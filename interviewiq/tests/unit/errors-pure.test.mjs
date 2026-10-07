import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError, requireValue, notFound } from '../../server/errors.mjs';

// ── AppError ────────────────────────────────────────────────────────

test('AppError is an Error', () => {
  const err = new AppError(422, 'test_code', 'test message');
  assert.ok(err instanceof Error);
  assert.ok(err instanceof AppError);
});

test('AppError has correct properties', () => {
  const err = new AppError(400, 'bad_input', 'Invalid input', { field: 'name' });
  assert.equal(err.status, 400);
  assert.equal(err.code, 'bad_input');
  assert.equal(err.message, 'Invalid input');
  assert.deepEqual(err.details, { field: 'name' });
  assert.equal(err.name, 'AppError');
});

test('AppError omits details when undefined', () => {
  const err = new AppError(500, 'server', 'fail');
  assert.ok(!('details' in err));
});

test('AppError details can be null', () => {
  const err = new AppError(422, 'code', 'msg', null);
  assert.ok('details' in err);
  assert.equal(err.details, null);
});

test('AppError details can be false', () => {
  const err = new AppError(422, 'code', 'msg', false);
  assert.ok('details' in err);
  assert.equal(err.details, false);
});

test('AppError has a stack trace', () => {
  const err = new AppError(422, 'code', 'msg');
  assert.ok(typeof err.stack === 'string');
  assert.ok(err.stack.includes('AppError'));
});

// ── requireValue ────────────────────────────────────────────────────

test('requireValue does not throw for truthy condition', () => {
  assert.doesNotThrow(() => requireValue(true, 'code', 'msg'));
  assert.doesNotThrow(() => requireValue(1, 'code', 'msg'));
  assert.doesNotThrow(() => requireValue('yes', 'code', 'msg'));
});

test('requireValue throws AppError for falsy condition', () => {
  assert.throws(() => requireValue(false, 'test_code', 'test message'), {
    name: 'AppError',
    code: 'test_code',
    message: 'test message',
    status: 422,
  });
});

test('requireValue defaults status to 422', () => {
  try {
    requireValue(false, 'code', 'msg');
  } catch (e) {
    assert.equal(e.status, 422);
  }
});

test('requireValue accepts custom status', () => {
  assert.throws(() => requireValue(false, 'code', 'msg', 403), {
    status: 403,
  });
});

test('requireValue accepts details', () => {
  try {
    requireValue(false, 'code', 'msg', 422, { hint: 'check input' });
  } catch (e) {
    assert.deepEqual(e.details, { hint: 'check input' });
  }
});

test('requireValue throws for null condition', () => {
  assert.throws(() => requireValue(null, 'code', 'msg'));
});

test('requireValue throws for 0 condition', () => {
  assert.throws(() => requireValue(0, 'code', 'msg'));
});

test('requireValue throws for empty string condition', () => {
  assert.throws(() => requireValue('', 'code', 'msg'));
});

// ── notFound ────────────────────────────────────────────────────────

test('notFound returns an AppError', () => {
  const err = notFound();
  assert.ok(err instanceof AppError);
  assert.ok(err instanceof Error);
});

test('notFound has status 404', () => {
  assert.equal(notFound().status, 404);
});

test('notFound has code not_found', () => {
  assert.equal(notFound().code, 'not_found');
});

test('notFound has expected message', () => {
  assert.equal(notFound().message, 'This record is unavailable.');
});
