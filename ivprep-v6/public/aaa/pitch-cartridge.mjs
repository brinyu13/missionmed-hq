// F0/pitch extraction cartridge for IV Prep On-Call.
//
// Autocorrelation-based fundamental frequency estimation from the audio
// analyser buffer. Converts Hz to semitones relative to a personal baseline.
//
// Per 3492 design system: honest PITCH — UNAVAILABLE when confidence is low.
// Semitones never Hz. Personal baseline over population norms.
// PIT-A instrument: active register glows, dwell fills, decay drains.

const MIN_F0_HZ = 65;
const MAX_F0_HZ = 500;
const CONFIDENCE_THRESHOLD = 0.25;
const A4_HZ = 440;

function hzToMidi(hz) {
  return 12 * Math.log2(hz / A4_HZ) + 69;
}

function hzToSemitones(hz, baselineHz) {
  if (!hz || !baselineHz || hz <= 0 || baselineHz <= 0) return 0;
  return 12 * Math.log2(hz / baselineHz);
}

function classifyRegister(midi) {
  if (midi < 48) return 'low';
  if (midi < 60) return 'mid-low';
  if (midi < 72) return 'mid';
  if (midi < 84) return 'mid-high';
  return 'high';
}

function autocorrelate(buffer, sampleRate) {
  const size = buffer.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return { f0: 0, confidence: 0 };

  const minLag = Math.floor(sampleRate / MAX_F0_HZ);
  const maxLag = Math.floor(sampleRate / MIN_F0_HZ);
  const clampedMax = Math.min(maxLag, size - 1);

  let bestCorrelation = 0;
  let bestLag = -1;
  let foundGoodCorrelation = false;

  for (let lag = minLag; lag <= clampedMax; lag++) {
    let correlation = 0;
    let normA = 0;
    let normB = 0;
    const limit = size - lag;
    for (let i = 0; i < limit; i++) {
      correlation += buffer[i] * buffer[i + lag];
      normA += buffer[i] * buffer[i];
      normB += buffer[i + lag] * buffer[i + lag];
    }
    const norm = Math.sqrt(normA * normB);
    if (norm > 0) correlation /= norm;

    if (correlation > CONFIDENCE_THRESHOLD) foundGoodCorrelation = true;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
    if (foundGoodCorrelation && correlation < bestCorrelation * 0.8) break;
  }

  if (bestLag < 0 || bestCorrelation < CONFIDENCE_THRESHOLD) {
    return { f0: 0, confidence: bestCorrelation };
  }

  // Parabolic interpolation for sub-sample accuracy.
  let refinedLag = bestLag;
  if (bestLag > 0 && bestLag < size - 1) {
    const prev = buffer[bestLag - 1] || 0;
    const curr = buffer[bestLag];
    const next = buffer[bestLag + 1] || 0;
    const denom = 2 * curr - prev - next;
    if (Math.abs(denom) > 1e-10) {
      refinedLag = bestLag + (prev - next) / (2 * denom);
    }
  }

  return {
    f0: sampleRate / refinedLag,
    confidence: bestCorrelation,
  };
}

export const PITCH_STATE = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
  CALIBRATING: 'calibrating',
});

export class PitchCartridge {
  #sampleRate;
  #baseline = null;
  #calibrationBuffer = [];
  #calibrationTarget;
  #buffer = [];
  #maxHistory;
  #listeners = new Set();

  constructor({ sampleRate = 44100, calibrationFrames = 60, maxHistory = 600 } = {}) {
    this.#sampleRate = sampleRate;
    this.#calibrationTarget = calibrationFrames;
    this.#maxHistory = maxHistory;
  }

  get state() {
    if (this.#baseline) return PITCH_STATE.AVAILABLE;
    if (this.#calibrationBuffer.length > 0) return PITCH_STATE.CALIBRATING;
    return PITCH_STATE.UNAVAILABLE;
  }

  get baseline() { return this.#baseline; }

  process(audioBuffer) {
    const { f0, confidence } = autocorrelate(audioBuffer, this.#sampleRate);

    if (confidence < CONFIDENCE_THRESHOLD) {
      const frame = Object.freeze({
        f0: 0,
        confidence,
        semitones: 0,
        midi: 0,
        register: null,
        available: false,
        t: performance.now(),
      });
      this.#pushFrame(frame);
      return frame;
    }

    if (!this.#baseline) {
      this.#calibrationBuffer.push(f0);
      if (this.#calibrationBuffer.length >= this.#calibrationTarget) {
        const sorted = this.#calibrationBuffer.slice().sort((a, b) => a - b);
        const trimmed = sorted.slice(
          Math.floor(sorted.length * 0.1),
          Math.floor(sorted.length * 0.9)
        );
        if (trimmed.length > 0) {
          this.#baseline = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
        }
        this.#calibrationBuffer = [];
      }
    }

    const midi = hzToMidi(f0);
    const semitones = this.#baseline ? hzToSemitones(f0, this.#baseline) : 0;
    const frame = Object.freeze({
      f0,
      confidence,
      semitones,
      midi,
      register: classifyRegister(midi),
      available: true,
      t: performance.now(),
    });
    this.#pushFrame(frame);
    return frame;
  }

  #pushFrame(frame) {
    this.#buffer.push(frame);
    if (this.#buffer.length > this.#maxHistory) this.#buffer.shift();
    for (const listener of this.#listeners) listener(frame);
  }

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  recent(count = 30) {
    return this.#buffer.slice(-count);
  }

  registersUsed(windowMs = 30_000) {
    const now = performance.now();
    const cutoff = now - windowMs;
    const window = this.#buffer.filter((f) => f.t >= cutoff && f.available);
    const registers = new Set(window.map((f) => f.register).filter(Boolean));
    return [...registers];
  }

  medianSemitones(windowMs = 10_000) {
    const now = performance.now();
    const cutoff = now - windowMs;
    const values = this.#buffer
      .filter((f) => f.t >= cutoff && f.available)
      .map((f) => f.semitones);
    if (values.length === 0) return null;
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  }

  range(windowMs = 30_000) {
    const now = performance.now();
    const cutoff = now - windowMs;
    const values = this.#buffer
      .filter((f) => f.t >= cutoff && f.available)
      .map((f) => f.semitones);
    if (values.length < 2) return null;
    return { min: Math.min(...values), max: Math.max(...values), span: Math.max(...values) - Math.min(...values) };
  }

  coverage(windowMs = 5_000) {
    const now = performance.now();
    const cutoff = now - windowMs;
    const window = this.#buffer.filter((f) => f.t >= cutoff);
    if (window.length === 0) return 0;
    return window.filter((f) => f.available).length / window.length;
  }

  reset() {
    this.#buffer = [];
    this.#baseline = null;
    this.#calibrationBuffer = [];
  }
}
