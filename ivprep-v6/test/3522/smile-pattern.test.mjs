import test from 'node:test';
import assert from 'node:assert/strict';
import { SmilePatternEventDetector } from '../../public/analytics/smile-pattern.mjs';

test('smile-pattern event requires a personal baseline, hysteresis, duration, refractory, and state', () => {
  const detector = new SmilePatternEventDetector({
    config: {
      smileOnDelta: 0.15,
      smileOffDelta: 0.07,
      smileMinimumDurationMs: 300,
      smileRefractoryMs: 1_000,
    },
  });
  assert.equal(detector.ingest({ atMs: 0, bilateral: 0.1, state: 'SETUP', confidence: 0.9 }).available, false);
  detector.beginBaseline();
  for (let atMs = 0; atMs < 500; atMs += 100) detector.ingest({ atMs, bilateral: 0.1, state: 'SETUP', confidence: 0.9 });
  assert.equal(detector.endBaseline(), 0.1);
  assert.equal(detector.ingest({ atMs: 600, bilateral: 0.3, state: 'ANSWERING', confidence: 0.9 }).active, true);
  assert.equal(detector.ingest({ atMs: 800, bilateral: 0.18, state: 'ANSWERING', confidence: 0.9 }).active, true, 'hysteresis holds between thresholds');
  const ended = detector.ingest({ atMs: 1_000, bilateral: 0.1, state: 'ANSWERING', confidence: 0.9 });
  assert.equal(ended.event.kind, 'mouth_corner_elevation_pattern');
  assert.equal(ended.event.state, 'ANSWERING');
  assert.equal(ended.event.durationMs, 400);
  assert.equal(ended.event.provenance.method, 'PERSONAL_BASELINE_HYSTERESIS');
  detector.ingest({ atMs: 1_100, bilateral: 0.4, state: 'ANSWERING', confidence: 0.9 });
  assert.equal(detector.summary().eventCount, 1, 'refractory prevents immediate event start');
});

test('short mouth-corner elevation is not promoted to an event', () => {
  const detector = new SmilePatternEventDetector({
    config: { smileOnDelta: 0.1, smileOffDelta: 0.05, smileMinimumDurationMs: 300, smileRefractoryMs: 0 },
  });
  detector.beginBaseline();
  detector.ingest({ atMs: 0, bilateral: 0.1 });
  detector.endBaseline();
  detector.ingest({ atMs: 100, bilateral: 0.3, state: 'ANSWERING', confidence: 0.8 });
  const ended = detector.ingest({ atMs: 250, bilateral: 0.1, state: 'ANSWERING', confidence: 0.8 });
  assert.equal(ended.event, null);
  assert.equal(detector.summary().eventCount, 0);
});
