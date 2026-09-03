// Tier D fallback: an explicitly estimated envelope-peak rate. It must never be
// labelled words per minute and must not enter the SPEED_WPM metric.
export class EstimatedSyllableRate {
  constructor({ onsetDb = 5, refractoryMs = 140, maximumFrames = 1_200 } = {}) {
    this.onsetDb = onsetDb;
    this.refractoryMs = refractoryMs;
    this.maximumFrames = maximumFrames;
    this.reset();
  }

  reset() {
    this.frames = [];
    this.lastPeakAtMs = -Infinity;
    this.peaks = [];
  }

  ingest({ atMs, db, speaking }) {
    const time = Number(atMs);
    const level = Number(db);
    if (!Number.isFinite(time) || !Number.isFinite(level)) return this.snapshot();
    this.frames.push({ atMs: time, db: level, speaking: Boolean(speaking) });
    if (this.frames.length > this.maximumFrames) this.frames.shift();
    const recent = this.frames.slice(-20).filter((frame) => frame.speaking).map((frame) => frame.db);
    const baseline = recent.length ? recent.reduce((sum, value) => sum + value, 0) / recent.length : level;
    const prior = this.frames.at(-2);
    if (speaking && prior && level - baseline >= this.onsetDb && level > prior.db && time - this.lastPeakAtMs >= this.refractoryMs) {
      this.peaks.push(time);
      if (this.peaks.length > 240) this.peaks.shift();
      this.lastPeakAtMs = time;
    }
    return this.snapshot();
  }

  snapshot() {
    const first = this.frames[0]?.atMs;
    const last = this.frames.at(-1)?.atMs;
    const durationMs = Number.isFinite(first) && Number.isFinite(last) ? last - first : 0;
    const peaks = this.peaks.filter((atMs) => !Number.isFinite(first) || atMs >= first);
    return Object.freeze({
      available: durationMs >= 3_000 && peaks.length >= 3,
      estimatedSyllablesPerMinute: durationMs >= 3_000 && peaks.length >= 3 ? Number((peaks.length * 60_000 / durationMs).toFixed(1)) : null,
      label: 'ESTIMATED SYLLABLE RATE',
      tier: 'D',
      reason: durationMs >= 3_000 && peaks.length >= 3 ? null : 'NEED_MORE_SPEECH_ENVELOPE',
      provenance: Object.freeze({ source: 'LOCAL_PCM_ENVELOPE', method: 'ENERGY_PEAK_ESTIMATE', tier: 'D' }),
    });
  }
}
