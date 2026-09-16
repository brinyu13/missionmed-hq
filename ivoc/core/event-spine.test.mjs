import assert from 'node:assert/strict';
import test from 'node:test';
import { EventSpine } from './event-spine.mjs';

const event = (id, media, key, payload = { value: 1 }) => ({
  event_id: id,
  session_id: 'session-1',
  t_media_ms: media,
  t_wall: '2026-09-16T13:00:00.000Z',
  source: 'client.orchestrator',
  type: 'fixture.event.v1',
  schema_version: '1',
  reliability: 'synthetic',
  availability: 'ok',
  payload,
  idempotency_key: key,
});

test('event spine is append-only, ordered, and idempotent', () => {
  const spine = new EventSpine();
  const first = spine.appendBatch('session-1', [event('e1', 20, 'k1')])[0];
  const replay = spine.appendBatch('session-1', [event('e1', 20, 'k1')])[0];
  assert.deepEqual(replay, first);
  spine.appendBatch('session-1', [event('e2', 10, 'k2')]);
  assert.deepEqual(spine.read('session-1').map((entry) => entry.event_id), ['e2', 'e1']);
  assert.equal(spine.lastSeq('session-1'), 2);
  assert.throws(() => spine.appendBatch('session-1', [event('e1', 20, 'k1', { value: 2 })]), /changed payload/);
});
