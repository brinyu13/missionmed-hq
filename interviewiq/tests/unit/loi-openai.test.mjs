import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOI_CANARY_OWNER, LOI_CANARY_WP_USER_ID, LOI_AUTHORIZATION, LOI_MODEL,
  MODEL_CONTEXT_TOKENS, MAX_LIFETIME_MICROS, MAX_WIRE_BYTES, MAX_RESPONSE_BYTES,
  paidCanaryActor, canaryPolicy, usageCost, maxCostBound,
  buildLoiRequest, proseSchema, buildLoiProseRequest, PROSE_INSTRUCTIONS,
} from '../../server/loi-openai.mjs';

// ── Constants ────────────────────────────────────────────────────────────

test('LOI_CANARY_OWNER is a UUID', () => {
  assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(LOI_CANARY_OWNER));
});

test('LOI_MODEL is a specific gpt model', () => {
  assert.ok(LOI_MODEL.startsWith('gpt-'));
});

test('MODEL_CONTEXT_TOKENS is 400000', () => {
  assert.equal(MODEL_CONTEXT_TOKENS, 400000);
});

test('MAX_LIFETIME_MICROS is 25000000', () => {
  assert.equal(MAX_LIFETIME_MICROS, 25000000);
});

test('MAX_WIRE_BYTES is 65536', () => {
  assert.equal(MAX_WIRE_BYTES, 65536);
});

test('MAX_RESPONSE_BYTES is 262144', () => {
  assert.equal(MAX_RESPONSE_BYTES, 262144);
});

// ── paidCanaryActor ──────────────────────────────────────────────────────

test('paidCanaryActor accepts matching actor', () => {
  const actor = {id: LOI_CANARY_OWNER, wpUserId: LOI_CANARY_WP_USER_ID, role: 'student'};
  assert.equal(paidCanaryActor(actor), true);
});

test('paidCanaryActor rejects wrong id', () => {
  const actor = {id: 'wrong', wpUserId: LOI_CANARY_WP_USER_ID, role: 'student'};
  assert.equal(paidCanaryActor(actor), false);
});

test('paidCanaryActor rejects wrong wpUserId', () => {
  const actor = {id: LOI_CANARY_OWNER, wpUserId: 9999, role: 'student'};
  assert.equal(paidCanaryActor(actor), false);
});

test('paidCanaryActor rejects non-student role', () => {
  const actor = {id: LOI_CANARY_OWNER, wpUserId: LOI_CANARY_WP_USER_ID, role: 'admin'};
  assert.equal(paidCanaryActor(actor), false);
});

test('paidCanaryActor rejects null actor', () => {
  assert.equal(paidCanaryActor(null), false);
});

test('paidCanaryActor rejects undefined actor', () => {
  assert.equal(paidCanaryActor(undefined), false);
});

// ── usageCost ────────────────────────────────────────────────────────────

test('usageCost returns integer micros', () => {
  const cost = usageCost(1000, 500);
  assert.ok(Number.isInteger(cost));
});

test('usageCost formula: ceil((input + 8*output) / 20)', () => {
  // 1000 + 8*500 = 5000; 5000/20 = 250
  assert.equal(usageCost(1000, 500), 250);
});

test('usageCost rounds up', () => {
  // 1001 + 8*1 = 1009; 1009/20 = 50.45 → ceil = 51
  assert.equal(usageCost(1001, 1), 51);
});

test('usageCost zero output', () => {
  // 100 + 0 = 100; 100/20 = 5
  assert.equal(usageCost(100, 0), 5);
});

test('usageCost weights output 8x', () => {
  // 0 + 8*100 = 800; 800/20 = 40
  assert.equal(usageCost(0, 100), 40);
});

// ── maxCostBound ─────────────────────────────────────────────────────────

test('maxCostBound formula: ceil((MODEL_CONTEXT_TOKENS + 8*output) / 20)', () => {
  // 400000 + 8*4096 = 432768; 432768/20 = 21638.4 → ceil = 21639
  assert.equal(maxCostBound(4096), Math.ceil((MODEL_CONTEXT_TOKENS + 8 * 4096) / 20));
});

test('maxCostBound returns integer', () => {
  assert.ok(Number.isInteger(maxCostBound(1024)));
});

test('maxCostBound is monotonically increasing with output tokens', () => {
  assert.ok(maxCostBound(2048) < maxCostBound(4096));
});

// ── canaryPolicy ─────────────────────────────────────────────────────────

function validPolicy(overrides = {}) {
  const maxOutput = overrides.maxOutputTokens || 4096;
  return {
    canaryOwnerId: LOI_CANARY_OWNER,
    authorizationId: LOI_AUTHORIZATION,
    model: LOI_MODEL,
    maxInputTokens: MODEL_CONTEXT_TOKENS,
    maxOutputTokens: maxOutput,
    maxCostMicros: maxCostBound(maxOutput),
    lifetimeBudgetMicros: MAX_LIFETIME_MICROS,
    timeoutMs: 15000,
    ...overrides,
  };
}

test('canaryPolicy accepts valid policy', () => {
  assert.equal(canaryPolicy(validPolicy()), true);
});

test('canaryPolicy rejects wrong canaryOwnerId', () => {
  assert.equal(canaryPolicy(validPolicy({canaryOwnerId: 'wrong'})), false);
});

test('canaryPolicy rejects wrong authorizationId', () => {
  assert.equal(canaryPolicy(validPolicy({authorizationId: 'WRONG'})), false);
});

test('canaryPolicy rejects wrong model', () => {
  assert.equal(canaryPolicy(validPolicy({model: 'gpt-4o'})), false);
});

test('canaryPolicy rejects wrong maxInputTokens', () => {
  assert.equal(canaryPolicy(validPolicy({maxInputTokens: 100000})), false);
});

test('canaryPolicy rejects maxOutputTokens below 128', () => {
  assert.equal(canaryPolicy(validPolicy({maxOutputTokens: 127})), false);
});

test('canaryPolicy rejects maxOutputTokens above 8192', () => {
  assert.equal(canaryPolicy(validPolicy({maxOutputTokens: 8193})), false);
});

test('canaryPolicy rejects maxCostMicros below bound', () => {
  const p = validPolicy();
  p.maxCostMicros = maxCostBound(p.maxOutputTokens) - 1;
  assert.equal(canaryPolicy(p), false);
});

test('canaryPolicy rejects maxCostMicros above 1000000', () => {
  assert.equal(canaryPolicy(validPolicy({maxCostMicros: 1000001})), false);
});

test('canaryPolicy rejects lifetimeBudgetMicros below maxCostMicros', () => {
  const p = validPolicy();
  p.lifetimeBudgetMicros = p.maxCostMicros - 1;
  assert.equal(canaryPolicy(p), false);
});

test('canaryPolicy rejects lifetimeBudgetMicros above MAX_LIFETIME_MICROS', () => {
  assert.equal(canaryPolicy(validPolicy({lifetimeBudgetMicros: MAX_LIFETIME_MICROS + 1})), false);
});

test('canaryPolicy rejects timeoutMs below 100', () => {
  assert.equal(canaryPolicy(validPolicy({timeoutMs: 99})), false);
});

test('canaryPolicy rejects timeoutMs above 30000', () => {
  assert.equal(canaryPolicy(validPolicy({timeoutMs: 30001})), false);
});

test('canaryPolicy rejects null config', () => {
  assert.equal(canaryPolicy(null), false);
});

test('canaryPolicy rejects undefined config', () => {
  assert.equal(canaryPolicy(undefined), false);
});

test('canaryPolicy accepts minimal valid maxOutputTokens (128)', () => {
  assert.equal(canaryPolicy(validPolicy({maxOutputTokens: 128, maxCostMicros: maxCostBound(128)})), true);
});

test('canaryPolicy accepts maximum valid maxOutputTokens (8192)', () => {
  assert.equal(canaryPolicy(validPolicy({maxOutputTokens: 8192, maxCostMicros: maxCostBound(8192)})), true);
});

// ── buildLoiRequest ──────────────────────────────────────────────────────

function validInput(overrides = {}) {
  return {
    program: {id: 'prog1', name: 'Internal Medicine'},
    refs: [{ref: 'identity', text: 'I am a medical student.', kind: 'context'}],
    approaches: ['WARM_PERSONAL'],
    ...overrides,
  };
}

test('buildLoiRequest returns valid JSON string', () => {
  const json = buildLoiRequest(validInput(), 4096);
  const parsed = JSON.parse(json);
  assert.equal(parsed.model, LOI_MODEL);
  assert.equal(parsed.store, false);
  assert.equal(parsed.stream, false);
  assert.equal(parsed.truncation, 'disabled');
  assert.equal(parsed.max_output_tokens, 4096);
});

test('buildLoiRequest includes correct schema name for v1', () => {
  const parsed = JSON.parse(buildLoiRequest(validInput(), 4096));
  assert.equal(parsed.text.format.name, 'iiq_loi_composition_plan_v1');
});

test('buildLoiRequest accepts 3 approaches', () => {
  const input = validInput({approaches: ['WARM_PERSONAL', 'DIRECT_CONCISE', 'ACADEMIC_PROGRAM']});
  const json = buildLoiRequest(input, 4096);
  assert.ok(json.length > 0);
});

test('buildLoiRequest rejects 2 approaches', () => {
  const input = validInput({approaches: ['WARM_PERSONAL', 'DIRECT_CONCISE']});
  assert.throws(() => buildLoiRequest(input, 4096), {code: 'LOI_INPUT_INVALID'});
});

test('buildLoiRequest rejects empty refs', () => {
  const input = validInput({refs: []});
  assert.throws(() => buildLoiRequest(input, 4096), {code: 'LOI_INPUT_INVALID'});
});

test('buildLoiRequest rejects too many refs (>90)', () => {
  const refs = Array.from({length: 91}, (_, i) => ({ref: `r${i}`, text: 'x', kind: 'context'}));
  const input = validInput({refs});
  assert.throws(() => buildLoiRequest(input, 4096), {code: 'LOI_INPUT_INVALID'});
});

test('buildLoiRequest rejects invalid approach', () => {
  const input = validInput({approaches: ['NONEXISTENT']});
  assert.throws(() => buildLoiRequest(input, 4096), {code: 'LOI_INPUT_INVALID'});
});

test('buildLoiRequest rejects duplicate approaches', () => {
  const input = validInput({approaches: ['WARM_PERSONAL', 'WARM_PERSONAL', 'DIRECT_CONCISE']});
  assert.throws(() => buildLoiRequest(input, 4096), {code: 'LOI_INPUT_INVALID'});
});

test('buildLoiRequest rejects null input', () => {
  assert.throws(() => buildLoiRequest(null, 4096), {code: 'LOI_INPUT_INVALID'});
});

test('buildLoiRequest rejects non-array refs', () => {
  const input = validInput({refs: 'not array'});
  assert.throws(() => buildLoiRequest(input, 4096), {code: 'LOI_INPUT_INVALID'});
});

test('buildLoiRequest includes CONNECTORS in data', () => {
  const parsed = JSON.parse(buildLoiRequest(validInput(), 4096));
  const data = JSON.parse(parsed.input[0].content[0].text);
  assert.ok('connectors' in data);
  assert.ok('greeting' in data.connectors);
});

// ── proseSchema ──────────────────────────────────────────────────────────

test('proseSchema returns valid JSON Schema', () => {
  const schema = proseSchema(validInput());
  assert.equal(schema.type, 'object');
  assert.ok(schema.properties.schema);
  assert.ok(schema.properties.candidates);
  assert.deepEqual(schema.properties.schema.enum, ['iiq-loi-prose-plan-v1']);
});

test('proseSchema candidates use approach enum from input', () => {
  const input = validInput({approaches: ['WARM_PERSONAL', 'DIRECT_CONCISE', 'ACADEMIC_PROGRAM']});
  const schema = proseSchema(input);
  assert.deepEqual(schema.properties.candidates.items.properties.approach.enum, input.approaches);
});

test('proseSchema candidates include text field', () => {
  const schema = proseSchema(validInput());
  assert.equal(schema.properties.candidates.items.properties.text.type, 'string');
});

test('proseSchema is additionalProperties false at all levels', () => {
  const schema = proseSchema(validInput());
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.candidates.items.additionalProperties, false);
});

// ── buildLoiProseRequest ─────────────────────────────────────────────────

test('buildLoiProseRequest returns valid JSON string', () => {
  const json = buildLoiProseRequest(validInput(), 4096);
  const parsed = JSON.parse(json);
  assert.equal(parsed.model, LOI_MODEL);
  assert.equal(parsed.text.format.name, 'iiq_loi_prose_plan_v1');
  assert.equal(parsed.store, false);
});

test('buildLoiProseRequest uses PROSE_INSTRUCTIONS', () => {
  const parsed = JSON.parse(buildLoiProseRequest(validInput(), 4096));
  assert.equal(parsed.instructions, PROSE_INSTRUCTIONS);
});

test('buildLoiProseRequest rejects same invalid inputs as buildLoiRequest', () => {
  assert.throws(() => buildLoiProseRequest(null, 4096), {code: 'LOI_INPUT_INVALID'});
  assert.throws(() => buildLoiProseRequest(validInput({refs: []}), 4096), {code: 'LOI_INPUT_INVALID'});
  assert.throws(() => buildLoiProseRequest(validInput({approaches: ['FAKE']}), 4096), {code: 'LOI_INPUT_INVALID'});
});

test('buildLoiProseRequest includes prose schema', () => {
  const parsed = JSON.parse(buildLoiProseRequest(validInput(), 4096));
  assert.equal(parsed.text.format.schema.properties.schema.enum[0], 'iiq-loi-prose-plan-v1');
});

// ── PROSE_INSTRUCTIONS content ───────────────────────────────────────────

test('PROSE_INSTRUCTIONS mentions positionContext', () => {
  assert.ok(PROSE_INSTRUCTIONS.includes('positionContext'));
});

test('PROSE_INSTRUCTIONS mentions PGY-1', () => {
  assert.ok(PROSE_INSTRUCTIONS.includes('PGY-1'));
});

test('PROSE_INSTRUCTIONS guards against inventing details', () => {
  assert.ok(PROSE_INSTRUCTIONS.includes('Do not invent additional program names'));
});

test('PROSE_INSTRUCTIONS mentions Advanced program pathway', () => {
  assert.ok(PROSE_INSTRUCTIONS.includes('Advanced program pathway'));
});
