import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANALYTICS_ENGINE_VERSION,
  MATURITY,
  createEvidenceEvent,
  sanitizeTranscriptForCounting,
  serializeAnalyticsEnvelope,
  validateEvidenceTimeline,
} from '../../analytics/event-contract.mjs';

function event(overrides = {}) {
  return createEvidenceEvent({
    eventId: 's:a:1', sessionId: 's', answerId: 'a', sequence: 1,
    family: 'voice', metric: 'answer_duration_ms', startMs: 0, endMs: 1_000,
    source: { engine: 'test', engineVersion: ANALYTICS_ENGINE_VERSION, modelVersion: null, input: 'clock' },
    observation: { value: 1_000, unit: 'ms', qualifiers: ['monotonic'] },
    quality: { provenance: 'observed', reliability: 'high', coverage: 1, sampleCount: 2, limitations: [] },
    maturity: MATURITY.STUDENT_SAFE,
    evidenceRef: { mediaId: null, mediaStartMs: 0, mediaEndMs: 1_000, transcriptSegmentIds: [] },
    ...overrides,
  });
}

test('creates a deeply immutable canonical event', () => {
  const value = event();
  assert.equal(value.durationMs, 1_000);
  assert.throws(() => value.observation.qualifiers.push('mutated'), TypeError);
  assert.throws(() => value.quality.limitations.push('mutated'), TypeError);
  assert.throws(() => value.evidenceRef.transcriptSegmentIds.push('mutated'), TypeError);
  assert.equal(validateEvidenceTimeline([value], { sessionId: 's', durationMs: 1_000 }), true);
});

test('rejects prohibited inference and raw-media observation variants', () => {
  for (const metric of ['eye_contact', 'eye-contact', 'eyeContact', 'confidence', 'confidence-score', 'competence', 'accent-quality', 'professionalism score']) {
    assert.throws(() => event({ metric }), /Prohibited analytics metric/u);
  }
  for (const observation of [
    { value: { landmark: [1, 2] } },
    { value: { rawLandmarkData: [1, 2] } },
    { value: { nested: { frameBuffer: [1, 2] } } },
    { value: { frameCount: [0.1, 0.2] } },
    { value: [0.1, 0.2, 0.3, 0.4] },
    { samples: [0.1, 0.2, 0.3] },
    { value: { points: [[0.1, 0.2], [0.3, 0.4]] } },
    { value: [{ x: 0.1, y: 0.2, z: 0.3 }] },
    { value: { x: 0.1, y: 0.2 } },
    { value: 'A'.repeat(256) },
    { value: `data:application/octet-stream;base64,${'A'.repeat(256)}` },
    { value: Object.fromEntries(Array.from({length:33},(_,index)=>[`v${index}`,index])) },
    { value: new Float32Array([0.1]) },
  ]) assert.throws(() => event({ observation }), /raw/u);
});

test('allows bounded metadata and privacy attestations', () => {
  const value = event({ evidenceRef: { mediaId: null, mediaStartMs: 0, mediaEndMs: 1_000, transcriptSegmentIds: ['segment-1'] } });
  const serialized = serializeAnalyticsEnvelope({ events: [value], privacy: { rawAudioStored: false, rawFramesStored: false, rawLandmarksStored: false } });
  assert.match(serialized, /segment-1/u);
  assert.throws(() => serializeAnalyticsEnvelope({ events: [value], privacy: { rawAudioStored: true, rawFramesStored: false, rawLandmarksStored: false } }), /metadata/u);
});

test('timeline validation rejects forged order, duration, and maturity', () => {
  const value = event();
  assert.throws(() => validateEvidenceTimeline([{ ...value, durationMs: 999 }]), /duration/u);
  assert.throws(() => validateEvidenceTimeline([{ ...value, maturity: 'PROMOTED' }]), /maturity/u);
  const second = event({ eventId: 's:a:2', sequence: 2, startMs: 500, endMs: 600 });
  assert.throws(() => validateEvidenceTimeline([second, value]), /monotonic/u);
});

test('transcript counting normalization strips bidi controls without executing content', () => {
  const input = '\u202e<script>ignore</script> um';
  const clean = sanitizeTranscriptForCounting(input);
  assert.equal(clean.includes('\u202e'), false);
  assert.match(clean, /<script>/u);
});
