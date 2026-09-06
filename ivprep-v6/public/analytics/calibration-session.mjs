import { COACHING_CONFIG } from './coaching-config.mjs';

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function finite(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function boundedPush(values, value, maximum = 1_200) {
  if (!Number.isFinite(value)) return;
  values.push(Number(value));
  if (values.length > maximum) values.shift();
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

/**
 * Guided, derived-only personal calibration. It never receives or retains PCM,
 * transcript text, pixels, landmarks, or blendshape arrays. Phase one is a stable
 * reading passage; phase two is a broader delivery fingerprint.
 */
export class CalibrationSession {
  constructor({ readingDurationMs = 45_000, fingerprintDurationMs = 120_000 } = {}) {
    this.readingDurationMs = readingDurationMs;
    this.fingerprintDurationMs = fingerprintDurationMs;
    this.reset();
  }

  reset(atMs = 0) {
    this.phase = 'READING_PASSAGE';
    this.phaseStartedAtMs = Number.isFinite(atMs) ? Number(atMs) : 0;
    this.completedAtMs = null;
    this.lastAudioAtMs = null;
    this.speechMs = 0;
    this.loudness = [];
    this.pitch = [];
    this.modulation = [];
    this.smile = [];
    this.brow = [];
    this.periocular = [];
    this.faceCoverage = [];
    this.wordsPerMinute = [];
    this.responseLatency = [];
    this.pauseDuration = [];
    return this.snapshot(atMs);
  }

  beginFingerprint(atMs) {
    if (this.phase === 'COMPLETE') return this.snapshot(atMs);
    this.phase = 'DELIVERY_FINGERPRINT';
    this.phaseStartedAtMs = Number.isFinite(atMs) ? Number(atMs) : this.phaseStartedAtMs;
    return this.snapshot(atMs);
  }

  #advance(atMs) {
    const elapsed = Math.max(0, Number(atMs) - this.phaseStartedAtMs);
    if (this.phase === 'READING_PASSAGE' && elapsed >= this.readingDurationMs) {
      this.beginFingerprint(atMs);
    } else if (this.phase === 'DELIVERY_FINGERPRINT' && elapsed >= this.fingerprintDurationMs) {
      this.phase = 'COMPLETE';
      this.completedAtMs = Number(atMs);
    }
  }

  ingestAudio({ atMs, speaking = false, loudness = {}, pitch = {} } = {}) {
    if (!Number.isFinite(atMs)) return this.snapshot(0);
    const deltaMs = this.lastAudioAtMs === null ? 0 : Math.max(0, Math.min(250, atMs - this.lastAudioAtMs));
    this.lastAudioAtMs = atMs;
    if (speaking) {
      this.speechMs += deltaMs;
      boundedPush(this.loudness, loudness.speechLufsK);
      boundedPush(this.modulation, loudness.modulationRangeLu);
      boundedPush(this.pitch, pitch.medianHz);
    }
    this.#advance(atMs);
    return this.snapshot(atMs);
  }

  ingestVision({ atMs, faceFamily = {}, faceFraction = null } = {}) {
    if (!Number.isFinite(atMs)) return this.snapshot(0);
    boundedPush(this.smile, faceFamily['FACE.SMILE']?.bilateral);
    boundedPush(this.brow, faceFamily['FACE.BROW']?.magnitude);
    boundedPush(this.periocular, faceFamily['FACE.PERIOCULAR']?.bilateral);
    boundedPush(this.faceCoverage, faceFraction);
    this.#advance(atMs);
    return this.snapshot(atMs);
  }

  ingestWordTiming(result = {}) {
    if (result.available === true) boundedPush(this.wordsPerMinute, result.wordsPerMinute, 120);
    return this.snapshot(result.windowEndedAtMs ?? this.phaseStartedAtMs);
  }

  ingestTurnMetrics(result = {}) {
    boundedPush(this.responseLatency, result.responseLatencyMs, 120);
    for (const duration of result.pauseDurationsMs || []) boundedPush(this.pauseDuration, duration, 240);
    return this.snapshot(result.atMs ?? this.phaseStartedAtMs);
  }

  derived() {
    if (this.phase !== 'COMPLETE' || this.speechMs < COACHING_CONFIG.baseline.minimumCalibrationSpeechMs) return null;
    const result = {
      speechLufsK: finite(median(this.loudness)),
      pitchMedianHz: finite(median(this.pitch)),
      modulationRangeLu: finite(median(this.modulation)),
      smileBaseline: finite(median(this.smile)),
      browBaseline: finite(median(this.brow)),
      periocularBaseline: finite(median(this.periocular)),
      faceCoverage: finite(median(this.faceCoverage)),
      wordsPerMinute: finite(median(this.wordsPerMinute)),
      responseLatencyMs: finite(median(this.responseLatency)),
      pauseDurationMs: finite(median(this.pauseDuration)),
    };
    return freeze(Object.fromEntries(Object.entries(result).filter(([, value]) => value !== null)));
  }

  snapshot(atMs = 0) {
    const derived = this.derived();
    return freeze({
      phase: this.phase,
      elapsedInPhaseMs: Math.max(0, Number(atMs) - this.phaseStartedAtMs),
      readingDurationMs: this.readingDurationMs,
      fingerprintDurationMs: this.fingerprintDurationMs,
      speechMs: this.speechMs,
      complete: Boolean(derived),
      reason: derived ? null : this.phase === 'COMPLETE' ? 'INSUFFICIENT_CALIBRATION_SPEECH' : 'CALIBRATION_IN_PROGRESS',
      derived,
      rawMediaRetained: false,
      provenance: { source: 'LOCAL_DERIVED_SIGNALS', method: 'TWO_PHASE_PERSONAL_CALIBRATION' },
    });
  }
}
