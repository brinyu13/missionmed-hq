import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import type {
  DeleteObjectRequest,
  ObjectMetadata,
  PresignDownloadRequest,
  PresignUploadRequest,
  PutObjectRequest,
  S3CompatibleClientPort,
  S3ObjectBody,
  S3ObjectHead,
  SignedObjectGrant,
} from "./ports.js";
import { S3CompatibleClientError } from "./ports.js";

interface FilesystemManifest extends S3ObjectHead {
  bodyFile: string;
}

interface UploadGrantState {
  kind: "UPLOAD";
  token: string;
  key: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
  metadata: Record<string, string>;
  consumed: boolean;
  revoked: boolean;
}

interface DownloadGrantState {
  kind: "DOWNLOAD";
  token: string;
  key: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
  responseContentType: string;
  consumed: boolean;
  revoked: boolean;
}

type GrantState = UploadGrantState | DownloadGrantState;

interface IdempotentGrant {
  fingerprint: string;
  grant: SignedObjectGrant;
}

interface IdempotentPut {
  fingerprint: string;
  head: S3ObjectHead;
}

export interface DisposableFilesystemS3ClientOptions {
  parentDirectory?: string;
  directoryPrefix?: string;
  clock?: () => Date;
}

export interface SignedUploadHeaders {
  [name: string]: string | number;
}

function hash(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeMetadata(metadata: ObjectMetadata): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(metadata).sort(([left], [right]) => left.localeCompare(right))) {
    const name = rawName.toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(name)) throw new S3CompatibleClientError("S3_METADATA_INVALID", "Object metadata name is invalid.");
    if (rawValue.length > 2_048 || /[\r\n\u0000]/.test(rawValue)) {
      throw new S3CompatibleClientError("S3_METADATA_INVALID", "Object metadata value is invalid.");
    }
    normalized[name] = rawValue;
  }
  return normalized;
}

function stableMetadata(metadata: ObjectMetadata): string {
  return JSON.stringify(normalizeMetadata(metadata));
}

function validateKey(key: string): void {
  const segments = key.split("/");
  if (
    key.length < 1 ||
    key.length > 1_024 ||
    key.startsWith("/") ||
    key.endsWith("/") ||
    key.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(key) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new S3CompatibleClientError("S3_KEY_INVALID", "Object key is invalid.");
  }
}

function validateSha256(checksum: string): void {
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new S3CompatibleClientError("S3_CHECKSUM_INVALID", "SHA256 must be lowercase hexadecimal.");
}

function cloneHead(manifest: FilesystemManifest): S3ObjectHead {
  const { bodyFile: _bodyFile, ...head } = manifest;
  return structuredClone(head);
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : undefined;
}

/**
 * S3-compatible contract fixture backed by actual private files in a temporary
 * directory. It never starts a server and never contains a cloud endpoint or
 * credential. Its staging-object URLs are opaque capabilities understood only
 * by uploadSigned/downloadSigned.
 */
export class DisposableFilesystemS3Client implements S3CompatibleClientPort {
  readonly rootDirectory: string;
  private readonly objectDirectory: string;
  private readonly clock: () => Date;
  private readonly grants = new Map<string, GrantState>();
  private readonly grantTokensByKey = new Map<string, Set<string>>();
  private readonly grantIdempotency = new Map<string, IdempotentGrant>();
  private readonly putIdempotency = new Map<string, IdempotentPut>();
  private lockTail: Promise<void> = Promise.resolve();
  private disposed = false;

  private constructor(rootDirectory: string, clock: () => Date) {
    this.rootDirectory = rootDirectory;
    this.objectDirectory = join(rootDirectory, "objects");
    this.clock = clock;
  }

  static async create(options: DisposableFilesystemS3ClientOptions = {}): Promise<DisposableFilesystemS3Client> {
    const parent = options.parentDirectory ?? tmpdir();
    await mkdir(parent, { recursive: true, mode: 0o700 });
    const prefix = options.directoryPrefix ?? "mission-timeline-private-";
    if (!/^[a-zA-Z0-9._-]{1,80}$/.test(prefix)) throw new Error("FILESYSTEM_PREFIX_INVALID");
    const root = await mkdtemp(join(parent, prefix));
    await chmod(root, 0o700);
    const client = new DisposableFilesystemS3Client(root, options.clock ?? (() => new Date()));
    await mkdir(client.objectDirectory, { mode: 0o700 });
    return client;
  }

  async presignUpload(request: PresignUploadRequest): Promise<SignedObjectGrant> {
    this.ensureUsable();
    validateKey(request.key);
    validateSha256(request.checksumSha256);
    this.validateExpiry(request.expiresAt);
    if (!Number.isInteger(request.contentLength) || request.contentLength < 1) {
      throw new S3CompatibleClientError("S3_CONTENT_LENGTH_INVALID", "Content length is invalid.");
    }
    const metadata = normalizeMetadata(request.metadata);
    const requiredHeaders = {
      "content-type": request.contentType,
      "content-length": String(request.contentLength),
      "x-amz-checksum-sha256": Buffer.from(request.checksumSha256, "hex").toString("base64"),
    };
    const fingerprint = hash(
      JSON.stringify({
        kind: "UPLOAD",
        key: request.key,
        contentType: request.contentType,
        contentLength: request.contentLength,
        checksumSha256: request.checksumSha256,
        metadata,
        expiresAt: request.expiresAt,
      }),
    );
    const repeated = this.repeatedGrant(request.idempotencyKey, fingerprint);
    if (repeated) return repeated;

    const token = randomBytes(32).toString("base64url");
    const grant: SignedObjectGrant = {
      url: `staging-object+fs://upload/${token}`,
      expiresAt: request.expiresAt,
      requiredHeaders,
    };
    this.registerGrant({
      kind: "UPLOAD",
      token,
      key: request.key,
      expiresAt: request.expiresAt,
      requiredHeaders,
      metadata,
      consumed: false,
      revoked: false,
    });
    this.grantIdempotency.set(request.idempotencyKey, { fingerprint, grant: structuredClone(grant) });
    return structuredClone(grant);
  }

  async presignDownload(request: PresignDownloadRequest): Promise<SignedObjectGrant> {
    this.ensureUsable();
    validateKey(request.key);
    this.validateExpiry(request.expiresAt);
    if (request.singleUse !== true) throw new S3CompatibleClientError("S3_REPLAY_PROTECTION_REQUIRED", "Download grant must be single-use.");
    const fingerprint = hash(JSON.stringify({ kind: "DOWNLOAD", ...request }));
    const repeated = this.repeatedGrant(request.idempotencyKey, fingerprint);
    if (repeated) return repeated;

    const token = randomBytes(32).toString("base64url");
    const grant: SignedObjectGrant = {
      url: `staging-object+fs://download/${token}`,
      expiresAt: request.expiresAt,
      requiredHeaders: {},
    };
    this.registerGrant({
      kind: "DOWNLOAD",
      token,
      key: request.key,
      expiresAt: request.expiresAt,
      requiredHeaders: {},
      responseContentType: request.responseContentType,
      consumed: false,
      revoked: false,
    });
    this.grantIdempotency.set(request.idempotencyKey, { fingerprint, grant: structuredClone(grant) });
    return structuredClone(grant);
  }

  async uploadSigned(url: string, bytes: Uint8Array, headers: SignedUploadHeaders): Promise<S3ObjectHead> {
    const grant = this.consumeGrant(url, "UPLOAD");
    const normalizedHeaders = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value)]));
    for (const [name, value] of Object.entries(grant.requiredHeaders)) {
      if (normalizedHeaders[name] !== value) throw new S3CompatibleClientError("S3_SIGNED_HEADER_MISMATCH", `Required signed header ${name} did not match.`);
    }
    if (bytes.byteLength !== Number(grant.requiredHeaders["content-length"])) {
      throw new S3CompatibleClientError("S3_SIGNED_LENGTH_MISMATCH", "Signed upload length did not match.");
    }
    const checksumSha256 = hash(bytes);
    if (Buffer.from(checksumSha256, "hex").toString("base64") !== grant.requiredHeaders["x-amz-checksum-sha256"]) {
      throw new S3CompatibleClientError("S3_SIGNED_CHECKSUM_MISMATCH", "Signed upload checksum did not match.");
    }
    return this.putObject({
      key: grant.key,
      bytes,
      contentType: grant.requiredHeaders["content-type"]!,
      checksumSha256,
      metadata: grant.metadata,
      idempotencyKey: `signed-upload:${grant.token}`,
    });
  }

  async downloadSigned(url: string): Promise<S3ObjectBody> {
    const grant = this.consumeGrant(url, "DOWNLOAD");
    const object = await this.getObject(grant.key);
    if (object.contentType !== grant.responseContentType) {
      throw new S3CompatibleClientError("S3_RESPONSE_TYPE_MISMATCH", "Download response type did not match the grant.");
    }
    return object;
  }

  async headObject(key: string): Promise<S3ObjectHead | null> {
    this.ensureUsable();
    validateKey(key);
    return this.withLock(async () => {
      const manifest = await this.readManifest(key);
      return manifest ? cloneHead(manifest) : null;
    });
  }

  async getObject(key: string): Promise<S3ObjectBody> {
    this.ensureUsable();
    validateKey(key);
    return this.withLock(async () => {
      const manifest = await this.readManifest(key);
      if (!manifest) throw new S3CompatibleClientError("S3_OBJECT_NOT_FOUND", "Object was not found.");
      const bytes = new Uint8Array(await readFile(join(this.objectDirectory, manifest.bodyFile)));
      if (bytes.byteLength !== manifest.contentLength || hash(bytes) !== manifest.checksumSha256) {
        throw new S3CompatibleClientError("S3_OBJECT_INTEGRITY", "Filesystem object failed its integrity check.");
      }
      return { ...cloneHead(manifest), bytes };
    });
  }

  async putObject(request: PutObjectRequest): Promise<S3ObjectHead> {
    this.ensureUsable();
    validateKey(request.key);
    validateSha256(request.checksumSha256);
    if (hash(request.bytes) !== request.checksumSha256) {
      throw new S3CompatibleClientError("S3_CHECKSUM_MISMATCH", "Object body did not match its SHA256.");
    }
    const metadata = normalizeMetadata(request.metadata);
    const fingerprint = hash(
      JSON.stringify({
        key: request.key,
        body: request.checksumSha256,
        contentType: request.contentType,
        metadata,
        ifMatchEtag: request.ifMatchEtag ?? null,
        ifNoneMatch: request.ifNoneMatch ?? false,
      }),
    );

    return this.withLock(async () => {
      const repeated = this.putIdempotency.get(request.idempotencyKey);
      if (repeated) {
        if (repeated.fingerprint !== fingerprint) {
          throw new S3CompatibleClientError("S3_IDEMPOTENCY_CONFLICT", "Idempotency key was reused for different object data.");
        }
        return structuredClone(repeated.head);
      }

      const existing = await this.readManifest(request.key);
      if (request.ifNoneMatch && existing) throw new S3CompatibleClientError("S3_PRECONDITION_FAILED", "Object already exists.");
      if (request.ifMatchEtag && existing?.etag !== request.ifMatchEtag) {
        throw new S3CompatibleClientError("S3_PRECONDITION_FAILED", "Object ETag did not match.");
      }
      if (request.ifMatchEtag && !existing) throw new S3CompatibleClientError("S3_PRECONDITION_FAILED", "Object does not exist.");

      const timestamp = this.clock().toISOString();
      const etag = hash(`${request.checksumSha256}:${request.contentType}:${stableMetadata(metadata)}`);
      const keyHash = hash(request.key);
      const bodyFile = `${keyHash}.${randomUUID()}.body`;
      const bodyPath = join(this.objectDirectory, bodyFile);
      const manifestPath = this.manifestPath(request.key);
      const temporaryManifestPath = `${manifestPath}.${randomUUID()}.tmp`;
      const manifest: FilesystemManifest = {
        key: request.key,
        etag,
        contentType: request.contentType,
        contentLength: request.bytes.byteLength,
        checksumSha256: request.checksumSha256,
        metadata,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        bodyFile,
      };

      await writeFile(bodyPath, request.bytes, { mode: 0o600, flag: "wx" });
      try {
        await writeFile(temporaryManifestPath, `${JSON.stringify(manifest)}\n`, { mode: 0o600, flag: "wx" });
        await rename(temporaryManifestPath, manifestPath);
      } catch (error) {
        await unlink(bodyPath).catch(() => undefined);
        await unlink(temporaryManifestPath).catch(() => undefined);
        throw error;
      }
      if (existing) await unlink(join(this.objectDirectory, existing.bodyFile)).catch(() => undefined);
      const head = cloneHead(manifest);
      this.putIdempotency.set(request.idempotencyKey, { fingerprint, head: structuredClone(head) });
      return head;
    });
  }

  async deleteObject(request: DeleteObjectRequest): Promise<void> {
    this.ensureUsable();
    validateKey(request.key);
    await this.withLock(async () => {
      const manifest = await this.readManifest(request.key);
      if (!manifest) return;
      await unlink(this.manifestPath(request.key)).catch((error: unknown) => {
        if (errorCode(error) !== "ENOENT") throw error;
      });
      await unlink(join(this.objectDirectory, manifest.bodyFile)).catch((error: unknown) => {
        if (errorCode(error) !== "ENOENT") throw error;
      });
    });
  }

  async revokeObjectGrants(key: string): Promise<void> {
    this.ensureUsable();
    validateKey(key);
    for (const token of this.grantTokensByKey.get(key) ?? []) {
      const grant = this.grants.get(token);
      if (grant) grant.revoked = true;
    }
  }

  async objectCount(): Promise<number> {
    this.ensureUsable();
    return this.withLock(async () => {
      const { readdir } = await import("node:fs/promises");
      const names = await readdir(this.objectDirectory);
      return names.filter((name) => name.endsWith(".json")).length;
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.grants.clear();
    this.grantTokensByKey.clear();
    this.grantIdempotency.clear();
    this.putIdempotency.clear();
    await rm(this.rootDirectory, { recursive: true, force: true });
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.dispose();
  }

  private repeatedGrant(idempotencyKey: string, fingerprint: string): SignedObjectGrant | null {
    const repeated = this.grantIdempotency.get(idempotencyKey);
    if (!repeated) return null;
    if (repeated.fingerprint !== fingerprint) {
      throw new S3CompatibleClientError("S3_IDEMPOTENCY_CONFLICT", "Idempotency key was reused for a different signed grant.");
    }
    return structuredClone(repeated.grant);
  }

  private registerGrant(grant: GrantState): void {
    this.grants.set(grant.token, grant);
    const tokens = this.grantTokensByKey.get(grant.key) ?? new Set<string>();
    tokens.add(grant.token);
    this.grantTokensByKey.set(grant.key, tokens);
  }

  private consumeGrant(url: string, expectedKind: "UPLOAD"): UploadGrantState;
  private consumeGrant(url: string, expectedKind: "DOWNLOAD"): DownloadGrantState;
  private consumeGrant(url: string, expectedKind: GrantState["kind"]): GrantState {
    this.ensureUsable();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new S3CompatibleClientError("S3_GRANT_INVALID", "Signed object grant is invalid.");
    }
    const expectedHost = expectedKind === "UPLOAD" ? "upload" : "download";
    const token = parsed.pathname.slice(1);
    if (
      parsed.protocol !== "staging-object+fs:" ||
      parsed.hostname !== expectedHost ||
      !/^[a-zA-Z0-9_-]{40,}$/.test(token) ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password ||
      parsed.port
    ) {
      throw new S3CompatibleClientError("S3_GRANT_INVALID", "Signed object grant is invalid.");
    }
    const grant = this.grants.get(token);
    if (!grant || grant.kind !== expectedKind) throw new S3CompatibleClientError("S3_GRANT_INVALID", "Signed object grant is invalid.");
    if (grant.revoked) throw new S3CompatibleClientError("S3_GRANT_REVOKED", "Signed object grant was revoked.");
    if (grant.consumed) throw new S3CompatibleClientError("S3_GRANT_REPLAYED", "Signed object grant has already been used.");
    if (Date.parse(grant.expiresAt) <= this.clock().getTime()) {
      grant.consumed = true;
      throw new S3CompatibleClientError("S3_GRANT_EXPIRED", "Signed object grant expired.");
    }
    grant.consumed = true;
    return grant;
  }

  private validateExpiry(expiresAt: string): void {
    const value = Date.parse(expiresAt);
    if (!Number.isFinite(value) || value <= this.clock().getTime()) {
      throw new S3CompatibleClientError("S3_GRANT_EXPIRY_INVALID", "Signed object grant expiry is invalid.");
    }
  }

  private manifestPath(key: string): string {
    return join(this.objectDirectory, `${hash(key)}.json`);
  }

  private async readManifest(key: string): Promise<FilesystemManifest | null> {
    try {
      const parsed = JSON.parse(await readFile(this.manifestPath(key), "utf8")) as FilesystemManifest;
      if (
        parsed.key !== key ||
        !/^[a-f0-9]{64}\.[a-f0-9-]{36}\.body$/.test(parsed.bodyFile) ||
        basename(parsed.bodyFile) !== parsed.bodyFile ||
        !/^[a-f0-9]{64}$/.test(parsed.checksumSha256) ||
        !/^[a-f0-9]{64}$/.test(parsed.etag)
      ) {
        throw new S3CompatibleClientError("S3_MANIFEST_INVALID", "Filesystem object manifest is invalid.");
      }
      const bodyStats = await stat(join(this.objectDirectory, parsed.bodyFile));
      if (!bodyStats.isFile() || bodyStats.size !== parsed.contentLength) {
        throw new S3CompatibleClientError("S3_OBJECT_INTEGRITY", "Filesystem object size does not match its manifest.");
      }
      return parsed;
    } catch (error) {
      if (errorCode(error) === "ENOENT") return null;
      if (error instanceof S3CompatibleClientError) throw error;
      throw new S3CompatibleClientError("S3_MANIFEST_INVALID", "Filesystem object manifest could not be read.");
    }
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.lockTail;
    this.lockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private ensureUsable(): void {
    if (this.disposed) throw new S3CompatibleClientError("S3_CLIENT_DISPOSED", "Disposable filesystem client has been disposed.");
  }
}

export async function createDisposableFilesystemS3Client(
  options: DisposableFilesystemS3ClientOptions = {},
): Promise<DisposableFilesystemS3Client> {
  return DisposableFilesystemS3Client.create(options);
}
