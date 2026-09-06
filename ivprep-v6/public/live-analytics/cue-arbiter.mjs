import { COACHING_CONFIG } from '../analytics/coaching-config.mjs';

const TRANSITIONS = new Set(['SETUP', 'TRANSITION_TO_ANSWER', 'TRANSITION_TO_LISTENING', 'NOTES']);

export class CueArbiter {
  constructor({ config = COACHING_CONFIG.cues } = {}) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.firstSeen = new Map();
    this.lastIssued = new Map();
    this.issued = [];
    this.answerIssued = 0;
    this.visibleUntilMs = -Infinity;
    return this;
  }

  select(candidates = [], { atMs, state, density = 'TRAINING', answerStartedAtMs = null } = {}) {
    const time = Math.round(Number(atMs));
    if (!Number.isFinite(time)) throw new TypeError('Cue arbitration requires atMs.');
    if (density === 'SIMULATION' || TRANSITIONS.has(state)) return null;
    if (Number.isFinite(answerStartedAtMs) && time - answerStartedAtMs < this.config.answerOpeningSuppressionMs) return null;
    if (time < this.visibleUntilMs) return null;
    const maximum = density === 'DRILL' ? this.config.trainingMaximumPerMinute : this.config.maximumPerMinute;
    this.issued = this.issued.filter((issuedAt) => time - issuedAt < 60_000);
    const usable = candidates.filter((candidate) => candidate?.active
      && !['LOW', 'UNAVAILABLE'].includes(candidate.confidence)
      && (candidate.coverage === undefined || Number(candidate.coverage) >= 0.7));
    const activeIds = new Set(usable.map((candidate) => candidate.id));
    for (const id of this.firstSeen.keys()) if (!activeIds.has(id)) this.firstSeen.delete(id);
    const eligible = [];
    for (const candidate of usable) {
      if (!candidate?.active || !candidate.id) continue;
      this.firstSeen.set(candidate.id, this.firstSeen.get(candidate.id) ?? time);
      const dwell = time - this.firstSeen.get(candidate.id);
      const refractory = time - (this.lastIssued.get(candidate.id) ?? -Infinity);
      if (dwell >= (candidate.minimumDwellMs ?? this.config.minimumDwellMs)
        && refractory >= (candidate.refractoryMs ?? this.config.refractoryMs)) eligible.push(candidate);
    }
    if (!eligible.length || this.issued.length >= maximum || this.answerIssued >= this.config.maximumPerAnswer) return null;
    eligible.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.id).localeCompare(String(b.id)));
    const selected = eligible[0];
    this.lastIssued.set(selected.id, time);
    this.issued.push(time);
    this.answerIssued += 1;
    this.visibleUntilMs = time + 3_000;
    return Object.freeze({ id: selected.id, message: String(selected.message || ''), priority: Number(selected.priority || 0), atMs: time, expiresAtMs: this.visibleUntilMs });
  }
}
