import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { StaticEntitlementTestAdapter, MetadataOnlyEventBuffer } from '../../lor-studio/adapters/test-adapters.js';
import { InvitationDeniedError } from '../../lor-studio/domain/errors.js';
import { createWaiverReceipt } from '../../lor-studio/domain/receipts.js';
import {
  BUILDER_STEPS,
  appendReceipt,
  autosaveBuilderStep,
  bindFacultyInvitation,
  bindVerifiedFaculty,
  completeBuilderStep,
  createRecommendationCase,
  releaseFinalDocument,
  setFacultyPrivateContent,
  transitionRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import { createLorApplicationAdapter } from '../../lor-studio/http/application-adapter.mjs';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
import { createMetadataServiceEvent } from '../../lor-studio/services/metadata-events.js';
import { RecommendationCaseService } from '../../lor-studio/services/recommendation-case-service.js';

function eligible(studentId) {
  return {
    studentId,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
  };
}

// The waiver supersession chain requires each decision to be recorded strictly later than the
// one it replaces, so receipt tests cannot run against a frozen clock. Every clock read advances
// one minute, which is what a real deployment's wall clock does between two student decisions.
function monotonicClock(startIso = '2026-08-09T16:00:00.000Z', stepMs = 60_000) {
  let tick = 0;
  return () => new Date(Date.parse(startIso) + (tick++) * stepMs);
}

function harness({ clock = () => new Date('2026-08-09T16:00:00.000Z') } = {}) {
  const repository = new InMemoryRecommendationCaseRepository();
  const entitlementPort = new StaticEntitlementTestAdapter([eligible('student-1'), eligible('student-2')]);
  const eventSink = new MetadataOnlyEventBuffer();
  let caseSequence = 0;
  const service = new RecommendationCaseService({
    repository,
    entitlementPort,
    eventSink,
    requireCanary: true,
    clock,
    caseIdFactory: () => `case-${++caseSequence}`,
    protectedIdFactory: () => 'builder-server-generated',
  });
  const adapter = createLorApplicationAdapter({
    caseService: service,
    repository,
    allowNonDurableForTests: true,
  });
  return { adapter, eventSink, repository, service };
}

function request(method, body = null, headers = {}) {
  const stream = Readable.from(body === null ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.headers = {
    ...(body === null ? {} : { 'content-type': 'application/json' }),
    ...headers,
  };
  return stream;
}

async function call(adapter, pathname, { method = 'GET', body = null, actor = { id: 'student-1', role: 'student' }, key = '' } = {}) {
  const headers = key ? { 'idempotency-key': key } : {};
  return adapter.handleRequest({
    request: request(method, body, headers),
    url: new URL(pathname, 'https://hq.example.test'),
    actor,
  });
}

test('application adapter refuses non-durable persistence without an explicit test harness', () => {
  const repository = new InMemoryRecommendationCaseRepository();
  assert.throws(
    () => createLorApplicationAdapter({ caseService: {}, repository }),
    /explicit test harness/u,
  );
});

test('durable composition cannot inject a shape-only artifact service around audit custody', () => {
  assert.throws(
    () => createLorApplicationAdapter({
      caseService: {},
      repository: { isDurable: true },
      artifactService: { async exportFinalDocumentArtifact() {} },
    }),
    /constructs its audited artifact service internally/u,
  );
});

test('in-memory application bootstrap is truthful and cannot enter live mode', async () => {
  const { adapter } = harness();
  assert.deepEqual(await adapter.getBootstrap(), {
    operational: false,
    runtimeMode: 'unavailable',
    storageMode: 'NON_DURABLE_TEST_ONLY',
    providersReady: false,
    capabilities: {
      builder: true,
      autosave: true,
      resume: true,
      versionHistory: true,
      studentEvidencePublication: false,
      durableStorage: false,
      fullAcceptedFunctionSet: false,
    },
  });
});

test('student case creation, autosave, completion, and resume work end to end with safe projections', async () => {
  const { adapter, eventSink } = harness();
  const created = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: {},
    key: 'create-case-1',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.case.caseId, 'case-1');
  assert.equal('facultyPrivate' in created.body.case, false);

  const saved = await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: {
      expectedRevision: 0,
      stepId: 'case_basics',
      stepData: { specialty: 'Internal Medicine' },
    },
    key: 'save-case-1-step-1',
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.case.revision, 1);
  assert.equal('facultyPrivate' in saved.body.case, false);

  const completed = await call(adapter, '/api/lor-studio/cases/case-1/builder/complete', {
    method: 'POST',
    body: { expectedRevision: 1, stepId: 'case_basics' },
    key: 'complete-case-1-step-1',
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.case.revision, 2);

  const resumed = await call(adapter, '/api/lor-studio/cases/case-1/builder');
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.progress.completedSteps, 1);
  assert.equal(resumed.body.progress.nextStepId, 'writer_relationship');
  assert.equal('facultyPrivate' in resumed.body.projection, false);
  assert.equal(eventSink.snapshot().length, 3);
});

test('student evidence publication is reachable only through the narrow database-owned command', async () => {
  const calls = [];
  const projectionReads = [];
  const repository = new InMemoryRecommendationCaseRepository();
  const safeProjection = Object.freeze({
    schemaVersion: 'missionmed.lor.student-projection.v1',
    caseId: 'case-1',
    revision: 8,
  });
  const commandAggregate = Object.freeze({
    schemaVersion: 'missionmed.lor.student-safe-case.v1',
    id: 'case-1',
    studentId: 'wp:41',
    revision: 8,
  });
  const adapter = createLorApplicationAdapter({
    caseService: {
      async publishStudentEvidence(input) {
        calls.push(structuredClone(input));
        return commandAggregate;
      },
      async getCaseProjection(input) {
        projectionReads.push(structuredClone(input));
        return safeProjection;
      },
    },
    repository,
    allowNonDurableForTests: true,
  });
  const actor = { id: 'wp:41', role: 'student' };
  const published = await call(adapter, '/api/lor-studio/cases/case-1/evidence/publish', {
    method: 'POST',
    actor,
    key: 'publish-evidence-1',
    body: { expectedRevision: 7 },
  });
  assert.deepEqual(published, { status: 200, body: { case: safeProjection } });
  assert.equal('studentId' in published.body.case, false);
  assert.deepEqual(calls, [{
    caseId: 'case-1',
    actor,
    expectedRevision: 7,
    idempotencyKey: 'publish-evidence-1',
  }]);
  assert.deepEqual(projectionReads, [{ caseId: 'case-1', actor }]);

  const forged = await call(adapter, '/api/lor-studio/cases/case-1/evidence/publish', {
    method: 'POST',
    actor,
    key: 'publish-evidence-forged',
    body: { expectedRevision: 7, evidence: [{ text: 'caller controlled' }] },
  });
  assert.equal(forged.status, 400);
  assert.equal(calls.length, 1);
  assert.equal(projectionReads.length, 1);

  const wrongMethod = await call(adapter, '/api/lor-studio/cases/case-1/evidence/publish', {
    method: 'GET',
    actor,
  });
  assert.deepEqual(wrongMethod, { status: 405, body: { error: 'method_not_allowed' } });
});

test('stale writes, idempotency conflicts, IDOR attempts, and unknown fields are safe', async () => {
  const { adapter } = harness();
  await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: {},
    key: 'create-case-1',
  });
  await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: { expectedRevision: 0, stepId: 'case_basics', stepData: { specialty: 'IM' } },
    key: 'save-1',
  });

  const stale = await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: { expectedRevision: 0, stepId: 'case_basics', stepData: { specialty: 'FM' } },
    key: 'save-2',
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'stale_revision');
  assert.doesNotMatch(JSON.stringify(stale), /case-1|student-1/u);

  const clientSelectedCase = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: { caseId: 'different-case' },
    key: 'create-case-1',
  });
  assert.equal(clientSelectedCase.status, 400);
  assert.equal(clientSelectedCase.body.error, 'validation_failed');

  const denied = await call(adapter, '/api/lor-studio/cases/case-1', {
    actor: { id: 'student-2', role: 'student' },
  });
  const missing = await call(adapter, '/api/lor-studio/cases/does-not-exist');
  assert.equal(denied.status, 404);
  assert.equal(denied.body.error, 'not_found');
  assert.deepEqual(denied.body, missing.body, 'foreign and missing cases must be externally indistinguishable');
  for (const actor of [
    { id: 'faculty-unbound', role: 'faculty' },
    { id: 'mentor-unassigned', role: 'mentor' },
    { id: 'service-ungranted', role: 'service' },
  ]) {
    const actorDenied = await call(adapter, '/api/lor-studio/cases/case-1', { actor });
    assert.equal(actorDenied.status, 404);
    assert.deepEqual(actorDenied.body, missing.body, `${actor.role} denial must not reveal case existence`);
  }

  const unknown = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: { caseId: 'case-3', role: 'admin' },
    key: 'create-case-3',
  });
  assert.equal(unknown.status, 400);
  assert.equal(unknown.body.error, 'validation_failed');
});

test('same-resource idempotent retry replays and conflicting payload fails without raw key leakage', async () => {
  const { adapter } = harness();
  const first = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: {},
    key: 'safe-retry-key',
  });
  const replay = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: {},
    key: 'safe-retry-key',
  });
  assert.equal(first.status, 201);
  assert.equal(replay.status, 201);
  assert.equal(replay.body.case.caseId, first.body.case.caseId);
  assert.equal(replay.body.case.revision, 0);

  const conflict = await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: { expectedRevision: 0, stepId: 'case_basics', stepData: { specialty: 'IM' } },
    key: 'builder-retry-key',
  });
  assert.equal(conflict.status, 200);
  const changedRetry = await call(adapter, '/api/lor-studio/cases/case-1/builder', {
    method: 'PATCH',
    body: { expectedRevision: 0, stepId: 'case_basics', stepData: { specialty: 'FM' } },
    key: 'builder-retry-key',
  });
  assert.equal(changedRetry.status, 409);
  assert.equal(changedRetry.body.error, 'idempotency_conflict');
  assert.doesNotMatch(JSON.stringify(changedRetry), /builder-retry-key/u);
});

function invitationDeniedHarness(error) {
  const repository = new InMemoryRecommendationCaseRepository();
  const reject = async () => {
    throw error;
  };
  const adapter = createLorApplicationAdapter({
    caseService: {
      createCase: reject,
      getCaseProjection: reject,
      resumeBuilder: reject,
      autosaveBuilder: reject,
      completeBuilderStep: reject,
      recordReceipt: reject,
      releaseFinalDocument: reject,
    },
    repository,
    allowNonDurableForTests: true,
  });
  return { adapter, repository };
}

test('faculty invitation denials are opaque and never expose the denial reason to the client', async () => {
  const reasons = [
    'TOKEN_MISMATCH',
    'RECIPIENT_MISMATCH',
    'OTP_NOT_VERIFIED',
    'INVITATION_EXPIRED',
    'INVITATION_LOCKED',
  ];
  const serialized = new Set();
  for (const reason of reasons) {
    const error = new InvitationDeniedError(reason);
    assert.deepEqual(
      error.details,
      { reasonCode: reason },
      'the denial reason must remain on the error for server-side audit and telemetry',
    );
    const { adapter } = invitationDeniedHarness(error);
    const denied = await call(adapter, '/api/lor-studio/cases/case-1/builder', {
      actor: { id: 'faculty-1', role: 'faculty' },
    });
    const deniedReceipt = await call(adapter, '/api/lor-studio/cases/case-1/receipts', {
      method: 'POST',
      body: {
        expectedRevision: 0,
        receiptType: 'waiver',
        receiptData: {
          waived: true,
          policyVersion: 'dr-019-v1',
          acknowledgment: 'I knowingly waive access.',
        },
      },
      key: `receipt-${reason}`,
      actor: { id: 'faculty-1', role: 'faculty' },
    });
    const deniedRelease = await call(adapter, '/api/lor-studio/cases/case-1/final-document/release', {
      method: 'POST',
      body: { expectedRevision: 0, documentId: 'document-1' },
      key: `release-${reason}`,
      actor: { id: 'faculty-1', role: 'faculty' },
    });
    for (const response of [denied, deniedReceipt, deniedRelease]) {
      assert.equal(response.status, 403);
      assert.equal(response.body.error, 'invitation_denied');
      assert.equal(response.body.message, 'Faculty invitation verification was denied.');
      assert.deepEqual(Object.keys(response.body).sort(), ['error', 'message']);
      assert.equal('reasonCode' in response.body, false);
      assert.doesNotMatch(JSON.stringify(response), new RegExp(reason, 'u'));
      serialized.add(JSON.stringify(response));
    }
  }
  assert.equal(
    serialized.size,
    1,
    'every invitation denial reason must be externally indistinguishable',
  );
});

test('faculty invitation issue, OTP resend, and revoke routes accept only their narrow client contracts', async () => {
  const calls = [];
  const repository = new InMemoryRecommendationCaseRepository();
  const projection = Object.freeze({
    schemaVersion: 'missionmed.lor.student-projection.v1',
    caseId: 'case-1',
    revision: 9,
    status: 'faculty_invited',
  });
  const adapter = createLorApplicationAdapter({
    caseService: {
      async getCaseProjection(input) {
        calls.push(['projection', structuredClone(input)]);
        return projection;
      },
    },
    repository,
    facultyInvitationLifecycleService: {
      async issue(input) {
        calls.push(['issue', structuredClone(input)]);
        return { schemaVersion: 'missionmed.lor.faculty-invitation-lifecycle-result.v1', action: 'issued' };
      },
      async resendOtp(input) {
        calls.push(['resend', structuredClone(input)]);
        return { schemaVersion: 'missionmed.lor.faculty-invitation-lifecycle-result.v1', action: 'otp_resent' };
      },
      async revoke(input) {
        calls.push(['revoke', structuredClone(input)]);
        return { schemaVersion: 'missionmed.lor.faculty-invitation-lifecycle-result.v1', action: 'revoked' };
      },
    },
    allowNonDurableForTests: true,
  });
  const actor = { id: 'wp:41', role: 'student' };
  const issued = await call(adapter, '/api/lor-studio/cases/case-1/faculty-invitations', {
    method: 'POST', actor, key: 'issue-1',
    body: { expectedRevision: 8, recipientEmail: 'writer@example.test' },
  });
  const resent = await call(adapter, '/api/lor-studio/cases/case-1/faculty-invitations/otp/resend', {
    method: 'POST', actor, key: 'resend-1',
    body: { recipientEmail: 'writer@example.test' },
  });
  const revoked = await call(adapter, '/api/lor-studio/cases/case-1/faculty-invitations/revoke', {
    method: 'POST', actor, key: 'revoke-1', body: {},
  });
  assert.equal(issued.status, 201);
  assert.equal(resent.status, 200);
  assert.equal(revoked.status, 200);
  const actionCalls = calls.filter(([name]) => name !== 'projection');
  assert.deepEqual(actionCalls, [
    ['issue', {
      actor, caseId: 'case-1', expectedRevision: 8,
      recipientEmail: 'writer@example.test', idempotencyKey: 'issue-1',
    }],
    ['resend', {
      actor, caseId: 'case-1', recipientEmail: 'writer@example.test', idempotencyKey: 'resend-1',
    }],
    ['revoke', { actor, caseId: 'case-1', idempotencyKey: 'revoke-1' }],
  ]);
  for (const [, actionInput] of actionCalls) assert.equal('invitationId' in actionInput, false);

  const forbidden = await call(adapter, '/api/lor-studio/cases/case-1/faculty-invitations', {
    method: 'POST', actor, key: 'issue-forged',
    body: {
      expectedRevision: 8,
      recipientEmail: 'writer@example.test',
      invitationId: 'attacker-selected',
    },
  });
  assert.equal(forbidden.status, 400);
  assert.equal(forbidden.body.error, 'validation_failed');
});

test('faculty invitation routes fail closed when the lifecycle service is absent', async () => {
  const { adapter } = harness();
  const response = await call(adapter, '/api/lor-studio/cases/case-1/faculty-invitations', {
    method: 'POST',
    actor: { id: 'student-1', role: 'student' },
    key: 'issue-disabled',
    body: { expectedRevision: 8, recipientEmail: 'writer@example.test' },
  });
  assert.equal(response.status, 503);
  assert.equal(response.body.error, 'integration_disabled');
});

test('faculty candidate verification is path-bound, exact, and returns only the safe DB result', async () => {
  const calls = [];
  const repository = new InMemoryRecommendationCaseRepository();
  const safeResult = Object.freeze({
    schemaVersion: 'missionmed.lor.faculty-verification-result.v2',
    verified: true,
    reasonCode: null,
    caseId: 'case-1',
    invitationId: 'invitation-1',
    caseRevision: 4,
    invitationRevision: 2,
    auditEventRef: `event_${sha256('faculty-verified')}`,
    idempotentReplay: false,
    privateSessionIssued: false,
    privateEditGranted: true,
  });
  const adapter = createLorApplicationAdapter({
    caseService: {},
    repository,
    facultyInvitationVerificationService: {
      async verify(input) {
        calls.push(structuredClone(input));
        return safeResult;
      },
    },
    allowNonDurableForTests: true,
  });
  const actor = { id: 'wp:43', role: 'faculty' };
  const response = await call(adapter, '/api/lor-studio/invitations/invitation-1/verify', {
    method: 'POST',
    actor,
    key: 'verify-1',
    body: {
      otpCode: '538291',
      recipientEmail: 'faculty@example.test',
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { verification: safeResult });
  assert.deepEqual(calls, [{
    actor,
    invitationId: 'invitation-1',
    idempotencyKey: 'verify-1',
    otpCode: '538291',
    recipientEmail: 'faculty@example.test',
  }]);
  assert.doesNotMatch(JSON.stringify(response), /538291|faculty@example\.test/u);

  const extra = await call(adapter, '/api/lor-studio/invitations/invitation-1/verify', {
    method: 'POST', actor, key: 'verify-extra',
    body: {
      otpCode: '538291', recipientEmail: 'faculty@example.test',
      caseId: 'client-selected',
    },
  });
  assert.equal(extra.status, 400);
  const browserSecret = await call(adapter, '/api/lor-studio/invitations/invitation-1/verify', {
    method: 'POST', actor, key: 'verify-browser-secret',
    body: {
      otpCode: '538291',
      recipientEmail: 'faculty@example.test',
      rawToken: 'browser-must-not-carry-this',
    },
  });
  assert.equal(browserSecret.status, 400);
  const queried = await call(adapter, '/api/lor-studio/invitations/invitation-1/verify?caseId=forged', {
    method: 'POST', actor, key: 'verify-query',
    body: { otpCode: '538291', recipientEmail: 'faculty@example.test' },
  });
  assert.equal(queried.status, 400);
  const wrongMethod = await call(adapter, '/api/lor-studio/invitations/invitation-1/verify', {
    method: 'GET', actor,
  });
  assert.equal(wrongMethod.status, 405);

  for (const malformed of [
    '/api/lor-studio/invitations/invite%/verify',
    '/api/lor-studio/cases/case%/faculty-invitations',
    '/api/lor-studio/cases/case-1/ai-proposals/proposal%/decision',
  ]) {
    const rejected = await call(adapter, malformed, { method: 'GET', actor });
    assert.equal(rejected.status, 404);
    assert.deepEqual(rejected.body, { error: 'lor_route_not_found' });
  }
});

test('faculty candidate verification fails closed when absent and makes every DB denial opaque', async () => {
  const repository = new InMemoryRecommendationCaseRepository();
  const withoutService = createLorApplicationAdapter({
    caseService: {}, repository, allowNonDurableForTests: true,
  });
  const requestOptions = {
    method: 'POST', actor: { id: 'wp:43', role: 'faculty' }, key: 'verify-1',
    body: { otpCode: '538291', recipientEmail: 'faculty@example.test' },
  };
  const unavailable = await call(
    withoutService,
    '/api/lor-studio/invitations/invitation-1/verify',
    requestOptions,
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.error, 'integration_disabled');

  const serialized = new Set();
  for (const reason of ['TOKEN_MISMATCH', 'RECIPIENT_MISMATCH', 'OTP_NOT_VERIFIED', 'INVITATION_LOCKED']) {
    const adapter = createLorApplicationAdapter({
      caseService: {},
      repository,
      facultyInvitationVerificationService: {
        async verify() { throw new InvitationDeniedError(reason); },
      },
      allowNonDurableForTests: true,
    });
    const denied = await call(
      adapter,
      '/api/lor-studio/invitations/invitation-1/verify',
      { ...requestOptions, key: `verify-${reason}` },
    );
    assert.equal(denied.status, 403);
    assert.deepEqual(denied.body, {
      error: 'invitation_denied',
      message: 'Faculty invitation verification was denied.',
    });
    assert.doesNotMatch(JSON.stringify(denied), new RegExp(reason, 'u'));
    serialized.add(JSON.stringify(denied));
  }
  assert.equal(serialized.size, 1);
});

const CONSENT_DATA = Object.freeze({
  scopes: ['builder_autosave', 'faculty_handoff', 'ai_drafting', 'evidence_grounding'],
  policyVersion: 'dr-133-identified-education-record-v1',
});
const CONSENT_WITHDRAWAL_DATA = Object.freeze({
  scopes: ['consent_withdrawn'],
  policyVersion: 'dr-133-identified-education-record-v1',
});

function waiverData(overrides = {}) {
  return {
    waived: true,
    policyVersion: 'dr-019-v1',
    acknowledgment: 'I knowingly waive my right of access to this letter.',
    ...overrides,
  };
}

async function openCase(adapter) {
  const created = await call(adapter, '/api/lor-studio/cases', {
    method: 'POST',
    body: {},
    key: 'create-case-1',
  });
  assert.equal(created.status, 201);
  return created.body.case.caseId;
}

async function postReceipt(adapter, options) {
  const { caseId = 'case-1', expectedRevision, receiptType, receiptData, key, actor } = options;
  return call(adapter, `/api/lor-studio/cases/${caseId}/receipts`, {
    method: 'POST',
    body: { expectedRevision, receiptType, receiptData },
    key,
    ...(actor ? { actor } : {}),
  });
}

test('a consent receipt is minted server-side and appended to the student projection', async () => {
  const { adapter, eventSink } = harness({ clock: monotonicClock() });
  await openCase(adapter);

  const recorded = await postReceipt(adapter, {
    expectedRevision: 0,
    receiptType: 'consent',
    receiptData: CONSENT_DATA,
    key: 'consent-1',
  });
  assert.equal(recorded.status, 201);
  assert.equal(recorded.body.case.revision, 1);
  assert.equal('facultyPrivate' in recorded.body.case, false);
  assert.equal(recorded.body.case.consentReceipts.length, 1);

  const [receipt] = recorded.body.case.consentReceipts;
  assert.equal(receipt.schemaVersion, 'missionmed.lor.consent-receipt.v1');
  assert.equal(receipt.caseId, 'case-1');
  assert.equal(receipt.actorId, 'student-1');
  assert.deepEqual(
    receipt.scopes,
    ['ai_drafting', 'builder_autosave', 'evidence_grounding', 'faculty_handoff'],
    'scopes are normalised by the domain',
  );
  assert.match(receipt.receiptHash, /^[a-f0-9]{64}$/u);
  assert.equal(receipt.recordedAt, new Date(receipt.recordedAt).toISOString());
  assert.deepEqual(
    eventSink.snapshot().map((event) => event.eventType),
    ['case.created', 'consent.recorded'],
  );
});

test('consent rejects stale policy versions, partial grants, and ambiguous withdrawal scopes', async () => {
  const { adapter } = harness({ clock: monotonicClock() });
  await openCase(adapter);
  const invalidDecisions = [
    { ...CONSENT_DATA, policyVersion: 'dr-119-v1' },
    { ...CONSENT_DATA, scopes: ['ai_drafting', 'evidence_grounding'] },
    { ...CONSENT_DATA, scopes: ['consent_withdrawn', 'ai_drafting'] },
  ];
  for (const [index, receiptData] of invalidDecisions.entries()) {
    const response = await postReceipt(adapter, {
      expectedRevision: 0,
      receiptType: 'consent',
      receiptData,
      key: `invalid-consent-decision-${index}`,
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'validation_failed');
  }
  const untouched = await call(adapter, '/api/lor-studio/cases/case-1');
  assert.equal(untouched.status, 200);
  assert.equal(untouched.body.case.revision, 0);
  assert.deepEqual(untouched.body.case.consentReceipts, []);
});

test('receipt identity, timestamps, and integrity hashes are never client-assertable', async () => {
  const { adapter } = harness({ clock: monotonicClock() });
  await openCase(adapter);

  for (const forged of [
    { ...CONSENT_DATA, id: 'consent_attacker-chosen' },
    { ...CONSENT_DATA, recordedAt: '2020-01-01T00:00:00.000Z' },
    { ...CONSENT_DATA, actorId: 'student-2' },
    { ...CONSENT_DATA, caseId: 'case-2' },
    { ...CONSENT_DATA, receiptHash: 'f'.repeat(64) },
  ]) {
    const rejected = await postReceipt(adapter, {
      expectedRevision: 0,
      receiptType: 'consent',
      receiptData: forged,
      key: `forged-${Object.keys(forged).at(-1)}`,
    });
    assert.equal(rejected.status, 400, `client-asserted ${Object.keys(forged).at(-1)} must be refused`);
    assert.equal(rejected.body.error, 'validation_failed');
  }

  const unknownType = await postReceipt(adapter, {
    expectedRevision: 0,
    receiptType: 'attestation',
    receiptData: CONSENT_DATA,
    key: 'unknown-receipt-type',
  });
  assert.equal(unknownType.status, 400);
  assert.equal(unknownType.body.error, 'validation_failed');

  const unknownEnvelopeField = await call(adapter, '/api/lor-studio/cases/case-1/receipts', {
    method: 'POST',
    body: {
      expectedRevision: 0,
      receiptType: 'consent',
      receiptData: CONSENT_DATA,
      receipt: { id: 'consent_smuggled' },
    },
    key: 'smuggled-receipt',
  });
  assert.equal(unknownEnvelopeField.status, 400);
  assert.equal(unknownEnvelopeField.body.error, 'validation_failed');

  const untouched = await call(adapter, '/api/lor-studio/cases/case-1');
  assert.equal(untouched.body.case.revision, 0);
  assert.equal(untouched.body.case.consentReceipts.length, 0);
});

test('a waiver decision is recorded and may only be replaced by an explicit supersession', async () => {
  const { adapter } = harness({ clock: monotonicClock() });
  await openCase(adapter);

  const waived = await postReceipt(adapter, {
    expectedRevision: 0,
    receiptType: 'waiver',
    receiptData: waiverData({ waived: true }),
    key: 'waiver-1',
  });
  assert.equal(waived.status, 201);
  assert.equal(waived.body.case.revision, 1);
  assert.equal(waived.body.case.waiverReceipts.length, 1);
  const [first] = waived.body.case.waiverReceipts;
  assert.equal(first.schemaVersion, 'missionmed.lor.waiver-receipt.v1');
  assert.equal(first.waived, true);
  assert.equal(first.priorReceiptId, null);

  // A second decision that does not name the receipt it replaces must not silently flip the
  // student's waiver. Letter release is gated on this value, so an implicit overwrite here is a
  // FERPA failure, not a convenience.
  const implicit = await postReceipt(adapter, {
    expectedRevision: 1,
    receiptType: 'waiver',
    receiptData: waiverData({ waived: false }),
    key: 'waiver-2-implicit',
  });
  assert.equal(implicit.status, 409);
  assert.equal(implicit.body.error, 'domain_invariant');
  assert.doesNotMatch(JSON.stringify(implicit), new RegExp(`${first.id}|case-1|student-1`, 'u'));

  const wrongPredecessor = await postReceipt(adapter, {
    expectedRevision: 1,
    receiptType: 'waiver',
    receiptData: waiverData({ waived: false, priorReceiptId: 'waiver_not-the-current-receipt' }),
    key: 'waiver-2-wrong-prior',
  });
  assert.equal(wrongPredecessor.status, 409);
  assert.equal(wrongPredecessor.body.error, 'domain_invariant');

  const stillOriginal = await call(adapter, '/api/lor-studio/cases/case-1');
  assert.equal(stillOriginal.body.case.revision, 1);
  assert.deepEqual(
    stillOriginal.body.case.waiverReceipts.map((receipt) => receipt.waived),
    [true],
    'a refused supersession must leave the recorded decision untouched',
  );

  const superseded = await postReceipt(adapter, {
    expectedRevision: 1,
    receiptType: 'waiver',
    receiptData: waiverData({ waived: false, priorReceiptId: first.id }),
    key: 'waiver-2-explicit',
  });
  assert.equal(superseded.status, 201);
  assert.equal(superseded.body.case.revision, 2);
  const chain = superseded.body.case.waiverReceipts;
  assert.equal(chain.length, 2, 'supersession appends; it never rewrites the prior decision');
  assert.deepEqual(chain.map((receipt) => receipt.waived), [true, false]);
  assert.equal(chain[1].priorReceiptId, first.id);
  assert.ok(
    new Date(chain[1].recordedAt).valueOf() > new Date(chain[0].recordedAt).valueOf(),
    'a superseding decision must carry a strictly later server timestamp',
  );
});

test('receipts may only be recorded by the student who owns the case', async () => {
  const { adapter } = harness({ clock: monotonicClock() });
  await openCase(adapter);

  const missing = await postReceipt(adapter, {
    caseId: 'does-not-exist',
    expectedRevision: 0,
    receiptType: 'consent',
    receiptData: CONSENT_DATA,
    key: 'consent-missing-case',
  });
  assert.equal(missing.status, 404);

  for (const actor of [
    { id: 'student-2', role: 'student' },
    { id: 'faculty-unbound', role: 'faculty' },
    { id: 'mentor-unassigned', role: 'mentor' },
    { id: 'service-ungranted', role: 'service' },
  ]) {
    const denied = await postReceipt(adapter, {
      expectedRevision: 0,
      receiptType: 'waiver',
      receiptData: waiverData(),
      key: `waiver-foreign-${actor.id}`,
      actor,
    });
    assert.equal(denied.status, 404);
    assert.deepEqual(
      denied.body,
      missing.body,
      `${actor.role} denial must not reveal that the case or its receipts exist`,
    );
  }

  const owner = await call(adapter, '/api/lor-studio/cases/case-1');
  assert.equal(owner.body.case.revision, 0, 'a denied receipt must not advance the case');
  assert.equal(owner.body.case.waiverReceipts.length, 0);
});

test('receipt writes preserve optimistic concurrency and idempotent retry semantics', async () => {
  const { adapter, eventSink } = harness({ clock: monotonicClock() });
  await openCase(adapter);

  const first = await postReceipt(adapter, {
    expectedRevision: 0,
    receiptType: 'consent',
    receiptData: CONSENT_DATA,
    key: 'consent-retry-key',
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.case.revision, 1);
  const eventsAfterFirst = eventSink.snapshot().length;

  const stale = await postReceipt(adapter, {
    expectedRevision: 0,
    receiptType: 'consent',
    receiptData: CONSENT_WITHDRAWAL_DATA,
    key: 'consent-stale-key',
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'stale_revision');
  assert.doesNotMatch(JSON.stringify(stale), /case-1|student-1|consent-stale-key/u);

  // An interrupted retry carries the same key and the same asserted decision. It must replay,
  // not append a second consent receipt and not fail the student closed.
  const replay = await postReceipt(adapter, {
    expectedRevision: 0,
    receiptType: 'consent',
    receiptData: CONSENT_DATA,
    key: 'consent-retry-key',
  });
  assert.equal(replay.status, 201);
  assert.equal(replay.body.case.revision, 1);
  assert.deepEqual(replay.body.case.consentReceipts, first.body.case.consentReceipts);
  assert.equal(eventSink.snapshot().length, eventsAfterFirst, 'a replay performs no second write');

  const conflicting = await postReceipt(adapter, {
    expectedRevision: 0,
    receiptType: 'consent',
    receiptData: CONSENT_WITHDRAWAL_DATA,
    key: 'consent-retry-key',
  });
  assert.equal(conflicting.status, 409);
  assert.equal(conflicting.body.error, 'idempotency_conflict');
  assert.doesNotMatch(JSON.stringify(conflicting), /consent-retry-key/u);
});

test('a waiver retry replays instead of failing closed on the supersession chain', async () => {
  const { adapter } = harness({ clock: monotonicClock() });
  await openCase(adapter);

  const decision = waiverData({ waived: true });
  const recorded = await postReceipt(adapter, {
    expectedRevision: 0,
    receiptType: 'waiver',
    receiptData: decision,
    key: 'waiver-retry-key',
  });
  assert.equal(recorded.status, 201);

  // Without request-derived receipt identity this retry appends a second first-in-chain receipt
  // and the aggregate rejects it, stranding the student behind a 409 they cannot clear -- with
  // letter release gated on waiver state, that is a dead end rather than a safe refusal.
  const replay = await postReceipt(adapter, {
    expectedRevision: 0,
    receiptType: 'waiver',
    receiptData: decision,
    key: 'waiver-retry-key',
  });
  assert.equal(replay.status, 201);
  assert.equal(replay.body.case.revision, 1);
  assert.deepEqual(replay.body.case.waiverReceipts, recorded.body.case.waiverReceipts);
});

test('the receipts route accepts only POST and never falls through to the case projection', async () => {
  const { adapter } = harness({ clock: monotonicClock() });
  await openCase(adapter);

  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const response = await call(adapter, '/api/lor-studio/cases/case-1/receipts', { method });
    assert.equal(response.status, 405, `${method} /receipts must not be routed`);
    assert.equal(response.body.error, 'method_not_allowed');
    assert.equal('case' in response.body, false);
  }

  const nested = await call(adapter, '/api/lor-studio/cases/case-1/receipts/consent', {
    method: 'POST',
    body: { expectedRevision: 0, receiptType: 'consent', receiptData: CONSENT_DATA },
    key: 'nested-receipt-path',
  });
  assert.equal(nested.status, 404);
  assert.equal(nested.body.error, 'lor_route_not_found');
});


// ---------------------------------------------------------------------------
// Final-document release across the service and the HTTP boundary.
//
// Release is the only operation that can grant a student sight of the letter: the student
// projection returns `finalDocument` exactly when `facultyPrivate.finalDocument.releasedToStudentAt`
// is set (authorization-policy.js:299-305), and the aggregate now derives that field solely from
// its own release record. These tests hold this boundary to the same promise - no request field,
// no principal other than the recipient-bound writer, and no half-finished document can produce
// a release, and nothing is persisted that the audit trail cannot describe.
// ---------------------------------------------------------------------------

const FACULTY = Object.freeze({ id: 'faculty-1', role: 'faculty' });
const STUDENT = Object.freeze({ id: 'student-1', role: 'student' });
const T0 = new Date('2026-08-09T11:00:00.000Z');
const WAIVER_AT = new Date('2026-08-09T12:00:00.000Z');
const APPROVED_AT = '2026-08-09T14:30:00.000Z';
const SEEDED_RELEASE_AT = '2026-08-09T14:45:00.000Z';
const FINAL_TEXT = 'FINAL LETTER WORDING';
const RECIPIENT_EMAIL_HASH = sha256('writer@example.test');

function approvalFixture(overrides = {}) {
  return {
    approved: true,
    approvedAt: APPROVED_AT,
    facultyId: 'faculty-1',
    signatureAttested: true,
    ...overrides,
  };
}

/**
 * Build the whole revision chain of a case a faculty writer could release, one record per
 * revision, using only the domain transitions that produce those revisions in production. The
 * service exposes no faculty authoring yet, so the alternative would be hand-shaping an aggregate
 * and reaching past the invariants this route depends on.
 */
function releasableRevisions({
  caseId = 'case-1',
  studentId = 'student-1',
  waived = false,
  waiverDecided = true,
  documentState = 'faculty_final',
  approval = approvalFixture(),
  finalDocument = { id: 'document-1', text: FINAL_TEXT },
  released = false,
} = {}) {
  const revisions = [];
  let record = createRecommendationCase({
    id: caseId,
    studentId,
    now: T0,
    builderSessionId: `builder-${caseId}`,
  });
  revisions.push(record);
  const advance = (next) => {
    record = next;
    revisions.push(next);
  };
  if (waiverDecided) {
    advance(appendReceipt(record, {
      actorId: studentId,
      receiptType: 'waiver',
      receipt: createWaiverReceipt({
        id: `waiver-${caseId}`,
        caseId,
        studentId,
        waived,
        policyVersion: 'dr-119-v1',
        acknowledgment: waived ? 'I waive access.' : 'I retain access to the final letter.',
        recordedAt: WAIVER_AT,
      }),
      now: WAIVER_AT,
    }));
  }
  for (const [index, stepId] of BUILDER_STEPS.entries()) {
    advance(autosaveBuilderStep(record, { actorId: studentId, stepId, stepData: { index }, now: T0 }));
    advance(completeBuilderStep(record, { actorId: studentId, stepId, now: T0 }));
  }
  advance(bindFacultyInvitation(record, {
    actorId: studentId,
    invitationId: `invite-${caseId}`,
    recipientEmailHash: RECIPIENT_EMAIL_HASH,
    now: T0,
  }));
  advance(bindVerifiedFaculty(record, {
    actorId: 'faculty-1',
    invitationId: `invite-${caseId}`,
    facultyId: 'faculty-1',
    recipientEmailHash: RECIPIENT_EMAIL_HASH,
    now: T0,
  }));
  advance(transitionRecommendationCase(record, { actorId: 'faculty-1', toStatus: 'faculty_review', now: T0 }));
  if (finalDocument !== null) {
    advance(setFacultyPrivateContent(record, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      draftText: 'FACULTY PRIVATE DRAFT',
      finalDocument,
      documentState,
      facultyApproval: approval,
      now: T0,
    }));
  }
  if (released) {
    advance(releaseFinalDocument(record, {
      actorId: 'faculty-1',
      facultyId: 'faculty-1',
      caseId,
      documentId: finalDocument.id,
      expectedRevision: record.revision,
      now: SEEDED_RELEASE_AT,
    }));
  }
  return revisions;
}

// Seeded through the repository's own append-only create/save path - one revision per call, with
// the same request metadata a service write carries - so a fixture cannot install a record the
// repository would have refused.
async function seedCase(repository, revisions) {
  const caseId = revisions[0].id;
  await repository.create(revisions[0], {
    idempotencyKey: `seed-${caseId}-0`,
    requestHash: sha256(`seed:${caseId}:0`),
  });
  for (let index = 1; index < revisions.length; index += 1) {
    await repository.save(revisions[index], {
      expectedRevision: index - 1,
      idempotencyKey: `seed-${caseId}-${index}`,
      requestHash: sha256(`seed:${caseId}:${index}`),
    });
  }
  return repository.getById(caseId);
}

function releaseBody({ expectedRevision, documentId = 'document-1' } = {}) {
  return { expectedRevision, documentId };
}

async function releaseCall(adapter, {
  caseId = 'case-1',
  body = releaseBody({ expectedRevision: 0 }),
  key = 'release-1',
  actor = FACULTY,
} = {}) {
  return call(adapter, `/api/lor-studio/cases/${caseId}/final-document/release`, {
    method: 'POST',
    body,
    key,
    actor,
  });
}

async function frozenState(repository, caseId) {
  return JSON.stringify(await repository.getById(caseId));
}

test('PATCH faculty-private authors exact server-owned faculty content and rejects visibility assertions', async () => {
  const { adapter, repository } = harness();
  const seeded = await seedCase(repository, releasableRevisions({ finalDocument: null }));
  const body = {
    expectedRevision: seeded.revision,
    answers: [],
    notes: [{ text: 'private note' }],
    draftText: 'Private working draft',
    finalDocument: {
      contentHash: null,
      id: 'document-1',
      mimeType: 'text/plain',
      text: FINAL_TEXT,
    },
    documentState: 'faculty_final',
    facultyApproval: { approved: true, signatureAttested: true },
  };
  const saved = await call(adapter, '/api/lor-studio/cases/case-1/faculty-private', {
    method: 'PATCH',
    body,
    key: 'faculty-private-save-1',
    actor: FACULTY,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.case.revision, seeded.revision + 1);
  assert.equal(saved.body.case.facultyPrivate.draftText, 'Private working draft');
  assert.equal(saved.body.case.facultyPrivate.finalDocument.text, FINAL_TEXT);
  assert.equal(saved.body.case.facultyPrivate.finalDocument.releasedToStudentAt, null);

  const forgedDocument = {
    ...body.finalDocument,
    releasedToStudentAt: '2026-08-09T00:00:00.000Z',
  };
  const forged = await call(adapter, '/api/lor-studio/cases/case-1/faculty-private', {
    method: 'PATCH',
    body: { ...body, expectedRevision: seeded.revision + 1, finalDocument: forgedDocument },
    key: 'faculty-private-forged-release',
    actor: FACULTY,
  });
  assert.equal(forged.status, 400);
  assert.equal(
    (await repository.getById('case-1')).facultyPrivate.finalDocument.releasedToStudentAt,
    null,
  );

  const wrongMethod = await call(adapter, '/api/lor-studio/cases/case-1/faculty-private', {
    method: 'POST',
    body,
    key: 'faculty-private-wrong-method',
    actor: FACULTY,
  });
  assert.equal(wrongMethod.status, 405);
});

test('a final-document release is a recipient-bound faculty action and refuses every other principal', async () => {
  const { adapter, repository, eventSink } = harness();
  const seeded = await seedCase(repository, releasableRevisions());
  const before = await frozenState(repository, 'case-1');

  const missing = await releaseCall(adapter, { caseId: 'case-absent', key: 'release-absent' });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, 'not_found');

  // The recipient-bound writer clears authorisation on this exact request, so the refusals below
  // are the policy answering rather than every release being refused for some unrelated reason.
  //
  // The control runs on its OWN harness. It used to share this one, which was safe only while the
  // release path was blocked upstream and every call - including the writer's - failed with 400.
  // Once release actually committed, this control mutated the case the denial loop then asserts is
  // untouched. A control that changes the state under test is not a control.
  const control = harness();
  const controlSeed = await seedCase(control.repository, releasableRevisions());
  const bound = await releaseCall(control.adapter, {
    key: 'release-bound-writer',
    body: releaseBody({ expectedRevision: controlSeed.revision }),
  });
  assert.notEqual(bound.status, 404, 'the verified writer must not be answered as though the case did not exist');
  assert.equal(bound.status, 200, 'the control must actually succeed, or it proves nothing');

  for (const actor of [
    STUDENT,
    { id: 'student-2', role: 'student' },
    { id: 'mentor-1', role: 'mentor' },
    { id: 'faculty-2', role: 'faculty' },
    { id: 'service-1', role: 'service' },
    { id: 'admin-1', role: 'admin' },
  ]) {
    const denied = await releaseCall(adapter, {
      actor,
      key: `release-denied-${actor.id}`,
      body: releaseBody({ expectedRevision: seeded.revision }),
    });
    assert.equal(denied.status, 404, `${actor.role} ${actor.id} must not release the letter`);
    assert.deepEqual(denied.body, missing.body, `a ${actor.role} denial must not reveal that the case exists`);
  }

  assert.equal(await frozenState(repository, 'case-1'), before, 'a denied release must not touch the case');
  assert.equal(eventSink.snapshot().length, 0, 'a denied release must not emit an event');
  const studentView = await call(adapter, '/api/lor-studio/cases/case-1', { actor: STUDENT });
  assert.equal(studentView.body.case.finalDocument, null, 'the student must still see no letter');
});

test('a release must name the exact revision and document it acts on', async () => {
  const { adapter, repository } = harness();
  const seeded = await seedCase(repository, releasableRevisions());
  const before = await frozenState(repository, 'case-1');

  const stale = await releaseCall(adapter, {
    key: 'release-stale',
    body: releaseBody({ expectedRevision: seeded.revision - 1 }),
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'stale_revision');
  assert.doesNotMatch(JSON.stringify(stale), /case-1|student-1|document-1|faculty-1/u);

  const ahead = await releaseCall(adapter, {
    key: 'release-ahead',
    body: releaseBody({ expectedRevision: seeded.revision + 1 }),
  });
  assert.equal(ahead.status, 409);
  assert.equal(ahead.body.error, 'stale_revision');

  const unversioned = await releaseCall(adapter, {
    key: 'release-unversioned',
    body: releaseBody({ expectedRevision: 'latest' }),
  });
  assert.equal(unversioned.status, 400, 'a release may not be aimed at whatever the current revision happens to be');
  assert.equal(unversioned.body.error, 'validation_failed');

  const wrongDocument = await releaseCall(adapter, {
    key: 'release-wrong-document',
    body: releaseBody({ expectedRevision: seeded.revision, documentId: 'document-2' }),
  });
  assert.equal(wrongDocument.status, 409);
  assert.equal(wrongDocument.body.error, 'domain_invariant');

  const unnamedDocument = await releaseCall(adapter, {
    key: 'release-unnamed-document',
    body: { expectedRevision: seeded.revision, documentId: '' },
  });
  assert.equal(unnamedDocument.status, 400);
  assert.equal(unnamedDocument.body.error, 'validation_failed');

  assert.equal(await frozenState(repository, 'case-1'), before, 'a refused release must leave the case untouched');
});

test('a release requires an approved, attested, faculty-final document and a recorded non-waived decision', async () => {
  const { adapter, repository, eventSink } = harness();
  const refusals = [
    ['case-no-document', releasableRevisions({ caseId: 'case-no-document', finalDocument: null })],
    ['case-proposal', releasableRevisions({ caseId: 'case-proposal', documentState: 'ai_proposal' })],
    ['case-unapproved', releasableRevisions({
      caseId: 'case-unapproved',
      approval: approvalFixture({ approved: false }),
    })],
    ['case-unattested', releasableRevisions({
      caseId: 'case-unattested',
      approval: approvalFixture({ signatureAttested: false }),
    })],
    ['case-empty-letter', releasableRevisions({
      caseId: 'case-empty-letter',
      finalDocument: { id: 'document-1', text: '   ' },
    })],
    ['case-undecided-waiver', releasableRevisions({ caseId: 'case-undecided-waiver', waiverDecided: false })],
    ['case-waived', releasableRevisions({ caseId: 'case-waived', waived: true })],
  ];

  for (const [caseId, revisions] of refusals) {
    const seeded = await seedCase(repository, revisions);
    const refused = await releaseCall(adapter, {
      caseId,
      key: `release-${caseId}`,
      body: releaseBody({ expectedRevision: seeded.revision }),
    });
    assert.equal(refused.status, 409, `${caseId} must be refused`);
    assert.equal(refused.body.error, 'domain_invariant', `${caseId} must fail on a domain gate`);
    const stored = await repository.getById(caseId);
    assert.equal(stored.revision, seeded.revision, `${caseId} must not advance`);
    assert.equal(stored.finalDocumentState.release, null, `${caseId} must record no release`);
    assert.equal(stored.facultyPrivate.finalDocument?.releasedToStudentAt ?? null, null);
    const studentView = await call(adapter, `/api/lor-studio/cases/${caseId}`, { actor: STUDENT });
    assert.equal(studentView.body.case.finalDocument, null, `${caseId} must stay invisible to the student`);
  }
  assert.equal(eventSink.snapshot().length, 0, 'no refused release may emit an event');
});

test('releasing an already-released document replays and never mints a second release', async () => {
  const { adapter, repository, eventSink, service } = harness();
  const seeded = await seedCase(repository, releasableRevisions({ caseId: 'case-released', released: true }));
  assert.equal(seeded.finalDocumentState.release.releasedAt, SEEDED_RELEASE_AT);
  const before = await frozenState(repository, 'case-released');

  const replay = await releaseCall(adapter, {
    caseId: 'case-released',
    key: 'release-replay',
    body: releaseBody({ expectedRevision: seeded.revision }),
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.case.revision, seeded.revision);

  // A caller replaying a release necessarily still holds the pre-release revision, so a stale
  // expectation must replay rather than strand the writer behind a conflict they cannot clear.
  const staleReplay = await releaseCall(adapter, {
    caseId: 'case-released',
    key: 'release-replay-stale',
    body: releaseBody({ expectedRevision: 0 }),
  });
  assert.equal(staleReplay.status, 200);

  const raced = await Promise.all([
    releaseCall(adapter, {
      caseId: 'case-released',
      key: 'release-race-a',
      body: releaseBody({ expectedRevision: seeded.revision }),
    }),
    releaseCall(adapter, {
      caseId: 'case-released',
      key: 'release-race-b',
      body: releaseBody({ expectedRevision: seeded.revision }),
    }),
  ]);
  assert.deepEqual(raced.map((response) => response.status), [200, 200]);

  // Replaying is not a licence to re-scope what was released.
  const rescoped = await releaseCall(adapter, {
    caseId: 'case-released',
    key: 'release-rescope',
    body: releaseBody({ expectedRevision: seeded.revision, documentId: 'document-2' }),
  });
  assert.equal(rescoped.status, 409);
  assert.equal(rescoped.body.error, 'domain_invariant');

  // Even a service caller that invents an argument for it cannot move the release timestamp: the
  // service takes no such parameter, so the committed record answers instead.
  const forged = await service.releaseFinalDocument({
    caseId: 'case-released',
    actor: FACULTY,
    expectedRevision: seeded.revision,
    idempotencyKey: 'release-forged-argument',
    documentId: 'document-1',
    releasedToStudentAt: '2020-01-01T00:00:00.000Z',
    now: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(forged.facultyPrivate.finalDocument.releasedToStudentAt, SEEDED_RELEASE_AT);

  const stored = await repository.getById('case-released');
  assert.equal(await frozenState(repository, 'case-released'), before, 'no replay may change the released record');
  assert.equal(eventSink.snapshot().length, 0, 'a replayed release emits no second event');
  assert.equal(
    stored.versionHistory.filter((entry) => entry.eventType === 'faculty.final_document_released').length,
    1,
    'the version history must carry exactly one release',
  );
});

test('a student sees the final letter only where a release record exists', async () => {
  const { adapter, repository } = harness();
  await seedCase(repository, releasableRevisions({ caseId: 'case-unreleased' }));
  const released = await seedCase(repository, releasableRevisions({ caseId: 'case-released', released: true }));

  const hidden = await call(adapter, '/api/lor-studio/cases/case-unreleased', { actor: STUDENT });
  assert.equal(hidden.status, 200);
  assert.equal(
    hidden.body.case.finalDocument,
    null,
    'an approved, attested, faculty-final letter stays invisible until it is released',
  );

  const visible = await call(adapter, '/api/lor-studio/cases/case-released', { actor: STUDENT });
  assert.equal(visible.status, 200);
  assert.equal(visible.body.case.finalDocument.text, FINAL_TEXT);
  assert.equal(
    visible.body.case.finalDocument.releasedToStudentAt,
    released.finalDocumentState.release.releasedAt,
    'student visibility must mirror the release record exactly',
  );
});

test('no request field can assert the release timestamp, the writer, or the document content', async () => {
  const { adapter, repository } = harness();
  // Deliberately the already-released case. A well-formed body there is accepted and replays with
  // a 200, so a 400 below can only have come from the request-field allowlist - on an unreleased
  // case every one of these bodies would fail somewhere later and the test would prove nothing.
  const seeded = await seedCase(repository, releasableRevisions({ caseId: 'case-released', released: true }));
  const accepted = await releaseCall(adapter, {
    caseId: 'case-released',
    key: 'release-accepted-shape',
    body: releaseBody({ expectedRevision: seeded.revision }),
  });
  assert.equal(accepted.status, 200, 'the two permitted fields must be accepted, or the rejections below prove nothing');
  const before = await frozenState(repository, 'case-released');

  for (const field of [
    ['releasedToStudentAt', '2026-08-09T16:00:00.000Z'],
    ['finalDocument', { id: 'document-1', releasedToStudentAt: '2026-08-09T16:00:00.000Z' }],
    ['facultyId', 'faculty-1'],
    ['actorId', 'faculty-1'],
    ['caseId', 'case-released'],
    ['documentState', 'faculty_final'],
    ['facultyApproval', { approved: true, signatureAttested: true }],
    ['now', '2026-08-09T16:00:00.000Z'],
    ['waiverReceiptId', 'waiver-case-released'],
  ]) {
    const [name, value] = field;
    const rejected = await releaseCall(adapter, {
      caseId: 'case-released',
      key: `release-forged-${name}`,
      body: { ...releaseBody({ expectedRevision: seeded.revision }), [name]: value },
    });
    assert.equal(rejected.status, 400, `a client-asserted ${name} must be refused`);
    assert.equal(rejected.body.error, 'validation_failed');
  }
  assert.equal(
    await frozenState(repository, 'case-released'),
    before,
    'a rejected payload must leave the release record untouched',
  );

  // Neither boundary file names the field a student's visibility turns on, so there is no
  // parameter, assignment, or projection through which any caller could reach it. Comment lines
  // are dropped first: this is a claim about code, and the code is where it has to hold.
  for (const relativePath of [
    '../../lor-studio/http/application-adapter.mjs',
    '../../lor-studio/services/recommendation-case-service.js',
  ]) {
    const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(?:\/\/|\/?\*)/u.test(line))
      .join('\n');
    assert.equal(
      code.includes('releasedToStudentAt'),
      false,
      `${relativePath} must never name releasedToStudentAt in code`,
    );
  }
});

test('a release commits through the route, is audited, and becomes visible to the student', async () => {
  // This test was previously a PINNED BLOCKER: releaseFinalDocument commits with the domain event
  // type 'faculty.final_document_released' (domain/recommendation-case.js:901), which the service
  // metadata vocabulary did not name, so a release could not be audited and therefore must not
  // happen. The lane that found it did not own services/metadata-events.js and left an explicit
  // tripwire saying this must become the audited SUCCESS case once the type was added. It has
  // been, so this is now the first end-to-end release through the real route.
  assert.doesNotThrow(
    () => createMetadataServiceEvent({
      eventType: 'faculty.final_document_released',
      caseId: 'case-1',
      actorId: 'faculty-1',
      actorRole: 'faculty',
      correlationId: 'correlation-1',
      occurredAt: T0,
    }),
    'the metadata vocabulary must name the release event, or a release can never be audited',
  );

  const { adapter, repository, eventSink } = harness();
  const seeded = await seedCase(repository, releasableRevisions());

  const studentBefore = await call(adapter, '/api/lor-studio/cases/case-1', { actor: STUDENT });
  assert.equal(studentBefore.body.case.finalDocument, null, 'nothing is visible before release');

  const released = await releaseCall(adapter, {
    key: 'release-audited-success',
    body: releaseBody({ expectedRevision: seeded.revision }),
  });
  assert.equal(released.status, 200, 'a well-formed release must now commit');
  assert.notEqual(released.body.error, 'validation_failed');

  // Audited: the commit and its event are one transaction, so a persisted release always has a
  // recording event. Writing state first and minting the event afterwards would commit the
  // student's sight of the letter and then fail the caller, leaving an unrecorded release.
  const events = eventSink.snapshot();
  assert.equal(events.length, 1, 'exactly one release event must be recorded');
  assert.equal(events[0].eventType, 'faculty.final_document_released');

  // Visible: student sight of the letter is a pure mirror of the release record.
  const studentAfter = await call(adapter, '/api/lor-studio/cases/case-1', { actor: STUDENT });
  assert.ok(studentAfter.body.case.finalDocument, 'the student must see the letter after release');
  assert.ok(
    studentAfter.body.case.finalDocument.releasedToStudentAt,
    'the released document must carry its release timestamp',
  );
});

test('the release route accepts only POST, requires an idempotency key, and never falls through', async () => {
  const { adapter, repository } = harness();
  const seeded = await seedCase(repository, releasableRevisions());
  const body = releaseBody({ expectedRevision: seeded.revision });

  for (const method of ['GET', 'PATCH', 'PUT', 'DELETE']) {
    const response = await call(adapter, '/api/lor-studio/cases/case-1/final-document/release', {
      method,
      actor: FACULTY,
    });
    assert.equal(response.status, 405, `${method} /final-document/release must not be routed`);
    assert.equal(response.body.error, 'method_not_allowed');
    assert.equal('case' in response.body, false, 'the release path must never fall through to a projection');
  }

  for (const pathname of [
    '/api/lor-studio/cases/case-1/final-document',
    '/api/lor-studio/cases/case-1/final-document/release/again',
    '/api/lor-studio/cases/case-1/release',
  ]) {
    const response = await call(adapter, pathname, { method: 'POST', body, key: 'release-bad-path', actor: FACULTY });
    assert.equal(response.status, 404, `${pathname} must not be routed`);
    assert.equal(response.body.error, 'lor_route_not_found');
  }

  const keyless = await call(adapter, '/api/lor-studio/cases/case-1/final-document/release', {
    method: 'POST',
    body,
    actor: FACULTY,
  });
  assert.equal(keyless.status, 400);
  assert.equal(keyless.body.error, 'validation_failed');

  const untyped = await call(adapter, '/api/lor-studio/cases/case-1/final-document/release', {
    method: 'POST',
    actor: FACULTY,
    key: 'release-untyped',
  });
  assert.equal(untyped.status, 400);
  assert.equal(untyped.body.error, 'validation_failed');

  assert.equal((await repository.getById('case-1')).revision, seeded.revision);
});
