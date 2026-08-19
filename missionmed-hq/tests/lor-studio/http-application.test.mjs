import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { StaticEntitlementTestAdapter, MetadataOnlyEventBuffer } from '../../lor-studio/adapters/test-adapters.js';
import { InvitationDeniedError } from '../../lor-studio/domain/errors.js';
import { createLorApplicationAdapter } from '../../lor-studio/http/application-adapter.mjs';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
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
  return { adapter, eventSink, repository };
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
    for (const response of [denied, deniedReceipt]) {
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

const CONSENT_DATA = Object.freeze({
  scopes: ['timeline_read', 'faculty_share'],
  policyVersion: 'dr-019-v1',
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
  assert.deepEqual(receipt.scopes, ['faculty_share', 'timeline_read'], 'scopes are normalised by the domain');
  assert.match(receipt.receiptHash, /^[a-f0-9]{64}$/u);
  assert.equal(receipt.recordedAt, new Date(receipt.recordedAt).toISOString());
  assert.deepEqual(
    eventSink.snapshot().map((event) => event.eventType),
    ['case.created', 'consent.recorded'],
  );
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
    receiptData: { scopes: ['faculty_share'], policyVersion: 'dr-019-v1' },
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
    receiptData: { scopes: ['faculty_share'], policyVersion: 'dr-019-v2' },
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
