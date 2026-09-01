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

const finiteMs = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? Math.max(0, Math.round(Number(value)))
  : null;

async function browserPlayableDurationMs(blob) {
  if (!blob || typeof globalThis.document?.createElement !== 'function' || typeof globalThis.URL?.createObjectURL !== 'function') return null;
  const video = globalThis.document.createElement('video');
  const url = globalThis.URL.createObjectURL(blob);
  video.preload = 'metadata';
  try {
    const duration = await new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(value);
      };
      const timeout = setTimeout(() => finish(null), 2_500);
      video.addEventListener('loadedmetadata', () => finish(video.duration), { once: true });
      video.addEventListener('error', () => finish(null), { once: true });
      video.src = url;
    });
    return Number.isFinite(duration) && duration >= 0 ? Math.round(duration * 1000) : null;
  } finally {
    video.removeAttribute?.('src');
    video.load?.();
    globalThis.URL.revokeObjectURL(url);
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  let timer = null;
  const timedOut = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('recording_upload_timeout'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      fetch(url, { ...options, signal: controller.signal }),
      timedOut,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function putWithRetry(url, blob, {
  attempts = 4,
  chunkSize = 5 * 1024 * 1024,
  requestTimeoutMs = 15_000,
  csrfToken = '',
  uploadToken = '',
  uploadExpiresAtMs = 0,
} = {}) {
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
        const response = await fetchWithTimeout(chunkUrl, {
          method: 'PUT',
          credentials: 'same-origin',
          redirect: 'error',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Range': `bytes ${start}-${endInclusive}/${total}`,
            'X-MMHQ-CSRF': csrfToken,
            'X-IVOC-Upload-Token': uploadToken,
            'X-IVOC-Upload-Expires': String(uploadExpiresAtMs),
          },
          body: chunk,
        }, requestTimeoutMs);
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
  constructor({
    api,
    stream,
    enabled = true,
    sessionId,
    title,
    questionId,
    now = () => performance.now(),
    sessionNow = null,
    recordingStartSessionMs = null,
    probePlayableDuration = browserPlayableDurationMs,
  } = {}) {
    super();
    this.api = api;
    this.stream = stream;
    this.enabled = enabled && Boolean(globalThis.MediaRecorder) && Boolean(stream);
    this.sessionId = sessionId;
    this.title = title;
    this.questionId = questionId;
    this.now = now;
    this.sessionNow = typeof sessionNow === 'function' ? sessionNow : null;
    this.initialRecordingStartSessionMs = finiteMs(recordingStartSessionMs);
    this.probePlayableDuration = typeof probePlayableDuration === 'function' ? probePlayableDuration : browserPlayableDurationMs;
    this.mime = supportedMime();
    this.recorder = null;
    this.chunks = [];
    this.recording = null;
    this.startedAt = null;
    this.pausedAt = null;
    this.pausedMs = 0;
    this.pausedSpans = [];
    this.finalBlob = null;
    this.finalElapsedMs = null;
    this.recordingStartSessionMs = this.initialRecordingStartSessionMs;
    this.playableDurationMs = null;
    this.state = this.enabled ? 'READY' : 'OFF';
  }

  emit() { this.dispatchEvent(new CustomEvent('state', { detail: this.snapshot() })); }
  currentSessionMs(at = this.now()) {
    const observed = finiteMs(this.sessionNow?.());
    if (observed !== null) return observed;
    const anchor = this.recordingStartSessionMs ?? this.initialRecordingStartSessionMs ?? 0;
    return this.startedAt === null ? anchor : anchor + Math.max(0, at - this.startedAt);
  }
  timebase() {
    return Object.freeze({
      canonical: 'session',
      recordingStartSessionMs: this.recordingStartSessionMs ?? 0,
      pausedSpans: Object.freeze(this.pausedSpans.map((span) => Object.freeze({ ...span }))),
    });
  }
  snapshot() {
    const now = this.now();
    const elapsedMs = this.finalElapsedMs ?? (this.startedAt !== null
      ? Math.max(0, (this.pausedAt ?? now) - this.startedAt - this.pausedMs)
      : 0);
    return Object.freeze({
      state: this.state,
      elapsedMs,
      recordingId: this.recording?.id || null,
      recordingStartSessionMs: this.recordingStartSessionMs,
      pausedSpans: this.timebase().pausedSpans,
      playableDurationMs: this.playableDurationMs,
      timebase: this.timebase(),
    });
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
    this.startedAt = this.now();
    this.recordingStartSessionMs = finiteMs(this.sessionNow?.()) ?? this.initialRecordingStartSessionMs ?? 0;
    this.pausedAt = null;
    this.pausedMs = 0;
    this.pausedSpans = [];
    this.finalElapsedMs = null;
    this.playableDurationMs = null;
    this.state = 'RECORDING';
    this.recorder.start(5_000);
    this.emit();
    return true;
  }

  pause() {
    if (this.state !== 'RECORDING') return false;
    this.recorder.pause();
    this.pausedAt = this.now();
    this.pausedSpans.push({ startMs: this.currentSessionMs(this.pausedAt) });
    this.state = 'PAUSED';
    this.emit();
    return true;
  }

  resume() {
    if (this.state !== 'PAUSED') return false;
    const now = this.now();
    this.pausedMs += now - this.pausedAt;
    const span = this.pausedSpans.at(-1);
    if (span && span.endMs == null) span.endMs = this.currentSessionMs(now);
    this.pausedAt = null;
    this.recorder.resume();
    this.state = 'RECORDING';
    this.emit();
    return true;
  }

  async stopAndSeal() {
    if (this.state === 'ERROR' && this.finalBlob) return this.uploadAndSeal(this.finalBlob);
    if (!['RECORDING', 'PAUSED'].includes(this.state)) return null;
    const stoppedAt = this.now();
    if (this.pausedAt !== null) {
      this.pausedMs += stoppedAt - this.pausedAt;
      const span = this.pausedSpans.at(-1);
      if (span && span.endMs == null) span.endMs = this.currentSessionMs(stoppedAt);
      this.pausedAt = null;
    }
    this.finalElapsedMs = Math.max(0, stoppedAt - this.startedAt - this.pausedMs);
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
      const playableDuration = this.playableDurationMs === null
        ? Promise.resolve(this.probePlayableDuration(blob)).then(finiteMs).catch(() => null)
        : Promise.resolve(this.playableDurationMs);
      const upload = putWithRetry(this.recording.uploadUrl, blob, {
        csrfToken: this.api.csrfToken,
        uploadToken: this.recording.uploadToken,
        uploadExpiresAtMs: this.recording.uploadExpiresAtMs,
      });
      await upload;
      this.playableDurationMs = await playableDuration;
      const recordingDurationMs = Math.round(this.finalElapsedMs ?? 0);
      const durationMs = this.playableDurationMs ?? recordingDurationMs;
      const timebase = this.timebase();
      const sealed = await this.api.sealRecording(this.recording.id, {
        sizeBytes: blob.size,
        durationMs,
        recordingDurationMs,
        playableDurationMs: this.playableDurationMs,
        mime: blob.type,
        uploadToken: this.recording.uploadToken,
        uploadExpiresAtMs: this.recording.uploadExpiresAtMs,
        recordingStartSessionMs: timebase.recordingStartSessionMs,
        pausedSpans: timebase.pausedSpans,
        timebase,
      });
      this.state = 'SAVED'; this.emit();
      return {
        ...sealed,
        blob,
        durationMs,
        recordingDurationMs,
        playableDurationMs: this.playableDurationMs,
        recordingStartSessionMs: timebase.recordingStartSessionMs,
        pausedSpans: timebase.pausedSpans.map((span) => ({ ...span })),
        timebase,
      };
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
