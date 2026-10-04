import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import test from 'node:test';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { FOUNDER_TEST_AVATAR_PARTICIPANT_ID } from '../../server/founder-paid-test-gate.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';

const NOW = Date.parse('2026-08-11T16:00:00.000Z');
const CSRF = 'csrf_token_1234567890';
const VIDEO_BODY = Object.freeze({
  mode: 'video', authorizationId: 'authorization-video-1',
  agentId: 'agent_9bdfc50ec0086043', profile: 'PROFILE_B_OPENAI_NATIVE_AUDIO',
  voice: 'marin', maxSeconds: 45,
});

function paidTestGate() {
  return {
    publicState: () => ({ enabled: true, agentId: VIDEO_BODY.agentId, profile: VIDEO_BODY.profile, maximumSeconds: 45, voices: ['marin'], state: 'READY' }),
    issue: () => ({ ok: true, status: 201, authorization: { id: VIDEO_BODY.authorizationId, ...VIDEO_BODY } }),
    consume: ({ admission, interviewId, idempotencyKey }) => ({ ok: true, receipt: {
      authorized: true, consumed: true, authorizationId: VIDEO_BODY.authorizationId,
      authorizationBinding: 'a'.repeat(64), subject: admission.subject,
      cookieFingerprint: admission.cookieFingerprint, entitlementRevision: admission.entitlement.revision,
      interviewId, idempotencyKey, agentId: VIDEO_BODY.agentId, profile: VIDEO_BODY.profile,
      avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
      voice: VIDEO_BODY.voice, maxSeconds: 45, testNo: 1, terminationArmed: true,
      reconciliationArmed: true, zeroRetry: true, zeroReconnect: true, zeroRecreation: true,
    } }),
  };
}

function session(userId = 1) {
  return {
    version: 1,
    issuedAt: new Date(NOW - 1_000).toISOString(),
    expiresAt: new Date(NOW + 60_000).toISOString(),
    csrfToken: CSRF,
    authSource: 'wordpress-cookie',
    user: { id: userId, roles: ['administrator'] },
  };
}

function responseCapture() {
  return {
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(chunk = '') { this.body += String(chunk); },
  };
}

async function invoke(handler, { path = '/api/ivprep-v6/session', method = 'GET', headers = {}, body = '', hqSession = session(), fingerprint = 'a'.repeat(64) } = {}) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.headers = { host: 'hq.local', ...headers };
  const response = responseCapture();
  const handled = await handler({
    request,
    response,
    url: new URL(path, 'http://hq.local'),
    hqSession,
    cookieFingerprint: fingerprint,
    hqSessionMaxTtlSeconds: 300,
    expectedOrigin: 'http://hq.local',
  });
  return { handled, status: response.status, headers: response.headers, body: response.body ? JSON.parse(response.body) : null };
}

async function invokeAsset(handler, { path, hqSession = session(142), fingerprint = 'b'.repeat(64) } = {}) {
  const request = Readable.from([]);
  request.method = 'GET';
  request.headers = { host: 'hq.local' };
  const chunks = [];
  const response = new Writable({ write(chunk, _encoding, callback) { chunks.push(chunk); callback(); } });
  response.writeHead = (status, headers) => { response.status = status; response.headers = headers; };
  await handler({
    request, response, url: new URL(path, 'http://hq.local'), hqSession,
    cookieFingerprint: fingerprint, hqSessionMaxTtlSeconds: 300,
    expectedOrigin: 'http://hq.local',
  });
  await finished(response);
  return { status: response.status, body: Buffer.concat(chunks).toString('utf8') };
}

function registry() {
  const value = new InMemoryAdmissionRegistry({ now: () => NOW });
  value.grantSyntheticEntitlement({
    subject: 'wp:1', revision: 'local-1', expiresAtMs: NOW + 120_000,
    founder: true, voice: true, video: true, grantedVideoSeconds: 45,
  });
  return value;
}

const LIVE_SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LIVE_HEADERS = { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF };
const LIVE_BODY = { sdp: 'v=0\r\no=offer', voice: 'marin', context: { questionIds: ['CORE-01'] }, ivocSessionId: LIVE_SESSION_ID };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function until(predicate) {
  for (let count = 0; count < 100; count++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); }
  assert.fail('Expected lifecycle milestone was not reached.');
}
const startLive = (handler, extra = {}) => invoke(handler, { path: '/api/ivprep-v6/live/sessions', method: 'POST',
  headers: LIVE_HEADERS, body: JSON.stringify(LIVE_BODY), ...extra });
const endLive = (handler, id = 'live_fixture_0001') => invoke(handler, { path: `/api/ivprep-v6/live/sessions/${id}/end`, method: 'POST', headers: LIVE_HEADERS, body: '{}' });
const attachedReceipt = identity => ({ observation_id: identity.observationId, session_id: identity.ivocSessionId,
  owner_subject: identity.ownerSubject, provider_session_id: identity.providerSessionId, kind: 'attached', seq: 1 });
function observerFixture(identity, { ready = Promise.resolve(attachedReceipt(identity)), drain = null, events = [] } = {}) {
  const completed = deferred();
  return { ready, completion: completed.promise, finish: async () => {
    events.push(['finish', identity.providerSessionId]);
    const outcome = { observationId: identity.observationId,
      ...(drain ? await drain : { status: 'INCOMPLETE', reason: 'finish_timeout', terminalPersisted: true }) };
    completed.resolve(outcome); return outcome;
  } };
}
function liveHarness({ guard, context, create, observe, hangup, report = () => {} } = {}) {
  const enrolled = registry(), events = []; let generation = 0;
  const handler = createIvPrepHqHandler({ registry: enrolled, now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
    reportLiveStartFailure: report,
    liveSessionGuard: async identity => { events.push(['guard', identity]); if (guard) return guard(identity); },
    liveContextResolver: async identity => { events.push(['context', identity]); return context ? context(identity) : { actorBlock: 'authorized fixture', receipt: 'fixture' }; },
    liveSessionBroker: { create: async input => { events.push(['create', input]); return create ? create(input)
      : { session: { id: `live_fixture_${String(++generation).padStart(4, '0')}`, model: 'unchanged-model' }, transport: { type: 'webrtc', sdp: 'unchanged-sdp' } }; },
      hangup: async id => { events.push(['hangup', id]); if (hangup) return hangup(id); return { ok: true }; } },
    liveTranscriptObserver: async identity => {
      events.push(['observe', identity]);
      assert.equal(enrolled.bindingFor(`live:${identity.providerSessionId}`).subject, identity.ownerSubject);
      assert.equal(enrolled.terminationHandlers.has(`live:${identity.providerSessionId}`), true, 'termination must be armed before attachment');
      return observe ? observe(identity, events) : observerFixture(identity, { events });
    },
  });
  return { handler, enrolled, events };
}

test('owner-authorized observation attaches exact server identity before unchanged SDP201', async () => {
  const h = liveHarness(); const result = await startLive(h.handler);
  assert.equal(result.status, 201); assert.equal(result.body.transport.sdp, 'unchanged-sdp');
  assert.deepEqual(h.events.map(event => event[0]), ['guard', 'context', 'guard', 'create', 'observe']);
  const identity = h.events.at(-1)[1];
  assert.deepEqual(Object.keys(identity).sort(), ['ivocSessionId', 'observationId', 'ownerSubject', 'providerSessionId']);
  assert.equal(identity.ownerSubject, 'wp:1'); assert.equal(identity.ivocSessionId, LIVE_SESSION_ID);
  assert.equal(identity.providerSessionId, result.body.session.id); assert.match(identity.observationId, /^[a-f0-9-]{36}$/u);
  assert.equal(JSON.stringify(result.body).includes('observation'), false);
  assert.deepEqual(h.events.find(event => event[0] === 'create')[1].context, LIVE_BODY.context);
  assert.equal((await endLive(h.handler)).status, 200);
});

test('subject is reserved before body/context awaits so concurrent live creates never double pay', async () => {
  const pending = deferred(); const h = liveHarness({ context: () => pending.promise });
  const first = startLive(h.handler); await until(() => h.events.some(event => event[0] === 'context'));
  assert.equal((await startLive(h.handler)).status, 409);
  assert.equal(h.events.filter(event => event[0] === 'create').length, 0);
  pending.resolve({ actorBlock: 'fixture' }); assert.equal((await first).status, 201);
  assert.equal(h.events.filter(event => event[0] === 'create').length, 1);
  await endLive(h.handler);
});

test('startup diagnostics retain only the failed stage and bounded provider status', async () => {
  for (const stage of ['session_guard', 'context_pack', 'provider_create', 'transcript_factory']) {
    const reports = [];
    const privateError = Object.assign(new Error('private transcript and token must not escape'),
      stage === 'provider_create' ? { code: 'OPENAI_LIVE_REQUEST_FAILED', status: 401 } : {});
    const fail = () => { throw privateError; };
    const h = liveHarness({ report: record => reports.push(record),
      ...(stage === 'session_guard' ? {guard: fail} : stage === 'context_pack' ? {context: fail}
        : stage === 'provider_create' ? {create: fail} : {observe: fail}) });
    const result = await startLive(h.handler);
    assert.equal(result.status, 503);
    assert.deepEqual(result.body, {error: 'ivprep_live_start_failed'});
    assert.deepEqual(reports, [{event:'ivoc_live_start_failure',stage,
      category:stage === 'provider_create' ? 'provider_request' : 'startup_failed',
      providerStatus:stage === 'provider_create' ? 401 : null}]);
    assert.equal(JSON.stringify(reports).includes(privateError.message),false);
  }
  const h = liveHarness({create:()=>{throw new TypeError('private invalid context');},
    report:()=>{throw new Error('diagnostic sink unavailable');}});
  assert.equal((await startLive(h.handler)).status,503,'diagnostics never prevent ordinary cleanup');
});

test('foreign/inactive guard and client event extensions deny before paid creation or attachment', async () => {
  const denied = liveHarness({ guard: () => { throw new Error('private source-owner details'); } });
  const result = await startLive(denied.handler);
  assert.equal(result.status, 503); assert.deepEqual(result.body, { error: 'ivprep_live_start_failed' });
  assert.deepEqual(denied.events.map(event => event[0]), ['guard']);
  const h = liveHarness();
  assert.equal((await startLive(h.handler, { body: JSON.stringify({ ...LIVE_BODY, events: [] }) })).status, 400);
  assert.equal(h.events.length, 0);
  assert.equal((await startLive(h.handler)).status, 201, 'invalid request releases only its own reservation');
  await endLive(h.handler);
});

test('revocation/revision drift after awaited context blocks paid create', async () => {
  for (const kind of ['logout', 'entitlement', 'revision']) {
    const pending = deferred(); const h = liveHarness({ context: () => pending.promise });
    const starting = startLive(h.handler); await until(() => h.events.some(event => event[0] === 'context'));
    if (kind === 'logout') h.enrolled.recordLogout({ cookieFingerprint: 'a'.repeat(64) });
    if (kind === 'entitlement') h.enrolled.revokeEntitlement('wp:1');
    if (kind === 'revision') h.enrolled.grantSyntheticEntitlement({ subject: 'wp:1', revision: 'changed', voice: true, expiresAtMs: NOW + 120_000 });
    pending.resolve({ actorBlock: 'fixture' }); assert.equal((await starting).status, 503, kind);
    assert.equal(h.events.some(event => ['create', 'observe'].includes(event[0])), false);
  }
});

test('observer factory/readiness failure and wrong receipt identity clean original provider with generic503', async () => {
  for (const kind of ['factory', 'malformed-contract', 'ready-reject', 'wrong-owner', 'wrong-session', 'wrong-provider', 'wrong-observation', 'already-ended']) {
    const h = liveHarness({ observe: (identity, events) => {
      if (kind === 'factory') throw new Error('secret provider/transcript fixture');
      const receipt = attachedReceipt(identity);
      if (kind === 'wrong-owner') receipt.owner_subject = 'wp:2';
      if (kind === 'wrong-session') receipt.session_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      if (kind === 'wrong-provider') receipt.provider_session_id = 'foreign_live_provider';
      if (kind === 'wrong-observation') receipt.observation_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const observer = observerFixture(identity, { events, ready: kind === 'ready-reject' ? Promise.reject(new Error('private root')) : Promise.resolve(receipt) });
      if (kind === 'malformed-contract') observer.ready = null;
      if (kind === 'already-ended') observer.completion = Promise.resolve({ status: 'INCOMPLETE', reason: 'socket_closed', terminalPersisted: true });
      return observer;
    } });
    const result = await startLive(h.handler); assert.equal(result.status, 503, kind);
    assert.deepEqual(result.body, { error: 'ivprep_live_start_failed' });
    assert.deepEqual(h.events.filter(event => event[0] === 'hangup'), [['hangup', 'live_fixture_0001']]);
    if (kind !== 'factory') assert.equal(h.events.filter(event => event[0] === 'finish').length, 1);
  }
});

test('logout while readiness is pending cannot publish SDP and drains the attached observer', async () => {
  const ready = deferred(); let identity;
  const h = liveHarness({ observe: (input, events) => { identity = input; return observerFixture(input, { events, ready: ready.promise }); } });
  const starting = startLive(h.handler); await until(() => identity);
  h.enrolled.recordLogout({ cookieFingerprint: 'a'.repeat(64) });
  ready.resolve(attachedReceipt(identity)); const result = await starting;
  assert.equal(result.status, 503);
  assert.equal(h.events.filter(event => event[0] === 'hangup').length, 1);
  assert.equal(h.events.filter(event => event[0] === 'finish').length, 1);
});

test('end waits for observer drain after single provider hangup without claiming closed transcript', async () => {
  const drain = deferred();
  const h = liveHarness({ observe: (identity, events) => observerFixture(identity, { events, drain: drain.promise }) });
  assert.equal((await startLive(h.handler)).status, 201);
  let responded = false; const ending = endLive(h.handler).then(result => { responded = true; return result; });
  await until(() => h.events.some(event => event[0] === 'finish')); assert.equal(responded, false);
  assert.deepEqual(h.events.slice(-2).map(event => event[0]), ['hangup', 'finish']);
  drain.resolve({ status: 'INCOMPLETE', reason: 'finish_timeout', terminalPersisted: true });
  const result = await ending; assert.equal(result.status, 200);
  assert.deepEqual(result.body, { session: { id: 'live_fixture_0001', state: 'ended' } });
  assert.equal((await endLive(h.handler)).status, 200);
  assert.equal(h.events.filter(event => event[0] === 'hangup').length, 1);
  assert.equal(h.events.filter(event => event[0] === 'finish').length, 1);
});

test('failed hangup still drains observer; missing terminal persistence or wrong observation remains fail closed', async () => {
  for (const kind of ['hangup', 'negative-hangup', 'unpersisted', 'wrong-observation', 'drain-reject']) {
    const h = liveHarness({ hangup: kind === 'hangup' ? () => { throw new Error('private provider'); }
      : kind === 'negative-hangup' ? () => ({ ok: false }) : null,
      observe: (identity, events) => observerFixture(identity, { events, drain: kind === 'unpersisted'
        ? Promise.resolve({ status: 'INCOMPLETE', reason: 'persistence_failure', terminalPersisted: false })
        : kind === 'wrong-observation' ? Promise.resolve({ observationId: 'foreign-observation', status: 'PROVIDER_CLOSED', terminalPersisted: true })
          : kind === 'drain-reject' ? Promise.reject(new Error('private SQL')) : null }) });
    assert.equal((await startLive(h.handler)).status, 201);
    assert.equal((await endLive(h.handler)).status, 503);
    assert.equal(h.events.filter(event => event[0] === 'finish').length, 1);
    assert.equal((await startLive(h.handler)).status, 409, 'unknown cleanup cannot be hidden by starting another provider');
  }
});

test('observer cannot activate without owner guard and session identity cannot drift during create', async () => {
  assert.throws(() => createIvPrepHqHandler({ liveTranscriptObserver: async () => ({}) }), /owner session guard/u);
  const created = deferred(); const h = liveHarness({ create: () => created.promise });
  const ownerSession = session(); const starting = startLive(h.handler, { hqSession: ownerSession });
  await until(() => h.events.some(event => event[0] === 'create'));
  ownerSession.user.id = 2;
  created.resolve({ session: { id: 'late_provider_0001' }, transport: { sdp: 'never-published' } });
  assert.equal((await starting).status, 503);
  assert.deepEqual(h.events.filter(event => event[0] === 'hangup'), [['hangup', 'late_provider_0001']]);
  assert.equal(h.events.some(event => event[0] === 'observe'), false);
});

test('bounded readiness timeout cleans provider and finishes observer without returning SDP', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ready = deferred();
  const h = liveHarness({ observe: (identity, events) => observerFixture(identity, { events, ready: ready.promise }) });
  const starting = startLive(h.handler); await until(() => h.events.some(event => event[0] === 'observe'));
  // Allow the factory continuation to install the readiness watchdog.
  await new Promise(resolve => setImmediate(resolve)); t.mock.timers.tick(16_001);
  assert.equal((await starting).status, 503);
  assert.equal(h.events.filter(event => event[0] === 'hangup').length, 1);
  assert.equal(h.events.filter(event => event[0] === 'finish').length, 1);
});

test('bounded drain timeout retains guard and cannot retry cleanup into a second provider', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const drain = deferred();
  const h = liveHarness({ observe: (identity, events) => observerFixture(identity, { events, drain: drain.promise }) });
  assert.equal((await startLive(h.handler)).status, 201);
  const ending = endLive(h.handler); await until(() => h.events.some(event => event[0] === 'finish'));
  t.mock.timers.tick(24_001); assert.equal((await ending).status, 503);
  assert.equal((await startLive(h.handler)).status, 409);
  drain.resolve({ status: 'INCOMPLETE', reason: 'finish_timeout', terminalPersisted: true });
  assert.equal((await endLive(h.handler)).status, 503);
  assert.equal(h.events.filter(event => event[0] === 'hangup').length, 1);
  assert.equal(h.events.filter(event => event[0] === 'finish').length, 1);
});

test('late observer factory after timeout drains only that observation after original hangup', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const factory = deferred(); let identity;
  const h = liveHarness({ observe: (input) => { identity = input; return factory.promise; } });
  const starting = startLive(h.handler); await until(() => identity);
  await new Promise(resolve => setImmediate(resolve)); t.mock.timers.tick(16_001);
  await until(() => h.events.some(event => event[0] === 'hangup'));
  await new Promise(resolve => setImmediate(resolve)); t.mock.timers.tick(16_001);
  assert.equal((await starting).status, 503);
  factory.resolve(observerFixture(identity, { events: h.events }));
  await until(() => h.events.some(event => event[0] === 'finish'));
  assert.deepEqual(h.events.filter(event => ['hangup', 'finish'].includes(event[0])).map(event => event[0]), ['hangup', 'finish']);
  assert.equal((await startLive(h.handler)).status, 409, 'late completion does not upgrade failed custody or clear the retained guard');
});

test('shutdown/logout/end coalesce one cleanup and await observer drain', async () => {
  const hangup = deferred(), drain = deferred();
  const h = liveHarness({ hangup: () => hangup.promise, observe: (identity, events) => observerFixture(identity, { events, drain: drain.promise }) });
  assert.equal((await startLive(h.handler)).status, 201);
  const ending = endLive(h.handler); await until(() => h.events.some(event => event[0] === 'hangup'));
  h.enrolled.recordLogout({ cookieFingerprint: 'a'.repeat(64) });
  const shutdown = h.handler.shutdown(); hangup.resolve({ ok: true });
  await until(() => h.events.some(event => event[0] === 'finish'));
  drain.resolve({ status: 'PROVIDER_CLOSED', reason: 'provider_closed', terminalPersisted: true });
  assert.equal((await ending).status, 200); assert.deepEqual(await shutdown, { ok: true, stopped: 1 });
  assert.equal(h.events.filter(event => event[0] === 'hangup').length, 1);
  assert.equal(h.events.filter(event => event[0] === 'finish').length, 1);
});

test('provider creation that returns after shutdown or logout is never attached or published and is hung up', async () => {
  for (const kind of ['shutdown', 'logout']) {
    const created = deferred(); const h = liveHarness({ create: () => created.promise });
    const starting = startLive(h.handler); await until(() => h.events.some(event => event[0] === 'create'));
    const shutdown = kind === 'shutdown' ? h.handler.shutdown() : null;
    if (kind === 'logout') h.enrolled.recordLogout({ cookieFingerprint: 'a'.repeat(64) });
    created.resolve({ session: { id: 'late_provider_0001' }, transport: { type: 'webrtc', sdp: 'never-published' } });
    assert.equal((await starting).status, 503, kind);
    if (shutdown) assert.deepEqual(await shutdown, { ok: true, stopped: 1 });
    assert.deepEqual(h.events.filter(event => event[0] === 'hangup'), [['hangup', 'late_provider_0001']]);
    assert.equal(h.events.some(event => event[0] === 'observe'), false);
    if (shutdown) assert.equal((await startLive(h.handler)).status, 503);
  }
});

test('shutdown during awaited guard or context cancels pending start before any provider exists', async () => {
  for (const phase of ['guard', 'context']) {
    const pending = deferred(); const h = liveHarness({ [phase]: () => pending.promise });
    const starting = startLive(h.handler); await until(() => h.events.some(event => event[0] === phase));
    const shutdown = h.handler.shutdown(); pending.resolve({ actorBlock: 'fixture' });
    assert.equal((await starting).status, 503);
    assert.deepEqual(await shutdown, { ok: true, stopped: 1 });
    assert.equal(h.events.some(event => ['create', 'observe', 'hangup'].includes(event[0])), false);
  }
});

test('feature flags, bearer auth, and missing entitlement deny before product data', async () => {
  const off = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: false, adminCanaryEnabled: false, videoEnabled: false } });
  assert.equal((await invoke(off)).status, 503);
  const on = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  assert.equal((await invoke(on, { headers: { authorization: 'Bearer opaque' } })).status, 401);
  assert.equal((await invoke(on, { path: '/api/ivprep-v6/session?access_token=opaque' })).status, 401);
  assert.equal((await invoke(on, { path: '/api/ivprep-v6/session?next=Bearer%20opaque' })).status, 401);
  const empty = createIvPrepHqHandler({ registry: new InMemoryAdmissionRegistry({ now: () => NOW }), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  assert.equal((await invoke(empty)).status, 403);
});

test('course-entitled student static module boot reuses a short admission without weakening API or session checks', async () => {
  const student = { ...session(142), user: { id: 142, roles: ['subscriber'] } };
  const enrolled = new InMemoryAdmissionRegistry({ now: () => NOW });
  let ownerChecks = 0;
  enrolled.refreshSubject = async () => {
    ownerChecks += 1;
    if (ownerChecks > 1) {
      enrolled.revokeEntitlement('wp:142');
      return false;
    }
    enrolled.grantSyntheticEntitlement({
      subject: 'wp:142', revision: 'course-1', expiresAtMs: NOW + 120_000,
      founder: false, voice: true, video: false,
    });
    return true;
  };
  const handler = createIvPrepHqHandler({
    registry: enrolled, now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
  });
  assert.equal((await invoke(handler, { path: '/iv-prep-on-call/', method: 'HEAD', hqSession: student, fingerprint: 'b'.repeat(64) })).status, 200);
  const paths = [
    '/iv-prep-on-call/assets/studio/live-context-adapter.mjs',
    '/iv-prep-on-call/assets/studio/live-interview.mjs',
    '/iv-prep-on-call/assets/capabilities/admin-student-library.mjs',
  ];
  const modules = await Promise.all(paths.map((path) => invokeAsset(handler, { path, hqSession: student })));
  assert.deepEqual(modules.map(({ status }) => status), [200, 200, 200]);
  assert.ok(modules.every(({ body }) => body.length > 0));
  assert.equal(ownerChecks, 1, 'module burst must not repeat external course checks');

  const expired = { ...student, expiresAt: new Date(NOW - 1).toISOString() };
  assert.equal((await invokeAsset(handler, { path: paths[0], hqSession: expired })).status, 401);
  assert.equal((await invoke(handler, { path: '/api/ivprep-v6/session', hqSession: student, fingerprint: 'b'.repeat(64) })).status, 403);
  assert.equal(ownerChecks, 2, 'product API must revalidate owner entitlement');
  assert.equal((await invokeAsset(handler, { path: paths[0], hqSession: student })).status, 403);
});

test('concurrent first static module requests coalesce the course entitlement refresh', async () => {
  const enrolled = new InMemoryAdmissionRegistry({ now: () => NOW });
  let ownerChecks = 0;
  enrolled.refreshSubject = async () => {
    ownerChecks += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    enrolled.grantSyntheticEntitlement({
      subject: 'wp:142', revision: 'course-1', expiresAtMs: NOW + 120_000,
      founder: false, voice: true, video: false,
    });
    return true;
  };
  const handler = createIvPrepHqHandler({
    registry: enrolled, now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
  });
  const modules = await Promise.all([
    '/iv-prep-on-call/assets/studio/live-context-adapter.mjs',
    '/iv-prep-on-call/assets/studio/live-interview.mjs',
    '/iv-prep-on-call/assets/capabilities/admin-student-library.mjs',
  ].map((path) => invokeAsset(handler, { path })));
  assert.deepEqual(modules.map(({ status }) => status), [200, 200, 200]);
  assert.equal(ownerChecks, 1);
});

test('admitted session projection contains no shared token and vault is empty', async () => {
  const handler = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const admitted = await invoke(handler);
  assert.equal(admitted.status, 200);
  assert.equal(admitted.body.admitted, true);
  assert.equal(admitted.body.videoEnabled, false);
  assert.equal(JSON.stringify(admitted.body).includes('accessToken'), false);
  const vault = await invoke(handler, { path: '/api/ivprep-v6/vault' });
  assert.deepEqual(vault.body, { sessions: [] });
});

test('GPT-Live WebRTC creation is same-origin, entitlement-bound, and server-cleaned', async () => {
  const calls = [];
  const ivocSessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const actorContext = {
    receipt: `ctxpack:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb@${'c'.repeat(64)}`,
    actorBlock: 'AUTHORIZED APPLICATION CONTEXT\nPROGRAM: none',
  };
  const handler = createIvPrepHqHandler({
    registry: registry(),
    now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
    liveSessionBroker: {
      create: async (input) => {
        calls.push(['create', input]);
        return { session: { id: 'live_session_123456', model: 'gpt-live-1' }, transport: { type: 'webrtc', sdp: 'v=0\r\no=answer' } };
      },
      hangup: async (id) => { calls.push(['hangup', id]); return { ok: true }; },
    },
    liveContextResolver: async (input) => { calls.push(['resolve', input]); return actorContext; },
  });
  const admitted = await invoke(handler);
  assert.equal(admitted.body.runtime.liveInterviewAvailable, true);
  const headers = { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF };
  const context = {
    goal: 'Full interview simulation', questionIds: ['CORE-001'],
    interviewer: 'Program Director · balanced', program: 'Internal Medicine',
    environment: 'RISE + StoryForge seams', targetQuestions: 5,
  };
  const created = await invoke(handler, {
    path: '/api/ivprep-v6/live/sessions', method: 'POST', headers,
    body: JSON.stringify({ sdp: 'v=0\r\no=offer', voice: 'marin', context, ivocSessionId }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.session.model, 'gpt-live-1');
  assert.equal(JSON.stringify(created.body).includes('server-only'), false);
  assert.deepEqual(calls[0], ['resolve', { subject: 'wp:1', sessionId: ivocSessionId }]);
  assert.deepEqual(calls[1], ['create', { sdp: 'v=0\r\no=offer', voice: 'marin', context, actorContext }]);
  const switched = await invoke(handler, {
    path: '/api/ivprep-v6/live/sessions/live_session_123456/end', method: 'POST', headers, body: '{}', fingerprint: 'b'.repeat(64),
  });
  assert.equal(switched.status, 409);
  const ended = await invoke(handler, {
    path: '/api/ivprep-v6/live/sessions/live_session_123456/end', method: 'POST', headers, body: '{}',
  });
  assert.equal(ended.status, 200);
  assert.deepEqual(calls.at(-1), ['hangup', 'live_session_123456']);
});

test('GPT-Live creation fails closed when the broker is absent', async () => {
  const handler = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const result = await invoke(handler, {
    path: '/api/ivprep-v6/live/sessions', method: 'POST',
    headers: { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF },
    body: JSON.stringify({ sdp: 'v=0\r\no=offer', voice: 'marin', context: {} }),
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'ivprep_live_unavailable');
});

test('non-Founder sessions cannot select an Admin audition voice', async () => {
  const deniedRegistry = new InMemoryAdmissionRegistry({ now: () => NOW });
  deniedRegistry.grantSyntheticEntitlement({
    subject: 'wp:2', revision: 'student-1', expiresAtMs: NOW + 120_000,
    founder: false, voice: true, video: false, grantedVideoSeconds: 0,
  });
  const handler = createIvPrepHqHandler({
    registry: deniedRegistry, now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
    liveSessionBroker: { create: async () => { throw new Error('must not run'); } },
    liveContextResolver: async () => { throw new Error('must not run'); },
  });
  const denied = await invoke(handler, {
    path: '/api/ivprep-v6/live/sessions', method: 'POST',
    hqSession: { ...session(2), user: { id: 2, roles: ['subscriber'] } },
    headers: { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF },
    body: JSON.stringify({
      sdp: 'v=0\r\no=offer', voice: 'meridian', context: {},
      ivocSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }),
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, 'ivprep_admin_voice_audition_required');
});

test('live product CSP permits only the sealed LiveKit WSS origin', async () => {
  const live = createIvPrepHqHandler({
    registry: registry(),
    now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true },
    liveKitSignalOrigin: 'wss://example.livekit.cloud',
  });
  const response = await invoke(live, { path: '/iv-prep-on-call/', method: 'HEAD' });
  assert.match(response.headers['Content-Security-Policy'], /connect-src 'self' wss:\/\/example\.livekit\.cloud;/u);
  assert.doesNotMatch(response.headers['Content-Security-Policy'], /connect-src[^;]*\*/u);
  const closed = createIvPrepHqHandler({
    registry: registry(),
    now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
  });
  const closedResponse = await invoke(closed, { path: '/iv-prep-on-call/', method: 'HEAD' });
  assert.match(closedResponse.headers['Content-Security-Policy'], /connect-src 'self';/u);
  assert.throws(() => createIvPrepHqHandler({ liveKitSignalOrigin: 'wss://example.livekit.cloud/path' }), /origin is invalid/u);
});

test('voice start is CSRF-bound and idempotent; switched cookies cannot end it', async () => {
  const handler = createIvPrepHqHandler({ registry: registry(), now: () => NOW, idFactory: () => 'interview-1', flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const mutationHeaders = { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-key-1' };
  assert.equal((await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: { ...mutationHeaders, 'x-mmhq-csrf': 'wrong' }, body: '{"mode":"voice-only"}' })).status, 403);
  const first = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: '{"mode":"voice-only"}' });
  const duplicate = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: '{"mode":"voice-only"}' });
  assert.equal(first.status, 201);
  assert.equal(duplicate.status, 200);
  assert.deepEqual(first.body.interview, duplicate.body.interview);
  const changedBody = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: JSON.stringify(VIDEO_BODY) });
  assert.equal(changedBody.status, 409);
  assert.equal(changedBody.body.error, 'ivprep_idempotency_conflict');
  const switchedReplay = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: '{"mode":"voice-only"}', fingerprint: 'b'.repeat(64) });
  assert.equal(switchedReplay.status, 409);
  assert.equal(switchedReplay.body.error, 'ivprep_idempotency_conflict');
  const concurrent = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: { ...mutationHeaders, 'idempotency-key': 'idem-key-2' }, body: '{"mode":"voice-only"}' });
  assert.equal(concurrent.status, 409);
  assert.equal(concurrent.body.error, 'ivprep_interview_active');
  const switched = await invoke(handler, { path: '/api/ivprep-v6/interviews/interview-1/end', method: 'POST', headers: mutationHeaders, body: '{}', fingerprint: 'b'.repeat(64) });
  assert.equal(switched.status, 409);
});

test('mutations fail closed without a sealed configured origin', async () => {
  const handler = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const request = Readable.from([Buffer.from('{"mode":"voice-only"}')]);
  request.method = 'POST';
  request.headers = {
    host: 'attacker.example',
    'x-forwarded-proto': 'https',
    origin: 'https://attacker.example',
    'sec-fetch-site': 'same-origin',
    'x-mmhq-csrf': CSRF,
    'idempotency-key': 'idem-sealed-origin',
  };
  const response = responseCapture();
  await handler({
    request,
    response,
    url: new URL('/api/ivprep-v6/interviews/start', 'https://attacker.example'),
    hqSession: session(),
    cookieFingerprint: 'a'.repeat(64),
    hqSessionMaxTtlSeconds: 300,
    expectedOrigin: '',
  });
  assert.equal(response.status, 403);
});

test('video cannot become active without both the gate and a controller', async () => {
  const noGate = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false } });
  const yesGateNoController = createIvPrepHqHandler({ registry: registry(), now: () => NOW, flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true } });
  const options = { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-video-1' }, body: JSON.stringify(VIDEO_BODY) };
  assert.equal((await invoke(noGate, options)).status, 503);
  assert.equal((await invoke(yesGateNoController, options)).status, 503);
});

test('local controller construction failure closes the consumed authorization without provider work', async () => {
  const gate = paidTestGate();
  const terminal = [];
  gate.finish = (evidence) => { terminal.push(evidence); return { ok: true, state: 'CLOSED' }; };
  gate.failClosed = () => { throw new Error('Safe local close must not trip the uncertainty path.'); };
  const handler = createIvPrepHqHandler({
    registry: registry(),
    now: () => NOW,
    idFactory: () => 'interview-controller-construction-failure',
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true },
    paidTestGate: gate,
    providerControllerFactory: () => { throw new Error('Synthetic local construction failure.'); },
  });
  const result = await invoke(handler, {
    path: '/api/ivprep-v6/interviews/start', method: 'POST',
    headers: { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-controller-construction-failure' },
    body: JSON.stringify(VIDEO_BODY),
  });
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'ivprep_provider_start_failed');
  assert.deepEqual(terminal, [{
    authorizationId: VIDEO_BODY.authorizationId,
    providerCreateAttempted: false,
    terminationConfirmed: true,
    reconciliationConfirmed: true,
    reason: 'local_startup_initialization_failed',
  }]);
});

test('video start returns one scoped connection before browser readiness and exposes status separately', async () => {
  const recorded = [];
  let providerState = 'AGENT_JOINING';
  const connection = {
    url: 'wss://example.livekit.cloud',
    token: 'synthetic-room-token'.padEnd(64, 'x'),
    participantIdentity: 'ivp-browser-1',
    avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
  };
  const handler = createIvPrepHqHandler({
    registry: registry(),
    now: () => NOW,
    idFactory: () => 'interview-video-two-phase',
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true },
    paidTestGate: paidTestGate(),
    providerControllerFactory: () => ({
      start: async () => ({ ok: true, pending: true, connection }),
      recordBrowserMediaReady: async (evidence) => { recorded.push(evidence); return { ok: true }; },
      status: () => ({ state: providerState, active: providerState === 'ACTIVE' }),
      stop: async () => ({ ok: true }),
    }),
  });
  const mutationHeaders = { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-video-two-phase' };
  const first = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: JSON.stringify(VIDEO_BODY) });
  const replay = await invoke(handler, { path: '/api/ivprep-v6/interviews/start', method: 'POST', headers: mutationHeaders, body: JSON.stringify(VIDEO_BODY) });
  assert.equal(first.status, 202);
  assert.deepEqual(first.body.connection, connection);
  assert.deepEqual(replay.body.connection, connection);
  assert.equal(first.body.interview.state, 'starting');

  const readiness = await invoke(handler, {
    path: '/api/ivprep-v6/interviews/interview-video-two-phase/media-ready',
    method: 'POST',
    headers: mutationHeaders,
    body: JSON.stringify({
      avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
      videoDecoded: true,
      audioPlayable: true,
      audioAuthority: 'avatar-livekit',
    }),
  });
  assert.equal(readiness.status, 202);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].cookieFingerprint, 'a'.repeat(64));
  assert.equal(recorded[0].avatarParticipantIdentity, FOUNDER_TEST_AVATAR_PARTICIPANT_ID);

  providerState = 'ACTIVE';
  const status = await invoke(handler, { path: '/api/ivprep-v6/interviews/interview-video-two-phase/status' });
  assert.equal(status.status, 200);
  assert.equal(status.body.interview.state, 'active');
  assert.equal(JSON.stringify(status.body).includes(connection.token), false);

  providerState = 'CLOSED';
  const closed = await invoke(handler, { path: '/api/ivprep-v6/interviews/interview-video-two-phase/status' });
  assert.equal(closed.status, 200);
  assert.equal(closed.body.interview.state, 'ended');
  assert.equal(closed.body.provider.active, false);
});

test('handler shutdown awaits active controller cleanup', async () => {
  const stops = [];
  const handler = createIvPrepHqHandler({
    registry: registry(),
    now: () => NOW,
    idFactory: () => 'interview-shutdown-proof',
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true },
    paidTestGate: paidTestGate(),
    providerControllerFactory: () => ({
      start: async () => ({
        ok: true,
        pending: true,
        connection: {
          url: 'wss://example.livekit.cloud',
          token: 'synthetic-room-token'.padEnd(64, 'x'),
          participantIdentity: 'ivp-browser-shutdown',
          avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
        },
      }),
      stop: async (reason) => { stops.push(reason); return { ok: true }; },
      status: () => ({ state: 'AGENT_JOINING', active: false }),
    }),
  });
  const start = await invoke(handler, {
    path: '/api/ivprep-v6/interviews/start',
    method: 'POST',
    headers: {
      origin: 'http://hq.local',
      'sec-fetch-site': 'same-origin',
      'x-mmhq-csrf': CSRF,
      'idempotency-key': 'idem-shutdown-proof',
    },
    body: JSON.stringify(VIDEO_BODY),
  });
  assert.equal(start.status, 202);
  assert.deepEqual(await handler.shutdown('harness_shutdown'), { ok: true, stopped: 1 });
  assert.deepEqual(stops, ['harness_shutdown']);
});

test('logout during provider start is observed before activation and forces cleanup', async () => {
  const store = registry();
  let releaseStart;
  const startBarrier = new Promise((resolve) => { releaseStart = resolve; });
  const stopped = [];
  let stopPromise = null;
  const handler = createIvPrepHqHandler({
    registry: store,
    now: () => NOW,
    idFactory: () => 'interview-video-race',
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: true },
    paidTestGate: paidTestGate(),
    providerControllerFactory: () => ({
      start: async () => startBarrier,
      stop: async (reason) => {
        if (!stopPromise) {
          stopped.push(reason);
          stopPromise = Promise.resolve({ ok: true });
        }
        return stopPromise;
      },
    }),
  });
  const fingerprint = 'a'.repeat(64);
  const pending = invoke(handler, {
    path: '/api/ivprep-v6/interviews/start',
    method: 'POST',
    headers: { origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF, 'idempotency-key': 'idem-video-race' },
    body: JSON.stringify(VIDEO_BODY),
    fingerprint,
  });
  await new Promise((resolve) => setImmediate(resolve));
  store.recordLogout({ cookieFingerprint: fingerprint });
  releaseStart({ ok: true });
  const response = await pending;
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'ivprep_session_owner_changed');
  assert.deepEqual(stopped, ['hq_logout']);
});
