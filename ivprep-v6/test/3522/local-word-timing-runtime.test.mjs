import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';
import {
  createLocalWordTimingRuntime,
  decodeFloat32Le,
  inspectLocalWordTimingAssets,
  LOCAL_WORD_TIMING_SAMPLE_RATE,
  LOCAL_WORD_TIMING_SOURCE,
  normalizeWordTimingPcm,
} from '../../server/local-word-timing-runtime.mjs';

const NOW = Date.parse('2026-08-25T16:00:00.000Z');
const CSRF = 'local_harness_csrf_3521';

function registry() {
  const store = new InMemoryAdmissionRegistry({ now: () => NOW });
  store.grantSyntheticEntitlement({
    subject: 'wp:3521', revision: 'word-timing-test-1', expiresAtMs: NOW + 120_000,
    founder: true, voice: true, video: false, grantedVideoSeconds: 0,
  });
  return store;
}

function session() {
  return {
    version: 1,
    issuedAt: new Date(NOW - 1_000).toISOString(),
    expiresAt: new Date(NOW + 60_000).toISOString(),
    csrfToken: CSRF,
    authSource: 'wordpress-cookie',
    user: { id: 3521, roles: ['administrator'] },
  };
}

async function invoke(handler, { path, method = 'GET', headers = {}, body = null } = {}) {
  const request = Readable.from(body ? [body] : []);
  request.method = method;
  request.headers = { host: 'hq.local', ...headers };
  const response = {
    status: null,
    headers: null,
    body: '',
    writeHead(status, responseHeaders) { this.status = status; this.headers = responseHeaders; },
    end(chunk = '') { this.body += String(chunk); },
  };
  await handler({
    request,
    response,
    url: new URL(path, 'http://hq.local'),
    hqSession: session(),
    cookieFingerprint: 'a'.repeat(64),
    hqSessionMaxTtlSeconds: 300,
    expectedOrigin: 'http://hq.local',
  });
  return { status: response.status, body: response.body ? JSON.parse(response.body) : null };
}

function pcmBody(samples) {
  const body = Buffer.alloc(samples.length * 4);
  samples.forEach((sample, index) => body.writeFloatLE(sample, index * 4));
  return body;
}

test('float32 decoder requires finite, normalized, aligned PCM', () => {
  const samples = decodeFloat32Le(pcmBody([0, 0.5, -0.5, 1, -1]));
  assert.deepEqual([...samples], [0, 0.5, -0.5, 1, -1]);
  assert.throws(() => decodeFloat32Le(Buffer.alloc(3)), /aligned/u);
  assert.throws(() => decodeFloat32Le(pcmBody([Number.NaN])), /finite/u);
  assert.throws(() => decodeFloat32Le(pcmBody([1.5])), /normalized/u);
});

test('word timing normalizes only its private low-level ASR copy', () => {
  const quiet = new Float32Array(16_000).fill(10 ** (-50 / 20));
  const original = new Float32Array(quiet);
  const normalized = normalizeWordTimingPcm(quiet);
  const rms = Math.sqrt(normalized.reduce((sum, value) => sum + value * value, 0) / normalized.length);
  assert.deepEqual(quiet, original);
  assert.notEqual(normalized.buffer, quiet.buffer);
  assert.ok(Math.abs(20 * Math.log10(rms) - (-22)) < 0.1);
  assert.ok(Math.max(...normalized) <= 0.92);
  const silence = new Float32Array(800);
  assert.deepEqual(normalizeWordTimingPcm(silence), silence);
  assert.throws(() => normalizeWordTimingPcm(new Float32Array([Number.NaN])), /PCM_INVALID/u);
});

test('authenticated HQ endpoint exposes capability and returns timing-only aggregates', async () => {
  const calls = [];
  let closed = false;
  const fakeRuntime = {
    async probe() {
      return { available: true, source: LOCAL_WORD_TIMING_SOURCE, persistence: 'MEMORY_ONLY', providerSessions: 0 };
    },
    async transcribe(input) {
      calls.push(input);
      return Object.freeze({
        available: true,
        providerSessions: 0,
        rawAudioPersisted: false,
        rawTextReturned: false,
        source: LOCAL_WORD_TIMING_SOURCE,
        speechDurationMs: input.speechDurationMs,
        wordCount: 2,
        words: Object.freeze([
          Object.freeze({ startMs: 100, endMs: 320, probability: 0.91 }),
          Object.freeze({ startMs: 500, endMs: 740, probability: 0.88 }),
        ]),
      });
    },
    async close() { closed = true; },
  };
  const handler = createIvPrepHqHandler({
    registry: registry(),
    now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
    wordTimingRuntime: fakeRuntime,
  });
  const status = await invoke(handler, { path: '/api/ivprep-v6/live-analytics/word-timing/status' });
  assert.deepEqual(status, {
    status: 200,
    body: { available: true, source: LOCAL_WORD_TIMING_SOURCE, providerSessions: 0, persistence: 'MEMORY_ONLY' },
  });

  const body = pcmBody(new Array(LOCAL_WORD_TIMING_SAMPLE_RATE).fill(0.1));
  const mutationHeaders = {
    origin: 'http://hq.local',
    'sec-fetch-site': 'same-origin',
    'x-mmhq-csrf': CSRF,
    'content-type': 'application/vnd.missionmed.pcm-f32le',
    'x-ivprep-sample-rate': String(LOCAL_WORD_TIMING_SAMPLE_RATE),
    'x-ivprep-speech-duration-ms': '800',
  };
  const result = await invoke(handler, {
    path: '/api/ivprep-v6/live-analytics/word-timing', method: 'POST', headers: mutationHeaders, body,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body).sort(), [
    'available', 'providerSessions', 'rawAudioPersisted', 'rawTextReturned',
    'source', 'speechDurationMs', 'wordCount', 'words',
  ]);
  assert.equal(result.body.wordCount, 2);
  assert.equal('transcript' in result.body, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].samples instanceof Float32Array, true);
  assert.equal(calls[0].samples.length, LOCAL_WORD_TIMING_SAMPLE_RATE);
  assert.equal(calls[0].sampleRate, LOCAL_WORD_TIMING_SAMPLE_RATE);
  assert.equal(calls[0].speechDurationMs, 800);
  assert.equal(body.every((byte) => byte === 0), true, 'request PCM must be zeroed after processing');

  const denied = await invoke(handler, {
    path: '/api/ivprep-v6/live-analytics/word-timing', method: 'POST',
    headers: { ...mutationHeaders, 'x-mmhq-csrf': 'wrong_csrf_token_123456' }, body,
  });
  assert.equal(denied.status, 403);
  assert.equal(calls.length, 1);
  assert.deepEqual(await handler.shutdown(), { ok: true, stopped: 0 });
  assert.equal(closed, true);
});

test('HQ word-timing endpoint rejects media-type, sample-rate, and body violations before ASR', async () => {
  let transcribes = 0;
  const fakeRuntime = {
    async probe() { return { available: true, source: LOCAL_WORD_TIMING_SOURCE, persistence: 'MEMORY_ONLY' }; },
    async transcribe() { transcribes += 1; throw new Error('must not run'); },
    async close() {},
  };
  const handler = createIvPrepHqHandler({
    registry: registry(), now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
    wordTimingRuntime: fakeRuntime,
  });
  const base = {
    origin: 'http://hq.local', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': CSRF,
    'content-type': 'application/vnd.missionmed.pcm-f32le',
    'x-ivprep-sample-rate': String(LOCAL_WORD_TIMING_SAMPLE_RATE),
    'x-ivprep-speech-duration-ms': '10',
  };
  assert.equal((await invoke(handler, {
    path: '/api/ivprep-v6/live-analytics/word-timing', method: 'POST',
    headers: { ...base, 'content-type': 'audio/webm' }, body: Buffer.alloc(4),
  })).status, 415);
  assert.equal((await invoke(handler, {
    path: '/api/ivprep-v6/live-analytics/word-timing', method: 'POST',
    headers: { ...base, 'x-ivprep-sample-rate': '48000' }, body: Buffer.alloc(4),
  })).status, 400);
  assert.equal((await invoke(handler, {
    path: '/api/ivprep-v6/live-analytics/word-timing', method: 'POST', headers: base, body: Buffer.alloc(3),
  })).status, 400);
  assert.equal(transcribes, 0);
  await handler.shutdown();
});

test('vendored Sherpa worker initializes locally and fails truthful on silence', { timeout: 60_000 }, async () => {
  const assets = inspectLocalWordTimingAssets();
  assert.equal(assets.available, true);
  assert.equal(assets.providerSessions, 0);
  const runtime = createLocalWordTimingRuntime({ timeoutMs: 60_000 });
  try {
    const capability = await runtime.probe();
    assert.equal(capability.available, true);
    assert.equal(capability.source, LOCAL_WORD_TIMING_SOURCE);
    assert.equal(capability.providerSessions, 0);
    const timing = await runtime.transcribe({
      samples: new Float32Array(LOCAL_WORD_TIMING_SAMPLE_RATE),
      sampleRate: LOCAL_WORD_TIMING_SAMPLE_RATE,
      speechDurationMs: 0,
    });
    assert.deepEqual(timing.words, []);
    assert.equal(timing.wordCount, 0);
    assert.equal(timing.rawTextReturned, false);
    assert.equal(timing.rawAudioPersisted, false);
    assert.equal(timing.providerSessions, 0);
  } finally {
    await runtime.close();
  }
});
