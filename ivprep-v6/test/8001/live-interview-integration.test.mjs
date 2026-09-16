import assert from 'node:assert/strict';
import test from 'node:test';

import { LiveInterviewSession } from '../../public/studio/live-interview.mjs';

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
  const session = new LiveInterviewSession({
    PeerConnection: FakePeerConnection,
    audioElement: audio,
    createSession: async (input) => {
      assert.equal(input.sdp, 'v=0\r\no=offer');
      return { session: { id: 'live_session_123456', model: 'gpt-live-1' }, transport: { type: 'webrtc', sdp: 'v=0\r\no=answer' } };
    },
    endSession: async (id) => { ended.push(id); },
    onStatus: (event) => statuses.push(event.state),
    onTranscript: (event) => transcript.push(event),
  });
  assert.deepEqual(await session.start({ audioTrack: microphone, context: {} }), { id: 'live_session_123456', model: 'gpt-live-1' });
  assert.equal(FakePeerConnection.last.track, microphone);
  assert.equal(FakePeerConnection.last.channelLabel, 'oai-events');
  FakePeerConnection.last.channel.onmessage({ data: JSON.stringify({ type: 'session.output_transcript.delta', delta: 'Tell me about yourself.' }) });
  assert.deepEqual(transcript, [{ speaker: 'interviewer', text: 'Tell me about yourself.', type: 'session.output_transcript.delta' }]);
  const channel = FakePeerConnection.last.channel;
  await session.stop();
  assert.deepEqual(ended, ['live_session_123456']);
  assert.equal(microphone.stopCalls, 0);
  assert.deepEqual(channel.sent, [{ type: 'session.close' }]);
  assert.equal(statuses.includes('active'), true);
  assert.equal(statuses.at(-1), 'closed');
});
