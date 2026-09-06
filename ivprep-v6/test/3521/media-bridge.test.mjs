import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { LiveAnalyticsMediaBridge } from '../../public/live-analytics/media-bridge.mjs';

class FakeTrack {
  constructor(kind, id) {
    this.kind = kind;
    this.id = id;
    this.readyState = 'live';
    this.enabled = true;
    this.muted = false;
    this.stopCalls = 0;
    this.listeners = new Map();
  }

  stop() {
    this.stopCalls += 1;
    this.readyState = 'ended';
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ type, target: this });
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    this.dispatch(this.muted ? 'mute' : 'unmute');
  }

  end() {
    this.readyState = 'ended';
    this.dispatch('ended');
  }

  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
}

class FakeMediaDevices {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ type, target: this });
  }
  listenerCount(type) { return this.listeners.get(type)?.size || 0; }
}

class FakeStream {
  constructor(items) { this.items = [...items]; }
  getTracks() { return [...this.items]; }
  getAudioTracks() { return this.items.filter((track) => track.kind === 'audio'); }
  getVideoTracks() { return this.items.filter((track) => track.kind === 'video'); }
  addTrack(track) { if (!this.items.includes(track)) this.items.push(track); }
  removeTrack(track) { this.items = this.items.filter((candidate) => candidate !== track); }
}

class FakeNode {
  constructor(kind, input = null) {
    this.kind = kind;
    this.input = input;
    this.connections = [];
    this.disconnectCalls = 0;
    this.fftSize = 0;
  }

  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnectCalls += 1; }
}

class FakeAudioContext {
  constructor(log = [], { failSourceFor = null } = {}) {
    this.log = log;
    this.failSourceFor = failSourceFor;
    this.state = 'suspended';
    this.sampleRate = 48_000;
    this.resumeCalls = 0;
    this.closeCalls = 0;
    this.sources = [];
    this.analysers = [];
    this.sinks = [];
    this.destination = new FakeNode('speaker-destination');
  }

  resume() {
    this.log.push('resume');
    this.resumeCalls += 1;
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    this.closeCalls += 1;
    this.state = 'closed';
    return Promise.resolve();
  }

  createMediaStreamSource(stream) {
    if (this.failSourceFor && stream.getTracks().some(this.failSourceFor)) throw new Error('audio graph rejected');
    const node = new FakeNode('source', stream);
    this.sources.push(node);
    return node;
  }

  createAnalyser() {
    const node = new FakeNode('analyser');
    this.analysers.push(node);
    return node;
  }

  createMediaStreamDestination() {
    const node = new FakeNode('non-playback-destination');
    this.sinks.push(node);
    return node;
  }
}

function fakePipelineFactory(records = {}) {
  const clock = Object.freeze({ sessionMs: () => 17 });
  const pipeline = {
    session: { clock },
    beginCalls: [],
    endCalls: [],
    destroyCalls: 0,
    ensureSession() { return this.session; },
    beginAnswer(options) { this.beginCalls.push(options); return { answerId: options.answerId || 'answer' }; },
    endAnswer(options) { this.endCalls.push(options); return { complete: true }; },
    destroy() { this.destroyCalls += 1; },
  };
  records.pipeline = pipeline;
  records.clock = clock;
  records.factoryCalls = 0;
  return () => {
    records.factoryCalls += 1;
    return pipeline;
  };
}

test('Safari gesture priming precedes capture and the original stream feeds a non-playback graph', async () => {
  const log = [];
  const mic = new FakeTrack('audio', 'mic-1');
  const cam = new FakeTrack('video', 'cam-1');
  const stream = new FakeStream([mic, cam]);
  const context = new FakeAudioContext(log);
  let contextCreations = 0;
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => { log.push('create-context'); contextCreations += 1; return context; },
    getUserMedia: async () => { log.push('get-user-media'); return stream; },
    pipelineFactory: fakePipelineFactory(),
  });

  const pending = bridge.requestMedia({ audio: true, video: true });
  assert.deepEqual(log, ['create-context', 'resume'], 'context creation/resume must happen synchronously in the gesture');
  const media = await pending;

  assert.deepEqual(log, ['create-context', 'resume', 'get-user-media']);
  assert.equal(contextCreations, 1);
  assert.equal(context.resumeCalls, 1);
  assert.equal(media.stream, stream, 'WebKit must receive the original capture stream');
  assert.equal(context.sources[0].input, stream);
  assert.equal(context.sources[0].connections[0], context.analysers[0]);
  assert.equal(context.analysers[0].connections[0], context.sinks[0]);
  assert.notEqual(context.analysers[0].connections[0], context.destination, 'microphone must never play to the speakers');
  assert.equal(media.data.length, 2048);
});

test('readiness events reflect current track mute, unmute, and ended state without reacquiring media', async () => {
  const mic = new FakeTrack('audio', 'mic-readiness');
  const cam = new FakeTrack('video', 'cam-readiness');
  const stream = new FakeStream([mic, cam]);
  const context = new FakeAudioContext();
  const events = [];
  let captures = 0;
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => context,
    getUserMedia: async () => { captures += 1; return stream; },
    pipelineFactory: fakePipelineFactory(),
  });
  bridge.addEventListener('readinesschange', (event) => events.push(event.detail));

  await bridge.requestMedia();
  assert.equal(bridge.readiness.fullyReady, true);
  assert.equal(bridge.readiness.camera.reason, 'READY');
  assert.equal(bridge.readiness.microphone.reason, 'READY');

  mic.setMuted(true);
  assert.equal(bridge.readiness.microphone.ready, false);
  assert.equal(bridge.readiness.microphone.reason, 'MUTED');
  assert.equal(events.at(-1).reason, 'microphone-mute');
  assert.equal(events.at(-1).recovery, 'DEGRADED');

  mic.setMuted(false);
  assert.equal(bridge.readiness.microphone.ready, true);
  assert.equal(events.at(-1).reason, 'microphone-unmute');
  assert.equal(events.at(-1).recovery, 'NONE');

  cam.end();
  assert.equal(bridge.readiness.camera.ready, false);
  assert.equal(bridge.readiness.camera.reason, 'ENDED');
  assert.equal(bridge.readiness.microphone.ready, true);
  assert.equal(events.at(-1).reason, 'camera-ended');
  assert.equal(events.at(-1).readiness.camera.readyState, 'ended');
  assert.equal(captures, 1, 'readiness observation must never reacquire media');
  assert.ok(Object.isFrozen(events.at(-1).readiness));
});

test('devicechange publishes a bounded refresh or recovery signal with current readiness', async () => {
  const mic = new FakeTrack('audio', 'mic-devicechange');
  const cam = new FakeTrack('video', 'cam-devicechange');
  const mediaDevices = new FakeMediaDevices();
  const deviceEvents = [];
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => new FakeAudioContext(),
    getUserMedia: async () => new FakeStream([mic, cam]),
    mediaDevices,
    pipelineFactory: fakePipelineFactory(),
  });
  bridge.addEventListener('devicechange', (event) => deviceEvents.push(event.detail));

  await bridge.requestMedia();
  assert.equal(mediaDevices.listenerCount('devicechange'), 1);
  mediaDevices.dispatch('devicechange');
  assert.equal(deviceEvents.at(-1).reason, 'devicechange');
  assert.equal(deviceEvents.at(-1).recovery, 'REFRESH_DEVICE_LIST');
  assert.equal(deviceEvents.at(-1).readiness.deviceChangeRevision, 1);

  cam.end();
  mic.end();
  mediaDevices.dispatch('devicechange');
  assert.equal(deviceEvents.at(-1).recovery, 'REACQUIRE_MEDIA');
  assert.equal(deviceEvents.at(-1).readiness.anyReady, false);
  assert.equal(deviceEvents.at(-1).readiness.deviceChangeRevision, 2);
});

test('adoption publishes at most one live camera and microphone and fully cleans prior owned tracks', async () => {
  const a1 = new FakeTrack('audio', 'mic-a1');
  const aExtra = new FakeTrack('audio', 'mic-extra');
  const v1 = new FakeTrack('video', 'cam-v1');
  const vExtra = new FakeTrack('video', 'cam-extra');
  const first = new FakeStream([a1, aExtra, v1, vExtra]);
  const a2 = new FakeTrack('audio', 'mic-a2');
  const v2 = new FakeTrack('video', 'cam-v2');
  const second = new FakeStream([a2, v2]);
  const queue = [first, second];
  const context = new FakeAudioContext();
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => context,
    getUserMedia: async () => queue.shift(),
    pipelineFactory: fakePipelineFactory(),
  });

  await bridge.requestMedia();
  assert.deepEqual(first.getTracks(), [a1, v1]);
  assert.equal(aExtra.stopCalls, 1);
  assert.equal(vExtra.stopCalls, 1);

  await bridge.requestMedia();
  assert.equal(a1.stopCalls, 1, 'prior microphone must be released');
  assert.equal(v1.stopCalls, 1, 'prior camera must be released');
  assert.equal(a2.stopCalls, 0);
  assert.equal(v2.stopCalls, 0);
  assert.equal(bridge.media.stream, second);
  assert.deepEqual(second.getTracks().filter((track) => track.readyState === 'live').map((track) => track.kind).sort(), ['audio', 'video']);
  assert.equal(bridge.audioContext, context, 'recapture reuses the one gesture-primed AudioContext');
});

test('camera and microphone switches retain the stream, pipeline, clock, and opposite device', async () => {
  const mic1 = new FakeTrack('audio', 'mic-1');
  const cam1 = new FakeTrack('video', 'cam-1');
  const original = new FakeStream([mic1, cam1]);
  const cam2 = new FakeTrack('video', 'cam-2');
  const strayMic = new FakeTrack('audio', 'stray-mic');
  const mic2 = new FakeTrack('audio', 'mic-2');
  const strayCam = new FakeTrack('video', 'stray-cam');
  const context = new FakeAudioContext();
  const pipelineRecords = {};
  const calls = [];
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => context,
    pipelineFactory: fakePipelineFactory(pipelineRecords),
    getUserMedia: async (constraints) => {
      calls.push(constraints);
      if (calls.length === 1) return original;
      if (constraints.video !== false) return new FakeStream([cam2, strayMic]);
      return new FakeStream([mic2, strayCam]);
    },
  });

  await bridge.requestMedia();
  const pipeline = bridge.ensureAnalytics();
  const clock = bridge.sessionClock;
  const firstSource = context.sources[0];
  const firstAnalyser = context.analysers[0];
  const firstSink = context.sinks[0];
  assert.equal(cam1.listenerCount('ended'), 1);
  assert.equal(mic1.listenerCount('ended'), 1);

  await bridge.switchDevice('camera', 'rear-camera');
  assert.equal(bridge.media.stream, original, 'consumers keep the same MediaStream object');
  assert.equal(cam1.stopCalls, 1);
  assert.equal(mic1.stopCalls, 0);
  assert.equal(strayMic.stopCalls, 1);
  assert.equal(bridge.media.cameraTrack, cam2);
  assert.equal(bridge.media.microphoneTrack, mic1);
  assert.equal(cam1.listenerCount('ended'), 0, 'outgoing camera observation must be removed');
  assert.equal(cam2.listenerCount('ended'), 1);
  assert.equal(mic1.listenerCount('ended'), 1, 'retained microphone must have exactly one listener');

  await bridge.switchDevice('microphone', 'usb-mic');
  assert.equal(mic1.stopCalls, 1);
  assert.equal(cam2.stopCalls, 0);
  assert.equal(strayCam.stopCalls, 1);
  assert.equal(bridge.media.cameraTrack, cam2);
  assert.equal(bridge.media.microphoneTrack, mic2);
  assert.equal(mic1.listenerCount('ended'), 0, 'outgoing microphone observation must be removed');
  assert.equal(mic2.listenerCount('ended'), 1);
  assert.equal(cam2.listenerCount('ended'), 1, 'retained camera must have exactly one listener');
  assert.equal(firstSource.disconnectCalls, 1, 'old audio graph source must be disconnected');
  assert.equal(firstAnalyser.disconnectCalls, 1, 'old analyser must be disconnected');
  assert.equal(firstSink.disconnectCalls, 1, 'old sink must be disconnected');
  assert.equal(bridge.analyticsPipeline, pipeline);
  assert.equal(bridge.sessionClock, clock);
  assert.equal(pipelineRecords.factoryCalls, 1);
  assert.equal(bridge.audioContext, context);
  assert.deepEqual(calls[1], { audio: false, video: { deviceId: { exact: 'rear-camera' } } });
  assert.deepEqual(calls[2], { audio: { deviceId: { exact: 'usb-mic' } }, video: false });
});

test('telemetry visibility is presentation-only and cannot reacquire, resume, or reset runtime state', async () => {
  const mic = new FakeTrack('audio', 'mic');
  const cam = new FakeTrack('video', 'cam');
  const context = new FakeAudioContext();
  const records = {};
  let captures = 0;
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => context,
    getUserMedia: async () => { captures += 1; return new FakeStream([mic, cam]); },
    pipelineFactory: fakePipelineFactory(records),
  });

  await bridge.requestMedia();
  bridge.startAnalytics({ answerId: 'same-session' });
  const stream = bridge.media.stream;
  const pipeline = bridge.analyticsPipeline;
  const clock = bridge.sessionClock;
  const resumeCalls = context.resumeCalls;

  assert.equal(bridge.setTelemetryVisible(false), false);
  assert.equal(bridge.setPresentationVisibility(true), true);
  assert.equal(bridge.setPresentationVisibility(false), false);
  assert.equal(captures, 1);
  assert.equal(context.resumeCalls, resumeCalls);
  assert.equal(bridge.media.stream, stream);
  assert.equal(bridge.analyticsPipeline, pipeline);
  assert.equal(bridge.sessionClock, clock);
  assert.equal(records.pipeline.beginCalls.length, 1);
  assert.equal(records.pipeline.destroyCalls, 0);
  assert.equal(mic.stopCalls, 0);
  assert.equal(cam.stopCalls, 0);
});

test('one pipeline and one session clock persist until explicit idempotent stop', async () => {
  const mic = new FakeTrack('audio', 'mic');
  const cam = new FakeTrack('video', 'cam');
  const context = new FakeAudioContext();
  const records = {};
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => context,
    getUserMedia: async () => new FakeStream([mic, cam]),
    pipelineFactory: fakePipelineFactory(records),
  });

  await bridge.requestMedia();
  bridge.startAnalytics({ answerId: 'one' });
  bridge.endAnalytics({ transcript: '' });
  bridge.startAnalytics({ answerId: 'two' });
  assert.equal(records.factoryCalls, 1);
  assert.equal(bridge.sessionClock, records.clock);

  bridge.stopMedia();
  bridge.stopMedia();
  assert.equal(records.pipeline.destroyCalls, 1);
  assert.equal(mic.stopCalls, 1);
  assert.equal(cam.stopCalls, 1);
  assert.equal(context.closeCalls, 1);
  assert.equal(bridge.media.stream, null);
  assert.equal(bridge.analyticsPipeline, null);
  assert.equal(bridge.ownsStream, false);
});

test('explicit stop fences and cleans a capture that resolves late', async () => {
  let resolveCapture;
  let captureStarted;
  const started = new Promise((resolve) => { captureStarted = resolve; });
  const mic = new FakeTrack('audio', 'late-mic');
  const cam = new FakeTrack('video', 'late-cam');
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => new FakeAudioContext(),
    getUserMedia: () => { captureStarted(); return new Promise((resolve) => { resolveCapture = resolve; }); },
    pipelineFactory: fakePipelineFactory(),
  });

  const pending = bridge.requestMedia();
  await started;
  bridge.stopMedia();
  resolveCapture(new FakeStream([mic, cam]));
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(mic.stopCalls, 1);
  assert.equal(cam.stopCalls, 1);
  assert.equal(bridge.media.stream, null);
});

test('stop and destroy remove every track and devicechange observer without late signals', async () => {
  const mic = new FakeTrack('audio', 'mic-cleanup');
  const cam = new FakeTrack('video', 'cam-cleanup');
  const mediaDevices = new FakeMediaDevices();
  const events = [];
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => new FakeAudioContext(),
    getUserMedia: async () => new FakeStream([mic, cam]),
    mediaDevices,
    pipelineFactory: fakePipelineFactory(),
  });
  bridge.addEventListener('state', (event) => events.push(event.detail));
  await bridge.requestMedia();
  for (const type of ['ended', 'mute', 'unmute']) {
    assert.equal(cam.listenerCount(type), 1);
    assert.equal(mic.listenerCount(type), 1);
  }
  assert.equal(mediaDevices.listenerCount('devicechange'), 1);

  bridge.stopMedia();
  for (const type of ['ended', 'mute', 'unmute']) {
    assert.equal(cam.listenerCount(type), 0);
    assert.equal(mic.listenerCount(type), 0);
  }
  assert.equal(mediaDevices.listenerCount('devicechange'), 0);
  assert.equal(events.at(-1).reason, 'media-stopped');
  const countAfterStop = events.length;
  cam.dispatch('ended');
  mic.dispatch('mute');
  mediaDevices.dispatch('devicechange');
  assert.equal(events.length, countAfterStop, 'detached native sources cannot signal after stop');

  bridge.destroy();
  assert.equal(mediaDevices.listenerCount('devicechange'), 0);
});

test('failed microphone switching cleans the fresh track and restores the prior device', async () => {
  const mic1 = new FakeTrack('audio', 'mic-1');
  const cam1 = new FakeTrack('video', 'cam-1');
  const mic2 = new FakeTrack('audio', 'mic-bad');
  const context = new FakeAudioContext([], { failSourceFor: (track) => track.id === 'mic-bad' });
  let calls = 0;
  const bridge = new LiveAnalyticsMediaBridge({
    audioContextFactory: () => context,
    getUserMedia: async () => (++calls === 1 ? new FakeStream([mic1, cam1]) : new FakeStream([mic2])),
    pipelineFactory: fakePipelineFactory(),
  });

  await bridge.requestMedia();
  const originalStream = bridge.media.stream;
  const originalAnalyser = bridge.media.analyser;
  await assert.rejects(bridge.replaceTrack('audio', 'bad-device'), /audio graph rejected/u);
  assert.equal(bridge.media.stream, originalStream);
  assert.equal(bridge.media.microphoneTrack, mic1);
  assert.equal(bridge.media.cameraTrack, cam1);
  assert.equal(bridge.media.analyser, originalAnalyser);
  assert.equal(mic1.stopCalls, 0);
  assert.equal(cam1.stopCalls, 0);
  assert.equal(mic2.stopCalls, 1);
  assert.deepEqual(originalStream.getTracks(), [cam1, mic1]);
});

test('the bridge contains no provider, persistence, recording, or egress path', async () => {
  const source = await readFile(new URL('../../public/live-analytics/media-bridge.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|MediaRecorder|localStorage|indexedDB/iu);
  assert.doesNotMatch(source, /LiveKit|LemonSlice|ElevenLabs|OpenAI/iu);
});
