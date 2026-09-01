import test from 'node:test';
import assert from 'node:assert/strict';
import {
  intervalRuns,
  mediaToSessionSeconds,
  mediaToSessionMs,
  normalizeDurations,
  normalizeTimebase,
  selectLibrarySessions,
  selectMentorSessions,
  sessionToMediaSeconds,
  sessionToMediaMs,
  tracePath,
} from '../../public/ivoc-standalone/app/post-model.mjs';

test('flight recorder trace preserves unavailable and long-gap discontinuities', () => {
  const path = tracePath([
    { t: 0, vol: .2 },
    { t: .5, vol: .4 },
    { t: 1, vol: null },
    { t: 3, vol: .8 },
  ], 'vol', 4);
  assert.match(path, /^M0\.00,22\.00 L12\.50,18\.00 M75\.00,10\.00$/);
});

test('flight recorder interval runs preserve state and hand transitions', () => {
  const runs = intervalRuns([
    { t: 0, state: 'LISTENING' },
    { t: .5, state: 'LISTENING' },
    { t: 1, state: 'ANSWERING' },
    { t: 1.5, state: 'ANSWERING' },
  ], point => point.state, 10);
  assert.deepEqual(runs.map(run => run.value), ['LISTENING', 'ANSWERING']);
  assert.equal(runs[0].width, 10);
  assert.equal(runs[1].width, 5);
});

test('flight recorder interval runs leave long observation gaps visible', () => {
  const runs = intervalRuns([
    { t: 0, state: 'LISTENING' },
    { t: .5, state: 'LISTENING' },
    { t: 4, state: 'LISTENING' },
    { t: 4.5, state: 'LISTENING' },
  ], point => point.state, 5);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.map(({ start, end }) => [start, end]), [[0, .5], [4, 4.5]]);
});

test('canonical session and media clocks map startup offset and pauses in both directions', () => {
  const timebase = normalizeTimebase({
    recordingStartSessionMs: 2_000,
    pausedSpans: [
      { startMs: 7_000, endMs: 10_000 },
      { startMs: 14_000, endMs: 15_000 },
    ],
  });
  assert.equal(sessionToMediaMs(1_000, timebase), 0);
  assert.equal(sessionToMediaMs(5_000, timebase), 3_000);
  assert.equal(sessionToMediaMs(8_000, timebase), 5_000);
  assert.equal(sessionToMediaMs(16_000, timebase), 10_000);
  assert.equal(mediaToSessionMs(3_000, timebase), 5_000);
  assert.equal(mediaToSessionMs(5_000, timebase), 10_000);
  assert.equal(mediaToSessionMs(10_000, timebase), 16_000);
  assert.equal(sessionToMediaSeconds(16, timebase), 10);
  assert.equal(mediaToSessionSeconds(10, timebase), 16);
});

test('duration normalizer preserves explicit vocabulary and current legacy envelope fields', () => {
  assert.deepEqual(normalizeDurations({ durations: {
    sessionMs: 20_000,
    recordingMs: 15_000,
    playableMs: 14_900,
    activeAnsweringMs: 9_000,
    analyticsObservationMs: 19_500,
  } }), {
    sessionDurationMs: 20_000,
    recordingDurationMs: 15_000,
    playableDurationMs: 14_900,
    activeAnsweringDurationMs: 9_000,
    analyticsObservationDurationMs: 19_500,
    sessionMs: 20_000,
    recordingMs: 15_000,
    playableMs: 14_900,
    activeAnsweringMs: 9_000,
    analyticsObservationMs: 19_500,
    timelineMs: 20_000,
    replayMs: 14_900,
  });
  assert.deepEqual(normalizeDurations({
    durationMs: 14_900,
    sessionDurationMs: 20_000,
    recordingDurationMs: 15_000,
  }), {
    sessionDurationMs: 20_000,
    recordingDurationMs: 15_000,
    playableDurationMs: 14_900,
    activeAnsweringDurationMs: null,
    analyticsObservationDurationMs: null,
    sessionMs: 20_000,
    recordingMs: 15_000,
    playableMs: 14_900,
    activeAnsweringMs: null,
    analyticsObservationMs: null,
    timelineMs: 20_000,
    replayMs: 14_900,
  });
});

test('library model defaults to newest list truth and supports search, review, and score sorting', () => {
  const rows = [
    { id: 'a', title: 'Patient conflict', questionText: 'difficult patient', sessionType: 'quick', reviewStatus: 'pending', startedAt: '2026-01-01', scores: { pace: 5, volume: 6, variety: 7 } },
    { id: 'b', title: 'Leadership', questionText: 'team', sessionType: 'mock', reviewStatus: 'reviewed', startedAt: '2026-01-02', scores: { pace: 9, volume: 8, variety: 7 } },
  ];
  assert.deepEqual(selectLibrarySessions(rows).map(row => row.id), ['b', 'a']);
  assert.deepEqual(selectLibrarySessions(rows, { filter: 'reviewed' }).map(row => row.id), ['b']);
  assert.deepEqual(selectLibrarySessions(rows, { query: 'patient' }).map(row => row.id), ['a']);
  assert.deepEqual(selectLibrarySessions(rows, { sort: 'score', scoreOf: row => row.scores }).map(row => row.id), ['b', 'a']);
});

test('mentor queue is assigned-data only and filters without inventing review state', () => {
  const rows = [
    { id: 'a', studentName: 'Alex', title: 'Take one', reviewStatus: 'pending' },
    { id: 'b', studentName: 'Bailey', title: 'Take two', reviewStatus: 'reviewed' },
  ];
  assert.deepEqual(selectMentorSessions(rows).map(row => row.id), ['a']);
  assert.deepEqual(selectMentorSessions(rows, { filter: 'reviewed' }).map(row => row.id), ['b']);
  assert.deepEqual(selectMentorSessions(rows, { filter: 'all', query: 'alex' }).map(row => row.id), ['a']);
});

test('library selectors support the serious review filters and metric sorts from one dataset', () => {
  const now = Date.parse('2026-08-31T12:00:00Z');
  const rows = [
    { id: 'a', startedAt: '2026-08-30T12:00:00Z', questionCategory: 'behavioral', sessionType: 'quick', reviewStatus: 'pending', recording: { durationMs: 90_000 }, scores: { pace: 6, volume: 7, variety: 6 } },
    { id: 'b', startedAt: '2026-07-01T12:00:00Z', questionCategory: 'ethics', sessionType: 'mock', reviewStatus: 'reviewed', recording: { durationMs: 120_000 }, scores: { pace: 8, volume: 8, variety: 8 } },
  ];
  const scoreOf = row => row.scores;
  assert.deepEqual(selectLibrarySessions(rows, { category: 'behavioral', scoreOf }).map(row => row.id), ['a']);
  assert.deepEqual(selectLibrarySessions(rows, { dateRangeDays: 7, now, scoreOf }).map(row => row.id), ['a']);
  assert.deepEqual(selectLibrarySessions(rows, { performance: 'on-target', scoreOf }).map(row => row.id), ['b']);
  assert.deepEqual(selectLibrarySessions(rows, { sort: 'duration', scoreOf }).map(row => row.id), ['b', 'a']);
  assert.deepEqual(selectLibrarySessions(rows, { sort: 'pace', scoreOf }).map(row => row.id), ['b', 'a']);
});

test('mentor selector composes student, mode, category, and date filters', () => {
  const now = Date.parse('2026-08-31T12:00:00Z');
  const rows = [
    { id: 'a', ownerId: 's1', ownerDisplayName: 'Alex', startedAt: '2026-08-30T12:00:00Z', questionCategory: 'behavioral', sessionType: 'quick', reviewStatus: 'pending' },
    { id: 'b', ownerId: 's2', ownerDisplayName: 'Bailey', startedAt: '2026-07-01T12:00:00Z', questionCategory: 'ethics', sessionType: 'mock', reviewStatus: 'pending' },
  ];
  assert.deepEqual(selectMentorSessions(rows, { student: 's1', mode: 'quick', category: 'behavioral', dateRangeDays: 7, now }).map(row => row.id), ['a']);
  assert.deepEqual(selectMentorSessions(rows, { mode: 'mock' }).map(row => row.id), ['b']);
});
