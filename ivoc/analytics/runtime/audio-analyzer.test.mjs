import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePcmFrame } from './audio-analyzer.mjs';

test('real PCM analysis reports measured volume and fundamental frequency without affect claims', () => {
  const sampleRate = 16000;
  const samples = Float32Array.from({ length: 2048 }, (_, index) => 0.25 * Math.sin(2 * Math.PI * 200 * index / sampleRate));
  const output = analyzePcmFrame(samples, sampleRate, { nowMs: 1000, windowStartedAt: 0 });
  assert.equal(output.metrics.speaking, true);
  assert.ok(output.metrics.volume_dbfs > -20 && output.metrics.volume_dbfs < -5);
  assert.ok(output.metrics.pitch_hz > 180 && output.metrics.pitch_hz < 220);
  assert.equal('emotion' in output.metrics, false);
  assert.equal('confidence' in output.metrics, false);
});

test('silence becomes an explicit long pause instead of a fabricated score', () => {
  const output = analyzePcmFrame(new Float32Array(2048), 16000, { nowMs: 2500, speaking: false, silenceStartedAt: 0, windowStartedAt: 0 });
  assert.equal(output.metrics.speech_state, 'PAUSE_LONG');
  assert.equal(output.metrics.pitch_hz, null);
  assert.equal(output.metrics.volume_dbfs, -96);
});
