// Local aggregate word timing for the 3521 Live Analytics Runtime.
//
// Audio windows travel only to the same-origin localhost harness. The endpoint is
// required to return aggregate counts/timestamps and is never allowed to return
// transcript text. Missing or malformed capability fails closed.

export const LOCAL_TRANSCRIPT_TIMING_SOURCE = 'LOCAL_TIMED_TRANSCRIPT';
export const LOCAL_TRANSCRIPT_ENDPOINT = '/iv-prep-on-call/live-analytics/local-transcript-timing';

const DEFAULT_WINDOW_MS = 6_000;
const MAX_PENDING_WINDOWS = 2;
const AGGREGATE_RESPONSE_KEYS = Object.freeze([
  'available',
  'firstWordStartMs',
  'lastWordEndMs',
  'providerSessions',
  'rawAudioPersisted',
  'rawTextReturned',
  'source',
  'wordCount',
]);

function frozenState(state, reason, detail = null) {
  return Object.freeze({ state, reason, ...(detail ? { detail } : {}) });
}

function finite(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function liveAudioTrack(stream) {
  return stream?.getAudioTracks?.().find((track) => track?.readyState === 'live' && track?.enabled !== false) || null;
}

export class LocalTranscriptTimingProducer {
  constructor({
    fetchImpl = globalThis.fetch?.bind(globalThis),
    MediaRecorderClass = globalThis.MediaRecorder,
    MediaStreamClass = globalThis.MediaStream,
    BlobClass = globalThis.Blob,
    setTimeoutFn = (callback, delay) => setTimeout(callback, delay),
    clearTimeoutFn = (handle) => clearTimeout(handle),
    endpoint = LOCAL_TRANSCRIPT_ENDPOINT,
    windowMs = DEFAULT_WINDOW_MS,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.MediaRecorderClass = MediaRecorderClass;
    this.MediaStreamClass = MediaStreamClass;
    this.BlobClass = BlobClass;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.endpoint = endpoint;
    this.windowMs = Math.max(2_000, Math.min(15_000, Number(windowMs) || DEFAULT_WINDOW_MS));
    this.active = false;
    this.generation = 0;
    this.recorder = null;
    this.stopTimer = null;
    this.clock = null;
    this.audioTrack = null;
    this.onTiming = null;
    this.onState = null;
    this.pendingWindows = 0;
    this.queue = Promise.resolve();
    this.requestController = null;
    this.state = frozenState('idle', 'LOCAL_TRANSCRIPT_TIMING_IDLE');
  }

  #setState(state, reason, detail = null) {
    this.state = frozenState(state, reason, detail);
    this.onState?.(this.state);
    return this.state;
  }

  async probe({ generation = null } = {}) {
    const publish = (state, reason, detail = null) => generation !== null && generation !== this.generation
      ? this.state
      : this.#setState(state, reason, detail);
    if (typeof this.fetchImpl !== 'function') return publish('unavailable', 'LOCAL_TRANSCRIPT_FETCH_UNAVAILABLE');
    try {
      const response = await this.fetchImpl(`${this.endpoint}/status`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json();
      if (!response.ok
        || payload?.available !== true
        || payload?.source !== 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS'
        || payload?.providerSessions !== 0
        || payload?.persistence !== 'MEMORY_ONLY') {
        return publish('unavailable', payload?.reason || 'LOCAL_TRANSCRIPT_SIDECAR_UNAVAILABLE');
      }
      return publish('ready', 'LOCAL_TRANSCRIPT_SIDECAR_READY', {
        source: payload.source,
        persistence: payload.persistence,
      });
    } catch {
      return publish('unavailable', 'LOCAL_TRANSCRIPT_SIDECAR_UNREACHABLE');
    }
  }

  async start({ stream, clock, onTiming, onState } = {}) {
    if (this.active) return false;
    const generation = ++this.generation;
    this.onState = typeof onState === 'function' ? onState : null;
    this.onTiming = typeof onTiming === 'function' ? onTiming : null;
    this.clock = clock || null;
    this.audioTrack = liveAudioTrack(stream);
    if (!this.audioTrack) {
      this.#setState('unavailable', 'LIVE_MICROPHONE_TRACK_REQUIRED');
      return false;
    }
    if (!this.clock?.sessionMs || !this.onTiming) {
      this.#setState('unavailable', 'TRANSCRIPT_TIMING_CONSUMER_REQUIRED');
      return false;
    }
    if (!this.MediaRecorderClass || !this.MediaStreamClass || !this.BlobClass) {
      this.#setState('unavailable', 'MEDIARECORDER_AUDIO_WINDOWS_UNSUPPORTED');
      return false;
    }
    const capability = await this.probe({ generation });
    if (generation !== this.generation || capability.state !== 'ready') return false;
    this.active = true;
    this.#setState('live', 'LOCAL_TRANSCRIPT_TIMING_LIVE', capability.detail);
    this.#beginWindow(generation);
    return true;
  }

  #beginWindow(generation) {
    if (!this.active || generation !== this.generation || !this.audioTrack) return false;
    const chunks = [];
    const windowStartedAtMs = Number(this.clock.sessionMs());
    let recorder;
    try {
      const audioStream = new this.MediaStreamClass([this.audioTrack]);
      recorder = new this.MediaRecorderClass(audioStream);
    } catch {
      this.#fail('MEDIARECORDER_AUDIO_WINDOW_START_FAILED');
      return false;
    }
    this.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (event?.data?.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => this.#fail('MEDIARECORDER_AUDIO_WINDOW_FAILED');
    recorder.onstop = () => {
      if (!this.active || generation !== this.generation) return;
      const windowEndedAtMs = Number(this.clock.sessionMs());
      const mimeType = recorder.mimeType || chunks[0]?.type || 'application/octet-stream';
      const blob = new this.BlobClass(chunks, { type: mimeType });
      this.recorder = null;
      this.#beginWindow(generation);
      if (blob.size > 0) this.#enqueueWindow({ blob, windowStartedAtMs, windowEndedAtMs, generation });
    };
    try {
      recorder.start();
      this.stopTimer = this.setTimeoutFn(() => {
        this.stopTimer = null;
        if (recorder.state !== 'inactive') recorder.stop();
      }, this.windowMs);
      return true;
    } catch {
      this.#fail('MEDIARECORDER_AUDIO_WINDOW_START_FAILED');
      return false;
    }
  }

  #enqueueWindow(window) {
    if (this.pendingWindows >= MAX_PENDING_WINDOWS) {
      this.#setState('partial', 'LOCAL_TRANSCRIPT_BACKPRESSURE');
      return false;
    }
    this.pendingWindows += 1;
    this.queue = this.queue
      .then(() => this.#transcribeWindow(window))
      .catch(() => {
        if (this.active && window.generation === this.generation) this.#setState('partial', 'LOCAL_TRANSCRIPT_WINDOW_FAILED');
      })
      .finally(() => { this.pendingWindows = Math.max(0, this.pendingWindows - 1); });
    return true;
  }

  async #transcribeWindow({ blob, windowStartedAtMs, windowEndedAtMs, generation }) {
    if (!this.active || generation !== this.generation) return false;
    const controller = new AbortController();
    this.requestController = controller;
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      body: blob,
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'Content-Type': blob.type || 'application/octet-stream' },
    });
    const payload = await response.json();
    if (!this.active || generation !== this.generation) return false;
    const responseKeys = payload && typeof payload === 'object' ? Object.keys(payload).sort() : [];
    if (!response.ok
      || responseKeys.length !== AGGREGATE_RESPONSE_KEYS.length
      || responseKeys.some((key, index) => key !== AGGREGATE_RESPONSE_KEYS[index])
      || payload?.available !== true
      || payload?.source !== 'LOCAL_FASTER_WHISPER_WORD_TIMESTAMPS'
      || payload?.providerSessions !== 0
      || payload?.rawTextReturned !== false
      || payload?.rawAudioPersisted !== false) {
      this.#setState('partial', payload?.reason || 'LOCAL_TRANSCRIPT_WINDOW_REJECTED');
      return false;
    }
    const wordCount = Number.isInteger(payload.wordCount) ? payload.wordCount : null;
    const captureDurationMs = windowEndedAtMs - windowStartedAtMs;
    const firstOffsetMs = finite(payload.firstWordStartMs);
    const lastOffsetMs = finite(payload.lastWordEndMs);
    if (wordCount === null || wordCount < 0 || captureDurationMs <= 0) {
      this.#setState('partial', 'INVALID_LOCAL_TRANSCRIPT_AGGREGATE');
      return false;
    }
    const observedStartedAtMs = wordCount > 0 && firstOffsetMs !== null
      ? windowStartedAtMs + clamp(firstOffsetMs, 0, captureDurationMs)
      : windowStartedAtMs;
    const observedEndedAtMs = wordCount > 0 && lastOffsetMs !== null
      ? windowStartedAtMs + clamp(lastOffsetMs, 0, captureDurationMs)
      : windowEndedAtMs;
    if (observedEndedAtMs <= observedStartedAtMs) {
      this.#setState('partial', 'INVALID_LOCAL_TRANSCRIPT_WORD_TIMESTAMPS');
      return false;
    }
    const atMs = Math.max(observedEndedAtMs, Number(this.clock.sessionMs()));
    this.onTiming(Object.freeze({
      atMs,
      windowStartedAtMs: observedStartedAtMs,
      windowEndedAtMs: observedEndedAtMs,
      wordCount,
      provenance: Object.freeze({
        kind: 'OBSERVED_TRANSCRIPT_TIMING',
        observed: true,
        source: LOCAL_TRANSCRIPT_TIMING_SOURCE,
        engine: 'FASTER_WHISPER_LOCAL_SNAPSHOT',
        transport: 'LOOPBACK_SAME_ORIGIN',
        rawTextRetained: false,
        rawAudioPersisted: false,
      }),
    }));
    this.#setState('live', wordCount >= 3 ? 'LOCAL_TRANSCRIPT_TIMING_OBSERVED' : 'NEED_MORE_TIMED_WORDS', {
      wordCount,
      windowDurationMs: Math.round(observedEndedAtMs - observedStartedAtMs),
    });
    return true;
  }

  #fail(reason) {
    this.#setState('unavailable', reason);
    this.stop({ preserveState: true });
  }

  stop({ preserveState = false } = {}) {
    const wasActive = this.active;
    this.active = false;
    this.generation += 1;
    if (this.stopTimer !== null) this.clearTimeoutFn(this.stopTimer);
    this.stopTimer = null;
    this.requestController?.abort?.();
    this.requestController = null;
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try { recorder.stop(); } catch {}
    }
    this.audioTrack = null;
    this.clock = null;
    this.onTiming = null;
    if (!preserveState) this.#setState('idle', 'LOCAL_TRANSCRIPT_TIMING_IDLE');
    this.onState = null;
    return wasActive;
  }
}
