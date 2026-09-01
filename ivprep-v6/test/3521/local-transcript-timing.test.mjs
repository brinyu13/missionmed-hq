import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  FIRST_PARTY_TRANSCRIPT_TIMING_SOURCE,
  encodeFloat32Le,
  FIRST_PARTY_WORD_TIMING_TRANSPORT,
  LOCAL_SHERPA_TIMING_SOURCE,
  LOCAL_TRANSCRIPT_TIMING_SOURCE,
  LOOPBACK_WORD_TIMING_TRANSPORT,
  LocalTranscriptTimingProducer,
  resamplePcm,
  timedWordOccupancyMs,
} from '../../public/live-analytics/local-transcript-timing.mjs';
import { transcriptPcmFrame } from '../../public/analytics/browser-pipeline.mjs';
import { evaluateWordTiming } from '../../public/analytics/word-timing-ladder.mjs';

const response = (payload, ok = true) => ({ ok, async json() { return payload; } });
const liveStream = () => ({ getAudioTracks: () => [{ kind: 'audio', readyState: 'live', enabled: true }] });
const capability = () => ({
  available: true,
  source: LOCAL_SHERPA_TIMING_SOURCE,
  persistence: 'MEMORY_ONLY',
  providerSessions: 0,
});

class FakePipeline {
  setPcmConsumer(consumer) { this.consumer = consumer; }
  push(frame) { return this.consumer?.(frame); }
}

function pushSpeechWindow(pipeline, { durationMs = 4_000, sampleRate = 16_000, startAtMs = 0 } = {}) {
  const frameMs = 100;
  const frame = new Float32Array(sampleRate * frameMs / 1_000).fill(0.1);
  for (let atMs = startAtMs; atMs < startAtMs + durationMs; atMs += frameMs) {
    pipeline.push({ atMs, sampleRate, samples: frame, speaking: true, speechProbability: 0.95 });
  }
}

function pushVadUndercountedWindow(pipeline, { durationMs = 4_000, sampleRate = 16_000 } = {}) {
  const frameMs = 100;
  const frame = new Float32Array(sampleRate * frameMs / 1_000).fill(0.1);
  for (let atMs = 0; atMs < durationMs; atMs += frameMs) {
    pipeline.push({
      atMs,
      sampleRate,
      samples: frame,
      speaking: false,
      voiced: atMs < 500,
      speechProbability: 0.5,
    });
  }
}

test('local timing producer emits only authenticated, timing-only observed evidence from AudioWorklet PCM', async () => {
  let now = 4_000;
  const calls = [];
  const timings = [];
  const states = [];
  const pipeline = new FakePipeline();
  const words = Array.from({ length: 8 }, (_, index) => ({
    startMs: 100 + index * 350,
    endMs: 250 + index * 350,
    probability: 0.9,
  }));
  const producer = new LocalTranscriptTimingProducer({
    windowMs: 4_000,
    async fetchImpl(url, options) {
      calls.push({ url, options });
      if (options.method === 'GET') return response(capability());
      return response({
        available: true,
        providerSessions: 0,
        rawAudioPersisted: false,
        rawTextReturned: false,
        source: LOCAL_SHERPA_TIMING_SOURCE,
        speechDurationMs: 4_000,
        wordCount: words.length,
        words,
      });
    },
  });

  assert.equal(await producer.start({
    stream: liveStream(),
    pipeline,
    clock: { sessionMs: () => now },
    csrfToken: 'local_harness_csrf_3521',
    onTiming: (timing) => timings.push(timing),
    onState: (state) => states.push(state),
  }), true);
  pushSpeechWindow(pipeline);
  await producer.queue;

  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'http://127.0.0.1/api/ivprep-v6/live-analytics/word-timing');
  assert.equal(calls[1].options.credentials, 'same-origin');
  assert.equal(calls[1].options.redirect, 'error');
  assert.equal(calls[1].options.headers['X-MMHQ-CSRF'], 'local_harness_csrf_3521');
  assert.equal(calls[1].options.headers['Content-Type'], 'application/vnd.missionmed.pcm-f32le');
  assert.equal(calls[1].options.body instanceof ArrayBuffer, true);
  assert.equal(calls[1].options.body.byteLength, 4_000 * 16 * 4);
  assert.equal(new Uint8Array(calls[1].options.body).every((byte) => byte === 0), true);
  assert.equal(timings.length, 1);
  assert.deepEqual(timings[0], {
    atMs: 4_000,
    cadence: 'REALTIME_ROLLING',
    rateBasis: 'RECENT_WORD_START_INTERVALS',
    windowStartedAtMs: 0,
    windowEndedAtMs: 4_000,
    speechDurationMs: 4_000,
    coverage: 1,
    words,
    wordCount: 8,
    provenance: {
      kind: 'OBSERVED_TRANSCRIPT_TIMING',
      observed: true,
      tier: 'A_PRIME',
      wordTimestampsObserved: true,
      timingAccuracyValidated: false,
      source: LOCAL_TRANSCRIPT_TIMING_SOURCE,
      engine: 'SHERPA_ONNX_1.13.6_WASM',
      transport: LOOPBACK_WORD_TIMING_TRANSPORT,
      rawTextRetained: false,
      rawAudioPersisted: false,
    },
  });
  assert.doesNotMatch(JSON.stringify({ timings, states }), /transcriptText|recognizedText|must never|observed-audio/u);
  producer.stop();
  assert.equal(pipeline.consumer, null);
  now = 5_000;
});

test('default physical timing window begins decoding after two seconds for near-live feedback', async () => {
  const calls = [];
  const states = [];
  const pipeline = new FakePipeline();
  const words = Array.from({ length: 4 }, (_, index) => ({
    startMs: 100 + index * 430,
    endMs: 350 + index * 430,
    probability: 0.9,
  }));
  const producer = new LocalTranscriptTimingProducer({
    async fetchImpl(_url, options) {
      calls.push(options);
      if (options.method === 'GET') return response(capability());
      return response({
        available: true,
        providerSessions: 0,
        rawAudioPersisted: false,
        rawTextReturned: false,
        source: LOCAL_SHERPA_TIMING_SOURCE,
        speechDurationMs: 2_000,
        wordCount: words.length,
        words,
      });
    },
  });
  await producer.start({
    stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => 2_000 }, onTiming() {}, onState: (state) => states.push(state),
  });
  pushSpeechWindow(pipeline, { durationMs: 2_000 });
  await producer.queue;

  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.byteLength, 2_000 * 16 * 4);
  assert.ok(states.some((state) => state.reason === 'COLLECTING_TIMED_WORD_WINDOW'));
  assert.ok(states.some((state) => state.reason === 'DECODING_TIMED_WORD_WINDOW'));
  producer.stop();
});

test('adaptive recent timing uses the latest five-to-ten genuine words without diluting a later fast window', async () => {
  let now = 4_000;
  let decode = 0;
  const timings = [];
  const pipeline = new FakePipeline();
  const slowWords = Array.from({ length: 3 }, (_, index) => ({
    startMs: 100 + index * 900,
    endMs: 400 + index * 900,
    probability: 0.9,
  }));
  const fastWords = Array.from({ length: 12 }, (_, index) => ({
    startMs: 50 + index * 300,
    endMs: 250 + index * 300,
    probability: 0.9,
  }));
  const producer = new LocalTranscriptTimingProducer({
    windowMs: 4_000,
    async fetchImpl(_url, options) {
      if (options.method === 'GET') return response(capability());
      const words = decode < 2 ? slowWords : fastWords;
      decode += 1;
      return response({
        available: true,
        providerSessions: 0,
        rawAudioPersisted: false,
        rawTextReturned: false,
        source: LOCAL_SHERPA_TIMING_SOURCE,
        speechDurationMs: decode < 3 ? 3_500 : 3_000,
        wordCount: words.length,
        words,
      });
    },
  });
  await producer.start({
    stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => now }, onTiming: (timing) => timings.push(timing),
  });

  pushSpeechWindow(pipeline, { startAtMs: 0 });
  await producer.queue;
  assert.equal(timings[0].wordCount, 3);
  assert.equal(producer.state.reason, 'NEED_MORE_TIMED_WORDS');

  now = 8_000;
  pushSpeechWindow(pipeline, { startAtMs: 4_000 });
  await producer.queue;
  assert.equal(timings[1].windowStartedAtMs, 0);
  assert.equal(timings[1].windowEndedAtMs, 8_000);
  assert.equal(timings[1].wordCount, 6);
  assert.equal(timings[1].speechDurationMs, 7_000);
  assert.equal(producer.state.reason, 'LOCAL_TRANSCRIPT_TIMING_OBSERVED');

  now = 12_000;
  pushSpeechWindow(pipeline, { startAtMs: 8_000 });
  await producer.queue;
  assert.equal(timings[2].windowStartedAtMs, 8_000, 'fast speech uses only the newest sufficient window');
  assert.equal(timings[2].windowEndedAtMs, 12_000);
  assert.equal(timings[2].wordCount, 10);
  assert.equal(timings[2].speechDurationMs, 3_000);
  producer.stop();
});

test('realtime rolling evidence admits five genuine timed words while ordinary evidence retains the strict floor', () => {
  const words = Array.from({ length: 5 }, (_, index) => ({
    startMs: 100 + index * 400,
    endMs: 300 + index * 400,
    probability: 0.9,
  }));
  const evidence = {
    windowStartedAtMs: 0,
    windowEndedAtMs: 2_400,
    speechDurationMs: 1_600,
    coverage: 0.8,
    words,
    wordCount: words.length,
    provenance: {
      observed: true,
      tier: 'A_PRIME',
      wordTimestampsObserved: true,
      source: LOCAL_TRANSCRIPT_TIMING_SOURCE,
    },
  };

  assert.equal(evaluateWordTiming({ ...evidence, cadence: 'REALTIME_ROLLING' }).available, true);
  assert.equal(evaluateWordTiming(evidence).reason, 'NEED_MORE_TIMED_WORDS');
});

test('physical Sherpa low-confidence timestamps accumulate into a truthful rolling rate', async () => {
  let now = 2_000;
  let decode = 0;
  const timings = [];
  const pipeline = new FakePipeline();
  const windows = [
    [
      { startMs: 320, endMs: 620, probability: 0.09 },
      { startMs: 760, endMs: 1_040, probability: 0.18 },
      { startMs: 1_200, endMs: 1_500, probability: 0.12 },
    ],
    [
      { startMs: 240, endMs: 520, probability: 0.08 },
      { startMs: 700, endMs: 980, probability: 0.21 },
      { startMs: 1_140, endMs: 1_440, probability: 0.11 },
    ],
  ];
  const producer = new LocalTranscriptTimingProducer({
    async fetchImpl(_url, options) {
      if (options.method === 'GET') return response(capability());
      const words = windows[Math.min(decode, windows.length - 1)];
      decode += 1;
      return response({
        available: true,
        providerSessions: 0,
        rawAudioPersisted: false,
        rawTextReturned: false,
        source: LOCAL_SHERPA_TIMING_SOURCE,
        speechDurationMs: 1_400,
        wordCount: words.length,
        words,
      });
    },
  });
  await producer.start({
    stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => now }, onTiming: (timing) => timings.push(timing),
  });

  pushSpeechWindow(pipeline, { durationMs: 2_000, startAtMs: 0 });
  await producer.queue;
  now = 4_000;
  pushSpeechWindow(pipeline, { durationMs: 2_000, startAtMs: 2_000 });
  await producer.queue;

  const evaluated = evaluateWordTiming(timings.at(-1));
  assert.equal(timings.at(-1).wordCount, 6);
  assert.equal(evaluated.available, true);
  assert.equal(evaluated.rateBasis, 'RECENT_WORD_START_INTERVALS');
  assert.ok(evaluated.wordsPerMinute > 100 && evaluated.wordsPerMinute < 220);
  producer.stop();
});

test('realtime rolling pace uses genuine start-to-start intervals from the recent word window', () => {
  const words = Array.from({ length: 6 }, (_, index) => ({
    startMs: 500 + index * 500,
    endMs: 750 + index * 500,
    probability: 0.9,
  }));
  const result = evaluateWordTiming({
    cadence: 'REALTIME_ROLLING',
    rateBasis: 'RECENT_WORD_START_INTERVALS',
    windowStartedAtMs: 0,
    windowEndedAtMs: 4_000,
    speechDurationMs: 3_000,
    coverage: 0.75,
    words,
    wordCount: words.length,
    provenance: { observed: true, tier: 'A_PRIME', wordTimestampsObserved: true },
  });
  assert.equal(result.available, true);
  assert.equal(result.wordsPerMinute, 120);
  assert.equal(result.articulationWordsPerMinute, 120);
  assert.equal(result.rateBasis, 'RECENT_WORD_START_INTERVALS');
});

test('a stalled same-origin decode times out and leaves the queue available for the next window', async () => {
  const pipeline = new FakePipeline();
  const producer = new LocalTranscriptTimingProducer({
    requestTimeoutMs: 2_000,
    fetchImpl: async (_url, options) => {
      if (options.method === 'GET') return response(capability());
      return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    },
  });
  await producer.start({
    stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => 2_000 }, onTiming() {},
  });
  pushSpeechWindow(pipeline, { durationMs: 2_000 });
  await producer.queue;
  assert.equal(producer.state.reason, 'LOCAL_TRANSCRIPT_WINDOW_TIMED_OUT');
  assert.equal(producer.pendingWindows, 0);
  producer.stop();
});

test('producer fails closed without a live mic, PCM lane, CSRF, or exact local capability', async () => {
  const cases = [
    { stream: { getAudioTracks: () => [] }, pipeline: new FakePipeline(), csrfToken: 'local_harness_csrf_3521', reason: 'LIVE_MICROPHONE_TRACK_REQUIRED' },
    { stream: liveStream(), pipeline: null, csrfToken: 'local_harness_csrf_3521', reason: 'AUDIO_WORKLET_PCM_CONSUMER_REQUIRED' },
    { stream: liveStream(), pipeline: new FakePipeline(), csrfToken: '', reason: 'AUTHENTICATED_MUTATION_CSRF_REQUIRED' },
  ];
  for (const entry of cases) {
    const producer = new LocalTranscriptTimingProducer({ fetchImpl: async () => response(capability()) });
    assert.equal(await producer.start({ ...entry, clock: { sessionMs: () => 0 }, onTiming() {} }), false);
    assert.equal(producer.state.reason, entry.reason);
  }

  for (const payload of [
    { ...capability(), persistence: 'DISK' },
    { ...capability(), source: 'UNTRUSTED_TIMING_ENGINE' },
    { ...capability(), providerSessions: 1 },
  ]) {
    const producer = new LocalTranscriptTimingProducer({ fetchImpl: async () => response(payload) });
    assert.equal(await producer.start({
      stream: liveStream(),
      pipeline: new FakePipeline(),
      csrfToken: 'local_harness_csrf_3521',
      clock: { sessionMs: () => 0 },
      onTiming() {},
    }), false);
    assert.equal(producer.state.state, 'unavailable');
  }
});

test('producer reports a stalled microphone PCM lane instead of claiming live timing forever', async () => {
  let watchdog = null;
  const states = [];
  const producer = new LocalTranscriptTimingProducer({
    fetchImpl: async () => response(capability()),
    setTimeoutImpl(callback, delay) { watchdog = { callback, delay }; return 17; },
    clearTimeoutImpl() {},
  });
  assert.equal(await producer.start({
    stream: liveStream(), pipeline: new FakePipeline(), csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => 0 }, onTiming() {}, onState: (state) => states.push(state),
  }), true);
  assert.equal(watchdog.delay, 6_000);
  watchdog.callback();
  assert.equal(producer.state.reason, 'MICROPHONE_PCM_CAPTURE_STALLED');
  assert.equal(states.at(-1).state, 'partial');
  producer.stop();
});

test('first genuine microphone PCM frame disarms the capture watchdog', async () => {
  let watchdog = null;
  const cleared = [];
  const pipeline = new FakePipeline();
  const producer = new LocalTranscriptTimingProducer({
    fetchImpl: async () => response(capability()),
    setTimeoutImpl(callback, delay) { watchdog = { callback, delay }; return 23; },
    clearTimeoutImpl(id) { cleared.push(id); },
  });
  await producer.start({
    stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => 0 }, onTiming() {},
  });
  pipeline.push({ atMs: 0, sampleRate: 16_000, samples: new Float32Array(1_600), speaking: false });
  assert.deepEqual(cleared, [23]);
  watchdog.callback();
  assert.notEqual(producer.state.reason, 'MICROPHONE_PCM_CAPTURE_STALLED');
  producer.stop();
});

test('local word timestamps recover real duration and coverage when VAD undercounts voiced speech', async () => {
  const calls = [];
  const timings = [];
  const pipeline = new FakePipeline();
  const words = Array.from({ length: 8 }, (_, index) => ({
    startMs: 200 + index * 400,
    endMs: 580 + index * 400,
    probability: 0.9,
  }));
  const producer = new LocalTranscriptTimingProducer({
    windowMs: 4_000,
    async fetchImpl(_url, options) {
      calls.push(options);
      if (options.method === 'GET') return response(capability());
      return response({
        available: true,
        providerSessions: 0,
        rawAudioPersisted: false,
        rawTextReturned: false,
        source: LOCAL_SHERPA_TIMING_SOURCE,
        speechDurationMs: 500,
        wordCount: words.length,
        words,
      });
    },
  });
  await producer.start({
    stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => 4_000 }, onTiming: (timing) => timings.push(timing),
  });
  pushVadUndercountedWindow(pipeline);
  await producer.queue;

  assert.equal(calls.length, 2, 'validated F0 evidence admits one bounded local decode');
  assert.equal(calls[1].headers['X-IVPrep-Speech-Duration-Ms'], '500');
  assert.equal(timings.length, 1);
  assert.equal(timings[0].speechDurationMs, 3_040);
  assert.equal(timings[0].coverage, 0.76);
  producer.stop();
});

test('long pauses between timed words never inflate speech duration or coverage', () => {
  const words = [
    { startMs: 0, endMs: 40 }, { startMs: 100, endMs: 140 },
    { startMs: 200, endMs: 240 }, { startMs: 300, endMs: 340 },
    { startMs: 7_700, endMs: 7_740 }, { startMs: 7_800, endMs: 7_840 },
    { startMs: 7_900, endMs: 7_940 }, { startMs: 8_000, endMs: 8_040 },
  ];
  assert.equal(timedWordOccupancyMs(words), 320);
  assert.equal(timedWordOccupancyMs([
    { startMs: 0, endMs: 100 }, { startMs: 50, endMs: 150 },
  ]), 150, 'overlapping intervals are counted once');
});

test('pure silence still never reaches the local recognizer', async () => {
  const calls = [];
  const pipeline = new FakePipeline();
  const producer = new LocalTranscriptTimingProducer({
    windowMs: 4_000,
    async fetchImpl(_url, options) {
      calls.push(options);
      return response(capability());
    },
  });
  await producer.start({
    stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => 4_000 }, onTiming() {},
  });
  const frame = new Float32Array(1_600);
  for (let atMs = 0; atMs < 4_000; atMs += 100) {
    pipeline.push({ atMs, sampleRate: 16_000, samples: frame, speaking: false, voiced: false });
  }
  await producer.queue;
  assert.equal(calls.length, 1, 'only the capability probe may run for silence');
  assert.equal(producer.state.reason, 'NEED_MORE_SPEECH_TIME');
  producer.stop();
});

test('browser PCM bridge forwards validated voiced evidence without making it WPM', async () => {
  const samples = new Float32Array([0.1, -0.1]);
  const voiced = transcriptPcmFrame({
    atMs: 100, sampleRate: 48_000, samples, speaking: false,
    speechProbability: 0.5, f0: { voiced: true, f0Hz: 160 },
  });
  const unvoiced = transcriptPcmFrame({
    atMs: 200, sampleRate: 48_000, samples, speaking: false,
    speechProbability: 0.01, f0: { voiced: false, f0Hz: null },
  });
  assert.equal(voiced.voiced, true);
  assert.equal(unvoiced.voiced, false);
  assert.equal(voiced.samples, samples);
  assert.equal(Object.hasOwn(voiced, 'wordCount'), false);
  assert.equal(Object.hasOwn(voiced, 'wordsPerMinute'), false);
});

test('only the exact secure same-origin production route may receive microphone windows', async () => {
  for (const options of [
    { locationHref: 'http://127.0.0.1:62327/iv-prep-on-call/live-analytics/', endpoint: 'https://receiver.example/upload' },
    { locationHref: 'http://127.0.0.1:62327/iv-prep-on-call/live-analytics/', endpoint: 'http://localhost:62327/api/ivprep-v6/live-analytics/word-timing' },
    { locationHref: 'http://127.0.0.1:62327/iv-prep-on-call/live-analytics/', endpoint: '/api/ivprep-v6/live-analytics/word-timing?forward=1' },
    { locationHref: 'http://matrix.missionmed.example/iv-prep-on-call/live-analytics/' },
    { locationHref: 'https://matrix.missionmed.example/iv-prep-on-call/live-analytics/', endpoint: 'https://receiver.example/api/ivprep-v6/live-analytics/word-timing' },
  ]) {
    const calls = [];
    const producer = new LocalTranscriptTimingProducer({
      ...options,
      fetchImpl: async (...args) => { calls.push(args); return response(capability()); },
    });
    assert.equal(await producer.start({
      stream: liveStream(), pipeline: new FakePipeline(), csrfToken: 'local_harness_csrf_3521',
      clock: { sessionMs: () => 0 }, onTiming() {},
    }), false);
    assert.equal(producer.state.reason, 'WORD_TIMING_SAME_ORIGIN_REQUIRED');
    assert.equal(calls.length, 0);
  }
});

test('secure MissionMed production uses authenticated first-party ephemeral timing', async () => {
  const calls = [];
  const timings = [];
  const pipeline = new FakePipeline();
  const words = Array.from({ length: 8 }, (_, index) => ({
    startMs: 100 + index * 350, endMs: 250 + index * 350, probability: 0.9,
  }));
  const producer = new LocalTranscriptTimingProducer({
    locationHref: 'https://hq.missionmed.example/iv-prep-on-call/live-analytics/',
    windowMs: 4_000,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(options.method === 'GET' ? capability() : {
        available: true, providerSessions: 0, rawAudioPersisted: false, rawTextReturned: false,
        source: LOCAL_SHERPA_TIMING_SOURCE, speechDurationMs: 4_000, wordCount: words.length, words,
      });
    },
  });
  assert.equal(await producer.start({
    stream: liveStream(), pipeline, csrfToken: 'production_csrf_3522c',
    clock: { sessionMs: () => 4_000 }, onTiming: (timing) => timings.push(timing),
  }), true);
  pushSpeechWindow(pipeline);
  await producer.queue;
  assert.deepEqual(calls.map((call) => call.url), [
    'https://hq.missionmed.example/api/ivprep-v6/live-analytics/word-timing/status',
    'https://hq.missionmed.example/api/ivprep-v6/live-analytics/word-timing',
  ]);
  assert.equal(calls[1].options.credentials, 'same-origin');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[1].options.redirect, 'error');
  assert.equal(calls[1].options.headers['X-MMHQ-CSRF'], 'production_csrf_3522c');
  assert.equal(timings[0].provenance.transport, FIRST_PARTY_WORD_TIMING_TRANSPORT);
  assert.equal(timings[0].provenance.tier, 'B');
  assert.equal(timings[0].provenance.source, FIRST_PARTY_TRANSCRIPT_TIMING_SOURCE);
  assert.equal(timings[0].provenance.rawTextRetained, false);
  assert.equal(timings[0].provenance.rawAudioPersisted, false);
  producer.stop();
});

test('stateful endpoint objects are stringified once before exact-route admission', async () => {
  const calls = [];
  let stringifications = 0;
  const endpoint = {
    toString() {
      stringifications += 1;
      return stringifications === 1
        ? '/api/ivprep-v6/live-analytics/word-timing'
        : 'https://receiver.example/upload';
    },
  };
  const producer = new LocalTranscriptTimingProducer({
    endpoint,
    fetchImpl: async (url) => { calls.push(url); return response(capability()); },
  });
  assert.equal(await producer.start({
    stream: liveStream(), pipeline: new FakePipeline(), csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => 0 }, onTiming() {},
  }), true);
  assert.equal(stringifications, 1);
  assert.deepEqual(calls, ['http://127.0.0.1/api/ivprep-v6/live-analytics/word-timing/status']);
  producer.stop();
});

test('post-admission public-property mutation cannot redirect raw PCM', async () => {
  const calls = [];
  const pipeline = new FakePipeline();
  const words = Array.from({ length: 8 }, (_, index) => ({
    startMs: 100 + index * 350, endMs: 250 + index * 350, probability: 0.9,
  }));
  const producer = new LocalTranscriptTimingProducer({
    windowMs: 4_000,
    fetchImpl: async (url, options) => {
      calls.push(url);
      return response(options.method === 'GET' ? capability() : {
        available: true, providerSessions: 0, rawAudioPersisted: false, rawTextReturned: false,
        source: LOCAL_SHERPA_TIMING_SOURCE, speechDurationMs: 4_000, wordCount: words.length, words,
      });
    },
  });
  await producer.start({
    stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => 4_000 }, onTiming() {},
  });
  producer.endpoint = 'https://receiver.example/upload';
  producer.admittedEndpoint = 'https://receiver.example/upload';
  pushSpeechWindow(pipeline);
  await producer.queue;
  assert.deepEqual(calls, [
    'http://127.0.0.1/api/ivprep-v6/live-analytics/word-timing/status',
    'http://127.0.0.1/api/ivprep-v6/live-analytics/word-timing',
  ]);
  producer.stop();
});

test('zero-confidence and implausibly dense recognizer words cannot activate WPM', async () => {
  for (const words of [
    Array.from({ length: 8 }, (_, index) => ({
      startMs: 100 + index * 380, endMs: 480 + index * 380, probability: 0,
    })),
    Array.from({ length: 8 }, (_, index) => ({
      startMs: index * 50, endMs: index * 50 + 40, probability: 0.9,
    })),
  ]) {
    const timings = [];
    const pipeline = new FakePipeline();
    const producer = new LocalTranscriptTimingProducer({
      windowMs: 4_000,
      fetchImpl: async (_url, options) => response(options.method === 'GET' ? capability() : {
        available: true, providerSessions: 0, rawAudioPersisted: false, rawTextReturned: false,
        source: LOCAL_SHERPA_TIMING_SOURCE, speechDurationMs: 500, wordCount: words.length, words,
      }),
    });
    await producer.start({
      stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
      clock: { sessionMs: () => 4_000 }, onTiming: (timing) => timings.push(timing),
    });
    pushVadUndercountedWindow(pipeline);
    await producer.queue;
    if (words[0].probability === 0) {
      assert.equal(timings.length, 1);
      assert.equal(timings[0].wordCount, 0);
      assert.equal(timings[0].speechDurationMs, 500);
      assert.equal(producer.state.reason, 'NEED_MORE_TIMED_WORDS');
    } else {
      assert.equal(timings.length, 0);
      assert.equal(producer.state.reason, 'IMPLAUSIBLE_LOCAL_WORD_TIMING');
    }
    producer.stop();
  }
});

test('undeclared response fields, raw text, and invalid timing never cross the aggregate boundary', async () => {
  for (const invalidPayload of [
    {
      available: true, providerSessions: 0, rawAudioPersisted: false, rawTextReturned: true,
      source: LOCAL_SHERPA_TIMING_SOURCE, speechDurationMs: 4_000, wordCount: 0, words: [], transcript: 'must never cross',
    },
    {
      available: true, providerSessions: 0, rawAudioPersisted: false, rawTextReturned: false,
      source: LOCAL_SHERPA_TIMING_SOURCE, speechDurationMs: 4_000, wordCount: 1,
      words: [{ startMs: 900, endMs: 800, probability: 0.9 }],
    },
  ]) {
    const pipeline = new FakePipeline();
    const timings = [];
    const producer = new LocalTranscriptTimingProducer({
      windowMs: 4_000,
      fetchImpl: async (_url, options) => response(options.method === 'GET' ? capability() : invalidPayload),
    });
    await producer.start({
      stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
      clock: { sessionMs: () => 4_000 }, onTiming: (timing) => timings.push(timing),
    });
    pushSpeechWindow(pipeline);
    await producer.queue;
    assert.equal(timings.length, 0);
    assert.equal(producer.state.state, 'partial');
    producer.stop();
  }
});

test('stopping while capability is pending cannot reactivate the PCM consumer', async () => {
  let resolveProbe;
  const pipeline = new FakePipeline();
  const producer = new LocalTranscriptTimingProducer({
    fetchImpl: () => new Promise((resolve) => { resolveProbe = resolve; }),
  });
  const started = producer.start({
    stream: liveStream(), pipeline, csrfToken: 'local_harness_csrf_3521',
    clock: { sessionMs: () => 0 }, onTiming() {},
  });
  producer.stop();
  resolveProbe(response(capability()));
  assert.equal(await started, false);
  assert.equal(producer.active, false);
  assert.equal(pipeline.consumer, null);
});

test('PCM conversion is bounded, finite, normalized, and sample-rate explicit', () => {
  const source = new Float32Array([2, 1, 0, -1, -2]);
  const resampled = resamplePcm(source, 10_000, 20_000);
  assert.equal(resampled.length, 10);
  const encoded = encodeFloat32Le(resampled);
  const view = new DataView(encoded);
  for (let index = 0; index < resampled.length; index += 1) {
    assert.equal(Number.isFinite(view.getFloat32(index * 4, true)), true);
    assert.equal(Math.abs(view.getFloat32(index * 4, true)) <= 1, true);
  }
  assert.throws(() => encodeFloat32Le(new Float32Array([Number.NaN])), /finite/u);
});

test('vendored runtime and harness are local-only, memory-only, and provider-free', async () => {
  const harness = await readFile(new URL('../../scripts/3521/start-live-analytics-harness.mjs', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../../server/local-word-timing-worker.cjs', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../../vendor/sherpa-onnx-node/1.13.6/manifest.json', import.meta.url), 'utf8'));
  assert.match(harness, /createLocalWordTimingRuntime/u);
  assert.match(harness, /PROVIDER_SESSIONS=0/u);
  assert.doesNotMatch(harness, /spawn|faster-whisper|OPENAI_API_KEY|fetch\(/iu);
  assert.match(worker, /LOCAL_WORD_TIMING_ASSET_HASH_MISMATCH/u);
  assert.doesNotMatch(worker, /https?:|fetch\(|writeFile|createWriteStream|OpenAI/iu);
  assert.equal(manifest.runtime.version, '1.13.6');
  assert.equal(manifest.model.license, 'Apache-2.0');
  assert.match(manifest.model.revision, /^[a-f0-9]{40}$/u);
});
