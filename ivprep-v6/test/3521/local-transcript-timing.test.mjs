import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  encodeFloat32Le,
  LOCAL_SHERPA_TIMING_SOURCE,
  LOCAL_TRANSCRIPT_TIMING_SOURCE,
  LocalTranscriptTimingProducer,
  resamplePcm,
} from '../../public/live-analytics/local-transcript-timing.mjs';

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

function pushSpeechWindow(pipeline, { durationMs = 4_000, sampleRate = 16_000 } = {}) {
  const frameMs = 100;
  const frame = new Float32Array(sampleRate * frameMs / 1_000).fill(0.1);
  for (let atMs = 0; atMs < durationMs; atMs += frameMs) {
    pipeline.push({ atMs, sampleRate, samples: frame, speaking: true, speechProbability: 0.95 });
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
  assert.equal(calls[1].url, '/api/ivprep-v6/live-analytics/word-timing');
  assert.equal(calls[1].options.credentials, 'same-origin');
  assert.equal(calls[1].options.headers['X-MMHQ-CSRF'], 'local_harness_csrf_3521');
  assert.equal(calls[1].options.headers['Content-Type'], 'application/vnd.missionmed.pcm-f32le');
  assert.equal(calls[1].options.body instanceof ArrayBuffer, true);
  assert.equal(calls[1].options.body.byteLength, 4_000 * 16 * 4);
  assert.equal(timings.length, 1);
  assert.deepEqual(timings[0], {
    atMs: 4_000,
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
      engine: 'SHERPA_ONNX_1.13.6_LOCAL_WASM',
      transport: 'SAME_ORIGIN_AUTHENTICATED',
      rawTextRetained: false,
      rawAudioPersisted: false,
    },
  });
  assert.doesNotMatch(JSON.stringify({ timings, states }), /transcriptText|recognizedText|must never|observed-audio/u);
  producer.stop();
  assert.equal(pipeline.consumer, null);
  now = 5_000;
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
