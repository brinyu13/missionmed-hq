import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Writable } from 'node:stream';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createLorStudioRuntime,
  evaluateLorEntitlement,
  isLorStudioRequestPath,
  resolveLorStudioFlags,
  validateFreshLorSession,
} from '../../lor-studio/http/runtime.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(testDirectory, '..', '..', 'public', 'lor-studio');
const NOW = new Date('2026-08-09T16:00:00.000Z');

class MemoryResponse extends Writable {
  constructor() {
    super();
    this.statusCode = 0;
    this.headers = {};
    this.chunks = [];
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  end(chunk, encoding, callback) {
    if (chunk) this.chunks.push(Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
    return super.end(typeof encoding === 'function' ? encoding : callback);
  }

  get body() {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

function session(overrides = {}) {
  return {
    issuedAt: '2026-08-09T15:00:00.000Z',
    expiresAt: '2026-08-09T17:00:00.000Z',
    csrfToken: 'csrf-test-value',
    authSource: 'wp_cookie',
    user: { id: 'student-1', roles: ['subscriber'] },
    ...overrides,
  };
}

function entitlement(overrides = {}) {
  return {
    available: true,
    sourceVerified: true,
    studentId: 'student-1',
    actorId: 'student-1',
    role: 'student',
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
    ...overrides,
  };
}

function runtime(options = {}) {
  return createLorStudioRuntime({
    publicDirectory,
    flags: { enabled: true, killSwitch: false, requireCanary: true },
    clock: () => NOW,
    entitlementResolver: { resolve: async () => entitlement() },
    validateCsrf: (request, activeSession) => request.headers['x-mmhq-csrf'] === activeSession?.csrfToken,
    ...options,
  });
}

async function invoke(activeRuntime, route, { method = 'GET', activeSession = session(), headers = {} } = {}) {
  const request = { method, headers };
  const response = new MemoryResponse();
  await activeRuntime.handle(request, response, new URL(route, 'https://hq.example.test'), { session: activeSession });
  return response;
}

test('LOR route matching is exact and does not capture lookalike paths', () => {
  assert.equal(isLorStudioRequestPath('/lor-studio'), true);
  assert.equal(isLorStudioRequestPath('/lor-studio/production-adapter.js'), true);
  assert.equal(isLorStudioRequestPath('/api/lor-studio/bootstrap'), true);
  assert.equal(isLorStudioRequestPath('/lor-studio-evil'), false);
  assert.equal(isLorStudioRequestPath('/api/lor-studio-evil'), false);
});

test('feature flags default closed', () => {
  assert.deepEqual(resolveLorStudioFlags({}), {
    enabled: false,
    killSwitch: true,
    requireCanary: true,
  });
});

test('fresh-session validation rejects anonymous, malformed, future, and expired sessions', () => {
  assert.equal(validateFreshLorSession(null, NOW).error, 'authentication_required');
  assert.equal(validateFreshLorSession(session({ expiresAt: 'invalid' }), NOW).error, 'invalid_session');
  assert.equal(validateFreshLorSession(session({ issuedAt: '2026-08-09T16:06:00.000Z' }), NOW).error, 'invalid_session_window');
  assert.equal(validateFreshLorSession(session({ expiresAt: '2026-08-09T15:59:59.000Z' }), NOW).error, 'session_expired');
  assert.equal(validateFreshLorSession(session(), NOW).ok, true);
});

test('entitlement evaluation requires authoritative, active, explicit, unrevoked 360 proof', () => {
  assert.equal(evaluateLorEntitlement(null).error, 'entitlement_contract_unavailable');
  assert.equal(evaluateLorEntitlement(entitlement({ sourceVerified: false })).error, 'entitlement_contract_unavailable');
  assert.equal(evaluateLorEntitlement(entitlement({ revoked: true })).error, 'lor_entitlement_revoked');
  assert.equal(evaluateLorEntitlement(entitlement({ active: false })).error, 'lor_entitlement_required');
  assert.equal(evaluateLorEntitlement(entitlement({ tier: 'other' })).error, 'lor_entitlement_required');
  assert.equal(evaluateLorEntitlement(entitlement({ lorEnabled: false })).error, 'lor_entitlement_required');
  assert.equal(evaluateLorEntitlement(entitlement({ canaryConsented: false })).error, 'lor_canary_consent_required');
  assert.equal(evaluateLorEntitlement(entitlement()).ok, true);
});

test('protected presentation never reaches anonymous or expired sessions', async () => {
  const anonymous = await invoke(runtime(), '/lor-studio/', { activeSession: null });
  assert.equal(anonymous.statusCode, 401);
  assert.match(anonymous.body, /authentication_required/u);
  assert.doesNotMatch(anonymous.body, /synthetic, labeled demo data/u);

  const expired = await invoke(runtime(), '/lor-studio/', {
    activeSession: session({ expiresAt: '2026-08-09T15:59:59.000Z' }),
  });
  assert.equal(expired.statusCode, 401);
  assert.match(expired.body, /session_expired/u);
});

test('feature-off and kill-switch states fail before entitlement lookup', async () => {
  let lookups = 0;
  const resolver = { resolve: async () => { lookups += 1; return entitlement(); } };
  const featureOff = runtime({ flags: { enabled: false, killSwitch: false, requireCanary: true }, entitlementResolver: resolver });
  const offResponse = await invoke(featureOff, '/api/lor-studio/bootstrap');
  assert.equal(offResponse.statusCode, 404);
  assert.equal(JSON.parse(offResponse.body).error, 'lor_feature_disabled');

  const killed = runtime({ flags: { enabled: true, killSwitch: true, requireCanary: true }, entitlementResolver: resolver });
  const killedResponse = await invoke(killed, '/api/lor-studio/bootstrap');
  assert.equal(killedResponse.statusCode, 423);
  assert.equal(JSON.parse(killedResponse.body).error, 'lor_kill_switch_active');
  assert.equal(lookups, 0);
});

test('unknown, revoked, ineligible, nonconsenting, and mismatched entitlements fail closed', async () => {
  const cases = [
    [{ available: false }, 503, 'entitlement_contract_unavailable'],
    [entitlement({ revoked: true }), 403, 'lor_entitlement_revoked'],
    [entitlement({ lorEnabled: false }), 403, 'lor_entitlement_required'],
    [entitlement({ canaryConsented: false }), 403, 'lor_canary_consent_required'],
    [entitlement({ actorId: 'student-2' }), 403, 'entitlement_subject_mismatch'],
    [entitlement({ actorId: 'faculty-2', role: 'faculty' }), 403, 'entitlement_subject_mismatch'],
  ];

  for (const [projection, expectedStatus, expectedError] of cases) {
    const activeRuntime = runtime({ entitlementResolver: { resolve: async () => projection } });
    const response = await invoke(activeRuntime, '/api/lor-studio/bootstrap');
    assert.equal(response.statusCode, expectedStatus);
    assert.equal(JSON.parse(response.body).error, expectedError);
  }
});

test('authorized static route exposes only allowlisted assets', async () => {
  const index = await invoke(runtime(), '/lor-studio/', { method: 'HEAD' });
  assert.equal(index.statusCode, 200);
  assert.match(index.headers['Content-Type'], /text\/html/u);
  assert.equal(index.headers['X-Robots-Tag'], 'noindex, nofollow');

  const hiddenManifest = await invoke(runtime(), '/lor-studio/FROZEN_PRESENTATION_MANIFEST.json', { method: 'HEAD' });
  assert.equal(hiddenManifest.statusCode, 404);
});

test('bootstrap will not claim live mode without a durable verified application', async () => {
  const absent = await invoke(runtime(), '/api/lor-studio/bootstrap');
  assert.equal(absent.statusCode, 503);
  assert.equal(JSON.parse(absent.body).error, 'lor_application_unavailable');

  const inMemory = runtime({
    application: {
      getBootstrap: async () => ({
        operational: true,
        runtimeMode: 'live',
        storageMode: 'NON_DURABLE_TEST_ONLY',
        providersReady: true,
      }),
    },
  });
  const inMemoryResponse = await invoke(inMemory, '/api/lor-studio/bootstrap');
  assert.equal(inMemoryResponse.statusCode, 503);
  assert.equal(JSON.parse(inMemoryResponse.body).error, 'lor_durable_runtime_required');

  const durable = runtime({
    application: {
      getBootstrap: async () => ({
        operational: true,
        runtimeMode: 'live',
        storageMode: 'durable',
        providersReady: true,
        capabilities: { builder: true },
      }),
    },
  });
  const durableResponse = await invoke(durable, '/api/lor-studio/bootstrap');
  assert.equal(durableResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(durableResponse.body), {
    operational: true,
    runtimeMode: 'live',
    storageMode: 'durable',
    providersReady: true,
    capabilities: { builder: true },
    csrfToken: 'csrf-test-value',
  });
});

test('every mutation requires the LOR CSRF header before application dispatch', async () => {
  let dispatched = 0;
  const activeRuntime = runtime({
    application: {
      handleRequest: async () => {
        dispatched += 1;
        return { status: 200, body: { ok: true } };
      },
    },
  });

  const missing = await invoke(activeRuntime, '/api/lor-studio/cases', { method: 'POST' });
  assert.equal(missing.statusCode, 403);
  assert.equal(JSON.parse(missing.body).error, 'csrf_validation_failed');
  assert.equal(dispatched, 0);

  const valid = await invoke(activeRuntime, '/api/lor-studio/cases', {
    method: 'POST',
    headers: { 'x-mmhq-csrf': 'csrf-test-value' },
  });
  assert.equal(valid.statusCode, 200);
  assert.equal(dispatched, 1);
});

test('unexpected application errors are redacted at the LOR boundary', async () => {
  const activeRuntime = runtime({
    application: {
      handleRequest: async () => {
        throw new Error('protected letter body and private@example.test');
      },
    },
  });
  const response = await invoke(activeRuntime, '/api/lor-studio/cases', {
    method: 'POST',
    headers: { 'x-mmhq-csrf': 'csrf-test-value' },
  });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'lor_application_request_failed',
    message: 'The LOR Studio application request failed safely.',
  });
  assert.doesNotMatch(response.body, /protected letter|private@example/u);
});

test('frozen public snapshot contains the adapter gate and source digest declaration', async () => {
  const manifest = JSON.parse(await readFile(path.join(publicDirectory, 'FROZEN_PRESENTATION_MANIFEST.json'), 'utf8'));
  const html = await readFile(path.join(publicDirectory, 'index.html'), 'utf8');
  assert.equal(manifest.sourceSha256, '8560559341895f2973c51bdf7d7ba28ba7a9890d70c6bc6eb5976fc67371e037');
  assert.equal(createHash('sha256').update(html).digest('hex'), manifest.outputSha256);
  assert.equal(manifest.adapterVersion, 5);
  assert.deepEqual(manifest.securityTransforms, ['toast_text_only']);
  assert.match(html, new RegExp(manifest.sourceSha256, 'u'));
  assert.match(html, /data-lor-runtime="gated"/u);
  assert.match(html, /id="lorRuntimeGate"/u);
  assert.match(html, /production-adapter\.js/u);
  assert.match(html, /t\.textContent=String\(m\?\?''\)/u);
  assert.doesNotMatch(html, /t\.innerHTML=m/u);
  assert.match(html, /<\/script>\s*<script src="\/lor-studio\/production-adapter\.js\?v=5"><\/script>\s*<\/body>\s*<\/html>\s*$/u);
});
