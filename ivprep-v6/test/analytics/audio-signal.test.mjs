import test from 'node:test';
import assert from 'node:assert/strict';

import { AudioSignalAnalyzer, measurePcmFrame } from '../../analytics/audio-signal.mjs';

function feed(analyzer, start, duration, rms, clippedFraction = 0) {
  for (let at = start; at < start + duration; at += 50) analyzer.ingest({ atMs: at, rms, peak: clippedFraction ? 1 : rms, clippedFraction });
}

test('PCM measurement reports exact RMS, peak, and clipping', () => {
  const known = measurePcmFrame(new Float32Array([0.5, -0.5, 0.5, -0.5]));
  assert.ok(Math.abs(known.rms - 0.5) < 1e-7);
  assert.equal(known.peak, 0.5);
  assert.equal(known.clippedFraction, 0);
  const clipped = measurePcmFrame(new Float32Array([1, 1, 1, 0, 0, 0]));
  assert.equal(clipped.clippedFraction, 0.5);
});

test('immediate speech is detected while steady mid-level noise is not', () => {
  const speech = new AudioSignalAnalyzer();speech.begin(0);feed(speech, 0, 2_000, 0.1);
  const speechResult = speech.finish(2_000);
  assert.equal(speechResult.responseStartLatencyMs, 0);
  assert.ok(speechResult.speechActiveRatio >= 0.8);
  const noise = new AudioSignalAnalyzer();noise.begin(0);feed(noise, 0, 2_000, 0.018);
  const noiseResult = noise.finish(2_000);
  assert.equal(noiseResult.responseStartLatencyMs, null);
  assert.equal(noiseResult.speechActiveRatio, 0);
});

test('reports only silence bounded by speech as a pause', () => {
  const analyzer = new AudioSignalAnalyzer();analyzer.begin(0);
  feed(analyzer, 0, 1_000, 0.1);feed(analyzer, 1_000, 1_200, 0.0001);feed(analyzer, 2_200, 1_000, 0.1);
  const result = analyzer.finish(3_200);
  assert.equal(result.pauseEpisodes.length, 1);
  assert.equal(result.pauseEpisodes[0].durationMs, 1_200);
  const trailing = new AudioSignalAnalyzer();trailing.begin(0);
  feed(trailing, 0, 1_000, 0.1);feed(trailing, 1_000, 5_000, 0.0001);
  assert.equal(trailing.finish(6_000).pauseEpisodes.length, 0);
});

test('aggregates clipping as sample fraction and enforces monotonic timestamps', () => {
  const analyzer = new AudioSignalAnalyzer();analyzer.begin(0);
  analyzer.ingest({ atMs: 0, rms: 0.1, peak: 1, clippedFraction: 0.01 });
  analyzer.ingest({ atMs: 50, rms: 0.1, peak: 0.1, clippedFraction: 0 });
  assert.equal(analyzer.finish(100).digitalClippingFraction, 0.005);
  const invalid = new AudioSignalAnalyzer();invalid.begin(100);
  assert.throws(() => invalid.ingest({ atMs: 99, rms: 0 }));
  invalid.ingest({ atMs: 100, rms: 0 });
  assert.throws(() => invalid.ingest({ atMs: 99, rms: 0 }));
});

test('audio begin and finish timestamps are finite and monotonic',()=>{
  assert.throws(()=>new AudioSignalAnalyzer().begin(Number.NaN),/finite/u);
  const analyzer=new AudioSignalAnalyzer();analyzer.begin(100);
  analyzer.ingest({atMs:100,rms:.01,peak:.01,clippedFraction:0});
  assert.throws(()=>analyzer.finish(Number.NaN),/finite/u);
  assert.throws(()=>analyzer.finish(99),/monotonic/u);
});

test('a visible-thread cadence gap cannot become a fabricated pause',()=>{
  const analyzer=new AudioSignalAnalyzer();analyzer.begin(0);
  feed(analyzer,0,1_000,.1);feed(analyzer,1_000,200,.0001);feed(analyzer,6_000,1_000,.1);
  const result=analyzer.finish(7_000);
  assert.equal(result.pauseEpisodes.length,0);
  assert.equal(result.samplingGapDetected,true);
  assert.deepEqual(result.samplingGaps,[{startMs:1_150,endMs:6_000,reason:'audio_cadence_gap'}]);
});

test('startup and trailing audio gaps are explicit',()=>{
  const startup=new AudioSignalAnalyzer();startup.begin(0);feed(startup,300,4_700,.1);
  assert.deepEqual(startup.finish(5_000).samplingGaps,[{startMs:0,endMs:300,reason:'audio_startup_gap'}]);
  const trailing=new AudioSignalAnalyzer();trailing.begin(0);feed(trailing,0,4_600,.1);
  assert.deepEqual(trailing.finish(5_000).samplingGaps,[{startMs:4_550,endMs:5_000,reason:'audio_trailing_gap'}]);
});

test('captured level is a VAD-independent aggregate of all analyzed windows',()=>{
  const analyzer=new AudioSignalAnalyzer();analyzer.begin(0);
  feed(analyzer,0,1_000,.1);feed(analyzer,1_000,9_000,.001);
  assert.equal(analyzer.finish(10_000).capturedLevelDbfs,-60);
});
