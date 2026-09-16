export const NO_CUE = Object.freeze({ cue_id: null, decision: 'NO_CUE' });

export class CueArbiter {
  constructor({ dwellMs = 1200, showMs = 3000, refractoryMs = 10000, maxPerAnswer = 3 } = {}) {
    this.config = { dwellMs, showMs, refractoryMs, maxPerAnswer };
    this.candidates = new Map();
    this.lastShownAt = -Infinity;
    this.shownForAnswer = 0;
  }

  beginAnswer() {
    this.candidates.clear();
    this.shownForAnswer = 0;
  }

  decide({ nowMs, candidates = [], fault = null }) {
    if (!Number.isFinite(nowMs)) throw new TypeError('nowMs is required');
    if (fault) return { cue_id: fault, decision: 'SHOW', reason: 'fault_bypass', visible_until_ms: nowMs + this.config.showMs };
    const active = new Set(candidates.map((candidate) => candidate.cue_id));
    for (const [cueId] of this.candidates) if (!active.has(cueId)) this.candidates.delete(cueId);
    for (const candidate of candidates) {
      if (!candidate?.cue_id || !Number.isFinite(candidate.priority)) throw new TypeError('candidate is invalid');
      if (!this.candidates.has(candidate.cue_id)) this.candidates.set(candidate.cue_id, { ...candidate, since: nowMs });
    }
    if (this.shownForAnswer >= this.config.maxPerAnswer) return { ...NO_CUE, reason: 'answer_limit' };
    if (nowMs - this.lastShownAt < this.config.refractoryMs) return { ...NO_CUE, reason: 'refractory' };
    const eligible = [...this.candidates.values()].filter((candidate) => nowMs - candidate.since >= this.config.dwellMs).sort((a, b) => b.priority - a.priority || a.cue_id.localeCompare(b.cue_id));
    if (!eligible.length) return { ...NO_CUE, reason: 'dwell' };
    const selected = eligible[0];
    this.lastShownAt = nowMs;
    this.shownForAnswer += 1;
    this.candidates.delete(selected.cue_id);
    return { cue_id: selected.cue_id, decision: 'SHOW', reason: 'eligible', visible_until_ms: nowMs + this.config.showMs };
  }
}
