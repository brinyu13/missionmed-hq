import test from 'node:test';
import assert from 'node:assert/strict';
import { intervalRuns, selectLibrarySessions, selectMentorSessions, tracePath } from '../../public/ivoc-standalone/app/post-model.mjs';

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
    { t: 2, state: 'LISTENING' },
    { t: 3, state: 'ANSWERING' },
    { t: 7, state: 'ANSWERING' },
  ], point => point.state, 10);
  assert.deepEqual(runs.map(run => run.value), ['LISTENING', 'ANSWERING']);
  assert.equal(runs[0].width, 30);
  assert.equal(runs[1].width, 40);
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
