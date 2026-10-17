import assert from "node:assert/strict";
import test from "node:test";

import { sha256 } from "../src/core/canonical.js";
import { TimelineService } from "../src/domain/timeline-service.js";
import { ExportOrchestrator, projectDocumentForExport } from "../src/export/export-orchestrator.js";
import type { TimelineRenderer } from "../src/export/renderer.js";
import { FileVaultPublisher, InMemoryLegacyFileVaultClient, LegacyFileVaultAdapter } from "../src/filevault/filevault.js";
import { InMemoryTimelineRepository } from "../src/persistence/repository.js";
import { InMemoryPrivateObjectStore } from "../src/storage/private-object-store.js";
import { advisor, document, exportService, fileVaultService, fixedClock, otherStudent, programAdmin, student } from "./fixtures.js";

const officialRenderer: TimelineRenderer = {
  authority: "MAC_PRO_AUTHORITY",
  async render(request) {
    return {
      authority: "MAC_PRO_AUTHORITY",
      rendererVersion: "mac-pro-contract-fixture-1",
      assetManifestSha256: "a".repeat(64),
      files: [
        { role: "PRIMARY", filename: "mission-timeline.png", mimeType: "image/png", bytes: new Uint8Array([137, 80, 78, 71]) },
        { role: "ACCESSIBLE_TEXT", filename: "mission-timeline.txt", mimeType: "text/plain", bytes: new TextEncoder().encode(request.document.title) },
      ],
      warnings: ["CONTRACT_FIXTURE_ONLY"],
    };
  },
};

async function approvedExportSetup() {
  const repository = new InMemoryTimelineRepository();
  const service = new TimelineService(repository, fixedClock);
  await service.createDocument(student, { id: "timeline_test", programId: "program_internal_medicine", title: "Mission Timeline", document: document() });
  const version = await service.createVersion(student, "timeline_test", 0, document(), "Approved version");
  await service.assignAdvisor(programAdmin, {
    documentId: "timeline_test",
    advisorPrincipalId: advisor.principalId,
    programId: "program_internal_medicine",
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: null,
  });
  const review = await service.requestReview(student, "timeline_test", version.id);
  await service.decideReview(advisor, review.id, "APPROVED", "Ready.");
  const job = await service.createExportJob(
    student,
    "timeline_test",
    version.id,
    "TIMELINE_INTERVIEWER_SAFE_PNG",
    "INTERVIEWER_SAFE",
    "MAC_PRO_AUTHORITY",
  );
  return { repository, service, version, review, job };
}

test("interviewer-safe projection removes private events and quarantined source text", () => {
  const projected = projectDocumentForExport(
    document({
      events: [
        document().events[0]!,
        { ...document().events[0]!, id: "private", title: "Private family context", visibilityState: "STUDENT_ONLY" },
      ],
      documentPages: [{ text: "raw CV text" }],
      sourceBlocks: [{ text: "raw block" }],
      extractionCandidates: [{ title: "candidate" }],
      sourceDocuments: [{ id: "source_1", kind: "CV", sha256: "f".repeat(64), filename: "Student Name CV.pdf" }],
    }),
    "INTERVIEWER_SAFE",
  );
  assert.deepEqual(projected.events.map((item) => item.id), ["event_work"]);
  assert.equal(projected.documentPages, undefined);
  assert.equal(projected.sourceBlocks, undefined);
  assert.equal(projected.extractionCandidates, undefined);
  assert.deepEqual(projected.sourceDocuments, [{ id: "source_1", kind: "CV", sha256: "f".repeat(64), removed: undefined }]);
});

test("official export rechecks approval immediately before render", async () => {
  const { repository, version, review, job } = await approvedExportSetup();
  await repository.addApproval({
    id: "approval_invalidated",
    reviewRequestId: review.id,
    documentId: "timeline_test",
    versionId: version.id,
    contentSha256: version.contentSha256,
    decision: "INVALIDATED",
    actorId: student.principalId,
    reason: "Material edit detected.",
    createdAt: "2026-07-15T12:00:01.000Z",
  });
  const orchestrator = new ExportOrchestrator(
    repository,
    new InMemoryPrivateObjectStore("test", "0123456789abcdef0123456789abcdef", fixedClock),
    new Map([["MAC_PRO_AUTHORITY", officialRenderer]]),
    fixedClock,
  );
  await assert.rejects(orchestrator.process(exportService, job.id), (error: { code?: string }) => error.code === "APPROVAL_REQUIRED");
  assert.equal((await repository.getExportJob(job.id))?.status, "QUEUED");
});

test("export produces canonical TimelineArtifact and student-owned private objects", async () => {
  const { repository, job, version } = await approvedExportSetup();
  const objectStore = new InMemoryPrivateObjectStore("test", "0123456789abcdef0123456789abcdef", fixedClock);
  const orchestrator = new ExportOrchestrator(repository, objectStore, new Map([["MAC_PRO_AUTHORITY", officialRenderer]]), fixedClock);
  const artifact = await orchestrator.process(exportService, job.id);
  assert.equal(artifact.artifactSchemaVersion, "d1-timeline-artifact-409.1");
  assert.equal(artifact.timelineVersionId, version.id);
  assert.equal(artifact.createdByRole, "SYSTEM_LOCAL");
  assert.equal(artifact.primaryFile.role, "PRIMARY");
  assert.equal(artifact.companionFiles.length, 1);
  assert.equal(artifact.timelineEventCount, 1);
  assert.match(artifact.contentHash, /^[a-f0-9]{64}$/);
  assert.equal((await objectStore.getObject(artifact.primaryFile.objectId))?.ownerPrincipalId, student.principalId);
});

test("private object store validates token, size, hash, MIME, and opaque key", async () => {
  const store = new InMemoryPrivateObjectStore("test", "0123456789abcdef0123456789abcdef", fixedClock);
  const expected = new TextEncoder().encode("abc");
  const signed = await store.signUpload(student, {
    documentId: "timeline_test",
    objectClass: "MEDIA",
    mimeType: "image/png",
    byteSize: expected.byteLength,
    sha256: sha256(expected),
  });
  assert.doesNotMatch((await store.getObject(signed.objectId))!.storageKey, /student|example|@/i);
  await store.acceptTestUpload(signed.objectId, signed.uploadToken, new TextEncoder().encode("abd"), "image/png");
  await assert.rejects(store.confirmUpload(student, signed.objectId, signed.uploadToken), (error: { code?: string }) => error.code === "OBJECT_HASH_MISMATCH");

  const valid = await store.signUpload(student, {
    documentId: "timeline_test",
    objectClass: "MEDIA",
    mimeType: "image/png",
    byteSize: expected.byteLength,
    sha256: sha256(expected),
  });
  await store.acceptTestUpload(valid.objectId, valid.uploadToken, expected, "image/png");
  await store.confirmUpload(student, valid.objectId, valid.uploadToken);
  await assert.rejects(store.signDownload(otherStudent, valid.objectId), (error: { code?: string }) => error.code === "OBJECT_ACCESS_DENIED");
});

test("legacy FileVault publication is idempotent and v2 remains disabled", async () => {
  const { repository, job } = await approvedExportSetup();
  const objectStore = new InMemoryPrivateObjectStore("test", "0123456789abcdef0123456789abcdef", fixedClock);
  const orchestrator = new ExportOrchestrator(repository, objectStore, new Map([["MAC_PRO_AUTHORITY", officialRenderer]]), fixedClock);
  const artifact = await orchestrator.process(exportService, job.id);
  const legacyClient = new InMemoryLegacyFileVaultClient();
  const publisher = new FileVaultPublisher(
    repository,
    new Map([["LEGACY", new LegacyFileVaultAdapter(legacyClient)]]),
    fixedClock,
  );
  const first = await publisher.publish(fileVaultService, artifact.artifactId, "LEGACY");
  const second = await publisher.publish(fileVaultService, artifact.artifactId, "LEGACY");
  assert.deepEqual(second, first);
  assert.equal(legacyClient.uploads.length, 1);
});
