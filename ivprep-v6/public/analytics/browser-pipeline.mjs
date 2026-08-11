import { AnalyticsSession } from './analytics-session.mjs';
import { measurePcmFrame } from './audio-signal.mjs';

const VENDOR_ROOT = '/vendor/mediapipe/tasks-vision/1.0.1';
const HOLISTIC_MODEL = '/vendor/mediapipe/models/holistic_landmarker/float16/1/holistic_landmarker.task';
const FACE_MODEL = '/vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';
const FACE_WORKER = '/analytics/face-detector-worker.mjs';
const WORKER_REVISION = '3420r-founder-instrumentation-11';
const FACE_INITIALIZATION_TIMEOUT_MS = 10_000;
const HOLISTIC_FRAME_TIMEOUT_MIN_MS = 1_000;
const HOLISTIC_FRAME_TIMEOUT_MAX_MS = 5_000;

export function visionFrameWatchdogMs(expectedFrameMs = 125) {
  const frameBudget = Number.isFinite(expectedFrameMs) && expectedFrameMs > 0 ? expectedFrameMs : 125;
  return Math.min(HOLISTIC_FRAME_TIMEOUT_MAX_MS, Math.max(HOLISTIC_FRAME_TIMEOUT_MIN_MS, Math.ceil(frameBudget * 4)));
}

function closeOverlayBitmap(bitmap) {
  try { bitmap?.close?.(); } catch {}
}

function randomId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
}

export function visionFrameDimensions(sourceWidth, sourceHeight, maximumWidth = 480, maximumHeight = 270) {
  if (![sourceWidth, sourceHeight, maximumWidth, maximumHeight].every((value) => Number.isFinite(value) && value > 0)) throw new TypeError('Vision frame dimensions must be finite and positive.');
  const scale = Math.min(maximumWidth / sourceWidth, maximumHeight / sourceHeight);
  return Object.freeze({
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  });
}

export function normalizeOverlayInstrumentation({ overlayEnabled = false, faceEnabled = true, bodyEnabled = true } = {}) {
  return Object.freeze({
    overlayEnabled: Boolean(overlayEnabled),
    faceEnabled: Boolean(faceEnabled),
    bodyEnabled: Boolean(bodyEnabled),
  });
}

const OVERLAY_FRAME_STATUSES = new Set(['not-requested', 'rendered', 'unavailable', 'error']);
const OVERLAY_UNAVAILABLE_REASONS = new Set([
  'display_disabled',
  'face_count_not_one',
  'render_surface_unavailable',
  'no_renderable_primitives',
  'render_failed',
  'bitmap_transfer_failed',
  'layer_mask_changed',
]);
const OVERLAY_ERROR_CODES = new Set(['overlay_render_failed', 'overlay_bitmap_transfer_failed']);

export function normalizeOverlayFrameMetadata(message = {}) {
  const overlayRendered = Boolean(message.overlayRendered);
  const fallbackStatus = overlayRendered
    ? 'rendered'
    : message.overlayRequested === false ? 'not-requested' : 'unavailable';
  const overlayStatus = OVERLAY_FRAME_STATUSES.has(message.overlayStatus) ? message.overlayStatus : fallbackStatus;
  const overlayUnavailableReason = OVERLAY_UNAVAILABLE_REASONS.has(message.overlayUnavailableReason)
    ? message.overlayUnavailableReason
    : overlayStatus === 'not-requested' ? 'display_disabled' : overlayStatus === 'unavailable' ? 'no_renderable_primitives' : null;
  const overlayErrorCode = OVERLAY_ERROR_CODES.has(message.overlayErrorCode) ? message.overlayErrorCode : null;
  const overlayErrorMessage = overlayErrorCode && typeof message.overlayErrorMessage === 'string'
    ? message.overlayErrorMessage.slice(0, 180)
    : null;
  return Object.freeze({ overlayStatus, overlayUnavailableReason, overlayErrorCode, overlayErrorMessage });
}

export class BrowserAnalyticsPipeline extends EventTarget {
  constructor({ bridge, now = () => performance.now() } = {}) {
    super();
    if (!bridge) throw new TypeError('V6Bridge is required.');
    this.bridge = bridge;
    this.now = now;
    this.generation = 0;
    this.answerEpoch = 0;
    this.visionEpoch = 0;
    this.session = null;
    this.answer = null;
    this.answerSealed = false;
    this.sealedEndAt = null;
    this.audioTimer = null;
    this.visionTimer = null;
    this.worker = null;
    this.workerReady = false;
    this.faceWorker = null;
    this.faceWorkerReady = false;
    this.multiFaceProtection = null;
    this.frameInFlight = false;
    this.visionCaptureSequence = 0;
    this.pendingVisionFrame = null;
    this.inFlightVision = null;
    this.faceFrameTimer = null;
    this.visionFrameTimer = null;
    this.faceInitTimer = null;
    this.frameId = 0;
    this.targetFps = 8;
    this.droppedFrames = 0;
    this.workerErrors = [];
    this.blockedEgressAttempts = 0;
    this.overlayEnabled = false;
    this.overlayFaceEnabled = true;
    this.overlayBodyEnabled = true;
    this.overlayConsumer = null;
    this.overlayDisplayErrorActive = false;
    this.overlayRendererErrorActive = false;
    this.hiddenAt = null;
    this.visionDisconnectedAt = null;
    this.audioDisconnectedAt = null;
    this.boundVisibility = () => this.onVisibilityChange();
    document.addEventListener('visibilitychange', this.boundVisibility);
  }

  ensureSession() {
    if (!this.session) this.session = new AnalyticsSession({ sessionId: randomId('communication'), now: this.now });
    return this.session;
  }

  setInstrumentation(options = {}) {
    const mask = normalizeOverlayInstrumentation(options);
    const changed = mask.overlayEnabled !== this.overlayEnabled
      || mask.faceEnabled !== this.overlayFaceEnabled
      || mask.bodyEnabled !== this.overlayBodyEnabled;
    this.overlayEnabled = mask.overlayEnabled;
    this.overlayFaceEnabled = mask.faceEnabled;
    this.overlayBodyEnabled = mask.bodyEnabled;
    if (!mask.overlayEnabled || (!mask.faceEnabled && !mask.bodyEnabled)) this.overlayRendererErrorActive = false;
    if (changed) this.worker?.postMessage?.({ type: 'instrumentation', generation: this.generation, ...mask });
  }

  setOverlayConsumer(consumer = null) {
    if (consumer !== null && typeof consumer !== 'function') throw new TypeError('Overlay consumer must be a function or null.');
    this.overlayConsumer = consumer;
    this.overlayDisplayErrorActive = false;
  }

  notifyOverlayConsumer(payload = {}) {
    if (!this.overlayEnabled || !this.overlayConsumer) return false;
    try {
      this.overlayConsumer(payload);
      this.overlayDisplayErrorActive = false;
      return true;
    } catch (error) {
      if (!this.overlayDisplayErrorActive) {
        this.overlayDisplayErrorActive = true;
        this.recordWorkerError(`overlay display: ${error?.message || error}`);
        this.dispatch('state', {
          state: 'partial', subsystem: 'overlay-display', atMs: Number.isFinite(payload.atMs) ? payload.atMs : null,
          message: 'Overlay display is unavailable; analytics continued.',
        });
      }
      return false;
    }
  }

  beginAnswer({ answerId = null, mediaId = null, mediaStartedAt = null, videoElement = null } = {}) {
    if (this.answer) this.abandonAnswer('superseded');
    this.answerEpoch += 1;
    this.visionEpoch += 1;
    this.answerSealed = false;
    this.sealedEndAt = null;
    const media = this.bridge.media || {};
    const hasMic = Boolean(media.mic && media.AC?.state === 'running' && media.analyser && media.data && media.stream?.getAudioTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
    const video = videoElement || document.getElementById('pipvid') || document.getElementById('stationvid');
    const hasCamera = Boolean(media.cam && media.stream?.getVideoTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true) && video);
    const session = this.ensureSession();
    this.answer = session.beginAnswer({ answerId: answerId || randomId('answer'), hasMic, hasCamera, mediaId, mediaStartedAt });
    this.hiddenAt = document.hidden ? this.answer.startedAtMs : null;
    this.visionDisconnectedAt = null;
    this.audioDisconnectedAt = null;
    try {
      if (hasMic) this.startAudio();
      if (hasCamera) this.startVision(video);
    } catch (error) {
      this.stopSampling({ terminateWorker: true });
      session.abandonAnswer();
      this.answer = null;
      this.hiddenAt = null;
      this.audioDisconnectedAt = null;
      this.visionDisconnectedAt = null;
      throw error;
    }
    this.dispatch('state', { state: 'running', hasMic, hasCamera, ...this.answer });
    return this.answer;
  }

  startAudio() {
    const tick = () => {
      if (!this.answer) return;
      if (document.hidden) return;
      const media = this.bridge.media || {};
      const audioLive = this.audioMediaIsLive();
      if (!audioLive || !media.analyser || !media.data) {
        if (this.audioDisconnectedAt === null) {
          const atMs = this.session.clock.sessionMs();
          this.audioDisconnectedAt = atMs;
          this.dispatch('diagnostic', {
            modality: 'audio', atMs, available: false,
            reason: 'microphone_or_audio_context_disconnected',
          });
          this.dispatch('state', {
            state: 'partial', subsystem: 'audio', atMs,
            message: 'Microphone or audio context unavailable.',
          });
        }
        return;
      }
      if (this.audioDisconnectedAt !== null) {
        const resumedAt = this.session.clock.sessionMs();
        this.session.observationGap({ startMs: this.audioDisconnectedAt, endMs: resumedAt, reason: 'microphone_or_audio_context_disconnected', modality: 'audio' });
        this.audioDisconnectedAt = null;
      }
      media.analyser.getFloatTimeDomainData(media.data);
      const measured = measurePcmFrame(media.data);
      const atMs = this.session.clock.sessionMs();
      this.session.ingestAudio({ atMs, ...measured });
      const analyzer = this.session.audio;
      this.dispatch('diagnostic', {
        modality: 'audio', atMs, available: true, ...measured,
        speaking: analyzer.speaking,
        pauseInProgressMs: analyzer.hasSpoken && !analyzer.speaking && analyzer.candidateSilenceStartMs !== null ? Math.max(0, atMs - analyzer.candidateSilenceStartMs) : 0,
        frameCount: analyzer.validFrames,
      });
    };
    tick();
    this.audioTimer = setInterval(tick, 50);
  }

  startVision(video) {
    this.frameInFlight = false;
    this.workerErrors = [];
    let generation = this.generation;
    const answerEpoch = this.answerEpoch;
    if (!this.worker) {
      this.workerReady = false;
      generation = ++this.generation;
      this.worker = new Worker(`/analytics/holistic-worker.mjs?v=${WORKER_REVISION}`, { type: 'module', name: `communication-analytics-${generation}` });
      this.worker.onmessage = (event) => this.onWorkerMessage(event.data || {}, generation);
      this.worker.onerror = (event) => {
        if (generation === this.generation) this.failVisionWorker(event.message || 'vision worker error');
      };
      this.worker.postMessage({
        type: 'init', generation,
        answerEpoch,
        bundleUrl: `${VENDOR_ROOT}/vision_bundle.mjs`,
        wasmRoot: `${VENDOR_ROOT}/wasm`,
        holisticModelUrl: HOLISTIC_MODEL,
        overlayEnabled: this.overlayEnabled,
        faceEnabled: this.overlayFaceEnabled,
        bodyEnabled: this.overlayBodyEnabled,
      });
    } else this.worker.postMessage({ type: 'reset', generation, answerEpoch });
    if (!this.faceWorker) {
      this.faceWorkerReady = false;
      this.multiFaceProtection = false;
      this.faceWorker = new Worker(`${FACE_WORKER}?v=${WORKER_REVISION}`, { type: 'module', name: `communication-face-safety-${generation}` });
      this.faceWorker.onmessage = (event) => this.onFaceWorkerMessage(event.data || {}, generation);
      this.faceWorker.onerror = (event) => {
        if (generation === this.generation) this.failFaceWorker(event.message || 'face safety worker error');
      };
      this.faceWorker.postMessage({
        type: 'init', generation,
        answerEpoch,
        bundleUrl: `${VENDOR_ROOT}/vision_bundle.mjs`,
        wasmRoot: `${VENDOR_ROOT}/wasm`,
        faceDetectorModelUrl: FACE_MODEL,
      });
    } else this.faceWorker.postMessage({ type: 'reset', generation, answerEpoch });
    const schedule = () => {
      if (!this.answer || this.answerSealed || generation !== this.generation || answerEpoch !== this.answerEpoch) return;
      const delay = Math.round(1_000 / this.targetFps);
      this.visionTimer = setTimeout(async () => {
        if (!this.answer || this.answerSealed || generation !== this.generation || answerEpoch !== this.answerEpoch) return;
        if (!this.cameraMediaIsLive()) {
          this.markVisionUnavailable('camera_disconnected');
          return;
        }
        const faceSafetySettled = this.faceWorkerReady || !this.faceWorker;
        if (!document.hidden && this.workerReady && faceSafetySettled && !this.frameInFlight && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          let bitmap = null;
          let faceBitmap = null;
          let captureSequence = null;
          let visionEpoch = null;
          try {
            this.frameInFlight = true;
            captureSequence = ++this.visionCaptureSequence;
            visionEpoch = this.visionEpoch;
            const captureStartedAt = this.now();
            const frameDimensions = visionFrameDimensions(video.videoWidth, video.videoHeight);
            bitmap = await createImageBitmap(video, { resizeWidth: frameDimensions.width, resizeHeight: frameDimensions.height, resizeQuality: 'medium' });
            if (!this.visionCaptureIsCurrent({ generation, answerEpoch, visionEpoch, captureSequence })) {
              closeOverlayBitmap(bitmap);
              bitmap = null;
              if (captureSequence === this.visionCaptureSequence) this.frameInFlight = false;
              if (!this.cameraMediaIsLive()) {
                this.markVisionUnavailable('camera_disconnected');
                return;
              }
            } else {
              const timestampMs = this.session.clock.sessionMs();
              const frameId = ++this.frameId;
              if (this.faceWorkerReady && this.faceWorker) {
                faceBitmap = await createImageBitmap(bitmap);
                if (!this.visionCaptureIsCurrent({ generation, answerEpoch, visionEpoch, captureSequence })) {
                  closeOverlayBitmap(faceBitmap);
                  faceBitmap = null;
                  closeOverlayBitmap(bitmap);
                  bitmap = null;
                  if (captureSequence === this.visionCaptureSequence) this.frameInFlight = false;
                  if (!this.cameraMediaIsLive()) {
                    this.markVisionUnavailable('camera_disconnected');
                    return;
                  }
                } else {
                  this.pendingVisionFrame = { bitmap, generation, answerEpoch, visionEpoch, frameId, timestampMs, expectedFrameMs: delay, captureStartedAt };
                  bitmap = null;
                  this.faceFrameTimer = setTimeout(() => {
                    const pending = this.pendingVisionFrame;
                    if (pending?.generation === generation && pending?.answerEpoch === answerEpoch && pending?.visionEpoch === visionEpoch && pending?.frameId === frameId) this.failFaceWorker('face safety frame timed out');
                  }, Math.max(400, delay * 2));
                  this.faceWorker.postMessage({ type: 'frame', generation, answerEpoch, visionEpoch, frameId, timestampMs, bitmap: faceBitmap }, [faceBitmap]);
                  faceBitmap = null;
                }
              } else {
                this.inFlightVision = { generation, answerEpoch, visionEpoch, frameId, timestampMs, expectedFrameMs: delay, captureStartedAt };
                this.worker.postMessage({ type: 'frame', generation, answerEpoch, visionEpoch, frameId, timestampMs, expectedFrameMs: delay, faceCount: null, faceInferenceMs: null, bitmap }, [bitmap]);
                this.armVisionFrameWatchdog(this.inFlightVision);
                bitmap = null;
              }
            }
          } catch (error) {
            closeOverlayBitmap(faceBitmap);
            closeOverlayBitmap(bitmap);
            if (this.visionCaptureOwnsSlot({ generation, answerEpoch, visionEpoch, captureSequence })) {
              this.clearPendingVision();
              this.clearVisionFrameWatchdog();
              this.inFlightVision = null;
              this.frameInFlight = false;
              this.recordWorkerError(error?.message || error);
            }
          }
        } else if (this.frameInFlight) this.droppedFrames += 1;
        schedule();
      }, delay);
    };
    schedule();
    if (this.faceWorker && !this.faceWorkerReady && !this.faceInitTimer) {
      this.faceInitTimer = setTimeout(() => {
        this.faceInitTimer = null;
        if (generation === this.generation && this.faceWorker && !this.faceWorkerReady) this.failFaceWorker('face safety initialization timed out');
      }, FACE_INITIALIZATION_TIMEOUT_MS);
    }
  }

  audioMediaIsLive() {
    const media = this.bridge.media || {};
    return Boolean(media.mic
      && media.AC?.state === 'running'
      && media.stream?.getAudioTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
  }

  cameraMediaIsLive() {
    const media = this.bridge.media || {};
    return Boolean(media.cam
      && media.stream?.getVideoTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
  }

  visionCaptureIsCurrent({ generation, answerEpoch, visionEpoch, captureSequence }) {
    return Boolean(this.visionCaptureOwnsSlot({ generation, answerEpoch, visionEpoch, captureSequence })
      && !document.hidden
      && this.cameraMediaIsLive());
  }

  visionCaptureOwnsSlot({ generation, answerEpoch, visionEpoch, captureSequence }) {
    return Boolean(this.answer
      && !this.answerSealed
      && generation === this.generation
      && answerEpoch === this.answerEpoch
      && visionEpoch === this.visionEpoch
      && captureSequence === this.visionCaptureSequence);
  }

  forwardPendingVision(faceCount, generation, answerEpoch, visionEpoch, frameId, timestampMs, faceInferenceMs = null) {
    const pending = this.pendingVisionFrame;
    if (!pending || pending.generation !== generation || pending.answerEpoch !== answerEpoch || pending.visionEpoch !== visionEpoch || pending.frameId !== frameId || pending.timestampMs !== timestampMs) return false;
    clearTimeout(this.faceFrameTimer);
    this.faceFrameTimer = null;
    this.pendingVisionFrame = null;
    if (!this.answer || this.answerSealed || generation !== this.generation || answerEpoch !== this.answerEpoch || visionEpoch !== this.visionEpoch || !this.worker) {
      pending.bitmap?.close?.();
      this.frameInFlight = false;
      return false;
    }
    this.inFlightVision = { generation, answerEpoch, visionEpoch, frameId, timestampMs, expectedFrameMs: pending.expectedFrameMs, captureStartedAt: pending.captureStartedAt };
    try {
      this.worker.postMessage({
        type: 'frame', generation, answerEpoch, visionEpoch, frameId, timestampMs,
        expectedFrameMs: pending.expectedFrameMs,
        faceCount: Number.isFinite(faceCount) ? Math.max(0, Math.round(faceCount)) : null,
        faceInferenceMs: Number.isFinite(faceInferenceMs) ? faceInferenceMs : null,
        bitmap: pending.bitmap,
      }, [pending.bitmap]);
      this.armVisionFrameWatchdog(this.inFlightVision);
      return true;
    } catch (error) {
      closeOverlayBitmap(pending.bitmap);
      this.inFlightVision = null;
      this.frameInFlight = false;
      this.failVisionWorker(`holistic frame dispatch failed: ${error?.message || error}`);
      return false;
    }
  }

  clearPendingVision() {
    clearTimeout(this.faceFrameTimer);
    this.faceFrameTimer = null;
    this.pendingVisionFrame?.bitmap?.close?.();
    this.pendingVisionFrame = null;
  }

  clearVisionFrameWatchdog() {
    clearTimeout(this.visionFrameTimer);
    this.visionFrameTimer = null;
  }

  armVisionFrameWatchdog(frame) {
    this.clearVisionFrameWatchdog();
    if (!frame) return;
    const ownership = {
      generation: frame.generation,
      answerEpoch: frame.answerEpoch,
      visionEpoch: frame.visionEpoch,
      frameId: frame.frameId,
      timestampMs: frame.timestampMs,
    };
    const timer = setTimeout(() => {
      if (this.visionFrameTimer !== timer) return;
      this.visionFrameTimer = null;
      const current = this.inFlightVision;
      const ownsFrame = Boolean(current
        && this.answer
        && !this.answerSealed
        && ownership.generation === this.generation
        && ownership.answerEpoch === this.answerEpoch
        && ownership.visionEpoch === this.visionEpoch
        && current.generation === ownership.generation
        && current.answerEpoch === ownership.answerEpoch
        && current.visionEpoch === ownership.visionEpoch
        && current.frameId === ownership.frameId
        && current.timestampMs === ownership.timestampMs);
      if (ownsFrame) this.failVisionWorker('holistic frame timed out');
    }, visionFrameWatchdogMs(frame.expectedFrameMs));
    this.visionFrameTimer = timer;
  }

  onFaceWorkerMessage(message, generation) {
    if (generation !== this.generation || message.generation !== generation) return;
    if (message.type !== 'init-error' && message.answerEpoch !== undefined && message.answerEpoch !== this.answerEpoch) return;
    if (['face-count', 'frame-error'].includes(message.type) && message.visionEpoch !== this.visionEpoch) return;
    if (message.type === 'egress-blocked') {
      this.blockedEgressAttempts += Math.max(1, Number(message.count) || 1);
      this.dispatch('state', { state: 'privacy-guard', blockedEgressAttempts: this.blockedEgressAttempts });
      return;
    }
    if (message.type === 'ready') {
      clearTimeout(this.faceInitTimer);
      this.faceInitTimer = null;
      this.faceWorkerReady = true;
      this.multiFaceProtection = true;
      this.dispatch('state', { state: 'vision-ready', multiFaceProtection: true });
      return;
    }
    if (message.type === 'face-count') {
      this.forwardPendingVision(message.faceCount, generation, message.answerEpoch, message.visionEpoch, message.frameId, message.timestampMs, message.faceInferenceMs);
      return;
    }
    if (message.type === 'frame-error') {
      this.failFaceWorker(`face safety frame: ${message.message || 'unavailable'}`);
      return;
    }
    if (message.type === 'init-error') this.failFaceWorker(message.message || 'face safety initialization failed');
  }

  onWorkerMessage(message, generation) {
    if (generation !== this.generation || message.generation !== generation) {
      closeOverlayBitmap(message.overlayBitmap);
      return;
    }
    if (message.type !== 'init-error' && message.answerEpoch !== undefined && message.answerEpoch !== this.answerEpoch) {
      closeOverlayBitmap(message.overlayBitmap);
      return;
    }
    if (['geometry', 'frame-error'].includes(message.type) && message.visionEpoch !== this.visionEpoch) {
      closeOverlayBitmap(message.overlayBitmap);
      return;
    }
    if (message.type === 'egress-blocked') {
      this.blockedEgressAttempts += Math.max(1, Number(message.count) || 1);
      this.dispatch('state', { state: 'privacy-guard', blockedEgressAttempts: this.blockedEgressAttempts });
      return;
    }
    if (message.type === 'ready') {
      this.workerReady = true;
      this.dispatch('state', { state: 'vision-ready', multiFaceProtection: this.multiFaceProtection });
      return;
    }
    if (message.type === 'geometry') {
      const bitmap = message.overlayBitmap || null;
      const inFlight = this.inFlightVision;
      const matchesFrame = Boolean(inFlight
        && inFlight.generation === generation
        && inFlight.answerEpoch === message.answerEpoch
        && inFlight.visionEpoch === message.visionEpoch
        && inFlight.frameId === message.frameId
        && inFlight.timestampMs === message.timestampMs);
      if (!matchesFrame) {
        closeOverlayBitmap(bitmap);
        return;
      }
      const pipelineMs = Number(Math.max(0, this.now() - inFlight.captureStartedAt).toFixed(2));
      this.clearVisionFrameWatchdog();
      this.inFlightVision = null;
      this.frameInFlight = false;
      if (!this.answer || this.answerSealed) {
        closeOverlayBitmap(bitmap);
        return;
      }
      try {
        this.session.ingestVision({ atMs: message.timestampMs, geometry: message.geometry, inferenceMs: pipelineMs, expectedFrameMs: message.expectedFrameMs });
        if (pipelineMs > 180) this.targetFps = Math.max(2, this.targetFps - 2);
        else if (pipelineMs < 70 && this.targetFps < 8) this.targetFps += 1;
        const live = this.visionLiveState();
        const overlayMaskPresent = typeof message.overlayLayers?.face === 'boolean' && typeof message.overlayLayers?.body === 'boolean';
        const overlayMaskMatches = message.overlayLayers?.face === this.overlayFaceEnabled
          && message.overlayLayers?.body === this.overlayBodyEnabled;
        const overlayRequestMatches = Boolean(message.overlayRequested) === Boolean(this.overlayEnabled && (this.overlayFaceEnabled || this.overlayBodyEnabled));
        const overlayConfigurationMatches = overlayMaskMatches && overlayRequestMatches;
        const overlayMetadata = overlayMaskPresent && !overlayConfigurationMatches
          ? Object.freeze({ overlayStatus: 'unavailable', overlayUnavailableReason: 'layer_mask_changed', overlayErrorCode: null, overlayErrorMessage: null })
          : normalizeOverlayFrameMetadata(message);
        const overlayDisplayEligible = Boolean(bitmap
          && message.overlayRendered
          && overlayConfigurationMatches
          && overlayMetadata.overlayStatus === 'rendered');
        this.notifyOverlayConsumer({
          bitmap: overlayDisplayEligible ? bitmap : null,
          geometry: message.geometry,
          atMs: message.timestampMs,
          primitiveCount: message.overlayPrimitiveCount,
          pipelineMs,
          ...overlayMetadata,
        });
        if (overlayMetadata.overlayStatus === 'error') {
          if (!this.overlayRendererErrorActive) this.dispatch('state', {
            state: 'partial', subsystem: 'overlay-display', atMs: message.timestampMs,
            message: 'Local overlay rendering is unavailable; analytics continued.',
            ...overlayMetadata,
          });
          this.overlayRendererErrorActive = true;
        } else if (overlayMetadata.overlayStatus === 'rendered') this.overlayRendererErrorActive = false;
        this.dispatch('diagnostic', {
          modality: 'vision', atMs: message.timestampMs, geometry: message.geometry, live,
          overlayRequested: Boolean(message.overlayRequested), overlayRendered: overlayDisplayEligible,
          overlayPrimitiveCount: Number.isFinite(message.overlayPrimitiveCount) ? message.overlayPrimitiveCount : 0,
          ...overlayMetadata,
          inferenceMs: pipelineMs,
          faceInferenceMs: Number.isFinite(message.faceInferenceMs) ? message.faceInferenceMs : null,
          holisticInferenceMs: Number.isFinite(message.holisticInferenceMs) ? message.holisticInferenceMs : null,
          targetFps: this.targetFps, droppedFrames: this.droppedFrames,
        });
      } catch (error) {
        this.notifyOverlayConsumer({ bitmap: null, geometry: null, atMs: message.timestampMs, primitiveCount: 0, pipelineMs });
        this.recordWorkerError(`vision frame rejected: ${error?.message || error}`);
        this.dispatch('state', {
          state: 'partial', subsystem: 'vision',
          atMs: Number.isFinite(message.timestampMs) ? message.timestampMs : this.session.clock.sessionMs(),
          message: 'A visual frame was rejected by local validation.',
        });
      } finally {
        closeOverlayBitmap(bitmap);
      }
      return;
    }
    if (message.type === 'frame-error') {
      const inFlight = this.inFlightVision;
      const matchesFrame = Boolean(inFlight
        && inFlight.generation === generation
        && inFlight.answerEpoch === message.answerEpoch
        && inFlight.visionEpoch === message.visionEpoch
        && inFlight.frameId === message.frameId
        && inFlight.timestampMs === message.timestampMs);
      if (!matchesFrame) return;
      const pipelineMs = Number(Math.max(0, this.now() - inFlight.captureStartedAt).toFixed(2));
      this.clearVisionFrameWatchdog();
      this.inFlightVision = null;
      this.frameInFlight = false;
      this.recordWorkerError(message.message);
      this.notifyOverlayConsumer({ bitmap: null, geometry: null, atMs: message.timestampMs, primitiveCount: 0, pipelineMs });
      this.dispatch('diagnostic', { modality: 'vision', atMs: message.timestampMs, geometry: null, live: null, overlayRequested: this.overlayEnabled, overlayRendered: false, overlayPrimitiveCount: 0, inferenceMs: pipelineMs, targetFps: this.targetFps, droppedFrames: this.droppedFrames });
      if (this.answer && !this.answerSealed && Number.isFinite(message.timestampMs)) this.session.ingestVision({
        atMs: message.timestampMs,
        expectedFrameMs: message.expectedFrameMs,
        inferenceMs: pipelineMs,
        geometry: null,
      });
      return;
    }
    if (message.type === 'init-error') {
      this.failVisionWorker(message.message || 'vision initialization failed');
    }
  }

  visionLiveState() {
    const trackers = this.session?.vision?.trackers;
    if (!trackers) return null;
    const gestureActive = trackers.handBoth?.activeAt !== null
      ? 'both'
      : trackers.handLeft?.activeAt !== null
        ? 'left'
        : trackers.handRight?.activeAt !== null
          ? 'right'
          : null;
    return Object.freeze({
      gestureActive,
      headTurnActive: trackers.turned?.activeAt !== null,
      postureMovementActive: trackers.lean?.activeAt !== null || trackers.sway?.activeAt !== null,
      facialMovementActive: trackers.faceMove?.activeAt !== null,
    });
  }

  invalidateVision(reason, { subsystem = 'vision', atMs = this.answer ? this.session.clock.sessionMs() : null } = {}) {
    this.visionEpoch += 1;
    this.clearPendingVision();
    this.clearVisionFrameWatchdog();
    this.inFlightVision = null;
    this.frameInFlight = false;
    this.notifyOverlayConsumer({ bitmap: null, geometry: null, atMs, primitiveCount: 0, pipelineMs: null });
    this.dispatch('state', { state: 'partial', subsystem, atMs, message: reason });
  }

  markVisionUnavailable(reason) {
    if (this.answer && this.visionDisconnectedAt === null) this.visionDisconnectedAt = this.session.clock.sessionMs();
    this.invalidateVision(reason);
  }

  failVisionWorker(message) {
    this.recordWorkerError(message);
    this.markVisionUnavailable('vision_worker_unavailable');
    clearTimeout(this.faceInitTimer);
    this.faceInitTimer = null;
    if (this.worker) this.worker.terminate();
    if (this.faceWorker) this.faceWorker.terminate();
    this.worker = null;
    this.faceWorker = null;
    this.workerReady = false;
    this.faceWorkerReady = false;
    this.multiFaceProtection = false;
    this.clearPendingVision();
    this.clearVisionFrameWatchdog();
    this.inFlightVision = null;
    this.generation += 1;
  }

  failFaceWorker(message) {
    clearTimeout(this.faceInitTimer);
    this.faceInitTimer = null;
    this.recordWorkerError(`multi-face protection: ${message}`);
    if (this.faceWorker) this.faceWorker.terminate();
    this.faceWorker = null;
    this.faceWorkerReady = false;
    this.multiFaceProtection = false;
    const pending = this.pendingVisionFrame;
    if (pending) this.forwardPendingVision(null, pending.generation, pending.answerEpoch, pending.visionEpoch, pending.frameId, pending.timestampMs, null);
    this.dispatch('state', {
      state: 'partial', subsystem: 'multi-face-protection',
      atMs: this.answer ? this.session.clock.sessionMs() : null,
      message: 'Person-specific visual analytics are unavailable.',
    });
  }

  onVisibilityChange() {
    if (!this.answer || this.answerSealed) return;
    const at = this.session.clock.sessionMs();
    if (document.hidden) {
      this.hiddenAt = at;
      this.invalidateVision('document_hidden', { subsystem: 'all', atMs: at });
    }
    else if (this.hiddenAt !== null) {
      this.session.observationGap({ startMs: this.hiddenAt, endMs: at, reason: 'document_hidden', modality: 'all' });
      this.hiddenAt = null;
    }
  }

  prepareEnd(endAt = this.now()) {
    if (!this.answer) return null;
    if (this.answerSealed) return this.sealedEndAt;
    if (!Number.isFinite(endAt)) throw new TypeError('Analytics end timestamp must be finite.');
    this.answerSealed = true;
    this.sealedEndAt = endAt;
    const endSessionMs = this.session.clock.sessionMs(endAt);
    if (this.hiddenAt !== null) this.session.observationGap({ startMs: this.hiddenAt, endMs: endSessionMs, reason: 'document_hidden', modality: 'all' });
    this.hiddenAt = null;
    if (this.audioDisconnectedAt !== null) this.session.observationGap({ startMs: this.audioDisconnectedAt, endMs: endSessionMs, reason: 'microphone_or_audio_context_disconnected', modality: 'audio' });
    this.audioDisconnectedAt = null;
    if (this.visionDisconnectedAt !== null) this.session.observationGap({ startMs: this.visionDisconnectedAt, endMs: endSessionMs, reason: 'camera_or_vision_disconnected', modality: 'vision' });
    this.visionDisconnectedAt = null;
    this.stopSampling({ terminateWorker: false });
    return endAt;
  }

  endAnswer({ transcript = '', mediaAvailable = false, endAt = undefined } = {}) {
    if (!this.answer) return null;
    if (!this.answerSealed) this.prepareEnd(endAt ?? this.now());
    const finalEndAt = this.sealedEndAt;
    let result = null;
    try {
      result = this.session.endAnswer({ transcript, mediaAvailable, endAt: finalEndAt, blockedExternalAttemptCount: this.blockedEgressAttempts });
      this.dispatch('state', { state: 'complete', result });
    } catch (error) {
      this.recordWorkerError(`finalization: ${error?.message || error}`);
      this.session.audio.reset();
      this.session.vision.reset();
      this.session.active = null;
      this.dispatch('state', { state: 'partial', subsystem: 'finalization', message: 'Analytics result was withheld after local validation failed.' });
    } finally {
      this.answer = null;
      this.answerSealed = false;
      this.sealedEndAt = null;
    }
    return result;
  }

  abandonAnswer(reason = 'abandoned') {
    if (!this.answer) return false;
    this.stopSampling({ terminateWorker: false });
    this.session.observationGap({ startMs: this.answer.startedAtMs, endMs: this.session.clock.sessionMs(), reason });
    this.session.abandonAnswer();
    this.answer = null;
    this.answerSealed = false;
    this.sealedEndAt = null;
    this.hiddenAt = null;
    this.audioDisconnectedAt = null;
    this.visionDisconnectedAt = null;
    this.dispatch('state', { state: 'idle', reason });
    return true;
  }

  stopSampling({ terminateWorker = false } = {}) {
    clearInterval(this.audioTimer);
    clearTimeout(this.visionTimer);
    this.audioTimer = null;
    this.visionTimer = null;
    this.clearPendingVision();
    this.clearVisionFrameWatchdog();
    this.inFlightVision = null;
    this.frameInFlight = false;
    this.visionEpoch += 1;
    if (terminateWorker && (this.worker || this.faceWorker)) {
      clearTimeout(this.faceInitTimer);
      this.faceInitTimer = null;
      this.worker?.terminate?.();
      this.faceWorker?.terminate?.();
      this.generation += 1;
      this.worker = null;
      this.faceWorker = null;
      this.workerReady = false;
      this.faceWorkerReady = false;
      this.multiFaceProtection = null;
    }
  }

  resetSession() {
    if (this.answer) this.abandonAnswer('session_reset');
    this.stopSampling({ terminateWorker: true });
    this.session = null;
    this.droppedFrames = 0;
    this.frameId = 0;
    this.targetFps = 8;
    this.hiddenAt = null;
    this.visionDisconnectedAt = null;
    this.audioDisconnectedAt = null;
    this.workerErrors = [];
    this.blockedEgressAttempts = 0;
    this.overlayRendererErrorActive = false;
  }

  destroy() {
    if (this.answer) this.abandonAnswer('destroyed');
    this.stopSampling({ terminateWorker: true });
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.session = null;
  }

  faceDetectorStatus() {
    if (this.faceWorker && this.faceWorkerReady && this.multiFaceProtection === true) return 'ready';
    if (this.faceWorker) return 'initializing';
    if (this.multiFaceProtection === false || this.faceWorkerReady || this.multiFaceProtection === true) return 'unavailable';
    return 'idle';
  }

  diagnostics() {
    return Object.freeze({
      sessionId: this.session?.sessionId || null,
      active: Boolean(this.answer),
      workerReady: this.workerReady,
      faceWorkerReady: this.faceWorkerReady,
      faceDetectorStatus: this.faceDetectorStatus(),
      multiFaceProtection: this.multiFaceProtection,
      targetFps: this.targetFps,
      droppedFrames: this.droppedFrames,
      workerErrors: [...this.workerErrors],
      blockedEgressAttempts: this.blockedEgressAttempts,
      audioFrameCount: this.session?.audio?.validFrames || 0,
      visualFrameCount: this.session?.vision?.analyzableFrames || 0,
      networkPolicy: 'same-origin-only-worker-guard-and-csp',
      overlayLayers: Object.freeze({ enabled: this.overlayEnabled, face: this.overlayFaceEnabled, body: this.overlayBodyEnabled }),
      overlayRendererErrorActive: this.overlayRendererErrorActive,
    });
  }

  recordWorkerError(value) {
    this.workerErrors.push(String(value || 'analytics error').slice(0, 1_000));
    if (this.workerErrors.length > 20) this.workerErrors.splice(0, this.workerErrors.length - 20);
  }

  dispatch(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
