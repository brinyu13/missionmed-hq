import assert from 'node:assert/strict';
import test from 'node:test';

import { projectContextResults } from '../../public/capabilities/context-results.mjs';

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

