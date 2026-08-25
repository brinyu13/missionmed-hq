/**
 * LOR STUDIO STUDENT JOURNEY - REAL HTTP END-TO-END TEST.
 *
 * Every other suite in this directory drives the application through an in-process object: either
 * the adapter directly, or `runtime.handle()` with a hand-rolled fake ServerResponse. None of them
 * proves that a browser talking to a socket gets the same answers. This one does: it starts a real
 * `node:http` server on an ephemeral port, mounts the REAL `createLorStudioRuntime` with an
 * application built by the REAL composition root, and drives the whole student journey with
 * `fetch` over a real TCP connection - real request bodies, real headers, real status codes.
 *
 * WHAT IS REAL HERE
 *   - the composition root (lor-studio/composition.mjs) and the target binding it validates
 *   - the HTTP runtime, its session/flag/entitlement/CSRF gates, and its security headers
 *   - the application adapter, its routing, its payload allowlists, and its error mapping
 *   - the case service, the aggregate, the authorization policy, and the in-memory repository
 *   - the wire: sockets, chunked request bodies, header casing, JSON parsing
 *
 * WHAT IS NOT REAL, AND IS CLASSIFIED RATHER THAN SIMULATED
 *   1. SESSION TRANSPORT. server.mjs derives the session from an AES-GCM cookie
 *      (`authenticateApiRequest` -> `readSessionFromHeaders`) BEFORE it calls the LOR runtime, and
 *      there is no exported minting helper to forge one from a test. The session provider is
 *      therefore a test seam in this file only; the product's authenticator is untouched. Nothing
 *      inside the LOR trust boundary is relaxed - the runtime's own freshness, flag, entitlement,
 *      subject-match, and CSRF gates all run for real and are asserted below.
 *   2. DURABLE STORAGE. An operational (200) bootstrap requires storageMode 'durable' AND
 *      providersReady AND allAcceptedFunctionsOperational. Durable storage is a Supabase binding
 *      that does not exist in this repository - composition.mjs returns
 *      `lor_durable_driver_unavailable` without a driver. This test asserts the TRUE response
 *      (503 lor_durable_runtime_required) and never fakes an operational production bootstrap.
 *   3. THE FACULTY WORKFLOW. invite -> OTP verify -> author -> approve have NO HTTP route in this
 *      release: `routeCase` (http/application-adapter.mjs) exposes only cases, cases/:id,
 *      builder, builder/complete, receipts, and final-document/release. Those four transitions are
 *      therefore performed through the REAL aggregate against the REAL shared repository instance
 *      - not simulated, and not asserted to be reachable over HTTP, because they are not. The
 *      release itself, which IS routed, is driven over real HTTP.
 *   4. AI PROPOSAL GENERATION. No AI route is mounted by the application adapter, so no AI
 *      provider is exercised and none is stubbed into a fake success.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLorStudioApplication } from '../../lor-studio/composition.mjs';
import { createLorStudioRuntime } from '../../lor-studio/http/runtime.mjs';
import { InMemoryRecommendationCaseRepository } from '../../lor-studio/repositories/in-memory-recommendation-case-repository.js';
import {
  MetadataOnlyEventBuffer,
  StaticEntitlementTestAdapter,
} from '../../lor-studio/adapters/test-adapters.js';
import {
  BUILDER_STEPS,
  bindFacultyInvitation,
  bindVerifiedFaculty,
  setFacultyPrivateContent,
} from '../../lor-studio/domain/recommendation-case.js';
import { hashValue, sha256 } from '../../lor-studio/domain/value-utils.js';

const PUBLIC_LOR_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../public/lor-studio',
);

/** Header this test's session provider reads. It exists only in this file. */
const TEST_PRINCIPAL_HEADER = 'x-mmhq-lor-e2e-principal';

/**
 * An explicit, ratified, NON-PRODUCTION target. There is no default target by design, and the
 * denied RankListIQ production project and historical no-touch branch are never named here -
 * not even as a negative fixture, which production-composition.test.mjs already owns.
 */
const E2E_TARGET_PROJECT_REF = 'lor-e2e-student-journey-target';
const E2E_TARGET_CONFIGURATION = Object.freeze({
  schemaVersion: 'missionmed.lor.target-binding.v1',
  ratified: true,
  decisionRecord: 'DR-119',
  environment: 'test',
  projectRef: E2E_TARGET_PROJECT_REF,
  parentProjectRef: null,
  branchName: 'main',
  branchId: E2E_TARGET_PROJECT_REF,
  schema: 'lor_studio',
  migrationLedger: 'lor-e2e-student-journey-ledger',
  providerResourceBound: true,
  independentlyVerified: true,
  health: 'ready',
  environmentBound: true,
  dataCopied: false,
  productionDataBindingPassed: false,
});

// Production WordPress subjects are `wp:<numeric user id>`. Actor-safe faculty projections and
// PostgreSQL command scopes intentionally reject the symbolic `wp:lor-e2e-*` identifiers this
// journey used before DR-120, so the socket-level fixture must exercise the canonical identity
// contract rather than a legacy test-only shape.
const STUDENT_A = 'wp:910001';
const STUDENT_B = 'wp:910002';
const FACULTY_A = 'wp:920001';
const FACULTY_B = 'wp:920002';

/**
 * A string that exists nowhere except inside the faculty letter. Any student-facing HTTP response
 * that contains it before the release route ran is a leak, and this test greps every byte of the
 * real response body for it.
 */
const LETTER_SENTINEL = 'MMLOR-E2E-LETTER-SENTINEL-9d41ac';
const FINAL_DOCUMENT_ID = 'doc_lor_e2e_final_1';
const FINAL_DOCUMENT_TEXT =
  `It is my privilege to recommend this applicant without reservation. ${LETTER_SENTINEL}`;

const PRINCIPAL_FIXTURES = Object.freeze({
  student: { subject: STUDENT_A, role: 'student', studentId: STUDENT_A, projection: 'eligible' },
  otherStudent: { subject: STUDENT_B, role: 'student', studentId: STUDENT_B, projection: 'eligible' },
  faculty: { subject: FACULTY_A, role: 'faculty', studentId: STUDENT_A, projection: 'eligible' },
  unboundFaculty: { subject: FACULTY_B, role: 'faculty', studentId: STUDENT_A, projection: 'eligible' },
  unentitled: { subject: 'wp:910003', role: 'student', studentId: 'wp:910003', projection: 'inactive' },
  nonCanary: { subject: 'wp:910004', role: 'student', studentId: 'wp:910004', projection: 'noCanaryConsent' },
  // Its projection claims to be student A while the authenticated subject is student E. The
  // runtime must refuse on the mismatch rather than trusting the projection.
  impersonator: { subject: 'wp:910005', role: 'student', studentId: STUDENT_A, projection: 'impersonating' },
  expired: { subject: 'wp:910006', role: 'student', studentId: 'wp:910006', projection: 'eligible', expired: true },
});

const SUBJECT_TO_FIXTURE = new Map(
  Object.values(PRINCIPAL_FIXTURES).map((fixture) => [fixture.subject, fixture]),
);

/** The service-layer entitlement contract. Student B is fully eligible ON PURPOSE: a cross-student
 * denial must come from RESOURCE OWNERSHIP, not from the probing student being unentitled. */
function eligibleEntitlementRecord(studentId) {
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

/** The runtime-layer entitlement projection, which is a different, flatter contract. */
function entitlementProjectionFor(subject) {
  const fixture = SUBJECT_TO_FIXTURE.get(String(subject));
  if (!fixture) return { available: false, sourceVerified: false };
  const base = {
    available: true,
    sourceVerified: true,
    revoked: false,
    active: true,
    tier: 'tier3_360',
    lorEnabled: true,
    canaryEnabled: true,
    canaryConsented: true,
    studentId: fixture.studentId,
    actorId: fixture.subject,
    role: fixture.role,
  };
  if (fixture.projection === 'inactive') return { ...base, active: false };
  if (fixture.projection === 'noCanaryConsent') return { ...base, canaryConsented: false };
  if (fixture.projection === 'impersonating') return { ...base, actorId: STUDENT_A };
  return base;
}

function buildSession(fixture) {
  const now = Date.now();
  return fixture.expired
    ? {
      user: { id: fixture.subject, role: fixture.role },
      issuedAt: new Date(now - 7_200_000).toISOString(),
      expiresAt: new Date(now - 3_600_000).toISOString(),
      csrfToken: `csrf-${fixture.subject}-${randomUUID()}`,
    }
    : {
      user: { id: fixture.subject, role: fixture.role },
      issuedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 30 * 60_000).toISOString(),
      csrfToken: `csrf-${fixture.subject}-${randomUUID()}`,
    };
}

/** Byte-for-byte the contract server.mjs enforces: a mutation needs the session's own token. */
function mirroredValidateCsrf(request, session) {
  if (!session) return false;
  const csrfHeader = String(request.headers['x-mmhq-csrf'] || '').trim();
  return csrfHeader !== '' && csrfHeader === session.csrfToken;
}

async function startJourneyHarness() {
  const events = new MetadataOnlyEventBuffer();
  const repository = new InMemoryRecommendationCaseRepository();
  const composed = createLorStudioApplication({
    targetConfiguration: E2E_TARGET_CONFIGURATION,
    entitlementPort: new StaticEntitlementTestAdapter([
      eligibleEntitlementRecord(STUDENT_A),
      eligibleEntitlementRecord(STUDENT_B),
      eligibleEntitlementRecord('wp:910006'),
    ]),
    testRepository: repository,
    eventSink: events,
    allowNonDurableForTests: true,
    requireCanary: true,
  });
  assert.ok(composed.application, `composition must build an application (reason: ${composed.reason})`);
  assert.equal(composed.binding.environment, 'test', 'the journey must never bind a production target');
  assert.equal(composed.binding.projectRef, E2E_TARGET_PROJECT_REF);

  const sessions = new Map(
    Object.entries(PRINCIPAL_FIXTURES).map(([name, fixture]) => [name, buildSession(fixture)]),
  );

  const runtime = createLorStudioRuntime({
    publicDirectory: PUBLIC_LOR_DIRECTORY,
    flags: { enabled: true, killSwitch: false, requireCanary: true },
    entitlementResolver: {
      async resolve({ subject }) {
        return entitlementProjectionFor(subject);
      },
    },
    application: composed.application,
    validateCsrf: mirroredValidateCsrf,
  });

  const server = createServer((request, response) => {
    // Mirrors server.mjs: build the real URL, resolve the session, hand both to the runtime.
    (async () => {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const principal = String(request.headers[TEST_PRINCIPAL_HEADER] || '').trim();
      const session = principal ? sessions.get(principal) ?? null : null;
      const handled = await runtime.handle(request, response, url, { session });
      if (!handled) {
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: 'not_a_lor_studio_path' }));
      }
    })().catch((error) => {
      if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'test_harness_failure', message: String(error?.message || error) }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = /** @type {{ port: number }} */ (server.address());
  return {
    base: `http://127.0.0.1:${port}`,
    repository,
    events,
    sessions,
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(() => resolve(undefined)));
    },
  };
}

/**
 * One real HTTP round trip. `csrf` defaults to the principal's own token; pass null to omit it and
 * false-y strings to send a wrong one.
 */
async function call(harness, pathname, {
  method = 'GET',
  principal = null,
  body,
  idempotencyKey = null,
  csrf,
} = {}) {
  const headers = {};
  if (principal) headers[TEST_PRINCIPAL_HEADER] = principal;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (idempotencyKey !== null) headers['idempotency-key'] = idempotencyKey;
  const token = csrf === undefined
    ? (principal ? harness.sessions.get(principal)?.csrfToken ?? null : null)
    : csrf;
  if (token) headers['x-mmhq-csrf'] = token;

  const response = await fetch(new URL(pathname, harness.base), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, text, json, headers: response.headers };
}

const casePath = (caseId) => `/api/lor-studio/cases/${encodeURIComponent(caseId)}`;
const key = (label) => `e2e-${label}-${randomUUID()}`;

/**
 * Every unauthorised access shape, replayed at each checkpoint of the journey. Denials must be
 * indistinguishable from "no such case", must never mutate state, and must never carry the letter.
 */
async function probeUnauthorisedAccess(harness, caseId, checkpoint) {
  const at = (what) => `${checkpoint}: ${what}`;
  const ghost = await call(harness, casePath('case_no-such-case-exists'), { principal: 'otherStudent' });
  assert.equal(ghost.status, 404, at('a nonexistent case must 404'));

  const probes = [
    ['otherStudent reads the case', { pathname: casePath(caseId), method: 'GET', principal: 'otherStudent' }, 404],
    ['otherStudent resumes the builder', { pathname: `${casePath(caseId)}/builder`, method: 'GET', principal: 'otherStudent' }, 404],
    ['otherStudent autosaves', {
      pathname: `${casePath(caseId)}/builder`,
      method: 'PATCH',
      principal: 'otherStudent',
      body: { expectedRevision: 0, stepId: BUILDER_STEPS[0], stepData: { hijacked: true } },
      idempotencyKey: key('probe-autosave'),
    }, 404],
    ['otherStudent completes a step', {
      pathname: `${casePath(caseId)}/builder/complete`,
      method: 'POST',
      principal: 'otherStudent',
      body: { expectedRevision: 0, stepId: BUILDER_STEPS[0] },
      idempotencyKey: key('probe-complete'),
    }, 404],
    ['otherStudent records a receipt', {
      pathname: `${casePath(caseId)}/receipts`,
      method: 'POST',
      principal: 'otherStudent',
      body: { expectedRevision: 0, receiptType: 'consent', receiptData: { policyVersion: 'v1', scopes: ['all'] } },
      idempotencyKey: key('probe-receipt'),
    }, 404],
    ['otherStudent releases the letter', {
      pathname: `${casePath(caseId)}/final-document/release`,
      method: 'POST',
      principal: 'otherStudent',
      body: { expectedRevision: 0, documentId: FINAL_DOCUMENT_ID },
      idempotencyKey: key('probe-release-other'),
    }, 404],
    // The owning student is authenticated and entitled, but releasing is not a student action.
    ['the owning student releases the letter', {
      pathname: `${casePath(caseId)}/final-document/release`,
      method: 'POST',
      principal: 'student',
      body: { expectedRevision: 0, documentId: FINAL_DOCUMENT_ID },
      idempotencyKey: key('probe-release-owner'),
    }, 404],
    ['an unbound faculty writer reads the case', { pathname: casePath(caseId), method: 'GET', principal: 'unboundFaculty' }, 404],
    ['an unbound faculty writer releases the letter', {
      pathname: `${casePath(caseId)}/final-document/release`,
      method: 'POST',
      principal: 'unboundFaculty',
      body: { expectedRevision: 0, documentId: FINAL_DOCUMENT_ID },
      idempotencyKey: key('probe-release-unbound'),
    }, 404],
    ['an anonymous caller reads the case', { pathname: casePath(caseId), method: 'GET' }, 401],
    ['an unentitled student reads the case', { pathname: casePath(caseId), method: 'GET', principal: 'unentitled' }, 403],
    ['a non-consenting canary student reads the case', { pathname: casePath(caseId), method: 'GET', principal: 'nonCanary' }, 403],
    ['a session whose projection names another student reads the case', { pathname: casePath(caseId), method: 'GET', principal: 'impersonator' }, 403],
    ['an expired session reads the case', { pathname: casePath(caseId), method: 'GET', principal: 'expired' }, 401],
  ];

  for (const [what, request, expectedStatus] of probes) {
    const { pathname, ...options } = request;
    const result = await call(harness, pathname, options);
    assert.equal(result.status, expectedStatus, at(`${what} must be refused (got ${result.status} ${result.text})`));
    assert.equal(result.text.includes(LETTER_SENTINEL), false, at(`${what} must not leak the letter`));
    assert.equal(result.text.includes(caseId), false, at(`${what} must not echo the case identifier`));
  }

  // Refusals must be indistinguishable from a case that does not exist, or the 404 becomes an
  // enumeration oracle over every student's case identifiers.
  const denied = await call(harness, casePath(caseId), { principal: 'otherStudent' });
  assert.deepEqual(denied.json, ghost.json, at('a denied read must be byte-identical to a missing case'));
}

async function readCase(harness, caseId, principal = 'student') {
  const result = await call(harness, casePath(caseId), { principal });
  assert.equal(result.status, 200, `reading the case must succeed (got ${result.status} ${result.text})`);
  return result;
}

test('LOR Studio student journey survives a real HTTP round trip end to end', async () => {
  const harness = await startJourneyHarness();
  try {
    // -----------------------------------------------------------------------
    // STEP 1 - bootstrap resolves the authenticated, entitled context.
    // -----------------------------------------------------------------------
    const anonymousBootstrap = await call(harness, '/api/lor-studio/bootstrap');
    assert.equal(anonymousBootstrap.status, 401, 'bootstrap without a session must be refused');
    assert.equal(anonymousBootstrap.json.error, 'authentication_required');

    const unentitledBootstrap = await call(harness, '/api/lor-studio/bootstrap', { principal: 'unentitled' });
    assert.equal(unentitledBootstrap.status, 403, 'an inactive entitlement must be refused');
    assert.equal(unentitledBootstrap.json.error, 'lor_entitlement_required');

    const bootstrap = await call(harness, '/api/lor-studio/bootstrap', { principal: 'student' });
    // CLASSIFIED (durable storage): this is the honest answer, not a failure of the journey. The
    // authenticated and entitled context WAS resolved - the 401 and 403 gates above are the ones
    // that fire when it is not - and the application was reached, which is what
    // `lor_application_unavailable` would deny. The refusal is specifically about durability.
    assert.equal(bootstrap.status, 503, 'a non-durable runtime must never report itself live');
    assert.notEqual(bootstrap.json.error, 'lor_application_unavailable',
      'the composed application must be reached, not reported missing');
    assert.equal(bootstrap.json.error, 'lor_durable_runtime_required');
    assert.equal(bootstrap.json.operational, false);
    assert.equal(bootstrap.json.runtimeMode, 'unavailable');
    assert.equal(bootstrap.json.storageMode, 'NON_DURABLE_TEST_ONLY');
    assert.equal(bootstrap.json.providersReady, false);
    assert.equal(bootstrap.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(bootstrap.headers.get('cache-control'), 'no-store, max-age=0');

    // -----------------------------------------------------------------------
    // STEP 2 - create a case.
    // -----------------------------------------------------------------------
    const created = await call(harness, '/api/lor-studio/cases', {
      method: 'POST',
      principal: 'student',
      body: {},
      idempotencyKey: key('create'),
    });
    assert.equal(created.status, 201, `case creation must succeed (got ${created.status} ${created.text})`);
    const caseId = created.json.case.caseId;
    assert.match(caseId, /^case_/u, 'the case identifier must be server-minted');
    assert.equal(created.json.case.schemaVersion, 'missionmed.lor.student-projection.v1');
    assert.equal(created.json.case.revision, 0);
    assert.equal(created.json.case.status, 'draft');
    assert.equal(created.json.case.builder.currentStepId, BUILDER_STEPS[0]);
    assert.deepEqual(created.json.case.builder.completedStepIds, []);
    assert.notEqual(created.json.case.builder.sessionId, caseId,
      'the protected builder session id must be distinct from the case id');

    await probeUnauthorisedAccess(harness, caseId, 'after creation');

    // -----------------------------------------------------------------------
    // STEP 3 + STEP 4 - autosave each step, then complete the steps in sequence.
    // -----------------------------------------------------------------------
    let revision = 0;
    for (const [index, stepId] of BUILDER_STEPS.entries()) {
      const autosaved = await call(harness, `${casePath(caseId)}/builder`, {
        method: 'PATCH',
        principal: 'student',
        body: { expectedRevision: revision, stepId, stepData: { draftedAt: index, note: `step ${stepId}` } },
        idempotencyKey: key(`autosave-${stepId}`),
      });
      assert.equal(autosaved.status, 200, `autosaving ${stepId} must succeed (got ${autosaved.status} ${autosaved.text})`);
      revision += 1;
      assert.equal(autosaved.json.case.revision, revision, `autosaving ${stepId} must advance exactly one revision`);
      assert.deepEqual(autosaved.json.case.builder.stepData[stepId], { draftedAt: index, note: `step ${stepId}` });
      assert.equal(autosaved.json.case.builder.completedStepIds.length, index,
        'autosave must not complete the step it saves');

      // Steps cannot be completed out of order: the step after next must be refused.
      const skipTarget = BUILDER_STEPS[index + 1];
      if (skipTarget) {
        const skipped = await call(harness, `${casePath(caseId)}/builder/complete`, {
          method: 'POST',
          principal: 'student',
          body: { expectedRevision: revision, stepId: skipTarget },
          idempotencyKey: key(`skip-${skipTarget}`),
        });
        assert.equal(skipped.status, 409, `completing ${skipTarget} out of order must conflict`);
        assert.equal(skipped.json.error, 'domain_invariant');
      }

      const completed = await call(harness, `${casePath(caseId)}/builder/complete`, {
        method: 'POST',
        principal: 'student',
        body: { expectedRevision: revision, stepId },
        idempotencyKey: key(`complete-${stepId}`),
      });
      assert.equal(completed.status, 200, `completing ${stepId} must succeed (got ${completed.status} ${completed.text})`);
      revision += 1;
      assert.equal(completed.json.case.revision, revision);
      assert.deepEqual(completed.json.case.builder.completedStepIds, BUILDER_STEPS.slice(0, index + 1));
      assert.equal(completed.json.case.builder.currentStepId, BUILDER_STEPS[index + 1] ?? null);
    }
    assert.equal(revision, BUILDER_STEPS.length * 2, 'each step must have cost exactly one autosave and one completion');

    await probeUnauthorisedAccess(harness, caseId, 'after the builder is complete');

    // -----------------------------------------------------------------------
    // STEP 5 - RE-ENTRY. The student closes the tab and comes back.
    // -----------------------------------------------------------------------
    const lastWriteProjection = (await readCase(harness, caseId)).json.case;
    const reentry = await readCase(harness, caseId);
    assert.deepEqual(reentry.json.case, lastWriteProjection,
      're-entry must return the persisted state identically');
    assert.equal(reentry.json.case.revision, revision);
    assert.deepEqual(reentry.json.case.builder.completedStepIds, [...BUILDER_STEPS]);
    assert.equal(reentry.json.case.builder.currentStepId, null);
    for (const [index, stepId] of BUILDER_STEPS.entries()) {
      assert.deepEqual(reentry.json.case.builder.stepData[stepId], { draftedAt: index, note: `step ${stepId}` },
        `${stepId} data must survive re-entry`);
    }

    const resumed = await call(harness, `${casePath(caseId)}/builder`, { principal: 'student' });
    assert.equal(resumed.status, 200, `resuming the builder must succeed (got ${resumed.status} ${resumed.text})`);
    assert.equal(resumed.json.progress.completedSteps, BUILDER_STEPS.length);
    assert.equal(resumed.json.progress.totalSteps, BUILDER_STEPS.length);
    assert.equal(resumed.json.progress.percent, 100);
    assert.equal(resumed.json.progress.nextStepId, null);
    assert.equal(resumed.json.projection.caseId, caseId);

    // -----------------------------------------------------------------------
    // STEP 6 - CONCURRENCY. Two writers reason about the same revision.
    // -----------------------------------------------------------------------
    const contestedStep = BUILDER_STEPS[0];
    const staleRevision = revision;
    const firstWriteKey = key('concurrent-first');
    const firstWriteBody = {
      expectedRevision: staleRevision,
      stepId: contestedStep,
      stepData: { writer: 'first-write', keepThis: true },
    };
    const firstWrite = await call(harness, `${casePath(caseId)}/builder`, {
      method: 'PATCH',
      principal: 'student',
      body: firstWriteBody,
      idempotencyKey: firstWriteKey,
    });
    assert.equal(firstWrite.status, 200, `the first concurrent write must land (got ${firstWrite.status} ${firstWrite.text})`);
    revision += 1;
    assert.equal(firstWrite.json.case.revision, revision);

    const secondWrite = await call(harness, `${casePath(caseId)}/builder`, {
      method: 'PATCH',
      principal: 'student',
      body: {
        expectedRevision: staleRevision,
        stepId: contestedStep,
        stepData: { writer: 'second-write', clobbered: true },
      },
      idempotencyKey: key('concurrent-second'),
    });
    assert.equal(secondWrite.status, 409,
      `a write against a stale revision must conflict, not overwrite (got ${secondWrite.status} ${secondWrite.text})`);
    assert.equal(secondWrite.json.error, 'stale_revision');

    const afterConflict = await readCase(harness, caseId);
    assert.equal(afterConflict.json.case.revision, revision, 'a rejected write must not advance the revision');
    assert.deepEqual(afterConflict.json.case.builder.stepData[contestedStep], { writer: 'first-write', keepThis: true },
      'the durable state must still hold the FIRST write');

    // -----------------------------------------------------------------------
    // STEP 7 - IDEMPOTENCY. The network drops the response and the client retries.
    // -----------------------------------------------------------------------
    const replay = await call(harness, `${casePath(caseId)}/builder`, {
      method: 'PATCH',
      principal: 'student',
      body: firstWriteBody,
      idempotencyKey: firstWriteKey,
    });
    assert.equal(replay.status, 200, `a replayed write must succeed (got ${replay.status} ${replay.text})`);
    assert.deepEqual(replay.json.case, firstWrite.json.case,
      'a replayed write must return the original result, not a new one');
    assert.equal((await readCase(harness, caseId)).json.case.revision, revision,
      'a replayed write must not advance the revision');

    // The key is bound to the request that minted it: reusing it for different intent is a
    // conflict, not a silent replay of the old payload and not a second write.
    const keyReuse = await call(harness, `${casePath(caseId)}/builder`, {
      method: 'PATCH',
      principal: 'student',
      body: { expectedRevision: revision, stepId: contestedStep, stepData: { writer: 'different-intent' } },
      idempotencyKey: firstWriteKey,
    });
    assert.equal(keyReuse.status, 409, `reusing a key for a different payload must conflict (got ${keyReuse.status} ${keyReuse.text})`);
    assert.equal(keyReuse.json.error, 'idempotency_conflict');
    const afterKeyReuse = await readCase(harness, caseId);
    assert.equal(afterKeyReuse.json.case.revision, revision);
    assert.deepEqual(afterKeyReuse.json.case.builder.stepData[contestedStep], { writer: 'first-write', keepThis: true });

    // -----------------------------------------------------------------------
    // STEP 8 - consent and waiver receipts.
    // -----------------------------------------------------------------------
    const consentKey = key('consent');
    const consentBody = {
      expectedRevision: revision,
      receiptType: 'consent',
      receiptData: {
        policyVersion: 'missionmed-lor-consent-2026-01',
        scopes: ['share_academic_record', 'share_clinical_evaluations'],
      },
    };
    const consent = await call(harness, `${casePath(caseId)}/receipts`, {
      method: 'POST',
      principal: 'student',
      body: consentBody,
      idempotencyKey: consentKey,
    });
    assert.equal(consent.status, 201, `recording consent must succeed (got ${consent.status} ${consent.text})`);
    revision += 1;
    assert.equal(consent.json.case.revision, revision);
    assert.equal(consent.json.case.consentReceipts.length, 1);
    assert.equal(consent.json.case.consentReceipts[0].actorId, STUDENT_A);
    assert.equal(consent.json.case.consentReceipts[0].caseId, caseId);
    assert.match(consent.json.case.consentReceipts[0].receiptHash, /^[a-f0-9]{64}$/u);

    // A client may not assert receipt identity, time, or integrity - only the decision itself.
    const forgedReceipt = await call(harness, `${casePath(caseId)}/receipts`, {
      method: 'POST',
      principal: 'student',
      body: {
        expectedRevision: revision,
        receiptType: 'consent',
        receiptData: {
          policyVersion: 'missionmed-lor-consent-2026-01',
          scopes: ['share_academic_record'],
          recordedAt: '2020-01-01T00:00:00.000Z',
        },
      },
      idempotencyKey: key('forged-consent'),
    });
    assert.equal(forgedReceipt.status, 400, 'a client-asserted receipt timestamp must be refused');
    assert.equal(forgedReceipt.json.error, 'validation_failed');

    const waiver = await call(harness, `${casePath(caseId)}/receipts`, {
      method: 'POST',
      principal: 'student',
      body: {
        expectedRevision: revision,
        receiptType: 'waiver',
        receiptData: {
          waived: false,
          policyVersion: 'missionmed-lor-waiver-2026-01',
          priorReceiptId: null,
          acknowledgment: 'I retain my right to review this letter.',
        },
      },
      idempotencyKey: key('waiver'),
    });
    assert.equal(waiver.status, 201, `recording the waiver must succeed (got ${waiver.status} ${waiver.text})`);
    revision += 1;
    assert.equal(waiver.json.case.revision, revision);
    assert.equal(waiver.json.case.waiverReceipts.length, 1);
    assert.equal(waiver.json.case.waiverReceipts[0].waived, false);
    assert.equal(waiver.json.case.waiverReceipts[0].priorReceiptId, null);

    // Replaying the consent receipt must not append a second decision to the append-only log.
    const consentReplay = await call(harness, `${casePath(caseId)}/receipts`, {
      method: 'POST',
      principal: 'student',
      body: consentBody,
      idempotencyKey: consentKey,
    });
    assert.equal(consentReplay.status, 201);
    assert.equal(consentReplay.json.case.consentReceipts.length, 1,
      'a replayed receipt must not duplicate the recorded decision');
    assert.equal(consentReplay.json.case.revision, revision,
      'a replayed receipt must not mint a new revision');

    await probeUnauthorisedAccess(harness, caseId, 'after receipts are recorded');

    // -----------------------------------------------------------------------
    // FACULTY PREPARATION - CLASSIFIED: no HTTP route exists for these transitions.
    //
    // invite -> verify -> author -> approve are not exposed by the application adapter in this
    // release, so they cannot be, and are not, driven over HTTP here. They are performed through
    // the REAL aggregate against the REAL repository instance the HTTP application is using, so
    // the state the release route reads is genuine domain state, produced by the same invariants
    // production would run. Nothing about the release itself is short-circuited.
    // -----------------------------------------------------------------------
    const invitationId = 'invitation_lor_e2e_1';
    const recipientEmailHash = sha256('faculty-writer@example.test');
    const outOfBand = async (label, next, expectedRevision) => harness.repository.save(next, {
      expectedRevision,
      idempotencyKey: `e2e-out-of-band-${label}-${randomUUID()}`,
      requestHash: hashValue({ operation: label, caseId: next.id, revision: next.revision }),
    });

    const beforeInvite = await harness.repository.getById(caseId);
    assert.equal(beforeInvite.revision, revision, 'the out-of-band prep must start from the HTTP state');
    const invited = bindFacultyInvitation(beforeInvite, {
      actorId: STUDENT_A,
      invitationId,
      recipientEmailHash,
    });
    await outOfBand('faculty.invited', invited, revision);
    revision += 1;

    const verified = bindVerifiedFaculty(invited, {
      actorId: FACULTY_A,
      invitationId,
      facultyId: FACULTY_A,
      recipientEmailHash,
    });
    await outOfBand('faculty.verified', verified, revision);
    revision += 1;

    const authored = setFacultyPrivateContent(verified, {
      actorId: FACULTY_A,
      facultyId: FACULTY_A,
      finalDocument: {
        id: FINAL_DOCUMENT_ID,
        text: FINAL_DOCUMENT_TEXT,
        mimeType: 'text/plain',
        contentHash: sha256(FINAL_DOCUMENT_TEXT),
      },
      documentState: 'faculty_final',
      facultyApproval: {
        approved: true,
        approvedAt: new Date().toISOString(),
        facultyId: FACULTY_A,
        signatureAttested: true,
      },
    });
    await outOfBand('faculty.private_content_updated', authored, revision);
    revision += 1;

    // -----------------------------------------------------------------------
    // STEP 10a - the student projection must NOT show the letter before release.
    // -----------------------------------------------------------------------
    const beforeRelease = await readCase(harness, caseId);
    assert.equal(beforeRelease.json.case.revision, revision);
    assert.equal(beforeRelease.json.case.status, 'faculty_verified');
    assert.equal(beforeRelease.json.case.finalDocument, null,
      'an approved, unreleased letter must not appear in the student projection');
    assert.equal(beforeRelease.text.includes(LETTER_SENTINEL), false,
      'the letter text must not cross the wire to the student before release');
    for (const forbidden of ['facultyPrivate', 'draftText', 'finalDocumentState']) {
      assert.equal(beforeRelease.text.includes(`"${forbidden}"`), false,
        `the student projection must not carry ${forbidden}`);
    }
    const resumeBeforeRelease = await call(harness, `${casePath(caseId)}/builder`, { principal: 'student' });
    assert.equal(resumeBeforeRelease.text.includes(LETTER_SENTINEL), false,
      'the resume projection must not leak the unreleased letter either');

    // The student builder is locked once the faculty workflow begins.
    const lockedAutosave = await call(harness, `${casePath(caseId)}/builder`, {
      method: 'PATCH',
      principal: 'student',
      body: { expectedRevision: revision, stepId: contestedStep, stepData: { late: true } },
      idempotencyKey: key('locked-autosave'),
    });
    assert.equal(lockedAutosave.status, 409, 'the builder must be locked after faculty invitation');
    assert.equal(lockedAutosave.json.error, 'domain_invariant');

    // -----------------------------------------------------------------------
    // STEP 9 - release the final document through the real route.
    // -----------------------------------------------------------------------
    const staleRelease = await call(harness, `${casePath(caseId)}/final-document/release`, {
      method: 'POST',
      principal: 'faculty',
      body: { expectedRevision: revision - 1, documentId: FINAL_DOCUMENT_ID },
      idempotencyKey: key('release-stale'),
    });
    assert.equal(staleRelease.status, 409, 'a release against a stale revision must conflict');
    assert.equal(staleRelease.json.error, 'stale_revision');
    assert.equal((await readCase(harness, caseId)).json.case.finalDocument, null,
      'a refused release must not grant the student sight of the letter');

    const wrongDocument = await call(harness, `${casePath(caseId)}/final-document/release`, {
      method: 'POST',
      principal: 'faculty',
      body: { expectedRevision: revision, documentId: 'doc_some_other_version' },
      idempotencyKey: key('release-wrong-document'),
    });
    assert.equal(wrongDocument.status, 409, 'a release must name the exact current final document');
    assert.equal(wrongDocument.json.error, 'domain_invariant');
    assert.equal((await readCase(harness, caseId)).json.case.finalDocument, null);

    const releaseKey = key('release');
    const releaseBody = { expectedRevision: revision, documentId: FINAL_DOCUMENT_ID };
    const released = await call(harness, `${casePath(caseId)}/final-document/release`, {
      method: 'POST',
      principal: 'faculty',
      body: releaseBody,
      idempotencyKey: releaseKey,
    });
    assert.equal(released.status, 200, `the release must succeed (got ${released.status} ${released.text})`);
    revision += 1;
    assert.equal(released.json.case.schemaVersion, 'missionmed.lor.faculty-projection.v1');
    assert.equal(released.json.case.revision, revision,
      'the release must actually commit a revision, not report success over an unchanged case');

    const releasedRecord = await harness.repository.getById(caseId);
    assert.equal(releasedRecord.finalDocumentState.release.documentId, FINAL_DOCUMENT_ID);
    assert.equal(releasedRecord.finalDocumentState.release.releasedAtRevision, revision);
    assert.equal(
      releasedRecord.facultyPrivate.finalDocument.releasedToStudentAt,
      releasedRecord.finalDocumentState.release.releasedAt,
      'student visibility must mirror the recorded release exactly',
    );

    // Replaying the release must not mint a second revision or a second release timestamp.
    const releaseReplay = await call(harness, `${casePath(caseId)}/final-document/release`, {
      method: 'POST',
      principal: 'faculty',
      body: releaseBody,
      idempotencyKey: releaseKey,
    });
    assert.equal(releaseReplay.status, 200, `a replayed release must succeed (got ${releaseReplay.status} ${releaseReplay.text})`);
    assert.equal(releaseReplay.json.case.revision, revision, 'a replayed release must not advance the revision');
    const afterReleaseReplay = await harness.repository.getById(caseId);
    assert.equal(
      afterReleaseReplay.finalDocumentState.release.releasedAt,
      releasedRecord.finalDocumentState.release.releasedAt,
      'a replayed release must not re-stamp the release time',
    );

    // -----------------------------------------------------------------------
    // STEP 10b - the student projection now shows the released document.
    // -----------------------------------------------------------------------
    const afterRelease = await readCase(harness, caseId);
    assert.notEqual(afterRelease.json.case.finalDocument, null,
      'the released letter must now be visible to the student');
    assert.equal(afterRelease.json.case.finalDocument.id, FINAL_DOCUMENT_ID);
    assert.equal(afterRelease.json.case.finalDocument.text, FINAL_DOCUMENT_TEXT);
    assert.equal(afterRelease.text.includes(LETTER_SENTINEL), true,
      'the released letter must reach the student over the wire');
    assert.equal(
      afterRelease.json.case.finalDocument.releasedToStudentAt,
      releasedRecord.finalDocumentState.release.releasedAt,
    );
    assert.equal(beforeRelease.json.case.finalDocument, null,
      'the before/after contrast is the whole point: it was null before the release route ran');

    // -----------------------------------------------------------------------
    // STEP 11 - no unauthorised cross-student read succeeds, including now.
    // -----------------------------------------------------------------------
    await probeUnauthorisedAccess(harness, caseId, 'after the letter is released');

    // The metadata event stream must carry the journey without carrying its content.
    const emitted = harness.events.snapshot();
    const serializedEvents = JSON.stringify(emitted);
    assert.equal(serializedEvents.includes(LETTER_SENTINEL), false,
      'the metadata event stream must never carry letter content');
    assert.equal(serializedEvents.includes(STUDENT_A), false,
      'the metadata event stream must carry pseudonymized references only');
    assert.equal(serializedEvents.includes(caseId), false,
      'the metadata event stream must not carry raw case identifiers');
    const eventTypes = emitted.map((event) => event.eventType);
    assert.equal(eventTypes.includes('case.created'), true);
    assert.equal(eventTypes.includes('builder.step_completed'), true);
    assert.equal(eventTypes.includes('consent.recorded'), true);
    assert.equal(eventTypes.includes('waiver.recorded'), true);
    assert.equal(eventTypes.includes('faculty.final_document_released'), true);
    assert.equal(
      eventTypes.filter((type) => type === 'faculty.final_document_released').length,
      1,
      'a replayed release must not emit a second release event',
    );
  } finally {
    await harness.close();
  }
});

test('the mounted HTTP boundary enforces its own gates before any application code runs', async () => {
  const harness = await startJourneyHarness();
  try {
    // A mutation without the session's CSRF token is refused even though the caller is
    // authenticated and entitled.
    const noCsrf = await call(harness, '/api/lor-studio/cases', {
      method: 'POST',
      principal: 'student',
      body: {},
      idempotencyKey: key('csrf-missing'),
      csrf: null,
    });
    assert.equal(noCsrf.status, 403, `a mutation without CSRF must be refused (got ${noCsrf.status} ${noCsrf.text})`);
    assert.equal(noCsrf.json.error, 'csrf_validation_failed');

    // Another principal's token is not this session's token.
    const borrowedCsrf = await call(harness, '/api/lor-studio/cases', {
      method: 'POST',
      principal: 'student',
      body: {},
      idempotencyKey: key('csrf-borrowed'),
      csrf: harness.sessions.get('otherStudent').csrfToken,
    });
    assert.equal(borrowedCsrf.status, 403, 'a CSRF token belonging to another session must not be accepted');
    assert.equal(borrowedCsrf.json.error, 'csrf_validation_failed');

    // Every write must be replay-safe, so the key is mandatory.
    const noKey = await call(harness, '/api/lor-studio/cases', {
      method: 'POST',
      principal: 'student',
      body: {},
    });
    assert.equal(noKey.status, 400, 'a write without an Idempotency-Key must be refused');
    assert.equal(noKey.json.error, 'validation_failed');

    // The create payload allowlist is exact: the client may not assert identity.
    const forgedIdentity = await call(harness, '/api/lor-studio/cases', {
      method: 'POST',
      principal: 'student',
      body: { studentId: STUDENT_B, caseId: 'case_chosen_by_the_client' },
      idempotencyKey: key('forged-identity'),
    });
    assert.equal(forgedIdentity.status, 400, 'a client may not assert case identity or ownership');
    assert.equal(forgedIdentity.json.error, 'validation_failed');

    // Unknown routes under the API prefix must not fall through to a projection.
    const created = await call(harness, '/api/lor-studio/cases', {
      method: 'POST',
      principal: 'student',
      body: {},
      idempotencyKey: key('gates-create'),
    });
    assert.equal(created.status, 201);
    const caseId = created.json.case.caseId;
    const partialRoute = await call(harness, `${casePath(caseId)}/final-document`, { principal: 'student' });
    assert.equal(partialRoute.status, 404, '/final-document is not a resource and must not project the case');
    assert.equal(partialRoute.text.includes('student-projection'), false);

    // Security headers are present on a real socket response, not just in unit assertions.
    const projection = await call(harness, casePath(caseId), { principal: 'student' });
    assert.equal(projection.status, 200);
    assert.equal(projection.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(projection.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(projection.headers.get('referrer-policy'), 'same-origin');
    assert.equal(projection.headers.get('x-missionmed-lor-mode'), 'protected');
    assert.match(projection.headers.get('content-security-policy') ?? '', /default-src 'self'/u);
  } finally {
    await harness.close();
  }
});
