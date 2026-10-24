import { COACHING_CONFIG } from './coaching-config.mjs';

function distance(a, b) {
  return Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.y) - Number(b?.y));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export class GestureUnitDetector {
  constructor({ config = COACHING_CONFIG.gesture } = {}) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.prior = null;
    this.active = false;
    this.activeSinceMs = null;
    this.onsetCandidateAtMs = null;
    this.releaseCandidateAtMs = null;
    this.restSinceMs = null;
    this.lastEventAtMs = -Infinity;
    this.eventCount = 0;
    this.speakingFrames = 0;
    this.handsVisibleSpeakingFrames = 0;
    this.speakingDurationMs = 0;
    this.outOfRestSpeakingMs = 0;
    this.noiseSpeeds = [];
    this.energy = [];
    this.eventTimes = [];
  }

  ingest({ atMs, leftHand = null, rightHand = null, leftShoulder, rightShoulder, faceBox = null, speaking = false } = {}) {
    const time = Number(atMs);
    const observedShoulderWidth = distance(leftShoulder, rightShoulder);
    const faceNormalizedWidth = Number(faceBox?.width) * Number(this.config.faceBoxNormalizerK || 2.2);
    const shoulderWidth = observedShoulderWidth > 0.02
      ? observedShoulderWidth
      : Number.isFinite(faceNormalizedWidth) && faceNormalizedWidth > 0.02
        ? faceNormalizedWidth
        : 0;
    const visible = Boolean(leftHand || rightHand);
    const deltaMs = this.prior && time > this.prior.atMs ? Math.min(500, time - this.prior.atMs) : 0;
    if (speaking) {
      this.speakingFrames += 1;
      this.speakingDurationMs += deltaMs;
      if (visible) this.handsVisibleSpeakingFrames += 1;
    }
    let speed = null;
    if (this.prior && deltaMs > 0 && shoulderWidth > 0.02 && visible) {
      const distances = [];
      if (leftHand && this.prior.leftHand) distances.push(distance(leftHand, this.prior.leftHand));
      if (rightHand && this.prior.rightHand) distances.push(distance(rightHand, this.prior.rightHand));
      if (distances.length) speed = Math.max(...distances) / shoulderWidth / (deltaMs / 1_000);
    }
    if (speed !== null) {
      this.energy.push(speed);
      if (this.energy.length > 600) this.energy.shift();
      if (speed <= this.config.restShoulderWidthsPerSecond) {
        this.noiseSpeeds.push(speed);
        if (this.noiseSpeeds.length > 120) this.noiseSpeeds.shift();
      }
    }
    const onsetThreshold = Math.max(this.config.onsetShoulderWidthsPerSecond, 3 * median(this.noiseSpeeds));
    const atRest = speed !== null && speed <= this.config.restShoulderWidthsPerSecond;
    if (atRest) this.restSinceMs ??= time;
    else this.restSinceMs = null;
    const rested = this.restSinceMs !== null && time - this.restSinceMs >= this.config.restDwellMs;
    let event = null;
    if (!speaking || !visible) {
      this.onsetCandidateAtMs = null;
      this.releaseCandidateAtMs ??= this.active ? time : null;
    } else if (!this.active) {
      if (speed !== null && speed >= onsetThreshold && (this.onsetCandidateAtMs !== null || rested || this.prior?.rested)) this.onsetCandidateAtMs ??= time;
      else this.onsetCandidateAtMs = null;
      if (this.onsetCandidateAtMs !== null
        && time - this.onsetCandidateAtMs >= this.config.onsetDwellMs
        && time - this.lastEventAtMs >= this.config.refractoryMs) {
        this.active = true;
        this.activeSinceMs = this.onsetCandidateAtMs;
        this.onsetCandidateAtMs = null;
      }
    } else {
      if (atRest || speed === null) this.releaseCandidateAtMs ??= time;
      else this.releaseCandidateAtMs = null;
      const durationMs = time - this.activeSinceMs;
      const releaseReady = this.releaseCandidateAtMs !== null && time - this.releaseCandidateAtMs >= this.config.releaseDwellMs;
      if (releaseReady || durationMs >= this.config.maximumDurationMs || !speaking) {
        if (durationMs >= this.config.minimumDurationMs && durationMs <= this.config.maximumDurationMs) {
          this.eventCount += 1;
          this.lastEventAtMs = time;
          this.eventTimes.push(time);
          event = Object.freeze({ type: 'GESTURE_UNIT', startMs: this.activeSinceMs, endMs: time, durationMs, state: 'ANSWERING' });
        }
        this.active = false;
        this.activeSinceMs = null;
        this.releaseCandidateAtMs = null;
      }
    }
    if (speaking && visible && !atRest) this.outOfRestSpeakingMs += deltaMs;
    this.prior = { atMs: time, leftHand, rightHand, rested };
    const coverage = this.speakingFrames ? this.handsVisibleSpeakingFrames / this.speakingFrames : 0;
    const rollingWindowMs = Number(this.config.rollingRateWindowMs) || 45_000;
    this.eventTimes = this.eventTimes.filter((eventAtMs) => time - eventAtMs <= rollingWindowMs);
    const rateSpeechMs = Math.min(this.speakingDurationMs, rollingWindowMs);
    const rateAvailable = rateSpeechMs >= (Number(this.config.minimumRateSpeechMs) || 15_000)
      && coverage >= this.config.minimumHandsCoverage;
    const unitsPerSpeakingMinute = rateAvailable ? this.eventTimes.length * 60_000 / rateSpeechMs : null;
    const corridorState = !rateAvailable ? 'UNAVAILABLE'
      : unitsPerSpeakingMinute < this.config.personalMinimumPerMinute ? 'LOW'
        : unitsPerSpeakingMinute > this.config.personalMaximumPerMinute ? 'EXCESSIVE'
          : 'HEALTHY';
    return Object.freeze({
      active: this.active,
      speedShoulderWidthsPerSecond: speed,
      movementEnergyShoulderWidthsPerSecond: this.energy.length ? this.energy.reduce((sum, value) => sum + value, 0) / this.energy.length : null,
      onsetThresholdShoulderWidthsPerSecond: onsetThreshold,
      event,
      eventCount: this.eventCount,
      handsCoverage: coverage,
      speakingDurationMs: this.speakingDurationMs,
      rateAvailable,
      rollingEventCount: this.eventTimes.length,
      unitsPerSpeakingMinute,
      corridorState,
      corridor: Object.freeze({ minimum: this.config.personalMinimumPerMinute, maximum: this.config.personalMaximumPerMinute, basis: 'PERSONAL_TUNABLE_HEURISTIC' }),
      outOfRestSpeakingFraction: this.speakingDurationMs ? this.outOfRestSpeakingMs / this.speakingDurationMs : null,
      rateUnavailableReason: rateAvailable ? null : coverage < this.config.minimumHandsCoverage ? 'INSUFFICIENT_HANDS_COVERAGE' : 'INSUFFICIENT_SPEAKING_TIME',
      provenance: Object.freeze({
        source: 'LOCAL_HAND_GEOMETRY',
        method: observedShoulderWidth > 0.02
          ? 'SHOULDER_WIDTH_REST_CLUSTER_GESTURE_UNITS'
          : shoulderWidth > 0
            ? 'FACE_BOX_NORMALIZED_REST_CLUSTER_GESTURE_UNITS'
            : 'NORMALIZER_UNAVAILABLE',
      }),
    });
  }
}
