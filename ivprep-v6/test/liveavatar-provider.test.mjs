import { EventEmitter } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';

import { NullAvatarProvider } from '../providers/avatar-provider.mjs';
import { ProviderError, publicProviderError } from '../providers/errors.mjs';
import {
  LIVEAVATAR_AUDIO_CONTRACT,
  LiveAvatarProvider,
  createAvatarProviderFromEnv,
  liveAvatarConfigFromEnv,
} from '../providers/liveavatar-provider.mjs';

const TEST_ENV = Object.freeze({
  LIVEAVATAR_API_KEY: 'unit-test-api-key',
  LIVEAVATAR_AVATAR_ID: 'bd43ce31-7425-4379-8407-60f029548e61',
  LIVEAVATAR_SANDBOX: 'true',
  LIVEAVATAR_MAX_SESSION_SECONDS: '1200',
});

class FakeWebSocket extends EventEmitter {
  static instances = [];

  constructor(url) {
    super();
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.emit('message', JSON.stringify({ type: 'session.state_updated', state: 'connected' }));
    });
  }

  send(value) {
    if (this.readyState !== 1) throw new Error('socket not open');
    const event = JSON.parse(value);
    this.sent.push(event);
    if (event.type === 'agent.speak_end') {
      queueMicrotask(() => this.emit('message', JSON.stringify({
        type: 'agent.speak_ended',
        event_id: event.event_id,
      })));
    }
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close');
  }
}

function response(data, { ok = true, status = 200 } = {}) {
  return { ok, status, async json() { return data; } };
}

function providerHarness({ stopFailure = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({ path, init });
    if (path === '/v1/sessions/token') {
      return response({
        code: 100,
        data: {
          session_id: '77777777-7777-4777-8777-777777777777',
          session_token: 'unit-test-session-token',
        },
      });
    }
    if (path === '/v1/sessions/start') {
      return response({
        code: 100,
        data: {
          session_id: '77777777-7777-4777-8777-777777777777',
          livekit_url: 'wss://unit.test/livekit',
          livekit_client_token: 'unit-test-client-token',
          livekit_agent_token: 'must-not-be-retained',
          ws_url: 'wss://unit.test/control?ephemeral=1',
          max_session_duration: 1200,
        },
      }, { status: 201 });
    }
    if (path === '/v1/sessions/stop') {
      if (stopFailure) return response({}, { ok: false, status: 503 });
      return response({ code: 100, data: null });
    }
    throw new Error(`unexpected test path: ${path}`);
  };

  FakeWebSocket.instances = [];
  let now = Date.parse('2026-08-02T12:00:00.000Z');
  const provider = new LiveAvatarProvider({
    env: TEST_ENV,
    fetchImpl,
    WebSocketImpl: FakeWebSocket,
    now: () => now,
    randomUUIDImpl: () => '99999999-9999-4999-8999-999999999999',
    setIntervalImpl: () => ({ unref() {} }),
    clearIntervalImpl() {},
    connectTimeoutMs: 100,
  });
  return {
    provider,
    calls,
    advance(milliseconds) { now += milliseconds; },
  };
}

test('environment configuration is fail-closed, sandboxed, and capped at twenty minutes', () => {
  const empty = liveAvatarConfigFromEnv({});
  assert.equal(empty.configured, false);
  assert.equal(empty.sandbox, true);
  assert.match(empty.unavailableReason, /voice-only/i);

  const capped = liveAvatarConfigFromEnv({ ...TEST_ENV, LIVEAVATAR_MAX_SESSION_SECONDS: '99999' });
  assert.equal(capped.configured, true);
  assert.equal(capped.hasServerAuthorization, true);
  assert.equal(Object.hasOwn(capped, 'apiKey'), false);
  assert.equal(capped.maxSessionDuration, 1200);
  assert.equal(capped.videoEncoding, 'H264');
});

test('factory selects a truthful inactive provider without complete server configuration', async () => {
  const provider = createAvatarProviderFromEnv({ env: { LIVEAVATAR_AVATAR_ID: TEST_ENV.LIVEAVATAR_AVATAR_ID } });
  assert.ok(provider instanceof NullAvatarProvider);
  assert.match((await provider.start()).reason, /server authorization is unavailable/i);
});

test('LITE session uses the authenticated API contract and keeps control credentials out of diagnostics', async () => {
  const { provider, calls } = providerHarness();
  const created = await provider.createSession();
  const started = await provider.start();

  assert.deepEqual(created, {
    provider: 'liveavatar',
    status: 'created',
    mode: 'LITE',
    sessionId: '77777777-7777-4777-8777-777777777777',
    avatarId: TEST_ENV.LIVEAVATAR_AVATAR_ID,
    sandbox: true,
    maxSessionDuration: 1200,
  });
  assert.equal(started.status, 'connected');
  assert.equal(started.media.transport, 'livekit');
  assert.deepEqual(started.audioInput, {
    encoding: 'pcm_s16le',
    sampleRateHz: 24000,
    channels: 1,
  });

  const tokenCall = calls.find((call) => call.path === '/v1/sessions/token');
  const tokenBody = JSON.parse(tokenCall.init.body);
  assert.equal(tokenCall.init.headers['X-API-KEY'], TEST_ENV.LIVEAVATAR_API_KEY);
  assert.deepEqual(tokenBody, {
    mode: 'LITE',
    avatar_id: TEST_ENV.LIVEAVATAR_AVATAR_ID,
    is_sandbox: true,
    video_settings: { quality: 'high', encoding: 'H264' },
    max_session_duration: 1200,
  });
  const startCall = calls.find((call) => call.path === '/v1/sessions/start');
  assert.equal(startCall.init.headers.authorization, 'Bearer unit-test-session-token');

  const diagnostics = JSON.stringify({ health: provider.health(), usage: provider.usage() });
  assert.equal(diagnostics.includes(TEST_ENV.LIVEAVATAR_API_KEY), false);
  assert.equal(diagnostics.includes('unit-test-session-token'), false);
  assert.equal(diagnostics.includes('must-not-be-retained'), false);
  assert.equal(diagnostics.includes('ephemeral=1'), false);
  await provider.stop({ reason: 'completed' });
  const stopCall = calls.find((call) => call.path === '/v1/sessions/stop');
  assert.deepEqual(JSON.parse(stopCall.init.body), {
    session_id: '77777777-7777-4777-8777-777777777777',
    reason: 'USER_CLOSED',
  });
  await provider.close();
});

test('finished 24 kHz PCM is sent as synchronized speak/speak_end and can be interrupted', async () => {
  const { provider, advance } = providerHarness();
  await provider.start();
  const socket = FakeWebSocket.instances.at(-1);
  const pcm = Buffer.alloc(48_000, 7);

  const result = await provider.enqueueAudio(pcm);
  assert.deepEqual(result, {
    accepted: true,
    eventId: '99999999-9999-4999-8999-999999999999',
    bytes: 48_000,
    final: true,
    playbackEnded: true,
    reason: 'provider-event',
  });
  assert.deepEqual(socket.sent.slice(0, 2), [
    {
      type: 'agent.speak',
      event_id: '99999999-9999-4999-8999-999999999999',
      audio: pcm.toString('base64'),
    },
    { type: 'agent.speak_end', event_id: '99999999-9999-4999-8999-999999999999' },
  ]);

  assert.deepEqual(await provider.interrupt(), { interrupted: true });
  assert.deepEqual(socket.sent.at(-1), { type: 'agent.interrupt' });
  advance(90_000);
  assert.deepEqual(provider.usage(), {
    provider: 'liveavatar',
    sessions: 1,
    active: true,
    sessionId: '77777777-7777-4777-8777-777777777777',
    createdAt: '2026-08-02T12:00:00.000Z',
    startedAt: '2026-08-02T12:00:00.000Z',
    endedAt: null,
    estimatedMinutes: 1.5,
    audioBytes: 48_000,
    audioChunks: 1,
    audioSeconds: 1,
    interruptions: 1,
    reconnects: 0,
  });
  await provider.close();
});

test('async PCM streams preserve one utterance event and close it once', async () => {
  const { provider } = providerHarness();
  await provider.start();
  const socket = FakeWebSocket.instances.at(-1);

  async function* audio() {
    yield Buffer.alloc(4_800, 1);
    yield Buffer.alloc(9_600, 2);
  }

  const result = await provider.attachAudioStream(audio());
  assert.equal(result.chunks, 2);
  assert.equal(result.bytes, 14_400);
  assert.deepEqual(socket.sent.map((event) => event.type), [
    'agent.speak',
    'agent.speak',
    'agent.speak_end',
  ]);
  assert.equal(new Set(socket.sent.map((event) => event.event_id)).size, 1);
  await provider.close();
});

test('audio contract rejects wrong formats and unsafe packet sizes before socket transmission', async () => {
  const { provider } = providerHarness();
  await provider.start();
  const socket = FakeWebSocket.instances.at(-1);

  await assert.rejects(
    provider.enqueueAudio(Buffer.alloc(100), { format: 'mp3' }),
    (error) => error instanceof ProviderError && error.code === 'liveavatar_invalid_audio',
  );
  await assert.rejects(
    provider.enqueueAudio(Buffer.alloc(LIVEAVATAR_AUDIO_CONTRACT.maxRawChunkBytes + 2)),
    (error) => error instanceof ProviderError && error.code === 'liveavatar_audio_too_large',
  );
  assert.equal(socket.sent.length, 0);
  await provider.close();
});

test('reconnect replaces only the control socket and does not mint a duplicate provider session', async () => {
  const { provider, calls } = providerHarness();
  await provider.start();
  const first = FakeWebSocket.instances.at(-1);
  const result = await provider.reconnect();

  assert.equal(result.reconnected, true);
  assert.equal(first.readyState, 3);
  assert.equal(FakeWebSocket.instances.length, 2);
  assert.equal(calls.filter((call) => call.path === '/v1/sessions/token').length, 1);
  assert.equal(calls.filter((call) => call.path === '/v1/sessions/start').length, 1);
  assert.equal(provider.usage().reconnects, 1);
  await provider.close();
});

test('remote stop failure still closes local media and returns a sanitized normalized error', async () => {
  const { provider } = providerHarness({ stopFailure: true });
  await provider.start();
  const socket = FakeWebSocket.instances.at(-1);

  await assert.rejects(
    provider.stop(),
    (error) => {
      assert.equal(error instanceof ProviderError, true);
      assert.equal(error.code, 'liveavatar_stop_failed');
      assert.deepEqual(publicProviderError(error), {
        error: 'The live avatar is unavailable. Continue in voice-only mode.',
        code: 'liveavatar_stop_failed',
        provider: 'liveavatar',
        retryable: true,
      });
      return true;
    },
  );
  assert.equal(socket.readyState, 3);
  assert.equal(provider.health().connected, false);
  assert.equal(provider.health().fallback, 'voice-only');
  assert.equal(provider.health().sessionId, null);
});
