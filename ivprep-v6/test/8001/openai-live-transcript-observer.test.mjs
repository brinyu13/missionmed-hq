import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { attachOpenAiLiveTranscriptObserver } from '../../server/providers/openai-live-transcript-observer.mjs';

const IVOC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OBS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ append, limits = {} } = {}) {
  const records = [], batches = [], calls = [];
  let socket;
  class FakeSocket extends EventEmitter {
    constructor(url, options) { super(); this.readyState = 0; socket = this; calls.push({ url, options }); }
    send() { assert.fail('observer must never send provider commands or audio'); }
    open() { this.readyState = 1; this.emit('open'); }
    message(event) { this.emit('message', Buffer.from(JSON.stringify(event)), false); }
    close() { this.readyState = 3; this.emit('close', 1000); }
    terminate() { this.terminated = true; this.close(); }
  }
  const observer = attachOpenAiLiveTranscriptObserver({ providerSessionId: 'sess_test_123', ivocSessionId: IVOC,
    ownerSubject: 'wp:42', observationId: OBS, apiKey: 'offline-placeholder-not-a-secret', WebSocketImpl: FakeSocket,
    append: async batch => { batches.push(batch); if (append) await append(batch); records.push(...batch); },
    limits: { connectMs: 100, appendMs: 100, durationMs: 1000, drainMs: 10, ...limits } });
  return { observer, socket, records, batches, calls };
}
const fragment = (delta = ' What is', event_id = 'event_1', speaker = 'input') => ({
  type: `session.${speaker}_transcript.delta`, event_id, delta, start_ms: 1000, end_ms: 1200,
});

test('exact server attachment, no publication, attached receipt precedes early exact fragments', async () => {
  const root = deferred(); const h = fixture({ append: batch => batch[0].kind === 'attached' ? root.promise : undefined });
  h.socket.message(fragment(' What is  \n'));
  h.socket.open(); h.socket.message(fragment(' repeated repeated ', 'event_2', 'output'));
  let ready = false; h.observer.ready.then(() => { ready = true; });
  await tick(); assert.equal(ready, false); assert.equal(h.batches.length, 1);
  assert.deepEqual(h.batches[0].map(row => row.kind), ['attached']);
  root.resolve(); const receipt = await h.observer.ready;
  assert.equal(receipt.seq, 1); assert.equal(receipt.provider_event_id, null);
  h.socket.message({ type: 'session.closed', event_id: 'ignored_closed_id' });
  assert.deepEqual(await h.observer.completion, { status: 'PROVIDER_CLOSED', reason: 'provider_closed', terminalPersisted: true, observationId: OBS });
  assert.equal(h.calls[0].url, 'wss://api.openai.com/v1/live/sessions/sess_test_123/attach');
  assert.equal(h.calls[0].options.followRedirects, false);
  assert.match(h.calls[0].options.headers.Authorization, /^Bearer offline-placeholder/u);
  assert.deepEqual(h.records.map(row => row.seq), [1, 2, 3, 4]);
  assert.deepEqual(h.records.map(row => row.fragment_text), [null, ' What is  \n', ' repeated repeated ', null]);
  for (const row of h.records) {
    assert.equal(row.observation_id, OBS); assert.equal(row.session_id, IVOC); assert.equal(row.owner_subject, 'wp:42');
    assert.equal(row.provider_session_id, 'sess_test_123'); assert.match(row.server_received_at, /^\d{4}-.*Z$/u);
    assert.equal(Object.hasOwn(row, 'turn_id'), false); assert.equal(Object.hasOwn(row, 'audio'), false);
  }
  assert.equal(h.records[1].provider_start_ms, 1000); assert.equal(h.records[1].provider_end_ms, 1200);
  assert.equal(h.records.at(-1).provider_event_id, null);
  assert.equal(h.socket.listenerCount('message'), 0); assert.equal(h.socket.listenerCount('error'), 0);
  const n = h.records.length; h.socket.message(fragment('late', 'late')); await tick(); assert.equal(h.records.length, n);
});

test('identical IDs deduplicate; missing IDs retain repeated text; reflected audio/delegation ignored', async () => {
  const h = fixture(); h.socket.open(); await h.observer.ready;
  h.socket.message(fragment()); h.socket.message(fragment());
  for (const type of ['session.input_audio.append', 'session.output_audio.delta', 'session.delegation.created', 'response.completed']) {
    h.socket.message({ type, audio: 'do-not-retain', delta: 'do-not-retain' });
  }
  const withoutId = fragment(' again'); delete withoutId.event_id;
  h.socket.message(withoutId); h.socket.message(withoutId); h.socket.message({ type: 'session.closed' });
  await h.observer.completion;
  assert.equal(h.records.filter(row => row.kind === 'fragment').length, 3);
  assert.equal(JSON.stringify(h.records).includes('do-not-retain'), false);
});

test('reflected audio does not consume transcript limits or retain audio; transport flood remains bounded', async () => {
  const h = fixture({ limits: { fragments: 1, transcriptBytes: 2, queueBytes: 2 } });
  h.socket.open(); await h.observer.ready;
  for (let i = 0; i < 1000; i++) h.socket.message({ type: 'session.output_audio.delta', delta: 'ignored-audio', start_ms: 0, end_ms: 20 });
  h.socket.message(fragment('ok')); h.socket.message({ type: 'session.closed' });
  assert.equal((await h.observer.completion).status, 'PROVIDER_CLOSED');
  assert.equal(h.records.filter(row => row.kind === 'fragment').length, 1);
  assert.equal(JSON.stringify(h.records).includes('ignored-audio'), false);
  const bounded = fixture({ limits: { messages: 2 } }); bounded.socket.open(); await bounded.observer.ready;
  for (let i = 0; i < 3; i++) bounded.socket.message({ type: 'session.input_audio.append', audio: 'ignored' });
  assert.equal((await bounded.observer.completion).reason, 'event_limit');
});

test('conflicting duplicate ID stops observation without retaining conflicting fragment', async () => {
  const h = fixture(); h.socket.open(); await h.observer.ready;
  h.socket.message(fragment()); h.socket.message(fragment('different'));
  assert.equal((await h.observer.completion).reason, 'conflicting_event_id');
  assert.equal(h.records.filter(row => row.kind === 'fragment').length, 1);
});

test('missing session.closed is incomplete despite normal socket close; terminal immutable and finish idempotent', async () => {
  const h = fixture(); h.socket.open(); await h.observer.ready; h.socket.close();
  const result = await h.observer.completion;
  assert.equal(result.status, 'INCOMPLETE'); assert.equal(result.reason, 'socket_closed');
  assert.equal(h.observer.finish(), h.observer.completion);
  h.socket.message({ type: 'session.closed' }); await tick();
  assert.equal(h.records.filter(row => row.kind === 'terminal').length, 1);
});

test('finish waits boundedly for genuine provider closure, never sends session.close', async () => {
  const h = fixture(); h.socket.open(); await h.observer.ready;
  const first = h.observer.finish(); assert.equal(first, h.observer.finish());
  h.socket.message(fragment()); h.socket.message({ type: 'session.closed' });
  assert.equal((await first).status, 'PROVIDER_CLOSED');
  const missing = fixture(); missing.socket.open(); await missing.observer.ready;
  assert.equal((await missing.observer.finish()).reason, 'finish_timeout');
});

test('serialized bounded batches and contiguous identities under slow persistence', async () => {
  const hold = deferred(); let active = 0, highest = 0;
  const h = fixture({ append: async batch => { active++; highest = Math.max(highest, active);
    if (batch[0].kind === 'fragment') await hold.promise; active--; } });
  h.socket.open(); await h.observer.ready;
  for (let i = 0; i < 50; i++) h.socket.message(fragment(` ${i}`, `event_${i}`));
  await tick(); h.socket.message({ type: 'session.closed' }); hold.resolve();
  await h.observer.completion;
  assert.equal(highest, 1); assert.equal(h.batches.every(batch => batch.length <= 32), true);
  assert.equal(h.records.length, 52); assert.deepEqual(h.records.map(row => row.seq), Array.from({ length: 52 }, (_, i) => i + 1));
});

for (const [name, patch] of Object.entries({ negative: { start_ms: -1 }, reversed: { end_ms: 999 },
  fractional: { start_ms: .5 }, missing: { end_ms: undefined }, tooLate: { end_ms: 86_400_001 },
  eventId: { event_id: 'bad id' }, nonText: { delta: null }, oversized: { delta: 'x'.repeat(16_385) } })) {
  test(`invalid fragment ${name} fails closed`, async () => {
    const h = fixture(); h.socket.open(); await h.observer.ready;
    h.socket.message({ ...fragment(), ...patch });
    assert.equal((await h.observer.completion).reason, 'invalid_event');
    assert.equal(h.records.filter(row => row.kind === 'fragment').length, 0);
  });
}

for (const [name, limits, inputs, expected] of [
  ['fragment count', { fragments: 1 }, ['a', 'b'], 'event_limit'],
  ['total bytes', { transcriptBytes: 2 }, ['aa', 'b'], 'byte_limit'],
  ['queue records', { queueRecords: 1 }, ['a', 'b'], 'queue_limit'],
  ['queue bytes', { queueBytes: 2 }, ['aa', 'b'], 'queue_limit'],
]) {
  test(`bounded ${name}`, async () => {
    const hold = deferred(); const h = fixture({ limits, append: batch => batch[0].kind === 'attached' ? hold.promise : undefined });
    h.socket.open(); inputs.forEach((text, i) => h.socket.message(fragment(text, `event_${i}`)));
    hold.resolve(); const result = await h.observer.completion;
    assert.equal(result.reason, expected); assert.equal(result.terminalPersisted, true);
  });
}

test('sink rejection never skips failed sequence or claims a durable terminal', async () => {
  const h = fixture({ append: batch => { if (batch[0].kind === 'fragment') throw new Error('private error not returned'); } });
  h.socket.open(); await h.observer.ready; h.socket.message(fragment());
  const result = await h.observer.completion;
  assert.equal(result.reason, 'persistence_failure'); assert.equal(result.terminalPersisted, false);
  assert.deepEqual(h.records.map(row => row.kind), ['attached']);
  assert.equal(h.batches.length, 2);
});

test('terminal sink failure and late uncertain root acknowledgement cannot promote completion', async () => {
  const fail = fixture({ append: batch => { if (batch[0].kind === 'terminal') return Promise.reject(new Error('private')); } });
  fail.socket.open(); await fail.observer.ready; fail.socket.message({ type: 'session.closed' });
  assert.equal((await fail.observer.completion).terminalPersisted, false);
  assert.equal(fail.records.at(-1).kind, 'attached');
  const root = deferred(); const late = fixture({ limits: { appendMs: 5 }, append: () => root.promise });
  late.socket.open(); late.socket.message(fragment());
  const result = await late.observer.completion;
  assert.equal(result.reason, 'persistence_timeout');
  await assert.rejects(late.observer.ready, /did not attach durably/u);
  root.resolve(); await tick(); late.socket.message({ type: 'session.closed' }); await tick();
  assert.equal(await late.observer.completion, result); assert.equal(late.batches.length, 1);
});

test('malformed, binary and over-budget transport data stop without retaining payload', async () => {
  for (const [data, binary, limits] of [['not JSON', false, {}], [Buffer.from('{}'), true, {}], ['{}'.repeat(6), false, { packetBytes: 10 }]]) {
    const h = fixture({ limits }); h.socket.open(); await h.observer.ready;
    h.socket.emit('message', data, binary);
    assert.equal((await h.observer.completion).reason, 'invalid_event');
    assert.equal(h.records.some(row => row.kind === 'fragment'), false);
  }
});

test('sink timeout stays bounded even when provider closes during pending append', async () => {
  const h = fixture({ limits: { appendMs: 10 }, append: batch => batch[0].kind === 'fragment' ? new Promise(() => {}) : undefined });
  h.socket.open(); await h.observer.ready; h.socket.message(fragment()); await tick();
  h.socket.message({ type: 'session.closed' });
  const result = await h.observer.completion;
  assert.equal(result.reason, 'persistence_timeout'); assert.equal(result.terminalPersisted, false);
  assert.equal(h.batches.length, 2); assert.equal(h.socket.listenerCount('message'), 0);
});

test('root failure rejects ready; socket error, connection timeout and lifetime remain incomplete', async () => {
  const fail = fixture({ append: () => Promise.reject(new Error('private failure')) }); fail.socket.open();
  await assert.rejects(fail.observer.ready, /did not attach durably/u);
  assert.equal((await fail.observer.completion).reason, 'persistence_failure');
  const error = fixture(); error.socket.open(); await error.observer.ready; error.socket.emit('error', new Error('private'));
  assert.equal((await error.observer.completion).reason, 'socket_error');
  const timeout = fixture({ limits: { connectMs: 5 } });
  assert.equal((await timeout.observer.completion).reason, 'connect_timeout');
  const lifetime = fixture({ limits: { durationMs: 5 } }); lifetime.socket.open(); await lifetime.observer.ready;
  assert.equal((await lifetime.observer.completion).reason, 'duration_limit');
});

test('identity and loosened limits rejected before socket construction; constructor failure contained', async () => {
  const base = { providerSessionId: 'sess_test_123', ivocSessionId: IVOC, observationId: OBS,
    ownerSubject: 'wp:42', apiKey: 'offline', append: async () => {} };
  class Never { constructor() { assert.fail('invalid inputs reached socket'); } }
  for (const patch of [{ providerSessionId: '../escape' }, { ivocSessionId: 'bad' }, { ownerSubject: 'wp:0' },
    { observationId: 'bad' }, { apiKey: 'key\nheader' }, { append: null }, { limits: { fragments: 8193 } }]) {
    assert.throws(() => attachOpenAiLiveTranscriptObserver({ ...base, WebSocketImpl: Never, ...patch }), TypeError);
  }
  class Broken { constructor() { throw new Error('private transport details'); } }
  const observer = attachOpenAiLiveTranscriptObserver({ ...base, WebSocketImpl: Broken });
  await assert.rejects(observer.ready, /did not attach durably/u);
  assert.deepEqual(await observer.completion, { status: 'INCOMPLETE', reason: 'connect_failure', terminalPersisted: false, observationId: OBS });
});
