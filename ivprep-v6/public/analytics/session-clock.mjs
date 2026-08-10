export class SessionClock {
  constructor({ sessionId, now = () => performance.now(), wallClock = () => Date.now() } = {}) {
    if (!sessionId) throw new TypeError('sessionId is required.');
    this.sessionId = String(sessionId);
    this.now = now;
    this.origin = Number(now());
    this.wallClockAnchor = Number(wallClock());
    if (!Number.isFinite(this.origin) || !Number.isFinite(this.wallClockAnchor)) throw new TypeError('Clock origins must be finite.');
    this.lastMs = 0;
    this.answers = new Map();
  }

  sessionMs(at = this.now()) {
    const elapsed = this.projectMs(at);
    this.lastMs = Math.max(this.lastMs, elapsed);
    return Math.round(this.lastMs);
  }

  projectMs(at = this.now()) {
    const elapsed = Math.max(0, Number(at) - this.origin);
    if (!Number.isFinite(elapsed)) throw new TypeError('Clock reading must be finite.');
    return Math.round(elapsed);
  }

  startAnswer(answerId, at = this.now()) {
    const id = String(answerId || '').trim();
    if (!id || this.answers.has(id)) throw new TypeError('answerId must be new and non-empty.');
    const record = { answerId: id, startedAtMs: this.sessionMs(at), endedAtMs: null };
    this.answers.set(id, record);
    return { ...record };
  }

  answerMs(answerId, at = this.now()) {
    const record = this.answers.get(String(answerId));
    if (!record) throw new TypeError('Unknown answerId.');
    return Math.max(0, this.sessionMs(at) - record.startedAtMs);
  }

  endAnswer(answerId, at = this.now()) {
    const record = this.answers.get(String(answerId));
    if (!record || record.endedAtMs !== null) throw new TypeError('Answer is unknown or already ended.');
    record.endedAtMs = this.sessionMs(at);
    return { ...record, durationMs: Math.max(0, record.endedAtMs - record.startedAtMs) };
  }

  envelope() {
    return Object.freeze({
      sessionId: this.sessionId,
      monotonicDurationMs: this.sessionMs(),
      wallClockAnchor: new Date(this.wallClockAnchor).toISOString(),
    });
  }
}
