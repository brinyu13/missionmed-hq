const ABSOLUTE_GATE_LUFS = -70;
const MOMENTARY_WINDOW_SECONDS = 0.4;
const MOMENTARY_HOP_SECONDS = 0.1;
const SHORT_TERM_SECONDS = 3;

function freezeCoefficients(coefficients) {
  return Object.freeze({ ...coefficients });
}

// ITU-R BS.1770 specifies the 48 kHz coefficients and requires coefficients
// for other sample rates to preserve the same K-weighting response. These are
// the standard bilinear-transform equations for the two specified stages.
export function deriveKWeightingCoefficients(sampleRate) {
  const fs = Number(sampleRate);
  if (!Number.isFinite(fs) || fs < 8_000 || fs > 192_000) return null;

  const preFrequency = 1681.974450955533;
  const preGainDb = 3.999843853973347;
  const preQ = 0.7071752369554196;
  const kPre = Math.tan(Math.PI * preFrequency / fs);
  const vh = 10 ** (preGainDb / 20);
  const vb = vh ** 0.4996667741545416;
  const preA0 = 1 + kPre / preQ + kPre * kPre;
  const preFilter = freezeCoefficients({
    b0: (vh + vb * kPre / preQ + kPre * kPre) / preA0,
    b1: 2 * (kPre * kPre - vh) / preA0,
    b2: (vh - vb * kPre / preQ + kPre * kPre) / preA0,
    a1: 2 * (kPre * kPre - 1) / preA0,
    a2: (1 - kPre / preQ + kPre * kPre) / preA0,
  });

  const highPassFrequency = 38.13547087602444;
  const highPassQ = 0.5003270373238773;
  const kHighPass = Math.tan(Math.PI * highPassFrequency / fs);
  const highPassA0 = 1 + kHighPass / highPassQ + kHighPass * kHighPass;
  const highPass = freezeCoefficients({
    b0: 1,
    b1: -2,
    b2: 1,
    a1: 2 * (kHighPass * kHighPass - 1) / highPassA0,
    a2: (1 - kHighPass / highPassQ + kHighPass * kHighPass) / highPassA0,
  });

  return Object.freeze({ preFilter, highPass });
}

class Biquad {
  constructor(coefficients) {
    this.c = coefficients;
    this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0;
  }

  process(x) {
    const { b0, b1, b2, a1, a2 } = this.c;
    const y = b0 * x + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

function quantile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function toLufs(meanSquare) {
  return meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity;
}

function meanLufs(values) {
  if (!values.length) return null;
  const meanSquare = values.reduce((sum, value) => sum + 10 ** ((value + 0.691) / 10), 0) / values.length;
  const result = toLufs(meanSquare);
  return Number.isFinite(result) ? result : null;
}

export class KWeightedLoudness {
  constructor({ sampleRate = 48_000, maximumBlocks = 300 } = {}) {
    this.sampleRate = Number(sampleRate);
    this.maximumBlocks = Math.max(3, Number(maximumBlocks) || 300);
    this.coefficients = deriveKWeightingCoefficients(this.sampleRate);
    this.supported = Boolean(this.coefficients);
    this.windowSamples = this.supported ? Math.round(this.sampleRate * MOMENTARY_WINDOW_SECONDS) : 0;
    this.hopSamples = this.supported ? Math.round(this.sampleRate * MOMENTARY_HOP_SECONDS) : 0;
    this.shortTermBlocks = Math.round(SHORT_TERM_SECONDS / MOMENTARY_HOP_SECONDS);
    this.reset();
  }

  ingest(samples, { speaking = false } = {}) {
    if (!this.supported || !samples?.length) return this.summary();
    for (const raw of samples) {
      const bounded = Math.max(-1, Math.min(1, Number(raw) || 0));
      const weighted = this.highPass.process(this.pre.process(bounded));
      this.energyWindow[this.windowIndex] = weighted * weighted;
      this.speechWindow[this.windowIndex] = speaking ? 1 : 0;
      this.windowIndex = (this.windowIndex + 1) % this.windowSamples;
      this.filledSamples = Math.min(this.windowSamples, this.filledSamples + 1);
      this.samplesSinceBlock += 1;
      if (this.filledSamples === this.windowSamples && this.samplesSinceBlock >= this.hopSamples) {
        this.samplesSinceBlock = 0;
        this.recordMomentaryBlock();
      }
    }
    return this.summary();
  }

  recordMomentaryBlock() {
    let sumSquares = 0;
    let speechSamples = 0;
    for (let index = 0; index < this.windowSamples; index += 1) {
      sumSquares += this.energyWindow[index];
      speechSamples += this.speechWindow[index];
    }
    const lufsK = toLufs(sumSquares / this.windowSamples);
    if (!Number.isFinite(lufsK)) return;
    this.blocks.push(lufsK);
    if (speechSamples / this.windowSamples >= 0.5 && lufsK >= ABSOLUTE_GATE_LUFS) {
      this.speechBlocks.push(lufsK);
    }
    if (this.blocks.length > this.maximumBlocks) this.blocks.shift();
    if (this.speechBlocks.length > this.maximumBlocks) this.speechBlocks.shift();
  }

  provenance() {
    return Object.freeze({ source: 'MICROPHONE', method: 'BS1770_K_WEIGHTING_RATE_DERIVED' });
  }

  summary() {
    if (!this.supported) return Object.freeze({
      available: false,
      reason: 'LUFS_K_SAMPLE_RATE_UNSUPPORTED',
      sampleRate: this.sampleRate,
      provenance: this.provenance(),
    });
    if (this.speechBlocks.length < 3) return Object.freeze({
      available: false,
      reason: 'NEED_MORE_VAD_GATED_SPEECH',
      sampleRate: this.sampleRate,
      speechBlockCount: this.speechBlocks.length,
      provenance: this.provenance(),
    });
    const median = quantile(this.speechBlocks, 0.5);
    const p10 = quantile(this.speechBlocks, 0.1);
    const p90 = quantile(this.speechBlocks, 0.9);
    const momentary = this.blocks.at(-1);
    const shortTerm = meanLufs(this.blocks.slice(-this.shortTermBlocks));
    return Object.freeze({
      available: true,
      momentaryLufsK: Number(momentary.toFixed(2)),
      shortTermLufsK: Number(shortTerm.toFixed(2)),
      speechLufsK: Number(median.toFixed(2)),
      p10LufsK: Number(p10.toFixed(2)),
      p90LufsK: Number(p90.toFixed(2)),
      modulationRangeLu: Number((p90 - p10).toFixed(2)),
      speechBlockCount: this.speechBlocks.length,
      sampleRate: this.sampleRate,
      provenance: this.provenance(),
    });
  }

  reset() {
    if (!this.supported) {
      this.pre = null;
      this.highPass = null;
      this.energyWindow = new Float64Array(0);
      this.speechWindow = new Uint8Array(0);
    } else {
      this.pre = new Biquad(this.coefficients.preFilter);
      this.highPass = new Biquad(this.coefficients.highPass);
      this.energyWindow = new Float64Array(this.windowSamples);
      this.speechWindow = new Uint8Array(this.windowSamples);
    }
    this.windowIndex = 0;
    this.filledSamples = 0;
    this.samplesSinceBlock = 0;
    this.blocks = [];
    this.speechBlocks = [];
  }
}
