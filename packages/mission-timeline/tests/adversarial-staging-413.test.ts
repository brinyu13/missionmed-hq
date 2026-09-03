import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import type {
  PrincipalContext,
  TimelineArtifact,
  TimelineDocument,
  TimelineEvent,
} from "../src/contracts/types.js";
import { canonicalDocumentHash, sha256, stableStringify } from "../src/core/canonical.js";
import { TimelineError } from "../src/core/errors.js";
import { projectDocumentForExport } from "../src/export/export-orchestrator.js";
import {
  LocalMacProRenderCoordinator,
  signWorkerCommand,
  type MacProAuthorityPolicy,
  type MacProRenderSubmission,
} from "../src/export/staging/mac-pro-renderer-staging.js";
import {
  LocalLegacyFileVaultContractFixture,
  type LegacyPublishInput,
} from "../src/filevault/staging/legacy-filevault-staging.js";
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
  PostgresTimelineRepository,
  type PostgresPool,
  type PostgresQueryResult,
  type PostgresTransactionClient,
} from "../src/persistence/postgres/index.js";
import {
  DisposableFilesystemS3Client,
  InMemoryPrivateStorageAuditSink,
  S3CompatibleClientError,
  StagingPrivateObjectStore,
  type MalwareScannerPort,
  type PrivateStorageAuthorizationPort,
  type PrivateStorageAuthorizationRequest,
} from "../src/storage/staging/index.js";
import { context, document, event, student } from "./fixtures.js";

const SESSION_SECRET = "d1-413-turing-session-secret-0123456789abcdef";
const ENVELOPE_SECRET = "d1-413-turing-envelope-secret";
const WORKER_SECRET = "d1-413-turing-worker-secret";
const FILEVAULT_SECRET = "d1-413-turing-filevault-secret";
const ISSUER = "https://matrix.missionmed.test";
const AUDIENCE = "mission-timeline-staging";
const NOW = "2026-07-15T12:00:00.000Z";

function hasCode(expected: string): (error: unknown) => boolean {
  return (error) => error instanceof TimelineError && error.code === expected;
}

function eventSet(): TimelineEvent[] {
  return [
    event({ id: "safe", title: "Public work", visibilityState: "INTERVIEWER_SAFE" }),
    event({ id: "full", title: "Full story", visibilityState: "FULL_STORY" }),
    event({ id: "advisor", title: "Advisor detail", visibilityState: "ADVISOR_ONLY" }),
    event({ id: "student", title: "Student private", visibilityState: "STUDENT_ONLY" }),
    event({ id: "hidden", title: "Hidden detail", visibilityState: "HIDDEN" }),
  ];
}

class TestMatrixAuthority implements MatrixSessionAuthority {
  active = true;

  async verifyProof(proof: MatrixSessionProof) {
    return {
      valid: proof.nonce.startsWith("valid-"),
      proofId: `${proof.wpUserId}:${proof.sessionId}:${proof.nonce}`,
      wpUserId: proof.wpUserId,
      sessionId: proof.sessionId,
    };
  }

  async isSessionActive() {
    return this.active;
  }
}

function principalRecord(overrides: Record<string, unknown> = {}) {
  return {
    principalId: "principal_student",
    wpUserId: 42,
    role: "STUDENT" as const,
    programIds: ["program_internal_medicine"],
    assignedDocumentIds: [],
    active: true,
    membershipVersion: 1,
    ...overrides,
  };
}

function sessionExchange(
  directory: InMemoryStagingPrincipalDirectory,
  authority: MatrixSessionAuthority,
  clock: () => Date = () => new Date(NOW),
) {
  return new StagingMatrixSessionExchange(directory, authority, {
    issuer: ISSUER,
    audience: AUDIENCE,
    signingSecret: SESSION_SECRET,
    ttlSeconds: 60,
    clock,
  });
}

function rewriteSessionToken(token: string, patch: Record<string, unknown>): string {
  const [header, payload] = token.split(".");
  assert.ok(header && payload);
  const current = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  const changed = Buffer.from(JSON.stringify({ ...current, ...patch })).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(`${header}.${changed}`).digest("base64url");
  return `${header}.${changed}.${signature}`;
}

test("identity rejects forged claims, membership changes, disabled principals, and replay", async () => {
  const directory = new InMemoryStagingPrincipalDirectory();
  directory.register(principalRecord());
  const authority = new TestMatrixAuthority();
  const exchange = sessionExchange(directory, authority);
  const proof = { wpUserId: 42, sessionId: "matrix-session", nonce: "valid-once" };
  const { token } = await exchange.exchange(proof);

  await assert.rejects(exchange.exchange(proof), hasCode("MATRIX_SESSION_PROOF_REPLAYED"));
  await assert.rejects(
    exchange.verify(rewriteSessionToken(token, { role: "PROGRAM_ADMIN" }), { requestId: "forged-role" }),
    hasCode("SESSION_PRINCIPAL_CLAIMS_STALE"),
  );
  await assert.rejects(
    exchange.verify(rewriteSessionToken(token, { programs: ["program_attacker"] }), { requestId: "forged-program" }),
    hasCode("SESSION_PRINCIPAL_CLAIMS_STALE"),
  );
  await assert.rejects(
    exchange.verify(rewriteSessionToken(token, { sub: "principal_attacker" }), { requestId: "forged-owner" }),
    hasCode("PRINCIPAL_NOT_ACTIVE"),
  );

  directory.register(principalRecord({ membershipVersion: 2, active: false }));
  await assert.rejects(exchange.verify(token, { requestId: "disabled" }), hasCode("PRINCIPAL_NOT_ACTIVE"));
});

test("[P1] Matrix authority outages must be translated to a content-free authentication error", async () => {
  const directory = new InMemoryStagingPrincipalDirectory();
  directory.register(principalRecord());
  const authority: MatrixSessionAuthority = {
    async verifyProof() {
      throw new Error("matrix-db-password=do-not-leak");
    },
    async isSessionActive() {
      throw new Error("matrix-session-store-secret=do-not-leak");
    },
  };
  const exchange = sessionExchange(directory, authority);
  await assert.rejects(
    exchange.exchange({ wpUserId: 42, sessionId: "matrix-session", nonce: "valid-outage" }),
    (error: unknown) => {
      assert.ok(error instanceof TimelineError);
      assert.equal(error.code, "MATRIX_AUTHORITY_UNAVAILABLE");
      assert.doesNotMatch(error.message, /password|secret|do-not-leak/i);
      return true;
    },
  );
});

test("export event projection excludes hidden and more-private visibility scopes", () => {
  const source = document({ events: eventSet() });
  assert.deepEqual(projectDocumentForExport(source, "INTERVIEWER_SAFE").events.map(({ id }) => id), ["safe"]);
  assert.deepEqual(projectDocumentForExport(source, "FULL_STORY").events.map(({ id }) => id), ["safe", "full"]);
  assert.deepEqual(projectDocumentForExport(source, "ADVISOR_PACKET").events.map(({ id }) => id), ["safe", "full", "advisor"]);
  assert.deepEqual(projectDocumentForExport(source, "SOURCE").events.map(({ id }) => id), ["safe", "full", "advisor", "student"]);
  for (const scope of ["INTERVIEWER_SAFE", "FULL_STORY", "ADVISOR_PACKET", "SOURCE", "ARCHIVE", "PRINT", "ACCESSIBLE"]) {
    assert.equal(projectDocumentForExport(source, scope).events.some(({ id }) => id === "hidden"), false);
  }
});

test("[P0] interviewer-safe projection must remove unclassified media instead of defaulting it public", () => {
  const projected = projectDocumentForExport(document({
    mediaItems: [
      { id: "explicit-safe", visibilityState: "INTERVIEWER_SAFE" },
      { id: "unclassified-private-photo", caption: "private family image" },
      { id: "advisor-photo", visibilityState: "ADVISOR_ONLY" },
    ],
  }), "INTERVIEWER_SAFE");
  assert.deepEqual(projected.mediaItems, [{ id: "explicit-safe", visibilityState: "INTERVIEWER_SAFE" }]);
});

test("[P0] interviewer-safe projection must not send advisor, question, or private metadata bodies to any renderer", () => {
  const projected = projectDocumentForExport(document({
    advisorReview: { comments: [{ body: "private advisor concern" }] },
    generatedQuestions: [{ body: "Explain private family history" }],
    metadata: { privateNarrative: "immigration and health context", updatedAt: NOW },
    documentPages: [{ text: "raw CV page" }],
    sourceBlocks: [{ text: "raw parsed block" }],
    extractionCandidates: [{ title: "raw candidate" }],
  }), "INTERVIEWER_SAFE");
  const serialized = stableStringify(projected);
  const secrets = [
    "private advisor concern",
    "Explain private family history",
    "immigration and health context",
    "raw CV page",
    "raw parsed block",
    "raw candidate",
  ];
  const leaked = secrets.filter((secret) => serialized.includes(secret));
  assert.deepEqual(leaked, [], `projected renderer input leaked: ${leaked.join(", ")}`);
});

const renderAuthority: MacProAuthorityPolicy = {
  approvedTemplateId: "timeline-2025-canonical",
  templateSha256: "1".repeat(64),
  rendererVersion: "mac-pro-local-fixture-413.1",
  rendererSha256: "2".repeat(64),
  fontManifestSha256: "3".repeat(64),
  assetManifestSha256: "4".repeat(64),
};

function renderCoordinator(clock: () => Date = () => new Date(NOW)) {
  return new LocalMacProRenderCoordinator({
    envelopeKeyId: "d1-413-turing-envelope-key",
    envelopeSecret: ENVELOPE_SECRET,
    workerSecret: WORKER_SECRET,
    authority: renderAuthority,
    leaseMs: 1_000,
    heartbeatTimeoutMs: 1_000,
    clock,
  });
}

function renderSubmission(
  source: TimelineDocument,
  overrides: Partial<MacProRenderSubmission> = {},
): MacProRenderSubmission {
  const sourceContentSha256 = overrides.sourceContentSha256 ?? canonicalDocumentHash(source);
  const sourceVersionId = overrides.sourceVersionId ?? "version_approved_413";
  return {
    jobId: "render_job_turing_413",
    idempotencyKey: "render-job-turing-413",
    artifactType: "TIMELINE_INTERVIEWER_SAFE_PNG",
    scope: "INTERVIEWER_SAFE",
    document: source,
    sourceVersionId,
    sourceContentSha256,
    approval: {
      decision: "APPROVED",
      sourceVersionId,
      sourceContentSha256,
      approvedAt: NOW,
    },
    authority: renderAuthority,
    requestedFormats: ["PNG"],
    ...overrides,
  };
}

test("renderer rejects stale approval version and hash bindings", () => {
  const source = document();
  const valid = renderSubmission(source);
  assert.throws(
    () => renderCoordinator().submit({ ...valid, approval: { ...valid.approval, sourceVersionId: "version_stale" } }),
    hasCode("RENDER_STALE_APPROVAL_VERSION"),
  );
  assert.throws(
    () => renderCoordinator().submit({ ...valid, approval: { ...valid.approval, sourceContentSha256: "f".repeat(64) } }),
    hasCode("RENDER_STALE_APPROVAL_HASH"),
  );
});

test("[P0] renderer must prove that the approved content hash belongs to the submitted document", () => {
  const approved = document({ title: "Approved document" });
  const approvedHash = canonicalDocumentHash(approved);
  const changed = document({
    title: "Materially changed after approval",
    events: [event({ title: "Unapproved private change" })],
  });
  const request = renderSubmission(changed, {
    sourceContentSha256: approvedHash,
    approval: {
      decision: "APPROVED",
      sourceVersionId: "version_approved_413",
      sourceContentSha256: approvedHash,
      approvedAt: NOW,
    },
  });
  assert.throws(() => renderCoordinator().submit(request), hasCode("RENDER_SOURCE_DOCUMENT_HASH_MISMATCH"));
});

test("[P0] renderer must reject a public artifact type paired with a private SOURCE scope", () => {
  const source = document({ events: eventSet() });
  const request = renderSubmission(source, { scope: "SOURCE" });
  assert.throws(() => renderCoordinator().submit(request), hasCode("RENDER_ARTIFACT_SCOPE_MISMATCH"));
});

test("[P1] renderer worker commands must be single-use", () => {
  const queue = renderCoordinator();
  queue.submit(renderSubmission(document()));
  queue.submit(renderSubmission(document({ id: "timeline_second" }), {
    jobId: "render_job_turing_413_second",
    idempotencyKey: "render-job-turing-413-second",
  }));
  const command = signWorkerCommand(WORKER_SECRET, "worker-turing", "CLAIM", "*", NOW);
  assert.ok(queue.claimNext(command));
  assert.throws(() => queue.claimNext(command), hasCode("RENDER_WORKER_COMMAND_REPLAYED"));
});

test("[P1] a worker cannot extend an expired lease without re-claiming the job", () => {
  let current = Date.parse(NOW);
  const clock = () => new Date(current);
  const queue = renderCoordinator(clock);
  queue.submit(renderSubmission(document()));
  const claim = signWorkerCommand(WORKER_SECRET, "worker-turing", "CLAIM", "*", clock().toISOString());
  const job = queue.claimNext(claim);
  assert.ok(job);
  current += 1_001;
  const heartbeat = signWorkerCommand(WORKER_SECRET, "worker-turing", "HEARTBEAT", job.jobId, clock().toISOString());
  assert.throws(() => queue.heartbeat(job.jobId, heartbeat), hasCode("RENDER_LEASE_EXPIRED"));
});

class ConflictRemote implements StagingRemoteTimelineClient {
  availability: StagingRemoteAvailability = { enabled: true, online: true, authenticated: true };
  current = document({ revision: 9, title: "Remote winner" });

  getAvailability() {
    return { ...this.availability };
  }

  async saveCheckpoint(_request: StagingCheckpointRequest): Promise<{ revision: number }> {
    throw new TimelineError("REVISION_CONFLICT", "synthetic conflict", 409);
  }

  async createVersion(_request: StagingVersionRequest): Promise<{ revision: number }> {
    throw new TimelineError("REVISION_CONFLICT", "synthetic conflict", 409);
  }

  async getCurrentDocument() {
    return structuredClone(this.current);
  }
}

test("hybrid conflict and auth failure preserve the local draft and pending operation", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new ConflictRemote();
  const coordinator = new StagingHybridSyncCoordinator(student.principalId, local, remote, "device-turing");
  await coordinator.saveLocal(document({ revision: 2, title: "Local unsynced" }));
  const conflict = await coordinator.flush("timeline_test");
  assert.equal(conflict.state, "CONFLICT");
  assert.equal((await coordinator.getLocalDraft("timeline_test"))?.document.title, "Local unsynced");
  assert.equal((await local.listOperations(student.principalId, "timeline_test")).length, 1);
  assert.equal((await local.listConflicts(student.principalId, "timeline_test")).length, 1);

  await assert.rejects(
    coordinator.resumeAfterAuthentication("principal_attacker", "timeline_test"),
    hasCode("LOCAL_DRAFT_PRINCIPAL_SWITCH_DENIED"),
  );
});

test("[P1] recovery packets must carry a checksum so corruption can be detected before import", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new ConflictRemote();
  remote.availability.enabled = false;
  const coordinator = new StagingHybridSyncCoordinator(student.principalId, local, remote, "device-turing");
  await coordinator.saveLocal(document({ title: "Recoverable local draft" }));
  const recovery = JSON.parse(await coordinator.exportRecoveryJson("timeline_test")) as {
    contentSha256?: string;
  };
  assert.match(recovery.contentSha256 ?? "", /^[a-f0-9]{64}$/);
});

const cleanScanner: MalwareScannerPort = {
  async scan() {
    return { status: "CLEAN", scanner: "turing", scannerVersion: "1" };
  },
};

function storageAuthorization(calls: PrivateStorageAuthorizationRequest[]): PrivateStorageAuthorizationPort {
  return {
    async authorize(request) {
      calls.push(structuredClone(request));
      const ownerMatches = request.resource.ownerPrincipalId === undefined
        || request.resource.ownerPrincipalId === request.actor.principalId;
      const programMatches = request.actor.programIds.includes(request.resource.programId);
      return {
        allowed: ownerMatches && programMatches,
        reasonCode: ownerMatches && programMatches ? "SYNTHETIC_ALLOW" : "SYNTHETIC_DENY",
      };
    },
  };
}

test("storage fails closed across owner/program boundaries and never logs capabilities or PII", async (t) => {
  const filesystem = await DisposableFilesystemS3Client.create();
  t.after(() => filesystem.dispose());
  const calls: PrivateStorageAuthorizationRequest[] = [];
  const audit = new InMemoryPrivateStorageAuditSink();
  const store = new StagingPrivateObjectStore({
    client: filesystem,
    malwareScanner: cleanScanner,
    authorization: storageAuthorization(calls),
    auditSink: audit,
    environment: "test",
    sleep: async () => undefined,
  });
  const piiActor = context("STUDENT", "student@example.com", {
    requestId: "request_Jane_Doe_private",
    programIds: ["program_internal_medicine"],
  });
  const bytes = new TextEncoder().encode("synthetic private narrative");
  const signed = await store.signUpload(piiActor, {
    documentId: "timeline_private",
    objectClass: "MEDIA",
    mimeType: "text/plain",
    byteSize: bytes.byteLength,
    sha256: sha256(bytes),
  });
  await filesystem.uploadSigned(signed.uploadUrl, bytes, signed.requiredHeaders);
  await store.confirmUpload(piiActor, signed.objectId, signed.uploadToken);

  const otherOwner = context("STUDENT", "principal_other", { programIds: ["program_internal_medicine"] });
  const otherProgram = context("STUDENT", piiActor.principalId, { programIds: ["program_surgery"] });
  await assert.rejects(store.signDownload(otherOwner, signed.objectId), hasCode("OBJECT_ACCESS_DENIED"));
  await assert.rejects(store.signDownload(otherProgram, signed.objectId), hasCode("OBJECT_ACCESS_DENIED"));
  await assert.rejects(store.signDownload(piiActor, "object_00000000-0000-4000-8000-000000000000"), hasCode("OBJECT_NOT_FOUND"));
  await assert.rejects(filesystem.headObject("../../escape"), (error: unknown) => error instanceof S3CompatibleClientError && error.code === "S3_KEY_INVALID");

  const grant = await store.signDownload(piiActor, signed.objectId);
  await filesystem.downloadSigned(grant.downloadUrl);
  await assert.rejects(filesystem.downloadSigned(grant.downloadUrl), (error: unknown) => error instanceof S3CompatibleClientError && error.code === "S3_GRANT_REPLAYED");
  const serializedAudit = JSON.stringify(audit.events);
  assert.doesNotMatch(serializedAudit, /student@example\.com|Jane_Doe|synthetic private narrative|staging-object\+fs:|upload.?token|storage.?key/i);
});

test("storage authorization outages fail closed without issuing an upload capability", async (t) => {
  const filesystem = await DisposableFilesystemS3Client.create();
  t.after(() => filesystem.dispose());
  const audit = new InMemoryPrivateStorageAuditSink();
  const authorization: PrivateStorageAuthorizationPort = {
    async authorize() {
      throw new Error("authorization-db-password=do-not-leak");
    },
  };
  const store = new StagingPrivateObjectStore({
    client: filesystem,
    malwareScanner: cleanScanner,
    authorization,
    auditSink: audit,
    environment: "test",
    sleep: async () => undefined,
  });
  await assert.rejects(store.signUpload(student, {
    documentId: "timeline_test",
    objectClass: "MEDIA",
    mimeType: "text/plain",
    byteSize: 4,
    sha256: sha256("test"),
  }), hasCode("OBJECT_AUTHORIZATION_UNAVAILABLE"));
  assert.equal(await filesystem.objectCount(), 0);
  assert.doesNotMatch(JSON.stringify(audit.events), /password|do-not-leak/i);
});

function artifact(bytes: Uint8Array, overrides: Partial<TimelineArtifact> = {}): TimelineArtifact {
  const primaryHash = sha256(bytes);
  const primaryFile = {
    role: "PRIMARY" as const,
    objectId: `object_${primaryHash.slice(0, 12)}`,
    filename: "mission-timeline.pdf",
    mimeType: "application/pdf",
    byteSize: bytes.byteLength,
    sha256: primaryHash,
    contentHash: primaryHash,
  };
  return {
    artifactId: "artifact_turing_413",
    artifactSchemaVersion: "d1-timeline-artifact-409.1",
    artifactType: "TIMELINE_PRINT_PDF",
    timelineDocumentId: "timeline_test",
    timelineVersionId: "version_approved_413",
    studentOwnerId: student.principalId,
    programId: "program_internal_medicine",
    createdByRole: "SYSTEM_LOCAL",
    createdAt: NOW,
    updatedAt: NOW,
    displayName: "Mission Timeline",
    description: "Synthetic fixture",
    documentCategory: "MISSION_TIMELINE",
    mimeType: "application/pdf",
    byteSize: bytes.byteLength,
    contentHash: sha256(stableStringify([{ role: "PRIMARY", sha256: primaryHash }])),
    exportScope: "PRINT",
    visibility: "INTERVIEWER_SAFE",
    approvalState: { sourceVersionId: "version_approved_413" },
    theme: "keynote",
    dimensions: null,
    pageCount: 1,
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
    retentionClass: "STUDENT_CONTROLLED_PRIVATE",
    fileVaultLinkageState: "PENDING",
    legacyVaultReference: null,
    v2VaultReference: null,
    synchronizationStatus: "ARTIFACT_READY",
    synchronizationHistory: [],
    idempotencyKey: "export-artifact-turing-413",
    ...overrides,
  };
}

function vaultInput(vault: LocalLegacyFileVaultContractFixture, faults: LegacyPublishInput["faults"] = undefined): LegacyPublishInput {
  const bytes = new TextEncoder().encode("%PDF-1.4\nsynthetic\n%%EOF\n");
  const value = artifact(bytes);
  return {
    artifact: value,
    primaryBytes: bytes,
    session: vault.issueSession(101, value.studentOwnerId),
    faults,
  };
}

test("FileVault partial failure remains queued, deduplicated, and recoverable", () => {
  const vault = new LocalLegacyFileVaultContractFixture({
    nonceSecret: FILEVAULT_SECRET,
    clock: () => new Date(NOW),
  });
  const input = vaultInput(vault, { failConfirmCount: 1 });
  const first = vault.publish(input);
  assert.equal(first.status, "CONFIRM_FAILED");
  const recovered = vault.reconcile({ ...input, faults: undefined });
  assert.equal(recovered.status, "LINKED");
  const replay = vault.publish(input);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.externalFileId, first.externalFileId);
  assert.equal(replay.externalVersionId, first.externalVersionId);
});

test("[P1] FileVault nonce validation must bind the configured issuer", () => {
  const vault = new LocalLegacyFileVaultContractFixture({
    nonceSecret: FILEVAULT_SECRET,
    nonceIssuer: "trusted-matrix-issuer",
    clock: () => new Date(NOW),
  });
  const input = vaultInput(vault);
  const payload = {
    issuer: "attacker-issuer",
    wpUserId: input.session.wpUserId,
    principalId: input.session.principalId,
    expiresAt: "2026-07-15T12:01:00.000Z",
  };
  const encoded = Buffer.from(stableStringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", FILEVAULT_SECRET).update(encoded).digest("hex");
  const forged = { ...input.session, nonce: `${encoded}.${signature}` };
  assert.throws(() => vault.publish({ ...input, session: forged }), hasCode("FILEVAULT_WORDPRESS_NONCE_INVALID"));
});

test("PostgreSQL unavailability is translated without leaking driver or credential details", async () => {
  const driverError = Object.assign(new Error("postgres password=do-not-leak host=private"), { code: "08006" });
  const unavailableClient: PostgresTransactionClient = {
    async query<Row = Record<string, unknown>>(): Promise<PostgresQueryResult<Row>> {
      throw driverError;
    },
    release() {},
  };
  const unavailablePool: PostgresPool = {
    async query<Row = Record<string, unknown>>(): Promise<PostgresQueryResult<Row>> {
      throw driverError;
    },
    async connect() {
      return unavailableClient;
    },
  };
  const repository = new PostgresTimelineRepository(unavailablePool);
  await assert.rejects(repository.initialize(), (error: unknown) => {
    assert.ok(error instanceof TimelineError);
    assert.equal(error.code, "PERSISTENCE_UNAVAILABLE");
    assert.equal(error.status, 503);
    assert.doesNotMatch(`${error.message} ${stableStringify(error.details)}`, /password|do-not-leak|private/i);
    return true;
  });
});
