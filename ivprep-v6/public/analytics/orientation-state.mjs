import { COACHING_CONFIG } from './coaching-config.mjs';

export function classifyOrientation({ yawDegrees, pitchDegrees, confidence = 0, facePresent = false, state = 'UNKNOWN', provenance = null } = {}, config = COACHING_CONFIG.orientation) {
  const yaw = Number(yawDegrees);
  const pitch = Number(pitchDegrees);
  const numeric = Number.isFinite(yaw) && Number.isFinite(pitch);
  if (!facePresent || !numeric || Number(confidence) < config.minimumConfidence) {
    return Object.freeze({ orientation: 'UNKNOWN', state, confidence: 'UNAVAILABLE', reason: 'INSUFFICIENT_FACE_GEOMETRY', ...(provenance ? { provenance } : {}) });
  }
  let orientation = 'TOWARD_SCREEN';
  if (pitch <= -config.downPitchDegrees) orientation = 'DOWN';
  else if (Math.abs(yaw) >= config.awayYawDegrees || Math.abs(pitch) >= config.towardScreenPitchDegrees) orientation = 'AWAY';
  else if (Math.abs(yaw) > config.towardScreenYawDegrees) orientation = 'UNKNOWN';
  return Object.freeze({ orientation, state, confidence: Number(confidence) >= 0.75 ? 'HIGH' : 'MODERATE', yawDegrees: yaw, pitchDegrees: pitch, ...(provenance ? { provenance } : {}) });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Rolling state-aware classifier with bounded dwell so single-frame pose noise cannot emit a cue. */
export class OrientationTracker {
  constructor({ config = COACHING_CONFIG.orientation } = {}) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.frames = [];
    this.current = Object.freeze({ orientation: 'UNKNOWN', state: 'SETUP', confidence: 'UNAVAILABLE', reason: 'INSUFFICIENT_FACE_GEOMETRY' });
    this.candidate = null;
    this.candidateSinceMs = null;
    this.previousAtMs = null;
    this.previousState = null;
    this.timeByStateOrientation = new Map();
    this.downEpisodesSpeaking = 0;
    this.thinkingGazeEpisodes = 0;
    return this.current;
  }

  ingest({ atMs, ...frame } = {}) {
    const time = Number(atMs);
    if (!Number.isFinite(time)) return this.current;
    if (this.previousAtMs !== null) {
      const elapsed = Math.max(0, Math.min(500, time - this.previousAtMs));
      const key = `${this.previousState || 'UNKNOWN'}:${this.current.orientation}`;
      this.timeByStateOrientation.set(key, (this.timeByStateOrientation.get(key) || 0) + elapsed);
    }
    if (frame.facePresent && Number.isFinite(Number(frame.yawDegrees)) && Number.isFinite(Number(frame.pitchDegrees))) {
      this.frames.push({ yaw: Number(frame.yawDegrees), pitch: Number(frame.pitchDegrees) });
      while (this.frames.length > this.config.smoothingFrames) this.frames.shift();
    } else {
      this.frames = [];
    }
    const smoothed = this.frames.length ? {
      ...frame,
      yawDegrees: median(this.frames.map(({ yaw }) => yaw)),
      pitchDegrees: median(this.frames.map(({ pitch }) => pitch)),
    } : frame;
    const next = classifyOrientation(smoothed, this.config);
    if (next.orientation === this.current.orientation) {
      this.candidate = null;
      this.candidateSinceMs = null;
      this.current = this.#withContext(next);
      this.previousAtMs = time;
      this.previousState = frame.state;
      return this.current;
    }
    if (next.orientation !== this.candidate) {
      this.candidate = next.orientation;
      this.candidateSinceMs = time;
    }
    if (next.orientation === 'UNKNOWN' || time - this.candidateSinceMs >= this.config.changeDwellMs) {
      if (next.orientation === 'DOWN' && this.current.orientation !== 'DOWN') {
        if (frame.state === 'ANSWERING') this.downEpisodesSpeaking += 1;
        if (String(frame.state).startsWith('TRANSITION')) this.thinkingGazeEpisodes += 1;
      }
      this.current = next;
      this.candidate = null;
      this.candidateSinceMs = null;
    }
    this.current = this.#withContext(this.current);
    this.previousAtMs = time;
    this.previousState = frame.state;
    return this.current;
  }

  #withContext(value) {
    const state = value.state || 'UNKNOWN';
    const totals = {};
    let stateTotal = 0;
    for (const orientation of ['TOWARD_SCREEN', 'DOWN', 'AWAY', 'UNKNOWN']) {
      const durationMs = this.timeByStateOrientation.get(`${state}:${orientation}`) || 0;
      totals[orientation] = durationMs;
      stateTotal += durationMs;
    }
    const shares = Object.fromEntries(Object.entries(totals).map(([key, durationMs]) => [key, stateTotal ? durationMs / stateTotal : 0]));
    return Object.freeze({
      ...value,
      shares: Object.freeze(shares),
      downEpisodesSpeaking: this.downEpisodesSpeaking,
      thinkingGazeEpisodes: this.thinkingGazeEpisodes,
    });
  }
}
