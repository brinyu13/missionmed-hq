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

const FACE_CONTOUR = Object.freeze([10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]);
const LEFT_EYE = Object.freeze([33, 160, 158, 133, 153, 144, 33]);
const RIGHT_EYE = Object.freeze([362, 385, 387, 263, 373, 380, 362]);
const BROWS = Object.freeze([[70, 63, 105, 66, 107], [336, 296, 334, 293, 300]]);
const LIPS = Object.freeze([61, 40, 37, 0, 267, 270, 291, 321, 314, 17, 84, 91, 61]);

const POSE_CONNECTIONS = Object.freeze([
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
]);

const HAND_CONNECTIONS = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]);

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

function pointsFrom(value) {
  if (!Array.isArray(value)) return [];
  return value.map((point) => point && finite(point.x) && finite(point.y) ? point : null);
}

function canvasPoint(point, width, height) {
  const normalized = Math.abs(Number(point.x)) <= 1.25 && Math.abs(Number(point.y)) <= 1.25;
  return {
    x: normalized ? Number(point.x) * width : Number(point.x),
    y: normalized ? Number(point.y) * height : Number(point.y),
  };
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

function drawPolyline(context, points, indices, width, height, color, close = false) {
  const usable = indices.map((index) => points[index]).filter(Boolean);
  if (usable.length < 2) return;
  context.beginPath();
  usable.forEach((point, index) => {
    const mapped = canvasPoint(point, width, height);
    if (index === 0) context.moveTo(mapped.x, mapped.y);
    else context.lineTo(mapped.x, mapped.y);
  });
  if (close) context.closePath();
  context.strokeStyle = color;
  context.stroke();
}

function drawConnections(context, points, connections, width, height, color) {
  context.strokeStyle = color;
  context.lineWidth = 1.25;
  connections.forEach(([from, to]) => {
    if (!points[from] || !points[to]) return;
    const a = canvasPoint(points[from], width, height);
    const b = canvasPoint(points[to], width, height);
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  });
}

function drawLandmarks(context, points, width, height, color, radius = 1.3) {
  context.fillStyle = color;
  points.forEach((point) => {
    if (!point) return;
    const mapped = canvasPoint(point, width, height);
    context.beginPath();
    context.arc(mapped.x, mapped.y, radius, 0, Math.PI * 2);
    context.fill();
  });
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
    this.regions = Object.fromEntries(['eyes', 'eyebrows', 'cheeks', 'mouth', 'lips', 'chin'].map((key) => [key, root.querySelector(`[data-face-region="${key}"]`)]));
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
  }

  unavailable(reason = 'NO_CAMERA_SIGNAL') {
    super.unavailable(reason);
    const idle = ['NO_VISION_FRAMES', 'NO_CAMERA_SIGNAL'].includes(reason);
    setText(this.captureState, idle ? '● Idle' : '● Signal gap', idle ? 'idle' : 'unavailable');
    Object.values(this.readouts).forEach((node) => setText(node, 'UNAVAILABLE', 'unavailable'));
    Object.values(this.regions).forEach((node) => {
      node?.setAttribute('data-state', 'unavailable');
      setText(node?.querySelector('strong'), 'Unavailable', 'unavailable');
    });
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
    const points = pointsFrom(frame.landmarks || frame.faceLandmarks || frame.mesh);
    const hasGeometry = frame.present === true || points.length > 0;
    if (!hasGeometry) {
      this.unavailable(frame.reason || 'FACE_NOT_DETECTED');
      return;
    }

    // The Founder scanner plate is a presentation-only anatomical reference.
    // Keep this layer transparent so actual observed geometry can paint over it.
    fit.context.clearRect(0, 0, fit.width, fit.height);
    if (points.length >= 50) {
      fit.context.save();
      fit.context.globalAlpha = .66;
      fit.context.lineWidth = 1;
      const regionState = frame.regionStates || {};
      drawPolyline(fit.context, points, FACE_CONTOUR, fit.width, fit.height, stateColor(regionState.face || frame.state || 'live'), true);
      drawPolyline(fit.context, points, LEFT_EYE, fit.width, fit.height, stateColor(regionState.eyes || 'live'));
      drawPolyline(fit.context, points, RIGHT_EYE, fit.width, fit.height, stateColor(regionState.eyes || 'live'));
      BROWS.forEach((indices) => drawPolyline(fit.context, points, indices, fit.width, fit.height, stateColor(regionState.brows || 'live')));
      drawPolyline(fit.context, points, LIPS, fit.width, fit.height, stateColor(regionState.mouth || 'live'), true);
      drawLandmarks(fit.context, points.filter((_, index) => index % 5 === 0), fit.width, fit.height, 'rgba(57,214,255,.55)', 1);
      fit.context.restore();
    }

    const yaw = frame.yawProxyDeg ?? frame.yawDeg;
    const pitch = frame.pitchProxyDeg ?? frame.pitchDeg;
    const roll = frame.rollProxyDeg ?? frame.rollDeg;
    if (finite(yaw) || finite(pitch)) {
      const cx = fit.width / 2;
      const cy = fit.height / 2;
      fit.context.strokeStyle = COLORS.gold;
      fit.context.lineWidth = 2;
      fit.context.beginPath();
      fit.context.moveTo(cx, cy);
      fit.context.lineTo(cx + clamp(yaw || 0, -35, 35) / 35 * fit.width * .16, cy + clamp(pitch || 0, -30, 30) / 30 * fit.height * .13);
      fit.context.stroke();
      fit.context.fillStyle = COLORS.gold;
      fit.context.beginPath();
      fit.context.arc(cx, cy, 2.5, 0, Math.PI * 2);
      fit.context.fill();
    }

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
    setText(this.status, frame.transientOverlay ? 'TRANSIENT WORKER OVERLAY' : (points.length ? 'LIVE LANDMARKS' : 'COMPACT GEOMETRY PROXY'), frame.state || 'ok');
    setText(this.captureState, '● Live', 'live');

    const regionStatus = {
      eyes: frame.gazeProxy?.available,
      eyebrows: frame.movementLabel !== 'UNAVAILABLE',
      cheeks: frame.periocularContraction?.available,
      mouth: frame.mouthCornerElevation?.available,
      lips: frame.mouthCornerElevation?.available,
      chin: frame.present === true,
    };
    for (const [key, available] of Object.entries(regionStatus)) {
      const node = this.regions[key];
      const state = available ? 'tracked' : 'limited';
      node?.setAttribute('data-state', state);
      setText(node?.querySelector('strong'), available ? 'Tracked' : 'Limited signal', available ? 'ok' : 'warn');
    }
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
  }

  unavailable(reason = 'NO_CAMERA_SIGNAL') {
    super.unavailable(reason);
    const idle = ['NO_VISION_FRAMES', 'NO_CAMERA_SIGNAL'].includes(reason);
    setText(this.captureState, idle ? '● Idle' : '● Signal gap', idle ? 'idle' : 'unavailable');
    Object.values(this.readouts).forEach((node) => setText(node, 'UNAVAILABLE', 'unavailable'));
    setText(this.alignment, '—', 'unavailable');
    setText(this.spine, 'UNAVAILABLE', 'unavailable');
    setText(this.headPosition, 'UNAVAILABLE', 'unavailable');
    setText(this.centeredSummary, 'UNAVAILABLE', 'unavailable');
    setText(this.movement, 'UNAVAILABLE', 'unavailable');
    if (this.alignmentNeedle) this.alignmentNeedle.style.transform = 'rotate(0deg)';
    drawTrend(this.trend, []);
  }

  draw(frame) {
    const fit = this.context();
    if (!fit) return;
    const pose = pointsFrom(frame.poseLandmarks || frame.landmarks || frame.pose);
    const leftHand = pointsFrom(frame.leftHandLandmarks || frame.leftHand);
    const rightHand = pointsFrom(frame.rightHandLandmarks || frame.rightHand);
    if (!pose.length && !leftHand.length && !rightHand.length && frame.present !== true) {
      this.unavailable(frame.reason || 'BODY_NOT_DETECTED');
      return;
    }

    // Preserve the anatomical scanner plate and paint only observed live geometry.
    fit.context.clearRect(0, 0, fit.width, fit.height);
    if (pose.length) {
      fit.context.save();
      fit.context.globalAlpha = .72;
      drawConnections(fit.context, pose, POSE_CONNECTIONS, fit.width, fit.height, stateColor(frame.postureState || frame.state || 'live'));
      drawLandmarks(fit.context, pose, fit.width, fit.height, COLORS.cyan, 1.8);
      fit.context.restore();
    }
    if (leftHand.length) {
      drawConnections(fit.context, leftHand, HAND_CONNECTIONS, fit.width, fit.height, stateColor(frame.leftHandState || 'live'));
      drawLandmarks(fit.context, leftHand, fit.width, fit.height, COLORS.gold, 1.1);
    }
    if (rightHand.length) {
      drawConnections(fit.context, rightHand, HAND_CONNECTIONS, fit.width, fit.height, stateColor(frame.rightHandState || 'live'));
      drawLandmarks(fit.context, rightHand, fit.width, fit.height, COLORS.orange, 1.1);
    }
    const centered = frame.centeredLabel || (typeof frame.centered === 'boolean' ? (frame.centered ? 'CENTERED' : 'OFF CENTER') : 'UNAVAILABLE');
    const shoulders = frame.shoulderLabel || (finite(frame.shoulderTiltDeg) ? `${formatNumber(frame.shoulderTiltDeg, 1)}° TILT` : 'UNAVAILABLE');
    const hands = frame.handsLabel || ((leftHand.length || rightHand.length) ? `${leftHand.length ? 'L' : '—'} / ${rightHand.length ? 'R' : '—'} VISIBLE` : 'UNAVAILABLE');
    const gesture = frame.gestureLabel || (typeof frame.gestureActive === 'boolean' ? (frame.gestureActive ? 'MOTION ACTIVE' : 'NO MOTION EVENT') : 'UNAVAILABLE');
    setText(this.readouts.centered, centered, frame.centeredState || frame.state || 'neutral');
    setText(this.readouts.shoulders, shoulders, frame.shoulderState || 'neutral');
    setText(this.readouts.hands, hands, frame.handsState || 'neutral');
    setText(this.readouts.gesture, gesture, frame.gestureState || 'neutral');
    setText(this.spine, centered, frame.centeredState || frame.state || 'neutral');
    setText(this.headPosition, centered, frame.centeredState || frame.state || 'neutral');
    setText(this.centeredSummary, centered, frame.centeredState || frame.state || 'neutral');
    setText(this.status, frame.transientOverlay ? 'TRANSIENT WORKER OVERLAY' : (pose.length || leftHand.length || rightHand.length ? 'LIVE LANDMARKS' : 'COMPACT GEOMETRY PROXY'), frame.state || 'ok');
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
    const dbfs = frame.dbfs ?? frame.rmsDb;
    if (!finite(dbfs)) {
      this.unavailable(frame.reason || 'MIC_LEVEL_REQUIRED');
      return;
    }
    const fit = this.context();
    if (!fit) return;
    clearScreen(fit.context, fit.width, fit.height, { grid: false });
    const normalized = finite(frame.normalized) ? clamp(frame.normalized) : clamp((Number(dbfs) + 60) / 60);
    const segments = 16;
    const gap = 3;
    const segmentWidth = Math.max(2, (fit.width - gap * (segments - 1)) / segments);
    const lit = Math.round(normalized * segments);
    const corridor = Array.isArray(frame.corridor) && frame.corridor.length === 2 && frame.corridor.every(finite)
      ? [clamp(frame.corridor[0]), clamp(frame.corridor[1])]
      : [.47, .73];
    for (let index = 0; index < segments; index += 1) {
      const x = index * (segmentWidth + gap);
      const position = (index + .5) / segments;
      const active = index < lit;
      const color = position < corridor[0]
        ? '#1475e8'
        : position <= corridor[1]
          ? COLORS.ok
          : COLORS.bad;
      fit.context.fillStyle = active ? color : 'rgba(33,42,57,.82)';
      fit.context.fillRect(x, 12, segmentWidth, fit.height - 24);
      fit.context.strokeStyle = active ? 'rgba(198,227,255,.86)' : 'rgba(86,100,125,.50)';
      fit.context.lineWidth = 1;
      fit.context.strokeRect(x + .5, 12.5, Math.max(1, segmentWidth - 1), Math.max(1, fit.height - 25));
    }
    fit.context.strokeStyle = COLORS.ink;
    fit.context.lineWidth = 2;
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
    const zone = stateName(frame.zone || frame.state || 'neutral');
    const cue = zone === 'target' || zone === 'ok'
      ? 'TARGET — HOLD'
      : zone === 'quiet' || zone === 'warn'
        ? 'QUIET — LIFT'
        : zone === 'loud' || zone === 'bad'
          ? 'LOUD — EASE'
          : 'LIVE LEVEL';
    setText(this.value, `${formatNumber(dbfs, 1)}`, zone);
    setText(this.cue, cue, zone);
    setText(this.status, frame.label || String(frame.zone || 'LIVE LEVEL').replaceAll('_', ' '), zone);
  }
}

export class SpeedHudRenderer extends HudRenderer {
  constructor(root) { super(root, 'speed'); }

  draw(frame) {
    if (!finite(frame.wpm)) {
      this.unavailable(frame.reason || 'VALIDATED_WORD_TIMING_REQUIRED');
      return;
    }
    const fit = this.context();
    if (!fit) return;
    clearScreen(fit.context, fit.width, fit.height, { grid: false });
    const cx = fit.width / 2;
    const cy = fit.height * .91;
    const radius = Math.min(fit.width * .43, fit.height * .78);
    const segments = 28;
    const corridor = Array.isArray(frame.corridor) && frame.corridor.length === 2 && frame.corridor.every(finite)
      ? [clamp(frame.corridor[0]), clamp(frame.corridor[1])]
      : [110 / 240, 160 / 240];
    const normalized = finite(frame.normalized) ? clamp(frame.normalized) : clamp(Number(frame.wpm) / 240);
    for (let index = 0; index < segments; index += 1) {
      const position = index / (segments - 1);
      const angle = Math.PI + position * Math.PI;
      const innerRadius = radius - Math.max(10, radius * .14);
      const inTarget = position >= corridor[0] && position <= corridor[1];
      const extreme = index === 0 || index === segments - 1;
      const traversed = position <= normalized;
      fit.context.strokeStyle = extreme ? COLORS.bad : inTarget ? COLORS.ok : traversed ? '#2388ff' : 'rgba(97,111,135,.62)';
      fit.context.lineWidth = Math.max(3, radius * .052);
      fit.context.lineCap = 'butt';
      fit.context.beginPath();
      fit.context.moveTo(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius);
      fit.context.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      fit.context.stroke();
    }
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
    setText(this.value, `${Math.round(Number(frame.wpm))}`, frame.zone || frame.state || 'neutral');
    setText(this.status, frame.label || String(frame.zone || 'VALIDATED WORD TIMING').replaceAll('_', ' '), frame.zone || frame.state || 'neutral');
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
      const history = (Array.isArray(histories[trace]) ? histories[trace] : [])
        .filter((sample) => finite(sample?.atMs) && sample.atMs >= startAtMs)
        .sort((a, b) => a.atMs - b.atMs);
      let segmentOpen = false;
      let pointCount = 0;
      fit.context.beginPath();
      for (const sample of history) {
        const normalized = normalizeVocalVariationValue(trace, sample.value);
        if (!finite(normalized)) { segmentOpen = false; continue; }
        const x = ((sample.atMs - startAtMs) / durationMs) * fit.width;
        const y = fit.height - (normalized * fit.height * .76 + fit.height * .12);
        if (!segmentOpen) fit.context.moveTo(x, y);
        else fit.context.lineTo(x, y);
        segmentOpen = true;
        pointCount += 1;
      }
      if (pointCount >= 2) {
        fit.context.strokeStyle = colors[trace];
        fit.context.lineWidth = trace === 'volume' ? 2 : 1.7;
        fit.context.shadowColor = colors[trace];
        fit.context.shadowBlur = 4;
        fit.context.stroke();
        fit.context.shadowBlur = 0;
        drawnTraces += 1;
      }
    }

    if (visible.size === 0) {
      setText(this.status, 'ALL TRACES HIDDEN · MEASUREMENT CONTINUES', 'neutral');
    } else if (drawnTraces === 0) {
      setText(this.status, 'WAITING FOR GENUINE MEASURED HISTORY', 'unavailable');
    } else {
      setText(this.status, frame.label || 'NORMALIZED LIVE HISTORY', frame.state || 'live');
    }
  }
}

export const ModulationHudRenderer = VocalVariationHudRenderer;

export class PitchHudRenderer extends HudRenderer {
  constructor(root) { super(root, 'pitch'); }

  draw(frame) {
    if (frame.voiced === false && frame.available !== false) {
      const fit = this.context();
      if (fit) {
        clearScreen(fit.context, fit.width, fit.height, { grid: false });
        fit.context.fillStyle = COLORS.dim;
        fit.context.font = '700 9px "Space Grotesk", ui-monospace, monospace';
        fit.context.textAlign = 'center';
        fit.context.textBaseline = 'middle';
        fit.context.fillText('UNVOICED FRAME', fit.width / 2, fit.height / 2);
      }
      setText(this.value, '—', 'idle');
      setText(this.status, 'UNVOICED — WAITING FOR VALID F0', 'idle');
      return;
    }
    if (!finite(frame.semitones)) {
      this.unavailable(frame.reason || 'VOICED_F0_REQUIRED');
      return;
    }
    const fit = this.context();
    if (!fit) return;
    clearScreen(fit.context, fit.width, fit.height, { grid: false });
    const rows = [2, 1, 0, -1, -2];
    const register = finite(frame.register) ? clamp(Math.round(Number(frame.register)), -2, 2) : clamp(Math.round(Number(frame.semitones) / 2), -2, 2);
    const rowHeight = fit.height / rows.length;
    rows.forEach((row, index) => {
      const active = row === register;
      const median = row === 0;
      const y = index * rowHeight;
      fit.context.fillStyle = median ? 'rgba(57,214,255,.82)' : 'rgba(27,42,82,.68)';
      fit.context.fillRect(4, y + 2, fit.width - 8, Math.max(2, rowHeight - 4));
      if (active) {
        fit.context.strokeStyle = COLORS.gold;
        fit.context.lineWidth = 2;
        fit.context.strokeRect(3, y + 1, fit.width - 6, Math.max(3, rowHeight - 2));
        fit.context.fillStyle = COLORS.gold;
        fit.context.beginPath();
        fit.context.moveTo(fit.width - 16, y + rowHeight / 2);
        fit.context.lineTo(fit.width - 7, y + rowHeight / 2 - 4);
        fit.context.lineTo(fit.width - 7, y + rowHeight / 2 + 4);
        fit.context.closePath();
        fit.context.fill();
      }
      fit.context.fillStyle = median ? '#03151b' : COLORS.dim;
      fit.context.font = '700 9px ui-monospace, monospace';
      fit.context.textAlign = 'left';
      fit.context.textBaseline = 'middle';
      fit.context.fillText(row === 0 ? 'MEDIAN' : `${row > 0 ? '+' : ''}${row}`, 8, y + rowHeight / 2);
    });
    const semitones = Number(frame.semitones);
    setText(this.value, `${semitones >= 0 ? '+' : ''}${semitones.toFixed(1)} st`, frame.state || 'neutral');
    setText(this.status, frame.label || 'SPEAKER-RELATIVE REGISTER', frame.state || 'neutral');
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
