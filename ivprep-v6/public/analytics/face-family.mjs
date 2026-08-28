// FACE delivery-intelligence family — registry-driven observable facial cartridges.
//
// Y1-Y2-CAM-V6-3504. The holistic worker already requests outputFaceBlendshapes and
// already reads faceBlendshapes[0].categories, but then collapsed the entire stream
// into one scalar via facialMovementRate() and discarded the rest. FACE was therefore
// a single Flight Recorder lane despite a dense facial signal being computed every
// frame. This module recovers that stream as a family of separate cartridges.
//
// CLAIM SAFETY IS THE POINT OF THIS FILE.
//
// Every detector reports observable movement or geometry. None of them infers, and
// none of them may be renamed to imply, emotion, affect, honesty, deception,
// authenticity, confidence, personality, intent, interest, engagement or clinical
// state. The vocabulary is deliberate:
//
//   "mouth corners elevated"      NOT "happy"
//   "periocular contraction"      NOT "genuine smile"
//   "gaze proxy moved off-centre" NOT "looked away to think"
//   "camera-facing dwell 92%"     NOT "good eye contact"
//
// Camera dwell in particular carries NO target. Continuous staring is not the goal;
// natural conversation includes gaze release. The detector reports the distribution
// and refuses to score it.
//
// Availability is honest per cartridge. A detector whose required blendshape channels
// are absent from the running model reports UNAVAILABLE rather than substituting a
// weaker proxy, so the Flight Recorder can never imply a measurement that did not
// happen.

import { SmilePatternEventDetector } from './smile-pattern.mjs';

export const FACE_AVAILABILITY = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  PARTIAL: 'PARTIAL',
  UNAVAILABLE: 'UNAVAILABLE',
});

// Activation thresholds on the 0..1 blendshape scale. Chosen to sit above resting
// anatomical noise; they gate EVENTS only, never the continuous value.
const SMILE_ON = 0.32;
const SMILE_OFF = 0.20;
const BLINK_ON = 0.55;
const BLINK_OFF = 0.30;
const BROW_ON = 0.28;
const SQUINT_ON = 0.25;
// Gaze proxy magnitude beyond which the face is treated as off-camera-centre.
const GAZE_OFF_CENTRE = 0.28;
const GAZE_SHIFT_MIN_MS = 120;

function categoryMap(categories) {
  const map = new Map();
  for (const entry of categories || []) {
    const name = entry?.categoryName ?? entry?.displayName;
    if (typeof name === 'string' && Number.isFinite(entry?.score)) map.set(name, entry.score);
  }
  return map;
}

const pick = (map, name) => (map.has(name) ? map.get(name) : null);
const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

function stdDev(values) {
  if (values.length < 2) return null;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
}

/**
 * One observable facial cartridge.
 *
 * `requires` lists the blendshape channels the detector genuinely needs. If any are
 * missing the cartridge is UNAVAILABLE and contributes nothing - it does not degrade
 * into a guess.
 */
class FaceCartridge {
  constructor({ id, label, requires, optional = [], derive, describeEvents = null }) {
    this.id = id;
    this.label = label;
    this.requires = requires;
    this.optional = optional;
    this.derive = derive;
    this.describeEvents = describeEvents;
    this.samples = [];
    this.events = [];
    this.state = false;
    this.stateSinceMs = null;
    this.baseline = null;
    this.availability = FACE_AVAILABILITY.UNAVAILABLE;
  }

  resolveAvailability(map) {
    const missing = this.requires.filter((name) => !map.has(name));
    if (missing.length) {
      this.availability = FACE_AVAILABILITY.UNAVAILABLE;
      this.missing = missing;
      return this.availability;
    }
    const missingOptional = this.optional.filter((name) => !map.has(name));
    this.availability = missingOptional.length ? FACE_AVAILABILITY.PARTIAL : FACE_AVAILABILITY.AVAILABLE;
    this.missing = missingOptional;
    return this.availability;
  }

  reset() {
    this.samples = [];
    this.events = [];
    this.state = false;
    this.stateSinceMs = null;
    return this;
  }
}

/** Hysteresis gate so a value hovering at a threshold cannot chatter events. */
function gate(cartridge, active, atMs, payload) {
  if (active && !cartridge.state) {
    cartridge.state = true;
    cartridge.stateSinceMs = atMs;
  } else if (!active && cartridge.state) {
    const durationMs = Number.isFinite(atMs) && Number.isFinite(cartridge.stateSinceMs)
      ? atMs - cartridge.stateSinceMs
      : null;
    cartridge.events.push(Object.freeze({ atMs: cartridge.stateSinceMs, durationMs, ...payload }));
    cartridge.state = false;
    cartridge.stateSinceMs = null;
  }
}

function buildRegistry() {
  return [
    new FaceCartridge({
      id: 'FACE.SMILE',
      label: 'Mouth-corner elevation',
      requires: ['mouthSmileLeft', 'mouthSmileRight'],
      derive(map, atMs) {
        const left = pick(map, 'mouthSmileLeft');
        const right = pick(map, 'mouthSmileRight');
        const bilateral = (left + right) / 2;
        // Symmetry is reported as observed geometry only. Asymmetry is anatomically
        // common and is never framed as a deficiency.
        const symmetry = 1 - Math.min(1, Math.abs(left - right));
        gate(this, bilateral >= (this.state ? SMILE_OFF : SMILE_ON), atMs, { kind: 'mouth_corner_elevation' });
        this.samples.push(bilateral);
        return { left, right, bilateral, symmetry, active: this.state };
      },
    }),

    new FaceCartridge({
      id: 'FACE.MOUTH_MOVEMENT',
      label: 'Mouth movement',
      requires: ['jawOpen'],
      optional: ['mouthPressLeft', 'mouthPressRight', 'mouthPucker'],
      derive(map, atMs) {
        const jawOpen = pick(map, 'jawOpen');
        const press = mean([pick(map, 'mouthPressLeft'), pick(map, 'mouthPressRight')].filter((v) => v !== null));
        this.samples.push(jawOpen);
        return { jawOpen, lipCompression: press, pucker: pick(map, 'mouthPucker') };
      },
    }),

    new FaceCartridge({
      id: 'FACE.EYE_APERTURE',
      label: 'Eye aperture',
      requires: ['eyeBlinkLeft', 'eyeBlinkRight'],
      optional: ['eyeWideLeft', 'eyeWideRight'],
      derive(map, atMs) {
        // Aperture is derived as the complement of closure, widened by eyeWide when
        // the model provides it. Normalised against the speaker's own baseline below,
        // because resting aperture is anatomical.
        const closure = mean([pick(map, 'eyeBlinkLeft'), pick(map, 'eyeBlinkRight')]);
        const wide = mean([pick(map, 'eyeWideLeft'), pick(map, 'eyeWideRight')].filter((v) => v !== null));
        const aperture = Math.max(0, Math.min(1, 1 - closure + (wide ?? 0) * 0.5));
        this.samples.push(aperture);
        const fromBaseline = this.baseline === null ? null : aperture - this.baseline;
        return {
          left: pick(map, 'eyeBlinkLeft') === null ? null : 1 - pick(map, 'eyeBlinkLeft'),
          right: pick(map, 'eyeBlinkRight') === null ? null : 1 - pick(map, 'eyeBlinkRight'),
          bilateral: aperture,
          changeFromBaseline: fromBaseline,
        };
      },
    }),

    new FaceCartridge({
      id: 'FACE.BLINK',
      label: 'Blink',
      requires: ['eyeBlinkLeft', 'eyeBlinkRight'],
      derive(map, atMs) {
        const left = pick(map, 'eyeBlinkLeft');
        const right = pick(map, 'eyeBlinkRight');
        const bilateral = (left + right) / 2;
        gate(this, bilateral >= (this.state ? BLINK_OFF : BLINK_ON), atMs, { kind: 'blink' });
        this.samples.push(bilateral);
        // Blink rate is descriptive evidence. It carries no target and is never
        // penalised by default.
        return { left, right, bilateral, closing: this.state, count: this.events.length };
      },
    }),

    new FaceCartridge({
      id: 'FACE.BROW',
      label: 'Brow movement',
      requires: ['browInnerUp'],
      optional: ['browDownLeft', 'browDownRight', 'browOuterUpLeft', 'browOuterUpRight'],
      derive(map, atMs) {
        const innerUp = pick(map, 'browInnerUp');
        const outerUp = mean([pick(map, 'browOuterUpLeft'), pick(map, 'browOuterUpRight')].filter((v) => v !== null));
        const down = mean([pick(map, 'browDownLeft'), pick(map, 'browDownRight')].filter((v) => v !== null));
        const raise = Math.max(innerUp, outerUp ?? 0);
        const magnitude = Math.max(raise, down ?? 0);
        gate(this, magnitude >= BROW_ON, atMs, { kind: raise >= (down ?? 0) ? 'brow_raise' : 'brow_lower' });
        this.samples.push(magnitude);
        const asymmetry = pick(map, 'browOuterUpLeft') !== null && pick(map, 'browOuterUpRight') !== null
          ? Math.abs(pick(map, 'browOuterUpLeft') - pick(map, 'browOuterUpRight'))
          : null;
        return { innerUp, outerUp, lower: down, raise, magnitude, asymmetry, active: this.state };
      },
    }),

    new FaceCartridge({
      id: 'FACE.PERIOCULAR',
      label: 'Periocular contraction',
      requires: ['eyeSquintLeft', 'eyeSquintRight'],
      derive(map, atMs) {
        // Eye-corner movement. Recorded as geometry ONLY. This detector must never be
        // combined with FACE.SMILE to assert a "genuine" or "authentic" smile - that
        // is an affect claim and is out of scope by law.
        const left = pick(map, 'eyeSquintLeft');
        const right = pick(map, 'eyeSquintRight');
        const bilateral = (left + right) / 2;
        gate(this, bilateral >= SQUINT_ON, atMs, { kind: 'periocular_contraction' });
        this.samples.push(bilateral);
        return { left, right, bilateral, active: this.state };
      },
    }),

    new FaceCartridge({
      id: 'FACE.GAZE',
      label: 'Camera-relative gaze proxy',
      requires: ['eyeLookOutLeft', 'eyeLookOutRight', 'eyeLookInLeft', 'eyeLookInRight'],
      optional: ['eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight'],
      derive(map, atMs) {
        // A PROXY, not literal eye-contact inference. Positive horizontal = the gaze
        // proxy favours the subject's right.
        const outL = pick(map, 'eyeLookOutLeft');
        const inL = pick(map, 'eyeLookInLeft');
        const outR = pick(map, 'eyeLookOutRight');
        const inR = pick(map, 'eyeLookInRight');
        const horizontal = ((outR - inR) + (inL - outL)) / 2;
        const up = mean([pick(map, 'eyeLookUpLeft'), pick(map, 'eyeLookUpRight')].filter((v) => v !== null));
        const down = mean([pick(map, 'eyeLookDownLeft'), pick(map, 'eyeLookDownRight')].filter((v) => v !== null));
        const vertical = up === null || down === null ? null : up - down;
        const offCentre = Math.max(Math.abs(horizontal), Math.abs(vertical ?? 0));
        const cameraFacing = offCentre < GAZE_OFF_CENTRE;
        this.samples.push(offCentre);
        // `estimator` rather than `confidence` so this can never be misread as a
        // statement about the speaker. It describes the method, not the person.
        return { horizontal, vertical, offCentreMagnitude: offCentre, cameraFacing, estimator: 'blendshape_proxy' };
      },
    }),
  ];
}

/**
 * FACE family runtime.
 *
 * Feed it the blendshape categories the holistic worker already produces. It returns
 * a per-cartridge live frame and can summarise a session, including camera-facing
 * dwell and gaze-shift events derived from the gaze proxy.
 */
export class FaceFamily {
  #cartridges = buildRegistry();
  #smilePattern = new SmilePatternEventDetector();
  #baselineSamples = new Map();
  #baselineCapturing = false;
  #dwell = { facingMs: 0, awayMs: 0, longestFacingMs: 0, currentFacingMs: 0, releases: 0, returns: 0 };
  #gazeShifts = [];
  #lastAtMs = null;
  #lastRegion = null;
  #regionSinceMs = null;
  #frames = 0;

  get cartridges() { return this.#cartridges; }

  get ids() { return this.#cartridges.map((c) => c.id); }

  hasPersonalBaseline() { return Number.isFinite(this.#smilePattern.summary().baseline); }

  setPersonalBaseline(values = {}) {
    const mapping = {
      'FACE.SMILE': values.smileBaseline,
      'FACE.BROW': values.browBaseline,
      'FACE.PERIOCULAR': values.periocularBaseline,
    };
    for (const cartridge of this.#cartridges) {
      if (Number.isFinite(mapping[cartridge.id])) cartridge.baseline = Number(mapping[cartridge.id]);
    }
    if (Number.isFinite(values.smileBaseline)) {
      this.#smilePattern.setBaseline(values.smileBaseline, values.periocularBaseline);
    }
    this.#baselineCapturing = false;
    return this;
  }

  clearPersonalBaseline() {
    for (const cartridge of this.#cartridges) cartridge.baseline = null;
    this.#smilePattern.clearBaseline();
    this.#baselineCapturing = false;
    this.#baselineSamples.clear();
    return this;
  }

  /** Capture a personal baseline so anatomical differences are not scored. */
  beginBaseline() {
    this.#baselineCapturing = true;
    this.#baselineSamples.clear();
    this.#smilePattern.beginBaseline();
    return this;
  }

  endBaseline() {
    this.#baselineCapturing = false;
    for (const cartridge of this.#cartridges) {
      const samples = this.#baselineSamples.get(cartridge.id);
      if (samples?.length) cartridge.baseline = mean(samples);
    }
    this.#smilePattern.endBaseline();
    return this;
  }

  /**
   * @param {Array} categories faceBlendshapes[0].categories from the holistic worker
   * @param {number} atMs session clock
   */
  update(categories, atMs, { state = 'UNKNOWN', confidence = 0.75, yawDegrees = 0, pitchDegrees = 0, faceFraction = 0 } = {}) {
    const map = categoryMap(categories);
    if (!map.size) {
      this.#lastAtMs = atMs;
      return Object.freeze({ available: false, reason: 'NO_FACE_BLENDSHAPES', frames: this.#frames });
    }
    this.#frames += 1;
    const deltaMs = this.#lastAtMs === null || !Number.isFinite(atMs) ? 0 : Math.max(0, atMs - this.#lastAtMs);
    const frame = {};

    for (const cartridge of this.#cartridges) {
      const availability = cartridge.resolveAvailability(map);
      if (availability === FACE_AVAILABILITY.UNAVAILABLE) {
        frame[cartridge.id] = Object.freeze({
          availability, missing: cartridge.missing, reason: 'MODEL_CHANNELS_ABSENT',
        });
        continue;
      }
      const value = cartridge.derive(map, atMs);
      if (this.#baselineCapturing) {
        const list = this.#baselineSamples.get(cartridge.id) || [];
        const latest = cartridge.samples.at(-1);
        if (Number.isFinite(latest)) list.push(latest);
        this.#baselineSamples.set(cartridge.id, list);
      }
      frame[cartridge.id] = Object.freeze({ availability, ...value });
    }

    const smile = frame['FACE.SMILE'];
    const cheekPeriocular = frame['FACE.PERIOCULAR'];
    const smilePattern = this.#smilePattern.ingest({
      atMs,
      bilateral: smile?.bilateral,
      cheekBilateral: cheekPeriocular?.bilateral,
      faceAvailable: smile?.availability !== FACE_AVAILABILITY.UNAVAILABLE,
      state,
      confidence,
      yawDegrees,
      pitchDegrees,
      faceFraction,
    });
    this.#trackGaze(frame['FACE.GAZE'], atMs, deltaMs);
    this.#lastAtMs = atMs;
    return Object.freeze({ available: true, atMs, frames: this.#frames, ...frame, smilePattern });
  }

  #trackGaze(gaze, atMs, deltaMs) {
    if (!gaze || gaze.availability === FACE_AVAILABILITY.UNAVAILABLE) return;
    const region = gaze.cameraFacing ? 'CENTRE'
      : (Math.abs(gaze.horizontal) >= Math.abs(gaze.vertical ?? 0)
        ? (gaze.horizontal > 0 ? 'RIGHT' : 'LEFT')
        : (gaze.vertical > 0 ? 'UP' : 'DOWN'));

    if (gaze.cameraFacing) {
      this.#dwell.facingMs += deltaMs;
      this.#dwell.currentFacingMs += deltaMs;
      this.#dwell.longestFacingMs = Math.max(this.#dwell.longestFacingMs, this.#dwell.currentFacingMs);
    } else {
      this.#dwell.awayMs += deltaMs;
      this.#dwell.currentFacingMs = 0;
    }

    if (region !== this.#lastRegion) {
      const durationMs = this.#regionSinceMs === null ? null : atMs - this.#regionSinceMs;
      if (this.#lastRegion !== null && durationMs !== null && durationMs >= GAZE_SHIFT_MIN_MS) {
        this.#gazeShifts.push(Object.freeze({
          atMs: this.#regionSinceMs, durationMs, from: this.#lastRegion, to: region,
        }));
        if (this.#lastRegion === 'CENTRE') this.#dwell.releases += 1;
        if (region === 'CENTRE') this.#dwell.returns += 1;
      }
      this.#lastRegion = region;
      this.#regionSinceMs = atMs;
    }
  }

  /**
   * Session summary. Camera dwell is reported WITHOUT a target: 100% dwell is not
   * presented as ideal, and no "maximise eye contact" guidance is derived here.
   */
  summary() {
    const perCartridge = {};
    for (const cartridge of this.#cartridges) {
      perCartridge[cartridge.id] = Object.freeze({
        label: cartridge.label,
        availability: cartridge.availability,
        eventCount: cartridge.events.length,
        events: Object.freeze(cartridge.events.slice(-64)),
        movementRange: cartridge.samples.length
          ? Math.max(...cartridge.samples) - Math.min(...cartridge.samples)
          : null,
        variability: stdDev(cartridge.samples),
        baseline: cartridge.baseline,
      });
    }

    const totalMs = this.#dwell.facingMs + this.#dwell.awayMs;
    const dwell = totalMs > 0
      ? Object.freeze({
        available: true,
        cameraFacingRatio: this.#dwell.facingMs / totalMs,
        offCameraRatio: this.#dwell.awayMs / totalMs,
        longestFacingRunMs: this.#dwell.longestFacingMs,
        gazeReleases: this.#dwell.releases,
        gazeReturns: this.#dwell.returns,
        // Stated explicitly so no downstream surface invents a target.
        target: null,
        note: 'Distribution only. Continuous camera-facing dwell is not a goal; natural conversation includes gaze release.',
      })
      : Object.freeze({ available: false, reason: 'NO_GAZE_PROXY' });

    return Object.freeze({
      frames: this.#frames,
      cartridges: Object.freeze(perCartridge),
      cameraDwell: dwell,
      gazeShifts: Object.freeze(this.#gazeShifts.slice(-64)),
      smilePattern: this.#smilePattern.summary(),
      movementVariability: this.#movementVariability(),
    });
  }

  /** Bounded aggregate of observable facial motion. Explicitly not a personality score. */
  #movementVariability() {
    const contributors = this.#cartridges
      .filter((c) => c.availability !== FACE_AVAILABILITY.UNAVAILABLE && c.samples.length > 1)
      .map((c) => ({ id: c.id, variability: stdDev(c.samples) }))
      .filter((c) => Number.isFinite(c.variability));
    if (!contributors.length) return Object.freeze({ available: false, reason: 'NO_CONTRIBUTORS' });
    return Object.freeze({
      available: true,
      value: mean(contributors.map((c) => c.variability)),
      // Coverage stays visible so a thin sample cannot masquerade as a full reading.
      coverage: contributors.length / this.#cartridges.length,
      contributors: Object.freeze(contributors),
    });
  }

  reset() {
    for (const cartridge of this.#cartridges) cartridge.reset();
    this.#dwell = { facingMs: 0, awayMs: 0, longestFacingMs: 0, currentFacingMs: 0, releases: 0, returns: 0 };
    this.#gazeShifts = [];
    this.#lastAtMs = null;
    this.#lastRegion = null;
    this.#regionSinceMs = null;
    this.#frames = 0;
    this.#smilePattern.reset();
    return this;
  }
}

/** Flight Recorder grouping: FACE is a family, not a single lane. */
export const FACE_FLIGHT_RECORDER_GROUP = Object.freeze({
  id: 'FACE',
  label: 'Face',
  lanes: Object.freeze([
    Object.freeze({ id: 'FACE.SMILE', label: 'Smile' }),
    Object.freeze({ id: 'FACE.MOUTH_MOVEMENT', label: 'Mouth' }),
    Object.freeze({ id: 'FACE.EYE_APERTURE', label: 'Eyes' }),
    Object.freeze({ id: 'FACE.BLINK', label: 'Blink' }),
    Object.freeze({ id: 'FACE.BROW', label: 'Brows' }),
    Object.freeze({ id: 'FACE.PERIOCULAR', label: 'Periocular' }),
    Object.freeze({ id: 'FACE.GAZE', label: 'Gaze' }),
    Object.freeze({ id: 'FACE.CAMERA_DWELL', label: 'Camera dwell' }),
    Object.freeze({ id: 'FACE.GAZE_SHIFT', label: 'Gaze shifts' }),
    Object.freeze({ id: 'FACE.MOVEMENT_VARIABILITY', label: 'Movement' }),
  ]),
});

// Affect/trait vocabulary that must never appear as a FACE detector label or output.
// Asserted by test against the executable surface of this module.
//
// Note on "confidence": the affect claim "confident" is forbidden, but STATISTICAL
// confidence is a legitimate and required field elsewhere in Delivery Intelligence
// (the F0 cartridge reports one). The list therefore bans the trait adjective and not
// the statistical noun, and this module avoids the noun entirely on face outputs to
// remove the ambiguity at the source.
export const FORBIDDEN_FACE_CLAIMS = Object.freeze([
  'happy', 'happiness', 'sad', 'sadness', 'anxious', 'anxiety', 'confident',
  'honest', 'honesty', 'deception', 'deceptive', 'authentic', 'authenticity', 'genuine',
  'personality', 'intent', 'interested', 'engagement', 'emotion', 'mood', 'feeling',
]);
