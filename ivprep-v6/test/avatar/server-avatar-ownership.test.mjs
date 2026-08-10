import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LIVE_INTERVIEWER_TARGET } from '../../avatar/live-interviewer-target.mjs';
import { AlphaStore } from '../../persistence/alpha-store.mjs';
import { createIvPrepServer } from '../../server/serve.mjs';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function fakeAvatarProvider({ stopFailures = 0 } = {}) {
  const calls = [];
  let sessionId = null;
  return {
    calls,
    health: () => ({
      provider: 'liveavatar', configured: true, available: Boolean(sessionId), connected: Boolean(sessionId),
      status: sessionId ? 'connected' : 'idle', mode: 'LITE', avatarId: LIVE_INTERVIEWER_TARGET.avatarId, sessionId,
    }),
    usage: () => ({ provider: 'liveavatar', sessions: sessionId ? 1 : 0, sessionId }),
    async createSession() {
      sessionId = '77777777-7777-4777-8777-777777777777';
      calls.push(['create']);
      return { sessionId, status: 'created', avatarId: LIVE_INTERVIEWER_TARGET.avatarId, mode: 'LITE', maxSessionDuration: 120 };
    },
    async start() {
      calls.push(['start']);
      return {
        provider: 'liveavatar', status: 'connected', sessionId, avatarId: LIVE_INTERVIEWER_TARGET.avatarId,
        maxSessionDuration: 120, media: { url: 'wss://unit.test', clientToken: 'scoped-client-token' },
      };
    },
    async enqueueAudio(_audio, options) { calls.push(['audio', options]); return { accepted: true, eventId: options.eventId, final: options.final }; },
    async interrupt(options) { calls.push(['interrupt', options]); return { interrupted: true, eventId: options.eventId }; },
    async reconnect() { calls.push(['reconnect']); return { status: 'connected', sessionId, reconnected: true, media: { url: 'wss://unit.test', clientToken: 'scoped-client-token' } }; },
    async stop(options) {
      calls.push(['stop', options]);
      if (stopFailures > 0) { stopFailures -= 1; throw new Error('sanitized fake stop failure'); }
      sessionId = null;
      return { stopped: true };
    },
    async close() { calls.push(['close']); sessionId = null; },
  };
}

test('avatar control is bound to one active avatar-mode alpha session and carries cancellation event IDs', async (t) => {
  const previousOrigin = process.env.LIVEAVATAR_LIVEKIT_ORIGIN;
  process.env.LIVEAVATAR_LIVEKIT_ORIGIN = 'wss://unit.test';
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.LIVEAVATAR_LIVEKIT_ORIGIN;
    else process.env.LIVEAVATAR_LIVEKIT_ORIGIN = previousOrigin;
  });
  const storePath = join(mkdtempSync(join(tmpdir(), 'ivprep-avatar-owner-')), 'sessions.json');
  const avatarProvider = fakeAvatarProvider();
  const server = createIvPrepServer({ apiKey: 'unit-key', avatarProvider, alphaStore: new AlphaStore({ path: storePath }) });
  t.after(async () => {
    await server.closeProviders().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  });
  const base = await listen(server);
  const post = (path, body) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const alphaResponse = await post('/api/alpha-sessions/start', {
    testIdentity: 'avatar-owner', durationMinutes: 2, selectedInterviewer: 'senior-academic-pd-male',
    model: 'gpt-5.6-terra', voice: 'cedar', avatar: LIVE_INTERVIEWER_TARGET.avatarId,
    behavior: 'direct-program-director', mode: 'avatar',
  });
  assert.equal(alphaResponse.status, 201);
  const alphaSessionId = (await alphaResponse.json()).session.id;

  const createdResponse = await post('/api/avatar/session/create', { alphaSessionId, avatarId: LIVE_INTERVIEWER_TARGET.avatarId });
  assert.equal(createdResponse.status, 201);
  const sessionId = (await createdResponse.json()).sessionId;
  assert.equal((await post('/api/avatar/session/start', { alphaSessionId, sessionId })).status, 200);

  const wrongOwner = await post('/api/avatar/session/audio', {
    alphaSessionId: 'wrong-alpha-session', sessionId, eventId: 'utterance-1', final: false, pcmBase64: 'AAA=',
  });
  assert.equal(wrongOwner.status, 400);
  assert.equal(avatarProvider.calls.some(([name]) => name === 'audio'), false);

  const audio = await post('/api/avatar/session/audio', {
    alphaSessionId, sessionId, eventId: 'utterance-1', final: false, pcmBase64: 'AAA=',
  });
  assert.equal(audio.status, 200);
  const interrupted = await post('/api/avatar/session/interrupt', { alphaSessionId, sessionId, eventId: 'utterance-1' });
  assert.equal(interrupted.status, 200);
  assert.deepEqual(avatarProvider.calls.find(([name]) => name === 'interrupt'), ['interrupt', { eventId: 'utterance-1' }]);

  const omittedSession = await post('/api/avatar/session/stop', { alphaSessionId });
  assert.equal(omittedSession.status, 400);
  assert.equal((await post('/api/avatar/session/stop', { alphaSessionId, sessionId, reason: 'completed' })).status, 200);
});

test('unacknowledged remote stop retains ownership so cleanup can be retried', async (t) => {
  const previousOrigin = process.env.LIVEAVATAR_LIVEKIT_ORIGIN;
  process.env.LIVEAVATAR_LIVEKIT_ORIGIN = 'wss://unit.test';
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.LIVEAVATAR_LIVEKIT_ORIGIN;
    else process.env.LIVEAVATAR_LIVEKIT_ORIGIN = previousOrigin;
  });
  const storePath = join(mkdtempSync(join(tmpdir(), 'ivprep-avatar-cleanup-')), 'sessions.json');
  const avatarProvider = fakeAvatarProvider({ stopFailures: 1 });
  const server = createIvPrepServer({ apiKey: 'unit-key', avatarProvider, alphaStore: new AlphaStore({ path: storePath }) });
  t.after(async () => {
    await server.closeProviders().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  });
  const base = await listen(server);
  const post = (path, body) => fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const alpha = await (await post('/api/alpha-sessions/start', {
    testIdentity: 'avatar-cleanup-owner', durationMinutes: 2, selectedInterviewer: 'senior-academic-pd-male',
    model: 'gpt-5.6-terra', voice: 'cedar', avatar: LIVE_INTERVIEWER_TARGET.avatarId,
    behavior: 'direct-program-director', mode: 'avatar',
  })).json();
  const alphaSessionId = alpha.session.id;
  const created = await (await post('/api/avatar/session/create', { alphaSessionId, avatarId: LIVE_INTERVIEWER_TARGET.avatarId })).json();
  const sessionId = created.sessionId;
  assert.equal((await post('/api/avatar/session/start', { alphaSessionId, sessionId })).status, 200);

  const firstStop = await post('/api/avatar/session/stop', { alphaSessionId, sessionId, reason: 'completed' });
  assert.equal(firstStop.status, 503);
  assert.equal((await firstStop.json()).code, 'liveavatar_cleanup_unconfirmed');
  assert.equal(avatarProvider.health().sessionId, sessionId);

  const retryStop = await post('/api/avatar/session/stop', { alphaSessionId, sessionId, reason: 'cleanup-retry' });
  assert.equal(retryStop.status, 200);
  assert.equal((await retryStop.json()).cleanup.acknowledged, true);
});
