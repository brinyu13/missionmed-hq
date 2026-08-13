export const EVENT_SCHEMA = 'missionmed.ivprep.analytics.event.v1';
export const SESSION_SCHEMA = 'missionmed.ivprep.analytics.session.v1';
export const ANALYTICS_ENGINE_VERSION = '3420r-1.0.0';

export const EVENT_FAMILIES = Object.freeze([
  'voice',
  'pause',
  'gesture',
  'pose',
  'face',
  'framing',
  'system',
]);

export const MATURITY = Object.freeze({
  STUDENT_SAFE: 'VALIDATED_STUDENT_SAFE',
  FOUNDER_EXPERIMENTAL: 'FOUNDER_EXPERIMENTAL',
  REJECTED: 'REJECTED_UNRELIABLE',
});

export const PROVENANCE = Object.freeze(['observed', 'derived', 'inferred', 'unresolved']);
export const RELIABILITY = Object.freeze(['high', 'medium', 'low', 'unavailable']);

const PROHIBITED_METRIC_TERMS = Object.freeze([
  'anxiety',
  'accent_quality',
  'competence',
  'confidence',
  'confidence_score',
  'deception',
  'demographic',
  'emotion',
  'ethnicity',
  'eye_contact',
  'honesty',
  'identity',
  'intelligence',
  'match_probability',
  'personality',
  'professionalism_score',
  'program_fit',
  'readiness',
]);

const RAW_PAYLOAD_KEY = /(?:audio|bitmap|blendshape|embed|frame(?:buffer|data|s)?|image|landmark|pcm|pixel|vector)/iu;
const SAFE_MEDIA_METADATA_KEYS = Object.freeze(new Set([
  'analyzableframes', 'framecount', 'mediaendms', 'mediaid', 'mediastartms',
  'rawaudiostored', 'rawframesstored', 'rawlandmarksstored', 'transcriptsegmentids',
]));

function validSafeMediaMetadata(key, value) {
  if (['rawaudiostored', 'rawframesstored', 'rawlandmarksstored'].includes(key)) return value === false;
  if (['analyzableframes', 'framecount', 'mediaendms', 'mediastartms'].includes(key)) return Number.isFinite(value) && value >= 0;
  if (key === 'mediaid') return value === null || (typeof value === 'string' && value.length <= 96);
  if (key === 'transcriptsegmentids') return Array.isArray(value) && value.length <= 20 && value.every((item) => typeof item === 'string' && item.length <= 96);
  return false;
}

function boundedText(value, name, maximum = 160) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maximum) throw new TypeError(`${name} is missing or too long.`);
  return text;
}

function finiteInteger(value, name, minimum = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) throw new TypeError(`${name} must be finite and at least ${minimum}.`);
  return Math.round(number);
}

function assertNoRawPayload(value, path = 'value', state = { numericLeaves: 0, limitNumericLeaves: false }) {
  if (typeof value === 'string') {
    const compact = value.replace(/\s+/gu, '');
    if (state.limitNumericLeaves && (/(?:^data:.*;base64,)/iu.test(compact) || (compact.length >= 128 && /^(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(compact)))) {
      throw new TypeError(`${path} contains prohibited encoded raw material.`);
    }
    return;
  }
  if (typeof value === 'number') {
    state.numericLeaves += 1;
    if (state.limitNumericLeaves && state.numericLeaves > 32) throw new TypeError(`${path} contains too many numeric dimensions for compact raw-free analytics metadata.`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer || (typeof Blob !== 'undefined' && value instanceof Blob)) throw new TypeError(`${path} contains raw binary material.`);
  if (Array.isArray(value) && value.some((item) => typeof item === 'number' || Array.isArray(item) || (state.limitNumericLeaves && item && typeof item === 'object'))) throw new TypeError(`${path} contains a prohibited numeric/raw array.`);
  if (state.limitNumericLeaves && !Array.isArray(value) && Number.isFinite(value.x) && Number.isFinite(value.y)) throw new TypeError(`${path} contains prohibited raw coordinate material.`);
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/gu, '');
    if (RAW_PAYLOAD_KEY.test(normalized)) {
      if (SAFE_MEDIA_METADATA_KEYS.has(normalized)) {
        if (!validSafeMediaMetadata(normalized, child)) throw new TypeError(`${path}.${key} contains invalid raw-media metadata.`);
      } else if (child !== false && child !== null && child !== 0) {
        throw new TypeError(`${path}.${key} contains prohibited raw-media material.`);
      }
    }
    assertNoRawPayload(child, `${path}.${key}`, state);
  }
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function safeJson(value, name, maximumBytes = 2_000, { rejectRaw = false } = {}) {
  if (rejectRaw) assertNoRawPayload(value, name, { numericLeaves: 0, limitNumericLeaves: true });
  const serialized = JSON.stringify(value ?? null);
  if (serialized === undefined || byteLength(serialized) > maximumBytes) throw new TypeError(`${name} is not bounded JSON.`);
  return JSON.parse(serialized);
}

function normalizeEvidenceRef(value, startMs, endMs) {
  if (value === null || value === undefined) return null;
  const mediaId = value.mediaId === null || value.mediaId === undefined ? null : boundedText(value.mediaId, 'evidenceRef.mediaId', 96);
  const mediaStartMs = finiteInteger(value.mediaStartMs ?? startMs, 'evidenceRef.mediaStartMs');
  const mediaEndMs = finiteInteger(value.mediaEndMs ?? endMs, 'evidenceRef.mediaEndMs');
  if (mediaEndMs < mediaStartMs) throw new TypeError('Evidence reference ends before it starts.');
  const transcriptSegmentIds = Array.isArray(value.transcriptSegmentIds)
    ? value.transcriptSegmentIds.slice(0, 20).map((id) => boundedText(id, 'transcriptSegmentId', 96))
    : [];
  return deepFreeze({ mediaId, mediaStartMs, mediaEndMs, transcriptSegmentIds });
}

export function createEvidenceEvent({
  eventId,
  sessionId,
  answerId = null,
  sequence,
  family,
  metric,
  startMs,
  endMs = startMs,
  source,
  observation,
  quality,
  maturity = MATURITY.FOUNDER_EXPERIMENTAL,
  evidenceRef = null,
}) {
  if (!EVENT_FAMILIES.includes(family)) throw new TypeError(`Unsupported analytics family: ${family}.`);
  const normalizedMetric = boundedText(metric, 'metric', 120).toLowerCase();
  const conceptMetric = normalizedMetric.replace(/[^a-z0-9]+/gu, '_').replace(/^_+|_+$/gu, '');
  const compactMetric = conceptMetric.replaceAll('_', '');
  if (PROHIBITED_METRIC_TERMS.some((term) => conceptMetric.includes(term) || compactMetric.includes(term.replaceAll('_', '')))) {
    throw new TypeError(`Prohibited analytics metric: ${normalizedMetric}.`);
  }
  if (!Object.values(MATURITY).includes(maturity)) throw new TypeError(`Unsupported maturity: ${maturity}.`);
  const normalizedStart = finiteInteger(startMs, 'startMs');
  const normalizedEnd = finiteInteger(endMs, 'endMs');
  if (normalizedEnd < normalizedStart) throw new TypeError('Event ends before it starts.');
  const normalizedSequence = finiteInteger(sequence, 'sequence', 1);
  const normalizedSource = {
    engine: boundedText(source?.engine ?? 'missionmed-local', 'source.engine', 64),
    engineVersion: boundedText(source?.engineVersion ?? ANALYTICS_ENGINE_VERSION, 'source.engineVersion', 48),
    modelVersion: source?.modelVersion === null || source?.modelVersion === undefined ? null : boundedText(source.modelVersion, 'source.modelVersion', 96),
    input: boundedText(source?.input, 'source.input', 24),
  };
  if (!['mic', 'camera', 'transcript', 'clock', 'system'].includes(normalizedSource.input)) throw new TypeError('Unsupported analytics input source.');
  const normalizedQuality = {
    provenance: boundedText(quality?.provenance ?? 'unresolved', 'quality.provenance', 24),
    reliability: boundedText(quality?.reliability ?? 'unavailable', 'quality.reliability', 24),
    coverage: Number.isFinite(quality?.coverage) ? Number(Math.max(0, Math.min(1, quality.coverage)).toFixed(4)) : 0,
    sampleCount: finiteInteger(quality?.sampleCount ?? 0, 'quality.sampleCount'),
    limitations: Array.isArray(quality?.limitations)
      ? quality.limitations.slice(0, 8).map((item) => boundedText(item, 'quality.limitation', 160))
      : [],
  };
  if (!PROVENANCE.includes(normalizedQuality.provenance)) throw new TypeError('Unsupported provenance.');
  if (!RELIABILITY.includes(normalizedQuality.reliability)) throw new TypeError('Unsupported reliability.');

  return deepFreeze({
    schema: EVENT_SCHEMA,
    eventId: boundedText(eventId ?? `${sessionId}:${answerId ?? 'session'}:${normalizedSequence}`, 'eventId', 180),
    sessionId: boundedText(sessionId, 'sessionId', 96),
    answerId: answerId === null ? null : boundedText(answerId, 'answerId', 96),
    sequence: normalizedSequence,
    family,
    metric: normalizedMetric,
    startMs: normalizedStart,
    endMs: normalizedEnd,
    durationMs: normalizedEnd - normalizedStart,
    source: normalizedSource,
    observation: safeJson(observation ?? { value: null, unit: null, qualifiers: [] }, 'observation', 2_000, { rejectRaw: true }),
    quality: normalizedQuality,
    maturity,
    evidenceRef: normalizeEvidenceRef(evidenceRef, normalizedStart, normalizedEnd),
  });
}

export function validateEvidenceTimeline(events, { sessionId = null, durationMs = Number.POSITIVE_INFINITY } = {}) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array.');
  let priorStart = -1;
  let priorSequence = 0;
  const ids = new Set();
  for (const event of events) {
    if (!event || event.schema !== EVENT_SCHEMA || !EVENT_FAMILIES.includes(event.family)) throw new TypeError('Timeline contains an invalid event.');
    if (!Number.isInteger(event.sequence) || event.sequence < 1 || event.durationMs !== event.endMs - event.startMs) throw new TypeError('Timeline contains invalid sequence or duration metadata.');
    if (!Object.values(MATURITY).includes(event.maturity)) throw new TypeError('Timeline contains invalid maturity.');
    if (!event.source || !['mic', 'camera', 'transcript', 'clock', 'system'].includes(event.source.input)) throw new TypeError('Timeline contains an invalid source.');
    if (!event.quality || !PROVENANCE.includes(event.quality.provenance) || !RELIABILITY.includes(event.quality.reliability)) throw new TypeError('Timeline contains invalid quality metadata.');
    if (!Number.isFinite(event.quality.coverage) || event.quality.coverage < 0 || event.quality.coverage > 1) throw new TypeError('Timeline contains invalid coverage.');
    safeJson(event.observation, 'event observation', 2_000, { rejectRaw: true });
    if (sessionId !== null && event.sessionId !== sessionId) throw new TypeError('Timeline crosses session IDs.');
    if (event.startMs < priorStart || event.sequence <= priorSequence) throw new TypeError('Timeline is not monotonic.');
    if (event.endMs < event.startMs || event.startMs < 0 || event.endMs > durationMs) throw new TypeError('Timeline event is out of bounds.');
    if (ids.has(event.eventId)) throw new TypeError('Timeline event IDs must be unique.');
    safeJson(event, 'event', 8_000);
    ids.add(event.eventId);
    priorStart = event.startMs;
    priorSequence = event.sequence;
  }
  return true;
}

export function serializeAnalyticsEnvelope(value) {
  assertNoRawPayload(value, 'analytics envelope');
  const serialized = JSON.stringify(value);
  if (byteLength(serialized) > 256_000) throw new TypeError('Analytics envelope exceeds the privacy size limit.');
  safeJson(value, 'analytics envelope', 256_000);
  return serialized;
}

export function sanitizeTranscriptForCounting(value, maximum = 20_000) {
  return String(value ?? '')
    .slice(0, maximum)
    .replace(/[\u202A-\u202E\u2066-\u2069]/gu, '')
    .normalize('NFKC');
}
