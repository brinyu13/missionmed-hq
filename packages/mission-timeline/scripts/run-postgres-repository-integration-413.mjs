import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import pg from "pg";

import { canonicalDocumentHash, sha256, stableStringify } from "../src/core/canonical.ts";
import { TimelineError } from "../src/core/errors.ts";
import { TimelineService } from "../src/domain/timeline-service.ts";
import { PostgresTimelineRepository } from "../src/persistence/postgres/index.ts";

const host = process.env.D1_413_PGHOST || "127.0.0.1";
const port = Number(process.env.D1_413_PGPORT || "55413");
const database = process.env.D1_413_PGDATABASE || "d1_413_primary";
const adminUser = process.env.D1_413_PGUSER || process.env.USER || "brianb";
const runtimeUser = "timeline_runtime_413";
const output = process.env.D1_413_POSTGRES_REPOSITORY_OUTPUT
  || "/Users/brianb/MissionMed_AI_Sandbox/D1_TIMELINE_ENGINE/evidence/413/postgres_repository_integration_413.json";

if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !database.startsWith('d1_413_')) {
  throw new Error("Refusing non-local or non-disposable PostgreSQL target");
}

const admin = new pg.Pool({ host, port, database, user: adminUser, max: 1 });
const runtime = new pg.Pool({ host, port, database, user: runtimeUser, max: 3 });
const suffix = `${Date.now()}`;
const documentId = `document_repo_${suffix}`;
const workflowDocumentId = `document_workflow_${suffix}`;
const rollbackDocumentId = `document_rollback_${suffix}`;
const studentRequestId = `request_student_workflow_${suffix}`;
const advisorRequestId = `request_advisor_workflow_${suffix}`;
const checks = [];
const cleanupFailures = [];
let advisorCommentId = "";
let advisorReviewId = "";

function check(name, passed, detail = "") {
  checks.push({ name, status: passed ? "PASS" : "FAIL", detail });
  if (!passed) throw new Error(`${name}: ${detail}`);
}

function cleanupCheck(name, passed, detail = "") {
  checks.push({ name, status: passed ? "PASS" : "FAIL", detail });
  if (!passed) cleanupFailures.push(`${name}: ${detail}`);
}

const createdAt = new Date().toISOString();
const original = {
  id: documentId,
  schemaVersion: "d1-timeline-document-409.1",
  studentOwnerId: "student_a",
  programId: "program_a",
  title: "Synthetic repository integration timeline",
  theme: "keynote",
  revision: 0,
  events: [{
    id: `event_repo_${suffix}`,
    title: "Synthetic verified experience",
    categoryId: "work",
    eventType: "bar",
    startDate: "2024-01",
    endDate: "2024-02",
    visibilityState: "INTERVIEWER_SAFE",
  }],
  mediaItems: [],
  sourceDocuments: [],
  metadata: { syntheticFixture: true },
};
const record = {
  document: original,
  currentVersionId: null,
  status: "DRAFT",
  createdAt,
  updatedAt: createdAt,
};
const studentClaims = {
  sub: "student_a",
  timeline_role: "STUDENT",
  program_ids: ["program_a"],
  service_scopes: [],
};
const advisorClaims = {
  sub: "advisor_assigned",
  timeline_role: "ADVISOR",
  program_ids: ["program_a"],
  service_scopes: [],
};
const codec = {
  encrypt: (value) => `cipher:${Buffer.from(value).toString("base64")}`,
  decrypt: (value) => Buffer.from(value.slice("cipher:".length), "base64").toString("utf8"),
};
const repository = new PostgresTimelineRepository(runtime, { rlsClaims: studentClaims, commentBodyCodec: codec });
const advisorRepository = new PostgresTimelineRepository(runtime, { rlsClaims: advisorClaims, commentBodyCodec: codec });
const programAdminRepository = new PostgresTimelineRepository(runtime, {
  rlsClaims: {
    sub: "program_admin_a",
    timeline_role: "PROGRAM_ADMIN",
    program_ids: ["program_a"],
    service_scopes: [],
  },
});
let mainFailure;

try {
  const role = await admin.query(
    "select rolsuper, rolbypassrls, rolinherit, rolcanlogin from pg_roles where rolname=$1",
    [runtimeUser],
  );
  check(
    "runtime role safety",
    role.rows.length === 1
      && role.rows[0].rolsuper === false
      && role.rows[0].rolbypassrls === false
      && role.rows[0].rolinherit === false,
    "runtime role is non-owner, non-superuser, and cannot bypass RLS",
  );
  await admin.query(`ALTER ROLE ${runtimeUser} LOGIN`);
  await repository.initialize();
  check("schema initialization", true, "runtime adapter accepted corrected schema d1-timeline-db-413.2");

  const created = await repository.createDocument(record);
  check("restricted-role create", created.document.id === documentId, "document created through RLS runtime role");
  check("restricted-role read", (await repository.getDocument(documentId))?.document.studentOwnerId === "student_a", "owner can read the created document");

  const checkpoint = await repository.saveCheckpoint({
    id: `${documentId}:device-413`,
    documentId,
    deviceId: "device-413",
    baseRevision: 0,
    snapshot: structuredClone(original),
    createdAt,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  check("checkpoint transaction", checkpoint.baseRevision === 0, "checkpoint persisted under RLS");

  const snapshot = structuredClone(original);
  snapshot.revision = 1;
  snapshot.metadata = { ...snapshot.metadata, applicationVersion: "D1-413", updatedAt: createdAt };
  const contentSha256 = canonicalDocumentHash(snapshot);
  const versionId = `version_${sha256(stableStringify([documentId, 1, contentSha256])).slice(0, 32)}`;
  const version = {
    id: versionId,
    documentId,
    revision: 1,
    parentVersionId: null,
    label: "Synthetic integration v1",
    snapshot,
    contentSha256,
    createdBy: "student_a",
    createdAt,
  };
  const nextRecord = { ...record, document: snapshot, currentVersionId: versionId, updatedAt: createdAt };
  const savedVersion = await repository.saveVersion(documentId, 0, nextRecord, version);
  check("version transaction", savedVersion.contentSha256 === contentSha256, "server canonical hash matched");
  check("immutable version read", (await repository.listVersions(documentId)).length === 1, "version round-trip passed");

  let staleCode = "";
  try {
    const staleSnapshot = structuredClone(snapshot);
    staleSnapshot.title = "Synthetic stale write";
    const staleHash = canonicalDocumentHash(staleSnapshot);
    const staleVersionId = `version_${sha256(stableStringify([documentId, 1, staleHash])).slice(0, 32)}`;
    await repository.saveVersion(documentId, 0, {
      ...nextRecord,
      document: staleSnapshot,
      currentVersionId: staleVersionId,
    }, {
      ...version,
      id: staleVersionId,
      snapshot: staleSnapshot,
      contentSha256: staleHash,
      parentVersionId: versionId,
    });
  } catch (error) {
    staleCode = error instanceof TimelineError ? error.code : String(error);
  }
  check("optimistic conflict", staleCode === "REVISION_CONFLICT", staleCode);
  check("rollback preserved version", (await repository.listVersions(documentId)).length === 1, "failed transaction added no version");

  const studentContext = {
    principalId: "student_a",
    role: "STUDENT",
    programIds: ["program_a"],
    assignedDocumentIds: [],
    facultyGrants: [],
    serviceScopes: [],
    sessionId: `session_${suffix}`,
    requestId: studentRequestId,
  };
  const workflowCreated = await repository.withTransaction(async (unit) => {
    const service = new TimelineService(unit, () => new Date(createdAt));
    return service.createDocument(studentContext, {
      id: workflowDocumentId,
      programId: "program_a",
      title: "Synthetic atomic workflow",
      document: { ...structuredClone(original), id: workflowDocumentId, events: [] },
    });
  });
  check("student positive workflow", workflowCreated.document.id === workflowDocumentId, "primary, outbox, and audit writes committed together");
  const studentAudit = await repository.listAudit(workflowDocumentId);
  check("student workflow audit visible", studentAudit.some((event) => event.requestId === studentRequestId && event.outcome === "SUCCESS"), "actor-scoped audit row returned");
  const studentOutbox = await repository.pendingOutbox(100);
  check("student workflow outbox visible", studentOutbox.some((event) => event.aggregateId === workflowDocumentId && event.eventType === "timeline.document.created"), "actor-scoped outbox row returned");

  await programAdminRepository.addAssignment({
    documentId,
    advisorPrincipalId: "advisor_assigned",
    programId: "program_a",
    startsAt: new Date(Date.parse(createdAt) - 1_000).toISOString(),
    endsAt: null,
  });
  const advisorReview = await repository.withTransaction(async (unit) => {
    const service = new TimelineService(unit, () => new Date(createdAt));
    return service.requestReview(studentContext, documentId, versionId);
  });
  advisorReviewId = advisorReview.id;

  const advisorContext = {
    principalId: "advisor_assigned",
    role: "ADVISOR",
    programIds: ["program_a"],
    assignedDocumentIds: [documentId],
    facultyGrants: [],
    serviceScopes: [],
    sessionId: `session_advisor_${suffix}`,
    requestId: advisorRequestId,
  };
  const advisorComment = await advisorRepository.withTransaction(async (unit) => {
    const service = new TimelineService(unit, () => new Date(createdAt));
    return service.addComment(advisorContext, advisorReviewId, "Synthetic advisor integration comment.", "SHARED");
  });
  advisorCommentId = advisorComment.id;
  check("advisor positive workflow", advisorComment.authorId === "advisor_assigned", "comment, outbox, and audit writes committed together");
  check("advisor workflow audit visible", (await advisorRepository.listAudit()).some((event) => event.requestId === advisorRequestId), "advisor can read its own audit event");
  check("advisor workflow outbox visible", (await advisorRepository.pendingOutbox(100)).some((event) => event.payload.commentId === advisorCommentId), "advisor can read its own outbox event");

  let partialWriteCode = "";
  try {
    const rollbackRecord = {
      ...record,
      document: { ...structuredClone(original), id: rollbackDocumentId, title: "Synthetic rollback probe" },
    };
    await repository.withTransaction(async (unit) => {
      await unit.createDocument(rollbackRecord);
      await unit.addOutbox({
        id: `outbox_forbidden_${suffix}`,
        aggregateId: rollbackDocumentId,
        eventType: "timeline.security.override",
        payload: { documentId: rollbackDocumentId },
        attempts: 0,
        availableAt: createdAt,
        publishedAt: null,
      });
    });
  } catch (error) {
    partialWriteCode = error instanceof TimelineError ? error.code : String(error);
  }
  check("partial-write denial surfaced", partialWriteCode === "PERSISTENCE_ACCESS_DENIED", partialWriteCode);
  check("partial-write rollback removed primary row", await repository.getDocument(rollbackDocumentId) === null, "denied outbox insert rolled back document insert");

  const other = new PostgresTimelineRepository(runtime, {
    rlsClaims: { sub: "student_b", timeline_role: "STUDENT", program_ids: ["program_b"], service_scopes: [] },
  });
  check("cross-student denial", await other.getDocument(workflowDocumentId) === null, "unrelated student received no row");
} catch (error) {
  mainFailure = error;
  checks.push({ name: "integration execution", status: "FAIL", detail: error instanceof Error ? error.message : String(error) });
} finally {
  try {
    await runtime.end();
  } catch (error) {
    cleanupFailures.push(`runtime pool close: ${error instanceof Error ? error.message : String(error)}`);
  }

  const cleanupSteps = [
    ["advisor outbox", "delete from timeline.outbox_events where payload_json->>'commentId'=$1", [advisorCommentId || "missing"]],
    ["workflow outbox", "delete from timeline.outbox_events where document_id = any($1::text[])", [[documentId, workflowDocumentId, rollbackDocumentId]]],
    ["advisor comment", "delete from timeline.comments where id=$1", [advisorCommentId || "missing"]],
    ["integration audit", "delete from timeline.audit_events where request_id = any($1::text[])", [[studentRequestId, advisorRequestId]]],
    ["integration review", "delete from timeline.review_requests where id=$1", [advisorReviewId || "missing"]],
    ["advisor assignment", "delete from timeline.advisor_assignments where document_id=$1 and advisor_principal_id='advisor_assigned'", [documentId]],
    ["checkpoints", "delete from timeline.checkpoints where document_id = any($1::text[])", [[documentId, workflowDocumentId, rollbackDocumentId]]],
    ["document version pointers", "update timeline.documents set current_version_id=null where id = any($1::text[])", [[documentId, workflowDocumentId, rollbackDocumentId]]],
    ["versions", "delete from timeline.versions where document_id = any($1::text[])", [[documentId, workflowDocumentId, rollbackDocumentId]]],
    ["documents", "delete from timeline.documents where id = any($1::text[])", [[documentId, workflowDocumentId, rollbackDocumentId]]],
  ];
  for (const [label, sql, values] of cleanupSteps) {
    try {
      await admin.query(sql, values);
    } catch (error) {
      cleanupFailures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  try {
    await admin.query(`ALTER ROLE ${runtimeUser} NOLOGIN`);
  } catch (error) {
    cleanupFailures.push(`restore NOLOGIN: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const remaining = await admin.query(`
      select
        (select count(*) from timeline.documents where id = any($1::text[]))
        + (select count(*) from timeline.versions where document_id = any($1::text[]))
        + (select count(*) from timeline.checkpoints where document_id = any($1::text[]))
        + (select count(*) from timeline.outbox_events where document_id = any($1::text[]))
        + (select count(*) from timeline.audit_events where request_id = any($2::text[]))
        + (select count(*) from timeline.comments where id=$3)
        + (select count(*) from timeline.review_requests where id=$4)
        + (select count(*) from timeline.advisor_assignments where document_id=$5 and advisor_principal_id='advisor_assigned') as test_rows
    `, [[documentId, workflowDocumentId, rollbackDocumentId], [studentRequestId, advisorRequestId], advisorCommentId || "missing", advisorReviewId || "missing", documentId]);
    cleanupCheck("cleanup removed all integration rows", Number(remaining.rows[0].test_rows) === 0, `remaining rows: ${remaining.rows[0].test_rows}`);
    const login = await admin.query("select rolcanlogin from pg_roles where rolname=$1", [runtimeUser]);
    cleanupCheck("cleanup restored runtime NOLOGIN", login.rows.length === 1 && login.rows[0].rolcanlogin === false, `rolcanlogin=${login.rows[0]?.rolcanlogin}`);
  } catch (error) {
    cleanupFailures.push(`cleanup assertion: ${error instanceof Error ? error.message : String(error)}`);
  }
  cleanupCheck("cleanup completed without suppressed failures", cleanupFailures.length === 0, cleanupFailures.join(" | "));
  await admin.end();
}

const summary = {
  total: checks.length,
  passed: checks.filter((item) => item.status === "PASS").length,
  failed: checks.filter((item) => item.status === "FAIL").length,
};
const report = {
  schemaVersion: "d1-postgres-repository-integration-413.2",
  generatedAt: new Date().toISOString(),
  target: { host, port, database, disposable: true, runtimeRole: runtimeUser },
  syntheticDataOnly: true,
  ownerConnectionUse: "role setup, cleanup, and cleanup assertions only",
  cleanupFailures,
  checks,
  summary,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary)}\n${output}\n`);
if (mainFailure || summary.failed) process.exitCode = 1;
