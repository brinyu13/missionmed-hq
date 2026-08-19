import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type pg from "pg";

import type { ObjectRecord, PrincipalContext } from "../../contracts/types.js";
import { clone, newId, now, sha256 } from "../../core/canonical.js";
import { TimelineError } from "../../core/errors.js";
import { postgresClaimsFromPrincipal } from "../../persistence/postgres/types.js";
import type {
  PrivateObjectStore,
  SignedDownload,
  SignedUpload,
  UploadRequest,
} from "../private-object-store.js";

const MAX_SIGNED_URL_SECONDS = 5 * 60;
const DEFAULT_SIGNED_URL_SECONDS = 2 * 60;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const OBJECT_CLASSES = new Set<ObjectRecord["objectClass"]>([
  "SOURCE",
  "MEDIA",
  "EXPORT",
  "PREVIEW",
  "TEMP",
]);

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/html",
  "text/plain",
]);

const CLASS_MAX_BYTES: Record<ObjectRecord["objectClass"], number> = {
  SOURCE: 25 * 1024 * 1024,
  MEDIA: 15 * 1024 * 1024,
  EXPORT: MAX_UPLOAD_BYTES,
  PREVIEW: 5 * 1024 * 1024,
  TEMP: MAX_UPLOAD_BYTES,
};

interface UploadTokenPayload {
  version: 1;
  objectId: string;
  actorHash: string;
  expiresAt: string;
  nonce: string;
}

interface MediaRow extends pg.QueryResultRow {
  id: string;
  owner_principal_id: string;
  document_id: string;
  object_class: ObjectRecord["objectClass"];
  storage_key: string;
  mime_type: string;
  byte_size: string | number;
  content_sha256: string;
  status: ObjectRecord["status"];
  created_at: Date | string;
  confirmed_at: Date | string | null;
}

export interface ProductionMediaRepository {
  insertPending(context: PrincipalContext, record: ObjectRecord): Promise<ObjectRecord>;
  getAuthorized(context: PrincipalContext, objectId: string): Promise<ObjectRecord | null>;
  transition(
    context: PrincipalContext,
    objectId: string,
    expectedStatus: ObjectRecord["status"],
    nextStatus: ObjectRecord["status"],
    changedAt: string,
  ): Promise<ObjectRecord | null>;
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mediaRecord(row: MediaRow): ObjectRecord {
  return {
    id: row.id,
    ownerPrincipalId: row.owner_principal_id,
    documentId: row.document_id,
    objectClass: row.object_class,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    expectedBytes: Number(row.byte_size),
    expectedSha256: row.content_sha256,
    status: row.status,
    createdAt: asIso(row.created_at),
    ...(row.confirmed_at ? { confirmedAt: asIso(row.confirmed_at) } : {}),
  };
}

export class PostgresProductionMediaRepository implements ProductionMediaRepository {
  constructor(
    private readonly pool: pg.Pool,
    private readonly runtimeRole = "timeline_authenticated",
  ) {
    if (!/^[a-z_][a-z0-9_]*$/.test(runtimeRole)) throw new TypeError("PostgreSQL runtime role is invalid.");
  }

  async insertPending(context: PrincipalContext, record: ObjectRecord): Promise<ObjectRecord> {
    return this.withRls(context, async (client) => {
      const result = await client.query<MediaRow>(
        `insert into timeline.media_objects (
          id, document_id, owner_principal_id, object_class, storage_key,
          mime_type, byte_size, content_sha256, visibility, status, created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'PRIVATE', 'PENDING', $9)
        returning id, owner_principal_id, document_id, object_class, storage_key,
          mime_type, byte_size, content_sha256, status, created_at, confirmed_at`,
        [
          record.id,
          record.documentId,
          record.ownerPrincipalId,
          record.objectClass,
          record.storageKey,
          record.mimeType,
          record.expectedBytes,
          record.expectedSha256,
          record.createdAt,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new TimelineError("OBJECT_CUSTODY_WRITE_FAILED", "Object custody could not be recorded.", 503);
      return mediaRecord(row);
    });
  }

  async getAuthorized(context: PrincipalContext, objectId: string): Promise<ObjectRecord | null> {
    return this.withRls(context, async (client) => {
      const result = await client.query<MediaRow>(
        `select id, owner_principal_id, document_id, object_class, storage_key,
          mime_type, byte_size, content_sha256, status, created_at, confirmed_at
        from timeline.media_objects
        where id = $1`,
        [objectId],
      );
      return result.rows[0] ? mediaRecord(result.rows[0]) : null;
    });
  }

  async transition(
    context: PrincipalContext,
    objectId: string,
    expectedStatus: ObjectRecord["status"],
    nextStatus: ObjectRecord["status"],
    changedAt: string,
  ): Promise<ObjectRecord | null> {
    return this.withRls(context, async (client) => {
      const result = await client.query<MediaRow>(
        `update timeline.media_objects
        set status = $3,
            confirmed_at = case when $3 = 'CONFIRMED' then $4::timestamptz else confirmed_at end,
            deleted_at = case when $3 = 'DELETED' then $4::timestamptz else deleted_at end
        where id = $1 and status = $2
        returning id, owner_principal_id, document_id, object_class, storage_key,
          mime_type, byte_size, content_sha256, status, created_at, confirmed_at`,
        [objectId, expectedStatus, nextStatus, changedAt],
      );
      return result.rows[0] ? mediaRecord(result.rows[0]) : null;
    });
  }

  private async withRls<T>(
    context: PrincipalContext,
    work: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    let transactionStarted = false;
    let releaseError: Error | boolean | undefined;
    try {
      await client.query("BEGIN");
      transactionStarted = true;
      await client.query(`SET LOCAL ROLE ${this.runtimeRole}`);
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(postgresClaimsFromPrincipal(context)),
      ]);
      const result = await work(client);
      await client.query("COMMIT");
      transactionStarted = false;
      return result;
    } catch (error) {
      releaseError = error instanceof Error ? error : true;
      if (transactionStarted) await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release(releaseError);
    }
  }
}

export type R2Presigner = (
  client: S3Client,
  command: PutObjectCommand | GetObjectCommand,
  options: {
    expiresIn: number;
    signableHeaders?: Set<string>;
    unhoistableHeaders?: Set<string>;
  },
) => Promise<string>;

const R2_UPLOAD_SIGNABLE_HEADERS = new Set(["content-type"]);
const R2_UPLOAD_UNHOISTABLE_HEADERS = new Set([
  "x-amz-checksum-sha256",
  "x-amz-meta-object-id",
  "x-amz-meta-expected-sha256",
  "x-amz-meta-object-class",
]);

export interface R2PrivateObjectStoreOptions {
  client: S3Client;
  repository: ProductionMediaRepository;
  bucket: string;
  environment?: "production" | "staging" | "test";
  tokenSecret: string;
  signedUrlSeconds?: number;
  maxUploadBytes?: number;
  presign?: R2Presigner;
  clock?: () => Date;
}

export class R2PrivateObjectStore implements PrivateObjectStore {
  private readonly environment: "production" | "staging" | "test";
  private readonly signedUrlSeconds: number;
  private readonly maxUploadBytes: number;
  private readonly presign: R2Presigner;
  private readonly clock: () => Date;

  constructor(private readonly options: R2PrivateObjectStoreOptions) {
    if (!/^[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/.test(options.bucket)) throw new Error("TIMELINE_MEDIA_S3_BUCKET_INVALID");
    if (options.tokenSecret.length < 32) throw new Error("TIMELINE_MEDIA_TOKEN_SECRET_INVALID");
    this.environment = options.environment ?? "production";
    this.signedUrlSeconds = options.signedUrlSeconds ?? DEFAULT_SIGNED_URL_SECONDS;
    this.maxUploadBytes = options.maxUploadBytes ?? MAX_UPLOAD_BYTES;
    this.presign = options.presign ?? getSignedUrl;
    this.clock = options.clock ?? (() => new Date());
    if (!Number.isInteger(this.signedUrlSeconds) || this.signedUrlSeconds < 1 || this.signedUrlSeconds > MAX_SIGNED_URL_SECONDS) {
      throw new Error("TIMELINE_MEDIA_SIGNED_URL_TTL_SECONDS_INVALID");
    }
    if (!Number.isInteger(this.maxUploadBytes) || this.maxUploadBytes < 1 || this.maxUploadBytes > MAX_UPLOAD_BYTES) {
      throw new Error("TIMELINE_MEDIA_MAX_UPLOAD_BYTES_INVALID");
    }
  }

  async signUpload(context: PrincipalContext, request: UploadRequest): Promise<SignedUpload> {
    this.assertAuthenticated(context);
    this.validateUploadRequest(request);
    if (!["STUDENT", "SERVICE"].includes(context.role)) {
      throw new TimelineError("OBJECT_UPLOAD_ROLE_DENIED", "Object upload is not allowed for this role.", 403);
    }
    const ownerPrincipalId = context.role === "SERVICE" && request.ownerPrincipalId
      ? request.ownerPrincipalId
      : context.principalId;
    const objectId = newId("object");
    const createdAt = now(this.clock);
    const expiresAt = new Date(this.clock().getTime() + this.signedUrlSeconds * 1_000).toISOString();
    const storageKey = this.storageKey(ownerPrincipalId, request.documentId, request.objectClass, objectId);
    const record = await this.options.repository.insertPending(context, {
      id: objectId,
      ownerPrincipalId,
      documentId: request.documentId,
      objectClass: request.objectClass,
      storageKey,
      mimeType: request.mimeType,
      expectedBytes: request.byteSize,
      expectedSha256: request.sha256.toLowerCase(),
      status: "PENDING",
      createdAt,
    });
    const checksum = this.base64Checksum(record.expectedSha256);
    const command = new PutObjectCommand({
      Bucket: this.options.bucket,
      Key: record.storageKey,
      ContentType: record.mimeType,
      ChecksumSHA256: checksum,
      Metadata: {
        "object-id": record.id,
        "expected-sha256": record.expectedSha256,
        "object-class": record.objectClass,
      },
    });
    let uploadUrl: string;
    try {
      uploadUrl = await this.presign(this.options.client, command, {
        expiresIn: this.signedUrlSeconds,
        signableHeaders: R2_UPLOAD_SIGNABLE_HEADERS,
        unhoistableHeaders: R2_UPLOAD_UNHOISTABLE_HEADERS,
      });
    } catch (error) {
      throw this.storageUnavailable(error);
    }
    return {
      objectId: record.id,
      uploadUrl,
      uploadToken: this.issueUploadToken(context, record.id, expiresAt),
      expiresAt,
      requiredHeaders: {
        "content-type": record.mimeType,
        "x-amz-checksum-sha256": checksum,
        "x-amz-meta-object-id": record.id,
        "x-amz-meta-expected-sha256": record.expectedSha256,
        "x-amz-meta-object-class": record.objectClass,
      },
    };
  }

  async confirmUpload(context: PrincipalContext, objectId: string, uploadToken: string): Promise<ObjectRecord> {
    this.assertAuthenticated(context);
    this.verifyUploadToken(context, objectId, uploadToken);
    const record = await this.requireAuthorizedRecord(context, objectId);
    this.assertMutableBy(context, record);
    if (record.status !== "PENDING") throw new TimelineError("OBJECT_UPLOAD_NOT_PENDING", "Pending object not found.", 404);

    let head;
    try {
      head = await this.options.client.send(new HeadObjectCommand({
        Bucket: this.options.bucket,
        Key: record.storageKey,
        ChecksumMode: "ENABLED",
      }));
    } catch (error) {
      if (this.isNotFound(error)) throw new TimelineError("OBJECT_UPLOAD_MISSING", "Object bytes were not uploaded.", 409);
      throw this.storageUnavailable(error);
    }

    const mismatch = this.integrityMismatch(record, {
      contentLength: head.ContentLength,
      contentType: head.ContentType,
      checksumSha256: head.ChecksumSHA256,
      metadata: head.Metadata,
    });
    if (mismatch) {
      await this.options.repository.transition(context, objectId, "PENDING", "QUARANTINED", now(this.clock));
      throw new TimelineError(mismatch, "Object integrity does not match the signed request.", 409);
    }
    const confirmed = await this.options.repository.transition(context, objectId, "PENDING", "CONFIRMED", now(this.clock));
    if (!confirmed) throw new TimelineError("OBJECT_UPLOAD_REPLAYED", "Upload confirmation was already consumed.", 409);
    return clone(confirmed);
  }

  async signDownload(context: PrincipalContext, objectId: string): Promise<SignedDownload> {
    this.assertAuthenticated(context);
    const record = await this.requireAuthorizedRecord(context, objectId);
    // A SOURCE object is the student's own uploaded CV. The in-memory reference store
    // refuses to mint a download URL for anyone but its owner (or a SERVICE principal);
    // this path had lost that check, so any principal able to read the document could
    // presign the private file. MEDIA stays document-scoped so shared boards still load.
    if (record.objectClass === "SOURCE") this.assertMutableBy(context, record);
    if (record.status !== "CONFIRMED") throw new TimelineError("OBJECT_NOT_FOUND", "Object not found.", 404);
    const expiresAt = new Date(this.clock().getTime() + this.signedUrlSeconds * 1_000).toISOString();
    const command = new GetObjectCommand({
      Bucket: this.options.bucket,
      Key: record.storageKey,
      ResponseContentType: record.mimeType,
      ResponseContentDisposition: `attachment; filename="${record.id}"`,
    });
    try {
      return {
        downloadUrl: await this.presign(this.options.client, command, { expiresIn: this.signedUrlSeconds }),
        expiresAt,
      };
    } catch (error) {
      throw this.storageUnavailable(error);
    }
  }

  async putServiceObject(context: PrincipalContext, request: UploadRequest, bytes: Uint8Array): Promise<ObjectRecord> {
    if (context.role !== "SERVICE") throw new TimelineError("SERVICE_ROLE_REQUIRED", "Service role is required.", 403);
    if (bytes.byteLength !== request.byteSize || sha256(bytes) !== request.sha256.toLowerCase()) {
      throw new TimelineError("OBJECT_SERVICE_BYTES_INVALID", "Service object integrity is invalid.", 400);
    }
    const signed = await this.signUpload(context, request);
    const pending = await this.requireAuthorizedRecord(context, signed.objectId);
    try {
      await this.options.client.send(new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: pending.storageKey,
        Body: bytes,
        ContentType: pending.mimeType,
        ContentLength: pending.expectedBytes,
        ChecksumSHA256: this.base64Checksum(pending.expectedSha256),
        Metadata: {
          "object-id": pending.id,
          "expected-sha256": pending.expectedSha256,
          "object-class": pending.objectClass,
        },
      }));
    } catch (error) {
      throw this.storageUnavailable(error);
    }
    return this.confirmUpload(context, signed.objectId, signed.uploadToken);
  }

  async getObject(_objectId: string): Promise<ObjectRecord | null> {
    throw new TimelineError(
      "OBJECT_AUTHORIZATION_CONTEXT_REQUIRED",
      "Use an authenticated object operation.",
      401,
    );
  }

  async getAuthorizedObject(context: PrincipalContext, objectId: string): Promise<ObjectRecord | null> {
    this.assertAuthenticated(context);
    return this.options.repository.getAuthorized(context, objectId);
  }

  async deleteObject(context: PrincipalContext, objectId: string): Promise<void> {
    this.assertAuthenticated(context);
    const record = await this.requireAuthorizedRecord(context, objectId);
    this.assertMutableBy(context, record);
    if (record.status === "DELETED") return;
    try {
      await this.options.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: record.storageKey }));
    } catch (error) {
      throw this.storageUnavailable(error);
    }
    const deleted = await this.options.repository.transition(context, objectId, record.status, "DELETED", now(this.clock));
    if (!deleted) throw new TimelineError("OBJECT_STATE_CHANGED", "Object state changed during deletion.", 409);
  }

  private validateUploadRequest(request: UploadRequest): void {
    if (!/^[-_a-zA-Z0-9]{1,128}$/.test(request.documentId)) {
      throw new TimelineError("OBJECT_DOCUMENT_INVALID", "Document ID is invalid.", 400);
    }
    if (!OBJECT_CLASSES.has(request.objectClass)) throw new TimelineError("OBJECT_CLASS_INVALID", "Object class is invalid.", 400);
    if (!ALLOWED_MIME.has(request.mimeType)) throw new TimelineError("OBJECT_MIME_DENIED", "MIME type is not allowed.", 415);
    const maximum = Math.min(CLASS_MAX_BYTES[request.objectClass], this.maxUploadBytes);
    if (!Number.isInteger(request.byteSize) || request.byteSize < 1 || request.byteSize > maximum) {
      throw new TimelineError("OBJECT_SIZE_DENIED", "Object size is outside the allowed range.", 413);
    }
    if (!/^[a-f0-9]{64}$/i.test(request.sha256)) throw new TimelineError("OBJECT_HASH_INVALID", "SHA256 is required.", 400);
  }

  private assertAuthenticated(context: PrincipalContext): void {
    if (!context?.principalId || !context.sessionId || !context.requestId) {
      throw new TimelineError("OBJECT_AUTHENTICATION_REQUIRED", "Authenticated storage context is required.", 401);
    }
  }

  private assertMutableBy(context: PrincipalContext, record: ObjectRecord): void {
    if (context.role === "SERVICE") return;
    if (context.role !== "STUDENT" || record.ownerPrincipalId !== context.principalId) {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403);
    }
  }

  private async requireAuthorizedRecord(context: PrincipalContext, objectId: string): Promise<ObjectRecord> {
    const record = await this.options.repository.getAuthorized(context, objectId);
    if (!record) throw new TimelineError("OBJECT_NOT_FOUND", "Object not found.", 404);
    return record;
  }

  private storageKey(
    ownerPrincipalId: string,
    documentId: string,
    objectClass: ObjectRecord["objectClass"],
    objectId: string,
  ): string {
    return [
      "timeline",
      "private",
      this.environment,
      "users",
      this.scopeHash(ownerPrincipalId),
      "documents",
      this.scopeHash(documentId),
      objectClass.toLowerCase(),
      this.scopeHash(objectId),
      randomBytes(32).toString("hex"),
    ].join("/");
  }

  private issueUploadToken(context: PrincipalContext, objectId: string, expiresAt: string): string {
    const payload: UploadTokenPayload = {
      version: 1,
      objectId,
      actorHash: this.scopeHash(context.principalId),
      expiresAt,
      nonce: randomBytes(24).toString("base64url"),
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `${encoded}.${this.sign(encoded)}`;
  }

  private verifyUploadToken(context: PrincipalContext, objectId: string, token: string): void {
    const [encoded, suppliedSignature, extra] = token.split(".");
    if (!encoded || !suppliedSignature || extra !== undefined) {
      throw new TimelineError("OBJECT_UPLOAD_TOKEN_INVALID", "Upload token is invalid.", 401);
    }
    const expectedSignature = this.sign(encoded);
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new TimelineError("OBJECT_UPLOAD_TOKEN_INVALID", "Upload token is invalid.", 401);
    }
    let payload: UploadTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as UploadTokenPayload;
    } catch {
      throw new TimelineError("OBJECT_UPLOAD_TOKEN_INVALID", "Upload token is invalid.", 401);
    }
    const expiresAt = new Date(payload.expiresAt);
    if (
      payload.version !== 1
      || payload.objectId !== objectId
      || payload.actorHash !== this.scopeHash(context.principalId)
      || !payload.nonce
      || Number.isNaN(expiresAt.getTime())
    ) {
      throw new TimelineError("OBJECT_UPLOAD_TOKEN_INVALID", "Upload token is invalid.", 401);
    }
    if (expiresAt.getTime() <= this.clock().getTime()) {
      throw new TimelineError("OBJECT_UPLOAD_EXPIRED", "Upload authorization expired.", 401);
    }
  }

  private integrityMismatch(
    record: ObjectRecord,
    head: {
      contentLength?: number;
      contentType?: string;
      checksumSha256?: string;
      metadata?: Record<string, string>;
    },
  ): "OBJECT_SIZE_MISMATCH" | "OBJECT_MIME_MISMATCH" | "OBJECT_HASH_MISMATCH" | null {
    if (head.contentLength !== record.expectedBytes) return "OBJECT_SIZE_MISMATCH";
    if (head.contentType !== record.mimeType) return "OBJECT_MIME_MISMATCH";
    const checksum = this.base64Checksum(record.expectedSha256);
    if (
      head.checksumSha256 !== checksum
      || head.metadata?.["expected-sha256"] !== record.expectedSha256
      || head.metadata?.["object-id"] !== record.id
      || head.metadata?.["object-class"] !== record.objectClass
    ) return "OBJECT_HASH_MISMATCH";
    return null;
  }

  private base64Checksum(hex: string): string {
    return Buffer.from(hex, "hex").toString("base64");
  }

  private scopeHash(value: string): string {
    return createHmac("sha256", this.options.tokenSecret).update(value).digest("hex").slice(0, 32);
  }

  private sign(value: string): string {
    return createHmac("sha256", this.options.tokenSecret).update(value).digest("base64url");
  }

  private isNotFound(error: unknown): boolean {
    const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return candidate?.name === "NotFound" || candidate?.$metadata?.httpStatusCode === 404;
  }

  private storageUnavailable(error: unknown): TimelineError {
    const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    return new TimelineError("PRIVATE_OBJECT_STORAGE_UNAVAILABLE", "Private object storage is unavailable.", 503, {
      providerCode: candidate?.name ?? "R2_ERROR",
      providerStatus: candidate?.$metadata?.httpStatusCode ?? null,
      retryable: true,
    });
  }
}

const REQUIRED_R2_ENV = [
  "TIMELINE_MEDIA_S3_ENDPOINT",
  "TIMELINE_MEDIA_S3_REGION",
  "TIMELINE_MEDIA_S3_BUCKET",
  "TIMELINE_MEDIA_S3_ACCESS_KEY_ID",
  "TIMELINE_MEDIA_S3_SECRET_ACCESS_KEY",
  "TIMELINE_MEDIA_SIGNED_URL_TTL_SECONDS",
  "TIMELINE_MEDIA_MAX_UPLOAD_BYTES",
] as const;

export interface R2EnvironmentConfig {
  endpoint: string;
  region: "auto";
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  signedUrlSeconds: number;
  maxUploadBytes: number;
}

export function readR2Environment(env: NodeJS.ProcessEnv): R2EnvironmentConfig | null {
  const present = REQUIRED_R2_ENV.filter((name) => Boolean(env[name]?.trim()));
  if (present.length === 0) return null;
  const missing = REQUIRED_R2_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) throw new Error(`TIMELINE_MEDIA_STORAGE_CONFIGURATION_INCOMPLETE:${missing.join(",")}`);
  let endpoint: URL;
  try {
    endpoint = new URL(env.TIMELINE_MEDIA_S3_ENDPOINT!.trim());
  } catch {
    throw new Error("TIMELINE_MEDIA_S3_ENDPOINT_INVALID");
  }
  if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".r2.cloudflarestorage.com") || endpoint.username || endpoint.password) {
    throw new Error("TIMELINE_MEDIA_S3_ENDPOINT_INVALID");
  }
  if (env.TIMELINE_MEDIA_S3_REGION!.trim() !== "auto") throw new Error("TIMELINE_MEDIA_S3_REGION_MUST_BE_AUTO");
  if (env.TIMELINE_MEDIA_KMS_KEY_ID?.trim()) throw new Error("TIMELINE_MEDIA_KMS_KEY_UNSUPPORTED_FOR_R2");
  const signedUrlSeconds = Number(env.TIMELINE_MEDIA_SIGNED_URL_TTL_SECONDS);
  const maxUploadBytes = Number(env.TIMELINE_MEDIA_MAX_UPLOAD_BYTES);
  return {
    endpoint: endpoint.toString().replace(/\/$/, ""),
    region: "auto",
    bucket: env.TIMELINE_MEDIA_S3_BUCKET!.trim(),
    accessKeyId: env.TIMELINE_MEDIA_S3_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.TIMELINE_MEDIA_S3_SECRET_ACCESS_KEY!.trim(),
    signedUrlSeconds,
    maxUploadBytes,
  };
}

export function createR2PrivateObjectStoreFromEnvironment(options: {
  env: NodeJS.ProcessEnv;
  pool: pg.Pool;
  runtimeRole: string;
  tokenSecret: string;
}): R2PrivateObjectStore | null {
  const config = readR2Environment(options.env);
  if (!config) return null;
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return new R2PrivateObjectStore({
    client,
    repository: new PostgresProductionMediaRepository(options.pool, options.runtimeRole),
    bucket: config.bucket,
    environment: "production",
    tokenSecret: options.tokenSecret,
    signedUrlSeconds: config.signedUrlSeconds,
    maxUploadBytes: config.maxUploadBytes,
  });
}
