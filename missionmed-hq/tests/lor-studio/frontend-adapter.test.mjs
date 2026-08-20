import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const adapterSource = await readFile(path.resolve(testDirectory, '..', '..', 'public', 'lor-studio', 'production-adapter.js'), 'utf8');
const materializedHtml = await readFile(path.resolve(testDirectory, '..', '..', 'public', 'lor-studio', 'index.html'), 'utf8');
// The projection UI bundle is produced by a concurrent lane. When it is present the adapter is
// exercised against the real renderer; when it is not, that one test skips rather than turning
// this lane red for another lane's file.
const projectionUiSource = await readFile(
  path.resolve(testDirectory, '..', '..', 'public', 'lor-studio', 'production-projection-ui.js'),
  'utf8',
).catch(() => null);
const shell = `<!doctype html><html data-lor-runtime="gated"><body>
  <section id="lorRuntimeGate" role="status" aria-live="polite" aria-busy="true">
    <h1 id="lorRuntimeGateTitle">Checking secure access</h1>
    <p id="lorRuntimeGateMessage"></p>
    <div id="lorRuntimeGateActions"></div>
    <p id="lorRuntimeGateCode"></p>
  </section>
  <button id="dialogTrigger" type="button">Open privacy notice</button>
  <div id="modal" role="dialog"><button id="dialogClose" type="button">Understood</button></div>
  <main id="prototype">Synthetic prototype</main>
  <script id="lorFrozenPrototypeRuntime" type="application/x-lor-frozen-prototype">
    window.__FROZEN_TEST_EXECUTIONS__ = (window.__FROZEN_TEST_EXECUTIONS__ || 0) + 1;
    window.localStorage.setItem('lor-frozen-test-write', 'fixture-only');
  </script>
</body></html>`;

async function runAdapter({ url = 'https://hq.example.test/lor-studio/', response = null } = {}) {
  const dom = new JSDOM(shell, { runScripts: 'dangerously', url });
  dom.window.fetch = async () => response || {
    ok: false,
    status: 503,
    json: async () => ({ error: 'lor_application_unavailable' }),
  };
  dom.window.eval(adapterSource);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  return dom;
}

const LIVE_BOOTSTRAP = Object.freeze({
  operational: true,
  runtimeMode: 'live',
  storageMode: 'durable',
  providersReady: true,
  csrfToken: 'csrf-value',
  capabilities: { builder: true },
});

function jsonResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function studentProjection(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.student-projection.v1',
    caseId: 'case-42',
    revision: 3,
    status: 'in_progress',
    ...overrides,
  };
}

function stubProjectionUi(overrides = {}) {
  const calls = { block: [], render: [] };
  const ui = {
    presentationIsolation: 'production_projection_only',
    usesLocalStorage: false,
    canRevealPrototype: false,
    async block(input) { calls.block.push(input); },
    async renderProductionProjection(projection, meta) { calls.render.push({ projection, meta }); },
    ...overrides,
  };
  return { ui, calls };
}

/**
 * Runs the adapter against a routed fetch so the live path exercises the real API shape rather
 * than a single canned response.
 */
async function runProductionAdapter({
  url = 'https://hq.example.test/lor-studio/?case=case-42',
  routes = {},
  ui = null,
  factory = false,
} = {}) {
  const dom = new JSDOM(shell, { runScripts: 'dangerously', url });
  const requests = [];
  dom.window.fetch = async (input, init = {}) => {
    requests.push({ path: String(input), init });
    const route = routes[String(input)];
    if (!route) return jsonResponse(404, { error: 'route_not_stubbed' });
    return typeof route === 'function' ? route(init) : route;
  };
  if (ui) {
    dom.window.LorProductionProjectionUi = factory
      ? (options) => { dom.window.__UI_FACTORY_OPTIONS__ = options; return ui; }
      : ui;
  }
  dom.window.eval(adapterSource);
  for (let tick = 0; tick < 16; tick += 1) {
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  }
  return { dom, requests };
}

function assertPrototypeNeverRevealed(dom) {
  const { document, window } = { document: dom.window.document, window: dom.window };
  assert.equal(window.__FROZEN_TEST_EXECUTIONS__, undefined, 'frozen prototype script must not execute');
  assert.equal(window.__LOR_FROZEN_PROTOTYPE_READY__, undefined);
  assert.equal(window.localStorage.getItem('lor-frozen-test-write'), null);
  assert.equal(
    document.getElementById('lorFrozenPrototypeRuntime')?.type,
    'application/x-lor-frozen-prototype',
    'the prototype script stays quarantined',
  );
  assert.equal(document.querySelector('.lor-fidelity-badge'), null, 'fixture badge must never appear');
  assert.notEqual(document.documentElement.dataset.lorRuntime, 'fixture');
  assert.equal(document.getElementById('prototype').inert, true);
  assert.equal(document.getElementById('prototype').getAttribute('aria-hidden'), 'true');
}

test('materialized production document keeps the entire frozen prototype runtime inert before the governed adapter runs', () => {
  const dom = new JSDOM(materializedHtml, {
    runScripts: 'dangerously',
    url: 'https://hq.example.test/lor-studio/',
  });
  assert.equal(dom.window.localStorage.getItem('lorstudio-f2-1002'), null);
  assert.equal(dom.window.__LOR_FROZEN_PROTOTYPE_READY__, undefined);
  assert.equal(dom.window.document.getElementById('main').childElementCount, 0);
  assert.equal(dom.window.document.getElementById('lorFrozenPrototypeRuntime').type, 'application/x-lor-frozen-prototype');
});

test('production adapter keeps the prototype gated when durable runtime is unavailable', async () => {
  const dom = await runAdapter();
  const { document } = dom.window;
  assert.equal(document.documentElement.dataset.lorRuntime, 'gated');
  assert.equal(document.getElementById('prototype').inert, true);
  assert.equal(document.getElementById('prototype').getAttribute('aria-hidden'), 'true');
  assert.equal(document.getElementById('lorRuntimeGateTitle').textContent, 'LOR Studio is not ready yet');
  assert.match(document.getElementById('lorRuntimeGateCode').textContent, /lor_application_unavailable/u);
  assert.equal(dom.window.__LOR_STUDIO_RUNTIME__, undefined);
  assert.equal(dom.window.__FROZEN_TEST_EXECUTIONS__, undefined);
  assert.equal(dom.window.localStorage.getItem('lor-frozen-test-write'), null);
});

test('authentication response offers the same-origin MissionMed login handoff', async () => {
  const dom = await runAdapter({
    response: {
      ok: false,
      status: 401,
      json: async () => ({ error: 'session_expired' }),
    },
  });
  const link = dom.window.document.querySelector('#lorRuntimeGateActions a');
  assert.equal(dom.window.document.getElementById('lorRuntimeGateTitle').textContent, 'Sign in to continue');
  assert.equal(link.getAttribute('href'), '/api/auth/start?final=%2Flor-studio%2F');
});

test('adapter keeps frozen presentation blocked even when backend reports live without an authorized hydration adapter', async () => {
  const dom = await runAdapter({
    response: {
      ok: true,
      status: 200,
      json: async () => ({
        operational: true,
        runtimeMode: 'live',
        storageMode: 'durable',
        providersReady: true,
        csrfToken: 'csrf-value',
        capabilities: { builder: true },
      }),
    },
  });
  const { document } = dom.window;
  assert.equal(document.documentElement.dataset.lorRuntime, 'gated');
  assert.equal(document.getElementById('lorRuntimeGate').hidden, false);
  assert.equal(document.getElementById('prototype').inert, true);
  assert.equal(document.getElementById('lorRuntimeGateTitle').textContent, 'LOR Studio is not yet available');
  assert.match(document.getElementById('lorRuntimeGateMessage').textContent, /no authorized production hydration adapter/u);
  assert.doesNotMatch(document.getElementById('lorRuntimeGateMessage').textContent, /undefined/u);
  assert.equal(document.getElementById('lorRuntimeGateCode').textContent, 'Reference: frontend_hydration_unavailable');
  assert.deepEqual({ ...dom.window.__LOR_STUDIO_RUNTIME__ }, {
    mode: 'blocked_unhydrated',
    operational: false,
  });
  assert.equal('csrfToken' in dom.window.__LOR_STUDIO_RUNTIME__, false);
});

test('local fidelity mode is visibly labeled synthetic and never marked operational', async () => {
  const dom = await runAdapter({ url: 'http://localhost/lor-studio/?fidelity=1' });
  const badge = dom.window.document.querySelector('.lor-fidelity-badge');
  assert.equal(dom.window.document.documentElement.dataset.lorRuntime, 'fixture');
  assert.match(badge.textContent, /Synthetic fidelity fixture/u);
  assert.equal(dom.window.__LOR_STUDIO_RUNTIME__.operational, false);
  assert.equal(dom.window.__LOR_STUDIO_RUNTIME__.mode, 'synthetic_fixture');
  assert.equal(dom.window.__FROZEN_TEST_EXECUTIONS__, 1);
  assert.equal(dom.window.localStorage.getItem('lor-frozen-test-write'), 'fixture-only');
});

test('localhost does not bypass the gate unless fidelity mode is explicit', async () => {
  const dom = await runAdapter({ url: 'http://localhost/lor-studio/' });
  assert.equal(dom.window.document.documentElement.dataset.lorRuntime, 'gated');
  assert.equal(dom.window.document.querySelector('.lor-fidelity-badge'), null);
});

test('dialog adapter restores focus to the invoking control after close', async () => {
  const dom = await runAdapter({ url: 'http://localhost/lor-studio/?fidelity=1' });
  const trigger = dom.window.document.getElementById('dialogTrigger');
  const close = dom.window.document.getElementById('dialogClose');
  const modal = dom.window.document.getElementById('modal');
  trigger.focus();
  trigger.click();
  modal.classList.add('open');
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  close.focus();
  modal.classList.remove('open');
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.equal(dom.window.document.activeElement, trigger);
});

test('production mode hydrates the authoritative projection into the isolated production UI', async () => {
  const { ui, calls } = stubProjectionUi();
  const { dom, requests } = await runProductionAdapter({
    ui,
    routes: {
      '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      '/api/lor-studio/cases/case-42': jsonResponse(200, { case: studentProjection() }),
    },
  });
  const { document } = dom.window;
  const { window } = dom;

  // The projection came from the real API, addressed by the real route.
  assert.deepEqual(requests.map((entry) => entry.path), [
    '/api/lor-studio/bootstrap',
    '/api/lor-studio/cases/case-42',
  ]);
  assert.equal(requests[1].init.credentials, 'same-origin');
  assert.equal(requests[1].init.cache, 'no-store');

  // It was handed to the production UI, blocked first, and rendered with prototype reveal and
  // localStorage persistence both explicitly denied.
  assert.deepEqual(calls.block.map((entry) => entry.reasonCode), ['HYDRATION_PENDING']);
  assert.equal(calls.block[0].revealPrototype, false);
  assert.equal(calls.render.length, 1);
  assert.deepEqual(calls.render[0].projection, studentProjection());
  assert.equal(calls.render[0].meta.runtimeMode, 'live');
  assert.equal(calls.render[0].meta.caseId, 'case-42');
  assert.equal(calls.render[0].meta.projectionSchema, 'missionmed.lor.student-projection.v1');
  assert.equal(calls.render[0].meta.revealPrototype, false);
  assert.equal(calls.render[0].meta.persistToLocalStorage, false);

  // The runtime is live, the gate is down, and the CSRF token never reached the global.
  assert.equal(document.documentElement.dataset.lorRuntime, 'live');
  assert.equal(document.getElementById('lorRuntimeGate').hidden, true);
  assert.deepEqual({ ...window.__LOR_STUDIO_RUNTIME__ }, { mode: 'live', operational: true });
  assert.equal('csrfToken' in window.__LOR_STUDIO_RUNTIME__, false);
  assert.equal(JSON.stringify(window.__LOR_STUDIO_RUNTIME__).includes('csrf-value'), false);

  // Live does not mean the frozen prototype came back.
  assertPrototypeNeverRevealed(dom);
});

test('a projection UI supplied as a factory is constructed against a dedicated production mount', async () => {
  const { ui, calls } = stubProjectionUi();
  const { dom } = await runProductionAdapter({
    ui,
    factory: true,
    routes: {
      '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      '/api/lor-studio/cases/case-42': jsonResponse(200, { case: studentProjection() }),
    },
  });
  const mount = dom.window.document.getElementById('lorProductionRoot');
  assert.notEqual(mount, null, 'the adapter creates a mount the UI can own');
  assert.equal(dom.window.__UI_FACTORY_OPTIONS__.mount, mount);
  assert.equal(calls.render.length, 1);
  // The mount is exempt from the inert sweep; the prototype is not.
  assert.notEqual(mount.inert, true);
  assert.equal(mount.getAttribute('aria-hidden'), null);
  assertPrototypeNeverRevealed(dom);
});

test('a projection UI that fails the isolation contract never receives a projection', async () => {
  const variants = [
    ['reveals the prototype', { canRevealPrototype: true }],
    ['uses localStorage', { usesLocalStorage: true }],
    ['is not projection-isolated', { presentationIsolation: 'frozen_prototype' }],
    ['cannot render', { renderProductionProjection: undefined }],
    ['cannot block', { block: undefined }],
  ];

  for (const [label, overrides] of variants) {
    const { ui, calls } = stubProjectionUi(overrides);
    const { dom, requests } = await runProductionAdapter({
      ui,
      routes: {
        '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
        '/api/lor-studio/cases/case-42': jsonResponse(200, { case: studentProjection() }),
      },
    });
    const { document } = dom.window;
    const { window } = dom;
    assert.equal(calls.render.length, 0, `${label}: must not be handed a projection`);
    assert.deepEqual(requests.map((entry) => entry.path), ['/api/lor-studio/bootstrap'], `${label}: no projection fetched`);
    assert.equal(document.documentElement.dataset.lorRuntime, 'gated', label);
    assert.equal(document.getElementById('lorRuntimeGateTitle').textContent, 'LOR Studio is not yet available', label);
    assert.equal(document.getElementById('lorRuntimeGateCode').textContent, 'Reference: frontend_hydration_unavailable', label);
    assert.deepEqual({ ...window.__LOR_STUDIO_RUNTIME__ }, { mode: 'blocked_unhydrated', operational: false }, label);
    assertPrototypeNeverRevealed(dom);
  }
});

test('an unauthoritative or mismatched projection is refused instead of rendered', async () => {
  const cases = [
    ['wrong case', jsonResponse(200, { case: studentProjection({ caseId: 'case-other' }) })],
    ['unknown schema', jsonResponse(200, { case: studentProjection({ schemaVersion: 'prototype.v1' }) })],
    ['prototype marker', jsonResponse(200, { case: studentProjection({ fixture: { seeded: true } }) })],
    ['nested prototype marker', jsonResponse(200, { case: studentProjection({ builder: { syntheticData: [1] } }) })],
    ['no case envelope', jsonResponse(200, { ok: true })],
    ['forbidden', jsonResponse(403, { error: 'lor_projection_forbidden' })],
    ['server error', jsonResponse(500, { error: 'lor_projection_failed' })],
  ];

  for (const [label, projectionResponse] of cases) {
    const { ui, calls } = stubProjectionUi();
    const { dom } = await runProductionAdapter({
      ui,
      routes: {
        '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
        '/api/lor-studio/cases/case-42': projectionResponse,
      },
    });
    assert.equal(calls.render.length, 0, `${label}: nothing may be rendered`);
    assert.deepEqual(
      calls.block.map((entry) => entry.reasonCode),
      ['HYDRATION_PENDING', 'HYDRATION_BLOCKED'],
      label,
    );
    assert.equal(dom.window.document.documentElement.dataset.lorRuntime, 'gated', label);
    assert.deepEqual({ ...dom.window.__LOR_STUDIO_RUNTIME__ }, { mode: 'blocked_unhydrated', operational: false }, label);
    assertPrototypeNeverRevealed(dom);
  }
});

test('a bootstrap that is live but not durably backed never reaches the projection UI', async () => {
  for (const bootstrap of [
    { ...LIVE_BOOTSTRAP, storageMode: 'memory' },
    { ...LIVE_BOOTSTRAP, providersReady: false },
    { ...LIVE_BOOTSTRAP, fixtureBacked: true },
  ]) {
    const { ui, calls } = stubProjectionUi();
    const { dom, requests } = await runProductionAdapter({
      ui,
      routes: { '/api/lor-studio/bootstrap': jsonResponse(200, bootstrap) },
    });
    assert.equal(calls.block.length, 0);
    assert.equal(calls.render.length, 0);
    assert.deepEqual(requests.map((entry) => entry.path), ['/api/lor-studio/bootstrap']);
    assert.equal(dom.window.document.getElementById('lorRuntimeGateTitle').textContent, 'LOR Studio is not yet available');
    assertPrototypeNeverRevealed(dom);
  }
});

test('fixture mode cannot be requested into existence on a production origin', async () => {
  const { ui, calls } = stubProjectionUi();
  const { dom } = await runProductionAdapter({
    url: 'https://hq.example.test/lor-studio/?fidelity=1&case=case-42',
    ui,
    routes: {
      '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      '/api/lor-studio/cases/case-42': jsonResponse(200, { case: studentProjection() }),
    },
  });
  assert.equal(calls.render.length, 1, 'the live path still runs');
  assert.equal(dom.window.document.documentElement.dataset.lorRuntime, 'live');
  assertPrototypeNeverRevealed(dom);
});

test('with no case selected the gate stays closed and starting a case carries CSRF and idempotency', async () => {
  const { ui, calls } = stubProjectionUi();
  const { dom, requests } = await runProductionAdapter({
    url: 'https://hq.example.test/lor-studio/',
    ui,
    routes: {
      '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      '/api/lor-studio/cases': jsonResponse(201, { case: studentProjection({ caseId: 'case-new' }) }),
      '/api/lor-studio/cases/case-new': jsonResponse(200, { case: studentProjection({ caseId: 'case-new' }) }),
    },
  });
  const { document } = dom.window;

  assert.equal(document.documentElement.dataset.lorRuntime, 'gated');
  assert.equal(document.getElementById('lorRuntimeGateCode').textContent, 'Reference: case_not_selected');
  assert.equal(calls.render.length, 0, 'no case means nothing is rendered');

  const start = document.querySelector('#lorRuntimeGateActions button');
  assert.notEqual(start, null);
  start.click();
  for (let tick = 0; tick < 16; tick += 1) {
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  }

  const created = requests.find((entry) => entry.path === '/api/lor-studio/cases');
  assert.equal(created.init.method, 'POST');
  assert.equal(created.init.headers['X-MMHQ-CSRF'], 'csrf-value');
  assert.match(String(created.init.headers['Idempotency-Key']), /^.{8,200}$/u);
  assert.equal(created.init.body, '{}');
  assert.equal(calls.render.length, 1);
  assert.equal(dom.window.document.documentElement.dataset.lorRuntime, 'live');
  assertPrototypeNeverRevealed(dom);
});

test('every fail-closed gate branch is unchanged by hydration', async () => {
  const { ui } = stubProjectionUi();
  const branches = [
    [401, 'session_expired', 'Sign in to continue'],
    [403, 'lor_entitlement_required', 'LOR Studio is not enabled for this account'],
    [423, 'lor_kill_switch_active', 'LOR Studio is temporarily paused'],
    [404, 'lor_feature_disabled', 'LOR Studio is not ready yet'],
    [503, 'lor_durable_runtime_required', 'LOR Studio is not ready yet'],
  ];

  for (const [status, error, heading] of branches) {
    const { dom, requests } = await runProductionAdapter({
      ui,
      routes: { '/api/lor-studio/bootstrap': jsonResponse(status, { error }) },
    });
    const { document } = dom.window;
    assert.equal(document.documentElement.dataset.lorRuntime, 'gated', error);
    assert.equal(document.getElementById('lorRuntimeGateTitle').textContent, heading, error);
    assert.equal(document.getElementById('lorRuntimeGateCode').textContent, `Reference: ${error}`, error);
    assert.deepEqual(requests.map((entry) => entry.path), ['/api/lor-studio/bootstrap'], error);
    assert.equal(dom.window.__LOR_STUDIO_RUNTIME__, undefined, error);
    assertPrototypeNeverRevealed(dom);
  }

  const login = await runProductionAdapter({
    ui,
    routes: { '/api/lor-studio/bootstrap': jsonResponse(401, { error: 'session_expired' }) },
  });
  assert.equal(
    login.dom.window.document.querySelector('#lorRuntimeGateActions a').getAttribute('href'),
    '/api/auth/start?final=%2Flor-studio%2F',
  );
});

test('end to end: the real projection UI bundle hydrates production without ever revealing the prototype', { skip: projectionUiSource ? false : 'production-projection-ui.js not present in this worktree' }, async () => {
  const liveProjection = {
    schemaVersion: 'missionmed.lor.student-projection.v1',
    caseId: 'case-42',
    revision: 3,
    status: 'in_progress',
    builder: {
      sessionId: 'builder-session-1',
      totalSteps: 8,
      completedStepIds: ['case_basics'],
      currentStepId: 'writer_relationship',
      stepData: { case_basics: { programType: 'md' } },
    },
    studentEvidence: [],
    applicantOptions: [],
    consentReceipts: [],
    waiverReceipts: [],
    delivery: { status: 'not_started' },
    finalDocument: null,
  };

  const dom = new JSDOM(shell, { runScripts: 'dangerously', url: 'https://hq.example.test/lor-studio/?case=case-42' });
  dom.window.fetch = async (input) => {
    if (String(input) === '/api/lor-studio/bootstrap') return jsonResponse(200, LIVE_BOOTSTRAP);
    if (String(input) === '/api/lor-studio/cases/case-42') return jsonResponse(200, { case: liveProjection });
    return jsonResponse(404, { error: 'route_not_stubbed' });
  };

  // Load the concurrent lane's real bundle, then the adapter, exactly as the page does.
  dom.window.eval(projectionUiSource);
  assert.equal(typeof dom.window.LorProductionProjectionUi, 'function', 'the agreed global is a factory');
  dom.window.eval(adapterSource);
  for (let tick = 0; tick < 24; tick += 1) {
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  }

  const { document } = dom.window;
  assert.equal(document.documentElement.dataset.lorRuntime, 'live', 'the real UI drove the runtime live');
  const mount = document.getElementById('lorProductionRoot');
  assert.notEqual(mount, null);
  assert.equal(mount.className, 'lor-production-root', 'the mount matches the class the adapter stylesheet targets');
  assert.notEqual(mount.childElementCount, 0, 'the real renderer painted the projection');

  // The whole point: real production data on screen, prototype still sealed.
  assertPrototypeNeverRevealed(dom);
  assert.deepEqual({ ...dom.window.__LOR_STUDIO_RUNTIME__ }, { mode: 'live', operational: true });
  assert.equal(dom.window.localStorage.length, 0, 'production hydration wrote nothing to localStorage');
});
