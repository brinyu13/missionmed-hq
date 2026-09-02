export const CONTEXT_REQUEST_SCHEMA = 'missionmed.ivoc.context.request.v1';
export const CONTEXT_ANALYSIS_SCHEMA = 'missionmed.ivoc.context.analysis.v1';
export const CONTEXT_RESULT_SCHEMA = 'missionmed.ivoc.context.result.v1';
export const COACH_COMMAND_SCHEMA = 'missionmed.ivoc.coach-command.v1';
export const BEHAVIOR_REGISTRY_SCHEMA = 'missionmed.ivoc.behavior-registry.v1';
export const BEHAVIOR_REGISTRY_VERSION = '2026-09-02.1';

export const COACH_COMMAND_SOURCES = Object.freeze(['AI', 'MENTOR', 'STREAM_DECK', 'OBS', 'SYSTEM']);
export const REACHABLE_CUES = Object.freeze(['SLOW_DOWN', 'PICK_UP_PACE', 'SPEAK_UP', 'EASE_VOLUME', 'NO_CUE']);
export const DECLARED_FUTURE_CUES = Object.freeze([
  'ADD_VARIETY', 'SETTLE_TONE', 'PAUSE', 'LOOK_AWAY', 'REENGAGE',
  'USE_HANDS', 'SETTLE_HANDS', 'EMPHASIZE', 'OPEN_UP', 'HOLD', 'GREAT',
]);

const FORBIDDEN_CLAIM = /(?:anxi(?:ety|ous)|confidence|decept|diagnos|dishonest|emotion|empathy as (?:an|a )?internal|employab|hidden (?:emotion|state|trait)|honest|intelligen|mental state|not sad enough|doesn['’]t care|personality|professionalism|program fit|protected trait|psychometric|readiness|sincere|sincerity|truthful person)/iu;
const PROMPT_INJECTION_ECHO = /(?:developer message|ignore (?:all |the )?(?:previous|prior) instructions|reveal (?:the )?system prompt|system prompt)/iu;
const MOCK_MARKER = /\[MOCK_/iu;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function boundedText(value, name, maximum = 400) {
  const text = String(value ?? '').trim();
  if (!text || text.length > maximum) throw new TypeError(`${name} is missing or too long.`);
  return text;
}

function boundedNumber(value, name, minimum = 0, maximum = 1) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new TypeError(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

export const BEHAVIOR_COACHING_REGISTRY = deepFreeze({
  schema: BEHAVIOR_REGISTRY_SCHEMA,
  registryVersion: BEHAVIOR_REGISTRY_VERSION,
  executableRulesAllowed: false,
  scopeResolution: 'GLOBAL_DEFAULT_ONLY_IN_6002',
  entries: [
    {
      id: 'pace-above-current-product-corridor',
      cue: 'SLOW_DOWN',
      state: 'LIVE_COACHING_ELIGIBLE',
      detectorRefs: ['analytics:answer_duration_ms', 'master:transcript_word_count'],
      fact: 'Master-derived pace is above the existing IV Prep product corridor.',
      interpretation: 'A slower delivery may improve listener processing.',
      policy: { metric: 'master.words_per_minute', operator: 'GT', value: 175, unit: 'WPM' },
      priority: 70,
    },
    {
      id: 'pace-below-current-product-corridor',
      cue: 'PICK_UP_PACE',
      state: 'LIVE_COACHING_ELIGIBLE',
      detectorRefs: ['analytics:answer_duration_ms', 'master:transcript_word_count'],
      fact: 'Master-derived pace is below the existing IV Prep product corridor.',
      interpretation: 'A slightly faster delivery may sustain conversational flow.',
      policy: { metric: 'master.words_per_minute', operator: 'LT', value: 140, unit: 'WPM' },
      priority: 60,
    },
    {
      id: 'captured-level-low',
      cue: 'SPEAK_UP',
      state: 'LIVE_COACHING_ELIGIBLE',
      detectorRefs: ['analytics:captured_level_dbfs'],
      fact: 'Validated microphone capture level is very low.',
      interpretation: 'More captured level may improve audibility; microphone calibration remains a limitation.',
      policy: { metric: 'analytics.captured_level_dbfs', operator: 'LT', value: -40, unit: 'dBFS' },
      priority: 50,
    },
    {
      id: 'digital-clipping-present',
      cue: 'EASE_VOLUME',
      state: 'LIVE_COACHING_ELIGIBLE',
      detectorRefs: ['analytics:digital_clipping_fraction'],
      fact: 'Validated digital samples include clipping.',
      interpretation: 'Easing input level may reduce clipping; this does not infer vocal effort.',
      policy: { metric: 'analytics.digital_clipping_fraction', operator: 'GTE', value: 0.01, unit: 'fraction' },
      priority: 90,
    },
    {
      id: 'semantic-gesture-and-dramatic-pause',
      cue: null,
      state: 'UNMEASURABLE_CURRENTLY',
      detectorRefs: [
        'analytics:gesture_primitives_UNPUBLISHED',
        'analytics:dramatic_pause_sequence_UNPUBLISHED',
      ],
      fact: 'Required observable primitives are not contracted.',
      interpretation: 'No gesture or dramatic-pause cue may be emitted.',
      policy: null,
      priority: 0,
    },
  ],
});

export function assertBehaviorRegistry(value = BEHAVIOR_COACHING_REGISTRY) {
  if (
    value?.schema !== BEHAVIOR_REGISTRY_SCHEMA
    || value?.registryVersion !== BEHAVIOR_REGISTRY_VERSION
    || value?.executableRulesAllowed !== false
    || !Array.isArray(value?.entries)
  ) throw new TypeError('Behavior Coaching Registry contract is invalid.');
  for (const entry of value.entries) {
    boundedText(entry.id, 'registry entry id', 120);
    if (entry.cue !== null && !REACHABLE_CUES.includes(entry.cue)) throw new TypeError('Registry cue is not reachable in V1.');
    if (!['LIVE_COACHING_ELIGIBLE', 'UNMEASURABLE_CURRENTLY'].includes(entry.state)) throw new TypeError('Registry state is invalid.');
    if (!Array.isArray(entry.detectorRefs) || !entry.detectorRefs.length) throw new TypeError('Registry evidence references are required.');
    if (entry.policy && !['GT', 'GTE', 'LT', 'LTE'].includes(entry.policy.operator)) throw new TypeError('Registry policy operator is not allowlisted.');
  }
  return true;
}

export function assertTranscript(value) {
  if (!value || !['AVAILABLE', 'UNAVAILABLE'].includes(value.status)) throw new TypeError('Transcript status is invalid.');
  if (!['REAL', 'TEST DATA', 'UNAVAILABLE'].includes(value.truthLabel)) throw new TypeError('Transcript truth label is invalid.');
  if (value.status === 'UNAVAILABLE') {
    boundedText(value.reason, 'transcript unavailable reason', 120);
    if (value.truthLabel !== 'UNAVAILABLE' || (value.segments?.length ?? 0) !== 0) throw new TypeError('Unavailable transcript contains data.');
    return true;
  }
  if (value.truthLabel === 'UNAVAILABLE' || !Array.isArray(value.segments) || !value.segments.length || value.segments.length > 40) {
    throw new TypeError('Available transcript segments are invalid.');
  }
  const ids = new Set();
  let characters = 0;
  for (const segment of value.segments) {
    const id = boundedText(segment.id, 'transcript segment id', 96);
    const text = boundedText(segment.text, 'transcript segment text', 4_000);
    if (ids.has(id) || segment.speaker !== 'STUDENT' || segment.final !== true) throw new TypeError('Transcript segment identity is invalid.');
    if (!Number.isFinite(segment.startMs) || !Number.isFinite(segment.endMs) || segment.startMs < 0 || segment.endMs < segment.startMs) {
      throw new TypeError('Transcript segment time range is invalid.');
    }
    if (MOCK_MARKER.test(text)) throw new TypeError('Mock transcript content is prohibited.');
    characters += text.length;
    ids.add(id);
  }
  if (characters > 20_000 || MOCK_MARKER.test(value.text || '')) throw new TypeError('Transcript exceeds its truth boundary.');
  return true;
}

export function assertContextAnalysis(value, transcript) {
  if (value?.status === 'UNAVAILABLE') {
    boundedText(value.reason, 'analysis unavailable reason', 120);
    return true;
  }
  if (value?.schema !== CONTEXT_ANALYSIS_SCHEMA) throw new TypeError('Context analysis schema is invalid.');
  boundedText(value.analysisId, 'analysis id', 120);
  boundedNumber(value.score, 'analysis score');
  boundedNumber(value.coverage, 'analysis coverage');
  const segmentIds = new Set((transcript?.segments || []).map((segment) => segment.id));
  if (!Array.isArray(value.semanticObservations) || value.semanticObservations.length > 12) throw new TypeError('Semantic observations are invalid.');
  for (const observation of value.semanticObservations) {
    const text = boundedText(observation.text, 'semantic observation', 500);
    if (FORBIDDEN_CLAIM.test(text) || PROMPT_INJECTION_ECHO.test(text) || MOCK_MARKER.test(text)) throw new TypeError('Semantic observation failed the claim screen.');
    if (!Array.isArray(observation.transcriptSegmentIds) || !observation.transcriptSegmentIds.length
      || observation.transcriptSegmentIds.some((id) => !segmentIds.has(id))) {
      throw new TypeError('Semantic observation lacks valid transcript evidence.');
    }
  }
  return true;
}

function eventByMetric(observations, metric) {
  return (observations || []).find((entry) => entry.metric === metric) || null;
}

function commandId(idFactory) {
  if (typeof idFactory === 'function') return boundedText(idFactory(), 'command id', 120);
  return globalThis.crypto?.randomUUID?.() || `coach-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function deriveCoachCommand({
  sessionId,
  answerId,
  issuedAtMs,
  transcript,
  analysis,
  analyticsObservations = [],
  masterDerived = null,
  idFactory,
} = {}) {
  assertBehaviorRegistry();
  const candidates = [];
  const duration = eventByMetric(analyticsObservations, 'answer_duration_ms');
  const level = eventByMetric(analyticsObservations, 'captured_level_dbfs');
  const clipping = eventByMetric(analyticsObservations, 'digital_clipping_fraction');
  if (clipping && clipping.value >= 0.01) candidates.push({ cue: 'EASE_VOLUME', priority: 90, ids: [clipping.eventId], score: Math.min(1, clipping.value * 20), coverage: clipping.coverage });
  if (duration && Number.isFinite(masterDerived?.wordsPerMinute) && masterDerived.wordsPerMinute > 175) candidates.push({ cue: 'SLOW_DOWN', priority: 70, ids: [duration.eventId], score: Math.min(1, 0.7 + (masterDerived.wordsPerMinute - 175) / 100), coverage: duration.coverage });
  if (duration && Number.isFinite(masterDerived?.wordsPerMinute) && masterDerived.wordsPerMinute < 140) candidates.push({ cue: 'PICK_UP_PACE', priority: 60, ids: [duration.eventId], score: Math.min(1, 0.7 + (140 - masterDerived.wordsPerMinute) / 100), coverage: duration.coverage });
  if (level && level.value < -40 && (!clipping || clipping.value <= 0.001)) candidates.push({ cue: 'SPEAK_UP', priority: 50, ids: [level.eventId], score: Math.min(1, 0.7 + (-40 - level.value) / 80), coverage: level.coverage });
  candidates.sort((a, b) => b.priority - a.priority);
  const chosen = candidates[0] || null;
  const segmentIds = (transcript?.segments || []).map((segment) => segment.id).slice(0, 40);
  const cue = chosen?.cue || 'NO_CUE';
  const command = {
    schema: COACH_COMMAND_SCHEMA,
    commandId: commandId(idFactory),
    sessionId: boundedText(sessionId, 'command session id', 120),
    answerId: boundedText(answerId, 'command answer id', 120),
    cue,
    source: 'AI',
    issuedAtMs: Math.max(0, Math.round(Number(issuedAtMs) || 0)),
    ttlMs: cue === 'NO_CUE' ? 0 : 4_000,
    refractoryMs: cue === 'NO_CUE' ? 0 : 6_000,
    priority: chosen?.priority || 0,
    evidence: {
      analyticsEventIds: chosen?.ids || [],
      contextAnalysisId: analysis?.status === 'UNAVAILABLE' ? null : analysis?.analysisId || null,
      transcriptSegmentIds: chosen ? segmentIds : [],
    },
    score: chosen ? Number(chosen.score.toFixed(4)) : 0,
    coverage: chosen ? Number(Math.min(chosen.coverage ?? 0, analysis?.coverage ?? 0).toFixed(4)) : 0,
    registryVersion: BEHAVIOR_REGISTRY_VERSION,
    assignmentVersion: null,
    idempotencyKey: `${sessionId}:${answerId}:${cue}:${Math.max(0, Math.round(Number(issuedAtMs) || 0))}`,
    supersedes: null,
    truthLabel: transcript?.truthLabel || 'UNAVAILABLE',
  };
  return deepFreeze(command);
}

export function assertCoachCommand(command) {
  if (command?.schema !== COACH_COMMAND_SCHEMA || !REACHABLE_CUES.includes(command?.cue)) throw new TypeError('CoachCommand cue is invalid.');
  if (!COACH_COMMAND_SOURCES.includes(command.source)) throw new TypeError('CoachCommand source is invalid.');
  if (command.registryVersion !== BEHAVIOR_REGISTRY_VERSION) throw new TypeError('CoachCommand registry version is invalid.');
  boundedText(command.commandId, 'command id', 120);
  boundedText(command.sessionId, 'command session id', 120);
  boundedText(command.answerId, 'command answer id', 120);
  boundedNumber(command.score, 'command score');
  boundedNumber(command.coverage, 'command coverage');
  if (command.cue === 'NO_CUE' && (command.ttlMs !== 0 || command.priority !== 0)) throw new TypeError('NO_CUE must not create an active cue.');
  if (command.cue !== 'NO_CUE' && (!command.evidence?.analyticsEventIds?.length || !command.evidence?.contextAnalysisId)) {
    throw new TypeError('Active CoachCommand lacks evidence.');
  }
  return true;
}

export function assertContextResult(result) {
  if (result?.schema !== CONTEXT_RESULT_SCHEMA) throw new TypeError('Context result schema is invalid.');
  assertTranscript(result.transcript);
  assertContextAnalysis(result.analysis, result.transcript);
  assertCoachCommand(result.coachCommand);
  if (result.coachCommand.sessionId !== result.sessionId || result.coachCommand.answerId !== result.answerId) {
    throw new TypeError('Context result crosses identity boundaries.');
  }
  return true;
}
