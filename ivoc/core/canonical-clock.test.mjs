import assert from 'node:assert/strict';
import test from 'node:test';
import { CanonicalClock } from './canonical-clock.mjs';

test('capture-owner clock records holes and enforces the drift gate', () => {
  let monotonic = 1000;
  const clock = new CanonicalClock({
    monotonicNow: () => monotonic,
    wallNow: () => '2026-09-16T13:00:00.000Z',
  });
  assert.equal(clock.start().t_media_ms, 0);
  monotonic = 1600;
  assert.equal(clock.now(), 600);
  clock.pause();
  monotonic = 2100;
  assert.deepEqual(clock.resume(), { at_media_ms: 600, duration_ms: 500 });
  monotonic = 2400;
  assert.equal(clock.now(), 900);
  assert.equal(clock.reconcile(1000).within_gate, true);
  assert.equal(clock.reconcile(1100).within_gate, false);
});
