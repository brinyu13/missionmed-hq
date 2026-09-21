import assert from 'node:assert/strict';
import test from 'node:test';

import { ConversationRecordingMix } from '../../public/capabilities/conversation-recording.mjs';

class FakeTrack {
  constructor(kind, id) { this.kind = kind; this.id = id; this.readyState = 'live'; this.stopCalls = 0; }
  stop() { this.stopCalls += 1; this.readyState = 'ended'; }
}

class FakeStream {
  constructor(tracks = []) { this.tracks = tracks; }
  getTracks() { return [...this.tracks]; }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
}

class FakeAudioContext {
  constructor() { this.sources = []; this.destination = { audible: true }; }
  createMediaStreamDestination() {
    const node = { stream: new FakeStream([new FakeTrack('audio', 'recording-mix')]) };
    this.mixDestination = node;
    return node;
  }
  createMediaStreamSource(stream) {
    const node = {
      stream, targets: [], disconnected: false,
      connect(target) { this.targets.push(target); },
      disconnect() { this.disconnected = true; },
    };
    this.sources.push(node);
    return node;
  }
}

test('AI conversation recorder mixes candidate and the one authoritative remote track without a second audible output', () => {
  const camera = new FakeTrack('video', 'camera');
  const microphone = new FakeTrack('audio', 'microphone');
  const interviewer = new FakeTrack('audio', 'interviewer');
  const context = new FakeAudioContext();
  const mix = new ConversationRecordingMix({
    candidateStream: new FakeStream([camera, microphone]),
    audioContext: context,
    MediaStreamCtor: FakeStream,
  });

  assert.deepEqual(mix.stream.getVideoTracks(), [camera]);
  assert.equal(mix.stream.getAudioTracks()[0].id, 'recording-mix');
  assert.equal(context.sources.length, 1);
  assert.equal(mix.attachAuthoritativeAudio(new FakeStream([interviewer])), true);
  assert.equal(mix.attachAuthoritativeAudio(new FakeStream([interviewer])), false);
  assert.equal(context.sources.length, 2);
  assert.equal(context.sources.every((source) => source.targets.length === 1 && source.targets[0] === context.mixDestination), true);
  assert.equal(context.sources.some((source) => source.targets.includes(context.destination)), false);
  assert.deepEqual(mix.diagnostics(), {
    schema: 'ivoc.conversation-recording-mix.v1', candidateAudio: true, candidateVideo: true,
    interviewerAudio: true, audibleOutputs: 0,
  });

  mix.destroy();
  assert.equal(camera.stopCalls, 0);
  assert.equal(microphone.stopCalls, 0);
  assert.equal(interviewer.stopCalls, 0);
  assert.equal(context.mixDestination.stream.getAudioTracks()[0].stopCalls, 1);
});

test('AI conversation recorder rejects a second interviewer authority', () => {
  const mix = new ConversationRecordingMix({
    candidateStream: new FakeStream([new FakeTrack('video', 'camera'), new FakeTrack('audio', 'microphone')]),
    audioContext: new FakeAudioContext(),
    MediaStreamCtor: FakeStream,
  });
  mix.attachAuthoritativeAudio(new FakeStream([new FakeTrack('audio', 'interviewer-1')]));
  assert.throws(
    () => mix.attachAuthoritativeAudio(new FakeStream([new FakeTrack('audio', 'interviewer-2')])),
    /second interviewer audio authority/u,
  );
});
