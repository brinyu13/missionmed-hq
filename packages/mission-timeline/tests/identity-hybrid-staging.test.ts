import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import type { TimelineDocument } from "../src/contracts/types.js";
import { TimelineError } from "../src/core/errors.js";
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

const SECRET = "d1-413-staging-session-secret-0123456789abcdef";
const ISSUER = "https://matrix.missionmed.test";
const AUDIENCE = "mission-timeline-staging";

function timeline(owner = "principal_student", overrides: Partial<TimelineDocument> = {}): TimelineDocument {
  return {
    id: "timeline_staging",
    schemaVersion: "d1-timeline-document-409.1",
    studentOwnerId: owner,
    programId: "program_internal_medicine",
    title: "Private local draft",
    theme: "keynote-classic",
    revision: 0,
    events: [],
    ...structuredClone(overrides),
  };
}

class FakeMatrixAuthority implements MatrixSessionAuthority {
  activeSessions = new Set(["matrix-session-1", "matrix-session-2", "matrix-session-3"]);

  async verifyProof(proof: MatrixSessionProof) {
    return {
      valid: proof.nonce.startsWith("valid-nonce"),
      proofId: `${proof.wpUserId}:${proof.sessionId}:${proof.nonce}`,
      wpUserId: proof.wpUserId,
      sessionId: proof.sessionId,
    };
  }

  async isSessionActive(session: { wpUserId: number; sessionId: string }) {
    return session.wpUserId === 42 && this.activeSessions.has(session.sessionId);
  }
}

function principal(membershipVersion = 1, overrides = {}) {
  return {
    principalId: "principal_student",
    wpUserId: 42,
    role: "STUDENT" as const,
    programIds: ["program_internal_medicine"],
    assignedDocumentIds: [],
    active: true,
    membershipVersion,
    ...overrides,
  };
}

function rewriteSignedToken(token: string, patch: Record<string, unknown>): string {
  const [header, payload] = token.split(".");
  assert.ok(header && payload);
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  const changedPayload = Buffer.from(JSON.stringify({ ...claims, ...patch })).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(`${header}.${changedPayload}`).digest("base64url");
  return `${header}.${changedPayload}.${signature}`;
}

function errorWithCode(code: string) {
  return (error: unknown) => error instanceof TimelineError && error.code === code;
}

test("staging identity exchanges a Matrix-owned proof without a second login and emits minimal claims", async () => {
  const directory = new InMemoryStagingPrincipalDirectory();
  directory.register(principal());
  const matrix = new FakeMatrixAuthority();
  const clock = () => new Date("2026-07-15T12:00:00.000Z");
  const exchange = new StagingMatrixSessionExchange(directory, matrix, {
    issuer: ISSUER,
    audience: AUDIENCE,
    signingSecret: SECRET,
    ttlSeconds: 300,
    clock,
  });
  const session = await exchange.exchange({ wpUserId: 42, sessionId: "matrix-session-1", nonce: "valid-nonce-1" });
  const context = await exchange.verify(session.token, { requestId: "request-1" });
  assert.equal(context.principalId, "principal_student");
  assert.equal(context.role, "STUDENT");
  assert.deepEqual(context.programIds, ["program_internal_medicine"]);
  assert.equal(session.expiresAt, "2026-07-15T12:05:00.000Z");

  const payload = JSON.parse(Buffer.from(session.token.split(".")[1]!, "base64url").toString("utf8"));
  assert.deepEqual(Object.keys(payload).sort(), ["aud", "exp", "iat", "iss", "jti", "mv", "programs", "role", "sid", "sub", "wpuid"]);
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("email"), false);
  assert.equal(serialized.includes("Private local draft"), false);
  assert.equal(serialized.includes(SECRET), false);
});

test("identity fails closed for bad Matrix nonce/session and immutable WordPress mappings", async () => {
  const directory = new InMemoryStagingPrincipalDirectory();
  directory.register(principal());
  assert.throws(
    () => directory.register(principal(2, { principalId: "principal_attacker" })),
    errorWithCode("WP_USER_MAPPING_IMMUTABLE"),
  );
  assert.throws(
    () => directory.register(principal(2, { wpUserId: 99 })),
    errorWithCode("PRINCIPAL_MAPPING_IMMUTABLE"),
  );
  const matrix = new FakeMatrixAuthority();
  const exchange = new StagingMatrixSessionExchange(directory, matrix, {
    issuer: ISSUER,
    audience: AUDIENCE,
    signingSecret: SECRET,
  });
  await assert.rejects(
    exchange.exchange({ wpUserId: 42, sessionId: "matrix-session-1", nonce: "attacker-nonce" }),
    errorWithCode("MATRIX_SESSION_PROOF_INVALID"),
  );
  await assert.rejects(
    exchange.exchange({ wpUserId: 42, sessionId: "revoked-session", nonce: "valid-nonce-revoked" }),
    errorWithCode("MATRIX_SESSION_REVOKED"),
  );
});

test("identity rejects tampering, signed wrong issuer/audience, future issue time, and expiration", async () => {
  const directory = new InMemoryStagingPrincipalDirectory();
  directory.register(principal());
  const matrix = new FakeMatrixAuthority();
  let current = new Date("2026-07-15T12:00:00.000Z");
  const exchange = new StagingMatrixSessionExchange(directory, matrix, {
    issuer: ISSUER,
    audience: AUDIENCE,
    signingSecret: SECRET,
    ttlSeconds: 60,
    clock: () => current,
  });
  const { token } = await exchange.exchange({ wpUserId: 42, sessionId: "matrix-session-1", nonce: "valid-nonce-security" });
  await assert.rejects(exchange.verify(`${token}x`, { requestId: "tamper" }), errorWithCode("SESSION_TOKEN_INVALID"));
  await assert.rejects(
    exchange.verify(rewriteSignedToken(token, { iss: "https://attacker.invalid" }), { requestId: "issuer" }),
    errorWithCode("SESSION_ISSUER_INVALID"),
  );
  await assert.rejects(
    exchange.verify(rewriteSignedToken(token, { aud: "another-service" }), { requestId: "audience" }),
    errorWithCode("SESSION_AUDIENCE_INVALID"),
  );
  await assert.rejects(
    exchange.verify(rewriteSignedToken(token, { iat: 1_900_000_000 }), { requestId: "future" }),
    errorWithCode("SESSION_ISSUED_AT_INVALID"),
  );
  current = new Date("2026-07-15T12:01:01.000Z");
  await assert.rejects(exchange.verify(token, { requestId: "expired" }), (error: unknown) => {
    assert.equal(errorWithCode("SESSION_TOKEN_EXPIRED")(error), true);
    assert.equal((error as TimelineError).details.preserveLocalDraft, true);
    assert.equal((error as TimelineError).details.recoveryAction, "REAUTHENTICATE_WITH_MATRIX");
    return true;
  });
});

test("identity rechecks current role, program, membership version, active principal, and Matrix session", async () => {
  const directory = new InMemoryStagingPrincipalDirectory();
  directory.register(principal());
  const matrix = new FakeMatrixAuthority();
  const exchange = new StagingMatrixSessionExchange(directory, matrix, {
    issuer: ISSUER,
    audience: AUDIENCE,
    signingSecret: SECRET,
  });
  const first = await exchange.exchange({ wpUserId: 42, sessionId: "matrix-session-1", nonce: "valid-nonce-membership-1" });
  await assert.rejects(
    exchange.verify(rewriteSignedToken(first.token, { role: "PROGRAM_ADMIN" }), { requestId: "forged-role" }),
    errorWithCode("SESSION_PRINCIPAL_CLAIMS_STALE"),
  );
  await assert.rejects(
    exchange.verify(rewriteSignedToken(first.token, { programs: ["program_attacker"] }), { requestId: "forged-program" }),
    errorWithCode("SESSION_PRINCIPAL_CLAIMS_STALE"),
  );
  await assert.rejects(
    exchange.verify(rewriteSignedToken(first.token, { sub: "principal_attacker" }), { requestId: "forged-owner" }),
    errorWithCode("PRINCIPAL_NOT_ACTIVE"),
  );

  directory.register(principal(2, { assignedDocumentIds: ["timeline_new_assignment"] }));
  await assert.rejects(exchange.verify(first.token, { requestId: "membership-drift" }), errorWithCode("SESSION_MEMBERSHIP_STALE"));
  const second = await exchange.exchange({ wpUserId: 42, sessionId: "matrix-session-2", nonce: "valid-nonce-membership-2" });
  directory.register(principal(3, { active: false }));
  await assert.rejects(exchange.verify(second.token, { requestId: "disabled" }), errorWithCode("PRINCIPAL_NOT_ACTIVE"));
  directory.deletePrincipal("principal_student");
  await assert.rejects(exchange.verify(second.token, { requestId: "deleted" }), errorWithCode("PRINCIPAL_NOT_ACTIVE"));
});

test("identity rejects reused Matrix proofs, optional single-use replay, and revoked live sessions", async () => {
  const directory = new InMemoryStagingPrincipalDirectory();
  directory.register(principal());
  const matrix = new FakeMatrixAuthority();
  const exchange = new StagingMatrixSessionExchange(directory, matrix, {
    issuer: ISSUER,
    audience: AUDIENCE,
    signingSecret: SECRET,
  });
  const proof = { wpUserId: 42, sessionId: "matrix-session-1", nonce: "valid-nonce-replay" };
  const { token } = await exchange.exchange(proof);
  await assert.rejects(exchange.exchange(proof), errorWithCode("MATRIX_SESSION_PROOF_REPLAYED"));
  await exchange.verify(token, { requestId: "request-a", replayKey: "delete-document-1" });
  await assert.rejects(
    exchange.verify(token, { requestId: "request-b", replayKey: "delete-document-1" }),
    errorWithCode("SESSION_REQUEST_REPLAYED"),
  );
  await exchange.verify(token, { requestId: "normal-repeat-1" });
  await exchange.verify(token, { requestId: "normal-repeat-2" });
  matrix.activeSessions.delete("matrix-session-1");
  await assert.rejects(exchange.verify(token, { requestId: "revoked" }), errorWithCode("MATRIX_SESSION_REVOKED"));
});

class FakeRemote implements StagingRemoteTimelineClient {
  availability: StagingRemoteAvailability = { enabled: true, online: true, authenticated: true };
  checkpoints: StagingCheckpointRequest[] = [];
  versions: StagingVersionRequest[] = [];
  current = timeline("principal_student", { revision: 0, title: "Cloud copy" });
  failures: unknown[] = [];
  delay: Promise<void> | null = null;

  getAvailability() {
    return { ...this.availability };
  }

  async saveCheckpoint(request: StagingCheckpointRequest) {
    this.checkpoints.push(structuredClone(request));
    if (this.delay) await this.delay;
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.current = structuredClone(request.document);
    this.current.revision = request.baseRevision;
    return { revision: request.baseRevision };
  }

  async createVersion(request: StagingVersionRequest) {
    this.versions.push(structuredClone(request));
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.current = structuredClone(request.document);
    this.current.revision = request.baseRevision + 1;
    return { revision: request.baseRevision + 1 };
  }

  async getCurrentDocument(principalId: string, documentId: string) {
    assert.equal(principalId, this.current.studentOwnerId);
    assert.equal(documentId, this.current.id);
    return structuredClone(this.current);
  }
}

test("hybrid writes locally first, coalesces checkpoints, retries idempotently, and serializes concurrent flushes", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new FakeRemote();
  const states: string[] = [];
  const coordinator = new StagingHybridSyncCoordinator("principal_student", local, remote, "device-413", {
    clock: () => new Date("2026-07-15T12:00:00.000Z"),
    onStatus: (status) => states.push(status.state),
  });
  await coordinator.saveLocal(timeline("principal_student", { title: "First local" }));
  await coordinator.saveLocal(timeline("principal_student", { title: "Second local" }));
  await coordinator.saveLocal(timeline("principal_student", { title: "Final local" }));
  assert.equal((await coordinator.getLocalDraft("timeline_staging"))?.document.title, "Final local");
  assert.equal(remote.checkpoints.length, 0);

  remote.failures.push(new TimelineError("REMOTE_UNAVAILABLE", "temporary", 503));
  const [first, second] = await Promise.all([coordinator.flush("timeline_staging"), coordinator.flush("timeline_staging")]);
  assert.equal(first.state, "CLOUD_SYNCED");
  assert.deepEqual(second, first);
  assert.equal(remote.checkpoints.length, 2);
  assert.equal(remote.checkpoints[0]?.document.title, "Final local");
  assert.equal(remote.checkpoints[0]?.idempotencyKey, remote.checkpoints[1]?.idempotencyKey);
  assert.equal((await local.listOperations("principal_student", "timeline_staging")).length, 0);
  assert.deepEqual([...new Set(states)].sort(), ["CLOUD_SYNCED", "LOCAL_SAVED", "SYNC_PENDING"]);
});

test("hybrid preserves version boundaries while coalescing checkpoint bursts", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new FakeRemote();
  const coordinator = new StagingHybridSyncCoordinator("principal_student", local, remote, "device-413");
  await coordinator.saveLocal(timeline("principal_student", { title: "Checkpoint A" }));
  await coordinator.saveLocal(timeline("principal_student", { title: "Checkpoint B" }));
  await coordinator.saveVersion(timeline("principal_student", { title: "Named state" }), "Advisor review");
  await coordinator.saveLocal(timeline("principal_student", { title: "Checkpoint C" }));
  await coordinator.saveLocal(timeline("principal_student", { title: "Checkpoint D" }));
  const result = await coordinator.flush("timeline_staging");
  assert.equal(result.state, "CLOUD_SYNCED");
  assert.deepEqual(remote.checkpoints.map((request) => request.document.title), ["Checkpoint B", "Checkpoint D"]);
  assert.deepEqual(remote.versions.map((request) => request.document.title), ["Named state"]);
  assert.equal(remote.versions[0]?.label, "Advisor review");
});

test("hybrid exposes disabled, offline, and auth-required states while preserving and resuming the local draft", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new FakeRemote();
  remote.availability = { enabled: false, online: true, authenticated: true };
  const states: string[] = [];
  const coordinator = new StagingHybridSyncCoordinator("principal_student", local, remote, "device-413", {
    onStatus: (status) => states.push(status.state),
  });
  const saved = await coordinator.saveLocal(timeline());
  assert.equal(saved.state, "LOCAL_SAVED");
  assert.equal(saved.reason, "REMOTE_DISABLED");
  assert.ok(await coordinator.getLocalDraft("timeline_staging"));
  assert.equal((await local.listOperations("principal_student", "timeline_staging")).length, 1);

  remote.availability = { enabled: true, online: false, authenticated: true };
  assert.equal((await coordinator.flush("timeline_staging")).state, "OFFLINE");
  remote.availability = { enabled: true, online: true, authenticated: false };
  const auth = await coordinator.flush("timeline_staging");
  assert.equal(auth.state, "AUTH_REQUIRED");
  assert.equal(auth.preserveLocalDraft, true);
  remote.availability.authenticated = true;
  assert.equal((await coordinator.resumeAfterAuthentication("principal_student", "timeline_staging")).state, "CLOUD_SYNCED");
  assert.deepEqual([...new Set(states)].sort(), ["AUTH_REQUIRED", "CLOUD_SYNCED", "LOCAL_SAVED", "OFFLINE", "SYNC_PENDING"]);
});

test("hybrid handles mid-flight auth expiry and resumes with the same idempotency key", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new FakeRemote();
  remote.failures.push(new TimelineError("SESSION_TOKEN_EXPIRED", "expired", 401));
  const coordinator = new StagingHybridSyncCoordinator("principal_student", local, remote, "device-413");
  await coordinator.saveLocal(timeline());
  const auth = await coordinator.flush("timeline_staging");
  assert.equal(auth.state, "AUTH_REQUIRED");
  assert.equal((await local.listOperations("principal_student", "timeline_staging")).length, 1);
  const firstKey = remote.checkpoints[0]?.idempotencyKey;
  const resumed = await coordinator.resumeAfterAuthentication("principal_student", "timeline_staging");
  assert.equal(resumed.state, "CLOUD_SYNCED");
  assert.equal(remote.checkpoints[1]?.idempotencyKey, firstKey);
});

test("hybrid records both local and remote snapshots on conflict and exports recovery JSON without merging", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new FakeRemote();
  remote.current = timeline("principal_student", { revision: 7, title: "Cloud winner" });
  remote.failures.push(new TimelineError("REVISION_CONFLICT", "conflict", 409, { currentRevision: 7 }));
  const coordinator = new StagingHybridSyncCoordinator("principal_student", local, remote, "device-413", {
    clock: () => new Date("2026-07-15T12:00:00.000Z"),
  });
  await coordinator.saveLocal(timeline("principal_student", { revision: 3, title: "Local unsynced" }));
  const result = await coordinator.flush("timeline_staging");
  assert.equal(result.state, "CONFLICT");
  const conflicts = await local.listConflicts("principal_student", "timeline_staging");
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]?.localDocument.title, "Local unsynced");
  assert.equal(conflicts[0]?.remoteDocument.title, "Cloud winner");
  assert.notEqual(conflicts[0]?.localSha256, conflicts[0]?.remoteSha256);
  assert.equal((await coordinator.getLocalDraft("timeline_staging"))?.document.title, "Local unsynced");
  const recovery = JSON.parse(await coordinator.exportRecoveryJson("timeline_staging"));
  assert.equal(recovery.schemaVersion, "d1-timeline-hybrid-recovery-413.1");
  assert.equal(recovery.conflicts[0].resolution, "UNRESOLVED");
  assert.equal(recovery.conflicts[0].localDocument.title, "Local unsynced");
  assert.equal(recovery.conflicts[0].remoteDocument.title, "Cloud winner");
  const calls = remote.checkpoints.length;
  assert.equal((await coordinator.flush("timeline_staging")).state, "CONFLICT");
  assert.equal(remote.checkpoints.length, calls);
});

test("hybrid prevents forged ownership and cross-principal local-draft adoption", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new FakeRemote();
  const student = new StagingHybridSyncCoordinator("principal_student", local, remote, "device-student");
  const other = new StagingHybridSyncCoordinator("principal_other", local, remote, "device-other");
  await student.saveLocal(timeline());
  assert.equal(await other.getLocalDraft("timeline_staging"), null);
  await assert.rejects(other.saveLocal(timeline()), errorWithCode("LOCAL_DRAFT_OWNER_MISMATCH"));
  await assert.rejects(
    student.resumeAfterAuthentication("principal_other", "timeline_staging"),
    errorWithCode("LOCAL_DRAFT_PRINCIPAL_SWITCH_DENIED"),
  );
  assert.equal((await student.getLocalDraft("timeline_staging"))?.principalId, "principal_student");
});

test("hybrid reports terminal errors without deleting the recoverable queue", async () => {
  const local = new InMemoryStagingLocalDraftStore();
  const remote = new FakeRemote();
  remote.failures.push(new TimelineError("VALIDATION_REJECTED", "bad remote request", 400));
  const coordinator = new StagingHybridSyncCoordinator("principal_student", local, remote, "device-413");
  await coordinator.saveLocal(timeline());
  const result = await coordinator.flush("timeline_staging");
  assert.equal(result.state, "ERROR");
  assert.equal(result.errorCode, "VALIDATION_REJECTED");
  assert.equal(result.preserveLocalDraft, true);
  assert.equal((await local.listOperations("principal_student", "timeline_staging")).length, 1);
  assert.ok(JSON.parse(await coordinator.exportRecoveryJson("timeline_staging")).draft);
});
