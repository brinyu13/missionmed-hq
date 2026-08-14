import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FOUNDER_TEST_AGENT_ID,
  FOUNDER_TEST_MAX_SECONDS,
  FOUNDER_TEST_PROFILE,
  FounderPaidTestGate,
} from '../../server/founder-paid-test-gate.mjs';

const FINGERPRINT = 'a'.repeat(64);

function admission({ founder = true, fingerprint = FINGERPRINT, revision = 'entitlement-1' } = {}) {
  return Object.freeze({
    ok: true,
    subject: 'wp:3441',
    cookieFingerprint: fingerprint,
    entitlement: Object.freeze({ founder, video: true, revision }),
  });
}

function request(overrides = {}) {
  return {
    admission: admission(),
    idempotencyKey: 'authorize-test-1',
    agentId: FOUNDER_TEST_AGENT_ID,
    profile: FOUNDER_TEST_PROFILE,
    voice: 'marin',
    maxSeconds: FOUNDER_TEST_MAX_SECONDS,
    ...overrides,
  };
}

function armedGate(options = {}) {
  const gate = new FounderPaidTestGate(options);
  assert.equal(gate.armInfrastructure({
    terminationArmed: true,
    reconciliationArmed: true,
    singleSessionEnforced: true,
    zeroRetry: true,
    zeroReconnect: true,
    zeroRecreation: true,
  }).ok, true);
  return gate;
}

test('Founder authorization is exact, idempotent before consume, and single-use', () => {
  let now = 1_000;
  const gate = armedGate({ now: () => now, idFactory: () => 'authorization-test-1' });
  const issued = gate.issue(request());
  assert.equal(issued.status, 201);
  assert.equal(gate.issue(request()).status, 200);
  const consumed = gate.consume({
    admission: admission(),
    authorizationId: issued.authorization.id,
    interviewId: 'interview-test-1',
    idempotencyKey: 'start-test-1',
    agentId: FOUNDER_TEST_AGENT_ID,
    profile: FOUNDER_TEST_PROFILE,
    voice: 'marin',
    maxSeconds: 45,
  });
  assert.equal(consumed.ok, true);
  assert.equal(consumed.receipt.terminationArmed, true);
  assert.equal(consumed.receipt.reconciliationArmed, true);
  assert.equal(consumed.receipt.zeroRetry, true);
  assert.match(consumed.receipt.authorizationBinding, /^[a-f0-9]{64}$/u);
  assert.equal(gate.consume({ ...consumed.receipt, admission: admission(), authorizationId: issued.authorization.id }).code, 'ivprep_paid_test_authorization_consumed');
  assert.equal(gate.finish({ authorizationId: issued.authorization.id, providerCreateAttempted: true, terminationConfirmed: true, reconciliationConfirmed: true }).ok, true);
  assert.equal(gate.publicState({ admission: admission() }).state, 'TERMINAL');
  now += 1;
  assert.equal(gate.issue(request({ idempotencyKey: 'another-authorization' })).code, 'ivprep_paid_test_unavailable');
});

test('ordinary admin, wrong agent, cedar, duration drift, account switch, and missing cleanup fail closed', () => {
  const gate = armedGate({ idFactory: () => 'authorization-test-2' });
  assert.equal(gate.issue(request({ admission: admission({ founder: false }) })).code, 'ivprep_founder_authorization_required');
  assert.equal(gate.issue(request({ agentId: 'agent_wrong' })).code, 'ivprep_paid_test_contract_mismatch');
  assert.equal(gate.issue(request({ voice: 'cedar' })).code, 'ivprep_paid_test_contract_mismatch');
  assert.equal(gate.issue(request({ maxSeconds: 46 })).code, 'ivprep_paid_test_contract_mismatch');
  const issued = gate.issue(request());
  assert.equal(gate.consume({
    admission: admission({ fingerprint: 'b'.repeat(64) }),
    authorizationId: issued.authorization.id,
    interviewId: 'interview-test-2',
    idempotencyKey: 'start-test-2',
    agentId: FOUNDER_TEST_AGENT_ID,
    profile: FOUNDER_TEST_PROFILE,
    voice: 'marin',
    maxSeconds: 45,
  }).code, 'ivprep_paid_test_contract_mismatch');
  const consumed = gate.consume({
    admission: admission(),
    authorizationId: issued.authorization.id,
    interviewId: 'interview-test-2',
    idempotencyKey: 'start-test-2',
    agentId: FOUNDER_TEST_AGENT_ID,
    profile: FOUNDER_TEST_PROFILE,
    voice: 'marin',
    maxSeconds: 45,
  });
  assert.equal(consumed.ok, true);
  assert.equal(gate.finish({ authorizationId: issued.authorization.id, providerCreateAttempted: true, terminationConfirmed: false, reconciliationConfirmed: false }).ok, false);
  assert.equal(gate.publicState({ admission: admission() }).state, 'FAILED_CLOSED');
});

test('expired authorization is terminal and unarmed infrastructure never issues', () => {
  let now = 0;
  const gate = armedGate({ now: () => now, idFactory: () => 'authorization-test-3', authorizationTtlMs: 10_000 });
  const issued = gate.issue(request());
  now = 10_001;
  assert.equal(gate.consume({
    admission: admission(),
    authorizationId: issued.authorization.id,
    interviewId: 'interview-test-3',
    idempotencyKey: 'start-test-3',
    agentId: FOUNDER_TEST_AGENT_ID,
    profile: FOUNDER_TEST_PROFILE,
    voice: 'marin',
    maxSeconds: 45,
  }).code, 'ivprep_paid_test_authorization_expired');
  const unarmed = new FounderPaidTestGate();
  assert.equal(unarmed.armInfrastructure({ terminationArmed: true }).code, 'ivprep_provider_safety_unarmed');
  assert.equal(unarmed.issue(request()).code, 'ivprep_paid_test_unavailable');
});
