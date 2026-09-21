import assert from 'node:assert/strict';
import test from 'node:test';

import { createMediaAnalyticsBridge } from '../../public/studio/media-analytics-capability.mjs';

class FakeTrack {
  constructor(kind) { this.kind = kind; this.readyState = 'live'; this.listeners = new Map(); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name) { this.listeners.delete(name); }
  stop() { this.readyState = 'ended'; this.listeners.get('ended')?.(); }
}

class FakeMediaStream {
  constructor(tracks) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio'); }
}

test('failed re-acquisition clears the ended capture instead of preserving false LIVE state', async (context) => {
  const priorWindow = globalThis.window;
  const priorNavigator = globalThis.navigator;
  const priorMediaStream = globalThis.MediaStream;
  const priorCustomEvent = globalThis.CustomEvent;
  context.after(() => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: priorWindow });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: priorNavigator });
    Object.defineProperty(globalThis, 'MediaStream', { configurable: true, value: priorMediaStream });
    Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: priorCustomEvent });
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent() {} } });
  Object.defineProperty(globalThis, 'MediaStream', { configurable: true, value: FakeMediaStream });
  Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class { constructor(type) { this.type = type; } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { async getUserMedia() { throw Object.assign(new Error('missing'), { name: 'NotFoundError' }); } } } });

  const bridge = createMediaAnalyticsBridge();
  const video = new FakeTrack('video');
  await bridge.bindStream(new FakeMediaStream([video]), { ownsStream: true });
  assert.equal(bridge.media.cam, true);
  await assert.rejects(() => bridge.requestMedia(true, true), /missing/u);
  assert.equal(video.readyState, 'ended');
  assert.equal(bridge.media.stream, null);
  assert.equal(bridge.media.cam, false);
});
