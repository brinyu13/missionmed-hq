import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSelfPracticePrompt, validateSelfPracticeAnswerSource, mapSelfPracticeAnswerSegments } from '../../ivoc/answer-source.mjs';

const sessionId = '00000000-0000-4000-8000-000000000001';
const parentId = '00000000-0000-4000-8000-000000000002';
const sourceId = '00000000-0000-4000-8000-000000000003';
const stamp = '2026-10-02T01:00:00.000Z';
const freezeMap = map => Object.freeze({ ...map,
  pausedSpans: Object.freeze(map.pausedSpans.map(span => Object.freeze({ ...span }))) });
function fixture({ sourceStart = 200, parentStart = 100, sourceDuration = 1000,
  parentDuration = 1500, sourcePauses = [], parentPauses = [] } = {}) {
  const session = { id: sessionId, owner_subject: 'wp:1', state: 'saved', session_type: 'question',
    interviewer_provider: 'missionmed-static', question_id: 'CORE-10', question_text: 'Tell me about an error.',
    context: { targetQuestions: 1, questionIds: ['CORE-10'], promptReceipt: {
      schema: 'ivoc.self-practice-prompt.v1', workflow: 'SELF_PRACTICE', questionId: 'CORE-10', version: 2,
      text: 'Tell me about an error.', approval: 'ACTIVE_AT_SELECTION', issuedAt: stamp } } };
  const question = { status: 'active', question_id: 'CORE-10', current_version: 2, canonical_text: session.question_text };
  const parentRecording = { id: parentId, owner_subject: 'wp:1', session_id: sessionId, recording_role: 'conversation',
    status: 'saved', storage_object_key: 'private/full-conversation', size_bytes: 1000, etag: 'parent-etag', sealed_at: stamp,
    duration_ms: parentDuration, paused_spans: structuredClone(parentPauses) };
  const sourceRecording = { id: sourceId, owner_subject: 'wp:1', session_id: sessionId, parent_recording_id: parentId,
    recording_role: 'candidate_audio', status: 'saved', storage_object_key: 'private/mic-only', mime_type: 'audio/webm',
    size_bytes: 500, etag: 'source-etag', sealed_at: stamp, duration_ms: sourceDuration,
    paused_spans: structuredClone(sourcePauses), capture_receipt: {
      schema: 'ivoc.candidate-audio.v1', captureVersion: 'direct-mic-v1', status: 'SEALED',
      recordingId: sourceId, parentRecordingId: parentId, sessionId, allocatedAt: stamp, sealedAt: stamp,
      assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', analysisEligibility: 'UNVERIFIED',
      sizeBytes: 500, mime: 'audio/webm', etag: 'source-etag', timing: {
        clock: 'browser-monotonic-session', clientAttested: true, recordingStartSessionMs: sourceStart,
        recordingDurationMs: sourceDuration, playableDurationMs: sourceDuration, pausedSpans: structuredClone(sourcePauses) } } };
  const parentTimebase = freezeMap({ recordingId: parentId, sessionId, ownerSubject: 'wp:1',
    clock: 'browser-monotonic-session', recordingStartSessionMs: parentStart,
    recordingDurationMs: parentDuration, playableDurationMs: parentDuration, pausedSpans: parentPauses });
  return { actor: 'wp:1', workflow: 'SELF_PRACTICE', session, question, sourceRecording, parentRecording, parentTimebase };
}
function validated(input) {
  return validateSelfPracticeAnswerSource({ ...input, promptReceipt: resolveSelfPracticePrompt(input) });
}
const segment = (startMs = 0, endMs = 1000, id = 's1') => ({ id, startMs, endMs });

test('owned sealed stem maps independent source/session/replay offsets without creating a spoken question', () => {
  const input = fixture(); const before = structuredClone(input);
  const answerSource = validated(input);
  const result = mapSelfPracticeAnswerSegments({ answerSource, segments: [segment()] });
  assert.deepEqual(result.segments[0], { id: 's1', sourceRecordingId: sourceId, replayRecordingId: parentId,
    sourceMedia: { startMs: 0, endMs: 1000 }, session: { startMs: 200, endMs: 1200 }, replayMedia: { startMs: 100, endMs: 1100 } });
  assert.equal(answerSource.custody, 'SEALED');
  assert.equal(answerSource.analysisEligibility, 'UNVERIFIED');
  assert.equal(answerSource.biometricIdentity, 'UNVERIFIED');
  assert.equal(answerSource.prompt.version, 2);
  assert.equal(result.questionTurn, undefined); assert.equal(result.prompt.t_asked_ms, undefined);
  assert.equal(Object.isFrozen(result.segments[0].session), true);
  assert.equal(JSON.stringify(answerSource).includes('private/mic-only'), false);
  assert.equal(JSON.stringify(answerSource).includes('private/full-conversation'), false);
  assert.deepEqual(input, before);
});

test('historical approved snapshot remains exact; latest question cannot silently replace it', () => {
  const input = fixture(); input.session.context.promptReceipt.privatePack = 'must-not-project';
  const prompt = resolveSelfPracticePrompt(input);
  assert.equal(prompt.privatePack, undefined); assert.equal(prompt.version, 2);
  assert.throws(() => resolveSelfPracticePrompt({ ...input, question: { ...input.question, current_version: 3 } }), /PROMPT_UNPROVEN/);
  assert.throws(() => resolveSelfPracticePrompt({ ...input, question: { ...input.question, canonical_text: 'New wording' } }), /PROMPT_UNPROVEN/);
});

test('serialized or invented prompt/source contracts cannot impersonate in-process server resolution', () => {
  const input = fixture(); const prompt = resolveSelfPracticePrompt(input);
  for (const promptReceipt of [input.session.context.promptReceipt, structuredClone(prompt), { ...prompt }, null]) {
    assert.throws(() => validateSelfPracticeAnswerSource({ ...input, promptReceipt }), /PROMPT_UNPROVEN/);
  }
  const answerSource = validated(input);
  assert.throws(() => mapSelfPracticeAnswerSegments({ answerSource: structuredClone(answerSource), segments: [segment()] }), /SOURCE_UNPROVEN/);
});

test('AI, multiple questions, wrong owner, workflow and absent historical prompt deny', () => {
  const mutations = [
    f => { f.actor = 'wp:2'; }, f => { f.workflow = 'AI_MOCK'; },
    f => { f.session.interviewer_provider = 'openai-gpt-live'; }, f => { f.session.session_type = 'mock'; },
    f => { f.session.context.targetQuestions = 2; }, f => { f.session.context.questionIds.push('CORE-01'); },
    f => { delete f.session.context.promptReceipt; }, f => { f.session.context.promptReceipt.version = 0; },
    f => { f.session.context.promptReceipt.approval = 'DRAFT'; }, f => { f.question.status = 'retired'; },
    f => { f.session.question_text = 'Wrong prompt'; }, f => { f.question.question_id = 'CORE-01'; },
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); assert.throws(() => validated(f)); }
});

test('prompt snapshot mutation after resolution denies rather than reusing stale authority', () => {
  for (const [key, value] of [['version', 3], ['text', 'different'], ['approval', 'DRAFT'], ['issuedAt', '2026-10-02T02:00:00.000Z']]) {
    const f = fixture(); const promptReceipt = resolveSelfPracticePrompt(f);
    f.session.context.promptReceipt[key] = value;
    assert.throws(() => validateSelfPracticeAnswerSource({ ...f, promptReceipt }), /PROMPT_UNPROVEN/);
  }
});

test('mixed, legacy, cross-owner/session/parent, unsealed or forged custody rows deny', () => {
  const mutations = [
    f => { f.sourceRecording.recording_role = 'conversation'; }, f => { delete f.parentRecording.recording_role; },
    f => { f.sourceRecording.owner_subject = 'wp:2'; }, f => { f.parentRecording.owner_subject = 'wp:2'; },
    f => { f.sourceRecording.session_id = parentId; }, f => { f.sourceRecording.parent_recording_id = sessionId; },
    f => { f.sourceRecording.status = 'uploading'; }, f => { f.parentRecording.status = 'uploading'; },
    f => { f.session.state = 'active'; }, f => { f.sourceRecording.capture_receipt.analysisEligibility = 'VERIFIED'; },
    f => { f.sourceRecording.capture_receipt.status = 'ALLOCATED'; }, f => { f.sourceRecording.capture_receipt.captureVersion = 'legacy'; },
    f => { f.sourceRecording.capture_receipt.recordingId = parentId; }, f => { f.sourceRecording.capture_receipt.sessionId = parentId; },
    f => { f.sourceRecording.capture_receipt.etag = 'forged'; }, f => { f.sourceRecording.capture_receipt.sizeBytes = 2; },
    f => { f.sourceRecording.capture_receipt.mime = 'video/webm'; }, f => { f.sourceRecording.mime_type = 'video/webm'; },
    f => { f.sourceRecording.capture_receipt.timing.clientAttested = false; }, f => { delete f.sourceRecording.capture_receipt; },
    f => { f.sourceRecording.storage_object_key = f.parentRecording.storage_object_key; },
    f => { f.sourceRecording.capture_receipt.allocatedAt = '2027-10-02T01:00:00.000Z'; },
    f => { f.sourceRecording.capture_receipt.allocatedAt = '2026-10-01T01:00:00.000Z'; },
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); assert.throws(() => validated(f)); }
});

test('missing fields, mutable parent map, mismatched identities/durations and malformed pauses deny', () => {
  const mutations = [
    f => { delete f.parentTimebase; }, f => { f.parentTimebase = { ...f.parentTimebase }; },
    f => { f.parentTimebase = Object.freeze({ ...f.parentTimebase, pausedSpans: [] }); },
    f => { f.parentTimebase = Object.freeze({ ...f.parentTimebase, pausedSpans: Object.freeze([{ startMs: 300, endMs: 400 }]) }); },
    f => { f.parentTimebase = freezeMap({ ...f.parentTimebase, recordingId: sourceId }); },
    f => { f.parentTimebase = freezeMap({ ...f.parentTimebase, ownerSubject: 'wp:2' }); },
    f => { f.parentTimebase = freezeMap({ ...f.parentTimebase, sessionId: sourceId }); },
    f => { f.parentTimebase = freezeMap({ ...f.parentTimebase, clock: 'wall' }); },
    f => { delete f.sourceRecording.capture_receipt.timing.recordingStartSessionMs; },
    f => { delete f.sourceRecording.capture_receipt.timing.playableDurationMs; },
    f => { f.sourceRecording.capture_receipt.timing.recordingStartSessionMs = '200'; },
    f => { f.sourceRecording.capture_receipt.timing.recordingDurationMs = 0; },
    f => { f.sourceRecording.duration_ms = 999; }, f => { f.parentRecording.duration_ms = 1499; },
    f => { f.sourceRecording.capture_receipt.timing.pausedSpans = [{ startMs: 300, endMs: null }]; },
    f => { f.sourceRecording.capture_receipt.timing.pausedSpans = [{ startMs: 300, endMs: 400 }, { startMs: 350, endMs: 450 }]; },
    f => { f.sourceRecording.capture_receipt.timing.pausedSpans = [{ startMs: 1300, endMs: 1400 }]; },
    f => { f.sourceRecording.capture_receipt.timing.pausedSpans = [{ startMs: 300, endMs: 300 }]; },
    f => { f.sourceRecording.paused_spans = [{ startMs: 300, endMs: 400 }]; },
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f); assert.throws(() => validated(f)); }
});

test('source pause must be split; matching parent removal preserves both edge meanings', () => {
  const answerSource = validated(fixture({ sourceStart: 100, parentStart: 0,
    sourcePauses: [{ startMs: 400, endMs: 600 }], parentPauses: [{ startMs: 400, endMs: 600 }] }));
  assert.throws(() => mapSelfPracticeAnswerSegments({ answerSource, segments: [segment(200, 400)] }), /SOURCE_PAUSE_CROSSING/);
  const result = mapSelfPracticeAnswerSegments({ answerSource, segments: [segment(0, 300, 'before'), segment(300, 1000, 'after')] });
  assert.deepEqual(result.segments[0].session, { startMs: 100, endMs: 400 });
  assert.deepEqual(result.segments[1].session, { startMs: 600, endMs: 1300 });
  assert.deepEqual(result.segments[0].replayMedia, { startMs: 100, endMs: 400 });
  assert.deepEqual(result.segments[1].replayMedia, { startMs: 400, endMs: 1100 });
});

test('parent-only removed interval rejects unsplit and missing audio; correctly separated parts map', () => {
  const answerSource = validated(fixture({ sourceStart: 100, parentStart: 0, parentPauses: [{ startMs: 400, endMs: 600 }] }));
  for (const part of [segment(0, 600), segment(300, 500), segment(350, 450)]) {
    assert.throws(() => mapSelfPracticeAnswerSegments({ answerSource, segments: [part] }), /REPLAY_PAUSE_CROSSING/);
  }
  const result = mapSelfPracticeAnswerSegments({ answerSource, segments: [segment(0, 300, 'before'), segment(500, 1000, 'after')] });
  assert.deepEqual(result.segments[1].session, { startMs: 600, endMs: 1100 });
  assert.deepEqual(result.segments[1].replayMedia, { startMs: 400, endMs: 900 });
});

test('source-only removed interval requires split and retains real replay gap', () => {
  const answerSource = validated(fixture({ sourceStart: 100, parentStart: 0, sourcePauses: [{ startMs: 400, endMs: 600 }] }));
  const result = mapSelfPracticeAnswerSegments({ answerSource, segments: [segment(0, 300, 'before'), segment(300, 900, 'after')] });
  assert.equal(result.segments[0].replayMedia.endMs, 400);
  assert.equal(result.segments[1].replayMedia.startMs, 600);
});

test('multiple pauses preserve edge-specific mapping and never manufacture gap-spanning answers', () => {
  const pauses = [{ startMs: 300, endMs: 400 }, { startMs: 600, endMs: 800 }];
  const answerSource = validated(fixture({ sourceStart: 100, parentStart: 0, sourcePauses: pauses, parentPauses: pauses }));
  const mapped = mapSelfPracticeAnswerSegments({ answerSource,
    segments: [segment(0, 200, 'first'), segment(200, 400, 'second'), segment(400, 1000, 'third')] });
  assert.deepEqual(mapped.segments.map(s => s.session), [
    { startMs: 100, endMs: 300 }, { startMs: 400, endMs: 600 }, { startMs: 800, endMs: 1400 }]);
  assert.deepEqual(mapped.segments.map(s => s.replayMedia), [
    { startMs: 100, endMs: 300 }, { startMs: 300, endMs: 500 }, { startMs: 500, endMs: 1100 }]);
  assert.throws(() => mapSelfPracticeAnswerSegments({ answerSource, segments: [segment(200, 500)] }), /SOURCE_PAUSE_CROSSING/);
});

test('computed session end overflow and unbounded part lists reject', () => {
  const f = fixture(); f.sourceRecording.capture_receipt.timing.recordingStartSessionMs = 43_200_000;
  assert.throws(() => validated(f), /TIMEBASE_RANGE_INVALID/);
  const answerSource = validated(fixture());
  assert.throws(() => mapSelfPracticeAnswerSegments({ answerSource,
    segments: Array.from({ length: 41 }, (_, index) => segment(index, index + 1, `s${index}`)) }), /SEGMENTS_INVALID/);
});

test('invalid segment IDs/units/order/overlap/ranges reject whole mapping without clamping', () => {
  const answerSource = validated(fixture());
  for (const segments of [[], [segment(-1, 2)], [segment(1.5, 3)], [segment(0, 1001)],
    [segment(10, 10)], [segment(20, 10)], [segment(0, 20, ' same ')], [segment(0, 20, 'x'.repeat(97))],
    [segment(0, 20, 'same'), segment(20, 30, 'same')], [segment(0, 20), segment(19, 30, 's2')],
    [segment(20, 30), segment(0, 10, 's2')], [segment(0, 10), segment(10, 1001, 'bad')]]) {
    assert.throws(() => mapSelfPracticeAnswerSegments({ answerSource, segments }));
  }
});

test('source before replay or beyond parent playable duration denies; exact end boundary succeeds', () => {
  const before = validated(fixture({ sourceStart: 0, parentStart: 100 }));
  assert.throws(() => mapSelfPracticeAnswerSegments({ answerSource: before, segments: [segment(0, 50)] }), /REPLAY_RANGE_INVALID/);
  const end = validated(fixture({ sourceStart: 200, parentStart: 100, parentDuration: 1100 }));
  assert.equal(mapSelfPracticeAnswerSegments({ answerSource: end, segments: [segment()] }).segments[0].replayMedia.endMs, 1100);
  const tooLong = validated(fixture({ parentDuration: 1099 }));
  assert.throws(() => mapSelfPracticeAnswerSegments({ answerSource: tooLong, segments: [segment()] }), /REPLAY_RANGE_INVALID/);
});

test('explicit null playable duration is not missing; no rescaling when measured playable differs', () => {
  const f = fixture(); f.sourceRecording.capture_receipt.timing.playableDurationMs = null;
  const input = { ...f.parentTimebase, playableDurationMs: null }; f.parentTimebase = freezeMap(input);
  assert.equal(mapSelfPracticeAnswerSegments({ answerSource: validated(f), segments: [segment()] }).segments.length, 1);
  f.sourceRecording.capture_receipt.timing.playableDurationMs = 900; f.sourceRecording.duration_ms = 900;
  const answerSource = validated(f);
  assert.throws(() => mapSelfPracticeAnswerSegments({ answerSource, segments: [segment()] }), /SEGMENT_RANGE_INVALID/);
  assert.equal(mapSelfPracticeAnswerSegments({ answerSource, segments: [segment(0, 900)] }).segments[0].session.endMs, 1100);
});

test('validated source snapshot cannot be altered by later mutable input edits', () => {
  const f = fixture(); const answerSource = validated(f);
  f.sourceRecording.capture_receipt.timing.recordingStartSessionMs = 999;
  f.session.context.promptReceipt.text = 'Changed';
  const result = mapSelfPracticeAnswerSegments({ answerSource, segments: [segment()] });
  assert.equal(result.segments[0].session.startMs, 200);
  assert.equal(result.prompt.text, 'Tell me about an error.');
});
