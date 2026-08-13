const VENDOR_ROOT = '/vendor/mediapipe/tasks-vision/1.0.1';
const HOLISTIC_MODEL = '/vendor/mediapipe/models/holistic_landmarker/float16/1/holistic_landmarker.task';
const FACE_MODEL = '/vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';
const FACE_WORKER = '/analytics/face-detector-worker.mjs';
const HOLISTIC_WORKER = '/analytics/holistic-worker.mjs';
const WORKER_REVISION = '3420r-playback-overlay-3';
const MAX_PLAYBACK_FPS = 4;
const INITIALIZATION_TIMEOUT_MS = 15_000;
const FRAME_TIMEOUT_MS = 5_000;
const RECOVERY_DELAY_MS = 250;
const OVERLAY_FRAME_STATUSES = new Set(['not-requested', 'rendered', 'unavailable', 'error']);
const OVERLAY_UNAVAILABLE_REASONS = new Set([
  'display_disabled',
  'face_count_not_one',
  'render_surface_unavailable',
  'no_renderable_primitives',
  'render_failed',
  'bitmap_transfer_failed',
  'layer_mask_changed',
  'overlay_bitmap_unavailable',
  'canvas_blit_failed',
]);
const OVERLAY_ERROR_CODES = new Set(['overlay_render_failed', 'overlay_bitmap_transfer_failed', 'overlay_blit_failed']);
const OVERLAY_BLIT_ERROR = Object.freeze({
  overlayStatus: 'error',
  overlayUnavailableReason: 'canvas_blit_failed',
  overlayErrorCode: 'overlay_blit_failed',
  overlayErrorMessage: 'Local playback overlay drawing failed for this frame.',
});

function closeBitmap(bitmap) {
  try { bitmap?.close?.(); } catch {}
}

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

export function normalizePlaybackOverlayLayers(options = {}) {
  const faceValue = options.faceEnabled === undefined ? options.face : options.faceEnabled;
  const bodyValue = options.bodyEnabled === undefined ? options.body : options.bodyEnabled;
  return Object.freeze({
    overlayEnabled: options.overlayEnabled === undefined ? true : Boolean(options.overlayEnabled),
    faceEnabled: faceValue === undefined ? true : Boolean(faceValue),
    bodyEnabled: bodyValue === undefined ? true : Boolean(bodyValue),
  });
}

export function playbackFrameDimensions(sourceWidth, sourceHeight, maximumWidth = 480, maximumHeight = 270) {
  if (![sourceWidth, sourceHeight, maximumWidth, maximumHeight].every(finitePositive)) throw new TypeError('Playback overlay frame dimensions must be finite and positive.');
  const scale = Math.min(maximumWidth / sourceWidth, maximumHeight / sourceHeight);
  return Object.freeze({
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  });
}

export function containFitRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(finitePositive)) throw new TypeError('Contain-fit dimensions must be finite and positive.');
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return Object.freeze({
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  });
}

export function playbackSourceSignature(video) {
  return String(video?.currentSrc || video?.src || '');
}

export function exactPlaybackFrameMatch(expected, message) {
  return Boolean(expected
    && message
    && expected.generation === message.generation
    && expected.answerEpoch === message.answerEpoch
    && expected.visionEpoch === message.visionEpoch
    && expected.frameId === message.frameId
    && expected.timestampMs === message.timestampMs);
}

export function normalizePlaybackOverlayResult(message = {}) {
  const overlayRendered = Boolean(message.overlayRendered);
  let overlayStatus = OVERLAY_FRAME_STATUSES.has(message.overlayStatus)
    ? message.overlayStatus
    : overlayRendered ? 'rendered' : message.overlayRequested === false ? 'not-requested' : 'unavailable';
  let overlayUnavailableReason = OVERLAY_UNAVAILABLE_REASONS.has(message.overlayUnavailableReason)
    ? message.overlayUnavailableReason
    : overlayStatus === 'not-requested' ? 'display_disabled' : overlayStatus === 'unavailable' ? 'no_renderable_primitives' : null;
  if (overlayStatus === 'rendered' && !overlayRendered) {
    overlayStatus = 'unavailable';
    overlayUnavailableReason = 'overlay_bitmap_unavailable';
  }
  const overlayErrorCode = OVERLAY_ERROR_CODES.has(message.overlayErrorCode) ? message.overlayErrorCode : null;
  const overlayErrorMessage = overlayErrorCode && typeof message.overlayErrorMessage === 'string'
    ? message.overlayErrorMessage.slice(0, 180)
    : null;
  return Object.freeze({ overlayStatus, overlayUnavailableReason, overlayErrorCode, overlayErrorMessage });
}

export class LocalPlaybackOverlayRuntime {
  constructor({
    video,
    canvas,
    onState = () => {},
    targetFps = MAX_PLAYBACK_FPS,
    workerFactory = (url, options) => new Worker(url, options),
    createBitmap = (...args) => createImageBitmap(...args),
    documentRef = globalThis.document,
    now = () => performance.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = (id) => clearTimeout(id),
    devicePixelRatio = () => globalThis.devicePixelRatio || 1,
    maximumRecoveryAttempts = 2,
  } = {}) {
    if (!video?.addEventListener || !video?.removeEventListener) throw new TypeError('A playback video element is required.');
    if (!canvas?.getContext) throw new TypeError('A playback overlay canvas is required.');
    if (typeof onState !== 'function') throw new TypeError('Playback overlay onState must be a function.');
    if (typeof workerFactory !== 'function' || typeof createBitmap !== 'function') throw new TypeError('Playback overlay worker and bitmap factories are required.');
    this.video = video;
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    if (!this.context) throw new TypeError('Playback overlay requires a 2D canvas context.');
    this.onState = onState;
    this.targetFps = Math.min(MAX_PLAYBACK_FPS, Math.max(0.25, Number(targetFps) || MAX_PLAYBACK_FPS));
    this.workerFactory = workerFactory;
    this.createBitmap = createBitmap;
    this.documentRef = documentRef;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.devicePixelRatio = devicePixelRatio;
    this.maximumRecoveryAttempts = Math.max(0, Math.floor(Number(maximumRecoveryAttempts) || 0));
    this.layers = normalizePlaybackOverlayLayers();
    this.active = false;
    this.listenersAttached = false;
    this.destroyed = false;
    this.generation = 0;
    this.answerEpoch = 0;
    this.visionEpoch = 0;
    this.frameId = 0;
    this.frameInFlight = false;
    this.activeCaptureToken = null;
    this.pendingFaceFrame = null;
    this.inFlightHolistic = null;
    this.faceWorker = null;
    this.holisticWorker = null;
    this.faceReady = false;
    this.holisticReady = false;
    this.frameCallbackId = null;
    this.fallbackTimer = null;
    this.frameTimeout = null;
    this.initTimeout = null;
    this.recoveryTimer = null;
    this.recoveryEpoch = 0;
    this.lastCaptureWallMs = Number.NEGATIVE_INFINITY;
    this.sourceUrl = playbackSourceSignature(video);
    this.sourceObject = video.srcObject || null;
    this.recoveryAttempts = 0;
    this.blockedEgressAttempts = 0;
    this.boundPlay = () => this.resumeForPlayback('play');
    this.boundPause = () => this.quiesce('paused');
    this.boundEnded = () => this.quiesce('ended');
    this.boundSeeking = () => this.quiesce('seeking');
    this.boundSeeked = () => this.resumeForPlayback('seeked');
    this.boundSource = (event) => this.handleSourceEvent(event?.type);
    this.boundVisibility = () => {
      if (this.documentRef?.hidden) this.quiesce('document_hidden');
      else this.resumeForPlayback('document_visible');
    };
  }

  start() {
    if (this.destroyed) throw new Error('Playback overlay runtime has been destroyed.');
    this.active = true;
    this.attachListeners();
    if (!this.faceWorker || !this.holisticWorker) this.initializeWorkers();
    else if (this.workersReady()) this.resumeForPlayback('started');
    return this;
  }

  stop({ clear = true, reason = 'stopped' } = {}) {
    if (this.destroyed) return;
    this.active = false;
    this.recoveryEpoch += 1;
    this.cancelFrameSchedule();
    this.clearTimer(this.recoveryTimer);
    this.recoveryTimer = null;
    this.invalidatePendingFrames({ resetWorkers: true });
    if (clear) this.clearCanvas();
    this.emit({ state: clear ? 'cleared' : 'stopped', reason: String(reason || 'stopped').slice(0, 120) });
  }

  setLayers(options = {}) {
    if (this.destroyed) return this.layers;
    const layers = normalizePlaybackOverlayLayers(options);
    const changed = layers.overlayEnabled !== this.layers.overlayEnabled
      || layers.faceEnabled !== this.layers.faceEnabled
      || layers.bodyEnabled !== this.layers.bodyEnabled;
    this.layers = layers;
    if (!changed) return layers;
    this.cancelFrameSchedule();
    this.invalidatePendingFrames({ resetWorkers: true });
    this.holisticWorker?.postMessage?.({ type: 'instrumentation', generation: this.generation, ...layers });
    this.clearCanvas();
    if (this.overlayIsActive()) this.resumeForPlayback('layers_changed');
    return layers;
  }

  destroy() {
    if (this.destroyed) return;
    this.active = false;
    this.destroyed = true;
    this.recoveryEpoch += 1;
    this.cancelFrameSchedule();
    this.clearTimer(this.recoveryTimer);
    this.recoveryTimer = null;
    this.invalidatePendingFrames({ resetWorkers: false });
    this.detachListeners();
    this.terminateWorkers();
    this.clearCanvas();
    this.emit({ state: 'destroyed' });
  }

  attachListeners() {
    if (this.listenersAttached) return;
    this.listenersAttached = true;
    for (const [type, listener] of [
      ['play', this.boundPlay],
      ['pause', this.boundPause],
      ['ended', this.boundEnded],
      ['seeking', this.boundSeeking],
      ['seeked', this.boundSeeked],
      ['loadstart', this.boundSource],
      ['loadedmetadata', this.boundSource],
      ['emptied', this.boundSource],
    ]) this.video.addEventListener(type, listener);
    this.documentRef?.addEventListener?.('visibilitychange', this.boundVisibility);
  }

  detachListeners() {
    if (!this.listenersAttached) return;
    this.listenersAttached = false;
    for (const [type, listener] of [
      ['play', this.boundPlay],
      ['pause', this.boundPause],
      ['ended', this.boundEnded],
      ['seeking', this.boundSeeking],
      ['seeked', this.boundSeeked],
      ['loadstart', this.boundSource],
      ['loadedmetadata', this.boundSource],
      ['emptied', this.boundSource],
    ]) this.video.removeEventListener(type, listener);
    this.documentRef?.removeEventListener?.('visibilitychange', this.boundVisibility);
  }

  overlayIsActive() {
    return this.layers.overlayEnabled && (this.layers.faceEnabled || this.layers.bodyEnabled);
  }

  canSample() {
    return Boolean(this.active
      && !this.destroyed
      && this.overlayIsActive()
      && this.workersReady()
      && !this.documentRef?.hidden
      && !this.video.paused
      && !this.video.ended
      && !this.video.seeking
      && this.video.readyState >= 2
      && finitePositive(this.video.videoWidth)
      && finitePositive(this.video.videoHeight));
  }

  workersReady() {
    return Boolean(this.faceWorker && this.holisticWorker && this.faceReady && this.holisticReady);
  }

  initializeWorkers() {
    if (this.destroyed || !this.active) return;
    this.recoveryEpoch += 1;
    this.cancelFrameSchedule();
    this.clearTimer(this.recoveryTimer);
    this.recoveryTimer = null;
    this.terminateWorkers();
    const generation = ++this.generation;
    const answerEpoch = ++this.answerEpoch;
    this.visionEpoch += 1;
    this.faceReady = false;
    this.holisticReady = false;
    this.emit({ state: 'initializing' });
    try {
      this.faceWorker = this.workerFactory(`${FACE_WORKER}?v=${WORKER_REVISION}`, { type: 'module', name: `communication-playback-face-${generation}` });
      this.holisticWorker = this.workerFactory(`${HOLISTIC_WORKER}?v=${WORKER_REVISION}`, { type: 'module', name: `communication-playback-holistic-${generation}` });
      this.faceWorker.onmessage = (event) => this.onFaceWorkerMessage(event.data || {}, generation);
      this.holisticWorker.onmessage = (event) => this.onHolisticWorkerMessage(event.data || {}, generation);
      this.faceWorker.onerror = (event) => {
        if (generation === this.generation) this.recover('face_worker_error', event?.message);
      };
      this.holisticWorker.onerror = (event) => {
        if (generation === this.generation) this.recover('holistic_worker_error', event?.message);
      };
      this.faceWorker.postMessage({
        type: 'init', generation, answerEpoch,
        bundleUrl: `${VENDOR_ROOT}/vision_bundle.mjs`,
        wasmRoot: `${VENDOR_ROOT}/wasm`,
        faceDetectorModelUrl: FACE_MODEL,
      });
      this.holisticWorker.postMessage({
        type: 'init', generation, answerEpoch,
        bundleUrl: `${VENDOR_ROOT}/vision_bundle.mjs`,
        wasmRoot: `${VENDOR_ROOT}/wasm`,
        holisticModelUrl: HOLISTIC_MODEL,
        responseMode: 'overlay-only',
        ...this.layers,
      });
      this.initTimeout = this.setTimer(() => {
        this.initTimeout = null;
        if (generation === this.generation && !this.workersReady()) this.recover('worker_initialization_timeout');
      }, INITIALIZATION_TIMEOUT_MS);
    } catch (error) {
      this.recover('worker_initialization_failed', error?.message || error);
    }
  }

  terminateWorkers() {
    this.clearTimer(this.initTimeout);
    this.initTimeout = null;
    try { this.faceWorker?.terminate?.(); } catch {}
    try { this.holisticWorker?.terminate?.(); } catch {}
    this.faceWorker = null;
    this.holisticWorker = null;
    this.faceReady = false;
    this.holisticReady = false;
  }

  resumeForPlayback(reason) {
    if (!this.active || this.destroyed) return;
    if (!this.faceWorker || !this.holisticWorker) {
      this.initializeWorkers();
      return;
    }
    if (!this.workersReady()) return;
    if (!this.canSample()) {
      if (!this.overlayIsActive()) this.clearCanvas();
      return;
    }
    this.emit({ state: 'running', reason });
    this.scheduleNextFrame();
  }

  quiesce(reason) {
    if (this.destroyed) return;
    this.cancelFrameSchedule();
    this.invalidatePendingFrames({ resetWorkers: true });
    this.clearCanvas();
    this.emit({ state: 'cleared', reason });
  }

  handleSourceEvent(eventType = '') {
    if (this.destroyed) return;
    const nextUrl = playbackSourceSignature(this.video);
    const nextObject = this.video.srcObject || null;
    if (eventType === 'loadstart' || eventType === 'emptied' || nextUrl !== this.sourceUrl || nextObject !== this.sourceObject) {
      this.sourceUrl = nextUrl;
      this.sourceObject = nextObject;
      this.cancelFrameSchedule();
      this.invalidatePendingFrames({ resetWorkers: true });
      this.clearCanvas();
      this.emit({ state: 'cleared', reason: 'source_changed' });
    }
    this.resumeForPlayback('source_ready');
  }

  sourceMatches(token) {
    return Boolean(token && token.sourceUrl === playbackSourceSignature(this.video) && token.sourceObject === (this.video.srcObject || null));
  }

  invalidatePendingFrames({ resetWorkers } = {}) {
    this.clearTimer(this.frameTimeout);
    this.frameTimeout = null;
    closeBitmap(this.pendingFaceFrame?.bitmap);
    this.pendingFaceFrame = null;
    this.inFlightHolistic = null;
    this.activeCaptureToken = null;
    this.frameInFlight = false;
    this.lastCaptureWallMs = Number.NEGATIVE_INFINITY;
    this.visionEpoch += 1;
    if (resetWorkers && (this.faceWorker || this.holisticWorker)) {
      const answerEpoch = ++this.answerEpoch;
      this.faceReady = false;
      this.holisticReady = false;
      try { this.faceWorker?.postMessage?.({ type: 'reset', generation: this.generation, answerEpoch }); } catch {}
      try { this.holisticWorker?.postMessage?.({ type: 'reset', generation: this.generation, answerEpoch }); } catch {}
    }
  }

  scheduleNextFrame() {
    if (!this.canSample() || this.frameCallbackId !== null || this.fallbackTimer !== null) return;
    if (typeof this.video.requestVideoFrameCallback === 'function') {
      this.frameCallbackId = this.video.requestVideoFrameCallback((presentedAt, metadata = {}) => {
        this.frameCallbackId = null;
        this.onFrameOpportunity(presentedAt, metadata);
        this.scheduleNextFrame();
      });
      return;
    }
    const intervalMs = 1_000 / this.targetFps;
    this.fallbackTimer = this.setTimer(() => {
      this.fallbackTimer = null;
      this.onFrameOpportunity(this.now(), {});
      this.scheduleNextFrame();
    }, intervalMs);
  }

  cancelFrameSchedule() {
    if (this.frameCallbackId !== null) {
      try { this.video.cancelVideoFrameCallback?.(this.frameCallbackId); } catch {}
      this.frameCallbackId = null;
    }
    this.clearTimer(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  onFrameOpportunity(presentedAt, metadata) {
    if (!this.canSample() || this.frameInFlight) return;
    const wallMs = Number.isFinite(presentedAt) ? presentedAt : this.now();
    if (wallMs - this.lastCaptureWallMs < 1_000 / this.targetFps) return;
    const sourceUrl = playbackSourceSignature(this.video);
    const sourceObject = this.video.srcObject || null;
    if (sourceUrl !== this.sourceUrl || sourceObject !== this.sourceObject) {
      this.handleSourceEvent();
      return;
    }
    const mediaTimeSeconds = Number.isFinite(metadata?.mediaTime) ? metadata.mediaTime : this.video.currentTime;
    const timestampMs = Number(mediaTimeSeconds) * 1_000;
    if (!Number.isFinite(timestampMs) || timestampMs < 0) return;
    this.lastCaptureWallMs = wallMs;
    const token = Object.freeze({
      generation: this.generation,
      answerEpoch: this.answerEpoch,
      visionEpoch: this.visionEpoch,
      frameId: ++this.frameId,
      timestampMs,
      sourceUrl,
      sourceObject,
    });
    this.activeCaptureToken = token;
    this.frameInFlight = true;
    this.captureFrame(token).catch((error) => this.handleFrameCaptureRejection(token, error));
  }

  async captureFrame(token) {
    let bitmap = null;
    let faceBitmap = null;
    let rejected = false;
    try {
      const dimensions = playbackFrameDimensions(this.video.videoWidth, this.video.videoHeight);
      bitmap = await this.createBitmap(this.video, { resizeWidth: dimensions.width, resizeHeight: dimensions.height, resizeQuality: 'medium' });
      if (!this.tokenIsCurrent(token) || !this.sourceMatches(token) || !this.canSample()) return;
      faceBitmap = await this.createBitmap(bitmap);
      if (!this.tokenIsCurrent(token) || !this.sourceMatches(token) || !this.canSample()) return;
      this.pendingFaceFrame = { ...token, bitmap };
      bitmap = null;
      this.faceWorker.postMessage({ type: 'frame', ...token, bitmap: faceBitmap }, [faceBitmap]);
      faceBitmap = null;
      this.armFrameTimeout(token, 'face_frame_timeout');
    } catch (error) {
      rejected = true;
      throw error;
    } finally {
      closeBitmap(faceBitmap);
      closeBitmap(bitmap);
      if (!rejected && !this.pendingFaceFrame && !this.inFlightHolistic) this.releaseFrameSlot(token);
    }
  }

  handleFrameCaptureRejection(token, error) {
    const ownsCurrentCapture = this.frameSlotOwnedBy(token)
      && this.tokenIsCurrent(token)
      && this.sourceMatches(token);
    if (ownsCurrentCapture) {
      this.recover('frame_capture_failed', error?.message || error);
      return;
    }
    this.releaseFrameSlot(token);
  }

  frameSlotOwnedBy(token) {
    return Boolean(this.frameInFlight
      && exactPlaybackFrameMatch(this.activeCaptureToken, token)
      && this.activeCaptureToken?.sourceUrl === token?.sourceUrl
      && this.activeCaptureToken?.sourceObject === token?.sourceObject);
  }

  releaseFrameSlot(token) {
    if (!this.frameSlotOwnedBy(token)) return false;
    this.activeCaptureToken = null;
    this.frameInFlight = false;
    return true;
  }

  tokenIsCurrent(token) {
    return Boolean(this.tokenOwnsSlot(token) && this.active && !this.destroyed);
  }

  tokenOwnsSlot(token) {
    return Boolean(token
      && token.generation === this.generation
      && token.answerEpoch === this.answerEpoch
      && token.visionEpoch === this.visionEpoch);
  }

  armFrameTimeout(token, reason) {
    this.clearTimer(this.frameTimeout);
    this.frameTimeout = this.setTimer(() => {
      this.frameTimeout = null;
      const expected = this.pendingFaceFrame || this.inFlightHolistic;
      if (exactPlaybackFrameMatch(expected, token) && this.tokenIsCurrent(token)) this.recover(reason);
    }, FRAME_TIMEOUT_MS);
  }

  onFaceWorkerMessage(message, generation) {
    if (generation !== this.generation || message.generation !== generation) return;
    if (message.type === 'egress-blocked') {
      this.blockedEgressAttempts += Math.max(1, Number(message.count) || 1);
      this.emit({ state: 'privacy-guard', blockedEgressAttempts: this.blockedEgressAttempts });
      return;
    }
    if (message.type === 'ready') {
      if (message.answerEpoch !== this.answerEpoch) return;
      this.faceReady = true;
      this.onWorkersMayBeReady();
      return;
    }
    if (message.type === 'init-error') {
      this.recover('face_worker_initialization_failed', message.message);
      return;
    }
    if (!['face-count', 'frame-error'].includes(message.type) || message.answerEpoch !== this.answerEpoch || message.visionEpoch !== this.visionEpoch) return;
    const pending = this.pendingFaceFrame;
    if (!exactPlaybackFrameMatch(pending, message)) return;
    this.clearTimer(this.frameTimeout);
    this.frameTimeout = null;
    if (message.type === 'frame-error') {
      this.recover('face_frame_failed', message.message);
      return;
    }
    this.pendingFaceFrame = null;
    if (message.faceCount !== 1 || !this.tokenIsCurrent(pending) || !this.sourceMatches(pending) || !this.canSample()) {
      closeBitmap(pending.bitmap);
      this.releaseFrameSlot(pending);
      this.clearCanvas();
      this.emit({ state: 'cleared', reason: message.faceCount === 1 ? 'frame_invalidated' : 'face_count_not_one' });
      return;
    }
    this.inFlightHolistic = pending;
    try {
      this.holisticWorker.postMessage({
        type: 'frame',
        generation: pending.generation,
        answerEpoch: pending.answerEpoch,
        visionEpoch: pending.visionEpoch,
        frameId: pending.frameId,
        timestampMs: pending.timestampMs,
        expectedFrameMs: 1_000 / this.targetFps,
        faceCount: 1,
        faceInferenceMs: Number.isFinite(message.faceInferenceMs) ? message.faceInferenceMs : null,
        bitmap: pending.bitmap,
      }, [pending.bitmap]);
      this.armFrameTimeout(pending, 'holistic_frame_timeout');
    } catch (error) {
      closeBitmap(pending.bitmap);
      this.inFlightHolistic = null;
      this.releaseFrameSlot(pending);
      this.recover('holistic_frame_dispatch_failed', error?.message || error);
    }
  }

  onHolisticWorkerMessage(message, generation) {
    const bitmap = message.overlayBitmap || null;
    if (generation !== this.generation || message.generation !== generation) {
      closeBitmap(bitmap);
      return;
    }
    if (message.type === 'egress-blocked') {
      this.blockedEgressAttempts += Math.max(1, Number(message.count) || 1);
      this.emit({ state: 'privacy-guard', blockedEgressAttempts: this.blockedEgressAttempts });
      return;
    }
    if (message.type === 'ready') {
      if (message.answerEpoch !== this.answerEpoch) return;
      this.holisticReady = true;
      this.onWorkersMayBeReady();
      return;
    }
    if (message.type === 'init-error') {
      this.recover('holistic_worker_initialization_failed', message.message);
      return;
    }
    if (!['geometry', 'frame-error'].includes(message.type) || message.answerEpoch !== this.answerEpoch || message.visionEpoch !== this.visionEpoch) {
      closeBitmap(bitmap);
      return;
    }
    const expected = this.inFlightHolistic;
    if (!exactPlaybackFrameMatch(expected, message)) {
      closeBitmap(bitmap);
      return;
    }
    this.clearTimer(this.frameTimeout);
    this.frameTimeout = null;
    this.inFlightHolistic = null;
    this.releaseFrameSlot(expected);
    if (message.type === 'frame-error') {
      closeBitmap(bitmap);
      this.recover('holistic_frame_failed', message.message);
      return;
    }
    this.recoveryAttempts = 0;
    const overlay = normalizePlaybackOverlayResult(message);
    try {
      const drawable = this.tokenIsCurrent(expected)
        && this.sourceMatches(expected)
        && this.canSample()
        && message.faceCount === 1
        && overlay.overlayStatus === 'rendered'
        && message.overlayRendered
        && bitmap;
      if (drawable) {
        try {
          this.drawBitmap(bitmap);
          this.emit({ state: 'rendered', ...overlay });
        } catch {
          this.clearCanvas();
          this.emit({ state: 'overlay-error', ...OVERLAY_BLIT_ERROR });
        }
      } else if (overlay.overlayStatus === 'error') {
        this.clearCanvas();
        this.emit({ state: 'overlay-error', ...overlay });
      } else {
        this.clearCanvas();
        this.emit({
          state: 'unavailable',
          ...overlay,
          overlayStatus: 'unavailable',
          overlayUnavailableReason: message.faceCount === 1
            ? overlay.overlayUnavailableReason || 'overlay_bitmap_unavailable'
            : 'face_count_not_one',
        });
      }
    } finally {
      closeBitmap(bitmap);
    }
  }

  onWorkersMayBeReady() {
    if (!this.workersReady()) return;
    this.clearTimer(this.initTimeout);
    this.initTimeout = null;
    this.emit({ state: 'ready' });
    this.resumeForPlayback('workers_ready');
  }

  drawBitmap(bitmap) {
    const dpr = Math.min(4, Math.max(1, Number(this.devicePixelRatio()) || 1));
    const cssWidth = finitePositive(this.canvas.clientWidth) ? this.canvas.clientWidth : (finitePositive(this.canvas.width) ? this.canvas.width : bitmap.width);
    const cssHeight = finitePositive(this.canvas.clientHeight) ? this.canvas.clientHeight : (finitePositive(this.canvas.height) ? this.canvas.height : bitmap.height);
    const targetWidth = Math.max(1, Math.round(cssWidth * dpr));
    const targetHeight = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== targetWidth) this.canvas.width = targetWidth;
    if (this.canvas.height !== targetHeight) this.canvas.height = targetHeight;
    const rect = containFitRect(bitmap.width, bitmap.height, targetWidth, targetHeight);
    this.context.clearRect(0, 0, targetWidth, targetHeight);
    this.context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height);
  }

  clearCanvas() {
    try { this.context.clearRect(0, 0, this.canvas.width, this.canvas.height); } catch {}
  }

  recover(reason, error = '') {
    if (this.destroyed || !this.active) return;
    this.cancelFrameSchedule();
    this.clearTimer(this.recoveryTimer);
    this.recoveryTimer = null;
    this.invalidatePendingFrames({ resetWorkers: false });
    this.terminateWorkers();
    this.clearCanvas();
    this.generation += 1;
    this.recoveryAttempts += 1;
    const message = String(error || reason || 'playback overlay unavailable').slice(0, 180);
    if (this.recoveryAttempts > this.maximumRecoveryAttempts) {
      this.active = false;
      this.emit({ state: 'failed', reason, message });
      return;
    }
    this.emit({ state: 'recovering', reason, message, attempt: this.recoveryAttempts });
    const recoveryEpoch = ++this.recoveryEpoch;
    this.recoveryTimer = this.setTimer(() => {
      this.recoveryTimer = null;
      if (recoveryEpoch === this.recoveryEpoch && this.active && !this.destroyed) this.initializeWorkers();
    }, RECOVERY_DELAY_MS);
  }

  emit(detail) {
    try { this.onState(Object.freeze({ ...detail })); } catch {}
  }
}
