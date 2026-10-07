import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROACHES, APPROACH_LABELS, CONNECTORS, POSITION_TYPES,
} from '../../server/loi-composition.mjs';

// ── APPROACH_LABELS ─────────────────────────────────────────────────

test('APPROACH_LABELS is a frozen array', () => {
  assert.ok(Array.isArray(APPROACH_LABELS));
  assert.ok(Object.isFrozen(APPROACH_LABELS));
});

test('APPROACH_LABELS has 6 entries matching APPROACHES length', () => {
  assert.equal(APPROACH_LABELS.length, 6);
  assert.equal(APPROACH_LABELS.length, APPROACHES.length);
});

test('APPROACH_LABELS entries are all non-empty strings', () => {
  for (const label of APPROACH_LABELS) {
    assert.equal(typeof label, 'string');
    assert.ok(label.length > 0);
  }
});

test('APPROACH_LABELS contains expected labels', () => {
  assert.deepEqual([...APPROACH_LABELS], [
    'Warm + Personal',
    'Direct + Concise',
    'Academic + Program-Specific',
    'Post-Interview Reflective',
    'Update-Led',
    'Strong Interest',
  ]);
});

test('APPROACH_LABELS has no duplicates', () => {
  assert.equal(new Set(APPROACH_LABELS).size, APPROACH_LABELS.length);
});

// ── CONNECTORS ──────────────────────────────────────────────────────

test('CONNECTORS is a frozen object', () => {
  assert.ok(typeof CONNECTORS === 'object' && CONNECTORS !== null);
  assert.ok(Object.isFrozen(CONNECTORS));
});

test('CONNECTORS has exactly 6 keys', () => {
  assert.equal(Object.keys(CONNECTORS).length, 6);
});

test('CONNECTORS has expected keys', () => {
  const keys = Object.keys(CONNECTORS).sort();
  assert.deepEqual(keys, ['close', 'fit', 'greeting', 'interest', 'reflect', 'update']);
});

test('CONNECTORS values are all non-empty strings', () => {
  for (const value of Object.values(CONNECTORS)) {
    assert.equal(typeof value, 'string');
    assert.ok(value.length > 0);
  }
});

test('CONNECTORS greeting addresses program leadership', () => {
  assert.equal(CONNECTORS.greeting, 'Dear Program Leadership,');
});

test('CONNECTORS close is a thank you', () => {
  assert.equal(CONNECTORS.close, 'Thank you for considering my interest.');
});

// ── POSITION_TYPES (from loi-composition) ───────────────────────────

test('POSITION_TYPES is a frozen array', () => {
  assert.ok(Array.isArray(POSITION_TYPES));
  assert.ok(Object.isFrozen(POSITION_TYPES));
});

test('POSITION_TYPES has 7 entries', () => {
  assert.equal(POSITION_TYPES.length, 7);
});

test('POSITION_TYPES contains all expected types', () => {
  const expected = ['CATEGORICAL', 'PRELIMINARY', 'TRANSITIONAL_YEAR', 'ADVANCED', 'RESERVED', 'OTHER', 'UNKNOWN'];
  assert.deepEqual([...POSITION_TYPES].sort(), [...expected].sort());
});

test('POSITION_TYPES entries are all uppercase strings', () => {
  for (const pt of POSITION_TYPES) {
    assert.equal(typeof pt, 'string');
    assert.equal(pt, pt.toUpperCase());
  }
});

test('POSITION_TYPES has no duplicates', () => {
  assert.equal(new Set(POSITION_TYPES).size, POSITION_TYPES.length);
});
