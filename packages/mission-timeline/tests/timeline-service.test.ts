import assert from "node:assert/strict";
import test from "node:test";

import { TimelineService } from "../src/domain/timeline-service.js";
import { InMemoryTimelineRepository } from "../src/persistence/repository.js";
import { advisor, document, fixedClock, otherStudent, programAdmin, student } from "./fixtures.js";

async function setupVersion() {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  await service.createDocument(student, { id: "timeline_test", programId: "program_internal_medicine", title: "Mission Timeline", document: document() });
  const version = await service.createVersion(student, "timeline_test", 0, document(), "Advisor review");
  return { repository, service, version };
}

test("service derives owner from session and blocks cross-student access", async () => {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  const malicious = document({ studentOwnerId: otherStudent.principalId });
  const created = await service.createDocument(student, {
    id: "timeline_test",
    programId: "program_internal_medicine",
    title: "Mission Timeline",
    document: malicious,
  });
  assert.equal(created.document.studentOwnerId, student.principalId);
  await assert.rejects(service.getDocument(otherStudent, "timeline_test"), (error: { code?: string }) => error.code === "FORBIDDEN");
});

test("optimistic revision conflicts preserve the winning version", async () => {
  const { repository, service } = await setupVersion();
  await assert.rejects(
    service.createVersion(student, "timeline_test", 0, document(), "Stale version"),
    (error: { code?: string }) => error.code === "REVISION_CONFLICT",
  );
  assert.equal((await repository.getDocument("timeline_test"))?.document.revision, 1);
  assert.equal((await repository.listVersions("timeline_test")).length, 1);
});

test("checkpoint accepts the browser schema only through the guarded canonical boundary", async () => {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  await service.createDocument(student, {
    id: "timeline_schema_checkpoint",
    programId: "program_internal_medicine",
    title: "Mission Timeline",
    document: document(),
  });
  const browserSnapshot = document({
    id: "forged_browser_id",
    schemaVersion: "d1-uxr-002.1",
    studentOwnerId: otherStudent.principalId,
    programId: "program_other",
    browserOnlyField: { preserved: true },
  });
  const checkpoint = await service.saveCheckpoint(
    student,
    "timeline_schema_checkpoint",
    "browser_device",
    0,
    browserSnapshot,
  );
  assert.equal(checkpoint.snapshot.schemaVersion, "d1-timeline-document-409.1");
  assert.equal(checkpoint.snapshot.id, "timeline_schema_checkpoint");
  assert.equal(checkpoint.snapshot.studentOwnerId, student.principalId);
  assert.equal(checkpoint.snapshot.programId, "program_internal_medicine");
  assert.deepEqual(checkpoint.snapshot.browserOnlyField, { preserved: true });

  await assert.rejects(
    service.saveCheckpoint(
      student,
      "timeline_schema_checkpoint",
      "browser_device",
      0,
      document({ schemaVersion: "future-unknown.1" }),
    ),
    (error: { code?: string }) => error.code === "DOCUMENT_SCHEMA_UNSUPPORTED",
  );
});

test("advisor workflow binds review and approval to exact version hash", async () => {
  const { repository, service, version } = await setupVersion();
  await service.assignAdvisor(programAdmin, {
    documentId: "timeline_test",
    advisorPrincipalId: advisor.principalId,
    programId: "program_internal_medicine",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: null,
  });
  const review = await service.requestReview(student, "timeline_test", version.id);
  const comment = await service.addComment(advisor, review.id, "Clarify the transition into research.", "SHARED", { eventId: "event_work" });
  const approval = await service.decideReview(advisor, review.id, "APPROVED", "Ready for interview use.");
  assert.equal(comment.authorId, advisor.principalId);
  assert.equal(approval.versionId, version.id);
  assert.equal(approval.contentSha256, version.contentSha256);
  assert.equal(await service.isApproved("timeline_test", version.id, version.contentSha256), true);
  assert.equal((await repository.listComments(review.id)).length, 1);
});

test("material version invalidates prior approval", async () => {
  const { service, version } = await setupVersion();
  await service.assignAdvisor(programAdmin, {
    documentId: "timeline_test",
    advisorPrincipalId: advisor.principalId,
    programId: "program_internal_medicine",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: null,
  });
  const review = await service.requestReview(student, "timeline_test", version.id);
  await service.decideReview(advisor, review.id, "APPROVED", "Approved.");
  const changed = document({ revision: 1, events: [...document().events, { ...document().events[0]!, id: "event_research", title: "Research Fellow" }] });
  await service.createVersion(student, "timeline_test", 1, changed, "Material update");
  assert.equal(await service.isApproved("timeline_test", version.id, version.contentSha256), false);
});

test("active content, credentials, and patient identifiers are rejected", async () => {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  await assert.rejects(
    service.createDocument(student, { programId: "program_internal_medicine", title: "<script>alert(1)</script>" }),
    (error: { code?: string }) => error.code === "CONTENT_POLICY_BLOCK",
  );
  await assert.rejects(
    service.createDocument(student, { programId: "program_internal_medicine", title: "Patient MRN 123456" }),
    (error: { code?: string }) => error.code === "CONTENT_POLICY_BLOCK",
  );
});

test("V1 approval readback binds actor, time, optional note and current revision without mutable JSON authority", async () => {
  const { repository, service, version } = await setupVersion();
  const admin = { ...programAdmin, isWordpressAdministrator: true, adminWorkspace: true, adminSubjectPrincipalId: student.principalId };
  const unreviewed = await service.getApprovalStatus(student, "timeline_test");
  assert.equal(unreviewed.status, "UNREVIEWED");
  assert.equal(unreviewed.canDecide, false);
  assert.equal((await service.getApprovalStatus(admin, "timeline_test")).canDecide, true);
  await assert.rejects(service.requestReview(admin, "timeline_test", version.id), { code: "ADVISOR_NOT_ASSIGNED" });
  await service.assignAdvisor(programAdmin, { documentId: "timeline_test", advisorPrincipalId: advisor.principalId,
    programId: "program_internal_medicine", startsAt: "2026-01-01T00:00:00.000Z", endsAt: null });
  const review = await service.requestReview(admin, "timeline_test", version.id);
  assert.equal((await service.getApprovalStatus(student, "timeline_test")).reviewId, review.id);
  await assert.rejects(service.decideReview(student, review.id, "APPROVED", "", 1), { code: "FORBIDDEN" });
  await assert.rejects(service.getApprovalStatus(otherStudent, "timeline_test"), { code: "FORBIDDEN" });
  await assert.rejects(service.getApprovalStatus({ ...admin, facultyGrants: [] }, "timeline_test"), { code: "FORBIDDEN" });
  await service.decideReview(admin, review.id, "APPROVED", "", 1);
  const approved = await service.getApprovalStatus(student, "timeline_test");
  assert.equal(approved.status, "APPROVED");
  assert.equal(approved.currentRevision, 1);
  assert.equal(approved.currentVersionId, version.id);
  assert.equal(approved.currentContentSha256, version.contentSha256);
  assert.deepEqual(approved.decision, { decision: "APPROVED", versionId: version.id, revision: 1,
    contentSha256: version.contentSha256, actorId: admin.principalId, timestamp: fixedClock().toISOString(), note: null });
  await service.decideReview(admin, review.id, "CHANGES_REQUESTED", "Clarify dates.", 1);
  assert.equal((await service.getApprovalStatus(student, "timeline_test")).status, "CHANGES_REQUESTED");
  await service.decideReview(admin, review.id, "APPROVED", "Ready.", 1);
  const changed = await service.createVersion(student, "timeline_test", 1, document({ title: "Changed timeline" }), "Material edit");
  const stale = await service.getApprovalStatus(student, "timeline_test");
  assert.equal(stale.status, "NEEDS_REVIEW");
  assert.equal(stale.currentRevision, changed.revision);
  const count = (await repository.listApprovals("timeline_test")).length;
  await assert.rejects(service.decideReview(admin, review.id, "APPROVED", "", 1), { code: "REVISION_CONFLICT" });
  assert.equal((await repository.listApprovals("timeline_test")).length, count);
});

test("V1 approval decision uses transaction and current-document lock before writing", async () => {
  const { repository, service, version } = await setupVersion();
  await service.assignAdvisor(programAdmin, { documentId: "timeline_test", advisorPrincipalId: advisor.principalId,
    programId: "program_internal_medicine", startsAt: "2026-01-01T00:00:00.000Z", endsAt: null });
  const review = await service.requestReview(student, "timeline_test", version.id);
  const calls: string[] = [];
  const transaction = repository.withTransaction.bind(repository);
  repository.withTransaction = async work => { calls.push("transaction"); return transaction(work); };
  const get = repository.getDocument.bind(repository);
  repository.getDocument = async (id, options) => { calls.push(options?.forUpdate ? "lock" : "read"); return get(id, options); };
  const add = repository.addApproval.bind(repository);
  repository.addApproval = async event => { calls.push("write"); return add(event); };
  await assert.rejects(service.decideReview(advisor, review.id, "APPROVED", "", 0), { code: "REVISION_CONFLICT" });
  assert.equal(calls.includes("write"), false);
  calls.length = 0;
  await service.decideReview(advisor, review.id, "APPROVED", "", 1);
  assert.deepEqual(calls.slice(0, 3), ["transaction", "lock", "write"]);
});

test("V1 fixed-clock decisions remain in committed order under PostgreSQL timestamp and random-ID ordering", async () => {
  const { repository, service, version } = await setupVersion();
  await service.assignAdvisor(programAdmin, { documentId: "timeline_test", advisorPrincipalId: advisor.principalId,
    programId: "program_internal_medicine", startsAt: "2026-01-01T00:00:00.000Z", endsAt: null });
  const review = await service.requestReview(student, "timeline_test", version.id);
  const add = repository.addApproval.bind(repository);
  let counter = 0;
  repository.addApproval = event => add({ ...event, id: ["approval_z", "approval_a", "approval_0"][counter++]! });
  const list = repository.listApprovals.bind(repository);
  repository.listApprovals = async id => (await list(id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const approved = await service.decideReview(programAdmin, review.id, "APPROVED", "First", 1);
  const changed = await service.decideReview(programAdmin, review.id, "CHANGES_REQUESTED", "Later", 1);
  assert.ok(Date.parse(changed.createdAt) > Date.parse(approved.createdAt));
  const readback = await service.getApprovalStatus(student, "timeline_test");
  assert.equal(readback.status, "CHANGES_REQUESTED");
  assert.equal(readback.decision?.note, "Later");
  assert.equal(await service.isApproved("timeline_test", version.id, version.contentSha256), false);
  await service.createVersion(student, "timeline_test", 1, document({ title: "Material fixed-clock edit" }), "Edit");
  const events = await repository.listApprovals("timeline_test");
  assert.equal(events.at(-1)?.decision, "INVALIDATED");
  assert.ok(Date.parse(events.at(-1)!.createdAt) > Date.parse(changed.createdAt));
  await assert.rejects(service.decideReview(programAdmin, review.id, "APPROVED", "Stale", 1), { code: "REVISION_CONFLICT" });
});

test("V1 existing equal-timestamp history uses authoritative review status instead of random-ID order", async () => {
  const { repository, service, version } = await setupVersion();
  await service.assignAdvisor(programAdmin, { documentId: "timeline_test", advisorPrincipalId: advisor.principalId,
    programId: "program_internal_medicine", startsAt: "2026-01-01T00:00:00.000Z", endsAt: null });
  const review = await service.requestReview(student, "timeline_test", version.id);
  const timestamp = fixedClock().toISOString();
  for (const [id, decision, reason] of [["approval_z", "APPROVED", "Earlier"], ["approval_a", "CHANGES_REQUESTED", "Later"]] as const) {
    await repository.addApproval({ id, reviewRequestId: review.id, documentId: "timeline_test", versionId: version.id,
      contentSha256: version.contentSha256, decision, actorId: programAdmin.principalId, reason, createdAt: timestamp });
  }
  await repository.updateReview({ ...review, status: "CHANGES_REQUESTED" });
  const list = repository.listApprovals.bind(repository);
  repository.listApprovals = async id => (await list(id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const status = await service.getApprovalStatus(student, "timeline_test");
  assert.equal(status.status, "CHANGES_REQUESTED");
  assert.equal(status.decision?.note, "Later");
  assert.equal(await service.isApproved("timeline_test", version.id, version.contentSha256), false);
  await repository.addApproval({ id: "approval_b", reviewRequestId: review.id, documentId: "timeline_test", versionId: version.id,
    contentSha256: version.contentSha256, decision: "CHANGES_REQUESTED", actorId: programAdmin.principalId, reason: "Ambiguous", createdAt: timestamp });
  const ambiguous = await service.getApprovalStatus(student, "timeline_test");
  assert.equal(ambiguous.status, "NEEDS_REVIEW");
  assert.equal(ambiguous.decision, null);
  assert.equal(await service.isApproved("timeline_test", version.id, version.contentSha256), false);
});
