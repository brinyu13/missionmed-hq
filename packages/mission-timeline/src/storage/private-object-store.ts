import { createHmac, randomBytes } from "node:crypto";

import type { ObjectRecord, PrincipalContext } from "../contracts/types.js";
import { clone, newId, now, sha256 } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";

export interface UploadRequest {
  documentId: string;
  ownerPrincipalId?: string;
  objectClass: ObjectRecord["objectClass"];
  mimeType: string;
  byteSize: number;
  sha256: string;
}

export interface SignedUpload {
  objectId: string;
  uploadUrl: string;
  uploadToken: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

export interface SignedDownload {
  downloadUrl: string;
  expiresAt: string;
}

export interface PrivateObjectStore {
  signUpload(context: PrincipalContext, request: UploadRequest): Promise<SignedUpload>;
  confirmUpload(context: PrincipalContext, objectId: string, uploadToken: string): Promise<ObjectRecord>;
  signDownload(context: PrincipalContext, objectId: string): Promise<SignedDownload>;
  putServiceObject(context: PrincipalContext, request: UploadRequest, bytes: Uint8Array): Promise<ObjectRecord>;
  putOwnedObject(context: PrincipalContext, request: UploadRequest, bytes: Uint8Array): Promise<ObjectRecord>;
  getObject(objectId: string): Promise<ObjectRecord | null>;
  getAuthorizedObject(context: PrincipalContext, objectId: string): Promise<ObjectRecord | null>;
  deleteObject(context: PrincipalContext, objectId: string): Promise<void>;
}

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

const MAX_BYTES: Record<ObjectRecord["objectClass"], number> = {
  SOURCE: 25 * 1024 * 1024,
  MEDIA: 15 * 1024 * 1024,
  EXPORT: 50 * 1024 * 1024,
  PREVIEW: 5 * 1024 * 1024,
  TEMP: 50 * 1024 * 1024,
};

// Server-mediated ingestion (File Vault handoff) must run under the authenticated owner.
// SERVICE is the one role every owner check waives, so it may never be substituted for the
// student: doing so both forges custody and is rejected by every RLS policy in production.
export function assertOwnedObjectIngestion(context: PrincipalContext, request: UploadRequest, bytes: Uint8Array): void {
  if (context.role !== "STUDENT") throw new TimelineError("OBJECT_OWNER_ROLE_REQUIRED", "An owning student principal is required.", 403);
  if (request.ownerPrincipalId && request.ownerPrincipalId !== context.principalId) {
    throw new TimelineError("OBJECT_OWNER_MISMATCH", "Object owner mismatch.", 403);
  }
  if (bytes.byteLength !== request.byteSize || sha256(bytes) !== request.sha256.toLowerCase()) {
    throw new TimelineError("OBJECT_OWNED_BYTES_INVALID", "Ingested object integrity is invalid.", 400);
  }
}

interface PendingUpload {
  record: ObjectRecord;
  tokenHash: string;
  expiresAt: string;
  uploadedBytes?: Uint8Array;
  uploadedMimeType?: string;
}

export class InMemoryPrivateObjectStore implements PrivateObjectStore {
  private readonly objects = new Map<string, PendingUpload>();

  constructor(
    private readonly environment = "test",
    private readonly signingSecret = "d1-412-test-object-signing-secret-000000000000",
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async signUpload(context: PrincipalContext, request: UploadRequest): Promise<SignedUpload> {
    this.validateUploadRequest(request);
    const id = newId("object");
    const issuedAt = now(this.clock);
    const expiresAt = new Date(this.clock().getTime() + 5 * 60 * 1000).toISOString();
    const token = randomBytes(32).toString("base64url");
    const tenantHash = sha256(context.programIds[0] ?? "no-program").slice(0, 16);
    const record: ObjectRecord = {
      id,
      ownerPrincipalId: context.role === "SERVICE" && request.ownerPrincipalId ? request.ownerPrincipalId : context.principalId,
      documentId: request.documentId,
      objectClass: request.objectClass,
      storageKey: `timeline/${this.environment}/${tenantHash}/${request.documentId}/${request.objectClass.toLowerCase()}/${id}`,
      mimeType: request.mimeType,
      expectedBytes: request.byteSize,
      expectedSha256: request.sha256.toLowerCase(),
      status: "PENDING",
      createdAt: issuedAt,
    };
    this.objects.set(id, { record, tokenHash: this.tokenHash(token), expiresAt });
    return {
      objectId: id,
      uploadUrl: `https://private-objects.invalid/upload/${id}`,
      uploadToken: token,
      expiresAt,
      requiredHeaders: {
        "content-type": request.mimeType,
        "content-length": String(request.byteSize),
        "x-content-sha256": request.sha256.toLowerCase(),
      },
    };
  }

  async acceptTestUpload(objectId: string, uploadToken: string, bytes: Uint8Array, mimeType: string): Promise<void> {
    const pending = this.requirePending(objectId, uploadToken);
    pending.uploadedBytes = new Uint8Array(bytes);
    pending.uploadedMimeType = mimeType;
    this.objects.set(objectId, pending);
  }

  async confirmUpload(context: PrincipalContext, objectId: string, uploadToken: string): Promise<ObjectRecord> {
    const pending = this.requirePending(objectId, uploadToken);
    if (pending.record.ownerPrincipalId !== context.principalId && context.role !== "SERVICE") {
      throw new TimelineError("OBJECT_OWNER_MISMATCH", "Object owner mismatch.", 403);
    }
    if (!pending.uploadedBytes) throw new TimelineError("OBJECT_UPLOAD_MISSING", "Object bytes were not uploaded.", 409);
    if (pending.uploadedBytes.byteLength !== pending.record.expectedBytes) {
      pending.record.status = "QUARANTINED";
      throw new TimelineError("OBJECT_SIZE_MISMATCH", "Object size does not match the signed request.", 409);
    }
    if (sha256(pending.uploadedBytes) !== pending.record.expectedSha256) {
      pending.record.status = "QUARANTINED";
      throw new TimelineError("OBJECT_HASH_MISMATCH", "Object checksum does not match the signed request.", 409);
    }
    if (pending.uploadedMimeType !== pending.record.mimeType) {
      pending.record.status = "QUARANTINED";
      throw new TimelineError("OBJECT_MIME_MISMATCH", "Object MIME type does not match the signed request.", 409);
    }
    pending.record.status = "CONFIRMED";
    pending.record.confirmedAt = now(this.clock);
    pending.record.bytes = pending.uploadedBytes;
    this.objects.set(objectId, pending);
    return clone(pending.record);
  }

  async signDownload(context: PrincipalContext, objectId: string): Promise<SignedDownload> {
    const pending = this.objects.get(objectId);
    if (!pending || pending.record.status !== "CONFIRMED") {
      throw new TimelineError("OBJECT_NOT_FOUND", "Object not found.", 404);
    }
    if (pending.record.ownerPrincipalId !== context.principalId && context.role !== "SERVICE") {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403);
    }
    const expiresAt = new Date(this.clock().getTime() + 5 * 60 * 1000).toISOString();
    const signature = createHmac("sha256", this.signingSecret)
      .update(`${objectId}:${expiresAt}:${context.principalId}`)
      .digest("base64url");
    return { downloadUrl: `https://private-objects.invalid/download/${objectId}?expires=${encodeURIComponent(expiresAt)}&sig=${signature}`, expiresAt };
  }

  async putServiceObject(context: PrincipalContext, request: UploadRequest, bytes: Uint8Array): Promise<ObjectRecord> {
    if (context.role !== "SERVICE") throw new TimelineError("SERVICE_ROLE_REQUIRED", "Service role is required.", 403);
    const signed = await this.signUpload(context, request);
    await this.acceptTestUpload(signed.objectId, signed.uploadToken, bytes, request.mimeType);
    return this.confirmUpload(context, signed.objectId, signed.uploadToken);
  }

  async putOwnedObject(context: PrincipalContext, request: UploadRequest, bytes: Uint8Array): Promise<ObjectRecord> {
    assertOwnedObjectIngestion(context, request, bytes);
    const signed = await this.signUpload(context, request);
    await this.acceptTestUpload(signed.objectId, signed.uploadToken, bytes, request.mimeType);
    return this.confirmUpload(context, signed.objectId, signed.uploadToken);
  }

  async getObject(objectId: string): Promise<ObjectRecord | null> {
    const pending = this.objects.get(objectId);
    return pending ? clone(pending.record) : null;
  }

  async getAuthorizedObject(context: PrincipalContext, objectId: string): Promise<ObjectRecord | null> {
    const pending = this.objects.get(objectId);
    if (!pending) return null;
    if (pending.record.ownerPrincipalId !== context.principalId && context.role !== "SERVICE") {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object access denied.", 403);
    }
    return clone(pending.record);
  }

  async deleteObject(context: PrincipalContext, objectId: string): Promise<void> {
    const pending = this.objects.get(objectId);
    // Absent and not-yours answer alike, so deletion cannot enumerate another student's objects.
    if (!pending) throw new TimelineError("OBJECT_NOT_FOUND", "Object not found.", 404);
    if (pending.record.ownerPrincipalId !== context.principalId && context.role !== "SERVICE") {
      throw new TimelineError("OBJECT_ACCESS_DENIED", "Object deletion denied.", 403);
    }
    pending.record.status = "DELETED";
    delete pending.record.bytes;
    delete pending.uploadedBytes;
    this.objects.set(objectId, pending);
  }

  private validateUploadRequest(request: UploadRequest): void {
    if (!request.documentId) throw new TimelineError("OBJECT_DOCUMENT_REQUIRED", "Document ID is required.", 400);
    if (!ALLOWED_MIME.has(request.mimeType)) throw new TimelineError("OBJECT_MIME_DENIED", "MIME type is not allowed.", 415);
    if (!Number.isInteger(request.byteSize) || request.byteSize < 1 || request.byteSize > MAX_BYTES[request.objectClass]) {
      throw new TimelineError("OBJECT_SIZE_DENIED", "Object size is outside the allowed range.", 413);
    }
    if (!/^[a-f0-9]{64}$/i.test(request.sha256)) throw new TimelineError("OBJECT_HASH_INVALID", "SHA256 is required.", 400);
  }

  private requirePending(objectId: string, uploadToken: string): PendingUpload {
    const pending = this.objects.get(objectId);
    if (!pending || pending.record.status !== "PENDING") throw new TimelineError("OBJECT_UPLOAD_NOT_PENDING", "Pending object not found.", 404);
    if (pending.expiresAt <= now(this.clock)) throw new TimelineError("OBJECT_UPLOAD_EXPIRED", "Upload authorization expired.", 401);
    if (pending.tokenHash !== this.tokenHash(uploadToken)) throw new TimelineError("OBJECT_UPLOAD_TOKEN_INVALID", "Upload token is invalid.", 401);
    return pending;
  }

  private tokenHash(token: string): string {
    return createHmac("sha256", this.signingSecret).update(token).digest("hex");
  }
}
