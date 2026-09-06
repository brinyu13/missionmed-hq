// IV Prep On-Call — one persistent, local-only media and analytics lifecycle.
//
// Capture is intentionally independent from presentation. Opening or closing a HUD
// calls setPresentationVisibility(), which changes one boolean and nothing else. The
// only paths that acquire hardware are requestMedia() and replaceTrack().

import { BrowserAnalyticsPipeline } from '../analytics/browser-pipeline.mjs';

const EMPTY_MEDIA = Object.freeze({
  cam: false,
  mic: false,
  stream: null,
  cameraTrack: null,
  microphoneTrack: null,
  AC: null,
  analyser: null,
  data: null,
});

function abortError() {
  const error = new Error('The media lifecycle changed before capture completed.');
  error.name = 'AbortError';
  return error;
}

function defaultGetUserMedia(constraints) {
  const devices = globalThis.navigator?.mediaDevices;
  if (!devices?.getUserMedia) throw new Error('Browser media capture is unavailable.');
  return devices.getUserMedia(constraints);
}

function defaultAudioContextFactory() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function defaultPipelineFactory({ bridge, now }) {
  return new BrowserAnalyticsPipeline({ bridge, now });
}

function tracks(stream) {
  const value = stream?.getTracks?.();
  if (!Array.isArray(value)) throw new TypeError('A MediaStream-like object is required.');
  return value;
}

function liveTrack(stream, kind) {
  return tracks(stream).find((track) => track?.kind === kind && track.readyState !== 'ended') || null;
}

function stopPromiseRejection(promise) {
  if (promise && typeof promise.catch === 'function') void promise.catch(() => {});
}

function frozenTrackReadiness(track, { graphReady = true } = {}) {
  const present = Boolean(track);
  const readyState = present ? String(track.readyState || 'unknown') : 'absent';
  const enabled = present && track.enabled !== false;
  const muted = present && track.muted === true;
  const live = present && readyState === 'live';
  const ready = live && enabled && !muted && graphReady;
  let reason = 'READY';
  if (!present) reason = 'ABSENT';
  else if (!live) reason = readyState === 'ended' ? 'ENDED' : 'NOT_LIVE';
  else if (!enabled) reason = 'DISABLED';
  else if (muted) reason = 'MUTED';
  else if (!graphReady) reason = 'AUDIO_GRAPH_NOT_READY';
  return Object.freeze({ present, readyState, enabled, muted, live, graphReady, ready, reason });
}

function normalizeCaptureOptions(options, legacyVideo) {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    return { audio: options !== false, video: legacyVideo !== false };
  }

  const audio = options.audio === undefined ? true : options.audio;
  const video = options.video === undefined ? true : options.video;
  return { audio, video };
}

/**
 * Owns one persistent browser capture and one BrowserAnalyticsPipeline.
 *
 * Dependencies are injectable so lifecycle behavior can be proved without granting
 * camera/microphone permission. No method in this class contacts a provider, stores
 * raw media, or performs network I/O.
 */
export class LiveAnalyticsMediaBridge {
  constructor({
    getUserMedia = defaultGetUserMedia,
    audioContextFactory = defaultAudioContextFactory,
    pipelineFactory = defaultPipelineFactory,
    mediaDevices = globalThis.navigator?.mediaDevices || null,
    now = () => performance.now(),
  } = {}) {
    if (typeof getUserMedia !== 'function') throw new TypeError('getUserMedia must be a function.');
    if (typeof audioContextFactory !== 'function') throw new TypeError('audioContextFactory must be a function.');
    if (typeof pipelineFactory !== 'function') throw new TypeError('pipelineFactory must be a function.');
    if (typeof now !== 'function') throw new TypeError('now must be a function.');

    this._getUserMedia = getUserMedia;
    this._audioContextFactory = audioContextFactory;
    this._pipelineFactory = pipelineFactory;
    this._mediaDevices = mediaDevices;
    this._now = now;
    this._media = EMPTY_MEDIA;
    this._audioContext = null;
    this._source = null;
    this._sink = null;
    this._ownedTracks = new Set();
    this._stoppedTracks = new WeakSet();
    this._pipeline = null;
    this._sessionClock = null;
    this._presentationVisible = true;
    this._lifecycleEpoch = 0;
    this._operations = Promise.resolve();
    this._eventListeners = new Map();
    this._observedTrackListeners = new Map();
    this._deviceChangeListening = false;
    this._readinessRevision = 0;
    this._deviceChangeRevision = 0;
    this._lastReadinessReason = 'initial';
    this._boundDeviceChange = () => {
      if (this._deviceChangeListening) this._publishReadiness('devicechange', { deviceChange: true });
    };
  }

  get media() { return this._media; }
  get audioContext() { return this._audioContext; }
  get source() { return this._source; }
  get sink() { return this._sink; }
  get analyticsPipeline() { return this._pipeline; }
  get presentationVisible() { return this._presentationVisible; }
  get ownsStream() { return this._ownedTracks.size > 0; }
  get readiness() { return this.readinessSnapshot(); }

  addEventListener(type, listener) {
    if (!listener || (typeof listener !== 'function' && typeof listener.handleEvent !== 'function')) return;
    const name = String(type || '');
    if (!name) return;
    if (!this._eventListeners.has(name)) this._eventListeners.set(name, new Set());
    this._eventListeners.get(name).add(listener);
  }

  removeEventListener(type, listener) {
    const listeners = this._eventListeners.get(String(type || ''));
    listeners?.delete(listener);
    if (listeners?.size === 0) this._eventListeners.delete(String(type || ''));
  }

  /**
   * Current derived hardware readiness. Unlike the immutable media identity snapshot,
   * this reads each track's live properties at call time and therefore reflects mute,
   * end, disable, and AudioContext/graph loss without reacquiring media.
   */
  readinessSnapshot() {
    const media = this._media;
    const audioGraphReady = Boolean(media.AC?.state === 'running' && media.analyser && media.data);
    const camera = frozenTrackReadiness(media.cameraTrack);
    const microphone = frozenTrackReadiness(media.microphoneTrack, { graphReady: audioGraphReady });
    return Object.freeze({
      revision: this._readinessRevision,
      reason: this._lastReadinessReason,
      streamPresent: Boolean(media.stream),
      camera,
      microphone,
      anyReady: camera.ready || microphone.ready,
      fullyReady: camera.ready && microphone.ready,
      audioContextState: media.AC?.state || 'absent',
      deviceChangeRevision: this._deviceChangeRevision,
    });
  }

  /**
   * This method must be called synchronously from the camera/microphone gesture.
   * resume() is deliberately invoked before any getUserMedia await. WebKit does not
   * carry user activation across that await.
   */
  primeAudioContext() {
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = this._audioContextFactory();
    }
    const context = this._audioContext;
    if (context && context.state !== 'running') {
      try { stopPromiseRejection(context.resume?.()); } catch { /* surfaced as suspended readiness */ }
    }
    return context;
  }

  /** Presentation state is not capture state. This method performs no lifecycle I/O. */
  setPresentationVisibility(visible) {
    this._presentationVisible = Boolean(visible);
    return this._presentationVisible;
  }

  /** Alias used by drawer/surface adapters. */
  setTelemetryVisible(visible) {
    return this.setPresentationVisibility(visible);
  }

  /**
   * Request a new owned stream. AudioContext priming happens synchronously, before
   * the queued operation and before getUserMedia settles.
   */
  requestMedia(options = true, legacyVideo = true) {
    const capture = normalizeCaptureOptions(options, legacyVideo);
    if (capture.audio !== false) this.primeAudioContext();
    const epoch = this._lifecycleEpoch;

    return this._enqueue(async () => {
      this._assertEpoch(epoch);
      const stream = await this._getUserMedia(capture);
      try {
        this._assertEpoch(epoch);
        return this._adoptStream(stream, { ownsStream: true });
      } catch (error) {
        this._stopTracks(tracks(stream));
        throw error;
      }
    });
  }

  /**
   * Adopt a supplied local stream. The caller can retain track ownership by passing
   * ownsStream:false; requestMedia() always gives the bridge ownership.
   */
  bindStream(stream, { ownsStream = true } = {}) {
    if (tracks(stream).some((track) => track?.kind === 'audio' && track.readyState !== 'ended')) {
      this.primeAudioContext();
    }
    const epoch = this._lifecycleEpoch;
    return this._enqueue(() => {
      try {
        this._assertEpoch(epoch);
        return this._adoptStream(stream, { ownsStream: Boolean(ownsStream) });
      } catch (error) {
        if (ownsStream && stream !== this._media.stream) this._stopTracks(tracks(stream));
        throw error;
      }
    });
  }

  /**
   * Replace one device without rebuilding the session, pipeline, clock, or other
   * device. The outgoing track is removed and stopped after the replacement is live.
   */
  replaceTrack(kind, deviceId) {
    const trackKind = kind === 'microphone' ? 'audio' : kind === 'camera' ? 'video' : kind;
    if (trackKind !== 'audio' && trackKind !== 'video') throw new TypeError('Device kind must be audio/video or microphone/camera.');
    const id = String(deviceId || '').trim();
    if (!id) throw new TypeError('deviceId is required.');
    if (trackKind === 'audio') this.primeAudioContext();
    const epoch = this._lifecycleEpoch;
    const constraints = trackKind === 'audio'
      ? { audio: { deviceId: { exact: id } }, video: false }
      : { audio: false, video: { deviceId: { exact: id } } };

    return this._enqueue(async () => {
      this._assertEpoch(epoch);
      const fresh = await this._getUserMedia(constraints);
      try {
        this._assertEpoch(epoch);
        return this._installReplacement(trackKind, fresh);
      } catch (error) {
        this._stopTracks(tracks(fresh));
        throw error;
      }
    });
  }

  switchDevice(kind, deviceId) {
    return this.replaceTrack(kind, deviceId);
  }

  ensureAnalytics() {
    if (!this._pipeline) {
      this._pipeline = this._pipelineFactory({ bridge: this, now: this._now });
      if (!this._pipeline || typeof this._pipeline.beginAnswer !== 'function') {
        this._pipeline = null;
        throw new TypeError('pipelineFactory must return an analytics pipeline.');
      }
    }
    this._bindSessionClock(this._pipeline);
    return this._pipeline;
  }

  get sessionClock() {
    this.ensureAnalytics();
    return this._sessionClock;
  }

  startAnalytics(options = {}) {
    return this.ensureAnalytics().beginAnswer(options);
  }

  endAnalytics(options = {}) {
    return this._pipeline?.endAnswer?.(options) ?? null;
  }

  stopAnalytics() {
    const pipeline = this._pipeline;
    if (!pipeline) return false;
    this._pipeline = null;
    this._sessionClock = null;
    pipeline.destroy?.();
    return true;
  }

  /**
   * Explicit teardown. It is synchronous from the caller's perspective: published
   * media is empty and all owned tracks are stopped before this method returns. A late
   * getUserMedia resolution is fenced by lifecycleEpoch and cleaned up on arrival.
   */
  stopMedia({ keepContext = false, keepAnalytics = false } = {}) {
    this._lifecycleEpoch += 1;
    if (!keepAnalytics) this.stopAnalytics();
    this._clearTrackObservation();
    this._stopDeviceObservation();
    this._disconnectGraph(this._source, this._media.analyser, this._sink);
    this._source = null;
    this._sink = null;
    this._stopTracks(this._ownedTracks);
    this._ownedTracks.clear();
    this._media = EMPTY_MEDIA;

    if (!keepContext) {
      const context = this._audioContext;
      this._audioContext = null;
      if (context && context.state !== 'closed') {
        try { stopPromiseRejection(context.close?.()); } catch { /* already locally released */ }
      }
    }
    this._publishReadiness('media-stopped');
    return true;
  }

  stop(options) { return this.stopMedia(options); }
  destroy() {
    const stopped = this.stopMedia();
    this._eventListeners.clear();
    return stopped;
  }

  _enqueue(operation) {
    const run = this._operations.then(operation, operation);
    this._operations = run.catch(() => {});
    return run;
  }

  _assertEpoch(epoch) {
    if (epoch !== this._lifecycleEpoch) throw abortError();
  }

  _bindSessionClock(pipeline) {
    const session = typeof pipeline.ensureSession === 'function' ? pipeline.ensureSession() : pipeline.session;
    const clock = pipeline.sessionClock || session?.clock;
    if (!clock) throw new TypeError('The analytics pipeline must expose one session clock.');
    if (this._sessionClock && this._sessionClock !== clock) {
      throw new Error('The analytics pipeline attempted to replace the active session clock.');
    }
    this._sessionClock = clock;
  }

  _adoptStream(stream, { ownsStream }) {
    const allTracks = tracks(stream);
    const cameraTrack = liveTrack(stream, 'video');
    const microphoneTrack = liveTrack(stream, 'audio');
    if (!cameraTrack && !microphoneTrack) throw new Error('The stream contains no live camera or microphone track.');

    if (stream === this._media.stream
      && cameraTrack === this._media.cameraTrack
      && microphoneTrack === this._media.microphoneTrack) {
      if (ownsStream) for (const track of [cameraTrack, microphoneTrack]) if (track) this._ownedTracks.add(track);
      this._observeTracks(cameraTrack, microphoneTrack);
      this._startDeviceObservation();
      this._publishReadiness('media-reused');
      return this._media;
    }

    const selected = new Set([cameraTrack, microphoneTrack].filter(Boolean));
    for (const track of allTracks) {
      if (selected.has(track)) continue;
      try { stream.removeTrack?.(track); } catch {}
      if (ownsStream) this._stopTrack(track);
    }

    const graph = this._buildAudioGraph(stream, microphoneTrack);
    const priorMedia = this._media;
    const priorSource = this._source;
    const priorSink = this._sink;
    const priorAnalyser = priorMedia.analyser;
    const priorOwned = this._ownedTracks;

    this._source = graph.source;
    this._sink = graph.sink;
    this._media = this._mediaSnapshot(stream, cameraTrack, microphoneTrack, graph);
    this._ownedTracks = ownsStream ? new Set(selected) : new Set();
    this._observeTracks(cameraTrack, microphoneTrack);
    this._startDeviceObservation();

    this._disconnectGraph(priorSource, priorAnalyser, priorSink);
    for (const track of priorOwned) if (!selected.has(track)) this._stopTrack(track);
    this._publishReadiness('media-adopted');
    return this._media;
  }

  _installReplacement(kind, fresh) {
    const incoming = liveTrack(fresh, kind);
    if (!incoming) throw new Error(`No live ${kind} track was returned.`);
    for (const track of tracks(fresh)) if (track !== incoming) this._stopTrack(track);

    const stream = this._media.stream;
    if (!stream) return this._adoptStream(fresh, { ownsStream: true });
    if (typeof stream.removeTrack !== 'function' || typeof stream.addTrack !== 'function') {
      throw new TypeError('The active MediaStream cannot replace tracks in place.');
    }

    const outgoing = kind === 'audio' ? this._media.microphoneTrack : this._media.cameraTrack;
    if (outgoing) stream.removeTrack(outgoing);
    stream.addTrack(incoming);

    const cameraTrack = kind === 'video' ? incoming : liveTrack(stream, 'video');
    const microphoneTrack = kind === 'audio' ? incoming : liveTrack(stream, 'audio');
    let graph = { source: this._source, sink: this._sink, analyser: this._media.analyser, data: this._media.data, AC: this._audioContext };

    try {
      if (kind === 'audio') graph = this._buildAudioGraph(stream, microphoneTrack);
    } catch (error) {
      try { stream.removeTrack(incoming); } catch {}
      if (outgoing && outgoing.readyState !== 'ended') {
        try { stream.addTrack(outgoing); } catch {}
      }
      throw error;
    }

    const priorSource = this._source;
    const priorSink = this._sink;
    const priorAnalyser = this._media.analyser;
    this._source = graph.source;
    this._sink = graph.sink;
    this._media = this._mediaSnapshot(stream, cameraTrack, microphoneTrack, graph);
    this._observeTracks(cameraTrack, microphoneTrack);
    this._startDeviceObservation();
    if (kind === 'audio') this._disconnectGraph(priorSource, priorAnalyser, priorSink);

    if (outgoing) {
      this._ownedTracks.delete(outgoing);
      this._stopTrack(outgoing);
    }
    this._ownedTracks.add(incoming);
    this._publishReadiness(`${kind === 'audio' ? 'microphone' : 'camera'}-replaced`);
    return this._media;
  }

  _buildAudioGraph(stream, microphoneTrack) {
    const context = this._audioContext;
    if (!microphoneTrack || !context) {
      return { source: null, sink: null, analyser: null, data: null, AC: context };
    }

    let source = null; let sink = null; let analyser = null;
    try {
      // Use the original MediaStream. Reconstructing an audio-only MediaStream is not
      // reliably pulled by WebKit.
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      // A real non-playback destination makes WebKit pull the analyser while making
      // microphone self-monitoring structurally impossible.
      sink = context.createMediaStreamDestination();
      analyser.connect(sink);
      return { source, sink, analyser, data: new Float32Array(analyser.fftSize), AC: context };
    } catch (error) {
      this._disconnectGraph(source, analyser, sink);
      throw error;
    }
  }

  _mediaSnapshot(stream, cameraTrack, microphoneTrack, graph) {
    const cam = Boolean(cameraTrack && cameraTrack.readyState === 'live');
    const mic = Boolean(microphoneTrack && microphoneTrack.readyState === 'live'
      && graph.AC && graph.analyser && graph.data);
    return Object.freeze({
      cam,
      mic,
      stream,
      cameraTrack: cam ? cameraTrack : null,
      microphoneTrack: microphoneTrack?.readyState === 'live' ? microphoneTrack : null,
      AC: graph.AC || null,
      analyser: graph.analyser || null,
      data: graph.data || null,
    });
  }

  _emit(type, detail) {
    const listeners = this._eventListeners.get(type);
    if (!listeners?.size) return;
    const event = Object.freeze({ type, target: this, currentTarget: this, detail });
    for (const listener of [...listeners]) {
      try {
        if (typeof listener === 'function') listener.call(this, event);
        else listener.handleEvent(event);
      } catch {
        // A presentation listener cannot break or roll back the media lifecycle.
      }
    }
  }

  _publishReadiness(reason, { deviceChange = false } = {}) {
    if (deviceChange) this._deviceChangeRevision += 1;
    this._readinessRevision += 1;
    this._lastReadinessReason = String(reason || 'changed');
    const readiness = this.readinessSnapshot();
    const recovery = deviceChange
      ? (readiness.anyReady ? 'REFRESH_DEVICE_LIST' : 'REACQUIRE_MEDIA')
      : readiness.fullyReady
        ? 'NONE'
        : readiness.anyReady
          ? 'DEGRADED'
          : 'REACQUIRE_MEDIA';
    let observedAtMs = null;
    try {
      const candidate = this._now();
      if (Number.isFinite(candidate)) observedAtMs = candidate;
    } catch { /* readiness observation cannot perturb media ownership */ }
    const detail = Object.freeze({
      state: 'media-readiness',
      reason: this._lastReadinessReason,
      atMs: observedAtMs,
      recovery,
      readiness,
    });
    this._emit('readinesschange', detail);
    this._emit('state', detail);
    if (deviceChange) this._emit('devicechange', detail);
    return readiness;
  }

  _observeTracks(cameraTrack, microphoneTrack) {
    this._clearTrackObservation();
    for (const [label, track] of [['camera', cameraTrack], ['microphone', microphoneTrack]]) {
      if (!track?.addEventListener) continue;
      const listeners = [];
      try {
        for (const type of ['ended', 'mute', 'unmute']) {
          const listener = () => this._publishReadiness(`${label}-${type}`);
          track.addEventListener(type, listener);
          listeners.push([type, listener]);
        }
        this._observedTrackListeners.set(track, listeners);
      } catch {
        for (const [type, listener] of listeners) {
          try { track.removeEventListener?.(type, listener); } catch {}
        }
      }
    }
  }

  _clearTrackObservation() {
    for (const [track, listeners] of this._observedTrackListeners) {
      for (const [type, listener] of listeners) {
        try { track.removeEventListener?.(type, listener); } catch {}
      }
    }
    this._observedTrackListeners.clear();
  }

  _startDeviceObservation() {
    if (this._deviceChangeListening || !this._mediaDevices?.addEventListener) return;
    try {
      this._mediaDevices.addEventListener('devicechange', this._boundDeviceChange);
      this._deviceChangeListening = true;
    } catch { /* device-list observation is advisory; owned capture remains valid */ }
  }

  _stopDeviceObservation() {
    if (!this._deviceChangeListening) return;
    try { this._mediaDevices?.removeEventListener?.('devicechange', this._boundDeviceChange); } catch {}
    this._deviceChangeListening = false;
  }

  _disconnectGraph(source, analyser, sink) {
    for (const node of [source, analyser, sink]) {
      try { node?.disconnect?.(); } catch {}
    }
  }

  _stopTrack(track) {
    if (!track || (typeof track !== 'object' && typeof track !== 'function') || this._stoppedTracks.has(track)) return;
    this._stoppedTracks.add(track);
    try { track.stop?.(); } catch {}
  }

  _stopTracks(values) {
    for (const track of values || []) this._stopTrack(track);
  }
}

export function createLiveAnalyticsMediaBridge(options) {
  return new LiveAnalyticsMediaBridge(options);
}
