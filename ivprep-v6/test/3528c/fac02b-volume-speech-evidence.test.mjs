import test from 'node:test';
import assert from 'node:assert/strict';

import { advancedSpeechEvidence } from '../../public/analytics/browser-pipeline.mjs';

test('Silero remains the primary advanced-audio speech gate', () => {
  assert.deepEqual(
    advancedSpeechEvidence({
      sileroState: { speaking: true, probability: 0.9 },
      f0: { voiced: false, f0Hz: null, confidence: 0 },
    }),
    {
      speaking: true,
      sileroSpeaking: true,
      validatedPeriodicF0: false,
      method: 'SILERO_V5_LOCAL_ONNX',
    },
  );
});

test('validated periodic F0 rescues real voiced frames when Silero is late', () => {
  assert.deepEqual(
    advancedSpeechEvidence({
      sileroState: { speaking: false, probability: 0.2 },
      f0: { voiced: true, f0Hz: 168, confidence: 0.78 },
    }),
    {
      speaking: true,
      sileroSpeaking: false,
      validatedPeriodicF0: true,
      method: 'VALIDATED_PERIODIC_F0_RESCUE',
    },
  );
});

test('unvoiced, out-of-range, and low-confidence frames stay closed', () => {
  for (const f0 of [
    { voiced: false, f0Hz: null, confidence: 0 },
    { voiced: true, f0Hz: 40, confidence: 0.9 },
    { voiced: true, f0Hz: 700, confidence: 0.9 },
    { voiced: true, f0Hz: 168, confidence: 0.3 },
  ]) {
    const evidence = advancedSpeechEvidence({ sileroState: null, f0 });
    assert.equal(evidence.speaking, false);
    assert.equal(evidence.validatedPeriodicF0, false);
    assert.equal(evidence.method, 'NO_VALIDATED_SPEECH_EVIDENCE');
  }
});
