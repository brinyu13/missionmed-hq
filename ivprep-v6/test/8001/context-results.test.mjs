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
    { id: 'seg-1', startMs: 0, endMs: 0 },
    { id: 'seg-2', startMs: 0, endMs: 0 },
  ]);
  assert.deepEqual(result.analysis.semanticObservations[0].transcriptSegmentIds, ['seg-1']);
  assert.equal(projectContextResults(result).strongest.facetLabel, 'Specificity');
  assert.deepEqual(result.analysis.limitations, ['Only this answer was analyzed.']);
});
