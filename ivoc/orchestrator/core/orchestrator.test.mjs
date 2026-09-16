import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PromptedMockDirector } from '../../brain/prompted/director.mjs';
import { CanonicalClock } from '../../core/canonical-clock.mjs';
import { EventSpine } from '../../core/event-spine.mjs';
import { SessionStore } from '../../core/session-store.mjs';
import { PromptedMockOrchestrator } from './orchestrator.mjs';
import { runTeardown, TEARDOWN_ORDER } from './teardown.mjs';

const sessionFixture = JSON.parse(await readFile(new URL('../../fixtures/session.v1.json', import.meta.url), 'utf8'));
const pool = JSON.parse(await readFile(new URL('../../fixtures/question-pool.v1.json', import.meta.url), 'utf8'));

test('Prompted Mock owns one clock and no audio authority or provider', async () => {
  let tick = 0;
  const clock = new CanonicalClock({ monotonicNow: () => tick, wallNow: () => '2026-09-16T13:00:00.000Z' });
  const store = new SessionStore();
  const spine = new EventSpine();
  store.create(sessionFixture);
  let session = store.transition(sessionFixture.session_id, 'ready_check', { expectedVersion: 0, idempotencyKey: 'ready', at: '2026-09-16T13:00:00.000Z' });
  session = store.transition(sessionFixture.session_id, 'armed', { expectedVersion: session.state_version, idempotencyKey: 'armed', at: '2026-09-16T13:00:00.000Z' });
  const orchestrator = new PromptedMockOrchestrator({ sessionId: session.session_id, sessionStore: store, eventSpine: spine, clock, wallNow: () => '2026-09-16T13:00:00.000Z' });
  orchestrator.start({ idempotencyKey: 'start' });
  tick = 1000;
  const director = new PromptedMockDirector(pool);
  const card = orchestrator.present(director.next('move-1'), { idempotencyKey: 'present-1' });
  assert.equal(card.card.canonical_id, pool.expanded_question_ids[0]);
  assert.equal(orchestrator.audioAuthority, 'none');
  orchestrator.beginAnswer({ answerId: 'answer-1', idempotencyKey: 'answer-1' });
  tick = 2500;
  orchestrator.endAnswer({ answerId: 'answer-1', idempotencyKey: 'answer-1-end' });
  const ended = await orchestrator.end({ idempotencyKey: 'end' });
  assert.equal(ended.state, 'Sealing');
  assert.equal([...ended.records.values()].every((record) => record.status === 'ok'), true);
  assert.equal(spine.read(session.session_id).some((event) => event.type.startsWith('provider.')), false);
});

test('teardown attempts every ordered step after an individual failure', async () => {
  const attempted = [];
  const steps = Object.fromEntries(TEARDOWN_ORDER.map((name) => [name, async () => {
    attempted.push(name);
    if (name === 'transport') throw new Error('fixture transport stop failed');
  }]));
  const records = await runTeardown(steps);
  assert.deepEqual(attempted, TEARDOWN_ORDER);
  assert.equal(records.get('transport').status, 'failed');
  assert.equal(records.get('session_sealing').status, 'ok');
});
