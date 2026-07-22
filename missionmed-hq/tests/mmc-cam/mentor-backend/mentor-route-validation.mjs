import assert from 'node:assert/strict';

import {
  MENTOR_ROUTE_CONTRACT,
  createLocalMentorRuntime,
  handleMmcMentorRoute,
  isMmcMentorPath,
  matchMmcMentorRoute,
} from '../../../routes/mmc/mentor.mjs';

const tenantId = '00700000-0000-4000-8000-000000000001';
const mentorId = '00700000-0000-4000-8000-000000000002';
const session = Object.freeze({ csrfToken: 'csrf_007_exact_route', user: { id: 7 } });
const runtime = createLocalMentorRuntime({ tenantId, environment: 'LOCAL', mentorPrincipalId: mentorId });
const baseConfig = Object.freeze({
  enabled: true,
  commandsEnabled: true,
  inMemoryEnabled: true,
  tenantId,
  environment: 'LOCAL',
  approvedOrigins: Object.freeze(['http://127.0.0.1:4177', 'https://mmc.local.test']),
  allowLoopbackHttp: true,
  maxJsonBytes: 64 * 1024,
});

function request(method = 'GET', body = null, headers = {}) {
  return {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      origin: 'http://127.0.0.1:4177',
      'sec-fetch-site': 'same-origin',
      'x-mmhq-csrf': session.csrfToken,
      ...headers,
    },
  };
}

function deps(overrides = {}) {
  return {
    session,
    authHeaders: {
      'Access-Control-Allow-Origin': 'https://cdn.missionmedinstitute.com',
      'Access-Control-Allow-Credentials': 'true',
      'X-Auth-Fixture': 'mentor-007',
    },
    isAuthorizedMmcPrivateSession: () => true,
    buildMmcPrincipal: () => ({ id: mentorId, role: 'mentor' }),
    mentorConfig: baseConfig,
    mentorRuntime: runtime,
    sendJson: (response, status, payload, headers) => Object.assign(response, { status, payload, headers }),
    ...overrides,
  };
}

async function invoke(pathname, req = request(), overrides = {}) {
  const response = {};
  const handled = await handleMmcMentorRoute(
    req,
    response,
    new URL(`http://127.0.0.1:4177${pathname}`),
    deps(overrides),
  );
  assert.equal(handled, true);
  return response;
}

assert.equal(MENTOR_ROUTE_CONTRACT.length, 14);
assert.equal(isMmcMentorPath('/api/mmc/v2/mentor/today'), true);
assert.equal(isMmcMentorPath('/api/mmc/v2/status'), false);
assert.equal(matchMmcMentorRoute('/api/mmc/v2/mentor/students/subject_007_001/overview').resource, 'student_overview');
assert.deepEqual(matchMmcMentorRoute('/api/mmc/v2/mentor/reviews/ai_claim/review_007_ai_001').params, {
  queueKind: 'AI_CLAIM', reviewId: 'review_007_ai_001',
});
assert.equal(matchMmcMentorRoute('/api/mmc/v2/mentor/students/../overview'), null);

let response = await invoke('/api/mmc/v2/mentor/today');
assert.equal(response.status, 200);
assert.equal(response.payload.data.kind, 'MENTOR_TODAY');
assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
assert.match(response.headers['Content-Security-Policy'], /default-src 'none'/u);
assert.equal(Object.hasOwn(response.headers, 'Access-Control-Allow-Origin'), false,
  'Sensitive mentor responses must not inherit the host server credentialed CORS policy.');
assert.equal(Object.hasOwn(response.headers, 'Access-Control-Allow-Credentials'), false,
  'Sensitive mentor responses must remain unreadable to sibling origins.');

response = await invoke('/api/mmc/v2/mentor/today', request('GET', null, {
  origin: 'https://cdn.missionmedinstitute.com',
  'sec-fetch-site': 'same-site',
}));
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'FETCH_METADATA_FORBIDDEN');
assert.equal(Object.hasOwn(response.headers, 'Access-Control-Allow-Origin'), false);

response = await invoke('/api/mmc/v2/mentor/today', request('GET', null, {
  origin: 'https://cdn.missionmedinstitute.com',
  'sec-fetch-site': 'same-origin',
}));
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'ORIGIN_FORBIDDEN');

response = await invoke('/api/mmc/v2/mentor/students/subject_007_001/overview');
assert.equal(response.status, 200);
assert.equal(response.payload.data.subjectLink.id, 'subject_007_001');

response = await invoke('/api/mmc/v2/mentor/students/subject_007_001/history/sessions/session_007_history_001');
assert.equal(response.status, 200);
assert.equal(response.payload.data.session.id, 'session_007_history_001');

const start = {
  commandId: '00700000-0000-4000-8000-000000000701',
  idempotencyKey: 'idem_007_route_session_start',
  expectedVersion: 0,
  targetId: 'session_007_route_001',
  kind: 'session.start',
  purpose: 'Start a bounded local route session.',
  payload: { subjectLinkId: 'subject_007_001', objective: 'Review the next evidence-backed action.' },
  schemaVersion: 1,
};
response = await invoke('/api/mmc/v2/mentor/commands', request('POST', {
  ...start,
  commandId: '00700000-0000-4000-8000-000000000700',
  idempotencyKey: 'idem_007_route_unsafe_session',
  targetId: 'session/route-break',
}));
assert.equal(response.status, 422);
assert.equal(response.payload.error.code, 'MENTOR_COMMAND_IDENTIFIER_INVALID');
assert.equal(runtime.repository.snapshot().sessions.has('session/route-break'), false,
  'A schema-valid command must never create an object that the HTTP route grammar cannot address.');

response = await invoke('/api/mmc/v2/mentor/commands', request('POST', start));
assert.equal(response.status, 200);
assert.equal(response.payload.readback.state.status, 'ACTIVE');

response = await invoke('/api/mmc/v2/mentor/sessions/session_007_route_001/live');
assert.equal(response.status, 200);
assert.equal(response.payload.data.subjectLocked, true);
assert.equal(response.payload.meta.sections.offline_persistence, 'UNAVAILABLE');

response = await invoke('/api/mmc/v2/mentor/commands', request('POST', start), {
  mentorConfig: { ...baseConfig, allowLoopbackHttp: false },
});
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'ORIGIN_FORBIDDEN');

response = await invoke('/api/mmc/v2/mentor/commands', request('POST', start, {
  origin: 'http://127.0.0.1:4177.attacker.example',
}));
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'ORIGIN_FORBIDDEN');

response = await invoke('/api/mmc/v2/mentor/commands', request('POST', start, {
  'x-mmhq-csrf': '',
}));
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'CSRF_VALIDATION_FAILED');

response = await invoke('/api/mmc/v2/mentor/today', request('GET'), {
  isAuthorizedMmcPrivateSession: () => false,
});
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'MMC_PRIVATE_FORBIDDEN');

response = await invoke('/api/mmc/v2/mentor/today', request('GET'), {
  mentorConfig: { ...baseConfig, enabled: false },
});
assert.equal(response.status, 503);
assert.equal(response.payload.error.code, 'MMC_MENTOR_EXPERIENCE_DISABLED');

response = await invoke('/api/mmc/v2/mentor/today', request('GET'), {
  mentorConfig: { ...baseConfig, environment: 'LIVE' },
});
assert.equal(response.status, 503);
assert.equal(response.payload.error.code, 'MENTOR_DURABLE_PERSISTENCE_REQUIRED');

response = await invoke('/api/mmc/v2/mentor/operations', request('GET'));
assert.equal(response.status, 403);
assert.equal(response.payload.error.code, 'MENTOR_OPERATIONS_FORBIDDEN');

response = await invoke('/api/mmc/v2/mentor/operations', request('GET'), {
  buildMmcPrincipal: () => ({ id: '00700000-0000-4000-8000-000000000003', role: 'operator' }),
});
assert.equal(response.status, 200);
assert.equal(response.payload.data.providerIntegrations, 'UNAVAILABLE');
assert.equal(response.payload.data.durablePersistence, 'UNAVAILABLE');
assert.equal(response.payload.data.health.externalWrites, 'PROHIBITED');

response = await invoke('/api/mmc/v2/mentor/today', request('POST'));
assert.equal(response.status, 405);
assert.equal(response.payload.error.code, 'MMC_MENTOR_METHOD_NOT_ALLOWED');

const previousNodeEnv = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = 'production';
  response = await invoke('/api/mmc/v2/mentor/today', request('GET'));
  assert.equal(response.status, 503);
  assert.equal(response.payload.error.code, 'MMC_MENTOR_LOCAL_RUNTIME_PRODUCTION_FORBIDDEN');
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
}

const unhandledResponse = {};
assert.equal(await handleMmcMentorRoute(
  request('GET'),
  unhandledResponse,
  new URL('http://127.0.0.1:4177/api/other'),
  deps(),
), false);
assert.deepEqual(unhandledResponse, {});

console.log(JSON.stringify({
  result: 'MMC 007 mentor route validation passed',
  routeCount: MENTOR_ROUTE_CONTRACT.length,
  privateAuthorization: true,
  exactLoopbackOrigin: true,
  csrf: true,
  productionRuntimeDenied: true,
  liveInMemoryDenied: true,
  operationsRoleGate: true,
  noStore: true,
}, null, 2));
