import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { resolveSelfPracticePrompt, validateSelfPracticeAnswerSource, isSelfPracticeAnswerSource, mapSelfPracticeAnswerSegments } from './answer-source.mjs';
import { assertContextResult, assertContextAnalysis } from '../../ivprep-v6/public/ivoc-standalone/app/context-contracts.mjs';

// Origin authority MUST be the server-only ivoc_results.candidate_analysis
// column. Structural validation/brands cannot authenticate identical JSON.
const rebuilt = new WeakMap();
const promptKeys = ['schema', 'workflow', 'questionId', 'version', 'text', 'approval', 'issuedAt'];
const fail = code => { throw Object.assign(new TypeError(code), { code }); };
const bounded = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;
const ratio = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const identifiers = value => Array.isArray(value) && value.length <= 40 && value.every(id => bounded(id, 120));
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value || {}, key)).map(key => [key, value[key]]));
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
const copy = value => freeze(structuredClone(value));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const limits = [
  'Source binding describes a separate microphone capture declared by the client, not biometric speaker verification or proof of acoustic isolation.',
  'Timing uses sealed client-attested monotonic maps; event arrival times are not independently measured speech boundaries.',
  'The selected question is setup context, not a recorded interviewer utterance.',
];
function exactPrompt(session) {
  const receipt = session?.context?.promptReceipt;
  if (!receipt || !isDeepStrictEqual(Object.keys(receipt).sort(), [...promptKeys].sort())) fail('SELF_PRACTICE_PROMPT_UNPROVEN');
  return copy(receipt);
}
function sealDigest(row) {
  return digest(pick(row, ['id', 'session_id', 'owner_subject', 'recording_role', 'parent_recording_id',
    'storage_object_key', 'mime_type', 'size_bytes', 'duration_ms', 'etag', 'sealed_at', 'paused_spans', 'capture_receipt', 'recording_timebase']));
}

/** Server-resolved rows only. No current-catalog or mutable Results fallback. */
export function rebuildSelfPracticeAnswerSource({ session, sourceRecording, parentRecording } = {}) {
  const snapshot = exactPrompt(session);
  if (!parentRecording?.recording_timebase) fail('ANSWER_TIMEBASE_UNAVAILABLE');
  const parentTimebase = copy(parentRecording.recording_timebase);
  const promptReceipt = resolveSelfPracticePrompt({ actor: session.owner_subject, session,
    workflow: snapshot.workflow, question: { question_id: snapshot.questionId, current_version: snapshot.version,
      canonical_text: snapshot.text, status: snapshot.approval === 'ACTIVE_AT_SELECTION' ? 'active' : null } });
  const answerSource = validateSelfPracticeAnswerSource({ actor: session.owner_subject, session,
    promptReceipt, sourceRecording, parentRecording, parentTimebase });
  rebuilt.set(answerSource, { promptReceipt: snapshot, sourceSealDigest: sealDigest(sourceRecording),
    replaySealDigest: sealDigest(parentRecording), sealedAt: [sourceRecording.sealed_at, parentRecording.sealed_at].sort().at(-1) });
  return answerSource;
}

function checkedResult(answerSource, result) {
  if (!isSelfPracticeAnswerSource(answerSource) || !rebuilt.has(answerSource)) fail('SELF_PRACTICE_SOURCE_UNPROVEN');
  assertContextResult(result);
  if (result.sessionId !== answerSource.sessionId || !bounded(result.answerId, 120)
    || result.question?.questionId !== answerSource.prompt.questionId
    || result.question?.revision !== answerSource.prompt.version || result.question?.canonicalText !== answerSource.prompt.text
    || result.transcript?.status !== 'AVAILABLE' || result.transcript.truthLabel !== 'REAL'
    || typeof result.transcript.transcriptId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u.test(result.transcript.transcriptId)
    || result.candidateAttribution?.status === 'VERIFIED') fail('SELF_PRACTICE_RESULT_IDENTITY_INVALID');
  const transcript = result.transcript;
  if (['provider', 'model', 'adapter', 'timestamps'].some(key => !bounded(transcript[key], 120))) fail('SELF_PRACTICE_TRANSCRIPT_METADATA_INVALID');
  const mapping = transcript.mapping;
  const sourceBinding = { status: 'SOURCE_BOUND', sourceRecordingId: answerSource.sourceRecordingId,
    replayRecordingId: answerSource.replayRecordingId, assurance: 'CLIENT_MIC_CAPTURE_DECLARATION' };
  if (!isDeepStrictEqual(transcript.sourceBinding, sourceBinding) || !Array.isArray(mapping?.segments)
    || mapping.segments.length !== transcript.segments.length) fail('SELF_PRACTICE_RESULT_MAPPING_INVALID');
  const recomputed = mapSelfPracticeAnswerSegments({ answerSource, segments: mapping.segments.map(segment => ({
    id: segment.id, startMs: segment.sourceMedia?.startMs, endMs: segment.sourceMedia?.endMs })) });
  if (!isDeepStrictEqual(mapping, recomputed)) fail('SELF_PRACTICE_RESULT_MAPPING_INVALID');
  const cleanSegments = transcript.segments.map((segment, index) => {
    const mapped = recomputed.segments[index];
    if (segment.id !== mapped.id || segment.startMs !== mapped.replayMedia.startMs || segment.endMs !== mapped.replayMedia.endMs
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u.test(segment.id)
      || !isDeepStrictEqual(segment.sourceRange, mapped.sourceMedia) || !isDeepStrictEqual(segment.sessionRange, mapped.session)
      || !bounded(segment.text, 4000)) fail('SELF_PRACTICE_RESULT_MAPPING_INVALID');
    return { id: segment.id, speaker: 'STUDENT', final: true, text: segment.text,
      startMs: segment.startMs, endMs: segment.endMs, source: 'separate-microphone-capture',
      sourceRange: mapped.sourceMedia, sessionRange: mapped.session };
  });
  const joined = cleanSegments.map(segment => segment.text).join(' ');
  if (transcript.text !== joined || transcript.wordCount !== joined.split(/\s+/u).length) fail('SELF_PRACTICE_TRANSCRIPT_CONTENT_INVALID');
  const ids = new Set(cleanSegments.map(segment => segment.id));
  let analysis;
  if (result.analysis.status === 'AVAILABLE') {
    if (result.analysis.sessionId !== result.sessionId || result.analysis.answerId !== result.answerId
      || !isDeepStrictEqual(result.analysis.range, { startMs: cleanSegments[0].startMs, endMs: cleanSegments.at(-1).endMs })) {
      fail('SELF_PRACTICE_ANALYSIS_IDENTITY_INVALID');
    }
    if (!ratio(result.analysis.score) || !ratio(result.analysis.coverage)
      || !['PERSONAL_NARRATIVE', 'BEHAVIORAL', 'MOTIVATION', 'PROGRAM_FIT', 'SITUATIONAL', 'GENERAL'].includes(result.analysis.questionIntent?.label)
      || !ratio(result.analysis.questionIntent.score)
      || !['OPENING', 'CLAIM', 'EVIDENCE', 'REFLECTION', 'CLOSE', 'COMPLETE', 'UNSUPPORTED'].includes(result.analysis.answerStage?.label)
      || !ratio(result.analysis.answerStage.score)
      || !bounded(result.analysis.analysisId, 120)
      || result.analysis.semanticObservations.some(item => !['SUPPORTED_CLAIM', 'ANSWER_STRUCTURE'].includes(item.kind) || !bounded(item.text, 500))
      || !Array.isArray(result.analysis.limitations) || result.analysis.limitations.length > 16
      || result.analysis.limitations.some(value => !bounded(value, 500))
      || ['provider', 'model', 'policyVersion', 'truthLabel'].some(key => !bounded(result.analysis.provenance?.[key], 120))) {
      fail('SELF_PRACTICE_ANALYSIS_METADATA_INVALID');
    }
    const patterns = result.analysis.coachingPatterns;
    if (!Array.isArray(patterns) || patterns.length > 12 || patterns.some(pattern =>
      !['structure', 'evidence', 'specificity', 'concision'].includes(pattern.facet)
      || !['strength', 'weakness'].includes(pattern.polarity) || !Array.isArray(pattern.transcriptSegmentIds)
      || !bounded(pattern.text, 500)
      || !pattern.transcriptSegmentIds.length || pattern.transcriptSegmentIds.length > 8
      || pattern.transcriptSegmentIds.some(id => !ids.has(id))
      || (pattern.facet === 'concision' && pattern.polarity === 'strength' && result.analysis.answerStage?.label !== 'COMPLETE'))) {
      fail('SELF_PRACTICE_COACHING_EVIDENCE_INVALID');
    }
    // Reuse the current claim screen for patterns as well as observations.
    assertContextAnalysis({ ...result.analysis, semanticObservations: patterns }, transcript);
    analysis = { ...pick(result.analysis, ['status', 'schema', 'analysisId', 'sessionId', 'answerId', 'range', 'score', 'coverage']),
      questionIntent: pick(result.analysis.questionIntent, ['label', 'score']), answerStage: pick(result.analysis.answerStage, ['label', 'score']),
      semanticObservations: result.analysis.semanticObservations.map(item => pick(item, ['kind', 'text', 'transcriptSegmentIds'])),
      coachingPatterns: patterns.map(item => pick(item, ['facet', 'polarity', 'text', 'transcriptSegmentIds'])),
      contextTags: (result.analysis.contextTags || []).filter(value => typeof value === 'string').slice(0, 8),
      limitations: [...new Set([...result.analysis.limitations, ...limits])],
      provenance: pick(result.analysis.provenance, ['provider', 'model', 'policyVersion', 'truthLabel']) };
  } else {
    if (!bounded(result.analysis.reason, 120)) fail('SELF_PRACTICE_ANALYSIS_METADATA_INVALID');
    analysis = { status: 'UNAVAILABLE', reason: result.analysis.reason,
      semanticObservations: [], coachingPatterns: [], limitations: [...limits] };
  }
  const command = pick(result.coachCommand, ['schema', 'commandId', 'sessionId', 'answerId', 'issuedAtMs', 'ttlMs', 'refractoryMs', 'source',
    'cue', 'priority', 'score', 'coverage', 'registryVersion', 'assignmentVersion', 'idempotencyKey', 'supersedes', 'truthLabel']);
  if (Object.values(command).some(value => value !== null && !['string', 'number', 'boolean'].includes(typeof value))) fail('SELF_PRACTICE_COMMAND_METADATA_INVALID');
  command.evidence = pick(result.coachCommand.evidence, ['analyticsEventIds', 'contextAnalysisId', 'transcriptSegmentIds']);
  if (!identifiers(command.evidence.analyticsEventIds) || !identifiers(command.evidence.transcriptSegmentIds)
    || command.evidence.transcriptSegmentIds.some(id => !ids.has(id))
    || (command.evidence.contextAnalysisId !== null && command.evidence.contextAnalysisId !== result.analysis.analysisId)) {
    fail('SELF_PRACTICE_COMMAND_EVIDENCE_INVALID');
  }
  if (!Array.isArray(result.analyticsObservations || [])) fail('SELF_PRACTICE_ANALYTICS_METADATA_INVALID');
  const observations = (result.analyticsObservations || []).map(item => {
    const row = pick(item, ['metric', 'value', 'unit', 'maturity', 'reliability', 'coverage', 'eventId']);
    if (Object.values(row).some(value => value !== null && (!['string', 'number', 'boolean'].includes(typeof value)
      || (typeof value === 'number' && !Number.isFinite(value))))) {
      fail('SELF_PRACTICE_ANALYTICS_METADATA_INVALID');
    }
    return row;
  });
  const master = result.masterDerived ? pick(result.masterDerived, ['wordsPerMinute', 'basis', 'transcriptId', 'analyticsEventId']) : null;
  if (master && (!Number.isFinite(master.wordsPerMinute) || master.wordsPerMinute < 0 || !bounded(master.basis, 120)
    || master.transcriptId !== transcript.transcriptId || (master.analyticsEventId !== null && !bounded(master.analyticsEventId, 120)))) {
    fail('SELF_PRACTICE_MASTER_METADATA_INVALID');
  }
  return copy({ schema: result.schema, sessionId: result.sessionId, answerId: result.answerId,
    question: { questionId: answerSource.prompt.questionId, revision: answerSource.prompt.version,
      canonicalText: answerSource.prompt.text, tags: [], source: 'saved-approved-prompt' },
    transcript: { ...pick(transcript, ['status', 'transcriptId', 'provider', 'model', 'adapter', 'truthLabel', 'timestamps']),
      text: joined, wordCount: transcript.wordCount, segments: cleanSegments, mapping: recomputed, sourceBinding,
      limitations: [...limits] }, analysis, coachCommand: command,
    analyticsObservations: observations, masterDerived: master,
    sourceBinding: { ...sourceBinding, biometricIdentity: 'UNVERIFIED', analysisEligibility: 'UNVERIFIED', limitations: [...limits] } });
}

/** Package only the actual source-relative mapping; replay timestamps are not shifted twice. */
export function packageSelfPracticeAnalysis({ answerSource, session, result, createdAt } = {}) {
  const clean = checkedResult(answerSource, result);
  const origin = rebuilt.get(answerSource);
  resolveSelfPracticePrompt({ actor: session?.owner_subject, session, workflow: answerSource.prompt.workflow,
    question: { question_id: answerSource.prompt.questionId, current_version: answerSource.prompt.version,
      canonical_text: answerSource.prompt.text, status: 'active' } });
  if (session?.id !== answerSource.sessionId || session.owner_subject !== answerSource.ownerSubject
    || !isDeepStrictEqual(exactPrompt(session), origin.promptReceipt) || !instant(createdAt)
    || createdAt < origin.sealedAt) fail('SELF_PRACTICE_ENVELOPE_IDENTITY_INVALID');
  return copy({ receipt: { schema: 'ivoc.self-practice-analysis.v1', status: 'SOURCE_BOUND',
    sessionId: answerSource.sessionId, ownerSubject: answerSource.ownerSubject,
    sourceRecordingId: answerSource.sourceRecordingId, replayRecordingId: answerSource.replayRecordingId,
    promptReceipt: origin.promptReceipt, createdAt, sourceSealDigest: origin.sourceSealDigest, replaySealDigest: origin.replaySealDigest }, result: clean });
}

function publicSpine(envelope) {
  const { result, receipt } = envelope;
  const ref = `transcript:${result.transcript.transcriptId}`;
  const turnIds = new Map();
  const turns = result.transcript.segments.map((segment, index) => {
    const id = `turn:${receipt.sessionId}:source:${index + 1}`; turnIds.set(segment.id, id);
    return { id, speaker: 'student', relation: 'answer', startMs: segment.startMs, endMs: segment.endMs,
      transcript: { canonical_ref: `${ref}#${segment.id}`, text: segment.text, sourceBinding: result.sourceBinding },
      question: { origin: 'setup_prompt', identity: { canonical_question_id: receipt.promptReceipt.questionId, version: String(receipt.promptReceipt.version) } },
      semantic: {}, version: 1 };
  });
  const rows = result.analysis.status === 'AVAILABLE'
    ? [...result.analysis.semanticObservations.map(item => ({ ...item, dimension: `semantic.${String(item.kind).toLowerCase()}` })),
      ...result.analysis.coachingPatterns.map(item => ({ ...item, dimension: 'semantic.coaching_pattern' }))] : [];
  const evidence = rows.map((item, index) => ({ id: `evidence:${receipt.sessionId}:source:${index + 1}`,
    dimension: item.dimension, refs: item.transcriptSegmentIds.map(id => ({ kind: 'transcript_span', ref: `${ref}#${id}` })),
    interpretation: { text: item.text, by: 'ai_draft', ...(item.facet ? { facet: item.facet, polarity: item.polarity } : {}) },
    confidence: result.analysis.coverage, limitations: result.analysis.limitations, version: 1 }));
  const segments = result.transcript.segments.map((segment, index) => ({ id: `segment:${receipt.sessionId}:source:${index + 1}`,
    transcriptRef: ref, mediaRef: `recording:${receipt.replayRecordingId}`,
    question: { origin: 'setup_prompt', text: receipt.promptReceipt.text,
      canonical_question_id: receipt.promptReceipt.questionId, version: String(receipt.promptReceipt.version) },
    answer: { t_start_ms: segment.startMs, t_end_ms: segment.endMs, turn_ids: [turnIds.get(segment.id)], follow_up_turn_ids: [] },
    coachingNotesRefs: evidence.filter(item => item.refs.some(row => row.ref === `${ref}#${segment.id}`)).map(item => item.id), version: 1 }));
  return { schema: 'ivoc.session-spine.v1', sourceBinding: result.sourceBinding,
    setupPrompt: receipt.promptReceipt, turns, segments, evidence };
}

/** Read ONLY from the protected candidate_analysis column after route authorization. */
export function projectSelfPracticeAnalysis({ candidateAnalysis, session, sourceRecording, parentRecording } = {}) {
  try {
    const answerSource = rebuildSelfPracticeAnswerSource({ session, sourceRecording, parentRecording });
    const expected = packageSelfPracticeAnalysis({ answerSource, session, result: candidateAnalysis?.result,
      createdAt: candidateAnalysis?.receipt?.createdAt });
    if (!isDeepStrictEqual(candidateAnalysis, expected)) fail('SELF_PRACTICE_SAVED_ENVELOPE_INVALID');
    return copy({ available: true, receipt: expected.receipt, result: expected.result,
      sourceBinding: expected.result.sourceBinding, setupPrompt: expected.receipt.promptReceipt, spine: publicSpine(expected) });
  } catch {
    return copy({ available: false, reason: 'SELF_PRACTICE_ANALYSIS_UNAVAILABLE', result: null, spine: null,
      sourceBinding: { status: 'UNAVAILABLE', biometricIdentity: 'UNVERIFIED', analysisEligibility: 'UNVERIFIED', limitations: [...limits] } });
  }
}
