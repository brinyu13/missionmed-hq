import test from 'node:test';
import assert from 'node:assert/strict';
import { validZone, validDate, resolveWall, schedule, conflicts } from '../../server/time.mjs';

// ── validZone ──────────────────────────────────────────────────────────

test('validZone accepts America/New_York', () => {
  assert.equal(validZone('America/New_York'), true);
});

test('validZone accepts UTC', () => {
  assert.equal(validZone('UTC'), true);
});

test('validZone accepts Asia/Tokyo', () => {
  assert.equal(validZone('Asia/Tokyo'), true);
});

test('validZone accepts Europe/London', () => {
  assert.equal(validZone('Europe/London'), true);
});

test('validZone rejects empty string', () => {
  assert.equal(validZone(''), false);
});

test('validZone rejects invented zone', () => {
  assert.equal(validZone('Moon/Crater'), false);
});

test('validZone rejects non-string', () => {
  assert.equal(validZone(42), false);
});

test('validZone rejects null', () => {
  assert.equal(validZone(null), false);
});

test('validZone rejects string over 80 chars', () => {
  assert.equal(validZone('x'.repeat(81)), false);
});

// ── validDate ──────────────────────────────────────────────────────────

test('validDate accepts 2025-03-15', () => {
  assert.equal(validDate('2025-03-15'), true);
});

test('validDate accepts 2000-01-01', () => {
  assert.equal(validDate('2000-01-01'), true);
});

test('validDate accepts 2100-12-31', () => {
  assert.equal(validDate('2100-12-31'), true);
});

test('validDate rejects year below 2000', () => {
  assert.equal(validDate('1999-12-31'), false);
});

test('validDate rejects year above 2100', () => {
  assert.equal(validDate('2101-01-01'), false);
});

test('validDate rejects invalid month', () => {
  assert.equal(validDate('2025-13-01'), false);
});

test('validDate rejects invalid day', () => {
  assert.equal(validDate('2025-02-30'), false);
});

test('validDate rejects non-string', () => {
  assert.equal(validDate(20250315), false);
});

test('validDate rejects empty string', () => {
  assert.equal(validDate(''), false);
});

test('validDate rejects malformed format', () => {
  assert.equal(validDate('03/15/2025'), false);
});

test('validDate rejects datetime string', () => {
  assert.equal(validDate('2025-03-15T12:00:00Z'), false);
});

// ── resolveWall ────────────────────────────────────────────────────────

test('resolveWall returns array of candidates', () => {
  const result = resolveWall('2025-07-15T14:00', 'America/New_York');
  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 1);
});

test('resolveWall candidate has instant, offset, fold', () => {
  const result = resolveWall('2025-07-15T14:00', 'America/New_York');
  const c = result[0];
  assert.ok('instant' in c);
  assert.ok('offset' in c);
  assert.ok('fold' in c);
  assert.equal(c.fold, 0);
});

test('resolveWall instant is ISO string', () => {
  const result = resolveWall('2025-07-15T14:00', 'UTC');
  assert.ok(result[0].instant.endsWith('Z'));
});

test('resolveWall UTC offset is 0', () => {
  const result = resolveWall('2025-07-15T14:00', 'UTC');
  assert.equal(result[0].offset, 0);
  assert.equal(result[0].instant, '2025-07-15T14:00:00.000Z');
});

test('resolveWall accepts wall with seconds', () => {
  const result = resolveWall('2025-07-15T14:00:00', 'UTC');
  assert.ok(result.length >= 1);
});

test('resolveWall rejects invalid zone', () => {
  assert.throws(() => resolveWall('2025-07-15T14:00', 'Fake/Zone'), { code: 'invalid_timezone' });
});

test('resolveWall rejects invalid wall format', () => {
  assert.throws(() => resolveWall('not-a-time', 'UTC'), { code: 'invalid_wall_time' });
});

test('resolveWall rejects hour 24', () => {
  assert.throws(() => resolveWall('2025-07-15T24:00', 'UTC'), { code: 'invalid_wall_time' });
});

test('resolveWall rejects minute 60', () => {
  assert.throws(() => resolveWall('2025-07-15T14:60', 'UTC'), { code: 'invalid_wall_time' });
});

// ── schedule ───────────────────────────────────────────────────────────

test('schedule returns complete shape', () => {
  const result = schedule({ date: '2025-07-15', time: '14:00', zone: 'UTC' });
  assert.ok('date' in result);
  assert.ok('wall' in result);
  assert.ok('zone' in result);
  assert.ok('instant' in result);
  assert.ok('fold' in result);
  assert.ok('duration' in result);
  assert.ok('travel_minutes' in result);
  assert.ok('format' in result);
  assert.ok('joining' in result);
});

test('schedule resolves date+time to instant', () => {
  const result = schedule({ date: '2025-07-15', time: '14:00', zone: 'UTC' });
  assert.equal(result.instant, '2025-07-15T14:00:00.000Z');
  assert.equal(result.wall, '2025-07-15T14:00:00');
  assert.equal(result.date, '2025-07-15');
});

test('schedule defaults zone to America/New_York', () => {
  const result = schedule({ date: '2025-07-15' });
  assert.equal(result.zone, 'America/New_York');
});

test('schedule accepts date-only (no time)', () => {
  const result = schedule({ date: '2025-07-15', zone: 'UTC' });
  assert.equal(result.instant, null);
  assert.equal(result.wall, null);
  assert.equal(result.fold, null);
});

test('schedule accepts empty data (no date, no time)', () => {
  const result = schedule({});
  assert.equal(result.date, null);
  assert.equal(result.instant, null);
  assert.equal(result.format, 'unknown');
});

test('schedule rejects invalid date', () => {
  assert.throws(() => schedule({ date: 'bad' }), { code: 'invalid_date' });
});

test('schedule rejects time without date', () => {
  assert.throws(() => schedule({ time: '14:00' }), { code: 'date_required' });
});

test('schedule rejects invalid zone', () => {
  assert.throws(() => schedule({ zone: 'Fake/Zone' }), { code: 'invalid_timezone' });
});

test('schedule accepts valid duration', () => {
  const result = schedule({ date: '2025-07-15', time: '14:00', zone: 'UTC', duration: 60 });
  assert.equal(result.duration, 60);
});

test('schedule rejects zero duration', () => {
  assert.throws(() => schedule({ duration: 0 }), { code: 'invalid_duration' });
});

test('schedule rejects duration over 1440', () => {
  assert.throws(() => schedule({ duration: 1441 }), { code: 'invalid_duration' });
});

test('schedule rejects negative duration', () => {
  assert.throws(() => schedule({ duration: -1 }), { code: 'invalid_duration' });
});

test('schedule rejects float duration', () => {
  assert.throws(() => schedule({ duration: 30.5 }), { code: 'invalid_duration' });
});

test('schedule accepts null duration', () => {
  const result = schedule({ duration: null });
  assert.equal(result.duration, null);
});

test('schedule accepts valid travel_minutes', () => {
  const result = schedule({ travel_minutes: 120 });
  assert.equal(result.travel_minutes, 120);
});

test('schedule rejects travel_minutes over 10080', () => {
  assert.throws(() => schedule({ travel_minutes: 10081 }), { code: 'invalid_travel_buffer' });
});

test('schedule accepts all valid formats', () => {
  for (const fmt of ['unknown', 'virtual', 'in person', 'hybrid', 'phone']) {
    const result = schedule({ format: fmt });
    assert.equal(result.format, fmt);
  }
});

test('schedule rejects invalid format', () => {
  assert.throws(() => schedule({ format: 'smoke_signal' }), { code: 'invalid_format' });
});

test('schedule accepts joining text', () => {
  const result = schedule({ joining: 'https://zoom.us/j/123' });
  assert.equal(result.joining, 'https://zoom.us/j/123');
});

test('schedule rejects joining over 4000 chars', () => {
  assert.throws(() => schedule({ joining: 'x'.repeat(4001) }), { code: 'invalid_joining' });
});

test('schedule defaults joining to empty string', () => {
  const result = schedule({});
  assert.equal(result.joining, '');
});

test('schedule rejects fold without time', () => {
  assert.throws(() => schedule({ date: '2025-07-15', fold: 0 }), { code: 'time_required' });
});

test('schedule accepts wall directly', () => {
  const result = schedule({ wall: '2025-07-15T14:00', zone: 'UTC' });
  assert.equal(result.instant, '2025-07-15T14:00:00.000Z');
});

test('schedule rejects date/wall mismatch', () => {
  assert.throws(
    () => schedule({ date: '2025-07-16', wall: '2025-07-15T14:00', zone: 'UTC' }),
    { code: 'date_mismatch' }
  );
});

// ── conflicts ──────────────────────────────────────────────────────────

test('conflicts returns unknown when either instant is null', () => {
  assert.deepEqual(conflicts({ instant: null }, { instant: '2025-07-15T14:00:00.000Z' }), { kind: 'unknown' });
  assert.deepEqual(conflicts({ instant: '2025-07-15T14:00:00.000Z' }, { instant: null }), { kind: 'unknown' });
});

test('conflicts detects overlap', () => {
  const a = { instant: '2025-07-15T14:00:00.000Z', duration: 60, format: 'virtual' };
  const b = { instant: '2025-07-15T14:30:00.000Z', duration: 60, format: 'virtual' };
  assert.deepEqual(conflicts(a, b), { kind: 'overlap' });
});

test('conflicts no overlap when sequential', () => {
  const a = { instant: '2025-07-15T14:00:00.000Z', duration: 60, format: 'virtual' };
  const b = { instant: '2025-07-15T15:00:00.000Z', duration: 60, format: 'virtual' };
  assert.deepEqual(conflicts(a, b), { kind: 'none' });
});

test('conflicts overlap is symmetric', () => {
  const a = { instant: '2025-07-15T14:00:00.000Z', duration: 60, format: 'virtual' };
  const b = { instant: '2025-07-15T14:30:00.000Z', duration: 60, format: 'virtual' };
  assert.deepEqual(conflicts(a, b), conflicts(b, a));
});

test('conflicts returns possible when duration unknown and within 24h', () => {
  const a = { instant: '2025-07-15T14:00:00.000Z', duration: null, format: 'virtual' };
  const b = { instant: '2025-07-15T16:00:00.000Z', duration: 60, format: 'virtual' };
  const result = conflicts(a, b);
  assert.equal(result.kind, 'possible');
  assert.ok(result.reason.includes('Duration'));
});

test('conflicts returns none when duration unknown but over 24h apart', () => {
  const a = { instant: '2025-07-15T14:00:00.000Z', duration: null, format: 'virtual' };
  const b = { instant: '2025-07-17T14:00:00.000Z', duration: 60, format: 'virtual' };
  assert.deepEqual(conflicts(a, b), { kind: 'none' });
});

test('conflicts detects travel conflict for in-person', () => {
  const a = { instant: '2025-07-15T14:00:00.000Z', duration: 60, format: 'in person' };
  const b = { instant: '2025-07-15T15:30:00.000Z', duration: 60, format: 'in person', travel_minutes: 60 };
  const result = conflicts(a, b);
  assert.equal(result.kind, 'travel');
  assert.ok('gap' in result);
});

test('conflicts possible when in-person travel unknown', () => {
  const a = { instant: '2025-07-15T14:00:00.000Z', duration: 60, format: 'in person' };
  const b = { instant: '2025-07-15T15:30:00.000Z', duration: 60, format: 'in person', travel_minutes: null };
  const result = conflicts(a, b);
  assert.equal(result.kind, 'possible');
  assert.ok(result.reason.includes('Travel'));
});

test('conflicts no travel issue for virtual interviews', () => {
  const a = { instant: '2025-07-15T14:00:00.000Z', duration: 60, format: 'virtual' };
  const b = { instant: '2025-07-15T15:01:00.000Z', duration: 60, format: 'virtual', travel_minutes: 120 };
  assert.deepEqual(conflicts(a, b), { kind: 'none' });
});

test('conflicts no issue when gap exceeds travel', () => {
  const a = { instant: '2025-07-15T14:00:00.000Z', duration: 60, format: 'in person' };
  const b = { instant: '2025-07-15T16:30:00.000Z', duration: 60, format: 'in person', travel_minutes: 30 };
  assert.deepEqual(conflicts(a, b), { kind: 'none' });
});
