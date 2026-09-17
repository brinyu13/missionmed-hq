// Y1-Y2-CAM-V6-3521 — Founder-conformant, presentation-only live HUD renderers (visual pass 4).
//
// These renderers consume already-derived observable frames. They do not own media,
// inference, thresholds, coaching policy, or session lifecycle. A hidden HUD may stop
// painting, but the upstream measurement pipeline must continue. Every missing input
// fails closed to the literal word UNAVAILABLE; no neutral midpoint or synthetic sample
// is drawn in its place.

export const HUD_METRICS = Object.freeze([
  'head-face',
  'body',
  'volume',
  'speed',
  'modulation',
  'pitch',
]);

const COLORS = Object.freeze({
  screen: '#020914',
  grid: 'rgba(35,72,98,.28)',
  line: '#1c3046',
  ink: '#ffffff',
  soft: '#cbd5ee',
  dim: '#8da1b7',
  orange: '#ff8a1e',
  gold: '#ffb300',
  ok: '#65d21f',
  warn: '#ffb300',
  bad: '#e5484d',
  cyan: '#23c5e8',
  violet: '#8b7cf7',
});

const STATE_COLOR = Object.freeze({
  ok: COLORS.ok,
  good: COLORS.ok,
  target: COLORS.ok,
  warn: COLORS.warn,
  warning: COLORS.warn,
  quiet: COLORS.warn,
  loud: COLORS.bad,
  bad: COLORS.bad,
  error: COLORS.bad,
  unavailable: COLORS.warn,
  idle: COLORS.dim,
  neutral: COLORS.cyan,
  live: COLORS.cyan,
});

export const VOCAL_VARIATION_TRACES = Object.freeze(['volume', 'pitch', 'speed']);
export const VOCAL_VARIATION_SIGNAL_HOLD_MS = Object.freeze({
  volume: 0,
  pitch: 1_200,
  speed: 2_000,
});
export const PITCH_VISUAL_HOLD_MS = 1_200;

export function normalizeVocalVariationValue(trace, value) {
  if (!finite(value)) return null;
  if (trace === 'volume') return clamp((value + 60) / 60);
  if (trace === 'pitch') return clamp((value + 6) / 12);
  if (trace === 'speed') return clamp(value / 240);
  throw new RangeError(`Unknown Vocal Variation trace: ${trace}`);
}

export class VocalVariationTraceVisibility {
  constructor(visible = VOCAL_VARIATION_TRACES) {
    this.visible = new Set(visible.filter((trace) => VOCAL_VARIATION_TRACES.includes(trace)));
  }

  set(trace, visible) {
    if (!VOCAL_VARIATION_TRACES.includes(trace)) throw new RangeError(`Unknown Vocal Variation trace: ${trace}`);
    if (visible) this.visible.add(trace);
    else this.visible.delete(trace);
    return this.snapshot();
  }

  toggle(trace) { return this.set(trace, !this.visible.has(trace)); }

  setAll(visible) {
    this.visible = new Set(visible ? VOCAL_VARIATION_TRACES : []);
    return this.snapshot();
  }

  snapshot() {
    const visible = Object.freeze(VOCAL_VARIATION_TRACES.filter((trace) => this.visible.has(trace)));
    return Object.freeze({
      visible,
      hidden: Object.freeze(VOCAL_VARIATION_TRACES.filter((trace) => !this.visible.has(trace))),
    });
  }
}

// Strict on purpose: null and the empty string coerce to numeric zero, which would
// turn a missing measurement into a plausible-looking value.
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value)));
const labelReason = (reason = 'NO_SIGNAL') => String(reason).replaceAll('_', ' ').trim().toUpperCase();
const stateName = (state) => String(state || 'neutral').toLowerCase();
const stateColor = (state) => STATE_COLOR[stateName(state)] || COLORS.cyan;

function setText(node, text, state) {
  if (!node) return;
  node.textContent = text;
  if (state) node.dataset.state = stateName(state);
}

function formatNumber(value, digits = 1) {
  return finite(value) ? Number(value).toFixed(digits) : 'UNAVAILABLE';
}

export function continuousVocalVariationPoints(history, { holdGapMs = 0, endAtMs = null } = {}) {
  const ordered = (Array.isArray(history) ? history : [])
    .filter((sample) => finite(sample?.atMs))
    .sort((a, b) => a.atMs - b.atMs);
  const points = [];
  let lastObserved = null;
  for (const sample of ordered) {
    if (finite(sample.value)) {
      lastObserved = { atMs: Number(sample.atMs), value: Number(sample.value) };
      points.push({ ...lastObserved, observed: true });
      continue;
    }
    const gapMs = lastObserved ? Number(sample.atMs) - lastObserved.atMs : Infinity;
    points.push(lastObserved && gapMs <= holdGapMs
      ? { atMs: Number(sample.atMs), value: lastObserved.value, observed: false }
      : { atMs: Number(sample.atMs), value: null, observed: false });
  }
  const tailAtMs = finite(endAtMs) ? Number(endAtMs) : null;
  if (lastObserved && tailAtMs !== null && tailAtMs > (points.at(-1)?.atMs ?? -Infinity)) {
    const gapMs = tailAtMs - lastObserved.atMs;
    if (gapMs <= holdGapMs) points.push({ atMs: tailAtMs, value: lastObserved.value, observed: false });
  }
  return points;
}

function fitCanvas(canvas) {
  const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 260));
  const height = Math.max(1, Math.round(rect.height || canvas.clientHeight || 100));
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function clearScreen(context, width, height, { grid = true } = {}) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = COLORS.screen;
  context.fillRect(0, 0, width, height);
  if (!grid) return;
  context.strokeStyle = COLORS.grid;
  context.lineWidth = 1;
  const spacing = Math.max(16, Math.round(Math.min(width, height) / 5));
  for (let x = spacing; x < width; x += spacing) {
    context.beginPath();
    context.moveTo(x + .5, 0);
    context.lineTo(x + .5, height);
    context.stroke();
  }
  for (let y = spacing; y < height; y += spacing) {
    context.beginPath();
    context.moveTo(0, y + .5);
    context.lineTo(width, y + .5);
    context.stroke();
  }
}

function drawUnavailable(context, width, height, reason) {
  clearScreen(context, width, height, { grid: false });
  context.save();
  context.strokeStyle = 'rgba(255,169,40,.20)';
  context.lineWidth = 1;
  for (let x = -height; x < width + height; x += 10) {
    context.beginPath();
    context.moveTo(x, height);
    context.lineTo(x + height, 0);
    context.stroke();
  }
  context.restore();
  context.fillStyle = COLORS.warn;
  context.font = '700 9px "Space Grotesk", ui-monospace, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const suffix = labelReason(reason);
  const message = suffix === 'NO SIGNAL' ? 'UNAVAILABLE' : `UNAVAILABLE · ${suffix}`;
  context.fillText(message, width / 2, height / 2, Math.max(80, width - 18));
}

function setSignalRegion(node, state) {
  if (node?.dataset) node.dataset.state = stateName(state);
}

const PIANO_WHITE_KEYS = Object.freeze([
  { offset: -7, index: 0 }, { offset: -5, index: 1 }, { offset: -3, index: 2 },
  { offset: -1, index: 3 }, { offset: 0, index: 4 }, { offset: 2, index: 5 },
  { offset: 4, index: 6 }, { offset: 5, index: 7 }, { offset: 7, index: 8 },
]);
const PIANO_BLACK_KEYS = Object.freeze([
  { offset: -6, after: 0 }, { offset: -4, after: 1 }, { offset: -2, after: 2 },
  { offset: 1, after: 4 }, { offset: 3, after: 5 }, { offset: 6, after: 7 },
]);

function drawPianoKeyboard(context, width, height, { activeSemitone = null, held = false } = {}) {
  clearScreen(context, width, height, { grid: false });
  const left = 5;
  const top = 5;
  const labelHeight = 15;
  const keyHeight = Math.max(24, height - top - labelHeight);
  const whiteWidth = Math.max(5, (width - left * 2) / PIANO_WHITE_KEYS.length);
  const active = finite(activeSemitone) ? clamp(Math.round(activeSemitone), -7, 7) : null;
  for (const key of PIANO_WHITE_KEYS) {
    const x = left + key.index * whiteWidth;
    context.fillStyle = key.offset === active ? (held ? '#7f7142' : COLORS.gold) : '#dce5ea';
    context.fillRect(x, top, Math.max(2, whiteWidth - 1), keyHeight);
    context.strokeStyle = '#172536';
    context.lineWidth = 1;
    context.strokeRect(x, top, Math.max(2, whiteWidth - 1), keyHeight);
    if (key.offset === 0) {
      context.fillStyle = COLORS.cyan;
      context.fillRect(x + 2, top + keyHeight - 5, Math.max(1, whiteWidth - 5), 3);
    }
  }
  const blackWidth = whiteWidth * .58;
  const blackHeight = keyHeight * .62;
  for (const key of PIANO_BLACK_KEYS) {
    const x = left + (key.after + 1) * whiteWidth - blackWidth / 2;
    context.fillStyle = key.offset === active ? (held ? '#6f5b2c' : COLORS.orange) : '#07101d';
    context.fillRect(x, top, blackWidth, blackHeight);
    context.strokeStyle = key.offset === active ? COLORS.gold : '#2e4355';
    context.strokeRect(x, top, blackWidth, blackHeight);
  }
  context.font = '700 8px ui-monospace, monospace';
  context.textBaseline = 'alphabetic';
  context.fillStyle = COLORS.dim;
  context.textAlign = 'left';
  context.fillText('LOW', left, height - 3);
  context.textAlign = 'center';
  context.fillStyle = COLORS.cyan;
  context.fillText('MEDIAN', width / 2, height - 3);
  context.textAlign = 'right';
  context.fillStyle = COLORS.dim;
  context.fillText('HIGH', width - left, height - 3);
}

function drawTrend(canvas, values, { color = COLORS.cyan, floor = null, ceiling = null } = {}) {
  if (!canvas) return;
  const fit = fitCanvas(canvas);
  clearScreen(fit.context, fit.width, fit.height);
  const samples = (values || []).map((entry) => Number(entry?.value ?? entry)).filter(Number.isFinite);
  if (samples.length < 2) {
    drawUnavailable(fit.context, fit.width, fit.height, 'NEED_MORE_HISTORY');
    return;
  }
  const low = Number.isFinite(floor) ? floor : Math.min(...samples);
  const high = Number.isFinite(ceiling) ? ceiling : Math.max(...samples);
  const spread = Math.max(0.0001, high - low);
  fit.context.beginPath();
  samples.forEach((sample, index) => {
    const x = index / (samples.length - 1) * fit.width;
    const y = fit.height - 5 - clamp((sample - low) / spread) * (fit.height - 10);
    if (index === 0) fit.context.moveTo(x, y);
    else fit.context.lineTo(x, y);
  });
  fit.context.strokeStyle = color;
  fit.context.lineWidth = 1.6;
  fit.context.stroke();
}

function drawCanonicalFace(context, width, height, frame) {
  const cx = width * .5;
  const cy = height * .53;
  const rx = width * .34;
  const ry = height * .44;
  const point = (x, y) => ({ x: cx + x * rx, y: cy + y * ry });
  const path = (vertices, close = false) => {
    context.beginPath();
    vertices.forEach(([x, y], index) => {
      const mapped = point(x, y);
      if (index === 0) context.moveTo(mapped.x, mapped.y);
      else context.lineTo(mapped.x, mapped.y);
    });
    if (close) context.closePath();
    context.stroke();
  };
  context.save();
  context.strokeStyle = 'rgba(57,214,255,.78)';
  context.lineWidth = 1.05;
  context.beginPath();
  context.moveTo(cx, cy - ry);
  context.bezierCurveTo(cx + rx * .78, cy - ry * .96, cx + rx * 1.04, cy - ry * .34, cx + rx * .86, cy + ry * .30);
  context.bezierCurveTo(cx + rx * .70, cy + ry * .78, cx + rx * .30, cy + ry, cx, cy + ry);
  context.bezierCurveTo(cx - rx * .30, cy + ry, cx - rx * .70, cy + ry * .78, cx - rx * .86, cy + ry * .30);
  context.bezierCurveTo(cx - rx * 1.04, cy - ry * .34, cx - rx * .78, cy - ry * .96, cx, cy - ry);
  context.closePath();
  context.stroke();
  for (const side of [-1, 1]) {
    context.beginPath();
    context.ellipse(cx + side * rx * .93, cy - ry * .02, rx * .16, ry * .22, 0, 0, Math.PI * 2);
    context.stroke();
  }
  context.globalAlpha = .34;
  for (const fraction of [-.66, -.33, 0, .33, .66]) {
    context.beginPath();
    context.ellipse(cx, cy, rx * (1 - Math.abs(fraction) * .24), ry, fraction * .28, Math.PI * .10, Math.PI * .90);
    context.stroke();
  }
  for (const fraction of [-.62, -.32, 0, .32, .62]) {
    context.beginPath();
    context.moveTo(cx - rx * .86, cy + ry * fraction);
    context.quadraticCurveTo(cx, cy + ry * (fraction + .12), cx + rx * .86, cy + ry * fraction);
    context.stroke();
  }
  context.globalAlpha = 1;
  const mesh = [
    [[0,-1],[-.46,-.70],[-.78,-.28],[-.72,.18],[-.46,.62],[0,1]],
    [[0,-1],[.46,-.70],[.78,-.28],[.72,.18],[.46,.62],[0,1]],
    [[-.70,-.48],[-.28,-.62],[0,-.52],[.28,-.62],[.70,-.48]],
    [[-.82,-.18],[-.38,-.26],[0,-.14],[.38,-.26],[.82,-.18]],
    [[-.78,.20],[-.34,.10],[0,.25],[.34,.10],[.78,.20]],
    [[-.62,.55],[-.26,.44],[0,.58],[.26,.44],[.62,.55]],
  ];
  for (const vertices of mesh) path(vertices);
  context.fillStyle = 'rgba(47,191,99,.14)';
  path([[-.72,-.26],[-.20,-.34],[-.10,-.08],[-.62,.06]], true);
  context.fill();
  path([[.72,-.26],[.20,-.34],[.10,-.08],[.62,.06]], true);
  context.fill();
  context.fillStyle = 'rgba(255,169,40,.16)';
  path([[-.72,.02],[-.18,.05],[-.25,.40],[-.62,.52]], true);
  context.fill();
  path([[.72,.02],[.18,.05],[.25,.40],[.62,.52]], true);
  context.fill();
  const eyeState = frame.gazeProxy?.available ? COLORS.ok : COLORS.warn;
  const mouthState = frame.mouthCornerElevation?.available
    ? (frame.mouthCornerElevation.active ? COLORS.ok : COLORS.gold)
    : COLORS.warn;
  context.strokeStyle = eyeState;
  context.lineWidth = 2;
  for (const side of [-1, 1]) {
    context.beginPath();
    context.moveTo(cx + side * rx * .68, cy - ry * .24);
    context.quadraticCurveTo(cx + side * rx * .42, cy - ry * .34, cx + side * rx * .16, cy - ry * .22);
    context.quadraticCurveTo(cx + side * rx * .42, cy - ry * .12, cx + side * rx * .68, cy - ry * .24);
    context.stroke();
    context.fillStyle = 'rgba(47,191,99,.17)';
    context.fill();
  }
  context.strokeStyle = COLORS.gold;
  context.beginPath();
  context.moveTo(cx, cy - ry * .28);
  context.lineTo(cx - rx * .12, cy + ry * .19);
  context.lineTo(cx, cy + ry * .26);
  context.lineTo(cx + rx * .14, cy + ry * .18);
  context.stroke();
  context.strokeStyle = mouthState;
  context.beginPath();
  context.moveTo(cx - rx * .42, cy + ry * .48);
  context.quadraticCurveTo(cx, cy + ry * .34, cx + rx * .42, cy + ry * .48);
  context.quadraticCurveTo(cx, cy + ry * .67, cx - rx * .42, cy + ry * .48);
  context.stroke();
  context.strokeStyle = 'rgba(57,214,255,.72)';
  path([[-.50,.76],[-.24,.88],[0,1],[.24,.88],[.50,.76]]);
  context.restore();
}

function drawCanonicalBody(context, width, height, frame) {
  const cx = width * .5;
  const top = height * .08;
  const shoulderY = height * .27;
  const hipY = height * .60;
  const kneeY = height * .80;
  const footY = height * .96;
  const shoulderHalf = width * .17;
  const hipHalf = width * .11;
  const handsVisible = /L|R|BOTH/i.test(frame.handsLabel || '');
  context.save();
  context.strokeStyle = 'rgba(57,214,255,.82)';
  context.fillStyle = 'rgba(35,197,232,.16)';
  context.lineWidth = 1.15;

  context.beginPath();
  context.moveTo(cx, top);
  context.bezierCurveTo(cx + width * .045, top, cx + width * .055, top + height * .10, cx, top + height * .13);
  context.bezierCurveTo(cx - width * .055, top + height * .10, cx - width * .045, top, cx, top);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(cx - shoulderHalf, shoulderY);
  context.quadraticCurveTo(cx, shoulderY - height * .08, cx + shoulderHalf, shoulderY);
  context.lineTo(cx + hipHalf, hipY);
  context.lineTo(cx - hipHalf, hipY);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = 'rgba(35,197,232,.12)';
  context.beginPath();
  context.moveTo(cx - hipHalf, hipY);
  context.lineTo(cx - width * .045, kneeY);
  context.lineTo(cx - width * .075, footY);
  context.lineTo(cx - width * .15, footY);
  context.lineTo(cx - width * .12, kneeY);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(cx + hipHalf, hipY);
  context.lineTo(cx + width * .045, kneeY);
  context.lineTo(cx + width * .075, footY);
  context.lineTo(cx + width * .15, footY);
  context.lineTo(cx + width * .12, kneeY);
  context.closePath();
  context.fill();
  context.stroke();

  const joints = {
    leftShoulder: [cx - shoulderHalf, shoulderY], rightShoulder: [cx + shoulderHalf, shoulderY],
    leftElbow: [cx - width * .255, height * .45], rightElbow: [cx + width * .255, height * .45],
    leftWrist: [cx - width * .29, height * .62], rightWrist: [cx + width * .29, height * .62],
    leftHip: [cx - hipHalf, hipY], rightHip: [cx + hipHalf, hipY],
    leftKnee: [cx - width * .095, kneeY], rightKnee: [cx + width * .095, kneeY],
    leftFoot: [cx - width * .13, footY], rightFoot: [cx + width * .13, footY],
  };
  const segments = [
    ['leftShoulder','leftElbow'],['leftElbow','leftWrist'],['rightShoulder','rightElbow'],['rightElbow','rightWrist'],
    ['leftHip','leftKnee'],['leftKnee','leftFoot'],['rightHip','rightKnee'],['rightKnee','rightFoot'],
    ['leftShoulder','rightHip'],['rightShoulder','leftHip'],['leftHip','rightHip'],
  ];
  context.beginPath();
  for (const [from, to] of segments) {
    context.moveTo(...joints[from]);
    context.lineTo(...joints[to]);
  }
  context.moveTo(cx, top + height * .13);
  context.lineTo(cx, hipY);
  context.stroke();
  context.fillStyle = COLORS.cyan;
  for (const [x, y] of Object.values(joints)) {
    context.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
  }

  context.strokeStyle = handsVisible ? COLORS.ok : COLORS.dim;
  for (const side of [-1, 1]) {
    const wristX = cx + side * width * .29;
    const wristY = height * .62;
    const palmTipY = wristY + height * .07;
    context.beginPath();
    context.moveTo(wristX - side * width * .025, wristY);
    context.lineTo(wristX - side * width * .035, palmTipY);
    context.lineTo(wristX + side * width * .035, palmTipY);
    context.lineTo(wristX + side * width * .025, wristY);
    context.closePath();
    context.stroke();
    for (let finger = -2; finger <= 2; finger += 1) {
      const rootX = wristX + side * width * finger * .009;
      context.beginPath();
      context.moveTo(rootX, palmTipY);
      context.lineTo(rootX + side * width * finger * .006, palmTipY + height * (.045 + (2 - Math.abs(finger)) * .008));
      context.stroke();
    }
  }

  context.strokeStyle = 'rgba(47,191,99,.72)';
  context.fillStyle = 'rgba(101,210,31,.24)';
  context.beginPath();
  context.ellipse(cx, shoulderY + height * .11, width * .105, height * .095, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = 'rgba(101,210,31,.18)';
  for (const side of [-1, 1]) {
    context.beginPath();
    context.ellipse(cx + side * width * .078, shoulderY + height * .035, width * .065, height * .055, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
  context.strokeStyle = 'rgba(255,194,75,.72)';
  context.beginPath();
  context.moveTo(cx - shoulderHalf * .72, shoulderY + height * .015);
  context.quadraticCurveTo(cx, shoulderY + height * .07, cx + shoulderHalf * .72, shoulderY + height * .015);
  context.stroke();
  context.restore();
}

class HudRenderer {
  constructor(root, metric) {
    this.root = root;
    this.metric = metric;
    this.canvas = root.querySelector(`[data-hud-canvas="${metric}"]`);
    this.value = root.querySelector(`[data-hud-value="${metric}"]`);
    this.unit = root.querySelector(`[data-hud-unit="${metric}"]`);
    this.status = root.querySelector(`[data-hud-state="${metric}"]`);
    this.lastFrame = null;
  }

  context() {
    return this.canvas ? fitCanvas(this.canvas) : null;
  }

  unavailable(reason = 'NO_SIGNAL') {
    this.lastFrame = Object.freeze({ available: false, reason });
    const fit = this.context();
    if (fit) drawUnavailable(fit.context, fit.width, fit.height, reason);
    setText(this.value, this.metric === 'volume' || this.metric === 'modulation' ? 'UNAVAILABLE' : '—', 'unavailable');
    setText(this.status, `UNAVAILABLE — ${labelReason(reason)}`, 'unavailable');
  }

  update(frame) {
    this.lastFrame = frame;
    if (!frame || frame.available === false) {
      this.unavailable(frame?.reason || 'NO_SIGNAL');
      return;
    }
    this.draw(frame);
  }

  resize() {
    if (this.lastFrame?.available !== false) this.update(this.lastFrame);
    else this.unavailable(this.lastFrame?.reason || 'NO_SIGNAL');
  }

  draw() {}
}

export class HeadFaceHudRenderer extends HudRenderer {
  constructor(root) {
    super(root, 'head-face');
    this.captureState = root.querySelector('[data-module="head-face"] .capture-state');
    this.readouts = Object.fromEntries(['framing', 'orientation', 'movement', 'events'].map((key) => [key, root.querySelector(`[data-hud-readout="head-face:${key}"]`)]));
    this.signalRegions = Object.fromEntries(['eyes', 'eyebrows', 'cheeks', 'mouth', 'chin'].map((key) => [key, root.querySelector(`[data-face-map-region="${key}"]`)]));
    this.smileGauge = root.querySelector('[data-face-smile-gauge]');
    this.smileValue = root.querySelector('[data-face-smile-value]');
    this.smileStatus = root.querySelector('[data-face-smile-status]');
    this.smileEvents = root.querySelector('[data-face-smile-events]');
    this.facing = root.querySelector('[data-face-facing]');
    this.away = root.querySelector('[data-face-away]');
    this.balance = root.querySelector('[data-face-balance]');
    this.blinkRate = root.querySelector('[data-face-blink-rate]');
    this.headNods = root.querySelector('[data-face-head-nods]');
    this.trend = root.querySelector('[data-face-trend]');
    this.activityState = root.querySelector('[data-face-activity-state]');
  }

  unavailable(reason = 'NO_CAMERA_SIGNAL') {
    this.lastFrame = Object.freeze({ available: false, reason });
    const fit = this.context();
    if (fit) fit.context.clearRect(0, 0, fit.width, fit.height);
    setText(this.status, `ACQUIRING — ${labelReason(reason)}`, 'unavailable');
    const idle = ['NO_VISION_FRAMES', 'NO_CAMERA_SIGNAL'].includes(reason);
    setText(this.captureState, idle ? '● Idle' : '● Signal gap', idle ? 'idle' : 'unavailable');
    Object.values(this.readouts).forEach((node) => setText(node, 'UNAVAILABLE', 'unavailable'));
    Object.values(this.signalRegions).forEach((node) => setSignalRegion(node, 'unavailable'));
    setText(this.smileValue, '—', 'unavailable');
    setText(this.smileStatus, 'Unavailable', 'unavailable');
    setText(this.smileEvents, '—', 'unavailable');
    setText(this.facing, '—', 'unavailable');
    setText(this.away, '—', 'unavailable');
    setText(this.blinkRate, '—', 'unavailable');
    setText(this.headNods, '—', 'unavailable');
    if (this.balance) this.balance.style.width = '0%';
    drawTrend(this.trend, []);
  }

  draw(frame) {
    const fit = this.context();
    if (!fit) return;
    if (frame.present !== true) {
      this.unavailable(frame.reason || 'FACE_NOT_DETECTED');
      return;
    }

    // This left-rail plate is an interpreted anatomical teaching instrument.
    // Raw landmarks and camera pixels belong only on the center camera.
    fit.context.clearRect(0, 0, fit.width, fit.height);
    const mouthActive = frame.mouthCornerElevation?.active === true;
    const browObserved = frame.movementLabel !== 'UNAVAILABLE';
    const browActive = frame.movementLabel === 'OBSERVED';
    const periocularActive = frame.periocularContraction?.active === true;
    const gazeAvailable = frame.gazeProxy?.available === true;
    setSignalRegion(this.signalRegions.eyes, gazeAvailable ? 'ok' : 'bad');
    setSignalRegion(this.signalRegions.eyebrows, browActive ? 'ok' : (browObserved ? 'warn' : 'bad'));
    setSignalRegion(this.signalRegions.cheeks, periocularActive ? 'ok' : (frame.periocularContraction?.available ? 'warn' : 'bad'));
    setSignalRegion(this.signalRegions.mouth, mouthActive ? 'ok' : (frame.mouthCornerElevation?.available ? 'warn' : 'bad'));
    setSignalRegion(this.signalRegions.chin, frame.present ? 'ok' : 'bad');

    const yaw = frame.yawProxyDeg ?? frame.yawDeg;
    const pitch = frame.pitchProxyDeg ?? frame.pitchDeg;
    const roll = frame.rollProxyDeg ?? frame.rollDeg;
    const framing = frame.framingLabel || (typeof frame.centered === 'boolean' ? (frame.centered ? 'CENTERED' : 'OFF CENTER') : (frame.present ? 'IN FRAME' : 'UNAVAILABLE'));
    const orientation = [yaw, pitch, roll].every(finite)
      ? `Y ${formatNumber(yaw, 0)}° · P ${formatNumber(pitch, 0)}° · R ${formatNumber(roll, 0)}°`
      : (frame.orientationLabel || 'UNAVAILABLE');
    const movement = finite(frame.movementRatePerSecond)
      ? `${formatNumber(frame.movementRatePerSecond, 2)} Δ/s`
      : (frame.movementLabel || 'UNAVAILABLE');
    const events = frame.eventsLabel || (finite(frame.eventCount) ? `${Number(frame.eventCount)} OBSERVED` : 'UNAVAILABLE');
    setText(this.readouts.framing, framing, frame.framingState || frame.state || 'neutral');
    setText(this.readouts.orientation, orientation, frame.orientationState || 'neutral');
    setText(this.readouts.movement, movement, frame.movementState || 'neutral');
    setText(this.readouts.events, events, frame.eventsState || 'neutral');
    const conversationState = String(frame.conversationState || 'UNKNOWN').replaceAll('_', ' ');
    setText(this.status, `TEACHING HUD · ${conversationState}`, frame.state || 'ok');
    setText(this.captureState, '● Live', 'live');

    const smile = frame.mouthCornerElevation;
    const smileLevel = smile?.available ? clamp(smile.bilateral ?? (smile.active ? .7 : .25)) : null;
    if (this.smileGauge) {
      this.smileGauge.style.setProperty('--metric-value', smileLevel === null ? '0' : String(smileLevel));
      this.smileGauge.style.setProperty('--metric-angle', `${-45 + (smileLevel || 0) * 180}deg`);
    }
    setText(this.smileValue, smileLevel === null ? '—' : (smile.active ? 'ACTIVE' : 'IDLE'), smile?.active ? 'ok' : 'neutral');
    setText(this.smileStatus, smile?.available ? (smile.active ? 'Pattern active' : 'Pattern idle') : 'Unavailable', smile?.available ? 'neutral' : 'unavailable');
    setText(this.smileEvents, frame.smileEvents?.available ? frame.smileEvents.count : '—', frame.smileEvents?.available ? 'ok' : 'unavailable');
    const dwell = frame.cameraFacingDwell;
    const facingRatio = dwell?.available ? clamp(dwell.cameraFacingRatio) : null;
    setText(this.facing, facingRatio === null ? '—' : `${Math.round(facingRatio * 100)}%`, dwell?.available ? 'ok' : 'unavailable');
    setText(this.away, facingRatio === null ? '—' : `${Math.round((1 - facingRatio) * 100)}%`, dwell?.available ? 'neutral' : 'unavailable');
    if (this.balance) this.balance.style.width = facingRatio === null ? '0%' : `${Math.round(facingRatio * 100)}%`;
    setText(this.blinkRate, frame.blinkRate?.available ? Math.round(frame.blinkRate.eventsPerMinute) : '—', frame.blinkRate?.available ? 'ok' : 'unavailable');
    setText(this.headNods, frame.headNods?.available ? frame.headNods.count : '—', frame.headNods?.available ? 'ok' : 'unavailable');
    const activityState = String(frame.facialActivity?.state || frame.conversationState || 'UNKNOWN').replaceAll('_', ' ');
    setText(this.activityState, `${activityState} WINDOW`, frame.facialActivity?.available ? 'live' : 'unavailable');
    drawTrend(this.trend, frame.geometryTrend?.available ? frame.geometryTrend.values : []);
  }
}

export class BodyHudRenderer extends HudRenderer {
  constructor(root) {
    super(root, 'body');
    this.captureState = root.querySelector('[data-module="body"] .capture-state');
    this.readouts = Object.fromEntries(['centered', 'shoulders', 'hands', 'gesture'].map((key) => [key, root.querySelector(`[data-hud-readout="body:${key}"]`)]));
    this.alignment = root.querySelector('[data-body-alignment]');
    this.alignmentNeedle = root.querySelector('[data-body-alignment-needle]');
    this.spine = root.querySelector('[data-body-spine]');
    this.headPosition = root.querySelector('[data-body-head-position]');
    this.centeredSummary = root.querySelector('[data-body-centered-summary]');
    this.movement = root.querySelector('[data-body-movement]');
    this.trend = root.querySelector('[data-body-trend]');
    this.signalRegions = Object.fromEntries(['shoulders', 'torso', 'left-hand', 'right-hand', 'movement'].map((key) => [key, root.querySelector(`[data-body-map-region="${key}"]`)]));
  }

  unavailable(reason = 'NO_CAMERA_SIGNAL') {
    this.lastFrame = Object.freeze({ available: false, reason });
    const fit = this.context();
    if (fit) fit.context.clearRect(0, 0, fit.width, fit.height);
    setText(this.status, `ACQUIRING — ${labelReason(reason)}`, 'unavailable');
    const idle = ['NO_VISION_FRAMES', 'NO_CAMERA_SIGNAL'].includes(reason);
    setText(this.captureState, idle ? '● Idle' : '● Signal gap', idle ? 'idle' : 'unavailable');
    Object.values(this.readouts).forEach((node) => setText(node, 'UNAVAILABLE', 'unavailable'));
    setText(this.alignment, '—', 'unavailable');
    setText(this.spine, 'UNAVAILABLE', 'unavailable');
    setText(this.headPosition, 'UNAVAILABLE', 'unavailable');
    setText(this.centeredSummary, 'UNAVAILABLE', 'unavailable');
    setText(this.movement, 'UNAVAILABLE', 'unavailable');
    Object.values(this.signalRegions).forEach((node) => setSignalRegion(node, 'unavailable'));
    if (this.alignmentNeedle) this.alignmentNeedle.style.transform = 'rotate(0deg)';
    drawTrend(this.trend, []);
  }

  draw(frame) {
    const fit = this.context();
    if (!fit) return;
    const leftHandPresent = frame.leftHandPresent === true;
    const rightHandPresent = frame.rightHandPresent === true;
    if (frame.present !== true && !leftHandPresent && !rightHandPresent) {
      this.unavailable(frame.reason || 'BODY_NOT_DETECTED');
      return;
    }

    // This left-rail plate is an interpreted anatomical teaching instrument.
    // Raw landmarks and camera pixels belong only on the center camera.
    fit.context.clearRect(0, 0, fit.width, fit.height);
    const centeredObserved = frame.centered === true;
    const movementActive = frame.movementLevel?.active === true;
    const activeRegion = ['left', 'right', 'both'].includes(frame.activeRegion) ? frame.activeRegion : null;
    const answering = frame.conversationState === 'ANSWERING';
    const gestureState = String(frame.gestureCorridorState || frame.gestureUnits?.corridorState || 'UNAVAILABLE');
    setSignalRegion(this.signalRegions.torso, centeredObserved ? 'ok' : (frame.present ? 'warn' : 'bad'));
    setSignalRegion(this.signalRegions.shoulders, frame.present ? (finite(frame.shoulderTiltDeg) && Math.abs(frame.shoulderTiltDeg) <= 8 ? 'ok' : 'warn') : 'bad');
    const handState = !answering ? 'neutral'
      : (!leftHandPresent && !rightHandPresent) ? 'bad'
        : gestureState === 'HEALTHY' ? 'ok'
          : ['LOW', 'EXCESSIVE'].includes(gestureState) ? 'warn'
            : 'neutral';
    setSignalRegion(this.signalRegions['left-hand'], leftHandPresent ? handState : (answering ? 'bad' : 'neutral'));
    setSignalRegion(this.signalRegions['right-hand'], rightHandPresent ? handState : (answering ? 'bad' : 'neutral'));
    setSignalRegion(this.signalRegions.movement, movementActive ? 'warn' : (frame.movementLevel?.available ? 'ok' : 'neutral'));
    const centered = frame.centeredLabel || (typeof frame.centered === 'boolean' ? (frame.centered ? 'CENTERED' : 'OFF CENTER') : 'UNAVAILABLE');
    const shoulders = frame.shoulderLabel || (finite(frame.shoulderTiltDeg) ? `${formatNumber(frame.shoulderTiltDeg, 1)}° TILT` : 'UNAVAILABLE');
    const hands = frame.handsLabel || ((leftHandPresent || rightHandPresent) ? `${leftHandPresent ? 'L' : '—'} / ${rightHandPresent ? 'R' : '—'} VISIBLE` : 'UNAVAILABLE');
    const gesture = frame.gestureLabel || (typeof frame.gestureActive === 'boolean' ? (frame.gestureActive ? 'MOTION ACTIVE' : 'NO MOTION EVENT') : 'UNAVAILABLE');
    setText(this.readouts.centered, centered, frame.centeredState || frame.state || 'neutral');
    setText(this.readouts.shoulders, shoulders, frame.shoulderState || 'neutral');
    setText(this.readouts.hands, hands, frame.handsState || 'neutral');
    setText(this.readouts.gesture, gesture, frame.gestureState || 'neutral');
    setText(this.spine, centered, frame.centeredState || frame.state || 'neutral');
    setText(this.headPosition, centered, frame.centeredState || frame.state || 'neutral');
    setText(this.centeredSummary, centered, frame.centeredState || frame.state || 'neutral');
    const conversationState = String(frame.conversationState || 'UNKNOWN').replaceAll('_', ' ');
    setText(this.status, `TEACHING HUD · ${conversationState}`, frame.state || 'ok');
    setText(this.captureState, '● Live', 'live');
    const lean = Number(frame.shoulderLabel?.match?.(/-?\d+(?:\.\d+)?/)?.[0]);
    setText(this.alignment, Number.isFinite(lean) ? `${Math.abs(lean).toFixed(0)}°` : (frame.centered ? 'CENTERED' : '—'), frame.centered ? 'ok' : 'warn');
    if (this.alignmentNeedle) this.alignmentNeedle.style.transform = `rotate(${Number.isFinite(lean) ? clamp(lean, -24, 24) * 2.2 : 0}deg)`;
    const movement = frame.movementLevel;
    setText(this.movement, movement?.available ? (movement.active ? 'ACTIVE' : 'LOW') : 'UNAVAILABLE', movement?.available ? (movement.active ? 'warn' : 'ok') : 'unavailable');
    drawTrend(this.trend, frame.movementTrend?.available ? frame.movementTrend.values : [], { floor: 0, ceiling: .04, color: COLORS.ok });
  }
}

export class VolumeHudRenderer extends HudRenderer {
  constructor(root) {
    super(root, 'volume');
    this.cue = root.querySelector('[data-volume-state-cue]');
  }

  unavailable(reason = 'NO_AUDIO_FRAMES') {
    super.unavailable(reason);
    setText(this.cue, 'UNAVAILABLE', 'unavailable');
  }

  draw(frame) {
    const level = frame.level ?? frame.dbfs ?? frame.rmsDb;
    if (!finite(level)) {
      this.unavailable(frame.reason || 'MIC_LEVEL_REQUIRED');
      return;
    }
    const fit = this.context();
    if (!fit) return;
    clearScreen(fit.context, fit.width, fit.height, { grid: false });
    const normalized = frame.silent === true ? 0 : finite(frame.normalized) ? clamp(frame.normalized) : clamp((Number(level) + 60) / 60);
    const segments = 16;
    const gap = 3;
    const segmentWidth = Math.max(2, (fit.width - gap * (segments - 1)) / segments);
    const lit = Math.round(normalized * segments);
    const corridor = Array.isArray(frame.corridor) && frame.corridor.length === 2 && frame.corridor.every(finite)
      ? [clamp(frame.corridor[0]), clamp(frame.corridor[1])]
      : null;
    for (let index = 0; index < segments; index += 1) {
      const x = index * (segmentWidth + gap);
      const position = (index + .5) / segments;
      const active = index < lit;
      const color = corridor
        ? position < corridor[0]
          ? '#1475e8'
          : position <= corridor[1]
            ? COLORS.ok
            : COLORS.bad
        : '#1475e8';
      fit.context.fillStyle = active ? color : 'rgba(33,42,57,.82)';
      fit.context.fillRect(x, 12, segmentWidth, fit.height - 24);
      fit.context.strokeStyle = active ? 'rgba(198,227,255,.86)' : 'rgba(86,100,125,.50)';
      fit.context.lineWidth = 1;
      fit.context.strokeRect(x + .5, 12.5, Math.max(1, segmentWidth - 1), Math.max(1, fit.height - 25));
    }
    fit.context.strokeStyle = COLORS.ink;
    fit.context.lineWidth = 2;
    if (corridor) {
      const start = corridor[0] * fit.width;
      const end = corridor[1] * fit.width;
      for (const [x, direction] of [[start, 1], [end, -1]]) {
        fit.context.beginPath();
        fit.context.moveTo(x, 4);
        fit.context.lineTo(x, 10);
        fit.context.lineTo(x + direction * 8, 10);
        fit.context.moveTo(x, fit.height - 4);
        fit.context.lineTo(x, fit.height - 10);
        fit.context.lineTo(x + direction * 8, fit.height - 10);
        fit.context.stroke();
      }
    }
    const zone = stateName(frame.zone || frame.state || 'neutral');
    const cue = frame.cue || (frame.silent === true
      ? '—'
      : !corridor
      ? 'NO BASELINE'
      : zone === 'target' || zone === 'ok'
      ? 'TARGET — HOLD'
      : zone === 'quiet' || zone === 'warn'
        ? 'QUIET — LIFT'
        : zone === 'loud' || zone === 'bad'
          ? 'LOUD — EASE'
          : 'LIVE LEVEL');
    setText(this.value, frame.silent === true ? '—' : finite(frame.score) ? `${formatNumber(frame.score, 1)}` : '—', zone);
    setText(this.cue, cue, zone);
    setText(this.status, frame.label || String(frame.zone || 'LIVE LEVEL').replaceAll('_', ' '), zone);
  }
}

export class SpeedHudRenderer extends HudRenderer {
  constructor(root) {
    super(root, 'speed');
    this.cue = root.querySelector('[data-speed-state-cue]');
  }

  #paintDial(fit, { normalized = null, corridor = [.70, .80] } = {}) {
    const cx = fit.width / 2;
    const cy = fit.height * .91;
    const radius = Math.min(fit.width * .43, fit.height * .78);
    const segments = 28;
    for (let index = 0; index < segments; index += 1) {
      const position = index / (segments - 1);
      const angle = Math.PI + position * Math.PI;
      const innerRadius = radius - Math.max(10, radius * .14);
      const inTarget = position >= corridor[0] && position <= corridor[1];
      const extreme = index === 0 || index === segments - 1;
      const traversed = finite(normalized) && position <= normalized;
      fit.context.strokeStyle = extreme ? COLORS.warn : inTarget ? COLORS.ok : traversed ? '#2388ff' : 'rgba(97,111,135,.62)';
      fit.context.lineWidth = Math.max(3, radius * .052);
      fit.context.lineCap = 'butt';
      fit.context.beginPath();
      fit.context.moveTo(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius);
      fit.context.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      fit.context.stroke();
    }
    if (!finite(normalized)) return;
    const angle = Math.PI + normalized * Math.PI;
    fit.context.strokeStyle = COLORS.ok;
    fit.context.lineWidth = 3;
    fit.context.beginPath();
    fit.context.moveTo(cx, cy);
    fit.context.lineTo(cx + Math.cos(angle) * (radius - 7), cy + Math.sin(angle) * (radius - 7));
    fit.context.stroke();
    fit.context.fillStyle = COLORS.gold;
    fit.context.beginPath();
    fit.context.arc(cx, cy, 3.2, 0, Math.PI * 2);
    fit.context.fill();
  }

  unavailable(reason = 'OBSERVED_WORD_TIMING_REQUIRED') {
    this.lastFrame = Object.freeze({ available: false, reason });
    const fit = this.context();
    if (fit) {
      clearScreen(fit.context, fit.width, fit.height, { grid: false });
      this.#paintDial(fit);
      fit.context.fillStyle = COLORS.warn;
      fit.context.font = '700 8px "Space Grotesk", ui-monospace, monospace';
      fit.context.textAlign = 'center';
      fit.context.textBaseline = 'middle';
      fit.context.fillText('WAITING FOR TIMED WORDS', fit.width / 2, fit.height * .62, Math.max(80, fit.width - 18));
    }
    setText(this.value, '—', 'unavailable');
    setText(this.cue, 'LISTENING FOR YOUR PACE…', 'unavailable');
    setText(this.status, `UNAVAILABLE — ${labelReason(reason)}`, 'unavailable');
  }

  draw(frame) {
    if (!finite(frame.wpm)) {
      this.unavailable(frame.reason || 'OBSERVED_WORD_TIMING_REQUIRED');
      return;
    }
    const fit = this.context();
    if (!fit) return;
    clearScreen(fit.context, fit.width, fit.height, { grid: false });
    const corridor = Array.isArray(frame.corridor) && frame.corridor.length === 2 && frame.corridor.every(finite)
      ? [clamp(frame.corridor[0]), clamp(frame.corridor[1])]
      : [.70, .80];
    const normalized = finite(frame.normalized) ? clamp(frame.normalized) : clamp(Number(frame.wpm) / 240);
    this.#paintDial(fit, { normalized, corridor });
    setText(this.value, finite(frame.score) ? `${formatNumber(frame.score, 1)}` : '—', frame.zone || frame.state || 'neutral');
    setText(this.cue, frame.cue || 'MEASURING PACE', frame.zone || frame.state || 'neutral');
    setText(this.status, frame.label || String(frame.zone || 'OBSERVED WORD TIMING').replaceAll('_', ' '), frame.zone || frame.state || 'neutral');
  }
}

export class VocalVariationHudRenderer extends HudRenderer {
  constructor(root) {
    super(root, 'modulation');
    this.traceVisibility = new VocalVariationTraceVisibility();
    this.controls = [...(root.querySelectorAll?.('[data-vocal-trace-toggle]') || [])];
    for (const control of this.controls) {
      control.addEventListener('click', () => {
        const trace = control.dataset.vocalTraceToggle;
        if (trace === 'all') {
          const allVisible = this.traceVisibility.snapshot().visible.length === VOCAL_VARIATION_TRACES.length;
          this.traceVisibility.setAll(!allVisible);
        } else {
          this.traceVisibility.toggle(trace);
        }
        this.#paintControls(this.lastFrame);
        if (this.lastFrame?.available !== false) this.draw(this.lastFrame);
      });
    }
    this.#paintControls(null);
  }

  traceSnapshot() { return this.traceVisibility.snapshot(); }

  #paintControls(frame) {
    const visible = new Set(this.traceVisibility.snapshot().visible);
    for (const control of this.controls) {
      const trace = control.dataset.vocalTraceToggle;
      const pressed = trace === 'all'
        ? visible.size === VOCAL_VARIATION_TRACES.length
        : visible.has(trace);
      control.setAttribute('aria-pressed', String(pressed));
      control.dataset.state = pressed ? 'visible' : 'hidden';
      if (trace !== 'all') {
        const available = frame?.histories?.[trace]?.some((sample) => finite(sample?.value)) === true;
        control.dataset.available = String(available);
      }
      if (trace === 'all') control.textContent = visible.size === VOCAL_VARIATION_TRACES.length ? 'Hide all' : 'Show all';
    }
  }

  draw(frame) {
    const fit = this.context();
    if (!fit) return;
    clearScreen(fit.context, fit.width, fit.height);
    this.#paintControls(frame);
    const histories = frame.histories || {};
    const visible = new Set(this.traceVisibility.snapshot().visible);
    const samples = VOCAL_VARIATION_TRACES
      .flatMap((trace) => Array.isArray(histories[trace]) ? histories[trace] : [])
      .filter((sample) => finite(sample?.atMs));
    const endAtMs = samples.length ? Math.max(...samples.map((sample) => sample.atMs)) : 0;
    const earliestAtMs = samples.length ? Math.min(...samples.map((sample) => sample.atMs)) : 0;
    const startAtMs = Math.max(0, endAtMs - (finite(frame.windowMs) ? frame.windowMs : 60_000), earliestAtMs);
    const durationMs = Math.max(1, endAtMs - startAtMs);
    const colors = { volume: COLORS.cyan, pitch: COLORS.orange, speed: COLORS.ok };
    let drawnTraces = 0;

    for (const trace of VOCAL_VARIATION_TRACES) {
      if (!visible.has(trace)) continue;
      const history = continuousVocalVariationPoints(histories[trace], {
        holdGapMs: VOCAL_VARIATION_SIGNAL_HOLD_MS[trace],
        endAtMs,
      }).filter((sample) => sample.atMs >= startAtMs);
      let previous = null;
      let segmentCount = 0;
      for (const sample of history) {
        const normalized = normalizeVocalVariationValue(trace, sample.value);
        if (!finite(normalized)) { previous = null; continue; }
        const x = ((sample.atMs - startAtMs) / durationMs) * fit.width;
        const y = fit.height - (normalized * fit.height * .76 + fit.height * .12);
        if (previous) {
          const bridged = previous.observed === false || sample.observed === false;
          fit.context.save();
          fit.context.beginPath();
          fit.context.moveTo(previous.x, previous.y);
          fit.context.lineTo(x, y);
          fit.context.strokeStyle = colors[trace];
          fit.context.lineWidth = trace === 'volume' ? 2 : 1.7;
          fit.context.globalAlpha = bridged ? .48 : 1;
          fit.context.setLineDash(bridged ? [4, 3] : []);
          fit.context.shadowColor = colors[trace];
          fit.context.shadowBlur = bridged ? 0 : 4;
          fit.context.stroke();
          fit.context.restore();
          segmentCount += 1;
        }
        previous = { x, y, observed: sample.observed };
      }
      if (segmentCount > 0) {
        drawnTraces += 1;
      }
    }

    if (visible.size === 0) {
      setText(this.status, 'ALL TRACES HIDDEN · MEASUREMENT CONTINUES', 'neutral');
    } else if (drawnTraces === 0) {
      setText(this.status, 'WAITING FOR OBSERVED MEASURED HISTORY', 'unavailable');
    } else {
      setText(this.status, frame.label || 'NORMALIZED LIVE HISTORY', frame.state || 'live');
    }
  }
}

export const ModulationHudRenderer = VocalVariationHudRenderer;

export class PitchHudRenderer extends HudRenderer {
  constructor(root) {
    super(root, 'pitch');
    this.cue = root.querySelector('[data-pitch-state-cue]');
    this.raw = root.querySelector('[data-pitch-raw]');
    this.lastVoicedFrame = null;
  }

  unavailable(reason = 'VOICED_F0_REQUIRED') {
    this.lastVoicedFrame = null;
    this.lastFrame = Object.freeze({ available: false, reason });
    const fit = this.context();
    if (fit) drawPianoKeyboard(fit.context, fit.width, fit.height);
    setText(this.value, '—', 'unavailable');
    setText(this.raw, '— st variation', 'unavailable');
    setText(this.cue, 'ESTABLISHING SPEAKER RANGE', 'unavailable');
    setText(this.status, `UNAVAILABLE — ${labelReason(reason)}`, 'unavailable');
  }

  draw(frame) {
    let displayFrame = frame;
    let recentHold = false;
    if (frame.voiced === true && finite(frame.semitones)) {
      this.lastVoicedFrame = Object.freeze({ ...frame });
    } else if (frame.voiced === false && this.lastVoicedFrame && finite(frame.atMs) && finite(this.lastVoicedFrame.atMs)) {
      recentHold = frame.atMs - this.lastVoicedFrame.atMs <= PITCH_VISUAL_HOLD_MS;
      if (recentHold) displayFrame = this.lastVoicedFrame;
    }
    if (frame.voiced === false && frame.available !== false && !recentHold) {
      const fit = this.context();
      if (fit) drawPianoKeyboard(fit.context, fit.width, fit.height);
      setText(this.value, '—', 'idle');
      setText(this.cue, 'UNVOICED', 'idle');
      setText(this.status, 'UNVOICED — WAITING FOR VALID F0', 'idle');
      return;
    }
    if (!finite(displayFrame.semitones)) {
      this.unavailable(frame.reason || 'VOICED_F0_REQUIRED');
      return;
    }
    const fit = this.context();
    if (!fit) return;
    const semitones = Number(displayFrame.semitones);
    drawPianoKeyboard(fit.context, fit.width, fit.height, { activeSemitone: semitones, held: recentHold });
    setText(this.value, finite(displayFrame.score) ? formatNumber(displayFrame.score, 1) : '—', recentHold ? 'idle' : frame.state || 'neutral');
    setText(this.cue, recentHold ? 'HOLDING RECENT VARIETY' : frame.cue || 'ESTABLISHING SPEAKER RANGE', recentHold ? 'holding' : frame.zone || frame.state || 'neutral');
    setText(this.status, recentHold ? 'RECENT VALID F0 · CURRENT FRAME UNVOICED' : frame.label || 'SPEAKER-RELATIVE REGISTER', recentHold ? 'idle' : frame.state || 'neutral');
  }
}

/**
 * One presentation facade for the runtime integration layer.
 *
 *   const hud = new LiveHudRenderers(document);
 *   hud.render('volume', { available: true, dbfs: -23.4, normalized: .61, zone: 'target' });
 *   hud.renderAll({ pitch: pitchFrame, 'head-face': faceFrame });
 *
 * `update()` is an alias of `render()` for event-stream consumers. Frames are never
 * retained outside this presentation object and no scheduling loop is started.
 */
export class LiveHudRenderers {
  constructor(root = document) {
    if (!root?.querySelector) throw new TypeError('LiveHudRenderers requires a Document or Element root');
    this.root = root;
    this.renderers = Object.freeze({
      'head-face': new HeadFaceHudRenderer(root),
      body: new BodyHudRenderer(root),
      volume: new VolumeHudRenderer(root),
      speed: new SpeedHudRenderer(root),
      modulation: new VocalVariationHudRenderer(root),
      pitch: new PitchHudRenderer(root),
    });
    this.resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this.resize())
      : null;
    Object.values(this.renderers).forEach((renderer) => {
      if (renderer.canvas) this.resizeObserver?.observe(renderer.canvas);
      renderer.unavailable();
    });
  }

  render(metric, frame) {
    const renderer = this.renderers[metric];
    if (!renderer) throw new RangeError(`Unknown HUD metric: ${metric}`);
    renderer.update(frame);
    return this;
  }

  update(metric, frame) { return this.render(metric, frame); }

  renderAll(frames = {}) {
    HUD_METRICS.forEach((metric) => {
      if (Object.hasOwn(frames, metric)) this.render(metric, frames[metric]);
    });
    return this;
  }

  updateAll(frames = {}) { return this.renderAll(frames); }

  unavailable(metric, reason = 'NO_SIGNAL') {
    const renderer = this.renderers[metric];
    if (!renderer) throw new RangeError(`Unknown HUD metric: ${metric}`);
    renderer.unavailable(reason);
    return this;
  }

  resize() {
    Object.values(this.renderers).forEach((renderer) => renderer.resize());
    return this;
  }

  destroy() {
    this.resizeObserver?.disconnect();
    return this;
  }
}

export function createLiveHudRenderers(root = document) {
  return new LiveHudRenderers(root);
}
