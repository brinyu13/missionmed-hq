import assert from 'node:assert/strict';
import test from 'node:test';

import { AccountRecordingController } from '../../public/ivoc-standalone/app/recording.mjs';

class FakeRecorder extends EventTarget {
  static isTypeSupported() { return true; }
  constructor() { super(); this.state = 'inactive'; this.mimeType = 'video/webm'; }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    const data = new Event('dataavailable'); data.data = new Blob(['real-media-bytes'], { type: this.mimeType }); this.dispatchEvent(data);
    this.dispatchEvent(new Event('stop'));
  }
}

test('recording state machine saves, preserves pause spans, and seals account media', async () => {
  const oldRecorder = globalThis.MediaRecorder;
  const oldFetch = globalThis.fetch;
  const uploads = [];
  globalThis.MediaRecorder = FakeRecorder;
  globalThis.fetch = async (url, options) => { uploads.push({ url, options }); return { ok: true }; };
  let seal = null;
  const api = {
    createRecording: async () => ({ id: 'r1', uploadUrl: 'https://media.test/upload', uploadToken: 'token', uploadExpiresAtMs: Date.now() + 60_000 }),
    sealRecording: async (_id, body) => { seal = body; return { recording: { id: 'r1', status: 'saved' } }; },
  };
  try {
    const controller = new AccountRecordingController({ api, stream: {}, sessionId: 's1', enabled: true });
    assert.equal(await controller.start(), true);
    assert.equal(controller.state, 'RECORDING');
    assert.equal(controller.pause(), true);
    assert.equal(controller.state, 'PAUSED');
    assert.equal(controller.resume(), true);
    const result = await controller.stopAndSeal();
    assert.equal(controller.state, 'SAVED');
    assert.equal(result.recording.id, 'r1');
    assert.equal(seal.uploadToken, 'token');
    assert.equal(seal.pausedSpans.length, 1);
    assert.ok(seal.sizeBytes > 0);
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].url, 'https://media.test/upload?part=1&parts=1');
    assert.equal(uploads[0].options.headers['Content-Type'], 'application/octet-stream');
    assert.equal(uploads[0].options.headers['Content-Range'], `bytes 0-${seal.sizeBytes - 1}/${seal.sizeBytes}`);
  } finally {
    globalThis.MediaRecorder = oldRecorder;
    globalThis.fetch = oldFetch;
  }
});
