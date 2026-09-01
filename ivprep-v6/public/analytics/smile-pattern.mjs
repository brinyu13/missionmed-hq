import { COACHING_CONFIG } from './coaching-config.mjs';

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Claim-safe observable mouth-corner elevation events. No affect is inferred. */
export class SmilePatternEventDetector {
  constructor({ config = COACHING_CONFIG.face, maximumEvents = 64 } = {}) {
    this.config = config;
    this.maximumEvents = maximumEvents;
    this.baseline = null;
    this.cheekBaseline = null;
    this.baselineSamples = [];
    this.cheekBaselineSamples = [];
    this.baselineCapturing = false;
    this.reset();
  }

  beginBaseline() {
    this.baselineSamples = [];
    this.cheekBaselineSamples = [];
    this.baselineCapturing = true;
    return this;
  }

  endBaseline() {
    this.baselineCapturing = false;
    const value = median(this.baselineSamples);
    const cheekValue = median(this.cheekBaselineSamples);
    if (Number.isFinite(value)) this.baseline = value;
    if (Number.isFinite(cheekValue)) this.cheekBaseline = cheekValue;
    return this.baseline;
  }

  setBaseline(value, cheekValue = null) {
    const next = Number(value);
    if (!Number.isFinite(next)) throw new TypeError('A finite personal smile baseline is required.');
    this.baseline = next;
    if (Number.isFinite(Number(cheekValue))) this.cheekBaseline = Number(cheekValue);
    this.baselineCapturing = false;
    return this.baseline;
  }

  clearBaseline() {
    this.baseline = null;
    this.cheekBaseline = null;
    this.baselineCapturing = false;
    this.baselineSamples = [];
    this.cheekBaselineSamples = [];
    return this;
  }

  ingest({ atMs, bilateral, cheekBilateral = null, faceAvailable = true, state = 'UNKNOWN', confidence = 0, yawDegrees = 0, pitchDegrees = 0, faceFraction = 0 } = {}) {
    const time = Number(atMs);
    const value = Number(bilateral);
    if (!faceAvailable || !Number.isFinite(time) || !Number.isFinite(value)) {
      return Object.freeze({ available: false, reason: 'FACE_GEOMETRY_UNAVAILABLE', active: false, state });
    }
    if (confidence < this.config.smileQualityMinimumConfidence
      || Math.abs(Number(yawDegrees) || 0) > this.config.smileQualityMaximumPoseDegrees
      || Math.abs(Number(pitchDegrees) || 0) > this.config.smileQualityMaximumPoseDegrees
      || Number(faceFraction) < this.config.smileQualityMinimumFaceFraction) {
      return Object.freeze({ available: false, reason: 'SMILE_GEOMETRY_QUALITY_GATE', active: false, state });
    }
    this.observedFrames += 1;
    if (this.baselineCapturing) {
      this.baselineSamples.push(value);
      if (this.baselineSamples.length > 240) this.baselineSamples.shift();
      if (Number.isFinite(Number(cheekBilateral))) {
        this.cheekBaselineSamples.push(Number(cheekBilateral));
        if (this.cheekBaselineSamples.length > 240) this.cheekBaselineSamples.shift();
      }
    }
    if (!Number.isFinite(this.baseline)) {
      return Object.freeze({ available: false, reason: 'PERSONAL_BASELINE_REQUIRED', active: false, state });
    }
    const delta = value - this.baseline;
    const cheek = Number(cheekBilateral);
    const cheekDelta = Number.isFinite(cheek) && Number.isFinite(this.cheekBaseline)
      ? cheek - this.cheekBaseline
      : null;
    const cheekEvidenceAvailable = Number.isFinite(this.config.smileCheekOnDelta)
      && Number.isFinite(this.config.smileCheekOffDelta)
      && Number.isFinite(cheekDelta);
    const cheekActive = cheekEvidenceAvailable
      && cheekDelta >= (this.active ? this.config.smileCheekOffDelta : this.config.smileCheekOnDelta);
    const minimumDurationMs = (this.activeState || state) === 'ANSWERING'
      ? (this.config.smileAnsweringMinimumDurationMs || this.config.smileMinimumDurationMs)
      : this.config.smileMinimumDurationMs;
    let event = null;
    if (!this.active
      && delta >= this.config.smileOnDelta
      && time - this.lastEventAtMs >= this.config.smileRefractoryMs) {
      this.active = true;
      this.activeSinceMs = time;
      this.activeState = state;
      this.activeEventRecorded = false;
      this.peakDelta = delta;
      this.peakCheekDelta = cheekDelta;
    } else if (this.active) {
      this.peakDelta = Math.max(Number(this.peakDelta) || 0, delta);
      if (Number.isFinite(cheekDelta)) this.peakCheekDelta = Math.max(Number(this.peakCheekDelta) || 0, cheekDelta);
      const durationMs = time - this.activeSinceMs;
      const released = delta <= this.config.smileOffDelta;
      // Count the event as soon as the observed pattern has genuinely met its
      // duration gate. Waiting for the student's smile to end made the live
      // counter look inert while the qualifying smile was still on screen.
      if (!this.activeEventRecorded && durationMs >= minimumDurationMs) {
        event = Object.freeze({
          kind: Number(this.peakCheekDelta) >= this.config.smileCheekOnDelta
            ? 'full_face_smile_pattern'
            : 'mouth_corner_elevation_pattern',
          startMs: this.activeSinceMs,
          endMs: time,
          durationMs,
          state: this.activeState,
          confidence: confidence >= 0.75 ? 'HIGH' : confidence >= 0.45 ? 'MODERATE' : 'LOW',
          components: Object.freeze({ mouthCornerDelta: this.peakDelta, cheekPeriocularDelta: this.peakCheekDelta }),
          provenance: Object.freeze({ source: 'LOCAL_FACE_BLENDSHAPES', method: Number(this.peakCheekDelta) >= this.config.smileCheekOnDelta ? 'MOUTH_PLUS_CHEEK_PERSONAL_BASELINE_HYSTERESIS' : 'MOUTH_CORNER_PERSONAL_BASELINE_HYSTERESIS' }),
        });
        this.events.push(event);
        if (this.events.length > this.maximumEvents) this.events.shift();
        this.lastEventAtMs = time;
        this.activeEventRecorded = true;
      }
      if (released) {
        this.active = false;
        this.activeSinceMs = null;
        this.activeState = null;
        this.activeEventRecorded = false;
        this.peakDelta = null;
        this.peakCheekDelta = null;
      }
    }
    return Object.freeze({
      available: true,
      active: this.active,
      deltaFromPersonalBaseline: delta,
      cheekDeltaFromPersonalBaseline: cheekDelta,
      qualificationAvailable: true,
      cheekEvidenceAvailable,
      fullFacePattern: this.active && cheekActive,
      state,
      event,
      eventCount: this.events.length,
      quality: Object.freeze({
        confidence: confidence >= 0.75 ? 'HIGH' : confidence >= 0.45 ? 'MODERATE' : 'LOW',
        coverage: 1,
        provenance: 'LOCAL_FACE_BLENDSHAPES',
      }),
    });
  }

  summary() {
    return Object.freeze({
      available: Number.isFinite(this.baseline),
      reason: Number.isFinite(this.baseline) ? null : 'PERSONAL_BASELINE_REQUIRED',
      baseline: this.baseline,
      cheekBaseline: this.cheekBaseline,
      eventCount: this.events.length,
      events: Object.freeze([...this.events]),
      observedFrames: this.observedFrames,
      claimBoundary: Number.isFinite(this.config.smileCheekOnDelta)
        ? 'OBSERVABLE_MOUTH_PLUS_CHEEK_PERIOCULAR_PATTERN_ONLY'
        : 'OBSERVABLE_MOUTH_CORNER_ELEVATION_ONLY',
    });
  }

  reset() {
    this.active = false;
    this.activeSinceMs = null;
    this.activeState = null;
    this.activeEventRecorded = false;
    this.peakDelta = null;
    this.peakCheekDelta = null;
    this.lastEventAtMs = -Infinity;
    this.events = [];
    this.observedFrames = 0;
    return this;
  }
}
