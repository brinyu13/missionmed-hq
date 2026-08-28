import { COACHING_CONFIG } from '../analytics/coaching-config.mjs';

function processingState(processing, speechLevelStdLu, config) {
  const actual = processing?.actual && typeof processing.actual === 'object' ? processing.actual : processing;
  const values = [actual?.echoCancellation, actual?.noiseSuppression, actual?.autoGainControl];
  if (values.some((value) => value === true)) return 'PROCESSED';
  if (Number.isFinite(speechLevelStdLu) && speechLevelStdLu < config.audio.processedFlatEnvelopeStdLu) return 'PROCESSED_FLAT_ENVELOPE';
  if (values.every((value) => value === false)) return 'UNPROCESSED';
  return 'PROCESSED_UNKNOWN';
}

export class SetupReadinessGate {
  constructor({ config = COACHING_CONFIG } = {}) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.audio = { speechMs: 0, noiseFloorDb: null, speechLevelDb: null, speechLevelStdLu: null, clippedFraction: null, processing: null, available: false };
    this.video = { facePresent: false, faceFraction: null, centerX: null, centerY: null, headPitchDegrees: null, confidence: 0 };
    return this.snapshot();
  }

  ingestAudio({ speechMs, noiseFloorDb, speechLevelDb, speechLevelStdLu = null, clippedFraction = 0, processing = null, available = true } = {}) {
    this.audio = { speechMs, noiseFloorDb, speechLevelDb, speechLevelStdLu, clippedFraction, processing, available: Boolean(available) };
    return this.snapshot();
  }

  ingestVideo({ facePresent, faceFraction, centerX, centerY, headPitchDegrees = null, confidence = 0 } = {}) {
    this.video = { facePresent: Boolean(facePresent), faceFraction, centerX, centerY, headPitchDegrees, confidence };
    return this.snapshot();
  }

  snapshot() {
    const a = this.audio;
    const v = this.video;
    const speechEnough = Number(a.speechMs) >= this.config.audio.setupSpeechMinimumMs;
    const signalAboveNoise = Number.isFinite(Number(a.speechLevelDb))
      && Number.isFinite(Number(a.noiseFloorDb))
      && Number(a.speechLevelDb) >= Math.max(
        Number(a.noiseFloorDb) + this.config.audio.speechAboveNoiseDb,
        this.config.audio.minimumSpeechDbfs,
      );
    const notClipping = Number(a.clippedFraction) < this.config.audio.clippingFractionWarning;
    const audioSignal = a.available && speechEnough && signalAboveNoise && notClipping;
    const faceFound = v.facePresent && Number(v.confidence) >= 0.45;
    const faceSize = faceFound
      && Number(v.faceFraction) >= this.config.framing.faceMinimumFraction
      && Number(v.faceFraction) <= this.config.framing.faceMaximumFraction;
    const centered = faceFound
      && Math.abs(Number(v.centerX) - this.config.framing.centerTargetX) <= this.config.framing.centerToleranceX
      && Math.abs(Number(v.centerY) - this.config.framing.centerTargetY) <= this.config.framing.centerToleranceY;
    const cameraHeight = !Number.isFinite(Number(v.headPitchDegrees))
      || Math.abs(Number(v.headPitchDegrees)) <= this.config.framing.restPitchMaximumDegrees;
    const videoFraming = faceFound && faceSize && centered;
    const reasons = [];
    if (!a.available || !speechEnough || !signalAboveNoise) reasons.push('NO_AUDIO_SIGNAL');
    if (!notClipping) reasons.push('CHECK_MIC_CLIPPING');
    if (!faceFound) reasons.push('FACE_NOT_FOUND');
    else {
      if (Number(v.faceFraction) < this.config.framing.faceMinimumFraction) reasons.push('MOVE_CLOSER');
      if (Number(v.faceFraction) > this.config.framing.faceMaximumFraction) reasons.push('MOVE_BACK');
      if (!centered) reasons.push('RE_CENTER');
      if (!cameraHeight) reasons.push('RAISE_CAMERA_TO_EYE_LEVEL');
    }
    const correction = reasons.find((reason) => !['NO_AUDIO_SIGNAL', 'CHECK_MIC_CLIPPING'].includes(reason))
      || reasons[0]
      || 'CAMERA_READY';
    return Object.freeze({
      ready: audioSignal && videoFraming,
      audioSignal,
      videoFraming,
      faceFound,
      faceSize,
      centered,
      cameraHeight,
      cameraHeightAdvisory: !cameraHeight,
      audioProcessing: processingState(a.processing, a.speechLevelStdLu, this.config),
      correction,
      reasons: Object.freeze(reasons),
      guidance: Object.freeze({
        placement: 'Place the interviewer tile directly below the webcam.',
        cameraHeight: 'Raise the camera to eye level and keep the tile compact.',
      }),
    });
  }
}
