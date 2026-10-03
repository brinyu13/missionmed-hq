// ivoc.trace-reducer.v1 — ONE versioned sample reducer shared by the live Flight Recorder,
// Results and Film Room, so live and replay samples are identical point-for-point
// (closes the a74e9a6 live/Results divergence noted by the Astra Analytics Experience
// Contract §7). Strict finite checks: null is a GAP, never zero. No Math.random.
//
// Input: a cockpit frame in the 3528C `RealAnalyticsEngine.mapFrame` shape (real engine)
// or the identical shape produced by the fixture engine. Output: one trace sample.

export const TRACE_REDUCER_VERSION = 'ivoc.trace-reducer.v1';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const clamp01 = (v) => (v === null ? null : Math.max(0, Math.min(1, v)));

// Versioned, visible normalisations (never per-window auto-normalised).
export const NORMALISATION = Object.freeze({
  volume: 'VOLUME.normalized = (dbfs + 60) / 60; speech-gated',
  pitch: '(semitonesFromSpeakerMedian + 6) / 12; voiced + speech-gated',
  pace: '(wpm - 90) / 130; speech-gated',
  variety: 'score / 10; speech-gated',
});

export function traceSample(frame) {
  if (!frame || typeof frame !== 'object') return null;
  const t = num(frame.t);
  if (t === null) return null;
  const speaking = frame.speaking === true;
  const volume = frame.volume || {};
  const pitch = frame.pitch || {};
  const speed = frame.speedWpm || {};
  const variety = frame.volumeModulation || {};
  const head = frame.headFace || {};
  const body = frame.bodyHands || {};
  const vol = speaking && volume.available === true ? clamp01(num(volume.normalized)) : null;
  const st = num(pitch.semitonesFromSpeakerMedian);
  const pit = speaking && pitch.available === true && pitch.voiced === true && st !== null ? clamp01((st + 6) / 12) : null;
  const wpm = num(speed.wordsPerMinute);
  const pace = speaking && speed.available === true && wpm !== null ? clamp01((wpm - 90) / 130) : null;
  const vscore = num(variety.score);
  const varietyNorm = speaking && variety.available === true && vscore !== null ? clamp01(vscore / 10) : null;
  const signalGap = speaking && volume.available !== true && pitch.available !== true && speed.available !== true;
  return Object.freeze({
    t: Number(t.toFixed(3)),
    vol, pitch: pit, pace, variety: varietyNorm,
    speaking,
    state: typeof frame.state === 'string' ? frame.state : 'SETUP',
    hands: typeof body.visibility === 'string' ? body.visibility : 'UNAVAILABLE',
    presence: head.presence === 'TRACKED' ? 'TRACKED' : head.presence === 'SEARCHING' ? 'SEARCHING' : 'UNAVAILABLE',
    facing: num(head.cameraFacingPct),
    nods: num(head.nods),
    smiles: num(head.smileEvents),
    gestures: num(body.gestures),
    wpm: speed.available === true ? wpm : null,
    loudness: volume.available === true ? num(volume.scientificValue) : null,
    loudnessUnit: volume.available === true ? (volume.scientificUnit || null) : null,
    f0Hz: pitch.available === true && pitch.voiced === true ? num(pitch.f0Hz) : null,
    scores: {
      pace: num(speed.score), volume: num(volume.score), variety: num(variety.score),
    },
    signalGap,
  });
}

// Reduce a frame stream into a bounded history at 0.5 s cadence. Older samples are
// decimated past ten minutes; stored samples are never rewritten.
export class TraceHistory {
  constructor({ cadenceS = 0.5, retain = 7_200 } = {}) { this.cadenceS = cadenceS; this.retain = retain; this.samples = []; this.lastT = -Infinity; }
  push(frame, { force = false } = {}) {
    const sample = traceSample(frame);
    if (!sample) return null;
    if (!force && sample.t - this.lastT < this.cadenceS) return null;
    this.lastT = sample.t;
    this.samples.push(sample);
    if (this.samples.length > this.retain) {
      const recent = this.samples.slice(-1_200);
      const older = this.samples.slice(0, -1_200).filter((_, i) => i % 2 === 0);
      this.samples = [...older, ...recent];
    }
    return sample;
  }
  slice() { return this.samples.slice(); }
}

// Contiguous runs of a categorical lane (state, hands, presence, gap) for Film Room lanes.
export function intervalRuns(samples, key, value = (s) => s[key]) {
  const runs = [];
  let current = null;
  for (const s of samples) {
    const v = value(s);
    if (current && current.value === v) { current.endT = s.t; continue; }
    if (current) runs.push(current);
    current = { value: v, startT: s.t, endT: s.t };
  }
  if (current) runs.push(current);
  return runs;
}

// Dwell statistics for teaching ("pace stayed in your range 71% of answering time").
export function dwell(samples, predicate, { onlyState = 'ANSWERING' } = {}) {
  const inState = samples.filter((s) => !onlyState || s.state === onlyState);
  if (!inState.length) return { fraction: null, count: 0, total: 0 };
  const hits = inState.filter(predicate).length;
  return { fraction: hits / inState.length, count: hits, total: inState.length };
}
