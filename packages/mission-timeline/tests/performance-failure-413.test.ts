import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import type { TimelineArtifact, TimelineDocument, TimelineEvent } from "../src/contracts/types.js";
import { canonicalDocumentHash, sha256, stableStringify } from "../src/core/canonical.js";
import { projectDocumentForExport } from "../src/export/export-orchestrator.js";
import {
  LocalMacProRenderCoordinator,
  LocalMacProWorkerSimulator,
  sanitizeProjection,
  type MacProAuthorityPolicy,
  type MacProRenderSubmission,
} from "../src/export/staging/mac-pro-renderer-staging.js";
import { LocalLegacyFileVaultContractFixture } from "../src/filevault/staging/legacy-filevault-staging.js";
import {
  InMemoryStagingPrincipalDirectory,
  StagingMatrixSessionExchange,
  type MatrixSessionAuthority,
  type MatrixSessionProof,
} from "../src/identity/staging/index.js";
import {
  InMemoryStagingLocalDraftStore,
  StagingHybridSyncCoordinator,
  type StagingCheckpointRequest,
  type StagingRemoteAvailability,
  type StagingRemoteTimelineClient,
  type StagingVersionRequest,
} from "../src/persistence/staging-hybrid.js";
import {
  DisposableFilesystemS3Client,
  StagingPrivateObjectStore,
  type MalwareScannerPort,
  type PrivateStorageAuthorizationPort,
} from "../src/storage/staging/index.js";
import { context, document, event, student } from "./fixtures.js";

const NOW = "2026-07-15T12:00:00.000Z";
const SESSION_SECRET = "d1-413-performance-session-secret-0123456789";
const ENVELOPE_SECRET = "d1-413-performance-envelope-secret";
const WORKER_SECRET = "d1-413-performance-worker-secret";
const FILEVAULT_SECRET = "d1-413-performance-filevault-secret";

function duration(startedAt: number): number {
  return performance.now() - startedAt;
}

function syntheticEvents(count: number): TimelineEvent[] {
  const visibilities = ["INTERVIEWER_SAFE", "FULL_STORY", "ADVISOR_ONLY", "STUDENT_ONLY", "HIDDEN"] as const;
  return Array.from({ length: count }, (_, index) => event({
    id: `event_${String(index).padStart(3, "0")}`,
    title: `Synthetic event ${index}`,
    startDate: `${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
    endDate: `${2020 + Math.floor((index + 1) / 12)}-${String(((index + 1) % 12) + 1).padStart(2, "0")}`,
    visibilityState: visibilities[index % visibilities.length],
  }));
}

test("100-event projection and 500-candidate quarantine stay within a 100ms local budget", () => {
  const candidateMarker = "candidate-private-marker";
  const source = document({
    events: syntheticEvents(100),
    extractionCandidates: Array.from({ length: 500 }, (_, index) => ({
      id: `candidate_${index}`,
      text: `${candidateMarker}-${index}`,
      confidence: (index % 100) / 100,
      provenance: { page: index % 20, rawText: `raw-${index}` },
    })),
  });
  const startedAt = performance.now();
  const projected = projectDocumentForExport(source, "INTERVIEWER_SAFE");
  const elapsedMs = duration(startedAt);

  assert.equal(projected.events.length, 20);
  assert.equal(projected.extractionCandidates, undefined);
  assert.equal(stableStringify(projected).includes(candidateMarker), false);
  assert.ok(elapsedMs < 100, `100-event/500-candidate projection took ${elapsedMs.toFixed(2)}ms`);
});

test("100-event Mac Pro privacy projections sustain 100 iterations within 500ms", () => {
  const source = document({ events: syntheticEvents(100) });
  const startedAt = performance.now();
  let visible = 0;
  for (let index = 0; index < 100; index += 1) {
    const projection = sanitizeProjection(source, index % 2 === 0 ? "INTERVIEWER_SAFE" : "ADVISOR_PACKET");
    visible += projection.events.length;
    assert.equal(projection.events.some(({ visibilityState }) => visibilityState === "HIDDEN"), false);
  }
  const elapsedMs = duration(startedAt);
  assert.equal(visible, 4_000);
  assert.ok(elapsedMs < 500, `100 render projections took ${elapsedMs.toFixed(2)}ms`);
});

class BurstRemote implements StagingRemoteTimelineClient {
  availability: StagingRemoteAvailability = { enabled: true, online: true, authenticated: true };
  checkpoints: StagingCheckpointRequest[] = [];
  versions: StagingVersionRequest[] = [];
  current = document();

  getAvailability() {
    return { ...this.availability };
  }

  async saveCheckpoint(request: StagingCheckpointRequest) {
    this.checkpoints.push(structuredClone(request));
    this.current = structuredClone(request.document);
    return { revision: request.baseRevision };
  }

  async createVersion(request: StagingVersionRequest) {
    this.versions.push(structuredClone(request));
    this.current = structuredClone(request.document);
    return { revision: request.baseRevision + 1 };
  }

  async getCurrentDocument() {
    return structuredClone(this.current);
  }
}

test("500 checkpoint saves coalesce without data loss within a 2.5s local budget", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new BurstRemote();
  const coordinator = new StagingHybridSyncCoordinator(student.principalId, local, remote, "device-burst", {
    clock: () => new Date(NOW),
  });
  const startedAt = performance.now();
  for (let index = 0; index < 500; index += 1) {
    await coordinator.saveLocal(document({ title: `Checkpoint ${index}` }));
  }
  const queuedBeforeFlush = await local.listOperations(student.principalId, "timeline_test");
  assert.equal(queuedBeforeFlush.length, 500);
  const result = await coordinator.flush("timeline_test");
  const elapsedMs = duration(startedAt);

  assert.equal(result.state, "CLOUD_SYNCED");
  assert.equal(remote.checkpoints.length, 1);
  assert.equal(remote.checkpoints[0]?.document.title, "Checkpoint 499");
  assert.equal((await coordinator.getLocalDraft("timeline_test"))?.document.title, "Checkpoint 499");
  assert.equal((await local.listOperations(student.principalId, "timeline_test")).length, 0);
  assert.ok(elapsedMs < 2_500, `500 checkpoint saves and flush took ${elapsedMs.toFixed(2)}ms`);
});

test("250 concurrent autosaves retain a monotonic sequence and the last synthetic edit", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new BurstRemote();
  remote.availability = { enabled: false, online: false, authenticated: false };
  const coordinator = new StagingHybridSyncCoordinator(student.principalId, local, remote, "device-race", {
    clock: () => new Date(NOW),
  });
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: 250 }, (_, index) =>
    coordinator.saveLocal(document({ title: `Race ${index}` })),
  ));
  const elapsedMs = duration(startedAt);
  const operations = await local.listOperations(student.principalId, "timeline_test");
  const draft = await coordinator.getLocalDraft("timeline_test");

  assert.equal(operations.length, 250);
  assert.deepEqual(operations.map(({ localSequence }) => localSequence), Array.from({ length: 250 }, (_, index) => index + 1));
  assert.equal(draft?.localSequence, 250);
  assert.equal(draft?.document.title, "Race 249");
  assert.equal(coordinator.getStatus("timeline_test")?.preserveLocalDraft, true);
  assert.ok(elapsedMs < 1_500, `250 concurrent local saves took ${elapsedMs.toFixed(2)}ms`);
});

test("offline and authentication failure keep a 100-operation queue recoverable", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new BurstRemote();
  remote.availability = { enabled: true, online: false, authenticated: true };
  const coordinator = new StagingHybridSyncCoordinator(student.principalId, local, remote, "device-offline");
  for (let index = 0; index < 100; index += 1) {
    await coordinator.saveVersion(document({ title: `Offline version ${index}` }), `Version ${index}`);
  }
  const offline = await coordinator.flush("timeline_test");
  assert.equal(offline.state, "OFFLINE");
  assert.equal(offline.preserveLocalDraft, true);
  assert.equal((await local.listOperations(student.principalId, "timeline_test")).length, 100);

  remote.availability = { enabled: true, online: true, authenticated: false };
  const auth = await coordinator.flush("timeline_test");
  assert.equal(auth.state, "AUTH_REQUIRED");
  assert.equal(auth.preserveLocalDraft, true);
  assert.equal((await local.listOperations(student.principalId, "timeline_test")).length, 100);
  assert.equal((await coordinator.getLocalDraft("timeline_test"))?.document.title, "Offline version 99");
});

class FastMatrixAuthority implements MatrixSessionAuthority {
  async verifyProof(proof: MatrixSessionProof) {
    return {
      valid: true,
      proofId: `${proof.wpUserId}:${proof.sessionId}:${proof.nonce}`,
      wpUserId: proof.wpUserId,
      sessionId: proof.sessionId,
    };
  }

  async isSessionActive() {
    return true;
  }
}

test("500 Matrix exchanges and live membership verifications fit a 2s local budget", async () => {
  const directory = new InMemoryStagingPrincipalDirectory();
  directory.register({
    principalId: student.principalId,
    wpUserId: 42,
    role: "STUDENT",
    programIds: ["program_internal_medicine"],
    assignedDocumentIds: [],
    active: true,
    membershipVersion: 1,
  });
  const exchange = new StagingMatrixSessionExchange(directory, new FastMatrixAuthority(), {
    issuer: "https://matrix.missionmed.test",
    audience: "mission-timeline-staging",
    signingSecret: SESSION_SECRET,
    clock: () => new Date(NOW),
  });
  const startedAt = performance.now();
  for (let index = 0; index < 500; index += 1) {
    const { token } = await exchange.exchange({
      wpUserId: 42,
      sessionId: `session-${index}`,
      nonce: `nonce-${index}`,
    });
    const verified = await exchange.verify(token, { requestId: `request-${index}` });
    assert.equal(verified.principalId, student.principalId);
  }
  const elapsedMs = duration(startedAt);
  assert.ok(elapsedMs < 2_000, `500 session exchanges took ${elapsedMs.toFixed(2)}ms`);
});

const renderAuthority: MacProAuthorityPolicy = {
  approvedTemplateId: "timeline-2025-canonical",
  templateSha256: "1".repeat(64),
  rendererVersion: "mac-pro-local-fixture-413.1",
  rendererSha256: "2".repeat(64),
  fontManifestSha256: "3".repeat(64),
  assetManifestSha256: "4".repeat(64),
};

function renderSubmission(index: number): MacProRenderSubmission {
  const source = document({ id: `timeline_render_${index}`, events: syntheticEvents(100) });
  const sourceContentSha256 = canonicalDocumentHash(source);
  const sourceVersionId = `version_render_${index}`;
  return {
    jobId: `render_job_performance_${index}`,
    idempotencyKey: `render-job-performance-${index}`,
    artifactType: "TIMELINE_INTERVIEWER_SAFE_PNG",
    scope: "INTERVIEWER_SAFE",
    document: source,
    sourceVersionId,
    sourceContentSha256,
    approval: { decision: "APPROVED", sourceVersionId, sourceContentSha256, approvedAt: NOW },
    authority: renderAuthority,
    requestedFormats: ["PNG"],
  };
}

test("100 renderer queue failures remain explicit and bounded without partial outputs", () => {
  const queue = new LocalMacProRenderCoordinator({
    envelopeKeyId: "d1-413-performance-envelope-key",
    envelopeSecret: ENVELOPE_SECRET,
    workerSecret: WORKER_SECRET,
    authority: renderAuthority,
    maxAttempts: 1,
    clock: () => new Date(NOW),
  });
  const worker = new LocalMacProWorkerSimulator({
    workerId: "mac-pro-performance",
    workerSecret: WORKER_SECRET,
    freeDiskBytes: 0,
    minimumFreeDiskBytes: 10 * 1024 * 1024 * 1024,
    clock: () => new Date(NOW),
  });
  const startedAt = performance.now();
  for (let index = 0; index < 100; index += 1) queue.submit(renderSubmission(index));
  for (let index = 0; index < 100; index += 1) {
    const result = worker.runOnce(queue, "LOW_DISK");
    assert.equal(result?.status, "FAILED");
    assert.equal(result?.errorCode, "RENDER_LOW_DISK");
    assert.deepEqual(result?.outputs, []);
  }
  const elapsedMs = duration(startedAt);
  assert.equal(worker.runOnce(queue), null);
  assert.ok(elapsedMs < 1_500, `100 rejected renderer jobs took ${elapsedMs.toFixed(2)}ms`);
});

function queueArtifact(index: number): { artifact: TimelineArtifact; bytes: Uint8Array } {
  const bytes = new TextEncoder().encode(`%PDF-1.4\nsynthetic-${index}\n%%EOF\n`);
  const primaryHash = sha256(bytes);
  const primaryFile = {
    role: "PRIMARY" as const,
    objectId: `object_${primaryHash.slice(0, 12)}`,
    filename: `timeline-${index}.pdf`,
    mimeType: "application/pdf",
    byteSize: bytes.byteLength,
    sha256: primaryHash,
    contentHash: primaryHash,
  };
  const artifact: TimelineArtifact = {
    artifactId: `artifact_queue_${index}`,
    artifactSchemaVersion: "d1-timeline-artifact-409.1",
    artifactType: "TIMELINE_PRINT_PDF",
    timelineDocumentId: "timeline_test",
    timelineVersionId: `version_${index}`,
    studentOwnerId: student.principalId,
    programId: "program_internal_medicine",
    createdByRole: "SYSTEM_LOCAL",
    createdAt: NOW,
    updatedAt: NOW,
    displayName: `Timeline ${index}`,
    description: "Synthetic performance fixture",
    documentCategory: "MISSION_TIMELINE",
    mimeType: "application/pdf",
    byteSize: bytes.byteLength,
    contentHash: sha256(stableStringify([{ role: "PRIMARY", sha256: primaryHash }])),
    exportScope: "PRINT",
    visibility: "INTERVIEWER_SAFE",
    approvalState: {},
    theme: "keynote",
    dimensions: null,
    pageCount: 1,
    previewImage: null,
    primaryFile,
    companionFiles: [],
    sourceDocumentReferences: [],
    timelineEventCount: 100,
    generatedQuestionCount: 0,
    advisorCommentCount: 0,
    files: [primaryFile],
    warnings: [],
    provenanceSummary: {},
    retentionClass: "STUDENT_CONTROLLED_PRIVATE",
    fileVaultLinkageState: "PENDING",
    legacyVaultReference: null,
    v2VaultReference: null,
    synchronizationStatus: "ARTIFACT_READY",
    synchronizationHistory: [],
    idempotencyKey: `filevault-queue-${index}`,
  };
  return { artifact, bytes };
}

test("250 FileVault queue entries drain once without duplicates within a 1.5s local budget", () => {
  const vault = new LocalLegacyFileVaultContractFixture({
    nonceSecret: FILEVAULT_SECRET,
    clock: () => new Date(NOW),
  });
  const session = vault.issueSession(101, student.principalId);
  const startedAt = performance.now();
  for (let index = 0; index < 250; index += 1) {
    const { artifact, bytes } = queueArtifact(index);
    vault.enqueue({ artifact, primaryBytes: bytes, session });
  }
  assert.equal(vault.pendingQueueCount, 250);
  const results = vault.drainQueue();
  const elapsedMs = duration(startedAt);

  assert.equal(results.length, 250);
  assert.equal(results.every(({ status }) => status === "LINKED"), true);
  assert.equal(new Set(results.map(({ externalFileId }) => externalFileId)).size, 250);
  assert.equal(vault.pendingQueueCount, 0);
  assert.equal(vault.operations.length, 750);
  assert.equal(vault.drainQueue().length, 0);
  assert.ok(elapsedMs < 1_500, `250 FileVault publications took ${elapsedMs.toFixed(2)}ms`);
});

const cleanScanner: MalwareScannerPort = {
  async scan() {
    return { status: "CLEAN", scanner: "performance", scannerVersion: "1" };
  },
};

const serviceAuthorization: PrivateStorageAuthorizationPort = {
  async authorize(request) {
    return {
      allowed: request.actor.role === "SERVICE",
      reasonCode: request.actor.role === "SERVICE" ? "SERVICE_ALLOW" : "ROLE_DENY",
    };
  },
};

test("50 disposable private-storage writes complete within a 3s local budget", async (t) => {
  const filesystem = await DisposableFilesystemS3Client.create();
  t.after(() => filesystem.dispose());
  const store = new StagingPrivateObjectStore({
    client: filesystem,
    malwareScanner: cleanScanner,
    authorization: serviceAuthorization,
    environment: "test",
    retryPolicy: { maxAttempts: 1, baseDelayMs: 0 },
    sleep: async () => undefined,
  });
  const service = context("SERVICE", "service_export", {
    programIds: ["program_internal_medicine"],
    serviceScopes: ["artifact:create"],
  });
  const bytes = new TextEncoder().encode("%PDF-1.7\nsynthetic storage\n%%EOF");
  const startedAt = performance.now();
  const records = [];
  for (let index = 0; index < 50; index += 1) {
    records.push(await store.putServiceObject(service, {
      documentId: `timeline_${index}`,
      ownerPrincipalId: student.principalId,
      programId: "program_internal_medicine",
      objectClass: "EXPORT",
      mimeType: "application/pdf",
      byteSize: bytes.byteLength,
      sha256: sha256(bytes),
      idempotencyKey: `service-storage-${String(index).padStart(4, "0")}`,
    }, bytes));
  }
  const elapsedMs = duration(startedAt);
  assert.equal(records.length, 50);
  assert.equal(records.every(({ status }) => status === "CONFIRMED"), true);
  assert.equal(new Set(records.map(({ id }) => id)).size, 50);
  assert.equal(await filesystem.objectCount(), 50);
  assert.ok(elapsedMs < 3_000, `50 private-storage writes took ${elapsedMs.toFixed(2)}ms`);
});

