import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createLorStudioRuntime,
  canonicalizeLorSessionSubject,
  evaluateLorEntitlement,
  isLorStudioRequestPath,
  LOR_CANDIDATE_AUTH_START_PATH,
  LOR_CANDIDATE_AUTH_START_CONTRACT,
  LOR_CANDIDATE_HANDOFF_COOKIE_PATH,
  LOR_CANDIDATE_HANDOFF_COOKIE_NAME,
  LOR_CANDIDATE_HANDOFF_SCHEMA,
  LOR_CANDIDATE_IDENTITY_CLASS,
  LOR_SESSION_CANDIDATE_INVITATION_FIELD,
  LOR_SESSION_IDENTITY_CLASS_FIELD,
  LOR_STUDENT_IDENTITY_CLASS,
  resolveLorStudioFlags,
  validateFreshLorSession,
} from '../../lor-studio/http/runtime.mjs';
import { readTrustedRequestContext } from '../../lor-studio/security/trusted-request-context.mjs';
import { readFacultyCandidateCredentialContext } from '../../lor-studio/security/faculty-candidate-credential-context.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(testDirectory, '..', '..', 'public', 'lor-studio');
const NOW = new Date('2026-08-09T16:00:00.000Z');

test('candidate auth exports one exact server wiring contract without browser secrets', () => {
  assert.equal(LOR_CANDIDATE_IDENTITY_CLASS, 'faculty_candidate');
  assert.equal(LOR_STUDENT_IDENTITY_CLASS, 'student');
  assert.equal(LOR_SESSION_IDENTITY_CLASS_FIELD, 'lorAdmissionIdentityClass');
  assert.equal(LOR_SESSION_CANDIDATE_INVITATION_FIELD, 'lorFacultyCandidateInvitationId');
  assert.equal(LOR_CANDIDATE_HANDOFF_COOKIE_PATH, '/api/lor-studio/auth/');
  assert.equal(
    LOR_CANDIDATE_HANDOFF_SCHEMA,
    'missionmed.lor.faculty-candidate-auth-handoff.v1',
  );
  assert.equal(LOR_CANDIDATE_AUTH_START_CONTRACT.inspectionMethod, 'inspectSealedHandoff');
  assert.equal(LOR_CANDIDATE_AUTH_START_CONTRACT.identityClass, 'faculty_candidate');
  assert.doesNotMatch(JSON.stringify(LOR_CANDIDATE_AUTH_START_CONTRACT), /rawTokenValue|secret/iu);
});

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
    user: { id: 'wp:1', roles: ['subscriber'] },
    ...overrides,
  };
}

function entitlement(overrides = {}) {
  return {
    available: true,
    sourceVerified: true,
    studentId: 'wp:1',
    actorId: 'wp:1',
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

function candidateCredential(invitationId = 'invite_abc-123', overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-candidate-credential.v1',
    authoritySource: 'server_verified_sealed_candidate_cookie',
    authenticatedSubject: 'wp:1',
    invitationId,
    caseId: 'case-candidate-1',
    requiresOtpVerification: true,
    tokenHash: 'a'.repeat(64),
    flowNonceHash: 'b'.repeat(64),
    issuedAt: '2026-08-09T15:55:00.000Z',
    expiresAt: '2026-08-09T16:05:00.000Z',
    clientAsserted: false,
    ...overrides,
  };
}

function candidateHandoff(invitationId = 'invite_abc-123', overrides = {}) {
  return {
    schemaVersion: 'missionmed.lor.faculty-candidate-auth-handoff.v1',
    authoritySource: 'server_verified_invitation_token_exchange',
    invitationId,
    sealedHandoff: `lorch1.${'i'.repeat(16)}.${'c'.repeat(64)}.${'t'.repeat(22)}`,
    issuedAt: '2026-08-09T15:59:00.000Z',
    expiresAt: '2026-08-09T16:09:00.000Z',
    singlePurpose: true,
    clientAsserted: false,
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

async function invoke(activeRuntime, route, {
  method = 'GET',
  activeSession = session(),
  headers = {},
  body = null,
  activeCandidateCredential = null,
} = {}) {
  const request = Readable.from(body === null ? [] : [Buffer.from(JSON.stringify(body))]);
  request.method = method;
  request.headers = headers;
  request.url = route;
  const response = new MemoryResponse();
  await activeRuntime.handle(request, response, new URL(route, 'https://hq.example.test'), {
    session: activeSession,
    candidateCredential: activeCandidateCredential,
  });
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

test('session identity is canonicalized to wp:<id> and rejects ambiguous identifiers', () => {
  for (const [input, expected] of [
    [123, 'wp:123'],
    ['123', 'wp:123'],
    ['wp:123', 'wp:123'],
  ]) assert.equal(canonicalizeLorSessionSubject(input), expected);
  for (const input of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '', '0', '01', 'wp:0', 'wp:01', 'student-1']) {
    assert.equal(canonicalizeLorSessionSubject(input), null);
  }
  assert.equal(validateFreshLorSession(session({ user: { id: 1 } }), NOW).subject, 'wp:1');
  assert.equal(validateFreshLorSession(session({ user: { id: '1' } }), NOW).subject, 'wp:1');
  assert.equal(validateFreshLorSession(
    session({ user: { id: 'student-1' } }),
    NOW,
    { requireCanonicalSubject: true },
  ).error, 'invalid_session');
  assert.equal(validateFreshLorSession(session({ user: { id: 'student-1' } }), NOW).subject, 'student-1');
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
    [entitlement({ actorId: 'wp:2' }), 403, 'entitlement_subject_mismatch'],
    [entitlement({ actorId: 'wp:2', role: 'faculty' }), 403, 'entitlement_subject_mismatch'],
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

test('general bootstrap accepts only an exact single canonical case scope', async () => {
  let bootstrapCalls = 0;
  const activeRuntime = runtime({
    application: {
      getBootstrap: async () => {
        bootstrapCalls += 1;
        return {
          operational: true,
          runtimeMode: 'live',
          storageMode: 'durable',
          providersReady: true,
        };
      },
    },
  });

  const scoped = await invoke(activeRuntime, '/api/lor-studio/bootstrap?case=case-1');
  assert.equal(scoped.statusCode, 200);
  assert.equal(bootstrapCalls, 1);

  for (const forbidden of [
    '/api/lor-studio/bootstrap?case=',
    '/api/lor-studio/bootstrap?case=case-1&case=case-1',
    '/api/lor-studio/bootstrap?case=case-1&actor=faculty',
    '/api/lor-studio/bootstrap?case=case%2Fother',
  ]) {
    const response = await invoke(activeRuntime, forbidden);
    assert.equal(response.statusCode, 400, forbidden);
    assert.equal(JSON.parse(response.body).error, 'lor_bootstrap_query_forbidden', forbidden);
  }
  assert.equal(bootstrapCalls, 1, 'forbidden query shapes never reach the application');
});

test('a branded production resolver opens trusted context only around application dispatch', async () => {
  const projection = entitlement();
  let observedContext = null;
  let applicationInput = null;
  const activeRuntime = runtime({
    entitlementResolver: {
      requiresTrustedRequestContext: true,
      resolve: async () => projection,
      consumeTrustedRequestContext(value) {
        assert.equal(value, projection);
        return {
          schemaVersion: 'missionmed.lor.trusted-request-context.v1',
          authenticatedSubject: 'wp:1',
          actorRole: 'student',
          sourceReferenceHash: 'a'.repeat(64),
          proofHash: 'b'.repeat(64),
          entitlementVerified: true,
          lorEnabled: true,
          canaryAuthorized: true,
          clientAsserted: false,
        };
      },
    },
    application: {
      getBootstrap: async (input) => {
        applicationInput = input;
        observedContext = readTrustedRequestContext();
        return {
          operational: true,
          runtimeMode: 'live',
          storageMode: 'durable',
          providersReady: true,
        };
      },
    },
  });
  const response = await invoke(activeRuntime, '/api/lor-studio/bootstrap', {
    activeSession: session({
      lorAdmissionGrant: 'must-not-cross-application-boundary',
      wpAuthorization: 'must-not-cross-application-boundary',
    }),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(observedContext.authenticatedSubject, 'wp:1');
  assert.deepEqual(Object.keys(applicationInput).sort(), ['actor', 'entitlement']);
  assert.equal(JSON.stringify(applicationInput).includes('must-not-cross'), false);
  assert.throws(() => readTrustedRequestContext(), /unavailable/u);
});

test('trusted invitation policy admits only the exact pre-case candidate without rewriting canary facts', async () => {
  const projection = entitlement({
    role: 'faculty',
    canaryEnabled: false,
    canaryConsented: false,
  });
  const trustedResolver = {
    requiresTrustedRequestContext: true,
    resolve: async () => projection,
    consumeTrustedRequestContext(value) {
      assert.equal(value, projection);
      return {
        schemaVersion: 'missionmed.lor.trusted-request-context.v1',
        authenticatedSubject: 'wp:1',
        actorRole: 'faculty',
        sourceReferenceHash: 'a'.repeat(64),
        proofHash: 'b'.repeat(64),
        entitlementVerified: true,
        lorEnabled: true,
        canaryAuthorized: true,
        clientAsserted: false,
      };
    },
  };
  const activeRuntime = runtime({ entitlementResolver: trustedResolver });
  const activeSession = session({
    [LOR_SESSION_IDENTITY_CLASS_FIELD]: LOR_CANDIDATE_IDENTITY_CLASS,
    [LOR_SESSION_CANDIDATE_INVITATION_FIELD]: 'invite_abc-123',
  });
  const candidateUrl = new URL(
    '/api/lor-studio/invitations/invite_abc-123/verify',
    'https://hq.example.test',
  );
  const admitted = await activeRuntime.authorize(
    { method: 'POST', headers: {} },
    activeSession,
    { url: candidateUrl, candidateCredential: candidateCredential() },
  );
  assert.equal(admitted.ok, true);
  assert.equal(admitted.actor.role, 'faculty');
  assert.equal(admitted.entitlement.canaryEnabled, false);
  assert.equal(admitted.entitlement.canaryConsented, false);

  for (const denied of [
    await activeRuntime.authorize(
      { method: 'GET', headers: {} },
      activeSession,
      { url: new URL('/api/lor-studio/bootstrap', 'https://hq.example.test') },
    ),
    await activeRuntime.authorize(
      { method: 'POST', headers: {} },
      activeSession,
      { url: candidateUrl, candidateCredential: candidateCredential('invite_other') },
    ),
    await activeRuntime.authorize(
      { method: 'POST', headers: {} },
      session(),
      { url: candidateUrl, candidateCredential: candidateCredential() },
    ),
    await runtime({ entitlementResolver: { resolve: async () => projection } }).authorize(
      { method: 'POST', headers: {} },
      activeSession,
      { url: candidateUrl, candidateCredential: candidateCredential() },
    ),
  ]) {
    assert.equal(denied.ok, false);
    assert.equal(denied.error, 'lor_canary_consent_required');
  }
});

test('a resolver declaring trusted context fails closed when its context cannot be consumed', async () => {
  const activeRuntime = runtime({
    entitlementResolver: {
      requiresTrustedRequestContext: true,
      resolve: async () => entitlement(),
      consumeTrustedRequestContext() { throw new Error('unbranded'); },
    },
  });
  const response = await invoke(activeRuntime, '/api/lor-studio/bootstrap');
  assert.equal(response.statusCode, 503);
  assert.equal(JSON.parse(response.body).error, 'entitlement_lookup_failed');
});

test('a branded resolver must supply an exact identity-bound context before authorization succeeds', async () => {
  const cases = [
    [undefined, 503, 'entitlement_lookup_failed'],
    [{
      schemaVersion: 'missionmed.lor.trusted-request-context.v1',
      authenticatedSubject: 'wp:2',
      actorRole: 'student',
      sourceReferenceHash: 'a'.repeat(64),
      proofHash: 'b'.repeat(64),
      entitlementVerified: true,
      lorEnabled: true,
      canaryAuthorized: true,
      clientAsserted: false,
    }, 403, 'trusted_context_identity_mismatch'],
    [{
      schemaVersion: 'missionmed.lor.trusted-request-context.v1',
      authenticatedSubject: 'wp:1',
      actorRole: 'mentor',
      sourceReferenceHash: 'a'.repeat(64),
      proofHash: 'b'.repeat(64),
      entitlementVerified: true,
      lorEnabled: true,
      canaryAuthorized: true,
      clientAsserted: false,
    }, 403, 'trusted_context_identity_mismatch'],
  ];
  for (const [context, status, code] of cases) {
    const activeRuntime = runtime({
      entitlementResolver: {
        requiresTrustedRequestContext: true,
        resolve: async () => entitlement(),
        consumeTrustedRequestContext: () => context,
      },
    });
    const response = await invoke(activeRuntime, '/api/lor-studio/bootstrap');
    assert.equal(response.statusCode, status);
    assert.equal(JSON.parse(response.body).error, code);
  }
});

test('authorize returns no decrypted session credentials', async () => {
  const activeRuntime = runtime();
  const access = await activeRuntime.authorize(
    { method: 'GET', headers: {} },
    session({
      lorAdmissionGrant: 'private-admission-grant',
      wpAuthorization: 'private-service-credential',
    }),
  );
  assert.equal(access.ok, true);
  assert.equal(Object.hasOwn(access, 'session'), false);
  assert.equal(JSON.stringify(access).includes('private-'), false);
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

test('anonymous candidate start is the one invitation-bound pre-session exchange and emits only an opaque cookie', async () => {
  const rawToken = 't'.repeat(43);
  const calls = [];
  let entitlementLookups = 0;
  const activeRuntime = runtime({
    entitlementResolver: {
      async resolve() {
        entitlementLookups += 1;
        throw new Error('ordinary authorization must not run');
      },
    },
    candidateAuthStartService: {
      async exchangeInvitationToken(input) {
        calls.push(structuredClone(input));
        return candidateHandoff();
      },
    },
  });
  const response = await invoke(activeRuntime, LOR_CANDIDATE_AUTH_START_PATH, {
    method: 'POST',
    activeSession: null,
    headers: {
      'content-type': 'application/json',
      origin: 'https://hq.example.test',
      'sec-fetch-site': 'same-origin',
      'x-missionmed-lor-candidate': '1',
    },
    body: { invitationId: 'invite_abc-123', rawToken },
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.body, '');
  assert.equal(entitlementLookups, 0);
  assert.deepEqual(calls, [{ invitationId: 'invite_abc-123', rawToken }]);
  const cookie = response.headers['Set-Cookie'];
  assert.match(cookie, new RegExp(`^${LOR_CANDIDATE_HANDOFF_COOKIE_NAME}=lorch1\\.`, 'u'));
  assert.match(cookie, /; Max-Age=540; Path=\/api\/lor-studio\/auth\/; HttpOnly; Secure; SameSite=Lax$/u);
  assert.doesNotMatch(cookie, new RegExp(rawToken, 'u'));
  assert.doesNotMatch(cookie, /invite_abc-123/u);
  assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
});

test('candidate start rejects every widening before token exchange and clears any stale handoff', async () => {
  let exchanges = 0;
  const activeRuntime = runtime({
    candidateAuthStartService: {
      async exchangeInvitationToken() {
        exchanges += 1;
        return candidateHandoff();
      },
    },
  });
  const validHeaders = {
    'content-type': 'application/json',
    origin: 'https://hq.example.test',
    'sec-fetch-site': 'same-origin',
    'x-missionmed-lor-candidate': '1',
  };
  const validBody = { invitationId: 'invite_abc-123', rawToken: 't'.repeat(43) };
  const attempts = [
    [LOR_CANDIDATE_AUTH_START_PATH, { method: 'GET', activeSession: null }, 405],
    [`${LOR_CANDIDATE_AUTH_START_PATH}?role=faculty`, {
      method: 'POST', activeSession: null, headers: validHeaders, body: validBody,
    }, 400],
    [LOR_CANDIDATE_AUTH_START_PATH, {
      method: 'POST', activeSession: null,
      headers: { ...validHeaders, origin: 'https://attacker.example' }, body: validBody,
    }, 403],
    [LOR_CANDIDATE_AUTH_START_PATH, {
      method: 'POST', activeSession: null,
      headers: { ...validHeaders, 'x-missionmed-lor-candidate': 'faculty' }, body: validBody,
    }, 403],
    [LOR_CANDIDATE_AUTH_START_PATH, {
      method: 'POST', activeSession: null,
      headers: { ...validHeaders, 'sec-fetch-site': 'cross-site' }, body: validBody,
    }, 403],
    [LOR_CANDIDATE_AUTH_START_PATH, {
      method: 'POST', activeSession: null,
      headers: { ...validHeaders, 'content-type': 'text/plain' }, body: validBody,
    }, 400],
    [LOR_CANDIDATE_AUTH_START_PATH, {
      method: 'POST', activeSession: null, headers: validHeaders,
      body: { ...validBody, actor: { id: 'wp:1', role: 'faculty' } },
    }, 400],
    [LOR_CANDIDATE_AUTH_START_PATH, {
      method: 'POST', activeSession: null, headers: validHeaders,
      body: { ...validBody, rawToken: 'short' },
    }, 400],
  ];

  for (const [route, options, expectedStatus] of attempts) {
    const response = await invoke(activeRuntime, route, options);
    assert.equal(response.statusCode, expectedStatus);
    assert.match(
      response.headers['Set-Cookie'],
      new RegExp(`^${LOR_CANDIDATE_HANDOFF_COOKIE_NAME}=; Max-Age=0;`, 'u'),
    );
    assert.doesNotMatch(response.body, /tttttttt|wp:1|faculty/u);
  }
  assert.equal(exchanges, 0);
});

test('candidate start fails closed for an absent, denying, or malformed trusted exchange service', async () => {
  const headers = {
    'content-type': 'application/json',
    origin: 'https://hq.example.test',
    'x-missionmed-lor-candidate': '1',
  };
  const body = { invitationId: 'invite_abc-123', rawToken: 't'.repeat(43) };

  const absent = await invoke(runtime(), LOR_CANDIDATE_AUTH_START_PATH, {
    method: 'POST', activeSession: null, headers, body,
  });
  assert.equal(absent.statusCode, 503);
  assert.equal(JSON.parse(absent.body).error, 'candidate_auth_start_unavailable');

  const deniedRuntime = runtime({
    candidateAuthStartService: {
      async exchangeInvitationToken() {
        throw Object.assign(new Error('must not escape'), { code: 'INVITATION_DENIED' });
      },
    },
  });
  const denied = await invoke(deniedRuntime, LOR_CANDIDATE_AUTH_START_PATH, {
    method: 'POST', activeSession: null, headers, body,
  });
  assert.equal(denied.statusCode, 403);
  assert.deepEqual(JSON.parse(denied.body), {
    error: 'candidate_auth_start_denied',
    message: 'Faculty invitation sign-in could not be started.',
  });
  assert.doesNotMatch(denied.body, /must not escape|invite_abc|tttt/u);

  for (const malformed of [
    null,
    candidateHandoff('another-invitation'),
    candidateHandoff('invite_abc-123', { sealedHandoff: 'raw-browser-token' }),
    candidateHandoff('invite_abc-123', { expiresAt: '2026-08-09T16:30:00.000Z' }),
    { ...candidateHandoff(), actor: { id: 'wp:1', role: 'faculty' } },
  ]) {
    const malformedRuntime = runtime({
      candidateAuthStartService: { async exchangeInvitationToken() { return malformed; } },
    });
    const response = await invoke(malformedRuntime, LOR_CANDIDATE_AUTH_START_PATH, {
      method: 'POST', activeSession: null, headers, body,
    });
    assert.equal(response.statusCode, 503);
    assert.equal(JSON.parse(response.body).error, 'candidate_auth_start_unavailable');
    assert.doesNotMatch(response.body, /invite_abc|wp:1|faculty|tttt/u);
  }
});

test('candidate start service shape is validated at construction', () => {
  assert.throws(
    () => runtime({ candidateAuthStartService: {} }),
    /candidateAuthStartService\.exchangeInvitationToken/u,
  );
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

test('an invitation-bound faculty candidate can load only the three production code assets', async () => {
  const stagedPublic = await mkdtemp(path.join(tmpdir(), 'lor-candidate-assets-'));
  const assets = [
    ['production-adapter.css', 'body { color: white; }\n'],
    ['production-projection-ui.js', 'globalThis.LorProductionProjectionUi = null;\n'],
    ['production-adapter.js', 'globalThis.__lorAdapterLoaded = true;\n'],
  ];
  for (const [name, contents] of assets) await writeFile(path.join(stagedPublic, name), contents, 'utf8');

  const candidateSession = session({
    [LOR_SESSION_IDENTITY_CLASS_FIELD]: LOR_CANDIDATE_IDENTITY_CLASS,
    [LOR_SESSION_CANDIDATE_INVITATION_FIELD]: 'invite_abc-123',
  });
  let entitlementLookups = 0;
  const candidateRuntime = runtime({
    publicDirectory: stagedPublic,
    entitlementResolver: {
      resolve: async () => {
        entitlementLookups += 1;
        throw new Error('candidate assets must not enter the general entitlement path');
      },
    },
  });

  try {
    for (const [name, contents] of assets) {
      const response = await invoke(candidateRuntime, `/lor-studio/${name}`, {
        activeSession: candidateSession,
        activeCandidateCredential: candidateCredential(),
      });
      assert.equal(response.statusCode, 200, name);
      assert.equal(response.body, contents, name);
    }
    assert.equal(entitlementLookups, 0);

    for (const invalidCredential of [
      null,
      candidateCredential('invite_other'),
      candidateCredential('invite_abc-123', { expiresAt: '2026-08-09T15:59:59.000Z' }),
    ]) {
      const response = await invoke(candidateRuntime, '/lor-studio/production-adapter.js', {
        activeSession: candidateSession,
        activeCandidateCredential: invalidCredential,
      });
      assert.notEqual(response.statusCode, 200);
      assert.doesNotMatch(response.body, /__lorAdapterLoaded/u);
    }
    assert.equal(entitlementLookups, 3, 'invalid credentials fail through the ordinary closed admission path');
  } finally {
    await rm(stagedPublic, { force: true, recursive: true });
  }
});

test('exact faculty invitation deep links serve the protected application shell without widening assets', async () => {
  const deepLink = '/lor-studio/invitations/invite_abc-123';
  const candidate = runtime({
    entitlementResolver: { resolve: async () => entitlement({ role: 'faculty' }) },
  });
  const authorized = await invoke(candidate, deepLink, {
    activeCandidateCredential: candidateCredential(),
  });
  assert.equal(authorized.statusCode, 200);
  assert.match(authorized.headers['Content-Type'], /text\/html/u);
  assert.match(authorized.body, /id="lorRuntimeGate"/u);
  assert.equal(authorized.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(authorized.headers['X-Robots-Tag'], 'noindex, nofollow');

  const trailingSlash = await invoke(candidate, `${deepLink}/`, {
    activeCandidateCredential: candidateCredential(),
  });
  assert.equal(trailingSlash.statusCode, 200);
  assert.equal(trailingSlash.body, authorized.body);

  const anonymous = await invoke(runtime(), deepLink, { activeSession: null });
  assert.equal(anonymous.statusCode, 200);
  assert.match(anonymous.body, /id="candidateContinue"/u);
  assert.doesNotMatch(anonymous.body, /id="lorRuntimeGate"/u);

  const alreadySignedIn = await invoke(candidate, deepLink);
  assert.equal(alreadySignedIn.statusCode, 200);
  assert.match(alreadySignedIn.body, /id="candidateContinue"/u);
  assert.doesNotMatch(alreadySignedIn.body, /id="lorRuntimeGate"/u);

  const mismatchedCredential = await invoke(candidate, deepLink, {
    activeCandidateCredential: candidateCredential('another-invitation'),
  });
  assert.equal(mismatchedCredential.statusCode, 200);
  assert.match(mismatchedCredential.body, /id="candidateContinue"/u);
  assert.doesNotMatch(mismatchedCredential.body, /id="lorRuntimeGate"/u);

  for (const invalidCredential of [
    candidateCredential('invite_abc-123', { expiresAt: '2026-08-09T15:59:59.000Z' }),
    candidateCredential('invite_abc-123', { authenticatedSubject: 'wp:2' }),
    { invitationId: 'invite_abc-123', rawToken: 'browser-asserted' },
  ]) {
    const response = await invoke(candidate, deepLink, {
      activeCandidateCredential: invalidCredential,
    });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /id="candidateContinue"/u);
    assert.doesNotMatch(response.body, /id="lorRuntimeGate"/u);
    assert.doesNotMatch(response.body, /browser-asserted|wp:2/u);
  }

  const featureOff = await invoke(runtime({
    flags: { enabled: false, killSwitch: false, requireCanary: true },
  }), deepLink, { activeSession: null });
  assert.equal(featureOff.statusCode, 404);
  assert.doesNotMatch(featureOff.body, /id="candidateContinue"|id="lorRuntimeGate"/u);

  const killed = await invoke(runtime({
    flags: { enabled: true, killSwitch: true, requireCanary: true },
  }), deepLink);
  assert.equal(killed.statusCode, 423);
  assert.doesNotMatch(killed.body, /id="candidateContinue"|id="lorRuntimeGate"/u);

  for (const unsafe of [
    '/lor-studio/invitations/invite_abc-123/extra',
    '/lor-studio/invitations/invite%2Fother',
    '/lor-studio/invitations/invite%00other',
  ]) {
    const response = await invoke(runtime(), unsafe);
    assert.equal(response.statusCode, 404);
    assert.equal(JSON.parse(response.body).error, 'lor_asset_not_found');
  }
});

test('candidate bootstrap is invitation-scoped and verification receives only the server credential context', async () => {
  const seen = [];
  const activeRuntime = runtime({
    entitlementResolver: { resolve: async () => entitlement({ role: 'faculty' }) },
    application: {
      async getBootstrap() {
        return {
          operational: true,
          runtimeMode: 'live',
          storageMode: 'durable',
          providersReady: true,
          capabilities: { builder: true, export: true },
        };
      },
      async handleRequest() {
        seen.push(readFacultyCandidateCredentialContext());
        return { status: 200, body: { verification: { verified: true } } };
      },
    },
  });
  const credential = candidateCredential();
  const bootstrap = await invoke(
    activeRuntime,
    '/api/lor-studio/invitations/invite_abc-123/bootstrap',
    { activeCandidateCredential: credential },
  );
  assert.equal(bootstrap.statusCode, 200);
  assert.deepEqual(JSON.parse(bootstrap.body).capabilities, { verifyInvitation: true });

  const verified = await invoke(
    activeRuntime,
    '/api/lor-studio/invitations/invite_abc-123/verify',
    {
      method: 'POST',
      headers: { 'x-mmhq-csrf': 'csrf-test-value' },
      activeCandidateCredential: credential,
    },
  );
  assert.equal(verified.statusCode, 200);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].tokenHash, credential.tokenHash);
  assert.equal(seen[0].invitationId, credential.invitationId);
  assert.throws(() => readFacultyCandidateCredentialContext(), /unavailable/u);

  const otherInvitation = await invoke(
    activeRuntime,
    '/api/lor-studio/invitations/invite_other/bootstrap',
    { activeCandidateCredential: credential },
  );
  assert.equal(otherInvitation.statusCode, 403);
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

test('private opaque download buffers are zeroed only after response completion', async () => {
  const plaintext = Buffer.from('private artifact response bytes', 'utf8');
  const expected = Buffer.from(plaintext);
  const response = await invoke(runtime({
    application: {
      handleRequest: async () => ({
        status: 200,
        binary: {
          body: plaintext,
          contentType: 'application/octet-stream',
          filename: 'private.bin',
          sensitive: true,
        },
      }),
    },
  }), '/api/lor-studio/cases/case-1/private-artifacts/object-1/versions/version-1?contentClass=student_prepared&purpose=case_workflow');

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/octet-stream');
  assert.equal(response.raw.equals(expected), true);
  assert.equal(plaintext.every((byte) => byte === 0), true);
  expected.fill(0);
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

test('public snapshot executes the Founder-approved application and rejects the reduced renderer', async () => {
  const manifest = JSON.parse(await readFile(path.join(publicDirectory, 'FROZEN_PRESENTATION_MANIFEST.json'), 'utf8'));
  const html = await readFile(path.join(publicDirectory, 'index.html'), 'utf8');
  assert.equal(manifest.sourceSha256, 'c249373619a45c31a1b895363fb1d3806d966c8fc413e0acdc4df0870c5a51b7');
  assert.equal(createHash('sha256').update(html).digest('hex'), manifest.outputSha256);
  assert.equal(manifest.adapterVersion, 8);
  assert.deepEqual(manifest.securityTransforms, [
    'toast_text_only',
    'production_local_storage_disabled',
    'founder_approved_runtime_executable',
    'reduced_projection_runtime_rejected',
    'faculty_ai_case_boundary_enforced',
    'student_release_export_restored',
    'durable_applicant_options_only',
    'production_server_role_selector_hidden',
    'writer_depot_missing_writer_fail_safe',
  ]);
  assert.match(html, new RegExp(manifest.sourceSha256, 'u'));
  assert.match(html, /data-lor-runtime="gated"/u);
  assert.match(html, /id="lorRuntimeGate"/u);
  assert.match(html, /production-adapter\.js/u);
  assert.match(html, /t\.textContent=String\(m\?\?''\)/u);
  assert.doesNotMatch(html, /t\.innerHTML=m/u);
  assert.match(html, /<script id="lorFounderApprovedRuntime" type="text\/javascript">/u);
  assert.match(html, /approvedArtifactSha256:'c249373619a45c31a1b895363fb1d3806d966c8fc413e0acdc4df0870c5a51b7'/u);
  assert.doesNotMatch(html, /production-projection-ui\.js/u);
  assert.match(
    html,
    /<\/script>\s*<script src="\/lor-studio\/production-adapter\.js\?v=8"><\/script>\s*<\/body>\s*<\/html>\s*$/u,
  );
});
