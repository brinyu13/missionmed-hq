import { AnalyticsSession } from './analytics-session.mjs';
import { AudioWorkletPcmCapture } from './audio-worklet-capture.mjs';
import { measurePcmFrame } from './audio-signal.mjs';
import { FaceFamily } from './face-family.mjs';
import { KWeightedLoudness } from './k-weighted-loudness.mjs';
import {
  DEFAULT_CLARITY_THRESHOLD,
  F0_MAX_HZ,
  F0_MIN_HZ,
  PitchTrack,
  estimateF0,
} from './pitch-f0.mjs';
import { EstimatedSyllableRate } from './syllable-rate.mjs';
import { SileroVadLane, VadHysteresis } from './vad-silero.mjs';

const IVPREP_ASSET_ROOT = '/iv-prep-on-call/assets';
const VENDOR_ROOT = `${IVPREP_ASSET_ROOT}/vendor/mediapipe/tasks-vision/1.0.1`;
const HOLISTIC_MODEL = `${IVPREP_ASSET_ROOT}/vendor/mediapipe/models/holistic_landmarker/float16/1/holistic_landmarker.task`;
const FACE_MODEL = `${IVPREP_ASSET_ROOT}/vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite`;
const ANALYTICS_ROOT = `${IVPREP_ASSET_ROOT}/analytics`;
const FACE_WORKER = `${ANALYTICS_ROOT}/face-detector-worker.mjs`;
const WORKER_REVISION = '3522c-primary-face-association-1';
const FACE_INITIALIZATION_TIMEOUT_MS = 10_000;
const HOLISTIC_FRAME_TIMEOUT_MIN_MS = 1_000;
const HOLISTIC_FRAME_TIMEOUT_MAX_MS = 5_000;
// Overlay cadence. The Founder-reported lag came from the FLOOR: under load targetFps
// degraded to 2, a 500ms overlay interval, which reads as detached even though frames
// are never queued (capture is skipped while one is in flight, so landmarks are never
// stale-by-queueing). The floor is now 8 - a 125ms interval - so the overlay cannot
// collapse.
//
// The ceiling stays at the previous default of 8 deliberately: several epoch tests
// assert exact frame counts under fake timers and are coupled to this cadence. Raising
// the ceiling is a real latency win but requires updating those tests, so it is left
// for a follow-up rather than bent to fit here.
const VISION_MIN_FPS = 8;
const VISION_MAX_FPS = 8;

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

export function transcriptPcmFrame({ atMs, sampleRate, samples, speaking, speechProbability, f0, method = 'AUDIO_WORKLET_PCM' } = {}) {
  return Object.freeze({
    atMs,
    sampleRate: Number(sampleRate),
    samples,
    speaking: speaking === true,
    // This is acoustic evidence only. It never becomes a word or WPM without
    // the local recognizer's separately observed word timestamps.
    voiced: f0?.voiced === true,
    speechProbability: Number.isFinite(speechProbability) ? Number(speechProbability) : null,
    provenance: Object.freeze({ source: 'MICROPHONE', method }),
  });
}

// Silero remains the primary speech gate. A validated periodic F0 is a bounded
// acoustic rescue when the model starts late or momentarily drops voiced speech.
// This does not create words, WPM, or pitch: it only admits the same real PCM frame
// to the K-weighted speech-loudness accumulator when the independent F0 cartridge
// has already proved that the frame contains an in-range periodic human-voice
// candidate at its normal confidence threshold.
export function advancedSpeechEvidence({ sileroState = null, f0 = null } = {}) {
  const sileroSpeaking = sileroState?.speaking === true;
  const validatedPeriodicF0 = f0?.voiced === true
    && Number.isFinite(f0?.f0Hz)
    && f0.f0Hz >= F0_MIN_HZ
    && f0.f0Hz <= F0_MAX_HZ
    && Number.isFinite(f0?.confidence)
    && f0.confidence >= DEFAULT_CLARITY_THRESHOLD;
  return Object.freeze({
    speaking: sileroSpeaking || validatedPeriodicF0,
    sileroSpeaking,
    validatedPeriodicF0,
    method: sileroSpeaking
      ? 'SILERO_V5_LOCAL_ONNX'
      : validatedPeriodicF0
        ? 'VALIDATED_PERIODIC_F0_RESCUE'
        : sileroState
          ? 'SILERO_V5_LOCAL_ONNX'
          : 'NO_VALIDATED_SPEECH_EVIDENCE',
  });
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
    this.faceOverlayEnabled = true;
    this.bodyHandsOverlayEnabled = true;
    this.overlayConsumer = null;
    this.pcmConsumer = null;
    // Y1-Y2-CAM-V6-3504: FACE is a family, not one lane. Derives its cartridges from
    // the blendshape categories the worker now forwards.
    this.faceFamily = new FaceFamily();
    this.faceBaselineCapturing = false;
    // Y1-Y2-CAM-V6-3505: real microphone-derived F0. Speaker-relative by law - the
    // track reports semitones against this speaker's own rolling median, never a
    // universal target Hz.
    this.pitchTrack = new PitchTrack();
    this.pitchCalibrationCapturing = false;
    this.audioWorkletCapture = null;
    this.sileroVadLane = null;
    this.vadHysteresis = new VadHysteresis();
    this.sileroState = null;
    this.advancedAudio = null;
    this.advancedAudioStatus = 'idle';
    this.kWeightedLoudness = null;
    this.estimatedSyllableRate = new EstimatedSyllableRate();
    this.lastPrimaryLock = null;
    this.visionSourceMode = 'camera';
    this.visionVideo = null;
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

  setInstrumentation({
    overlayEnabled = false,
    faceOverlayEnabled = true,
    bodyHandsOverlayEnabled = true,
    handsOverlayEnabled = bodyHandsOverlayEnabled,
    bodyOverlayEnabled = bodyHandsOverlayEnabled,
    framingOverlayEnabled = faceOverlayEnabled,
  } = {}) {
    this.overlayEnabled = Boolean(overlayEnabled);
    this.faceOverlayEnabled = Boolean(faceOverlayEnabled);
    this.bodyHandsOverlayEnabled = Boolean(bodyHandsOverlayEnabled);
    this.handsOverlayEnabled = Boolean(handsOverlayEnabled);
    this.bodyOverlayEnabled = Boolean(bodyOverlayEnabled);
    this.framingOverlayEnabled = Boolean(framingOverlayEnabled);
    this.worker?.postMessage?.({
      type: 'instrumentation',
      generation: this.generation,
      overlayEnabled: this.overlayEnabled,
      faceOverlayEnabled: this.faceOverlayEnabled,
      bodyHandsOverlayEnabled: this.bodyHandsOverlayEnabled,
      handsOverlayEnabled: this.handsOverlayEnabled,
      bodyOverlayEnabled: this.bodyOverlayEnabled,
      framingOverlayEnabled: this.framingOverlayEnabled,
    });
  }

  setOverlayConsumer(consumer = null) {
    if (consumer !== null && typeof consumer !== 'function') throw new TypeError('Overlay consumer must be a function or null.');
    this.overlayConsumer = consumer;
  }

  setPcmConsumer(consumer = null) {
    if (consumer !== null && typeof consumer !== 'function') throw new TypeError('PCM consumer must be a function or null.');
    this.pcmConsumer = consumer;
  }

  beginAnswer({ answerId = null, mediaId = null, mediaStartedAt = null, videoElement = null } = {}) {
    if (this.answer) this.abandonAnswer('superseded');
    this.visionSourceMode = 'camera';
    this.visionVideo = null;
    this.answerEpoch += 1;
    this.visionEpoch += 1;
    this.answerSealed = false;
    this.sealedEndAt = null;
    const media = this.bridge.media || {};
    // Y1-Y2-CAM-V6-3510 — SAFARI GATE.
    //
    // Two conditions here silently disabled all audio in WebKit while the camera
    // worked perfectly, which is exactly the reported "UNAVAILABLE - NO AUDIO" with a
    // selected microphone and granted permission:
    //
    //   track.muted !== true
    //     MediaStreamTrack.muted is NOT a user mute. Per spec it means "temporarily
    //     not producing data", and WebKit reports muted===true on a freshly acquired
    //     microphone until samples actually begin flowing. Requiring it to be false
    //     before we start sampling is a deadlock: we never sample, so data never
    //     flows, so muted never clears. Liveness is now readyState + enabled, and the
    //     transient muted state is tolerated.
    //
    //   AC.state === 'running'
    //     Kept, but the context is now created and resumed synchronously inside the
    //     user gesture (see primeAudioContext in studio.mjs). Creating it after the
    //     media-acquisition await left it permanently 'suspended' in WebKit, because
    //     user activation does not survive that await.
    const hasMic = Boolean(media.mic && media.AC?.state === 'running' && media.analyser && media.data && media.stream?.getAudioTracks?.().some((track) => track.readyState === 'live' && track.enabled));
    const video = videoElement || document.getElementById('pipvid') || document.getElementById('stationvid');
    // A fresh camera track may be temporarily muted before its first frame. Start
    // the bounded vision scheduler from track ownership/liveness; per-frame capture
    // still fails closed in visionSourceIsLive() until the track actually unmutes.
    const hasCamera = Boolean(media.cam && media.stream?.getVideoTracks?.().some((track) => track.readyState === 'live' && track.enabled) && video);
    const session = this.ensureSession();
    this.answer = session.beginAnswer({ answerId: answerId || randomId('answer'), hasMic, hasCamera, mediaId, mediaStartedAt });
    this.faceFamily.reset();
    this.faceBaselineCapturing = false;
    this.pitchTrack.reset({ preserveCalibration: true });
    this.pitchCalibrationCapturing = false;
    this.hiddenAt = document.hidden ? this.answer.startedAtMs : null;
    this.visionDisconnectedAt = null;
    this.audioDisconnectedAt = null;
    try {
      if (hasMic) {
        this.startAudio();
        void this.startAdvancedAudio();
      }
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

  beginPlayback({ videoElement = null } = {}) {
    if (!videoElement || !Number.isFinite(videoElement.readyState)) throw new TypeError('A playback video element is required.');
    if (this.answer) this.abandonAnswer('playback_superseded');
    this.answerEpoch += 1;
    this.visionEpoch += 1;
    this.answerSealed = false;
    this.sealedEndAt = null;
    this.session = new AnalyticsSession({ sessionId: randomId('communication-playback'), now: this.now });
    this.visionSourceMode = 'playback';
    this.visionVideo = videoElement;
    this.answer = this.session.beginAnswer({ answerId: randomId('playback'), hasMic: false, hasCamera: true });
    this.hiddenAt = document.hidden ? this.answer.startedAtMs : null;
    this.visionDisconnectedAt = null;
    this.audioDisconnectedAt = null;
    try {
      this.startVision(videoElement);
    } catch (error) {
      this.stopSampling({ terminateWorker: true });
      this.session.abandonAnswer();
      this.answer = null;
      this.session = null;
      this.visionSourceMode = 'camera';
      this.visionVideo = null;
      throw error;
    }
    this.dispatch('state', { state: 'running', hasMic: false, hasCamera: true, ephemeralPlayback: true, ...this.answer });
    return this.answer;
  }

  endPlayback(reason = 'playback_stopped') {
    if (this.visionSourceMode !== 'playback' || !this.answer) return false;
    this.stopSampling({ terminateWorker: false });
    this.session.abandonAnswer();
    this.answer = null;
    this.session = null;
    this.answerSealed = false;
    this.sealedEndAt = null;
    this.hiddenAt = null;
    this.visionDisconnectedAt = null;
    this.audioDisconnectedAt = null;
    this.visionSourceMode = 'camera';
    this.visionVideo = null;
    this.dispatch('state', { state: 'idle', reason, ephemeralPlayback: true });
    return true;
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
      const atMs = this.session.clock.sessionMs();
      media.analyser.getFloatTimeDomainData(media.data);
      const fallbackMeasured = measurePcmFrame(media.data);
      const advanced = this.advancedAudio && atMs - this.advancedAudio.atMs <= 250
        ? this.advancedAudio
        : null;
      const measured = advanced?.measured || fallbackMeasured;
      this.session.ingestAudio({ atMs, ...measured });
      // F0 is computed from the same PCM frame the level meter uses, but by
      // periodicity - never derived from RMS. An unvoiced or low-clarity frame
      // contributes nothing and reports no number.
      const analyzer = this.session.audio;
      let deviceProcessing = Object.freeze({ requested: 'UNPROCESSED', actual: 'UNKNOWN' });
      try {
        const settings = media.microphoneTrack?.getSettings?.() || {};
        deviceProcessing = Object.freeze({
          requested: 'UNPROCESSED',
          actual: Object.freeze({
            echoCancellation: settings.echoCancellation ?? null,
            noiseSuppression: settings.noiseSuppression ?? null,
            autoGainControl: settings.autoGainControl ?? null,
            channelCount: settings.channelCount ?? null,
          }),
        });
      } catch {}
      const sampleRate = Number(media.AC?.sampleRate) || 48000;
      const f0 = advanced?.f0 || estimateF0(media.data, sampleRate);
      if (!advanced) this.pitchTrack.push(f0, { speaking: analyzer.speaking });
      const pitchSummary = advanced?.pitchSummary || this.pitchTrack.summary();
      // The authenticated Sherpa timing lane must receive genuine microphone PCM
      // even when AudioWorklet/Silero is unavailable or still initializing. The
      // legacy AnalyserNode is already the real level-meter source; copy its
      // current time-domain frame so the downstream producer can build bounded
      // timing windows without retaining or fabricating transcript content.
      // Once fresh AudioWorklet frames exist, that higher-fidelity lane owns PCM
      // delivery and this fallback stays silent, preventing duplicate samples.
      if (!advanced && this.pcmConsumer) {
        try {
          this.pcmConsumer(transcriptPcmFrame({
            atMs,
            sampleRate,
            samples: new Float32Array(media.data),
            speaking: analyzer.speaking,
            speechProbability: null,
            f0,
            method: 'ANALYSER_PCM_FALLBACK',
          }));
        } catch (error) {
          this.recordWorkerError(`PCM consumer fallback: ${error?.message || error}`);
        }
      }
      this.dispatch('diagnostic', {
        modality: 'audio', atMs, available: true, ...measured,
        pitch: Object.freeze({
          f0Hz: f0.voiced ? f0.f0Hz : null,
          voiced: f0.voiced,
          clarity: f0.confidence,
          // Fails closed: until enough voiced audio exists the summary is
          // unavailable and the UI must render PITCH - UNAVAILABLE.
          summary: pitchSummary,
        }),
        speaking: analyzer.speaking,
        vad: advanced?.vad || Object.freeze({
          available: false,
          reason: this.advancedAudioStatus === 'failed' ? 'SILERO_V5_UNAVAILABLE' : 'SILERO_V5_INITIALIZING',
          provenance: Object.freeze({ source: 'MICROPHONE', method: 'LEGACY_LEVEL_VAD_FALLBACK' }),
        }),
        loudness: advanced?.loudness || this.kWeightedLoudness?.summary?.() || Object.freeze({ available: false, reason: 'LUFS_K_INITIALIZING' }),
        estimatedSyllableRate: advanced?.estimatedSyllableRate || this.estimatedSyllableRate.snapshot(),
        captureMethod: advanced ? 'AUDIO_WORKLET_PCM' : 'ANALYSER_FALLBACK',
        deviceProcessing,
        pauseInProgressMs: analyzer.hasSpoken && !analyzer.speaking && analyzer.candidateSilenceStartMs !== null ? Math.max(0, atMs - analyzer.candidateSilenceStartMs) : 0,
        frameCount: analyzer.validFrames,
      });
    };
    tick();
    this.audioTimer = setInterval(tick, 50);
  }

  async startAdvancedAudio() {
    this.stopAdvancedAudio();
    const media = this.bridge.media || {};
    if (!this.answer || !media.AC || !this.bridge.source || !this.bridge.sink || !media.stream) return false;
    this.advancedAudioStatus = 'initializing';
    this.vadHysteresis.reset();
    this.sileroState = null;
    this.advancedAudio = null;
    this.kWeightedLoudness = new KWeightedLoudness({ sampleRate: Number(media.AC.sampleRate) || 48_000 });
    this.estimatedSyllableRate.reset();
    const capture = new AudioWorkletPcmCapture({
      onFrame: (frame) => this.onAdvancedPcmFrame(frame),
    });
    this.audioWorkletCapture = capture;
    try {
      await capture.start({ context: media.AC, source: this.bridge.source, sink: this.bridge.sink });
      if (!this.answer || this.audioWorkletCapture !== capture) {
        capture.stop();
        return false;
      }
      const vadLane = new SileroVadLane({
        onFrame: (frame) => this.onSileroFrame(frame),
      });
      this.sileroVadLane = vadLane;
      await vadLane.start({ stream: media.stream, audioContext: media.AC });
      if (!this.answer || this.sileroVadLane !== vadLane) {
        await vadLane.stop();
        return false;
      }
      this.advancedAudioStatus = 'ready';
      this.dispatch('state', { state: 'audio-worklet-ready', vad: 'SILERO_V5', loudness: 'LUFS_K' });
      return true;
    } catch (error) {
      if (this.audioWorkletCapture === capture) capture.stop();
      this.audioWorkletCapture = null;
      if (this.sileroVadLane) void this.sileroVadLane.stop().catch(() => {});
      this.sileroVadLane = null;
      this.advancedAudioStatus = 'failed';
      this.recordWorkerError(`advanced audio: ${error?.message || error}`);
      this.dispatch('state', {
        state: 'partial',
        subsystem: 'advanced-audio',
        atMs: this.answer ? this.session.clock.sessionMs() : null,
        message: 'AudioWorklet/Silero unavailable; legacy local DSP remains active.',
      });
      return false;
    }
  }

  onSileroFrame(frame) {
    if (!this.answer || !Number.isFinite(frame?.speechProbability)) return;
    const atMs = this.session.clock.sessionMs();
    this.sileroState = this.vadHysteresis.ingest({ atMs, speechProbability: frame.speechProbability });
  }

  onAdvancedPcmFrame(frame) {
    if (!this.answer || !(frame?.samples instanceof Float32Array)) return;
    const atMs = this.session.clock.sessionMs();
    const measured = measurePcmFrame(frame.samples);
    const f0 = estimateF0(frame.samples, frame.sampleRate);
    const speechEvidence = advancedSpeechEvidence({ sileroState: this.sileroState, f0 });
    const speaking = speechEvidence.speaking;
    this.pitchTrack.push(f0, { speaking });
    const loudness = this.kWeightedLoudness.ingest(frame.samples, { speaking });
    const db = measured.rms > 0 ? 20 * Math.log10(measured.rms) : -96;
    const estimatedSyllableRate = this.estimatedSyllableRate.ingest({ atMs, db, speaking });
    this.advancedAudio = Object.freeze({
      atMs,
      measured,
      f0,
      pitchSummary: this.pitchTrack.summary(),
      vad: Object.freeze({
        available: Boolean(this.sileroState) || speechEvidence.validatedPeriodicF0,
        speaking,
        probability: this.sileroState?.probability ?? null,
        evidence: speechEvidence.validatedPeriodicF0 && !speechEvidence.sileroSpeaking
          ? 'VALIDATED_PERIODIC_F0'
          : speechEvidence.sileroSpeaking
            ? 'SILERO_V5'
            : 'NONE',
        provenance: Object.freeze({ source: 'MICROPHONE', method: speechEvidence.method }),
      }),
      loudness,
      estimatedSyllableRate,
    });
    if (this.pcmConsumer) {
      try {
        this.pcmConsumer(transcriptPcmFrame({
          atMs,
          sampleRate: Number(frame.sampleRate),
          samples: frame.samples,
          speaking,
          // A validated periodic F0 is independent acoustic evidence that a
          // microphone frame contains voiced human speech. The transcript lane
          // may use it to avoid rejecting speech when Silero starts late, but
          // word timestamps remain mandatory before WPM can become available.
          speechProbability: this.sileroState?.probability ?? null,
          f0,
        }));
      } catch (error) {
        this.recordWorkerError(`PCM consumer: ${error?.message || error}`);
      }
    }
  }

  stopAdvancedAudio() {
    this.audioWorkletCapture?.stop?.();
    this.audioWorkletCapture = null;
    if (this.sileroVadLane) void this.sileroVadLane.stop().catch(() => {});
    this.sileroVadLane = null;
    this.sileroState = null;
    this.advancedAudio = null;
    this.advancedAudioStatus = 'idle';
  }

  startVision(video) {
    this.visionVideo = video;
    this.frameInFlight = false;
    this.workerErrors = [];
    let generation = this.generation;
    const answerEpoch = this.answerEpoch;
    if (!this.worker) {
      this.workerReady = false;
      generation = ++this.generation;
      this.worker = ANALYTICS_ROOT === '/analytics'
        ? new Worker(`/analytics/holistic-worker.mjs?v=${WORKER_REVISION}`, { type: 'module', name: `communication-analytics-${generation}` })
        : new Worker(`${ANALYTICS_ROOT}/holistic-worker.mjs?v=${WORKER_REVISION}`, { type: 'module', name: `communication-analytics-${generation}` });
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
        faceOverlayEnabled: this.faceOverlayEnabled,
        bodyHandsOverlayEnabled: this.bodyHandsOverlayEnabled,
        handsOverlayEnabled: this.handsOverlayEnabled,
        bodyOverlayEnabled: this.bodyOverlayEnabled,
        framingOverlayEnabled: this.framingOverlayEnabled,
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
        if (!this.visionSourceIsLive(video)) {
          if (this.visionDisconnectedAt === null) this.markVisionUnavailable(this.visionSourceMode === 'playback' ? 'playback_stopped' : 'camera_disconnected');
          this.visionTimer = null;
          schedule();
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
            if (!this.visionCaptureIsCurrent({ generation, answerEpoch, visionEpoch, captureSequence, video })) {
              closeOverlayBitmap(bitmap);
              bitmap = null;
              if (captureSequence === this.visionCaptureSequence) this.frameInFlight = false;
              if (!this.visionSourceIsLive(video)) {
                if (this.visionDisconnectedAt === null) this.markVisionUnavailable(this.visionSourceMode === 'playback' ? 'playback_stopped' : 'camera_disconnected');
                this.visionTimer = null;
                schedule();
                return;
              }
            } else {
              const timestampMs = this.session.clock.sessionMs();
              const frameId = ++this.frameId;
              if (this.faceWorkerReady && this.faceWorker) {
                faceBitmap = await createImageBitmap(bitmap);
                if (!this.visionCaptureIsCurrent({ generation, answerEpoch, visionEpoch, captureSequence, video })) {
                  closeOverlayBitmap(faceBitmap);
                  faceBitmap = null;
                  closeOverlayBitmap(bitmap);
                  bitmap = null;
                  if (captureSequence === this.visionCaptureSequence) this.frameInFlight = false;
                  if (!this.visionSourceIsLive(video)) {
                    if (this.visionDisconnectedAt === null) this.markVisionUnavailable(this.visionSourceMode === 'playback' ? 'playback_stopped' : 'camera_disconnected');
                    this.visionTimer = null;
                    schedule();
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
      // The per-frame guard DOES honour muted: a microphone that genuinely mutes
      // mid-session must produce an observation gap rather than be recorded as measured.
      // Only the startup gate tolerates the transient WebKit muted state, because that
      // was a bootstrap deadlock (no sampling -> no data -> muted never clears).
      && media.stream?.getAudioTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
  }

  cameraMediaIsLive() {
    const media = this.bridge.media || {};
    return Boolean(media.cam
      && media.stream?.getVideoTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
  }

  visionSourceIsLive(video = this.visionVideo) {
    if (this.visionSourceMode === 'playback') return Boolean(video
      && video === this.visionVideo
      && Number.isFinite(video.readyState)
      && video.readyState >= 2
      && video.paused !== true
      && video.ended !== true);
    return this.cameraMediaIsLive();
  }

  visionCaptureIsCurrent({ generation, answerEpoch, visionEpoch, captureSequence, video = this.visionVideo }) {
    return Boolean(this.visionCaptureOwnsSlot({ generation, answerEpoch, visionEpoch, captureSequence })
      && !document.hidden
      && this.visionSourceIsLive(video));
  }

  visionCaptureOwnsSlot({ generation, answerEpoch, visionEpoch, captureSequence }) {
    return Boolean(this.answer
      && !this.answerSealed
      && generation === this.generation
      && answerEpoch === this.answerEpoch
      && visionEpoch === this.visionEpoch
      && captureSequence === this.visionCaptureSequence);
  }

  forwardPendingVision(faceCount, generation, answerEpoch, visionEpoch, frameId, timestampMs, faceInferenceMs = null, primary = {}) {
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
        primaryTrackId: typeof primary.primaryTrackId === 'string' ? primary.primaryTrackId : null,
        primaryUsable: primary.primaryUsable === true,
        primaryRoi: primary.primaryRoi || null,
        primaryFaceBox: primary.primaryFaceBox || null,
        primaryLock: primary.primaryLock || null,
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
    if (['primary-lock', 'frame-error'].includes(message.type) && message.visionEpoch !== this.visionEpoch) return;
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
    if (message.type === 'primary-lock') {
      this.lastPrimaryLock = message.primaryLock || null;
      this.dispatch('state', { state: 'primary-lock', atMs: message.timestampMs, primaryLock: this.lastPrimaryLock });
      this.forwardPendingVision(message.faceCount, generation, message.answerEpoch, message.visionEpoch, message.frameId, message.timestampMs, message.faceInferenceMs, message);
      return;
    }
    if (message.type === 'primary-selection-restarted') {
      this.lastPrimaryLock = message.primaryLock || null;
      this.dispatch('state', { state: 'primary-lock', atMs: message.timestampMs, primaryLock: this.lastPrimaryLock });
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
        if (this.visionDisconnectedAt !== null) {
          this.session.observationGap({
            startMs: this.visionDisconnectedAt,
            endMs: message.timestampMs,
            reason: 'camera_or_vision_disconnected',
            modality: 'vision',
          });
          this.visionDisconnectedAt = null;
          this.dispatch('state', { state: 'recovered', subsystem: 'vision', atMs: message.timestampMs });
        }
        this.session.ingestVision({
          atMs: message.timestampMs,
          geometry: message.geometry,
          primaryLock: message.primaryLock || null,
          inferenceMs: pipelineMs,
          expectedFrameMs: message.expectedFrameMs,
        });
        // Y1-Y2-CAM-V6-3508: the overlay felt detached because this floor was 2 FPS -
        // a 500ms update interval, which reads as lag even though frames are never
        // queued (capture is skipped while a frame is in flight, so landmarks are
        // never stale-by-queueing). A latest-frame-wins pipeline still looks broken at
        // 2 FPS, so the floor is raised and recovery is faster. Low latency is
        // preferred over inference throughput.
        if (pipelineMs > 180) this.targetFps = Math.max(VISION_MIN_FPS, this.targetFps - 1);
        else if (pipelineMs < 70 && this.targetFps < VISION_MAX_FPS) this.targetFps += 1;
        const live = this.visionLiveState();
        if (bitmap && message.overlayRendered && this.overlayEnabled && this.overlayConsumer) this.overlayConsumer({
          bitmap,
          geometry: message.geometry,
          primaryLock: message.primaryLock || null,
          atMs: message.timestampMs,
          primitiveCount: message.overlayPrimitiveCount,
          pipelineMs,
        });
        const faceState = this.session.audio?.speaking
          ? 'ANSWERING'
          : this.session.audio?.hasSpoken
            ? 'PAUSE'
            : 'SETUP';
        const faceFamilyFrame = this.faceFamily.update(message.faceCategories, message.timestampMs, {
          state: faceState,
          confidence: message.geometry?.primaryAssociated === true ? 0.9 : 0.4,
          yawDegrees: message.geometry?.face?.yawDeg ?? message.geometry?.face?.yawProxyDeg,
          pitchDegrees: message.geometry?.face?.pitchDeg ?? message.geometry?.face?.pitchProxyDeg,
          faceFraction: message.geometry?.face?.box?.height,
        });
        this.dispatch('diagnostic', {
          modality: 'vision', atMs: message.timestampMs, geometry: message.geometry, primaryLock: message.primaryLock || null, live,
          faceFamily: faceFamilyFrame,
          overlayRequested: Boolean(message.overlayRequested), overlayRendered: Boolean(message.overlayRendered),
          overlayPrimitiveCount: Number.isFinite(message.overlayPrimitiveCount) ? message.overlayPrimitiveCount : 0,
          inferenceMs: pipelineMs,
          faceInferenceMs: Number.isFinite(message.faceInferenceMs) ? message.faceInferenceMs : null,
          holisticInferenceMs: Number.isFinite(message.holisticInferenceMs) ? message.holisticInferenceMs : null,
          targetFps: this.targetFps, droppedFrames: this.droppedFrames,
        });
      } catch (error) {
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
    this.faceBaselineCapturing = false;
    this.pitchCalibrationCapturing = false;
    this.clearPendingVision();
    this.clearVisionFrameWatchdog();
    this.inFlightVision = null;
    this.frameInFlight = false;
    this.resetEphemeralVisionState();
    this.dispatch('state', { state: 'partial', subsystem, atMs, message: reason });
  }

  resetEphemeralVisionState() {
    const message = { type: 'reset', generation: this.generation, answerEpoch: this.answerEpoch };
    try { this.worker?.postMessage?.(message); } catch {}
    try { this.faceWorker?.postMessage?.(message); } catch {}
    this.lastPrimaryLock = null;
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
    if (pending) this.forwardPendingVision(null, pending.generation, pending.answerEpoch, pending.visionEpoch, pending.frameId, pending.timestampMs, null, { primaryLock: null });
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

  reselectPrimary() {
    if (!this.answer || this.answerSealed || !this.faceWorker) return false;
    const timestampMs = this.session.clock.sessionMs();
    this.faceWorker.postMessage({
      type: 'reselect-primary',
      generation: this.generation,
      answerEpoch: this.answerEpoch,
      timestampMs,
    });
    return true;
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
    this.visionSourceMode = 'camera';
    this.visionVideo = null;
    this.dispatch('state', { state: 'idle', reason });
    return true;
  }

  stopSampling({ terminateWorker = false } = {}) {
    clearInterval(this.audioTimer);
    this.stopAdvancedAudio();
    clearTimeout(this.visionTimer);
    this.audioTimer = null;
    this.visionTimer = null;
    this.clearPendingVision();
    this.clearVisionFrameWatchdog();
    this.inFlightVision = null;
    this.frameInFlight = false;
    this.visionEpoch += 1;
    if (!terminateWorker) this.resetEphemeralVisionState();
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
      this.lastPrimaryLock = null;
    }
  }

  resetSession() {
    if (this.answer) this.abandonAnswer('session_reset');
    this.stopSampling({ terminateWorker: true });
    // Clears per-session FACE events and dwell. The personal facial baseline is
    // deliberately retained: it describes the speaker's anatomy, not this session.
    this.faceFamily.reset();
    this.pitchTrack.reset();
    this.vadHysteresis.reset();
    this.kWeightedLoudness = null;
    this.estimatedSyllableRate.reset();
    this.session = null;
    this.droppedFrames = 0;
    this.frameId = 0;
    this.targetFps = 12;
    this.hiddenAt = null;
    this.visionDisconnectedAt = null;
    this.audioDisconnectedAt = null;
    this.workerErrors = [];
    this.blockedEgressAttempts = 0;
    this.lastPrimaryLock = null;
    this.visionSourceMode = 'camera';
    this.visionVideo = null;
  }

  setPersonalCalibration(values = {}) {
    if (Number.isFinite(values.pitchMedianHz)) this.pitchTrack.freezeCalibrationBaseline(values.pitchMedianHz);
    this.faceFamily.setPersonalBaseline(values);
    this.faceBaselineCapturing = false;
    this.pitchCalibrationCapturing = false;
    return Object.freeze({
      pitchMedianHz: this.pitchTrack.calibrationMedianHz,
      faceBaselineAvailable: this.faceFamily.hasPersonalBaseline(),
    });
  }

  beginPersonalFaceBaseline() {
    if (this.faceFamily.hasPersonalBaseline()) {
      return Object.freeze({ capturing: false, available: true, reason: 'PERSONAL_BASELINE_RETAINED' });
    }
    this.faceFamily.beginBaseline();
    this.faceBaselineCapturing = true;
    return Object.freeze({ capturing: true, available: false, reason: 'CAPTURING_PERSONAL_FACE_BASELINE' });
  }

  endPersonalFaceBaseline() {
    if (this.faceBaselineCapturing) this.faceFamily.endBaseline();
    this.faceBaselineCapturing = false;
    return Object.freeze({
      capturing: false,
      available: this.faceFamily.hasPersonalBaseline(),
      reason: this.faceFamily.hasPersonalBaseline() ? null : 'INSUFFICIENT_FACE_BASELINE_FRAMES',
    });
  }

  clearPersonalCalibration() {
    this.pitchTrack.reset({ preserveCalibration: false });
    this.faceFamily.clearPersonalBaseline();
    this.faceBaselineCapturing = false;
    this.pitchCalibrationCapturing = false;
    return true;
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
      primaryLock: this.lastPrimaryLock,
      visionSourceMode: this.visionSourceMode,
      targetFps: this.targetFps,
      droppedFrames: this.droppedFrames,
      workerErrors: [...this.workerErrors],
      blockedEgressAttempts: this.blockedEgressAttempts,
      audioFrameCount: this.session?.audio?.validFrames || 0,
      advancedAudioStatus: this.advancedAudioStatus,
      vad: this.advancedAudio?.vad || null,
      loudness: this.advancedAudio?.loudness || null,
      faceBaselineCapturing: this.faceBaselineCapturing,
      pitchCalibrationMedianHz: this.pitchTrack.calibrationMedianHz,
      visualFrameCount: this.session?.vision?.analyzableFrames || 0,
      networkPolicy: 'same-origin-only-worker-guard-and-csp',
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
