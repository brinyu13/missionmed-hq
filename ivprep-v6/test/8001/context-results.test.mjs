import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contextResultFromSessionSpine,
  projectContextResults,
  projectTranscriptMetrics,
} from '../../public/capabilities/context-results.mjs';

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
    const result = contextResultFromSessionSpine({ spine: { turns: [turn], evidence: [claim(refs)] } });
    assert.equal(result.analysis.status, 'UNAVAILABLE');
    assert.equal(result.analysis.score, 0);
    assert.deepEqual(projectContextResults(result), { status: 'UNAVAILABLE' });
  }
  for (const turns of [[turn, turn], [turn, { ...turn, transcript: { ...turn.transcript, canonical_ref: 'transcript:other#seg-1' } }]]) {
    assert.equal(contextResultFromSessionSpine({ spine: { turns, evidence: [claim(['transcript:own#seg-1'])] } }).analysis.status, 'UNAVAILABLE');
  }
  const valid = { ...claim(['transcript:own#seg-1']), score: { value: .7 }, confidence: .65 };
  const mixed = contextResultFromSessionSpine({ spine: { turns: [turn], evidence: [valid, claim(['transcript:other#seg-1'])] } });
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
  assert.equal(contextResultFromSessionSpine({spine:{turns:[turn],evidence:[claim]}}).analysis.status,'UNAVAILABLE');
  const prefix = `transcript:own#${'a'.repeat(96)}`;
  const mixed = contextResultFromSessionSpine({spine:{turns:[turn,
    {...turn,transcript:{...turn.transcript,canonical_ref:prefix}}],evidence:[{...claim,refs:[{ref:prefix}]}]}});
  assert.deepEqual(mixed.transcript.segments.map(segment=>segment.id),[null,'a'.repeat(96)]);
  assert.equal(mixed.analysis.status,'AVAILABLE');
  const own = 'transcript:own#seg-1';
  const valid = {...claim,refs:[{ref:own}]};
  const unknown = {...valid,interpretation:{...valid.interpretation,polarity:'weakness'},score:null,confidence:null};
  const result = contextResultFromSessionSpine({spine:{turns:[{...turn,transcript:{...turn.transcript,canonical_ref:own}}],evidence:[valid,unknown]}});
  assert.equal(projectContextResults(result).confidence.label,'LIMITED');
  assert.match(result.analysis.limitations[0],/no saved quality estimate/);
});
