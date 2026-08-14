import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import {
  FOUNDER_TEST_AGENT_ID,
  FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
  FOUNDER_TEST_PROFILE,
} from '../../server/founder-paid-test-gate.mjs';
import { FounderProofDurableCoordinator, createFounderProofRuntime, createSyntheticProviderDependencies } from '../../server/founder-proof-runtime.mjs';
import { InMemoryVideoEntitlementStore } from '../../server/video-entitlement-store.mjs';

const NOW = Date.parse('2026-08-13T20:00:00.000Z');
const CSRF = 'founder_proof_csrf_3441r';
const ORIGIN = 'http://127.0.0.1:3441';

function hqSession(userId = 3441) {
  return {
    version: 1,
    issuedAt: new Date(NOW - 1_000).toISOString(),
    expiresAt: new Date(NOW + 60_000).toISOString(),
    csrfToken: CSRF,
    authSource: 'wordpress-cookie',
    user: { id: userId, roles: ['administrator'] },
  };
}

function responseCapture() {
  return { status: null, headers: null, body: '', writeHead(status, headers) { this.status = status; this.headers = headers; }, end(chunk = '') { this.body += String(chunk); } };
}

async function invoke(handler, { path = '/api/ivprep-v6/session', method = 'GET', headers = {}, body = '', session = hqSession(), fingerprint = '4'.repeat(64) } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.headers = { host: '127.0.0.1:3441', ...headers };
  const response = responseCapture();
  await handler({ request, response, url: new URL(path, ORIGIN), hqSession: session, cookieFingerprint: fingerprint, hqSessionMaxTtlSeconds: 300, expectedOrigin: ORIGIN });
  return { status: response.status, body: response.body ? JSON.parse(response.body) : null };
}

function runtime() {
  const registry = new InMemoryAdmissionRegistry({ now: () => NOW });
  registry.grantSyntheticEntitlement({
    subject: 'wp:3441', revision: 'founder-proof-1', expiresAtMs: NOW + 120_000,
    founder: true, voice: true, video: true, grantedVideoSeconds: 45,
  });
  const entitlementStore = new InMemoryVideoEntitlementStore({ now: () => NOW, idFactory: () => 'reservation-proof-1' });
  entitlementStore.grantSyntheticSeconds('wp:3441', 45);
  const coordinator = new FounderProofDurableCoordinator();
  return createFounderProofRuntime({
    registry,
    entitlementStore,
    providerDependencies: createSyntheticProviderDependencies({ coordinator }),
    now: () => NOW,
    idFactory: () => 'interview-proof-1',
  });
}

const mutationHeaders = Object.freeze({ origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF });

test('GET, page load, health-shaped reads, and startup create no authorization or job', async () => {
  const proof = runtime();
  const session = await invoke(proof.handler);
  assert.equal(session.status, 200);
  assert.equal(session.body.founderPaidTest.enabled, true);
  assert.equal(session.body.founderPaidTest.agentId, FOUNDER_TEST_AGENT_ID);
  assert.equal(proof.paidTestGate.publicState({ admission: { ok: true, entitlement: { founder: true, video: true } } }).state, 'READY');
  assert.equal(proof.providerDependencies.coordinator.jobs.size, 0);
  assert.equal((await invoke(proof.handler, { path: '/api/ivprep-v6/provider-tests/authorize' })).status, 404);
  assert.equal(proof.providerDependencies.coordinator.jobs.size, 0);
});

test('one authenticated Founder action maps to one authorization, reservation, dispatch, worker, fake provider, and terminal record', async () => {
  const proof = runtime();
  const authorization = await invoke(proof.handler, {
    path: '/api/ivprep-v6/provider-tests/authorize', method: 'POST',
    headers: { ...mutationHeaders, 'idempotency-key': 'authorize-proof-1' },
    body: JSON.stringify({ agentId: FOUNDER_TEST_AGENT_ID, profile: FOUNDER_TEST_PROFILE, voice: 'marin', maxSeconds: 45 }),
  });
  assert.equal(authorization.status, 201);
  const start = await invoke(proof.handler, {
    path: '/api/ivprep-v6/interviews/start', method: 'POST',
    headers: { ...mutationHeaders, 'idempotency-key': 'start-proof-1' },
    body: JSON.stringify({ mode: 'video', authorizationId: authorization.body.authorization.id, agentId: FOUNDER_TEST_AGENT_ID, profile: FOUNDER_TEST_PROFILE, voice: 'marin', maxSeconds: 45 }),
  });
  assert.equal(start.status, 202);
  assert.equal(start.body.proof.agentId, FOUNDER_TEST_AGENT_ID);
  assert.equal(start.body.proof.voice, 'marin');
  assert.equal(start.body.connection.synthetic, true);
  assert.equal(start.body.connection.avatarParticipantIdentity, FOUNDER_TEST_AVATAR_PARTICIPANT_ID);
  assert.equal(proof.providerDependencies.coordinator.jobs.size, 1);

  const ready = await invoke(proof.handler, {
    path: `/api/ivprep-v6/interviews/${start.body.interview.id}/media-ready`, method: 'POST',
    headers: mutationHeaders,
    body: JSON.stringify({
      avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
      videoDecoded: true,
      audioPlayable: true,
      audioAuthority: 'avatar-livekit',
    }),
  });
  assert.equal(ready.status, 202);
  let status = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    status = await invoke(proof.handler, { path: `/api/ivprep-v6/interviews/${start.body.interview.id}/status` });
    if (status.body.provider.state === 'ACTIVE') break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(status.body.provider.state, 'ACTIVE');

  const ended = await invoke(proof.handler, {
    path: `/api/ivprep-v6/interviews/${start.body.interview.id}/end`, method: 'POST', headers: mutationHeaders, body: '{}',
  });
  assert.equal(ended.status, 200);
  assert.equal(proof.paidTestGate.publicState({ admission: { ok: true, entitlement: { founder: true, video: true } } }).state, 'TERMINAL');
  assert.deepEqual(proof.entitlementStore.balance('wp:3441'), { granted: 45, consumed: 0, reserved: 0, available: 45 });
});

test('wrong agent, missing authorization, reuse, CSRF failure, and switched account create zero extra jobs', async () => {
  const proof = runtime();
  const wrong = await invoke(proof.handler, {
    path: '/api/ivprep-v6/provider-tests/authorize', method: 'POST',
    headers: { ...mutationHeaders, 'idempotency-key': 'authorize-wrong' },
    body: JSON.stringify({ agentId: 'agent_wrong', profile: FOUNDER_TEST_PROFILE, voice: 'marin', maxSeconds: 45 }),
  });
  assert.equal(wrong.status, 403);
  const missing = await invoke(proof.handler, {
    path: '/api/ivprep-v6/interviews/start', method: 'POST',
    headers: { ...mutationHeaders, 'idempotency-key': 'start-missing' },
    body: JSON.stringify({ mode: 'video', authorizationId: 'authorization-missing', agentId: FOUNDER_TEST_AGENT_ID, profile: FOUNDER_TEST_PROFILE, voice: 'marin', maxSeconds: 45 }),
  });
  assert.equal(missing.status, 403);
  const csrf = await invoke(proof.handler, {
    path: '/api/ivprep-v6/provider-tests/authorize', method: 'POST',
    headers: { ...mutationHeaders, 'x-mmhq-csrf': 'wrong', 'idempotency-key': 'authorize-csrf' },
    body: JSON.stringify({ agentId: FOUNDER_TEST_AGENT_ID, profile: FOUNDER_TEST_PROFILE, voice: 'marin', maxSeconds: 45 }),
  });
  assert.equal(csrf.status, 403);
  assert.equal(proof.providerDependencies.coordinator.jobs.size, 0);
});
