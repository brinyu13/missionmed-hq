const ALLOWED_STATES = new Set(['LISTENING', 'TRANSITION_TO_ANSWER']);

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Geometry-only nod pattern; it does not infer agreement, engagement, or comprehension. */
export class NodDetector {
  constructor({ minimumFps = 15, excursionDegrees = 5, returnToleranceDegrees = 3, maximumCycleMs = 1_800, refractoryMs = 700 } = {}) {
    this.minimumFps = minimumFps;
    this.excursionDegrees = excursionDegrees;
    this.returnToleranceDegrees = returnToleranceDegrees;
    this.maximumCycleMs = maximumCycleMs;
    this.refractoryMs = refractoryMs;
    this.reset();
  }

  reset() {
    this.rest = [];
    this.excursionStartedAtMs = null;
    this.lastEventAtMs = -Infinity;
    this.count = 0;
    this.clusterCount = 0;
    this.eligibleListeningMs = 0;
    this.previousValidAtMs = null;
    this.previousValidState = null;
    this.events = [];
    this.latest = Object.freeze({ available: false, reason: 'INSUFFICIENT_VISION_FRAME_RATE', count: 0 });
    return this.latest;
  }

  ingest({ atMs, pitchDegrees, state = 'UNKNOWN', targetFps = 0, confidence = 0 } = {}) {
    const time = Number(atMs);
    const pitch = Number(pitchDegrees);
    if (!Number.isFinite(time) || !Number.isFinite(pitch) || Number(targetFps) < this.minimumFps || Number(confidence) < 0.45) {
      this.previousValidAtMs = null;
      this.previousValidState = null;
      this.latest = Object.freeze({
        available: false,
        reason: Number(targetFps) < this.minimumFps ? 'INSUFFICIENT_VISION_FRAME_RATE' : 'INSUFFICIENT_HEAD_POSE',
        count: this.count,
        clusterCount: this.clusterCount,
        eligibleListeningMs: this.eligibleListeningMs,
        listeningNodsPerMinute: this.eligibleListeningMs > 0 ? Number((this.count * 60_000 / this.eligibleListeningMs).toFixed(1)) : null,
      });
      return this.latest;
    }
    if (this.previousValidAtMs !== null && ALLOWED_STATES.has(this.previousValidState)) {
      this.eligibleListeningMs += Math.max(0, Math.min(250, time - this.previousValidAtMs));
    }
    this.previousValidAtMs = time;
    this.previousValidState = state;
    if (!ALLOWED_STATES.has(state)) {
      this.excursionStartedAtMs = null;
      this.latest = Object.freeze({
        available: true,
        count: this.count,
        clusterCount: this.clusterCount,
        eligibleListeningMs: this.eligibleListeningMs,
        listeningNodsPerMinute: this.eligibleListeningMs > 0 ? Number((this.count * 60_000 / this.eligibleListeningMs).toFixed(1)) : null,
        state,
        gated: true,
        event: null,
        claim: 'OBSERVED_HEAD_PITCH_CYCLE',
      });
      return this.latest;
    }
    this.rest.push(pitch);
    if (this.rest.length > 45) this.rest.shift();
    const baseline = median(this.rest) ?? pitch;
    const displacement = pitch - baseline;
    let event = null;
    if (this.excursionStartedAtMs === null && Math.abs(displacement) >= this.excursionDegrees && time - this.lastEventAtMs >= this.refractoryMs) {
      this.excursionStartedAtMs = time;
    } else if (this.excursionStartedAtMs !== null) {
      if (Math.abs(displacement) <= this.returnToleranceDegrees) {
        const durationMs = time - this.excursionStartedAtMs;
        if (durationMs <= this.maximumCycleMs) {
          const sameCluster = time - this.lastEventAtMs <= 2_500;
          this.count += 1;
          if (!sameCluster) this.clusterCount += 1;
          this.lastEventAtMs = time;
          event = Object.freeze({ type: 'HEAD_PITCH_CYCLE', startMs: this.excursionStartedAtMs, endMs: time, state, cluster: this.clusterCount });
          this.events.push(event);
          if (this.events.length > 60) this.events.shift();
        }
        this.excursionStartedAtMs = null;
      } else if (time - this.excursionStartedAtMs > this.maximumCycleMs) this.excursionStartedAtMs = null;
    }
    this.latest = Object.freeze({
      available: true,
      count: this.count,
      clusterCount: this.clusterCount,
      eligibleListeningMs: this.eligibleListeningMs,
      listeningNodsPerMinute: this.eligibleListeningMs > 0 ? Number((this.count * 60_000 / this.eligibleListeningMs).toFixed(1)) : null,
      state,
      event,
      baselinePitchDegrees: baseline,
      claim: 'OBSERVED_HEAD_PITCH_CYCLE',
      confidence: Number(confidence) >= 0.75 ? 'HIGH' : 'MODERATE',
      provenance: Object.freeze({ source: 'FACIAL_TRANSFORMATION_MATRIX', method: 'LISTENING_HEAD_PITCH_CYCLE' }),
    });
    return this.latest;
  }
}
