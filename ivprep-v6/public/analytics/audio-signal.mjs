function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function dbfs(rms) {
  return 20 * Math.log10(Math.max(Number(rms) || 0, 1e-8));
}

function quantile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export function measurePcmFrame(samples) {
  if (!samples || !Number.isFinite(samples.length) || samples.length < 1) {
    return { rms: 0, peak: 0, clippedFraction: 0 };
  }
  let sumSquares = 0;
  let peak = 0;
  let clipped = 0;
  let consecutive = 0;
  let clippedRun = false;
  for (const raw of samples) {
    const value = clamp(Number(raw) || 0, -1, 1);
    const absolute = Math.abs(value);
    sumSquares += value * value;
    peak = Math.max(peak, absolute);
    if (absolute >= 0.99) {
      clipped += 1;
      consecutive += 1;
      if (consecutive >= 3) clippedRun = true;
    } else consecutive = 0;
  }
  const fraction = clipped / samples.length;
  return {
    rms: Math.sqrt(sumSquares / samples.length),
    peak,
    clippedFraction: clippedRun || fraction >= 0.01 ? fraction : 0,
  };
}

export class AudioSignalAnalyzer {
  constructor({ frameMs = 50, calibrationMs = 800, pauseMinimumMs = 1_000 } = {}) {
    this.frameMs = frameMs;
    this.calibrationMs = calibrationMs;
    this.pauseMinimumMs = pauseMinimumMs;
    this.reset();
  }

  reset() {
    this.startedAtMs = null;
    this.frames = 0;
    this.validFrames = 0;
    this.calibration = [];
    this.levels = [];
    this.speechLevels = [];
    this.clippedFractionSum = 0;
    this.speechFrames = 0;
    this.firstSpeechAtMs = null;
    this.hasSpoken = false;
    this.speaking = false;
    this.onCount = 0;
    this.offCount = 0;
    this.candidateSilenceStartMs = null;
    this.pauseEpisodes = [];
    this.pauseEpisodesDropped = 0;
    this.samplingGapCount = 0;
    this.samplingGaps = [];
    this.samplingGapsDropped = 0;
    this.lastAtMs = null;
  }

  begin(startedAtMs) {
    if (!Number.isFinite(startedAtMs)) throw new TypeError('Audio start timestamp must be finite.');
    this.reset();
    this.startedAtMs = Math.round(Number(startedAtMs));
  }

  ingest({ atMs, rms, peak = 0, clippedFraction = 0 }) {
    if (this.startedAtMs === null) throw new TypeError('Audio analyzer has not begun.');
    const requestedTime = Math.round(Number(atMs));
    if (!Number.isFinite(requestedTime) || requestedTime < this.startedAtMs || (this.lastAtMs !== null && requestedTime < this.lastAtMs)) {
      throw new TypeError('Audio frame timestamps must be finite and monotonic.');
    }
    const time = requestedTime;
    if (this.lastAtMs === null && time - this.startedAtMs > Math.max(250, this.frameMs * 5)) {
      this.gap(this.startedAtMs, time, 'audio_startup_gap');
    } else if (this.lastAtMs !== null && time - this.lastAtMs > Math.max(250, this.frameMs * 5)) {
      this.gap(this.lastAtMs, time, 'audio_cadence_gap');
    }
    const level = dbfs(rms);
    this.frames += 1;
    this.lastAtMs = time;
    if (!Number.isFinite(level) || !Number.isFinite(peak) || !Number.isFinite(clippedFraction)) return;
    this.validFrames += 1;
    this.levels.push(level);
    if (time - this.startedAtMs <= this.calibrationMs) this.calibration.push(level);
    this.clippedFractionSum += clamp(clippedFraction, 0, 1);

    // Loud startup audio is probably speech; mid-level steady startup audio is
    // treated as ambient until it rises materially above its own floor.
    const observedFloor = quantile(this.calibration, 0.25) ?? -60;
    const noiseFloor = observedFloor > -30 ? -50 : observedFloor;
    const speechOnThreshold = Math.max(-42, noiseFloor + 10);
    const speechOffThreshold = Math.max(-48, noiseFloor + 6);
    const above = level >= (this.speaking ? speechOffThreshold : speechOnThreshold);

    if (above) {
      this.onCount += 1;
      this.offCount = 0;
      if (!this.speaking && this.onCount >= 3) {
        const onset = Math.max(this.startedAtMs, time - (this.onCount - 1) * this.frameMs);
        if (this.hasSpoken && this.candidateSilenceStartMs !== null) {
          const durationMs = onset - this.candidateSilenceStartMs;
          if (durationMs >= this.pauseMinimumMs) {
            if (this.pauseEpisodes.length < 40) this.pauseEpisodes.push({ startMs: this.candidateSilenceStartMs, endMs: onset, durationMs });
            else this.pauseEpisodesDropped += 1;
          }
        }
        this.candidateSilenceStartMs = null;
        this.speaking = true;
        this.hasSpoken = true;
        if (this.firstSpeechAtMs === null) this.firstSpeechAtMs = onset;
      }
    } else {
      this.offCount += 1;
      this.onCount = 0;
      if (this.speaking && this.offCount === 1) this.candidateSilenceStartMs = time;
      if (this.speaking && this.offCount >= 4) this.speaking = false;
    }

    if (this.speaking) {
      this.speechFrames += 1;
      this.speechLevels.push(level);
    }
  }

  gap(startMs, endMs, reason = 'audio_sampling_gap') {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return false;
    this.samplingGapCount += 1;
    if (this.samplingGaps.length < 40) this.samplingGaps.push({ startMs: Math.round(startMs), endMs: Math.round(endMs), reason: String(reason || 'audio_sampling_gap').slice(0, 120) });
    else this.samplingGapsDropped += 1;
    this.speaking = false;
    this.onCount = 0;
    this.offCount = 0;
    this.candidateSilenceStartMs = null;
    this.lastAtMs = Math.max(this.lastAtMs ?? this.startedAtMs ?? 0, Math.round(endMs));
    return true;
  }

  finish(endedAtMs) {
    if (this.startedAtMs === null) throw new TypeError('Audio analyzer has not begun.');
    if (!Number.isFinite(endedAtMs) || endedAtMs < this.startedAtMs || (this.lastAtMs !== null && endedAtMs < this.lastAtMs)) throw new TypeError('Audio end timestamp must be finite and monotonic.');
    const end = Math.round(Number(endedAtMs));
    if (this.lastAtMs !== null && end - this.lastAtMs > Math.max(250, this.frameMs * 5)) this.gap(this.lastAtMs, end, 'audio_trailing_gap');
    const durationMs = end - this.startedAtMs;
    const expectedFrames = Math.max(1, Math.round(durationMs / this.frameMs));
    const coverage = clamp(this.validFrames / expectedFrames, 0, 1);
    const medianLevel = quantile(this.levels, 0.5);
    const lower = quantile(this.levels, 0.25);
    const upper = quantile(this.levels, 0.75);
    const result = {
      durationMs,
      coverage: Number(coverage.toFixed(4)),
      frameCount: this.validFrames,
      noiseFloorDbfs: (() => { const observed = quantile(this.calibration, 0.25) ?? -60; return observed > -30 ? -50 : observed; })(),
      responseStartLatencyMs: this.firstSpeechAtMs === null ? null : this.firstSpeechAtMs - this.startedAtMs,
      speechActiveDurationMs: this.speechFrames * this.frameMs,
      speechActiveRatio: durationMs ? clamp((this.speechFrames * this.frameMs) / durationMs, 0, 1) : 0,
      capturedLevelDbfs: medianLevel,
      energyIqrDb: lower === null || upper === null ? null : upper - lower,
      digitalClippingFraction: this.validFrames ? this.clippedFractionSum / this.validFrames : 0,
      pauseEpisodes: this.pauseEpisodes.map((episode) => ({ ...episode })),
      pauseEpisodesDropped: this.pauseEpisodesDropped,
      samplingGapCount: this.samplingGapCount,
      samplingGapDetected: this.samplingGapCount > 0,
      samplingGaps: this.samplingGaps.map((gap) => ({ ...gap })),
      samplingGapsDropped: this.samplingGapsDropped,
    };
    this.reset();
    return result;
  }
}
