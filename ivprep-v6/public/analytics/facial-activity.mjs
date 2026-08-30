import { COACHING_CONFIG } from './coaching-config.mjs';

function finite(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function freeze(value) {
  return Object.freeze(value);
}

/** Descriptive movement energy only; no affect, personality, or interview-quality inference. */
export class FacialActivityTracker {
  constructor({ config = COACHING_CONFIG.face } = {}) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.previous = null;
    this.windows = new Map();
    this.setupBaseline = [];
    this.latest = freeze({ available: false, reason: 'NEED_MORE_FACE_GEOMETRY', state: 'SETUP' });
    return this.latest;
  }

  ingest({ atMs, state = 'UNKNOWN', confidence = 0, channels = {} } = {}) {
    const time = finite(atMs);
    const values = [channels.brow, channels.mouth, channels.periocular, channels.yaw, channels.pitch].map(finite);
    if (time === null || values.some((value) => value === null) || Number(confidence) < 0.45) {
      this.previous = null;
      this.latest = freeze({ available: false, reason: 'INSUFFICIENT_FACE_GEOMETRY', state });
      return this.latest;
    }
    if (!this.previous) {
      this.previous = { time, values };
      return this.latest;
    }
    const elapsedSeconds = Math.max(1 / 30, (time - this.previous.time) / 1_000);
    const energy = values.reduce((sum, value, index) => sum + Math.abs(value - this.previous.values[index]), 0) / elapsedSeconds;
    this.previous = { time, values };
    const samples = this.windows.get(state) || [];
    samples.push({ atMs: time, energy });
    while (samples.length && time - samples[0].atMs > this.config.activityWindowMs) samples.shift();
    this.windows.set(state, samples);
    if (state === 'SETUP') {
      this.setupBaseline.push(energy);
      if (this.setupBaseline.length > 240) this.setupBaseline.shift();
    }
    if (samples.length < this.config.activityMinimumFrames) {
      this.latest = freeze({ available: false, reason: 'ESTABLISHING_FACE_ACTIVITY', state, sampleCount: samples.length });
      return this.latest;
    }
    const observed = median(samples.map((sample) => sample.energy));
    const baseline = median(this.setupBaseline) ?? observed;
    this.latest = freeze({
      available: true,
      state,
      activityRelativeToPersonalBaseline: baseline > 1e-6 ? Number((observed / baseline).toFixed(3)) : null,
      observedMovementEnergy: Number(observed.toFixed(4)),
      baselineMovementEnergy: Number(baseline.toFixed(4)),
      confidence: Number(confidence) >= 0.75 ? 'HIGH' : 'MODERATE',
      provenance: freeze({ source: 'LOCAL_FACE_GEOMETRY', method: 'ROLLING_STATE_SPLIT_BASELINE_RELATIVE_ENERGY' }),
      claimBoundary: 'DESCRIPTIVE_MOVEMENT_ONLY',
    });
    return this.latest;
  }
}
