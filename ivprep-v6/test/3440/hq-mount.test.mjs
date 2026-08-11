import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';

const NOW = Date.parse('2026-08-11T16:00:00.000Z');
const CSRF = 'csrf_token_1234567890';

function session(userId = 1) {
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
  return {
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(chunk = '') { this.body += String(chunk); },
  };
}

async function invoke(handler, { path = '/api/ivprep-v6/session', method = 'GET', headers = {}, body = '', hqSession = session(), fingerprint = 'a'.repeat(64) } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.headers = { host: 'hq.local', ...headers };
  const response = responseCapture();
  const handled = await handler({
    request,
    response,
    url: new URL(path, 'http://hq.local'),
    hqSession,
    cookieFingerprint: fingerprint,
    hqSessionMaxTtlSeconds: 300,
    expectedOrigin: 'http://hq.local',
  });
  return { handled, status: response.status, headers: response.headers, body: response.body ? JSON.parse(response.body) : null };
}

function registry() {
  const value = new InMemoryAdmissionRegistry({ now: () => NOW });
  value.grantSyntheticEntitlement({
    subject: 'wp:1', revision: 'local-1', expiresAtMs: NOW + 120_000,
    founder: true, voice: true, video: true, grantedVideoSeconds: 45,
  });
  return value;
}

test('feature flags, bearer auth, and missing entitlement deny before product data', async () => {
  const off = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: false, adminCanaryEnabled: false, videoEnabled: false } });
  assert.equal((await invoke(off)).status, 503);
  const on = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  assert.equal((await invoke(on, { headers: { authorization: 'Bearer opaque' } })).status, 401);
  assert.equal((await invoke(on, { path: '/api/ivprep-v6/session?access_token=opaque' })).status, 401);
  assert.equal((await invoke(on, { path: '/api/ivprep-v6/session?next=Bearer%20opaque' })).status, 401);
  const empty = createIvPrepHqHandler({ registry: new InMemoryAdmissionRegistry({ now: () => NOW }), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  assert.equal((await invoke(empty)).status, 403);
});

test('admitted session projection contains no shared token and vault is empty', async () => {
  const handler = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const admitted = await invoke(handler);
  assert.equal(admitted.status, 200);
  assert.equal(admitted.body.admitted, true);
  assert.equal(admitted.body.videoEnabled, false);
  assert.equal(JSON.stringify(admitted.body).includes('accessToken'), false);
  const vault = await invoke(handler, { path: '/api/ivprep-v6/vault' });
  assert.deepEqual(vault.body, { sessions: [] });
});

test('voice start is CSRF-bound and idempotent; switched cookies cannot end it', async () => {
  const handler = createIvPrepHqHandler({ registry: registry(), now: () => NOW, idFactory: () => 'interview-1', flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const mutationHeaders = { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-key-1' };
  assert.equal((await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: { ...mutationHeaders, 'x-mmhq-csrf': 'wrong' }, body: '{"mode":"voice-only"}' })).status, 403);
  const first = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: '{"mode":"voice-only"}' });
  const duplicate = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: '{"mode":"voice-only"}' });
  assert.equal(first.status, 201);
  assert.equal(duplicate.status, 200);
  assert.deepEqual(first.body.interview, duplicate.body.interview);
  const changedBody = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: '{"mode":"video"}' });
  assert.equal(changedBody.status, 409);
  assert.equal(changedBody.body.error, 'ivprep_idempotency_conflict');
  const switchedReplay = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: '{"mode":"voice-only"}', fingerprint: 'b'.repeat(64) });
  assert.equal(switchedReplay.status, 409);
  assert.equal(switchedReplay.body.error, 'ivprep_idempotency_conflict');
  const concurrent = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: { ...mutationHeaders, 'idempotency-key': 'idem-key-2' }, body: '{"mode":"voice-only"}' });
  assert.equal(concurrent.status, 409);
  assert.equal(concurrent.body.error, 'ivprep_interview_active');
  const switched = await invoke(handler, { path: '/api/ivprep-v6/interviews/interview-1/end', method: 'POST', headers: mutationHeaders, body: '{}', fingerprint: 'b'.repeat(64) });
  assert.equal(switched.status, 409);
});

test('mutations fail closed without a sealed configured origin', async () => {
  const handler = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const request = Readable.from([Buffer.from('{"mode":"voice-only"}')]);
  request.method = 'POST';
  request.headers = {
    host: 'attacker.example',
    'x-forwarded-proto': 'https',
    origin: 'https://attacker.example',
    'sec-fetch-site': 'same-origin',
    'x-mmhq-csrf': CSRF,
    'idempotency-key': 'idem-sealed-origin',
  };
  const response = responseCapture();
  await handler({
    request,
    response,
    url: new URL('/api/ivprep-v6/interviews/start', 'https://attacker.example'),
    hqSession: session(),
    cookieFingerprint: 'a'.repeat(64),
    hqSessionMaxTtlSeconds: 300,
    expectedOrigin: '',
  });
  assert.equal(response.status, 403);
});

test('video cannot become active without both the gate and a controller', async () => {
  const noGate = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const yesGateNoController = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true } });
  const options = { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-video-1' }, body: '{"mode":"video"}' };
  assert.equal((await invoke(noGate, options)).status, 503);
  assert.equal((await invoke(yesGateNoController, options)).status, 503);
});

test('video start returns one scoped connection before browser readiness and exposes status separately', async () => {
  const recorded = [];
  let providerState = 'AGENT_JOINING';
  const connection = {
    url: 'wss://example.livekit.cloud',
    token: 'synthetic-room-token'.padEnd(64, 'x'),
    participantIdentity: 'ivp-browser-1',
  };
  const handler = createIvPrepHqHandler({
    registry: registry(),
    now: () => NOW,
    idFactory: () => 'interview-video-two-phase',
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true },
    providerControllerFactory: () => ({
      start: async () => ({ ok: true, pending: true, connection }),
      recordBrowserMediaReady: async (evidence) => { recorded.push(evidence); return { ok: true }; },
      status: () => ({ state: providerState, active: providerState === 'ACTIVE' }),
      stop: async () => ({ ok: true }),
    }),
  });
  const mutationHeaders = { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-video-two-phase' };
  const first = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: '{"mode":"video"}' });
  const replay = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: '{"mode":"video"}' });
  assert.equal(first.status, 202);
  assert.deepEqual(first.body.connection, connection);
  assert.deepEqual(replay.body.connection, connection);
  assert.equal(first.body.interview.state, 'starting');

  const readiness = await invoke(handler, {
    path: '/api/ivprep-v6/interviews/interview-video-two-phase/media-ready',
    method: 'POST',
    headers: mutationHeaders,
    body: '{"videoDecoded":true,"audioPlayable":true,"audioAuthority":"avatar-livekit"}',
  });
  assert.equal(readiness.status, 202);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].cookieFingerprint, 'a'.repeat(64));

  providerState = 'ACTIVE';
  const status = await invoke(handler, { path: '/api/ivprep-v6/interviews/interview-video-two-phase/status' });
  assert.equal(status.status, 200);
  assert.equal(status.body.interview.state, 'active');
  assert.equal(JSON.stringify(status.body).includes(connection.token), false);
});

test('logout during provider start is observed before activation and forces cleanup', async () => {
  const store = registry();
  let releaseStart;
  const startBarrier = new Promise((resolve) => { releaseStart = resolve; });
  const stopped = [];
  let stopPromise = null;
  const handler = createIvPrepHqHandler({
    registry: store,
    now: () => NOW,
    idFactory: () => 'interview-video-race',
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true },
    providerControllerFactory: () => ({
      start: async () => startBarrier,
      stop: async (reason) => {
        if (!stopPromise) {
          stopped.push(reason);
          stopPromise = Promise.resolve({ ok: true });
        }
        return stopPromise;
      },
    }),
  });
  const fingerprint = 'a'.repeat(64);
  const pending = invoke(handler, {
    path: '/api/ivprep-v6/interviews/start',
    method: 'POST',
    headers: { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-video-race' },
    body: '{"mode":"video"}',
    fingerprint,
  });
  await new Promise((resolve) => setImmediate(resolve));
  store.recordLogout({ cookieFingerprint: fingerprint });
  releaseStart({ ok: true });
  const response = await pending;
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'ivprep_session_owner_changed');
  assert.deepEqual(stopped, ['hq_logout']);
});
