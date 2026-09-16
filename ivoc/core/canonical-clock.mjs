export class CanonicalClock {
  #monotonicNow;
  #wallNow;
  #startedAt;
  #pausedAt;
  #pausedTotal = 0;
  #holes = [];

  constructor({ monotonicNow = () => performance.now(), wallNow = () => new Date().toISOString() } = {}) {
    this.#monotonicNow = monotonicNow;
    this.#wallNow = wallNow;
  }

  start() {
    if (this.#startedAt !== undefined) throw new Error('clock already started');
    this.#startedAt = this.#monotonicNow();
    return { t_media_ms: 0, t_wall: this.#wallNow() };
  }

  now() {
    if (this.#startedAt === undefined) return -1;
    const edge = this.#pausedAt ?? this.#monotonicNow();
    return Math.max(0, Math.round(edge - this.#startedAt - this.#pausedTotal));
  }

  pause() {
    if (this.#startedAt === undefined || this.#pausedAt !== undefined) throw new Error('clock cannot pause');
    this.#pausedAt = this.#monotonicNow();
    return this.now();
  }

  resume() {
    if (this.#pausedAt === undefined) throw new Error('clock is not paused');
    const resumedAt = this.#monotonicNow();
    const durationMs = Math.max(0, resumedAt - this.#pausedAt);
    const hole = Object.freeze({ at_media_ms: this.now(), duration_ms: Math.round(durationMs) });
    this.#pausedTotal += durationMs;
    this.#pausedAt = undefined;
    this.#holes.push(hole);
    return structuredClone(hole);
  }

  sync() {
    return { t_media_ms: this.now(), t_wall: this.#wallNow(), perf_now: this.#monotonicNow() };
  }

  holes() {
    return structuredClone(this.#holes);
  }

  reconcile(containerDurationMs, thresholdMs = 120) {
    if (!Number.isFinite(containerDurationMs) || containerDurationMs < 0) throw new TypeError('container duration is invalid');
    const clockDurationMs = this.now();
    const driftMs = Math.round(containerDurationMs - clockDurationMs);
    return Object.freeze({
      clock_duration_ms: clockDurationMs,
      container_duration_ms: Math.round(containerDurationMs),
      drift_ms: driftMs,
      within_gate: Math.abs(driftMs) <= thresholdMs,
      retimeable: Math.abs(driftMs) > thresholdMs,
    });
  }
}
