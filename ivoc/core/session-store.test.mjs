import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SessionStore } from './session-store.mjs';

const fixture = JSON.parse(await readFile(new URL('../fixtures/session.v1.json', import.meta.url), 'utf8'));

test('session state transitions require version and command idempotency', () => {
  const store = new SessionStore();
  store.create(fixture);
  const ready = store.transition(fixture.session_id, 'ready_check', {
    expectedVersion: 0,
    idempotencyKey: 'ready',
    at: '2026-09-16T13:00:01.000Z',
  });
  assert.equal(ready.state_version, 1);
  assert.deepEqual(store.transition(fixture.session_id, 'ready_check', {
    expectedVersion: 0,
    idempotencyKey: 'ready',
    at: '2026-09-16T13:00:01.000Z',
  }), ready);
  assert.throws(() => store.transition(fixture.session_id, 'live', {
    expectedVersion: 1,
    idempotencyKey: 'skip-armed',
    at: '2026-09-16T13:00:02.000Z',
  }), /invalid session transition/);
});
