import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contextResultFromSessionSpine,
  projectContextResults,
  projectTranscriptMetrics,
  projectInterviewerNameUse,
  normalizeNameUseCoaching,
  selfPracticeAnalysisAvailability,
  sourceBoundSelfPracticeResult,
} from '../../public/capabilities/context-results.mjs';

test('server-ready analysis is not requested yet, not falsely unavailable or already transcribed', () => {
  const detail = { id: 'own', sessionType: 'question', interviewerProvider: 'missionmed-static', recording: { id: 'replay' },
    analysisAvailability: { status: 'READY', workflow: 'SELF_PRACTICE', sessionId: 'own', replayRecordingId: 'replay' } };
  assert.deepEqual(contextResultFromSessionSpine(detail), {
    transcript: { status: 'UNAVAILABLE', reason: 'NOT_REQUESTED' },
    analysis: { status: 'UNAVAILABLE', reason: 'NOT_REQUESTED' },
  });
  for (const mutate of [d => { d.analysisAvailability.sessionId = 'other'; },
    d => { d.recording.id = 'other'; }, d => { d.interviewerProvider = 'openai-gpt-live'; },
    d => { d.analysisAvailability.status = 'UNAVAILABLE'; }]) {
    const copy = structuredClone(detail); mutate(copy);
    assert.equal(contextResultFromSessionSpine(copy).transcript.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
  }
});

test('source-bound self-practice projects server detail without claiming biometric verification or using browser envelopes', () => {
  const binding = { status: 'SOURCE_BOUND', assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', biometricIdentity: 'UNVERIFIED',
    sourceRecordingId: 'mic-1', replayRecordingId: 'replay-1' };
  const detail = { id: 'practice-1', sessionType: 'question', interviewerProvider: 'missionmed-static', questionId: 'CORE-01',
    questionText: 'Tell me about yourself.', recording: { id: 'replay-1' },
    analysisAvailability: { status: 'AVAILABLE', workflow: 'SELF_PRACTICE', sessionId: 'practice-1', replayRecordingId: 'replay-1' },
    spine: { sourceBinding: binding, candidateAttribution: { status: 'UNVERIFIED' } },
    contextAnalysis: { sessionId: 'practice-1', question: { questionId: 'CORE-01', canonicalText: 'Tell me about yourself.' },
      sourceBinding: binding, transcript: { status: 'AVAILABLE', segments: [{ id: 'seg-1', startMs: 125, endMs: 2100 }] } } };
  assert.equal(selfPracticeAnalysisAvailability(detail), 'AVAILABLE');
  assert.equal(contextResultFromSessionSpine(detail), detail.contextAnalysis);
  assert.equal(contextResultFromSessionSpine(detail).transcript.segments[0].startMs, 125);
  assert.equal(detail.spine.candidateAttribution.status, 'UNVERIFIED');
  for (const mutate of [d => { d.id = 'other'; }, d => { d.recording.id = 'other'; },
    d => { d.interviewerProvider = 'openai-gpt-live'; }, d => { d.questionText = 'Different'; },
    d => { d.contextAnalysis.sourceBinding.biometricIdentity = 'VERIFIED'; },
    d => { d.results = { payload: { contextAnalysis: d.contextAnalysis } }; delete d.contextAnalysis; },
    d => { d.analysisAvailability.status = 'READY'; }, d => { delete d.spine.sourceBinding; }]) {
    const changed = structuredClone(detail); mutate(changed);
    assert.equal(sourceBoundSelfPracticeResult(changed), null);
    assert.equal(contextResultFromSessionSpine(changed).transcript.status, 'UNAVAILABLE');
  }
});

const nameSession = (name = 'Dr. Élan') => ({ id: 'name-session', recording: { durationMs: 9000 },
  results: { payload: { sessionId: 'name-session', nameUseCoaching: { schema: 'ivoc.name-use.v1',
    enabled: true, name, source: 'manual', sessionId: 'name-session' } } },
  spine: { candidateAttribution: { status: 'VERIFIED' }, turns: [] } });
const nameTurn = (id, text, startMs = 0, endMs = 1000, speaker = 'student') => ({ speaker, startMs, endMs,
  transcript: { canonical_ref: `transcript:controlled-test#${id}`, text } });

test('possible name mentions use canonical student text and recording thirds, not interviewer speech', () => {
  const detail = nameSession();
  detail.spine.turns = [nameTurn('seg-1', 'Thank you, DR. E\u0301LAN.', 0, 1000),
    nameTurn('seg-2', 'Dr Élan, my contribution was coordinating follow-up.', 3100, 4000),
    nameTurn('seg-3', 'Thank you Dr. Élan.', 6100, 7000),
    nameTurn('seg-4', 'Dr Élan, what would you say?', 7100, 8000, 'interviewer'),
    { speaker: 'student', text: 'Dr. Élan', startMs: 8200, endMs: 8400 }];
  const view = projectInterviewerNameUse(JSON.parse(JSON.stringify(detail)));
  assert.equal(view.status, 'AVAILABLE'); assert.equal(view.source, 'manual');
  assert.deepEqual(view.matches.map(item => item.third), ['first', 'middle', 'final']);
  assert.deepEqual(view.matches.map(item => item.segmentId), ['seg-1', 'seg-2', 'seg-3']);
  assert.equal(view.matches[0].ref, 'transcript:controlled-test#seg-1');
  assert.match(view.limitation, /not word timestamps/);
  assert.equal(view.score, undefined); assert.equal(view.confidence, undefined);
});

test('unverified recording attribution suppresses name and semantic observations even with canonical-looking student labels', () => {
  const detail = nameSession(); detail.spine.turns = [nameTurn('seg-1', 'Thank you, Dr. Élan.')];
  for (const candidateAttribution of [undefined, { status: 'UNVERIFIED' }]) {
    detail.spine.candidateAttribution = candidateAttribution;
    assert.equal(projectInterviewerNameUse(detail).status, 'UNASSESSED');
    assert.equal(projectInterviewerNameUse(detail).reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
    assert.equal(contextResultFromSessionSpine(detail).transcript.status, 'UNAVAILABLE');
  }
  const result = contextResultFromSessionSpine(detail);
  assert.equal(result.transcript.status, 'UNAVAILABLE');
  assert.equal(result.transcript.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
  assert.equal(result.analysis.status, 'UNAVAILABLE');
});

test('name matching uses Unicode tokens, not substring or executable regex, and never guesses aliases', () => {
  for (const [name, text, expected] of [['Ann', 'Annette greeted me.', 0], ['Ann', 'Thanks, Ann!', 1],
    ['Dr. A+B', 'Thank you Dr A+B.', 1], ['Dr. A+B', 'Thanks Dr AAAAA B.', 0],
    ['李明', '谢谢李明同学', 0], ['李明', '谢谢，李明。', 1],
    ['Dr. Élan', 'Thank you Élan.', 0]]) {
    const detail = nameSession(name); detail.spine.turns = [nameTurn('seg-1', text)];
    assert.equal(projectInterviewerNameUse(detail).matches.length, expected);
  }
  assert.equal(normalizeNameUseCoaching({ schema: 'ivoc.name-use.v1', enabled: true, name: '123', source: 'manual' }), null);
});

test('missing opt-in, legacy, foreign envelope and ambiguous canonical refs remain unassessed', () => {
  const detail = nameSession(); detail.spine.turns = [nameTurn('seg-1', 'Dr. Élan')];
  const envelope = detail.results.payload;
  assert.equal(projectInterviewerNameUse({ ...detail, results: undefined }).status, 'UNASSESSED');
  assert.equal(projectInterviewerNameUse(null, envelope).status, 'UNASSESSED');
  assert.equal(projectInterviewerNameUse({ ...detail, id: 'another' }).status, 'UNASSESSED');
  assert.equal(projectInterviewerNameUse({ ...detail, results: { payload: { ...envelope,
    nameUseCoaching: { ...envelope.nameUseCoaching, enabled: false } } } }).status, 'UNASSESSED');
  for (const other of [detail.spine.turns[0], nameTurn('seg-1', 'Other text', 1000, 2000, 'interviewer'),
    { ...nameTurn('seg-1', 'Other'), transcript: { canonical_ref: 'transcript:other#seg-1', text: 'Other' } }]) {
    assert.equal(projectInterviewerNameUse({ ...detail, spine: { turns: [...detail.spine.turns, other] } }).status, 'UNASSESSED');
  }
  const distantDuplicate = [...detail.spine.turns,
    ...Array.from({ length: 128 }, (_, index) => nameTurn(`other-${index}`, 'Other text', 0, 100)), detail.spine.turns[0]];
  assert.equal(projectInterviewerNameUse({ ...detail, spine: { turns: distantDuplicate } }).matches.length, 0);
});

test('missing, invalid, out-of-duration and cross-third ranges never invent name timing', () => {
  for (const [startMs, endMs] of [[null, null], [undefined, undefined], ['', ''], [-1, 20], [0, 0],
    [0, 10000], [Infinity, Infinity]]) {
    const detail = nameSession(); detail.spine.turns = [nameTurn('seg-1', 'Dr. Élan', startMs, endMs)];
    // Explicit assignment preserves undefined instead of helper defaults.
    detail.spine.turns[0].startMs = startMs; detail.spine.turns[0].endMs = endMs;
    const match = projectInterviewerNameUse(detail).matches[0];
    assert.equal(match.third, null); assert.equal(match.startMs, null); assert.equal(match.endMs, null);
  }
  const detail = nameSession(); detail.spine.turns = [nameTurn('seg-1', 'Dr. Élan', 2000, 4000)];
  assert.equal(projectInterviewerNameUse(detail).matches[0].third, null);
  detail.recording.durationMs = null;
  assert.equal(projectInterviewerNameUse(detail).matches[0].startMs, null);
  detail.spine.turns = [nameTurn('seg-1', 'No exact name in this passage.')];
  assert.deepEqual(projectInterviewerNameUse(detail).matches, []);
});

test('canonical transcript metrics count bounded fillers and retain segment boundaries', () => {
  const metrics = projectTranscriptMetrics({ transcript: {
    status: 'AVAILABLE',
    text: 'Um, I mean, I learned to pause. Like, I can be more specific.',
    segments: [
      { id: 'seg-1', startMs: 450, endMs: 3_200 },
      { id: 'seg-2', startMs: 3_300, endMs: 6_750 },
    ],
  } });
  assert.equal(metrics.status, 'AVAILABLE');
  assert.equal(metrics.fillerTokenCount, 3);
  assert.equal(metrics.segmentCount, 2);
  assert.equal(metrics.startMs, 450);
  assert.equal(metrics.endMs, 6_750);
  assert.equal(metrics.basis, 'CANONICAL_PERSISTED_TRANSCRIPT');
});

test('canonical transcript metrics truthfully retain a zero filler count', () => {
  const metrics = projectTranscriptMetrics({ transcript: {
    status: 'AVAILABLE', text: 'I coordinated follow-up and explained the plan.', segments: [],
  } });
  assert.equal(metrics.fillerTokenCount, 0);
  assert.equal(metrics.wordCount, 7);
  assert.equal(metrics.startMs, null);
});

test('context results project cited strengths, improvements, a deterministic drill, and confidence', () => {
  const view = projectContextResults({ analysis: {
    status: 'AVAILABLE', score: 0.82, coverage: 0.91,
    coachingPatterns: [
      { facet: 'structure', polarity: 'strength', text: 'The answer has a clear opening.', transcriptSegmentIds: ['seg-1'] },
      { facet: 'specificity', polarity: 'weakness', text: 'The result remains general.', transcriptSegmentIds: ['seg-2', 'seg-3'] },
    ],
    limitations: ['Only the final answer transcript was analyzed.'],
  } });

  assert.equal(view.status, 'AVAILABLE');
  assert.equal(view.strongest.facetLabel, 'Structure');
  assert.equal(view.improvement.facetLabel, 'Specificity');
  assert.match(view.drill.text, /concrete action, decision, or outcome/);
  assert.deepEqual(view.drill.refs, ['seg-2', 'seg-3']);
  assert.equal(view.confidence.label, 'HIGH');
  assert.equal(view.confidence.coverage, 0.91);
  assert.deepEqual(view.confidence.limitations, ['Only the final answer transcript was analyzed.']);
});

test('context results never invent unsupported strengths, improvements, or drills', () => {
  const unavailable = projectContextResults({ analysis: { status: 'UNAVAILABLE' } });
  assert.deepEqual(unavailable, { status: 'UNAVAILABLE' });

  const view = projectContextResults({ analysis: {
    status: 'AVAILABLE', score: 0.4, coverage: 0.5, coachingPatterns: [], limitations: [],
  } });
  assert.equal(view.strongest, null);
  assert.equal(view.improvement, null);
  assert.equal(view.drill, null);
  assert.equal(view.confidence.label, 'LIMITED');
});

test('persisted session spine rehydrates the same bounded Results adapter after reload', () => {
  const result = contextResultFromSessionSpine({ spine: {
    candidateAttribution: { status: 'VERIFIED' },
    turns: [
      { speaker: 'student', transcript: { canonical_ref: 'transcript:t#seg-1', text: 'I coordinated follow-up.' } },
      { speaker: 'student', transcript: { canonical_ref: 'transcript:t#seg-2', text: 'I explained my contribution.' } },
    ],
    evidence: [
      {
        dimension: 'semantic.supported_claim', refs: [{ ref: 'transcript:t#seg-1' }],
        interpretation: { text: 'The answer names a concrete action.' }, confidence: 0.9,
        limitations: ['Only this answer was analyzed.'],
      },
      {
        dimension: 'semantic.coaching_pattern', refs: [{ ref: 'transcript:t#seg-2' }],
        interpretation: { text: 'The contribution is explicit.', facet: 'specificity', polarity: 'strength' },
        score: { value: 0.82 }, confidence: 0.9, limitations: ['Only this answer was analyzed.'],
      },
    ],
  } });

  assert.equal(result.transcript.status, 'AVAILABLE');
  assert.equal(result.transcript.text, 'I coordinated follow-up. I explained my contribution.');
  assert.deepEqual(result.transcript.segments, [
    { id: 'seg-1', startMs: null, endMs: null },
    { id: 'seg-2', startMs: null, endMs: null },
  ]);
  assert.deepEqual(result.analysis.semanticObservations[0].transcriptSegmentIds, ['seg-1']);
  assert.equal(projectContextResults(result).strongest.facetLabel, 'Specificity');
  assert.deepEqual(result.analysis.limitations, ['Only this answer was analyzed.']);
  assert.equal(projectContextResults(result).confidence.coverageBasis, 'evidence_confidence');
});

test('missing, invalid and zero-length segment times do not become replay evidence', () => {
  const metrics = projectTranscriptMetrics({ transcript: { status: 'AVAILABLE', text: 'I like research.', segments: [
    { id: 'missing' }, { id: 'null', startMs: null, endMs: null },
    { id: 'negative', startMs: -1, endMs: 500 }, { id: 'zero', startMs: 0, endMs: 0 },
  ] } });
  assert.equal(metrics.startMs, null);
  assert.equal(metrics.endMs, null);
  assert.equal(metrics.segmentCount, 0);
  assert.equal(metrics.fillerTokenCount, 1);
  assert.ok(metrics.limitations.includes('bounded_lexical_candidates_not_all_disfluencies'));
});

// TEST DATA: these controlled outputs exercise contract differentiation only,
// not whether a language model can recognize answer quality.
test('saved coaching rejects missing, foreign, duplicate and mixed-invalid references', () => {
  const turn = { speaker: 'student', transcript: { canonical_ref: 'transcript:own#seg-1', text: 'I coordinated follow-up.' } };
  const claim = refs => ({ dimension: 'semantic.coaching_pattern', refs: refs.map(ref => ({ref})),
    interpretation: { facet: 'specificity', polarity: 'strength', text: 'Names a concrete action.' },
    score: { value: .9 }, confidence: .9 });
  for (const refs of [['transcript:own#seg-404'], ['transcript:foreign#seg-1'],
    ['transcript:own#seg-1', 'transcript:own#seg-404'], []]) {
    const result = contextResultFromSessionSpine({ spine: { candidateAttribution: { status: 'VERIFIED' }, turns: [turn], evidence: [claim(refs)] } });
    assert.equal(result.analysis.status, 'UNAVAILABLE');
    assert.equal(result.analysis.score, 0);
    assert.deepEqual(projectContextResults(result), { status: 'UNAVAILABLE' });
  }
  for (const turns of [[turn, turn], [turn, { ...turn, transcript: { ...turn.transcript, canonical_ref: 'transcript:other#seg-1' } }]]) {
    assert.equal(contextResultFromSessionSpine({ spine: { candidateAttribution: { status: 'VERIFIED' }, turns, evidence: [claim(['transcript:own#seg-1'])] } }).analysis.status, 'UNAVAILABLE');
  }
  const valid = { ...claim(['transcript:own#seg-1']), score: { value: .7 }, confidence: .65 };
  const mixed = contextResultFromSessionSpine({ spine: { candidateAttribution: { status: 'VERIFIED' }, turns: [turn], evidence: [valid, claim(['transcript:other#seg-1'])] } });
  assert.equal(mixed.analysis.coachingPatterns.length, 1);
  assert.equal(mixed.analysis.score, .7);
  assert.equal(mixed.analysis.coverage, .65);
  assert.match(mixed.analysis.limitations[0], /omitted/);
});

test('synthetic contrasting coaching preserves distinct drills and silent evidence stays unavailable', () => {
  const cases = [
    ['specific', 'I called the patient, arranged the visit, and confirmed follow-up.', 'specificity', 'strength'],
    ['vague', 'I did many things and it went well.', 'specificity', 'weakness'],
    ['rambling', 'I called. I called again. As I said, I called again.', 'concision', 'weakness'],
    ['incomplete', 'The situation was difficult, and then I', 'structure', 'weakness'],
    ['medical', 'I reviewed the HbA1c trend and discussed the insulin plan.', 'evidence', 'strength'],
  ];
  for (const [label, text, facet, polarity] of cases) {
    const result = contextResultFromSessionSpine({ spine: {
      candidateAttribution: { status: 'VERIFIED' },
      turns: [{ speaker: 'student', startMs: null, endMs: null, transcript: { canonical_ref: 'transcript:test#seg-1', text } }],
      evidence: [{ dimension: 'semantic.coaching_pattern', refs: [{ref:'transcript:test#seg-1'}],
        interpretation: { text: `TEST DATA: ${label}`, facet, polarity }, score: {value:.8}, confidence:.8 }],
    } });
    const view = projectContextResults(result);
    assert.equal(result.transcript.text, text);
    assert.equal(result.transcript.segments[0].endMs, null);
    assert.equal((polarity === 'strength' ? view.strongest : view.improvement).facet, facet);
    assert.equal(view.drill?.facet || null, polarity === 'weakness' ? facet : null);
  }
  assert.deepEqual(projectContextResults(contextResultFromSessionSpine({spine:{turns:[],evidence:[]}})), {status:'UNAVAILABLE'});
});

test('overlong replay IDs and absent coaching quality cannot acquire another observation certainty', () => {
  const ref = `transcript:own#${'a'.repeat(96)}-one`;
  const claim = { dimension: 'semantic.coaching_pattern', refs: [{ref}],
    interpretation: {text:'TEST DATA',facet:'specificity',polarity:'strength'},score:{value:.9},confidence:.9 };
  const turn = {speaker:'student',transcript:{canonical_ref:ref,text:'Test contribution.'}};
  assert.equal(contextResultFromSessionSpine({spine:{candidateAttribution:{status:'VERIFIED'},turns:[turn],evidence:[claim]}}).analysis.status,'UNAVAILABLE');
  const prefix = `transcript:own#${'a'.repeat(96)}`;
  const mixed = contextResultFromSessionSpine({spine:{candidateAttribution:{status:'VERIFIED'},turns:[turn,
    {...turn,transcript:{...turn.transcript,canonical_ref:prefix}}],evidence:[{...claim,refs:[{ref:prefix}]}]}});
  assert.deepEqual(mixed.transcript.segments.map(segment=>segment.id),[null,'a'.repeat(96)]);
  assert.equal(mixed.analysis.status,'AVAILABLE');
  const own = 'transcript:own#seg-1';
  const valid = {...claim,refs:[{ref:own}]};
  const unknown = {...valid,interpretation:{...valid.interpretation,polarity:'weakness'},score:null,confidence:null};
  const result = contextResultFromSessionSpine({spine:{candidateAttribution:{status:'VERIFIED'},turns:[{...turn,transcript:{...turn.transcript,canonical_ref:own}}],evidence:[valid,unknown]}});
  assert.equal(projectContextResults(result).confidence.label,'LIMITED');
  assert.match(result.analysis.limitations[0],/no saved quality estimate/);
});
