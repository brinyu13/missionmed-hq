import { CANDIDATE_CAPTURE_VERSION } from './candidate-audio.mjs';

// Pure contracts only. Callers must resolve rows/snapshots from server-owned
// storage. These in-process brands reject client JSON, not attest DB origin.
const prompts = new WeakSet();
const sources = new WeakSet();
const MAX_MS = 43_200_000;
const audioMimes = new Set(['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
const owner = value => typeof value === 'string' && /^wp:[1-9][0-9]{0,19}$/u.test(value);
const ms = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX_MS;
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const fail = code => { throw Object.assign(new TypeError(code), { code }); };
const equalPauses = (a, b) => Array.isArray(a) && a.length === b.length
  && a.every((span, index) => span?.startMs === b[index].startMs && span?.endMs === b[index].endMs);

function singlePractice(session, actor, workflow) {
  if (!owner(actor) || !uuid(session?.id) || session.owner_subject !== actor
    || workflow !== 'SELF_PRACTICE' || !['question', 'quick'].includes(session.session_type)
    || session.interviewer_provider !== 'missionmed-static'
    || session.context?.targetQuestions !== 1 || !Array.isArray(session.context?.questionIds)
    || session.context.questionIds.length !== 1 || session.context.questionIds[0] !== session.question_id) {
    fail('SELF_PRACTICE_BINDING_INVALID');
  }
}

/** Resolve an approved snapshot as it existed at selection, never today's fallback. */
export function resolveSelfPracticePrompt({ actor, session, question, workflow } = {}) {
  singlePractice(session, actor, workflow);
  const receipt = session.context.promptReceipt;
  if (receipt?.schema !== 'ivoc.self-practice-prompt.v1' || receipt.workflow !== workflow
    || receipt.approval !== 'ACTIVE_AT_SELECTION' || !instant(receipt.issuedAt)
    || !text(receipt.questionId, 120) || !Number.isSafeInteger(receipt.version) || receipt.version < 1
    || !text(receipt.text, 4000) || receipt.questionId !== session.question_id
    || receipt.text !== session.question_text || question?.status !== 'active'
    || question.question_id !== receipt.questionId || question.current_version !== receipt.version
    || question.canonical_text !== receipt.text) fail('SELF_PRACTICE_PROMPT_UNPROVEN');
  const prompt = Object.freeze({ schema: receipt.schema, workflow: receipt.workflow,
    questionId: receipt.questionId, version: receipt.version, text: receipt.text,
    approval: receipt.approval, issuedAt: receipt.issuedAt, ownerSubject: actor, sessionId: session.id });
  prompts.add(prompt);
  return prompt;
}

function timebase(input, { immutable = false } = {}) {
  if (!input || input.clock !== 'browser-monotonic-session' || !ms(input.recordingStartSessionMs)
    || !ms(input.recordingDurationMs) || input.recordingDurationMs === 0
    || (input.playableDurationMs !== null && (!ms(input.playableDurationMs) || input.playableDurationMs === 0))
    || !Array.isArray(input.pausedSpans) || input.pausedSpans.length > 128
    || (immutable && (!Object.isFrozen(input) || !Object.isFrozen(input.pausedSpans)))) fail('ANSWER_TIMEBASE_INVALID');
  let removedMs = 0;
  let lastEnd = input.recordingStartSessionMs;
  const pausedSpans = input.pausedSpans.map(span => {
    if (!span || !ms(span.startMs) || !ms(span.endMs) || span.startMs < lastEnd || span.endMs <= span.startMs
      || span.startMs - input.recordingStartSessionMs - removedMs > input.recordingDurationMs
      || (immutable && !Object.isFrozen(span))) fail('ANSWER_TIMEBASE_PAUSE_INVALID');
    lastEnd = span.endMs;
    removedMs += span.endMs - span.startMs;
    return Object.freeze({ startMs: span.startMs, endMs: span.endMs });
  });
  const sessionEndMs = input.recordingStartSessionMs + input.recordingDurationMs + removedMs;
  if (!ms(sessionEndMs) || lastEnd > sessionEndMs) fail('ANSWER_TIMEBASE_RANGE_INVALID');
  return Object.freeze({ clock: input.clock, recordingStartSessionMs: input.recordingStartSessionMs,
    recordingDurationMs: input.recordingDurationMs, playableDurationMs: input.playableDurationMs,
    pausedSpans: Object.freeze(pausedSpans), sessionEndMs,
    mediaLimitMs: Math.min(input.recordingDurationMs, input.playableDurationMs ?? input.recordingDurationMs) });
}

/** SEALED custody and structural mapping only; never biometric/source verification. */
export function validateSelfPracticeAnswerSource({ actor, session, promptReceipt, sourceRecording, parentRecording, parentTimebase } = {}) {
  if (!prompts.has(promptReceipt)) fail('SELF_PRACTICE_PROMPT_UNPROVEN');
  singlePractice(session, actor, promptReceipt?.workflow);
  if (!prompts.has(promptReceipt) || promptReceipt.ownerSubject !== actor || promptReceipt.sessionId !== session.id
    || promptReceipt.questionId !== session.question_id || promptReceipt.text !== session.question_text
    || session.context.promptReceipt?.schema !== promptReceipt.schema
    || session.context.promptReceipt?.workflow !== promptReceipt.workflow
    || session.context.promptReceipt?.approval !== promptReceipt.approval
    || session.context.promptReceipt?.questionId !== promptReceipt.questionId
    || session.context.promptReceipt?.text !== promptReceipt.text
    || session.context.promptReceipt?.version !== promptReceipt.version
    || session.context.promptReceipt?.issuedAt !== promptReceipt.issuedAt) fail('SELF_PRACTICE_PROMPT_UNPROVEN');
  const source = sourceRecording;
  const parent = parentRecording;
  const receipt = source?.capture_receipt;
  if (session.state !== 'saved' || !uuid(source?.id) || !uuid(parent?.id) || source.id === parent.id
    || source.recording_role !== 'candidate_audio' || parent.recording_role !== 'conversation'
    || source.status !== 'saved' || parent.status !== 'saved'
    || source.owner_subject !== actor || parent.owner_subject !== actor
    || source.session_id !== session.id || parent.session_id !== session.id || source.parent_recording_id !== parent.id
    || !audioMimes.has(source.mime_type) || !text(source.storage_object_key, 1024) || !text(parent.storage_object_key, 1024)
    || source.storage_object_key === parent.storage_object_key
    || !Number.isSafeInteger(source.size_bytes) || source.size_bytes <= 0
    || !Number.isSafeInteger(parent.size_bytes) || parent.size_bytes <= 0 || !text(parent.etag, 256) || !instant(parent.sealed_at)
    || !text(source.etag, 256) || !instant(source.sealed_at)
    || receipt?.schema !== 'ivoc.candidate-audio.v1' || receipt.captureVersion !== CANDIDATE_CAPTURE_VERSION
    || receipt.status !== 'SEALED' || receipt.recordingId !== source.id || receipt.parentRecordingId !== parent.id
    || receipt.sessionId !== session.id || receipt.assurance !== 'CLIENT_MIC_CAPTURE_DECLARATION'
    || receipt.analysisEligibility !== 'UNVERIFIED' || receipt.sizeBytes !== source.size_bytes
    || receipt.mime !== source.mime_type || receipt.etag !== source.etag || receipt.sealedAt !== source.sealed_at
    || !instant(receipt.allocatedAt) || Date.parse(receipt.allocatedAt) > Date.parse(receipt.sealedAt)
    || Date.parse(receipt.allocatedAt) < Date.parse(promptReceipt.issuedAt)
    || receipt.timing?.clientAttested !== true) fail('CANDIDATE_SOURCE_CUSTODY_INVALID');
  const sourceMap = timebase(receipt.timing);
  const replayMap = timebase(parentTimebase, { immutable: true });
  if (parentTimebase.recordingId !== parent.id || parentTimebase.sessionId !== session.id || parentTimebase.ownerSubject !== actor
    || source.duration_ms !== (sourceMap.playableDurationMs ?? sourceMap.recordingDurationMs)
    || parent.duration_ms !== (replayMap.playableDurationMs ?? replayMap.recordingDurationMs)
    || !equalPauses(source.paused_spans, sourceMap.pausedSpans) || !equalPauses(parent.paused_spans, replayMap.pausedSpans)) {
    fail('ANSWER_TIMEBASE_BINDING_INVALID');
  }
  const answerSource = Object.freeze({ schema: 'ivoc.self-practice-answer-source.v1', sessionId: session.id,
    ownerSubject: actor, prompt: promptReceipt, sourceRecordingId: source.id, replayRecordingId: parent.id,
    sourceMap, replayMap, custody: 'SEALED', assurance: 'CLIENT_MIC_CAPTURE_DECLARATION',
    analysisEligibility: 'UNVERIFIED', biometricIdentity: 'UNVERIFIED',
    limitations: Object.freeze(['Mic capture custody is not speaker identity or acoustic isolation proof.',
      'Timing is client-attested browser-monotonic timing, not independently measured speech boundaries.']) });
  sources.add(answerSource);
  return answerSource;
}

function toSession(mediaMs, map, edge) {
  let sessionMs = map.recordingStartSessionMs + mediaMs;
  let removedMs = 0;
  for (const span of map.pausedSpans) {
    const boundary = span.startMs - map.recordingStartSessionMs - removedMs;
    if (mediaMs > boundary || (mediaMs === boundary && edge === 'start')) sessionMs += span.endMs - span.startMs;
    removedMs += span.endMs - span.startMs;
  }
  return sessionMs;
}

function toReplay(sessionMs, map) {
  let mediaMs = sessionMs - map.recordingStartSessionMs;
  for (const span of map.pausedSpans) {
    if (sessionMs > span.startMs && sessionMs < span.endMs) fail('ANSWER_REPLAY_PAUSE_CROSSING');
    if (sessionMs >= span.endMs) mediaMs -= span.endMs - span.startMs;
  }
  if (!ms(mediaMs) || mediaMs > map.mediaLimitMs) fail('ANSWER_REPLAY_RANGE_INVALID');
  return mediaMs;
}

/** Caller splits discontinuous source spans first. No lost replay audio is clamped away. */
export function mapSelfPracticeAnswerSegments({ answerSource, segments } = {}) {
  if (!sources.has(answerSource)) fail('ANSWER_SOURCE_UNPROVEN');
  if (!Array.isArray(segments) || !segments.length || segments.length > 40) fail('ANSWER_SEGMENTS_INVALID');
  const seen = new Set();
  let lastEndMs = -1;
  const mapped = segments.map(segment => {
    if (!text(segment?.id, 96) || seen.has(segment.id) || !ms(segment.startMs) || !ms(segment.endMs)
      || segment.endMs <= segment.startMs || segment.startMs < lastEndMs
      || segment.endMs > answerSource.sourceMap.mediaLimitMs) fail('ANSWER_SEGMENT_RANGE_INVALID');
    seen.add(segment.id); lastEndMs = segment.endMs;
    let removedMs = 0;
    for (const span of answerSource.sourceMap.pausedSpans) {
      const boundary = span.startMs - answerSource.sourceMap.recordingStartSessionMs - removedMs;
      if (segment.startMs < boundary && segment.endMs > boundary) fail('ANSWER_SOURCE_PAUSE_CROSSING');
      removedMs += span.endMs - span.startMs;
    }
    const startMs = toSession(segment.startMs, answerSource.sourceMap, 'start');
    const endMs = toSession(segment.endMs, answerSource.sourceMap, 'end');
    if (endMs <= startMs || answerSource.replayMap.pausedSpans.some(span => startMs < span.endMs && endMs > span.startMs)) {
      fail('ANSWER_REPLAY_PAUSE_CROSSING');
    }
    const replayStartMs = toReplay(startMs, answerSource.replayMap);
    const replayEndMs = toReplay(endMs, answerSource.replayMap);
    return Object.freeze({ id: segment.id, sourceRecordingId: answerSource.sourceRecordingId,
      replayRecordingId: answerSource.replayRecordingId,
      sourceMedia: Object.freeze({ startMs: segment.startMs, endMs: segment.endMs }),
      session: Object.freeze({ startMs, endMs }), replayMedia: Object.freeze({ startMs: replayStartMs, endMs: replayEndMs }) });
  });
  return Object.freeze({ schema: 'ivoc.self-practice-answer-map.v1', sessionId: answerSource.sessionId,
    sourceRecordingId: answerSource.sourceRecordingId, replayRecordingId: answerSource.replayRecordingId,
    prompt: answerSource.prompt, analysisEligibility: 'UNVERIFIED', segments: Object.freeze(mapped) });
}
