/**
 * PRODUCTION COMPOSITION INTEGRATION TESTS.
 *
 * These exist because of a specific historical failure: every other suite in this directory
 * builds its own runtime, so all 116 original tests would have stayed green if the production
 * mount in server.mjs had been deleted outright. It WAS effectively deleted - the mount omitted
 * the `application` option, so `application` defaulted to null and every /api/lor-studio/*
 * request returned 503 while the suite reported a healthy product.
 *
 * Every test below drives the REAL createLorStudioRuntime through its REAL handle() entry point,
 * with the application produced by the REAL composition root. The suite closes with a source
 * guard asserting server.mjs actually passes `application`, and a negative control proving these
 * tests genuinely fail when the composition root is removed.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

import {
  createLorStudioApplication,
  readLorTargetConfiguration,
  LOR_COMPOSITION_REASONS,
} from '../../lor-studio/composition.mjs';
import { createLorStudioRuntime } from '../../lor-studio/http/runtime.mjs';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
import {
  MetadataOnlyEventBuffer,
  StaticEntitlementTestAdapter,
} from '../../lor-studio/adapters/test-adapters.js';

const RANKLISTIQ_PRODUCTION_PROJECT_REF = 'fglyvdykwgbuivikqoah';
const HISTORICAL_NO_TOUCH_BRANCH_ID = 'mftguikkftmrxjxrkdln';

/** An explicit, ratified, NON-denied test target. There is no default target by design. */
function testTargetConfiguration(overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.target-binding.v1',
    ratified: true,
    decisionRecord: 'DR-119',
    environment: 'test',
    projectRef: 'lor-composition-test-target',
    parentProjectRef: null,
    branchName: 'main',
    branchId: 'lor-composition-test-target',
    schema: 'lor_studio',
    migrationLedger: 'lor-composition-test-ledger',
    providerResourceBound: true,
    independentlyVerified: true,
    health: 'ready',
    environmentBound: true,
    dataCopied: false,
    productionDataBindingPassed: false,
    ...overrides,
  };
}

function eligibleStudent(studentId) {
  return {
    studentId,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    revoked: false,
    canaryEnabled: true,
    canaryConsented: true,
    producerStatus: 'VERIFIED_TEST_FIXTURE',
  };
}

/**
 * The runtime's entitlement contract is FLAT - evaluateLorEntitlement reads `available`,
 * `sourceVerified`, `revoked`, `active`, `tier`, `lorEnabled`, `studentId` and `actorId` off the
 * resolved object itself, and then requires actorId to equal the authenticated subject.
 */
function resolverFor(subject) {
  return {
    async resolve() {
      return {
        available: true,
        sourceVerified: true,
        revoked: false,
        active: true,
        tier: 'tier3_360',
        lorEnabled: true,
        canaryEnabled: true,
        canaryConsented: true,
        studentId: subject,
        actorId: subject,
      };
    },
  };
}

/** Composes an application exactly as server.mjs does, differing only in injected test ports. */
function composeTestApplication() {
  return createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([eligibleStudent('wp:1')]),
    testRepository: new InMemoryRecommendationCaseRepository(),
    eventSink: new MetadataOnlyEventBuffer(),
    allowNonDurableForTests: true,
  });
}

function freshSession(now = Date.now()) {
  return {
    user: { id: 'wp:1', role: 'student' },
    issuedAt: new Date(now - 60_000).toISOString(),
    expiresAt: new Date(now + 30 * 60_000).toISOString(),
    csrfToken: 'test-csrf-token',
  };
}

/** Minimal ServerResponse capturing what the runtime actually wrote. */
function captureResponse() {
  const chunks = [];
  return {
    statusCode: null,
    headers: null,
    writeHead(status, headers) { this.statusCode = status; this.headers = headers; },
    end(chunk) { if (chunk) chunks.push(chunk); },
    write(chunk) { if (chunk) chunks.push(chunk); },
    get body() {
      const raw = Buffer.concat(chunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(String(c))))).toString('utf8');
      try { return JSON.parse(raw); } catch { return raw; }
    },
  };
}

function apiRequest(method = 'GET', body = null) {
  const stream = Readable.from(body === null ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.headers = body === null ? {} : { 'content-type': 'application/json' };
  return stream;
}

/**
 * Drive the REAL runtime through its REAL handle() entry point, exactly as server.mjs does.
 * Note the third argument is a genuine URL - server.mjs previously passed a synthetic
 * { pathname, searchParams } literal here, which no test would have caught.
 */
async function callRuntime(runtime, pathname, { method = 'GET', body = null, session = freshSession() } = {}) {
  const response = captureResponse();
  const url = new URL(pathname, 'https://hq.example.test');
  const handled = await runtime.handle(apiRequest(method, body), response, url, { session });
  return { handled, status: response.statusCode, body: response.body };
}

function runtimeWith(application) {
  return createLorStudioRuntime({
    publicDirectory: '/tmp/lor-studio-composition-test',
    flags: { enabled: true, killSwitch: false, requireCanary: false },
    entitlementResolver: resolverFor('wp:1'),
    application,
    validateCsrf: () => true,
  });
}

// ---------------------------------------------------------------------------
// Composition root behaviour
// ---------------------------------------------------------------------------

test('composition fails closed when no target is configured', () => {
  const composed = createLorStudioApplication({ targetConfiguration: null, entitlementPort: null });
  assert.equal(composed.application, null);
  assert.equal(composed.reason, LOR_COMPOSITION_REASONS.TARGET_NOT_CONFIGURED);
});

test('composition fails closed for the denied RankListIQ production project and no-touch branch', () => {
  for (const [field, denied] of [
    ['projectRef', RANKLISTIQ_PRODUCTION_PROJECT_REF],
    ['branchId', HISTORICAL_NO_TOUCH_BRANCH_ID],
    ['parentProjectRef', RANKLISTIQ_PRODUCTION_PROJECT_REF],
  ]) {
    const composed = createLorStudioApplication({
      targetConfiguration: testTargetConfiguration({ [field]: denied }),
      entitlementPort: new StaticEntitlementTestAdapter([]),
      testRepository: new InMemoryRecommendationCaseRepository(),
      allowNonDurableForTests: true,
    });
    assert.equal(composed.application, null, `${field}=${denied} must not compose`);
    assert.equal(composed.reason, LOR_COMPOSITION_REASONS.TARGET_REJECTED);
  }
});

test('composition fails closed on a partial or unratified target configuration', () => {
  const partial = testTargetConfiguration();
  delete partial.migrationLedger;
  assert.equal(
    createLorStudioApplication({ targetConfiguration: partial, entitlementPort: new StaticEntitlementTestAdapter([]) }).reason,
    LOR_COMPOSITION_REASONS.TARGET_REJECTED,
  );
  assert.equal(
    createLorStudioApplication({
      targetConfiguration: testTargetConfiguration({ ratified: false }),
      entitlementPort: new StaticEntitlementTestAdapter([]),
    }).reason,
    LOR_COMPOSITION_REASONS.TARGET_REJECTED,
  );
});

test('composition declines without a durable driver rather than silently degrading', () => {
  const composed = createLorStudioApplication({
    targetConfiguration: testTargetConfiguration(),
    entitlementPort: new StaticEntitlementTestAdapter([]),
  });
  assert.equal(composed.application, null);
  assert.equal(composed.reason, LOR_COMPOSITION_REASONS.DURABLE_DRIVER_UNAVAILABLE);
  // The binding still resolved - the refusal is about durability, not about the target.
  assert.equal(composed.binding.projectRef, 'lor-composition-test-target');
});

test('composition builds a real application from an explicit validated target', () => {
  const composed = composeTestApplication();
  assert.ok(composed.application, 'an application must be constructed');
  assert.equal(typeof composed.application.handleRequest, 'function');
  assert.equal(typeof composed.application.getBootstrap, 'function');
  assert.equal(composed.binding.projectRef, 'lor-composition-test-target');
});

// ---------------------------------------------------------------------------
// NEGATIVE CONTROL - the historical failure, reproduced deliberately
// ---------------------------------------------------------------------------

test('NEGATIVE CONTROL: omitting the composition root makes every API route 503', async () => {
  // This is the exact production shape that left LOR Studio dark: a runtime built without an
  // `application`. If a future change reintroduces it, the positive tests below go red.
  const runtime = runtimeWith(null);

  for (const pathname of ['/api/lor-studio/bootstrap', '/api/lor-studio/cases/case-1']) {
    const { status, body } = await callRuntime(runtime, pathname);
    assert.equal(status, 503, `${pathname} must be 503 without a composed application`);
    assert.equal(body.error, 'lor_application_unavailable');
  }
});

// ---------------------------------------------------------------------------
// Reachability through the REAL runtime
// ---------------------------------------------------------------------------

test('a composed application changes bootstrap from "no application" to "not durable"', async () => {
  // This is the precise signal that composition worked. Both responses are 503, but they mean
  // opposite things: lor_application_unavailable means the application was never constructed -
  // the historical defect - whereas lor_durable_runtime_required means the application WAS
  // reached, evaluated its own readiness, and correctly refused to enter live mode on a
  // non-durable repository. Reachability and truthfulness, not a green light.
  const withoutApplication = await callRuntime(runtimeWith(null), '/api/lor-studio/bootstrap');
  assert.equal(withoutApplication.body.error, 'lor_application_unavailable');

  const composed = await callRuntime(runtimeWith(composeTestApplication().application), '/api/lor-studio/bootstrap');
  assert.notEqual(composed.body.error, 'lor_application_unavailable',
    'the application must be reached, not reported missing');
  assert.equal(composed.body.error, 'lor_durable_runtime_required');
  assert.equal(composed.body.operational, false);
  assert.equal(composed.body.storageMode, 'NON_DURABLE_TEST_ONLY',
    'a non-durable repository must never claim to be operational just because wiring exists');
});

test('a composed application makes case routes reachable through the real runtime', async () => {
  const runtime = runtimeWith(composeTestApplication().application);
  const created = await callRuntime(runtime, '/api/lor-studio/cases', {
    method: 'POST',
    body: { studentId: 'wp:1' },
  });

  assert.notEqual(created.status, 503, 'case creation must reach the application, not 503');
  assert.notEqual(created.body?.error, 'lor_application_unavailable');
});

test('authorization still applies at the actually mounted boundary', async () => {
  const runtime = runtimeWith(composeTestApplication().application);

  // No session at all: the runtime must refuse before the application is ever consulted.
  const anonymous = await callRuntime(runtime, '/api/lor-studio/bootstrap', { session: null });
  assert.equal(anonymous.status, 401);

  // An expired session must not reach the application either.
  const expired = await callRuntime(runtime, '/api/lor-studio/bootstrap', {
    session: {
      user: { id: 'wp:1' },
      issuedAt: new Date(Date.now() - 7_200_000).toISOString(),
      expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
  });
  assert.equal(expired.status, 401);
});

test('the feature flags still gate a composed application', async () => {
  const application = composeTestApplication().application;

  const disabled = createLorStudioRuntime({
    publicDirectory: '/tmp/lor-studio-composition-test',
    flags: { enabled: false, killSwitch: false, requireCanary: false },
    entitlementResolver: { async resolve() { return { available: true, eligible: true, sourceVerified: true }; } },
    application,
    validateCsrf: () => true,
  });
  assert.equal((await callRuntime(disabled, '/api/lor-studio/bootstrap')).status, 404);

  const killed = createLorStudioRuntime({
    publicDirectory: '/tmp/lor-studio-composition-test',
    flags: { enabled: true, killSwitch: true, requireCanary: false },
    entitlementResolver: { async resolve() { return { available: true, eligible: true, sourceVerified: true }; } },
    application,
    validateCsrf: () => true,
  });
  assert.equal((await callRuntime(killed, '/api/lor-studio/bootstrap')).status, 423);
});

// ---------------------------------------------------------------------------
// SOURCE GUARD - the check that would have caught the original defect
// ---------------------------------------------------------------------------

test('SOURCE GUARD: server.mjs composes and passes an application to the runtime', () => {
  const source = readFileSync(fileURLToPath(new URL('../../server.mjs', import.meta.url)), 'utf8');

  assert.match(source, /createLorStudioApplication\(/u,
    'server.mjs must construct the application through the composition root');
  assert.match(source, /readLorTargetConfiguration\(/u,
    'the target must come from explicit configuration');

  const mount = source.match(/createLorStudioRuntime\(\{[\s\S]*?\n\}\);/u);
  assert.ok(mount, 'the LOR Studio runtime mount must be present in server.mjs');
  assert.match(mount[0], /application:\s*LOR_STUDIO_COMPOSITION\.application/u,
    'the mount MUST pass `application` - omitting it is the defect that left the product dark');

  // No implicit LOR target may reappear in the LOR composition path. Scoped deliberately to
  // that block: server.mjs legitimately names the RankListIQ project elsewhere as
  // AUTH_ALLOWED_SUPABASE_PROJECT, which is MissionMed HQ's auth project and nothing to do with
  // LOR Studio. The binding-level protection is the denylist in lor-target-binding.mjs.
  const compositionBlock = source.match(/const LOR_STUDIO_COMPOSITION[\s\S]*?\n\}\);/u);
  assert.ok(compositionBlock, 'the LOR composition block must be present');
  assert.equal(compositionBlock[0].includes(RANKLISTIQ_PRODUCTION_PROJECT_REF), false,
    'the LOR composition must never name the RankListIQ production project');
  assert.equal(compositionBlock[0].includes(HISTORICAL_NO_TOUCH_BRANCH_ID), false,
    'the LOR composition must never name the historical no-touch branch');
  assert.match(compositionBlock[0], /targetConfiguration:\s*readLorTargetConfiguration\(process\.env\)/u,
    'the target must come only from explicit external configuration, never a literal');

  // The runtime must receive a real URL, not a synthetic { pathname, searchParams } literal.
  assert.match(source, /LOR_STUDIO_RUNTIME\.handle\(request,\s*response,\s*url,/u,
    'the runtime must be handed the genuine URL object');
});
