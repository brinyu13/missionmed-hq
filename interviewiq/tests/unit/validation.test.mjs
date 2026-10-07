import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../../server/validation.mjs';

// ── object ──────────────────────────────────────────────────────────────

test('object accepts plain object', () => {
  const o = {a: 1, b: 'two'};
  assert.deepEqual(v.object(o), o);
});

test('object rejects null', () => {
  assert.throws(() => v.object(null), {code: 'invalid_object'});
});

test('object rejects array', () => {
  assert.throws(() => v.object([1, 2]), {code: 'invalid_object'});
});

test('object rejects primitive string', () => {
  assert.throws(() => v.object('hello'), {code: 'invalid_object'});
});

test('object rejects undefined', () => {
  assert.throws(() => v.object(undefined), {code: 'invalid_object'});
});

test('object rejects __proto__ key', () => {
  const o = Object.create(null);
  o.__proto__ = 'bad';
  // object() checks for Object.getPrototypeOf === Object.prototype,
  // so Object.create(null) will fail that check
  assert.throws(() => v.object(o), {code: 'invalid_object'});
});

test('object rejects constructor key', () => {
  assert.throws(() => v.object({constructor: 'bad'}), {code: 'invalid_object'});
});

test('object rejects prototype key', () => {
  assert.throws(() => v.object({prototype: 'bad'}), {code: 'invalid_object'});
});

test('object accepts empty object', () => {
  assert.deepEqual(v.object({}), {});
});

// ── text ────────────────────────────────────────────────────────────────

test('text accepts valid string within max', () => {
  assert.equal(v.text('hello', 'Greeting', 10), 'hello');
});

test('text accepts empty string by default', () => {
  assert.equal(v.text('', 'Note', 100), '');
});

test('text rejects empty string when empty:false', () => {
  assert.throws(() => v.text('', 'Note', 100, {empty: false}), {code: 'invalid_text'});
});

test('text rejects whitespace-only when empty:false', () => {
  assert.throws(() => v.text('   ', 'Note', 100, {empty: false}), {code: 'invalid_text'});
});

test('text rejects string exceeding max', () => {
  assert.throws(() => v.text('x'.repeat(101), 'Note', 100), {code: 'invalid_text'});
});

test('text accepts string at exact max', () => {
  assert.equal(v.text('x'.repeat(100), 'Note', 100), 'x'.repeat(100));
});

test('text rejects NUL character', () => {
  assert.throws(() => v.text('hello\x00world', 'Note', 100), {code: 'invalid_text'});
});

test('text rejects non-string', () => {
  assert.throws(() => v.text(42, 'Note', 100), {code: 'invalid_text'});
});

test('text rejects null', () => {
  assert.throws(() => v.text(null, 'Note', 100), {code: 'invalid_text'});
});

// ── uuid ────────────────────────────────────────────────────────────────

test('uuid accepts valid v4 UUID', () => {
  const id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  assert.equal(v.uuid(id, 'Record'), id);
});

test('uuid rejects too-short string', () => {
  assert.throws(() => v.uuid('abc', 'Record'), {code: 'invalid_identifier'});
});

test('uuid rejects non-string', () => {
  assert.throws(() => v.uuid(123, 'Record'), {code: 'invalid_identifier'});
});

test('uuid rejects malformed UUID', () => {
  assert.throws(() => v.uuid('not-a-uuid-at-all-at-all', 'Record'), {code: 'invalid_identifier'});
});

// ── integer ─────────────────────────────────────────────────────────────

test('integer accepts valid integer in range', () => {
  assert.equal(v.integer(5, 'Count', 0, 10), 5);
});

test('integer accepts min boundary', () => {
  assert.equal(v.integer(0, 'Count', 0, 10), 0);
});

test('integer accepts max boundary', () => {
  assert.equal(v.integer(10, 'Count', 0, 10), 10);
});

test('integer rejects below min', () => {
  assert.throws(() => v.integer(-1, 'Count', 0, 10), {code: 'invalid_integer'});
});

test('integer rejects above max', () => {
  assert.throws(() => v.integer(11, 'Count', 0, 10), {code: 'invalid_integer'});
});

test('integer rejects float', () => {
  assert.throws(() => v.integer(3.14, 'Count', 0, 10), {code: 'invalid_integer'});
});

test('integer rejects NaN', () => {
  assert.throws(() => v.integer(NaN, 'Count', 0, 10), {code: 'invalid_integer'});
});

test('integer rejects Infinity', () => {
  assert.throws(() => v.integer(Infinity, 'Count', 0, 10), {code: 'invalid_integer'});
});

test('integer rejects string', () => {
  assert.throws(() => v.integer('5', 'Count', 0, 10), {code: 'invalid_integer'});
});

// ── choice ──────────────────────────────────────────────────────────────

test('choice accepts valid option', () => {
  assert.equal(v.choice('red', ['red', 'blue', 'green'], 'Color'), 'red');
});

test('choice rejects invalid option', () => {
  assert.throws(() => v.choice('yellow', ['red', 'blue', 'green'], 'Color'), {code: 'invalid_choice'});
});

test('choice rejects null', () => {
  assert.throws(() => v.choice(null, ['red', 'blue'], 'Color'), {code: 'invalid_choice'});
});

test('choice rejects undefined', () => {
  assert.throws(() => v.choice(undefined, ['red', 'blue'], 'Color'), {code: 'invalid_choice'});
});

// ── boolean ─────────────────────────────────────────────────────────────

test('boolean accepts true', () => {
  assert.equal(v.boolean(true, 'Flag'), true);
});

test('boolean accepts false', () => {
  assert.equal(v.boolean(false, 'Flag'), false);
});

test('boolean rejects truthy string', () => {
  assert.throws(() => v.boolean('true', 'Flag'), {code: 'invalid_boolean'});
});

test('boolean rejects number 1', () => {
  assert.throws(() => v.boolean(1, 'Flag'), {code: 'invalid_boolean'});
});

test('boolean rejects null', () => {
  assert.throws(() => v.boolean(null, 'Flag'), {code: 'invalid_boolean'});
});

// ── array ───────────────────────────────────────────────────────────────

test('array accepts valid array within max', () => {
  const a = [1, 2, 3];
  assert.deepEqual(v.array(a, 'Items', 10), a);
});

test('array accepts empty array', () => {
  assert.deepEqual(v.array([], 'Items', 10), []);
});

test('array rejects non-array', () => {
  assert.throws(() => v.array('not an array', 'Items', 10), {code: 'invalid_array'});
});

test('array rejects oversized array', () => {
  assert.throws(() => v.array(new Array(11), 'Items', 10), {code: 'invalid_array'});
});

test('array accepts array at exact max', () => {
  assert.deepEqual(v.array(new Array(10).fill(0), 'Items', 10), new Array(10).fill(0));
});

test('array rejects null', () => {
  assert.throws(() => v.array(null, 'Items', 10), {code: 'invalid_array'});
});

// ── onlyKeys ────────────────────────────────────────────────────────────

test('onlyKeys passes with all allowed keys', () => {
  assert.doesNotThrow(() => v.onlyKeys({a: 1, b: 2}, ['a', 'b', 'c']));
});

test('onlyKeys passes with subset of allowed keys', () => {
  assert.doesNotThrow(() => v.onlyKeys({a: 1}, ['a', 'b', 'c']));
});

test('onlyKeys passes with empty object', () => {
  assert.doesNotThrow(() => v.onlyKeys({}, ['a', 'b']));
});

test('onlyKeys rejects unexpected keys', () => {
  assert.throws(() => v.onlyKeys({a: 1, d: 2}, ['a', 'b', 'c']), {code: 'unexpected_fields'});
});

test('onlyKeys rejects non-object (null)', () => {
  assert.throws(() => v.onlyKeys(null, ['a']), {code: 'invalid_object'});
});

// ── digest ──────────────────────────────────────────────────────────────

test('digest returns hex string', () => {
  const d = v.digest({a: 1});
  assert.ok(typeof d === 'string');
  assert.ok(/^[0-9a-f]{64}$/.test(d));
});

test('digest is deterministic', () => {
  assert.equal(v.digest({a: 1, b: 2}), v.digest({a: 1, b: 2}));
});

test('digest is key-order independent', () => {
  assert.equal(v.digest({a: 1, b: 2}), v.digest({b: 2, a: 1}));
});

test('digest differs for different values', () => {
  assert.notEqual(v.digest({a: 1}), v.digest({a: 2}));
});

test('digest handles nested objects canonically', () => {
  assert.equal(
    v.digest({outer: {b: 2, a: 1}}),
    v.digest({outer: {a: 1, b: 2}})
  );
});

test('digest handles arrays in order', () => {
  assert.notEqual(v.digest([1, 2, 3]), v.digest([3, 2, 1]));
});

// ── commandEnvelope ─────────────────────────────────────────────────────

test('commandEnvelope accepts valid envelope', () => {
  const body = {
    command: 'debrief.save',
    interviewId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    data: {narrative: 'Good day'},
    requestId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    expectedVersion: 1,
  };
  const result = v.commandEnvelope(body);
  assert.equal(result.command, 'debrief.save');
  assert.equal(result.interviewId, body.interviewId);
  assert.ok('bodyHash' in result);
});

test('commandEnvelope rejects invalid command format', () => {
  assert.throws(() => v.commandEnvelope({
    command: 'BADCOMMAND',
    requestId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    expectedVersion: 0,
  }), {code: 'invalid_command'});
});

test('commandEnvelope allows null interviewId', () => {
  const body = {
    command: 'loitarget.list',
    interviewId: null,
    data: {},
    requestId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    expectedVersion: 0,
  };
  const result = v.commandEnvelope(body);
  assert.equal(result.interviewId, null);
});

test('commandEnvelope produces deterministic bodyHash', () => {
  const body = {
    command: 'debrief.save',
    interviewId: null,
    data: {a: 1},
    requestId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    expectedVersion: 0,
  };
  const h1 = v.commandEnvelope(body).bodyHash;
  const h2 = v.commandEnvelope(body).bodyHash;
  assert.equal(h1, h2);
});
