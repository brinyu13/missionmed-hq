/**
 * Tests for public/lor-studio/production-projection-ui.js.
 *
 * The renderer is the last thing standing between a student and a screen that lies to them, so
 * these tests are written against the two ways it could lie: showing synthetic prototype content
 * as if it were their case, and claiming durable state (above all "Saved") that the server never
 * confirmed. The contract half is not asserted by inspection - a real ProductionHydrationAdapter
 * is constructed around this UI and driven end to end, so `assertProductionUi` itself is the
 * judge.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { ProductionHydrationAdapter } from '../../lor-studio/adapters/production-hydration-adapter.mjs';
import { OPERATIONAL_READINESS_CONTRACT } from '../../lor-studio/adapters/operational-readiness-adapters.mjs';
import {
  appendReceipt,
  autosaveBuilderStep,
  bindFacultyInvitation,
  bindVerifiedFaculty,
  BUILDER_STEPS,
  completeBuilderStep,
  createRecommendationCase,
  releaseFinalDocument,
  setFacultyPrivateContent,
  transitionRecommendationCase,
} from '../../lor-studio/domain/recommendation-case.js';
import { createConsentReceipt, createWaiverReceipt } from '../../lor-studio/domain/receipts.js';
import { projectCaseForActor } from '../../lor-studio/security/authorization-policy.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.resolve(
  testDirectory,
  '..',
  '..',
  'public',
  'lor-studio',
  'production-projection-ui.js',
);
const SOURCE = await readFile(SOURCE_PATH, 'utf8');

const STUDENT_ID = 'wp:42';
const CASE_ID = 'case-projection-ui';
const T0 = new Date('2026-08-09T12:00:00.000Z');
const RELEASE_AT = new Date('2026-08-09T15:00:00.000Z');
const NOW = new Date('2026-08-09T16:00:00.000Z');
const FINAL_TEXT = 'Amara has been the strongest applicant I have supervised in six years.';
const STUDENT_SCHEMA = 'missionmed.lor.student-projection.v1';

/**
 * The materialized page, reduced to the parts the renderer interacts with. The frozen prototype
 * script is included in its quarantined form and carries observable side effects, so any accidental
 * execution shows up as a failed assertion rather than as a silent pass.
 */
const SHELL = `<!doctype html><html data-lor-runtime="gated"><body data-role="student">
<section id="lorRuntimeGate" class="lor-runtime-gate" role="status">
  <div class="lor-runtime-gate__card">
    <h1 id="lorRuntimeGateTitle">Checking secure access</h1>
    <p id="lorRuntimeGateMessage"></p>
    <div id="lorRuntimeGateActions"></div>
    <p id="lorRuntimeGateCode"></p>
  </div>
</section>
<header><button class="matrixBtn" id="btnMatrix" type="button">Matrix</button></header>
<main id="main"></main>
<div id="toast" role="status"></div>
<script id="lorFrozenPrototypeRuntime" type="application/x-lor-frozen-prototype">
  window.__PROTOTYPE_EXECUTIONS__ = (window.__PROTOTYPE_EXECUTIONS__ || 0) + 1;
  window.localStorage.setItem('lorstudio-f2-1002', 'synthetic');
</script>
</body></html>`;

/** Internal vocabulary that must never reach a student's screen. */
const FORBIDDEN_IN_UI = Object.freeze([
  'HYDRATION_PENDING',
  'HYDRATION_BLOCKED',
  'reasonCode',
  'STALE_REVISION',
  'DOMAIN_INVARIANT',
  'AUTHORIZATION_DENIED',
  'INTEGRATION_DISABLED',
  'recommendation_cases',
  'supabase',
  'TypeError',
  'ValidationError',
  'at Object.',
  'stack',
]);

function deterministicIdFactory(prefix) {
  let value = 0;
  return () => `${prefix}-${++value}`;
}

function eligible() {
  return {
    studentId: STUDENT_ID,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
    producerStatus: 'VERIFIED_TEST_FIXTURE',
  };
}

function stepDataFor(index) {
  return { acknowledged: true, index, summary: `Step ${index + 1} content` };
}

/** A case mid-builder: three steps complete, a fourth autosaved but not completed. */
function draftCase() {
  const idFactory = deterministicIdFactory('id');
  let record = createRecommendationCase({
    id: CASE_ID,
    studentId: STUDENT_ID,
    now: T0,
    builderSessionId: 'builder-session-1',
    idFactory,
  });
  record = appendReceipt(record, {
    actorId: STUDENT_ID,
    receiptType: 'consent',
    receipt: createConsentReceipt({
      caseId: CASE_ID,
      studentId: STUDENT_ID,
      scopes: ['builder_autosave', 'faculty_handoff'],
      policyVersion: 'dr-119-v1',
      recordedAt: T0,
      idFactory,
    }),
    now: T0,
  });
  for (let index = 0; index < 3; index += 1) {
    record = autosaveBuilderStep(record, {
      actorId: STUDENT_ID,
      stepId: BUILDER_STEPS[index],
      stepData: stepDataFor(index),
      now: new Date(T0.valueOf() + index * 2_000),
    });
    record = completeBuilderStep(record, {
      actorId: STUDENT_ID,
      stepId: BUILDER_STEPS[index],
      now: new Date(T0.valueOf() + index * 2_000 + 1_000),
    });
  }
  return autosaveBuilderStep(record, {
    actorId: STUDENT_ID,
    stepId: BUILDER_STEPS[3],
    stepData: stepDataFor(3),
    now: new Date(T0.valueOf() + 10_000),
  });
}

/** A case carried all the way through faculty approval and an explicit release to the student. */
function releasedCase({ waived = false, released = true } = {}) {
  const idFactory = deterministicIdFactory('rid');
  let record = createRecommendationCase({
    id: CASE_ID,
    studentId: STUDENT_ID,
    now: T0,
    builderSessionId: 'builder-session-2',
    idFactory,
  });
  record = appendReceipt(record, {
    actorId: STUDENT_ID,
    receiptType: 'waiver',
    receipt: createWaiverReceipt({
      caseId: CASE_ID,
      studentId: STUDENT_ID,
      waived,
      policyVersion: 'dr-119-v1',
      acknowledgment: waived ? 'I waive access.' : 'I retain access to the final letter.',
      recordedAt: T0,
      idFactory,
    }),
    now: T0,
  });
  for (const [index, stepId] of BUILDER_STEPS.entries()) {
    record = autosaveBuilderStep(record, {
      actorId: STUDENT_ID,
      stepId,
      stepData: stepDataFor(index),
      now: new Date(T0.valueOf() + index * 2_000),
    });
    record = completeBuilderStep(record, {
      actorId: STUDENT_ID,
      stepId,
      now: new Date(T0.valueOf() + index * 2_000 + 1_000),
    });
  }
  const recipientEmailHash = sha256('writer@example.test');
  record = bindFacultyInvitation(record, {
    actorId: STUDENT_ID,
    invitationId: 'invite-1',
    recipientEmailHash,
    now: new Date('2026-08-09T13:00:00.000Z'),
  });
  record = bindVerifiedFaculty(record, {
    actorId: 'faculty-1',
    invitationId: 'invite-1',
    facultyId: 'faculty-1',
    recipientEmailHash,
    now: new Date('2026-08-09T13:05:00.000Z'),
  });
  record = transitionRecommendationCase(record, {
    actorId: 'faculty-1',
    toStatus: 'faculty_review',
    now: new Date('2026-08-09T13:10:00.000Z'),
  });
  record = setFacultyPrivateContent(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    draftText: 'FACULTY PRIVATE DRAFT',
    finalDocument: { id: 'document-1', text: FINAL_TEXT },
    documentState: 'faculty_final',
    facultyApproval: {
      approved: true,
      approvedAt: '2026-08-09T14:30:00.000Z',
      facultyId: 'faculty-1',
      signatureAttested: true,
    },
    now: new Date('2026-08-09T14:30:00.000Z'),
  });
  // The aggregate refuses outright to release a waived letter, so a waived fixture stops here:
  // approved and finished, but never handed to the student.
  if (waived || !released) return record;
  return releaseFinalDocument(record, {
    actorId: 'faculty-1',
    facultyId: 'faculty-1',
    caseId: record.id,
    documentId: 'document-1',
    expectedRevision: record.revision,
    now: RELEASE_AT,
  });
}

function studentProjection(record) {
  return projectCaseForActor({
    actor: { id: STUDENT_ID, role: 'student' },
    caseRecord: record,
    entitlement: eligible(),
    now: NOW,
  });
}

/**
 * The faculty projection, produced by the same authorization policy the API uses. Obtaining one
 * at all is the server's statement that this actor is the recipient-bound, verified writer: if the
 * binding did not hold, projectCaseForActor would throw rather than return.
 */
function facultyProjection(record) {
  return projectCaseForActor({
    actor: { id: 'faculty-1', role: 'faculty' },
    caseRecord: record,
    entitlement: eligible(),
    now: NOW,
  });
}

/** A JSON-safe, mutable copy - the hydration adapter hands the renderer a structuredClone too. */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function liveContext(caseId) {
  return {
    runtimeMode: 'live',
    actorRole: 'student',
    projectionSchema: STUDENT_SCHEMA,
    caseId,
    revealPrototype: false,
    persistToLocalStorage: false,
  };
}

/**
 * Storage and network are removed from the window rather than merely observed: any access is both
 * recorded and thrown, so a regression fails loudly instead of quietly incrementing a counter.
 */
function createHarness({ createMount = true } = {}) {
  const dom = new JSDOM(SHELL, { runScripts: 'dangerously', url: 'https://hq.example.test/lor-studio/' });
  const win = dom.window;
  const storageTouches = [];
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(win, name, {
      configurable: true,
      get() {
        storageTouches.push(name);
        throw new Error(`${name} is not available to the production projection UI`);
      },
    });
  }
  const cookieTouches = [];
  Object.defineProperty(win.document, 'cookie', {
    configurable: true,
    get() {
      cookieTouches.push('read');
      return '';
    },
    set() {
      cookieTouches.push('write');
    },
  });
  const networkCalls = [];
  for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) {
    win[name] = (...args) => {
      networkCalls.push([name, args]);
      throw new Error('network access is not available to the production projection UI');
    };
  }

  win.eval(SOURCE);

  let mount = null;
  if (createMount) {
    mount = win.document.createElement('div');
    mount.id = 'lorProductionRoot';
    mount.className = 'lor-production-root';
    win.document.body.appendChild(mount);
  }
  const ui = win.LorProductionProjectionUi({ mount, document: win.document });
  return {
    dom,
    win,
    ui,
    storageTouches,
    cookieTouches,
    networkCalls,
    get mount() {
      return win.document.getElementById('lorProductionRoot');
    },
    text() {
      return win.document.getElementById('lorProductionRoot').textContent;
    },
  };
}

function assertPrototypeStillQuarantined(harness) {
  const { win } = harness;
  const frozen = win.document.getElementById('lorFrozenPrototypeRuntime');
  assert.ok(frozen, 'the quarantined prototype script must still be present');
  assert.equal(frozen.getAttribute('type'), 'application/x-lor-frozen-prototype');
  assert.equal(win.document.querySelector('script[data-lor-fixture-runtime]'), null);
  assert.equal(win.__LOR_FROZEN_PROTOTYPE_READY__, undefined);
  assert.equal(win.__PROTOTYPE_EXECUTIONS__, undefined);
  assert.equal(harness.mount.querySelector('script'), null);
  assert.equal(harness.mount.querySelector('iframe'), null);
}

function assertNoInternalLeak(harness) {
  const rendered = harness.text();
  for (const token of FORBIDDEN_IN_UI) {
    assert.ok(
      !rendered.includes(token),
      `student-facing surface leaked internal detail: ${token}`,
    );
  }
}

function assertNoInlineHandlers(harness) {
  for (const element of harness.mount.querySelectorAll('*')) {
    for (const attribute of element.attributes) {
      assert.ok(
        !attribute.name.toLowerCase().startsWith('on'),
        `inline handler attribute rendered: ${attribute.name}`,
      );
    }
  }
}

function readyHealthSnapshot() {
  const dependencies = {};
  for (const name of OPERATIONAL_READINESS_CONTRACT.dependencies) {
    dependencies[name] = { state: 'ready' };
  }
  return {
    schemaVersion: 'missionmed.lor.dependency-health.v1',
    status: 'ready',
    productionOperational: true,
    dependencies,
  };
}

function liveBootstrap(caseId) {
  return {
    operational: true,
    runtimeMode: 'live',
    storageMode: 'durable',
    providersReady: true,
    allDependenciesReady: true,
    authenticated: true,
    authorizationSource: 'server_verified_session_crosswalk',
    actorId: STUDENT_ID,
    actorRole: 'student',
    caseId,
    projectionSchema: STUDENT_SCHEMA,
  };
}

function hydrationAdapterFor(ui, projection) {
  return new ProductionHydrationAdapter({
    bootstrapLoader: {
      source: 'protected_lor_bootstrap',
      fixtureBacked: false,
      load: async () => liveBootstrap(projection.caseId),
    },
    dependencyHealth: {
      metadataOnly: true,
      snapshot: async () => readyHealthSnapshot(),
    },
    projectionLoader: {
      source: 'durable_repository',
      fixtureBacked: false,
      loadProductionProjection: async (binding) => ({
        schemaVersion: 'missionmed.lor.hydration-envelope.v1',
        authorizationSource: 'server_authorization_policy',
        actorId: binding.actorId,
        actorRole: binding.actorRole,
        caseId: binding.caseId,
        projectionSchema: binding.projectionSchema,
        projection: plain(projection),
      }),
    },
    ui,
    clock: () => NOW,
  });
}

/* ------------------------------------------------------------------ contract */

test('the factory produces an object the server-side assertProductionUi accepts verbatim', () => {
  const harness = createHarness();
  const { ui } = harness;
  assert.equal(ui.presentationIsolation, 'production_projection_only');
  assert.equal(ui.usesLocalStorage, false);
  assert.equal(ui.canRevealPrototype, false);
  assert.equal(typeof ui.block, 'function');
  assert.equal(typeof ui.renderProductionProjection, 'function');

  // Constructing the real adapter is the assertion: assertProductionUi runs inside it.
  const adapter = hydrationAdapterFor(ui, studentProjection(draftCase()));
  assert.ok(adapter instanceof ProductionHydrationAdapter);
});

test('the isolation flags cannot be flipped after the adapter has read them', () => {
  const { ui } = createHarness();
  assert.throws(() => {
    ui.canRevealPrototype = true;
  }, TypeError);
  assert.throws(() => {
    ui.usesLocalStorage = true;
  }, TypeError);
  assert.equal(ui.canRevealPrototype, false);
  assert.equal(ui.usesLocalStorage, false);
});

test('a full production hydration paints the durable case and touches no storage or network', async () => {
  const harness = createHarness();
  const projection = studentProjection(releasedCase());
  const adapter = hydrationAdapterFor(harness.ui, projection);

  const result = await adapter.hydrate({ caseId: CASE_ID });

  assert.deepEqual({ ...result }, {
    hydrated: true,
    runtimeMode: 'live',
    caseId: CASE_ID,
    fixtureRevealed: false,
    localStorageUsed: false,
  });
  assert.equal(harness.storageTouches.length, 0);
  assert.equal(harness.cookieTouches.length, 0);
  assert.equal(harness.networkCalls.length, 0);
  assertPrototypeStillQuarantined(harness);
  assertNoInlineHandlers(harness);
  assertNoInternalLeak(harness);

  const rendered = harness.text();
  assert.match(rendered, /Faculty review/u);
  assert.match(rendered, new RegExp(`Case ${CASE_ID}`, 'u'));
  assert.match(rendered, new RegExp(`Version ${projection.revision}`, 'u'));
  assert.match(rendered, /8 of 8 steps complete · 100%/u);
  assert.ok(rendered.includes(FINAL_TEXT), 'the released letter text must be shown');
});

/* ------------------------------------------------ projection rendering fidelity */

test('the eight-step builder renders per-step state and honest progress', async () => {
  const harness = createHarness();
  const projection = plain(studentProjection(draftCase()));
  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));

  const rail = harness.mount.querySelector('.stepRail');
  const buttons = [...rail.querySelectorAll('button')];
  assert.equal(buttons.length, 8);
  assert.deepEqual(buttons.map((button) => button.dataset.step), [...BUILDER_STEPS]);
  assert.equal(buttons.filter((button) => button.className.includes('done')).length, 3);

  const pipe = harness.mount.querySelector('.pipe');
  assert.equal(pipe.querySelectorAll('i.done').length, 3);
  assert.equal(pipe.querySelectorAll('i.on').length, 1);

  const rendered = harness.text();
  assert.match(rendered, /3 of 8 steps complete · 38%/u);
  assert.match(rendered, /Saved, not yet marked complete\./u);
  assert.match(rendered, /Not started\./u);
  // The autosaved fourth step is the default selection, so its saved values are on screen.
  assert.match(rendered, /Step 4 content/u);
  assert.match(rendered, /Consent recorded/u);
  assert.match(rendered, /You have not recorded a waiver decision yet\./u);
  assertNoInternalLeak(harness);
  assertNoInlineHandlers(harness);
});

test('selecting a step shows that step and never reaches for storage or the network', async () => {
  const harness = createHarness();
  await harness.ui.renderProductionProjection(plain(studentProjection(draftCase())), liveContext(CASE_ID));

  const first = harness.mount.querySelector('button[data-step="case_basics"]');
  first.dispatchEvent(new harness.win.Event('click', { bubbles: true }));

  assert.match(harness.text(), /Step 1 content/u);
  assert.equal(harness.storageTouches.length, 0);
  assert.equal(harness.networkCalls.length, 0);
  assertPrototypeStillQuarantined(harness);
});

test('an unreleased letter is never described as released', async () => {
  const harness = createHarness();
  await harness.ui.renderProductionProjection(plain(studentProjection(draftCase())), liveContext(CASE_ID));
  const rendered = harness.text();
  assert.match(rendered, /No finished letter has been released to you/u);
  assert.ok(!rendered.includes('Released'), 'an unreleased case must not show a released marker');
});

test('a waived case shows the waiver decision and withholds the letter', async () => {
  const harness = createHarness();
  const projection = plain(studentProjection(releasedCase({ waived: true })));
  assert.equal(projection.finalDocument, null, 'the server must withhold a waived letter');

  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));
  const rendered = harness.text();
  assert.match(rendered, /You waived your right to read the finished letter\./u);
  assert.match(rendered, /the finished letter is not shared with you/u);
  assert.ok(!rendered.includes(FINAL_TEXT), 'a waived case must never show letter wording');
});

test('a released letter is shown with the release timestamp the server recorded', async () => {
  const harness = createHarness();
  const projection = plain(studentProjection(releasedCase()));
  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));
  const rendered = harness.text();
  assert.match(rendered, /Released 2026-08-09 15:00 UTC/u);
  assert.ok(rendered.includes(FINAL_TEXT));
  assert.match(rendered, /You kept your right to read the finished letter\./u);
});

test('student data is rendered as text, never as markup', async () => {
  const harness = createHarness();
  const projection = plain(studentProjection(draftCase()));
  projection.builder.stepData.case_basics = {
    summary: '<img src=x onerror="window.__XSS__=true">',
  };
  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));
  harness.mount
    .querySelector('button[data-step="case_basics"]')
    .dispatchEvent(new harness.win.Event('click', { bubbles: true }));

  assert.equal(harness.mount.querySelector('img'), null);
  assert.equal(harness.win.__XSS__, undefined);
  assert.match(harness.text(), /<img src=x onerror=/u);
  assertNoInlineHandlers(harness);
});

/* ----------------------------------------------------------------- isolation */

test('the source references no storage, no network, no eval and no HTML sinks', () => {
  // Access patterns, not bare words: the file is allowed to name `localStorageUsed: false` in the
  // result it reports back to the hydration adapter, but it may not touch the API.
  const forbidden = [
    'localStorage.',
    'localStorage[',
    'sessionStorage.',
    'sessionStorage[',
    'indexedDB',
    'getItem',
    'setItem',
    'removeItem',
    '.cookie',
    'innerHTML',
    'outerHTML',
    'insertAdjacentHTML',
    'document.write',
    'eval(',
    'new Function',
    'fetch(',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'sendBeacon',
    'import(',
  ];
  // Comments are excluded so the file may still describe what it refuses to do.
  const code = SOURCE
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  for (const token of forbidden) {
    assert.ok(!code.includes(token), `production projection UI must not reference ${token}`);
  }
});

test('block refuses to reveal the prototype and closes the surface before refusing', async () => {
  const harness = createHarness();
  await harness.ui.renderProductionProjection(plain(studentProjection(draftCase())), liveContext(CASE_ID));
  assert.match(harness.text(), /Eight-step builder/u);

  await assert.rejects(
    () => harness.ui.block({ reasonCode: 'HYDRATION_BLOCKED', revealPrototype: true }),
    /cannot reveal the frozen prototype/u,
  );

  assert.ok(!harness.text().includes('Eight-step builder'), 'the workspace must be torn down');
  assert.match(harness.text(), /LOR Studio cannot open your case right now/u);
  assertPrototypeStillQuarantined(harness);
});

test('rendering is refused when something else has already un-quarantined the prototype', async () => {
  const harness = createHarness();
  const revealed = harness.win.document.createElement('script');
  revealed.dataset.lorFixtureRuntime = 'active';
  harness.win.document.body.appendChild(revealed);

  await assert.rejects(
    () => harness.ui.renderProductionProjection(plain(studentProjection(draftCase())), liveContext(CASE_ID)),
    /not quarantined/u,
  );
  assert.ok(!harness.text().includes('Eight-step builder'));
  assert.match(harness.text(), /LOR Studio cannot open your case right now/u);
});

test('rendering is refused when the caller asks for prototype reveal or local persistence', async () => {
  const harness = createHarness();
  const projection = plain(studentProjection(draftCase()));

  await assert.rejects(
    () => harness.ui.renderProductionProjection(projection, {
      ...liveContext(CASE_ID),
      revealPrototype: true,
    }),
    /prototype and storage isolation/u,
  );
  await assert.rejects(
    () => harness.ui.renderProductionProjection(projection, {
      ...liveContext(CASE_ID),
      persistToLocalStorage: true,
    }),
    /prototype and storage isolation/u,
  );
  await assert.rejects(
    () => harness.ui.renderProductionProjection(projection, {
      ...liveContext(CASE_ID),
      runtimeMode: 'fixture',
    }),
    /requires the live runtime/u,
  );
  assert.ok(!harness.text().includes('Eight-step builder'));
  assertPrototypeStillQuarantined(harness);
});

test('a non-student projection is refused rather than rendered as a student workspace', async () => {
  const harness = createHarness();
  await assert.rejects(
    () => harness.ui.renderProductionProjection(
      {
        schemaVersion: 'missionmed.lor.mentor-projection.v1',
        caseId: CASE_ID,
        status: 'draft',
        strategyStatus: null,
        nextMilestone: null,
        deliveryStatus: null,
      },
      { ...liveContext(CASE_ID), actorRole: 'mentor', projectionSchema: 'missionmed.lor.mentor-projection.v1' },
    ),
    /student case view only/u,
  );
  assert.equal(harness.mount.querySelector('.stepRail'), null);
});

test('a hydration failure leaves a closed, honest screen and no case content', async () => {
  const harness = createHarness();
  const adapter = new ProductionHydrationAdapter({
    bootstrapLoader: {
      source: 'protected_lor_bootstrap',
      fixtureBacked: false,
      load: async () => ({ operational: false, runtimeMode: 'unavailable' }),
    },
    dependencyHealth: { metadataOnly: true, snapshot: async () => readyHealthSnapshot() },
    projectionLoader: {
      source: 'durable_repository',
      fixtureBacked: false,
      loadProductionProjection: async () => null,
    },
    ui: harness.ui,
    clock: () => NOW,
  });

  const result = await adapter.hydrate({ caseId: CASE_ID });
  assert.equal(result.hydrated, false);
  assert.equal(result.fixtureRevealed, false);
  assert.equal(result.localStorageUsed, false);
  assert.match(harness.text(), /LOR Studio cannot open your case right now/u);
  assert.equal(harness.mount.querySelector('.stepRail'), null);
  assert.equal(harness.storageTouches.length, 0);
  assertPrototypeStillQuarantined(harness);
  assertNoInternalLeak(harness);
});

/* -------------------------------------------------------------------- states */

const STATE_EXPECTATIONS = Object.freeze({
  loading: 'Loading your recommendation case',
  empty: 'You have not started a recommendation case',
  saving: 'Saving your change',
  save_failed: 'That change was not saved',
  version_conflict: 'This case changed somewhere else',
  unauthorized: 'Sign in again to continue',
  case_not_found: 'We could not open this case',
  durable_runtime_unavailable: 'LOR Studio cannot open your case right now',
  provider_unavailable: 'A service LOR Studio depends on is offline',
  network_failure: 'We could not reach MissionMed',
  server_failure: 'Something went wrong on our side',
});

test('every state the renderer can express has user-safe copy and leaks nothing internal', () => {
  const harness = createHarness();
  const names = harness.win.MissionMedLorProductionProjectionUi.STATE_NAMES;
  assert.deepEqual(
    [...names].sort(),
    [...Object.keys(STATE_EXPECTATIONS), 'saved'].sort(),
    'every declared state must be covered by this test',
  );

  for (const [name, title] of Object.entries(STATE_EXPECTATIONS)) {
    harness.ui.showState(name);
    const rendered = harness.text();
    assert.ok(rendered.includes(title), `state ${name} must render its intended title`);
    assert.equal(harness.mount.querySelector('#lorProductionState').dataset.state, name);
    assertNoInternalLeak(harness);
  }
  assert.equal(harness.storageTouches.length, 0);
  assert.equal(harness.networkCalls.length, 0);
});

test('every failure state tells the student that nothing was stored', () => {
  const harness = createHarness();
  for (const name of [
    'save_failed',
    'version_conflict',
    'unauthorized',
    'case_not_found',
    'durable_runtime_unavailable',
    'provider_unavailable',
    'network_failure',
    'server_failure',
  ]) {
    harness.ui.showState(name);
    assert.match(
      harness.text(),
      /(nothing was stored|Nothing was saved|your change was not saved)/u,
      `state ${name} must say plainly that nothing was stored`,
    );
  }
});

test('block maps internal reason codes to safe copy and never prints the code', async () => {
  const harness = createHarness();
  const cases = [
    ['HYDRATION_PENDING', 'Loading your recommendation case'],
    ['HYDRATION_BLOCKED', 'LOR Studio cannot open your case right now'],
    ['PROVIDER_UNAVAILABLE', 'A service LOR Studio depends on is offline'],
    ['UNAUTHORIZED', 'Sign in again to continue'],
    ['CASE_NOT_FOUND', 'We could not open this case'],
    ['SOME_UNMAPPED_INTERNAL_CODE', 'LOR Studio cannot open your case right now'],
  ];
  for (const [reasonCode, title] of cases) {
    const outcome = await harness.ui.block({ reasonCode, revealPrototype: false });
    assert.equal(outcome.blocked, true);
    assert.equal(outcome.prototypeRevealed, false);
    assert.ok(harness.text().includes(title), `reason ${reasonCode} must render its mapped copy`);
    assert.ok(!harness.text().includes(reasonCode), 'the raw reason code must never be shown');
    assertNoInternalLeak(harness);
  }
});

test('an unknown state name is refused rather than invented', () => {
  const { ui } = createHarness();
  assert.throws(() => ui.showState('everything_is_fine'), /Unknown LOR Studio presentation state/u);
});

/* --------------------------------------------------------------- saved discipline */

async function renderedHarness() {
  const harness = createHarness();
  const projection = plain(studentProjection(draftCase()));
  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));
  return { harness, projection };
}

function acknowledgement(projection, { status = 200, revision } = {}) {
  return {
    status,
    body: { case: { ...projection, revision: revision ?? projection.revision + 1 } },
  };
}

test('a freshly rendered case shows no saved indicator', async () => {
  const { harness } = await renderedHarness();
  assert.ok(!harness.text().includes('Saved to your account'));
  assert.equal(harness.ui.state, 'loaded');
  assert.equal(harness.ui.saveInFlight, false);
});

test('the saved indicator cannot be produced through showState', async () => {
  const { harness } = await renderedHarness();
  assert.throws(() => harness.ui.showState('saved'), /only available through markSaved/u);
  assert.ok(!harness.text().includes('Saved to your account'));
});

test('markSaved without a write in flight refuses and changes nothing on screen', async () => {
  const { harness, projection } = await renderedHarness();
  const before = harness.text();
  const outcome = harness.ui.markSaved(acknowledgement(projection));
  assert.deepEqual({ ...outcome }, { saved: false, reason: 'no_write_in_flight' });
  assert.equal(harness.text(), before);
  assert.ok(!harness.text().includes('Saved to your account'));
});

test('saving alone never claims saved', async () => {
  const { harness } = await renderedHarness();
  harness.ui.markSaving({ stepId: 'case_basics' });
  assert.equal(harness.ui.state, 'saving');
  assert.match(harness.text(), /It is not stored until MissionMed confirms it\./u);
  assert.ok(!harness.text().includes('Saved to your account'));
});

test('a rejected write cannot produce a saved indicator', async () => {
  const { harness, projection } = await renderedHarness();
  harness.ui.markSaving({ stepId: 'case_basics' });
  const outcome = harness.ui.markSaved(acknowledgement(projection, { status: 409 }));
  assert.equal(outcome.saved, false);
  assert.equal(outcome.reason, 'server_did_not_accept');
  assert.equal(harness.ui.state, 'version_conflict');
  assert.ok(!harness.text().includes('Saved to your account'));
  assert.match(harness.text(), /This case changed somewhere else/u);
});

test('an accepted status with an unadvanced revision cannot produce a saved indicator', async () => {
  const { harness, projection } = await renderedHarness();
  harness.ui.markSaving({ stepId: 'case_basics' });
  const outcome = harness.ui.markSaved(
    acknowledgement(projection, { revision: projection.revision }),
  );
  assert.equal(outcome.saved, false);
  assert.equal(outcome.reason, 'server_revision_did_not_advance');
  assert.ok(!harness.text().includes('Saved to your account'));
  assert.equal(harness.ui.renderedRevision, projection.revision);
});

test('an acknowledgement for a different case cannot produce a saved indicator', async () => {
  const { harness, projection } = await renderedHarness();
  harness.ui.markSaving({ stepId: 'case_basics' });
  const other = { ...projection, caseId: 'some-other-case', revision: projection.revision + 1 };
  const outcome = harness.ui.markSaved({ status: 200, body: { case: other } });
  assert.equal(outcome.saved, false);
  assert.equal(outcome.reason, 'acknowledgement_names_another_case');
  assert.ok(!harness.text().includes('Saved to your account'));
});

test('an acknowledgement with no case projection cannot produce a saved indicator', async () => {
  const { harness } = await renderedHarness();
  harness.ui.markSaving({ stepId: 'case_basics' });
  const outcome = harness.ui.markSaved({ status: 200, body: {} });
  assert.equal(outcome.saved, false);
  assert.equal(outcome.reason, 'acknowledgement_not_a_case_projection');
  assert.ok(!harness.text().includes('Saved to your account'));
});

test('saved appears only after the server returns an advanced durable revision', async () => {
  const { harness, projection } = await renderedHarness();
  harness.ui.markSaving({ stepId: 'case_basics' });
  const outcome = harness.ui.markSaved(acknowledgement(projection));

  assert.equal(outcome.saved, true);
  assert.equal(outcome.revision, projection.revision + 1);
  assert.equal(harness.ui.state, 'saved');
  assert.equal(harness.ui.saveInFlight, false);
  assert.match(harness.text(), /Saved to your account/u);
  assert.match(harness.text(), /MissionMed accepted and stored this change\./u);
  assert.match(harness.text(), new RegExp(`Version ${projection.revision + 1}`, 'u'));
  assert.equal(harness.storageTouches.length, 0);
  assert.equal(harness.networkCalls.length, 0);
  assertPrototypeStillQuarantined(harness);
  assertNoInternalLeak(harness);
});

test('markSaveFailed tears the workspace down for states the renderer can no longer vouch for', async () => {
  const { harness } = await renderedHarness();
  harness.ui.markSaving({ stepId: 'case_basics' });
  harness.ui.markSaveFailed('unauthorized');
  assert.equal(harness.ui.state, 'unauthorized');
  assert.equal(harness.mount.querySelector('.stepRail'), null);
  assert.equal(harness.ui.saveInFlight, false);
});

test('markSaving is refused when no case is on screen', () => {
  const { ui } = createHarness();
  assert.throws(() => ui.markSaving({ stepId: 'case_basics' }), /A case must be rendered/u);
});

test('the factory creates its own mount when the page has not provided one', async () => {
  const harness = createHarness({ createMount: false });
  await harness.ui.renderProductionProjection(plain(studentProjection(draftCase())), liveContext(CASE_ID));
  const mount = harness.win.document.getElementById('lorProductionRoot');
  assert.ok(mount, 'the renderer must establish its own production mount');
  assert.equal(mount.className, 'lor-production-root');
  assert.match(mount.textContent, /Eight-step builder/u);
});

/* --------------------------------------------------------------- writing, not just reading */

/**
 * The injected transport. It is the ONLY way this renderer can reach a server, which is the point:
 * every request below is one the renderer decided to make, with the exact payload it decided on,
 * and `harness.networkCalls` proves it never went around the transport to a real network API.
 */
function commandRecorder(responders = {}) {
  const calls = [];
  const command = (name) => async (input) => {
    calls.push({ name, input });
    const responder = responders[name];
    if (typeof responder === 'function') return responder(input, calls.length);
    if (responder) return responder;
    return { reached: true, status: 200, body: {} };
  };
  return {
    calls,
    named(name) {
      return calls.filter((entry) => entry.name === name);
    },
    commands: {
      autosaveBuilderStep: command('autosaveBuilderStep'),
      completeBuilderStep: command('completeBuilderStep'),
      recordReceipt: command('recordReceipt'),
      releaseFinalDocument: command('releaseFinalDocument'),
      exportFinalDocument: command('exportFinalDocument'),
      reloadCase: command('reloadCase'),
    },
  };
}

function accepted(projection, { status = 200, revision } = {}) {
  return {
    reached: true,
    status,
    body: { case: { ...projection, revision: revision ?? projection.revision + 1 } },
  };
}

async function settle(harness, ticks = 8) {
  for (let tick = 0; tick < ticks; tick += 1) {
    await new Promise((resolve) => harness.win.setTimeout(resolve, 0));
  }
}

async function editableHarness(responders = {}) {
  const harness = createHarness();
  const projection = plain(studentProjection(draftCase()));
  const recorder = commandRecorder(responders);
  harness.ui.attachCommands(recorder.commands);
  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));
  return { harness, projection, recorder };
}

/**
 * JSDOM objects come from another realm, so deepStrictEqual would reject an identical array or
 * object purely on prototype identity. Comparing the JSON projection keeps the assertions about
 * the payload rather than about which realm built it.
 */
function plainCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

/** A real activation, so a disabled control genuinely does nothing. */
function press(control) {
  assert.notEqual(control, null, 'expected the control to exist');
  control.click();
}

function fieldControl(harness, stepId, key) {
  return harness.mount.querySelector(`[data-step="${stepId}"][data-field="${key}"]`);
}

function typeInto(harness, stepId, key, value) {
  const control = fieldControl(harness, stepId, key);
  assert.notEqual(control, null, `expected an editable ${key} control on ${stepId}`);
  control.value = value;
  control.dispatchEvent(new harness.win.Event('input', { bubbles: true }));
  return control;
}

function controlLabelled(harness, label) {
  return [...harness.mount.querySelectorAll('button')].find(
    (button) => button.textContent.trim() === label,
  ) || null;
}

test('the current step is editable and the rest of the saved step object survives a write', async () => {
  const stepId = 'timeline_highlights';
  const { harness, projection, recorder } = await editableHarness({
    autosaveBuilderStep: (input) => accepted(projection),
  });

  // The fixture stored `summary`, which is not a declared field for this step. It must still be
  // editable rather than stranded, and its saved value must be what the box starts with.
  assert.equal(fieldControl(harness, stepId, 'summary').value, 'Step 4 content');

  typeInto(harness, stepId, 'standoutMoment', 'The night the ICU was short a resident');
  press(controlLabelled(harness, 'Save now'));
  await settle(harness);

  const [write] = recorder.named('autosaveBuilderStep');
  assert.equal(write.input.caseId, CASE_ID);
  assert.equal(write.input.stepId, stepId);
  assert.equal(write.input.expectedRevision, projection.revision);
  assert.deepEqual(plainCopy(write.input.stepData), {
    // Everything the server already held for this step, carried through untouched...
    acknowledged: true,
    index: 3,
    summary: 'Step 4 content',
    // ...plus the one field that was typed. A payload of only the edit would delete the rest.
    standoutMoment: 'The night the ICU was short a resident',
  });
  assert.equal(harness.storageTouches.length, 0);
  assert.equal(harness.networkCalls.length, 0, 'the renderer must reach the server only through commands');
  assertPrototypeStillQuarantined(harness);
  assertNoInlineHandlers(harness);
  assertNoInternalLeak(harness);
});

test('typing autosaves after it settles, and claims saved only once the server advanced the revision', async () => {
  const stepId = 'timeline_highlights';
  const { harness, projection, recorder } = await editableHarness({
    autosaveBuilderStep: () => accepted(projection),
  });

  typeInto(harness, stepId, 'standoutMoment', 'A');
  typeInto(harness, stepId, 'standoutMoment', 'A d');
  typeInto(harness, stepId, 'standoutMoment', 'A debounced sentence');
  assert.equal(recorder.named('autosaveBuilderStep').length, 0, 'keystrokes must not each be a write');
  assert.ok(!harness.text().includes('Saved to your account'));

  await new Promise((resolve) => harness.win.setTimeout(resolve, 900));
  await settle(harness);

  assert.equal(recorder.named('autosaveBuilderStep').length, 1, 'a settled burst is one write');
  assert.equal(
    recorder.named('autosaveBuilderStep')[0].input.stepData.standoutMoment,
    'A debounced sentence',
  );
  assert.equal(harness.ui.state, 'saved');
  assert.equal(harness.ui.hasUnsavedEdits, false);
  assert.match(harness.text(), /Saved to your account/u);
  assert.equal(harness.mount.querySelector('#lorSaveIndicator').dataset.saveState, 'saved');
  assertNoInternalLeak(harness);
});

test('an accepted status whose revision did not advance never shows saved, and the typing stays', async () => {
  const stepId = 'timeline_highlights';
  const { harness, projection, recorder } = await editableHarness({
    // 200, a real case projection, same revision: the server stored nothing.
    autosaveBuilderStep: () => accepted(projection, { revision: projection.revision }),
  });

  typeInto(harness, stepId, 'standoutMoment', 'Wording the server did not keep');
  press(controlLabelled(harness, 'Save now'));
  await settle(harness);

  assert.equal(recorder.named('autosaveBuilderStep').length, 1);
  assert.ok(!harness.text().includes('Saved to your account'), 'a stalled revision is not a save');
  assert.equal(harness.ui.state, 'version_conflict');
  assert.equal(harness.ui.hasUnsavedEdits, true);
  assert.equal(fieldControl(harness, stepId, 'standoutMoment').value, 'Wording the server did not keep');
});

test('re-entering a case with an empty builder still offers somewhere to type', async () => {
  // Re-entry to a pristine case is the state most likely to strand a student: nothing saved, so
  // any "show the step that has data" heuristic has nothing to latch onto, and buildStepDetail
  // renders no editing surface at all without a selected step. It works today because
  // pickSelectedStep falls back to projection.builder.currentStepId, which the server sets to the
  // next actionable step - but nothing pinned that, so a change to either side could strand a
  // returning student silently. This pins it.
  //
  // Recorded because it is instructive: I first read this as a live defect while driving a
  // browser, then found the browser tab was reporting visibilityState 'hidden', which was the
  // real cause of the missing fields. A mutation check settled it - the assertion below passes
  // with and without the change I had made, which is what proved the change unnecessary.
  const harness = createHarness();
  // A pristine case: created and never touched. draftCase() already has autosaves and a receipt,
  // which is precisely the state that masked this bug.
  const pristine = createRecommendationCase({
    id: CASE_ID,
    studentId: STUDENT_ID,
    now: T0,
    builderSessionId: 'builder-session-1',
    idFactory: deterministicIdFactory('id'),
  });
  const projection = plain(studentProjection(pristine));
  assert.equal(projection.builder.completedStepIds.length, 0, 'fixture must be an untouched case');
  assert.equal(Object.keys(projection.builder.stepData || {}).length, 0);

  harness.ui.attachCommands(commandRecorder({}).commands);
  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));

  const fields = [...harness.mount.querySelectorAll('[data-step][data-field]')];
  assert.ok(fields.length > 0, 'a re-entered empty case must render editable fields');
  assert.ok(
    fields.every((f) => f.dataset.step === 'case_basics'),
    'the first incomplete step is the only one the server would accept next',
  );
});

test('a server field named __proto__ is edited as data and never silently discarded', async () => {
  // Regression. An adversarial review reproduced this end to end: a step field named `__proto__`
  // rendered as an editable control, but the edit buffer was a plain object literal, so
  // `edits['__proto__'] = value` hit the prototype setter instead of creating an own property.
  // The typed text vanished, no PATCH was issued, and the interface reported "Up to date" with
  // Save-now disabled - a student losing content while being told it was saved. That is a
  // data-loss bug regardless of how odd the key is, so the buffer is now prototype-free.
  const stepId = 'timeline_highlights';
  const harness = createHarness();
  const base = plain(studentProjection(draftCase()));
  // JSON.parse, not a literal: `{ __proto__: 'x' }` hits the prototype setter and creates no own
  // property, so the fixture would not even reproduce the bug. A JSON body from the server does
  // create the own property - which is exactly how this reaches the renderer in production.
  const hostileStep = JSON.parse('{"__proto__":"server stored this"}');
  const projection = plain({
    ...base,
    builder: {
      ...base.builder,
      stepData: Object.assign(Object.create(null), base.builder.stepData || {}, { [stepId]: hostileStep }),
    },
  });
  const recorder = commandRecorder({
    autosaveBuilderStep: () => accepted(projection, { revision: projection.revision + 1 }),
  });
  harness.ui.attachCommands(recorder.commands);
  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));

  typeInto(harness, stepId, '__proto__', 'TYPED BY STUDENT');

  assert.equal(harness.ui.hasUnsavedEdits, true, 'the edit must register, not vanish');
  assert.equal(
    fieldControl(harness, stepId, '__proto__').value,
    'TYPED BY STUDENT',
    'the typed value must survive in the control',
  );

  press(controlLabelled(harness, 'Save now'));
  await settle(harness);

  const sent = recorder.named('autosaveBuilderStep');
  assert.equal(sent.length, 1, 'a real edit must produce exactly one write');
  // Read the own property descriptor: plain member access on `__proto__` would consult the
  // prototype getter rather than the stored datum, which is the whole hazard under test.
  assert.equal(
    Object.getOwnPropertyDescriptor(sent[0].input.stepData, '__proto__')?.value,
    'TYPED BY STUDENT',
    'the write must carry the typed value as an own property',
  );

  // The prototype chain must be untouched in the process.
  assert.equal({}.TYPED, undefined);
  assert.equal(Object.prototype.TYPED, undefined);
});

test('a 409 shows the conflict state, keeps every typed character, and never silently overwrites', async () => {
  const stepId = 'timeline_highlights';
  const typed = 'Two sentences I do not want to lose.';
  const { harness, projection, recorder } = await editableHarness({
    autosaveBuilderStep: (input, callNumber) => (callNumber === 1
      ? { reached: true, status: 409, body: { error: 'stale_revision', message: 'The case changed after it was loaded. Reload before retrying.' } }
      : accepted({ ...projection, revision: projection.revision + 4 })),
    reloadCase: () => ({
      reached: true,
      status: 200,
      body: { case: { ...projection, revision: projection.revision + 4 } },
    }),
  });

  typeInto(harness, stepId, 'standoutMoment', typed);
  press(controlLabelled(harness, 'Save now'));
  await settle(harness);

  // The conflict is stated in words a student can act on, the typing is still on screen, and the
  // renderer has NOT written anything over the newer stored version.
  assert.equal(harness.ui.state, 'version_conflict');
  assert.equal(harness.ui.conflictRecoveryPhase, 'detected');
  assert.match(harness.text(), /This case changed somewhere else/u);
  assert.match(harness.text(), /Your wording is still here and has not been thrown away/u);
  assert.equal(fieldControl(harness, stepId, 'standoutMoment').value, typed);
  assert.equal(harness.ui.hasUnsavedEdits, true);
  assert.ok(!harness.text().includes('Saved to your account'));
  assert.equal(recorder.named('autosaveBuilderStep').length, 1, 'a conflict must not be retried behind the student');
  assertNoInternalLeak(harness);

  // Recovery step one: load the stored version. It reloads, it does not write.
  press(controlLabelled(harness, 'Load the stored version'));
  await settle(harness);
  assert.equal(recorder.named('reloadCase').length, 1);
  assert.equal(recorder.named('autosaveBuilderStep').length, 1, 'reloading must not re-send the change');
  assert.equal(harness.ui.renderedRevision, projection.revision + 4);
  assert.equal(fieldControl(harness, stepId, 'standoutMoment').value, typed, 'reloading must not discard typing');
  assert.equal(harness.ui.conflictRecoveryPhase, 'reloaded');
  assert.match(harness.text(), /Your unsaved wording is still in the boxes above/u);

  // Recovery step two: the student, not the renderer, decides to reapply.
  press(controlLabelled(harness, 'Save my wording again'));
  await settle(harness);
  const retry = recorder.named('autosaveBuilderStep')[1];
  assert.equal(retry.input.expectedRevision, projection.revision + 4, 'the retry is based on the reloaded revision');
  assert.equal(retry.input.stepData.standoutMoment, typed);
  assert.equal(harness.ui.state, 'saved');
  assert.equal(harness.ui.hasUnsavedEdits, false);
  assert.equal(harness.ui.conflictRecoveryPhase, null);
});

test('completing a step saves the pending wording first and stops if that save is refused', async () => {
  const stepId = 'timeline_highlights';
  const { harness, projection, recorder } = await editableHarness({
    autosaveBuilderStep: () => ({ reached: true, status: 409, body: { error: 'stale_revision' } }),
  });

  typeInto(harness, stepId, 'standoutMoment', 'Not stored yet');
  press(controlLabelled(harness, 'Save and mark this step complete'));
  await settle(harness);

  assert.equal(recorder.named('autosaveBuilderStep').length, 1);
  assert.equal(
    recorder.named('completeBuilderStep').length,
    0,
    'a step must not be marked complete while its latest wording exists only on screen',
  );
  assert.equal(harness.ui.state, 'version_conflict');
});

test('step completion posts the next canonical step against the durable revision', async () => {
  const { harness, projection, recorder } = await editableHarness({
    completeBuilderStep: () => accepted(projection),
  });

  press(controlLabelled(harness, 'Save and mark this step complete'));
  await settle(harness);

  const [complete] = recorder.named('completeBuilderStep');
  assert.deepEqual([...Object.keys(complete.input)].sort(), ['caseId', 'expectedRevision', 'stepId']);
  // Three steps are complete in the fixture, so the fourth is the only step the server will accept.
  assert.equal(complete.input.stepId, BUILDER_STEPS[3]);
  assert.equal(complete.input.expectedRevision, projection.revision);
  assert.equal(harness.ui.state, 'saved');
});

test('a step the server would refuse offers no editor and says why in plain words', async () => {
  const harness = createHarness();
  const recorder = commandRecorder();
  harness.ui.attachCommands(recorder.commands);
  await harness.ui.renderProductionProjection(plain(studentProjection(draftCase())), liveContext(CASE_ID));

  harness.mount
    .querySelector('button[data-step="faculty_handoff"]')
    .dispatchEvent(new harness.win.Event('click', { bubbles: true }));

  assert.equal(fieldControl(harness, 'faculty_handoff', 'handoffMessage'), null);
  assert.match(harness.text(), /Finish the earlier steps first/u);
  assertNoInternalLeak(harness);
});

test('a case that has left the student builder is read only and says so without blaming the student', async () => {
  const harness = createHarness();
  harness.ui.attachCommands(commandRecorder().commands);
  await harness.ui.renderProductionProjection(plain(studentProjection(releasedCase())), liveContext(CASE_ID));

  assert.equal(harness.mount.querySelector('.lorProductionStepForm'), null);
  assert.match(harness.text(), /Your case is with your faculty writer now/u);
  assert.match(harness.text(), /Nothing you saved was lost/u);
});

test('consent and the waiver decision are recorded through the receipts route', async () => {
  const projectionSource = plain(studentProjection(draftCase()));
  const harness = createHarness();
  const recorder = commandRecorder({ recordReceipt: () => accepted(projectionSource) });
  harness.ui.attachCommands(recorder.commands);
  await harness.ui.renderProductionProjection(projectionSource, liveContext(CASE_ID));

  press(controlLabelled(harness, 'Waive my access to the letter'));
  await settle(harness);

  const [waiver] = recorder.named('recordReceipt');
  assert.equal(waiver.input.receiptType, 'waiver');
  assert.equal(waiver.input.expectedRevision, projectionSource.revision);
  assert.deepEqual(
    [...Object.keys(waiver.input.receiptData)].sort(),
    ['acknowledgment', 'policyVersion', 'priorReceiptId', 'waived'],
    'only the four fields the server allows a client to supply may cross the wire',
  );
  assert.equal(waiver.input.receiptData.waived, true);
  // A first decision supersedes nothing, and the renderer must not invent a prior receipt.
  assert.equal(waiver.input.receiptData.priorReceiptId, null);
  // Receipt identity, the recorded time and the integrity hash are the server's to mint.
  for (const forbidden of ['id', 'recordedAt', 'receiptHash', 'actorId', 'caseId']) {
    assert.equal(forbidden in waiver.input.receiptData, false, `receiptData must not carry ${forbidden}`);
  }
});

test('a waiver change names the receipt it supersedes, exactly as the chain requires', async () => {
  const projectionSource = plain(studentProjection(releasedCase({ waived: true })));
  const priorId = projectionSource.waiverReceipts[projectionSource.waiverReceipts.length - 1].id;
  const harness = createHarness();
  const recorder = commandRecorder({ recordReceipt: () => accepted(projectionSource) });
  harness.ui.attachCommands(recorder.commands);
  await harness.ui.renderProductionProjection(projectionSource, liveContext(CASE_ID));

  press(controlLabelled(harness, 'Change to: keep my access'));
  await settle(harness);

  const [waiver] = recorder.named('recordReceipt');
  assert.equal(waiver.input.receiptData.waived, false);
  assert.equal(waiver.input.receiptData.priorReceiptId, priorId);
});

test('consent is offered only until it is on file, and carries just the policy and the scopes', async () => {
  const projectionSource = plain(studentProjection(draftCase()));
  const harness = createHarness();
  const recorder = commandRecorder({ recordReceipt: () => accepted(projectionSource) });
  harness.ui.attachCommands(recorder.commands);

  const withoutConsent = { ...projectionSource, consentReceipts: [] };
  await harness.ui.renderProductionProjection(withoutConsent, liveContext(CASE_ID));
  press(controlLabelled(harness, 'Record my consent'));
  await settle(harness);

  const [consent] = recorder.named('recordReceipt');
  assert.equal(consent.input.receiptType, 'consent');
  assert.deepEqual([...Object.keys(consent.input.receiptData)].sort(), ['policyVersion', 'scopes']);
  assert.deepEqual(plainCopy(consent.input.receiptData.scopes), ['builder_autosave', 'faculty_handoff']);
});

/* --------------------------------------------------------------------- release and export */

test('the faculty writer surface releases with two fields and never a timestamp', async () => {
  const record = releasedCase({ released: false });
  const projection = plain(facultyProjection(record));
  assert.equal(projection.schemaVersion, 'missionmed.lor.faculty-projection.v1');
  assert.equal(projection.facultyPrivate.finalDocument.releasedToStudentAt, null);

  const harness = createHarness();
  const recorder = commandRecorder({
    releaseFinalDocument: () => ({
      reached: true,
      status: 200,
      body: {
        case: {
          ...projection,
          revision: projection.revision + 1,
          facultyPrivate: {
            ...projection.facultyPrivate,
            finalDocument: {
              ...projection.facultyPrivate.finalDocument,
              releasedToStudentAt: '2026-08-09T15:00:00.000Z',
            },
          },
        },
      },
    }),
  });
  harness.ui.attachCommands(recorder.commands);
  await harness.ui.renderProductionProjection(projection, {
    ...liveContext(CASE_ID),
    actorRole: 'faculty',
    projectionSchema: 'missionmed.lor.faculty-projection.v1',
  });
  assert.equal(harness.ui.renderedSurface, 'faculty');

  press(controlLabelled(harness, 'Release this letter to the student'));
  await settle(harness);

  const [release] = recorder.named('releaseFinalDocument');
  assert.deepEqual(
    [...Object.keys(release.input)].sort(),
    ['caseId', 'expectedRevision', 'documentId'].sort(),
    'the release request carries the revision and the document, and nothing else',
  );
  assert.equal(release.input.documentId, 'document-1');
  assert.equal(release.input.expectedRevision, projection.revision);
  const serialized = JSON.stringify(release.input);
  for (const forbidden of ['releasedToStudentAt', 'releasedAt', 'timestamp', 'now', 'occurredAt']) {
    assert.ok(!serialized.includes(forbidden), `the release request must not carry ${forbidden}`);
  }

  // The release time on screen is the server's, read back out of its own projection.
  assert.equal(harness.ui.state, 'saved');
  assert.match(harness.text(), /Released to the student 2026-08-09 15:00 UTC/u);
  assertNoInternalLeak(harness);
});

test('the release control is inert once the server says the letter is already released', async () => {
  const projection = plain(facultyProjection(releasedCase()));
  const harness = createHarness();
  const recorder = commandRecorder();
  harness.ui.attachCommands(recorder.commands);
  await harness.ui.renderProductionProjection(projection, {
    ...liveContext(CASE_ID),
    actorRole: 'faculty',
    projectionSchema: 'missionmed.lor.faculty-projection.v1',
  });

  const control = controlLabelled(harness, 'Release this letter to the student');
  assert.equal(control.disabled, true);
  control.click();
  await settle(harness);
  assert.equal(recorder.named('releaseFinalDocument').length, 0);
});

test('a student never sees a release control, whatever the case looks like', async () => {
  for (const record of [draftCase(), releasedCase(), releasedCase({ released: false })]) {
    const harness = createHarness();
    harness.ui.attachCommands(commandRecorder().commands);
    await harness.ui.renderProductionProjection(plain(studentProjection(record)), liveContext(CASE_ID));
    assert.equal(harness.ui.renderedSurface, 'student');
    assert.equal(harness.mount.querySelector('#lorReleaseActions'), null);
    assert.equal(controlLabelled(harness, 'Release this letter to the student'), null);
  }
});

test('export asks the export command for this case and only claims a download the browser took', async () => {
  const projection = plain(studentProjection(releasedCase()));
  const harness = createHarness();
  const recorder = commandRecorder({
    exportFinalDocument: () => ({ reached: true, status: 200, downloadStarted: true }),
  });
  harness.ui.attachCommands(recorder.commands);
  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));

  press(controlLabelled(harness, 'Download a copy'));
  await settle(harness);

  assert.deepEqual(plainCopy(recorder.named('exportFinalDocument').map((entry) => entry.input)), [{ caseId: CASE_ID }]);
  assert.match(harness.text(), /Your download has started/u);
  assert.equal(harness.networkCalls.length, 0);
  assertNoInternalLeak(harness);
});

test('an export the browser refused to take is not described as a download', async () => {
  const projection = plain(studentProjection(releasedCase()));
  const harness = createHarness();
  harness.ui.attachCommands(commandRecorder({
    exportFinalDocument: () => ({ reached: true, status: 200, downloadStarted: false }),
  }).commands);
  await harness.ui.renderProductionProjection(projection, liveContext(CASE_ID));

  press(controlLabelled(harness, 'Download a copy'));
  await settle(harness);
  assert.ok(!harness.text().includes('Your download has started'));
  assert.match(harness.text(), /did not start the download/u);
});

/* ------------------------------------------------------------------- failure vocabulary */

test('every write failure maps to safe copy and leaks no status, reason code or message', async () => {
  const expectations = [
    [{ reached: false }, 'network_failure', 'We could not reach MissionMed'],
    [{ reached: true, status: 400, body: { error: 'validation_failed', message: 'The request payload is invalid.' } }, 'save_failed', 'That change was not saved'],
    [{ reached: true, status: 401, body: { error: 'session_expired' } }, 'unauthorized', 'Sign in again to continue'],
    [{ reached: true, status: 403, body: { error: 'csrf_validation_failed' } }, 'unauthorized', 'Sign in again to continue'],
    [{ reached: true, status: 404, body: { error: 'not_found', message: 'The requested recommendation case was not found.' } }, 'case_not_found', 'We could not open this case'],
    [{ reached: true, status: 409, body: { error: 'stale_revision' } }, 'version_conflict', 'This case changed somewhere else'],
    [{ reached: true, status: 423, body: { error: 'lor_kill_switch_active' } }, 'durable_runtime_unavailable', 'LOR Studio cannot open your case right now'],
    [{ reached: true, status: 503, body: { error: 'integration_disabled' } }, 'provider_unavailable', 'A service LOR Studio depends on is offline'],
    [{ reached: true, status: 500, body: { error: 'lor_application_request_failed' } }, 'server_failure', 'Something went wrong on our side'],
    [{ reached: true, status: 418, body: { error: 'unmapped_status' } }, 'server_failure', 'Something went wrong on our side'],
  ];

  for (const [outcome, expectedState, expectedCopy] of expectations) {
    const { harness } = await editableHarness({ autosaveBuilderStep: () => outcome });
    typeInto(harness, 'timeline_highlights', 'standoutMoment', 'A sentence');
    press(controlLabelled(harness, 'Save now'));
    await settle(harness);

    assert.equal(harness.ui.state, expectedState, `status ${outcome.status ?? 'unreachable'}`);
    assert.ok(harness.text().includes(expectedCopy), `status ${outcome.status ?? 'unreachable'} copy`);
    assert.ok(!harness.text().includes('Saved to your account'));
    assert.ok(harness.ui.hasUnsavedEdits, 'a failed write must never discard what was typed');
    assertNoInternalLeak(harness);
    // Nothing the server said about itself may appear on screen.
    for (const token of [String(outcome.status ?? ''), 'stale_revision', 'csrf', 'validation_failed', 'payload']) {
      if (!token) continue;
      assert.ok(!harness.text().includes(token), `server detail leaked: ${token}`);
    }
  }
});

/* -------------------------------------------------------------------- isolation, still */

test('attaching commands keeps every isolation property and cannot install anything else', async () => {
  const { harness } = await editableHarness();
  assert.equal(harness.ui.presentationIsolation, 'production_projection_only');
  assert.equal(harness.ui.usesLocalStorage, false);
  assert.equal(harness.ui.canRevealPrototype, false);
  assert.throws(() => { harness.ui.canRevealPrototype = true; }, TypeError);

  // Only the six named commands are kept; anything else in the object is discarded.
  const receipt = harness.ui.attachCommands({
    autosaveBuilderStep: async () => ({ reached: true, status: 200, body: {} }),
    revealPrototype: () => true,
    persistToLocalStorage: () => true,
    csrfToken: 'csrf-value',
  });
  assert.deepEqual([...receipt.attached], ['autosaveBuilderStep']);
  assert.equal(harness.storageTouches.length, 0);
  assert.equal(harness.networkCalls.length, 0);
  assertPrototypeStillQuarantined(harness);
  assertNoInlineHandlers(harness);
});

test('with no commands attached the surface is exactly the read-only screen it was before', async () => {
  const harness = createHarness();
  await harness.ui.renderProductionProjection(plain(studentProjection(draftCase())), liveContext(CASE_ID));
  assert.equal(harness.mount.querySelector('.lorProductionStepForm'), null);
  assert.equal(harness.mount.querySelector('#lorReceiptActions'), null);
  assert.equal(harness.mount.querySelector('#lorExportActions'), null);
  assert.match(harness.text(), /This case is open for reading only\./u);

  harness.ui.attachCommands({});
  assert.equal(harness.mount.querySelector('.lorProductionStepForm'), null);
});

test('typed content is held as a control value and never becomes markup', async () => {
  const stepId = 'timeline_highlights';
  const { harness, recorder } = await editableHarness({
    autosaveBuilderStep: () => ({ reached: true, status: 409, body: {} }),
  });

  const hostile = '<img src=x onerror="window.__XSS__=true"><script>window.__XSS2__=true</script>';
  typeInto(harness, stepId, 'standoutMoment', hostile);
  press(controlLabelled(harness, 'Save now'));
  await settle(harness);

  assert.equal(harness.mount.querySelector('img'), null);
  assert.equal(harness.mount.querySelector('script'), null);
  assert.equal(harness.win.__XSS__, undefined);
  assert.equal(harness.win.__XSS2__, undefined);
  // It survived the conflict re-render as data, in the control, not in the document.
  assert.equal(fieldControl(harness, stepId, 'standoutMoment').value, hostile);
  assert.equal(recorder.named('autosaveBuilderStep')[0].input.stepData.standoutMoment, hostile);
  assertNoInlineHandlers(harness);
  assertPrototypeStillQuarantined(harness);
});

test('blocking the surface cancels a pending autosave rather than letting it fire into a closed screen', async () => {
  const { harness, recorder } = await editableHarness();
  typeInto(harness, 'timeline_highlights', 'standoutMoment', 'Typed, then blocked');
  await assert.rejects(
    () => harness.ui.block({ reasonCode: 'UNAUTHORIZED', revealPrototype: true }),
    /cannot reveal the frozen prototype/u,
  );
  await new Promise((resolve) => harness.win.setTimeout(resolve, 900));
  assert.equal(recorder.named('autosaveBuilderStep').length, 0);
  assert.equal(harness.ui.state, 'unauthorized');
});
