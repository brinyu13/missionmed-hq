// Real fundamental-frequency (F0) cartridge for IV Prep Delivery Intelligence.
//
// Y1-Y2-CAM-V6-3504. Before this module the product had no F0 at all: the only
// pitch-adjacent signal was `pitch_zero_crossing`, which signal-registry.mjs marks
// MATURITY.REJECTED ("Legacy zero-crossing pitch"), and the UI correctly reported
// "PITCH - UNAVAILABLE - NO VALIDATED F0 INPUT".
//
// Method: McLeod Pitch Method (MPM) over the Normalised Square Difference Function.
// Chosen over plain autocorrelation (which is biased toward octave errors and toward
// low frequencies) and over FFT cepstrum (worse latency/resolution trade at speech
// F0). MPM needs no dependencies, is O(N*maxLag), runs comfortably per audio frame
// in the browser, and is well characterised for adult speech.
//
// LAW - this module measures frequency only:
//   * F0 is derived from the waveform's periodicity. It is never inferred from RMS,
//     volume, speech rate or transcript.
//   * An unvoiced or low-confidence frame yields NO number. It reports
//     voiced:false / f0Hz:null. Silence must never render as a pitch.
//   * Coaching is speaker-relative (semitones against the speaker's own median).
//     There is no universal target Hz, because the correct pitch for a speaker is
//     their own range.

// Adult speech F0 lives well inside this window. Deliberately generous at both ends
// so a low male voice or a raised female voice is still tracked rather than clipped.
export const F0_MIN_HZ = 55;
export const F0_MAX_HZ = 500;

// NSDF peak below this is not a periodic frame. 0.45 keeps breathy speech while
// rejecting broadband noise; fricatives correctly fall out as unvoiced.
export const DEFAULT_CLARITY_THRESHOLD = 0.45;

// Below this RMS there is no signal worth analysing. Prevents room noise from being
// promoted to a confident pitch.
export const SILENCE_RMS_FLOOR = 0.0025;

export const UNVOICED = Object.freeze({ f0Hz: null, voiced: false, confidence: 0, rms: 0 });

function rootMeanSquare(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/**
 * Normalised Square Difference Function (McLeod & Wyvill).
 *
 *   nsdf(tau) = 2 * sum(x[i] * x[i+tau]) / sum(x[i]^2 + x[i+tau]^2)
 *
 * Bounded to [-1, 1] regardless of amplitude, which is what makes the peak value a
 * usable clarity/confidence figure rather than an amplitude artefact.
 */
export function normalisedSquareDifference(samples, maxLag) {
  const size = samples.length;
  const limit = Math.min(maxLag, size - 1);
  const nsdf = new Float32Array(limit + 1);
  for (let tau = 0; tau <= limit; tau += 1) {
    let correlation = 0;
    let energy = 0;
    const window = size - tau;
    for (let i = 0; i < window; i += 1) {
      const a = samples[i];
      const b = samples[i + tau];
      correlation += a * b;
      energy += a * a + b * b;
    }
    nsdf[tau] = energy > 0 ? (2 * correlation) / energy : 0;
  }
  return nsdf;
}

/**
 * First key maximum: walk past the initial descent to the first negative-going zero
 * crossing, then take the highest peak of the *first* hump. Taking the global maximum
 * instead is the classic source of octave-halving errors.
 */
function firstKeyMaximum(nsdf, threshold) {
  let tau = 2;
  while (tau < nsdf.length && nsdf[tau] > 0) tau += 1;        // skip the lag-0 lobe
  while (tau < nsdf.length && nsdf[tau] <= 0) tau += 1;       // find the next positive run
  if (tau >= nsdf.length) return -1;

  let bestLag = -1;
  let bestValue = -1;
  while (tau < nsdf.length && nsdf[tau] > 0) {
    if (nsdf[tau] > bestValue) { bestValue = nsdf[tau]; bestLag = tau; }
    tau += 1;
  }
  return bestValue >= threshold ? bestLag : -1;
}

/** Parabolic interpolation around the peak for sub-sample lag precision. */
function refineLag(nsdf, lag) {
  if (lag <= 0 || lag >= nsdf.length - 1) return { lag, value: nsdf[lag] ?? 0 };
  const prev = nsdf[lag - 1];
  const here = nsdf[lag];
  const next = nsdf[lag + 1];
  const denominator = 2 * (2 * here - prev - next);
  if (!Number.isFinite(denominator) || denominator === 0) return { lag, value: here };
  const shift = (next - prev) / denominator;
  return { lag: lag + shift, value: here };
}

/**
 * Estimate F0 for one PCM frame.
 * Returns { f0Hz, voiced, confidence, rms } and never a fabricated frequency.
 */
export function estimateF0(samples, sampleRate, { clarityThreshold = DEFAULT_CLARITY_THRESHOLD } = {}) {
  if (!samples?.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return UNVOICED;

  const rms = rootMeanSquare(samples);
  if (rms < SILENCE_RMS_FLOOR) return Object.freeze({ ...UNVOICED, rms });

  // The frame must span at least two periods of the lowest frequency we claim to
  // track, otherwise the low end is unmeasurable and must not be guessed.
  const maxLag = Math.floor(sampleRate / F0_MIN_HZ);
  const minLag = Math.max(2, Math.floor(sampleRate / F0_MAX_HZ));
  if (samples.length < maxLag + 2) return Object.freeze({ ...UNVOICED, rms });

  const nsdf = normalisedSquareDifference(samples, maxLag);
  const peakLag = firstKeyMaximum(nsdf, clarityThreshold);
  if (peakLag < minLag) return Object.freeze({ ...UNVOICED, rms });

  const refined = refineLag(nsdf, peakLag);
  const f0Hz = sampleRate / refined.lag;
  if (!Number.isFinite(f0Hz) || f0Hz < F0_MIN_HZ || f0Hz > F0_MAX_HZ) {
    return Object.freeze({ ...UNVOICED, rms });
  }

  return Object.freeze({
    f0Hz,
    voiced: true,
    confidence: Math.max(0, Math.min(1, refined.value)),
    rms,
  });
}

/** Speaker-relative distance in semitones. 12 * log2(f0 / reference). */
export function semitonesFrom(f0Hz, referenceHz) {
  if (!Number.isFinite(f0Hz) || !Number.isFinite(referenceHz) || f0Hz <= 0 || referenceHz <= 0) return null;
  return 12 * Math.log2(f0Hz / referenceHz);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/**
 * Rolling speaker-relative pitch summary.
 *
 * Everything is expressed against the speaker's own median F0, because a "good"
 * absolute pitch does not exist. Reports UNAVAILABLE until enough voiced frames have
 * accumulated to make a median meaningful, rather than emitting an unstable early
 * number that would move for the wrong reasons.
 */
export class PitchTrack {
  #voiced = [];
  #frames = 0;
  #maxHistory;
  #minVoicedFrames;
  #octaveGuardSemitones;
  #lastAcceptedHz = null;
  #calibrationMedianHz = null;
  #octaveCorrections = 0;

  constructor({ maxHistory = 1800, minVoicedFrames = 12, octaveGuardSemitones = 8 } = {}) {
    this.#maxHistory = maxHistory;
    this.#minVoicedFrames = minVoicedFrames;
    this.#octaveGuardSemitones = octaveGuardSemitones;
  }

  /** Feed one estimateF0() result. Unvoiced frames are counted but contribute no F0. */
  push(estimate, { speaking = true } = {}) {
    this.#frames += 1;
    if (!speaking || estimate?.voiced !== true || !Number.isFinite(estimate.f0Hz)) return this;
    let acceptedHz = estimate.f0Hz;
    if (Number.isFinite(this.#lastAcceptedHz)) {
      const jump = Math.abs(semitonesFrom(acceptedHz, this.#lastAcceptedHz));
      if (jump > this.#octaveGuardSemitones) {
        const candidates = [acceptedHz / 2, acceptedHz, acceptedHz * 2]
          .filter((hz) => hz >= F0_MIN_HZ && hz <= F0_MAX_HZ)
          .map((hz) => ({ hz, distance: Math.abs(semitonesFrom(hz, this.#lastAcceptedHz)) }))
          .sort((a, b) => a.distance - b.distance);
        if (!candidates.length || candidates[0].distance > this.#octaveGuardSemitones) return this;
        if (candidates[0].hz !== acceptedHz) this.#octaveCorrections += 1;
        acceptedHz = candidates[0].hz;
      }
    }
    this.#lastAcceptedHz = acceptedHz;
    this.#voiced.push({ f0Hz: acceptedHz, confidence: estimate.confidence ?? 0 });
    if (this.#voiced.length > this.#maxHistory) this.#voiced.shift();
    return this;
  }

  get voicedFrameCount() { return this.#voiced.length; }

  get voicedRatio() { return this.#frames ? this.#voiced.length / this.#frames : 0; }

  get calibrationMedianHz() { return this.#calibrationMedianHz; }

  /** Freeze the speaker's admitted calibration median; later answers never move it. */
  freezeCalibrationBaseline(referenceHz = null) {
    const candidate = Number.isFinite(referenceHz)
      ? Number(referenceHz)
      : median(this.#voiced.map((entry) => entry.f0Hz));
    if (!Number.isFinite(candidate) || candidate <= 0) throw new TypeError('A voiced calibration median is required.');
    this.#calibrationMedianHz = candidate;
    return candidate;
  }

  /**
   * @returns {{available:boolean, reason?:string, medianHz?:number, rangeSemitones?:number,
   *            variationSemitones?:number, minHz?:number, maxHz?:number, voicedRatio:number}}
   */
  summary() {
    const voicedRatio = this.voicedRatio;
    if (this.#voiced.length < this.#minVoicedFrames) {
      return Object.freeze({
        available: false,
        reason: 'INSUFFICIENT_VOICED_AUDIO',
        voicedFrames: this.#voiced.length,
        voicedRatio,
      });
    }
    const values = this.#voiced.map((entry) => entry.f0Hz);
    const medianHz = median(values);
    const referenceHz = this.#calibrationMedianHz ?? medianHz;
    const semitones = values.map((hz) => semitonesFrom(hz, referenceHz)).filter((v) => v !== null);
    const mean = semitones.reduce((sum, v) => sum + v, 0) / semitones.length;
    const variance = semitones.reduce((sum, v) => sum + (v - mean) ** 2, 0) / semitones.length;
    const minHz = Math.min(...values);
    const maxHz = Math.max(...values);
    const p10Semitones = quantile(semitones, 0.1);
    const p90Semitones = quantile(semitones, 0.9);
    return Object.freeze({
      available: true,
      medianHz,
      referenceHz,
      referenceBasis: this.#calibrationMedianHz === null ? 'CURRENT_OBSERVED_MEDIAN' : 'FIXED_PERSONAL_CALIBRATION_MEDIAN',
      relativeMedianSemitones: semitonesFrom(medianHz, referenceHz),
      minHz,
      maxHz,
      rangeSemitones: semitonesFrom(maxHz, minHz) ?? 0,
      // Standard deviation in semitones: the speaker-relative "pitch variation" a
      // monotone delivery drives toward zero and a varied delivery raises.
      variationSemitones: Math.sqrt(variance),
      p10Semitones,
      p90Semitones,
      p10P90RangeSemitones: p90Semitones - p10Semitones,
      voicedFrames: this.#voiced.length,
      voicedRatio,
      octaveCorrections: this.#octaveCorrections,
    });
  }

  reset({ preserveCalibration = true } = {}) {
    this.#voiced = [];
    this.#frames = 0;
    this.#lastAcceptedHz = null;
    this.#octaveCorrections = 0;
    if (!preserveCalibration) this.#calibrationMedianHz = null;
    return this;
  }
}
