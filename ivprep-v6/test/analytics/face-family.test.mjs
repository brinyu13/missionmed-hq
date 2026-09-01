// Y1-Y2-CAM-V6-3504 — FACE family tests, including the claim-safety law.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  FACE_AVAILABILITY,
  FACE_FLIGHT_RECORDER_GROUP,
  FORBIDDEN_FACE_CLAIMS,
  FaceFamily,
} from '../../public/analytics/face-family.mjs';
import { SmilePatternEventDetector } from '../../public/analytics/smile-pattern.mjs';

/** Build a blendshape category list the way MediaPipe emits it. */
const cats = (values) => Object.entries(values).map(([categoryName, score]) => ({ categoryName, score }));

const NEUTRAL = {
  mouthSmileLeft: 0.02, mouthSmileRight: 0.02, jawOpen: 0.05,
  mouthPressLeft: 0.01, mouthPressRight: 0.01, mouthPucker: 0.01,
  eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05, eyeWideLeft: 0.0, eyeWideRight: 0.0,
  browInnerUp: 0.03, browOuterUpLeft: 0.02, browOuterUpRight: 0.02,
  browDownLeft: 0.0, browDownRight: 0.0,
  eyeSquintLeft: 0.02, eyeSquintRight: 0.02,
  eyeLookOutLeft: 0.05, eyeLookOutRight: 0.05, eyeLookInLeft: 0.05, eyeLookInRight: 0.05,
  eyeLookUpLeft: 0.02, eyeLookUpRight: 0.02, eyeLookDownLeft: 0.02, eyeLookDownRight: 0.02,
};

const frame = (overrides = {}) => cats({ ...NEUTRAL, ...overrides });

test('all ten FACE lanes are registered as a family, not one metric', () => {
  assert.equal(FACE_FLIGHT_RECORDER_GROUP.id, 'FACE');
  assert.equal(FACE_FLIGHT_RECORDER_GROUP.lanes.length, 10);
  const ids = FACE_FLIGHT_RECORDER_GROUP.lanes.map((l) => l.id);
  for (const required of ['FACE.SMILE', 'FACE.MOUTH_MOVEMENT', 'FACE.EYE_APERTURE', 'FACE.BLINK',
    'FACE.BROW', 'FACE.PERIOCULAR', 'FACE.GAZE', 'FACE.CAMERA_DWELL', 'FACE.GAZE_SHIFT',
    'FACE.MOVEMENT_VARIABILITY']) {
    assert.ok(ids.includes(required), `${required} lane missing`);
  }
});

test('a face with full blendshapes reports every cartridge available', () => {
  const family = new FaceFamily();
  const result = family.update(frame(), 1000);
  assert.equal(result.available, true);
  for (const id of family.ids) {
    assert.equal(result[id].availability, FACE_AVAILABILITY.AVAILABLE, `${id} should be available`);
  }
});

test('missing model channels report UNAVAILABLE instead of a weaker proxy', () => {
  const family = new FaceFamily();
  // A model without squint or gaze channels: periocular and gaze must fail closed.
  const reduced = cats({
    mouthSmileLeft: 0.4, mouthSmileRight: 0.4, jawOpen: 0.2,
    eyeBlinkLeft: 0.1, eyeBlinkRight: 0.1, browInnerUp: 0.1,
  });
  const result = family.update(reduced, 1000);
  assert.equal(result['FACE.SMILE'].availability, FACE_AVAILABILITY.AVAILABLE);
  assert.equal(result['FACE.PERIOCULAR'].availability, FACE_AVAILABILITY.UNAVAILABLE);
  assert.equal(result['FACE.PERIOCULAR'].reason, 'MODEL_CHANNELS_ABSENT');
  assert.equal(result['FACE.GAZE'].availability, FACE_AVAILABILITY.UNAVAILABLE);
  // Optional channels missing = PARTIAL, still honest.
  assert.equal(result['FACE.EYE_APERTURE'].availability, FACE_AVAILABILITY.PARTIAL);
  assert.equal(result['FACE.BROW'].availability, FACE_AVAILABILITY.PARTIAL);
});

test('no face blendshapes at all is reported, not silently zeroed', () => {
  const family = new FaceFamily();
  const result = family.update([], 500);
  assert.equal(result.available, false);
  assert.equal(result.reason, 'NO_FACE_BLENDSHAPES');
});

test('smile geometry activates, records events and reports symmetry', () => {
  const family = new FaceFamily();
  let t = 0;
  const step = (o) => { t += 40; return family.update(frame(o), t); };
  step();
  const smiling = step({ mouthSmileLeft: 0.7, mouthSmileRight: 0.6 });
  assert.equal(smiling['FACE.SMILE'].active, true);
  assert.ok(smiling['FACE.SMILE'].bilateral > 0.6);
  assert.ok(smiling['FACE.SMILE'].symmetry > 0.85, 'near-symmetric smile');
  // Asymmetric geometry is observed, never judged.
  const lopsided = step({ mouthSmileLeft: 0.8, mouthSmileRight: 0.2 });
  assert.ok(lopsided['FACE.SMILE'].symmetry < 0.5);
  // Hysteresis: dropping to between OFF and ON keeps it active (no chatter).
  const held = step({ mouthSmileLeft: 0.26, mouthSmileRight: 0.26 });
  assert.equal(held['FACE.SMILE'].active, true);
  step({ mouthSmileLeft: 0.02, mouthSmileRight: 0.02 });
  const summary = family.summary();
  assert.equal(summary.cartridges['FACE.SMILE'].eventCount, 1, 'one smile event with a duration');
  assert.ok(summary.cartridges['FACE.SMILE'].events[0].durationMs > 0);
  assert.equal(summary.cartridges['FACE.SMILE'].events[0].kind, 'mouth_corner_elevation');
});

test('a qualifying full-face smile increments while the smile is still visible', () => {
  const detector = new SmilePatternEventDetector();
  detector.beginBaseline();
  for (let atMs = 0; atMs < 1_000; atMs += 100) detector.ingest({
    atMs, bilateral: 0.05, cheekBilateral: 0.04, faceAvailable: true,
    state: 'LISTENING', confidence: 0.9, faceFraction: 0.3,
  });
  detector.endBaseline();
  detector.ingest({ atMs: 1_100, bilateral: 0.6, cheekBilateral: 0.3, faceAvailable: true, state: 'LISTENING', confidence: 0.9, faceFraction: 0.3 });
  const qualified = detector.ingest({ atMs: 1_700, bilateral: 0.62, cheekBilateral: 0.31, faceAvailable: true, state: 'LISTENING', confidence: 0.9, faceFraction: 0.3 });
  assert.equal(qualified.active, true);
  assert.equal(qualified.eventCount, 1);
  assert.equal(qualified.event.kind, 'full_face_smile_pattern');
  const stillSmiling = detector.ingest({ atMs: 1_900, bilateral: 0.64, cheekBilateral: 0.32, faceAvailable: true, state: 'LISTENING', confidence: 0.9, faceFraction: 0.3 });
  assert.equal(stillSmiling.eventCount, 1, 'one sustained smile must not double-count');
});

test('blink events are counted without any target or penalty', () => {
  const family = new FaceFamily();
  let t = 0;
  for (let i = 0; i < 5; i += 1) {
    t += 40; family.update(frame({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 }), t);
    t += 40; family.update(frame({ eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05 }), t);
  }
  const summary = family.summary();
  assert.equal(summary.cartridges['FACE.BLINK'].eventCount, 5);
  // Descriptive only: no "ideal" blink rate is exposed anywhere.
  assert.equal('target' in summary.cartridges['FACE.BLINK'], false);
});

test('periocular contraction is recorded as geometry and never fused into a smile verdict', async () => {
  const family = new FaceFamily();
  let t = 0;
  t += 40; family.update(frame({ eyeSquintLeft: 0.6, eyeSquintRight: 0.55, mouthSmileLeft: 0.7, mouthSmileRight: 0.7 }), t);
  const result = family.update(frame({ eyeSquintLeft: 0.02, eyeSquintRight: 0.02 }), t + 40);
  assert.equal(result['FACE.PERIOCULAR'].availability, FACE_AVAILABILITY.AVAILABLE);
  const summary = family.summary();
  assert.equal(summary.cartridges['FACE.PERIOCULAR'].eventCount, 1);
  assert.equal(summary.cartridges['FACE.PERIOCULAR'].events[0].kind, 'periocular_contraction');
  // The module must not contain any combined genuine/authentic smile inference.
  const source = await readFile(new URL('../../public/analytics/face-family.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /genuineSmile|authenticSmile|duchenne/iu);
});

test('gaze proxy tracks direction, dwell and shift events with no target', () => {
  const family = new FaceFamily();
  let t = 0;
  const hold = (o, times) => { for (let i = 0; i < times; i += 1) { t += 100; family.update(frame(o), t); } };

  hold({}, 10);                                                     // centre
  hold({ eyeLookOutRight: 0.8, eyeLookInLeft: 0.8 }, 5);            // to the subject's right
  hold({}, 8);                                                      // back to centre

  const summary = family.summary();
  const dwell = summary.cameraDwell;
  assert.equal(dwell.available, true);
  assert.ok(dwell.cameraFacingRatio > 0.5 && dwell.cameraFacingRatio < 1, `ratio ${dwell.cameraFacingRatio}`);
  assert.ok(dwell.offCameraRatio > 0);
  assert.ok(dwell.longestFacingRunMs > 0);
  assert.equal(dwell.gazeReleases, 1);
  assert.equal(dwell.gazeReturns, 1);
  // The law: dwell carries no target and says so.
  assert.equal(dwell.target, null);
  assert.match(dwell.note, /not a goal/iu);

  assert.ok(summary.gazeShifts.length >= 2, 'centre->right and right->centre');
  const shift = summary.gazeShifts[0];
  assert.equal(shift.from, 'CENTRE');
  assert.equal(shift.to, 'RIGHT');
  assert.ok(shift.durationMs >= 120);
});

test('a personal baseline normalises anatomy rather than scoring it', () => {
  const family = new FaceFamily();
  let t = 0;
  family.beginBaseline();
  // This speaker rests with narrower eyes; that must become their reference, not a fault.
  for (let i = 0; i < 10; i += 1) { t += 40; family.update(frame({ eyeBlinkLeft: 0.3, eyeBlinkRight: 0.3 }), t); }
  family.endBaseline();

  t += 40;
  const widened = family.update(frame({ eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05 }), t);
  assert.ok(widened['FACE.EYE_APERTURE'].changeFromBaseline > 0.1, 'widening relative to their own baseline');

  t += 40;
  const narrowed = family.update(frame({ eyeBlinkLeft: 0.55, eyeBlinkRight: 0.55 }), t);
  assert.ok(narrowed['FACE.EYE_APERTURE'].changeFromBaseline < 0, 'narrowing relative to their own baseline');
});

test('movement variability stays bounded and reports its coverage', () => {
  const family = new FaceFamily();
  let t = 0;
  for (let i = 0; i < 20; i += 1) {
    t += 40;
    family.update(frame({ jawOpen: i % 2 ? 0.6 : 0.05, mouthSmileLeft: i % 3 ? 0.4 : 0.02 }), t);
  }
  const mv = family.summary().movementVariability;
  assert.equal(mv.available, true);
  assert.ok(mv.value > 0);
  // Coverage must remain visible so a thin sample cannot look like a full reading.
  assert.ok(mv.coverage > 0 && mv.coverage <= 1);
  assert.ok(Array.isArray(mv.contributors) && mv.contributors.length > 0);
});

test('CLAIM SAFETY: no affect, honesty or personality vocabulary anywhere in the module', async () => {
  const source = await readFile(new URL('../../public/analytics/face-family.mjs', import.meta.url), 'utf8');
  // The prose in this module deliberately names the forbidden terms in order to forbid
  // them, so strip ALL comments (line and block) plus the forbidden-list literal, and
  // assert only the executable surface is clean.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n')
    .replace(/FORBIDDEN_FACE_CLAIMS = Object\.freeze\(\[[\s\S]*?\]\);/u, '');

  for (const term of FORBIDDEN_FACE_CLAIMS) {
    const pattern = new RegExp(`\\b${term}\\b`, 'iu');
    assert.doesNotMatch(code, pattern, `forbidden affect claim "${term}" appears in FACE code`);
  }

  // Labels the Founder will actually read must be observational.
  const family = new FaceFamily();
  family.update(frame(), 100);
  for (const cartridge of family.cartridges) {
    for (const term of FORBIDDEN_FACE_CLAIMS) {
      assert.doesNotMatch(cartridge.label, new RegExp(`\\b${term}\\b`, 'iu'), `${cartridge.id} label`);
    }
  }
  assert.equal(family.cartridges.find((c) => c.id === 'FACE.PERIOCULAR').label, 'Periocular contraction');
  assert.equal(family.cartridges.find((c) => c.id === 'FACE.SMILE').label, 'Mouth-corner elevation');
});

test('reset clears session state without losing the personal baseline', () => {
  const family = new FaceFamily();
  let t = 0;
  family.beginBaseline();
  for (let i = 0; i < 6; i += 1) { t += 40; family.update(frame(), t); }
  family.endBaseline();
  const baseline = family.cartridges.find((c) => c.id === 'FACE.EYE_APERTURE').baseline;
  assert.ok(Number.isFinite(baseline));

  t += 40; family.update(frame({ mouthSmileLeft: 0.8, mouthSmileRight: 0.8 }), t);
  family.reset();
  assert.equal(family.summary().frames, 0);
  assert.equal(family.summary().cartridges['FACE.SMILE'].eventCount, 0);
  assert.equal(family.cartridges.find((c) => c.id === 'FACE.EYE_APERTURE').baseline, baseline, 'baseline is anatomy, not session state');
});
