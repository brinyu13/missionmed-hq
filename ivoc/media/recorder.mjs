import { ChunkManifest } from './chunk-manifest.mjs';

export class CanonicalRecorder {
  constructor({ sessionId, mediaId, stream, clock, emit, onChunk, MediaRecorderClass = globalThis.MediaRecorder, mimeType = 'video/webm;codecs=vp9,opus', timesliceMs = 3000 }) {
    if (!sessionId || !mediaId || !stream || !clock || typeof emit !== 'function' || typeof onChunk !== 'function') throw new TypeError('recorder dependencies are required');
    if (!MediaRecorderClass) throw new TypeError('MediaRecorder is unavailable');
    this.sessionId = sessionId;
    this.mediaId = mediaId;
    this.stream = stream;
    this.clock = clock;
    this.emit = emit;
    this.onChunk = onChunk;
    this.MediaRecorderClass = MediaRecorderClass;
    this.mimeType = MediaRecorderClass.isTypeSupported?.(mimeType) === false ? 'video/webm' : mimeType;
    this.timesliceMs = timesliceMs;
    this.manifest = new ChunkManifest({ sessionId, mediaId, codec: this.mimeType });
    this.recorder = null;
    this.lastChunkAt = 0;
    this.queue = Promise.resolve();
  }

  start() {
    if (this.recorder) throw new Error('recorder already started');
    this.lastChunkAt = this.clock.now();
    this.recorder = new this.MediaRecorderClass(this.stream, { mimeType: this.mimeType });
    this.recorder.addEventListener('dataavailable', (event) => {
      if (!event.data?.size) return;
      const end = this.clock.now();
      const start = this.lastChunkAt;
      this.lastChunkAt = end;
      this.queue = this.queue.then(async () => {
        const entry = await this.manifest.append(event.data, { tStartMs: start, tEndMs: end });
        await this.onChunk(event.data, entry);
        this.emit('media.chunk.uploaded.v1', entry);
      });
    });
    this.recorder.start(this.timesliceMs);
    this.emit('media.started.v1', { media_id: this.mediaId, codec: this.mimeType, capture_owner: 'student_browser' });
  }

  pause() {
    if (this.recorder?.state !== 'recording') throw new Error('recorder is not recording');
    this.recorder.pause();
    this.emit('media.paused.v1', { media_id: this.mediaId });
  }

  resume() {
    if (this.recorder?.state !== 'paused') throw new Error('recorder is not paused');
    this.recorder.resume();
    this.lastChunkAt = this.clock.now();
    this.emit('media.resumed.v1', { media_id: this.mediaId });
  }

  async stop() {
    if (!this.recorder || this.recorder.state === 'inactive') throw new Error('recorder is not active');
    const stopped = new Promise((resolve) => this.recorder.addEventListener('stop', resolve, { once: true }));
    this.recorder.stop();
    await stopped;
    await this.queue;
    const durationMs = this.clock.now();
    const sealed = await this.manifest.seal({ durationMs });
    this.emit('media.sealed.v1', sealed);
    return sealed;
  }
}
