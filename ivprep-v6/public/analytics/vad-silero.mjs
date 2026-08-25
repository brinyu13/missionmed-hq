import { COACHING_CONFIG } from './coaching-config.mjs';

export class VadHysteresis {
  constructor({
    positiveSpeechThreshold = COACHING_CONFIG.vad.positiveSpeechThreshold,
    negativeSpeechThreshold = COACHING_CONFIG.vad.negativeSpeechThreshold,
    minimumSpeechMs = COACHING_CONFIG.vad.minimumSpeechMs,
    redemptionMs = COACHING_CONFIG.vad.redemptionMs,
  } = {}) {
    this.positiveSpeechThreshold = positiveSpeechThreshold;
    this.negativeSpeechThreshold = negativeSpeechThreshold;
    this.minimumSpeechMs = minimumSpeechMs;
    this.redemptionMs = redemptionMs;
    this.reset();
  }

  reset() {
    this.speaking = false;
    this.candidateOnAtMs = null;
    this.candidateOffAtMs = null;
    this.lastAtMs = null;
  }

  ingest({ atMs, speechProbability }) {
    const time = Math.round(Number(atMs));
    const probability = Number(speechProbability);
    if (!Number.isFinite(time) || !Number.isFinite(probability) || probability < 0 || probability > 1 || (this.lastAtMs !== null && time < this.lastAtMs)) {
      throw new TypeError('VAD frames require monotonic time and probability in [0,1].');
    }
    this.lastAtMs = time;
    let event = null;
    if (!this.speaking) {
      if (probability >= this.positiveSpeechThreshold) {
        this.candidateOnAtMs ??= time;
        if (time - this.candidateOnAtMs >= this.minimumSpeechMs) {
          this.speaking = true;
          this.candidateOffAtMs = null;
          event = { type: 'SPEECH_START', atMs: this.candidateOnAtMs };
        }
      } else this.candidateOnAtMs = null;
    } else if (probability <= this.negativeSpeechThreshold) {
      this.candidateOffAtMs ??= time;
      if (time - this.candidateOffAtMs >= this.redemptionMs) {
        this.speaking = false;
        this.candidateOnAtMs = null;
        event = { type: 'SPEECH_END', atMs: this.candidateOffAtMs };
      }
    } else this.candidateOffAtMs = null;
    return Object.freeze({ speaking: this.speaking, probability, atMs: time, event });
  }
}

/**
 * Self-only Silero v5 lane. `vad-web` is injected by the page from locally vendored
 * assets. No network URL or raw-frame retention is permitted by this adapter.
 */
export class SileroVadLane {
  constructor({ vadGlobal = globalThis.vad, assetRoot = '/iv-prep-on-call/assets/vendor/vad-web/0.0.30/', onFrame = () => {} } = {}) {
    this.vadGlobal = vadGlobal;
    this.assetRoot = assetRoot;
    this.onFrame = onFrame;
    this.instance = null;
  }

  async start({ stream, audioContext }) {
    if (!stream || !audioContext) throw new TypeError('Silero VAD requires the admitted stream and AudioContext.');
    if (!this.vadGlobal?.MicVAD?.new) throw new Error('SILERO_V5_RUNTIME_UNAVAILABLE');
    const contextStartedAt = audioContext.currentTime * 1_000;
    this.instance = await this.vadGlobal.MicVAD.new({
      model: 'v5',
      processorType: 'AudioWorklet',
      startOnLoad: false,
      baseAssetPath: this.assetRoot,
      onnxWASMBasePath: this.assetRoot,
      positiveSpeechThreshold: COACHING_CONFIG.vad.positiveSpeechThreshold,
      negativeSpeechThreshold: COACHING_CONFIG.vad.negativeSpeechThreshold,
      minSpeechMs: COACHING_CONFIG.vad.minimumSpeechMs,
      redemptionMs: COACHING_CONFIG.vad.redemptionMs,
      audioContext,
      getStream: async () => stream,
      pauseStream: async () => {},
      resumeStream: async () => stream,
      ortConfig: (ort) => {
        ort.env.logLevel = 'error';
        ort.env.wasm.numThreads = 1;
      },
      onFrameProcessed: (probabilities) => {
        this.onFrame(Object.freeze({
          atMs: Math.round(audioContext.currentTime * 1_000 - contextStartedAt),
          speechProbability: Number(probabilities?.isSpeech),
          provenance: Object.freeze({ source: 'SILERO_V5', method: 'LOCAL_ONNX_AUDIOWORKLET' }),
        }));
      },
    });
    await this.instance.start();
    return true;
  }

  async stop() {
    const instance = this.instance;
    this.instance = null;
    if (instance?.pause) await instance.pause();
    if (instance?.destroy) await instance.destroy();
  }
}
