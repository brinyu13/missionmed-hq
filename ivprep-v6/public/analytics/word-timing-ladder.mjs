import { COACHING_CONFIG } from './coaching-config.mjs';

export const WORD_TIMING_TIERS = Object.freeze({
  A: 'BROWSER_WHISPER_TIMESTAMPED',
  A_PRIME: 'LOCAL_SHERPA_ONNX_TIMESTAMPED',
  B: 'LOCAL_SIDECAR_WORD_TIMESTAMPS',
  C: 'AUTHORIZED_CLOUD_WORD_TIMESTAMPS',
  D: 'ESTIMATED_SYLLABLE_RATE',
  E: 'VAD_ONLY',
  TEST: 'DETERMINISTIC_TEST_TIMESTAMPS',
});

const MEASURED_TIERS = new Set(['A', 'A_PRIME', 'B', 'C']);

function finite(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function frozen(value) {
  return Object.freeze(value);
}

function validWords(words, windowStart, windowEnd) {
  if (!Array.isArray(words)) return null;
  const safe = [];
  let priorStart = -Infinity;
  for (const word of words) {
    const start = finite(word?.startMs ?? word?.start);
    const end = finite(word?.endMs ?? word?.end);
    if (start === null || end === null || start < windowStart || end <= start || end > windowEnd || start < priorStart) return null;
    safe.push({ startMs: start, endMs: end, probability: finite(word?.probability ?? word?.prob) });
    priorStart = start;
  }
  return safe;
}

function unavailable(reason, tier, detail = {}) {
  return frozen({
    available: false,
    tier,
    wordsPerMinute: null,
    articulationWordsPerMinute: null,
    deliverySpeed: null,
    reason,
    ...detail,
  });
}

export function deriveDeliverySpeed(wordsPerMinute, corridor = {}, config = COACHING_CONFIG.deliverySpeed) {
  const wpm = finite(wordsPerMinute);
  const minimum = finite(corridor.minimum);
  const maximum = finite(corridor.maximum);
  if (wpm === null || minimum === null || maximum === null || minimum <= 0 || maximum <= minimum) return null;
  const highCap = maximum + config.highCapAdditionalWpm;
  let score;
  if (wpm < minimum) score = 70 * (wpm / minimum);
  else if (wpm <= maximum) score = 70 + 10 * ((wpm - minimum) / (maximum - minimum));
  else score = 80 + 20 * ((wpm - maximum) / (highCap - maximum));
  score = Number(clamp(score, 0, 100).toFixed(1));
  const zone = score < 35 ? 'PAUSE'
    : score < 70 ? 'SLOW'
      : score <= 80 ? 'CRUISE'
        : score < 95 ? 'ENERGIZE'
          : 'TOO_FAST';
  return frozen({ score, zone, corridor: frozen({ minimum, maximum }), highCap, presentationOnly: true });
}

export function evaluateWordTiming(evidence = {}, {
  allowDeterministicFixture = false,
  corridor = {
    minimum: COACHING_CONFIG.deliverySpeed.globalMinimumWpm,
    maximum: COACHING_CONFIG.deliverySpeed.globalMaximumWpm,
  },
  config = COACHING_CONFIG.deliverySpeed,
} = {}) {
  const provenance = evidence.provenance || {};
  const tier = String(provenance.tier || evidence.tier || 'E').toUpperCase();
  if (tier === 'D') return unavailable('ESTIMATED_SYLLABLE_RATE_IS_NOT_WPM', 'D', {
    estimatedSyllablesPerMinute: finite(evidence.estimatedSyllablesPerMinute),
  });
  const fixture = tier === 'TEST' || provenance.fixture === 'DETERMINISTIC_LOCAL_TEST_SIGNAL';
  const admittedTier = MEASURED_TIERS.has(tier) || (fixture && allowDeterministicFixture);
  if (!admittedTier || (MEASURED_TIERS.has(tier) && (provenance.observed !== true || provenance.wordTimestampsObserved !== true))) {
    return unavailable('NO_OBSERVED_WORD_TIMESTAMPS', tier, {
      missingDependency: 'APPROVED_LOCAL_TRANSCRIBER_WITH_WORD_TIMESTAMPS',
    });
  }
  const startMs = finite(evidence.windowStartedAtMs);
  const endMs = finite(evidence.windowEndedAtMs);
  if (startMs === null || endMs === null || endMs <= startMs) return unavailable('INVALID_WORD_TIMING_WINDOW', tier);
  const words = validWords(evidence.words, startMs, endMs);
  if (!words) return unavailable('PER_WORD_TIMESTAMPS_REQUIRED', tier);
  const claimedCount = Number.isInteger(evidence.wordCount) ? evidence.wordCount : words.length;
  if (claimedCount !== words.length) return unavailable('WORD_COUNT_TIMESTAMP_MISMATCH', tier);
  const speechDurationMs = finite(evidence.speechDurationMs);
  const coverage = finite(evidence.coverage);
  if (words.length < config.minimumWords) return unavailable('NEED_MORE_TIMED_WORDS', tier, { wordCount: words.length, minimumWords: config.minimumWords });
  if (speechDurationMs === null || speechDurationMs < config.minimumSpeechMs) return unavailable('NEED_MORE_SPEECH_TIME', tier, { speechDurationMs });
  if (coverage === null || coverage < config.minimumCoverage) return unavailable('INSUFFICIENT_WORD_TIMING_COVERAGE', tier, { coverage });
  const windowDurationMs = endMs - startMs;
  const wordsPerMinute = Number((words.length * 60_000 / windowDurationMs).toFixed(1));
  const articulationWordsPerMinute = Number((words.length * 60_000 / speechDurationMs).toFixed(1));
  return frozen({
    available: true,
    tier,
    fixture,
    wordsPerMinute,
    articulationWordsPerMinute,
    wordCount: words.length,
    speechDurationMs,
    coverage,
    startMs,
    endMs,
    deliverySpeed: deriveDeliverySpeed(articulationWordsPerMinute, corridor, config),
    provenance: frozen({
      source: provenance.source || WORD_TIMING_TIERS[tier] || 'UNKNOWN',
      method: fixture ? 'DETERMINISTIC_TEST_WORD_TIMESTAMPS' : 'OBSERVED_WORD_TIMESTAMPS',
      wordTimestampsObserved: !fixture,
      timingAccuracyValidated: !fixture && provenance.timingAccuracyValidated === true,
      observed: !fixture,
    }),
  });
}
