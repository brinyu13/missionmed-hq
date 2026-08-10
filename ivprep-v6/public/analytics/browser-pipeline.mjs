import { AnalyticsSession } from './analytics-session.mjs';
import { measurePcmFrame } from './audio-signal.mjs';

const VENDOR_ROOT = '/vendor/mediapipe/tasks-vision/1.0.1';
const HOLISTIC_MODEL = '/vendor/mediapipe/models/holistic_landmarker/float16/1/holistic_landmarker.task';
const FACE_MODEL = '/vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite';

function randomId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
}

export class BrowserAnalyticsPipeline extends EventTarget {
  constructor({ bridge, now = () => performance.now() } = {}) {
    super();
    if (!bridge) throw new TypeError('V6Bridge is required.');
    this.bridge = bridge;
    this.now = now;
    this.generation = 0;
    this.answerEpoch = 0;
    this.session = null;
    this.answer = null;
    this.answerSealed = false;
    this.sealedEndAt = null;
    this.audioTimer = null;
    this.visionTimer = null;
    this.worker = null;
    this.workerReady = false;
    this.multiFaceProtection = null;
    this.frameInFlight = false;
    this.frameId = 0;
    this.targetFps = 8;
    this.droppedFrames = 0;
    this.workerErrors = [];
    this.blockedEgressAttempts = 0;
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

  beginAnswer({ answerId = null, mediaId = null, mediaStartedAt = null, videoElement = null } = {}) {
    if (this.answer) this.abandonAnswer('superseded');
    this.answerEpoch += 1;
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
      const media = this.bridge.media || {};
      const audioLive = Boolean(media.mic && media.AC?.state === 'running' && media.stream?.getAudioTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
      if (!audioLive || !media.analyser || !media.data) {
        if (this.audioDisconnectedAt === null) this.audioDisconnectedAt = this.session.clock.sessionMs();
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
        modality: 'audio', ...measured,
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
      this.worker = new Worker('/analytics/holistic-worker.mjs', { type: 'module', name: `communication-analytics-${generation}` });
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
        faceDetectorModelUrl: FACE_MODEL,
      });
    } else this.worker.postMessage({ type: 'reset', generation, answerEpoch });
    const schedule = () => {
      if (!this.answer || this.answerSealed || generation !== this.generation || answerEpoch !== this.answerEpoch) return;
      const delay = Math.round(1_000 / this.targetFps);
      this.visionTimer = setTimeout(async () => {
        if (!this.answer || this.answerSealed || generation !== this.generation || answerEpoch !== this.answerEpoch) return;
        const media = this.bridge.media || {};
        const cameraLive = Boolean(media.cam && media.stream?.getVideoTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
        if (!cameraLive) {
          this.markVisionUnavailable('camera_disconnected');
          return;
        }
        if (!document.hidden && this.workerReady && !this.frameInFlight && video.readyState >= 2 && video.videoWidth > 0) {
          try {
            this.frameInFlight = true;
            const bitmap = await createImageBitmap(video, { resizeWidth: 480, resizeHeight: 270, resizeQuality: 'medium' });
            if (!this.answer || this.answerSealed || generation !== this.generation || answerEpoch !== this.answerEpoch) {
              bitmap.close();
              this.frameInFlight = false;
            } else {
              const timestampMs = this.session.clock.sessionMs();
              this.worker.postMessage({ type: 'frame', generation, answerEpoch, frameId: ++this.frameId, timestampMs, expectedFrameMs: delay, bitmap }, [bitmap]);
            }
          } catch (error) {
            this.frameInFlight = false;
            this.recordWorkerError(error?.message || error);
          }
        } else if (this.frameInFlight) this.droppedFrames += 1;
        schedule();
      }, delay);
    };
    schedule();
  }

  onWorkerMessage(message, generation) {
    if (generation !== this.generation || message.generation !== generation) return;
    if (message.type !== 'init-error' && message.answerEpoch !== undefined && message.answerEpoch !== this.answerEpoch) return;
    if (message.type === 'egress-blocked') {
      this.blockedEgressAttempts += Math.max(1, Number(message.count) || 1);
      this.dispatch('state', { state: 'privacy-guard', blockedEgressAttempts: this.blockedEgressAttempts });
      return;
    }
    if (message.type === 'ready') {
      this.workerReady = true;
      this.multiFaceProtection = Boolean(message.multiFaceProtection);
      this.dispatch('state', { state: 'vision-ready', multiFaceProtection: message.multiFaceProtection });
      return;
    }
    if (message.type === 'geometry') {
      this.frameInFlight = false;
      if (!this.answer || this.answerSealed) return;
      this.session.ingestVision({ atMs: message.timestampMs, geometry: message.geometry, inferenceMs: message.inferenceMs, expectedFrameMs: message.expectedFrameMs });
      if (message.inferenceMs > 180) this.targetFps = Math.max(2, this.targetFps - 2);
      else if (message.inferenceMs < 70 && this.targetFps < 8) this.targetFps += 1;
      this.dispatch('diagnostic', { modality: 'vision', geometry: message.geometry, inferenceMs: message.inferenceMs, targetFps: this.targetFps, droppedFrames: this.droppedFrames });
      return;
    }
    if (message.type === 'frame-error') {
      this.frameInFlight = false;
      this.recordWorkerError(message.message);
      if (this.answer && !this.answerSealed && Number.isFinite(message.timestampMs)) this.session.ingestVision({
        atMs: message.timestampMs,
        expectedFrameMs: message.expectedFrameMs,
        geometry: { faceCount: null, face: { present: false }, pose: { torsoPresent: false }, hands: {} },
      });
      return;
    }
    if (message.type === 'init-error') {
      this.failVisionWorker(message.message || 'vision initialization failed');
    }
  }

  markVisionUnavailable(reason) {
    if (this.answer && this.visionDisconnectedAt === null) this.visionDisconnectedAt = this.session.clock.sessionMs();
    this.frameInFlight = false;
    this.dispatch('state', { state: 'partial', subsystem: 'vision', message: reason });
  }

  failVisionWorker(message) {
    this.recordWorkerError(message);
    this.markVisionUnavailable('vision_worker_unavailable');
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.workerReady = false;
    this.multiFaceProtection = null;
    this.generation += 1;
  }

  onVisibilityChange() {
    if (!this.answer || this.answerSealed) return;
    const at = this.session.clock.sessionMs();
    if (document.hidden) this.hiddenAt = at;
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
    this.frameInFlight = false;
    if (terminateWorker && this.worker) {
      const worker = this.worker;
      worker.terminate();
      this.generation += 1;
      this.worker = null;
      this.workerReady = false;
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
  }

  destroy() {
    if (this.answer) this.abandonAnswer('destroyed');
    this.stopSampling({ terminateWorker: true });
    document.removeEventListener('visibilitychange', this.boundVisibility);
    this.session = null;
  }

  diagnostics() {
    return Object.freeze({
      sessionId: this.session?.sessionId || null,
      active: Boolean(this.answer),
      workerReady: this.workerReady,
      multiFaceProtection: this.multiFaceProtection,
      targetFps: this.targetFps,
      droppedFrames: this.droppedFrames,
      workerErrors: [...this.workerErrors],
      blockedEgressAttempts: this.blockedEgressAttempts,
      audioFrameCount: this.session?.audio?.validFrames || 0,
      visualFrameCount: this.session?.vision?.analyzableFrames || 0,
      networkPolicy: 'same-origin-only-worker-guard-and-csp',
    });
  }

  recordWorkerError(value) {
    this.workerErrors.push(String(value || 'analytics error').slice(0, 180));
    if (this.workerErrors.length > 20) this.workerErrors.splice(0, this.workerErrors.length - 20);
  }

  dispatch(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
