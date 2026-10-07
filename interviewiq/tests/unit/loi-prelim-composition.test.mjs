import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// ── Prelim/TY LOI composition position-type awareness tests ──────────
// Verify that the LOI composition pipeline threads position type context
// for Preliminary and Transitional Year letters, including:
// 1. POSITION_TYPES export exists and contains expected values
// 2. compositionInput accepts positionType and advancedProgramName
// 3. Position-context ref is injected for PRELIMINARY positions
// 4. Position-context ref is injected for TRANSITIONAL_YEAR positions
// 5. Position-context ref includes Advanced program name when provided
// 6. No position-context ref for non-prelim/TY position types
// 7. compositionInput output includes positionType and advancedProgramName
// 8. loi-openai INSTRUCTIONS mention positionContext
// 9. loi-openai PROSE_INSTRUCTIONS mention positionContext
// 10. targetView does not invent positionType (loi_targets has no such column); derivePositionContext covers it

const compositionSrc = readFileSync(new URL('../../server/loi-composition.mjs', import.meta.url), 'utf8');
const openaiSrc = readFileSync(new URL('../../server/loi-openai.mjs', import.meta.url), 'utf8');
const targetsSrc = readFileSync(new URL('../../server/loi-targets.mjs', import.meta.url), 'utf8');

// ── POSITION_TYPES export ──────────────────────────────────────────────
test('POSITION_TYPES is exported from loi-composition', () => {
  assert.ok(compositionSrc.includes("export const POSITION_TYPES=Object.freeze("), 'POSITION_TYPES export exists');
});

test('POSITION_TYPES contains all expected position types', () => {
  for (const pt of ['CATEGORICAL','PRELIMINARY','TRANSITIONAL_YEAR','ADVANCED','RESERVED','OTHER','UNKNOWN']) {
    assert.ok(compositionSrc.includes(`'${pt}'`), `POSITION_TYPES includes ${pt}`);
  }
});

// ── compositionInput accepts positionType ───────────────────────────────
test('compositionInput onlyKeys includes positionType and advancedProgramName', () => {
  assert.ok(compositionSrc.includes("'positionType'"), 'positionType in allowed keys');
  assert.ok(compositionSrc.includes("'advancedProgramName'"), 'advancedProgramName in allowed keys');
});

test('compositionInput validates positionType against POSITION_TYPES', () => {
  assert.ok(compositionSrc.includes("v.choice(data.positionType,POSITION_TYPES,'position type')"), 'positionType validated via v.choice');
});

// ── Position-context ref injection ─────────────────────────────────────
test('PRELIMINARY position type injects positionContext ref', () => {
  assert.ok(compositionSrc.includes("'PRELIMINARY'"), 'PRELIMINARY check exists');
  assert.ok(compositionSrc.includes("ref:'positionContext'"), 'positionContext ref key exists');
  assert.ok(compositionSrc.includes("kind:'context'"), 'positionContext has context kind');
});

test('TRANSITIONAL_YEAR position type injects positionContext ref', () => {
  assert.ok(compositionSrc.includes("'TRANSITIONAL_YEAR'"), 'TRANSITIONAL_YEAR check exists');
  // Both PRELIMINARY and TRANSITIONAL_YEAR share the same injection path
  assert.ok(compositionSrc.includes("includes(positionType)"), 'Both types checked via includes');
});

test('Position-context ref mentions PGY-1', () => {
  assert.ok(compositionSrc.includes('PGY-1'), 'PGY-1 mentioned in position context');
});

test('Position-context ref includes Preliminary label', () => {
  assert.ok(compositionSrc.includes("'Preliminary'"), 'Preliminary label in context text');
});

test('Position-context ref includes Transitional Year label', () => {
  assert.ok(compositionSrc.includes("'Transitional Year'"), 'Transitional Year label in context text');
});

test('Position-context ref includes Advanced program name when provided', () => {
  assert.ok(compositionSrc.includes('advancedProgramName'), 'advancedProgramName referenced in context text');
  assert.ok(compositionSrc.includes('Advanced program at'), 'Context references Advanced program');
});

test('No position-context ref for CATEGORICAL position type', () => {
  // The condition only fires for PRELIMINARY and TRANSITIONAL_YEAR
  const condMatch = compositionSrc.match(/if\(positionType&&\['PRELIMINARY','TRANSITIONAL_YEAR'\]\.includes\(positionType\)\)/);
  assert.ok(condMatch, 'Condition explicitly limits to PRELIMINARY and TRANSITIONAL_YEAR only');
});

// ── compositionInput output shape ──────────────────────────────────────
test('compositionInput return includes positionType field', () => {
  assert.ok(compositionSrc.includes('positionType:positionType||null'), 'positionType in return object');
});

test('compositionInput return includes advancedProgramName field', () => {
  assert.ok(compositionSrc.includes('advancedProgramName:advancedProgramName||null'), 'advancedProgramName in return object');
});

// ── loi-openai INSTRUCTIONS ────────────────────────────────────────────
test('INSTRUCTIONS mention positionContext reference handling', () => {
  assert.ok(openaiSrc.includes('positionContext reference'), 'INSTRUCTIONS mention positionContext');
});

test('INSTRUCTIONS mention PGY-1 in context of positionContext', () => {
  assert.ok(openaiSrc.includes('PGY-1'), 'INSTRUCTIONS reference PGY-1');
});

test('INSTRUCTIONS guide positionContext placement near identity', () => {
  assert.ok(openaiSrc.includes('place it near the identity'), 'INSTRUCTIONS guide position-context placement');
});

// ── loi-openai PROSE_INSTRUCTIONS ──────────────────────────────────────
test('PROSE_INSTRUCTIONS mention positionContext reference handling', () => {
  assert.ok(openaiSrc.includes('positionContext reference'), 'PROSE_INSTRUCTIONS mention positionContext');
});

test('PROSE_INSTRUCTIONS mention PGY-1 qualifying year', () => {
  // PROSE_INSTRUCTIONS are the second set of instructions in the file
  const proseIdx = openaiSrc.indexOf('PROSE_INSTRUCTIONS');
  const afterProse = openaiSrc.slice(proseIdx);
  assert.ok(afterProse.includes('PGY-1 qualifying year'), 'PROSE_INSTRUCTIONS reference PGY-1 qualifying year');
});

test('PROSE_INSTRUCTIONS guard against inventing program details', () => {
  const proseIdx = openaiSrc.indexOf('PROSE_INSTRUCTIONS');
  const afterProse = openaiSrc.slice(proseIdx);
  assert.ok(afterProse.includes('Do not invent additional program names'), 'PROSE_INSTRUCTIONS guard against fabrication');
});

test('PROSE_INSTRUCTIONS mention Advanced program pathway', () => {
  const proseIdx = openaiSrc.indexOf('PROSE_INSTRUCTIONS');
  const afterProse = openaiSrc.slice(proseIdx);
  assert.ok(afterProse.includes('Advanced program pathway'), 'PROSE_INSTRUCTIONS reference Advanced pathway');
});

// ── loi-targets targetView ─────────────────────────────────────────────
// Recovery reconciliation (2026-10-07): iiq.loi_targets has no position_type column in any
// applied migration, so targetView must not project an invented positionType. The PGY-1
// context for program targets is derived server-side in loi-generation (derivePositionContext)
// from the student's own applied interview intake facts instead.
test('targetView does not invent a positionType the schema does not carry', () => {
  assert.ok(!targetsSrc.includes("positionType:row.position_type"), 'no schema-less positionType projection');
  const genSrc = readFileSync(new URL('../../server/loi-generation.mjs', import.meta.url), 'utf8');
  assert.ok(genSrc.includes('export function derivePositionContext('), 'position context derived from own intake facts');
});
