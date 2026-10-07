import test from 'node:test';
import assert from 'node:assert/strict';
import { cohortRange } from '../../server/calendar-cohort.mjs';

// ── cohortRange ───────────────────────────────────────────────────────

test('cohortRange accepts valid date range', () => {
  const result = cohortRange({ start: '2025-07-01', end: '2025-07-15' });
  assert.equal(result.start, '2025-07-01');
  assert.equal(result.end, '2025-07-15');
  assert.equal(result.cursor, null);
});

test('cohortRange accepts same-day range', () => {
  const result = cohortRange({ start: '2025-07-15', end: '2025-07-15' });
  assert.equal(result.start, '2025-07-15');
  assert.equal(result.end, '2025-07-15');
});

test('cohortRange accepts exactly 89-day range', () => {
  const result = cohortRange({ start: '2025-01-01', end: '2025-03-31' });
  assert.equal(result.start, '2025-01-01');
  assert.equal(result.end, '2025-03-31');
});

test('cohortRange passes through cursor value', () => {
  const result = cohortRange({ start: '2025-07-01', end: '2025-07-15', cursor: 'page_token' });
  assert.equal(result.cursor, 'page_token');
});

test('cohortRange defaults cursor to null when falsy', () => {
  const result = cohortRange({ start: '2025-07-01', end: '2025-07-15', cursor: '' });
  assert.equal(result.cursor, null);
});

test('cohortRange rejects null input', () => {
  assert.throws(() => cohortRange(null), { code: 'calendar_range' });
});

test('cohortRange rejects undefined input', () => {
  assert.throws(() => cohortRange(undefined), { code: 'calendar_range' });
});

test('cohortRange rejects missing start', () => {
  assert.throws(() => cohortRange({ end: '2025-07-15' }), { code: 'calendar_range' });
});

test('cohortRange rejects missing end', () => {
  assert.throws(() => cohortRange({ start: '2025-07-01' }), { code: 'calendar_range' });
});

test('cohortRange rejects invalid start date', () => {
  assert.throws(() => cohortRange({ start: 'bad', end: '2025-07-15' }), { code: 'calendar_range' });
});

test('cohortRange rejects invalid end date', () => {
  assert.throws(() => cohortRange({ start: '2025-07-01', end: 'bad' }), { code: 'calendar_range' });
});

test('cohortRange rejects reversed dates (end before start)', () => {
  assert.throws(
    () => cohortRange({ start: '2025-07-15', end: '2025-07-01' }),
    { code: 'calendar_range' }
  );
});

test('cohortRange rejects range of 90 days or more', () => {
  assert.throws(
    () => cohortRange({ start: '2025-01-01', end: '2025-04-01' }),
    { code: 'calendar_range' }
  );
});

test('cohortRange rejects unexpected keys', () => {
  assert.throws(
    () => cohortRange({ start: '2025-07-01', end: '2025-07-15', extra: true }),
    { code: 'calendar_range' }
  );
});

test('cohortRange rejects date out of validDate range', () => {
  assert.throws(
    () => cohortRange({ start: '1999-01-01', end: '1999-02-01' }),
    { code: 'calendar_range' }
  );
});
