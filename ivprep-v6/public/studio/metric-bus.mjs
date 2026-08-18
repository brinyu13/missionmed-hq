// Metric bus — measurement cartridge → normalized metric event → renderer.
//
// Y1-Y2-CAM-V6-3509. The 3494 hot-swap law: DSP must never live inside a gauge.
// SPD-C is a renderer for pace data, not the pace engine. This module is the only
// place that knows the shape of the analytics diagnostic payload; renderers consume
// normalized frames and can be replaced with minimal blast radius.
//
// Every metric carries its own availability. A metric with no evidence reports
// available:false with a reason and renders as UNAVAILABLE - never zero, never a
// neutral-looking midpoint, because both read as measurements.

export const METRICS = Object.freeze([
  'VOICE_LEVEL', 'VOLUME_VARIATION', 'PITCH', 'PITCH_VARIATION',
  'PACE', 'CADENCE', 'PAUSE', 'FACE', 'HANDS', 'FRAMING',
]);

const unavailable = (reason) => Object.freeze({ available: false, reason });

/** Rolling window used for variation/history without retaining unbounded state. */
class Window {
  #values = [];
  #max;
  constructor(max = 240) { this.#max = max; }
  push(v) {
    if (!Number.isFinite(v)) return this;
    this.#values.push(v);
    if (this.#values.length > this.#max) this.#values.shift();
    return this;
  }
  get values() { return this.#values; }
  get length() { return this.#values.length; }
  get last() { return this.#values.at(-1) ?? null; }
  get min() { return this.#values.length ? Math.min(...this.#values) : null; }
  get max() { return this.#values.length ? Math.max(...this.#values) : null; }
  get mean() { return this.#values.length ? this.#values.reduce((s, v) => s + v, 0) / this.#values.length : null; }
  get stdDev() {
    if (this.#values.length < 2) return null;
    const m = this.mean;
    return Math.sqrt(this.#values.reduce((s, v) => s + (v - m) ** 2, 0) / this.#values.length);
  }
  clear() { this.#values = []; return this; }
}

export class MetricBus extends EventTarget {
  #level = new Window(300);
  #pitch = new Window(300);
  #pauses = [];
  #speechEdges = [];
  #lastSpeaking = null;
  #frames = { audio: 0, vision: 0 };
  #latest = {};

  get latest() { return Object.freeze({ ...this.#latest }); }

  reset() {
    this.#level.clear(); this.#pitch.clear();
    this.#pauses = []; this.#speechEdges = []; this.#lastSpeaking = null;
    this.#frames = { audio: 0, vision: 0 };
    this.#latest = {};
    return this;
  }

  /** Feed a raw analytics diagnostic. Returns the normalized frame it produced. */
  ingest(detail = {}) {
    const frame = detail.modality === 'audio' ? this.#audio(detail)
      : detail.modality === 'vision' ? this.#vision(detail)
        : null;
    if (!frame) return null;
    this.#latest = { ...this.#latest, ...frame };
    this.dispatchEvent(new CustomEvent('metrics', { detail: Object.freeze(frame) }));
    return frame;
  }

  #audio(d) {
    this.#frames.audio += 1;
    const out = {};

    // ---- VOICE LEVEL. Level and variation are separate observables by law: a loud
    // monotone must not read as good on variation.
    // Y1-Y2-CAM-V6-3513: this read `d.capturedLevelDbfs`, a field name that does not
    // exist. measurePcmFrame() emits { rms, peak, clippedFraction }, so VOICE_LEVEL and
    // VOLUME_VARIATION could never populate while PITCH and PAUSE worked - the exact
    // split the Founder saw. Level is derived from the real rms here.
    const rms = Number.isFinite(d.rms) ? d.rms
      : (Number.isFinite(d.capturedLevelDbfs) ? null : null);
    const dbfs = Number.isFinite(d.capturedLevelDbfs) ? d.capturedLevelDbfs
      : (Number.isFinite(rms) && rms > 0 ? 20 * Math.log10(rms) : null);
    if (dbfs === null) {
      out.VOICE_LEVEL = unavailable('NO_AUDIO');
    } else {
      this.#level.push(dbfs);
      // -60..0 dBFS mapped to 0..1 for rendering only; the dBFS value is preserved.
      const norm = Math.max(0, Math.min(1, (dbfs + 60) / 60));
      out.VOICE_LEVEL = Object.freeze({
        available: true, dbfs, normalized: norm,
        peak: Number.isFinite(d.peak) ? d.peak : (Number.isFinite(d.peakAmplitude) ? d.peakAmplitude : null),
        history: this.#level.values.slice(-160),
        // Usable corridor, not a pass/fail score.
        inCorridor: dbfs > -34 && dbfs < -8,
      });
    }

    // ---- VOLUME VARIATION: spread of level over the window, in dB.
    const spread = this.#level.length >= 12 && this.#level.max !== null
      ? this.#level.max - this.#level.min : null;
    out.VOLUME_VARIATION = spread === null
      ? unavailable('NEED_MORE_SPEECH')
      : Object.freeze({
        available: true, rangeDb: spread, stdDevDb: this.#level.stdDev,
        // Flat is the failure mode this metric exists to expose.
        flat: spread < 4,
        normalized: Math.max(0, Math.min(1, spread / 24)),
      });

    // ---- PITCH: speaker-relative register from the real F0 engine. Never Hz targets.
    const pitch = d.pitch || null;
    const summary = pitch?.summary;
    if (!summary?.available) {
      const reason = summary?.reason === 'INSUFFICIENT_VOICED_AUDIO' ? 'ESTABLISHING_RANGE' : 'NO_VALIDATED_F0';
      out.PITCH = unavailable(reason);
      out.PITCH_VARIATION = unavailable(reason);
    } else {
      const semis = pitch.voiced && Number.isFinite(pitch.f0Hz)
        ? 12 * Math.log2(pitch.f0Hz / summary.medianHz) : null;
      if (semis !== null) this.#pitch.push(semis);
      out.PITCH = Object.freeze({
        available: true,
        voiced: pitch.voiced === true,
        semitones: semis,
        medianHz: summary.medianHz,
        f0Hz: pitch.voiced ? pitch.f0Hz : null,
        // Discrete registers are the approved VV4 language: five steps around the
        // speaker's own median, not an absolute frequency scale.
        register: semis === null ? null
          : semis <= -4 ? -2 : semis <= -1.5 ? -1 : semis < 1.5 ? 0 : semis < 4 ? 1 : 2,
        history: this.#pitch.values.slice(-160),
      });
      out.PITCH_VARIATION = Object.freeze({
        available: true,
        semitoneSpread: summary.rangeSemitones,
        variation: summary.variationSemitones,
        monotone: summary.variationSemitones < 1.2,
        normalized: Math.max(0, Math.min(1, summary.variationSemitones / 6)),
      });
    }

    // ---- PACE + CADENCE + PAUSE from speech/silence edges on the shared clock.
    const speaking = d.speaking === true;
    if (this.#lastSpeaking !== speaking && Number.isFinite(d.atMs)) {
      this.#speechEdges.push({ atMs: d.atMs, speaking });
      if (this.#speechEdges.length > 120) this.#speechEdges.shift();
      if (!speaking) this.#pauses.push(d.atMs);
      this.#lastSpeaking = speaking;
    }

    // Phrase rate from speech onsets: a real rhythm signal that needs no transcript.
    const onsets = this.#speechEdges.filter((e) => e.speaking);
    if (onsets.length >= 3) {
      const gaps = [];
      for (let i = 1; i < onsets.length; i += 1) gaps.push(onsets[i].atMs - onsets[i - 1].atMs);
      const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const phrasesPerMinute = meanGap > 0 ? 60000 / meanGap : null;
      out.PACE = Object.freeze({
        available: true,
        phrasesPerMinute,
        // Zone drives the SPD-C corridor rendering; deliberate slow and fast are
        // legitimate, so this is a corridor and not a target.
        zone: phrasesPerMinute === null ? 'unknown'
          : phrasesPerMinute > 70 ? 'fast' : phrasesPerMinute < 22 ? 'slow' : 'usable',
        normalized: phrasesPerMinute === null ? null : Math.max(0, Math.min(1, phrasesPerMinute / 90)),
        speaking,
      });
      // Cadence = regularity of those gaps. Perfectly metronomic is the failure mode.
      const gapMean = meanGap;
      const gapSd = Math.sqrt(gaps.reduce((s, g) => s + (g - gapMean) ** 2, 0) / gaps.length);
      const cv = gapMean > 0 ? gapSd / gapMean : null;
      out.CADENCE = cv === null ? unavailable('NEED_MORE_PHRASES') : Object.freeze({
        available: true,
        variability: cv,
        metronomic: cv < 0.18,
        normalized: Math.max(0, Math.min(1, cv / 0.9)),
        gaps: gaps.slice(-24),
      });
    } else {
      out.PACE = unavailable('NEED_MORE_SPEECH');
      out.CADENCE = unavailable('NEED_MORE_PHRASES');
    }

    out.PAUSE = Object.freeze({
      available: true,
      speaking,
      inPauseMs: Number.isFinite(d.pauseInProgressMs) ? d.pauseInProgressMs : 0,
      count: this.#pauses.length,
    });

    return out;
  }

  #vision(d) {
    this.#frames.vision += 1;
    const out = {};
    const g = d.geometry || null;
    const ff = d.faceFamily || null;

    // ---- FACE: compact family status for the student. Individual lanes stay in
    // Analytics Lab / Film Room. Observable language only.
    if (!ff?.available) {
      out.FACE = unavailable(ff?.reason === 'NO_FACE_BLENDSHAPES' ? 'NO_FACE_IN_FRAME' : 'NO_FACE_DATA');
    } else {
      const mv = ff.movementVariability;
      const dwell = ff.cameraDwell;
      const smile = ff['FACE.SMILE'];
      const brow = ff['FACE.BROW'];
      out.FACE = Object.freeze({
        available: true,
        expressiveRange: mv?.available ? mv.value : null,
        coverage: mv?.available ? mv.coverage : null,
        cameraFacingRatio: dwell?.available ? dwell.cameraFacingRatio : null,
        gazeReleases: dwell?.available ? dwell.gazeReleases : null,
        smileActive: smile?.availability === 'AVAILABLE' ? smile.active === true : null,
        browActive: brow?.availability === 'AVAILABLE' ? brow.active === true : null,
        // Descriptive only. No target dwell, and no affect claim anywhere.
        summary: mv?.available
          ? (mv.value > 0.06 ? 'Natural movement' : 'Low facial movement')
          : 'Measuring',
      });
    }

    // ---- HANDS: only what is genuinely measured. No gesture classifier exists yet,
    // so no gesture types are claimed.
    const hands = g?.hands || null;
    if (!hands) {
      out.HANDS = unavailable('NO_VISION');
    } else {
      const left = hands.left?.present === true;
      const right = hands.right?.present === true;
      out.HANDS = Object.freeze({
        available: true,
        left, right, both: left && right,
        leftZone: hands.left?.zone ?? null,
        rightZone: hands.right?.zone ?? null,
        activity: left || right ? (left && right ? 'both' : 'single') : 'none',
        // Explicit: classification is not implemented, so the UI must not imply it.
        gestureClassification: Object.freeze({ available: false, reason: 'NOT_IMPLEMENTED' }),
      });
    }

    // ---- FRAMING: readiness, not raw geometry.
    const face = g?.face || null;
    const pose = g?.pose || null;
    if (!face) {
      out.FRAMING = unavailable('NO_FACE_IN_FRAME');
    } else {
      const yaw = Number.isFinite(face.yawDeg) ? face.yawDeg : null;
      out.FRAMING = Object.freeze({
        available: true,
        facePresent: face.present === true,
        torsoPresent: pose?.torsoPresent === true,
        yawDeg: yaw,
        cameraFacing: yaw === null ? null : Math.abs(yaw) < 18,
        lateralLeanDeg: Number.isFinite(pose?.lateralLeanDeg) ? pose.lateralLeanDeg : null,
        stable: yaw === null ? null : Math.abs(yaw) < 25,
      });
    }
    return out;
  }
}

/**
 * Adaptive HUD arbiter — the one-big-correction law.
 *
 * Exactly one correction is ever elevated. Selection is by severity among metrics that
 * actually have evidence; a metric that is UNAVAILABLE can never produce a coaching
 * statement, because there is nothing to coach from.
 */
export function selectCorrection(latest = {}) {
  const candidates = [];
  const v = latest.VOLUME_VARIATION;
  if (v?.available && v.flat) candidates.push({ metric: 'VOLUME_VARIATION', severity: 3, headline: 'Volume variation', instruction: 'Flat — vary your level' });
  const lvl = latest.VOICE_LEVEL;
  if (lvl?.available && !lvl.inCorridor) {
    candidates.push({ metric: 'VOICE_LEVEL', severity: lvl.dbfs <= -34 ? 4 : 2, headline: 'Voice level', instruction: lvl.dbfs <= -34 ? 'Too quiet — project more' : 'Very loud — ease off' });
  }
  const pace = latest.PACE;
  if (pace?.available && pace.zone === 'fast') candidates.push({ metric: 'PACE', severity: 3, headline: 'Pace', instruction: 'Too fast — let it breathe' });
  const pv = latest.PITCH_VARIATION;
  if (pv?.available && pv.monotone) candidates.push({ metric: 'PITCH_VARIATION', severity: 2, headline: 'Pitch variation', instruction: 'Monotone — move your register' });
  const cad = latest.CADENCE;
  if (cad?.available && cad.metronomic) candidates.push({ metric: 'CADENCE', severity: 1, headline: 'Cadence', instruction: 'Very even — vary your phrasing' });
  const fr = latest.FRAMING;
  if (fr?.available && fr.cameraFacing === false) candidates.push({ metric: 'FRAMING', severity: 2, headline: 'Framing', instruction: 'Square up to the camera' });

  if (!candidates.length) {
    const anyEvidence = Object.values(latest).some((m) => m?.available);
    return anyEvidence
      ? Object.freeze({ state: 'locked', headline: 'Holding', instruction: 'In corridor — keep going' })
      : Object.freeze({ state: 'idle', headline: 'Ready', instruction: 'Start speaking to begin measuring' });
  }
  candidates.sort((a, b) => b.severity - a.severity);
  return Object.freeze({ state: 'warn', ...candidates[0] });
}

/** Compact peripheral status: every enabled metric, small, never a wall of gauges. */
export function statusRail(latest = {}) {
  const label = {
    VOICE_LEVEL: 'VOL', VOLUME_VARIATION: 'VOL VAR', PITCH: 'PITCH', PITCH_VARIATION: 'PITCH VAR',
    PACE: 'PACE', CADENCE: 'CADENCE', PAUSE: 'PAUSE', FACE: 'FACE', HANDS: 'HANDS', FRAMING: 'FRAME',
  };
  return METRICS.map((id) => {
    const m = latest[id];
    if (!m?.available) return { id, label: label[id], state: 'unavailable' };
    let state = 'ok';
    if (id === 'VOLUME_VARIATION' && m.flat) state = 'warn';
    if (id === 'VOICE_LEVEL' && !m.inCorridor) state = 'warn';
    if (id === 'PACE' && m.zone === 'fast') state = 'warn';
    if (id === 'PITCH_VARIATION' && m.monotone) state = 'warn';
    if (id === 'CADENCE' && m.metronomic) state = 'warn';
    if (id === 'FRAMING' && m.cameraFacing === false) state = 'warn';
    return { id, label: label[id], state };
  });
}
