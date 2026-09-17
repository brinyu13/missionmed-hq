import test from 'node:test';
import assert from 'node:assert/strict';
import { PitchTrack } from '../../public/analytics/pitch-f0.mjs';

const voiced = (f0Hz) => ({ voiced: true, f0Hz, confidence: 0.9 });

test('pitch track VAD-gates voiced frames and keeps unvoiced conditions numeric-free', () => {
  const track = new PitchTrack({ minVoicedFrames: 3 });
  track.push(voiced(120), { speaking: false });
  track.push({ voiced: false, f0Hz: null, confidence: 0 }, { speaking: true });
  assert.equal(track.voicedFrameCount, 0);
  assert.equal(track.summary().available, false);
  assert.equal(track.summary().reason, 'INSUFFICIENT_VOICED_AUDIO');
});

test('fixed calibration median survives answer reset and anchors semitone register', () => {
  const track = new PitchTrack({ minVoicedFrames: 3 });
  [118, 120, 122].forEach((hz) => track.push(voiced(hz)));
  assert.equal(track.freezeCalibrationBaseline(), 120);
  track.reset();
  [238, 240, 242].forEach((hz) => track.push(voiced(hz)));
  const result = track.summary();
  assert.equal(result.referenceBasis, 'FIXED_PERSONAL_CALIBRATION_MEDIAN');
  assert.equal(result.referenceHz, 120);
  assert(Math.abs(result.relativeMedianSemitones - 12) < 0.1);
  assert(Number.isFinite(result.p10Semitones));
  assert(Number.isFinite(result.p90Semitones));
});

test('octave guard corrects an isolated doubled estimate without fabricating silence', () => {
  const track = new PitchTrack({ minVoicedFrames: 3, octaveGuardSemitones: 8 });
  track.push(voiced(120));
  track.push(voiced(240));
  track.push(voiced(121));
  const result = track.summary();
  assert.equal(result.available, true);
  assert.equal(result.octaveCorrections, 1);
  assert(result.maxHz < 130);
});
