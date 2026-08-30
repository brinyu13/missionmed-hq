// Y1-Y2-CAM-V6-3522C — single source of truth for every behavior-intelligence
// threshold that the Fable specification marks [CALIBRATE]. The values below are
// engineering defaults, not population norms. Personal coaching corridors are
// derived from a speaker's own admitted calibration session.

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const COACHING_CONFIG_VERSION = '3526-p1.0';

export const COACHING_CONFIG = deepFreeze({
  version: COACHING_CONFIG_VERSION,
  calibrationStatus: 'CALIBRATE',
  audio: {
    setupSpeechMinimumMs: 3_000,
    setupMaximumMs: 30_000,
    speechAboveNoiseDb: 15,
    minimumSpeechDbfs: -45,
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
    adaptiveProfiles: {
      quiet: { positiveSpeechThreshold: 0.42, negativeSpeechThreshold: 0.25 },
      normal: { positiveSpeechThreshold: 0.52, negativeSpeechThreshold: 0.30 },
      noisy: { positiveSpeechThreshold: 0.68, negativeSpeechThreshold: 0.42 },
    },
    profileHysteresisMs: 2_000,
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
    smileCheekOnDelta: 0.12,
    smileCheekOffDelta: 0.06,
    smileMinimumDurationMs: 500,
    smileRefractoryMs: 8_000,
    smileAnsweringMinimumDurationMs: 700,
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
    chipHysteresisMs: 2_000,
    cameraHeightAdvisoryOnly: true,
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
    minimumRateSpeechMs: 15_000,
    rollingRateWindowMs: 45_000,
    personalMinimumPerMinute: 6,
    personalMaximumPerMinute: 14,
    faceBoxNormalizerK: 2.2,
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
    maximumSegmentMs: 5_000,
    utteranceOffsetPaddingMs: 300,
    emaTauMs: 3_000,
    holdBrightMs: 2_000,
    dimStepPercent: 20,
  },
  cues: {
    minimumDwellMs: 3_000,
    visibleMs: 3_000,
    refractoryMs: 10_000,
    maximumPerMinute: 2,
    trainingMaximumPerMinute: 3,
    maximumPerAnswer: 3,
    answerOpeningSuppressionMs: 3_000,
  },
  baseline: {
    staleAfterDays: 90,
    minimumCalibrationSpeechMs: 3_000,
  },
  scale: {
    corridorScoreMinimum: 7,
    corridorScoreMaximum: 8,
    maximumScore: 10,
    volumeCapAdditionalLu: 6,
    renderHz: 1,
    easeMs: 300,
    zonePillDwellMs: 2_000,
  },
  stateMachine: {
    speechHoldMs: 800,
    pauseShortMs: 250,
    pauseLongMs: 1_000,
    transitionDebounceMs: 300,
  },
  orientationChip: {
    dwellMs: 1_000,
    eyesAmberDwellMs: 5_000,
    listeningShareFlag: 0.50,
  },
  personLock: {
    graceMs: 5_000,
    scaleRatioMinimum: 0.42,
    scaleRatioMaximum: 2.40,
  },
  varietyScale: {
    pitchWeight: 0.70,
    loudnessWeight: 0.30,
    earlySessions: 2,
    minimumVoicedFrames: 50,
    defaultMinimumSemitones: 2.5,
    defaultMaximumSemitones: 4.5,
    highCapAdditionalSemitones: 3,
    loudnessMinimumRangeDb: 4,
    loudnessMaximumRangeDb: 10,
    loudnessHighCapAdditionalDb: 8,
  },
});

function finite(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

/** MissionMed Live Scale: the personal corridor is always the 7–8 coaching band. */
export function mapToLiveScale(value, minimum, maximum, cap) {
  const x = finite(value);
  const lo = finite(minimum);
  const hi = finite(maximum);
  const ceiling = finite(cap);
  if ([x, lo, hi, ceiling].some((item) => item === null)
    || !(lo > 0) || !(hi > lo) || !(ceiling > hi)) return null;
  const score = x < lo
    ? 7 * (x / lo)
    : x <= hi
      ? 7 + (x - lo) / (hi - lo)
      : 8 + 2 * (x - hi) / (ceiling - hi);
  return Number(Math.max(0, Math.min(10, score)).toFixed(1));
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
