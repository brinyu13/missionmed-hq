import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {derivePositionContext} from '../../server/loi-generation.mjs';
import {compositionInput} from '../../server/loi-composition.mjs';

// Advanced → prelim/TY LOI: position context is derived only from the student's own
// confirmed intake facts; ambiguity yields null; the client's explicit value wins.

const link = (over = {}) => ({ program_name: 'Example Advanced Dermatology', position_type: 'ADVANCED', advanced_fact_confirmed: true, pgy1_applied: 'YES', ...over });

test('interview subject with PRELIMINARY intake yields PRELIMINARY', () => {
  assert.deepEqual(derivePositionContext({ subjectPositionType: 'PRELIMINARY' }), { positionType: 'PRELIMINARY', advancedProgramName: null });
});

test('interview subject with TRANSITIONAL_YEAR intake yields TRANSITIONAL_YEAR', () => {
  assert.equal(derivePositionContext({ subjectPositionType: 'TRANSITIONAL_YEAR' }).positionType, 'TRANSITIONAL_YEAR');
});

test('categorical / advanced / unknown subjects yield no position context', () => {
  for (const t of ['CATEGORICAL', 'ADVANCED', 'RESERVED', 'OTHER', 'UNKNOWN']) {
    assert.deepEqual(derivePositionContext({ subjectPositionType: t, advancedLinks: [link()] }), { positionType: null, advancedProgramName: null }, t);
  }
});

test('program-target subject derives the type only when every applied own interview agrees', () => {
  assert.equal(derivePositionContext({ programPositionTypes: ['PRELIMINARY'] }).positionType, 'PRELIMINARY');
  assert.equal(derivePositionContext({ programPositionTypes: ['TRANSITIONAL_YEAR', 'TRANSITIONAL_YEAR'] }).positionType, 'TRANSITIONAL_YEAR');
  assert.equal(derivePositionContext({ programPositionTypes: ['PRELIMINARY', 'TRANSITIONAL_YEAR'] }).positionType, null, 'mixed → null');
  assert.equal(derivePositionContext({ programPositionTypes: ['PRELIMINARY', 'CATEGORICAL'] }).positionType, null, 'non-PGY1 present → null');
  assert.equal(derivePositionContext({ programPositionTypes: [] }).positionType, null, 'no facts → null');
  assert.equal(derivePositionContext({}).positionType, null);
});

test('advanced program name requires exactly one confirmed ADVANCED link', () => {
  const one = derivePositionContext({ subjectPositionType: 'PRELIMINARY', advancedLinks: [link()] });
  assert.equal(one.advancedProgramName, 'Example Advanced Dermatology');
  const two = derivePositionContext({ subjectPositionType: 'PRELIMINARY', advancedLinks: [link(), link({ program_name: 'Other Advanced Program' })] });
  assert.equal(two.advancedProgramName, null, 'two different programs → omitted');
  const dup = derivePositionContext({ subjectPositionType: 'PRELIMINARY', advancedLinks: [link(), link()] });
  assert.equal(dup.advancedProgramName, 'Example Advanced Dermatology', 'same program twice is still one name');
});

test('advanced link must be confirmed, applied and ADVANCED', () => {
  for (const bad of [link({ advanced_fact_confirmed: false }), link({ pgy1_applied: 'UNSURE' }), link({ position_type: 'CATEGORICAL' }), link({ program_name: '  ' }), null]) {
    assert.equal(derivePositionContext({ subjectPositionType: 'TRANSITIONAL_YEAR', advancedLinks: [bad] }).advancedProgramName, null);
  }
});

test('position context flows into compositionInput as a verbatim context ref', () => {
  const payload = { context: { whyNow: 'I am following up on my application.', applicationState: 'Applied to this program.', interviewState: 'Not yet invited to interview.' }, contextConfirmed: true, motivations: [{ id: '11111111-1111-4111-8111-111111111111', text: 'I value published resident training outcomes.', confirmed: true }], facts: [], count: 1, approach: 'DIRECT_CONCISE', positionType: 'TRANSITIONAL_YEAR', advancedProgramName: 'Example Advanced Dermatology' };
  const fresh = { program: { id: 'canonical-program', name: 'Synthetic TY Program', track: 'Transitional', registryReleaseId: 'registry-v1' }, evidence: [{ field: 'research.abim', claimRef: 'evidence-abim', value: 'The public report lists 57 examinees and 95% passing.', sources: [{ url: 'https://example.org/public-report' }], asOf: '2026-09-10' }], evidenceDigest: 'e', resultDigest: 'r', coverageDigest: 'c', observedAt: '2026-10-06' };
  const input = compositionInput(payload, fresh, null, 'DIRECT_CONCISE');
  assert.equal(input.positionType, 'TRANSITIONAL_YEAR');
  assert.equal(input.advancedProgramName, 'Example Advanced Dermatology');
  const ref = input.refs.find(r => r.ref === 'positionContext');
  assert.ok(ref && ref.text.includes('Transitional Year (PGY-1) program') && ref.text.includes('Example Advanced Dermatology'), 'position context ref present');
});

test('loi.generate only fills position context when the client did not state it', () => {
  const src = readFileSync(new URL('../../server/loi-generation.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes('if(envelope.data.positionType===undefined){const pc=await positionContext(db,actor,subjectRow);'), 'client value wins');
  assert.ok(src.includes("envelope.data.advancedProgramName===undefined?{advancedProgramName:pc.advancedProgramName}:{}"), 'advanced name only when absent and unambiguous');
  assert.ok(src.includes("d.position_type='ADVANCED'") && src.includes('t.id::text=d.prelim_target_id::text'), 'links come from own ADVANCED intakes that explicitly associated the PGY-1 target');
  assert.ok(src.includes("d.application_state='APPLIED'"), 'program-target derivation uses applied interview facts');
  assert.ok(!src.includes('program_name ILIKE') && !src.includes('LIKE'), 'never inferred from a program label');
});
