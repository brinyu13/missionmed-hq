function supportedMime() {
  const choices = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return choices.find((value) => globalThis.MediaRecorder?.isTypeSupported?.(value)) || '';
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function putWithRetry(url, blob, { attempts = 4, chunkSize = 5 * 1024 * 1024 } = {}) {
  const total = blob.size;
  if (!(total > 0)) throw new Error('recording_upload_empty');
  const parts = Math.max(1, Math.ceil(total / chunkSize));
  let last = null;
  for (let index = 0; index < parts; index += 1) {
    const start = index * chunkSize;
    const endExclusive = Math.min(start + chunkSize, total);
    const endInclusive = endExclusive - 1;
    const chunk = blob.slice(start, endExclusive);
    const chunkUrl = `${url}${url.includes('?') ? '&' : '?'}part=${index + 1}&parts=${parts}`;
    let uploaded = false;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        // This is the proven DBOC/CIE private-R2 contract. The worker requires
        // octet-stream chunks, an exact Content-Range, and part coordinates.
        const response = await fetch(chunkUrl, {
          method: 'PUT',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes ${start}-${endInclusive}/${total}`,
          },
          body: chunk,
        });
        if (response.ok) { uploaded = true; break; }
        last = new Error(`recording_upload_${response.status}`);
      } catch (error) { last = error; }
      if (attempt + 1 < attempts) await sleep(400 * (2 ** attempt));
    }
    if (!uploaded) throw last || new Error('recording_upload_failed');
  }
  return true;
}

export class AccountRecordingController extends EventTarget {
  constructor({ api, stream, enabled = true, sessionId, title, questionId } = {}) {
    super();
    this.api = api;
    this.stream = stream;
    this.enabled = enabled && Boolean(globalThis.MediaRecorder) && Boolean(stream);
    this.sessionId = sessionId;
    this.title = title;
    this.questionId = questionId;
    this.mime = supportedMime();
    this.recorder = null;
    this.chunks = [];
    this.recording = null;
    this.startedAt = 0;
    this.pausedAt = null;
    this.pausedMs = 0;
    this.pausedSpans = [];
    this.finalBlob = null;
    this.state = this.enabled ? 'READY' : 'OFF';
  }

  emit() { this.dispatchEvent(new CustomEvent('state', { detail: this.snapshot() })); }
  snapshot() {
    const now = performance.now();
    const elapsedMs = this.startedAt
      ? Math.max(0, (this.pausedAt ?? now) - this.startedAt - this.pausedMs)
      : 0;
    return Object.freeze({ state: this.state, elapsedMs, recordingId: this.recording?.id || null });
  }

  async start() {
    if (!this.enabled || this.state !== 'READY') return false;
    this.recording = await this.api.createRecording(this.sessionId, {
      title: this.title,
      questionId: this.questionId,
      mime: this.mime || 'video/webm',
    });
    this.recorder = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
    this.chunks = [];
    this.recorder.addEventListener('dataavailable', (event) => {
      if (event.data?.size) this.chunks.push(event.data);
    });
    this.startedAt = performance.now();
    this.state = 'RECORDING';
    this.recorder.start(5_000);
    this.emit();
    return true;
  }

  pause() {
    if (this.state !== 'RECORDING') return false;
    this.recorder.pause();
    this.pausedAt = performance.now();
    this.pausedSpans.push({ startMs: Math.round(this.pausedAt - this.startedAt) });
    this.state = 'PAUSED';
    this.emit();
    return true;
  }

  resume() {
    if (this.state !== 'PAUSED') return false;
    this.pausedMs += performance.now() - this.pausedAt;
    const span = this.pausedSpans.at(-1);
    if (span && span.endMs == null) span.endMs = Math.round(performance.now() - this.startedAt);
    this.pausedAt = null;
    this.recorder.resume();
    this.state = 'RECORDING';
    this.emit();
    return true;
  }

  async stopAndSeal() {
    if (this.state === 'ERROR' && this.finalBlob) return this.uploadAndSeal(this.finalBlob);
    if (!['RECORDING', 'PAUSED'].includes(this.state)) return null;
    if (this.state === 'PAUSED') this.resume();
    this.state = 'FINALIZING';
    this.emit();
    const stopped = new Promise((resolve) => this.recorder.addEventListener('stop', resolve, { once: true }));
    this.recorder.stop();
    await stopped;
    this.finalBlob = new Blob(this.chunks, { type: this.recorder.mimeType || this.mime || 'video/webm' });
    return this.uploadAndSeal(this.finalBlob);
  }

  async uploadAndSeal(blob) {
    this.state = 'FINALIZING'; this.emit();
    try {
      await putWithRetry(this.recording.uploadUrl, blob);
      const sealed = await this.api.sealRecording(this.recording.id, {
        sizeBytes: blob.size,
        durationMs: Math.round(this.snapshot().elapsedMs),
        mime: blob.type,
        uploadToken: this.recording.uploadToken,
        uploadExpiresAtMs: this.recording.uploadExpiresAtMs,
        pausedSpans: this.pausedSpans,
      });
      this.state = 'SAVED'; this.emit();
      return { ...sealed, blob };
    } catch (error) {
      this.state = 'ERROR'; this.emit();
      throw error;
    }
  }

  destroy() {
    try { if (this.recorder?.state && this.recorder.state !== 'inactive') this.recorder.stop(); } catch {}
    this.chunks = [];
  }
}
