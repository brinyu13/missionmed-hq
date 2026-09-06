import assert from "node:assert/strict";
import test from "node:test";

import type {
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
  TimelineVersion,
  PrincipalContext,
} from "../src/contracts/types.js";
import { canonicalDocumentHash, sha256, stableStringify } from "../src/core/canonical.js";
import {
  PostgresTimelineRepository,
  postgresClaimsFromPrincipal,
  type CommentBodyCodec,
  type DeletionRequestRecord,
  type PostgresPool,
  type PostgresQueryResult,
  type PostgresTransactionClient,
} from "../src/persistence/postgres/index.js";
import { document, FIXED_NOW, student } from "./fixtures.js";

const NOW = FIXED_NOW.toISOString();
const LATER = "2026-07-16T12:00:00.000Z";

interface QueryCall {
  scope: "pool" | "client";
  text: string;
  values: unknown[];
}

type QueryResponder = (normalizedSql: string, values: unknown[], rawSql: string) => PostgresQueryResult;

function normalized(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function queryResult<Row = Record<string, unknown>>(rows: Row[] = []): PostgresQueryResult<Row> {
  return { rows, rowCount: rows.length };
}

class FakeTransactionClient implements PostgresTransactionClient {
  constructor(private readonly owner: FakePool) {}

  async query<Row = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<PostgresQueryResult<Row>> {
    this.owner.calls.push({ scope: "client", text, values: [...values] });
    const sql = normalized(text);
    if (sql === "begin" || sql === "commit" || sql === "rollback") return queryResult<Row>();
    if (sql.startsWith("select set_config(")) return queryResult<Row>([{ set_config: values[0] }] as Row[]);
    return this.owner.respond(sql, values, text) as PostgresQueryResult<Row>;
  }

  release(): void {
    this.owner.releaseCount += 1;
  }
}

class FakePool implements PostgresPool {
  readonly calls: QueryCall[] = [];
  connectCount = 0;
  releaseCount = 0;
  schemaReady = true;

  constructor(readonly responder: QueryResponder) {}

  async query<Row = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<PostgresQueryResult<Row>> {
    this.calls.push({ scope: "pool", text, values: [...values] });
    if (normalized(text).includes("timeline.schema_version()")) {
      return queryResult<Row>([
        {
          schema_complete: this.schemaReady,
          schema_version: this.schemaReady ? "d1-timeline-db-413.2" : "d1-timeline-db-unsupported",
        },
      ] as Row[]);
    }
    return this.respond(normalized(text), values, text) as PostgresQueryResult<Row>;
  }

  async connect(): Promise<PostgresTransactionClient> {
    this.connectCount += 1;
    return new FakeTransactionClient(this);
  }

  respond(sql: string, values: unknown[], rawSql: string): PostgresQueryResult {
    return this.responder(sql, values, rawSql);
  }
}

const codec: CommentBodyCodec = {
  encrypt: (plaintext) => `cipher:${Buffer.from(plaintext).toString("base64")}`,
  decrypt: (ciphertext) => Buffer.from(ciphertext.slice("cipher:".length), "base64").toString("utf8"),
};

function repository(pool: FakePool): PostgresTimelineRepository {
  return new PostgresTimelineRepository(pool, {
    rlsClaims: postgresClaimsFromPrincipal(student),
    commentBodyCodec: codec,
    clock: () => new Date(FIXED_NOW),
  });
}

function record(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    document: document(),
    currentVersionId: null,
    status: "DRAFT",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function documentRow(value: DocumentRecord, deletedAt: string | null = null): Record<string, unknown> {
  return {
    id: value.document.id,
    owner_principal_id: value.document.studentOwnerId,
    program_id: value.document.programId,
    schema_version: value.document.schemaVersion,
    current_revision: value.document.revision,
    current_version_id: value.currentVersionId,
    status: value.status,
    document_json: value.document,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
    deleted_at: deletedAt,
  };
}

function versionFixture(overrides: Partial<TimelineVersion> = {}): TimelineVersion {
  const snapshot = document({
    revision: 1,
    metadata: { updatedAt: NOW },
  });
  return {
    id: "version_postgres_test",
    documentId: snapshot.id,
    revision: 1,
    parentVersionId: null,
    label: "Canonical version",
    snapshot,
    contentSha256: canonicalDocumentHash(snapshot),
    createdBy: student.principalId,
    createdAt: NOW,
    ...overrides,
  };
}

function versionRow(value: TimelineVersion): Record<string, unknown> {
  return {
    id: value.id,
    document_id: value.documentId,
    revision: value.revision,
    parent_version_id: value.parentVersionId,
    label: value.label,
    snapshot_json: value.snapshot,
    content_sha256: value.contentSha256,
    created_by: value.createdBy,
    created_at: value.createdAt,
  };
}

function artifactFixture(): TimelineArtifact {
  const primaryFile = {
    role: "PRIMARY" as const,
    objectId: "object_primary",
    filename: "timeline.json",
    mimeType: "application/json",
    byteSize: 512,
    sha256: "c".repeat(64),
    contentHash: "c".repeat(64),
  };
  return {
    artifactId: "artifact_postgres_test",
    artifactSchemaVersion: "d1-timeline-artifact-409.1",
    artifactType: "TIMELINE_SOURCE_JSON",
    timelineDocumentId: "timeline_test",
    timelineVersionId: "version_postgres_test",
    studentOwnerId: student.principalId,
    programId: "program_internal_medicine",
    createdByRole: "STUDENT",
    createdAt: NOW,
    updatedAt: NOW,
    displayName: "Timeline source",
    description: "Canonical source export",
    documentCategory: "MISSION_TIMELINE",
    mimeType: "application/json",
    byteSize: 512,
    contentHash: "c".repeat(64),
    exportScope: "SOURCE",
    visibility: "STUDENT_ONLY",
    approvalState: {},
    theme: "keynote",
    dimensions: null,
    pageCount: null,
    previewImage: null,
    primaryFile,
    companionFiles: [],
    sourceDocumentReferences: [],
    timelineEventCount: 1,
    generatedQuestionCount: 0,
    advisorCommentCount: 0,
    files: [primaryFile],
    warnings: [],
    provenanceSummary: {},
    retentionClass: "STUDENT_CONTROLLED",
    fileVaultLinkageState: "UNLINKED",
    legacyVaultReference: null,
    v2VaultReference: null,
    synchronizationStatus: "NOT_SYNCED",
    synchronizationHistory: [],
    idempotencyKey: "artifact-idempotency-key",
  };
}

test("schema check, RLS claims, and document writes use a committed parameterized transaction", async () => {
  let stored: Record<string, unknown> | undefined;
  const pool = new FakePool((sql, values) => {
    if (sql.startsWith("insert into timeline.documents")) {
      stored = {
        id: values[0],
        owner_principal_id: values[1],
        program_id: values[2],
        schema_version: values[3],
        current_revision: values[4],
        current_version_id: values[5],
        status: values[6],
        document_json: JSON.parse(String(values[7])),
        created_at: values[8],
        updated_at: values[9],
        deleted_at: null,
      };
      return queryResult([stored]);
    }
    if (sql.includes("from timeline.documents where id = $1")) return queryResult(stored ? [stored] : []);
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const postgres = repository(pool);
  const input = record();

  assert.deepEqual(await postgres.createDocument(input), input);
  assert.deepEqual(await postgres.getDocument(input.document.id), input);

  assert.equal(pool.calls.filter((call) => call.scope === "pool").length, 1, "schema compatibility should be cached");
  assert.equal(pool.connectCount, 2);
  assert.equal(pool.releaseCount, 2);
  assert.equal(pool.calls.filter((call) => normalized(call.text) === "begin").length, 2);
  assert.equal(pool.calls.filter((call) => normalized(call.text) === "commit").length, 2);
  const claimsCall = pool.calls.find((call) => normalized(call.text).startsWith("select set_config("));
  assert.deepEqual(JSON.parse(String(claimsCall?.values[0])), {
    sub: student.principalId,
    timeline_role: "STUDENT",
    program_ids: ["program_internal_medicine"],
    service_scopes: [],
  });
  const insert = pool.calls.find((call) => normalized(call.text).startsWith("insert into timeline.documents"));
  assert.ok(insert);
  assert.doesNotMatch(insert.text, /Mission Timeline/);
  assert.match(String(insert.values[7]), /Mission Timeline/);
});

test("audited break-glass claims require a matching independent grant authority", () => {
  const platformContext: PrincipalContext = {
    principalId: "platform_subject",
    role: "PLATFORM_ADMIN",
    programIds: [],
    assignedDocumentIds: [],
    facultyGrants: [],
    serviceScopes: [],
    breakGlass: {
      reason: "incident-response",
      expiresAt: "2026-07-15T12:30:00.000Z",
    },
    sessionId: "session_platform_subject",
    requestId: "request_platform_subject",
  };
  const grant = {
    auditId: "break_glass_grant_413",
    grantedByPrincipalId: "platform_grantor",
    grantedToPrincipalId: platformContext.principalId,
    reason: platformContext.breakGlass!.reason,
    expiresAt: platformContext.breakGlass!.expiresAt,
  };

  assert.deepEqual(postgresClaimsFromPrincipal(platformContext, grant), {
    sub: "platform_subject",
    timeline_role: "PLATFORM_ADMIN",
    program_ids: [],
    service_scopes: [],
    break_glass_audit_id: "break_glass_grant_413",
    break_glass_granted_by: "platform_grantor",
    break_glass_reason: "incident-response",
    break_glass_expires_at: "2026-07-15T12:30:00.000Z",
  });
  assert.deepEqual(postgresClaimsFromPrincipal(platformContext), {
    sub: "platform_subject",
    timeline_role: "PLATFORM_ADMIN",
    program_ids: [],
    service_scopes: [],
  });
  assert.throws(
    () => postgresClaimsFromPrincipal(platformContext, {
      ...grant,
      grantedByPrincipalId: platformContext.principalId,
    }),
    /independent audited grant/,
  );
});

test("schema mismatch fails before a connection is acquired", async () => {
  const pool = new FakePool(() => queryResult());
  pool.schemaReady = false;
  const postgres = repository(pool);

  await assert.rejects(postgres.initialize(), (error: { code?: string; details?: Record<string, unknown> }) => {
    assert.equal(error.code, "PERSISTENCE_SCHEMA_MISMATCH");
    assert.equal(error.details?.expectedSchemaVersion, "d1-timeline-db-413.2");
    return true;
  });
  assert.equal(pool.connectCount, 0);
});

test("a repository without claims clears pooled RLS state", async () => {
  const pool = new FakePool((sql) => {
    if (sql.includes("from timeline.documents where id = $1")) return queryResult();
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  assert.equal(await new PostgresTimelineRepository(pool).getDocument("timeline_missing"), null);

  const claimsCall = pool.calls.find((call) => normalized(call.text).startsWith("select set_config("));
  assert.equal(claimsCall?.values[0], "{}");
});

test("version save recomputes the canonical hash and advances with an optimistic compare", async () => {
  const intended = versionFixture({ contentSha256: "0".repeat(64) });
  const expectedHash = canonicalDocumentHash(intended.snapshot);
  let insertedHash: unknown;
  const pool = new FakePool((sql, values) => {
    if (sql.includes("from timeline.documents") && sql.endsWith("for update")) {
      return queryResult([
        {
          current_revision: 0,
          current_version_id: null,
          owner_principal_id: student.principalId,
          program_id: "program_internal_medicine",
          schema_version: "d1-timeline-document-409.1",
          status: "DRAFT",
        },
      ]);
    }
    if (sql.includes("from timeline.versions") && sql.includes("where id = $1")) return queryResult();
    if (sql.startsWith("insert into timeline.versions")) {
      insertedHash = values[6];
      return queryResult([
        {
          id: values[0],
          document_id: values[1],
          revision: values[2],
          parent_version_id: values[3],
          label: values[4],
          snapshot_json: JSON.parse(String(values[5])),
          content_sha256: values[6],
          created_by: values[7],
          created_at: values[8],
        },
      ]);
    }
    if (sql.startsWith("update timeline.documents")) return queryResult([{ id: values[0] }]);
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const postgres = repository(pool);
  const next = record({
    document: intended.snapshot,
    currentVersionId: intended.id,
    updatedAt: NOW,
  });

  const saved = await postgres.saveVersion("timeline_test", 0, next, intended);

  assert.equal(saved.contentSha256, expectedHash);
  assert.equal(insertedHash, expectedHash);
  const compare = pool.calls.find((call) => {
    const sql = normalized(call.text);
    return sql.startsWith("update timeline.documents") && sql.includes("current_revision = $7");
  });
  assert.equal(compare?.values[6], 0);
  assert.equal(pool.calls.some((call) => normalized(call.text).startsWith("update timeline.versions")), false);
});

test("stale revision rolls back before an immutable version is inserted", async () => {
  const intended = versionFixture({ revision: 2, snapshot: document({ revision: 2 }) });
  intended.contentSha256 = canonicalDocumentHash(intended.snapshot);
  const pool = new FakePool((sql) => {
    if (sql.includes("from timeline.documents") && sql.endsWith("for update")) {
      return queryResult([
        {
          current_revision: 2,
          current_version_id: "version_winner",
          owner_principal_id: student.principalId,
          program_id: "program_internal_medicine",
          schema_version: "d1-timeline-document-409.1",
          status: "DRAFT",
        },
      ]);
    }
    if (sql.includes("from timeline.versions")) return queryResult();
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const postgres = repository(pool);
  const next = record({ document: intended.snapshot, currentVersionId: intended.id });

  await assert.rejects(postgres.saveVersion("timeline_test", 1, next, intended), (error: { code?: string; details?: Record<string, unknown> }) => {
    assert.equal(error.code, "REVISION_CONFLICT");
    assert.equal(error.details?.currentRevision, 2);
    return true;
  });
  assert.equal(pool.calls.some((call) => normalized(call.text).startsWith("insert into timeline.versions")), false);
  assert.equal(pool.calls.some((call) => normalized(call.text) === "rollback"), true);
  assert.equal(pool.calls.some((call) => normalized(call.text) === "commit"), false);
});

test("checkpoint upsert validates the database revision inside its transaction", async () => {
  const checkpoint: CheckpointRecord = {
    id: "timeline_test:device_macpro",
    documentId: "timeline_test",
    deviceId: "device_macpro",
    baseRevision: 0,
    snapshot: document(),
    createdAt: NOW,
    expiresAt: "2026-08-14T12:00:00.000Z",
  };
  const pool = new FakePool((sql, values) => {
    if (sql.includes("from timeline.documents") && sql.endsWith("for share")) {
      return queryResult([
        {
          current_revision: 0,
          owner_principal_id: student.principalId,
          program_id: "program_internal_medicine",
          schema_version: "d1-timeline-document-409.1",
          status: "DRAFT",
        },
      ]);
    }
    if (sql.startsWith("insert into timeline.checkpoints")) {
      assert.match(sql, /on conflict \(document_id, device_id\) do update/);
      return queryResult([
        {
          id: values[0],
          document_id: values[1],
          device_id: values[2],
          base_revision: values[3],
          snapshot_json: JSON.parse(String(values[4])),
          created_at: values[5],
          expires_at: values[6],
        },
      ]);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  assert.deepEqual(await repository(pool).saveCheckpoint(checkpoint), checkpoint);
});

test("expired checkpoints fail before acquiring a database connection", async () => {
  const pool = new FakePool(() => queryResult());
  await assert.rejects(
    repository(pool).saveCheckpoint({
      id: "timeline_test:expired_device",
      documentId: "timeline_test",
      deviceId: "expired_device",
      baseRevision: 0,
      snapshot: document(),
      createdAt: NOW,
      expiresAt: NOW,
    }),
    (error: { code?: string }) => error.code === "CHECKPOINT_EXPIRY_INVALID",
  );
  assert.equal(pool.connectCount, 0);
});

test("review, encrypted comments, and approvals share one explicit unit of work", async () => {
  const version = versionFixture();
  let reviewRow: Record<string, unknown> | undefined;
  const pool = new FakePool((sql, values) => {
    if (sql.includes("from timeline.versions") && sql.includes("where id = $1")) return queryResult([versionRow(version)]);
    if (sql.startsWith("insert into timeline.review_requests")) {
      reviewRow = {
        id: values[0],
        document_id: values[1],
        version_id: values[2],
        version_sha256: values[3],
        requested_by: values[4],
        assigned_to: values[5],
        status: values[6],
        created_at: values[7],
        updated_at: values[8],
      };
      return queryResult([reviewRow]);
    }
    if (sql.startsWith("insert into timeline.comments")) {
      assert.notEqual(values[4], "Clarify this transition.");
      return queryResult([
        {
          id: values[0],
          review_request_id: values[1],
          author_id: values[2],
          author_role: values[3],
          body_ciphertext: values[4],
          visibility: values[5],
          anchor_json: JSON.parse(String(values[6])),
          status: values[7],
          created_at: values[8],
        },
      ]);
    }
    if (sql.startsWith("select r.document_id")) {
      return queryResult([{ document_id: version.documentId, version_id: version.id, content_sha256: version.contentSha256 }]);
    }
    if (sql.startsWith("insert into timeline.approval_events")) {
      return queryResult([
        {
          id: values[0],
          review_request_id: values[1],
          document_id: values[2],
          version_id: values[3],
          content_sha256: values[4],
          decision: values[5],
          actor_id: values[6],
          reason: values[7],
          created_at: values[8],
        },
      ]);
    }
    if (sql.startsWith("update timeline.review_requests")) {
      return queryResult([
        {
          id: values[0],
          document_id: values[3],
          version_id: values[4],
          version_sha256: values[5],
          requested_by: values[6],
          assigned_to: values[7],
          status: values[1],
          created_at: values[8],
          updated_at: values[2],
        },
      ]);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const postgres = repository(pool);

  const result = await postgres.withTransaction(async (unit) => {
    const reviewInput: ReviewRequest = {
      id: "review_postgres_test",
      documentId: version.documentId,
      versionId: version.id,
      versionHash: "0".repeat(64),
      requestedBy: student.principalId,
      assignedTo: "principal_advisor",
      status: "REQUESTED",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const review = await unit.createReview(reviewInput);
    const commentInput: ReviewComment = {
      id: "comment_postgres_test",
      reviewRequestId: review.id,
      authorId: "principal_advisor",
      authorRole: "ADVISOR",
      body: "Clarify this transition.",
      visibility: "SHARED",
      anchor: { eventId: "event_work" },
      status: "OPEN",
      createdAt: NOW,
    };
    const comment = await unit.addComment(commentInput);
    const approvalInput: ApprovalEvent = {
      id: "approval_postgres_test",
      reviewRequestId: review.id,
      documentId: version.documentId,
      versionId: version.id,
      contentSha256: "f".repeat(64),
      decision: "APPROVED",
      actorId: "principal_advisor",
      reason: "Ready.",
      createdAt: NOW,
    };
    const approval = await unit.addApproval(approvalInput);
    const updated = await unit.updateReview({ ...review, status: "APPROVED", updatedAt: LATER });
    return { review, comment, approval, updated };
  });

  assert.equal(result.review.versionHash, version.contentSha256);
  assert.equal(result.comment.body, "Clarify this transition.");
  assert.equal(result.approval.contentSha256, version.contentSha256);
  assert.equal(result.updated.status, "APPROVED");
  assert.equal(pool.connectCount, 1);
  assert.equal(pool.calls.filter((call) => normalized(call.text) === "begin").length, 1);
  assert.equal(pool.calls.filter((call) => normalized(call.text) === "commit").length, 1);
});

test("export, artifact, FileVault, and response idempotency records round-trip without storing response content", async () => {
  const artifact = artifactFixture();
  const responseSecret = "never-store-this-response-content";
  const pool = new FakePool((sql, values) => {
    if (sql.startsWith("insert into timeline.export_jobs")) {
      return queryResult([
        {
          id: values[0],
          document_id: values[1],
          version_id: values[2],
          artifact_type: values[3],
          export_scope: values[4],
          renderer: values[5],
          status: values[6],
          requested_by: values[7],
          idempotency_key: values[8],
          artifact_id: values[9],
          error_code: values[10],
          created_at: values[11],
          updated_at: values[12],
        },
      ]);
    }
    if (sql.startsWith("insert into timeline.artifacts")) {
      return queryResult([
        {
          id: values[0],
          document_id: values[1],
          version_id: values[2],
          artifact_type: values[3],
          export_scope: values[4],
          manifest_json: JSON.parse(String(values[5])),
          content_sha256: values[6],
          status: "READY",
          created_at: values[7],
        },
      ]);
    }
    if (sql.startsWith("insert into timeline.filevault_links")) {
      return queryResult([
        {
          id: values[0],
          artifact_id: values[1],
          adapter: values[2],
          external_file_id: values[3],
          external_version_id: values[4],
          status: values[5],
          artifact_sha256: values[6],
          last_error_code: values[7],
          created_at: values[8],
          updated_at: values[9],
        },
      ]);
    }
    if (sql.startsWith("insert into timeline.idempotency_keys")) {
      return queryResult([
        {
          principal_id: values[0],
          operation: values[1],
          idempotency_key: values[2],
          response_sha256: values[3],
          expires_at: values[4],
          created_at: values[5],
        },
      ]);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const postgres = repository(pool);
  const job: ExportJob = {
    id: "export_postgres_test",
    documentId: artifact.timelineDocumentId,
    versionId: artifact.timelineVersionId,
    artifactType: artifact.artifactType,
    scope: artifact.exportScope,
    requestedBy: student.principalId,
    renderer: "FIXTURE",
    status: "QUEUED",
    idempotencyKey: "export-idempotency-key",
    createdAt: NOW,
    updatedAt: NOW,
  };
  const link: FileVaultLink = {
    id: "filevault_postgres_test",
    artifactId: artifact.artifactId,
    adapter: "V2",
    externalFileId: "external_file",
    externalVersionId: "external_version",
    status: "SUPERSEDED",
    artifactHash: artifact.contentHash,
    createdAt: NOW,
    updatedAt: LATER,
  };

  const result = await postgres.withTransaction(async (unit) => ({
    job: await unit.createExportJob(job),
    artifact: await unit.addArtifact(artifact),
    link: await unit.saveFileVaultLink(link),
    failedLink: await unit.saveFileVaultLink({
      ...link,
      id: "filevault_failed_postgres_test",
      adapter: "LEGACY",
      externalFileId: "",
      externalVersionId: "",
      status: "FAILED",
      errorCode: "FILEVAULT_UNAVAILABLE",
    }),
    idempotency: await unit.recordIdempotencyResult({
      principalId: student.principalId,
      operation: "artifact:create",
      idempotencyKey: "response-idempotency-key",
      response: { status: "accepted", privateValue: responseSecret },
      createdAt: NOW,
      expiresAt: LATER,
    }),
  }));

  assert.deepEqual(result.job, job);
  assert.deepEqual(result.artifact, artifact);
  assert.equal(result.link.status, "SUPERSEDED");
  assert.equal(result.failedLink.status, "FAILED");
  assert.equal(result.failedLink.externalFileId, "");
  assert.equal(
    result.idempotency.responseSha256,
    sha256(stableStringify({ status: "accepted", privateValue: responseSecret })),
  );
  const persistedValues = pool.calls.flatMap((call) => call.values).map(String);
  assert.equal(persistedValues.includes(responseSecret), false);
});

test("outbox, audit, deletion workflow, and soft deletion persist in one unit of work", async () => {
  let outboxRow: Record<string, unknown>;
  let auditRow: Record<string, unknown>;
  let deletionRow: Record<string, unknown>;
  const deletedRecord = record({ status: "DELETED", updatedAt: LATER });
  const pool = new FakePool((sql, values) => {
    if (sql.startsWith("insert into timeline.outbox_events")) {
      assert.equal(values[7], student.principalId);
      assert.equal(values[8], "timeline_test");
      outboxRow = {
        id: values[0],
        aggregate_id: values[1],
        event_type: values[2],
        payload_json: JSON.parse(String(values[3])),
        attempts: values[4],
        available_at: values[5],
        published_at: values[6],
      };
      return queryResult([{ id: values[0] }]);
    }
    if (sql.includes("from timeline.outbox_events") && sql.includes("limit $1::integer")) return queryResult([outboxRow]);
    if (sql.startsWith("update timeline.outbox_events")) {
      outboxRow.published_at = values[1];
      return queryResult([{ id: values[0] }]);
    }
    if (sql.startsWith("insert into timeline.audit_events")) {
      auditRow = {
        id: values[0],
        actor_id: values[1],
        action: values[2],
        resource_type: values[3],
        resource_id: values[4],
        outcome: values[5],
        request_id: values[6],
        metadata_json: JSON.parse(String(values[7])),
        created_at: values[8],
      };
      return queryResult([{ id: values[0] }]);
    }
    if (sql.includes("from timeline.audit_events") && sql.includes("order by created_at")) return queryResult([auditRow]);
    if (sql.startsWith("insert into timeline.deletion_requests")) {
      deletionRow = {
        id: values[0],
        principal_id: values[1],
        document_id: values[2],
        status: values[3],
        legal_hold: values[4],
        created_at: values[5],
        completed_at: values[6],
      };
      return queryResult([deletionRow]);
    }
    if (sql.startsWith("update timeline.deletion_requests")) {
      deletionRow = { ...deletionRow, status: values[1], legal_hold: values[2], completed_at: values[3] };
      return queryResult([deletionRow]);
    }
    if (sql.includes("from timeline.deletion_requests") && sql.includes("order by created_at")) return queryResult([deletionRow]);
    if (sql.startsWith("update timeline.documents") && sql.includes("set status = 'deleted'")) {
      return queryResult([documentRow(deletedRecord, LATER)]);
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const postgres = repository(pool);
  const outbox: OutboxEvent = {
    id: "outbox_postgres_test",
    aggregateId: "timeline_test",
    eventType: "timeline.document.deleted",
    payload: { documentId: "timeline_test" },
    attempts: 0,
    availableAt: NOW,
    publishedAt: null,
  };
  const audit: AuditEvent = {
    id: "audit_postgres_test",
    actorId: student.principalId,
    action: "document:delete",
    resourceType: "document",
    resourceId: "timeline_test",
    outcome: "SUCCESS",
    requestId: "request_delete",
    metadata: { reasonCode: "OWNER_REQUEST" },
    createdAt: NOW,
  };
  const deletion: DeletionRequestRecord = {
    id: "deletion_postgres_test",
    principalId: student.principalId,
    documentId: "timeline_test",
    status: "REQUESTED",
    legalHold: false,
    createdAt: NOW,
    completedAt: null,
  };

  const result = await postgres.withTransaction(async (unit) => {
    await unit.addOutbox(outbox);
    const pending = await unit.pendingOutbox(5);
    await unit.markOutboxPublished(outbox.id, LATER);
    await unit.addAudit(audit);
    const auditEvents = await unit.listAudit("timeline_test");
    await unit.createDeletionRequest(deletion);
    const completed = await unit.updateDeletionRequest({ ...deletion, status: "COMPLETED", completedAt: LATER });
    const requests = await unit.listDeletionRequestsForPrincipal(student.principalId);
    const deleted = await unit.markDocumentDeleted("timeline_test", 0, LATER);
    return { pending, auditEvents, completed, requests, deleted };
  });

  assert.deepEqual(result.pending, [outbox]);
  assert.deepEqual(result.auditEvents, [audit]);
  assert.equal(result.completed.status, "COMPLETED");
  assert.equal(result.requests[0]?.completedAt, LATER);
  assert.equal(result.deleted.status, "DELETED");
  assert.equal(pool.calls.filter((call) => normalized(call.text) === "commit").length, 1);
});

test("database failures rollback and expose only stable content-free errors", async () => {
  const privateMessage = "connection failed while writing private timeline content";
  const pool = new FakePool((sql) => {
    if (sql.startsWith("insert into timeline.documents")) {
      throw Object.assign(new Error(privateMessage), { code: "08006" });
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await assert.rejects(repository(pool).createDocument(record()), (error: { code?: string; message?: string; details?: unknown }) => {
    assert.equal(error.code, "PERSISTENCE_UNAVAILABLE");
    assert.equal(error.message, "Timeline persistence is unavailable.");
    assert.doesNotMatch(JSON.stringify(error.details), /private timeline content/);
    return true;
  });
  assert.equal(pool.calls.some((call) => normalized(call.text) === "rollback"), true);
  assert.equal(pool.calls.some((call) => normalized(call.text) === "commit"), false);
  assert.equal(pool.releaseCount, 1);
});
