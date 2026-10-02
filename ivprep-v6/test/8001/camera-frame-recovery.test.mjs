import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { CAMERA_BLACK_MESSAGE, createMediaAnalyticsBridge } from '../../public/studio/media-analytics-capability.mjs';

const runtime = await readFile(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
class Track {
  constructor(kind) { this.kind = kind; this.readyState = 'live'; this.enabled = true; this.muted = false; this.listeners = new Map(); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name) { this.listeners.delete(name); }
  stop() { this.readyState = 'ended'; }
}
class Stream {
  constructor(tracks = [new Track('video'), new Track('audio')]) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
}
class AudioContext {
  state = 'running';
  createAnalyser() { return { connect() {}, disconnect() {}, fftSize: 2048 }; }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  createMediaStreamDestination() { return { disconnect() {} }; }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

async function fixture(t) {
  const names = ['window', 'document', 'MediaStream', 'CustomEvent', 'setInterval', 'clearInterval'];
  const prior = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  t.after(() => names.forEach((name, i) => prior[i]
    ? Object.defineProperty(globalThis, name, prior[i]) : delete globalThis[name]));
  const timers = new Map(); const listeners = new Map();
  let next = 0; let level = 0; let samples = 0;
  const document = { createElement(tag) {
    if (tag === 'canvas') return { getContext: () => ({ drawImage() {}, getImageData() {
      samples += 1; return { data: new Uint8ClampedArray([level, level, level, 255]) };
    } }) };
    return { dataset: {}, append() {} };
  } };
  const window = { AudioContext, addEventListener(name, callback) { listeners.set(name, callback); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); } };
  const values = { window, document, MediaStream: Stream, CustomEvent: class { constructor(type) { this.type = type; } },
    setInterval(callback, ms) { assert.equal(ms, 500); const id = ++next; timers.set(id, callback); return id; },
    clearInterval(id) { timers.delete(id); } };
  names.forEach(name => Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: values[name] }));
  const bridge = createMediaAnalyticsBridge();
  t.after(() => bridge.stopMedia());
  const stream = new Stream();
  await bridge.bindStream(stream, { ownsStream: true });
  const video = { srcObject: stream, videoWidth: 640, videoHeight: 480, paused: false, ended: false };
  return { bridge, stream, video, timers, window, document, setLevel(value) { level = value; },
    samples: () => samples, tick() { for (const callback of [...timers.values()]) callback(); } };
}

test('same-stream black to lit restores actual readiness and clears only its camera error without reacquiring', async t => {
  const f = await fixture(t);
  const state = { deviceError: CAMERA_BLACK_MESSAGE.toUpperCase(), role: 'student', view: 'devicecheck',
    launchMode: 'ai', interviewSet: ['CORE-01'] };
  const host = { replaceChildren() {}, append() {} }; const proceed = {};
  const context = { bridge: f.bridge, state, CAMERA_BLACK_MESSAGE, window: f.window, document: f.document,
    $: selector => selector === '#device-checklist' ? host : selector === '#device-proceed' ? proceed : f.video };
  const trackStart = runtime.indexOf('function liveTrack(kind)');
  const trackEnd = runtime.indexOf('function requestVideoPlayback', trackStart);
  const renderStart = runtime.indexOf('function renderDeviceCheck()');
  const renderEnd = runtime.indexOf('async function connectDevices()', renderStart);
  const eventStart = runtime.indexOf("window.addEventListener('ivoc-media-liveness'");
  const eventEnd = runtime.indexOf("window.addEventListener('pagehide'", eventStart);
  const render = runInNewContext(`${runtime.slice(trackStart, trackEnd)}\n${runtime.slice(renderStart, renderEnd)}\n${runtime.slice(eventStart, eventEnd)}; renderDeviceCheck`, context);
  await assert.rejects(f.bridge.verifyVisibleFrame(f.video, { timeoutMs: 0 }), { message: CAMERA_BLACK_MESSAGE });
  render(); assert.equal(proceed.disabled, true);
  f.tick(); assert.equal(f.bridge.frameVisibility.visible, false);
  f.setLevel(64); f.tick();
  assert.equal(f.bridge.frameVisibility.visible, true);
  assert.equal(f.bridge.media.stream, f.stream);
  assert.equal(f.stream.getTracks().every(track => track.readyState === 'live'), true);
  assert.equal(proceed.disabled, false);
  assert.match(proceed.innerHTML, /Start AI interview/);
  assert.equal(state.deviceError, null);
  assert.equal(f.timers.size, 0);
  state.deviceError = 'UNRELATED MICROPHONE ERROR';
  f.window.dispatchEvent({ type: 'ivoc-media-liveness' });
  assert.equal(state.deviceError, 'UNRELATED MICROPHONE ERROR');
});

test('recovery rejects paused, dimensionless, disabled or muted surfaces before accepting visible pixels', async t => {
  const f = await fixture(t);
  await assert.rejects(f.bridge.verifyVisibleFrame(f.video, { timeoutMs: 0 }));
  f.setLevel(64);
  for (const [target, key, invalid] of [[f.video, 'paused', true], [f.video, 'ended', true],
    [f.video, 'videoWidth', 0], [f.stream.getVideoTracks()[0], 'enabled', false],
    [f.stream.getVideoTracks()[0], 'muted', true]]) {
    const prior = target[key]; target[key] = invalid;
    const samples = f.samples(); f.tick();
    assert.equal(f.samples(), samples);
    assert.equal(f.bridge.frameVisibility.visible, false);
    target[key] = prior;
  }
  f.tick(); assert.equal(f.bridge.frameVisibility.visible, true);
});

test('a temporarily muted microphone keeps its graph and becomes ready on unmute without reacquisition', async t => {
  const f = await fixture(t);
  const stream = new Stream(); const mic = stream.getAudioTracks()[0];
  mic.muted = true;
  await f.bridge.bindStream(stream, { ownsStream: true });
  assert.equal(f.bridge.media.mic, false);
  const analyser = f.bridge.media.analyser;
  assert.ok(analyser);
  mic.muted = false; mic.listeners.get('unmute')();
  assert.equal(f.bridge.media.mic, true);
  assert.equal(f.bridge.media.analyser, analyser);
  assert.equal(f.bridge.media.stream, stream);
});

test('stream replacement and stop cancel recovery; a queued stale callback cannot cancel the new watcher', async t => {
  const f = await fixture(t);
  await assert.rejects(f.bridge.verifyVisibleFrame(f.video, { timeoutMs: 0 }));
  const stale = [...f.timers.values()][0];
  const replacement = new Stream();
  await f.bridge.bindStream(replacement, { ownsStream: true });
  assert.equal(f.timers.size, 0);
  f.video.srcObject = replacement;
  await assert.rejects(f.bridge.verifyVisibleFrame(f.video, { timeoutMs: 0 }));
  stale(); assert.equal(f.timers.size, 1);
  assert.equal(f.bridge.frameVisibility.visible, false);
  const latest = [...f.timers.values()][0];
  f.bridge.stopMedia(); f.setLevel(64); latest();
  assert.equal(f.timers.size, 0);
  assert.equal(f.bridge.frameVisibility.stream, null);
  assert.equal(f.bridge.frameVisibility.visible, false);
});

test('rebinding preview to another stream and ending the current track never grants readiness', async t => {
  for (const kind of ['rebind', 'ended']) {
    const f = await fixture(t);
    await assert.rejects(f.bridge.verifyVisibleFrame(f.video, { timeoutMs: 0 }));
    f.setLevel(64);
    if (kind === 'rebind') f.video.srcObject = new Stream();
    else f.stream.getVideoTracks()[0].stop();
    f.tick();
    assert.equal(f.bridge.frameVisibility.visible, false);
    assert.equal(f.timers.size, 0);
  }
});
