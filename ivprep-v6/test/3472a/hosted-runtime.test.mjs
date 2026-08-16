import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createHostedWorkerHealthServer } from '../../server/agents/hosted-profile-b-runtime.mjs';
import {
  createHostedHqDependenciesFromEnvironment,
  createSupabaseHqWorkerAdapter,
  IvPrepSupabaseRest,
  SupabaseAdmissionRegistry,
} from '../../server/providers/supabase-durable-adapter.mjs';
import { FOUNDER_TEST_AGENT_ID } from '../../server/founder-paid-test-gate.mjs';
import { PROFILE_B } from '../../server/providers/provider-session-controller.mjs';

const PRODUCT_URL = 'https://tufzqxeucfugdovtjyqk.supabase.co';
const SERVICE_KEY = 's'.repeat(40);
const MODULE_ROOT = new URL('../../', import.meta.url);

function jsonResponse(value, { status = 200 } = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('hosted database binding accepts only the exact IV Prep project and handles scalar RPC results', async () => {
  assert.throws(() => new IvPrepSupabaseRest({
    url: 'https://wrong-project.supabase.co',
    serviceRoleKey: SERVICE_KEY,
    fetchImpl: async () => jsonResponse(true),
  }), /exact IV Prep Supabase/u);

  const calls = [];
  const rest = new IvPrepSupabaseRest({
    url: PRODUCT_URL,
    serviceRoleKey: SERVICE_KEY,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(true);
    },
  });
  assert.equal(await rest.rpc('ivprep_bind_provider_dispatch', {}), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${PRODUCT_URL}/rest/v1/rpc/ivprep_bind_provider_dispatch`);
  assert.equal(calls[0].options.redirect, 'error');
});

test('hosted entitlement bootstrap preserves an existing durable usage ledger', async () => {
  const operations = [];
  const rest = {
    async table(name, query, options = {}) {
      operations.push({ name, query, options });
      if (options.method == null) return [{ subject: 'wp:3472' }];
      return null;
    },
  };
  const registry = new SupabaseAdmissionRegistry({
    rest,
    founderSubjects: new Set(['wp:3472']),
    adminSubjects: new Set(),
    videoEnabled: false,
    now: () => Date.parse('2026-08-15T20:00:00Z'),
  });
  await registry.bootstrapEntitlements();
  assert.equal(operations.length, 2);
  assert.equal(operations[1].options.method, 'PATCH');
  for (const field of ['granted_video_seconds', 'consumed_video_seconds', 'reserved_video_seconds']) {
    assert.equal(Object.hasOwn(operations[1].options.body, field), false);
  }
  assert.equal(operations[1].options.body.video_enabled, false);
});

test('HQ accepts worker readiness only from the exact zero-session Profile B health shape', async () => {
  const healthy = createSupabaseHqWorkerAdapter({
    rest: {},
    healthUrl: 'https://ivprep-worker.example.test/health',
    fetchImpl: async () => jsonResponse({
      ok: true,
      workerRegistered: true,
      providerSessionsCreated: 0,
      profile: PROFILE_B,
      agent: FOUNDER_TEST_AGENT_ID,
    }),
  });
  assert.deepEqual(await healthy.assertReady(), { ok: true });

  const nonzero = createSupabaseHqWorkerAdapter({
    rest: {},
    healthUrl: 'https://ivprep-worker.example.test/health',
    fetchImpl: async () => jsonResponse({
      ok: true,
      workerRegistered: true,
      providerSessionsCreated: 1,
      profile: PROFILE_B,
      agent: FOUNDER_TEST_AGENT_ID,
    }),
  });
  assert.deepEqual(await nonzero.assertReady(), { ok: false });
});

test('hosted worker health is non-activating and reports exact registration state', () => {
  let handle;
  const server = createHostedWorkerHealthServer({
    port: 3472,
    state: { workerRegistered: true, providerSessionsCreated: 0, failedClosed: false },
    createServer(callback) {
      handle = callback;
      return { synthetic: true };
    },
  });
  assert.deepEqual(server, { synthetic: true });
  const response = {
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = String(body); },
  };
  handle({ method: 'GET', url: '/health' }, response);
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), {
    ok: true,
    workerRegistered: true,
    providerSessionsCreated: 0,
    profile: PROFILE_B,
    agent: FOUNDER_TEST_AGENT_ID,
  });
});

test('hosted foundation defaults to Founder/admin admission with paid provider creation disabled', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).endsWith('/health')) return jsonResponse({
      ok: true,
      workerRegistered: true,
      providerSessionsCreated: 0,
      profile: PROFILE_B,
      agent: FOUNDER_TEST_AGENT_ID,
    });
    if (String(url).includes('/ivprep_entitlements?')) return jsonResponse([]);
    return new Response('', { status: 201 });
  };
  try {
    const dependencies = await createHostedHqDependenciesFromEnvironment({
      IVPREP_HOSTED_RUNTIME: 'true',
      IVPREP_SUPABASE_URL: PRODUCT_URL,
      IVPREP_SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      IVPREP_FOUNDER_WP_USER_IDS: '3472',
      IVPREP_ADMIN_WP_USER_IDS: '',
      IVPREP_WORKER_HEALTH_URL: 'https://ivprep-worker.example.test/health',
      IVPREP_VIDEO_ENABLED: 'false',
      IVPREP_PAID_TEST1_ENABLED: 'false',
    });
    assert.equal(dependencies.flags.enabled, true);
    assert.equal(dependencies.flags.adminCanaryEnabled, true);
    assert.equal(dependencies.flags.videoEnabled, false);
    assert.equal(dependencies.paidTestGate, null);
    assert.equal(dependencies.providerControllerFactory, null);
    assert.deepEqual(await dependencies.runtimeState(), {
      mode: 'hosted',
      workerRegistrationState: 'READY',
      providerSessionsCreatedAtReadiness: 0,
      paidProviderCreationEnabled: false,
    });
    assert.equal(calls.some((call) => call.url.includes('/rpc/')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('hosted AAA wiring uses scoped analytics assets and actual student surfaces', async () => {
  const [page, app, pipeline, ui] = await Promise.all([
    readFile(new URL('public/aaa/index.html', MODULE_ROOT), 'utf8'),
    readFile(new URL('public/aaa/app.mjs', MODULE_ROOT), 'utf8'),
    readFile(new URL('public/analytics/browser-pipeline.mjs', MODULE_ROOT), 'utf8'),
    readFile(new URL('public/analytics/ui.mjs', MODULE_ROOT), 'utf8'),
  ]);
  assert.match(page, /\/iv-prep-on-call\/assets\/analytics\/analytics\.css/u);
  assert.match(page, /id="founder-student-video"/u);
  assert.match(page, /id="communication-analytics-test-root"/u);
  assert.match(page, /id="communication-results-anchor"/u);
  assert.match(app, /initializeAnalyticsUi\(analyticsBridge/u);
  assert.match(app, /video: 'founder-student-video'/u);
  assert.match(app, /paidProviderCreationEnabled/u);
  assert.match(pipeline, /const IVPREP_ASSET_ROOT = '\/iv-prep-on-call\/assets'/u);
  assert.match(pipeline, /new Worker\(`\$\{ANALYTICS_ROOT\}\/holistic-worker\.mjs/u);
  assert.match(pipeline, /const FACE_WORKER = `\$\{ANALYTICS_ROOT\}\/face-detector-worker\.mjs`/u);
  assert.match(ui, /overlayPolicy = null/u);
  assert.match(ui, /if \(overlayPolicy\) studentOverlay\.configure\(overlayPolicy\)/u);
});
