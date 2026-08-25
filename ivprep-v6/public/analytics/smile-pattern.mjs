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
    this.baselineSamples = [];
    this.baselineCapturing = false;
    this.reset();
  }

  beginBaseline() {
    this.baselineSamples = [];
    this.baselineCapturing = true;
    return this;
  }

  endBaseline() {
    this.baselineCapturing = false;
    const value = median(this.baselineSamples);
    if (Number.isFinite(value)) this.baseline = value;
    return this.baseline;
  }

  setBaseline(value) {
    const next = Number(value);
    if (!Number.isFinite(next)) throw new TypeError('A finite personal smile baseline is required.');
    this.baseline = next;
    this.baselineCapturing = false;
    return this.baseline;
  }

  clearBaseline() {
    this.baseline = null;
    this.baselineCapturing = false;
    this.baselineSamples = [];
    return this;
  }

  ingest({ atMs, bilateral, faceAvailable = true, state = 'UNKNOWN', confidence = 0, yawDegrees = 0, pitchDegrees = 0, faceFraction = 0 } = {}) {
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
    }
    if (!Number.isFinite(this.baseline)) {
      return Object.freeze({ available: false, reason: 'PERSONAL_BASELINE_REQUIRED', active: false, state });
    }
    const delta = value - this.baseline;
    let event = null;
    if (!this.active && delta >= this.config.smileOnDelta && time - this.lastEventAtMs >= this.config.smileRefractoryMs) {
      this.active = true;
      this.activeSinceMs = time;
      this.activeState = state;
    } else if (this.active && delta <= this.config.smileOffDelta) {
      const durationMs = time - this.activeSinceMs;
      if (durationMs >= this.config.smileMinimumDurationMs) {
        event = Object.freeze({
          kind: 'mouth_corner_elevation_pattern',
          startMs: this.activeSinceMs,
          endMs: time,
          durationMs,
          state: this.activeState,
          confidence: confidence >= 0.75 ? 'HIGH' : confidence >= 0.45 ? 'MODERATE' : 'LOW',
          provenance: Object.freeze({ source: 'LOCAL_FACE_BLENDSHAPES', method: 'PERSONAL_BASELINE_HYSTERESIS' }),
        });
        this.events.push(event);
        if (this.events.length > this.maximumEvents) this.events.shift();
        this.lastEventAtMs = time;
      }
      this.active = false;
      this.activeSinceMs = null;
      this.activeState = null;
    }
    return Object.freeze({
      available: true,
      active: this.active,
      deltaFromPersonalBaseline: delta,
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
      eventCount: this.events.length,
      events: Object.freeze([...this.events]),
      observedFrames: this.observedFrames,
      claimBoundary: 'OBSERVABLE_MOUTH_CORNER_ELEVATION_ONLY',
    });
  }

  reset() {
    this.active = false;
    this.activeSinceMs = null;
    this.activeState = null;
    this.lastEventAtMs = -Infinity;
    this.events = [];
    this.observedFrames = 0;
    return this;
  }
}
