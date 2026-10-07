import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleColumns, scheduleValues, deadline } from '../../server/records.mjs';

// ── scheduleColumns ────────────────────────────────────────────────────

test('scheduleColumns returns resolved schedule with format and all_day', () => {
  const result = scheduleColumns({ date: '2025-07-15', time: '14:00', zone: 'UTC', format: 'virtual' });
  assert.ok('date' in result);
  assert.ok('wall' in result);
  assert.ok('zone' in result);
  assert.ok('instant' in result);
  assert.ok('format' in result);
  assert.ok('all_day' in result);
});

test('scheduleColumns normalizes in_person to schedule then back', () => {
  const result = scheduleColumns({ date: '2025-07-15', time: '14:00', zone: 'UTC', format: 'in_person' });
  assert.equal(result.format, 'in_person');
});

test('scheduleColumns preserves virtual format', () => {
  const result = scheduleColumns({ date: '2025-07-15', time: '14:00', zone: 'UTC', format: 'virtual' });
  assert.equal(result.format, 'virtual');
});

test('scheduleColumns defaults format to unknown', () => {
  const result = scheduleColumns({ date: '2025-07-15', zone: 'UTC' });
  assert.equal(result.format, 'unknown');
});

test('scheduleColumns sets all_day true for date-only', () => {
  const result = scheduleColumns({ date: '2025-07-15', zone: 'UTC' });
  assert.equal(result.all_day, true);
  assert.equal(result.instant, null);
});

test('scheduleColumns sets all_day false for date+time', () => {
  const result = scheduleColumns({ date: '2025-07-15', time: '14:00', zone: 'UTC' });
  assert.equal(result.all_day, false);
  assert.ok(result.instant);
});

test('scheduleColumns sets all_day false when no date', () => {
  const result = scheduleColumns({ zone: 'UTC' });
  assert.equal(result.all_day, false);
});

test('scheduleColumns rejects allDay with clock time', () => {
  assert.throws(
    () => scheduleColumns({ date: '2025-07-15', time: '14:00', zone: 'UTC', allDay: true }),
    { code: 'invalid_all_day' }
  );
});

test('scheduleColumns passes through duration', () => {
  const result = scheduleColumns({ date: '2025-07-15', time: '14:00', zone: 'UTC', duration: 90 });
  assert.equal(result.duration, 90);
});

test('scheduleColumns passes through travel_minutes', () => {
  const result = scheduleColumns({ date: '2025-07-15', time: '14:00', zone: 'UTC', travel_minutes: 45 });
  assert.equal(result.travel_minutes, 45);
});

test('scheduleColumns passes through joining', () => {
  const result = scheduleColumns({ joining: 'https://zoom.us/j/123', zone: 'UTC' });
  assert.equal(result.joining, 'https://zoom.us/j/123');
});

test('scheduleColumns defaults joining to empty', () => {
  const result = scheduleColumns({ zone: 'UTC' });
  assert.equal(result.joining, '');
});

// ── scheduleValues ─────────────────────────────────────────────────────

test('scheduleValues returns 10-element array', () => {
  const cols = scheduleColumns({ date: '2025-07-15', time: '14:00', zone: 'UTC', format: 'virtual' });
  const vals = scheduleValues(cols);
  assert.equal(vals.length, 10);
});

test('scheduleValues array order: date, time, zone, instant, fold, all_day, duration, travel_minutes, format, joining', () => {
  const cols = scheduleColumns({ date: '2025-07-15', time: '14:00', zone: 'UTC', format: 'virtual', duration: 60, travel_minutes: 30, joining: 'link' });
  const vals = scheduleValues(cols);
  assert.equal(vals[0], '2025-07-15');       // date
  assert.equal(vals[1], '14:00:00');          // time (sliced from wall)
  assert.equal(vals[2], 'UTC');               // zone
  assert.ok(vals[3].endsWith('Z'));           // instant
  assert.equal(vals[4], 0);                   // fold
  assert.equal(vals[5], false);               // all_day
  assert.equal(vals[6], 60);                  // duration
  assert.equal(vals[7], 30);                  // travel_minutes
  assert.equal(vals[8], 'virtual');           // format
  assert.equal(vals[9], 'link');              // joining
});

test('scheduleValues null time for date-only', () => {
  const cols = scheduleColumns({ date: '2025-07-15', zone: 'UTC' });
  const vals = scheduleValues(cols);
  assert.equal(vals[1], null); // no wall → null time
});

test('scheduleValues null instant for date-only', () => {
  const cols = scheduleColumns({ date: '2025-07-15', zone: 'UTC' });
  const vals = scheduleValues(cols);
  assert.equal(vals[3], null);
});

// ── deadline ───────────────────────────────────────────────────────────

test('deadline accepts valid date', () => {
  assert.equal(deadline('2025-07-15'), '2025-07-15');
});

test('deadline accepts null', () => {
  assert.equal(deadline(null), null);
});

test('deadline accepts undefined', () => {
  assert.equal(deadline(undefined), null);
});

test('deadline rejects invalid date string', () => {
  assert.throws(() => deadline('not-a-date'), { code: 'invalid_deadline' });
});

test('deadline rejects number', () => {
  assert.throws(() => deadline(20250715), { code: 'invalid_deadline' });
});

test('deadline rejects date out of range', () => {
  assert.throws(() => deadline('1999-12-31'), { code: 'invalid_deadline' });
});
