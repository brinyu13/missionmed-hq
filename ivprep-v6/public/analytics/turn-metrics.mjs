function quantile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** Session-clock response latency and in-turn silence; never transcript-derived. */
export class TurnMetrics {
  constructor({ pauseMinimumMs = 250, longPauseMs = 1_000, maximumEvents = 120 } = {}) {
    this.pauseMinimumMs = pauseMinimumMs;
    this.longPauseMs = longPauseMs;
    this.maximumEvents = maximumEvents;
    this.reset();
  }

  reset() {
    this.interviewerEndedAtMs = null;
    this.responseLatencyMs = null;
    this.pauseStartedAtMs = null;
    this.pauses = [];
    return this.snapshot();
  }

  ingest(event, atMs, { state = 'UNKNOWN' } = {}) {
    const time = Number(atMs);
    if (!Number.isFinite(time)) return this.snapshot();
    if (event === 'INTERVIEWER_SPEECH_END') {
      this.interviewerEndedAtMs = time;
      this.responseLatencyMs = null;
    }
    if (['USER_SPEECH_START', 'USER_SPEECH_RESUME'].includes(event)) {
      if (this.responseLatencyMs === null && Number.isFinite(this.interviewerEndedAtMs)) {
        this.responseLatencyMs = Math.max(0, time - this.interviewerEndedAtMs);
      }
      this.#closePause(time, state);
    }
    if (event === 'USER_SPEECH_END' && this.pauseStartedAtMs === null) this.pauseStartedAtMs = time;
    if (event === 'ANSWER_END') this.#closePause(time, state);
    return this.snapshot(time);
  }

  #closePause(endMs, state) {
    if (this.pauseStartedAtMs === null) return;
    const durationMs = Math.max(0, endMs - this.pauseStartedAtMs);
    if (durationMs >= this.pauseMinimumMs) {
      this.pauses.push(Object.freeze({
        type: durationMs >= this.longPauseMs ? 'PAUSE_LONG' : 'PAUSE',
        startMs: this.pauseStartedAtMs,
        endMs,
        durationMs,
        state,
      }));
      if (this.pauses.length > this.maximumEvents) this.pauses.shift();
    }
    this.pauseStartedAtMs = null;
  }

  snapshot(atMs = null) {
    const durations = this.pauses.map(({ durationMs }) => durationMs);
    const currentPauseMs = this.pauseStartedAtMs !== null && Number.isFinite(atMs)
      ? Math.max(0, atMs - this.pauseStartedAtMs)
      : 0;
    return Object.freeze({
      available: true,
      responseLatencyMs: this.responseLatencyMs,
      responseLatencyAvailable: Number.isFinite(this.responseLatencyMs),
      pauseCount: this.pauses.length,
      longPauseCount: this.pauses.filter(({ type }) => type === 'PAUSE_LONG').length,
      meanPauseMs: mean(durations),
      p90PauseMs: quantile(durations, 0.9),
      longestPauseMs: durations.length ? Math.max(...durations) : null,
      currentPauseMs,
      events: Object.freeze([...this.pauses]),
      provenance: Object.freeze({ source: 'SILERO_V5_SESSION_CLOCK', method: 'VAD_TURN_SILENCE' }),
    });
  }
}
