import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PromptedMockDirector } from '../brain/prompted/director.mjs';
import { PromptedMockOrchestrator } from '../orchestrator/core/orchestrator.mjs';
import { CanonicalClock } from './canonical-clock.mjs';
import { EventSpine } from './event-spine.mjs';
import { SessionStore } from './session-store.mjs';

const sessionFixture = JSON.parse(await readFile(new URL('../fixtures/session.v1.json', import.meta.url), 'utf8'));
const pool = JSON.parse(await readFile(new URL('../fixtures/question-pool.v1.json', import.meta.url), 'utf8'));

test('F1 fixture runs deterministic Prompted Mock through canonical completion', async () => {
  let tick = 100;
  let wallTick = 0;
  const wallNow = () => `2026-09-16T13:00:${String(wallTick++).padStart(2, '0')}.000Z`;
  const clock = new CanonicalClock({ monotonicNow: () => tick, wallNow });
  const store = new SessionStore();
  const spine = new EventSpine();
  const director = new PromptedMockDirector(pool);
  store.create(sessionFixture);
  let session = store.transition(sessionFixture.session_id, 'ready_check', { expectedVersion: 0, idempotencyKey: 'ready', at: wallNow() });
  session = store.transition(session.session_id, 'armed', { expectedVersion: 1, idempotencyKey: 'armed', at: wallNow() });
  const orchestrator = new PromptedMockOrchestrator({ sessionId: session.session_id, sessionStore: store, eventSpine: spine, clock, wallNow });
  orchestrator.start({ idempotencyKey: 'start' });
  for (let index = 0; index < pool.expanded_question_ids.length; index++) {
    tick += 1000;
    const move = director.next(`move-${index}`);
    orchestrator.present(move, { idempotencyKey: `present-${index}` });
    orchestrator.beginAnswer({ answerId: `answer-${index}`, idempotencyKey: `answer-${index}` });
    tick += 2000;
    orchestrator.endAnswer({ answerId: `answer-${index}`, idempotencyKey: `answer-end-${index}` });
  }
  assert.equal(director.next('close').move, 'close');
  const teardown = await orchestrator.end({ idempotencyKey: 'end' });
  assert.equal(teardown.state, 'Sealing');
  session = store.get(session.session_id);
  session = store.transition(session.session_id, 'processing', { expectedVersion: session.state_version, idempotencyKey: 'processing', at: wallNow() });
  session = store.transition(session.session_id, 'complete', { expectedVersion: session.state_version, idempotencyKey: 'complete', at: wallNow() });
  assert.equal(session.state, 'complete');
  const events = spine.read(session.session_id);
  assert.deepEqual(events.filter((event) => event.type === 'question.asked.v1').map((event) => event.payload.question_id), pool.expanded_question_ids);
  assert.equal(events.every((event) => Number.isFinite(event.t_media_ms)), true);
  assert.equal(events.some((event) => event.type.startsWith('provider.')), false);
});
