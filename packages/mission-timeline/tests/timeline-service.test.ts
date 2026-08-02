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
