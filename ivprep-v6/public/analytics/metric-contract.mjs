const VALID_STATES = new Set([
  'SETUP', 'LISTENING', 'TRANSITION_TO_ANSWER', 'ANSWERING', 'PAUSE',
  'TRANSITION_TO_LISTENING', 'UNKNOWN',
  'NOTES',
]);

const VALID_CONFIDENCE = new Set(['HIGH', 'MODERATE', 'LOW', 'UNAVAILABLE']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function normalizedWindow({ startMs, endMs } = {}) {
  const start = Number(startMs);
  const end = Number(endMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new TypeError('Metric windows require finite, monotonic startMs/endMs.');
  }
  return { startMs: Math.round(start), endMs: Math.round(end) };
}

export function metricEnvelope({
  available = true,
  state = 'UNKNOWN',
  startMs,
  endMs,
  confidence = available ? 'MODERATE' : 'UNAVAILABLE',
  provenance,
  reason = null,
  values = {},
} = {}) {
  const window = normalizedWindow({ startMs, endMs });
  const normalizedState = VALID_STATES.has(state) ? state : 'UNKNOWN';
  if (!VALID_CONFIDENCE.has(confidence)) throw new TypeError(`Unsupported metric confidence: ${confidence}`);
  if (!provenance || typeof provenance !== 'object' || !provenance.source || !provenance.method) {
    throw new TypeError('Metric provenance requires source and method.');
  }
  if (available === false && Object.values(values).some(Number.isFinite)) {
    throw new TypeError('Unavailable metrics must not carry numeric presentation values.');
  }
  return deepFreeze({
    available: Boolean(available),
    state: normalizedState,
    startMs: window.startMs,
    endMs: window.endMs,
    confidence,
    provenance: {
      source: String(provenance.source),
      method: String(provenance.method),
      ...(provenance.tier ? { tier: String(provenance.tier) } : {}),
      ...(provenance.fixture === true ? { fixture: true } : {}),
    },
    ...(available ? values : { reason: String(reason || 'UNAVAILABLE') }),
  });
}

export function unavailableMetric(reason, context = {}) {
  return metricEnvelope({
    ...context,
    available: false,
    confidence: 'UNAVAILABLE',
    reason,
    values: {},
  });
}
