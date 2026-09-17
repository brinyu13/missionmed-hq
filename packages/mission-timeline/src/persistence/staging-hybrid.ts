import type { TimelineDocument, TimelineVersion } from "../contracts/types.js";
import { clone, sha256, stableStringify } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";

export type StagingSyncState =
  | "LOCAL_SAVED"
  | "SYNC_PENDING"
  | "CLOUD_SYNCED"
  | "OFFLINE"
  | "AUTH_REQUIRED"
  | "CONFLICT"
  | "ERROR";

export type StagingSyncOperationKind = "CHECKPOINT" | "VERSION";

export const STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION = "d1-timeline-hybrid-recovery-413.1" as const;
export const STAGING_RECOVERY_ENVELOPE_SCHEMA_VERSION = "d1-timeline-hybrid-recovery-envelope-413.1" as const;

const STAGING_RECOVERY_INTEGRITY_ALGORITHM = "SHA-256" as const;
const STAGING_RECOVERY_CANONICALIZATION = "MISSIONMED_STABLE_JSON_V1" as const;

export interface StagingRemoteAvailability {
  enabled: boolean;
  online: boolean;
  authenticated: boolean;
}

export interface StagingLocalDraftRecord {
  principalId: string;
  documentId: string;
  document: TimelineDocument;
  localSequence: number;
  savedAt: string;
}

export interface StagingPendingOperation {
  id: string;
  idempotencyKey: string;
  principalId: string;
  documentId: string;
  kind: StagingSyncOperationKind;
  baseRevision: number;
  document: TimelineDocument;
  label?: string;
  localSequence: number;
  createdAt: string;
  attempts: number;
}

export interface StagingConflictRecord {
  id: string;
  principalId: string;
  documentId: string;
  operationId: string;
  idempotencyKey: string;
  baseRevision: number;
  currentRevision: number;
  localDocument: TimelineDocument;
  remoteDocument: TimelineDocument;
  localSha256: string;
  remoteSha256: string;
  recordedAt: string;
  resolution: "UNRESOLVED";
}

export interface StagingHybridStatus {
  state: StagingSyncState;
  principalId: string;
  documentId: string;
  localSavedAt: string | null;
  cloudSyncedAt: string | null;
  pendingOperations: number;
  preserveLocalDraft: true;
  reason?: "REMOTE_DISABLED" | "NETWORK_OFFLINE" | "AUTH_EXPIRED" | "REVISION_CONFLICT" | "SYNC_FAILURE";
  conflictId?: string;
  errorCode?: string;
}

export interface StagingRecoveryPayload {
  schemaVersion: typeof STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION;
  exportedAt: string;
  principalId: string;
  documentId: string;
  status: StagingHybridStatus | null;
  draft: StagingLocalDraftRecord;
  pendingOperations: StagingPendingOperation[];
  conflicts: StagingConflictRecord[];
}

export interface StagingRecoveryIntegrity {
  envelopeSchemaVersion: typeof STAGING_RECOVERY_ENVELOPE_SCHEMA_VERSION;
  payloadSchemaVersion: typeof STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION;
  algorithm: typeof STAGING_RECOVERY_INTEGRITY_ALGORITHM;
  canonicalization: typeof STAGING_RECOVERY_CANONICALIZATION;
  contentSha256: string;
}

export interface StagingRecoveryEnvelope extends StagingRecoveryPayload {
  /** Flat checksum field keeps the additive 413.1 payload shape usable by existing readers. */
  contentSha256: string;
  integrity: StagingRecoveryIntegrity;
}

export interface QueueLocalSaveInput {
  principalId: string;
  document: TimelineDocument;
  kind: StagingSyncOperationKind;
  baseRevision: number;
  label?: string;
  savedAt: string;
}

export interface StagingLocalDraftStore {
  saveDraftAndQueue(input: QueueLocalSaveInput): Promise<StagingPendingOperation>;
  getDraft(principalId: string, documentId: string): Promise<StagingLocalDraftRecord | null>;
  listOperations(principalId: string, documentId: string): Promise<StagingPendingOperation[]>;
  removeOperations(principalId: string, operationIds: string[]): Promise<void>;
  recordAttempt(principalId: string, operationId: string): Promise<void>;
  putConflict(conflict: StagingConflictRecord): Promise<void>;
  listConflicts(principalId: string, documentId: string): Promise<StagingConflictRecord[]>;
}

export interface StagingCheckpointRequest {
  principalId: string;
  documentId: string;
  deviceId: string;
  baseRevision: number;
  document: TimelineDocument;
  idempotencyKey: string;
}

export interface StagingVersionRequest extends StagingCheckpointRequest {
  label: string;
}

export interface StagingRemoteTimelineClient {
  getAvailability(): StagingRemoteAvailability;
  saveCheckpoint(request: StagingCheckpointRequest): Promise<{ revision: number }>;
  createVersion(request: StagingVersionRequest): Promise<{ revision: number; version?: TimelineVersion }>;
  getCurrentDocument(principalId: string, documentId: string): Promise<TimelineDocument>;
}

export interface StagingHybridOptions {
  clock?: () => Date;
  maxAttemptsPerFlush?: number;
  onStatus?: (status: StagingHybridStatus) => void;
}

function scopedKey(principalId: string, documentId: string): string {
  return `${principalId}\u0000${documentId}`;
}

function operationKey(principalId: string, operationId: string): string {
  return `${principalId}\u0000${operationId}`;
}

function iso(clock: () => Date): string {
  return clock().toISOString();
}

function documentHash(document: TimelineDocument): string {
  return sha256(stableStringify(document));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recoveryIntegrityMetadata() {
  return {
    envelopeSchemaVersion: STAGING_RECOVERY_ENVELOPE_SCHEMA_VERSION,
    payloadSchemaVersion: STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION,
    algorithm: STAGING_RECOVERY_INTEGRITY_ALGORITHM,
    canonicalization: STAGING_RECOVERY_CANONICALIZATION,
  } as const;
}

function recoveryContentHash(payload: StagingRecoveryPayload): string {
  return sha256(stableStringify({ integrity: recoveryIntegrityMetadata(), payload }));
}

function recoveryError(code: string, message: string, status = 400): TimelineError {
  return new TimelineError(code, message, status, { preserveLocalDraft: true });
}

function validateRecoveryPayload(payload: Record<string, unknown>): StagingRecoveryPayload {
  if (payload.schemaVersion !== STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION) {
    throw recoveryError("RECOVERY_SCHEMA_UNSUPPORTED", "Recovery payload schema is not supported.", 422);
  }
  if (
    typeof payload.exportedAt !== "string"
    || !Number.isFinite(Date.parse(payload.exportedAt))
    || typeof payload.principalId !== "string"
    || !payload.principalId
    || typeof payload.documentId !== "string"
    || !payload.documentId
    || !isRecord(payload.draft)
    || !Array.isArray(payload.pendingOperations)
    || !Array.isArray(payload.conflicts)
  ) {
    throw recoveryError("RECOVERY_PAYLOAD_INVALID", "Recovery payload is invalid.");
  }
  const draft = payload.draft;
  if (
    draft.principalId !== payload.principalId
    || draft.documentId !== payload.documentId
    || !isRecord(draft.document)
    || draft.document.id !== payload.documentId
    || draft.document.studentOwnerId !== payload.principalId
  ) {
    throw recoveryError("RECOVERY_PAYLOAD_INVALID", "Recovery payload ownership binding is invalid.");
  }
  for (const operation of payload.pendingOperations) {
    if (
      !isRecord(operation)
      || operation.principalId !== payload.principalId
      || operation.documentId !== payload.documentId
      || !isRecord(operation.document)
      || operation.document.id !== payload.documentId
      || operation.document.studentOwnerId !== payload.principalId
    ) {
      throw recoveryError("RECOVERY_PAYLOAD_INVALID", "Recovery operation ownership binding is invalid.");
    }
  }
  for (const conflict of payload.conflicts) {
    if (
      !isRecord(conflict)
      || conflict.principalId !== payload.principalId
      || conflict.documentId !== payload.documentId
      || !isRecord(conflict.localDocument)
      || !isRecord(conflict.remoteDocument)
      || conflict.localDocument.id !== payload.documentId
      || conflict.remoteDocument.id !== payload.documentId
      || conflict.localDocument.studentOwnerId !== payload.principalId
      || conflict.remoteDocument.studentOwnerId !== payload.principalId
    ) {
      throw recoveryError("RECOVERY_PAYLOAD_INVALID", "Recovery conflict ownership binding is invalid.");
    }
  }
  return payload as unknown as StagingRecoveryPayload;
}

export function verifyStagingRecoveryJson(serialized: string): StagingRecoveryEnvelope {
  let candidate: unknown;
  try {
    candidate = JSON.parse(serialized);
  } catch {
    throw recoveryError("RECOVERY_JSON_INVALID", "Recovery JSON is invalid.");
  }
  if (!isRecord(candidate)) throw recoveryError("RECOVERY_JSON_INVALID", "Recovery JSON must contain an object.");

  const { contentSha256, integrity, ...payload } = candidate;
  if (!isRecord(integrity) || typeof contentSha256 !== "string") {
    throw recoveryError("RECOVERY_INTEGRITY_REQUIRED", "Recovery JSON does not contain a verifiable integrity envelope.", 422);
  }
  const expectedIntegrityKeys = [
    "algorithm",
    "canonicalization",
    "contentSha256",
    "envelopeSchemaVersion",
    "payloadSchemaVersion",
  ];
  if (Object.keys(integrity).sort().join("\u0000") !== expectedIntegrityKeys.join("\u0000")) {
    throw recoveryError("RECOVERY_INTEGRITY_ENVELOPE_INVALID", "Recovery integrity envelope is invalid.", 422);
  }
  if (integrity.envelopeSchemaVersion !== STAGING_RECOVERY_ENVELOPE_SCHEMA_VERSION) {
    throw recoveryError("RECOVERY_ENVELOPE_SCHEMA_UNSUPPORTED", "Recovery integrity envelope schema is not supported.", 422);
  }
  const verifiedPayload = validateRecoveryPayload(payload);
  if (
    integrity.payloadSchemaVersion !== verifiedPayload.schemaVersion
    || integrity.algorithm !== STAGING_RECOVERY_INTEGRITY_ALGORITHM
    || integrity.canonicalization !== STAGING_RECOVERY_CANONICALIZATION
    || typeof integrity.contentSha256 !== "string"
    || !/^[a-f0-9]{64}$/.test(contentSha256)
    || integrity.contentSha256 !== contentSha256
  ) {
    throw recoveryError("RECOVERY_INTEGRITY_ENVELOPE_INVALID", "Recovery integrity envelope is invalid.", 422);
  }
  if (recoveryContentHash(verifiedPayload) !== contentSha256) {
    throw recoveryError("RECOVERY_CHECKSUM_MISMATCH", "Recovery JSON failed integrity verification.", 409);
  }
  const verifiedIntegrity: StagingRecoveryIntegrity = {
    envelopeSchemaVersion: STAGING_RECOVERY_ENVELOPE_SCHEMA_VERSION,
    payloadSchemaVersion: STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION,
    algorithm: STAGING_RECOVERY_INTEGRITY_ALGORITHM,
    canonicalization: STAGING_RECOVERY_CANONICALIZATION,
    contentSha256,
  };
  return clone({ ...verifiedPayload, contentSha256, integrity: verifiedIntegrity });
}

function errorCode(error: unknown): string {
  if (error instanceof TimelineError) return error.code;
  return error instanceof Error && error.name ? error.name : "REMOTE_SYNC_FAILED";
}

function errorStatus(error: unknown): number | undefined {
  if (error instanceof TimelineError) return error.status;
  if (error && typeof error === "object" && "status" in error) {
    const value = Number((error as { status?: unknown }).status);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

function isAuthFailure(error: unknown): boolean {
  const code = errorCode(error);
  return errorStatus(error) === 401 || ["AUTH_REQUIRED", "SESSION_REQUIRED", "SESSION_TOKEN_EXPIRED", "MATRIX_SESSION_REVOKED"].includes(code);
}

function isConflict(error: unknown): boolean {
  return errorStatus(error) === 409 || ["REVISION_CONFLICT", "PERSISTENCE_CONFLICT"].includes(errorCode(error));
}

function isOfflineFailure(error: unknown): boolean {
  return ["OFFLINE", "NETWORK_OFFLINE"].includes(errorCode(error));
}

function isRetryable(error: unknown): boolean {
  const status = errorStatus(error);
  return !isAuthFailure(error) && !isConflict(error) && !isOfflineFailure(error) && (status === undefined || status >= 500);
}

function assertOwnedDocument(principalId: string, document: TimelineDocument): void {
  if (!principalId || document.studentOwnerId !== principalId) {
    throw new TimelineError("LOCAL_DRAFT_OWNER_MISMATCH", "A local draft cannot be assigned to another principal.", 403, {
      preserveLocalDraft: true,
    });
  }
}

export class InMemoryStagingLocalDraftStore implements StagingLocalDraftStore {
  private readonly drafts = new Map<string, StagingLocalDraftRecord>();
  private readonly operations = new Map<string, StagingPendingOperation>();
  private readonly conflicts = new Map<string, StagingConflictRecord>();
  private readonly sequences = new Map<string, number>();

  async saveDraftAndQueue(input: QueueLocalSaveInput): Promise<StagingPendingOperation> {
    assertOwnedDocument(input.principalId, input.document);
    if (input.kind === "VERSION" && !input.label?.trim()) {
      throw new TimelineError("VERSION_LABEL_REQUIRED", "A named version requires a label.", 400);
    }
    const key = scopedKey(input.principalId, input.document.id);
    const localSequence = (this.sequences.get(key) ?? 0) + 1;
    const identity = stableStringify([
      input.principalId,
      input.document.id,
      input.kind,
      localSequence,
      input.baseRevision,
      input.label ?? null,
      documentHash(input.document),
    ]);
    const digest = sha256(identity);
    const operation: StagingPendingOperation = {
      id: `sync_${digest.slice(0, 32)}`,
      idempotencyKey: `timeline-sync:${digest}`,
      principalId: input.principalId,
      documentId: input.document.id,
      kind: input.kind,
      baseRevision: input.baseRevision,
      document: clone(input.document),
      label: input.label,
      localSequence,
      createdAt: input.savedAt,
      attempts: 0,
    };

    // These mutations are synchronous and contiguous, giving the in-memory candidate atomic local save + queue semantics.
    this.sequences.set(key, localSequence);
    this.drafts.set(key, {
      principalId: input.principalId,
      documentId: input.document.id,
      document: clone(input.document),
      localSequence,
      savedAt: input.savedAt,
    });
    this.operations.set(operationKey(input.principalId, operation.id), clone(operation));
    return clone(operation);
  }

  async getDraft(principalId: string, documentId: string): Promise<StagingLocalDraftRecord | null> {
    const draft = this.drafts.get(scopedKey(principalId, documentId));
    return draft ? clone(draft) : null;
  }

  async listOperations(principalId: string, documentId: string): Promise<StagingPendingOperation[]> {
    return [...this.operations.values()]
      .filter((operation) => operation.principalId === principalId && operation.documentId === documentId)
      .sort((left, right) => left.localSequence - right.localSequence || left.id.localeCompare(right.id))
      .map(clone);
  }

  async removeOperations(principalId: string, operationIds: string[]): Promise<void> {
    for (const id of operationIds) this.operations.delete(operationKey(principalId, id));
  }

  async recordAttempt(principalId: string, operationId: string): Promise<void> {
    const key = operationKey(principalId, operationId);
    const operation = this.operations.get(key);
    if (!operation) return;
    this.operations.set(key, { ...operation, attempts: operation.attempts + 1 });
  }

  async putConflict(conflict: StagingConflictRecord): Promise<void> {
    if (conflict.localDocument.studentOwnerId !== conflict.principalId || conflict.remoteDocument.studentOwnerId !== conflict.principalId) {
      throw new TimelineError("CONFLICT_OWNER_MISMATCH", "Conflict snapshots must belong to the active principal.", 403);
    }
    this.conflicts.set(scopedKey(conflict.principalId, conflict.id), clone(conflict));
  }

  async listConflicts(principalId: string, documentId: string): Promise<StagingConflictRecord[]> {
    return [...this.conflicts.values()]
      .filter((conflict) => conflict.principalId === principalId && conflict.documentId === documentId)
      .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class StagingHybridSyncCoordinator {
  readonly principalId: string;

  readonly #local: StagingLocalDraftStore;
  readonly #remote: StagingRemoteTimelineClient;
  readonly #deviceId: string;
  readonly #clock: () => Date;
  readonly #maxAttemptsPerFlush: number;
  readonly #onStatus: (status: StagingHybridStatus) => void;
  readonly #statuses = new Map<string, StagingHybridStatus>();
  readonly #flushes = new Map<string, Promise<StagingHybridStatus>>();
  readonly #remoteRevisions = new Map<string, number>();

  constructor(
    principalId: string,
    local: StagingLocalDraftStore,
    remote: StagingRemoteTimelineClient,
    deviceId: string,
    options: StagingHybridOptions = {},
  ) {
    if (!principalId || !deviceId) throw new Error("HYBRID_PRINCIPAL_AND_DEVICE_REQUIRED");
    const maxAttempts = options.maxAttemptsPerFlush ?? 2;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error("HYBRID_RETRY_LIMIT_INVALID");
    this.principalId = principalId;
    this.#local = local;
    this.#remote = remote;
    this.#deviceId = deviceId;
    this.#clock = options.clock ?? (() => new Date());
    this.#maxAttemptsPerFlush = maxAttempts;
    this.#onStatus = options.onStatus ?? (() => undefined);
  }

  async saveLocal(document: TimelineDocument): Promise<StagingHybridStatus> {
    return this.#save(document, "CHECKPOINT");
  }

  async saveVersion(document: TimelineDocument, label: string): Promise<StagingHybridStatus> {
    return this.#save(document, "VERSION", label);
  }

  async getLocalDraft(documentId: string): Promise<StagingLocalDraftRecord | null> {
    return this.#local.getDraft(this.principalId, documentId);
  }

  async flush(documentId: string): Promise<StagingHybridStatus> {
    const key = scopedKey(this.principalId, documentId);
    const active = this.#flushes.get(key);
    if (active) return active;
    const running = this.#flushInternal(documentId);
    this.#flushes.set(key, running);
    try {
      return await running;
    } finally {
      if (this.#flushes.get(key) === running) this.#flushes.delete(key);
    }
  }

  async resumeAfterAuthentication(principalId: string, documentId: string): Promise<StagingHybridStatus> {
    if (principalId !== this.principalId) {
      throw new TimelineError("LOCAL_DRAFT_PRINCIPAL_SWITCH_DENIED", "A different principal cannot adopt this local draft.", 403, {
        preserveLocalDraft: true,
      });
    }
    return this.flush(documentId);
  }

  getStatus(documentId: string): StagingHybridStatus | null {
    const status = this.#statuses.get(scopedKey(this.principalId, documentId));
    return status ? clone(status) : null;
  }

  async exportRecoveryJson(documentId: string): Promise<string> {
    const draft = await this.#local.getDraft(this.principalId, documentId);
    if (!draft) throw new TimelineError("LOCAL_DRAFT_NOT_FOUND", "No local draft is available for recovery.", 404);
    const pendingOperations = await this.#local.listOperations(this.principalId, documentId);
    const conflicts = await this.#local.listConflicts(this.principalId, documentId);
    const payload: StagingRecoveryPayload = {
      schemaVersion: STAGING_RECOVERY_PAYLOAD_SCHEMA_VERSION,
      exportedAt: iso(this.#clock),
      principalId: this.principalId,
      documentId,
      status: this.getStatus(documentId),
      draft,
      pendingOperations,
      conflicts,
    };
    const contentSha256 = recoveryContentHash(payload);
    return stableStringify({
      ...payload,
      contentSha256,
      integrity: { ...recoveryIntegrityMetadata(), contentSha256 },
    });
  }

  verifyRecoveryJson(serialized: string, expectedDocumentId?: string): StagingRecoveryEnvelope {
    const envelope = verifyStagingRecoveryJson(serialized);
    if (envelope.principalId !== this.principalId) {
      throw recoveryError("RECOVERY_PRINCIPAL_MISMATCH", "Recovery JSON belongs to another principal.", 403);
    }
    if (expectedDocumentId !== undefined && envelope.documentId !== expectedDocumentId) {
      throw recoveryError("RECOVERY_DOCUMENT_MISMATCH", "Recovery JSON belongs to another document.", 409);
    }
    return envelope;
  }

  async #save(document: TimelineDocument, kind: StagingSyncOperationKind, label?: string): Promise<StagingHybridStatus> {
    assertOwnedDocument(this.principalId, document);
    const savedAt = iso(this.#clock);
    await this.#local.saveDraftAndQueue({
      principalId: this.principalId,
      document: clone(document),
      kind,
      baseRevision: document.revision,
      label,
      savedAt,
    });
    const pendingOperations = (await this.#local.listOperations(this.principalId, document.id)).length;
    this.#setStatus(document.id, {
      state: "LOCAL_SAVED",
      principalId: this.principalId,
      documentId: document.id,
      localSavedAt: savedAt,
      cloudSyncedAt: this.getStatus(document.id)?.cloudSyncedAt ?? null,
      pendingOperations,
      preserveLocalDraft: true,
    });
    const availability = this.#remote.getAvailability();
    if (!availability.enabled) return this.#availabilityStatus(document.id, "LOCAL_SAVED", "REMOTE_DISABLED", pendingOperations);
    if (!availability.online) return this.#availabilityStatus(document.id, "OFFLINE", "NETWORK_OFFLINE", pendingOperations);
    if (!availability.authenticated) return this.#availabilityStatus(document.id, "AUTH_REQUIRED", "AUTH_EXPIRED", pendingOperations);
    return this.#setStatus(document.id, {
      ...this.getStatus(document.id)!,
      state: "SYNC_PENDING",
      pendingOperations,
    });
  }

  async #flushInternal(documentId: string): Promise<StagingHybridStatus> {
    let operations = await this.#coalescedOperations(documentId);
    const pendingOperations = operations.length;
    if (!pendingOperations) {
      const prior = this.getStatus(documentId);
      return this.#setStatus(documentId, {
        state: prior?.cloudSyncedAt ? "CLOUD_SYNCED" : "LOCAL_SAVED",
        principalId: this.principalId,
        documentId,
        localSavedAt: prior?.localSavedAt ?? null,
        cloudSyncedAt: prior?.cloudSyncedAt ?? null,
        pendingOperations: 0,
        preserveLocalDraft: true,
      });
    }

    const availability = this.#remote.getAvailability();
    if (!availability.enabled) return this.#availabilityStatus(documentId, "LOCAL_SAVED", "REMOTE_DISABLED", pendingOperations);
    if (!availability.online) return this.#availabilityStatus(documentId, "OFFLINE", "NETWORK_OFFLINE", pendingOperations);
    if (!availability.authenticated) return this.#availabilityStatus(documentId, "AUTH_REQUIRED", "AUTH_EXPIRED", pendingOperations);
    if ((await this.#local.listConflicts(this.principalId, documentId)).length) {
      return this.#availabilityStatus(documentId, "CONFLICT", "REVISION_CONFLICT", pendingOperations);
    }

    this.#setStatus(documentId, {
      ...this.#baseStatus(documentId, pendingOperations),
      state: "SYNC_PENDING",
    });

    for (const operation of operations) {
      const result = await this.#syncWithRetries(operation);
      if (result) return result;
      await this.#local.removeOperations(this.principalId, [operation.id]);
    }
    operations = await this.#local.listOperations(this.principalId, documentId);
    return this.#setStatus(documentId, {
      ...this.#baseStatus(documentId, operations.length),
      state: operations.length ? "SYNC_PENDING" : "CLOUD_SYNCED",
      cloudSyncedAt: operations.length ? this.#baseStatus(documentId, operations.length).cloudSyncedAt : iso(this.#clock),
      errorCode: undefined,
      reason: undefined,
      conflictId: undefined,
    });
  }

  async #syncWithRetries(operation: StagingPendingOperation): Promise<StagingHybridStatus | null> {
    for (let attempt = 1; attempt <= this.#maxAttemptsPerFlush; attempt += 1) {
      await this.#local.recordAttempt(this.principalId, operation.id);
      try {
        const baseRevision = this.#remoteRevisions.get(scopedKey(this.principalId, operation.documentId)) ?? operation.baseRevision;
        const request: StagingCheckpointRequest = {
          principalId: this.principalId,
          documentId: operation.documentId,
          deviceId: this.#deviceId,
          baseRevision,
          document: clone(operation.document),
          idempotencyKey: operation.idempotencyKey,
        };
        const result = operation.kind === "VERSION"
          ? await this.#remote.createVersion({ ...request, label: operation.label ?? "Named version" })
          : await this.#remote.saveCheckpoint(request);
        this.#remoteRevisions.set(scopedKey(this.principalId, operation.documentId), result.revision);
        return null;
      } catch (error) {
        if (isAuthFailure(error)) {
          return this.#availabilityStatus(operation.documentId, "AUTH_REQUIRED", "AUTH_EXPIRED", await this.#pendingCount(operation.documentId), errorCode(error));
        }
        if (isOfflineFailure(error)) {
          return this.#availabilityStatus(operation.documentId, "OFFLINE", "NETWORK_OFFLINE", await this.#pendingCount(operation.documentId), errorCode(error));
        }
        if (isConflict(error)) return this.#recordConflict(operation, error);
        if (attempt < this.#maxAttemptsPerFlush && isRetryable(error)) continue;
        return this.#availabilityStatus(operation.documentId, "ERROR", "SYNC_FAILURE", await this.#pendingCount(operation.documentId), errorCode(error));
      }
    }
    return this.#availabilityStatus(operation.documentId, "ERROR", "SYNC_FAILURE", await this.#pendingCount(operation.documentId), "REMOTE_SYNC_FAILED");
  }

  async #recordConflict(operation: StagingPendingOperation, error: unknown): Promise<StagingHybridStatus> {
    let remoteDocument: TimelineDocument;
    try {
      remoteDocument = await this.#remote.getCurrentDocument(this.principalId, operation.documentId);
      assertOwnedDocument(this.principalId, remoteDocument);
    } catch {
      return this.#availabilityStatus(
        operation.documentId,
        "ERROR",
        "SYNC_FAILURE",
        await this.#pendingCount(operation.documentId),
        "CONFLICT_REMOTE_SNAPSHOT_UNAVAILABLE",
      );
    }
    const currentRevision = remoteDocument.revision;
    const conflict: StagingConflictRecord = {
      id: `conflict_${sha256(`${operation.id}:${currentRevision}:${documentHash(remoteDocument)}`).slice(0, 32)}`,
      principalId: this.principalId,
      documentId: operation.documentId,
      operationId: operation.id,
      idempotencyKey: operation.idempotencyKey,
      baseRevision: operation.baseRevision,
      currentRevision,
      localDocument: clone(operation.document),
      remoteDocument: clone(remoteDocument),
      localSha256: documentHash(operation.document),
      remoteSha256: documentHash(remoteDocument),
      recordedAt: iso(this.#clock),
      resolution: "UNRESOLVED",
    };
    await this.#local.putConflict(conflict);
    return this.#setStatus(operation.documentId, {
      ...this.#baseStatus(operation.documentId, await this.#pendingCount(operation.documentId)),
      state: "CONFLICT",
      reason: "REVISION_CONFLICT",
      conflictId: conflict.id,
      errorCode: errorCode(error),
    });
  }

  async #coalescedOperations(documentId: string): Promise<StagingPendingOperation[]> {
    const operations = await this.#local.listOperations(this.principalId, documentId);
    const retained: StagingPendingOperation[] = [];
    const superseded: string[] = [];
    let checkpoint: StagingPendingOperation | null = null;
    for (const operation of operations) {
      if (operation.kind === "CHECKPOINT") {
        if (checkpoint) superseded.push(checkpoint.id);
        checkpoint = operation;
        continue;
      }
      if (checkpoint) retained.push(checkpoint);
      checkpoint = null;
      retained.push(operation);
    }
    if (checkpoint) retained.push(checkpoint);
    if (superseded.length) await this.#local.removeOperations(this.principalId, superseded);
    return retained;
  }

  async #pendingCount(documentId: string): Promise<number> {
    return (await this.#local.listOperations(this.principalId, documentId)).length;
  }

  #availabilityStatus(
    documentId: string,
    state: StagingSyncState,
    reason: StagingHybridStatus["reason"],
    pendingOperations: number,
    code?: string,
  ): StagingHybridStatus {
    return this.#setStatus(documentId, {
      ...this.#baseStatus(documentId, pendingOperations),
      state,
      reason,
      errorCode: code,
    });
  }

  #baseStatus(documentId: string, pendingOperations: number): StagingHybridStatus {
    const prior = this.getStatus(documentId);
    return {
      state: prior?.state ?? "LOCAL_SAVED",
      principalId: this.principalId,
      documentId,
      localSavedAt: prior?.localSavedAt ?? null,
      cloudSyncedAt: prior?.cloudSyncedAt ?? null,
      pendingOperations,
      preserveLocalDraft: true,
    };
  }

  #setStatus(documentId: string, status: StagingHybridStatus): StagingHybridStatus {
    const value = clone(status);
    this.#statuses.set(scopedKey(this.principalId, documentId), value);
    this.#onStatus(clone(value));
    return clone(value);
  }
}
