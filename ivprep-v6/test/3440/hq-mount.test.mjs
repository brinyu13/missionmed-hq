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
  const concurrent = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: { ...mutationHeaders, 'idempotency-key': 'idem-key-2' }, body: '{"mode":"voice-only"}' });
  assert.equal(concurrent.status, 409);
  assert.equal(concurrent.body.error, 'ivprep_interview_active');
  const switched = await invoke(handler, { path: '/api/ivprep-v6/interviews/interview-1/end', method: 'POST', headers: mutationHeaders, body: '{}', fingerprint: 'b'.repeat(64) });
  assert.equal(switched.status, 409);
});

test('video cannot become active without both the gate and a controller', async () => {
  const noGate = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const yesGateNoController = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true } });
  const options = { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-video-1' }, body: '{"mode":"video"}' };
  assert.equal((await invoke(noGate, options)).status, 503);
  assert.equal((await invoke(yesGateNoController, options)).status, 503);
});
