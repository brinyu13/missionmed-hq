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
function releasedCase({ waived = false } = {}) {
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
  if (waived) return record;
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
