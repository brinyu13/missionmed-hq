import assert from 'node:assert/strict';
import test from 'node:test';
import { createIvocLiveTranscriptStore } from '../../server/providers/ivoc-live-transcript-store.mjs';

const identity = { ownerSubject: 'wp:1', ivocSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  providerSessionId: 'live_session_fixture', observationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' };
const session = { id: identity.ivocSessionId, owner_subject: identity.ownerSubject, state: 'active', interviewer_provider: 'openai-gpt-live' };
const attached = () => ({ observation_id: identity.observationId, seq: 1, session_id: identity.ivocSessionId,
  owner_subject: identity.ownerSubject, provider_session_id: identity.providerSessionId, kind: 'attached',
  speaker: null, provider_event_id: null, fragment_text: null, provider_start_ms: null, provider_end_ms: null,
  server_received_at: '2026-10-02T03:00:00.000Z', terminal_status: null, terminal_reason: null });

test('private transcript sink requires current exact active AI owner before binding', async () => {
  for (const row of [null, { ...session, owner_subject: 'wp:2' }, { ...session, state: 'saved' },
    { ...session, id: identity.observationId }, { ...session, interviewer_provider: 'missionmed-static' }]) {
    let writes = 0;
    const store = createIvocLiveTranscriptStore({ rest: { table: async () => row ? [row] : [], request: async () => { writes++; } } });
    await assert.rejects(() => store.bindObservation(identity), /active owned live session/);
    assert.equal(writes, 0);
  }
});

test('private sink preserves exact fragments and freezes authorized batch before asynchronous storage', async () => {
  const calls = [];
  const store = createIvocLiveTranscriptStore({ rest: {
    table: async (table, query) => { assert.equal(table, 'ivoc_sessions');
      assert.match(query, /owner_subject=eq.wp%3A1/u); return [session]; },
    request: async (path, options) => { calls.push({ path, options }); },
  } });
  const append = await store.bindObservation(identity);
  const fragment = { ...attached(), seq: 2, kind: 'fragment', speaker: 'input',
    fragment_text: ' I  researched', provider_event_id: 'evt_1', provider_start_ms: 300, provider_end_ms: 800 };
  const pending = append([attached(), fragment]); fragment.fragment_text = 'changed'; await pending;
  assert.equal(calls[0].path, '/ivoc_live_transcript_events');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.prefer, 'return=minimal');
  assert.equal(calls[0].options.body[1].fragment_text, ' I  researched');
  assert.equal(calls[0].options.body[1].provider_start_ms, 300);
});

test('private sink rejects foreign, oversized and extra-field records before any persistence', async () => {
  let writes = 0;
  const store = createIvocLiveTranscriptStore({ rest: { table: async () => [session], request: async () => { writes++; } } });
  const append = await store.bindObservation(identity);
  for (const key of ['observation_id', 'session_id', 'owner_subject', 'provider_session_id']) {
    await assert.rejects(() => append([{ ...attached(), [key]: 'other' }]), /binding invalid/);
  }
  await assert.rejects(() => append([{ ...attached(), database_received_at: 'override' }]), /binding invalid/);
  await assert.rejects(() => append(Array(33).fill(attached())), /batch invalid/);
  await assert.rejects(() => append([]), /batch invalid/);
  assert.equal(writes, 0);
});

test('storage errors are generic and never claim a terminal was persisted', async () => {
  const store = createIvocLiveTranscriptStore({ rest: { table: async () => [session],
    request: async () => { throw new Error('sensitive transcript and credential fixture'); } } });
  const append = await store.bindObservation(identity);
  await assert.rejects(() => append([attached()]), error => {
    assert.equal(error.message, 'IVOC live transcript persistence unconfirmed.'); return true;
  });
});
