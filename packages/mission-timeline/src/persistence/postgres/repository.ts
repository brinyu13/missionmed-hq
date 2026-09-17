import type {
  AdvisorAssignment,
  ApprovalEvent,
  AuditEvent,
  CheckpointRecord,
  DocumentRecord,
  ExportJob,
  FileVaultLink,
  OutboxEvent,
  ReviewComment,
  ReviewRequest,
  TimelineArtifact,
  TimelineDocument,
  TimelineVersion,
} from "../../contracts/types.js";
import {
  canonicalDocumentHash,
  clone,
  sha256,
  stableStringify,
  validateTimelineDocument,
} from "../../core/canonical.js";
import { TimelineError } from "../../core/errors.js";
import type { TimelineRepository } from "../repository.js";
import {
  POSTGRES_TIMELINE_DOCUMENT_SCHEMA_VERSION,
  POSTGRES_TIMELINE_SCHEMA_VERSION,
  type CommentBodyCodec,
  type DeletionRequestRecord,
  type DeletionRequestStatus,
  type IdempotencyKeyRecord,
  type PostgresPool,
  type PostgresQueryable,
  type PostgresTimelineRepositoryOptions,
  type PostgresTransactionClient,
  type RecordIdempotencyResultInput,
} from "./types.js";

const REQUIRED_TABLES = [
  "principals",
  "principal_programs",
  "documents",
  "versions",
  "checkpoints",
  "advisor_assignments",
  "faculty_grants",
  "review_requests",
  "comments",
  "approval_events",
  "media_objects",
  "export_jobs",
  "artifacts",
  "artifact_files",
  "filevault_links",
  "outbox_events",
  "idempotency_keys",
  "audit_events",
  "deletion_requests",
] as const;

const DOCUMENT_COLUMNS = `
  id, owner_principal_id, program_id, schema_version, current_revision,
  current_version_id, status, document_json, created_at, updated_at, deleted_at
`;

const VERSION_COLUMNS = `
  id, document_id, revision, parent_version_id, label, snapshot_json,
  content_sha256, created_by, created_at
`;

const REVIEW_COLUMNS = `
  id, document_id, version_id, version_sha256, requested_by, assigned_to,
  status, created_at, updated_at
`;

const EXPORT_COLUMNS = `
  id, document_id, version_id, artifact_type, export_scope, renderer, status,
  requested_by, idempotency_key, artifact_id, error_code, created_at, updated_at
`;

const ARTIFACT_COLUMNS = `
  id, document_id, version_id, artifact_type, export_scope, manifest_json,
  content_sha256, status, created_at
`;

const SCHEMA_CHECK_SQL = `
  SELECT
    count(DISTINCT c.relname) = $2::integer AS schema_complete,
    timeline.schema_version() AS schema_version
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'timeline'
    AND c.relkind IN ('r', 'p')
    AND c.relname = ANY($1::text[])
`;

const SELECT_VERSION_BY_ID_SQL = `
  SELECT ${VERSION_COLUMNS}
  FROM timeline.versions
  WHERE id = $1
`;

const DOCUMENT_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED", "DELETED"] as const;
const REVIEW_STATUSES = ["REQUESTED", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "CLOSED"] as const;
const COMMENT_VISIBILITIES = ["SHARED", "ADVISOR_ONLY"] as const;
const COMMENT_STATUSES = ["OPEN", "RESOLVED"] as const;
const APPROVAL_DECISIONS = ["APPROVED", "CHANGES_REQUESTED", "INVALIDATED"] as const;
const EXPORT_RENDERERS = ["MAC_PRO_AUTHORITY", "WEB_CANDIDATE", "FIXTURE"] as const;
const EXPORT_STATUSES = ["QUEUED", "RUNNING", "COMPLETED", "FAILED"] as const;
const FILEVAULT_ADAPTERS = ["LEGACY", "V2"] as const;
const FILEVAULT_STORAGE_STATUSES = ["PENDING", "LINKED", "FAILED", "WITHDRAWN"] as const;
const AUDIT_OUTCOMES = ["ALLOW", "DENY", "SUCCESS", "FAILURE"] as const;
const DELETION_STATUSES = ["REQUESTED", "LEGAL_HOLD", "IN_PROGRESS", "COMPLETED", "DENIED"] as const;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

type DatabaseRow = Record<string, unknown>;

interface SharedSchemaState {
  check?: Promise<void>;
}

interface InternalRepositoryState {
  client?: PostgresTransactionClient;
  schemaState?: SharedSchemaState;
}

function invalidStoredData(entity: string): never {
  throw new TimelineError("PERSISTENCE_DATA_INVALID", "Stored persistence data is invalid.", 500, { entity });
}

function requiredText(row: DatabaseRow, key: string, entity: string): string {
  const value = stringValue(row, key, entity);
  if (value.length === 0) invalidStoredData(entity);
  return value;
}

function stringValue(row: DatabaseRow, key: string, entity: string): string {
  const value = row[key];
  if (typeof value !== "string") invalidStoredData(entity);
  return value;
}

function nullableText(row: DatabaseRow, key: string, entity: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") invalidStoredData(entity);
  return value;
}

function integerValue(row: DatabaseRow, key: string, entity: string): number {
  const raw = row[key];
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(value)) invalidStoredData(entity);
  return value;
}

function booleanValue(row: DatabaseRow, key: string, entity: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean") invalidStoredData(entity);
  return value;
}

function timestampValue(row: DatabaseRow, key: string, entity: string): string {
  const value = row[key];
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) invalidStoredData(entity);
  return date.toISOString();
}

function nullableTimestamp(row: DatabaseRow, key: string, entity: string): string | null {
  if (row[key] === null || row[key] === undefined) return null;
  return timestampValue(row, key, entity);
}

function jsonValue<T>(row: DatabaseRow, key: string, entity: string): T {
  const raw = row[key];
  try {
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as T) : (raw as T);
    return clone(parsed);
  } catch {
    return invalidStoredData(entity);
  }
}

function enumValue<const Values extends readonly string[]>(
  row: DatabaseRow,
  key: string,
  allowed: Values,
  entity: string,
): Values[number] {
  const value = row[key];
  if (typeof value !== "string" || !allowed.includes(value)) invalidStoredData(entity);
  return value;
}

function inputTimestamp(value: string, field: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TimelineError("PERSISTENCE_INPUT_INVALID", "Persistence input is invalid.", 400, { field });
  }
  return date.toISOString();
}

function inputHash(value: string, field: string): string {
  if (!SHA256_PATTERN.test(value)) {
    throw new TimelineError("PERSISTENCE_INPUT_INVALID", "Persistence input is invalid.", 400, { field });
  }
  return value;
}

function inputDocument(document: TimelineDocument): TimelineDocument {
  const copy = clone(document);
  try {
    validateTimelineDocument(copy);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "DOCUMENT_INVALID";
    throw new TimelineError("DOCUMENT_INVALID", "Timeline document is invalid.", 400, { reason });
  }
  return copy;
}

function sameValue(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function mapDocument(row: DatabaseRow): DocumentRecord {
  const entity = "document";
  const document = jsonValue<TimelineDocument>(row, "document_json", entity);
  try {
    validateTimelineDocument(document);
  } catch {
    invalidStoredData(entity);
  }
  if (
    document.id !== requiredText(row, "id", entity) ||
    document.studentOwnerId !== requiredText(row, "owner_principal_id", entity) ||
    document.programId !== requiredText(row, "program_id", entity) ||
    document.schemaVersion !== requiredText(row, "schema_version", entity) ||
    document.revision !== integerValue(row, "current_revision", entity)
  ) {
    invalidStoredData(entity);
  }
  return {
    document,
    currentVersionId: nullableText(row, "current_version_id", entity),
    status: enumValue(row, "status", DOCUMENT_STATUSES, entity),
    createdAt: timestampValue(row, "created_at", entity),
    updatedAt: timestampValue(row, "updated_at", entity),
  };
}

function mapVersion(row: DatabaseRow): TimelineVersion {
  const entity = "version";
  const snapshot = jsonValue<TimelineDocument>(row, "snapshot_json", entity);
  try {
    validateTimelineDocument(snapshot);
  } catch {
    invalidStoredData(entity);
  }
  const contentSha256 = inputStoredHash(row, "content_sha256", entity);
  const version: TimelineVersion = {
    id: requiredText(row, "id", entity),
    documentId: requiredText(row, "document_id", entity),
    revision: integerValue(row, "revision", entity),
    parentVersionId: nullableText(row, "parent_version_id", entity),
    label: requiredText(row, "label", entity),
    snapshot,
    contentSha256,
    createdBy: requiredText(row, "created_by", entity),
    createdAt: timestampValue(row, "created_at", entity),
  };
  if (
    snapshot.id !== version.documentId ||
    snapshot.revision !== version.revision ||
    canonicalDocumentHash(snapshot) !== contentSha256
  ) {
    invalidStoredData(entity);
  }
  return version;
}

function inputStoredHash(row: DatabaseRow, key: string, entity: string): string {
  const value = requiredText(row, key, entity);
  if (!SHA256_PATTERN.test(value)) invalidStoredData(entity);
  return value;
}

function mapCheckpoint(row: DatabaseRow): CheckpointRecord {
  const entity = "checkpoint";
  const snapshot = jsonValue<TimelineDocument>(row, "snapshot_json", entity);
  try {
    validateTimelineDocument(snapshot);
  } catch {
    invalidStoredData(entity);
  }
  const checkpoint: CheckpointRecord = {
    id: requiredText(row, "id", entity),
    documentId: requiredText(row, "document_id", entity),
    deviceId: requiredText(row, "device_id", entity),
    baseRevision: integerValue(row, "base_revision", entity),
    snapshot,
    createdAt: timestampValue(row, "created_at", entity),
    expiresAt: timestampValue(row, "expires_at", entity),
  };
  if (snapshot.id !== checkpoint.documentId || snapshot.revision !== checkpoint.baseRevision) invalidStoredData(entity);
  return checkpoint;
}

function mapAssignment(row: DatabaseRow): AdvisorAssignment {
  const entity = "advisor_assignment";
  return {
    documentId: requiredText(row, "document_id", entity),
    advisorPrincipalId: requiredText(row, "advisor_principal_id", entity),
    programId: requiredText(row, "program_id", entity),
    startsAt: timestampValue(row, "starts_at", entity),
    endsAt: nullableTimestamp(row, "ends_at", entity),
  };
}

function mapReview(row: DatabaseRow): ReviewRequest {
  const entity = "review_request";
  return {
    id: requiredText(row, "id", entity),
    documentId: requiredText(row, "document_id", entity),
    versionId: requiredText(row, "version_id", entity),
    versionHash: inputStoredHash(row, "version_sha256", entity),
    requestedBy: requiredText(row, "requested_by", entity),
    assignedTo: requiredText(row, "assigned_to", entity),
    status: enumValue(row, "status", REVIEW_STATUSES, entity),
    createdAt: timestampValue(row, "created_at", entity),
    updatedAt: timestampValue(row, "updated_at", entity),
  };
}

async function mapComment(row: DatabaseRow, codec: CommentBodyCodec): Promise<ReviewComment> {
  const entity = "review_comment";
  let body: string;
  try {
    body = await codec.decrypt(requiredText(row, "body_ciphertext", entity));
  } catch {
    throw new TimelineError("COMMENT_BODY_CODEC_FAILED", "Review comment could not be decrypted.", 500);
  }
  if (typeof body !== "string") invalidStoredData(entity);
  return {
    id: requiredText(row, "id", entity),
    reviewRequestId: requiredText(row, "review_request_id", entity),
    authorId: requiredText(row, "author_id", entity),
    authorRole: requiredText(row, "author_role", entity) as ReviewComment["authorRole"],
    body,
    visibility: enumValue(row, "visibility", COMMENT_VISIBILITIES, entity),
    anchor: jsonValue<Record<string, unknown>>(row, "anchor_json", entity),
    status: enumValue(row, "status", COMMENT_STATUSES, entity),
    createdAt: timestampValue(row, "created_at", entity),
  };
}

function mapApproval(row: DatabaseRow): ApprovalEvent {
  const entity = "approval_event";
  return {
    id: requiredText(row, "id", entity),
    reviewRequestId: requiredText(row, "review_request_id", entity),
    documentId: requiredText(row, "document_id", entity),
    versionId: requiredText(row, "version_id", entity),
    contentSha256: inputStoredHash(row, "content_sha256", entity),
    decision: enumValue(row, "decision", APPROVAL_DECISIONS, entity),
    actorId: requiredText(row, "actor_id", entity),
    reason: requiredText(row, "reason", entity),
    createdAt: timestampValue(row, "created_at", entity),
  };
}

function mapExportJob(row: DatabaseRow): ExportJob {
  const entity = "export_job";
  const artifactId = nullableText(row, "artifact_id", entity);
  const errorCode = nullableText(row, "error_code", entity);
  return {
    id: requiredText(row, "id", entity),
    documentId: requiredText(row, "document_id", entity),
    versionId: requiredText(row, "version_id", entity),
    artifactType: requiredText(row, "artifact_type", entity) as ExportJob["artifactType"],
    scope: requiredText(row, "export_scope", entity),
    requestedBy: requiredText(row, "requested_by", entity),
    renderer: enumValue(row, "renderer", EXPORT_RENDERERS, entity),
    status: enumValue(row, "status", EXPORT_STATUSES, entity),
    idempotencyKey: requiredText(row, "idempotency_key", entity),
    ...(artifactId ? { artifactId } : {}),
    ...(errorCode ? { errorCode } : {}),
    createdAt: timestampValue(row, "created_at", entity),
    updatedAt: timestampValue(row, "updated_at", entity),
  };
}

function mapArtifact(row: DatabaseRow): TimelineArtifact {
  const entity = "artifact";
  const artifact = jsonValue<TimelineArtifact>(row, "manifest_json", entity);
  const id = requiredText(row, "id", entity);
  const documentId = requiredText(row, "document_id", entity);
  const versionId = requiredText(row, "version_id", entity);
  const contentSha256 = inputStoredHash(row, "content_sha256", entity);
  if (
    !artifact ||
    typeof artifact !== "object" ||
    artifact.artifactId !== id ||
    artifact.timelineDocumentId !== documentId ||
    artifact.timelineVersionId !== versionId ||
    artifact.artifactType !== requiredText(row, "artifact_type", entity) ||
    artifact.exportScope !== requiredText(row, "export_scope", entity) ||
    artifact.contentHash !== contentSha256
  ) {
    invalidStoredData(entity);
  }
  return artifact;
}

function mapFileVaultLink(row: DatabaseRow): FileVaultLink {
  const entity = "filevault_link";
  const storageStatus = enumValue(row, "status", FILEVAULT_STORAGE_STATUSES, entity);
  if (storageStatus === "PENDING") invalidStoredData(entity);
  const errorCode = nullableText(row, "last_error_code", entity);
  const externalFileId = stringValue(row, "external_file_id", entity);
  const externalVersionId = stringValue(row, "external_version_id", entity);
  if (storageStatus === "LINKED" && (!externalFileId || !externalVersionId)) invalidStoredData(entity);
  return {
    id: requiredText(row, "id", entity),
    artifactId: requiredText(row, "artifact_id", entity),
    adapter: enumValue(row, "adapter", FILEVAULT_ADAPTERS, entity),
    externalFileId,
    externalVersionId,
    status: storageStatus === "WITHDRAWN" ? "SUPERSEDED" : storageStatus,
    artifactHash: inputStoredHash(row, "artifact_sha256", entity),
    createdAt: timestampValue(row, "created_at", entity),
    updatedAt: timestampValue(row, "updated_at", entity),
    ...(errorCode ? { errorCode } : {}),
  };
}

function mapAudit(row: DatabaseRow): AuditEvent {
  const entity = "audit_event";
  return {
    id: requiredText(row, "id", entity),
    actorId: requiredText(row, "actor_id", entity),
    action: requiredText(row, "action", entity),
    resourceType: requiredText(row, "resource_type", entity),
    resourceId: requiredText(row, "resource_id", entity),
    outcome: enumValue(row, "outcome", AUDIT_OUTCOMES, entity),
    requestId: requiredText(row, "request_id", entity),
    metadata: jsonValue<AuditEvent["metadata"]>(row, "metadata_json", entity),
    createdAt: timestampValue(row, "created_at", entity),
  };
}

function mapOutbox(row: DatabaseRow): OutboxEvent {
  const entity = "outbox_event";
  return {
    id: requiredText(row, "id", entity),
    aggregateId: requiredText(row, "aggregate_id", entity),
    eventType: requiredText(row, "event_type", entity),
    payload: jsonValue<OutboxEvent["payload"]>(row, "payload_json", entity),
    attempts: integerValue(row, "attempts", entity),
    availableAt: timestampValue(row, "available_at", entity),
    publishedAt: nullableTimestamp(row, "published_at", entity),
  };
}

function mapIdempotencyKey(row: DatabaseRow): IdempotencyKeyRecord {
  const entity = "idempotency_key";
  return {
    principalId: requiredText(row, "principal_id", entity),
    operation: requiredText(row, "operation", entity),
    idempotencyKey: requiredText(row, "idempotency_key", entity),
    responseSha256: inputStoredHash(row, "response_sha256", entity),
    expiresAt: timestampValue(row, "expires_at", entity),
    createdAt: timestampValue(row, "created_at", entity),
  };
}

function mapDeletionRequest(row: DatabaseRow): DeletionRequestRecord {
  const entity = "deletion_request";
  return {
    id: requiredText(row, "id", entity),
    principalId: requiredText(row, "principal_id", entity),
    documentId: requiredText(row, "document_id", entity),
    status: enumValue(row, "status", DELETION_STATUSES, entity),
    legalHold: booleanValue(row, "legal_hold", entity),
    createdAt: timestampValue(row, "created_at", entity),
    completedAt: nullableTimestamp(row, "completed_at", entity),
  };
}

function postgresCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : undefined;
}

export function asPostgresTimelineError(error: unknown): TimelineError {
  if (error instanceof TimelineError) return error;
  const code = postgresCode(error);
  if (code === "23503") {
    return new TimelineError("PERSISTENCE_REFERENCE_CONFLICT", "A referenced persistence record does not exist.", 409);
  }
  if (code === "23505") {
    return new TimelineError("PERSISTENCE_CONFLICT", "A conflicting persistence record already exists.", 409);
  }
  if (code === "23514" || code === "22P02" || code === "22003") {
    return new TimelineError("PERSISTENCE_CONSTRAINT_VIOLATION", "Persistence input violates a database constraint.", 400);
  }
  if (code === "42501") {
    return new TimelineError("PERSISTENCE_ACCESS_DENIED", "Database policy denied the persistence operation.", 403);
  }
  if (code === "40001" || code === "40P01" || code === "55P03") {
    return new TimelineError("PERSISTENCE_RETRY_REQUIRED", "The persistence operation must be retried.", 409, {
      retryable: true,
    });
  }
  if (code === "3F000" || code === "42P01" || code === "42703" || code === "42883") {
    return new TimelineError("PERSISTENCE_SCHEMA_MISMATCH", "Timeline database schema is not compatible.", 503, {
      expectedSchemaVersion: POSTGRES_TIMELINE_SCHEMA_VERSION,
    });
  }
  return new TimelineError("PERSISTENCE_UNAVAILABLE", "Timeline persistence is unavailable.", 503, { retryable: true });
}

export class PostgresTimelineRepository implements TimelineRepository {
  private readonly options: PostgresTimelineRepositoryOptions;
  private readonly client?: PostgresTransactionClient;
  private readonly schemaState: SharedSchemaState;

  constructor(
    private readonly pool: PostgresPool,
    options: PostgresTimelineRepositoryOptions = {},
    internal: InternalRepositoryState = {},
  ) {
    if (options.runtimeRole && !/^[a-z_][a-z0-9_]*$/.test(options.runtimeRole)) {
      throw new TypeError("PostgreSQL runtime role is invalid.");
    }
    this.options = {
      ...options,
      rlsClaims: options.rlsClaims
        ? {
            ...options.rlsClaims,
            program_ids: [...options.rlsClaims.program_ids],
            service_scopes: [...options.rlsClaims.service_scopes],
          }
        : undefined,
    };
    this.client = internal.client;
    this.schemaState = internal.schemaState ?? {};
  }

  async initialize(): Promise<void> {
    await this.assertSchemaVersion();
  }

  async assertSchemaVersion(): Promise<void> {
    if (this.schemaState.check) return this.schemaState.check;
    const check = this.performSchemaCheck();
    this.schemaState.check = check;
    try {
      await check;
    } catch (error) {
      if (this.schemaState.check === check) this.schemaState.check = undefined;
      throw asPostgresTimelineError(error);
    }
  }

  async withTransaction<T>(work: (unitOfWork: PostgresTimelineRepository) => Promise<T>): Promise<T> {
    if (this.client) return work(this);
    await this.assertSchemaVersion();

    let client: PostgresTransactionClient;
    try {
      client = await this.pool.connect();
    } catch (error) {
      throw asPostgresTimelineError(error);
    }

    let transactionStarted = false;
    let releaseError: Error | boolean | undefined;
    try {
      await client.query("BEGIN");
      transactionStarted = true;
      if (this.options.runtimeRole) {
        await client.query(`SET LOCAL ROLE ${this.options.runtimeRole}`);
      }
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(this.options.rlsClaims ?? {}),
      ]);
      const unitOfWork = new PostgresTimelineRepository(this.pool, this.options, {
        client,
        schemaState: this.schemaState,
      });
      const result = await work(unitOfWork);
      await client.query("COMMIT");
      transactionStarted = false;
      return result;
    } catch (error) {
      const translated = asPostgresTimelineError(error);
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          releaseError = rollbackError instanceof Error ? rollbackError : true;
          throw new TimelineError("PERSISTENCE_ROLLBACK_FAILED", "Timeline persistence rollback failed.", 503, {
            originalCode: translated.code,
          });
        }
      } else {
        releaseError = error instanceof Error ? error : true;
      }
      throw translated;
    } finally {
      client.release(releaseError);
    }
  }

  async createDocument(record: DocumentRecord): Promise<DocumentRecord> {
    const document = inputDocument(record.document);
    if (document.schemaVersion !== POSTGRES_TIMELINE_DOCUMENT_SCHEMA_VERSION || document.revision !== 0) {
      throw new TimelineError("DOCUMENT_INITIAL_STATE_INVALID", "Document initial persistence state is invalid.", 400);
    }
    if (record.currentVersionId !== null) {
      throw new TimelineError("DOCUMENT_INITIAL_STATE_INVALID", "Document initial persistence state is invalid.", 400);
    }
    const createdAt = inputTimestamp(record.createdAt, "createdAt");
    const updatedAt = inputTimestamp(record.updatedAt, "updatedAt");

    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.documents (
            id, owner_principal_id, program_id, schema_version, current_revision,
            current_version_id, status, document_json, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz, $10::timestamptz)
          ON CONFLICT (id) DO NOTHING
          RETURNING ${DOCUMENT_COLUMNS}
        `,
        [
          document.id,
          document.studentOwnerId,
          document.programId,
          document.schemaVersion,
          document.revision,
          null,
          record.status,
          JSON.stringify(document),
          createdAt,
          updatedAt,
        ],
      );
      if (!result.rows[0]) throw new TimelineError("DOCUMENT_EXISTS", "Document already exists.", 409);
      return mapDocument(result.rows[0]);
    });
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `SELECT ${DOCUMENT_COLUMNS} FROM timeline.documents WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapDocument(result.rows[0]) : null;
    });
  }

  async listDocumentsForOwner(ownerPrincipalId: string): Promise<DocumentRecord[]> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT ${DOCUMENT_COLUMNS}
          FROM timeline.documents
          WHERE owner_principal_id = $1
            AND status <> 'DELETED'
            AND deleted_at IS NULL
          ORDER BY updated_at DESC, id ASC
        `,
        [ownerPrincipalId],
      );
      return result.rows.map(mapDocument);
    });
  }

  async listAccessibleDocuments(_principalId: string): Promise<DocumentRecord[]> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT ${DOCUMENT_COLUMNS}
          FROM timeline.documents
          WHERE status <> 'DELETED'
            AND deleted_at IS NULL
          ORDER BY updated_at DESC, id ASC
        `,
      );
      return result.rows.map(mapDocument);
    });
  }

  async saveCheckpoint(checkpoint: CheckpointRecord): Promise<CheckpointRecord> {
    const snapshot = inputDocument(checkpoint.snapshot);
    const createdAt = inputTimestamp(checkpoint.createdAt, "createdAt");
    const expiresAt = inputTimestamp(checkpoint.expiresAt, "expiresAt");
    if (expiresAt <= createdAt) {
      throw new TimelineError("CHECKPOINT_EXPIRY_INVALID", "Checkpoint expiry must be after creation.", 400);
    }
    if (
      snapshot.id !== checkpoint.documentId ||
      snapshot.revision !== checkpoint.baseRevision ||
      snapshot.schemaVersion !== POSTGRES_TIMELINE_DOCUMENT_SCHEMA_VERSION
    ) {
      throw new TimelineError("CHECKPOINT_SNAPSHOT_MISMATCH", "Checkpoint snapshot does not match its document.", 400);
    }

    return this.run(async (database) => {
      const documentResult = await database.query<DatabaseRow>(
        `
          SELECT current_revision, owner_principal_id, program_id, schema_version, status
          FROM timeline.documents
          WHERE id = $1
          FOR SHARE
        `,
        [checkpoint.documentId],
      );
      const current = documentResult.rows[0];
      if (!current || current.status === "DELETED") {
        throw new TimelineError("DOCUMENT_NOT_FOUND", "Document not found.", 404);
      }
      const currentRevision = integerValue(current, "current_revision", "document");
      if (currentRevision !== checkpoint.baseRevision) {
        throw new TimelineError("REVISION_CONFLICT", "A newer document revision exists.", 409, {
          expectedRevision: checkpoint.baseRevision,
          currentRevision,
        });
      }
      if (
        snapshot.studentOwnerId !== requiredText(current, "owner_principal_id", "document") ||
        snapshot.programId !== requiredText(current, "program_id", "document") ||
        snapshot.schemaVersion !== requiredText(current, "schema_version", "document")
      ) {
        throw new TimelineError("CHECKPOINT_SNAPSHOT_MISMATCH", "Checkpoint snapshot does not match its document.", 400);
      }

      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.checkpoints (
            id, document_id, device_id, base_revision, snapshot_json, created_at, expires_at
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz)
          ON CONFLICT (document_id, device_id) DO UPDATE SET
            id = EXCLUDED.id,
            base_revision = EXCLUDED.base_revision,
            snapshot_json = EXCLUDED.snapshot_json,
            created_at = EXCLUDED.created_at,
            expires_at = EXCLUDED.expires_at
          RETURNING id, document_id, device_id, base_revision, snapshot_json, created_at, expires_at
        `,
        [
          checkpoint.id,
          checkpoint.documentId,
          checkpoint.deviceId,
          checkpoint.baseRevision,
          JSON.stringify(snapshot),
          createdAt,
          expiresAt,
        ],
      );
      if (!result.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Checkpoint was not persisted.", 500);
      return mapCheckpoint(result.rows[0]);
    });
  }

  async saveVersion(
    documentId: string,
    expectedRevision: number,
    nextRecord: DocumentRecord,
    version: TimelineVersion,
  ): Promise<TimelineVersion> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new TimelineError("REVISION_INVALID", "Expected revision is invalid.", 400);
    }
    const snapshot = inputDocument(version.snapshot);
    const nextDocument = inputDocument(nextRecord.document);
    const revision = expectedRevision + 1;
    if (
      version.documentId !== documentId ||
      version.revision !== revision ||
      snapshot.id !== documentId ||
      snapshot.revision !== revision ||
      nextDocument.id !== documentId ||
      nextDocument.revision !== revision ||
      nextRecord.currentVersionId !== version.id ||
      nextRecord.status === "DELETED" ||
      !sameValue(snapshot, nextDocument)
    ) {
      throw new TimelineError("VERSION_DOCUMENT_MISMATCH", "Version does not match the document revision.", 400);
    }
    const contentSha256 = canonicalDocumentHash(snapshot);
    const canonicalVersion: TimelineVersion = {
      ...clone(version),
      snapshot,
      contentSha256,
      createdAt: inputTimestamp(version.createdAt, "createdAt"),
    };
    const updatedAt = inputTimestamp(nextRecord.updatedAt, "updatedAt");

    return this.run(async (database) => {
      const documentResult = await database.query<DatabaseRow>(
        `
          SELECT current_revision, current_version_id, owner_principal_id, program_id, schema_version, status
          FROM timeline.documents
          WHERE id = $1
          FOR UPDATE
        `,
        [documentId],
      );
      const current = documentResult.rows[0];
      if (!current || current.status === "DELETED") {
        throw new TimelineError("DOCUMENT_NOT_FOUND", "Document not found.", 404);
      }

      const existingResult = await database.query<DatabaseRow>(SELECT_VERSION_BY_ID_SQL, [canonicalVersion.id]);
      if (existingResult.rows[0]) {
        const existing = mapVersion(existingResult.rows[0]);
        if (!sameValue(existing, canonicalVersion)) {
          throw new TimelineError("VERSION_IMMUTABLE_CONFLICT", "Immutable version identifier is already in use.", 409);
        }
        return existing;
      }

      const currentRevision = integerValue(current, "current_revision", "document");
      if (currentRevision !== expectedRevision) {
        throw new TimelineError("REVISION_CONFLICT", "A newer document revision exists.", 409, {
          expectedRevision,
          currentRevision,
        });
      }
      if (
        snapshot.studentOwnerId !== requiredText(current, "owner_principal_id", "document") ||
        snapshot.programId !== requiredText(current, "program_id", "document") ||
        snapshot.schemaVersion !== requiredText(current, "schema_version", "document")
      ) {
        throw new TimelineError("VERSION_DOCUMENT_MISMATCH", "Version does not match the document owner or program.", 400);
      }
      const currentVersionId = nullableText(current, "current_version_id", "document");
      if (canonicalVersion.parentVersionId !== currentVersionId) {
        throw new TimelineError("VERSION_PARENT_CONFLICT", "Version parent does not match the current version.", 409, {
          expectedParentVersionId: currentVersionId,
          actualParentVersionId: canonicalVersion.parentVersionId,
        });
      }

      const inserted = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.versions (
            id, document_id, revision, parent_version_id, label, snapshot_json,
            content_sha256, created_by, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::timestamptz)
          RETURNING ${VERSION_COLUMNS}
        `,
        [
          canonicalVersion.id,
          documentId,
          revision,
          canonicalVersion.parentVersionId,
          canonicalVersion.label,
          JSON.stringify(snapshot),
          contentSha256,
          canonicalVersion.createdBy,
          canonicalVersion.createdAt,
        ],
      );
      if (!inserted.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Version was not persisted.", 500);

      const updated = await database.query<DatabaseRow>(
        `
          UPDATE timeline.documents
          SET current_revision = $2,
              current_version_id = $3,
              status = $4,
              document_json = $5::jsonb,
              updated_at = $6::timestamptz
          WHERE id = $1
            AND current_revision = $7
            AND deleted_at IS NULL
          RETURNING id
        `,
        [documentId, revision, canonicalVersion.id, nextRecord.status, JSON.stringify(snapshot), updatedAt, expectedRevision],
      );
      if (!updated.rows[0]) {
        throw new TimelineError("REVISION_CONFLICT", "A newer document revision exists.", 409, { expectedRevision });
      }
      return mapVersion(inserted.rows[0]);
    });
  }

  async getVersion(id: string): Promise<TimelineVersion | null> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(SELECT_VERSION_BY_ID_SQL, [id]);
      return result.rows[0] ? mapVersion(result.rows[0]) : null;
    });
  }

  async listVersions(documentId: string): Promise<TimelineVersion[]> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT ${VERSION_COLUMNS}
          FROM timeline.versions
          WHERE document_id = $1
          ORDER BY revision DESC, id ASC
        `,
        [documentId],
      );
      return result.rows.map(mapVersion);
    });
  }

  async addAssignment(assignment: AdvisorAssignment): Promise<AdvisorAssignment> {
    const startsAt = inputTimestamp(assignment.startsAt, "startsAt");
    const endsAt = assignment.endsAt ? inputTimestamp(assignment.endsAt, "endsAt") : null;
    if (endsAt && endsAt <= startsAt) {
      throw new TimelineError("ASSIGNMENT_DATE_RANGE_INVALID", "Advisor assignment date range is invalid.", 400);
    }
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.advisor_assignments (
            document_id, advisor_principal_id, program_id, starts_at, ends_at
          )
          VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)
          ON CONFLICT (document_id, advisor_principal_id, starts_at) DO UPDATE SET
            program_id = EXCLUDED.program_id,
            ends_at = EXCLUDED.ends_at
          RETURNING document_id, advisor_principal_id, program_id, starts_at, ends_at
        `,
        [assignment.documentId, assignment.advisorPrincipalId, assignment.programId, startsAt, endsAt],
      );
      if (!result.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Advisor assignment was not persisted.", 500);
      return mapAssignment(result.rows[0]);
    });
  }

  async findActiveAssignment(documentId: string, at: string): Promise<AdvisorAssignment | null> {
    const effectiveAt = inputTimestamp(at, "at");
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT document_id, advisor_principal_id, program_id, starts_at, ends_at
          FROM timeline.advisor_assignments
          WHERE document_id = $1
            AND starts_at <= $2::timestamptz
            AND (ends_at IS NULL OR ends_at > $2::timestamptz)
          ORDER BY starts_at DESC, advisor_principal_id ASC
          LIMIT 1
        `,
        [documentId, effectiveAt],
      );
      return result.rows[0] ? mapAssignment(result.rows[0]) : null;
    });
  }

  async createReview(review: ReviewRequest): Promise<ReviewRequest> {
    const createdAt = inputTimestamp(review.createdAt, "createdAt");
    const updatedAt = inputTimestamp(review.updatedAt, "updatedAt");
    return this.run(async (database) => {
      const versionResult = await database.query<DatabaseRow>(SELECT_VERSION_BY_ID_SQL, [review.versionId]);
      if (!versionResult.rows[0]) throw new TimelineError("VERSION_NOT_FOUND", "Version not found.", 404);
      const version = mapVersion(versionResult.rows[0]);
      if (version.documentId !== review.documentId) throw new TimelineError("VERSION_NOT_FOUND", "Version not found.", 404);
      const canonicalReview: ReviewRequest = {
        ...clone(review),
        versionHash: version.contentSha256,
        createdAt,
        updatedAt,
      };

      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.review_requests (
            id, document_id, version_id, version_sha256, requested_by, assigned_to,
            status, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz)
          ON CONFLICT (id) DO NOTHING
          RETURNING ${REVIEW_COLUMNS}
        `,
        [
          canonicalReview.id,
          canonicalReview.documentId,
          canonicalReview.versionId,
          canonicalReview.versionHash,
          canonicalReview.requestedBy,
          canonicalReview.assignedTo,
          canonicalReview.status,
          canonicalReview.createdAt,
          canonicalReview.updatedAt,
        ],
      );
      if (result.rows[0]) return mapReview(result.rows[0]);

      const existingResult = await database.query<DatabaseRow>(
        `SELECT ${REVIEW_COLUMNS} FROM timeline.review_requests WHERE id = $1`,
        [canonicalReview.id],
      );
      if (!existingResult.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Review request was not persisted.", 500);
      const existing = mapReview(existingResult.rows[0]);
      if (!sameValue(existing, canonicalReview)) {
        throw new TimelineError("REVIEW_IMMUTABLE_CONFLICT", "Review request identifier is already in use.", 409);
      }
      return existing;
    });
  }

  async getReview(id: string): Promise<ReviewRequest | null> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `SELECT ${REVIEW_COLUMNS} FROM timeline.review_requests WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapReview(result.rows[0]) : null;
    });
  }

  async updateReview(review: ReviewRequest): Promise<ReviewRequest> {
    const updatedAt = inputTimestamp(review.updatedAt, "updatedAt");
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          UPDATE timeline.review_requests
          SET status = $2,
              updated_at = $3::timestamptz
          WHERE id = $1
            AND document_id = $4
            AND version_id = $5
            AND version_sha256 = $6
            AND requested_by = $7
            AND assigned_to = $8
            AND created_at = $9::timestamptz
          RETURNING ${REVIEW_COLUMNS}
        `,
        [
          review.id,
          review.status,
          updatedAt,
          review.documentId,
          review.versionId,
          inputHash(review.versionHash, "versionHash"),
          review.requestedBy,
          review.assignedTo,
          inputTimestamp(review.createdAt, "createdAt"),
        ],
      );
      if (result.rows[0]) return mapReview(result.rows[0]);

      const existing = await database.query<DatabaseRow>(
        `SELECT ${REVIEW_COLUMNS} FROM timeline.review_requests WHERE id = $1`,
        [review.id],
      );
      if (!existing.rows[0]) throw new TimelineError("REVIEW_NOT_FOUND", "Review request not found.", 404);
      throw new TimelineError("REVIEW_BINDING_CONFLICT", "Immutable review request fields cannot be changed.", 409);
    });
  }

  async addComment(comment: ReviewComment): Promise<ReviewComment> {
    const codec = this.requireCommentCodec();
    let ciphertext: string;
    try {
      ciphertext = await codec.encrypt(comment.body);
    } catch {
      throw new TimelineError("COMMENT_BODY_CODEC_FAILED", "Review comment could not be encrypted.", 500);
    }
    if (typeof ciphertext !== "string" || ciphertext.length === 0 || ciphertext === comment.body) {
      throw new TimelineError("COMMENT_BODY_CODEC_INVALID", "Review comment encryption did not produce ciphertext.", 500);
    }
    const createdAt = inputTimestamp(comment.createdAt, "createdAt");

    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.comments (
            id, review_request_id, author_id, author_role, body_ciphertext,
            visibility, anchor_json, status, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::timestamptz)
          ON CONFLICT (id) DO NOTHING
          RETURNING id, review_request_id, author_id, author_role, body_ciphertext,
                    visibility, anchor_json, status, created_at
        `,
        [
          comment.id,
          comment.reviewRequestId,
          comment.authorId,
          comment.authorRole,
          ciphertext,
          comment.visibility,
          JSON.stringify(comment.anchor),
          comment.status,
          createdAt,
        ],
      );
      if (result.rows[0]) return mapComment(result.rows[0], codec);

      const existingResult = await database.query<DatabaseRow>(
        `
          SELECT id, review_request_id, author_id, author_role, body_ciphertext,
                 visibility, anchor_json, status, created_at
          FROM timeline.comments
          WHERE id = $1
        `,
        [comment.id],
      );
      if (!existingResult.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Review comment was not persisted.", 500);
      const existing = await mapComment(existingResult.rows[0], codec);
      const canonicalComment = { ...clone(comment), createdAt };
      if (!sameValue(existing, canonicalComment)) {
        throw new TimelineError("COMMENT_IMMUTABLE_CONFLICT", "Review comment identifier is already in use.", 409);
      }
      return existing;
    });
  }

  async listComments(reviewRequestId: string): Promise<ReviewComment[]> {
    const codec = this.requireCommentCodec();
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT id, review_request_id, author_id, author_role, body_ciphertext,
                 visibility, anchor_json, status, created_at
          FROM timeline.comments
          WHERE review_request_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [reviewRequestId],
      );
      return Promise.all(result.rows.map((row) => mapComment(row, codec)));
    });
  }

  async addApproval(event: ApprovalEvent): Promise<ApprovalEvent> {
    const createdAt = inputTimestamp(event.createdAt, "createdAt");
    return this.run(async (database) => {
      const bindingResult = await database.query<DatabaseRow>(
        `
          SELECT r.document_id, r.version_id, v.content_sha256
          FROM timeline.review_requests r
          JOIN timeline.versions v ON v.id = r.version_id AND v.document_id = r.document_id
          WHERE r.id = $1
        `,
        [event.reviewRequestId],
      );
      const binding = bindingResult.rows[0];
      if (!binding) throw new TimelineError("REVIEW_NOT_FOUND", "Review request not found.", 404);
      if (
        requiredText(binding, "document_id", "review_request") !== event.documentId ||
        requiredText(binding, "version_id", "review_request") !== event.versionId
      ) {
        throw new TimelineError("APPROVAL_BINDING_CONFLICT", "Approval does not match the review version.", 409);
      }
      const canonicalEvent: ApprovalEvent = {
        ...clone(event),
        contentSha256: inputStoredHash(binding, "content_sha256", "version"),
        createdAt,
      };
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.approval_events (
            id, review_request_id, document_id, version_id, content_sha256,
            decision, actor_id, reason, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
          ON CONFLICT (id) DO NOTHING
          RETURNING id, review_request_id, document_id, version_id, content_sha256,
                    decision, actor_id, reason, created_at
        `,
        [
          canonicalEvent.id,
          canonicalEvent.reviewRequestId,
          canonicalEvent.documentId,
          canonicalEvent.versionId,
          canonicalEvent.contentSha256,
          canonicalEvent.decision,
          canonicalEvent.actorId,
          canonicalEvent.reason,
          canonicalEvent.createdAt,
        ],
      );
      if (result.rows[0]) return mapApproval(result.rows[0]);

      const existingResult = await database.query<DatabaseRow>(
        `
          SELECT id, review_request_id, document_id, version_id, content_sha256,
                 decision, actor_id, reason, created_at
          FROM timeline.approval_events
          WHERE id = $1
        `,
        [canonicalEvent.id],
      );
      if (!existingResult.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Approval event was not persisted.", 500);
      const existing = mapApproval(existingResult.rows[0]);
      if (!sameValue(existing, canonicalEvent)) {
        throw new TimelineError("APPROVAL_IMMUTABLE_CONFLICT", "Approval event identifier is already in use.", 409);
      }
      return existing;
    });
  }

  async listApprovals(documentId: string): Promise<ApprovalEvent[]> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT id, review_request_id, document_id, version_id, content_sha256,
                 decision, actor_id, reason, created_at
          FROM timeline.approval_events
          WHERE document_id = $1
          ORDER BY created_at ASC, id ASC
        `,
        [documentId],
      );
      return result.rows.map(mapApproval);
    });
  }

  async createExportJob(job: ExportJob): Promise<ExportJob> {
    const canonicalJob: ExportJob = {
      ...clone(job),
      createdAt: inputTimestamp(job.createdAt, "createdAt"),
      updatedAt: inputTimestamp(job.updatedAt, "updatedAt"),
    };
    if (!canonicalJob.idempotencyKey) {
      throw new TimelineError("IDEMPOTENCY_KEY_REQUIRED", "An idempotency key is required.", 400);
    }
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.export_jobs (
            id, document_id, version_id, artifact_type, export_scope, renderer,
            status, requested_by, idempotency_key, artifact_id, error_code,
            created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz)
          ON CONFLICT DO NOTHING
          RETURNING ${EXPORT_COLUMNS}
        `,
        [
          canonicalJob.id,
          canonicalJob.documentId,
          canonicalJob.versionId,
          canonicalJob.artifactType,
          canonicalJob.scope,
          canonicalJob.renderer,
          canonicalJob.status,
          canonicalJob.requestedBy,
          canonicalJob.idempotencyKey,
          canonicalJob.artifactId ?? null,
          canonicalJob.errorCode ?? null,
          canonicalJob.createdAt,
          canonicalJob.updatedAt,
        ],
      );
      if (result.rows[0]) return mapExportJob(result.rows[0]);

      const byKey = await database.query<DatabaseRow>(
        `SELECT ${EXPORT_COLUMNS} FROM timeline.export_jobs WHERE idempotency_key = $1`,
        [canonicalJob.idempotencyKey],
      );
      if (byKey.rows[0]) {
        const existing = mapExportJob(byKey.rows[0]);
        const sameOperation =
          existing.documentId === canonicalJob.documentId &&
          existing.versionId === canonicalJob.versionId &&
          existing.artifactType === canonicalJob.artifactType &&
          existing.scope === canonicalJob.scope &&
          existing.renderer === canonicalJob.renderer &&
          existing.requestedBy === canonicalJob.requestedBy;
        if (!sameOperation) {
          throw new TimelineError("IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for another operation.", 409);
        }
        return existing;
      }

      const byId = await database.query<DatabaseRow>(
        `SELECT ${EXPORT_COLUMNS} FROM timeline.export_jobs WHERE id = $1`,
        [canonicalJob.id],
      );
      if (byId.rows[0]) {
        throw new TimelineError("EXPORT_JOB_IMMUTABLE_CONFLICT", "Export job identifier is already in use.", 409);
      }
      throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Export job was not persisted.", 500);
    });
  }

  async getExportJob(id: string): Promise<ExportJob | null> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `SELECT ${EXPORT_COLUMNS} FROM timeline.export_jobs WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapExportJob(result.rows[0]) : null;
    });
  }

  async updateExportJob(job: ExportJob): Promise<ExportJob> {
    const updatedAt = inputTimestamp(job.updatedAt, "updatedAt");
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          UPDATE timeline.export_jobs
          SET status = $2,
              artifact_id = $3,
              error_code = $4,
              updated_at = $5::timestamptz
          WHERE id = $1
            AND document_id = $6
            AND version_id = $7
            AND artifact_type = $8
            AND export_scope = $9
            AND renderer = $10
            AND requested_by = $11
            AND idempotency_key = $12
            AND created_at = $13::timestamptz
          RETURNING ${EXPORT_COLUMNS}
        `,
        [
          job.id,
          job.status,
          job.artifactId ?? null,
          job.errorCode ?? null,
          updatedAt,
          job.documentId,
          job.versionId,
          job.artifactType,
          job.scope,
          job.renderer,
          job.requestedBy,
          job.idempotencyKey,
          inputTimestamp(job.createdAt, "createdAt"),
        ],
      );
      if (result.rows[0]) return mapExportJob(result.rows[0]);

      const existing = await database.query<DatabaseRow>(
        `SELECT id FROM timeline.export_jobs WHERE id = $1`,
        [job.id],
      );
      if (!existing.rows[0]) throw new TimelineError("EXPORT_JOB_NOT_FOUND", "Export job not found.", 404);
      throw new TimelineError("EXPORT_JOB_BINDING_CONFLICT", "Immutable export job fields cannot be changed.", 409);
    });
  }

  async findExportJobByIdempotencyKey(key: string): Promise<ExportJob | null> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `SELECT ${EXPORT_COLUMNS} FROM timeline.export_jobs WHERE idempotency_key = $1`,
        [key],
      );
      return result.rows[0] ? mapExportJob(result.rows[0]) : null;
    });
  }

  async addArtifact(artifact: TimelineArtifact): Promise<TimelineArtifact> {
    const canonicalArtifact = clone(artifact);
    if (canonicalArtifact.artifactSchemaVersion !== "d1-timeline-artifact-409.1") {
      throw new TimelineError("ARTIFACT_SCHEMA_UNSUPPORTED", "Artifact schema version is not supported.", 400);
    }
    inputHash(canonicalArtifact.contentHash, "contentHash");
    inputTimestamp(canonicalArtifact.createdAt, "createdAt");

    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.artifacts (
            id, document_id, version_id, artifact_type, export_scope,
            manifest_json, content_sha256, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz)
          ON CONFLICT DO NOTHING
          RETURNING ${ARTIFACT_COLUMNS}
        `,
        [
          canonicalArtifact.artifactId,
          canonicalArtifact.timelineDocumentId,
          canonicalArtifact.timelineVersionId,
          canonicalArtifact.artifactType,
          canonicalArtifact.exportScope,
          JSON.stringify(canonicalArtifact),
          canonicalArtifact.contentHash,
          canonicalArtifact.createdAt,
        ],
      );
      if (result.rows[0]) return mapArtifact(result.rows[0]);

      const existingResult = await database.query<DatabaseRow>(
        `
          SELECT ${ARTIFACT_COLUMNS}
          FROM timeline.artifacts
          WHERE id = $1
             OR (
               document_id = $2 AND version_id = $3 AND artifact_type = $4
               AND export_scope = $5 AND content_sha256 = $6
             )
          ORDER BY (id = $1) DESC
          LIMIT 1
        `,
        [
          canonicalArtifact.artifactId,
          canonicalArtifact.timelineDocumentId,
          canonicalArtifact.timelineVersionId,
          canonicalArtifact.artifactType,
          canonicalArtifact.exportScope,
          canonicalArtifact.contentHash,
        ],
      );
      if (!existingResult.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Artifact was not persisted.", 500);
      const existing = mapArtifact(existingResult.rows[0]);
      if (!sameValue(existing, canonicalArtifact)) {
        throw new TimelineError("ARTIFACT_IMMUTABLE_CONFLICT", "Immutable artifact already exists.", 409);
      }
      return existing;
    });
  }

  async getArtifact(id: string): Promise<TimelineArtifact | null> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `SELECT ${ARTIFACT_COLUMNS} FROM timeline.artifacts WHERE id = $1`,
        [id],
      );
      return result.rows[0] ? mapArtifact(result.rows[0]) : null;
    });
  }

  async saveFileVaultLink(link: FileVaultLink): Promise<FileVaultLink> {
    const createdAt = inputTimestamp(link.createdAt, "createdAt");
    const updatedAt = inputTimestamp(link.updatedAt, "updatedAt");
    const storageStatus = link.status === "SUPERSEDED" ? "WITHDRAWN" : link.status;
    inputHash(link.artifactHash, "artifactHash");

    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.filevault_links (
            id, artifact_id, adapter, external_file_id, external_version_id,
            status, artifact_sha256, last_error_code, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz)
          ON CONFLICT (artifact_id, adapter) DO UPDATE SET
            external_file_id = EXCLUDED.external_file_id,
            external_version_id = EXCLUDED.external_version_id,
            status = EXCLUDED.status,
            artifact_sha256 = EXCLUDED.artifact_sha256,
            last_error_code = EXCLUDED.last_error_code,
            updated_at = EXCLUDED.updated_at
          RETURNING id, artifact_id, adapter, external_file_id, external_version_id,
                    status, artifact_sha256, last_error_code, created_at, updated_at
        `,
        [
          link.id,
          link.artifactId,
          link.adapter,
          link.externalFileId,
          link.externalVersionId,
          storageStatus,
          link.artifactHash,
          link.errorCode ?? null,
          createdAt,
          updatedAt,
        ],
      );
      if (!result.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "FileVault link was not persisted.", 500);
      return mapFileVaultLink(result.rows[0]);
    });
  }

  async getFileVaultLink(artifactId: string, adapter: FileVaultLink["adapter"]): Promise<FileVaultLink | null> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT id, artifact_id, adapter, external_file_id, external_version_id,
                 status, artifact_sha256, last_error_code, created_at, updated_at
          FROM timeline.filevault_links
          WHERE artifact_id = $1 AND adapter = $2
        `,
        [artifactId, adapter],
      );
      return result.rows[0] ? mapFileVaultLink(result.rows[0]) : null;
    });
  }

  async addAudit(event: AuditEvent): Promise<void> {
    const canonicalEvent: AuditEvent = {
      ...clone(event),
      createdAt: inputTimestamp(event.createdAt, "createdAt"),
    };
    await this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.audit_events (
            id, actor_id, action, resource_type, resource_id, outcome,
            request_id, metadata_json, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::timestamptz)
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `,
        [
          canonicalEvent.id,
          canonicalEvent.actorId,
          canonicalEvent.action,
          canonicalEvent.resourceType,
          canonicalEvent.resourceId,
          canonicalEvent.outcome,
          canonicalEvent.requestId,
          JSON.stringify(canonicalEvent.metadata),
          canonicalEvent.createdAt,
        ],
      );
      if (result.rows[0]) return;

      const existingResult = await database.query<DatabaseRow>(
        `
          SELECT id, actor_id, action, resource_type, resource_id, outcome,
                 request_id, metadata_json, created_at
          FROM timeline.audit_events
          WHERE id = $1
        `,
        [canonicalEvent.id],
      );
      if (!existingResult.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Audit event was not persisted.", 500);
      if (!sameValue(mapAudit(existingResult.rows[0]), canonicalEvent)) {
        throw new TimelineError("AUDIT_IMMUTABLE_CONFLICT", "Audit event identifier is already in use.", 409);
      }
    });
  }

  async listAudit(resourceId?: string): Promise<AuditEvent[]> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        resourceId
          ? `
              SELECT id, actor_id, action, resource_type, resource_id, outcome,
                     request_id, metadata_json, created_at
              FROM timeline.audit_events
              WHERE resource_id = $1
              ORDER BY created_at ASC, id ASC
            `
          : `
              SELECT id, actor_id, action, resource_type, resource_id, outcome,
                     request_id, metadata_json, created_at
              FROM timeline.audit_events
              ORDER BY created_at ASC, id ASC
            `,
        resourceId ? [resourceId] : [],
      );
      return result.rows.map(mapAudit);
    });
  }

  async addOutbox(event: OutboxEvent): Promise<void> {
    const canonicalEvent: OutboxEvent = {
      ...clone(event),
      availableAt: inputTimestamp(event.availableAt, "availableAt"),
      publishedAt: event.publishedAt ? inputTimestamp(event.publishedAt, "publishedAt") : null,
    };
    if (!Number.isSafeInteger(event.attempts) || event.attempts < 0) {
      throw new TimelineError("OUTBOX_ATTEMPTS_INVALID", "Outbox attempts value is invalid.", 400);
    }
    await this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.outbox_events (
            id, aggregate_id, event_type, payload_json, attempts, available_at, published_at,
            actor_id, document_id
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6::timestamptz, $7::timestamptz, $8, $9)
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `,
        [
          canonicalEvent.id,
          canonicalEvent.aggregateId,
          canonicalEvent.eventType,
          JSON.stringify(canonicalEvent.payload),
          canonicalEvent.attempts,
          canonicalEvent.availableAt,
          canonicalEvent.publishedAt,
          this.options.rlsClaims?.sub ?? null,
          canonicalEvent.aggregateId,
        ],
      );
      if (result.rows[0]) return;

      const existingResult = await database.query<DatabaseRow>(
        `
          SELECT id, aggregate_id, event_type, payload_json, attempts, available_at, published_at
          FROM timeline.outbox_events
          WHERE id = $1
        `,
        [canonicalEvent.id],
      );
      if (!existingResult.rows[0]) throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Outbox event was not persisted.", 500);
      if (!sameValue(mapOutbox(existingResult.rows[0]), canonicalEvent)) {
        throw new TimelineError("OUTBOX_IMMUTABLE_CONFLICT", "Outbox event identifier is already in use.", 409);
      }
    });
  }

  async pendingOutbox(limit = 100): Promise<OutboxEvent[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
      throw new TimelineError("OUTBOX_LIMIT_INVALID", "Outbox query limit is invalid.", 400);
    }
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT id, aggregate_id, event_type, payload_json, attempts, available_at, published_at
          FROM timeline.outbox_events
          WHERE published_at IS NULL
            AND available_at <= now()
          ORDER BY available_at ASC, id ASC
          LIMIT $1::integer
        `,
        [limit],
      );
      return result.rows.map(mapOutbox);
    });
  }

  async markOutboxPublished(id: string, publishedAt: string): Promise<void> {
    const canonicalPublishedAt = inputTimestamp(publishedAt, "publishedAt");
    await this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          UPDATE timeline.outbox_events
          SET published_at = $2::timestamptz
          WHERE id = $1
            AND (published_at IS NULL OR published_at = $2::timestamptz)
          RETURNING id
        `,
        [id, canonicalPublishedAt],
      );
      if (result.rows[0]) return;

      const existing = await database.query<DatabaseRow>(
        `SELECT published_at FROM timeline.outbox_events WHERE id = $1`,
        [id],
      );
      if (!existing.rows[0]) throw new TimelineError("OUTBOX_EVENT_NOT_FOUND", "Outbox event not found.", 404);
      throw new TimelineError("OUTBOX_EVENT_ALREADY_PUBLISHED", "Outbox event was already published.", 409);
    });
  }

  async recordIdempotencyResult(input: RecordIdempotencyResultInput): Promise<IdempotencyKeyRecord> {
    if (!input.principalId || !input.operation || !input.idempotencyKey) {
      throw new TimelineError("IDEMPOTENCY_INPUT_INVALID", "Idempotency input is invalid.", 400);
    }
    const responseSha256 = sha256(stableStringify(input.response));
    const createdAt = inputTimestamp(input.createdAt ?? (this.options.clock ?? (() => new Date()))().toISOString(), "createdAt");
    const expiresAt = inputTimestamp(input.expiresAt, "expiresAt");
    if (expiresAt <= createdAt) {
      throw new TimelineError("IDEMPOTENCY_EXPIRY_INVALID", "Idempotency expiry must be after creation.", 400);
    }

    const intended: IdempotencyKeyRecord = {
      principalId: input.principalId,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
      responseSha256,
      expiresAt,
      createdAt,
    };
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.idempotency_keys (
            principal_id, operation, idempotency_key, response_sha256, expires_at, created_at
          )
          VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz)
          ON CONFLICT (principal_id, operation, idempotency_key) DO NOTHING
          RETURNING principal_id, operation, idempotency_key, response_sha256, expires_at, created_at
        `,
        [
          intended.principalId,
          intended.operation,
          intended.idempotencyKey,
          intended.responseSha256,
          intended.expiresAt,
          intended.createdAt,
        ],
      );
      if (result.rows[0]) return mapIdempotencyKey(result.rows[0]);

      const existingResult = await database.query<DatabaseRow>(
        `
          SELECT principal_id, operation, idempotency_key, response_sha256, expires_at, created_at
          FROM timeline.idempotency_keys
          WHERE principal_id = $1 AND operation = $2 AND idempotency_key = $3
        `,
        [intended.principalId, intended.operation, intended.idempotencyKey],
      );
      if (!existingResult.rows[0]) {
        throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Idempotency result was not persisted.", 500);
      }
      const existing = mapIdempotencyKey(existingResult.rows[0]);
      if (existing.responseSha256 !== intended.responseSha256) {
        throw new TimelineError("IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for another response.", 409);
      }
      return existing;
    });
  }

  async getIdempotencyKey(
    principalId: string,
    operation: string,
    idempotencyKey: string,
  ): Promise<IdempotencyKeyRecord | null> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT principal_id, operation, idempotency_key, response_sha256, expires_at, created_at
          FROM timeline.idempotency_keys
          WHERE principal_id = $1 AND operation = $2 AND idempotency_key = $3
        `,
        [principalId, operation, idempotencyKey],
      );
      return result.rows[0] ? mapIdempotencyKey(result.rows[0]) : null;
    });
  }

  async createDeletionRequest(request: DeletionRequestRecord): Promise<DeletionRequestRecord> {
    const canonicalRequest: DeletionRequestRecord = {
      ...clone(request),
      createdAt: inputTimestamp(request.createdAt, "createdAt"),
      completedAt: request.completedAt ? inputTimestamp(request.completedAt, "completedAt") : null,
    };
    this.assertDeletionState(canonicalRequest.status, canonicalRequest.legalHold, canonicalRequest.completedAt);
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          INSERT INTO timeline.deletion_requests (
            id, principal_id, document_id, status, legal_hold, created_at, completed_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
          ON CONFLICT (id) DO NOTHING
          RETURNING id, principal_id, document_id, status, legal_hold, created_at, completed_at
        `,
        [
          canonicalRequest.id,
          canonicalRequest.principalId,
          canonicalRequest.documentId,
          canonicalRequest.status,
          canonicalRequest.legalHold,
          canonicalRequest.createdAt,
          canonicalRequest.completedAt,
        ],
      );
      if (result.rows[0]) return mapDeletionRequest(result.rows[0]);

      const existingResult = await database.query<DatabaseRow>(
        `
          SELECT id, principal_id, document_id, status, legal_hold, created_at, completed_at
          FROM timeline.deletion_requests
          WHERE id = $1
        `,
        [canonicalRequest.id],
      );
      if (!existingResult.rows[0]) {
        throw new TimelineError("PERSISTENCE_WRITE_FAILED", "Deletion request was not persisted.", 500);
      }
      const existing = mapDeletionRequest(existingResult.rows[0]);
      if (!sameValue(existing, canonicalRequest)) {
        throw new TimelineError("DELETION_REQUEST_IMMUTABLE_CONFLICT", "Deletion request identifier is already in use.", 409);
      }
      return existing;
    });
  }

  async getDeletionRequest(id: string): Promise<DeletionRequestRecord | null> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT id, principal_id, document_id, status, legal_hold, created_at, completed_at
          FROM timeline.deletion_requests
          WHERE id = $1
        `,
        [id],
      );
      return result.rows[0] ? mapDeletionRequest(result.rows[0]) : null;
    });
  }

  async listDeletionRequestsForPrincipal(principalId: string): Promise<DeletionRequestRecord[]> {
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          SELECT id, principal_id, document_id, status, legal_hold, created_at, completed_at
          FROM timeline.deletion_requests
          WHERE principal_id = $1
          ORDER BY created_at DESC, id ASC
        `,
        [principalId],
      );
      return result.rows.map(mapDeletionRequest);
    });
  }

  async updateDeletionRequest(request: DeletionRequestRecord): Promise<DeletionRequestRecord> {
    const canonicalRequest: DeletionRequestRecord = {
      ...clone(request),
      createdAt: inputTimestamp(request.createdAt, "createdAt"),
      completedAt: request.completedAt ? inputTimestamp(request.completedAt, "completedAt") : null,
    };
    this.assertDeletionState(canonicalRequest.status, canonicalRequest.legalHold, canonicalRequest.completedAt);
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          UPDATE timeline.deletion_requests
          SET status = $2,
              legal_hold = $3,
              completed_at = $4::timestamptz
          WHERE id = $1
            AND principal_id = $5
            AND document_id = $6
            AND created_at = $7::timestamptz
          RETURNING id, principal_id, document_id, status, legal_hold, created_at, completed_at
        `,
        [
          canonicalRequest.id,
          canonicalRequest.status,
          canonicalRequest.legalHold,
          canonicalRequest.completedAt,
          canonicalRequest.principalId,
          canonicalRequest.documentId,
          canonicalRequest.createdAt,
        ],
      );
      if (result.rows[0]) return mapDeletionRequest(result.rows[0]);

      const existing = await database.query<DatabaseRow>(
        `SELECT id FROM timeline.deletion_requests WHERE id = $1`,
        [canonicalRequest.id],
      );
      if (!existing.rows[0]) throw new TimelineError("DELETION_REQUEST_NOT_FOUND", "Deletion request not found.", 404);
      throw new TimelineError("DELETION_REQUEST_BINDING_CONFLICT", "Immutable deletion request fields cannot be changed.", 409);
    });
  }

  async markDocumentDeleted(documentId: string, expectedRevision: number, deletedAt: string): Promise<DocumentRecord> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new TimelineError("REVISION_INVALID", "Expected revision is invalid.", 400);
    }
    const canonicalDeletedAt = inputTimestamp(deletedAt, "deletedAt");
    return this.run(async (database) => {
      const result = await database.query<DatabaseRow>(
        `
          UPDATE timeline.documents
          SET status = 'DELETED',
              deleted_at = $3::timestamptz,
              updated_at = $3::timestamptz
          WHERE id = $1
            AND current_revision = $2
            AND deleted_at IS NULL
          RETURNING ${DOCUMENT_COLUMNS}
        `,
        [documentId, expectedRevision, canonicalDeletedAt],
      );
      if (result.rows[0]) return mapDocument(result.rows[0]);

      const currentResult = await database.query<DatabaseRow>(
        `SELECT current_revision, status FROM timeline.documents WHERE id = $1`,
        [documentId],
      );
      const current = currentResult.rows[0];
      if (!current) throw new TimelineError("DOCUMENT_NOT_FOUND", "Document not found.", 404);
      if (current.status === "DELETED") throw new TimelineError("DOCUMENT_NOT_FOUND", "Document not found.", 404);
      throw new TimelineError("REVISION_CONFLICT", "A newer document revision exists.", 409, {
        expectedRevision,
        currentRevision: integerValue(current, "current_revision", "document"),
      });
    });
  }

  private async performSchemaCheck(): Promise<void> {
    const result = await this.pool.query<DatabaseRow>(SCHEMA_CHECK_SQL, [
      [...REQUIRED_TABLES],
      REQUIRED_TABLES.length,
    ]);
    const row = result.rows[0];
    if (
      !row ||
      row.schema_complete !== true ||
      row.schema_version !== (this.options.expectedSchemaVersion ?? POSTGRES_TIMELINE_SCHEMA_VERSION)
    ) {
      throw new TimelineError("PERSISTENCE_SCHEMA_MISMATCH", "Timeline database schema is not compatible.", 503, {
        expectedSchemaVersion: this.options.expectedSchemaVersion ?? POSTGRES_TIMELINE_SCHEMA_VERSION,
        actualSchemaVersion: typeof row?.schema_version === "string" ? row.schema_version : null,
      });
    }
  }

  private async run<T>(operation: (database: PostgresQueryable) => Promise<T>): Promise<T> {
    if (this.client) return operation(this.client);
    return this.withTransaction(async (unitOfWork) => operation(unitOfWork.client!));
  }

  private requireCommentCodec(): CommentBodyCodec {
    if (!this.options.commentBodyCodec) {
      throw new TimelineError("COMMENT_BODY_CODEC_REQUIRED", "Encrypted review comment persistence is not configured.", 503);
    }
    return this.options.commentBodyCodec;
  }

  private assertDeletionState(
    status: DeletionRequestStatus,
    legalHold: boolean,
    completedAt: string | null,
  ): void {
    if (!DELETION_STATUSES.includes(status)) {
      throw new TimelineError("DELETION_STATUS_INVALID", "Deletion request status is invalid.", 400);
    }
    if (legalHold !== (status === "LEGAL_HOLD")) {
      throw new TimelineError("DELETION_STATE_INVALID", "Legal hold and deletion status do not match.", 400);
    }
    if (status === "COMPLETED" && !completedAt) {
      throw new TimelineError("DELETION_STATE_INVALID", "Completed deletion requests require a completion time.", 400);
    }
    if (status !== "COMPLETED" && completedAt) {
      throw new TimelineError("DELETION_STATE_INVALID", "Only completed deletion requests may have a completion time.", 400);
    }
  }
}
