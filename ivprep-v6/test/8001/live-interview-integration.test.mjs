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
    queueMicrotask(() => this.channel.onmessage({ data: JSON.stringify({ type: 'session.started' }) }));
  }
  close() { this.closed = true; }
}

test('browser session reuses the admitted microphone and never stops the shared Analytics track', async () => {
  const statuses = [];
  const transcript = [];
  const ended = [];
  const audio = { srcObject: null, play: async () => {}, pause() { this.paused = true; } };
  const microphone = { kind: 'audio', readyState: 'live', stopCalls: 0, stop() { this.stopCalls += 1; } };
  let nowMs = 1_000;
  const session = new LiveInterviewSession({
    PeerConnection: FakePeerConnection,
    audioElement: audio,
    createSession: async (input) => {
      assert.equal(input.sdp, 'v=0\r\no=offer');
      return { session: { id: 'live_session_123456', model: 'gpt-live-1' }, transport: { type: 'webrtc', sdp: 'v=0\r\no=answer' } };
    },
    endSession: async (id, options) => { ended.push([id, options]); },
    onStatus: (event) => statuses.push(event.state),
    onTranscript: (event) => transcript.push(event),
    now: () => nowMs,
  });
  assert.deepEqual(await session.start({ audioTrack: microphone, context: {} }), { id: 'live_session_123456', model: 'gpt-live-1' });
  assert.equal(FakePeerConnection.last.track, microphone);
  assert.equal(FakePeerConnection.last.channelLabel, 'oai-events');
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
  assert.deepEqual(ended, [['live_session_123456', { keepalive: true }]]);
  assert.equal(microphone.stopCalls, 0);
  assert.deepEqual(channel.sent, [{ type: 'session.close' }]);
  assert.equal(statuses.includes('active'), true);
  assert.equal(statuses.at(-1), 'closed');
});
