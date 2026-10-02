import assert from 'node:assert/strict';
import test from 'node:test';
import { rebuildSelfPracticeAnswerSource, packageSelfPracticeAnalysis, projectSelfPracticeAnalysis } from '../../ivoc/self-practice-analysis.mjs';
import { mapSelfPracticeAnswerSegments, isSelfPracticeAnswerSource } from '../../ivoc/answer-source.mjs';
import { normalizeAnalysis } from '../../ivoc/context-provider.mjs';
import { CONTEXT_RESULT_SCHEMA, deriveCoachCommand } from '../../../ivprep-v6/public/ivoc-standalone/app/context-contracts.mjs';

const sid = '00000000-0000-4000-8000-000000000001';
const pid = '00000000-0000-4000-8000-000000000002';
const cid = '00000000-0000-4000-8000-000000000003';
const stamp = '2026-10-02T01:00:00.000Z';
function fixture() {
  const prompt = { schema: 'ivoc.self-practice-prompt.v1', workflow: 'SELF_PRACTICE', questionId: 'CORE-10',
    version: 2, text: 'Tell me about an error.', approval: 'ACTIVE_AT_SELECTION', issuedAt: stamp };
  const session = { id: sid, owner_subject: 'wp:1', state: 'saved', session_type: 'question', interviewer_provider: 'missionmed-static',
    question_id: prompt.questionId, question_text: prompt.text,
    context: { targetQuestions: 1, questionIds: [prompt.questionId], promptReceipt: prompt } };
  const parentRecording = { id: pid, session_id: sid, owner_subject: 'wp:1', recording_role: 'conversation', status: 'saved',
    storage_object_key: 'private/conversation-key', size_bytes: 5000, etag: 'parent-etag', sealed_at: stamp,
    mime_type: 'video/webm', duration_ms: 1500, paused_spans: [], recording_timebase: {
      clock: 'browser-monotonic-session', recordingId: pid, sessionId: sid, ownerSubject: 'wp:1',
      recordingStartSessionMs: 100, recordingDurationMs: 1500, playableDurationMs: 1500, pausedSpans: [] } };
  const sourceRecording = { id: cid, session_id: sid, owner_subject: 'wp:1', recording_role: 'candidate_audio', parent_recording_id: pid,
    status: 'saved', storage_object_key: 'private/candidate-key', mime_type: 'audio/webm', size_bytes: 1000, etag: 'source-etag',
    sealed_at: stamp, duration_ms: 1000, paused_spans: [], capture_receipt: {
      schema: 'ivoc.candidate-audio.v1', captureVersion: 'direct-mic-v1', status: 'SEALED', recordingId: cid,
      parentRecordingId: pid, sessionId: sid, allocatedAt: stamp, sealedAt: stamp, assurance: 'CLIENT_MIC_CAPTURE_DECLARATION',
      analysisEligibility: 'UNVERIFIED', sizeBytes: 1000, etag: 'source-etag', mime: 'audio/webm', timing: {
        clock: 'browser-monotonic-session', clientAttested: true, recordingStartSessionMs: 200,
        recordingDurationMs: 1000, playableDurationMs: 1000, pausedSpans: [] } } };
  return { session, sourceRecording, parentRecording };
}
function providerResult(answerSource, { segments = [{ id: 'seg-1', startMs: 0, endMs: 400, text: 'I omitted a check.' },
  { id: 'seg-2', startMs: 500, endMs: 900, text: 'My senior caught it.' }] } = {}) {
  const mapping = mapSelfPracticeAnswerSegments({ answerSource, segments });
  const transcriptSegments = segments.map((segment, index) => ({ id: segment.id, text: segment.text, speaker: 'STUDENT', final: true,
    startMs: mapping.segments[index].replayMedia.startMs, endMs: mapping.segments[index].replayMedia.endMs,
    sourceRange: mapping.segments[index].sourceMedia, sessionRange: mapping.segments[index].session }));
  const text = transcriptSegments.map(segment => segment.text).join(' ');
  const transcript = { status: 'AVAILABLE', transcriptId: '00000000-0000-4000-8000-000000000004', truthLabel: 'REAL',
    provider: 'openai', model: 'whisper-1', adapter: 'openai-batch-transcription', timestamps: 'FINAL_SEGMENTS',
    text, wordCount: text.split(/\s+/u).length, segments: transcriptSegments, mapping,
    sourceBinding: { status: 'SOURCE_BOUND', sourceRecordingId: cid, replayRecordingId: pid, assurance: 'CLIENT_MIC_CAPTURE_DECLARATION' } };
  const analysis = normalizeAnalysis({ questionIntent: { label: 'BEHAVIORAL', score: .9 },
    answerStage: { label: 'COMPLETE', score: .8 }, score: .7, coverage: .8, contextTags: ['FAILURE_LEARNING'], limitations: [],
    semanticObservations: [{ kind: 'SUPPORTED_CLAIM', text: 'Names an omitted check.', transcriptSegmentIds: ['seg-1'] }],
    coachingPatterns: [{ facet: 'specificity', polarity: 'strength', text: 'Identifies the concrete action.', transcriptSegmentIds: ['seg-1'] }] },
  { sessionId: sid, answerId: 'answer-1', transcript, durationMs: 1000, model: 'semantic-model' });
  const boundedAnalysis = { ...analysis, range: { startMs: transcriptSegments[0].startMs, endMs: transcriptSegments.at(-1).endMs } };
  const coachCommand = deriveCoachCommand({ sessionId: sid, answerId: 'answer-1', issuedAtMs: 1000,
    transcript, analysis: boundedAnalysis, analyticsObservations: [], idFactory: () => 'coach-1' });
  return { schema: CONTEXT_RESULT_SCHEMA, sessionId: sid, answerId: 'answer-1', question: {
    questionId: answerSource.prompt.questionId, revision: answerSource.prompt.version, canonicalText: answerSource.prompt.text },
  transcript, analysis: boundedAnalysis, coachCommand, analyticsObservations: [], masterDerived: null };
}
function ready() {
  const rows = fixture(); const answerSource = rebuildSelfPracticeAnswerSource(rows);
  const result = providerResult(answerSource);
  const envelope = packageSelfPracticeAnalysis({ ...rows, answerSource, result, createdAt: stamp });
  return { rows, answerSource, result, envelope };
}

test('PostgREST UTC timestamp spelling preserves custody, seal digests and cold readback', () => {
  const { rows, envelope } = ready();
  for (const timestamp of ['2026-10-02T01:00:00+00:00', '2026-10-02T01:00:00.0+00:00',
    '2026-10-02T01:00:00.000000+00:00', '2026-10-02T01:00:00.000000Z']) {
    for (const keys of [['sourceRecording'], ['parentRecording'], ['sourceRecording', 'parentRecording']]) {
      const stored = structuredClone(rows);
      for (const key of keys) stored[key].sealed_at = timestamp;
      const before = structuredClone(stored);
      const answerSource = rebuildSelfPracticeAnswerSource(stored);
      const packaged = packageSelfPracticeAnalysis({ ...stored, answerSource, result: providerResult(answerSource), createdAt: stamp });
      assert.equal(packaged.receipt.sourceSealDigest, envelope.receipt.sourceSealDigest);
      assert.equal(packaged.receipt.replaySealDigest, envelope.receipt.replaySealDigest);
      assert.equal(projectSelfPracticeAnalysis({ ...stored, candidateAnalysis: envelope }).available, true);
      assert.deepEqual(stored, before);
    }
  }
});

test('timestamp normalization rejects changed instants, malformed dates and precision loss', () => {
  for (const timestamp of ['2026-10-02T01:00:00.001+00:00', '2026-10-02T01:00:00.000001+00:00',
    '2026-02-30T01:00:00.000+00:00', '2026-10-02T25:00:00.000+00:00',
    '2026-10-02 01:00:00+00:00', '2026-10-02T01:00:00', 'not a timestamp', null]) {
    const rows = fixture(); rows.sourceRecording.sealed_at = timestamp;
    assert.throws(() => rebuildSelfPracticeAnswerSource(rows), /CUSTODY_INVALID/);
  }
  const rows = fixture();
  rows.sourceRecording.sealed_at = '2026-10-02T01:00:00.001+00:00';
  rows.sourceRecording.capture_receipt.sealedAt = '2026-10-02T01:00:00.001Z';
  const answerSource = rebuildSelfPracticeAnswerSource(rows);
  assert.throws(() => packageSelfPracticeAnalysis({ ...rows, answerSource, result: providerResult(answerSource), createdAt: stamp }), /ENVELOPE_IDENTITY_INVALID/);
  rows.sourceRecording.capture_receipt.allocatedAt = '2026-10-02T01:00:00.002Z';
  assert.throws(() => rebuildSelfPracticeAnswerSource(rows), /CUSTODY_INVALID/);
});

test('rebuild uses historical prompt and immutable parent seal clone, never mutable Results timing', () => {
  const rows = fixture(); const before = structuredClone(rows);
  const source = rebuildSelfPracticeAnswerSource(rows);
  assert.equal(isSelfPracticeAnswerSource(source), true);
  assert.equal(Object.isFrozen(source.replayMap.pausedSpans), true);
  assert.equal(source.prompt.version, 2);
  rows.parentRecording.recording_timebase.recordingStartSessionMs = 999;
  assert.equal(source.replayMap.recordingStartSessionMs, 100);
  assert.equal(before.parentRecording.recording_timebase.recordingStartSessionMs, 100);
});

test('package and saved-column read preserve replay timestamps exactly once, exact prompt and safe projections', () => {
  const { rows, answerSource, result, envelope } = ready();
  const before = structuredClone({ rows, result });
  assert.deepEqual(envelope.receipt.promptReceipt, rows.session.context.promptReceipt);
  assert.equal(envelope.receipt.status, 'SOURCE_BOUND');
  assert.equal(envelope.result.transcript.segments[0].startMs, 100);
  const projection = projectSelfPracticeAnalysis({ ...rows, candidateAnalysis: JSON.parse(JSON.stringify(envelope)) });
  assert.equal(projection.available, true);
  assert.equal(projection.result.transcript.segments[0].startMs, 100);
  assert.equal(projection.spine.turns.length, 2);
  assert.equal(projection.spine.turns.every(turn => turn.speaker === 'student'), true);
  assert.deepEqual(projection.setupPrompt, rows.session.context.promptReceipt);
  assert.equal(projection.setupPrompt.t_asked_ms, undefined);
  assert.equal(projection.spine.segments[0].mediaRef, `recording:${pid}`);
  assert.equal(projection.spine.segments[0].answer.t_start_ms, 100);
  assert.equal(projection.spine.segments[0].question.asked_turn_id, undefined);
  assert.equal(projection.spine.evidence[0].refs[0].ref, `transcript:${result.transcript.transcriptId}#seg-1`);
  assert.equal(projection.sourceBinding.biometricIdentity, 'UNVERIFIED');
  assert.equal(projection.sourceBinding.analysisEligibility, 'UNVERIFIED');
  assert.equal(JSON.stringify(projection).includes('private/candidate-key'), false);
  assert.equal(JSON.stringify(projection).includes('private/conversation-key'), false);
  assert.equal(projection.sourceBinding.status, 'SOURCE_BOUND');
  assert.equal(JSON.stringify(projection).includes(':"VERIFIED"'), false);
  assert.deepEqual({ rows, result }, before);
  assert.equal(answerSource.custody, 'SEALED');
});

test('missing historical prompt/parent seal maps, AI and wrong owner/source rows never rebuild', () => {
  const mutations = [f => { delete f.session.context.promptReceipt; }, f => { delete f.parentRecording.recording_timebase; },
    f => { delete f.parentRecording.recording_timebase.recordingStartSessionMs; },
    f => { f.session.interviewer_provider = 'openai-gpt-live'; }, f => { f.sourceRecording.owner_subject = 'wp:2'; },
    f => { f.parentRecording.session_id = cid; }, f => { f.sourceRecording.recording_role = 'conversation'; },
    f => { f.session.context.promptReceipt.privatePack = 'private'; }];
  for (const mutate of mutations) { const rows = fixture(); mutate(rows); assert.throws(() => rebuildSelfPracticeAnswerSource(rows)); }
});

test('package rejects unbranded sources, unavailable/test transcripts and mismatched prompt/session identities', () => {
  const mutations = [r => { r.sessionId = cid; }, r => { r.question.questionId = 'CORE-01'; },
    r => { r.question.revision = 3; }, r => { r.question.canonicalText = 'Different prompt'; },
    r => { r.transcript.truthLabel = 'TEST DATA'; }, r => { r.transcript.status = 'UNAVAILABLE'; },
    r => { r.analysis.sessionId = cid; }, r => { r.analysis.answerId = 'other'; },
    r => { r.candidateAttribution = { status: 'VERIFIED' }; }];
  for (const mutate of mutations) { const { rows, answerSource, result } = ready(); const changed = structuredClone(result); mutate(changed);
    assert.throws(() => packageSelfPracticeAnalysis({ ...rows, answerSource, result: changed, createdAt: stamp })); }
  const { rows, answerSource, result } = ready();
  assert.throws(() => packageSelfPracticeAnalysis({ ...rows, answerSource: structuredClone(answerSource), result, createdAt: stamp }));
  assert.throws(() => packageSelfPracticeAnalysis({ ...rows, answerSource, result, createdAt: 'yesterday' }));
  rows.session.interviewer_provider = 'openai-gpt-live';
  assert.throws(() => packageSelfPracticeAnalysis({ ...rows, answerSource, result, createdAt: stamp }));
});

test('package rejects wrong source, double-shifted replay, source/session ranges, absent mapping and invalid citations', () => {
  const mutations = [r => { r.transcript.sourceBinding.sourceRecordingId = pid; },
    r => { r.transcript.segments[0].startMs += 100; }, r => { r.transcript.segments[0].sourceRange.endMs += 1; },
    r => { r.transcript.mapping.segments[0].session.startMs += 1; }, r => { delete r.transcript.mapping; },
    r => { r.transcript.segments.reverse(); }, r => { r.transcript.wordCount += 1; },
    r => { r.transcript.text += ' fabricated'; }, r => { r.analysis.range.startMs = 0; },
    r => { r.analysis.semanticObservations[0].transcriptSegmentIds = ['missing']; },
    r => { r.analysis.coachingPatterns[0].transcriptSegmentIds = ['missing']; },
    r => { r.analysis.coachingPatterns[0].text = 'The candidate is dishonest.'; }];
  for (const mutate of mutations) { const { rows, answerSource, result } = ready(); const changed = structuredClone(result); mutate(changed);
    assert.throws(() => packageSelfPracticeAnalysis({ ...rows, answerSource, result: changed, createdAt: stamp })); }
});

test('legacy/client-shaped/mismatched saved envelopes project unavailable, never raw result fallback', () => {
  const { rows, envelope } = ready();
  for (const candidateAnalysis of [null, envelope.result, { contextResult: envelope.result }, { receipt: { status: 'SOURCE_BOUND' }, result: envelope.result }]) {
    assert.equal(projectSelfPracticeAnalysis({ ...rows, candidateAnalysis }).available, false);
  }
  const mutations = [e => { e.receipt.ownerSubject = 'wp:2'; }, e => { e.receipt.sessionId = cid; },
    e => { e.receipt.sourceRecordingId = pid; }, e => { e.receipt.replayRecordingId = cid; },
    e => { e.receipt.promptReceipt.version += 1; }, e => { e.receipt.sourceSealDigest = 'fake'; },
    e => { e.receipt.replaySealDigest = 'fake'; }, e => { e.receipt.status = 'VERIFIED'; },
    e => { e.result.transcript.mapping.segments[0].replayMedia.startMs += 1; },
    e => { e.result.privateObjectKey = 'private'; }];
  for (const mutate of mutations) { const changed = structuredClone(envelope); mutate(changed);
    const projection = projectSelfPracticeAnalysis({ ...rows, candidateAnalysis: changed });
    assert.equal(projection.available, false); assert.equal(projection.result, null); assert.equal(projection.spine, null); }
});

test('changing sealed source/parent object identity or immutable timing invalidates saved analysis', () => {
  const mutations = [f => { f.sourceRecording.etag = f.sourceRecording.capture_receipt.etag = 'new'; },
    f => { f.parentRecording.etag = 'new'; }, f => { f.sourceRecording.storage_object_key = 'private/replaced'; },
    f => { f.parentRecording.recording_timebase.recordingStartSessionMs = 101; },
    f => { f.session.context.promptReceipt.issuedAt = '2026-10-02T00:59:59.000Z'; }];
  for (const mutate of mutations) { const { rows, envelope } = ready(); mutate(rows);
    assert.equal(projectSelfPracticeAnalysis({ ...rows, candidateAnalysis: envelope }).available, false); }
});

test('whitelist strips unknown private provider metadata; nested non-scalar metadata rejects', () => {
  const { rows, answerSource, result } = ready();
  result.transcript.provenance = { storageObjectKey: 'private/candidate-key' };
  result.analysis.privatePack = { secret: 'private' };
  result.privateObjectKey = 'private/conversation-key';
  const envelope = packageSelfPracticeAnalysis({ ...rows, answerSource, result, createdAt: stamp });
  assert.equal(JSON.stringify(envelope.result).includes('private'), false);
  result.transcript.provider = { storageObjectKey: 'private' };
  assert.throws(() => packageSelfPracticeAnalysis({ ...rows, answerSource, result, createdAt: stamp }));
});

test('source-only pause creates explicit separate answer spans; no broad range bridges removed source time', () => {
  const rows = fixture(); const pauses = [{ startMs: 500, endMs: 700 }];
  rows.sourceRecording.paused_spans = pauses; rows.sourceRecording.capture_receipt.timing.pausedSpans = pauses;
  const answerSource = rebuildSelfPracticeAnswerSource(rows);
  const result = providerResult(answerSource, { segments: [
    { id: 'seg-1', startMs: 0, endMs: 300, text: 'I omitted a check.' },
    { id: 'seg-2', startMs: 300, endMs: 900, text: 'My senior caught it.' }] });
  const envelope = packageSelfPracticeAnalysis({ ...rows, answerSource, result, createdAt: stamp });
  const projection = projectSelfPracticeAnalysis({ ...rows, candidateAnalysis: envelope });
  assert.equal(projection.available, true);
  assert.equal(projection.spine.segments.length, 2);
  assert.equal(projection.spine.segments[0].answer.t_end_ms, 400);
  assert.equal(projection.spine.segments[1].answer.t_start_ms, 600);
});

test('available source transcript with unavailable semantic analysis exposes no fabricated coaching rows', () => {
  const { rows, answerSource, result } = ready();
  result.analysis = { status: 'UNAVAILABLE', reason: 'CONTEXT_PROVIDER_TIMEOUT' };
  result.coachCommand = deriveCoachCommand({ sessionId: sid, answerId: 'answer-1', issuedAtMs: 1000,
    transcript: result.transcript, analysis: result.analysis, idFactory: () => 'coach-1' });
  const envelope = packageSelfPracticeAnalysis({ ...rows, answerSource, result, createdAt: stamp });
  const projection = projectSelfPracticeAnalysis({ ...rows, candidateAnalysis: envelope });
  assert.equal(projection.available, true); assert.deepEqual(projection.spine.evidence, []);
  assert.equal(projection.result.analysis.status, 'UNAVAILABLE');
});
