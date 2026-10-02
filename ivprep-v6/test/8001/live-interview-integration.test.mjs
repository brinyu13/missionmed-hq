import assert from 'node:assert/strict';
import test from 'node:test';

import { LiveInterviewSession } from '../../public/capabilities/live-interview.mjs';

class FakeDataChannel {
  readyState = 'open';
  sent = [];
  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 'closed'; }
}

class FakePeerConnection {
  constructor() { FakePeerConnection.last = this; this.iceGatheringState = 'complete'; this.connectionState = 'new'; this.localDescription = null; }
  addTrack(track) { this.track = track; }
  createDataChannel(label) { this.channelLabel = label; this.channel = new FakeDataChannel(); return this.channel; }
  async createOffer() { return { type: 'offer', sdp: 'v=0\r\no=offer' }; }
  async setLocalDescription(value) { this.localDescription = value; }
  async setRemoteDescription(value) {
    this.remoteDescription = value;
    queueMicrotask(() => {
      this.channel.onmessage({ data: JSON.stringify({ type: 'session.started' }) });
      this.ontrack({ track: FakePeerConnection.remoteTrack, streams: [FakePeerConnection.remoteStream] });
    });
  }
  close() { this.closed = true; }
}

test('browser session reuses the admitted microphone and never stops the shared Analytics track', async () => {
  const statuses = [];
  const transcript = [];
  const telemetry = [];
  const authorityStreams = [];
  const ended = [];
  const audio = { srcObject: null, playCalls: 0, async play() { this.playCalls += 1; }, pause() { this.paused = true; } };
  const microphone = { kind: 'audio', readyState: 'live', stopCalls: 0, stop() { this.stopCalls += 1; } };
  let nowMs = 1_000;
  const session = new LiveInterviewSession({
    PeerConnection: FakePeerConnection,
    audioElement: audio,
    createSession: async (input) => {
      assert.equal(input.sdp, 'v=0\r\no=offer');
      return {
        session: { id: 'live_session_123456', model: 'gpt-live-1' },
        transport: { type: 'webrtc', sdp: 'v=0\r\no=answer' },
        audioAuthority: { schema: 'ivoc.audio-authority.v1', mode: 'single', authority: 'openai-gpt-live-native' },
      };
    },
    endSession: async (id, options) => { ended.push([id, options]); },
    onStatus: (event) => statuses.push(event.state),
    onTranscript: (event) => transcript.push(event),
    onTelemetry: (event) => telemetry.push(event),
    onAuthoritativeAudioStream: (stream) => authorityStreams.push(stream),
    now: () => nowMs,
  });
  assert.deepEqual(await session.start({ audioTrack: microphone, context: {}, openingQuestion: 'Tell me about yourself.' }), {
    id: 'live_session_123456', model: 'gpt-live-1',
    audioAuthority: {
      schema: 'ivoc.audio-authority.v1', mode: 'single', authority: 'openai-gpt-live-native',
      state: 'bound', remoteTrackBound: true,
    },
  });
  assert.equal(FakePeerConnection.last.track, microphone);
  assert.equal(FakePeerConnection.last.channelLabel, 'oai-events');
  const remote = FakePeerConnection.remoteTrack;
  FakePeerConnection.last.ontrack({ track: remote, streams: [{ id: 'provider-stream' }] });
  FakePeerConnection.last.ontrack({ track: remote, streams: [{ id: 'provider-stream' }] });
  const surplus = { id: 'remote-audio-2', stopCalls: 0, stop() { this.stopCalls += 1; } };
  FakePeerConnection.last.ontrack({ track: surplus, streams: [{ id: 'surplus-stream' }] });
  assert.deepEqual(telemetry.map((event) => event.state), ['configured', 'bound', 'surplus_rejected']);
  assert.equal(audio.playCalls, 1);
  assert.deepEqual(authorityStreams, [FakePeerConnection.remoteStream]);
  assert.equal(surplus.stopCalls, 1);
  nowMs = 1_125;
  FakePeerConnection.last.channel.onmessage({ data: JSON.stringify({ type: 'session.output_transcript.delta', response_id: 'response-1', delta: 'Tell me about yourself.' }) });
  nowMs = 1_250;
  FakePeerConnection.last.channel.onmessage({ data: JSON.stringify({ type: 'session.output_transcript.done', response_id: 'response-1', transcript: 'Tell me about yourself.' }) });
  assert.deepEqual(transcript, [
    {
      speaker: 'interviewer', text: 'Tell me about yourself.', type: 'session.output_transcript.delta',
      final: false, identity: 'response-1', observedAtMs: 125, responseId: 'response-1', itemId: null,
    },
    {
      speaker: 'interviewer', text: 'Tell me about yourself.', type: 'session.output_transcript.done',
      final: true, identity: 'response-1', observedAtMs: 250, responseId: 'response-1', itemId: null,
    },
  ]);
  const channel = FakePeerConnection.last.channel;
  await session.stop({ keepalive: true });
  assert.deepEqual(telemetry.map((event) => event.state), ['configured', 'bound', 'surplus_rejected', 'released']);
  assert.deepEqual(ended, [['live_session_123456', { keepalive: true }]]);
  assert.equal(microphone.stopCalls, 0);
  assert.deepEqual(channel.sent, [
    {
      event_id: 'ivoc-opening-question',
      type: 'session.instructions.append',
      delegation_id: null,
      content: 'Ask this opening interview question now, naturally, without waiting for the applicant to speak, without adding a preamble or a second question, then pause and listen: "Tell me about yourself."',
    },
    { type: 'session.close' },
  ]);
  assert.equal(statuses.includes('active'), true);
  assert.equal(statuses.at(-1), 'closed');
});

FakePeerConnection.remoteTrack = { kind: 'audio', id: 'remote-audio-1', stopCalls: 0, stop() { this.stopCalls += 1; } };
FakePeerConnection.remoteStream = { id: 'provider-stream' };

test('browser session refuses to open without a bounded opening question', async () => {
  const session = new LiveInterviewSession({
    PeerConnection: FakePeerConnection,
    audioElement: { play: async () => {}, pause() {} },
    createSession: async () => { throw new Error('must not create'); },
    endSession: async () => {},
  });
  const microphone = { kind: 'audio', readyState: 'live' };
  await assert.rejects(() => session.start({ audioTrack: microphone, context: {} }), /bounded opening question/u);
});

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
async function until(predicate) {
  for (let count = 0; count < 50; count++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); }
  assert.fail('Expected browser lifecycle milestone was not reached.');
}
const createdSession = id => ({ session: { id, model: 'gpt-live-1' }, transport: { type: 'webrtc', sdp: 'v=0\r\no=answer' },
  audioAuthority: { mode: 'single', authority: 'openai-gpt-live-native' } });
function harness({ createSession, PeerConnection = FakePeerConnection } = {}) {
  const ended = [], statuses = [], streams = [];
  const microphone = { kind: 'audio', readyState: 'live', stopCalls: 0, stop() { this.stopCalls++; } };
  const audio = { srcObject: null, playCalls: 0, async play() { this.playCalls++; }, pause() {} };
  const session = new LiveInterviewSession({ PeerConnection, audioElement: audio,
    createSession: createSession || (async () => createdSession('healthy_session_0001')),
    endSession: async (id, options) => { ended.push([id, options]); },
    onStatus: event => statuses.push(event.state), onAuthoritativeAudioStream: stream => { streams.push(stream); } });
  const start = () => session.start({ audioTrack: microphone, context: {}, ivocSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', openingQuestion: 'Tell me about yourself.' });
  return { session, ended, statuses, streams, microphone, audio, start };
}

test('slow server create beyond15s does not start media timers or reject before healthy SDP binding', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const pending = deferred(); let requested = false;
  const h = harness({ createSession: () => { requested = true; return pending.promise; } });
  const starting = h.start(); await until(() => requested);
  assert.equal(h.session.startTimer, null); assert.equal(h.session.audioBoundTimer, null);
  t.mock.timers.tick(20_001); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.statuses, ['connecting']); assert.deepEqual(h.ended, []);
  pending.resolve(createdSession('slow_healthy_0001'));
  assert.equal((await starting).id, 'slow_healthy_0001');
  assert.equal(h.audio.playCalls, 1); assert.equal(h.streams.length, 1);
  await h.session.stop(); assert.equal(h.microphone.stopCalls, 0);
});

test('actual SDP negotiation retains15s expiry and exact provider cleanup with no early unhandled rejection', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  class SilentPeer extends FakePeerConnection { async setRemoteDescription(value) { this.remoteDescription = value; } }
  const h = harness({ PeerConnection: SilentPeer });
  const result = h.start().then(value => ({ value }), error => ({ error }));
  await until(() => FakePeerConnection.last.remoteDescription);
  t.mock.timers.tick(15_001);
  assert.match((await result).error.message, /did not start in time|audio did not bind in time/u);
  assert.deepEqual(h.ended, [['healthy_session_0001', { keepalive: false }]]);
  assert.equal(h.audio.playCalls, 0); assert.equal(h.streams.length, 0); assert.equal(h.microphone.stopCalls, 0);
});

test('stop during create cleans exact late provider and never revives audio or overwrites a newer start', async () => {
  const pending = deferred(); let calls = 0;
  const h = harness({ createSession: () => ++calls === 1 ? pending.promise : Promise.resolve(createdSession('new_session_0002')) });
  const oldStart = h.start().then(value => ({ value }), error => ({ error })); await until(() => calls === 1);
  const oldPeer = FakePeerConnection.last;
  await h.session.stop(); assert.match((await oldStart).error.message, /startup was stopped/u);
  assert.equal((await h.start()).id, 'new_session_0002');
  const newPeer = FakePeerConnection.last; const statusCount = h.statuses.length;
  pending.resolve(createdSession('late_original_0001')); await until(() => h.ended.length === 1);
  const staleTrack = { kind: 'audio', id: 'stale-provider-track', stops: 0, stop() { this.stops++; } };
  await oldPeer.ontrack({ track: staleTrack, streams: [{ id: 'stale-stream' }] });
  oldPeer.channel.onmessage({ data: JSON.stringify({ type: 'session.started' }) });
  assert.deepEqual(h.ended, [['late_original_0001', { keepalive: true }]]);
  assert.equal(oldPeer.remoteDescription, undefined); assert.equal(staleTrack.stops, 1);
  assert.equal(h.audio.playCalls, 1); assert.equal(h.streams.length, 1);
  assert.equal(h.session.peer, newPeer); assert.equal(h.session.sessionId, 'new_session_0002');
  assert.equal(h.statuses.length, statusCount); assert.equal(h.microphone.stopCalls, 0);
  await h.session.stop(); assert.equal(h.ended[1][0], 'new_session_0002');
});

test('stopping a pending offer prevents any later createSession call', async () => {
  const offer = deferred(); let calls = 0;
  class PendingOfferPeer extends FakePeerConnection { createOffer() { return offer.promise; } }
  const h = harness({ PeerConnection: PendingOfferPeer, createSession: async () => { calls++; return createdSession('must_not_create'); } });
  const result = h.start().then(value => ({ value }), error => ({ error }));
  await h.session.stop(); offer.resolve({ type: 'offer', sdp: 'v=0\r\no=offer' });
  assert.match((await result).error.message, /startup was stopped/u);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 0); assert.equal(h.audio.playCalls, 0);
});

test('stop between create resolution guard and await continuation cleans returned provider exactly once', async () => {
  let h;
  h = harness({ createSession: () => Promise.resolve(createdSession('healthy_session_0001')).then(value => {
    // Internal creating.then first sees current=true, but stop then wins the
    // cancellation race before start receives the successfully returned ID.
    queueMicrotask(() => queueMicrotask(() => { void h.session.stop(); })); return value;
  }) });
  await assert.rejects(() => h.start(), /startup was stopped/u);
  assert.deepEqual(h.ended, [['healthy_session_0001', { keepalive: true }]]);
  assert.equal(FakePeerConnection.last.remoteDescription, undefined);
  assert.equal(h.audio.playCalls, 0); assert.equal(h.streams.length, 0);
});

test('overall90s startup cap safely cleans a later returned provider without arming media timers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const pending = deferred(); let requested = false;
  const h = harness({ createSession: () => { requested = true; return pending.promise; } });
  const result = h.start().then(value => ({ value }), error => ({ error })); await until(() => requested);
  t.mock.timers.tick(90_001); assert.match((await result).error.message, /startup did not finish in time/u);
  pending.resolve(createdSession('expired_late_0001')); await until(() => h.ended.length === 1);
  assert.deepEqual(h.ended, [['expired_late_0001', { keepalive: true }]]);
  assert.equal(h.audio.playCalls, 0); assert.equal(h.streams.length, 0); assert.equal(h.microphone.stopCalls, 0);
});
