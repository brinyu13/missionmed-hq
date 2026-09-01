import assert from 'node:assert/strict';
import test from 'node:test';

import { NodDetector } from '../../public/analytics/nod-detector.mjs';

function establishRest(detector, state = 'ANSWERING') {
  for (let atMs = 0; atMs <= 1_000; atMs += 125) detector.ingest({ atMs, pitchDegrees: 0, state, targetFps: 8, confidence: 0.9 });
}

test('observable head-pitch cycles count during an answer as well as while listening', () => {
  const detector = new NodDetector({ minimumFps: 8, excursionDegrees: 5, returnToleranceDegrees: 3 });
  establishRest(detector, 'ANSWERING');
  detector.ingest({ atMs: 1_125, pitchDegrees: 8, state: 'ANSWERING', targetFps: 8, confidence: 0.9 });
  const result = detector.ingest({ atMs: 1_375, pitchDegrees: 0, state: 'ANSWERING', targetFps: 8, confidence: 0.9 });
  assert.equal(result.available, true);
  assert.equal(result.count, 1);
  assert.equal(result.event.type, 'HEAD_PITCH_CYCLE');
  assert.equal(result.event.state, 'ANSWERING');
  assert.equal(result.provenance.method, 'STATE_AWARE_HEAD_PITCH_CYCLE');
});

test('listening exposure remains a separate denominator for mentor interpretation', () => {
  const detector = new NodDetector({ minimumFps: 8 });
  detector.ingest({ atMs: 0, pitchDegrees: 0, state: 'LISTENING', targetFps: 8, confidence: 0.9 });
  const listening = detector.ingest({ atMs: 125, pitchDegrees: 0, state: 'LISTENING', targetFps: 8, confidence: 0.9 });
  const answering = detector.ingest({ atMs: 250, pitchDegrees: 0, state: 'ANSWERING', targetFps: 8, confidence: 0.9 });
  assert.equal(listening.eligibleListeningMs, 125);
  assert.equal(answering.eligibleListeningMs, 250);
});

test('a natural three-degree physical nod keeps a stable resting reference and counts', () => {
  const detector = new NodDetector({ minimumFps: 8 });
  establishRest(detector, 'ANSWERING');
  detector.ingest({ atMs: 1_125, pitchDegrees: 1.4, state: 'ANSWERING', targetFps: 8, confidence: 0.9 });
  detector.ingest({ atMs: 1_250, pitchDegrees: 3.8, state: 'ANSWERING', targetFps: 8, confidence: 0.9 });
  detector.ingest({ atMs: 1_375, pitchDegrees: 5.2, state: 'ANSWERING', targetFps: 8, confidence: 0.9 });
  const result = detector.ingest({ atMs: 1_625, pitchDegrees: 0.8, state: 'ANSWERING', targetFps: 8, confidence: 0.9 });
  assert.equal(result.count, 1);
  assert.equal(result.event.type, 'HEAD_PITCH_CYCLE');
});
