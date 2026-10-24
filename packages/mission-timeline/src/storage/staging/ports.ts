import type { ObjectRecord, PrincipalContext } from "../../contracts/types.js";

export type ObjectMetadata = Readonly<Record<string, string>>;

export type PrivateStorageOperation = "CREATE" | "WRITE" | "READ" | "DELETE" | "LIST";

export interface PrivateStorageResource {
  programId: string;
  ownerPrincipalId?: string;
  documentId?: string;
  objectId?: string;
  objectClass?: ObjectRecord["objectClass"];
  resourceType: "OBJECT" | "OBJECT_COLLECTION" | "AUDIT_COLLECTION";
}

export interface PrivateStorageAuthorizationRequest {
  actor: PrincipalContext;
  operation: PrivateStorageOperation;
  resource: PrivateStorageResource;
}

export interface PrivateStorageAuthorizationDecision {
  allowed: boolean;
  reasonCode: string;
}

/**
 * Server-side policy boundary for every object lifecycle operation. The
 * implementation may consult assignments, active memberships, or service
 * scopes; storage itself never treats a client claim as authorization.
 */
export interface PrivateStorageAuthorizationPort {
  authorize(request: PrivateStorageAuthorizationRequest):
    | PrivateStorageAuthorizationDecision
    | Promise<PrivateStorageAuthorizationDecision>;
}

export interface S3ObjectHead {
  key: string;
  etag: string;
  contentType: string;
  contentLength: number;
  checksumSha256: string;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface S3ObjectBody extends S3ObjectHead {
  bytes: Uint8Array;
}

export interface PresignUploadRequest {
  key: string;
  contentType: string;
  contentLength: number;
  checksumSha256: string;
  metadata: ObjectMetadata;
  expiresAt: string;
  idempotencyKey: string;
}

export interface PresignDownloadRequest {
  key: string;
  responseContentType: string;
  expiresAt: string;
  idempotencyKey: string;
  singleUse: true;
}

export interface SignedObjectGrant {
  url: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

export interface PutObjectRequest {
  key: string;
  bytes: Uint8Array;
  contentType: string;
  checksumSha256: string;
  metadata: ObjectMetadata;
  idempotencyKey: string;
  ifMatchEtag?: string;
  ifNoneMatch?: true;
}

export interface DeleteObjectRequest {
  key: string;
  idempotencyKey: string;
}

/**
 * Minimal private-object port implemented by an S3/R2 signing service or by the
 * disposable filesystem client. Grant implementations must enforce expiry and
 * one-use semantics; a bare, replayable public URL does not satisfy this port.
 */
export interface S3CompatibleClientPort {
  presignUpload(request: PresignUploadRequest): Promise<SignedObjectGrant>;
  presignDownload(request: PresignDownloadRequest): Promise<SignedObjectGrant>;
  headObject(key: string): Promise<S3ObjectHead | null>;
  getObject(key: string): Promise<S3ObjectBody>;
  putObject(request: PutObjectRequest): Promise<S3ObjectHead>;
  deleteObject(request: DeleteObjectRequest): Promise<void>;
  revokeObjectGrants(key: string): Promise<void>;
}

export type S3CompatibleObjectClient = S3CompatibleClientPort;

export class S3CompatibleClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "S3CompatibleClientError";
  }
}

export interface MalwareScanRequest {
  objectId: string;
  bytes: Uint8Array;
  mimeType: string;
  sha256: string;
}

export interface MalwareScanResult {
  status: "CLEAN" | "INFECTED" | "UNAVAILABLE" | "ERROR";
  scanner: string;
  scannerVersion: string;
  signatureVersion?: string;
  findingCode?: string;
}

export interface MalwareScannerPort {
  scan(request: MalwareScanRequest): Promise<MalwareScanResult>;
}

export type MalwareScanner = MalwareScannerPort;

export interface SanitizeObjectRequest {
  objectId: string;
  bytes: Uint8Array;
  mimeType: string;
}

export interface SanitizeObjectResult {
  bytes: Uint8Array;
  sanitizer: string;
  sanitizerVersion: string;
  removedMetadata: boolean;
}

export interface PrivateObjectSanitizerPort {
  sanitize(request: SanitizeObjectRequest): Promise<SanitizeObjectResult>;
}

export type JpegSanitizer = PrivateObjectSanitizerPort;

export type PrivateStorageAuditAction =
  | "UPLOAD_SIGNED"
  | "UPLOAD_CONFIRMED"
  | "OBJECT_QUARANTINED"
  | "DOWNLOAD_SIGNED"
  | "OBJECT_READ"
  | "OBJECT_LISTED"
  | "OBJECT_DELETED"
  | "TEMPORARY_CLEANUP";

export interface PrivateStorageAuditEvent {
  id: string;
  action: PrivateStorageAuditAction;
  actorId: string;
  actorRole: string;
  requestId: string;
  objectId: string | null;
  outcome: "SUCCESS" | "FAILURE" | "DENY";
  reasonCode: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface PrivateStorageAuditSink {
  write(event: PrivateStorageAuditEvent): Promise<void>;
}

export class InMemoryPrivateStorageAuditSink implements PrivateStorageAuditSink {
  readonly events: PrivateStorageAuditEvent[] = [];

  async write(event: PrivateStorageAuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }

  list(): PrivateStorageAuditEvent[] {
    return structuredClone(this.events);
  }
}
