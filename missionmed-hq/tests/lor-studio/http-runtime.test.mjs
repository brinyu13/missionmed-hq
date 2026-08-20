import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

  get raw() {
    return Buffer.concat(this.chunks);
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
  // Asset responses are piped, so writeHead can return before the body has been written.
  if (response.statusCode !== 0 && !response.writableFinished) {
    await new Promise((resolve) => response.once('finish', resolve));
  }
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

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCX_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0xff, 0xfe, 0x0a, 0x00, 0x1b]);

function exportRuntime(options = {}) {
  return runtime({
    application: {
      handleRequest: async () => ({
        status: 200,
        binary: { body: DOCX_BYTES, contentType: DOCX_CONTENT_TYPE, filename: 'letter.docx' },
      }),
    },
    ...options,
  });
}

test('the production projection UI bundle is served, and only to authorized principals', async () => {
  // The bundle itself belongs to a concurrent lane, so the allowlist is exercised against a
  // throwaway public directory. What is under test here is runtime.mjs: that the name is
  // admitted at all, and that admitting it did not move it outside the authorization gate.
  const stagedPublic = await mkdtemp(path.join(tmpdir(), 'lor-safe-assets-'));
  await writeFile(path.join(stagedPublic, 'production-projection-ui.js'), 'globalThis.LorProductionProjectionUi = null;\n', 'utf8');
  await writeFile(path.join(stagedPublic, 'not-allowlisted.js'), 'throw new Error("should never be served");\n', 'utf8');

  try {
    const staged = (options = {}) => runtime({ publicDirectory: stagedPublic, ...options });
    const route = '/lor-studio/production-projection-ui.js';

    const authorized = await invoke(staged(), route);
    assert.equal(authorized.statusCode, 200);
    assert.match(authorized.headers['Content-Type'], /application\/javascript/u);
    assert.equal(authorized.headers['X-Robots-Tag'], 'noindex, nofollow');
    assert.match(authorized.body, /LorProductionProjectionUi/u);

    const anonymous = await invoke(staged(), route, { activeSession: null });
    assert.equal(anonymous.statusCode, 401);
    assert.match(anonymous.body, /authentication_required/u);
    assert.doesNotMatch(anonymous.body, /LorProductionProjectionUi/u);

    const expired = await invoke(staged(), route, { activeSession: session({ expiresAt: '2026-08-09T15:59:59.000Z' }) });
    assert.equal(expired.statusCode, 401);

    const unentitled = staged({ entitlementResolver: { resolve: async () => entitlement({ lorEnabled: false }) } });
    assert.equal((await invoke(unentitled, route)).statusCode, 403);

    const nonconsenting = staged({ entitlementResolver: { resolve: async () => entitlement({ canaryConsented: false }) } });
    assert.equal((await invoke(nonconsenting, route)).statusCode, 403);

    const killed = staged({ flags: { enabled: true, killSwitch: true, requireCanary: true } });
    assert.equal((await invoke(killed, route)).statusCode, 423);

    const off = staged({ flags: { enabled: false, killSwitch: false, requireCanary: true } });
    assert.equal((await invoke(off, route)).statusCode, 404);

    // Widening the allowlist by one name widened it by exactly one name.
    const sibling = await invoke(staged(), '/lor-studio/not-allowlisted.js');
    assert.equal(sibling.statusCode, 404);
    assert.equal(JSON.parse(sibling.body).error, 'lor_asset_not_found');

    const encodedTraversal = await invoke(staged(), '/lor-studio/%2e%2e%2fserver.mjs');
    assert.equal(encodedTraversal.statusCode, 404);
    assert.equal(JSON.parse(encodedTraversal.body).error, 'lor_asset_not_found');
  } finally {
    await rm(stagedPublic, { force: true, recursive: true });
  }
});

test('the binary export seam returns bytes with an attachment disposition and the full security header set', async () => {
  const response = await invoke(exportRuntime(), '/api/lor-studio/cases/case-1/final-document/export', {
    method: 'POST',
    headers: { 'x-mmhq-csrf': 'csrf-test-value' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], DOCX_CONTENT_TYPE);
  assert.equal(response.headers['Content-Length'], String(DOCX_BYTES.byteLength));
  assert.match(response.headers['Content-Disposition'], /^attachment; filename="letter\.docx"/u);
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(response.headers['X-Robots-Tag'], 'noindex, nofollow');
  // Real bytes, not JSON, and byte-exact including the non-UTF8 sequence.
  assert.equal(response.raw.equals(DOCX_BYTES), true);
});

test('every gate that precedes the binary seam still fires before a single byte is produced', async () => {
  let dispatched = 0;
  const application = {
    handleRequest: async () => {
      dispatched += 1;
      return { status: 200, binary: { body: DOCX_BYTES, contentType: DOCX_CONTENT_TYPE, filename: 'letter.docx' } };
    },
  };
  const route = '/api/lor-studio/cases/case-1/final-document/export';

  const anonymous = await invoke(runtime({ application }), route, {
    method: 'POST',
    activeSession: null,
    headers: { 'x-mmhq-csrf': 'csrf-test-value' },
  });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(JSON.parse(anonymous.body).error, 'authentication_required');

  const noCsrf = await invoke(runtime({ application }), route, { method: 'POST' });
  assert.equal(noCsrf.statusCode, 403);
  assert.equal(JSON.parse(noCsrf.body).error, 'csrf_validation_failed');

  const unentitled = await invoke(
    runtime({ application, entitlementResolver: { resolve: async () => entitlement({ canaryConsented: false }) } }),
    route,
    { method: 'POST', headers: { 'x-mmhq-csrf': 'csrf-test-value' } },
  );
  assert.equal(unentitled.statusCode, 403);
  assert.equal(JSON.parse(unentitled.body).error, 'lor_canary_consent_required');

  const killed = await invoke(
    runtime({ application, flags: { enabled: true, killSwitch: true, requireCanary: true } }),
    route,
    { method: 'POST', headers: { 'x-mmhq-csrf': 'csrf-test-value' } },
  );
  assert.equal(killed.statusCode, 423);

  const featureOff = await invoke(
    runtime({ application, flags: { enabled: false, killSwitch: false, requireCanary: true } }),
    route,
    { method: 'POST', headers: { 'x-mmhq-csrf': 'csrf-test-value' } },
  );
  assert.equal(featureOff.statusCode, 404);

  const missingApplication = await invoke(runtime(), route, {
    method: 'POST',
    headers: { 'x-mmhq-csrf': 'csrf-test-value' },
  });
  assert.equal(missingApplication.statusCode, 503);
  assert.equal(JSON.parse(missingApplication.body).error, 'lor_application_unavailable');

  assert.equal(dispatched, 0, 'no gate may be reached with the application dispatched');
});

test('the binary seam refuses active content types, unusable bodies, and filename header injection', async () => {
  const route = '/api/lor-studio/cases/case-1/final-document/export';
  const post = { method: 'POST', headers: { 'x-mmhq-csrf': 'csrf-test-value' } };

  for (const contentType of ['text/html; charset=utf-8', 'image/svg+xml', 'application/javascript', '']) {
    const response = await invoke(
      runtime({ application: { handleRequest: async () => ({ status: 200, binary: { body: DOCX_BYTES, contentType, filename: 'x.docx' } }) } }),
      route,
      post,
    );
    assert.equal(response.statusCode, 500, `content type must be refused: ${contentType}`);
    assert.equal(JSON.parse(response.body).error, 'lor_binary_response_rejected');
    assert.match(response.headers['Content-Type'], /application\/json/u);
  }

  const notBytes = await invoke(
    runtime({ application: { handleRequest: async () => ({ status: 200, binary: { body: { letter: 'secret' }, contentType: DOCX_CONTENT_TYPE } }) } }),
    route,
    post,
  );
  assert.equal(notBytes.statusCode, 500);
  assert.equal(JSON.parse(notBytes.body).error, 'lor_binary_response_rejected');
  assert.doesNotMatch(notBytes.body, /secret/u);

  const injected = await invoke(
    runtime({
      application: {
        handleRequest: async () => ({
          status: 200,
          binary: {
            body: DOCX_BYTES,
            contentType: DOCX_CONTENT_TYPE,
            filename: '../../etc/pa sswd"\r\nSet-Cookie: a=b',
          },
        }),
      },
    }),
    route,
    post,
  );
  assert.equal(injected.statusCode, 200);
  const disposition = injected.headers['Content-Disposition'];
  // The invariant is that no attacker-supplied byte can terminate the header, escape the quoted
  // filename, or traverse a path. Harmless header-looking *text* surviving inside the quoted
  // value is not injection, so this asserts the structural property rather than a word blocklist.
  assert.equal(/[\r\n]/u.test(disposition), false);
  assert.equal(disposition.includes('"'), true, 'the filename stays quoted');
  assert.match(disposition, /^attachment; filename="[A-Za-z0-9._-]+"; filename\*=UTF-8''[A-Za-z0-9._%-]+$/u);
  assert.equal(/[/\\]/u.test(disposition), false);
  assert.equal(disposition.includes('etc'), false, 'basename strips the traversal segments');
});

test('JSON responses are unaffected by the binary seam', async () => {
  const jsonRuntime = runtime({
    application: { handleRequest: async () => ({ status: 200, body: { ok: true } }) },
  });
  const response = await invoke(jsonRuntime, '/api/lor-studio/cases/case-1', {});
  assert.equal(response.statusCode, 200);
  assert.match(response.headers['Content-Type'], /application\/json/u);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
  assert.equal('Content-Disposition' in response.headers, false);
});

test('the LOR CSP admits the brand font stylesheet and font files, and nothing else new', async () => {
  const response = await invoke(runtime(), '/lor-studio/', { method: 'HEAD' });
  const csp = response.headers['Content-Security-Policy'];
  const directives = new Map(
    csp.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name, ...values] = part.split(/\s+/u);
      return [name, values];
    }),
  );

  assert.deepEqual(directives.get('font-src'), ["'self'", 'https://fonts.gstatic.com']);
  // The @font-face rules for Archivo, Rajdhani and Lora live in the Google Fonts stylesheet, so
  // font-src alone cannot lift the fallback - the stylesheet origin has to be reachable too.
  assert.deepEqual(directives.get('style-src'), ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']);

  // Everything else is untouched: no new script, connect, image, frame or form capability.
  assert.deepEqual(directives.get('default-src'), ["'self'"]);
  assert.deepEqual(directives.get('script-src'), ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(directives.get('connect-src'), ["'self'"]);
  assert.deepEqual(directives.get('img-src'), ["'self'", 'data:']);
  assert.deepEqual(directives.get('base-uri'), ["'none'"]);
  assert.deepEqual(directives.get('form-action'), ["'self'"]);
  assert.deepEqual(directives.get('frame-ancestors'), ["'self'"]);
  assert.equal(/gstatic/u.test(csp.replace(/font-src[^;]*/u, '')), false);
  assert.equal(/googleapis/u.test(csp.replace(/style-src[^;]*/u, '')), false);
});

test('frozen public snapshot contains the adapter gate and source digest declaration', async () => {
  const manifest = JSON.parse(await readFile(path.join(publicDirectory, 'FROZEN_PRESENTATION_MANIFEST.json'), 'utf8'));
  const html = await readFile(path.join(publicDirectory, 'index.html'), 'utf8');
  assert.equal(manifest.sourceSha256, '8560559341895f2973c51bdf7d7ba28ba7a9890d70c6bc6eb5976fc67371e037');
  assert.equal(createHash('sha256').update(html).digest('hex'), manifest.outputSha256);
  // Bumped 6 -> 7 when the materializer began injecting production-projection-ui.js ahead of
  // production-adapter.js. The page previously loaded no renderer at all, so the adapter had
  // nothing to hydrate into and always fell through to the closed state. This pin exists to catch
  // UNintended drift in the frozen snapshot; this drift is intended and recorded.
  assert.equal(manifest.adapterVersion, 7);
  assert.deepEqual(manifest.securityTransforms, [
    'toast_text_only',
    'prototype_script_execution_quarantine',
  ]);
  assert.match(html, new RegExp(manifest.sourceSha256, 'u'));
  assert.match(html, /data-lor-runtime="gated"/u);
  assert.match(html, /id="lorRuntimeGate"/u);
  assert.match(html, /production-adapter\.js/u);
  assert.match(html, /t\.textContent=String\(m\?\?''\)/u);
  assert.doesNotMatch(html, /t\.innerHTML=m/u);
  assert.match(html, /<script id="lorFrozenPrototypeRuntime" type="application\/x-lor-frozen-prototype">/u);
  assert.doesNotMatch(html, /<script>\s*'use strict';\s*\/\* =+ LOR STUDIO F2-LOR-1002/u);
  // Both bundles, in this exact order, immediately before </body>. The order is load-bearing:
  // production-projection-ui.js publishes the renderer factory that production-adapter.js looks
  // for on first paint, so reversing them would leave the adapter with no renderer and fall the
  // page back to the closed state - which is precisely the bug that kept Studio dark, since the
  // renderer bundle was not injected at all.
  assert.match(
    html,
    /<\/script>\s*<script src="\/lor-studio\/production-projection-ui\.js\?v=7"><\/script>\s*<script src="\/lor-studio\/production-adapter\.js\?v=7"><\/script>\s*<\/body>\s*<\/html>\s*$/u,
  );
});
