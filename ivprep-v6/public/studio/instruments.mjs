// Approved Delivery Intelligence instrument renderers.
//
// Y1-Y2-CAM-V6-3509. These are RENDERERS ONLY. They consume normalized metric frames
// from metric-bus.mjs and contain no DSP, no thresholds of their own and no engine
// state, so a gauge can be replaced without touching measurement (3494 hot-swap law).
//
// Founder-selected mappings are deliberate and are NOT the donor concepts' original
// metrics:
//   VOICE LEVEL       VV1 + VV2 + continuous monitor trace
//   PITCH             VV4 stepped register language (reassigned to pitch)
//   PACE              SPD-C / VV5 corridor
//
// Every instrument renders UNAVAILABLE explicitly - hatched amber plus the word - and
// never a zero or a neutral midpoint, because both read as a measurement.

const DPR = () => Math.min(2, globalThis.devicePixelRatio || 1);

function fitCanvas(canvas) {
  const ratio = DPR();
  const w = canvas.clientWidth || 260;
  const h = canvas.clientHeight || 90;
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w, h };
}

const TOKENS = Object.freeze({
  ink: '#FFFFFF', ink2: '#CBD5EE', dim: '#7E8AAC',
  gold: '#FFC24B', goldA: '#FF8A1E', ok: '#2FBF63', warn: '#FFA928', bad: '#E5484D',
  screen: '#0A0E1E', grid: '#1B2A52',
});

function drawUnavailable(ctx, w, h, reason) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = TOKENS.screen;
  ctx.fillRect(0, 0, w, h);
  // Hatched amber is the binding fail-closed grammar.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,169,40,.18)';
  ctx.lineWidth = 1;
  for (let x = -h; x < w; x += 9) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = TOKENS.warn;
  ctx.font = '600 10px "Space Grotesk", ui-monospace, monospace';
  ctx.fillText(`UNAVAILABLE${reason ? ` — ${reason.replace(/_/gu, ' ')}` : ''}`, 10, h / 2 + 3);
}

function screen(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = TOKENS.screen;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(34,46,82,.55)';
  ctx.lineWidth = 1;
  for (let y = h / 4; y < h; y += h / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

/** Base: owns the canvas, the rAF loop and the availability gate. */
class Instrument {
  constructor(host, { title, id }) {
    this.id = id;
    this.frame = null;
    this.dirty = true;
    host.classList.add('inst');
    host.dataset.instrument = id;
    const head = document.createElement('div');
    head.className = 'inst-head';
    const plate = document.createElement('span');
    plate.className = 'inst-plate';
    plate.textContent = id;
    const name = document.createElement('span');
    name.className = 'inst-title';
    name.textContent = title;
    this.readout = document.createElement('span');
    this.readout.className = 'inst-readout';
    this.readout.textContent = '—';
    head.append(plate, name, this.readout);
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'inst-canvas';
    host.replaceChildren(head, this.canvas);
  }

  update(frame) { this.frame = frame; this.dirty = true; }

  render() {
    if (!this.dirty) return;
    this.dirty = false;
    const { ctx, w, h } = fitCanvas(this.canvas);
    if (!this.frame?.available) {
      drawUnavailable(ctx, w, h, this.frame?.reason);
      this.readout.textContent = 'UNAVAILABLE';
      this.readout.dataset.state = 'unavailable';
      return;
    }
    this.draw(ctx, w, h, this.frame);
  }

  draw() {}
}

/** VOICE LEVEL — VV1 column + VV2 target window + continuous monitor trace. */
export class VoiceLevelInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Voice level', id: 'VOL' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const colW = 26;
    // Usable corridor as a target window, not a pass mark.
    const top = h * 0.18;
    const bot = h * 0.72;
    ctx.fillStyle = 'rgba(255,194,75,.10)';
    ctx.fillRect(0, top, colW, bot - top);
    ctx.strokeStyle = 'rgba(255,194,75,.5)';
    ctx.strokeRect(0.5, top, colW - 1, bot - top);
    // Level column.
    const lvl = Math.max(0, Math.min(1, f.normalized));
    const barH = lvl * h;
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, TOKENS.goldA);
    grad.addColorStop(1, TOKENS.gold);
    ctx.fillStyle = f.inCorridor ? grad : TOKENS.warn;
    ctx.fillRect(2, h - barH, colW - 4, barH);
    // Continuous monitor trace — recent history scrolling right to left.
    const hist = f.history || [];
    if (hist.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = TOKENS.gold;
      ctx.lineWidth = 1.4;
      const x0 = colW + 8;
      const span = w - x0 - 4;
      hist.forEach((db, i) => {
        const x = x0 + (i / (hist.length - 1)) * span;
        const y = h - Math.max(0, Math.min(1, (db + 60) / 60)) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    this.readout.textContent = `${f.dbfs.toFixed(1)} dBFS`;
    this.readout.dataset.state = f.inCorridor ? 'ok' : 'warn';
  }
}

/** VOLUME VARIATION — distinct from level. Flat is the failure this exposes. */
export class VolumeVariationInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Volume variation', id: 'VVAR' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const mid = h / 2;
    const spread = Math.max(0, Math.min(1, f.normalized)) * (h * 0.42);
    ctx.fillStyle = f.flat ? 'rgba(255,169,40,.22)' : 'rgba(255,194,75,.20)';
    ctx.fillRect(0, mid - spread, w, spread * 2);
    ctx.strokeStyle = f.flat ? TOKENS.warn : TOKENS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, mid - spread); ctx.lineTo(w, mid - spread);
    ctx.moveTo(0, mid + spread); ctx.lineTo(w, mid + spread); ctx.stroke();
    ctx.strokeStyle = 'rgba(203,213,238,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    this.readout.textContent = `${f.rangeDb.toFixed(1)} dB${f.flat ? ' · FLAT' : ''}`;
    this.readout.dataset.state = f.flat ? 'warn' : 'ok';
  }
}

/** PITCH — VV4 stepped registers, speaker-relative. Never absolute Hz targets. */
export class PitchRegisterInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Pitch register', id: 'PIT' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const steps = [2, 1, 0, -1, -2];
    const rowH = h / steps.length;
    steps.forEach((step, i) => {
      const y = i * rowH;
      const active = f.register === step;
      ctx.fillStyle = active ? 'rgba(255,194,75,.9)' : 'rgba(27,42,82,.55)';
      ctx.fillRect(8, y + 3, w - 16, rowH - 6);
      ctx.fillStyle = active ? '#241503' : TOKENS.dim;
      ctx.font = '700 9px "Space Grotesk", ui-monospace, monospace';
      const name = step === 0 ? 'MEDIAN' : step > 0 ? `+${step}` : `${step}`;
      ctx.fillText(name, 14, y + rowH / 2 + 3);
    });
    this.readout.textContent = f.voiced && f.semitones !== null
      ? `${f.semitones >= 0 ? '+' : ''}${f.semitones.toFixed(1)} st`
      : 'UNVOICED';
    this.readout.dataset.state = f.voiced ? 'ok' : 'idle';
  }
}

/** PITCH VARIATION — semitone spread around the speaker's own median. */
export class PitchVariationInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Pitch variation', id: 'PVAR' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const n = 28;
    const amp = Math.max(0.04, Math.min(1, f.normalized));
    ctx.strokeStyle = f.monotone ? TOKENS.warn : TOKENS.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const x = (i / (n - 1)) * w;
      const y = h / 2 - Math.sin(i * 0.7) * (h * 0.34) * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    this.readout.textContent = `${f.variation.toFixed(2)} st${f.monotone ? ' · MONOTONE' : ''}`;
    this.readout.dataset.state = f.monotone ? 'warn' : 'ok';
  }
}

/** PACE — SPD-C / VV5 corridor. Deliberate slow and fast are legitimate. */
export class PaceInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Speaking pace', id: 'SPD' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const cx = w / 2;
    const cy = h * 0.92;
    const r = Math.min(w * 0.42, h * 0.78);
    // Corridor arc: the usable band is a region, not a point target.
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(27,42,82,.9)';
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,194,75,.28)';
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.30, false); ctx.stroke();
    // Needle.
    const t = Math.max(0, Math.min(1, f.normalized ?? 0));
    const angle = Math.PI - t * Math.PI;
    ctx.strokeStyle = f.zone === 'usable' ? TOKENS.gold : TOKENS.warn;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (r - 6), cy - Math.sin(angle) * (r - 6));
    ctx.stroke();
    ctx.fillStyle = TOKENS.dim;
    ctx.font = '700 9px "Space Grotesk", ui-monospace, monospace';
    ctx.fillText('SLOW', 6, h - 4);
    ctx.fillText('FAST', w - 30, h - 4);
    this.readout.textContent = f.phrasesPerMinute ? `${Math.round(f.phrasesPerMinute)} ph/min · ${f.zone}` : f.zone;
    this.readout.dataset.state = f.zone === 'usable' ? 'ok' : 'warn';
  }
}

/** CADENCE — rhythmic variation. Perfectly metronomic is the failure mode. */
export class CadenceInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Cadence', id: 'CAD' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const gaps = f.gaps || [];
    const max = gaps.length ? Math.max(...gaps) : 1;
    const bw = gaps.length ? Math.min(16, (w - 12) / gaps.length) : 0;
    gaps.forEach((g, i) => {
      const bh = (g / max) * (h * 0.72);
      ctx.fillStyle = f.metronomic ? TOKENS.warn : TOKENS.gold;
      ctx.fillRect(8 + i * bw, h - 10 - bh, Math.max(2, bw - 3), bh);
    });
    this.readout.textContent = f.metronomic ? 'VERY EVEN' : 'VARIED';
    this.readout.dataset.state = f.metronomic ? 'warn' : 'ok';
  }
}

/** PAUSE — speech / silence / pause length on the shared clock. */
export class PauseInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Pause', id: 'PSE' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const speaking = f.speaking === true;
    ctx.fillStyle = speaking ? 'rgba(47,191,99,.25)' : 'rgba(255,194,75,.20)';
    ctx.fillRect(0, h * 0.3, w, h * 0.4);
    ctx.fillStyle = speaking ? TOKENS.ok : TOKENS.gold;
    ctx.font = '800 13px Archivo, sans-serif';
    ctx.fillText(speaking ? 'SPEAKING' : `PAUSE ${(f.inPauseMs / 1000).toFixed(1)}s`, 12, h * 0.58);
    this.readout.textContent = `${f.count} pauses`;
    this.readout.dataset.state = 'ok';
  }
}

/** FACE — compact family status. Individual lanes live in Analytics Lab / Film Room. */
export class FaceStatusInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Facial movement', id: 'FACE' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const range = Math.max(0, Math.min(1, (f.expressiveRange ?? 0) * 12));
    ctx.fillStyle = 'rgba(27,42,82,.85)';
    ctx.fillRect(10, h * 0.34, w - 20, 12);
    ctx.fillStyle = TOKENS.gold;
    ctx.fillRect(10, h * 0.34, (w - 20) * range, 12);
    ctx.fillStyle = TOKENS.ink2;
    ctx.font = '700 10px "Space Grotesk", ui-monospace, monospace';
    // Observable phrasing only - never affect.
    const dwell = f.cameraFacingRatio === null ? 'dwell —' : `camera-facing ${Math.round(f.cameraFacingRatio * 100)}%`;
    ctx.fillText(`${f.summary} · ${dwell}`, 10, h * 0.72);
    this.readout.textContent = f.coverage === null ? 'measuring' : `coverage ${Math.round(f.coverage * 100)}%`;
    this.readout.dataset.state = 'ok';
  }
}

/** HANDS — activity and territory only. No gesture classification is claimed. */
export class HandsInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Hands', id: 'HND' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const box = (x, on, label) => {
      ctx.fillStyle = on ? 'rgba(255,194,75,.85)' : 'rgba(27,42,82,.8)';
      ctx.fillRect(x, h * 0.28, w * 0.4, h * 0.34);
      ctx.fillStyle = on ? '#241503' : TOKENS.dim;
      ctx.font = '800 10px Archivo, sans-serif';
      ctx.fillText(label, x + 10, h * 0.5);
    };
    box(10, f.left, 'LEFT');
    box(w * 0.52, f.right, 'RIGHT');
    ctx.fillStyle = TOKENS.dim;
    ctx.font = '600 9px "Space Grotesk", ui-monospace, monospace';
    ctx.fillText('gesture classification unavailable', 10, h - 8);
    this.readout.textContent = f.activity;
    this.readout.dataset.state = f.activity === 'none' ? 'idle' : 'ok';
  }
}

/** FRAMING — camera readiness, not raw geometry. */
export class FramingInstrument extends Instrument {
  constructor(host) { super(host, { title: 'Camera framing', id: 'FRM' }); }
  draw(ctx, w, h, f) {
    screen(ctx, w, h);
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = f.cameraFacing ? TOKENS.ok : TOKENS.warn;
    ctx.lineWidth = 2;
    const bw = w * 0.42;
    const bh = h * 0.56;
    ctx.strokeRect(cx - bw / 2, cy - bh / 2, bw, bh);
    const yaw = f.yawDeg ?? 0;
    ctx.fillStyle = f.cameraFacing ? TOKENS.ok : TOKENS.warn;
    ctx.beginPath();
    ctx.arc(cx + Math.max(-bw / 2, Math.min(bw / 2, yaw * 2)), cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TOKENS.dim;
    ctx.font = '600 9px "Space Grotesk", ui-monospace, monospace';
    ctx.fillText(f.torsoPresent ? 'face + torso' : 'face only', 8, h - 8);
    this.readout.textContent = f.cameraFacing ? 'SQUARE' : 'TURN TO CAMERA';
    this.readout.dataset.state = f.cameraFacing ? 'ok' : 'warn';
  }
}

export const INSTRUMENTS = Object.freeze({
  VOICE_LEVEL: VoiceLevelInstrument,
  VOLUME_VARIATION: VolumeVariationInstrument,
  PITCH: PitchRegisterInstrument,
  PITCH_VARIATION: PitchVariationInstrument,
  PACE: PaceInstrument,
  CADENCE: CadenceInstrument,
  PAUSE: PauseInstrument,
  FACE: FaceStatusInstrument,
  HANDS: HandsInstrument,
  FRAMING: FramingInstrument,
});

/**
 * Instrument rack. Owns a single rAF loop for every mounted instrument, so adding
 * gauges never adds render loops, and renders only when a frame changed.
 */
export class InstrumentRack {
  #instruments = new Map();
  #running = false;

  mount(hostEl, metricId) {
    const Ctor = INSTRUMENTS[metricId];
    if (!Ctor) throw new RangeError(`No instrument for ${metricId}`);
    const inst = new Ctor(hostEl);
    this.#instruments.set(metricId, inst);
    return inst;
  }

  /** Feed normalized metric frames. Unmounted metrics are ignored, not errors. */
  update(frame = {}) {
    for (const [id, inst] of this.#instruments) {
      if (frame[id]) inst.update(frame[id]);
    }
  }

  start() {
    if (this.#running) return this;
    this.#running = true;
    const tick = () => {
      if (!this.#running) return;
      for (const inst of this.#instruments.values()) inst.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return this;
  }

  stop() { this.#running = false; return this; }

  get mounted() { return [...this.#instruments.keys()]; }
}
