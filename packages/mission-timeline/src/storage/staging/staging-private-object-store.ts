import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import type { ObjectRecord, PrincipalContext } from "../../contracts/types.js";
import { clone, newId, now, sha256 } from "../../core/canonical.js";
import { TimelineError } from "../../core/errors.js";
import { assertOwnedObjectIngestion, type PrivateObjectStore, type SignedDownload, type SignedUpload, type UploadRequest } from "../private-object-store.js";
import { ExifStrippingJpegSanitizer, hasJpegPrivacyMetadata, matchesDeclaredMimeType } from "./content-validation.js";
import type {
  MalwareScanResult,
  MalwareScannerPort,
  PrivateObjectSanitizerPort,
  PrivateStorageAuthorizationPort,
  PrivateStorageAuditEvent,
  PrivateStorageAuditSink,
  PrivateStorageOperation,
  PrivateStorageResource,
  S3CompatibleClientPort,
  S3ObjectBody,
} from "./ports.js";
import { InMemoryPrivateStorageAuditSink, S3CompatibleClientError } from "./ports.js";

const MAX_SIGNED_GRANT_MS = 5 * 60 * 1_000;
const DEFAULT_UPLOAD_EXPIRY_MS = 2 * 60 * 1_000;
const DEFAULT_DOWNLOAD_EXPIRY_MS = 60 * 1_000;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/json",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/html",
  "text/plain",
]);

const MAX_BYTES: Record<ObjectRecord["objectClass"], number> = {
  SOURCE: 25 * 1024 * 1024,
  MEDIA: 15 * 1024 * 1024,
  EXPORT: 50 * 1024 * 1024,
  PREVIEW: 5 * 1024 * 1024,
  TEMP: 50 * 1024 * 1024,
};

export interface StagingUploadRequest extends UploadRequest {
  /** Required when the actor has zero or multiple program memberships. */
  programId?: string;
  idempotencyKey?: string;
}

export interface LifecycleRule {
  retentionClass: string;
  pendingTtlMs: number;
  confirmedTtlMs: number | null;
  quarantineTtlMs: number;
}

export type LifecycleRules = Record<ObjectRecord["objectClass"], LifecycleRule>;

const DEFAULT_LIFECYCLE_RULES: LifecycleRules = {
  SOURCE: { retentionClass: "source-policy", pendingTtlMs: 7 * 24 * 60 * 60 * 1_000, confirmedTtlMs: null, quarantineTtlMs: 7 * 24 * 60 * 60 * 1_000 },
  MEDIA: { retentionClass: "media-policy", pendingTtlMs: 24 * 60 * 60 * 1_000, confirmedTtlMs: null, quarantineTtlMs: 7 * 24 * 60 * 60 * 1_000 },
  EXPORT: { retentionClass: "artifact-policy", pendingTtlMs: 24 * 60 * 60 * 1_000, confirmedTtlMs: null, quarantineTtlMs: 7 * 24 * 60 * 60 * 1_000 },
  PREVIEW: { retentionClass: "preview-policy", pendingTtlMs: 24 * 60 * 60 * 1_000, confirmedTtlMs: null, quarantineTtlMs: 7 * 24 * 60 * 60 * 1_000 },
  TEMP: { retentionClass: "temporary-24h", pendingTtlMs: 24 * 60 * 60 * 1_000, confirmedTtlMs: 24 * 60 * 60 * 1_000, quarantineTtlMs: 24 * 60 * 60 * 1_000 },
};

export interface StorageRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
}

export interface StagingPrivateObjectStoreOptions {
  client: S3CompatibleClientPort;
  malwareScanner: MalwareScannerPort;
  authorization: PrivateStorageAuthorizationPort;
  jpegSanitizer?: PrivateObjectSanitizerPort;
  auditSink?: PrivateStorageAuditSink;
  environment?: "test" | "staging";
  uploadExpiryMs?: number;
  downloadExpiryMs?: number;
  lifecyclePolicyVersion?: string;
  lifecycleRules?: Partial<Record<ObjectRecord["objectClass"], Partial<LifecycleRule>>>;
  retryPolicy?: Partial<StorageRetryPolicy>;
  clock?: () => Date;
  sleep?: (delayMs: number) => Promise<void>;
}

export interface StagingObjectMetadata {
  record: ObjectRecord;
  lifecycle: {
    policyVersion: string;
    retentionClass: string;
    deleteAfter: string | null;
  };
  integrity: {
    expectedBytes: number;
    expectedSha256: string;
    storedBytes: number | null;
    storedSha256: string | null;
  };
  malwareScan: MalwareScanResult | null;
  sanitization: {
    sanitizer: string;
    sanitizerVersion: string;
    removedMetadata: boolean;
  } | null;
  quarantine: {
    reasonCode: string;
    quarantinedAt: string;
    persisted: boolean;
  } | null;
  deletedAt: string | null;
}

export interface TemporaryCleanupResult {
  examined: number;
  eligible: number;
  deleted: number;
  failed: number;
}

export interface StagingObjectListRequest {
  programId: string;
  documentId?: string;
  ownerPrincipalId?: string;
  includeDeleted?: boolean;
}

interface StoredState {
  record: ObjectRecord;
  programId: string;
  storageKeys: Set<string>;
  tokenHash: string | null;
  uploadExpiresAt: string | null;
  requestFingerprint: string;
  idempotencyScope: string | null;
  grantGeneration: number;
  lifecycle: {
    rule: LifecycleRule;
    deleteAfter: string | null;
  };
  storedBytes: number | null;
  storedSha256: string | null;
  malwareScan: MalwareScanResult | null;
  sanitization: StagingObjectMetadata["sanitization"];
  quarantine: StagingObjectMetadata["quarantine"];
  deletedAt: string | null;
}

interface IdempotencyEntry {
  fingerprint: string;
  objectId: string;
}

interface RetryResult<T> {
  value: T;
  attempts: number;
}

function timelineErrorCode(error: unknown): string {
  if (error instanceof TimelineError) return error.code;
  if (error instanceof S3CompatibleClientError) return error.code;
  return "OBJECT_STORAGE_FAILURE";
}

function auditOutcome(error: unknown): "FAILURE" | "DENY" {
  if (error instanceof TimelineError && [401, 403, 404].includes(error.status)) return "DENY";
  return "FAILURE";
}

function addMilliseconds(value: Date, milliseconds: number): string {
  return new Date(value.getTime() + milliseconds).toISOString();
}

function validateDuration(value: number, name: string, maximum?: number): void {
  if (!Number.isInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) throw new Error(`${name}_INVALID`);
}

function mergeLifecycleRules(
  overrides: StagingPrivateObjectStoreOptions["lifecycleRules"],
): LifecycleRules {
  const merged = {} as LifecycleRules;
  for (const objectClass of Object.keys(DEFAULT_LIFECYCLE_RULES) as ObjectRecord["objectClass"][]) {
    const rule = { ...DEFAULT_LIFECYCLE_RULES[objectClass], ...overrides?.[objectClass] };
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(rule.retentionClass)) throw new Error("LIFECYCLE_RETENTION_CLASS_INVALID");
    validateDuration(rule.pendingTtlMs, "LIFECYCLE_PENDING_TTL");
    validateDuration(rule.quarantineTtlMs, "LIFECYCLE_QUARANTINE_TTL");
    if (rule.confirmedTtlMs !== null) validateDuration(rule.confirmedTtlMs, "LIFECYCLE_CONFIRMED_TTL");
    merged[objectClass] = rule;
  }
  return merged;
}

export function isOpaquePrivateStorageKey(key: string): boolean {
  return /^private\/(?:test|staging)\/(?:objects|quarantine)(?:\/[a-f0-9]{32}){4}\/[a-f0-9]{64}$/.test(key);
}

export class StagingPrivateObjectStore implements PrivateObjectStore {
  private readonly client: S3CompatibleClientPort;
  private readonly malwareScanner: MalwareScannerPort;
  private readonly authorization: PrivateStorageAuthorizationPort;
  private readonly jpegSanitizer: PrivateObjectSanitizerPort;
  private readonly auditSink: PrivateStorageAuditSink;
  private readonly environment: "test" | "staging";
  private readonly uploadExpiryMs: number;
  private readonly downloadExpiryMs: number;
  private readonly lifecyclePolicyVersion: string;
  private readonly lifecycleRules: LifecycleRules;
  private readonly retryPolicy: StorageRetryPolicy;
  private readonly clock: () => Date;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly tokenSecret = randomBytes(32);
  private readonly objects = new Map<string, StoredState>();
  private readonly idempotency = new Map<string, IdempotencyEntry>();
  private readonly auditEvents: PrivateStorageAuditEvent[] = [];
  private readonly lockTails = new Map<string, Promise<void>>();

  constructor(options: StagingPrivateObjectStoreOptions) {
    this.client = options.client;
    this.malwareScanner = options.malwareScanner;
    this.authorization = options.authorization;
    this.jpegSanitizer = options.jpegSanitizer ?? new ExifStrippingJpegSanitizer();
    this.auditSink = options.auditSink ?? new InMemoryPrivateStorageAuditSink();
    const environment = options.environment ?? "staging";
    if (environment !== "test" && environment !== "staging") throw new Error("STAGING_ENVIRONMENT_REQUIRED");
    this.environment = environment;
    this.uploadExpiryMs = options.uploadExpiryMs ?? DEFAULT_UPLOAD_EXPIRY_MS;
    this.downloadExpiryMs = options.downloadExpiryMs ?? DEFAULT_DOWNLOAD_EXPIRY_MS;
    validateDuration(this.uploadExpiryMs, "UPLOAD_EXPIRY", MAX_SIGNED_GRANT_MS);
    validateDuration(this.downloadExpiryMs, "DOWNLOAD_EXPIRY", MAX_SIGNED_GRANT_MS);
    this.lifecyclePolicyVersion = options.lifecyclePolicyVersion ?? "staging-v1";
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(this.lifecyclePolicyVersion)) throw new Error("LIFECYCLE_POLICY_VERSION_INVALID");
    this.lifecycleRules = mergeLifecycleRules(options.lifecycleRules);
    this.retryPolicy = {
      maxAttempts: options.retryPolicy?.maxAttempts ?? 3,
      baseDelayMs: options.retryPolicy?.baseDelayMs ?? 10,
    };
    validateDuration(this.retryPolicy.maxAttempts, "STORAGE_RETRY_ATTEMPTS", 8);
    if (!Number.isInteger(this.retryPolicy.baseDelayMs) || this.retryPolicy.baseDelayMs < 0 || this.retryPolicy.baseDelayMs > 5_000) {
      throw new Error("STORAGE_RETRY_DELAY_INVALID");
    }
    this.clock = options.clock ?? (() => new Date());
    this.sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  async signUpload(context: PrincipalContext, request: StagingUploadRequest): Promise<SignedUpload> {
    const objectIdForAudit = { value: null as string | null };
    try {
      this.requireAuthenticatedContext(context);
      this.validateUploadRequest(context, request);
      const ownerPrincipalId = this.ownerFor(context, request);
      const programId = this.programFor(context, request);
      await this.assertAuthorized(context, "CREATE", {
        resourceType: "OBJECT",
        programId,
        ownerPrincipalId,
        documentId: request.documentId,
        objectClass: request.objectClass,
      });
      const fingerprint = this.requestFingerprint(programId, ownerPrincipalId, request);
      const scope = request.idempotencyKey ? this.idempotencyScope(programId, ownerPrincipalId, request.idempotencyKey) : null;
      const lockName = scope ? `idempotency:${scope}` : `new:${randomUUID()}`;
      const signed = await this.withLock(lockName, async () => {
        if (scope) {
          const repeated = this.idempotency.get(scope);
          if (repeated) {
            if (repeated.fingerprint !== fingerprint) {
              throw new TimelineError("OBJECT_IDEMPOTENCY_CONFLICT", "Idempotency key was reused for a different upload.", 409);
            }
            const state = this.objects.get(repeated.objectId);
            if (!state) throw new TimelineError("OBJECT_STATE_MISSING", "Object state is unavailable.", 500);
            objectIdForAudit.value = state.record.id;
            if (state.record.status === "CONFIRMED") {
              throw new TimelineError("OBJECT_IDEMPOTENCY_COMPLETE", "Idempotent upload is already confirmed.", 409);
            }
            if (state.record.status !== "PENDING") {
              throw new TimelineError("OBJECT_UPLOAD_NOT_PENDING", "Pending object not found.", 404);
            }
            await this.retry(() => this.client.revokeObjectGrants(state.record.storageKey));
            return this.issueUploadGrant(state);
          }
        }

        const state = this.createPendingState(programId, ownerPrincipalId, request, fingerprint, scope);
        objectIdForAudit.value = state.record.id;
        this.objects.set(state.record.id, state);
        if (scope) this.idempotency.set(scope, { fingerprint, objectId: state.record.id });
        try {
          return await this.issueUploadGrant(state);
        } catch (error) {
          this.objects.delete(state.record.id);
          if (scope) this.idempotency.delete(scope);
          throw error;
        }
      });
      await this.audit(context, "UPLOAD_SIGNED", objectIdForAudit.value, "SUCCESS", null, {
        object_class: request.objectClass,
        expiry_seconds: Math.floor(this.uploadExpiryMs / 1_000),
      });
      return signed;
    } catch (error) {
      await this.auditFailure(context, "UPLOAD_SIGNED", objectIdForAudit.value, error);
      throw error;
    }
  }

  async confirmUpload(context: PrincipalContext, objectId: string, uploadToken: string): Promise<ObjectRecord> {
    return this.withLock(`object:${objectId}`, async () => {
      try {
        this.requireAuthenticatedContext(context);
        const state = this.requireState(objectId);
        await this.authorizeState(context, state, "WRITE");
        this.validateConfirmationAuthorization(state, uploadToken);

        const headResult = await this.retry(() => this.client.headObject(state.record.storageKey));
        if (!headResult.value) throw new TimelineError("OBJECT_UPLOAD_MISSING", "Object bytes were not uploaded.", 409);
        let bodyResult: RetryResult<S3ObjectBody>;
        try {
          bodyResult = await this.retry(() => this.client.getObject(state.record.storageKey));
        } catch (error) {
          await this.quarantine(context, state, null, "OBJECT_STORAGE_INTEGRITY", headResult.attempts);
          throw new TimelineError("OBJECT_STORAGE_INTEGRITY", "Uploaded object could not be verified.", 409, { cause: timelineErrorCode(error) });
        }
        const uploaded = bodyResult.value;
        const attempts = headResult.attempts + bodyResult.attempts;

        if (uploaded.contentLength !== state.record.expectedBytes || uploaded.bytes.byteLength !== state.record.expectedBytes) {
          await this.quarantineAndThrow(context, state, uploaded.bytes, "OBJECT_SIZE_MISMATCH", "Object size does not match the signed request.", attempts);
        }
        if (uploaded.contentType !== state.record.mimeType) {
          await this.quarantineAndThrow(context, state, uploaded.bytes, "OBJECT_MIME_MISMATCH", "Object MIME type does not match the signed request.", attempts);
        }
        const actualSha256 = sha256(uploaded.bytes);
        if (uploaded.checksumSha256 !== state.record.expectedSha256 || actualSha256 !== state.record.expectedSha256) {
          await this.quarantineAndThrow(context, state, uploaded.bytes, "OBJECT_HASH_MISMATCH", "Object checksum does not match the signed request.", attempts);
        }
        if (!this.matchesPendingMetadata(uploaded.metadata, state)) {
          await this.quarantineAndThrow(context, state, uploaded.bytes, "OBJECT_METADATA_MISMATCH", "Object metadata does not match the pending record.", attempts);
        }
        if (!matchesDeclaredMimeType(state.record.mimeType, uploaded.bytes)) {
          await this.quarantineAndThrow(context, state, uploaded.bytes, "OBJECT_MAGIC_MISMATCH", "Object content does not match its declared MIME type.", attempts);
        }

        const initialScan = await this.scanOrQuarantine(context, state, uploaded.bytes, attempts);
        let finalBytes = uploaded.bytes;
        let sanitization: StoredState["sanitization"] = null;
        if (state.record.mimeType === "image/jpeg") {
          try {
            const result = await this.jpegSanitizer.sanitize({
              objectId: state.record.id,
              bytes: new Uint8Array(uploaded.bytes),
              mimeType: state.record.mimeType,
            });
            if (
              !matchesDeclaredMimeType("image/jpeg", result.bytes) ||
              hasJpegPrivacyMetadata(result.bytes) ||
              !result.sanitizer ||
              !result.sanitizerVersion
            ) {
              throw new Error("SANITIZER_OUTPUT_INVALID");
            }
            finalBytes = new Uint8Array(result.bytes);
            sanitization = {
              sanitizer: result.sanitizer,
              sanitizerVersion: result.sanitizerVersion,
              removedMetadata: result.removedMetadata,
            };
          } catch {
            await this.quarantineAndThrow(
              context,
              state,
              uploaded.bytes,
              "OBJECT_SANITIZATION_FAILED",
              "JPEG privacy metadata sanitization failed closed.",
              attempts,
              422,
            );
          }
          await this.scanOrQuarantine(context, state, finalBytes, attempts);
        }

        const storedSha256 = sha256(finalBytes);
        const confirmedAt = now(this.clock);
        const deleteAfter = state.lifecycle.rule.confirmedTtlMs === null
          ? null
          : addMilliseconds(this.clock(), state.lifecycle.rule.confirmedTtlMs);
        const confirmedMetadata = this.storageMetadata(state, {
          status: "CONFIRMED",
          deleteAfter,
          storedBytes: finalBytes.byteLength,
          storedSha256,
          malwareStatus: initialScan.status,
          sanitized: sanitization !== null,
        });
        const writeResult = await this.retry(() =>
          this.client.putObject({
            key: state.record.storageKey,
            bytes: finalBytes,
            contentType: state.record.mimeType,
            checksumSha256: storedSha256,
            metadata: confirmedMetadata,
            idempotencyKey: `confirm:${state.record.id}:${storedSha256}`,
            ifMatchEtag: uploaded.etag,
          }),
        );
        await this.retry(() => this.client.revokeObjectGrants(state.record.storageKey));

        state.record.status = "CONFIRMED";
        state.record.confirmedAt = confirmedAt;
        state.tokenHash = null;
        state.uploadExpiresAt = null;
        state.lifecycle.deleteAfter = deleteAfter;
        state.storedBytes = finalBytes.byteLength;
        state.storedSha256 = storedSha256;
        state.malwareScan = initialScan;
        state.sanitization = sanitization;
        await this.audit(context, "UPLOAD_CONFIRMED", state.record.id, "SUCCESS", null, {
          object_class: state.record.objectClass,
          attempts: attempts + writeResult.attempts,
          sanitized: sanitization !== null,
        });
        return clone(state.record);
      } catch (error) {
        await this.auditFailure(context, "UPLOAD_CONFIRMED", objectId, error);
        throw error;
      }
    });
  }

  async signDownload(context: PrincipalContext, objectId: string): Promise<SignedDownload> {
    try {
      this.requireAuthenticatedContext(context);
      const signed = await this.withLock(`object:${objectId}`, async () => {
        const state = this.requireState(objectId);
        await this.authorizeState(context, state, "READ");
        if (state.record.status !== "CONFIRMED") throw new TimelineError("OBJECT_NOT_FOUND", "Object not found.", 404);
        if (state.lifecycle.deleteAfter && state.lifecycle.deleteAfter <= now(this.clock)) {
          throw new TimelineError("OBJECT_EXPIRED", "Object retention period has expired.", 410);
        }
        const head = await this.retry(() => this.client.headObject(state.record.storageKey));
        if (!head.value || head.value.checksumSha256 !== state.storedSha256 || head.value.contentLength !== state.storedBytes) {
          await this.quarantine(context, state, null, "OBJECT_STORED_INTEGRITY_MISMATCH", head.attempts);
          throw new TimelineError("OBJECT_STORED_INTEGRITY_MISMATCH", "Stored object failed integrity verification.", 409);
        }
        const expiresAt = addMilliseconds(this.clock(), this.downloadExpiryMs);
        const grant = await this.retry(() =>
          this.client.presignDownload({
            key: state.record.storageKey,
            responseContentType: state.record.mimeType,
            expiresAt,
            idempotencyKey: `download:${state.record.id}:${randomUUID()}`,
            singleUse: true,
          }),
        );
        return { downloadUrl: grant.value.url, expiresAt: grant.value.expiresAt };
      });
      await this.audit(context, "DOWNLOAD_SIGNED", objectId, "SUCCESS", null, {
        expiry_seconds: Math.floor(this.downloadExpiryMs / 1_000),
      });
      return signed;
    } catch (error) {
      await this.auditFailure(context, "DOWNLOAD_SIGNED", objectId, error);
      throw error;
    }
  }

  async putServiceObject(context: PrincipalContext, request: StagingUploadRequest, bytes: Uint8Array): Promise<ObjectRecord> {
    this.requireAuthenticatedContext(context);
    if (context.role !== "SERVICE") throw new TimelineError("SERVICE_ROLE_REQUIRED", "Service role is required.", 403);
    this.validateUploadRequest(context, request);
    const ownerPrincipalId = this.ownerFor(context, request);
    const programId = this.programFor(context, request);
    const fingerprint = this.requestFingerprint(programId, ownerPrincipalId, request);
    if (request.idempotencyKey) {
      const repeated = this.idempotency.get(this.idempotencyScope(programId, ownerPrincipalId, request.idempotencyKey));
      if (repeated) {
        if (repeated.fingerprint !== fingerprint) throw new TimelineError("OBJECT_IDEMPOTENCY_CONFLICT", "Idempotency key conflict.", 409);
        const state = this.objects.get(repeated.objectId);
        if (state?.record.status === "CONFIRMED") return clone(state.record);
      }
    }

    const signed = await this.signUpload(context, request);
    const state = this.requireState(signed.objectId);
    await this.authorizeState(context, state, "WRITE");
    await this.retry(() =>
      this.client.putObject({
        key: state.record.storageKey,
        bytes,
        contentType: request.mimeType,
        checksumSha256: sha256(bytes),
        metadata: this.storageMetadata(state),
        idempotencyKey: `service-upload:${state.record.id}`,
        ifNoneMatch: true,
      }),
    );
    await this.retry(() => this.client.revokeObjectGrants(state.record.storageKey));
    return this.confirmUpload(context, state.record.id, signed.uploadToken);
  }

  async putOwnedObject(context: PrincipalContext, request: StagingUploadRequest, bytes: Uint8Array): Promise<ObjectRecord> {
    this.requireAuthenticatedContext(context);
    assertOwnedObjectIngestion(context, request, bytes);
    const signed = await this.signUpload(context, request);
    const state = this.requireState(signed.objectId);
    await this.authorizeState(context, state, "WRITE");
    await this.retry(() =>
      this.client.putObject({
        key: state.record.storageKey,
        bytes,
        contentType: request.mimeType,
        checksumSha256: sha256(bytes),
        metadata: this.storageMetadata(state),
        idempotencyKey: `owner-upload:${state.record.id}`,
        ifNoneMatch: true,
      }),
    );
    await this.retry(() => this.client.revokeObjectGrants(state.record.storageKey));
    return this.confirmUpload(context, state.record.id, signed.uploadToken);
  }

  async getObject(_objectId: string): Promise<ObjectRecord | null> {
    throw new TimelineError(
      "OBJECT_AUTHORIZATION_CONTEXT_REQUIRED",
      "Use getAuthorizedObject with an authenticated server context.",
      401,
    );
  }

  async getAuthorizedObject(context: PrincipalContext, objectId: string): Promise<ObjectRecord | null> {
    try {
      this.requireAuthenticatedContext(context);
      const state = this.objects.get(objectId);
      if (!state) {
        await this.audit(context, "OBJECT_READ", objectId, "DENY", "OBJECT_NOT_FOUND", {});
        return null;
      }
      await this.authorizeState(context, state, "READ");
      await this.audit(context, "OBJECT_READ", objectId, "SUCCESS", null, { record_status: state.record.status });
      return clone(state.record);
    } catch (error) {
      await this.auditFailure(context, "OBJECT_READ", objectId, error);
      throw error;
    }
  }

  async getAuthorizedObjectBytes(context: PrincipalContext, objectId: string): Promise<{record: ObjectRecord; bytes: Uint8Array}> {
    try {
      this.requireAuthenticatedContext(context);
      const state = this.requireState(objectId);
      await this.authorizeState(context, state, "READ");
      if (state.record.status !== "CONFIRMED") throw new TimelineError("OBJECT_NOT_FOUND", "Object not found.", 404);
      const stored = await this.retry(() => this.client.getObject(state.record.storageKey));
      const bytes = new Uint8Array(stored.value.bytes);
      if (
        bytes.byteLength !== state.record.expectedBytes ||
        sha256(bytes) !== state.record.expectedSha256
      ) throw new TimelineError("OBJECT_INTEGRITY_MISMATCH", "Object integrity does not match its confirmed record.", 409);
      await this.audit(context, "OBJECT_READ", objectId, "SUCCESS", null, { record_status: state.record.status });
      return {record:clone(state.record),bytes};
    } catch (error) {
      await this.auditFailure(context, "OBJECT_READ", objectId, error);
      throw error;
    }
  }

  async listObjects(context: PrincipalContext, request: StagingObjectListRequest): Promise<ObjectRecord[]> {
    try {
      this.requireAuthenticatedContext(context);
      this.validateScopeId(request.programId, "OBJECT_PROGRAM_INVALID");
      if (request.documentId !== undefined) this.validateScopeId(request.documentId, "OBJECT_DOCUMENT_INVALID");
      if (request.ownerPrincipalId !== undefined) this.validateScopeId(request.ownerPrincipalId, "OBJECT_OWNER_INVALID");
      const ownerPrincipalId = context.role === "STUDENT" ? context.principalId : request.ownerPrincipalId;
      if (context.role === "STUDENT" && request.ownerPrincipalId !== undefined && request.ownerPrincipalId !== context.principalId) {
        throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403, { reasonCode: "OWNER_SCOPE_DENIED" });
      }
      await this.assertAuthorized(context, "LIST", {
        resourceType: "OBJECT_COLLECTION",
        programId: request.programId,
        documentId: request.documentId,
        ownerPrincipalId,
      });
      const records = [...this.objects.values()]
        .filter((state) => state.programId === request.programId)
        .filter((state) => request.documentId === undefined || state.record.documentId === request.documentId)
        .filter((state) => ownerPrincipalId === undefined || state.record.ownerPrincipalId === ownerPrincipalId)
        .filter((state) => request.includeDeleted === true || state.record.status !== "DELETED")
        .map((state) => clone(state.record));
      await this.audit(context, "OBJECT_LISTED", null, "SUCCESS", null, {
        result_count: records.length,
        include_deleted: request.includeDeleted === true,
      });
      return records;
    } catch (error) {
      await this.auditFailure(context, "OBJECT_LISTED", null, error);
      throw error;
    }
  }

  async getStagingMetadata(context: PrincipalContext, objectId: string): Promise<StagingObjectMetadata> {
    try {
      this.requireAuthenticatedContext(context);
      const state = this.requireState(objectId);
      await this.authorizeState(context, state, "READ");
      const metadata = {
      record: clone(state.record),
      lifecycle: {
        policyVersion: this.lifecyclePolicyVersion,
        retentionClass: state.lifecycle.rule.retentionClass,
        deleteAfter: state.lifecycle.deleteAfter,
      },
      integrity: {
        expectedBytes: state.record.expectedBytes,
        expectedSha256: state.record.expectedSha256,
        storedBytes: state.storedBytes,
        storedSha256: state.storedSha256,
      },
      malwareScan: state.malwareScan ? clone(state.malwareScan) : null,
      sanitization: state.sanitization ? clone(state.sanitization) : null,
      quarantine: state.quarantine ? clone(state.quarantine) : null,
      deletedAt: state.deletedAt,
      } satisfies StagingObjectMetadata;
      await this.audit(context, "OBJECT_READ", objectId, "SUCCESS", null, { metadata_only: true });
      return metadata;
    } catch (error) {
      await this.auditFailure(context, "OBJECT_READ", objectId, error);
      throw error;
    }
  }

  async deleteObject(context: PrincipalContext, objectId: string): Promise<void> {
    await this.withLock(`object:${objectId}`, async () => {
      try {
        this.requireAuthenticatedContext(context);
        const state = this.objects.get(objectId);
        if (!state) return;
        await this.authorizeState(context, state, "DELETE");
        if (state.record.status === "DELETED") return;
        let attempts = 0;
        for (const key of state.storageKeys) {
          const revocation = await this.retry(() => this.client.revokeObjectGrants(key));
          const deletion = await this.retry(() =>
            this.client.deleteObject({ key, idempotencyKey: `delete:${state.record.id}:${sha256(key).slice(0, 16)}` }),
          );
          const remaining = await this.retry(() => this.client.headObject(key));
          attempts += revocation.attempts + deletion.attempts + remaining.attempts;
          if (remaining.value) {
            throw new TimelineError("OBJECT_DELETE_VERIFICATION_FAILED", "Object deletion could not be verified.", 500);
          }
        }
        state.storageKeys.clear();
        state.record.status = "DELETED";
        state.tokenHash = null;
        state.uploadExpiresAt = null;
        state.storedBytes = null;
        state.storedSha256 = null;
        state.deletedAt = now(this.clock);
        state.lifecycle.deleteAfter = state.deletedAt;
        await this.audit(context, "OBJECT_DELETED", objectId, "SUCCESS", null, { attempts });
      } catch (error) {
        await this.auditFailure(context, "OBJECT_DELETED", objectId, error);
        throw error;
      }
    });
  }

  async cleanupTemporaryObjects(context: PrincipalContext, limit = 100): Promise<TemporaryCleanupResult> {
    this.requireAuthenticatedContext(context);
    if (context.role !== "SERVICE") throw new TimelineError("SERVICE_ROLE_REQUIRED", "Service role is required.", 403);
    await this.assertAuthorized(context, "LIST", {
      resourceType: "OBJECT_COLLECTION",
      programId: context.programIds[0] ?? "service-all-programs",
    });
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) throw new TimelineError("CLEANUP_LIMIT_INVALID", "Cleanup limit is invalid.", 400);
    const timestamp = now(this.clock);
    const states = [...this.objects.values()];
    const eligible = states
      .filter((state) => state.record.status !== "DELETED" && state.lifecycle.deleteAfter !== null && state.lifecycle.deleteAfter <= timestamp)
      .slice(0, limit);
    let deleted = 0;
    let failed = 0;
    for (const state of eligible) {
      try {
        await this.deleteObject(context, state.record.id);
        deleted += 1;
      } catch {
        failed += 1;
      }
    }
    const result = { examined: states.length, eligible: eligible.length, deleted, failed };
    await this.audit(context, "TEMPORARY_CLEANUP", null, failed ? "FAILURE" : "SUCCESS", failed ? "OBJECT_CLEANUP_PARTIAL" : null, result);
    return result;
  }

  async cleanupExpiredObjects(context: PrincipalContext, limit = 100): Promise<TemporaryCleanupResult> {
    return this.cleanupTemporaryObjects(context, limit);
  }

  async listAuditEvents(context: PrincipalContext): Promise<PrivateStorageAuditEvent[]> {
    this.requireAuthenticatedContext(context);
    if (context.role !== "SERVICE") throw new TimelineError("SERVICE_ROLE_REQUIRED", "Service role is required.", 403);
    await this.assertAuthorized(context, "LIST", {
      resourceType: "AUDIT_COLLECTION",
      programId: context.programIds[0] ?? "service-all-programs",
    });
    return structuredClone(this.auditEvents);
  }

  private validateUploadRequest(context: PrincipalContext, request: StagingUploadRequest): void {
    if (!/^[-_a-zA-Z0-9]{1,128}$/.test(request.documentId)) {
      throw new TimelineError("OBJECT_DOCUMENT_INVALID", "Document ID is invalid.", 400);
    }
    if (!Object.hasOwn(MAX_BYTES, request.objectClass)) throw new TimelineError("OBJECT_CLASS_INVALID", "Object class is invalid.", 400);
    if (!ALLOWED_MIME.has(request.mimeType)) throw new TimelineError("OBJECT_MIME_DENIED", "MIME type is not allowed.", 415);
    if (!Number.isInteger(request.byteSize) || request.byteSize < 1 || request.byteSize > MAX_BYTES[request.objectClass]) {
      throw new TimelineError("OBJECT_SIZE_DENIED", "Object size is outside the allowed range.", 413);
    }
    if (!/^[a-f0-9]{64}$/i.test(request.sha256)) throw new TimelineError("OBJECT_HASH_INVALID", "SHA256 is required.", 400);
    if (request.ownerPrincipalId && context.role !== "SERVICE" && request.ownerPrincipalId !== context.principalId) {
      throw new TimelineError("OBJECT_OWNER_OVERRIDE_DENIED", "Object owner cannot be overridden.", 403);
    }
    if (context.role === "SERVICE" && request.ownerPrincipalId !== undefined && !/^[-_a-zA-Z0-9]{1,128}$/.test(request.ownerPrincipalId)) {
      throw new TimelineError("OBJECT_OWNER_INVALID", "Object owner is invalid.", 400);
    }
    if (request.idempotencyKey !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(request.idempotencyKey)) {
      throw new TimelineError("OBJECT_IDEMPOTENCY_KEY_INVALID", "Idempotency key is invalid.", 400);
    }
  }

  private ownerFor(context: PrincipalContext, request: UploadRequest): string {
    return context.role === "SERVICE" && request.ownerPrincipalId ? request.ownerPrincipalId : context.principalId;
  }

  private programFor(context: PrincipalContext, request: StagingUploadRequest): string {
    const requested = request.programId ?? (context.programIds.length === 1 ? context.programIds[0] : undefined);
    if (!requested) throw new TimelineError("OBJECT_PROGRAM_REQUIRED", "A single program scope is required.", 400);
    this.validateScopeId(requested, "OBJECT_PROGRAM_INVALID");
    if (context.role !== "SERVICE" && !context.programIds.includes(requested)) {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object program access denied.", 403);
    }
    return requested;
  }

  private requestFingerprint(programId: string, ownerPrincipalId: string, request: StagingUploadRequest): string {
    return sha256(
      JSON.stringify({
        programId,
        ownerPrincipalId,
        documentId: request.documentId,
        objectClass: request.objectClass,
        mimeType: request.mimeType,
        byteSize: request.byteSize,
        sha256: request.sha256.toLowerCase(),
      }),
    );
  }

  private idempotencyScope(programId: string, ownerPrincipalId: string, idempotencyKey: string): string {
    return sha256(`${programId}:${ownerPrincipalId}:${idempotencyKey}`);
  }

  private createPendingState(
    programId: string,
    ownerPrincipalId: string,
    request: StagingUploadRequest,
    fingerprint: string,
    idempotencyScope: string | null,
  ): StoredState {
    const createdAt = now(this.clock);
    const rule = clone(this.lifecycleRules[request.objectClass]);
    const id = newId("object");
    const storageKey = this.newStorageKey("objects", programId, ownerPrincipalId, request.documentId, id);
    return {
      programId,
      storageKeys: new Set([storageKey]),
      record: {
        id,
        ownerPrincipalId,
        documentId: request.documentId,
        objectClass: request.objectClass,
        storageKey,
        mimeType: request.mimeType,
        expectedBytes: request.byteSize,
        expectedSha256: request.sha256.toLowerCase(),
        status: "PENDING",
        createdAt,
      },
      tokenHash: null,
      uploadExpiresAt: null,
      requestFingerprint: fingerprint,
      idempotencyScope,
      grantGeneration: 0,
      lifecycle: {
        rule,
        deleteAfter: addMilliseconds(this.clock(), rule.pendingTtlMs),
      },
      storedBytes: null,
      storedSha256: null,
      malwareScan: null,
      sanitization: null,
      quarantine: null,
      deletedAt: null,
    };
  }

  private async issueUploadGrant(state: StoredState): Promise<SignedUpload> {
    state.grantGeneration += 1;
    const uploadToken = randomBytes(32).toString("base64url");
    const expiresAt = addMilliseconds(this.clock(), this.uploadExpiryMs);
    const grant = await this.retry(() =>
      this.client.presignUpload({
        key: state.record.storageKey,
        contentType: state.record.mimeType,
        contentLength: state.record.expectedBytes,
        checksumSha256: state.record.expectedSha256,
        metadata: this.storageMetadata(state),
        expiresAt,
        idempotencyKey: `upload:${state.record.id}:${state.grantGeneration}`,
      }),
    );
    state.tokenHash = this.tokenHash(uploadToken);
    state.uploadExpiresAt = expiresAt;
    return {
      objectId: state.record.id,
      uploadUrl: grant.value.url,
      uploadToken,
      expiresAt: grant.value.expiresAt,
      requiredHeaders: grant.value.requiredHeaders,
    };
  }

  private validateConfirmationAuthorization(state: StoredState, uploadToken: string): void {
    if (state.record.status === "CONFIRMED") throw new TimelineError("OBJECT_UPLOAD_REPLAYED", "Upload confirmation has already been consumed.", 409);
    if (state.record.status !== "PENDING" || !state.tokenHash || !state.uploadExpiresAt) {
      throw new TimelineError("OBJECT_UPLOAD_NOT_PENDING", "Pending object not found.", 404);
    }
    if (state.uploadExpiresAt <= now(this.clock)) throw new TimelineError("OBJECT_UPLOAD_EXPIRED", "Upload authorization expired.", 401);
    const actual = Buffer.from(this.tokenHash(uploadToken), "hex");
    const expected = Buffer.from(state.tokenHash, "hex");
    if (actual.byteLength !== expected.byteLength || !timingSafeEqual(actual, expected)) {
      throw new TimelineError("OBJECT_UPLOAD_TOKEN_INVALID", "Upload token is invalid.", 401);
    }
  }

  private matchesPendingMetadata(metadata: Record<string, string>, state: StoredState): boolean {
    return (
      metadata["schema-version"] === "mission-timeline-private-object-v1" &&
      metadata["object-id"] === state.record.id &&
      metadata["program-hash"] === this.scopeHash(state.programId) &&
      metadata["document-hash"] === this.scopeHash(state.record.documentId) &&
      metadata["owner-hash"] === this.scopeHash(state.record.ownerPrincipalId) &&
      metadata["object-class"] === state.record.objectClass &&
      metadata["expected-bytes"] === String(state.record.expectedBytes) &&
      metadata["expected-sha256"] === state.record.expectedSha256 &&
      metadata["status"] === "PENDING"
    );
  }

  private async scanOrQuarantine(
    context: PrincipalContext,
    state: StoredState,
    bytes: Uint8Array,
    attempts: number,
  ): Promise<MalwareScanResult> {
    let result: MalwareScanResult;
    try {
      result = await this.malwareScanner.scan({
        objectId: state.record.id,
        bytes: new Uint8Array(bytes),
        mimeType: state.record.mimeType,
        sha256: sha256(bytes),
      });
    } catch {
      await this.quarantineAndThrow(context, state, bytes, "OBJECT_MALWARE_SCAN_FAILED", "Malware scanner failed closed.", attempts, 503);
    }
    if (!result!.scanner || !result!.scannerVersion || !["CLEAN", "INFECTED", "UNAVAILABLE", "ERROR"].includes(result!.status)) {
      await this.quarantineAndThrow(context, state, bytes, "OBJECT_MALWARE_SCAN_FAILED", "Malware scanner returned an invalid result.", attempts, 503);
    }
    if (result!.status === "INFECTED") {
      await this.quarantineAndThrow(context, state, bytes, "OBJECT_MALWARE_DETECTED", "Malware was detected in the object.", attempts, 422);
    }
    if (result!.status !== "CLEAN") {
      await this.quarantineAndThrow(context, state, bytes, "OBJECT_MALWARE_SCAN_FAILED", "Malware scanner was unavailable.", attempts, 503);
    }
    return clone(result!);
  }

  private async quarantineAndThrow(
    context: PrincipalContext,
    state: StoredState,
    bytes: Uint8Array,
    code: string,
    message: string,
    attempts: number,
    status = 409,
  ): Promise<never> {
    await this.quarantine(context, state, bytes, code, attempts);
    throw new TimelineError(code, message, status);
  }

  private async quarantine(
    context: PrincipalContext,
    state: StoredState,
    bytes: Uint8Array | null,
    reasonCode: string,
    attempts: number,
  ): Promise<void> {
    if (state.record.status === "QUARANTINED") return;
    const quarantinedAt = now(this.clock);
    const sourceKey = state.record.storageKey;
    const quarantineKey = this.newStorageKey(
      "quarantine",
      state.programId,
      state.record.ownerPrincipalId,
      state.record.documentId,
      state.record.id,
    );
    let persisted = false;
    if (bytes) {
      try {
        const actualSha256 = sha256(bytes);
        await this.retry(() =>
          this.client.putObject({
            key: quarantineKey,
            bytes,
            contentType: state.record.mimeType,
            checksumSha256: actualSha256,
            metadata: this.storageMetadata(state, {
              status: "QUARANTINED",
              deleteAfter: addMilliseconds(this.clock(), state.lifecycle.rule.quarantineTtlMs),
              storedBytes: bytes.byteLength,
              storedSha256: actualSha256,
              quarantineReason: reasonCode,
            }),
            idempotencyKey: `quarantine:${state.record.id}:${reasonCode}`,
            ifNoneMatch: true,
          }),
        );
        state.storageKeys.add(quarantineKey);
        state.record.storageKey = quarantineKey;
        persisted = true;
        try {
          await this.retry(() => this.client.deleteObject({ key: sourceKey, idempotencyKey: `quarantine-source-delete:${state.record.id}` }));
          state.storageKeys.delete(sourceKey);
        } catch {
          // Track both copies so deletion and lifecycle cleanup cannot orphan either one.
        }
      } catch {
        persisted = false;
      }
    }
    for (const key of state.storageKeys) {
      await this.retry(() => this.client.revokeObjectGrants(key)).catch(() => undefined);
    }
    state.record.status = "QUARANTINED";
    state.tokenHash = null;
    state.uploadExpiresAt = null;
    state.lifecycle.deleteAfter = addMilliseconds(this.clock(), state.lifecycle.rule.quarantineTtlMs);
    state.quarantine = { reasonCode, quarantinedAt, persisted };
    state.storedBytes = bytes?.byteLength ?? null;
    state.storedSha256 = bytes ? sha256(bytes) : null;
    await this.audit(context, "OBJECT_QUARANTINED", state.record.id, "SUCCESS", reasonCode, {
      object_class: state.record.objectClass,
      persisted,
      attempts,
    });
  }

  private storageMetadata(
    state: StoredState,
    overrides: {
      status?: ObjectRecord["status"];
      deleteAfter?: string | null;
      storedBytes?: number;
      storedSha256?: string;
      malwareStatus?: string;
      sanitized?: boolean;
      quarantineReason?: string;
    } = {},
  ): Record<string, string> {
    const metadata: Record<string, string> = {
      "schema-version": "mission-timeline-private-object-v1",
      "object-id": state.record.id,
      "program-hash": this.scopeHash(state.programId),
      "document-hash": this.scopeHash(state.record.documentId),
      "owner-hash": this.scopeHash(state.record.ownerPrincipalId),
      "object-class": state.record.objectClass,
      "status": overrides.status ?? state.record.status,
      "expected-bytes": String(state.record.expectedBytes),
      "expected-sha256": state.record.expectedSha256,
      "retention-class": state.lifecycle.rule.retentionClass,
      "retention-policy-version": this.lifecyclePolicyVersion,
      "created-at": state.record.createdAt,
    };
    const deleteAfter = overrides.deleteAfter === undefined ? state.lifecycle.deleteAfter : overrides.deleteAfter;
    if (deleteAfter) metadata["delete-after"] = deleteAfter;
    if (overrides.storedBytes !== undefined) metadata["stored-bytes"] = String(overrides.storedBytes);
    if (overrides.storedSha256) metadata["stored-sha256"] = overrides.storedSha256;
    if (overrides.malwareStatus) metadata["malware-status"] = overrides.malwareStatus;
    if (overrides.sanitized !== undefined) metadata["sanitized"] = String(overrides.sanitized);
    if (overrides.quarantineReason) metadata["quarantine-reason"] = overrides.quarantineReason;
    return metadata;
  }

  private newStorageKey(
    kind: "objects" | "quarantine",
    programId: string,
    ownerPrincipalId: string,
    documentId: string,
    objectId: string,
  ): string {
    return [
      "private",
      this.environment,
      kind,
      this.scopeHash(programId),
      this.scopeHash(ownerPrincipalId),
      this.scopeHash(documentId),
      this.scopeHash(objectId),
      randomBytes(32).toString("hex"),
    ].join("/");
  }

  private requireState(objectId: string): StoredState {
    const state = this.objects.get(objectId);
    if (!state) throw new TimelineError("OBJECT_NOT_FOUND", "Object not found.", 404);
    return state;
  }

  private requireAuthenticatedContext(
    context: PrincipalContext | null | undefined,
  ): asserts context is PrincipalContext {
    if (
      !context ||
      !context.principalId ||
      !context.requestId ||
      !context.sessionId ||
      !Array.isArray(context.programIds)
    ) {
      throw new TimelineError("OBJECT_AUTHENTICATION_REQUIRED", "Authenticated storage context is required.", 401);
    }
  }

  private validateScopeId(value: string, code: string): void {
    if (!/^[-_a-zA-Z0-9]{1,128}$/.test(value)) throw new TimelineError(code, "Storage scope identifier is invalid.", 400);
  }

  private async authorizeState(
    context: PrincipalContext,
    state: StoredState,
    operation: PrivateStorageOperation,
  ): Promise<void> {
    await this.assertAuthorized(context, operation, {
      resourceType: "OBJECT",
      programId: state.programId,
      ownerPrincipalId: state.record.ownerPrincipalId,
      documentId: state.record.documentId,
      objectId: state.record.id,
      objectClass: state.record.objectClass,
    });
  }

  private async assertAuthorized(
    context: PrincipalContext,
    operation: PrivateStorageOperation,
    resource: PrivateStorageResource,
  ): Promise<void> {
    if (
      context.role !== "SERVICE" &&
      context.role !== "PLATFORM_ADMIN" &&
      !context.programIds.includes(resource.programId)
    ) {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403, { reasonCode: "PROGRAM_SCOPE_DENIED" });
    }
    if (
      context.role === "STUDENT" &&
      resource.ownerPrincipalId !== undefined &&
      resource.ownerPrincipalId !== context.principalId
    ) {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403, { reasonCode: "OWNER_SCOPE_DENIED" });
    }
    let decision;
    try {
      decision = await this.authorization.authorize({ actor: clone(context), operation, resource: clone(resource) });
    } catch {
      throw new TimelineError("OBJECT_AUTHORIZATION_UNAVAILABLE", "Storage authorization was unavailable.", 503);
    }
    if (!decision || typeof decision.allowed !== "boolean" || !/^[A-Z0-9_]{2,80}$/.test(decision.reasonCode)) {
      throw new TimelineError("OBJECT_AUTHORIZATION_INVALID", "Storage authorization returned an invalid decision.", 500);
    }
    if (!decision.allowed) {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403, { reasonCode: decision.reasonCode });
    }
  }

  private scopeHash(value: string): string {
    return createHmac("sha256", this.tokenSecret).update(value).digest("hex").slice(0, 32);
  }

  private auditSubject(value: string): string {
    return createHmac("sha256", this.tokenSecret).update(value).digest("hex");
  }

  private tokenHash(token: string): string {
    return createHmac("sha256", this.tokenSecret).update(token).digest("hex");
  }

  private async retry<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    let attempts = 0;
    while (true) {
      attempts += 1;
      try {
        return { value: await operation(), attempts };
      } catch (error) {
        if (!(error instanceof S3CompatibleClientError) || !error.retryable || attempts >= this.retryPolicy.maxAttempts) throw error;
        const delay = this.retryPolicy.baseDelayMs * 2 ** (attempts - 1);
        if (delay > 0) await this.sleep(delay);
      }
    }
  }

  private async audit(
    context: PrincipalContext | null | undefined,
    action: PrivateStorageAuditEvent["action"],
    objectId: string | null,
    outcome: PrivateStorageAuditEvent["outcome"],
    reasonCode: string | null,
    metadata: Record<string, string | number | boolean | null>,
  ): Promise<void> {
    const serializedMetadata = JSON.stringify(metadata);
    if (/https?:|staging-object\+fs:|signed.?url|upload.?token|storage.?key/i.test(serializedMetadata)) {
      throw new TimelineError("OBJECT_AUDIT_METADATA_PROHIBITED", "Audit metadata contains prohibited capability data.", 500);
    }
    const event: PrivateStorageAuditEvent = {
      id: `storage_audit_${randomUUID()}`,
      action,
      actorId: context?.principalId ? this.auditSubject(context.principalId) : "ANONYMOUS",
      actorRole: context?.role ?? "ANONYMOUS",
      requestId: context?.requestId ? this.auditSubject(context.requestId) : "ANONYMOUS",
      objectId: objectId && /^object_[0-9a-f-]{36}$/.test(objectId) ? objectId : null,
      outcome,
      reasonCode,
      metadata: structuredClone(metadata),
      createdAt: now(this.clock),
    };
    this.auditEvents.push(structuredClone(event));
    await this.auditSink.write(event);
  }

  private async auditFailure(
    context: PrincipalContext | null | undefined,
    action: PrivateStorageAuditEvent["action"],
    objectId: string | null,
    error: unknown,
  ): Promise<void> {
    try {
      await this.audit(context, action, objectId, auditOutcome(error), timelineErrorCode(error), {});
    } catch {
      // Preserve the primary storage or authorization error.
    }
  }

  private async withLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.lockTails.get(name) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.lockTails.set(name, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.lockTails.get(name) === current) this.lockTails.delete(name);
    }
  }
}

export const DEFAULT_STAGING_LIFECYCLE_RULES: Readonly<LifecycleRules> = clone(DEFAULT_LIFECYCLE_RULES);
