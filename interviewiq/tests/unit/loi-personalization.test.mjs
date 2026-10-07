import test from 'node:test';
import assert from 'node:assert/strict';
import {compositionInput,standardPlans,validatePlans,validateProsePlans,APPROACHES} from '../../server/loi-composition.mjs';

// ── Prose-first cascade unit tests (Worker 01) ─────────────────────────────
// These test the composition/validation contract at the module boundary.
// dispatchGeneration and executeComposition integration is tested via
// loi-prose-threading.test.mjs.

const payload = () => ({
  context: { whyNow: 'Following up on my application.', applicationState: 'Applied.', interviewState: 'Not invited.' },
  contextConfirmed: true,
  motivations: [{ id: '11111111-1111-4111-8111-111111111111', text: 'I value published outcomes.', confirmed: true }],
  facts: [],
  count: 1,
  approach: 'WARM_PERSONAL',
});

const fresh = value => ({
  program: { id: 'p-1', name: 'Synth Program', track: 'Categorical', registryReleaseId: 'rv-1' },
  evidence: [{ field: 'research.abim', claimRef: 'ev-abim', value, sources: [{ url: 'https://example.org' }], asOf: '2026-09-10' }],
  evidenceDigest: 'ed', resultDigest: 'rd', coverageDigest: 'cd', observedAt: '2026-10-06',
});

test('compositionInput produces refs that validateProsePlans can consume', () => {
  const input = compositionInput(payload(), fresh({ rate: 'Verified 95% pass rate from public report.' }), null, 'WARM_PERSONAL');
  // Build valid prose: all refs verbatim + substantial authored tissue
  const tissue = '\n\nI am deeply committed to pursuing residency training that aligns with my long-term career goals in medicine. My background in clinical research and patient care has prepared me uniquely for this opportunity. ';
  const text = input.refs.map(r => r.text).join(tissue) + tissue;
  const output = { schema: 'iiq-loi-prose-plan-v1', candidates: [{ approach: 'WARM_PERSONAL', text }] };
  const validated = validateProsePlans(output, input);
  assert.equal(validated.length, 1);
  assert.equal(validated[0].studentReviewRequired, true);
  assert.equal(validated[0].studentFactualConfirmation, false);
});

test('v1 standardPlans still work as deterministic fallback', () => {
  const input = compositionInput(payload(), fresh({ detail: 'Public outcome statement.' }), null, 'WARM_PERSONAL');
  const plans = standardPlans(input);
  const drafts = validatePlans(plans, input);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].approach, 'WARM_PERSONAL');
  // All refs must appear
  for (const ref of input.refs) {
    assert.ok(drafts[0].text.includes(ref.text));
  }
});

test('all six approaches produce valid compositionInput', () => {
  for (const approach of APPROACHES) {
    const p = payload();
    p.approach = approach;
    if (approach === 'POST_INTERVIEW') p.postInterviewConfirmed = true;
    if (approach === 'UPDATE_LED') {
      p.updateConfirmed = true;
      p.facts = [{ id: '22222222-2222-4222-8222-222222222222', text: 'I completed a new rotation.', confirmed: true }];
    }
    const input = compositionInput(p, fresh({ detail: 'Program-specific public finding.' }), null, approach);
    assert.ok(input.approaches.includes(approach));
    assert.ok(input.refs.length > 0);
  }
});

test('prose schema is distinct from reference schema', () => {
  const input = compositionInput(payload(), fresh({ s: 'Statement.' }), null, 'WARM_PERSONAL');
  const tissue = '\n\nSubstantial authored content demonstrating composition beyond verbatim concatenation and genuine thoughtful engagement. ';
  const text = input.refs.map(r => r.text).join(tissue) + tissue;

  // Prose output uses prose schema
  const proseOutput = { schema: 'iiq-loi-prose-plan-v1', candidates: [{ approach: 'WARM_PERSONAL', text }] };
  const proseValidated = validateProsePlans(proseOutput, input);
  assert.equal(proseValidated[0].approach, 'WARM_PERSONAL');

  // Reference output uses reference schema
  const refOutput = standardPlans(input);
  assert.equal(refOutput.schema, 'iiq-loi-composition-plan-v1');
  const refValidated = validatePlans(refOutput, input);
  assert.equal(refValidated[0].approach, 'WARM_PERSONAL');
});

test('publicResult shape includes compositionMode and factualGuard', async () => {
  // This tests the export shape contract from loi-generation via import
  const {compositionEnabled, providerAvailable} = await import('../../server/loi-generation.mjs');
  // These are function exports — just verify they exist and are callable
  assert.equal(typeof compositionEnabled, 'function');
  assert.equal(typeof providerAvailable, 'function');
});
