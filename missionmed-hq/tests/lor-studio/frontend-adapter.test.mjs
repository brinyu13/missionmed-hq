import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM, VirtualConsole } from 'jsdom';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const adapterSource = await readFile(path.resolve(testDirectory, '..', '..', 'public', 'lor-studio', 'production-adapter.js'), 'utf8');
const materializedHtml = await readFile(path.resolve(testDirectory, '..', '..', 'public', 'lor-studio', 'index.html'), 'utf8');
const invitationAuthHtml = await readFile(
  path.resolve(testDirectory, '..', '..', 'public', 'lor-studio', 'invitation-auth.html'),
  'utf8',
);
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
  if (/^http:\/\/(?:localhost|127\.0\.0\.1).*\bfidelity=1/u.test(url)) {
    dom.window.MissionMedLorFounderApprovedApp = Object.freeze({ localFixtureReady: true });
  }
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
const CASE_42_BOOTSTRAP_PATH = '/api/lor-studio/bootstrap?case=case-42';

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
  const calls = { block: [], render: [], empty: [], commands: [] };
  const ui = {
    presentationIsolation: 'founder_approved_application_with_production_adapters',
    usesLocalStorage: false,
    canRevealPrototype: false,
    founderApprovedExecutable: true,
    async block(input) { calls.block.push(input); },
    async renderProductionProjection(projection, meta) { calls.render.push({ projection, meta }); },
    async showEmptyWorkspace(input) { calls.empty.push(input); },
    attachCommands(commands) { calls.commands.push(commands); return { attached: Object.keys(commands || {}) }; },
    ...overrides,
  };
  return {
    ui,
    calls,
    /** The transport the adapter handed the renderer, which is what the write tests drive. */
    get commands() {
      return calls.commands[calls.commands.length - 1] || null;
    },
  };
}

/**
 * jsdom has no navigation, so following a blob: download link raises a jsdomError that says so.
 * That one message is expected in the export test and is dropped; every other jsdom error still
 * reaches the console, because silencing the class wholesale would hide real page failures.
 */
function quietNavigationConsole() {
  const virtualConsole = new VirtualConsole();
  virtualConsole.sendTo(console, { omitJSDOMErrors: true });
  virtualConsole.on('jsdomError', (error) => {
    if (!/Not implemented: navigation/u.test(String(error?.message || ''))) console.error(error);
  });
  return virtualConsole;
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
  const dom = new JSDOM(shell, { runScripts: 'dangerously', url, virtualConsole: quietNavigationConsole() });
  const requests = [];
  dom.window.fetch = async (input, init = {}) => {
    requests.push({ path: String(input), init });
    const route = routes[String(input)]
      ?? (String(input) === CASE_42_BOOTSTRAP_PATH ? routes['/api/lor-studio/bootstrap'] : undefined);
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
}

test('materialized production document executes the Founder-approved application without local fixture state', () => {
  const dom = new JSDOM(materializedHtml, {
    runScripts: 'dangerously',
    url: 'https://hq.example.test/lor-studio/',
  });
  assert.equal(dom.window.localStorage.getItem('lorstudio-f2-1002'), null);
  assert.equal(dom.window.__LOR_FROZEN_PROTOTYPE_READY__, undefined);
  assert.ok(dom.window.document.getElementById('main').childElementCount > 0);
  assert.equal(dom.window.document.getElementById('lorFounderApprovedRuntime').type, 'text/javascript');
  assert.equal(dom.window.MissionMedLorFounderApprovedApp.approvedArtifactSha256, 'c249373619a45c31a1b895363fb1d3806d966c8fc413e0acdc4df0870c5a51b7');
  assert.equal(dom.window.LorProductionProjectionUi().founderApprovedExecutable, true);
});

test('anonymous candidate shell scrubs the token before any request and seals it only on user action', async () => {
  const rawToken = 't'.repeat(43);
  const requests = [];
  const dom = new JSDOM(invitationAuthHtml, {
    runScripts: 'dangerously',
    url: `https://hq.example.test/lor-studio/invitations/invitation-1#token=${rawToken}`,
    virtualConsole: quietNavigationConsole(),
    beforeParse(window) {
      window.fetch = async (input, init) => {
        requests.push({ input: String(input), init });
        return { ok: false, status: 503 };
      };
    },
  });
  const { document, window } = dom.window;
  assert.equal(window.location.hash, '');
  assert.equal(requests.length, 0);
  assert.equal(document.documentElement.outerHTML.includes(rawToken), false);
  assert.equal(window.localStorage.length, 0);
  assert.equal(window.sessionStorage.length, 0);

  document.getElementById('candidateContinue').click();
  for (let tick = 0; tick < 4; tick += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].input, '/api/lor-studio/auth/candidate/start');
  assert.equal(requests[0].init.credentials, 'same-origin');
  assert.equal(requests[0].init.redirect, 'error');
  assert.match(invitationAuthHtml, /window\.location\.assign\('\/api\/lor-studio\/auth\/start'\)/u);
  assert.doesNotMatch(invitationAuthHtml, /mode=faculty_candidate/u);
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    invitationId: 'invitation-1',
    rawToken,
  });
  assert.equal(document.documentElement.outerHTML.includes(rawToken), false);
  assert.equal(document.getElementById('candidateContinue').disabled, false);
});

test('anonymous candidate shell rejects malformed token fragments without a request', async () => {
  for (const fragment of ['', '#token=short', '#token=one&token=two', '#case=forged']) {
    let requests = 0;
    const dom = new JSDOM(invitationAuthHtml, {
      runScripts: 'dangerously',
      url: `https://hq.example.test/lor-studio/invitations/invitation-1${fragment}`,
      beforeParse(window) {
        window.fetch = async () => { requests += 1; return { ok: false, status: 503 }; };
      },
    });
    const { document, window } = dom.window;
    assert.equal(window.location.hash, '');
    assert.equal(document.getElementById('candidateContinue').disabled, true);
    document.getElementById('candidateContinue').click();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(requests, 0);
  }
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
  assert.equal(link.getAttribute('href'), '/api/lor-studio/auth/start');
});

test('case-scoped authentication also offers the bounded mentor login handoff', async () => {
  const { dom } = await runProductionAdapter({
    routes: { '/api/lor-studio/bootstrap': jsonResponse(401, { error: 'session_expired' }) },
  });
  const links = [...dom.window.document.querySelectorAll('#lorRuntimeGateActions a')];
  assert.equal(links.length, 2);
  assert.equal(
    links[1].getAttribute('href'),
    '/api/lor-studio/auth/start?case=case-42&identity_class=mentor',
  );
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
  assert.match(document.getElementById('lorRuntimeGateMessage').textContent, /Founder-approved application adapter did not pass its production contract/u);
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
  assert.equal(dom.window.__FROZEN_TEST_EXECUTIONS__, undefined);
  assert.equal(dom.window.localStorage.getItem('lor-frozen-test-write'), null);
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
    CASE_42_BOOTSTRAP_PATH,
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

test('protected faculty verification never retransmits browser token material', async () => {
  const rawToken = 's'.repeat(43);
  const { ui, calls } = stubProjectionUi();
  let verificationRequest = null;
  const facultyProjection = {
    schemaVersion: 'missionmed.lor.faculty-projection.v1',
    caseId: 'case-faculty-1',
    revision: 4,
    status: 'faculty_verified',
  };
  const { dom, requests } = await runProductionAdapter({
    url: `https://hq.example.test/lor-studio/invitations/invitation-1#token=${rawToken}`,
    ui,
    routes: {
      '/api/lor-studio/invitations/invitation-1/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      '/api/lor-studio/invitations/invitation-1/verify': (init) => {
        verificationRequest = init;
        return jsonResponse(200, {
          verification: {
            schemaVersion: 'missionmed.lor.faculty-verification-result.v2',
            verified: true,
            caseId: 'case-faculty-1',
          },
        });
      },
      '/api/lor-studio/cases/case-faculty-1': jsonResponse(200, { case: facultyProjection }),
    },
  });
  const { document, window } = dom.window;
  assert.equal(window.location.hash, '');
  assert.equal(window.location.pathname, '/lor-studio/invitations/invitation-1');
  assert.equal(document.documentElement.dataset.lorRuntime, 'verification');
  assert.equal(document.querySelector('.lorCandidateVerification__form') instanceof window.HTMLFormElement, true);
  assert.equal(document.documentElement.outerHTML.includes(rawToken), false);
  assert.equal(window.localStorage.length, 0);
  assert.equal(window.sessionStorage.length, 0);
  assert.deepEqual(requests.map((entry) => entry.path), [
    '/api/lor-studio/invitations/invitation-1/bootstrap',
  ]);
  assertPrototypeNeverRevealed(dom);

  document.getElementById('lorCandidateEmail').value = 'faculty@example.test';
  document.getElementById('lorCandidateOtp').value = '538291';
  document.querySelector('.lorCandidateVerification__form').dispatchEvent(
    new window.Event('submit', { bubbles: true, cancelable: true }),
  );
  for (let tick = 0; tick < 16; tick += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  assert.notEqual(verificationRequest, null);
  assert.equal(verificationRequest.method, 'POST');
  assert.equal(verificationRequest.credentials, 'same-origin');
  assert.equal(verificationRequest.headers['X-MMHQ-CSRF'], 'csrf-value');
  assert.match(verificationRequest.headers['Idempotency-Key'], /^[A-Za-z0-9-]{16,200}$/u);
  assert.deepEqual(JSON.parse(verificationRequest.body), {
    otpCode: '538291',
    recipientEmail: 'faculty@example.test',
  });
  assert.deepEqual(requests.map((entry) => entry.path), [
    '/api/lor-studio/invitations/invitation-1/bootstrap',
    '/api/lor-studio/invitations/invitation-1/verify',
    '/api/lor-studio/cases/case-faculty-1',
  ]);
  assert.equal(window.location.pathname, '/lor-studio/');
  assert.equal(window.location.search, '?case=case-faculty-1');
  assert.equal(window.location.hash, '');
  assert.equal(document.documentElement.outerHTML.includes(rawToken), false);
  assert.equal(JSON.stringify(window.__LOR_STUDIO_RUNTIME__).includes(rawToken), false);
  assert.equal(calls.render.length, 1);
  assert.deepEqual(calls.render[0].projection, facultyProjection);
  assert.equal(calls.render[0].meta.actorRole, 'faculty');
  assert.equal(document.documentElement.dataset.lorRuntime, 'live');
  assertPrototypeNeverRevealed(dom);
});

test('protected candidate form ignores and scrubs every browser fragment', async () => {
  for (const fragment of ['', '#token=short', '#token=one&token=two', '#case=forged']) {
    const { dom, requests } = await runProductionAdapter({
      url: `https://hq.example.test/lor-studio/invitations/invitation-1${fragment}`,
      routes: {
        '/api/lor-studio/invitations/invitation-1/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      },
    });
    const { document, window } = dom.window;
    assert.equal(window.location.hash, '');
    assert.deepEqual(requests.map((entry) => entry.path), [
      '/api/lor-studio/invitations/invitation-1/bootstrap',
    ]);
    assert.equal(
      document.querySelector('.lorCandidateVerification__form') instanceof window.HTMLFormElement,
      true,
    );
    assert.equal(document.documentElement.dataset.lorRuntime, 'verification');
    assertPrototypeNeverRevealed(dom);
  }
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
    assert.deepEqual(requests.map((entry) => entry.path), [CASE_42_BOOTSTRAP_PATH], `${label}: no projection fetched`);
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
    assert.deepEqual(requests.map((entry) => entry.path), [CASE_42_BOOTSTRAP_PATH]);
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

test('with no case selected the approved empty shell opens and starting a case carries CSRF and idempotency', async () => {
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

  assert.equal(document.documentElement.dataset.lorRuntime, 'live');
  assert.equal(document.getElementById('lorRuntimeGate').hidden, true);
  assert.equal(calls.render.length, 0, 'no case means nothing is rendered');
  assert.equal(calls.empty.length, 1, 'the approved zero-state surface is rendered');
  assert.equal(typeof calls.empty[0].startCase, 'function');

  await calls.empty[0].startCase();
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
    assert.deepEqual(requests.map((entry) => entry.path), [CASE_42_BOOTSTRAP_PATH], error);
    assert.equal(dom.window.__LOR_STUDIO_RUNTIME__, undefined, error);
    assertPrototypeNeverRevealed(dom);
  }

  const login = await runProductionAdapter({
    ui,
    routes: { '/api/lor-studio/bootstrap': jsonResponse(401, { error: 'session_expired' }) },
  });
  assert.equal(
    login.dom.window.document.querySelector('#lorRuntimeGateActions a').getAttribute('href'),
    '/api/lor-studio/auth/start',
  );
});

test('the rejected reduced projection renderer cannot take control after Ticket 024', { skip: projectionUiSource ? false : 'production-projection-ui.js not present in this worktree' }, async () => {
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
    if (String(input) === CASE_42_BOOTSTRAP_PATH) return jsonResponse(200, LIVE_BOOTSTRAP);
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
  assert.equal(document.documentElement.dataset.lorRuntime, 'gated', 'the rejected renderer must fail the Ticket 024 contract');
  const mount = document.getElementById('lorProductionRoot');
  assert.notEqual(mount, null);
  assert.equal(mount.className, 'lor-production-root', 'the mount matches the class the adapter stylesheet targets');
  assert.equal(mount.childElementCount, 0, 'the rejected renderer paints no production surface');
  assertPrototypeNeverRevealed(dom);
  assert.deepEqual({ ...dom.window.__LOR_STUDIO_RUNTIME__ }, { mode: 'blocked_unhydrated', operational: false });
  assert.equal(dom.window.localStorage.length, 0, 'production hydration wrote nothing to localStorage');
});

/* ------------------------------------------------------- the write transport the UI is handed */

/**
 * The projection UI is deliberately network-blind: it has no reference to fetch and a test in
 * production-projection-ui.test.mjs enforces that. So every write the Studio can perform is a
 * command this adapter builds, and these tests are the only place the real HTTP shape of an edit,
 * a completion, a receipt, a release and an export is pinned down.
 */
async function liveAdapterWithCommands({
  routes = {},
  projection = studentProjection(),
  url = 'https://hq.example.test/lor-studio/?case=case-42',
} = {}) {
  const harness = stubProjectionUi();
  const { dom, requests } = await runProductionAdapter({
    url,
    ui: harness.ui,
    routes: {
      '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      '/api/lor-studio/cases/case-42': jsonResponse(200, { case: projection }),
      ...routes,
    },
  });
  assert.notEqual(harness.commands, null, 'the adapter must hand the renderer a transport');
  return { dom, requests, harness, commands: harness.commands };
}

function writeRequest(requests, path) {
  const entry = requests.find((item) => item.path === path && item.init?.method !== 'GET' && item.init?.method);
  assert.notEqual(entry, undefined, `expected a write to ${path}`);
  return entry;
}

test('the transport handed to the renderer exposes only the case-bound production commands', async () => {
  const { commands } = await liveAdapterWithCommands();
  assert.deepEqual(Object.keys(commands).sort(), [
    'autosaveBuilderStep',
    'completeBuilderStep',
    'decideAiProposal',
    'exportFinalDocument',
    'inviteFaculty',
    'publishStudentEvidence',
    'readAiProposal',
    'recordReceipt',
    'releaseFinalDocument',
    'reloadCase',
    'requestAiProposal',
    'resendFacultyOtp',
    'revokeFacultyInvitation',
    'saveFacultyPrivateContent',
  ]);
});

test('an autosave is a PATCH to the builder route carrying the revision, CSRF and an idempotency key', async () => {
  const { commands, requests, dom } = await liveAdapterWithCommands({
    routes: {
      '/api/lor-studio/cases/case-42/builder': jsonResponse(200, { case: studentProjection({ revision: 4 }) }),
    },
  });

  const outcome = await commands.autosaveBuilderStep({
    caseId: 'case-42',
    expectedRevision: 3,
    stepId: 'case_basics',
    stepData: { programType: 'md', summary: 'Typed by the student' },
  });

  const patch = writeRequest(requests, '/api/lor-studio/cases/case-42/builder');
  assert.equal(patch.init.method, 'PATCH');
  assert.equal(patch.init.credentials, 'same-origin');
  assert.equal(patch.init.cache, 'no-store');
  assert.equal(patch.init.headers['X-MMHQ-CSRF'], 'csrf-value');
  assert.match(String(patch.init.headers['Idempotency-Key']), /^.{8,200}$/u);
  assert.equal(patch.init.headers['Content-Type'], 'application/json');
  // The server's builder route allowlists exactly these three fields and rejects anything else.
  assert.deepEqual(JSON.parse(patch.init.body), {
    expectedRevision: 3,
    stepId: 'case_basics',
    stepData: { programType: 'md', summary: 'Typed by the student' },
  });

  assert.equal(outcome.reached, true);
  assert.equal(outcome.status, 200);
  assert.equal(outcome.body.case.revision, 4);
  // The token stayed in the adapter closure: it is on the wire, never on the page's globals.
  assert.equal(JSON.stringify(dom.window.__LOR_STUDIO_RUNTIME__).includes('csrf-value'), false);
  assertPrototypeNeverRevealed(dom);
});

test('two writes in a row each carry a fresh idempotency key', async () => {
  const { commands, requests } = await liveAdapterWithCommands({
    routes: {
      '/api/lor-studio/cases/case-42/builder': jsonResponse(200, { case: studentProjection({ revision: 4 }) }),
    },
  });
  await commands.autosaveBuilderStep({ caseId: 'case-42', expectedRevision: 3, stepId: 'case_basics', stepData: { a: '1' } });
  await commands.autosaveBuilderStep({ caseId: 'case-42', expectedRevision: 4, stepId: 'case_basics', stepData: { a: '2' } });
  const keys = requests
    .filter((entry) => entry.path === '/api/lor-studio/cases/case-42/builder')
    .map((entry) => String(entry.init.headers['Idempotency-Key']));
  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);
});

test('step completion and receipts post exactly the fields their routes allow', async () => {
  const { commands, requests } = await liveAdapterWithCommands({
    routes: {
      '/api/lor-studio/cases/case-42/builder/complete': jsonResponse(200, { case: studentProjection({ revision: 4 }) }),
      '/api/lor-studio/cases/case-42/receipts': jsonResponse(201, { case: studentProjection({ revision: 5 }) }),
      '/api/lor-studio/cases/case-42/evidence/publish': jsonResponse(200, { case: studentProjection({ revision: 6 }) }),
    },
  });

  await commands.completeBuilderStep({ caseId: 'case-42', expectedRevision: 3, stepId: 'case_basics' });
  const complete = writeRequest(requests, '/api/lor-studio/cases/case-42/builder/complete');
  assert.equal(complete.init.method, 'POST');
  assert.deepEqual(JSON.parse(complete.init.body), { expectedRevision: 3, stepId: 'case_basics' });

  const receiptOutcome = await commands.recordReceipt({
    caseId: 'case-42',
    expectedRevision: 4,
    receiptType: 'waiver',
    receiptData: { waived: false, policyVersion: 'dr-119-v1', acknowledgment: 'I keep my access.', priorReceiptId: null },
  });
  const receipt = writeRequest(requests, '/api/lor-studio/cases/case-42/receipts');
  assert.equal(receipt.init.method, 'POST');
  assert.deepEqual(Object.keys(JSON.parse(receipt.init.body)).sort(), ['expectedRevision', 'receiptData', 'receiptType']);
  // Receipt identity, timestamp and integrity hash are server-minted and must never be asserted.
  const receiptBody = JSON.parse(receipt.init.body);
  for (const forbidden of ['id', 'recordedAt', 'receiptHash', 'actorId', 'caseId']) {
    assert.equal(forbidden in receiptBody.receiptData, false, `receiptData must not carry ${forbidden}`);
  }
  assert.equal(receiptOutcome.status, 201);

  const publicationOutcome = await commands.publishStudentEvidence({
    caseId: 'case-42',
    expectedRevision: 5,
    evidence: [{ text: 'forged' }],
  });
  const publication = writeRequest(requests, '/api/lor-studio/cases/case-42/evidence/publish');
  assert.equal(publication.init.method, 'POST');
  assert.deepEqual(JSON.parse(publication.init.body), { expectedRevision: 5 });
  assert.equal(publicationOutcome.status, 200);
});

test('invitation, faculty-private and AI transports are case-bound and carry only their route contracts', async () => {
  const base = '/api/lor-studio/cases/case-42';
  const proposal = {
    id: 'proposal/one',
    state: 'proposal',
    text: 'Grounded proposal wording.',
    provenance: { caseId: 'case-42' },
  };
  const { commands, requests } = await liveAdapterWithCommands({
    routes: {
      [`${base}/faculty-invitations`]: jsonResponse(201, { case: studentProjection({ revision: 4 }) }),
      [`${base}/faculty-invitations/otp/resend`]: jsonResponse(200, { case: studentProjection({ revision: 4 }) }),
      [`${base}/faculty-invitations/revoke`]: jsonResponse(200, { case: studentProjection({ revision: 4 }) }),
      [`${base}/faculty-private`]: jsonResponse(200, { case: studentProjection({ revision: 5 }) }),
      [`${base}/ai-proposals`]: jsonResponse(201, { proposal }),
      [`${base}/ai-proposals/proposal%2Fone`]: jsonResponse(200, { proposal }),
      [`${base}/ai-proposals/proposal%2Fone/decision`]: jsonResponse(201, {
        proposal: { ...proposal, state: 'decided' },
      }),
    },
  });

  await commands.inviteFaculty({
    caseId: 'case-42',
    expectedRevision: 3,
    recipientEmail: 'writer@example.test',
    role: 'faculty',
  });
  const invitation = writeRequest(requests, `${base}/faculty-invitations`);
  assert.equal(invitation.init.method, 'POST');
  assert.deepEqual(JSON.parse(invitation.init.body), {
    expectedRevision: 3,
    recipientEmail: 'writer@example.test',
  });

  await commands.resendFacultyOtp({
    caseId: 'case-42',
    recipientEmail: 'writer@example.test',
    invitationId: 'forged',
  });
  const resend = writeRequest(requests, `${base}/faculty-invitations/otp/resend`);
  assert.equal(resend.init.method, 'POST');
  assert.deepEqual(JSON.parse(resend.init.body), { recipientEmail: 'writer@example.test' });

  await commands.revokeFacultyInvitation({
    caseId: 'case-42',
    invitationId: 'forged',
    reason: 'forged',
  });
  const revoke = writeRequest(requests, `${base}/faculty-invitations/revoke`);
  assert.equal(revoke.init.method, 'POST');
  assert.deepEqual(JSON.parse(revoke.init.body), {});

  await commands.saveFacultyPrivateContent({
    caseId: 'case-42',
    expectedRevision: 4,
    answers: [{ prompt: 'why', answer: 'Direct observation' }],
    notes: [{ text: 'Private note' }],
    draftText: 'Private draft',
    finalDocument: { contentHash: null, id: null, mimeType: 'text/plain', text: 'Final wording' },
    documentState: 'faculty_final',
    facultyApproval: { approved: true, signatureAttested: true },
    actorId: 'forged',
    facultyId: 'forged',
  });
  const privateWrite = writeRequest(requests, `${base}/faculty-private`);
  assert.equal(privateWrite.init.method, 'PATCH');
  assert.deepEqual(Object.keys(JSON.parse(privateWrite.init.body)).sort(), [
    'answers',
    'documentState',
    'draftText',
    'expectedRevision',
    'facultyApproval',
    'finalDocument',
    'notes',
  ]);
  assert.equal(String(privateWrite.init.body).includes('forged'), false);

  await commands.requestAiProposal({ caseId: 'case-42', factIds: ['fact-1'], facts: ['forged'] });
  assert.deepEqual(JSON.parse(writeRequest(requests, `${base}/ai-proposals`).init.body), {
    factIds: ['fact-1'],
  });
  await commands.readAiProposal({ caseId: 'case-42', proposalId: 'proposal/one' });
  const proposalRead = requests.find((entry) => entry.path === `${base}/ai-proposals/proposal%2Fone`);
  assert.equal(proposalRead.init.method, 'GET');
  await commands.decideAiProposal({
    caseId: 'case-42',
    proposalId: 'proposal/one',
    action: 'edited',
    resultingText: 'Faculty-edited wording.',
    facultyId: 'forged',
  });
  const decision = writeRequest(requests, `${base}/ai-proposals/proposal%2Fone/decision`);
  assert.deepEqual(JSON.parse(decision.init.body), {
    action: 'edited',
    resultingText: 'Faculty-edited wording.',
  });
});

test('a release posts the revision and the document, and no release time in any form', async () => {
  const { commands, requests } = await liveAdapterWithCommands({
    routes: {
      '/api/lor-studio/cases/case-42/final-document/release': jsonResponse(200, { case: studentProjection({ revision: 9 }) }),
    },
  });

  await commands.releaseFinalDocument({ caseId: 'case-42', expectedRevision: 8, documentId: 'document-1' });
  const release = writeRequest(requests, '/api/lor-studio/cases/case-42/final-document/release');
  assert.equal(release.init.method, 'POST');
  assert.deepEqual(JSON.parse(release.init.body), { expectedRevision: 8, documentId: 'document-1' });
  const raw = String(release.init.body);
  for (const forbidden of ['releasedToStudentAt', 'releasedAt', 'timestamp', 'occurredAt', 'now']) {
    assert.ok(!raw.includes(forbidden), `the release body must not carry ${forbidden}`);
  }
});

test('the export is a bare GET on the real route and hands the browser a real file', async () => {
  const bytes = new Uint8Array([80, 75, 3, 4, 9, 9]);
  const exportPath = '/api/lor-studio/cases/case-42/final-document/export';
  const created = [];
  const revoked = [];

  const harness = stubProjectionUi();
  const dom = new JSDOM(shell, {
    runScripts: 'dangerously',
    url: 'https://hq.example.test/lor-studio/?case=case-42',
    virtualConsole: quietNavigationConsole(),
  });
  dom.window.URL.createObjectURL = (blob) => {
    created.push(blob);
    return 'blob:https://hq.example.test/exported-letter';
  };
  dom.window.URL.revokeObjectURL = (href) => { revoked.push(href); };

  const requests = [];
  dom.window.fetch = async (input, init = {}) => {
    requests.push({ path: String(input), init });
    if (String(input) === CASE_42_BOOTSTRAP_PATH) return jsonResponse(200, LIVE_BOOTSTRAP);
    if (String(input) === '/api/lor-studio/cases/case-42') return jsonResponse(200, { case: studentProjection() });
    if (String(input) === exportPath) {
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name) => (String(name).toLowerCase() === 'content-disposition'
            // Deliberately hostile: a traversal attempt inside the server-supplied filename.
            ? 'attachment; filename="../../etc/letter final.docx"; filename*=UTF-8\'\'%2E%2E%2F%2E%2E%2Fetc%2Fletter%20final.docx'
            : null),
        },
        blob: async () => new dom.window.Blob([bytes], { type: 'application/octet-stream' }),
        json: async () => ({}),
      };
    }
    return jsonResponse(404, { error: 'route_not_stubbed' });
  };
  dom.window.LorProductionProjectionUi = harness.ui;
  dom.window.eval(adapterSource);
  for (let tick = 0; tick < 16; tick += 1) {
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  }

  const anchors = [];
  const originalClick = dom.window.HTMLAnchorElement.prototype.click;
  dom.window.HTMLAnchorElement.prototype.click = function recordClick() {
    anchors.push({ href: this.href, download: this.download, connected: this.isConnected });
    return originalClick.call(this);
  };

  const outcome = await harness.commands.exportFinalDocument({ caseId: 'case-42' });

  const exported = requests.filter((entry) => entry.path === exportPath);
  assert.equal(exported.length, 1);
  // The route rejects ANY query parameter, precisely so a grant or privacy class can never be
  // smuggled in as one. The adapter therefore sends none.
  assert.equal(exported[0].path.includes('?'), false);
  assert.equal(exported[0].init.method, 'GET');
  assert.equal(exported[0].init.credentials, 'same-origin');
  assert.equal(exported[0].init.headers['X-MMHQ-CSRF'], undefined, 'a download is a GET and carries no CSRF header');

  assert.equal(outcome.reached, true);
  assert.equal(outcome.status, 200);
  assert.equal(outcome.downloadStarted, true);
  assert.equal(created.length, 1, 'the bytes were turned into an object URL');
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].download, 'letter_final.docx', 'the traversal is stripped to a bare, separator-free basename');
  assert.equal(anchors[0].connected, true, 'the anchor must be in the document for the click to count');
  assert.equal(dom.window.document.querySelector('a[download]'), null, 'the anchor is removed again');

  dom.window.HTMLAnchorElement.prototype.click = originalClick;
  assertPrototypeNeverRevealed(dom);
});

test('an export the server refuses comes back as a status, not as a thrown error or a file', async () => {
  const exportPath = '/api/lor-studio/cases/case-42/final-document/export';
  const { commands } = await liveAdapterWithCommands({
    routes: { [exportPath]: jsonResponse(404, { error: 'not_found', message: 'The requested recommendation case was not found.' }) },
  });
  const outcome = await commands.exportFinalDocument({ caseId: 'case-42' });
  assert.equal(outcome.reached, true);
  assert.equal(outcome.status, 404);
  assert.equal(outcome.downloadStarted, false);
});

test('a transport failure is an outcome, never an exception, so the renderer can speak plainly', async () => {
  const harness = stubProjectionUi();
  const dom = new JSDOM(shell, {
    runScripts: 'dangerously',
    url: 'https://hq.example.test/lor-studio/?case=case-42',
    virtualConsole: quietNavigationConsole(),
  });
  let live = true;
  dom.window.fetch = async (input) => {
    if (!live) throw new TypeError('Failed to fetch');
    if (String(input) === CASE_42_BOOTSTRAP_PATH) return jsonResponse(200, LIVE_BOOTSTRAP);
    if (String(input) === '/api/lor-studio/cases/case-42') return jsonResponse(200, { case: studentProjection() });
    return jsonResponse(404, { error: 'route_not_stubbed' });
  };
  dom.window.LorProductionProjectionUi = harness.ui;
  dom.window.eval(adapterSource);
  for (let tick = 0; tick < 16; tick += 1) {
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
  }
  live = false;

  for (const outcome of [
    await harness.commands.autosaveBuilderStep({ caseId: 'case-42', expectedRevision: 3, stepId: 'case_basics', stepData: {} }),
    await harness.commands.reloadCase({ caseId: 'case-42' }),
    await harness.commands.exportFinalDocument({ caseId: 'case-42' }),
  ]) {
    assert.equal(outcome.reached, false);
    assert.equal(outcome.status, 0);
  }
});

test('AI proposal transport outlives the bounded server provider timeout', async () => {
  const { commands, dom } = await liveAdapterWithCommands({
    routes: {
      '/api/lor-studio/cases/case-42/ai-proposals': jsonResponse(201, {
        proposal: { proposalId: 'proposal-1' },
      }),
    },
  });
  const delays = [];
  const originalSetTimeout = dom.window.setTimeout.bind(dom.window);
  dom.window.setTimeout = (callback, delay, ...args) => {
    delays.push(delay);
    return originalSetTimeout(callback, delay, ...args);
  };
  const outcome = await commands.requestAiProposal({ caseId: 'case-42', factIds: null });
  assert.equal(outcome.reached, true);
  assert.equal(outcome.status, 201);
  assert.deepEqual(delays, [40_000]);
});

test('a command naming a case this page was not authorized for is refused before any request', async () => {
  const { commands, requests } = await liveAdapterWithCommands();
  const before = requests.length;
  for (const outcome of [
    await commands.autosaveBuilderStep({ caseId: 'case-99', expectedRevision: 3, stepId: 'case_basics', stepData: {} }),
    await commands.completeBuilderStep({ caseId: 'case-99', expectedRevision: 3, stepId: 'case_basics' }),
    await commands.recordReceipt({ caseId: 'case-99', expectedRevision: 3, receiptType: 'consent', receiptData: {} }),
    await commands.publishStudentEvidence({ caseId: 'case-99', expectedRevision: 3 }),
    await commands.inviteFaculty({ caseId: 'case-99', expectedRevision: 3, recipientEmail: 'writer@example.test' }),
    await commands.resendFacultyOtp({ caseId: 'case-99', recipientEmail: 'writer@example.test' }),
    await commands.revokeFacultyInvitation({ caseId: 'case-99' }),
    await commands.saveFacultyPrivateContent({
      caseId: 'case-99', expectedRevision: 3, answers: [], notes: [], draftText: null,
      finalDocument: null, documentState: null, facultyApproval: null,
    }),
    await commands.requestAiProposal({ caseId: 'case-99', factIds: null }),
    await commands.readAiProposal({ caseId: 'case-99', proposalId: 'proposal-1' }),
    await commands.decideAiProposal({ caseId: 'case-99', proposalId: 'proposal-1', action: 'rejected' }),
    await commands.releaseFinalDocument({ caseId: 'case-99', expectedRevision: 3, documentId: 'document-1' }),
    await commands.exportFinalDocument({ caseId: 'case-99' }),
    await commands.reloadCase({ caseId: 'case-99' }),
  ]) {
    assert.equal(outcome.reached, false);
  }
  assert.equal(requests.length, before, 'nothing may leave the page for another case');
});

test('reloading the case is a plain GET of the authoritative projection', async () => {
  const { commands, requests } = await liveAdapterWithCommands();
  const outcome = await commands.reloadCase({ caseId: 'case-42' });
  const reads = requests.filter((entry) => entry.path === '/api/lor-studio/cases/case-42');
  assert.equal(reads.length, 2, 'the initial hydration read, then the reload');
  assert.equal(reads[1].init.method, 'GET');
  assert.equal(reads[1].init.cache, 'no-store');
  assert.equal(outcome.status, 200);
});

test('the actor role handed to the renderer is read off the projection the server chose', async () => {
  const { harness } = await liveAdapterWithCommands();
  assert.equal(harness.calls.render[0].meta.actorRole, 'student');

  const faculty = stubProjectionUi();
  const facultyProjection = {
    schemaVersion: 'missionmed.lor.faculty-projection.v1',
    caseId: 'case-42',
    revision: 7,
    status: 'faculty_review',
    studentShared: { evidence: [], applicantOptions: [], consentReceipts: [], waiverState: { decided: true, waived: false, receiptId: 'w-1' } },
    facultyPrivate: { answers: [], notes: [], draftText: null, finalDocument: { id: 'document-1', text: 'x', contentHash: 'h', mimeType: 'text/plain', releasedToStudentAt: null } },
    delivery: { status: 'not_started', destinationClass: null, deliveredAt: null },
  };
  await runProductionAdapter({
    ui: faculty.ui,
    routes: {
      '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      '/api/lor-studio/cases/case-42': jsonResponse(200, { case: facultyProjection }),
    },
  });
  assert.equal(faculty.calls.render.length, 1);
  assert.equal(faculty.calls.render[0].meta.actorRole, 'faculty');

  const mentor = stubProjectionUi();
  const mentorProjection = {
    schemaVersion: 'missionmed.lor.mentor-projection.v1',
    caseId: 'case-42',
    status: 'faculty_review',
    strategyStatus: 'faculty_review',
    nextMilestone: 'faculty_approval',
    deliveryStatus: 'not_started',
  };
  await runProductionAdapter({
    ui: mentor.ui,
    routes: {
      '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      '/api/lor-studio/cases/case-42': jsonResponse(200, { case: mentorProjection }),
    },
  });
  assert.equal(mentor.calls.render.length, 1);
  assert.equal(mentor.calls.render[0].meta.actorRole, 'mentor');
});

test('a projection schema the page cannot present is refused rather than guessed at', async () => {
  const { ui, calls } = stubProjectionUi();
  const { dom } = await runProductionAdapter({
    ui,
    routes: {
      '/api/lor-studio/bootstrap': jsonResponse(200, LIVE_BOOTSTRAP),
      '/api/lor-studio/cases/case-42': jsonResponse(200, {
        case: studentProjection({ schemaVersion: 'missionmed.lor.operational-projection.v1' }),
      }),
    },
  });
  assert.equal(calls.render.length, 0);
  assert.equal(dom.window.document.documentElement.dataset.lorRuntime, 'gated');
  assertPrototypeNeverRevealed(dom);
});
