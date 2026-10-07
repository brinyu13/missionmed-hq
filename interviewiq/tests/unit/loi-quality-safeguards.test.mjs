import test from 'node:test';
import assert from 'node:assert/strict';
import {
  locateSpans, bigramOverlap, measureProseSpecificity,
  measureVariation, validateProsePlans,
  MINIMUM_SPECIFICITY_RATIO, MAXIMUM_OVERLAP_RATIO,
  compositionInput, standardPlans, validatePlans
} from '../../server/loi-composition.mjs';

// ── locateSpans ─────────────────────────────────────────────────────────────

test('locateSpans finds all occurrences of a span', () => {
  const text = 'The cat sat on the mat. The cat ran.';
  const hits = locateSpans(text, 'The cat');
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0], { start: 0, end: 7 });
  assert.deepEqual(hits[1], { start: 24, end: 31 });
});

test('locateSpans returns empty for missing span', () => {
  assert.deepEqual(locateSpans('hello world', 'xyz'), []);
});

test('locateSpans handles edge types gracefully', () => {
  assert.deepEqual(locateSpans(null, 'x'), []);
  assert.deepEqual(locateSpans('x', null), []);
  assert.deepEqual(locateSpans('x', ''), []);
  assert.deepEqual(locateSpans(42, 'x'), []);
});

// ── bigramOverlap ───────────────────────────────────────────────────────────

test('bigramOverlap returns 1 for identical strings', () => {
  assert.equal(bigramOverlap('hello world', 'hello world'), 1);
});

test('bigramOverlap returns 0 for completely different strings', () => {
  assert.equal(bigramOverlap('aaa', 'zzz'), 0);
});

test('bigramOverlap returns 0 for empty inputs', () => {
  assert.equal(bigramOverlap('', 'hello'), 0);
  assert.equal(bigramOverlap('hello', ''), 0);
});

test('bigramOverlap is case insensitive', () => {
  assert.equal(bigramOverlap('Hello World', 'hello world'), 1);
});

test('bigramOverlap gives partial score for overlapping content', () => {
  const score = bigramOverlap('the quick brown fox', 'the slow brown dog');
  assert.ok(score > 0 && score < 1, `Expected partial overlap, got ${score}`);
});

// ── measureProseSpecificity ─────────────────────────────────────────────────

test('specificity is 0 when text is entirely verbatim spans', () => {
  const refs = [{ text: 'Hello world' }];
  assert.equal(measureProseSpecificity('Hello world', refs), 0);
});

test('specificity is 1 when no refs match', () => {
  const refs = [{ text: 'xyz not present' }];
  assert.equal(measureProseSpecificity('Hello world entirely unique text', refs), 1);
});

test('specificity is between 0 and 1 for mixed content', () => {
  const refs = [{ text: 'exact span' }];
  const text = 'This is authored prose surrounding the exact span with more original content.';
  const s = measureProseSpecificity(text, refs);
  assert.ok(s > 0 && s < 1, `Expected partial specificity, got ${s}`);
});

test('specificity handles empty text', () => {
  assert.equal(measureProseSpecificity('', [{ text: 'x' }]), 0);
});

test('specificity handles null/undefined refs gracefully', () => {
  const s = measureProseSpecificity('some text', [null, undefined, { text: null }]);
  assert.equal(s, 1);
});

// ── measureVariation ────────────────────────────────────────────────────────

test('measureVariation passes for sufficiently different candidates', () => {
  assert.ok(measureVariation([
    { text: 'The quick brown fox jumped over the lazy sleeping dog in the park.' },
    { text: 'A completely different sentence about entirely separate topics and ideas.' },
  ]));
});

test('measureVariation fails for near-identical candidates', () => {
  const text = 'The exact same text repeated verbatim with no changes at all.';
  assert.equal(measureVariation([{ text }, { text }]), false);
});

// ── validateProsePlans ──────────────────────────────────────────────────────

const payload = () => ({
  context: { whyNow: 'Following up.', applicationState: 'Applied.', interviewState: 'Not interviewed.' },
  contextConfirmed: true,
  motivations: [{ id: '11111111-1111-4111-8111-111111111111', text: 'Training outcomes matter.', confirmed: true }],
  facts: [],
  count: 1,
  approach: 'DIRECT_CONCISE',
});

const fresh = value => ({
  program: { id: 'prog-1', name: 'Test Program', track: 'Categorical', registryReleaseId: 'r-1' },
  evidence: [{ field: 'research.abim', claimRef: 'ev-abim', value, sources: [{ url: 'https://example.org' }], asOf: '2026-09-10' }],
  evidenceDigest: 'ed-1', resultDigest: 'rd-1', coverageDigest: 'cd-1', observedAt: '2026-10-06',
});

test('validateProsePlans accepts well-formed prose with verbatim spans and sufficient specificity', () => {
  const input = compositionInput(payload(), fresh({ detail: 'Exact public statement from verified source.' }), null, 'DIRECT_CONCISE');
  // Build a prose candidate that includes every ref verbatim plus authored connective tissue
  const authored = input.refs.map(r => r.text).join('\n\nThis demonstrates my deep commitment to excellence and leadership in medicine. Furthermore, I believe my background uniquely positions me to contribute meaningfully to your program. ');
  const output = { schema: 'iiq-loi-prose-plan-v1', candidates: [{ approach: 'DIRECT_CONCISE', text: authored }] };
  const validated = validateProsePlans(output, input);
  assert.equal(validated.length, 1);
  assert.equal(validated[0].approach, 'DIRECT_CONCISE');
  assert.equal(validated[0].studentReviewRequired, true);
});

test('validateProsePlans rejects prose missing a verbatim span', () => {
  const input = compositionInput(payload(), fresh({ detail: 'Exact public statement from verified source.' }), null, 'DIRECT_CONCISE');
  const output = { schema: 'iiq-loi-prose-plan-v1', candidates: [{ approach: 'DIRECT_CONCISE', text: 'Completely authored text with no factual spans at all.' }] };
  assert.throws(() => validateProsePlans(output, input), { code: 'loi_composition_reference' });
});

test('validateProsePlans rejects prose below minimum specificity', () => {
  const input = compositionInput(payload(), fresh({ detail: 'Exact public statement from verified source.' }), null, 'DIRECT_CONCISE');
  // Text that is almost entirely the verbatim spans with minimal authoring
  const bareConcat = input.refs.map(r => r.text).join(' ');
  const output = { schema: 'iiq-loi-prose-plan-v1', candidates: [{ approach: 'DIRECT_CONCISE', text: bareConcat }] };
  assert.throws(() => validateProsePlans(output, input), { code: 'loi_composition_specificity' });
});

test('validateProsePlans rejects wrong schema', () => {
  const input = compositionInput(payload(), fresh({ detail: 'Statement.' }), null, 'DIRECT_CONCISE');
  const authored = input.refs.map(r => r.text).join('\n\nSubstantial authored prose demonstrating genuine composition and thoughtful engagement. ');
  const output = { schema: 'iiq-loi-composition-plan-v1', candidates: [{ approach: 'DIRECT_CONCISE', text: authored }] };
  assert.throws(() => validateProsePlans(output, input), { code: 'loi_composition_output' });
});

test('validateProsePlans rejects near-identical three-candidate output', () => {
  const p = payload();
  delete p.approach;
  p.count = 3;
  p.approaches = ['WARM_PERSONAL', 'DIRECT_CONCISE', 'ACADEMIC_PROGRAM'];
  const input = compositionInput(p, fresh({ detail: 'Exact statement.' }), null, 'DIRECT_CONCISE');
  const sameText = input.refs.map(r => r.text).join('\n\nAuthored prose with strong commitment and leadership qualities. ');
  const output = {
    schema: 'iiq-loi-prose-plan-v1',
    candidates: [
      { approach: 'WARM_PERSONAL', text: sameText },
      { approach: 'DIRECT_CONCISE', text: sameText },
      { approach: 'ACADEMIC_PROGRAM', text: sameText },
    ],
  };
  assert.throws(() => validateProsePlans(output, input), { code: 'loi_composition_variation' });
});

test('MINIMUM_SPECIFICITY_RATIO and MAXIMUM_OVERLAP_RATIO have expected values', () => {
  assert.equal(MINIMUM_SPECIFICITY_RATIO, 0.15);
  assert.equal(MAXIMUM_OVERLAP_RATIO, 0.85);
});
