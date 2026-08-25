// Y1-Y2-CAM-V6-3522C — single source of truth for every behavior-intelligence
// threshold that the Fable specification marks [CALIBRATE]. The values below are
// engineering defaults, not population norms. Personal coaching corridors are
// derived from a speaker's own admitted calibration session.

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const COACHING_CONFIG_VERSION = '3522c-p0.1';

export const COACHING_CONFIG = deepFreeze({
  version: COACHING_CONFIG_VERSION,
  calibrationStatus: 'CALIBRATE',
  audio: {
    setupSpeechMinimumMs: 3_000,
    setupMaximumMs: 30_000,
    speechAboveNoiseDb: 10,
    clippingPeak: 0.99,
    clippingFractionWarning: 0.01,
    loudnessCorridorBelowBaselineLu: 6,
    loudnessCorridorAboveBaselineLu: 6,
    processedFlatEnvelopeStdLu: 1.5,
    modulationMinimumFrames: 12,
  },
  vad: {
    positiveSpeechThreshold: 0.60,
    negativeSpeechThreshold: 0.35,
    minimumSpeechMs: 250,
    redemptionMs: 400,
  },
  pitch: {
    minimumHz: 65,
    maximumHz: 420,
    minimumVoicedFrames: 8,
    octaveGuardSemitones: 8,
    corridorBelowBaselineSemitones: 5,
    corridorAboveBaselineSemitones: 5,
  },
  face: {
    smileOnDelta: 0.30,
    smileOffDelta: 0.18,
    smileMinimumDurationMs: 500,
    smileRefractoryMs: 500,
    smileQualityMinimumConfidence: 0.50,
    smileQualityMaximumPoseDegrees: 30,
    smileQualityMinimumFaceFraction: 0.15,
    blinkMinimumDurationMs: 70,
    blinkMaximumDurationMs: 400,
    activityWindowMs: 10_000,
    activityMinimumFrames: 8,
  },
  orientation: {
    towardScreenYawDegrees: 10,
    towardScreenPitchDegrees: 8,
    downPitchDegrees: 14,
    awayYawDegrees: 18,
    minimumConfidence: 0.45,
    smoothingFrames: 5,
    changeDwellMs: 350,
  },
  framing: {
    faceMinimumFraction: 0.22,
    faceMaximumFraction: 0.35,
    centerTargetX: 0.50,
    centerTargetY: 0.40,
    centerToleranceX: 0.10,
    centerToleranceY: 0.10,
    restPitchMaximumDegrees: 8,
  },
  gesture: {
    restShoulderWidthsPerSecond: 0.05,
    onsetShoulderWidthsPerSecond: 0.15,
    releaseShoulderWidthsPerSecond: 0.05,
    onsetDwellMs: 100,
    releaseDwellMs: 500,
    restDwellMs: 1_000,
    minimumDurationMs: 150,
    maximumDurationMs: 6_000,
    refractoryMs: 450,
    minimumHandsCoverage: 0.60,
  },
  deliverySpeed: {
    globalMinimumWpm: 140,
    globalMaximumWpm: 180,
    personalMinimumFactor: 0.92,
    personalMaximumFactor: 1.10,
    personalEnvelopeMinimumWpm: 110,
    personalEnvelopeMaximumWpm: 210,
    highCapAdditionalWpm: 60,
    minimumWords: 8,
    minimumSpeechMs: 3_000,
    minimumCoverage: 0.70,
    liveWindowMs: 10_000,
    trendWindowMs: 30_000,
    staleAfterMs: 8_000,
  },
  cues: {
    minimumDwellMs: 3_000,
    refractoryMs: 30_000,
    maximumPerMinute: 2,
    trainingMaximumPerMinute: 3,
    maximumPerAnswer: 3,
    answerOpeningSuppressionMs: 3_000,
  },
  baseline: {
    staleAfterDays: 90,
    minimumCalibrationSpeechMs: 3_000,
  },
});

function finite(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

/** Derives personal corridors only; it never returns universal ideal ranges. */
export function derivePersonalCorridors(baseline = {}) {
  const loudness = finite(baseline.speechLufsK);
  const pitchMedian = finite(baseline.pitchMedianHz);
  const pace = finite(baseline.wordsPerMinute);
  return deepFreeze({
    loudnessLufsK: loudness === null ? null : {
      minimum: loudness - COACHING_CONFIG.audio.loudnessCorridorBelowBaselineLu,
      maximum: loudness + COACHING_CONFIG.audio.loudnessCorridorAboveBaselineLu,
      basis: 'PERSONAL_CALIBRATION',
    },
    pitchHz: pitchMedian === null ? null : {
      minimum: pitchMedian * 2 ** (-COACHING_CONFIG.pitch.corridorBelowBaselineSemitones / 12),
      maximum: pitchMedian * 2 ** (COACHING_CONFIG.pitch.corridorAboveBaselineSemitones / 12),
      basis: 'PERSONAL_CALIBRATION',
    },
    wordsPerMinute: pace === null ? null : {
      minimum: Math.max(
        COACHING_CONFIG.deliverySpeed.personalEnvelopeMinimumWpm,
        Math.min(COACHING_CONFIG.deliverySpeed.personalEnvelopeMaximumWpm, pace * COACHING_CONFIG.deliverySpeed.personalMinimumFactor),
      ),
      maximum: Math.max(
        COACHING_CONFIG.deliverySpeed.personalEnvelopeMinimumWpm,
        Math.min(COACHING_CONFIG.deliverySpeed.personalEnvelopeMaximumWpm, pace * COACHING_CONFIG.deliverySpeed.personalMaximumFactor),
      ),
      basis: 'PERSONAL_CALIBRATION',
    },
  });
}
