import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { readLiveTranscriptReview } from '../../ivoc/live-transcript-review.mjs';
import { createIvocRepository } from '../../ivoc/repository.mjs';
import { createIvocLiveTranscriptStore } from '../../../ivprep-v6/server/providers/ivoc-live-transcript-store.mjs';
import { attachOpenAiLiveTranscriptObserver } from '../../../ivprep-v6/server/providers/openai-live-transcript-observer.mjs';

const sid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', oid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session = { id: sid, owner_subject: 'wp:42', interviewer_provider: 'openai-gpt-live', state: 'active' };
const root = () => ({ observation_id: oid, seq: 1, session_id: sid, owner_subject: 'wp:42',
  provider_session_id: 'live_offline_fixture', kind: 'attached', speaker: null, provider_event_id: null,
  fragment_text: null, provider_start_ms: null, provider_end_ms: null,
  server_received_at: '2026-10-02T04:00:00Z', terminal_status: null, terminal_reason: null });
const fragment = (seq = 2, text = ' I  did research.', speaker = 'input') => ({ ...root(), seq, kind: 'fragment',
  speaker, fragment_text: text, provider_event_id: `event_${seq}`, provider_start_ms: 500, provider_end_ms: 1000 });
const terminal = (seq = 3, status = 'PROVIDER_CLOSED') => ({ ...root(), seq, kind: 'terminal',
  terminal_status: status, terminal_reason: status === 'PROVIDER_CLOSED' ? 'provider_closed' : 'socket_closed' });
function reader(rows, { cap = 256, intercept } = {}) {
  return { request: async (path, options) => {
    assert.equal(options.signal instanceof AbortSignal, true);
    assert.match(path, new RegExp(`^ivoc_live_transcript_events\\?session_id=eq\\.${sid}&owner_subject=eq\\.wp%3A42&`));
    const query = new URLSearchParams(path.split('?')[1]);
    const custom = intercept?.(path, query); if (custom !== undefined) return custom;
    if (query.get('kind')) return rows.filter(row => row.kind === 'attached').slice(0, 5);
    assert.equal(query.get('observation_id'), `eq.${oid}`);
    if (query.get('order') === 'seq.desc') return rows.length ? [{ seq: Math.max(...rows.map(r => r.seq)) }] : [];
    const [, after, high] = query.get('and').match(/^\(seq.gt.(\d+),seq.lte.(\d+)\)$/u);
    return rows.filter(r => r.seq > +after && r.seq <= +high).slice(0, Math.min(cap, +query.get('limit')));
  } };
}

test('cold reader preserves exact input/output fragments with server-only custody and no stronger claims', async () => {
  const rows = [root(), fragment(), fragment(3, ' Why?', 'output'), terminal(4)];
  const result = await readLiveTranscriptReview(reader(rows), session);
  assert.equal(result.status, 'AVAILABLE'); assert.equal(result.heardAudio, 'UNVERIFIED');
  assert.equal(result.speechBoundaries, 'UNVERIFIED'); assert.equal(result.candidateIdentity, 'UNVERIFIED');
  assert.deepEqual(result.observations[0], { ordinal: 1, status: 'PROVIDER_CLOSED', fragments: [
    { sequence: 2, speaker: 'student', text: ' I  did research.', providerStartMs: 500, providerEndMs: 1000 },
    { sequence: 3, speaker: 'interviewer', text: ' Why?', providerStartMs: 500, providerEndMs: 1000 },
  ] });
  assert.doesNotMatch(JSON.stringify(result), /live_offline_fixture|event_2|owner_subject|observation_id|canonical_ref|answerId/);
  assert.deepEqual(rows[1], fragment());
});

test('missing terminal and socket close remain partial; absent capture differs from failed read', async () => {
  for (const rows of [[root()], [root(), fragment()], [root(), fragment(), terminal(3, 'INCOMPLETE')]]) {
    const result = await readLiveTranscriptReview(reader(rows), session);
    assert.equal(result.status, 'AVAILABLE'); assert.equal(result.observations[0].status, 'INCOMPLETE');
  }
  assert.equal((await readLiveTranscriptReview(reader([]), session)).reason, 'NOT_CAPTURED');
  assert.equal((await readLiveTranscriptReview({ request: async () => { throw Error('private'); } }, session)).reason, 'READ_UNAVAILABLE');
  assert.equal((await readLiveTranscriptReview({ request: () => assert.fail() }, { ...session, interviewer_provider: 'missionmed-static' })).reason, 'NOT_APPLICABLE');
});

test('capped pages use contiguous keysets and fixed high water, not page length as completion', async () => {
  const rows = [root(), ...Array.from({ length: 300 }, (_, i) => fragment(i + 2)), terminal(302)];
  const result = await readLiveTranscriptReview(reader(rows, { cap: 20 }), session);
  assert.equal(result.observations[0].fragments.length, 300);
  const partial = [root(), fragment()];
  let tailRead = false;
  const db = reader(partial, { intercept: (_path, query) => {
    if (query.get('order') === 'seq.desc') { tailRead = true; return [{ seq: 2 }]; }
    if (tailRead && partial.length === 2) partial.push(terminal());
  } });
  assert.equal((await readLiveTranscriptReview(db, session)).observations[0].status, 'INCOMPLETE');
});

test('owner/provider/session drift, gaps, invalid shape and duplicate events return no text', async () => {
  const mutations = [
    r => { r[1].owner_subject = 'wp:7'; }, r => { r[1].session_id = oid; },
    r => { r[1].provider_session_id = 'different_provider'; }, r => { r[1].observation_id = sid; },
    r => { r[1].seq = 7; }, r => { r[1].provider_start_ms = null; }, r => { r[1].speaker = 'other'; },
    r => { r[1].fragment_text = 'a'.repeat(16385); }, r => { r[1].provider_end_ms = -1; },
    r => { r[2].provider_event_id = r[1].provider_event_id; }, r => { r[3].terminal_reason = 'made_up'; },
    r => { r[3].terminal_status = 'COMPLETE'; }, r => { r[0].kind = 'fragment'; },
  ];
  for (const mutate of mutations) {
    const rows = [root(), fragment(), fragment(3), terminal(4)]; mutate(rows);
    const result = await readLiveTranscriptReview(reader(rows), session);
    assert.equal(result.status, 'UNAVAILABLE'); assert.deepEqual(result.observations, []);
  }
});

test('aggregate text and connection budgets fail closed', async () => {
  const rows = [root(), ...Array.from({ length: 129 }, (_, i) => fragment(i + 2, 'x'.repeat(16384))), terminal(131)];
  assert.equal((await readLiveTranscriptReview(reader(rows), session)).reason, 'READ_UNAVAILABLE');
  assert.equal((await readLiveTranscriptReview({ request: async () => Array(5).fill(root()) }, session)).reason, 'READ_UNAVAILABLE');
});

test('real observer → private sink → fresh cold reader preserves both speakers without browser envelope', async () => {
  const rows = []; let socket;
  const store = createIvocLiveTranscriptStore({ rest: { table: async () => [session],
    request: async (path, { body }) => { assert.equal(path, '/ivoc_live_transcript_events'); rows.push(...structuredClone(body)); } } });
  const identity = { ownerSubject: 'wp:42', ivocSessionId: sid, providerSessionId: 'live_offline_fixture', observationId: oid };
  const append = await store.bindObservation(identity);
  class Socket extends EventEmitter {
    constructor() { super(); socket = this; this.readyState = 1; }
    send() { assert.fail('silent observer'); }
    terminate() { this.readyState = 3; this.emit('close'); }
  }
  const observer = attachOpenAiLiveTranscriptObserver({ ...identity, append, apiKey: 'offline-fixture', WebSocketImpl: Socket });
  socket.emit('open'); await observer.ready;
  for (const [speaker, delta] of [['output', 'Tell me'], ['output', ' about yourself.'], ['input', ' I  chose medicine.']]) {
    socket.emit('message', JSON.stringify({ type: `session.${speaker}_transcript.delta`, delta, start_ms: 50, end_ms: 100 }), false);
  }
  socket.emit('message', JSON.stringify({ type: 'session.closed' }), false);
  assert.equal((await observer.completion).terminalPersisted, true);
  const result = await readLiveTranscriptReview(reader(rows), { ...session, state: 'saved' });
  assert.deepEqual(result.observations[0].fragments.map(f => [f.speaker, f.text]), [
    ['interviewer', 'Tell me'], ['interviewer', ' about yourself.'], ['student', ' I  chose medicine.'],
  ]);
});

test('actual repository allows only bounded GET for private transcript table', async () => {
  let calls = 0;
  const repo = createIvocRepository({ baseUrl: 'https://db.invalid', serviceRoleKey: 'offline-fixture', fetchImpl: async (_url, options) => {
    calls++; assert.equal(options.method, 'GET'); assert.ok(options.signal); return new Response('[{"seq":1}]');
  } });
  assert.deepEqual(await repo.request('ivoc_live_transcript_events?select=seq'), [{ seq: 1 }]);
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT', 'HEAD']) await assert.rejects(repo.request('ivoc_live_transcript_events', { method }), /not_allowed/);
  await assert.rejects(repo.request('ivoc_live_transcript_events', { body: [] }), /not_allowed/);
  assert.equal(calls, 1);
  for (const response of [new Response('x'.repeat(4 * 1024 * 1024 + 1)), new Response('private', { status: 500 }), new Response('not json')]) {
    const bounded = createIvocRepository({ baseUrl: 'https://db.invalid', serviceRoleKey: 'offline-fixture', fetchImpl: async () => response });
    await assert.rejects(bounded.request('ivoc_live_transcript_events'));
  }
});
