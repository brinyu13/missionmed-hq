import assert from "node:assert/strict";
import test from "node:test";

import type { TimelineArtifact } from "../src/contracts/types.js";
import { canonicalDocumentHash, sha256, stableStringify } from "../src/core/canonical.js";
import {
  assertEnvelopePrivacy,
  LocalMacProRenderCoordinator,
  LocalMacProWorkerSimulator,
  MAC_PRO_STAGING_MODE,
  type MacProAuthorityPolicy,
  type MacProRenderSubmission,
} from "../src/export/staging/mac-pro-renderer-staging.js";
import {
  LEGACY_FILEVAULT_STAGING_MODE,
  LocalLegacyFileVaultContractFixture,
  type LegacyPublishInput,
} from "../src/filevault/staging/legacy-filevault-staging.js";
import { document } from "./fixtures.js";

const ENVELOPE_SECRET = "d1-413-envelope-secret-for-tests";
const WORKER_SECRET = "d1-413-worker-secret-for-tests";
const NONCE_SECRET = "d1-413-filevault-nonce-for-tests";

const authority: MacProAuthorityPolicy = {
  approvedTemplateId: "timeline-2025-canonical",
  templateSha256: "1".repeat(64),
  rendererVersion: "mac-pro-local-fixture-413.1",
  rendererSha256: "2".repeat(64),
  fontManifestSha256: "3".repeat(64),
  assetManifestSha256: "4".repeat(64),
};

function submission(overrides: Partial<MacProRenderSubmission> = {}): MacProRenderSubmission {
  const source = overrides.document ?? document({
    revision: 7,
    events: [
      { ...document().events[0]!, notes: "private working note", provenance: { rawText: "raw CV line" } },
      { ...document().events[0]!, id: "event_student_only", title: "Private family matter", visibilityState: "STUDENT_ONLY" },
      { ...document().events[0]!, id: "event_advisor_only", title: "Advisor concern", visibilityState: "ADVISOR_ONLY" },
      { ...document().events[0]!, id: "event_hidden", title: "Hidden event", visibilityState: "HIDDEN" },
    ],
    documentPages: [{ text: "raw source" }],
    sourceBlocks: [{ text: "raw block" }],
    extractionCandidates: [{ text: "raw candidate" }],
    advisorReview: { comment: "private advisor body" },
    matrixSession: "must-never-leave-bff",
    databaseUrl: "must-never-leave-bff",
  });
  const sourceContentSha256 = overrides.sourceContentSha256 ?? canonicalDocumentHash(source);
  const sourceVersionId = overrides.sourceVersionId ?? "version_approved_413";
  return {
    jobId: "render_job_413_test",
    idempotencyKey: "render-job-413-test",
    artifactType: "TIMELINE_INTERVIEWER_SAFE_PNG",
    scope: "INTERVIEWER_SAFE",
    document: source,
    sourceVersionId,
    sourceContentSha256,
    approval: {
      decision: "APPROVED",
      sourceVersionId,
      sourceContentSha256,
      approvedAt: "2026-07-15T12:00:00.000Z",
    },
    authority,
    requestedFormats: ["PNG"],
    ...overrides,
  };
}

function coordinator(overrides: Partial<ConstructorParameters<typeof LocalMacProRenderCoordinator>[0]> = {}) {
  return new LocalMacProRenderCoordinator({
    envelopeKeyId: "d1-413-envelope-key",
    envelopeSecret: ENVELOPE_SECRET,
    workerSecret: WORKER_SECRET,
    authority,
    ...overrides,
  });
}

function worker(overrides: Partial<ConstructorParameters<typeof LocalMacProWorkerSimulator>[0]> = {}) {
  return new LocalMacProWorkerSimulator({
    workerId: "mac-pro-local-fixture",
    workerSecret: WORKER_SECRET,
    freeDiskBytes: 20 * 1024 * 1024 * 1024,
    minimumFreeDiskBytes: 10 * 1024 * 1024 * 1024,
    ...overrides,
  });
}

test("Mac Pro fixture is disconnected, signed, private, deterministic, and idempotent", () => {
  const queue = coordinator();
  const request = submission();
  const queued = queue.submit(request);
  assert.equal(queue.mode, MAC_PRO_STAGING_MODE);
  assert.equal(queue.connected, false);
  assert.equal(queue.verifyEnvelope(queued.envelope), true);
  assert.doesNotThrow(() => assertEnvelopePrivacy(queued.envelope));
  assert.deepEqual(queued.envelope.projection.events.map((event) => event.id), ["event_work"]);
  const serialized = stableStringify(queued.envelope);
  for (const secret of ["must-never-leave-bff", "raw CV line", "private working note", "Private family matter", "Advisor concern", "Hidden event", "principal_student", "program_internal_medicine"]) {
    assert.equal(serialized.includes(secret), false, `envelope leaked ${secret}`);
  }

  const completed = worker().runOnce(queue, "DUPLICATE_COMPLETION");
  assert.equal(completed?.status, "COMPLETED");
  assert.equal(completed?.outputs.length, 1);
  assert.equal(completed?.outputs[0]?.mimeType, "image/png");
  assert.equal(completed?.outputs[0]?.width, 1920);
  assert.equal(completed?.outputs[0]?.height, 1080);
  assert.equal(completed?.outputs[0]?.sha256, sha256(completed!.outputs[0]!.bytes));

  const replay = queue.submit(request);
  assert.equal(replay.status, "COMPLETED");
  assert.equal(replay.outputs[0]?.sha256, completed?.outputs[0]?.sha256);
  assert.throws(
    () => queue.submit(submission({ document: document({ title: "Conflicting input" }) })),
    (error: { code?: string }) => error.code === "RENDER_IDEMPOTENCY_CONFLICT",
  );
});

test("Mac Pro submission rejects stale approval and authority drift", () => {
  const cases: Array<[string, Partial<MacProRenderSubmission>, string]> = [
    ["approval decision", { approval: { ...submission().approval, decision: "INVALIDATED" } }, "RENDER_APPROVAL_REQUIRED"],
    ["approval version", { approval: { ...submission().approval, sourceVersionId: "version_stale_413" } }, "RENDER_STALE_APPROVAL_VERSION"],
    ["approval hash", { approval: { ...submission().approval, sourceContentSha256: "9".repeat(64) } }, "RENDER_STALE_APPROVAL_HASH"],
    ["template", { authority: { ...authority, approvedTemplateId: "unapproved-template" } }, "RENDER_TEMPLATE_ID_MISMATCH"],
    ["template hash", { authority: { ...authority, templateSha256: "5".repeat(64) } }, "RENDER_TEMPLATE_SHA256_MISMATCH"],
    ["font hash", { authority: { ...authority, fontManifestSha256: "5".repeat(64) } }, "RENDER_FONT_MANIFEST_SHA256_MISMATCH"],
    ["asset hash", { authority: { ...authority, assetManifestSha256: "5".repeat(64) } }, "RENDER_ASSET_MANIFEST_SHA256_MISMATCH"],
    ["renderer", { authority: { ...authority, rendererVersion: "wrong-renderer" } }, "RENDER_RENDERER_VERSION_MISMATCH"],
    ["artifact scope", { scope: "SOURCE" }, "RENDER_ARTIFACT_SCOPE_MISMATCH"],
  ];
  for (const [label, override, code] of cases) {
    assert.throws(() => coordinator().submit(submission(override)), (error: { code?: string }) => error.code === code, label);
  }
});

test("Mac Pro fixture makes low disk, partial output, and corruption visible and retryable", () => {
  const modes = ["LOW_DISK", "PARTIAL_OUTPUT", "CORRUPT_OUTPUT"] as const;
  for (const mode of modes) {
    const queue = coordinator();
    const localWorker = worker();
    queue.submit(submission({ jobId: `render_job_${mode.toLowerCase()}_413`, idempotencyKey: `render-${mode.toLowerCase()}-413` }));
    const result = localWorker.runOnce(queue, mode);
    assert.equal(result?.status, "QUEUED", mode);
    assert.equal(result?.outputs.length, 0, `${mode} leaked a partial completion`);
    assert.match(result?.errorCode ?? "", /^RENDER_/);
    const recovered = localWorker.runOnce(queue, "SUCCESS");
    assert.equal(recovered?.status, "COMPLETED", `${mode} did not recover`);
    assert.equal(recovered?.attempt, 2);
  }
});

test("Mac Pro crash, timeout, and lost heartbeat retry to a bounded terminal state", () => {
  let nowMs = Date.parse("2026-07-15T12:00:00.000Z");
  const clock = () => new Date(nowMs);
  const queue = coordinator({ clock, heartbeatTimeoutMs: 5_000, leaseMs: 10_000, maxAttempts: 2 });
  const localWorker = worker({ clock });
  queue.submit(submission());
  const crashed = localWorker.runOnce(queue, "CRASH");
  assert.equal(crashed?.status, "RUNNING");
  nowMs += 11_000;
  assert.equal(queue.sweepExpired()[0]?.status, "QUEUED");
  const lost = localWorker.runOnce(queue, "LOST_HEARTBEAT");
  assert.equal(lost?.attempt, 2);
  nowMs += 11_000;
  const terminal = queue.sweepExpired()[0];
  assert.equal(terminal?.status, "FAILED");
  assert.equal(terminal?.errorCode, "RENDER_LOST_HEARTBEAT");
  assert.equal(localWorker.runOnce(queue), null);
});

test("Mac Pro total execution timeout is independent of the heartbeat lease", () => {
  let nowMs = Date.parse("2026-07-15T12:00:00.000Z");
  const clock = () => new Date(nowMs);
  const queue = coordinator({ clock, heartbeatTimeoutMs: 20_000, leaseMs: 20_000, maxExecutionMs: 5_000 });
  queue.submit(submission());
  assert.equal(worker({ clock }).runOnce(queue, "LOST_HEARTBEAT")?.status, "RUNNING");
  nowMs += 6_000;
  const timedOut = queue.sweepExpired()[0];
  assert.equal(timedOut?.status, "QUEUED");
  assert.equal(timedOut?.errorCode, "RENDER_TIMEOUT");
});

function artifact(primaryBytes: Uint8Array, overrides: Partial<TimelineArtifact> = {}): TimelineArtifact {
  const primaryHash = sha256(primaryBytes);
  const artifactId = overrides.artifactId ?? "artifact_filevault_413";
  const artifactHash = overrides.contentHash ?? sha256(stableStringify([{ role: "PRIMARY", sha256: primaryHash }]));
  const now = "2026-07-15T12:00:00.000Z";
  const primaryFile = {
    role: "PRIMARY" as const,
    objectId: `object_${primaryHash.slice(0, 12)}`,
    filename: "mission-timeline.pdf",
    mimeType: "application/pdf",
    byteSize: primaryBytes.byteLength,
    sha256: primaryHash,
    contentHash: primaryHash,
  };
  return {
    artifactId,
    artifactSchemaVersion: "d1-timeline-artifact-409.1",
    artifactType: "TIMELINE_PRINT_PDF",
    timelineDocumentId: "timeline_test",
    timelineVersionId: "version_approved_413",
    studentOwnerId: "principal_student",
    programId: "program_internal_medicine",
    createdByRole: "SYSTEM_LOCAL",
    createdAt: now,
    updatedAt: now,
    displayName: "Mission Timeline",
    description: "Private source phrase must not enter legacy metadata",
    documentCategory: "MISSION_TIMELINE",
    mimeType: primaryFile.mimeType,
    byteSize: primaryFile.byteSize,
    contentHash: artifactHash,
    exportScope: "PRINT",
    visibility: "INTERVIEWER_SAFE",
    approvalState: { sourceVersionId: "version_approved_413" },
    theme: "keynote",
    dimensions: null,
    pageCount: 1,
    previewImage: null,
    primaryFile,
    companionFiles: [],
    sourceDocumentReferences: [{ rawText: "must never reach FileVault metadata" }],
    timelineEventCount: 1,
    generatedQuestionCount: 0,
    advisorCommentCount: 0,
    files: [primaryFile],
    warnings: [],
    provenanceSummary: { rawText: "must never reach FileVault metadata" },
    retentionClass: "STUDENT_CONTROLLED_PRIVATE",
    fileVaultLinkageState: "PENDING",
    legacyVaultReference: null,
    v2VaultReference: null,
    synchronizationStatus: "ARTIFACT_READY",
    synchronizationHistory: [],
    idempotencyKey: `export-${artifactId}`,
    ...overrides,
  };
}

function vaultFixture() {
  return new LocalLegacyFileVaultContractFixture({ nonceSecret: NONCE_SECRET, clock: () => new Date("2026-07-15T12:00:00.000Z") });
}

function vaultInput(
  vault: LocalLegacyFileVaultContractFixture,
  bytes = new TextEncoder().encode("%PDF-1.4\nfixture\n%%EOF\n"),
  artifactOverrides: Partial<TimelineArtifact> = {},
  inputOverrides: Partial<LegacyPublishInput> = {},
): LegacyPublishInput {
  const value = artifact(bytes, artifactOverrides);
  return {
    artifact: value,
    primaryBytes: bytes,
    session: vault.issueSession(101, value.studentOwnerId),
    ...inputOverrides,
  };
}

test("legacy FileVault fixture models authenticated create, raw PUT, confirm, and idempotency", () => {
  const vault = vaultFixture();
  const input = vaultInput(vault);
  const first = vault.publish(input);
  const repeated = vault.publish(input);
  assert.equal(vault.mode, LEGACY_FILEVAULT_STAGING_MODE);
  assert.equal(vault.connected, false);
  assert.equal(vault.servicePublishForOwnerEndpointAvailable, false);
  assert.equal(vault.fileVaultV2Enabled, false);
  assert.equal(first.status, "LINKED");
  assert.equal(repeated.status, "LINKED");
  assert.equal(repeated.idempotentReplay, true);
  assert.equal(repeated.externalFileId, first.externalFileId);
  assert.equal(repeated.externalVersionId, first.externalVersionId);
  assert.deepEqual(vault.operations.map(({ method, route }) => [method, route]), [
    ["POST", "/wp-json/mmed/v1/files/upload-url"],
    ["PUT", first.uploadUrl],
    ["POST", `/wp-json/mmed/v1/files/${first.externalFileId}/confirm`],
  ]);
  const metadata = stableStringify({ upload: first.uploadRequest, confirm: first.confirmRequest });
  assert.equal(metadata.includes("Private source phrase"), false);
  assert.equal(metadata.includes("must never reach FileVault metadata"), false);
  assert.equal(metadata.includes(input.session.nonce), false);
  assert.equal(vault.v2CallCount, 0);
});

test("legacy FileVault fixture enforces owner, nonce, primary size, and SHA-256 binding", () => {
  const vault = vaultFixture();
  const valid = vaultInput(vault);
  assert.throws(
    () => vault.publish({ ...valid, session: vault.issueSession(202, "principal_other_student") }),
    (error: { code?: string }) => error.code === "FILEVAULT_PUBLISH_FOR_OWNER_UNAVAILABLE",
  );
  assert.throws(
    () => vault.publish({ ...valid, session: { ...valid.session, nonce: `${valid.session.nonce}tampered` } }),
    (error: { code?: string }) => error.code === "FILEVAULT_WORDPRESS_NONCE_INVALID",
  );
  assert.throws(
    () => vault.publish({ ...valid, primaryBytes: Uint8Array.from([...valid.primaryBytes, 0]) }),
    (error: { code?: string }) => error.code === "FILEVAULT_PRIMARY_SIZE_MISMATCH",
  );
  const corrupt = Uint8Array.from(valid.primaryBytes);
  corrupt[0] = 0;
  assert.throws(
    () => vault.publish({ ...valid, primaryBytes: corrupt }),
    (error: { code?: string }) => error.code === "FILEVAULT_PRIMARY_HASH_MISMATCH",
  );
});

test("legacy FileVault partial PUT and confirm failure remain visible and reconcile safely", () => {
  const partialVault = vaultFixture();
  const partialInput = vaultInput(partialVault, undefined, {}, { faults: { partialPutBytes: 5 } });
  const partial = partialVault.publish(partialInput);
  assert.equal(partial.status, "PARTIAL_PUT");
  assert.equal(partial.bytesReceived, 5);
  assert.equal(partial.confirmRequest, null);
  const partialRecovered = partialVault.reconcile({ ...partialInput, faults: undefined });
  assert.equal(partialRecovered.status, "LINKED");

  const confirmVault = vaultFixture();
  const confirmInput = vaultInput(confirmVault, undefined, {}, { faults: { failConfirmCount: 1 } });
  const failed = confirmVault.publish(confirmInput);
  assert.equal(failed.status, "CONFIRM_FAILED");
  assert.equal(failed.errorCode, "LEGACY_CONFIRM_FAILED");
  assert.equal(failed.bytesReceived, failed.expectedBytes);
  const recovered = confirmVault.reconcile({ ...confirmInput, faults: undefined });
  assert.equal(recovered.status, "LINKED");
  assert.equal(recovered.externalVersionId, failed.externalVersionId);
});

test("legacy FileVault queue replay is deduplicated and recovers a transient failure", () => {
  const vault = vaultFixture();
  const input = vaultInput(vault, undefined, {}, { faults: { failCreateCount: 1 } });
  const key = vault.enqueue(input);
  assert.equal(vault.enqueue(input), key);
  assert.equal(vault.pendingQueueCount, 1);
  assert.equal(vault.drainQueue()[0]?.status, "CREATE_FAILED");
  assert.equal(vault.pendingQueueCount, 1);
  assert.equal(vault.drainQueue()[0]?.status, "LINKED");
  assert.equal(vault.pendingQueueCount, 0);
});

test("legacy FileVault creates a new version, supersedes prior linkage, and keeps archive/delete honest", () => {
  const vault = vaultFixture();
  const firstBytes = new TextEncoder().encode("%PDF-1.4\nfirst\n%%EOF\n");
  const secondBytes = new TextEncoder().encode("%PDF-1.4\nsecond\n%%EOF\n");
  const firstInput = vaultInput(vault, firstBytes);
  const first = vault.publish(firstInput);
  const secondArtifact = artifact(secondBytes, { artifactId: firstInput.artifact.artifactId });
  const second = vault.publish({
    artifact: secondArtifact,
    primaryBytes: secondBytes,
    session: vault.issueSession(101, secondArtifact.studentOwnerId),
  });
  assert.equal(second.status, "LINKED");
  assert.equal(second.externalFileId, first.externalFileId);
  assert.equal(second.versionNumber, 2);
  assert.notEqual(second.externalVersionId, first.externalVersionId);
  assert.equal(vault.getPublication(first.artifactId, first.artifactContentHash)?.status, "SUPERSEDED");
  assert.equal(vault.requestArchiveIntent(first.artifactId, "Student requested archive").status, "UNSUPPORTED_REQUIRES_VERIFIED_CONTRACT");
  assert.throws(
    () => vault.requestDeletion(first.artifactId, "Student requested deletion"),
    (error: { code?: string }) => error.code === "LEGACY_FILEVAULT_DELETE_NOT_VERIFIED",
  );
  assert.equal(vault.unsupportedIntents.length, 2);
  assert.equal(vault.v2CallCount, 0);
});
