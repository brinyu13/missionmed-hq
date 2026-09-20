import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildContextSources,
  buildHomeViewModel,
  buildReadinessRows,
} from '../../public/studio/presentation-view-model.mjs';

const row = (rows, label) => rows.find(([name]) => name === label);

test('connected devices do not become measured readiness without per-signal evidence', () => {
  const rows = buildReadinessRows({ media: { cam: true, mic: true }, metrics: {} });
  for (const label of ['Framing', 'Face / head', 'Hands / gestures', 'Smile / expression', 'Volume', 'Pace', 'Pitch', 'Pauses']) {
    assert.equal(row(rows, label)[1], false, label);
    assert.equal(row(rows, label)[2], 'Awaiting measured evidence', label);
  }
});

test('readiness exposes only signal-specific measured evidence', () => {
  const metrics = Object.fromEntries(['FRAMING', 'HANDS', 'VOICE_LEVEL', 'PACE', 'PITCH', 'PAUSE']
    .map((key) => [key, { available: true }]));
  metrics.FACE = { available: true, smileActive: null };
  const rows = buildReadinessRows({ media: { cam: true, mic: true }, metrics });
  for (const label of ['Framing', 'Face / head', 'Hands / gestures', 'Volume', 'Pace', 'Pitch', 'Pauses']) {
    assert.equal(row(rows, label)[1], true, label);
  }
  assert.equal(row(rows, 'Smile / expression')[1], false);
  metrics.FACE.smileActive = false;
  assert.equal(row(buildReadinessRows({ media: { cam: true }, metrics }), 'Smile / expression')[1], true);
});

test('Top 3 availability follows the real mentor-priority projection', () => {
  const empty = buildContextSources({ mentorPriorities: { version: 2, priorities: [] } })
    .find((source) => source.name === 'Top 3');
  assert.equal(empty.connected, true);
  assert.equal(empty.available, false);

  const populated = buildContextSources({ mentorPriorities: { version: 3, priorities: [{ text: 'Name your contribution' }] } })
    .find((source) => source.name === 'Top 3');
  assert.equal(populated.available, true);
  assert.match(populated.detail, /1 mentor priority/u);
});

test('Home presents real latest-session and mentor state with truthful empty fallbacks', () => {
  const empty = buildHomeViewModel({ identity: { displayName: 'Alex Morgan' } });
  assert.equal(empty.initials, 'AM');
  assert.equal(empty.continueTitle, 'No saved practice yet');
  assert.equal(empty.mentorPriority, 'No mentor priority has been set yet.');

  const real = buildHomeViewModel({
    identity: { displayName: 'Brian Yu', roles: ['administrator'] },
    sessions: [
      { title: 'Older answer', startedAt: '2026-09-01T12:00:00Z' },
      { title: 'Recent answer', startedAt: '2026-09-02T12:00:00Z' },
    ],
    mentorPriorities: { priorities: [{ text: 'Lead with your contribution.' }] },
  });
  assert.equal(real.greetingName, 'Dr Brian.');
  assert.equal(real.continueTitle, 'Recent answer');
  assert.equal(real.mentorPriority, 'Lead with your contribution.');
});
