import { createHmac, timingSafeEqual } from "node:crypto";

import type { TimelineArtifact } from "../../contracts/types.js";
import { sha256, stableStringify } from "../../core/canonical.js";
import { TimelineError } from "../../core/errors.js";

export const LEGACY_FILEVAULT_STAGING_MODE = "LOCAL_CONTRACT_FIXTURE_NOT_CONNECTED" as const;

const DEFAULT_LEGACY_FILEVAULT_NONCE_ISSUER = "d1-413-local-fixture";

export type LegacyPublicationStatus =
  | "QUEUED"
  | "CREATE_FAILED"
  | "UPLOAD_URL_CREATED"
  | "PUT_FAILED"
  | "PARTIAL_PUT"
  | "PUT_COMPLETE"
  | "CONFIRM_FAILED"
  | "LINKED"
  | "SUPERSEDED";

export interface LegacyWordPressSession {
  wpUserId: number;
  principalId: string;
  loggedIn: boolean;
  nonce: string;
}

export interface LegacyUploadUrlRequest {
  filename: string;
  mime_type: string;
  folder_id: string | null;
  document_type: "mission_timeline";
  note_to_advisor: string;
  ready_for_review: boolean;
}

export interface LegacyConfirmRequest {
  version_id: string;
  file_size: number;
  etag: string;
  ready_for_review: boolean;
}

export interface LegacyFixtureFaults {
  failCreateCount?: number;
  failPutCount?: number;
  partialPutBytes?: number;
  failConfirmCount?: number;
}

export interface LegacyPublishInput {
  artifact: TimelineArtifact;
  primaryBytes: Uint8Array;
  session: LegacyWordPressSession;
  folderId?: string | null;
  readyForReview?: boolean;
  faults?: LegacyFixtureFaults;
}

export interface LegacyPublicationSnapshot {
  idempotencyKey: string;
  artifactId: string;
  artifactContentHash: string;
  primaryContentSha256: string;
  ownerPrincipalId: string;
  externalFileId: string;
  externalVersionId: string;
  versionNumber: number;
  status: LegacyPublicationStatus;
  errorCode: string | null;
  uploadUrl: string | null;
  bytesReceived: number;
  expectedBytes: number;
  uploadRequest: LegacyUploadUrlRequest;
  confirmRequest: LegacyConfirmRequest | null;
  createdAt: string;
  updatedAt: string;
  idempotentReplay: boolean;
}

export interface LegacyFixtureOperation {
  method: "POST" | "PUT";
  route: string;
  artifactId: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  at: string;
}

export interface UnsupportedLegacyIntent {
  operation: "ARCHIVE" | "DELETE";
  artifactId: string;
  reason: string;
  status: "UNSUPPORTED_REQUIRES_VERIFIED_CONTRACT";
  createdAt: string;
}

export interface LegacyFixtureOptions {
  nonceSecret: string;
  nonceIssuer?: string;
  clock?: () => Date;
}

interface InternalPublication extends LegacyPublicationSnapshot {
  uploadedBytes: Uint8Array;
  inputBytes: Uint8Array;
  faultBudget: Required<LegacyFixtureFaults>;
}

interface QueueEntry {
  input: LegacyPublishInput;
  attempts: number;
}

export class LocalLegacyFileVaultContractFixture {
  readonly mode = LEGACY_FILEVAULT_STAGING_MODE;
  readonly connected = false as const;
  readonly fileVaultV2Enabled = false as const;
  readonly servicePublishForOwnerEndpointAvailable = false as const;
  readonly operations: LegacyFixtureOperation[] = [];
  readonly unsupportedIntents: UnsupportedLegacyIntent[] = [];
  readonly requiredFutureWork = [
    "LIVE_ROUTE_DISCOVERY_REQUIRED",
    "SERVICE_SCOPED_PUBLISH_FOR_OWNER_ENDPOINT_REQUIRED",
    "HEAD_INTEGRITY_CONFIRMATION_REQUIRED",
  ] as const;

  private readonly clock: () => Date;
  private readonly nonceIssuer: string;
  private readonly publications = new Map<string, InternalPublication>();
  private readonly currentByArtifact = new Map<string, string>();
  private readonly fileByOwnerArtifact = new Map<string, string>();
  private readonly versionCountByFile = new Map<string, number>();
  private readonly queue = new Map<string, QueueEntry>();
  private fileSequence = 0;
  private v2Calls = 0;

  constructor(private readonly options: LegacyFixtureOptions) {
    if (options.nonceSecret.length < 16) {
      throw new TimelineError("FILEVAULT_FIXTURE_NONCE_SECRET_WEAK", "Fixture nonce secret must contain at least 16 characters.", 500);
    }
    if (options.nonceIssuer !== undefined && !options.nonceIssuer.trim()) {
      throw new TimelineError("FILEVAULT_FIXTURE_NONCE_ISSUER_INVALID", "Fixture nonce issuer cannot be empty.", 500);
    }
    this.nonceIssuer = options.nonceIssuer ?? DEFAULT_LEGACY_FILEVAULT_NONCE_ISSUER;
    this.clock = options.clock ?? (() => new Date());
  }

  issueSession(wpUserId: number, principalId: string, lifetimeMs = 60_000): LegacyWordPressSession {
    if (!Number.isInteger(wpUserId) || wpUserId < 1 || !principalId) {
      throw new TimelineError("FILEVAULT_SESSION_IDENTITY_INVALID", "A WordPress user and principal are required.", 400);
    }
    const expiresAt = new Date(this.clock().getTime() + lifetimeMs).toISOString();
    const payload = { issuer: this.nonceIssuer, wpUserId, principalId, expiresAt };
    const encoded = Buffer.from(stableStringify(payload), "utf8").toString("base64url");
    const signature = hmac(this.options.nonceSecret, encoded);
    return { wpUserId, principalId, loggedIn: true, nonce: `${encoded}.${signature}` };
  }

  publish(input: LegacyPublishInput): LegacyPublicationSnapshot {
    this.authenticate(input.session);
    this.validateBinding(input);
    const idempotencyKey = publicationKey(input.artifact.artifactId, input.artifact.contentHash);
    const existing = this.publications.get(idempotencyKey);
    if (existing?.status === "LINKED") return snapshot(existing, true);
    const publication = existing ?? this.createPublication(input, idempotencyKey);
    if (existing) this.mergeFaults(publication, input.faults);
    return this.advance(publication);
  }

  reconcile(input: LegacyPublishInput): LegacyPublicationSnapshot {
    this.authenticate(input.session);
    this.validateBinding(input);
    const idempotencyKey = publicationKey(input.artifact.artifactId, input.artifact.contentHash);
    const publication = this.publications.get(idempotencyKey);
    if (!publication) return this.publish(input);
    if (publication.ownerPrincipalId !== input.session.principalId) {
      throw new TimelineError("FILEVAULT_OWNER_MISMATCH", "Publication is owned by another principal.", 403);
    }
    publication.inputBytes = Uint8Array.from(input.primaryBytes);
    this.mergeFaults(publication, input.faults);
    return publication.status === "LINKED" ? snapshot(publication, true) : this.advance(publication);
  }

  enqueue(input: LegacyPublishInput): string {
    this.authenticate(input.session);
    this.validateBinding(input);
    const key = publicationKey(input.artifact.artifactId, input.artifact.contentHash);
    const prior = this.queue.get(key);
    if (!prior) this.queue.set(key, { input: cloneInput(input), attempts: 0 });
    return key;
  }

  drainQueue(): LegacyPublicationSnapshot[] {
    const results: LegacyPublicationSnapshot[] = [];
    for (const [key, entry] of [...this.queue]) {
      entry.attempts += 1;
      const result = this.reconcile(entry.input);
      entry.input.faults = undefined;
      results.push(result);
      if (result.status === "LINKED") this.queue.delete(key);
    }
    return results;
  }

  get pendingQueueCount(): number {
    return this.queue.size;
  }

  requestArchiveIntent(artifactId: string, reason: string): UnsupportedLegacyIntent {
    const intent: UnsupportedLegacyIntent = {
      operation: "ARCHIVE",
      artifactId,
      reason,
      status: "UNSUPPORTED_REQUIRES_VERIFIED_CONTRACT",
      createdAt: this.clock().toISOString(),
    };
    this.unsupportedIntents.push(intent);
    return structuredClone(intent);
  }

  requestDeletion(artifactId: string, reason: string): never {
    this.unsupportedIntents.push({
      operation: "DELETE",
      artifactId,
      reason,
      status: "UNSUPPORTED_REQUIRES_VERIFIED_CONTRACT",
      createdAt: this.clock().toISOString(),
    });
    throw new TimelineError("LEGACY_FILEVAULT_DELETE_NOT_VERIFIED", "Legacy FileVault deletion is not a verified operation.", 501);
  }

  publishV2(): never {
    this.v2Calls += 1;
    throw new TimelineError("FILEVAULT_V2_DISABLED", "FileVault v2 remains disabled and disconnected.", 501);
  }

  get v2CallCount(): number {
    return this.v2Calls;
  }

  getPublication(artifactId: string, artifactContentHash?: string): LegacyPublicationSnapshot | null {
    const key = artifactContentHash
      ? publicationKey(artifactId, artifactContentHash)
      : this.currentByArtifact.get(artifactId);
    const publication = key ? this.publications.get(key) : null;
    return publication ? snapshot(publication, false) : null;
  }

  private createPublication(input: LegacyPublishInput, idempotencyKey: string): InternalPublication {
    const now = this.clock().toISOString();
    const ownerArtifactKey = `${input.artifact.studentOwnerId}:${input.artifact.artifactId}`;
    const existingFileId = this.fileByOwnerArtifact.get(ownerArtifactKey);
    const externalFileId = existingFileId ?? `legacy_fixture_file_${++this.fileSequence}`;
    if (!existingFileId) this.fileByOwnerArtifact.set(ownerArtifactKey, externalFileId);
    const versionNumber = (this.versionCountByFile.get(externalFileId) ?? 0) + 1;
    this.versionCountByFile.set(externalFileId, versionNumber);
    const externalVersionId = `${externalFileId}_v${versionNumber}`;
    const uploadRequest: LegacyUploadUrlRequest = {
      filename: input.artifact.primaryFile.filename,
      mime_type: input.artifact.primaryFile.mimeType,
      folder_id: input.folderId ?? null,
      document_type: "mission_timeline",
      note_to_advisor: "",
      ready_for_review: input.readyForReview ?? false,
    };
    const publication: InternalPublication = {
      idempotencyKey,
      artifactId: input.artifact.artifactId,
      artifactContentHash: input.artifact.contentHash,
      primaryContentSha256: input.artifact.primaryFile.sha256,
      ownerPrincipalId: input.artifact.studentOwnerId,
      externalFileId,
      externalVersionId,
      versionNumber,
      status: "QUEUED",
      errorCode: null,
      uploadUrl: null,
      bytesReceived: 0,
      expectedBytes: input.artifact.primaryFile.byteSize,
      uploadRequest,
      confirmRequest: null,
      createdAt: now,
      updatedAt: now,
      idempotentReplay: false,
      uploadedBytes: new Uint8Array(),
      inputBytes: Uint8Array.from(input.primaryBytes),
      faultBudget: normalizeFaults(input.faults),
    };
    this.publications.set(idempotencyKey, publication);
    return publication;
  }

  private advance(publication: InternalPublication): LegacyPublicationSnapshot {
    if (["QUEUED", "CREATE_FAILED"].includes(publication.status)) {
      if (publication.faultBudget.failCreateCount > 0) {
        publication.faultBudget.failCreateCount -= 1;
        return this.markFailure(publication, "CREATE_FAILED", "LEGACY_CREATE_UPLOAD_FAILED", "POST", "/wp-json/mmed/v1/files/upload-url");
      }
      publication.uploadUrl = `fixture://legacy-filevault/upload/${publication.externalFileId}/${publication.externalVersionId}`;
      publication.status = "UPLOAD_URL_CREATED";
      publication.errorCode = null;
      publication.updatedAt = this.clock().toISOString();
      this.record("POST", "/wp-json/mmed/v1/files/upload-url", publication.artifactId, "SUCCESS");
    }

    if (["UPLOAD_URL_CREATED", "PUT_FAILED", "PARTIAL_PUT"].includes(publication.status)) {
      if (publication.faultBudget.failPutCount > 0) {
        publication.faultBudget.failPutCount -= 1;
        return this.markFailure(publication, "PUT_FAILED", "LEGACY_RAW_PUT_FAILED", "PUT", publication.uploadUrl!);
      }
      if (publication.faultBudget.partialPutBytes > 0) {
        const received = Math.min(publication.faultBudget.partialPutBytes, Math.max(0, publication.inputBytes.byteLength - 1));
        publication.faultBudget.partialPutBytes = 0;
        publication.uploadedBytes = publication.inputBytes.subarray(0, received);
        publication.bytesReceived = received;
        publication.status = "PARTIAL_PUT";
        publication.errorCode = "LEGACY_RAW_PUT_PARTIAL";
        publication.updatedAt = this.clock().toISOString();
        this.record("PUT", publication.uploadUrl!, publication.artifactId, "PARTIAL");
        return snapshot(publication, false);
      }
      publication.uploadedBytes = Uint8Array.from(publication.inputBytes);
      publication.bytesReceived = publication.uploadedBytes.byteLength;
      publication.status = "PUT_COMPLETE";
      publication.errorCode = null;
      publication.updatedAt = this.clock().toISOString();
      this.record("PUT", publication.uploadUrl!, publication.artifactId, "SUCCESS");
    }

    if (["PUT_COMPLETE", "CONFIRM_FAILED"].includes(publication.status)) {
      if (publication.uploadedBytes.byteLength !== publication.expectedBytes) {
        publication.status = "PARTIAL_PUT";
        publication.errorCode = "LEGACY_UPLOAD_SIZE_MISMATCH";
        publication.updatedAt = this.clock().toISOString();
        return snapshot(publication, false);
      }
      const storedHash = sha256(publication.uploadedBytes);
      if (storedHash !== publication.primaryContentSha256) {
        publication.status = "CONFIRM_FAILED";
        publication.errorCode = "LEGACY_UPLOAD_HASH_MISMATCH";
        publication.updatedAt = this.clock().toISOString();
        return snapshot(publication, false);
      }
      publication.confirmRequest = {
        version_id: publication.externalVersionId,
        file_size: publication.uploadedBytes.byteLength,
        etag: storedHash,
        ready_for_review: publication.uploadRequest.ready_for_review,
      };
      const route = `/wp-json/mmed/v1/files/${publication.externalFileId}/confirm`;
      if (publication.faultBudget.failConfirmCount > 0) {
        publication.faultBudget.failConfirmCount -= 1;
        return this.markFailure(publication, "CONFIRM_FAILED", "LEGACY_CONFIRM_FAILED", "POST", route);
      }
      publication.status = "LINKED";
      publication.errorCode = null;
      publication.updatedAt = this.clock().toISOString();
      this.record("POST", route, publication.artifactId, "SUCCESS");
      this.supersedePrior(publication);
      this.currentByArtifact.set(publication.artifactId, publication.idempotencyKey);
    }
    return snapshot(publication, false);
  }

  private supersedePrior(current: InternalPublication): void {
    for (const publication of this.publications.values()) {
      if (
        publication.idempotencyKey !== current.idempotencyKey
        && publication.artifactId === current.artifactId
        && publication.ownerPrincipalId === current.ownerPrincipalId
        && publication.status === "LINKED"
      ) {
        publication.status = "SUPERSEDED";
        publication.updatedAt = this.clock().toISOString();
      }
    }
  }

  private authenticate(session: LegacyWordPressSession): void {
    if (!session.loggedIn) throw new TimelineError("FILEVAULT_WORDPRESS_AUTH_REQUIRED", "A logged-in WordPress session is required.", 401);
    const [encoded, signature, extra] = session.nonce.split(".");
    if (!encoded || !signature || extra || !secureEqual(signature, hmac(this.options.nonceSecret, encoded))) {
      throw new TimelineError("FILEVAULT_WORDPRESS_NONCE_INVALID", "WordPress nonce boundary rejected the request.", 403);
    }
    let payload: { issuer?: string; wpUserId?: number; principalId?: string; expiresAt?: string };
    try {
      payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as typeof payload;
    } catch {
      throw new TimelineError("FILEVAULT_WORDPRESS_NONCE_INVALID", "WordPress nonce payload is invalid.", 403);
    }
    const expiresAt = Date.parse(payload.expiresAt ?? "");
    if (
      payload.issuer !== this.nonceIssuer
      || payload.wpUserId !== session.wpUserId
      || payload.principalId !== session.principalId
      || !Number.isFinite(expiresAt)
      || expiresAt <= this.clock().getTime()
    ) {
      throw new TimelineError("FILEVAULT_WORDPRESS_NONCE_INVALID", "WordPress nonce does not bind the active owner session.", 403);
    }
  }

  private validateBinding(input: LegacyPublishInput): void {
    const { artifact, primaryBytes, session } = input;
    if (session.principalId !== artifact.studentOwnerId) {
      throw new TimelineError(
        "FILEVAULT_PUBLISH_FOR_OWNER_UNAVAILABLE",
        "The verified legacy contract cannot publish for another owner; a service-scoped endpoint is required.",
        501,
      );
    }
    if (!artifact.artifactId || !/^[a-f0-9]{64}$/.test(artifact.contentHash)) {
      throw new TimelineError("FILEVAULT_ARTIFACT_BINDING_INVALID", "Artifact identifier and content hash are required.", 409);
    }
    if (artifact.primaryFile.contentHash !== artifact.primaryFile.sha256) {
      throw new TimelineError("FILEVAULT_PRIMARY_HASH_CONTRACT_MISMATCH", "Primary content hash and SHA-256 disagree.", 409);
    }
    if (primaryBytes.byteLength !== artifact.primaryFile.byteSize) {
      throw new TimelineError("FILEVAULT_PRIMARY_SIZE_MISMATCH", "Primary bytes do not match the artifact byte count.", 409);
    }
    if (sha256(primaryBytes) !== artifact.primaryFile.sha256) {
      throw new TimelineError("FILEVAULT_PRIMARY_HASH_MISMATCH", "Primary bytes do not match the artifact SHA-256.", 409);
    }
  }

  private mergeFaults(publication: InternalPublication, faults?: LegacyFixtureFaults): void {
    if (!faults) return;
    publication.faultBudget.failCreateCount += faults.failCreateCount ?? 0;
    publication.faultBudget.failPutCount += faults.failPutCount ?? 0;
    publication.faultBudget.failConfirmCount += faults.failConfirmCount ?? 0;
    if (faults.partialPutBytes !== undefined) publication.faultBudget.partialPutBytes = faults.partialPutBytes;
  }

  private markFailure(
    publication: InternalPublication,
    status: Extract<LegacyPublicationStatus, "CREATE_FAILED" | "PUT_FAILED" | "CONFIRM_FAILED">,
    code: string,
    method: LegacyFixtureOperation["method"],
    route: string,
  ): LegacyPublicationSnapshot {
    publication.status = status;
    publication.errorCode = code;
    publication.updatedAt = this.clock().toISOString();
    this.record(method, route, publication.artifactId, "FAILED");
    return snapshot(publication, false);
  }

  private record(method: LegacyFixtureOperation["method"], route: string, artifactId: string, status: LegacyFixtureOperation["status"]): void {
    this.operations.push({ method, route, artifactId, status, at: this.clock().toISOString() });
  }
}

function publicationKey(artifactId: string, contentHash: string): string {
  return sha256(stableStringify([artifactId, contentHash]));
}

function normalizeFaults(faults?: LegacyFixtureFaults): Required<LegacyFixtureFaults> {
  return {
    failCreateCount: faults?.failCreateCount ?? 0,
    failPutCount: faults?.failPutCount ?? 0,
    partialPutBytes: faults?.partialPutBytes ?? 0,
    failConfirmCount: faults?.failConfirmCount ?? 0,
  };
}

function snapshot(publication: InternalPublication, idempotentReplay: boolean): LegacyPublicationSnapshot {
  return {
    idempotencyKey: publication.idempotencyKey,
    artifactId: publication.artifactId,
    artifactContentHash: publication.artifactContentHash,
    primaryContentSha256: publication.primaryContentSha256,
    ownerPrincipalId: publication.ownerPrincipalId,
    externalFileId: publication.externalFileId,
    externalVersionId: publication.externalVersionId,
    versionNumber: publication.versionNumber,
    status: publication.status,
    errorCode: publication.errorCode,
    uploadUrl: publication.uploadUrl,
    bytesReceived: publication.bytesReceived,
    expectedBytes: publication.expectedBytes,
    uploadRequest: structuredClone(publication.uploadRequest),
    confirmRequest: publication.confirmRequest ? structuredClone(publication.confirmRequest) : null,
    createdAt: publication.createdAt,
    updatedAt: publication.updatedAt,
    idempotentReplay,
  };
}

function cloneInput(input: LegacyPublishInput): LegacyPublishInput {
  return {
    ...input,
    artifact: structuredClone(input.artifact),
    primaryBytes: Uint8Array.from(input.primaryBytes),
    session: structuredClone(input.session),
    faults: input.faults ? structuredClone(input.faults) : undefined,
  };
}

function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function secureEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
