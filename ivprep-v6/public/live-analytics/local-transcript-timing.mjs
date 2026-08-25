// Genuine local WPM producer for the 3521/3522C Live Analytics Runtime.
//
// The already-admitted AudioWorklet PCM lane supplies bounded in-memory windows.
// Windows travel only to the authenticated same-origin MissionMed endpoint. The
// endpoint runs vendored sherpa-onnx in an isolated Node worker and returns timing
// aggregates only: never transcript text and never persisted audio.

export const LOCAL_TRANSCRIPT_TIMING_SOURCE = 'LOCAL_TIMED_TRANSCRIPT';
export const LOCAL_SHERPA_TIMING_SOURCE = 'LOCAL_SHERPA_ONNX_WORD_TIMESTAMPS';
export const LOCAL_TRANSCRIPT_ENDPOINT = '/api/ivprep-v6/live-analytics/word-timing';

const TARGET_SAMPLE_RATE = 16_000;
const DEFAULT_WINDOW_MS = 10_000;
const MAX_PENDING_WINDOWS = 2;
const WORD_TIMING_RESPONSE_KEYS = Object.freeze([
  'available',
  'providerSessions',
  'rawAudioPersisted',
  'rawTextReturned',
  'source',
  'speechDurationMs',
  'wordCount',
  'words',
]);

function frozenState(state, reason, detail = null) {
  return Object.freeze({ state, reason, ...(detail ? { detail: Object.freeze(detail) } : {}) });
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

export function resamplePcm(samples, sourceRate, targetRate = TARGET_SAMPLE_RATE) {
  if (!(samples instanceof Float32Array)
    || !Number.isFinite(sourceRate) || sourceRate < 8_000 || sourceRate > 192_000
    || !Number.isFinite(targetRate) || targetRate < 8_000 || targetRate > 48_000) {
    throw new TypeError('PCM resampling input is invalid.');
  }
  if (sourceRate === targetRate) return new Float32Array(samples);
  const outputLength = Math.max(1, Math.round(samples.length * targetRate / sourceRate));
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = Math.min(samples.length - 1, index * ratio);
    const left = Math.floor(position);
    const right = Math.min(samples.length - 1, left + 1);
    const mix = position - left;
    output[index] = samples[left] * (1 - mix) + samples[right] * mix;
  }
  return output;
}

export function encodeFloat32Le(samples) {
  if (!(samples instanceof Float32Array) || samples.length === 0) throw new TypeError('PCM samples are required.');
  const buffer = new ArrayBuffer(samples.byteLength);
  const view = new DataView(buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Number(samples[index]);
    if (!Number.isFinite(value)) throw new TypeError('PCM samples must be finite.');
    view.setFloat32(index * 4, clamp(value, -1, 1), true);
  }
  return buffer;
}

export class LocalTranscriptTimingProducer {
  constructor({
    fetchImpl = globalThis.fetch?.bind(globalThis),
    endpoint = LOCAL_TRANSCRIPT_ENDPOINT,
    windowMs = DEFAULT_WINDOW_MS,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.endpoint = endpoint;
    this.windowMs = Math.max(2_000, Math.min(15_000, Number(windowMs) || DEFAULT_WINDOW_MS));
    this.active = false;
    this.generation = 0;
    this.clock = null;
    this.pipeline = null;
    this.csrfToken = null;
    this.onTiming = null;
    this.onState = null;
    this.pendingWindows = 0;
    this.queue = Promise.resolve();
    this.requestController = null;
    this.pcmConsumer = (frame) => this.ingestPcmFrame(frame);
    this.window = null;
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
        || payload?.source !== LOCAL_SHERPA_TIMING_SOURCE
        || payload?.providerSessions !== 0
        || payload?.persistence !== 'MEMORY_ONLY') {
        return publish('unavailable', payload?.reason || 'LOCAL_SHERPA_WORD_TIMING_UNAVAILABLE');
      }
      return publish('ready', 'LOCAL_SHERPA_WORD_TIMING_READY', {
        source: payload.source,
        persistence: payload.persistence,
      });
    } catch {
      return publish('unavailable', 'LOCAL_SHERPA_WORD_TIMING_UNREACHABLE');
    }
  }

  async start({ stream, pipeline, clock, csrfToken, onTiming, onState } = {}) {
    if (this.active) return false;
    const generation = ++this.generation;
    this.onState = typeof onState === 'function' ? onState : null;
    this.onTiming = typeof onTiming === 'function' ? onTiming : null;
    this.clock = clock || null;
    this.pipeline = pipeline || null;
    this.csrfToken = String(csrfToken || '');
    if (!liveAudioTrack(stream)) {
      this.#setState('unavailable', 'LIVE_MICROPHONE_TRACK_REQUIRED');
      return false;
    }
    if (!this.clock?.sessionMs || !this.onTiming) {
      this.#setState('unavailable', 'TRANSCRIPT_TIMING_CONSUMER_REQUIRED');
      return false;
    }
    if (!this.pipeline?.setPcmConsumer) {
      this.#setState('unavailable', 'AUDIO_WORKLET_PCM_CONSUMER_REQUIRED');
      return false;
    }
    if (!/^[A-Za-z0-9_-]{16,256}$/u.test(this.csrfToken)) {
      this.#setState('unavailable', 'AUTHENTICATED_MUTATION_CSRF_REQUIRED');
      return false;
    }
    const capability = await this.probe({ generation });
    if (generation !== this.generation || capability.state !== 'ready') return false;
    this.window = null;
    this.active = true;
    this.pipeline.setPcmConsumer(this.pcmConsumer);
    this.#setState('live', 'LOCAL_SHERPA_WORD_TIMING_LIVE', capability.detail);
    return true;
  }

  ingestPcmFrame(frame = {}) {
    if (!this.active || !(frame.samples instanceof Float32Array)) return false;
    const sampleRate = Number(frame.sampleRate);
    const atMs = Number(frame.atMs);
    if (!Number.isFinite(sampleRate) || sampleRate < 8_000 || sampleRate > 192_000 || !Number.isFinite(atMs)) return false;
    const durationMs = frame.samples.length / sampleRate * 1_000;
    if (!(durationMs > 0 && durationMs <= 250)) return false;

    if (!this.window || this.window.sampleRate !== sampleRate
      || atMs < this.window.lastAtMs
      || atMs - this.window.lastAtMs > Math.max(750, durationMs * 4)) {
      this.window = {
        sampleRate,
        startedAtMs: atMs,
        lastAtMs: atMs,
        durationMs: 0,
        speechDurationMs: 0,
        sampleCount: 0,
        chunks: [],
      };
    }
    const copy = new Float32Array(frame.samples);
    this.window.chunks.push(copy);
    this.window.sampleCount += copy.length;
    this.window.durationMs += durationMs;
    this.window.lastAtMs = atMs;
    if (frame.speaking === true) this.window.speechDurationMs += durationMs;
    if (this.window.durationMs >= this.windowMs) this.flush();
    return true;
  }

  flush() {
    const window = this.window;
    this.window = null;
    if (!window || window.sampleCount === 0) return false;
    const joined = new Float32Array(window.sampleCount);
    let offset = 0;
    for (const chunk of window.chunks) {
      joined.set(chunk, offset);
      chunk.fill(0);
      offset += chunk.length;
    }
    const pcm = resamplePcm(joined, window.sampleRate);
    joined.fill(0);
    const endedAtMs = window.startedAtMs + window.durationMs;
    const coverage = clamp(window.speechDurationMs / window.durationMs, 0, 1);
    if (window.speechDurationMs < 3_000) {
      pcm.fill(0);
      this.#setState('live', 'NEED_MORE_SPEECH_TIME', { speechDurationMs: Math.round(window.speechDurationMs) });
      return false;
    }
    return this.#enqueueWindow({
      pcm,
      windowStartedAtMs: window.startedAtMs,
      windowEndedAtMs: endedAtMs,
      speechDurationMs: window.speechDurationMs,
      coverage,
      generation: this.generation,
    });
  }

  #enqueueWindow(window) {
    if (this.pendingWindows >= MAX_PENDING_WINDOWS) {
      window.pcm.fill(0);
      this.#setState('partial', 'LOCAL_TRANSCRIPT_BACKPRESSURE');
      return false;
    }
    this.pendingWindows += 1;
    this.queue = this.queue
      .then(() => this.#transcribeWindow(window))
      .catch(() => {
        if (this.active && window.generation === this.generation) this.#setState('partial', 'LOCAL_TRANSCRIPT_WINDOW_FAILED');
      })
      .finally(() => {
        window.pcm.fill(0);
        this.pendingWindows = Math.max(0, this.pendingWindows - 1);
      });
    return true;
  }

  async #transcribeWindow({
    pcm,
    windowStartedAtMs,
    windowEndedAtMs,
    speechDurationMs,
    coverage,
    generation,
  }) {
    if (!this.active || generation !== this.generation) return false;
    const controller = new AbortController();
    this.requestController = controller;
    const body = encodeFloat32Le(pcm);
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      body,
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/vnd.missionmed.pcm-f32le',
        'X-MMHQ-CSRF': this.csrfToken,
        'X-IVPrep-Sample-Rate': String(TARGET_SAMPLE_RATE),
        'X-IVPrep-Speech-Duration-Ms': String(Math.round(speechDurationMs)),
      },
    });
    const payload = await response.json();
    if (!this.active || generation !== this.generation) return false;
    const responseKeys = payload && typeof payload === 'object' ? Object.keys(payload).sort() : [];
    if (!response.ok
      || responseKeys.length !== WORD_TIMING_RESPONSE_KEYS.length
      || responseKeys.some((key, index) => key !== WORD_TIMING_RESPONSE_KEYS[index])
      || payload?.available !== true
      || payload?.source !== LOCAL_SHERPA_TIMING_SOURCE
      || payload?.providerSessions !== 0
      || payload?.rawTextReturned !== false
      || payload?.rawAudioPersisted !== false) {
      this.#setState('partial', payload?.reason || 'LOCAL_TRANSCRIPT_WINDOW_REJECTED');
      return false;
    }
    const wordCount = Number.isInteger(payload.wordCount) ? payload.wordCount : null;
    const captureDurationMs = windowEndedAtMs - windowStartedAtMs;
    const observedSpeechDurationMs = finite(payload.speechDurationMs);
    const words = Array.isArray(payload.words) ? payload.words.map((word) => ({
      startMs: windowStartedAtMs + Number(word?.startMs),
      endMs: windowStartedAtMs + Number(word?.endMs),
      probability: word?.probability === null ? null : Number(word?.probability),
    })) : null;
    const validWords = Array.isArray(words)
      && words.length === wordCount
      && words.every((word, index) => Number.isFinite(word.startMs)
        && word.startMs >= windowStartedAtMs
        && Number.isFinite(word.endMs)
        && word.endMs > word.startMs
        && word.endMs <= windowEndedAtMs + 25
        && (word.probability === null || (Number.isFinite(word.probability) && word.probability >= 0 && word.probability <= 1))
        && (index === 0 || word.startMs >= words[index - 1].startMs));
    if (wordCount === null || wordCount < 0 || captureDurationMs <= 0
      || observedSpeechDurationMs === null || observedSpeechDurationMs < 0
      || observedSpeechDurationMs > captureDurationMs + 25 || !validWords) {
      this.#setState('partial', 'INVALID_LOCAL_WORD_TIMING');
      return false;
    }
    const atMs = Math.max(windowEndedAtMs, Number(this.clock.sessionMs()));
    this.onTiming(Object.freeze({
      atMs,
      windowStartedAtMs,
      windowEndedAtMs,
      speechDurationMs: observedSpeechDurationMs,
      coverage,
      words: Object.freeze(words.map((word) => Object.freeze(word))),
      wordCount,
      provenance: Object.freeze({
        kind: 'OBSERVED_TRANSCRIPT_TIMING',
        observed: true,
        tier: 'A_PRIME',
        wordTimestampsValidated: true,
        source: LOCAL_TRANSCRIPT_TIMING_SOURCE,
        engine: 'SHERPA_ONNX_1.13.6_LOCAL_WASM',
        transport: 'SAME_ORIGIN_AUTHENTICATED',
        rawTextRetained: false,
        rawAudioPersisted: false,
      }),
    }));
    this.#setState('live', wordCount >= 8 ? 'LOCAL_TRANSCRIPT_TIMING_OBSERVED' : 'NEED_MORE_TIMED_WORDS', {
      wordCount,
      windowDurationMs: Math.round(captureDurationMs),
    });
    return true;
  }

  stop({ preserveState = false } = {}) {
    const wasActive = this.active;
    this.active = false;
    this.generation += 1;
    this.requestController?.abort?.();
    this.requestController = null;
    this.pipeline?.setPcmConsumer?.(null);
    if (this.window) {
      for (const chunk of this.window.chunks) chunk.fill(0);
    }
    this.window = null;
    this.pipeline = null;
    this.clock = null;
    this.csrfToken = null;
    this.onTiming = null;
    if (!preserveState) this.#setState('idle', 'LOCAL_TRANSCRIPT_TIMING_IDLE');
    this.onState = null;
    return wasActive;
  }
}
