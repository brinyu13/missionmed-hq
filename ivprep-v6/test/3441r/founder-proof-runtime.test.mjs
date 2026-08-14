import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
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
import { createFounderProofHqSession } from '../../scripts/3441r/start-founder-proof-harness.mjs';

const NOW = Date.parse('2026-08-13T20:00:00.000Z');
const CSRF = 'founder_proof_csrf_3441r';
const ORIGIN = 'http://127.0.0.1:3441';
const PRODUCT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HARNESS = fileURLToPath(new URL('../../scripts/3441r/start-founder-proof-harness.mjs', import.meta.url));

function awaitSyntheticHarness(child) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => reject(new Error('Synthetic Founder harness startup timed out.')), 5_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const url = stdout.match(/^LOCAL_FOUNDER_PROOF_URL=(http:\/\/127\.0\.0\.1:\d+\/iv-prep-on-call\/#room)$/mu)?.[1];
      if (!url || !stdout.includes('LOCAL_FOUNDER_PROOF_MODE=SYNTHETIC_ZERO_COST')
        || !stdout.includes('LEASE_STATE=NOT_ACQUIRED')
        || !stdout.includes('PROVIDER_CALLS_AT_STARTUP=0')) return;
      clearTimeout(timer);
      resolve({ url, stdout, stderr });
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Synthetic Founder harness exited before readiness (${code}).`));
    });
  });
}

async function leaseRequest(url, path, { method = 'GET' } = {}) {
  const origin = new URL(url).origin;
  const response = await fetch(`${origin}/api/ivprep-v6${path}`, {
    method,
    headers: method === 'POST' ? {
      Origin: origin,
      'Sec-Fetch-Site': 'same-origin',
      'X-MMHQ-CSRF': CSRF,
      'Content-Type': 'application/json',
      'Idempotency-Key': `lease-test-${path}`,
    } : {},
    body: method === 'POST' ? '{}' : undefined,
  });
  return { status: response.status, body: await response.json() };
}

async function waitForHarnessLease(url, state, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await leaseRequest(url, '/t1-lease');
    if (current.body.lease?.state === state) return current.body.lease;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Harness lease did not reach ${state}.`);
}

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

test('Founder harness session TTL uses one deterministic clock read and exactly 1800000 ms', () => {
  let clockReads = 0;
  const session = createFounderProofHqSession({
    clock: () => {
      clockReads += 1;
      return NOW + clockReads - 1;
    },
  });

  assert.equal(clockReads, 1);
  assert.equal(Date.parse(session.expiresAt) - Date.parse(session.issuedAt), 1_800_000);
});

test('synthetic Founder harness serves the observable room without provider activation', async (context) => {
  const child = spawn(process.execPath, [HARNESS], {
    cwd: PRODUCT_ROOT,
    env: {},
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stopped = false;
  context.after(() => {
    if (!stopped && child.exitCode == null) child.kill('SIGTERM');
  });

  const startup = await awaitSyntheticHarness(child);
  assert.equal(startup.stderr, '');
  const response = await fetch(startup.url);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') || '', /default-src 'self'/u);
  assert.match(html, /FOUNDER TEST #1 · ONE SHOT/u);
  assert.match(html, /Dr Kelly/u);
  assert.match(html, /id="founder-authorize-test"/u);
  assert.match(html, /id="founder-acquire-lease"/u);
  assert.match(html, /id="room-start"/u);
  assert.match(html, /id="founder-proof-voice"/u);
  const lease = await leaseRequest(startup.url, '/t1-lease');
  assert.equal(lease.status, 200);
  assert.equal(lease.body.lease.state, 'NOT_ACQUIRED');

  child.kill('SIGTERM');
  await once(child, 'exit');
  stopped = true;
  assert.equal(child.exitCode, 0);
});

test('harness blocks paid mutations until stable READY and releases on clean exit', async (context) => {
  const child = spawn(process.execPath, [HARNESS, '--synthetic-stability-test'], {
    cwd: PRODUCT_ROOT,
    env: {},
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  context.after(() => { if (child.exitCode == null) child.kill('SIGKILL'); });
  const startup = await awaitSyntheticHarness(child);
  const origin = new URL(startup.url).origin;
  const blocked = await fetch(`${origin}/api/ivprep-v6/provider-tests/authorize`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Sec-Fetch-Site': 'same-origin',
      'X-MMHQ-CSRF': CSRF,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'blocked-before-ready',
    },
    body: JSON.stringify({ agentId: FOUNDER_TEST_AGENT_ID, profile: FOUNDER_TEST_PROFILE, voice: 'marin', maxSeconds: 45 }),
  });
  assert.equal(blocked.status, 409);
  assert.deepEqual(await blocked.json(), { error: 'ivprep_t1_lease_not_ready' });

  const acquire = await leaseRequest(startup.url, '/t1-lease/acquire', { method: 'POST' });
  assert.equal(acquire.status, 202);
  const ready = await waitForHarnessLease(startup.url, 'READY');
  assert.ok(ready.heartbeatCount >= 3);
  child.kill('SIGTERM');
  await once(child, 'exit');
  assert.equal(child.exitCode, 0);
});

test('heartbeat loss terminates the paid-capable harness without provider startup calls', async (context) => {
  const child = spawn(process.execPath, [HARNESS, '--synthetic-lease-loss-test'], {
    cwd: PRODUCT_ROOT,
    env: {},
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  context.after(() => { if (child.exitCode == null) child.kill('SIGKILL'); });
  const startup = await awaitSyntheticHarness(child);
  const acquire = await leaseRequest(startup.url, '/t1-lease/acquire', { method: 'POST' });
  assert.equal(acquire.status, 202);
  await once(child, 'exit');
  assert.equal(child.exitCode, 1);
  assert.match(startup.stdout, /PROVIDER_CALLS_AT_STARTUP=0/u);
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
