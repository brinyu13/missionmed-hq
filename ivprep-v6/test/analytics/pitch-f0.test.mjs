// Y1-Y2-CAM-V6-3504 — F0 cartridge validation against synthetic ground truth.
//
// The point of these tests is that the frequency is KNOWN, so accuracy is measurable
// rather than asserted. Speech-like signals use a harmonic stack, because a pure sine
// is an unrealistically easy case for any periodicity detector.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_CLARITY_THRESHOLD,
  F0_MAX_HZ,
  F0_MIN_HZ,
  PitchTrack,
  estimateF0,
  normalisedSquareDifference,
  semitonesFrom,
} from '../../public/analytics/pitch-f0.mjs';

const RATE = 48000;

/** Harmonic stack with decaying partials - a crude but fair glottal-source proxy. */
function voiced(f0, { rate = RATE, seconds = 0.06, harmonics = 6, amplitude = 0.3, noise = 0 } = {}) {
  const size = Math.round(rate * seconds);
  const out = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    const t = i / rate;
    let sample = 0;
    for (let h = 1; h <= harmonics; h += 1) sample += Math.sin(2 * Math.PI * f0 * h * t) / h;
    out[i] = sample * amplitude + (noise ? (Math.random() * 2 - 1) * noise : 0);
  }
  return out;
}

function whiteNoise(level = 0.25, { rate = RATE, seconds = 0.06 } = {}) {
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i += 1) out[i] = (Math.random() * 2 - 1) * level;
  return out;
}

test('NSDF is amplitude invariant and bounded', () => {
  const quiet = voiced(150, { amplitude: 0.02 });
  const loud = voiced(150, { amplitude: 0.9 });
  const a = normalisedSquareDifference(quiet, 400);
  const b = normalisedSquareDifference(loud, 400);
  for (const nsdf of [a, b]) {
    for (const value of nsdf) assert.ok(value >= -1.0001 && value <= 1.0001, `NSDF out of bounds: ${value}`);
  }
  // A tenfold amplitude change must not move the periodicity estimate.
  const peakA = a.indexOf(Math.max(...a.slice(100)));
  const peakB = b.indexOf(Math.max(...b.slice(100)));
  assert.equal(peakA, peakB, 'NSDF peak must be amplitude invariant');
});

test('F0 is accurate across the adult speech range', () => {
  // Low male through raised female, plus the declared boundaries.
  for (const truth of [80, 98, 110, 128, 147, 165, 196, 220, 262, 330, 440]) {
    const { f0Hz, voiced: isVoiced, confidence } = estimateF0(voiced(truth), RATE);
    assert.equal(isVoiced, true, `${truth}Hz should be voiced`);
    const centsError = Math.abs(1200 * Math.log2(f0Hz / truth));
    // 50 cents = a quarter tone. Well inside what speaker-relative coaching needs.
    assert.ok(centsError < 50, `${truth}Hz -> ${f0Hz.toFixed(2)}Hz is ${centsError.toFixed(1)} cents off`);
    assert.ok(confidence > DEFAULT_CLARITY_THRESHOLD, `${truth}Hz confidence ${confidence}`);
  }
});

test('no octave errors on a strong-harmonic voice', () => {
  // Octave halving/doubling is the classic autocorrelation failure. A missing
  // fundamental (harmonics from the 2nd up) is the hardest realistic case.
  for (const truth of [110, 147, 220]) {
    const { f0Hz } = estimateF0(voiced(truth, { harmonics: 10 }), RATE);
    const ratio = f0Hz / truth;
    assert.ok(Math.abs(ratio - 1) < 0.05, `${truth}Hz produced ${f0Hz.toFixed(1)}Hz (ratio ${ratio.toFixed(3)})`);
  }
});

test('F0 survives realistic additive noise', () => {
  const { f0Hz, voiced: isVoiced } = estimateF0(voiced(140, { noise: 0.05 }), RATE);
  assert.equal(isVoiced, true);
  assert.ok(Math.abs(1200 * Math.log2(f0Hz / 140)) < 80, `noisy estimate ${f0Hz?.toFixed(1)}Hz`);
});

test('silence, noise and unvoiced frames yield NO pitch, never a fabricated one', () => {
  const silence = new Float32Array(Math.round(RATE * 0.06));
  const quiet = estimateF0(silence, RATE);
  assert.equal(quiet.voiced, false);
  assert.equal(quiet.f0Hz, null, 'silence must not produce a frequency');

  // Broadband noise stands in for a fricative: aperiodic, so no F0.
  const noise = estimateF0(whiteNoise(0.3), RATE);
  assert.equal(noise.f0Hz, null, 'aperiodic audio must not produce a frequency');
  assert.equal(noise.voiced, false);

  // Room tone just above the floor must still be rejected as aperiodic.
  assert.equal(estimateF0(whiteNoise(0.01), RATE).f0Hz, null);
});

test('out-of-range and malformed input fail closed', () => {
  assert.equal(estimateF0(voiced(1000), RATE).f0Hz, null, 'above F0_MAX_HZ must not be claimed');
  assert.equal(estimateF0(voiced(30), RATE).f0Hz, null, 'below F0_MIN_HZ must not be claimed');
  assert.equal(estimateF0(null, RATE).voiced, false);
  assert.equal(estimateF0(voiced(150), 0).voiced, false);
  assert.equal(estimateF0(new Float32Array(8), RATE).voiced, false, 'a frame too short to span a period');
  assert.ok(F0_MIN_HZ < 100 && F0_MAX_HZ > 400, 'declared range must cover adult speech');
});

test('semitone maths is speaker-relative and symmetric', () => {
  assert.ok(Math.abs(semitonesFrom(220, 110) - 12) < 1e-9, 'an octave up is +12');
  assert.ok(Math.abs(semitonesFrom(110, 220) + 12) < 1e-9, 'an octave down is -12');
  assert.ok(Math.abs(semitonesFrom(150, 150)) < 1e-9, 'the median is 0');
  assert.equal(semitonesFrom(0, 150), null);
  assert.equal(semitonesFrom(150, 0), null);
});

test('PitchTrack withholds a summary until it has enough voiced audio', () => {
  const track = new PitchTrack();
  assert.equal(track.summary().available, false);
  assert.equal(track.summary().reason, 'INSUFFICIENT_VOICED_AUDIO');
  for (let i = 0; i < 5; i += 1) track.push(estimateF0(voiced(150), RATE));
  assert.equal(track.summary().available, false, 'must not emit an unstable early median');
});

test('monotone versus varied delivery produce materially different variation', () => {
  // This is the Founder acceptance test, in code: same speaker, same loudness, only
  // the pitch behaviour differs.
  const monotone = new PitchTrack();
  for (let i = 0; i < 40; i += 1) monotone.push(estimateF0(voiced(150), RATE));

  const varied = new PitchTrack();
  const contour = [120, 135, 150, 168, 190, 168, 150, 135];
  for (let i = 0; i < 40; i += 1) varied.push(estimateF0(voiced(contour[i % contour.length]), RATE));

  const flat = monotone.summary();
  const lively = varied.summary();
  assert.equal(flat.available, true);
  assert.equal(lively.available, true);

  assert.ok(flat.variationSemitones < 0.5, `monotone variation should collapse, got ${flat.variationSemitones}`);
  assert.ok(lively.variationSemitones > 2, `varied variation should rise, got ${lively.variationSemitones}`);
  assert.ok(lively.variationSemitones > flat.variationSemitones * 4, 'the two must be unmistakably different');

  // Range behaves the same way, and the median stays where the speaker actually is.
  assert.ok(flat.rangeSemitones < 0.5);
  assert.ok(lively.rangeSemitones > 5);
  assert.ok(Math.abs(flat.medianHz - 150) < 5, `median drifted: ${flat.medianHz}`);
});

test('sustained lower and higher speech move the median as a Founder would hear it', () => {
  const low = new PitchTrack();
  for (let i = 0; i < 30; i += 1) low.push(estimateF0(voiced(105), RATE));
  const high = new PitchTrack();
  for (let i = 0; i < 30; i += 1) high.push(estimateF0(voiced(210), RATE));

  const a = low.summary();
  const b = high.summary();
  assert.ok(a.medianHz < 120 && b.medianHz > 190, `${a.medianHz} / ${b.medianHz}`);
  // An octave apart, so ~12 semitones of separation.
  assert.ok(Math.abs(semitonesFrom(b.medianHz, a.medianHz) - 12) < 1.5);
});

test('unvoiced frames lower the voiced ratio without polluting pitch', () => {
  const track = new PitchTrack();
  for (let i = 0; i < 20; i += 1) track.push(estimateF0(voiced(160), RATE));
  for (let i = 0; i < 20; i += 1) track.push(estimateF0(whiteNoise(0.3), RATE));
  const summary = track.summary();
  assert.equal(summary.available, true);
  assert.ok(Math.abs(summary.medianHz - 160) < 8, `noise polluted the median: ${summary.medianHz}`);
  assert.ok(summary.voicedRatio > 0.4 && summary.voicedRatio < 0.6, `voicedRatio ${summary.voicedRatio}`);
});
