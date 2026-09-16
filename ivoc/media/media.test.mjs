import assert from 'node:assert/strict';
import test from 'node:test';
import { ChunkManifest } from './chunk-manifest.mjs';
import { CanonicalRecorder } from './recorder.mjs';

test('chunk manifest hashes real bytes and seals one immutable media identity', async () => {
  const manifest = new ChunkManifest({ sessionId: 's1', mediaId: 'm1', codec: 'video/webm' });
  await manifest.append(new Blob(['one']), { tStartMs: 0, tEndMs: 1000 });
  await manifest.append(new Blob(['two']), { tStartMs: 1000, tEndMs: 2000 });
  const sealed = await manifest.seal({ durationMs: 2000 });
  assert.equal(sealed.chunk_count, 2);
  assert.equal(sealed.bytes, 6);
  assert.match(sealed.manifest_sha256, /^[0-9a-f]{64}$/u);
  await assert.rejects(() => manifest.append(new Blob(['late']), { tStartMs: 2, tEndMs: 3 }), /sealed/);
});

test('recorder uses the admitted stream and emits chunk and seal events', async () => {
  class FakeRecorder extends EventTarget {
    static isTypeSupported() { return true; }
    constructor(stream) { super(); this.stream = stream; this.state = 'inactive'; }
    start() { this.state = 'recording'; this.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['bytes']) })); }
    stop() { this.state = 'inactive'; this.dispatchEvent(new Event('stop')); }
  }
  let now = 0;
  const events = [];
  const recorder = new CanonicalRecorder({ sessionId: 's1', mediaId: 'm1', stream: { id: 'admitted' }, clock: { now: () => (now += 1000) }, emit: (type, payload) => events.push({ type, payload }), onChunk: async () => {}, MediaRecorderClass: FakeRecorder });
  recorder.start();
  const sealed = await recorder.stop();
  assert.equal(sealed.chunk_count, 1);
  assert.deepEqual(events.map((item) => item.type), ['media.started.v1', 'media.chunk.uploaded.v1', 'media.sealed.v1']);
});
