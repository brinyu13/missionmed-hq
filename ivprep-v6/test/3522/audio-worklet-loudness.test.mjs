import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioWorkletPcmCapture } from '../../public/analytics/audio-worklet-capture.mjs';
import { deriveKWeightingCoefficients, KWeightedLoudness } from '../../public/analytics/k-weighted-loudness.mjs';

function sineChunk({ sampleRate, amplitude = 0.08, frequency = 220 }) {
  return Float32Array.from(
    { length: Math.round(sampleRate / 10) },
    (_, index) => amplitude * Math.sin(2 * Math.PI * frequency * index / sampleRate),
  );
}

function feed(meter, samples, { speaking = true, chunks = 8 } = {}) {
  let result;
  for (let index = 0; index < chunks; index += 1) result = meter.ingest(samples, { speaking });
  return result;
}

test('AudioWorklet capture uses a self-only module, currentFrame timestamps, and disconnects cleanly', async () => {
  const calls = [];
  class FakeNode {
    constructor(context, name, options) {
      calls.push(['node', name, options.processorOptions.chunkSize]);
      this.port = {};
    }
    connect(sink) { calls.push(['node-connect', sink]); }
    disconnect() { calls.push(['node-disconnect']); }
  }
  const source = {
    connect: (node) => calls.push(['source-connect', node]),
    disconnect: (node) => calls.push(['source-disconnect', node]),
  };
  const sink = { id: 'non-playback-sink' };
  const context = {
    currentTime: 2,
    sampleRate: 48_000,
    audioWorklet: { addModule: async (url) => calls.push(['module', url]) },
  };
  let received = null;
  const capture = new AudioWorkletPcmCapture({ AudioWorkletNodeClass: FakeNode, onFrame: (frame) => { received = frame; } });
  await capture.start({ context, source, sink });
  capture.node.port.onmessage({ data: { type: 'pcm', frame: 98_400, sampleRate: 48_000, samples: new Float32Array(2048) } });
  assert.equal(received.atMs, 50);
  assert.equal(received.provenance.method, 'AUDIO_WORKLET_PCM');
  assert.match(calls.find((entry) => entry[0] === 'module')[1], /^\/iv-prep-on-call\/assets\//);
  capture.stop();
  assert(calls.some((entry) => entry[0] === 'node-disconnect'));
});

test('K-weighting derivation reproduces the specified 48 kHz coefficients', () => {
  const coefficients = deriveKWeightingCoefficients(48_000);
  const expectedPre = {
    b0: 1.53512485958697,
    b1: -2.69169618940638,
    b2: 1.19839281085285,
    a1: -1.69065929318241,
    a2: 0.73248077421585,
  };
  const expectedHighPass = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: -1.99004745483398,
    a2: 0.99007225036621,
  };
  for (const [name, expected] of Object.entries(expectedPre)) {
    assert(Math.abs(coefficients.preFilter[name] - expected) < 1e-12, `${name} pre-filter coefficient`);
  }
  for (const [name, expected] of Object.entries(expectedHighPass)) {
    assert(Math.abs(coefficients.highPass[name] - expected) < 1e-12, `${name} high-pass coefficient`);
  }
});

test('K-weighted loudness uses 400 ms blocks, VAD-gated speech, and actual sample-rate coefficients', () => {
  const samples48 = sineChunk({ sampleRate: 48_000 });
  const meter48 = new KWeightedLoudness({ sampleRate: 48_000 });
  feed(meter48, samples48, { speaking: false, chunks: 4 });
  assert.equal(meter48.summary().available, false);
  const result48 = feed(meter48, samples48, { speaking: true, chunks: 8 });
  assert.equal(result48.available, true);
  assert(Number.isFinite(result48.momentaryLufsK));
  assert(Number.isFinite(result48.shortTermLufsK));
  assert(Number.isFinite(result48.speechLufsK));
  assert.equal(result48.provenance.method, 'BS1770_K_WEIGHTING_RATE_DERIVED');

  const meter44 = new KWeightedLoudness({ sampleRate: 44_100 });
  const result44 = feed(meter44, sineChunk({ sampleRate: 44_100 }), { chunks: 8 });
  assert.equal(result44.available, true);
  assert.equal(result44.sampleRate, 44_100);

  const unsupported = new KWeightedLoudness({ sampleRate: 4_000 }).ingest(samples48, { speaking: true });
  assert.equal(unsupported.available, false);
  assert.equal(unsupported.reason, 'LUFS_K_SAMPLE_RATE_UNSUPPORTED');
});

test('speech loudness preserves amplitude deltas and ignores later non-speech silence', () => {
  const quiet = new KWeightedLoudness({ sampleRate: 48_000 });
  const loud = new KWeightedLoudness({ sampleRate: 48_000 });
  const quietResult = feed(quiet, sineChunk({ sampleRate: 48_000, amplitude: 0.05 }), { chunks: 10 });
  const loudResult = feed(loud, sineChunk({ sampleRate: 48_000, amplitude: 0.1 }), { chunks: 10 });
  assert(Math.abs((loudResult.speechLufsK - quietResult.speechLufsK) - 6.02) < 0.2);

  const speechMedian = quietResult.speechLufsK;
  feed(quiet, new Float32Array(4_800), { speaking: false, chunks: 12 });
  assert.equal(quiet.summary().speechLufsK, speechMedian);
});
