// Genuine private WPM producer for the 3521/3522C Live Analytics Runtime.
//
// The already-admitted AudioWorklet PCM lane supplies bounded in-memory windows.
// Windows travel only to the authenticated, exact same-origin MissionMed endpoint.
// On loopback this stays on the physical Mac; on a secure hosted origin it reaches
// the first-party MissionMed process serving the page. The endpoint runs vendored
// sherpa-onnx in an isolated Node worker and returns timing aggregates only: never
// transcript text and never persisted audio.

import { WordEventStream } from './word-stream.mjs';

export const LOCAL_TRANSCRIPT_TIMING_SOURCE = 'LOCAL_TIMED_TRANSCRIPT';
export const FIRST_PARTY_TRANSCRIPT_TIMING_SOURCE = 'FIRST_PARTY_TIMED_TRANSCRIPT';
export const LOCAL_SHERPA_TIMING_SOURCE = 'LOCAL_SHERPA_ONNX_WORD_TIMESTAMPS';
export const LOCAL_TRANSCRIPT_ENDPOINT = '/api/ivprep-v6/live-analytics/word-timing';
export const LOOPBACK_WORD_TIMING_TRANSPORT = 'ON_DEVICE_LOOPBACK';
export const FIRST_PARTY_WORD_TIMING_TRANSPORT = 'FIRST_PARTY_SAME_ORIGIN_EPHEMERAL';

const TARGET_SAMPLE_RATE = 16_000;
// A two-second rolling acoustic window is the smallest admitted physical lane.
// It reports only words the recognizer actually timestamped; it never estimates
// or extrapolates words between decodes. Slow speech may borrow the immediately
// preceding window to reach the realtime evidence floor.
const DEFAULT_WINDOW_MS = 2_000;
const MAX_PENDING_WINDOWS = 2;
const MINIMUM_ACOUSTIC_EVIDENCE_MS = 500;
const MINIMUM_VOICED_SPEECH_PROBABILITY = 0.35;
const MINIMUM_WORD_PROBABILITY = 0.35;
const MAXIMUM_PLAUSIBLE_WPM = 360;
const MAXIMUM_RECENT_TIMING_WINDOWS = 2;
const MINIMUM_LIVE_WORDS = 4;
const MINIMUM_LIVE_SPEECH_MS = 1_500;
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

function admittedWordTimingEndpoint(endpoint, locationHref) {
  try {
    const page = new URL(String(locationHref || ''));
    const target = new URL(String(endpoint || ''), page);
    const loopback = (hostname) => ['127.0.0.1', 'localhost', '[::1]'].includes(hostname.toLowerCase());
    const pageIsLoopback = loopback(page.hostname);
    const admittedProtocol = pageIsLoopback
      ? ['http:', 'https:'].includes(page.protocol)
      : page.protocol === 'https:';
    return admittedProtocol
      && target.protocol === page.protocol
      && target.origin === page.origin
      && target.pathname === LOCAL_TRANSCRIPT_ENDPOINT
      && target.search === ''
      && target.hash === ''
      && target.username === ''
      && target.password === ''
      ? Object.freeze({
        url: target.href,
        transport: pageIsLoopback ? LOOPBACK_WORD_TIMING_TRANSPORT : FIRST_PARTY_WORD_TIMING_TRANSPORT,
      })
      : null;
  } catch {
    return null;
  }
}

export function timedWordOccupancyMs(words = []) {
  if (!Array.isArray(words) || words.length === 0) return 0;
  let total = 0;
  let openStart = null;
  let openEnd = null;
  for (const word of words) {
    const start = finite(word?.startMs);
    const end = finite(word?.endMs);
    if (start === null || end === null || end <= start) return 0;
    if (openStart === null) {
      openStart = start;
      openEnd = end;
    } else if (start <= openEnd) {
      openEnd = Math.max(openEnd, end);
    } else {
      total += openEnd - openStart;
      openStart = start;
      openEnd = end;
    }
  }
  return total + (openStart === null ? 0 : openEnd - openStart);
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
  #admittedEndpoint = null;
  #transport = null;

  constructor({
    fetchImpl = globalThis.fetch?.bind(globalThis),
    endpoint = LOCAL_TRANSCRIPT_ENDPOINT,
    windowMs = DEFAULT_WINDOW_MS,
    locationHref = globalThis.location?.href || 'http://127.0.0.1/',
    setTimeoutImpl = globalThis.setTimeout?.bind(globalThis),
    clearTimeoutImpl = globalThis.clearTimeout?.bind(globalThis),
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.endpoint = String(endpoint || '');
    this.windowMs = Math.max(2_000, Math.min(15_000, Number(windowMs) || DEFAULT_WINDOW_MS));
    this.locationHref = String(locationHref || '');
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
    this.wordStream = new WordEventStream();
    this.timingWindows = [];
    this.lastProgressMs = 0;
    this.pcmFramesReceived = 0;
    this.captureWatchdog = null;
    this.setTimeoutImpl = setTimeoutImpl;
    this.clearTimeoutImpl = clearTimeoutImpl;
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
    const admission = this.#admittedEndpoint
      ? Object.freeze({ url: this.#admittedEndpoint, transport: this.#transport })
      : admittedWordTimingEndpoint(this.endpoint, this.locationHref);
    if (!admission) return publish('unavailable', 'WORD_TIMING_SAME_ORIGIN_REQUIRED');
    try {
      const response = await this.fetchImpl(`${admission.url}/status`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        redirect: 'error',
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
        transport: admission.transport,
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
    // The only remote form admitted is the exact HTTPS same-origin MissionMed
    // route already protected by the product session and CSRF contract. Cross-
    // origin endpoints, insecure hosted pages, redirects and query forwarding
    // remain impossible. The first-party server retains neither PCM nor text.
    const admission = admittedWordTimingEndpoint(this.endpoint, this.locationHref);
    if (!admission) {
      this.#setState('unavailable', 'WORD_TIMING_SAME_ORIGIN_REQUIRED');
      return false;
    }
    this.#admittedEndpoint = admission.url;
    this.#transport = admission.transport;
    const capability = await this.probe({ generation });
    if (generation !== this.generation || capability.state !== 'ready') return false;
    this.window = null;
    this.lastProgressMs = 0;
    this.wordStream.reset();
    this.timingWindows = [];
    this.pcmFramesReceived = 0;
    this.active = true;
    this.pipeline.setPcmConsumer(this.pcmConsumer);
    this.#setState('live', 'LOCAL_SHERPA_WORD_TIMING_LIVE', capability.detail);
    if (typeof this.setTimeoutImpl === 'function') {
      this.captureWatchdog = this.setTimeoutImpl(() => {
        if (this.active && generation === this.generation && this.pcmFramesReceived === 0) {
          this.#setState('partial', 'MICROPHONE_PCM_CAPTURE_STALLED');
        }
      }, 6_000);
    }
    return true;
  }

  ingestPcmFrame(frame = {}) {
    if (!this.active || !(frame.samples instanceof Float32Array)) return false;
    const sampleRate = Number(frame.sampleRate);
    const atMs = Number(frame.atMs);
    if (!Number.isFinite(sampleRate) || sampleRate < 8_000 || sampleRate > 192_000 || !Number.isFinite(atMs)) return false;
    const durationMs = frame.samples.length / sampleRate * 1_000;
    if (!(durationMs > 0 && durationMs <= 250)) return false;
    this.pcmFramesReceived += 1;
    if (this.captureWatchdog !== null) {
      this.clearTimeoutImpl?.(this.captureWatchdog);
      this.captureWatchdog = null;
    }

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
    // Silero's admitted state is sufficient. A periodic F0 may supplement a
    // late state transition only when the same frame also carries meaningful
    // Silero speech probability; a tone by itself is never treated as speech.
    const softSpeechEvidence = frame.voiced === true
      && Number.isFinite(frame.speechProbability)
      && frame.speechProbability >= MINIMUM_VOICED_SPEECH_PROBABILITY;
    if (frame.speaking === true || softSpeechEvidence) this.window.speechDurationMs += durationMs;
    const progressMs = Math.min(this.windowMs, this.window.durationMs);
    if (progressMs < this.windowMs && progressMs - this.lastProgressMs >= 1_000) {
      this.lastProgressMs = progressMs;
      this.#setState('live', 'COLLECTING_TIMED_WORD_WINDOW', {
        captureDurationMs: Math.round(progressMs),
        requiredDurationMs: this.windowMs,
      });
    }
    if (this.window.durationMs >= this.windowMs) this.flush();
    return true;
  }

  flush() {
    const window = this.window;
    this.window = null;
    this.lastProgressMs = 0;
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
    // Do not require the VAD/F0 prefilter itself to prove the full three-second
    // WPM acceptance contract. Its only job is to keep pure-silence windows out
    // of the local recognizer. Sherpa's returned word timestamps adjudicate the
    // real speech duration and coverage below.
    if (window.speechDurationMs < MINIMUM_ACOUSTIC_EVIDENCE_MS) {
      pcm.fill(0);
      this.#setState('live', 'NEED_MORE_SPEECH_TIME', {
        speechDurationMs: Math.round(window.speechDurationMs),
        minimumAcousticEvidenceMs: MINIMUM_ACOUSTIC_EVIDENCE_MS,
      });
      return false;
    }
    this.#setState('live', 'DECODING_TIMED_WORD_WINDOW', {
      captureDurationMs: Math.round(window.durationMs),
      speechDurationMs: Math.round(window.speechDurationMs),
    });
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
    try {
      const response = await this.fetchImpl(this.#admittedEndpoint, {
      method: 'POST',
      body,
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
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
        && (index === 0 || word.startMs >= words[index - 1].endMs));
    if (wordCount === null || wordCount < 0 || captureDurationMs <= 0
      || observedSpeechDurationMs === null || observedSpeechDurationMs < 0
      || observedSpeechDurationMs > captureDurationMs + 25 || !validWords) {
      this.#setState('partial', 'INVALID_LOCAL_WORD_TIMING');
      return false;
    }
    // Low-confidence tokens cannot satisfy WPM gates. The threshold is below
    // the weakest word in the admitted acoustic preflight (0.5312) while still
    // rejecting zero/very-low-confidence decoder output. Count only the union
    // of the recognizer's occupied word intervals. The
    // silence between separated words or episodes is deliberately excluded.
    // Taking the maximum with acoustic evidence avoids double-counting their
    // overlap while allowing genuine timed-word occupancy to correct VAD lag.
    const confidentWords = words.filter((word) => Number.isFinite(word.probability)
      && word.probability >= MINIMUM_WORD_PROBABILITY);
    const timedSpeechDurationMs = clamp(timedWordOccupancyMs(confidentWords), 0, captureDurationMs);
    const admittedSpeechDurationMs = Math.max(observedSpeechDurationMs, timedSpeechDurationMs);
    const timedWordsPerMinute = admittedSpeechDurationMs > 0
      ? confidentWords.length / (admittedSpeechDurationMs / 60_000)
      : 0;
    if (timedWordsPerMinute > MAXIMUM_PLAUSIBLE_WPM) {
      this.#setState('partial', 'IMPLAUSIBLE_LOCAL_WORD_TIMING');
      return false;
    }
    const admittedCoverage = Math.max(coverage, clamp(timedSpeechDurationMs / captureDurationMs, 0, 1));
    const atMs = Math.max(windowEndedAtMs, Number(this.clock.sessionMs()));
    const firstParty = this.#transport === FIRST_PARTY_WORD_TIMING_TRANSPORT;
    this.wordStream.ingest(confidentWords, { atMs, source: LOCAL_SHERPA_TIMING_SOURCE });
    this.timingWindows.push(Object.freeze({
      startedAtMs: windowStartedAtMs,
      endedAtMs: windowEndedAtMs,
      speechDurationMs: admittedSpeechDurationMs,
      captureDurationMs,
      coverage: admittedCoverage,
    }));
    if (this.timingWindows.length > MAXIMUM_RECENT_TIMING_WINDOWS) this.timingWindows.shift();

    // Select the smallest recent suffix that satisfies the realtime evidence
    // floor. A normal or fast two-second window updates immediately, while
    // genuine slow speech may borrow only the immediately preceding window.
    // Old speech can therefore never dilute the live reading beyond four seconds.
    const streamEvents = this.wordStream.snapshot().events;
    let selectedWindows = [];
    let streamWords = [];
    let streamSpeechDurationMs = 0;
    let streamCaptureDurationMs = 0;
    for (let index = this.timingWindows.length - 1; index >= 0; index -= 1) {
      selectedWindows = [this.timingWindows[index], ...selectedWindows];
      const firstWindow = selectedWindows[0];
      streamWords = streamEvents
        .filter((word) => word.startMs >= firstWindow.startedAtMs && word.endMs <= windowEndedAtMs + 25);
      streamSpeechDurationMs = selectedWindows.reduce((sum, item) => sum + item.speechDurationMs, 0);
      streamCaptureDurationMs = selectedWindows.reduce((sum, item) => sum + item.captureDurationMs, 0);
      if (streamWords.length >= MINIMUM_LIVE_WORDS && streamSpeechDurationMs >= MINIMUM_LIVE_SPEECH_MS) break;
    }
    const firstWindow = selectedWindows[0] || Object.freeze({ startedAtMs: windowStartedAtMs });
    const streamCoverage = streamCaptureDurationMs > 0
      ? clamp(selectedWindows.reduce((sum, item) => sum + item.coverage * item.captureDurationMs, 0) / streamCaptureDurationMs, 0, 1)
      : admittedCoverage;
    const recentEvidenceAvailable = streamWords.length >= MINIMUM_LIVE_WORDS
      && streamSpeechDurationMs >= MINIMUM_LIVE_SPEECH_MS;
    this.onTiming(Object.freeze({
      atMs,
      cadence: 'REALTIME_ROLLING',
      windowStartedAtMs: firstWindow.startedAtMs,
      windowEndedAtMs,
      speechDurationMs: streamSpeechDurationMs,
      coverage: streamCoverage,
      words: Object.freeze(streamWords.map((word) => Object.freeze({
        startMs: word.startMs,
        endMs: word.endMs,
        probability: word.probability,
      }))),
      wordCount: streamWords.length,
      provenance: Object.freeze({
        kind: 'OBSERVED_TRANSCRIPT_TIMING',
        observed: true,
        tier: firstParty ? 'B' : 'A_PRIME',
        wordTimestampsObserved: true,
        timingAccuracyValidated: false,
        source: firstParty ? FIRST_PARTY_TRANSCRIPT_TIMING_SOURCE : LOCAL_TRANSCRIPT_TIMING_SOURCE,
        engine: 'SHERPA_ONNX_1.13.6_WASM',
        transport: this.#transport,
        rawTextRetained: false,
        rawAudioPersisted: false,
      }),
    }));
    this.#setState('live', recentEvidenceAvailable ? 'LOCAL_TRANSCRIPT_TIMING_OBSERVED' : 'NEED_MORE_TIMED_WORDS', {
      wordCount: streamWords.length,
      windowDurationMs: Math.round(windowEndedAtMs - firstWindow.startedAtMs),
    });
      return true;
    } finally {
      new Uint8Array(body).fill(0);
    }
  }

  stop({ preserveState = false } = {}) {
    const wasActive = this.active;
    this.active = false;
    this.generation += 1;
    this.requestController?.abort?.();
    this.requestController = null;
    if (this.captureWatchdog !== null) this.clearTimeoutImpl?.(this.captureWatchdog);
    this.captureWatchdog = null;
    this.pipeline?.setPcmConsumer?.(null);
    if (this.window) {
      for (const chunk of this.window.chunks) chunk.fill(0);
    }
    this.window = null;
    this.lastProgressMs = 0;
    this.pcmFramesReceived = 0;
    this.wordStream.reset();
    this.timingWindows = [];
    this.pipeline = null;
    this.clock = null;
    this.csrfToken = null;
    this.#admittedEndpoint = null;
    this.#transport = null;
    this.onTiming = null;
    if (!preserveState) this.#setState('idle', 'LOCAL_TRANSCRIPT_TIMING_IDLE');
    this.onState = null;
    return wasActive;
  }
}
