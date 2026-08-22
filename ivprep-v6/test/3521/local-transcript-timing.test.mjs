import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  LOCAL_TRANSCRIPT_TIMING_SOURCE,
  LocalTranscriptTimingProducer,
} from '../../public/live-analytics/local-transcript-timing.mjs';

const response = (payload, ok = true) => ({ ok, async json() { return payload; } });

class FakeMediaStream {
  constructor(tracks) { this.tracks = tracks; }
  getAudioTracks() { return this.tracks; }
}

class FakeMediaRecorder {
  static instances = [];

  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    this.mimeType = 'audio/webm';
    FakeMediaRecorder.instances.push(this);
  }

  start() { this.state = 'recording'; }

  stop() {
    this.ondataavailable?.({ data: new Blob(['observed-audio'], { type: this.mimeType }) });
    this.state = 'inactive';
    this.onstop?.();
  }
}

function liveStream() {
  return { getAudioTracks: () => [{ kind: 'audio', readyState: 'live', enabled: true }] };
}

test('local timing producer emits only trusted aggregate observed timing', async () => {
  FakeMediaRecorder.instances = [];
  let now = 0;
  let scheduled = null;
  const calls = [];
  const timings = [];
  const states = [];
  const producer = new LocalTranscriptTimingProducer({
    MediaRecorderClass: FakeMediaRecorder,
    MediaStreamClass: FakeMediaStream,
    windowMs: 2_000,
    setTimeoutFn(callback) { scheduled = callback; return 1; },
    clearTimeoutFn() {},
    async fetchImpl(url, options) {
      calls.push({ url, options });
      if (options.method === 'GET') return response({
        available: true,
        source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS',
        persistence: 'MEMORY_ONLY',
        providerSessions: 0,
      });
      return response({
        available: true,
        source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS',
        wordCount: 8,
        firstWordStartMs: 400,
        lastWordEndMs: 1_900,
        providerSessions: 0,
        rawTextReturned: false,
        rawAudioPersisted: false,
      });
    },
  });

  assert.equal(await producer.start({
    stream: liveStream(),
    clock: { sessionMs: () => now },
    onTiming: (timing) => timings.push(timing),
    onState: (state) => states.push(state),
  }), true);
  now = 2_000;
  scheduled();
  await producer.queue;

  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.endsWith('/local-transcript-timing'), true);
  assert.equal(calls[1].options.credentials, 'same-origin');
  assert.equal(timings.length, 1);
  assert.deepEqual(timings[0], {
    atMs: 2_000,
    windowStartedAtMs: 400,
    windowEndedAtMs: 1_900,
    wordCount: 8,
    provenance: {
      kind: 'OBSERVED_TRANSCRIPT_TIMING',
      observed: true,
      source: LOCAL_TRANSCRIPT_TIMING_SOURCE,
      engine: 'FASTER_WHISPER_LOCAL_SNAPSHOT',
      transport: 'LOOPBACK_SAME_ORIGIN',
      rawTextRetained: false,
      rawAudioPersisted: false,
    },
  });
  assert.doesNotMatch(JSON.stringify({ timings, states }), /transcriptText|recognizedText|observed-audio/u);
  producer.stop();
});

test('missing local sidecar fails closed before opening an audio recorder', async () => {
  FakeMediaRecorder.instances = [];
  const producer = new LocalTranscriptTimingProducer({
    MediaRecorderClass: FakeMediaRecorder,
    MediaStreamClass: FakeMediaStream,
    async fetchImpl() {
      return response({ available: false, reason: 'LOCAL_WHISPER_RUNTIME_NOT_CONFIGURED', providerSessions: 0 });
    },
  });
  assert.equal(await producer.start({
    stream: liveStream(),
    clock: { sessionMs: () => 0 },
    onTiming() {},
  }), false);
  assert.equal(producer.state.reason, 'LOCAL_WHISPER_RUNTIME_NOT_CONFIGURED');
  assert.equal(FakeMediaRecorder.instances.length, 0);
});

test('status capability must attest the exact local source and memory-only persistence', async () => {
  for (const payload of [
    { available: true, source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS', persistence: 'DISK', providerSessions: 0 },
    { available: true, source: 'UNTRUSTED_TIMING_ENGINE', persistence: 'MEMORY_ONLY', providerSessions: 0 },
  ]) {
    const producer = new LocalTranscriptTimingProducer({
      MediaRecorderClass: FakeMediaRecorder,
      MediaStreamClass: FakeMediaStream,
      async fetchImpl() { return response(payload); },
    });
    assert.equal(await producer.start({
      stream: liveStream(),
      clock: { sessionMs: () => 0 },
      onTiming() {},
    }), false);
    assert.equal(producer.state.reason, 'LOCAL_TRANSCRIPT_SIDECAR_UNAVAILABLE');
  }
});

test('payloads that return raw text or omit aggregate provenance are rejected', async () => {
  let now = 0;
  let scheduled = null;
  const timings = [];
  const producer = new LocalTranscriptTimingProducer({
    MediaRecorderClass: FakeMediaRecorder,
    MediaStreamClass: FakeMediaStream,
    windowMs: 2_000,
    setTimeoutFn(callback) { scheduled = callback; return 1; },
    clearTimeoutFn() {},
    async fetchImpl(_url, options) {
      if (options.method === 'GET') return response({
        available: true,
        source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS',
        providerSessions: 0,
        persistence: 'MEMORY_ONLY',
      });
      return response({ available: true, wordCount: 20, providerSessions: 0, rawTextReturned: true, transcript: 'must be rejected' });
    },
  });
  await producer.start({ stream: liveStream(), clock: { sessionMs: () => now }, onTiming: (value) => timings.push(value) });
  now = 2_000;
  scheduled();
  await producer.queue;
  assert.equal(timings.length, 0);
  assert.equal(producer.state.reason, 'LOCAL_TRANSCRIPT_WINDOW_REJECTED');
  producer.stop();
});

test('payloads with undeclared fields are rejected even when rawTextReturned is false', async () => {
  let now = 0;
  let scheduled = null;
  const timings = [];
  const producer = new LocalTranscriptTimingProducer({
    MediaRecorderClass: FakeMediaRecorder,
    MediaStreamClass: FakeMediaStream,
    windowMs: 2_000,
    setTimeoutFn(callback) { scheduled = callback; return 1; },
    clearTimeoutFn() {},
    async fetchImpl(_url, options) {
      if (options.method === 'GET') return response({
        available: true,
        source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS',
        providerSessions: 0,
        persistence: 'MEMORY_ONLY',
      });
      return response({
        available: true,
        firstWordStartMs: 100,
        lastWordEndMs: 1_900,
        providerSessions: 0,
        rawAudioPersisted: false,
        rawTextReturned: false,
        source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS',
        transcript: 'must never cross the aggregate boundary',
        wordCount: 5,
      });
    },
  });
  await producer.start({ stream: liveStream(), clock: { sessionMs: () => now }, onTiming: (value) => timings.push(value) });
  now = 2_000;
  scheduled();
  await producer.queue;
  assert.equal(timings.length, 0);
  assert.equal(producer.state.reason, 'LOCAL_TRANSCRIPT_WINDOW_REJECTED');
  producer.stop();
});

test('stopping while the capability probe is pending cannot reactivate recording', async () => {
  FakeMediaRecorder.instances = [];
  let resolveProbe;
  const producer = new LocalTranscriptTimingProducer({
    MediaRecorderClass: FakeMediaRecorder,
    MediaStreamClass: FakeMediaStream,
    fetchImpl: () => new Promise((resolve) => { resolveProbe = resolve; }),
  });
  const started = producer.start({ stream: liveStream(), clock: { sessionMs: () => 0 }, onTiming() {} });
  producer.stop();
  resolveProbe(response({
    available: true,
    source: 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS',
    persistence: 'MEMORY_ONLY',
    providerSessions: 0,
  }));
  assert.equal(await started, false);
  assert.equal(producer.active, false);
  assert.equal(producer.state.reason, 'LOCAL_TRANSCRIPT_TIMING_IDLE');
  assert.equal(FakeMediaRecorder.instances.length, 0);
});

test('offline sidecar source cannot select providers, download models, persist audio, or return text', async () => {
  const python = await readFile(new URL('../../scripts/3521/local-whisper-timing.py', import.meta.url), 'utf8');
  const harness = await readFile(new URL('../../scripts/3521/start-live-analytics-harness.mjs', import.meta.url), 'utf8');
  assert.match(python, /local_files_only=True/u);
  assert.match(python, /EXPECTED_MODEL_BIN_SHA256 = "1a5afae06a4db91c975c9a9d78be5cc110ee4ea022ad57d55492e4550e936b2a"/u);
  assert.match(python, /io\.BytesIO\(audio_bytes\)/u);
  assert.match(python, /"rawTextReturned": False/u);
  assert.match(python, /"rawAudioPersisted": False/u);
  assert.doesNotMatch(python, /OpenAI|api\.openai\.com|NamedTemporaryFile|write_bytes/u);
  assert.match(harness, /HF_HUB_OFFLINE: '1'/u);
  assert.match(harness, /TRANSFORMERS_OFFLINE: '1'/u);
  assert.match(harness, /request\.headers\.origin !== sealedOrigin/u);
  assert.match(harness, /projectLocalTimingAggregate/u);
  assert.match(harness, /get available\(\)/u);
  assert.doesNotMatch(harness, /OPENAI_API_KEY/u);
});
