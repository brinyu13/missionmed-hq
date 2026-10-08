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

// Current prose acceptance is traced and specific; ratios remain diagnostics only.
import {proseFixture,proseOutput} from '../helpers/loi-prose.mjs';
test('validateProsePlans accepts traced concrete program fit',()=>{const input=proseFixture(),out=validateProsePlans(proseOutput(input),input);assert.equal(out.length,1);assert.equal(out[0].studentReviewRequired,true);assert.equal(out[0].claims.length,input.refs.length);});
test('validateProsePlans rejects missing traces and legacy untraced prose',()=>{const input=proseFixture(),output=proseOutput(input);output.candidates[0].claims.pop();assert.throws(()=>validateProsePlans(output,input),{code:'loi_composition_reference'});assert.throws(()=>validateProsePlans({...output,schema:'iiq-loi-prose-plan-v1'},input),{code:'loi_composition_output'});});
test('validateProsePlans rejects missing explicit fit link',()=>{const input=proseFixture(),output=proseOutput(input);output.candidates[0].fitLinks=[];assert.throws(()=>validateProsePlans(output,input),{code:'loi_composition_specificity'});});
test('validateProsePlans rejects three copies instead of distinct structures',()=>{const input=proseFixture({approaches:['WARM_PERSONAL','DIRECT_CONCISE','ACADEMIC_PROGRAM']}),output=proseOutput(input);output.candidates[1]={...output.candidates[0],approach:'DIRECT_CONCISE'};assert.throws(()=>validateProsePlans(output,input));});
test('existing specificity/overlap constants remain diagnostic utilities',()=>{assert.equal(MINIMUM_SPECIFICITY_RATIO,.15);assert.equal(MAXIMUM_OVERLAP_RATIO,.85);});
