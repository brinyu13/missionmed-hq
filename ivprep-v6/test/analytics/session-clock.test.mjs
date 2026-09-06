import test from 'node:test';
import assert from 'node:assert/strict';

import { SessionClock } from '../../analytics/session-clock.mjs';

test('session and answer clocks are monotonic under clock regression', () => {
  let now = 1_000;
  const clock = new SessionClock({ sessionId: 's', now: () => now, wallClock: () => 0 });
  now = 1_500; assert.equal(clock.sessionMs(), 500);
  now = 1_200; assert.equal(clock.sessionMs(), 500);
  clock.startAnswer('a');
  now = 1_600; assert.equal(clock.answerMs('a'), 100);
  const ended = clock.endAnswer('a');
  assert.equal(ended.durationMs, 100);
  assert.equal(clock.envelope().wallClockAnchor, '1970-01-01T00:00:00.000Z');
});

test('clock rejects duplicate and unknown answers', () => {
  const clock = new SessionClock({ sessionId: 's', now: () => 0, wallClock: () => 0 });
  clock.startAnswer('a');
  assert.throws(() => clock.startAnswer('a'));
  assert.throws(() => clock.answerMs('missing'));
  clock.endAnswer('a');
  assert.throws(() => clock.endAnswer('a'));
});
