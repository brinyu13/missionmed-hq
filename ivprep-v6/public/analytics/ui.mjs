import { BrowserAnalyticsPipeline } from './browser-pipeline.mjs';
import { LocalOverlaySettings } from './overlay-policy.mjs';
import { OverlayUiController, overlayRenderStatusCopy } from './overlay-ui.mjs';
import { describeStudentEvent, formatDuration, persistentAnalyticsEnvelopes, studentResultProjection } from './results-projection.mjs';

const GUIDED_STEPS = Object.freeze([
  Object.freeze(['Baseline · 10 seconds', 'Sit as you normally would. Face the camera and hold still; keep your head and shoulders in frame.', 10]),
  Object.freeze(['Natural speech · 25 seconds', 'Read or paraphrase: “I value careful listening, teamwork, and service.” Gesture as you normally would.', 25]),
  Object.freeze(['Pause exercise · 15 seconds', 'Say one sentence, pause for 3–5 seconds, then continue. The system measures silence; it does not infer purpose.', 15]),
  Object.freeze(['Gesture range · 20 seconds', 'Make one left-hand gesture, one right-hand gesture, then one two-hand gesture. Return both hands to rest.', 20]),
  Object.freeze(['Posture + head · 20 seconds', 'Lean gently and return upright. Turn your head left, right, then face the camera.', 20]),
  Object.freeze(['Facial movement · 10 seconds', 'Keep your head still. Smile once, relax, then raise your brows once. This checks movement only, never emotion.', 10]),
  Object.freeze(['Delivery contrast + volume · 25 seconds', 'Read the same sentence slowly, then quickly; once quietly, then normally. This exercises captured delivery signals; WPM stays unavailable without an existing transcript.', 25]),
]);

const GUIDED_DURATION_MS = GUIDED_STEPS.reduce((sum, step) => sum + step[2] * 1_000, 0);
const enduranceSteps = (minutes) => Object.freeze([
  Object.freeze([
    `${minutes}-minute real-WASM endurance hold`,
    'Keep this tab visible and the camera active. Continue natural speaking and movement while all Founder cockpit instruments remain enabled. Finish early at any time; an early or interrupted run is labeled as such.',
    minutes * 60,
  ]),
]);

export const FOUNDER_RUN_MODES = Object.freeze({
  guided: Object.freeze({ id: 'guided', label: 'Guided functional sequence — 2:05', startLabel: 'Start guided test', targetDurationMs: GUIDED_DURATION_MS, endurance: false, requiresCamera: false, steps: GUIDED_STEPS }),
  'endurance-10': Object.freeze({ id: 'endurance-10', label: 'Real-WASM endurance hold — 10:00', startLabel: 'Start 10-minute endurance', targetDurationMs: 10 * 60_000, endurance: true, requiresCamera: true, steps: enduranceSteps(10) }),
  'endurance-15': Object.freeze({ id: 'endurance-15', label: 'Real-WASM endurance hold — 15:00', startLabel: 'Start 15-minute endurance', targetDurationMs: 15 * 60_000, endurance: true, requiresCamera: true, steps: enduranceSteps(15) }),
});

export const FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS = 10_000;
export const FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS = 1_000;

const FOUNDER_INSTRUMENTATION_CONTROLS = Object.freeze([
  Object.freeze(['communication-analytics-show-overlay', ' Tracking overlay', 'communication-analytics-overlay']),
  Object.freeze(['communication-analytics-show-gauges', ' Head + posture gauges', 'communication-analytics-gauges']),
  Object.freeze(['communication-analytics-show-audio', ' Audio instruments', 'communication-analytics-audio']),
  Object.freeze(['communication-analytics-show-timeline', ' Synchronized timeline', 'communication-analytics-timeline']),
]);

const FOUNDER_OVERLAY_LAYER_CONTROLS = Object.freeze([
  Object.freeze(['communication-analytics-show-face-overlay', ' Face overlay', 'founderLiveFace']),
  Object.freeze(['communication-analytics-show-body-overlay', ' Body + hands overlay', 'founderLiveBody']),
]);

export function founderRunPlan(modeId = 'guided') {
  return FOUNDER_RUN_MODES[modeId] || FOUNDER_RUN_MODES.guided;
}

export function founderRunProgress(modeId, elapsedMs) {
  const plan = founderRunPlan(modeId);
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Object.freeze({
    modeId: plan.id,
    elapsedMs: elapsed,
    remainingMs: Math.max(0, plan.targetDurationMs - elapsed),
    targetDurationMs: plan.targetDurationMs,
    targetReached: elapsed >= plan.targetDurationMs,
  });
}

export function founderRunClock(milliseconds, { rounding = 'floor' } = {}) {
  const value = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  const round = rounding === 'ceil' ? Math.ceil : Math.floor;
  const seconds = round(value / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function founderRunReceipt({
  modeId = 'guided', elapsedMs = 0, interrupted = false, interruptionCount = 0,
  visualFrameCount = 0, firstVisualAtMs = null, lastVisualAtMs = null,
} = {}) {
  const plan = founderRunPlan(modeId);
  const progress = founderRunProgress(plan.id, elapsedMs);
  const frames = Number.isFinite(visualFrameCount) ? Math.max(0, Math.round(visualFrameCount)) : 0;
  const interruptions = Number.isFinite(interruptionCount) ? Math.max(0, Math.round(interruptionCount)) : 0;
  const firstVisual = Number.isFinite(firstVisualAtMs) && firstVisualAtMs >= 0 ? Math.round(firstVisualAtMs) : null;
  const lastVisual = Number.isFinite(lastVisualAtMs) && lastVisualAtMs >= 0 ? Math.round(lastVisualAtMs) : null;
  const realWasmObserved = frames > 0;
  const uninterrupted = !interrupted && interruptions === 0;
  const minimumVisualFrameCount = plan.endurance
    ? Math.max(1, Math.floor((plan.targetDurationMs - FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS) / FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS))
    : 0;
  const visualFrameMinimumRatio = plan.endurance && minimumVisualFrameCount
    ? Number(Math.min(1, frames / minimumVisualFrameCount).toFixed(4))
    : null;
  const visualStartedWithinBound = !plan.endurance || (firstVisual !== null && firstVisual <= FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS);
  const visualFreshThroughTarget = !plan.endurance || (lastVisual !== null && lastVisual >= plan.targetDurationMs - FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS);
  const visualFrameMinimumMet = !plan.endurance || frames >= minimumVisualFrameCount;
  const meaningfulVisualCoverage = realWasmObserved && visualStartedWithinBound && visualFreshThroughTarget && visualFrameMinimumMet;
  const targetCompleted = plan.endurance
    ? progress.targetReached && uninterrupted && meaningfulVisualCoverage
    : progress.targetReached;
  const incompleteReasons = [];
  if (plan.endurance && !progress.targetReached) incompleteReasons.push(`target duration not reached (${founderRunClock(progress.elapsedMs)} of ${founderRunClock(progress.targetDurationMs)})`);
  if (plan.endurance && !uninterrupted) incompleteReasons.push(interruptions > 0
    ? `${interruptions} instrumentation interruption${interruptions === 1 ? '' : 's'} recorded`
    : 'instrumentation interruption recorded');
  if (plan.endurance && !realWasmObserved) incompleteReasons.push('no analyzable visual WASM frames observed');
  if (plan.endurance && realWasmObserved && !visualStartedWithinBound) incompleteReasons.push(`first analyzable visual frame missed the ${founderRunClock(FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS)} startup bound`);
  if (plan.endurance && realWasmObserved && !visualFreshThroughTarget) incompleteReasons.push(`last analyzable visual frame was not within ${founderRunClock(FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS, { rounding: 'ceil' })} of the target boundary`);
  if (plan.endurance && realWasmObserved && !visualFrameMinimumMet) incompleteReasons.push(`${frames} analyzable visual frames observed; minimum ${minimumVisualFrameCount} required at one frame per ${FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS / 1_000}s freshness interval after the ${FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS / 1_000}s startup allowance`);
  let summary;
  if (!plan.endurance) {
    summary = progress.targetReached
      ? `GUIDED FUNCTIONAL SEQUENCE COMPLETE · ${founderRunClock(progress.elapsedMs)} SESSION-CLOCK ELAPSED`
      : `GUIDED FUNCTIONAL SEQUENCE ENDED EARLY · ${founderRunClock(progress.elapsedMs)} OF ${founderRunClock(progress.targetDurationMs)}`;
  } else if (targetCompleted) {
    summary = `${founderRunClock(progress.targetDurationMs)} REAL-WASM ENDURANCE TARGET COMPLETE · ${frames} VISUAL FRAMES OBSERVED · NO RECORDED INSTRUMENTATION INTERRUPTION`;
  } else if (!progress.targetReached) {
    summary = `ENDURANCE ENDED EARLY · ${founderRunClock(progress.elapsedMs)} OF ${founderRunClock(progress.targetDurationMs)} · TARGET NOT COMPLETE · ${incompleteReasons.join(' · ').toUpperCase()}`;
  } else {
    summary = `${founderRunClock(progress.targetDurationMs)} CLOCK TARGET REACHED · NOT AN UNINTERRUPTED REAL-WASM PASS · ${incompleteReasons.join(' · ').toUpperCase()}`;
  }
  return Object.freeze({
    ...progress, endurance: plan.endurance, visualFrameCount: frames,
    firstVisualAtMs: firstVisual, lastVisualAtMs: lastVisual,
    minimumVisualFrameCount, visualFrameMinimumRatio, visualStartedWithinBound,
    visualFreshThroughTarget, visualFrameMinimumMet, meaningfulVisualCoverage,
    interruptionCount: interruptions, uninterrupted, realWasmObserved, targetCompleted,
    incompleteReasons: Object.freeze(incompleteReasons), summary,
  });
}

const MAX_AUDIO_HISTORY = 180;
const MAX_TIMELINE_TRANSITIONS = 4_800;
export const FOUNDER_TIMELINE_LEVEL_CAPACITY = 640;
const LIVE_TIMELINE_WINDOW_MS = 30_000;
const OVERLAY_STALE_MS = FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS;
const TIMING_BUCKET_WIDTH_MS = 0.25;
const TIMING_BUCKET_MAX_MS = 2_000;
const TIMING_BUCKET_COUNT = Math.floor(TIMING_BUCKET_MAX_MS / TIMING_BUCKET_WIDTH_MS) + 2;

export const FOUNDER_DIAGNOSTIC_CONTRACT = Object.freeze({
  clock: 'Every diagnostic detail must include finite, non-negative atMs on the analytics session clock before it can enter the synchronized live timeline.',
  audio: Object.freeze(['modality', 'atMs', 'available', 'rmsDb|rms', 'peak', 'clippingFraction|clippedFraction', 'speaking', 'pauseInProgressMs', 'frameCount']),
  vision: Object.freeze(['modality', 'atMs', 'geometry', 'geometry.faceCount', 'live', 'overlayRendered', 'overlayPrimitiveCount', 'inferenceMs', 'targetFps', 'droppedFrames']),
  overlay: 'The Holistic worker renders actual current-frame MediaPipe geometry to a transient transparent ImageBitmap. Raw coordinates never cross the worker boundary. The bitmap is delivered only to the Founder overlay consumer, drawn synchronously, then closed. Missing, stale, multi-face, or unprotected input clears the overlay.',
});

export function founderDiagnosticAtMs(detail) {
  return Number.isFinite(detail?.atMs) && detail.atMs >= 0 ? Math.round(detail.atMs) : null;
}

export function boundedFounderHistory(history, value, maximum) {
  if (!Array.isArray(history) || !Number.isInteger(maximum) || maximum < 1) throw new TypeError('A bounded Founder history requires an array and positive integer maximum.');
  history.push(value);
  if (history.length > maximum) history.splice(0, history.length - maximum);
  return history;
}

export function appendFounderTimelineTransition(history, anchors, value, maximum = MAX_TIMELINE_TRANSITIONS) {
  if (!Array.isArray(history) || !(anchors instanceof Map) || !Number.isInteger(maximum) || maximum < 1) throw new TypeError('A bounded Founder timeline requires an array, anchor map, and positive integer maximum.');
  history.push(value);
  while (history.length > maximum) {
    const evicted = history.shift();
    if (evicted?.key) anchors.set(evicted.key, evicted);
  }
  return history;
}

export function founderPauseTimelineTransition(detail) {
  const atMs = founderDiagnosticAtMs(detail);
  if (atMs === null || !Number.isFinite(detail?.pauseInProgressMs)) return null;
  const durationMs = Math.max(0, detail.pauseInProgressMs);
  const active = durationMs >= 1_000;
  return Object.freeze({ active, atMs: active ? Math.max(0, Math.round(atMs - durationMs)) : atMs });
}

export function founderAudioDiagnosticAvailable(detail) {
  return detail?.available !== false && founderDiagnosticAtMs(detail) !== null;
}

export function founderVisionDiagnosticFreshness(detail, maximumAgeMs = OVERLAY_STALE_MS) {
  const atMs = founderDiagnosticAtMs(detail);
  const inferenceMs = Number.isFinite(detail?.inferenceMs) && detail.inferenceMs >= 0 ? detail.inferenceMs : null;
  if (atMs === null || inferenceMs === null || !Number.isFinite(maximumAgeMs) || maximumAgeMs <= 0) {
    return Object.freeze({ fresh: false, atMs, inferenceMs, staleAtMs: atMs, remainingMs: 0 });
  }
  return Object.freeze({
    fresh: inferenceMs < maximumAgeMs,
    atMs,
    inferenceMs,
    staleAtMs: inferenceMs < maximumAgeMs ? null : atMs + maximumAgeMs,
    remainingMs: Math.max(0, maximumAgeMs - inferenceMs),
  });
}

export function founderScalePresentation(value, minimum, maximum, unit = '', decimals = 1, { allowOutOfRange = true } = {}) {
  if (![value, minimum, maximum].every(Number.isFinite) || minimum >= maximum) return Object.freeze({ available: false, bounded: null, text: 'UNAVAILABLE' });
  if (!allowOutOfRange && (value < minimum || value > maximum)) return Object.freeze({ available: false, bounded: null, text: 'UNAVAILABLE' });
  const bounded = Math.max(minimum, Math.min(maximum, value));
  const actual = value.toFixed(decimals);
  const lower = minimum.toFixed(decimals);
  const upper = maximum.toFixed(decimals);
  const suffix = value < minimum
    ? ` — BELOW ${lower}${unit} DISPLAY RANGE`
    : value > maximum ? ` — ABOVE ${upper}${unit} DISPLAY RANGE` : '';
  return Object.freeze({ available: true, bounded, text: `${actual}${unit}${suffix}` });
}

export function createFounderTimingAccumulator() {
  return { count: 0, maxMs: null, buckets: new Uint32Array(TIMING_BUCKET_COUNT) };
}

export function recordFounderTiming(accumulator, value) {
  if (!accumulator || !(accumulator.buckets instanceof Uint32Array) || accumulator.buckets.length !== TIMING_BUCKET_COUNT) throw new TypeError('Founder timing accumulator is invalid.');
  if (!Number.isFinite(value) || value < 0) return accumulator;
  const index = Math.min(TIMING_BUCKET_COUNT - 1, Math.floor(value / TIMING_BUCKET_WIDTH_MS));
  accumulator.buckets[index] += 1;
  accumulator.count += 1;
  accumulator.maxMs = accumulator.maxMs === null ? value : Math.max(accumulator.maxMs, value);
  return accumulator;
}

function percentile95(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? Number(sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)].toFixed(2)) : null;
}

export function founderInstrumentationPerformance(costs = {}) {
  const summary = {};
  for (const key of ['overlay', 'audio', 'timeline', 'frame']) {
    const cost = costs[key];
    if (cost?.buckets instanceof Uint32Array && Number.isInteger(cost.count)) {
      const target = Math.ceil(cost.count * 0.95);
      let cumulative = 0;
      let bucketIndex = -1;
      for (let index = 0; index < cost.buckets.length; index += 1) {
        cumulative += cost.buckets[index];
        if (cumulative >= target) { bucketIndex = index;break; }
      }
      const p95Ms = cost.count === 0 ? null : bucketIndex === cost.buckets.length - 1
        ? `>=${TIMING_BUCKET_MAX_MS}`
        : Number((bucketIndex * TIMING_BUCKET_WIDTH_MS).toFixed(2));
      summary[key] = Object.freeze({ samples: cost.count, p95Ms, maxMs: cost.maxMs === null ? null : Number(cost.maxMs.toFixed(2)) });
    } else {
      const values = Array.isArray(cost) ? cost.filter(Number.isFinite) : [];
      summary[key] = Object.freeze({
        samples: values.length,
        p95Ms: percentile95(values),
        maxMs: values.length ? Number(Math.max(...values).toFixed(2)) : null,
      });
    }
  }
  return Object.freeze(summary);
}

export function founderFaceProtectionStatus(detail = {}, diagnostics = {}) {
  const rawFaceCount = detail?.geometry?.faceCount;
  const faceCount = Number.isFinite(rawFaceCount) && rawFaceCount >= 0 ? Math.round(rawFaceCount) : null;
  const explicitStatus = ['idle', 'initializing', 'ready', 'unavailable'].includes(diagnostics?.faceDetectorStatus)
    ? diagnostics.faceDetectorStatus
    : null;
  const inferredCapabilityReady = diagnostics?.multiFaceProtection === true && diagnostics?.faceWorkerReady !== false;
  const detectorStatus = explicitStatus || (inferredCapabilityReady
    ? 'ready'
    : diagnostics?.multiFaceProtection === false ? 'unavailable' : 'initializing');
  const capabilityReady = detectorStatus === 'ready'
    && diagnostics?.multiFaceProtection === true
    && diagnostics?.faceWorkerReady !== false;
  const guardReady = capabilityReady && faceCount === 1;
  let label;
  if (detectorStatus === 'unavailable') {
    label = 'FACE DETECTOR UNAVAILABLE · FACE COUNT UNKNOWN · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED';
  } else if (detectorStatus === 'idle') {
    label = 'FACE DETECTOR IDLE · FACE COUNT UNKNOWN · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED';
  } else if (!capabilityReady) {
    label = 'FACE DETECTOR INITIALIZING · FACE COUNT UNKNOWN · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED PENDING GUARD';
  } else if (faceCount === null) {
    label = 'FACE DETECTOR READY · FACE COUNT UNKNOWN · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED';
  } else if (faceCount === 0) {
    label = 'FACE DETECTOR READY · FACE COUNT 0 · NO PERSON DETECTED · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED';
  } else if (faceCount === 1) {
    label = 'FACE COUNT 1 · EXACTLY-ONE-PERSON GUARD READY';
  } else {
    label = `FACE DETECTOR READY · FACE COUNT 2+ (${faceCount} DETECTED) · MULTIPLE PEOPLE DETECTED · PERSON-SPECIFIC ANALYTICS + OVERLAY SUPPRESSED`;
  }
  return Object.freeze({ detectorStatus, faceCount, capabilityReady, guardReady, suppressed: !guardReady, label });
}

export function founderOverlayGeometry(detail, { multiFaceProtection = false } = {}) {
  const geometry = detail?.modality === 'vision' ? detail.geometry : null;
  if (!multiFaceProtection || !geometry || geometry.faceCount !== 1) return null;
  return geometry;
}

export function founderOverlayDrawRect(bitmapWidth, bitmapHeight, surfaceWidth, surfaceHeight) {
  if (![bitmapWidth, bitmapHeight, surfaceWidth, surfaceHeight].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(surfaceWidth / bitmapWidth, surfaceHeight / bitmapHeight);
  const width = bitmapWidth * scale;
  const height = bitmapHeight * scale;
  return Object.freeze({ width, height, left: (surfaceWidth - width) / 2, top: (surfaceHeight - height) / 2 });
}

function audioLevelDb(detail) {
  if (Number.isFinite(detail?.rmsDb)) return detail.rmsDb <= 0 ? Math.max(-160, detail.rmsDb) : null;
  if (!Number.isFinite(detail?.rms) || detail.rms < 0) return null;
  return Math.max(-160, Math.min(0, 20 * Math.log10(Math.max(detail.rms, 1e-8))));
}

function founderQuantile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export function founderEnergyVariationDb(samples) {
  const bounded = (Array.isArray(samples) ? samples : []).slice(-MAX_AUDIO_HISTORY);
  const values = bounded.map((sample) => Number.isFinite(sample) ? sample : sample?.db).filter(Number.isFinite);
  if (values.length < 4) return null;
  const lower = founderQuantile(values, 0.25);
  const upper = founderQuantile(values, 0.75);
  return lower === null || upper === null ? null : Number(Math.max(0, upper - lower).toFixed(2));
}

function clippingFraction(detail) {
  const value = Number.isFinite(detail?.clippingFraction) ? detail.clippingFraction : detail?.clippedFraction;
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function founderVisualStates(geometry, live = null) {
  if (!geometry) return Object.freeze({ cameraFacing: null, framingCentered: null, gesture: null, headMovement: false, postureMovement: false, facialMovement: false });
  const face = geometry.face || {};
  const box = face.box;
  const cameraFacing = face.present
    ? Math.abs(face.yawProxyDeg || 0) <= 20 && Math.abs(face.pitchProxyDeg || 0) <= 15 && Math.abs(face.rollProxyDeg || 0) <= 15
    : null;
  const framingCentered = face.present && box
    ? box.centerX >= 0.3 && box.centerX <= 0.7 && box.centerY >= 0.2 && box.centerY <= 0.65 && box.width >= 0.12
    : null;
  return Object.freeze({
    cameraFacing,
    framingCentered,
    gesture: ['left', 'right', 'both'].includes(live?.gestureActive) ? live.gestureActive : null,
    headMovement: Boolean(live?.headTurnActive),
    postureMovement: Boolean(live?.postureMovementActive),
    facialMovement: Boolean(live?.facialMovementActive),
  });
}

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function toggleControl(id, text, checked = true) {
  const label = element('label', 'ca-toggle');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;
  label.append(input, document.createTextNode(text));
  return { label, input };
}

function gauge(id, label, minimum, maximum, unit = '°') {
  const row = element('div', 'ca-gauge');
  const head = element('div', 'ca-gauge-head');
  head.append(element('span', '', label), element('output', 'ca-gauge-value', 'UNAVAILABLE'));
  const meter = element('div', 'ca-gauge-track ca-unavailable');
  meter.id = id;
  meter.dataset.minimum = String(minimum);
  meter.dataset.maximum = String(maximum);
  meter.dataset.unit = unit;
  meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-label', label);
  meter.setAttribute('aria-valuemin', String(minimum));
  meter.setAttribute('aria-valuemax', String(maximum));
  meter.setAttribute('aria-valuetext', 'Unavailable');
  meter.append(element('span', 'ca-gauge-center'), element('i', 'ca-gauge-marker'));
  row.append(head, meter);
  return row;
}

function instrumentMeter(id, label, minimum, maximum, unit) {
  const row = element('div', 'ca-meter-row');
  const head = element('div', 'ca-gauge-head');
  const output = element('output', 'ca-gauge-value', 'UNAVAILABLE');
  output.htmlFor = id;
  head.append(element('span', '', label), output);
  const meter = document.createElement('meter');
  meter.id = id;
  meter.min = minimum;
  meter.max = maximum;
  meter.dataset.unit = unit;
  meter.className = 'ca-meter ca-unavailable';
  meter.setAttribute('aria-label', label);
  meter.setAttribute('aria-valuetext', 'Unavailable');
  row.append(head, meter);
  return row;
}

function setUnsafeLegacyVisibility(hidden) {
  const direct = ['#v-pitch', '#v-move', '#v-crop', '#v-height'];
  for (const selector of direct) document.querySelector(selector)?.closest('.lensrow')?.classList.toggle('ca-hidden', hidden);
  document.querySelector('#checkchips')?.classList.toggle('ca-hidden', hidden);
  document.querySelector('#highlights')?.closest('.panel')?.classList.toggle('ca-hidden', hidden);
  document.querySelector('#stratRead')?.closest('.panel')?.classList.toggle('ca-hidden', hidden);
  document.querySelector('#v-dur')?.closest('.panel')?.classList.toggle('ca-hidden', hidden);
  const replayPanel = document.querySelector('#playback')?.closest('.panel');
  replayPanel?.querySelectorAll('.canvasbox,.teachline').forEach((node) => node.classList.toggle('ca-hidden', hidden));
  document.querySelector('#noplayback')?.classList.toggle('ca-hidden', hidden);
}

const FOUNDER_VISUAL_METRICS = Object.freeze(new Set([
  'hand_presence', 'hand_motion_episode', 'gesture_zone',
  'torso_presence', 'lateral_torso_lean', 'body_sway_episode',
  'face_presence', 'head_orientation_proxy', 'camera_facing_proxy',
  'sustained_head_turn_episode', 'facial_movement_episode', 'framing_center',
]));

function founderReportEvents(result) {
  return Array.isArray(result?.events) ? result.events.filter((event) => event && typeof event.metric === 'string') : [];
}

function founderReportPercent(value, decimals = 1) {
  return Number.isFinite(value) && value >= 0 && value <= 1 ? `${(value * 100).toFixed(decimals)}%` : 'UNAVAILABLE';
}

function founderReportDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'UNAVAILABLE';
  if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 2 : 1)} s`;
}

function founderReportNumber(value, decimals = 2) {
  return Number.isFinite(value) ? Number(value).toFixed(decimals) : 'UNAVAILABLE';
}

function founderReportValuePresent(event) {
  return event?.observation && event.observation.value !== null && event.observation.value !== undefined;
}

function founderReportEventMeta(event) {
  if (!event) return 'No timestamped observation recorded.';
  const reliability = event.quality?.reliability || 'unavailable';
  const coverage = founderReportPercent(event.quality?.coverage);
  const samples = Number.isFinite(event.quality?.sampleCount) ? Math.max(0, Math.round(event.quality.sampleCount)) : null;
  return `Reliability ${reliability} · analysis-path coverage ${coverage}${samples === null ? '' : ` · quality sample count ${samples}`}.`;
}

function founderReportHumanize(value) {
  return String(value ?? '').replaceAll('_', ' ').trim();
}

function founderReportUniqueLimitations(events, additions = []) {
  const values = [];
  for (const event of events) {
    for (const limitation of event?.quality?.limitations || []) values.push(founderReportHumanize(limitation));
  }
  for (const addition of additions) if (addition) values.push(String(addition));
  return [...new Set(values)].slice(0, 12);
}

function founderReportUnionDuration(events, result) {
  const runStart = Number.isFinite(result?.startedAtMs) ? result.startedAtMs : 0;
  const runEnd = Number.isFinite(result?.endedAtMs)
    ? result.endedAtMs
    : runStart + (Number.isFinite(result?.durationMs) ? Math.max(0, result.durationMs) : 0);
  const intervals = events.map((event) => ({
    start: Math.max(runStart, Number(event?.startMs)),
    end: Math.min(runEnd, Number(event?.endMs)),
  })).filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let total = 0;
  let active = null;
  for (const interval of intervals) {
    if (!active || interval.start > active.end) {
      if (active) total += active.end - active.start;
      active = { ...interval };
    } else active.end = Math.max(active.end, interval.end);
  }
  if (active) total += active.end - active.start;
  return Math.round(total);
}

function founderReportMetric(events, metric) {
  return events.find((event) => event.metric === metric) || null;
}

function founderReportMetrics(events, metrics) {
  const names = new Set(metrics);
  return events.filter((event) => names.has(event.metric));
}

function founderReportItem(label, event, formatter, unavailable = 'NO OBSERVATION RECORDED') {
  if (!event || !founderReportValuePresent(event)) return Object.freeze({ label, value: unavailable, meta: founderReportEventMeta(event) });
  return Object.freeze({ label, value: formatter(event.observation.value, event), meta: founderReportEventMeta(event) });
}

function founderReportEpisodeItem(label, events, { sourceObserved = false } = {}) {
  if (!events.length) return Object.freeze({
    label,
    value: sourceObserved ? '0 QUALIFYING EPISODES RECORDED' : 'NO OBSERVATION AVAILABLE',
    meta: sourceObserved ? 'Zero recorded events is not proof that no movement or silence occurred.' : 'The required measurement path did not emit a usable observation.',
  });
  const durationMs = founderReportUnionDuration(events, {
    startedAtMs: Math.min(...events.map((event) => event.startMs)),
    endedAtMs: Math.max(...events.map((event) => event.endMs)),
  });
  return Object.freeze({
    label,
    value: `${events.length} TIMESTAMPED EPISODE${events.length === 1 ? '' : 'S'} · ${founderReportDuration(durationMs)} UNION DURATION`,
    meta: `${founderReportEventMeta(events[0])} Overlapping event time is counted once.`,
  });
}

function founderReportIntervalItem(label, events, result, { sourceObserved = false } = {}) {
  if (!events.length) return Object.freeze({
    label,
    value: sourceObserved ? '0 TIMESTAMPED INTERVALS RECORDED' : 'NO OBSERVATION AVAILABLE',
    meta: sourceObserved ? 'Zero is an explicit event count for this completed run.' : 'The required measurement path did not emit a usable observation.',
  });
  const durationMs = founderReportUnionDuration(events, result);
  const ratio = Number.isFinite(result?.durationMs) && result.durationMs > 0 ? durationMs / result.durationMs : null;
  return Object.freeze({
    label,
    value: `${events.length} TIMESTAMPED INTERVAL${events.length === 1 ? '' : 'S'} · ${founderReportDuration(durationMs)} UNION DURATION${ratio === null ? '' : ` · ${founderReportPercent(ratio)} OF RUN`}`,
    meta: 'Intervals use the analytics session clock; overlapping time is counted once.',
  });
}

function founderReportReliabilityLabel(events, sourceObserved = false) {
  const observed = events.filter(founderReportValuePresent);
  if (!observed.length) return sourceObserved ? 'NO QUALIFYING EPISODE RECORDED' : 'UNAVAILABLE';
  const reliabilities = new Set(observed.map((event) => event.quality?.reliability || 'unavailable'));
  return reliabilities.has('unavailable') || reliabilities.has('low') ? 'OBSERVED · LIMITED RELIABILITY' : 'OBSERVED';
}

function founderReportCoverageEntry(label, modality, events) {
  const available = modality?.available === true;
  const coverage = Number.isFinite(modality?.coverage) && modality.coverage >= 0 && modality.coverage <= 1 ? modality.coverage : null;
  const frames = Number.isFinite(modality?.frameCount) ? Math.max(0, Math.round(modality.frameCount)) : null;
  const analyzable = Number.isFinite(modality?.analyzableFrames) ? Math.max(0, Math.round(modality.analyzableFrames)) : null;
  const personSpecificCoverage = Number.isFinite(modality?.personSpecificCoverage) && modality.personSpecificCoverage >= 0 && modality.personSpecificCoverage <= 1 ? modality.personSpecificCoverage : null;
  const personSpecificSamples = Number.isFinite(modality?.personSpecificSampleCount) ? Math.max(0, Math.round(modality.personSpecificSampleCount)) : null;
  const reliabilityCounts = { high: 0, medium: 0, low: 0, unavailable: 0 };
  for (const event of events) reliabilityCounts[event.quality?.reliability] = (reliabilityCounts[event.quality?.reliability] || 0) + 1;
  const reliability = Object.entries(reliabilityCounts).filter(([, count]) => count > 0).map(([key, count]) => `${key} ${count}`).join(' · ') || 'no event reliability records';
  const status = !available
    ? 'UNAVAILABLE'
    : personSpecificCoverage === 0
      ? 'NO EXACTLY-ONE-PERSON COVERAGE'
      : personSpecificCoverage !== null && personSpecificCoverage < 0.8
        ? 'LIMITED EXACTLY-ONE-PERSON COVERAGE'
        : coverage === 0
          ? 'NO ANALYZABLE OBSERVATION'
          : coverage !== null && coverage < 0.8
            ? 'LIMITED COVERAGE'
            : 'OBSERVED';
  return Object.freeze({
    label,
    status,
    text: `${available ? 'Input available' : 'Input unavailable'} · analysis coverage ${founderReportPercent(coverage)} · ${frames === null ? 'frame count unavailable' : `${frames} frames`}${analyzable === null ? '' : ` · ${analyzable} analyzable`}${personSpecificCoverage === null ? '' : ` · exactly-one-person coverage ${founderReportPercent(personSpecificCoverage)}`}${personSpecificSamples === null ? '' : ` · ${personSpecificSamples} exactly-one-person samples`} · reliability records: ${reliability}.`,
  });
}

function founderReportHeadOrientation(value) {
  if (!value || typeof value !== 'object') return 'UNAVAILABLE';
  const axis = (name) => Number.isFinite(value[name]) ? `${Number(value[name]).toFixed(1)}°` : 'UNAVAILABLE';
  return `YAW ${axis('yawDeg')} · PITCH ${axis('pitchDeg')} · ROLL ${axis('rollDeg')}`;
}

function founderReportGestureZones(value) {
  if (!value || typeof value !== 'object') return 'UNAVAILABLE';
  const side = (name) => {
    const entries = Object.entries(value[name] || {}).filter(([, count]) => Number.isFinite(count) && count >= 0);
    if (!entries.length) return `${name} 0 categorized frames`;
    return `${name} ${entries.map(([zone, count]) => `${founderReportHumanize(zone)} ${Math.round(count)} frames`).join(', ')}`;
  };
  return `${side('left')} · ${side('right')}`.toUpperCase();
}

function founderReportEpisodeBreakdown(events, key) {
  const counts = new Map();
  for (const event of events) {
    const value = event.observation?.value;
    const name = value && typeof value === 'object' ? value[key] : null;
    if (typeof name === 'string' && name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts.size ? [...counts].map(([name, count]) => `${founderReportHumanize(name)} ${count}`).join(' · ').toUpperCase() : 'NO LABELED EPISODE BREAKDOWN';
}

function founderReportPositiveFraction(event) {
  return founderReportValuePresent(event)
    && Number.isFinite(event.observation.value)
    && event.observation.value > 0
    && event.quality?.reliability !== 'unavailable';
}

function founderReportPositiveCounts(event) {
  if (!founderReportValuePresent(event) || event.quality?.reliability === 'unavailable') return false;
  const stack = [event.observation.value];
  while (stack.length) {
    const value = stack.pop();
    if (Number.isFinite(value) && value > 0) return true;
    if (value && typeof value === 'object') stack.push(...Object.values(value));
  }
  return false;
}

function founderVisualSuppression(result, events) {
  const durationMs = Number.isFinite(result?.durationMs) ? Math.max(0, Math.round(result.durationMs)) : null;
  const camera = result?.modalities?.camera || {};
  const visualEvents = events.filter((event) => FOUNDER_VISUAL_METRICS.has(event.metric));
  const triggers = events.filter((event) => event.metric === 'multiple_faces_detected');
  const safetyGaps = events.filter((event) => event.metric === 'observation_gap' && (
    ['multiple_faces', 'multiple_face_frames_excluded'].includes(event.observation?.value)
    || event.observation?.qualifiers?.includes?.('multiple_face_interval_suppressed')
  ));
  const explicitDuration = [camera.personSpecificSuppressedDurationMs, camera.safetySuppressedDurationMs, camera.multiFaceSuppressedDurationMs]
    .find((value) => Number.isFinite(value) && value >= 0);
  const timestampedSafetyEvents = safetyGaps.length ? safetyGaps : triggers.filter((event) => event.observation?.qualifiers?.includes?.('affected_interval_suppressed'));
  const affectedDurationMs = explicitDuration === undefined ? founderReportUnionDuration(timestampedSafetyEvents, result) : Math.round(explicitDuration);
  const affectedRatio = durationMs && Number.isFinite(affectedDurationMs) && affectedDurationMs <= durationMs ? affectedDurationMs / durationMs : null;
  const triggered = triggers.length > 0 || safetyGaps.length > 0 || affectedDurationMs > 0;
  if (!triggered) return Object.freeze({ triggered: false, partial: false, affectedDurationMs: 0, affectedRatio: 0, summary: 'No multiple-face safety suppression event was recorded.' });
  const partial = visualEvents.length > 0 && affectedRatio !== null && affectedRatio > 0 && affectedRatio < 1;
  let summary;
  if (partial) {
    summary = `Safe exactly-one-person sample evidence remains available. Multiple-face-excluded intervals total ${founderReportDuration(affectedDurationMs)} (${founderReportPercent(affectedRatio)}) across ${timestampedSafetyEvents.length} timestamped interval${timestampedSafetyEvents.length === 1 ? '' : 's'}; other gaps and exact safe coverage are reported separately.`;
  } else if (affectedRatio !== null && affectedRatio > 0) {
    summary = `Person-specific visual result coverage was suppressed for ${founderReportDuration(affectedDurationMs)} (${founderReportPercent(affectedRatio)}) after a multiple-face safety trigger. The envelope does not prove that another person was present throughout that result-suppression window.`;
  } else {
    summary = 'A multiple-face safety trigger was recorded, but this envelope does not expose an exact affected interval; person-specific visual coverage is unavailable.';
  }
  if (!visualEvents.length) summary += ' Safe-interval person-specific values were not emitted by this envelope.';
  return Object.freeze({ triggered: true, partial, affectedDurationMs, affectedRatio, intervalCount: timestampedSafetyEvents.length, triggerCount: triggers.length, summary });
}

/**
 * Creates a synchronous, display-only Founder report from a sealed analytics result.
 * It summarizes only emitted observations and never changes the student projection.
 */
export function founderPostRunReport(result, { cockpitPerformance = null, localReplayRetained = false } = {}) {
  const events = founderReportEvents(result);
  const metrics = (names) => founderReportMetrics(events, names);
  const metric = (name) => founderReportMetric(events, name);
  const mic = result?.modalities?.mic || {};
  const camera = result?.modalities?.camera || {};
  const micEvents = events.filter((event) => event.source?.input === 'mic');
  const cameraEvents = events.filter((event) => event.source?.input === 'camera');
  const audioObserved = mic.available === true && (Number(mic.frameCount) > 0 || micEvents.length > 0);
  const visualObserved = camera.available === true && (Number(camera.analyzableFrames) > 0 || cameraEvents.length > 0);
  const suppression = founderVisualSuppression(result, events);
  const visualGaps = events.filter((event) => {
    if (event.metric !== 'observation_gap' || event.observation?.qualifiers?.includes?.('audio')) return false;
    const reason = String(event.observation?.value || '');
    return /camera|vision|visual|face|document_hidden|multi_face/u.test(reason)
      || event.observation?.qualifiers?.includes?.('vision')
      || event.observation?.qualifiers?.includes?.('person_specific_visual_signals_suppressed');
  });
  const faceAbsenceGaps = visualGaps.filter((event) => event.observation?.value === 'face_absence');
  const multipleFaceGaps = visualGaps.filter((event) => ['multiple_faces', 'multiple_face_frames_excluded'].includes(event.observation?.value));
  const protectionGaps = visualGaps.filter((event) => event.observation?.value === 'multi_face_protection_unavailable');

  const duration = metric('answer_duration_ms');
  const level = metric('captured_level_dbfs');
  const clipping = metric('digital_clipping_fraction');
  const responseStart = metric('response_start_latency_ms');
  const speechRatio = metric('speech_active_ratio');
  const energy = metric('energy_variation_db');
  // The current transcript and pitch paths have no validation contract. Keep
  // their Founder report values unavailable even when experimental events are
  // present in the raw catalog below.
  const wordRate = null;
  const filler = null;
  const pitch = null;
  const pauses = metrics(['pause_episode']);
  const handMotion = metrics(['hand_motion_episode']);
  const leans = metrics(['lateral_torso_lean']);
  const sways = metrics(['body_sway_episode']);
  const headTurns = metrics(['sustained_head_turn_episode']);
  const faceMoves = metrics(['facial_movement_episode']);
  const handTrackable = founderReportPositiveFraction(metric('hand_presence')) || founderReportPositiveCounts(metric('gesture_zone'));
  const torsoTrackable = founderReportPositiveFraction(metric('torso_presence'));
  const faceTrackable = founderReportPositiveFraction(metric('face_presence'));

  const voiceEvents = metrics(['answer_duration_ms', 'captured_level_dbfs', 'digital_clipping_fraction', 'response_start_latency_ms', 'speech_active_ratio', 'energy_variation_db', 'word_rate_wpm', 'filler_token_count']);
  const gestureEvents = metrics(['hand_presence', 'hand_motion_episode', 'gesture_zone']);
  const postureEvents = metrics(['torso_presence', 'lateral_torso_lean', 'body_sway_episode']);
  const headEvents = metrics(['face_presence', 'head_orientation_proxy', 'camera_facing_proxy', 'sustained_head_turn_episode']);
  const facialEvents = metrics(['face_presence', 'facial_movement_episode']);
  const framingEvents = [...metrics(['framing_center', 'multiple_faces_detected']), ...visualGaps];

  const sections = [
    Object.freeze({
      id: 'voice', title: 'Voice / Delivery', status: founderReportReliabilityLabel(voiceEvents, audioObserved),
      items: Object.freeze([
        founderReportItem('Answer duration', duration, (value) => `${founderReportDuration(value)} · SESSION CLOCK`),
        founderReportItem('Captured microphone level', level, (value) => `${founderReportNumber(value)} dBFS · DEVICE CAPTURE, NOT CALIBRATED LOUDNESS`, audioObserved ? 'NO USABLE LEVEL OBSERVATION' : 'UNAVAILABLE — MICROPHONE OBSERVATION NOT AVAILABLE'),
        founderReportItem('Digital clipping', clipping, (value) => `${founderReportPercent(value, 2)} OF ANALYZED DIGITAL SAMPLES`, audioObserved ? 'NO CLIPPING OBSERVATION RECORDED' : 'UNAVAILABLE — MICROPHONE OBSERVATION NOT AVAILABLE'),
        founderReportItem('Detected speech-active time', speechRatio, (value) => `${founderReportPercent(value)} · LEVEL-ACTIVITY ESTIMATE ONLY`, audioObserved ? 'NO SPEECH-ACTIVITY OBSERVATION RECORDED' : 'UNAVAILABLE — MICROPHONE OBSERVATION NOT AVAILABLE'),
        founderReportItem('Detected speech start', responseStart, (value) => `${founderReportDuration(value)} AFTER RUN START · LEVEL-ACTIVITY ESTIMATE ONLY`, audioObserved ? 'NO QUALIFYING START OBSERVATION RECORDED' : 'UNAVAILABLE — MICROPHONE OBSERVATION NOT AVAILABLE'),
        founderReportItem('Captured energy variation', energy, (value) => `${founderReportNumber(value)} dB IQR · CAPTURED ENERGY ONLY`),
        founderReportItem('Words per minute', wordRate, (value) => `${Math.round(value)} WPM · TRANSCRIPT-DERIVED`, 'UNAVAILABLE — NO TRANSCRIPT-DERIVED WPM OBSERVATION'),
        founderReportItem('Pitch / F0', pitch, (value, event) => `${founderReportNumber(value)} ${event.observation?.unit || ''}`.trim(), 'UNAVAILABLE — NO VALIDATED F0 OBSERVATION'),
        founderReportItem('Transcript-derived filler tokens', filler, (value) => `${Math.max(0, Math.round(value))} TOKENS`, 'UNAVAILABLE — NO TRANSCRIPT-DERIVED OBSERVATION'),
      ]),
      limitations: Object.freeze(founderReportUniqueLimitations(voiceEvents, ['Delivery interpretation is not produced.'])),
    }),
    Object.freeze({
      id: 'pauses', title: 'Silence / Pauses', status: founderReportReliabilityLabel(pauses, audioObserved),
      items: Object.freeze([
        founderReportEpisodeItem('Detected silence between speech', pauses, { sourceObserved: audioObserved }),
        Object.freeze({ label: 'Purpose', value: 'NOT DETERMINED', meta: 'Pause events represent detected silence only.' }),
      ]),
      limitations: Object.freeze(founderReportUniqueLimitations(pauses, ['Voice-activity ground truth is not validated; quiet speech and startup noise can be ambiguous.'])),
    }),
    Object.freeze({
      id: 'gestures', title: 'Gesture / Hands', status: founderReportReliabilityLabel(gestureEvents, visualObserved && handTrackable),
      items: Object.freeze([
        founderReportItem('Hand visible in exactly-one-person analyzable frames', metric('hand_presence'), (value) => founderReportPercent(value), visualObserved ? 'NO PERSON-SPECIFIC HAND OBSERVATION EMITTED' : 'UNAVAILABLE — VISUAL OBSERVATION NOT AVAILABLE'),
        founderReportEpisodeItem('Hand movement', handMotion, { sourceObserved: handTrackable }),
        Object.freeze({ label: 'Movement channels', value: founderReportEpisodeBreakdown(handMotion, 'hands'), meta: 'Left and right are MediaPipe anatomical channels; no gesture meaning is assigned.' }),
        founderReportItem('Observed hand zones', metric('gesture_zone'), founderReportGestureZones, visualObserved ? 'NO HAND-ZONE OBSERVATION EMITTED' : 'UNAVAILABLE — VISUAL OBSERVATION NOT AVAILABLE'),
      ]),
      limitations: Object.freeze(founderReportUniqueLimitations(gestureEvents, suppression.triggered ? [suppression.summary] : [])),
    }),
    Object.freeze({
      id: 'posture', title: 'Posture / Body', status: founderReportReliabilityLabel(postureEvents, visualObserved && torsoTrackable),
      items: Object.freeze([
        founderReportItem('Torso visible in exactly-one-person analyzable frames', metric('torso_presence'), (value) => founderReportPercent(value), visualObserved ? 'NO PERSON-SPECIFIC TORSO OBSERVATION EMITTED' : 'UNAVAILABLE — VISUAL OBSERVATION NOT AVAILABLE'),
        founderReportEpisodeItem('Lateral torso lean', leans, { sourceObserved: torsoTrackable }),
        founderReportEpisodeItem('Body sway', sways, { sourceObserved: torsoTrackable }),
      ]),
      limitations: Object.freeze(founderReportUniqueLimitations(postureEvents, suppression.triggered ? [suppression.summary] : ['Camera-relative geometry only.'])),
    }),
    Object.freeze({
      id: 'head', title: 'Head / Camera-facing', status: founderReportReliabilityLabel(headEvents, visualObserved && faceTrackable),
      items: Object.freeze([
        founderReportItem('Face visible in exactly-one-person analyzable frames', metric('face_presence'), (value) => founderReportPercent(value), visualObserved ? 'NO PERSON-SPECIFIC FACE OBSERVATION EMITTED' : 'UNAVAILABLE — VISUAL OBSERVATION NOT AVAILABLE'),
        founderReportItem('Average head orientation proxy', metric('head_orientation_proxy'), founderReportHeadOrientation, visualObserved ? 'NO HEAD-ORIENTATION OBSERVATION EMITTED' : 'UNAVAILABLE — VISUAL OBSERVATION NOT AVAILABLE'),
        founderReportItem('Camera-facing head position', metric('camera_facing_proxy'), (value) => `${founderReportPercent(value)} OF FACE-VISIBLE ANALYZABLE FRAMES`, visualObserved ? 'NO CAMERA-FACING OBSERVATION EMITTED' : 'UNAVAILABLE — VISUAL OBSERVATION NOT AVAILABLE'),
        founderReportEpisodeItem('Sustained head turn', headTurns, { sourceObserved: faceTrackable }),
      ]),
      limitations: Object.freeze(founderReportUniqueLimitations(headEvents, [suppression.triggered ? suppression.summary : null, 'Head orientation is camera-relative; visual attention is not measured.'])),
    }),
    Object.freeze({
      id: 'facial', title: 'Facial movement', status: founderReportReliabilityLabel(facialEvents, visualObserved && faceTrackable),
      items: Object.freeze([
        founderReportEpisodeItem('Facial movement', faceMoves, { sourceObserved: faceTrackable }),
        ...(faceMoves.length ? [Object.freeze({ label: 'Recorded movement rates', value: faceMoves.map((event) => `${founderReportNumber(event.observation?.value)} score-change/s`).join(' · '), meta: 'Geometry change only; no expression category is assigned.' })] : []),
      ]),
      limitations: Object.freeze(founderReportUniqueLimitations(facialEvents, [suppression.triggered ? suppression.summary : null, 'Movement is reported without interpreting expression or internal state.'])),
    }),
    Object.freeze({
      id: 'framing', title: 'Framing / Tracking safety', status: suppression.triggered ? 'SAFETY SUPPRESSION RECORDED' : founderReportReliabilityLabel(framingEvents, visualObserved),
      items: Object.freeze([
        founderReportItem('Face centered in frame', metric('framing_center'), (value) => `${founderReportPercent(value)} OF FACE-VISIBLE ANALYZABLE FRAMES`, visualObserved ? 'NO PERSON-SPECIFIC FRAMING OBSERVATION EMITTED' : 'UNAVAILABLE — VISUAL OBSERVATION NOT AVAILABLE'),
        founderReportIntervalItem('Face absent / out of view', faceAbsenceGaps, result, { sourceObserved: visualObserved }),
        founderReportIntervalItem('Multiple-face frames excluded', multipleFaceGaps, result, { sourceObserved: visualObserved }),
        founderReportIntervalItem('Face-protection unavailable', protectionGaps, result, { sourceObserved: visualObserved }),
        Object.freeze({ label: 'Exactly-one-person safety', value: suppression.summary, meta: `${suppression.triggerCount || 0} safety trigger event${suppression.triggerCount === 1 ? '' : 's'} · ${suppression.intervalCount || 0} timestamped suppression interval${suppression.intervalCount === 1 ? '' : 's'}.` }),
      ]),
      limitations: Object.freeze(founderReportUniqueLimitations(framingEvents)),
    }),
    Object.freeze({
      id: 'performance-privacy', title: 'Performance / Privacy', status: 'FACTUAL RECEIPT',
      items: Object.freeze([
        Object.freeze({ label: 'Full visual pipeline p95', value: Number.isFinite(result?.performance?.visualInferenceP95Ms) ? `${founderReportNumber(result.performance.visualInferenceP95Ms, 2)} ms` : 'UNAVAILABLE', meta: 'Includes local worker inference and rendering.' }),
        Object.freeze({ label: 'Founder cockpit run-wide p95', value: `OVERLAY BLIT ${cockpitPerformance?.overlay?.p95Ms ?? 'UNAVAILABLE'} ms · AUDIO ${cockpitPerformance?.audio?.p95Ms ?? 'UNAVAILABLE'} ms · TIMELINE ${cockpitPerformance?.timeline?.p95Ms ?? 'UNAVAILABLE'} ms · FRAME ${cockpitPerformance?.frame?.p95Ms ?? 'UNAVAILABLE'} ms`, meta: 'Fixed-memory 0.25 ms histogram.' }),
        Object.freeze({ label: 'Raw analytics retention', value: `AUDIO ${result?.privacy?.rawAudioStored === false ? 'NO' : result?.privacy?.rawAudioStored === true ? 'YES' : 'UNRESOLVED'} · FRAMES ${result?.privacy?.rawFramesStored === false ? 'NO' : result?.privacy?.rawFramesStored === true ? 'YES' : 'UNRESOLVED'} · LANDMARKS ${result?.privacy?.rawLandmarksStored === false ? 'NO' : result?.privacy?.rawLandmarksStored === true ? 'YES' : 'UNRESOLVED'}`, meta: `Optional local replay: ${localReplayRetained ? 'YES — TAB MEMORY ONLY' : 'NO'}.` }),
        Object.freeze({ label: 'External analytics calls', value: result?.privacy?.externalAnalyticsCalls === false ? 'NO' : result?.privacy?.externalAnalyticsCalls === true ? 'YES' : 'UNRESOLVED', meta: `${Number.isFinite(result?.privacy?.blockedExternalAttemptCount) ? Math.max(0, Math.round(result.privacy.blockedExternalAttemptCount)) : 'UNRESOLVED'} blocked external attempt${result?.privacy?.blockedExternalAttemptCount === 1 ? '' : 's'} recorded.` }),
      ]),
      limitations: Object.freeze([]),
    }),
  ];

  const overview = [
    `Run duration ${founderReportDuration(result?.durationMs)}.`,
    level && founderReportValuePresent(level) ? `Captured level ${founderReportNumber(level.observation.value)} dBFS.` : 'Captured level unavailable.',
    clipping && founderReportValuePresent(clipping) ? `Digital clipping ${founderReportPercent(clipping.observation.value, 2)}.` : 'Digital clipping observation unavailable.',
    pauses.length ? `${pauses.length} timestamped pause episode${pauses.length === 1 ? '' : 's'} detected.` : audioObserved ? '0 qualifying pause episodes recorded.' : 'Pause observation unavailable.',
    handMotion.length ? `${handMotion.length} timestamped hand-movement episode${handMotion.length === 1 ? '' : 's'} detected.` : handTrackable ? '0 qualifying hand-movement episodes recorded.' : 'Hand-movement observation unavailable.',
    leans.length || sways.length ? `${leans.length} lean and ${sways.length} sway episode${leans.length + sways.length === 1 ? '' : 's'} detected.` : torsoTrackable ? '0 qualifying lean or sway episodes recorded.' : 'Posture-movement observation unavailable.',
    headTurns.length ? `${headTurns.length} timestamped sustained head-turn episode${headTurns.length === 1 ? '' : 's'} detected.` : faceTrackable ? '0 qualifying sustained head-turn episodes recorded.' : 'Head-turn observation unavailable.',
    faceMoves.length ? `${faceMoves.length} timestamped facial-movement episode${faceMoves.length === 1 ? '' : 's'} detected.` : faceTrackable ? '0 qualifying facial-movement episodes recorded.' : 'Facial-movement observation unavailable.',
    ...(suppression.triggered ? [suppression.summary] : []),
  ];

  return Object.freeze({
    heading: 'Founder multimodal analytics report',
    note: 'Founder-only factual instrumentation. Values below describe emitted observations and limitations; they do not create a communication rating or change the student result.',
    overview: Object.freeze(overview),
    coverage: Object.freeze([
      founderReportCoverageEntry('Microphone', mic, micEvents),
      founderReportCoverageEntry('Camera', camera, cameraEvents),
    ]),
    sections: Object.freeze(sections),
    suppression,
    eventCount: events.length,
  });
}

function renderFounderPostRunReport(report) {
  const region = element('section', 'ca-founder-report');
  region.setAttribute('aria-labelledby', 'communication-analytics-founder-report-overview');
  const overviewTitle = element('h3', '', 'What was detected');
  overviewTitle.id = 'communication-analytics-founder-report-overview';
  region.append(overviewTitle, element('p', 'ca-founder-report-note', report.note));
  const overview = element('ul', 'ca-founder-overview');
  for (const item of report.overview) overview.append(element('li', '', item));
  region.append(overview);

  const coverageTitle = element('h3', '', 'Coverage and reliability');
  const coverage = element('div', 'ca-report-coverage');
  for (const entry of report.coverage) {
    const card = element('section', 'ca-report-coverage-card');
    card.append(element('h4', '', entry.label), element('span', 'ca-report-state', entry.status), element('p', '', entry.text));
    coverage.append(card);
  }
  region.append(coverageTitle, coverage);

  const sectionGrid = element('div', 'ca-report-grid');
  for (const section of report.sections) {
    const card = element('section', 'ca-report-card');
    const titleId = `communication-analytics-founder-report-${section.id}`;
    card.setAttribute('aria-labelledby', titleId);
    const head = element('div', 'ca-report-card-head');
    const title = element('h3', '', section.title);
    title.id = titleId;
    head.append(title, element('span', 'ca-report-state', section.status));
    card.append(head);
    const details = element('dl', 'ca-report-details');
    for (const item of section.items) {
      details.append(element('dt', '', item.label));
      const value = element('dd');
      value.append(element('strong', '', item.value), element('small', '', item.meta));
      details.append(value);
    }
    card.append(details);
    if (section.limitations.length) card.append(element('p', 'ca-report-limitations', `Limitations · ${section.limitations.join(' · ')}`));
    sectionGrid.append(card);
  }
  region.append(sectionGrid);
  return region;
}

export function renderStudentAnalytics(result) {
  const anchor = document.getElementById('communication-results-anchor');
  if (!anchor) return;
  anchor.replaceChildren();
  const projection = studentResultProjection(result);
  const attempted = Boolean(result?.communicationAnalyticsAttempted);
  setUnsafeLegacyVisibility(projection.engineAvailable || attempted);
  if (!projection.engineAvailable && !attempted) return;

  const panel = element('div', 'panel ca-result');
  const pad = element('div', 'pPad');
  const head = element('div', 'ca-result-head');
  const title = element('h2', 'pLbl', 'Communication moments');
  const badge = element('span', projection.available ? 'real' : 'sim', projection.available ? 'VALIDATED · STUDENT SAFE' : 'NO VALIDATED SIGNALS');
  head.append(title, badge);
  pad.append(head);
  pad.append(element('p', 'serif', 'Observable signals from this interview. No communication score was created. Dr Brian’s coaching remains authoritative.'));
  pad.append(element('p', 'serif', 'Only validated signals appear here. Experimental measures stay in the Founder test.'));
  const list = element('div', 'ca-event-list');
  if (!projection.events.length) {
    list.append(element('div', 'ca-status', 'Communication analytics were not available for this interview. No result was inferred.'));
  } else {
    const answerLabels = new Map();
    for (const event of projection.events.slice(0, 9)) {
      if (!answerLabels.has(event.answerId)) answerLabels.set(event.answerId, answerLabels.size + 1);
      const row = element('div', 'ca-event');
      row.append(element('span', 'ca-event-time', formatDuration(event.evidenceRef?.mediaStartMs ?? event.startMs)));
      row.append(element('span', '', `Answer ${answerLabels.get(event.answerId)} · ${describeStudentEvent(event)}`));
      const playback = document.getElementById('playback');
      if (result?.blobUrl && event.evidenceRef?.mediaId && event.evidenceRef.mediaId === result.communicationAnalyticsReplayMediaId && playback && playback.style.display !== 'none') {
        const watch = element('button', 'qBtn', `Watch ${formatDuration(event.evidenceRef.mediaStartMs)}`);
        watch.type = 'button';
        watch.addEventListener('click', () => {
          playback.currentTime = event.evidenceRef.mediaStartMs / 1_000;
          playback.play().catch(() => {});
        });
        row.append(watch);
      }
      list.append(row);
    }
  }
  pad.append(list);
  pad.append(element('div', 'ca-privacy', 'LOCAL DERIVED EVENTS · NO RAW AUDIO, CAMERA FRAMES, LANDMARKS, BIOMETRIC TEMPLATES, OR COMMUNICATION SCORE SAVED BY ANALYTICS'));
  panel.append(pad);
  anchor.append(panel);
}

export class FounderAnalyticsSurface {
  constructor({ root, pipeline, bridge, overlaySettings = null, overlayUi = null }) {
    this.root = root;
    this.pipeline = pipeline;
    this.bridge = bridge;
    this.overlaySettings = overlaySettings;
    this.overlayUi = overlayUi;
    this.state = 'idle';
    this.stepIndex = 0;
    this.startedAt = null;
    this.timer = null;
    this.selectedRunModeId = 'guided';
    this.activeRunPlan = null;
    this.runInterrupted = false;
    this.runInterruptionCount = 0;
    this.runInterruptions = [];
    this.runOpenInterruptions = new Set();
    this.runFirstVisualAtMs = null;
    this.runLastVisualAtMs = null;
    this.runVisualFrameCount = 0;
    this.completedRunReceipt = null;
    this.completedRunCleanup = null;
    this.recorder = null;
    this.chunks = [];
    this.replayUrl = null;
    this.lastDiagnostic = {};
    this.connectEpoch = 0;
    this.runEpoch = 0;
    this.recorderEpoch = 0;
    this.ownsMedia = false;
    this.instrumentationFrame = null;
    this.overlayExpiryTimer = null;
    this.audioHistory = [];
    this.timelineTransitions = [];
    this.timelineTransitionAnchors = new Map();
    this.timelineLevels = [];
    this.timelineStates = new Map();
    this.timelineLatestAtMs = null;
    this.instrumentationCosts = this.newInstrumentationCosts();
    this.completedInstrumentationPerformance = null;
    this.visionStale = true;
    this.visionDiagnosticStale = true;
    this.visionUnavailableReason = null;
    this.audioStale = true;
    this.overlayError = null;
    this.lastOverlayPrimitiveCount = 0;
    this.lastTrackingSummary = '';
    this.founderInstrumentationLocked = false;
    this.onOverlaySettingsChange = () => this.handleOverlaySettingsChange();
    this.overlaySettings?.addEventListener?.('change', this.onOverlaySettingsChange);
    this.pipeline.addEventListener('diagnostic', (event) => {
      this.consumeDiagnostic(event.detail || {});
    });
    this.pipeline.addEventListener('state', (event) => this.consumePipelineState(event.detail || {}));
    this.pipeline.setOverlayConsumer?.((payload) => this.consumeOverlay(payload));
    this.render();
  }

  render() {
    this.root.replaceChildren();
    const grid = element('div', 'ca-grid');
    const media = element('div', 'ca-stack');
    const previewStage = element('div', 'ca-preview-stage');
    const preview = element('video', 'ca-preview');
    preview.id = 'communication-analytics-preview';
    preview.autoplay = true;
    preview.muted = true;
    preview.playsInline = true;
    preview.setAttribute('aria-label', 'Local camera preview for communication analytics');
    const overlay = document.createElement('canvas');
    overlay.id = 'communication-analytics-overlay';
    overlay.className = 'ca-tracking-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    previewStage.append(preview, overlay);
    media.append(previewStage);
    const status = element('div', 'ca-status', 'Connect camera and microphone to begin. Nothing is measured while idle.');
    status.id = 'communication-analytics-status';
    status.tabIndex = -1;
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    media.append(status);
    const actions = element('div', 'ca-actions');
    const connect = element('button', 'btnPri cyan', 'Connect camera + mic');
    connect.type = 'button';
    connect.id = 'communication-analytics-connect';
    connect.addEventListener('click', () => this.connect());
    const start = element('button', 'btnHero', 'Start guided test');
    start.type = 'button';
    start.id = 'communication-analytics-start';
    start.disabled = true;
    start.addEventListener('click', () => this.start());
    const finish = element('button', 'btnGhost', 'Finish test');
    finish.type = 'button';
    finish.id = 'communication-analytics-finish';
    finish.disabled = true;
    finish.addEventListener('click', () => this.finish('manual'));
    actions.append(connect, start, finish);
    media.append(actions);

    const controls = element('div', 'ca-stack');
    const runConfig = element('div', 'ca-run-config');
    const runModeLabel = element('label', '', 'Founder run mode');
    runModeLabel.htmlFor = 'communication-analytics-run-mode';
    const runMode = document.createElement('select');
    runMode.id = 'communication-analytics-run-mode';
    for (const plan of Object.values(FOUNDER_RUN_MODES)) {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.label;
      runMode.append(option);
    }
    runMode.value = founderRunPlan(this.selectedRunModeId).id;
    runMode.addEventListener('change', () => {
      this.selectedRunModeId = founderRunPlan(runMode.value).id;
      this.renderRunPlan();
      this.updateStartAvailability();
    });
    const runModeNote = element('p', 'ca-instrument-note');
    runModeNote.id = 'communication-analytics-run-mode-note';
    runConfig.append(runModeLabel, runMode, runModeNote);
    controls.append(runConfig);
    const replayLabel = element('label', 'ca-status');
    const replay = document.createElement('input');
    replay.type = 'checkbox';
    replay.id = 'communication-analytics-replay';
    replayLabel.append(replay, document.createTextNode(' Keep a local replay until this tab closes. Off by default.'));
    controls.append(replayLabel);
    const stepTitle = element('h2', 'pLbl', 'Guided test steps');
    stepTitle.id = 'communication-analytics-step-title';
    controls.append(stepTitle);
    const steps = element('ol', 'ca-steps');
    steps.id = 'communication-analytics-steps';
    controls.append(steps);
    const stepActions = element('div', 'ca-actions');
    const next = element('button', 'btnGhost', 'Next step');
    next.type = 'button';
    next.id = 'communication-analytics-next';
    next.disabled = true;
    next.addEventListener('click', () => this.nextStep(false));
    const skip = element('button', 'btnGhost', 'Skip step');
    skip.type = 'button';
    skip.id = 'communication-analytics-skip';
    skip.disabled = true;
    skip.addEventListener('click', () => this.nextStep(true));
    stepActions.append(next, skip);
    controls.append(stepActions);
    grid.append(media, controls);
    this.root.append(grid, this.buildFounderCockpit());
    this.configureOverlay(true);
    this.renderRunPlan();
    this.updateStartAvailability();
    this.scheduleInstrumentationRender();
  }

  renderRunPlan() {
    const plan = founderRunPlan(this.selectedRunModeId);
    this.selectedRunModeId = plan.id;
    const selector = document.getElementById('communication-analytics-run-mode');
    if (selector) selector.value = plan.id;
    const title = document.getElementById('communication-analytics-step-title');
    if (title) title.textContent = plan.endurance ? 'Endurance hold' : 'Guided test steps';
    const note = document.getElementById('communication-analytics-run-mode-note');
    if (note) note.textContent = plan.endurance
      ? `${formatDuration(plan.targetDurationMs)} session-clock target · live camera and the local overlay master are required to exercise real MediaPipe WASM with the full cockpit · overlay, gauges, audio, and timeline lock on · local replay is disabled to keep the endurance path bounded · keep this tab visible · Finish test remains available for an explicitly early result.`
      : `${formatDuration(plan.targetDurationMs)} guided functional sequence · Next and Skip remain available · automatic finish follows the final step.`;
    const steps = document.getElementById('communication-analytics-steps');
    if (steps) {
      steps.replaceChildren();
      for (const [stepTitle, instruction] of plan.steps) {
        const item = element('li');
        item.append(element('b', '', stepTitle), document.createTextNode(` — ${instruction}`));
        steps.append(item);
      }
    }
    const start = document.getElementById('communication-analytics-start');
    if (start) start.textContent = plan.startLabel;
    const active = this.state === 'running';
    for (const id of ['communication-analytics-next', 'communication-analytics-skip']) {
      const control = document.getElementById(id);
      if (control) control.disabled = !active || plan.endurance;
    }
  }

  cameraIsLive() {
    const media = this.bridge.media || {};
    return Boolean(media.cam && media.stream?.getVideoTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
  }

  microphoneIsLive() {
    const media = this.bridge.media || {};
    return Boolean(media.mic && media.AC?.state === 'running' && media.stream?.getAudioTracks?.().some((track) => track.readyState === 'live' && track.enabled && track.muted !== true));
  }

  updateStartAvailability() {
    const plan = founderRunPlan(this.selectedRunModeId);
    const start = document.getElementById('communication-analytics-start');
    const selector = document.getElementById('communication-analytics-run-mode');
    const replay = document.getElementById('communication-analytics-replay');
    const transitioning = ['requesting', 'running', 'finalizing'].includes(this.state);
    const anyMedia = this.cameraIsLive() || this.microphoneIsLive();
    const overlayPolicyReady = !plan.endurance || this.overlaySettings?.policy?.().masterEnabled !== false;
    const canStart = ['ready', 'partial'].includes(this.state) && anyMedia && (!plan.requiresCamera || this.cameraIsLive()) && overlayPolicyReady;
    if (start) {
      start.textContent = plan.startLabel;
      start.disabled = !canStart;
    }
    if (selector) selector.disabled = transitioning;
    if (replay) {
      if (plan.endurance) replay.checked = false;
      replay.disabled = transitioning || plan.endurance;
    }
  }

  lockFounderInstrumentation(locked) {
    this.founderInstrumentationLocked = Boolean(locked);
    for (const [id, , targetId] of FOUNDER_INSTRUMENTATION_CONTROLS) {
      const control = document.getElementById(id);
      if (!control) continue;
      if (locked) {
        control.checked = true;
        document.getElementById(targetId)?.classList.remove('ca-hidden');
      }
      control.disabled = Boolean(locked);
    }
    for (const [id] of FOUNDER_OVERLAY_LAYER_CONTROLS) {
      const control = document.getElementById(id);
      if (!control) continue;
      if (locked) control.checked = true;
      control.disabled = Boolean(locked) || this.overlaySettings?.policy?.().masterEnabled === false;
    }
    if (locked) this.configureOverlay(true);
    else this.syncFounderOverlayControls();
    this.scheduleInstrumentationRender();
  }

  syncFounderOverlayControls() {
    const preferences = this.overlaySettings?.preferences?.() || { founderLiveFace: true, founderLiveBody: true };
    const policyEnabled = this.overlaySettings?.policy?.().masterEnabled !== false;
    const locked = this.founderInstrumentationLocked;
    for (const [id, , preferenceKey] of FOUNDER_OVERLAY_LAYER_CONTROLS) {
      const control = document.getElementById(id);
      if (!control) continue;
      control.checked = locked ? true : preferences[preferenceKey] !== false;
      control.disabled = locked || !policyEnabled;
    }
    const master = document.getElementById('communication-analytics-show-overlay');
    if (master) master.disabled = locked || !policyEnabled;
    const status = document.getElementById('communication-analytics-founder-overlay-policy-status');
    if (status) status.textContent = `${policyEnabled ? 'LOCAL OVERLAY POLICY ON' : 'LOCAL OVERLAY POLICY OFF'} · LOCAL ALPHA · THIS BROWSER ONLY · NOT AUTHENTICATED OR SHARED`;
  }

  buildFounderCockpit() {
    const cockpit = element('section', 'ca-cockpit');
    cockpit.id = 'communication-analytics-founder-cockpit';
    cockpit.setAttribute('aria-labelledby', 'communication-analytics-cockpit-title');
    const head = element('div', 'ca-cockpit-head');
    const heading = element('h2', 'pLbl', 'Live Founder instrumentation');
    heading.id = 'communication-analytics-cockpit-title';
    const badges = element('div', 'ca-badges');
    badges.append(element('span', 'real', 'FOUNDER ONLY'), element('span', 'sim', 'LOCAL DERIVED SIGNALS'), element('span', 'sim', 'THIS BROWSER ONLY'));
    head.append(heading, badges);
    cockpit.append(head);
    cockpit.append(element('p', 'ca-cockpit-note', 'Live engineering visibility only. These instruments are not a communication score and do not change the student result.'));

    const toggles = element('div', 'ca-instrument-toggles');
    for (const [id, label, targetId] of FOUNDER_INSTRUMENTATION_CONTROLS) {
      const control = toggleControl(id, label, true);
      control.input.setAttribute('aria-controls', targetId);
      control.input.addEventListener('change', () => {
        const target = document.getElementById(targetId);
        target?.classList.toggle('ca-hidden', !control.input.checked);
        if (id === 'communication-analytics-show-overlay') this.configureOverlay(control.input.checked);
        this.scheduleInstrumentationRender();
      });
      toggles.append(control.label);
    }
    const founderPreferences = this.overlaySettings?.preferences?.() || { founderLiveFace: true, founderLiveBody: true };
    for (const [id, label, preferenceKey] of FOUNDER_OVERLAY_LAYER_CONTROLS) {
      const control = toggleControl(id, label, founderPreferences[preferenceKey] !== false);
      control.input.dataset.overlayPreference = preferenceKey;
      control.input.setAttribute('aria-controls', 'communication-analytics-overlay');
      control.input.addEventListener('change', () => {
        try { this.overlaySettings?.updatePreferences?.({ [preferenceKey]: control.input.checked }, { role: this.bridge.role }); } catch {}
        this.configureOverlay(document.getElementById('communication-analytics-show-overlay')?.checked !== false);
      });
      toggles.append(control.label);
    }
    const rawControl = toggleControl('communication-analytics-show-diagnostics', ' Raw diagnostics', false);
    rawControl.input.setAttribute('aria-controls', 'communication-analytics-diagnostics');
    rawControl.input.addEventListener('change', () => this.renderDiagnostics());
    toggles.append(rawControl.label);
    cockpit.append(toggles);

    const overlayPolicyStatus = element('p', 'ca-overlay-status', 'LOCAL ALPHA · THIS BROWSER ONLY · NOT AUTHENTICATED OR SHARED');
    overlayPolicyStatus.id = 'communication-analytics-founder-overlay-policy-status';
    overlayPolicyStatus.setAttribute('role', 'status');
    overlayPolicyStatus.setAttribute('aria-live', 'polite');
    cockpit.append(overlayPolicyStatus);

    const tracking = element('div', 'ca-tracking-status');
    tracking.id = 'communication-analytics-tracking-status';
    tracking.setAttribute('role', 'status');
    tracking.setAttribute('aria-live', 'polite');
    tracking.setAttribute('aria-atomic', 'true');
    tracking.textContent = 'Tracking · IDLE — START A GUIDED TEST';
    cockpit.append(tracking);

    const instruments = element('div', 'ca-instrument-grid');
    const gauges = element('section', 'ca-instrument');
    gauges.id = 'communication-analytics-gauges';
    gauges.setAttribute('aria-labelledby', 'communication-analytics-gauges-title');
    const gaugesTitle = element('h3', '', 'Head + posture proxies');
    gaugesTitle.id = 'communication-analytics-gauges-title';
    gauges.append(gaugesTitle, element('p', 'ca-instrument-note', 'Camera-relative geometric proxies; unavailable whenever exactly-one-person protection is not ready.'));
    gauges.append(
      gauge('communication-analytics-yaw-gauge', 'Head yaw proxy', -45, 45),
      gauge('communication-analytics-pitch-gauge', 'Head pitch proxy', -30, 30),
      gauge('communication-analytics-roll-gauge', 'Head roll proxy', -30, 30),
      gauge('communication-analytics-lean-gauge', 'Torso lateral lean', -30, 30),
    );

    const audio = element('section', 'ca-instrument');
    audio.id = 'communication-analytics-audio';
    audio.setAttribute('aria-labelledby', 'communication-analytics-audio-title');
    const audioTitle = element('h3', '', 'Voice + delivery instruments');
    audioTitle.id = 'communication-analytics-audio-title';
    const audioCanvas = document.createElement('canvas');
    audioCanvas.id = 'communication-analytics-audio-waveform';
    audioCanvas.className = 'ca-signal-canvas';
    audioCanvas.setAttribute('role', 'img');
    audioCanvas.setAttribute('aria-label', 'Audio level envelope unavailable');
    audio.append(audioTitle, element('p', 'ca-instrument-note', 'Bounded derived RMS level envelope; no PCM samples are retained.'), audioCanvas);
    const meters = element('div', 'ca-meter-grid');
    meters.append(
      instrumentMeter('communication-analytics-level-meter', 'Captured level', -80, 0, ' dBFS'),
      instrumentMeter('communication-analytics-peak-meter', 'Peak amplitude', 0, 1, ''),
      instrumentMeter('communication-analytics-clipping-meter', 'Clipping', 0, 100, '%'),
    );
    audio.append(meters);
    const delivery = element('dl', 'ca-delivery-status');
    delivery.append(
      element('dt', '', 'Detected speech'), element('dd', '', 'UNAVAILABLE'),
      element('dt', '', 'Pause in progress'), element('dd', '', 'UNAVAILABLE'),
      element('dt', '', 'Pitch'), element('dd', '', 'UNAVAILABLE — NO VALIDATED F0 INPUT'),
      element('dt', '', 'WPM'), element('dd', '', 'TRANSCRIPT REQUIRED — UNAVAILABLE IN LIVE COCKPIT'),
      element('dt', '', 'Energy variation'), element('dd', '', 'UNAVAILABLE — FOUNDER EXPERIMENTAL ONLY'),
    );
    delivery.id = 'communication-analytics-delivery-status';
    audio.append(delivery);

    const timeline = element('section', 'ca-instrument ca-instrument-wide');
    timeline.id = 'communication-analytics-timeline';
    timeline.setAttribute('aria-labelledby', 'communication-analytics-timeline-title');
    const timelineTitle = element('h3', '', 'Synchronized live timeline');
    timelineTitle.id = 'communication-analytics-timeline-title';
    const timelineCanvas = document.createElement('canvas');
    timelineCanvas.id = 'communication-analytics-live-timeline';
    timelineCanvas.className = 'ca-timeline-canvas';
    timelineCanvas.setAttribute('role', 'img');
    timelineCanvas.setAttribute('aria-label', 'Synchronized timeline awaiting timestamped diagnostics');
    const timelineStatus = element('p', 'ca-timeline-status', 'AWAITING TIMESTAMPED DIAGNOSTICS — NO SYNCHRONIZED EVENTS SHOWN');
    timelineStatus.id = 'communication-analytics-timeline-status';
    timeline.append(timelineTitle, element('p', 'ca-instrument-note', 'Rolling 30-second window. Rows are derived transitions on the analytics session clock, not inferred coaching claims.'), timelineCanvas, timelineStatus);

    instruments.append(gauges, audio, timeline);
    cockpit.append(instruments);
    const diagnostics = element('div', 'ca-diagnostics ca-hidden');
    diagnostics.id = 'communication-analytics-diagnostics';
    diagnostics.setAttribute('aria-live', 'off');
    cockpit.append(diagnostics);
    return cockpit;
  }

  configureOverlay(enabled) {
    const overlay = document.getElementById('communication-analytics-overlay');
    const policyEnabled = this.overlaySettings?.policy?.().masterEnabled !== false;
    const faceEnabled = policyEnabled && document.getElementById('communication-analytics-show-face-overlay')?.checked !== false;
    const bodyEnabled = policyEnabled && document.getElementById('communication-analytics-show-body-overlay')?.checked !== false;
    const overlayEnabled = Boolean(enabled && policyEnabled && (faceEnabled || bodyEnabled));
    overlay?.classList.toggle('ca-hidden', !overlayEnabled);
    try { this.pipeline.setInstrumentation?.({ overlayEnabled, faceEnabled, bodyEnabled }); } catch {}
    if (!overlayEnabled) this.clearOverlay();
    this.syncFounderOverlayControls();
  }

  handleOverlaySettingsChange() {
    const policyEnabled = this.overlaySettings?.policy?.().masterEnabled !== false;
    if (this.state === 'running' && this.activeRunPlan?.endurance && !policyEnabled) {
      let atMs = null;
      try { atMs = this.pipeline?.session?.clock?.sessionMs?.() ?? null; } catch {}
      this.recordRunInterruption({
        subsystem: 'overlay-display', atMs,
        message: 'Local overlay policy was disabled during the endurance run.',
      });
    }
    this.syncFounderOverlayControls();
    this.configureOverlay(document.getElementById('communication-analytics-show-overlay')?.checked !== false);
    this.updateStartAvailability();
  }

  consumePipelineState(detail) {
    if (detail?.state === 'partial') {
      const atMs = founderDiagnosticAtMs(detail);
      if (['vision', 'multi-face-protection', 'all'].includes(detail?.subsystem)) {
        this.expireVision(atMs, detail.message || detail.subsystem);
      }
      if (['audio', 'all'].includes(detail?.subsystem)) {
        this.recordRunInterruption({ ...detail, atMs, subsystem: 'audio' });
        this.audioStale = true;
        this.audioHistory.length = 0;
        this.closeTimelineStates(['audioAvailable', 'speech', 'silence', 'pause', 'clipping'], atMs);
      }
      if (!['vision', 'multi-face-protection', 'audio', 'all'].includes(detail?.subsystem)) this.recordRunInterruption({ ...detail, atMs });
    }
    if (['idle', 'complete'].includes(detail?.state)) {
      this.visionStale = true;
      this.visionDiagnosticStale = true;
      this.audioStale = true;
      this.clearOverlay();
      if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
      this.overlayExpiryTimer = null;
    }
    this.renderDiagnostics();
    this.scheduleInstrumentationRender();
  }

  consumeDiagnostic(detail) {
    const modality = detail?.modality;
    if (modality !== 'audio' && modality !== 'vision') return;
    this.lastDiagnostic[modality] = detail;
    const atMs = founderDiagnosticAtMs(detail);

    if (modality === 'audio') {
      if (!founderAudioDiagnosticAvailable(detail)) {
        this.recordRunInterruption({ subsystem: 'audio', atMs, message: detail.reason || 'audio diagnostics unavailable' });
        this.audioStale = true;
        this.audioHistory.length = 0;
        this.closeTimelineStates(['audioAvailable', 'speech', 'silence', 'pause', 'clipping'], atMs);
        this.renderDiagnostics();
        this.scheduleInstrumentationRender();
        return;
      }
      this.runOpenInterruptions?.delete('audio');
      this.audioStale = false;
      const db = audioLevelDb(detail);
      const peak = Number.isFinite(detail.peak) ? Math.max(0, Math.min(1, detail.peak)) : null;
      const clipping = clippingFraction(detail);
      if (db !== null || peak !== null || clipping !== null) {
        boundedFounderHistory(this.audioHistory, { atMs, db, peak, clipping }, MAX_AUDIO_HISTORY);
      }
      if (atMs !== null) {
        this.timelineLatestAtMs = Math.max(this.timelineLatestAtMs ?? atMs, atMs);
        this.recordTimelineState('audioAvailable', true, atMs);
        if (db !== null) boundedFounderHistory(this.timelineLevels, { atMs, db }, FOUNDER_TIMELINE_LEVEL_CAPACITY);
        if (typeof detail.speaking === 'boolean') this.recordTimelineState('speech', detail.speaking, atMs);
        if (typeof detail.speaking === 'boolean') this.recordTimelineState('silence', !detail.speaking, atMs);
        const pause = founderPauseTimelineTransition(detail);
        if (pause) this.recordTimelineState('pause', pause.active, pause.atMs);
        if (clipping !== null) this.recordTimelineState('clipping', clipping > 0, atMs);
      }
    }

    if (modality === 'vision') {
      const freshness = founderVisionDiagnosticFreshness(detail);
      if (!freshness.fresh) {
        if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
        this.overlayExpiryTimer = null;
        const boundaryAtMs = freshness.staleAtMs ?? this.timelineLatestAtMs;
        this.expireVision(boundaryAtMs, freshness.inferenceMs === null
          ? 'vision diagnostics unavailable — missing bounded latency'
          : `vision diagnostics stale — ${freshness.inferenceMs.toFixed(1)} ms capture-to-return latency`);
        this.renderDiagnostics();
        return;
      }
      if (!detail.geometry) {
        this.expireVision(freshness.atMs, 'vision geometry unavailable — local frame inference failed');
        this.renderDiagnostics();
        return;
      }
      const diagnostics = this.pipeline.diagnostics();
      const protection = founderFaceProtectionStatus(detail, diagnostics);
      const geometry = founderOverlayGeometry(detail, { multiFaceProtection: protection.guardReady });
      this.runOpenInterruptions?.delete('vision');
      if (atMs !== null) {
        this.runVisualFrameCount = (Number.isFinite(this.runVisualFrameCount) ? this.runVisualFrameCount : 0) + 1;
        if (this.runFirstVisualAtMs === null) this.runFirstVisualAtMs = atMs;
        this.runLastVisualAtMs = Math.max(this.runLastVisualAtMs ?? atMs, atMs);
      }
      this.visionStale = !geometry;
      this.visionDiagnosticStale = false;
      this.visionUnavailableReason = null;
      if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
      this.overlayExpiryTimer = null;
      const overlayEnabled = document.getElementById('communication-analytics-show-overlay')?.checked !== false;
      if (this.state !== 'running' || !overlayEnabled || !geometry || !detail.overlayRendered) this.clearOverlay();
      if (this.state === 'running') {
        const staleAtMs = atMs === null ? null : atMs + OVERLAY_STALE_MS;
        this.overlayExpiryTimer = setTimeout(() => {
          this.overlayExpiryTimer = null;
          this.expireVision(staleAtMs, 'vision diagnostics stale — local inference stopped updating');
        }, freshness.remainingMs);
      }
      if (atMs !== null) {
        const visual = founderVisualStates(geometry, detail.live);
        this.timelineLatestAtMs = Math.max(this.timelineLatestAtMs ?? atMs, atMs);
        this.recordTimelineState('visionAvailable', Boolean(detail.geometry), atMs);
        this.recordTimelineState('face', Boolean(geometry?.face?.present), atMs);
        this.recordTimelineState('torso', Boolean(geometry?.pose?.torsoPresent), atMs);
        this.recordTimelineState('leftHand', Boolean(geometry?.hands?.left?.present), atMs);
        this.recordTimelineState('rightHand', Boolean(geometry?.hands?.right?.present), atMs);
        this.recordTimelineState('gesture', Boolean(visual.gesture), atMs);
        this.recordTimelineState('head', visual.headMovement, atMs);
        this.recordTimelineState('posture', visual.postureMovement, atMs);
        this.recordTimelineState('framing', visual.framingCentered === true, atMs);
      }
    }

    this.renderDiagnostics();
    this.scheduleInstrumentationRender();
  }

  consumeOverlay({
    bitmap,
    geometry,
    atMs,
    primitiveCount = 0,
    pipelineMs = null,
    overlayStatus = bitmap ? 'rendered' : 'unavailable',
    overlayUnavailableReason = bitmap ? null : 'overlay_bitmap_unavailable',
  } = {}) {
    const diagnostics = this.pipeline.diagnostics();
    const enabled = document.getElementById('communication-analytics-show-overlay')?.checked !== false;
    const detail = { modality: 'vision', geometry };
    const protection = founderFaceProtectionStatus(detail, diagnostics);
    const protectedGeometry = founderOverlayGeometry(detail, { multiFaceProtection: protection.guardReady });
    const freshness = founderVisionDiagnosticFreshness({ atMs, inferenceMs: pipelineMs });
    if (overlayStatus === 'error') {
      this.overlayError = overlayRenderStatusCopy({ overlayStatus, overlayUnavailableReason });
      this.clearOverlay();
      return;
    }
    this.overlayError = null;
    if (this.state !== 'running' || !enabled || overlayStatus !== 'rendered' || !bitmap || !protectedGeometry || !freshness.fresh) {
      this.clearOverlay();
      return;
    }
    try {
      this.drawOverlayBitmap(bitmap);
      this.overlayError = null;
      this.lastOverlayPrimitiveCount = Number.isFinite(primitiveCount) ? primitiveCount : 0;
    } catch (error) {
      this.overlayError = String(error?.message || error).slice(0, 300);
      let interruptionAtMs = founderDiagnosticAtMs({ atMs });
      if (interruptionAtMs === null) {
        try {
          interruptionAtMs = founderDiagnosticAtMs({ atMs: this.pipeline?.session?.clock?.sessionMs?.() });
        } catch {}
      }
      if (interruptionAtMs === null) interruptionAtMs = founderDiagnosticAtMs({ atMs: this.timelineLatestAtMs });
      this.recordRunInterruption({
        subsystem: 'overlay-display',
        atMs: interruptionAtMs ?? 0,
        message: 'Founder overlay canvas drawing failed; analytics continued.',
      });
      this.clearOverlay();
    }
  }

  recordTimelineState(key, active, atMs) {
    if (founderDiagnosticAtMs({ atMs }) === null) return;
    if (this.timelineStates.get(key) === active) return;
    this.timelineStates.set(key, active);
    appendFounderTimelineTransition(this.timelineTransitions, this.timelineTransitionAnchors, { key, active, atMs }, MAX_TIMELINE_TRANSITIONS);
  }

  closeTimelineStates(keys, atMs) {
    if (atMs === null) return;
    this.timelineLatestAtMs = Math.max(this.timelineLatestAtMs ?? atMs, atMs);
    for (const key of keys) this.recordTimelineState(key, false, atMs);
  }

  recordRunInterruption({ subsystem = 'unknown', atMs = null, message = 'instrumentation unavailable' } = {}) {
    if (this.state !== 'running' || !this.activeRunPlan?.endurance) return false;
    const rawSubsystem = String(subsystem || 'unknown').slice(0, 80);
    const interruptionKey = ['vision', 'multi-face-protection', 'all'].includes(rawSubsystem) ? 'vision' : rawSubsystem;
    if (!(this.runOpenInterruptions instanceof Set)) this.runOpenInterruptions = new Set();
    if (this.runOpenInterruptions.has(interruptionKey)) return false;
    this.runOpenInterruptions.add(interruptionKey);
    this.runInterrupted = true;
    this.runInterruptionCount += 1;
    if (!Array.isArray(this.runInterruptions)) this.runInterruptions = [];
    boundedFounderHistory(this.runInterruptions, Object.freeze({
      atMs: founderDiagnosticAtMs({ atMs }),
      subsystem: rawSubsystem,
      message: String(message || 'instrumentation unavailable').slice(0, 160),
    }), 20);
    return true;
  }

  expireVision(atMs, reason = 'vision unavailable') {
    this.recordRunInterruption({ subsystem: 'vision', atMs, message: reason });
    this.visionStale = true;
    this.visionDiagnosticStale = true;
    this.visionUnavailableReason = reason;
    this.closeTimelineStates(['visionAvailable', 'face', 'torso', 'leftHand', 'rightHand', 'gesture', 'head', 'posture', 'framing'], atMs);
    this.clearOverlay();
    if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
    this.overlayExpiryTimer = null;
    this.renderDiagnostics?.();
    this.scheduleInstrumentationRender();
  }

  scheduleInstrumentationRender() {
    if (this.instrumentationFrame !== null) return;
    if (typeof requestAnimationFrame !== 'function') {
      this.renderInstrumentation();
      return;
    }
    this.instrumentationFrame = requestAnimationFrame(() => {
      this.instrumentationFrame = null;
      this.renderInstrumentation();
    });
  }

  measureInstrumentation(kind, callback) {
    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    try {
      return callback();
    } finally {
      const elapsed = Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - startedAt);
      const accumulator = this.instrumentationCosts[kind];
      if (accumulator) recordFounderTiming(accumulator, elapsed);
    }
  }

  newInstrumentationCosts() {
    return {
      overlay: createFounderTimingAccumulator(),
      audio: createFounderTimingAccumulator(),
      timeline: createFounderTimingAccumulator(),
      frame: createFounderTimingAccumulator(),
    };
  }

  instrumentationPerformance() {
    return founderInstrumentationPerformance(this.instrumentationCosts);
  }

  renderInstrumentation() {
    return this.measureInstrumentation('frame', () => {
      const diagnostics = this.pipeline.diagnostics();
      const vision = this.lastDiagnostic.vision || {};
      const protection = founderFaceProtectionStatus(this.visionDiagnosticStale ? {} : vision, diagnostics);
      const geometry = this.state === 'running' && !this.visionStale
        ? founderOverlayGeometry(vision, { multiFaceProtection: protection.guardReady })
        : null;
      this.renderTrackingStatus(diagnostics, geometry, protection);
      this.setGauge('communication-analytics-yaw-gauge', geometry?.face?.present ? geometry.face.yawProxyDeg : null);
      this.setGauge('communication-analytics-pitch-gauge', geometry?.face?.present ? geometry.face.pitchProxyDeg : null);
      this.setGauge('communication-analytics-roll-gauge', geometry?.face?.present ? geometry.face.rollProxyDeg : null);
      this.setGauge('communication-analytics-lean-gauge', geometry?.pose?.torsoPresent ? geometry.pose.lateralLeanDeg : null);
      this.renderAudioInstruments();
      this.renderTimeline();
    });
  }

  renderTrackingStatus(diagnostics, geometry, protection = founderFaceProtectionStatus(this.lastDiagnostic.vision || {}, diagnostics)) {
    const status = document.getElementById('communication-analytics-tracking-status');
    if (!status) return;
    const running = this.state === 'running';
    const worker = running
      ? this.visionUnavailableReason ? 'VISION UNAVAILABLE' : diagnostics.workerReady ? 'VISION READY' : 'VISION WAITING/UNAVAILABLE'
      : 'VISION IDLE';
    const protectionLabel = running ? protection.label : 'PERSON SAFETY IDLE';
    const face = geometry?.face?.present ? 'FACE TRACKED' : 'FACE UNAVAILABLE';
    const torso = geometry?.pose?.torsoPresent ? 'TORSO TRACKED' : 'TORSO UNAVAILABLE';
    const left = geometry?.hands?.left?.present ? 'LEFT HAND TRACKED' : 'LEFT HAND UNAVAILABLE';
    const right = geometry?.hands?.right?.present ? 'RIGHT HAND TRACKED' : 'RIGHT HAND UNAVAILABLE';
    const visual = founderVisualStates(geometry, this.lastDiagnostic.vision?.live);
    const facing = visual.cameraFacing === null ? 'CAMERA-FACING PROXY UNAVAILABLE' : visual.cameraFacing ? 'CAMERA-FACING PROXY YES' : 'CAMERA-FACING PROXY NO';
    const framing = visual.framingCentered === null ? 'FRAMING UNAVAILABLE' : visual.framingCentered ? 'FRAMING CENTERED' : 'FRAMING OUTSIDE CENTER GUIDE';
    const gesture = !geometry ? 'GESTURE UNAVAILABLE' : visual.gesture ? `GESTURE ACTIVE ${visual.gesture.toUpperCase()}` : 'GESTURE INACTIVE';
    const summary = `${worker} · ${protectionLabel} · ${face} · ${torso} · ${left} · ${right} · ${facing} · ${framing} · ${gesture} · ${diagnostics.targetFps ?? 'UNAVAILABLE'} FPS TARGET · ${diagnostics.droppedFrames ?? 'UNAVAILABLE'} DROPPED`;
    if (summary !== this.lastTrackingSummary) {
      status.textContent = summary;
      this.lastTrackingSummary = summary;
    }
  }

  setGauge(id, value) {
    const meter = document.getElementById(id);
    if (!meter) return;
    const output = meter.parentElement?.querySelector('output');
    const marker = meter.querySelector('.ca-gauge-marker');
    const minimum = Number(meter.dataset.minimum);
    const maximum = Number(meter.dataset.maximum);
    const presentation = founderScalePresentation(value, minimum, maximum, meter.dataset.unit, 1);
    meter.classList.toggle('ca-unavailable', !presentation.available);
    if (!presentation.available) {
      meter.removeAttribute('aria-valuenow');
      meter.setAttribute('aria-valuetext', 'Unavailable');
      if (output) output.textContent = 'UNAVAILABLE';
      if (marker) marker.style.removeProperty('--ca-gauge-position');
      return;
    }
    meter.setAttribute('aria-valuenow', presentation.bounded.toFixed(1));
    meter.setAttribute('aria-valuetext', presentation.text);
    if (output) output.textContent = presentation.text;
    if (marker) marker.style.setProperty('--ca-gauge-position', `${((presentation.bounded - minimum) / (maximum - minimum)) * 100}%`);
  }

  setInstrumentMeter(id, value, decimals = 1, allowOutOfRange = false) {
    const meter = document.getElementById(id);
    if (!meter) return;
    const output = meter.parentElement?.querySelector('output');
    const presentation = founderScalePresentation(value, Number(meter.min), Number(meter.max), meter.dataset.unit, decimals, { allowOutOfRange });
    meter.classList.toggle('ca-unavailable', !presentation.available);
    if (!presentation.available) {
      meter.removeAttribute('value');
      meter.setAttribute('aria-valuetext', 'Unavailable');
      if (output) output.textContent = 'UNAVAILABLE';
      return;
    }
    meter.value = presentation.bounded;
    meter.setAttribute('aria-valuetext', presentation.text);
    if (output) output.textContent = presentation.text;
  }

  renderAudioInstruments() {
    const audio = this.state === 'running' && !this.audioStale ? this.lastDiagnostic.audio || {} : {};
    const db = audioLevelDb(audio);
    const peak = Number.isFinite(audio.peak) && audio.peak >= 0 && audio.peak <= 1 ? audio.peak : null;
    const clipping = clippingFraction(audio);
    const energyVariation = founderEnergyVariationDb(this.audioHistory);
    this.setInstrumentMeter('communication-analytics-level-meter', db, 1, true);
    this.setInstrumentMeter('communication-analytics-peak-meter', peak, 2);
    this.setInstrumentMeter('communication-analytics-clipping-meter', clipping === null ? null : clipping * 100, 1);
    const delivery = document.getElementById('communication-analytics-delivery-status');
    const values = delivery?.querySelectorAll('dd');
    if (values?.length >= 5) {
      values[0].textContent = typeof audio.speaking === 'boolean' ? (audio.speaking ? 'YES — DERIVED LEVEL ACTIVITY' : 'NO') : 'UNAVAILABLE';
      values[1].textContent = Number.isFinite(audio.pauseInProgressMs) ? `${(audio.pauseInProgressMs / 1_000).toFixed(1)} s — SILENCE ONLY; PURPOSE NOT INFERRED` : 'UNAVAILABLE';
      values[2].textContent = 'UNAVAILABLE — NO VALIDATED F0 INPUT';
      values[3].textContent = 'TRANSCRIPT REQUIRED — UNAVAILABLE IN LIVE COCKPIT';
      values[4].textContent = energyVariation === null
        ? 'UNAVAILABLE — NEEDS AT LEAST 4 VALID LEVEL FRAMES · FOUNDER EXPERIMENTAL ONLY'
        : `${energyVariation.toFixed(1)} dB IQR · BOUNDED LAST 180 LEVEL FRAMES · CAPTURED ENERGY ONLY · FOUNDER EXPERIMENTAL ONLY`;
    }
    this.drawAudioEnvelope();
  }

  canvasContext(canvas, fallbackWidth, fallbackHeight) {
    if (!canvas || canvas.classList.contains('ca-hidden')) return null;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || fallbackWidth));
    const cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || fallbackHeight));
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.round(cssWidth * ratio);
    const height = Math.round(cssHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context ? { context, width: cssWidth, height: cssHeight } : null;
  }

  drawOverlayBitmap(bitmap) {
    return this.measureInstrumentation('overlay', () => {
      const canvas = document.getElementById('communication-analytics-overlay');
      const preview = document.getElementById('communication-analytics-preview');
      const stage = canvas?.parentElement;
      if (!canvas || !preview || !stage) return;
      const surface = this.canvasContext(canvas, preview.clientWidth || 480, preview.clientHeight || 270);
      if (!surface) return;
      const { context, width, height } = surface;
      context.clearRect(0, 0, width, height);
      const rect = founderOverlayDrawRect(bitmap.width, bitmap.height, width, height);
      if (!rect) throw new TypeError('Founder overlay bitmap dimensions are unavailable.');
      context.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height);
    });
  }

  clearOverlay() {
    const canvas = document.getElementById('communication-analytics-overlay');
    const context = canvas?.getContext?.('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  }

  drawAudioEnvelope() {
    return this.measureInstrumentation('audio', () => {
      const canvas = document.getElementById('communication-analytics-audio-waveform');
      if (!canvas || document.getElementById('communication-analytics-show-audio')?.checked === false) return;
      const surface = this.canvasContext(canvas, 520, 112);
      if (!surface) return;
      const { context, width, height } = surface;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#070b12';
      context.fillRect(0, 0, width, height);
      const values = this.audioHistory.map((sample) => sample.db).filter(Number.isFinite);
      if (!values.length) {
        canvas.setAttribute('aria-label', 'Audio level envelope unavailable');
        return;
      }
      context.strokeStyle = 'rgba(57,214,255,.25)';
      context.lineWidth = 1;
      for (const db of [-60, -40, -20]) {
        const y = height - ((db + 80) / 80) * height;
        context.beginPath();context.moveTo(0, y);context.lineTo(width, y);context.stroke();
      }
      context.strokeStyle = '#39d6ff';
      context.lineWidth = 2;
      context.beginPath();
      let started = false;
      this.audioHistory.forEach((sample, index) => {
        if (!Number.isFinite(sample.db)) return;
        const x = this.audioHistory.length < 2 ? width : (index / (this.audioHistory.length - 1)) * width;
        const y = height - ((Math.max(-80, Math.min(0, sample.db)) + 80) / 80) * height;
        if (!started) { context.moveTo(x, y);started = true; } else context.lineTo(x, y);
      });
      context.stroke();
      const latest = values.at(-1);
      canvas.setAttribute('aria-label', `Bounded derived audio level envelope, latest ${latest.toFixed(1)} decibels full scale; no PCM samples retained`);
    });
  }

  renderTimeline() {
    return this.measureInstrumentation('timeline', () => {
    const canvas = document.getElementById('communication-analytics-live-timeline');
    const status = document.getElementById('communication-analytics-timeline-status');
    if (!canvas || !status || document.getElementById('communication-analytics-show-timeline')?.checked === false) return;
    const surface = this.canvasContext(canvas, 920, 280);
    if (!surface) return;
    const { context, width, height } = surface;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#070b12';
    context.fillRect(0, 0, width, height);
    if (this.timelineLatestAtMs === null) {
      status.textContent = 'AWAITING TIMESTAMPED DIAGNOSTICS — NO SYNCHRONIZED EVENTS SHOWN';
      canvas.setAttribute('aria-label', 'Synchronized timeline awaiting timestamped diagnostics');
      return;
    }
    const rows = [
      ['audioAvailable', 'AUDIO DATA'], ['speech', 'SPEECH'], ['silence', 'SILENCE'], ['pause', 'PAUSE'], ['clipping', 'CLIP'], ['level', 'LEVEL'],
      ['visionAvailable', 'VISION DATA'],
      ['face', 'FACE'], ['leftHand', 'L HAND'], ['rightHand', 'R HAND'], ['gesture', 'GESTURE'],
      ['head', 'HEAD'], ['posture', 'POSTURE'], ['framing', 'FRAMING'],
    ];
    const labelWidth = 62;
    const endAt = this.timelineLatestAtMs;
    const startAt = Math.max(0, endAt - LIVE_TIMELINE_WINDOW_MS);
    const span = Math.max(1, endAt - startAt);
    const trackWidth = Math.max(1, width - labelWidth - 8);
    const rowHeight = height / rows.length;
    const xAt = (atMs) => labelWidth + ((Math.max(startAt, Math.min(endAt, atMs)) - startAt) / span) * trackWidth;
    context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    rows.forEach(([key, label], rowIndex) => {
      const top = rowIndex * rowHeight;
      const center = top + rowHeight / 2;
      context.fillStyle = '#8e9daf';
      context.fillText(label, 4, center + 3);
      context.strokeStyle = 'rgba(255,255,255,.1)';
      context.beginPath();context.moveTo(labelWidth, center);context.lineTo(width, center);context.stroke();
      if (key === 'level') {
        const samples = this.timelineLevels.filter((sample) => sample.atMs >= startAt && sample.atMs <= endAt && Number.isFinite(sample.db));
        if (samples.length) {
          context.strokeStyle = '#ffd166';
          context.lineWidth = 1.5;
          context.beginPath();
          samples.forEach((sample, index) => {
            const boundedDb = Math.max(-80, Math.min(0, sample.db));
            const y = top + rowHeight - 4 - ((boundedDb + 80) / 80) * Math.max(3, rowHeight - 8);
            if (index === 0) context.moveTo(xAt(sample.atMs), y);
            else context.lineTo(xAt(sample.atMs), y);
          });
          context.stroke();
        }
        return;
      }
      const transitions = this.timelineTransitions.filter((item) => item.key === key).sort((a, b) => a.atMs - b.atMs);
      let active = Boolean(this.timelineTransitionAnchors.get(key)?.active);
      let activeFrom = startAt;
      for (const transition of transitions) {
        if (transition.atMs < startAt) {
          active = transition.active;
          activeFrom = startAt;
          continue;
        }
        if (transition.atMs > endAt) break;
        if (active) {
          context.fillStyle = key === 'clipping' ? '#ff5d73' : '#39d6ff';
          context.fillRect(xAt(activeFrom), top + 7, Math.max(1, xAt(transition.atMs) - xAt(activeFrom)), Math.max(3, rowHeight - 14));
        }
        active = transition.active;
        activeFrom = transition.atMs;
      }
      if (active) {
        context.fillStyle = key === 'clipping' ? '#ff5d73' : '#39d6ff';
        context.fillRect(xAt(activeFrom), top + 7, Math.max(1, xAt(endAt) - xAt(activeFrom)), Math.max(3, rowHeight - 14));
      }
    });
    const seconds = (span / 1_000).toFixed(1);
    status.textContent = `${this.timelineTransitions.length} BOUNDED STATE TRANSITIONS · ${this.timelineLevels.length} BOUNDED LEVEL SAMPLES · ${seconds} s SESSION-CLOCK WINDOW · NEWEST ${formatDuration(endAt)}`;
    canvas.setAttribute('aria-label', `Synchronized live timeline with ${this.timelineTransitions.length} bounded state transitions and ${this.timelineLevels.length} bounded level samples through ${formatDuration(endAt)}`);
    });
  }

  resetInstrumentation() {
    if (this.instrumentationFrame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.instrumentationFrame);
    this.instrumentationFrame = null;
    if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
    this.overlayExpiryTimer = null;
    this.audioHistory.length = 0;
    this.timelineTransitions.length = 0;
    this.timelineTransitionAnchors.clear();
    this.timelineLevels.length = 0;
    this.timelineStates.clear();
    this.timelineLatestAtMs = null;
    this.runFirstVisualAtMs = null;
    this.runLastVisualAtMs = null;
    this.runVisualFrameCount = 0;
    this.visionStale = true;
    this.visionDiagnosticStale = true;
    this.visionUnavailableReason = null;
    this.audioStale = true;
    this.overlayError = null;
    this.lastOverlayPrimitiveCount = 0;
    this.lastTrackingSummary = '';
    this.instrumentationCosts = this.newInstrumentationCosts();
    this.clearOverlay();
    for (const id of ['communication-analytics-audio-waveform', 'communication-analytics-live-timeline']) {
      const canvas = document.getElementById(id);
      canvas?.getContext?.('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  async connect() {
    if (this.state === 'requesting' || this.state === 'running' || this.state === 'finalizing') return;
    const connectEpoch = ++this.connectEpoch;
    this.ownsMedia = true;
    this.setStatus('requesting', 'Waiting for browser permission…');
    const connect = document.getElementById('communication-analytics-connect');
    if (connect) connect.disabled = true;
    const start = document.getElementById('communication-analytics-start');
    if (start) start.disabled = true;
    await Promise.resolve(this.bridge.requestMedia(true, true));
    if (connectEpoch !== this.connectEpoch) {
      if (this.bridge.media?.stream) this.bridge.stopMedia();
      this.ownsMedia = false;
      return;
    }
    const current = this.bridge.media;
    current.cam = Boolean(current.cam && current.stream?.getVideoTracks?.().some((track) => track.readyState === 'live'));
    current.mic = Boolean(current.mic && current.stream?.getAudioTracks?.().some((track) => track.readyState === 'live'));
    const preview = document.getElementById('communication-analytics-preview');
    if (preview && current.stream) preview.srcObject = current.stream;
    if (!current.cam && !current.mic) {
      this.setStatus('denied', 'Camera and microphone are blocked or unavailable. Nothing was measured. Use the browser permission control, then retry.');
      document.getElementById('communication-analytics-status')?.focus();
      if (connect) { connect.disabled = false; connect.textContent = 'Retry camera + mic'; }
      return;
    }
    const availability = `${current.cam ? 'CAMERA ACTIVE' : 'CAMERA UNAVAILABLE'} · ${current.mic ? 'MIC ACTIVE' : 'MIC UNAVAILABLE'}`;
    this.setStatus(current.cam && current.mic ? 'ready' : 'partial', `${availability}. Raw frames and audio are not sent by analytics.`);
    if (connect) connect.disabled = false;
    this.updateStartAvailability();
  }

  start() {
    if (!['ready', 'partial'].includes(this.state)) return;
    const selected = document.getElementById('communication-analytics-run-mode')?.value || this.selectedRunModeId;
    const plan = founderRunPlan(selected);
    this.selectedRunModeId = plan.id;
    if (plan.requiresCamera && !this.cameraIsLive()) {
      this.setStatus('partial', `${plan.label} requires a live camera so real MediaPipe WASM frames are actually processed. Reconnect camera or choose the guided functional sequence.`);
      document.getElementById('communication-analytics-status')?.focus();
      return;
    }
    if (plan.endurance && this.overlaySettings?.policy?.().masterEnabled === false) {
      this.setStatus('partial', `${plan.label} requires the local overlay master to be ON so the full Founder cockpit instrumentation is actually exercised. Enable it in Admin Ops or choose the guided functional sequence.`);
      document.getElementById('communication-analytics-status')?.focus();
      return;
    }
    this.pipeline.resetSession();
    this.completedInstrumentationPerformance = null;
    this.completedRunReceipt = null;
    this.completedRunCleanup = null;
    this.resetInstrumentation();
    this.lastDiagnostic = {};
    if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
    this.replayUrl = null;
    this.chunks = [];
    const runEpoch = ++this.runEpoch;
    this.activeRunPlan = plan;
    this.runInterrupted = false;
    this.runInterruptionCount = 0;
    this.runInterruptions.length = 0;
    this.runOpenInterruptions.clear();
    this.runFirstVisualAtMs = null;
    this.runLastVisualAtMs = null;
    this.runVisualFrameCount = 0;
    this.stepIndex = 0;
    this.startedAt = performance.now();
    const mediaId = `founder-${Date.now()}`;
    let mediaStartedAt = null;
    const replay = document.getElementById('communication-analytics-replay');
    if (replay?.checked && window.MediaRecorder && this.bridge.media?.stream) {
      try {
        const recorder = new MediaRecorder(this.bridge.media.stream);
        const recorderEpoch = ++this.recorderEpoch;
        this.recorder = recorder;
        recorder.ondataavailable = (event) => {
          if (this.recorder === recorder && this.recorderEpoch === recorderEpoch && runEpoch === this.runEpoch && event.data.size) this.chunks.push(event.data);
        };
        recorder.start(250);
        mediaStartedAt = performance.now();
      } catch { this.recorder = null; }
    }
    try {
      this.pipeline.beginAnswer({ answerId: mediaId, mediaId, mediaStartedAt, videoElement: document.getElementById('communication-analytics-preview') });
    } catch {
      this.detachRecorder();
      this.activeRunPlan = null;
      this.lockFounderInstrumentation(false);
      this.setStatus('error', 'The local analytics session could not start. Nothing was retained.');
      return;
    }
    this.lockFounderInstrumentation(plan.endurance);
    this.setStatus('running', plan.endurance
      ? `${plan.label} running. Cockpit instrumentation is locked on. Keep this tab visible; Finish test ends early and will be labeled honestly.`
      : 'Guided functional test running. No score is being created.');
    for (const id of ['communication-analytics-start', 'communication-analytics-connect']) document.getElementById(id)?.setAttribute('disabled', '');
    document.getElementById('communication-analytics-finish')?.removeAttribute('disabled');
    this.renderRunPlan();
    this.renderStep();
    this.timer = setInterval(() => this.tickRun(runEpoch), 250);
  }

  tickRun(runEpoch = this.runEpoch, now = performance.now()) {
    if (runEpoch !== this.runEpoch || this.state !== 'running' || !this.activeRunPlan) return;
    this.renderStep();
    const elapsedMs = Math.max(0, now - this.startedAt);
    if (this.activeRunPlan.endurance) {
      if (elapsedMs >= this.activeRunPlan.targetDurationMs) this.finish('target_elapsed');
      return;
    }
    const stepEndMs = this.activeRunPlan.steps.slice(0, this.stepIndex + 1).reduce((sum, step) => sum + step[2] * 1_000, 0);
    if (elapsedMs >= stepEndMs) this.nextStep(false);
  }

  nextStep(skipped) {
    if (this.state !== 'running' || !this.activeRunPlan || this.activeRunPlan.endurance) return;
    const item = document.querySelectorAll('#communication-analytics-steps li')[this.stepIndex];
    if (skipped && item) item.append(document.createTextNode(' · NOT EXERCISED'));
    this.stepIndex += 1;
    if (this.stepIndex >= this.activeRunPlan.steps.length) this.finish('guided_sequence_complete');
    else this.renderStep(true);
  }

  renderStep(announce = false) {
    document.querySelectorAll('#communication-analytics-steps li').forEach((item, index) => {
      if (index === this.stepIndex && this.state === 'running') item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    if (this.state === 'running' && this.activeRunPlan) {
      const elapsedMs = Math.max(0, performance.now() - this.startedAt);
      const step = this.activeRunPlan.steps[this.stepIndex] || this.activeRunPlan.steps.at(-1);
      if (this.activeRunPlan.endurance) {
        const progress = founderRunProgress(this.activeRunPlan.id, elapsedMs);
        this.setStatus('running', `${step[0]} · elapsed ${founderRunClock(progress.elapsedMs)} · remaining ${founderRunClock(progress.remainingMs, { rounding: 'ceil' })} · ${this.runInterrupted ? 'INTERRUPTION RECORDED — RUN WILL NOT BE LABELED UNINTERRUPTED' : 'NO INSTRUMENTATION INTERRUPTION RECORDED'} · ${step[1]}`, { announce });
      } else {
        this.setStatus('running', `${step[0]} · session ${founderRunClock(elapsedMs)} elapsed · ${step[1]}`, { announce });
      }
    }
  }

  async finish(reason = 'manual') {
    if (this.state !== 'running') return;
    const runEpoch = this.runEpoch;
    const endAt = performance.now();
    const elapsedMs = Math.max(0, endAt - this.startedAt);
    this.completedRunReceipt = founderRunReceipt({
      modeId: this.activeRunPlan?.id || this.selectedRunModeId,
      elapsedMs,
      interrupted: this.runInterrupted,
      interruptionCount: this.runInterruptionCount,
      visualFrameCount: this.runVisualFrameCount,
      firstVisualAtMs: this.runFirstVisualAtMs,
      lastVisualAtMs: this.runLastVisualAtMs,
    });
    clearInterval(this.timer);
    this.timer = null;
    this.setStatus('finalizing', `${reason === 'target_elapsed' || reason === 'guided_sequence_complete' ? 'Target reached.' : 'Finish requested.'} Finalizing synchronized evidence…`);
    if (this.overlayExpiryTimer) clearTimeout(this.overlayExpiryTimer);
    this.overlayExpiryTimer = null;
    this.visionStale = true;
    this.visionDiagnosticStale = true;
    this.clearOverlay();
    this.pipeline.prepareEnd(endAt);
    const recorder = this.recorder;
    let recorderStopped = false;
    if (recorder) {
      recorderStopped = await Promise.race([
        new Promise((resolve) => {
          recorder.addEventListener('stop', () => resolve(true), { once: true });
          recorder.addEventListener('error', () => resolve(false), { once: true });
          try { if (recorder.state !== 'inactive') recorder.stop(); else resolve(true); } catch { resolve(false); }
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), 2_000)),
      ]);
    }
    if (runEpoch !== this.runEpoch) return;
    if (recorder && recorderStopped && this.chunks.length) this.replayUrl = URL.createObjectURL(new Blob(this.chunks, { type: this.chunks[0].type || 'video/webm' }));
    this.detachRecorder({ stop: false });
    const result = this.pipeline.endAnswer({ mediaAvailable: Boolean(this.replayUrl), endAt });
    if (!result) {
      if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
      this.replayUrl = null;
      this.chunks = [];
      this.clear();
      this.setStatus('error', 'TEST FAILED · RESULT WITHHELD. Local validation did not accept this run; devices were released and no analytics result was retained. Retry when ready.');
      document.getElementById('communication-analytics-status')?.focus();
      return;
    }
    this.completedInstrumentationPerformance = this.instrumentationPerformance();
    this.lockFounderInstrumentation(false);
    this.resetInstrumentation();
    this.completedRunCleanup = this.releaseCompletedRunResources();
    this.renderFounderResult(result);
  }

  releaseCompletedRunResources() {
    let released = true;
    try { this.pipeline.resetSession(); } catch { released = false; }
    if (this.ownsMedia) {
      try {
        this.bridge.stopMedia();
        this.ownsMedia = false;
      } catch { released = false; }
    }
    if (released) {
      const preview = document.getElementById('communication-analytics-preview');
      if (preview) preview.srcObject = null;
    }
    return released;
  }

  detachRecorder({ stop = true } = {}) {
    const recorder = this.recorder;
    this.recorderEpoch += 1;
    this.recorder = null;
    if (!recorder) return;
    recorder.ondataavailable = null;
    recorder.onerror = null;
    recorder.onstop = null;
    if (stop && recorder.state !== 'inactive') { try { recorder.stop(); } catch {} }
  }

  renderFounderResult(result) {
    const runReceipt = this.completedRunReceipt;
    this.setStatus('complete', `${runReceipt?.summary || 'TEST COMPLETE'} · No score was created.`);
    const prior = document.getElementById('communication-analytics-founder-result');
    prior?.remove();
    const panel = element('div', 'panel ca-result');
    panel.id = 'communication-analytics-founder-result';
    panel.tabIndex = -1;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', 'communication-analytics-founder-result-title');
    const pad = element('div', 'pPad');
    const cockpitPerformance = this.completedInstrumentationPerformance;
    const report = founderPostRunReport(result, { cockpitPerformance, localReplayRetained: Boolean(this.replayUrl) });
    const reportTitle = element('h2', 'pLbl', report.heading);
    reportTitle.id = 'communication-analytics-founder-result-title';
    pad.append(reportTitle);
    const studentSafe = result?.studentEvents?.length || 0;
    const experimental = result?.events?.filter((event) => event.maturity === 'FOUNDER_EXPERIMENTAL').length || 0;
    pad.append(element('div', 'ca-status', `${studentSafe} validated student-safe observations · ${experimental} Founder-only experimental observations · ${result?.events?.length || 0} total timestamped events.`));
    if (runReceipt) pad.append(element('div', `ca-run-receipt ${runReceipt.targetCompleted && this.completedRunCleanup ? 'ca-run-complete' : 'ca-run-limited'}`, `${runReceipt.summary} · ${this.completedRunCleanup ? 'CAMERA, MICROPHONE, AND LOCAL WASM WORKERS RELEASED' : 'AUTOMATIC CLEANUP INCOMPLETE — USE CLEAR TEST + RELEASE DEVICES'}`));
    pad.append(renderFounderPostRunReport(report));
    const catalogTitle = element('h3', 'ca-catalog-title', 'Full timestamped evidence catalog');
    catalogTitle.id = 'communication-analytics-founder-catalog-title';
    pad.append(catalogTitle, element('p', 'ca-founder-report-note', 'Complete event-level evidence follows the summary. Times use the synchronized media/session clock when available.'));
    const list = element('div', 'ca-event-list');
    for (const event of (result?.events || [])) {
      const row = element('div', 'ca-event');
      row.append(element('span', 'ca-event-time', formatDuration(event.evidenceRef?.mediaStartMs ?? 0)));
      const observed = typeof event.observation?.value === 'object' ? JSON.stringify(event.observation.value) : String(event.observation?.value ?? 'unavailable');
      const limitations = event.quality?.limitations?.length ? ` · limitations: ${event.quality.limitations.join(', ')}` : '';
      row.append(element('span', '', `${event.metric.replaceAll('_', ' ')} · ${observed} ${event.observation?.unit || ''} · ${event.durationMs} ms · reliability ${event.quality?.reliability || 'unavailable'}${limitations} · ${event.maturity === 'VALIDATED_STUDENT_SAFE' ? 'VALIDATED · STUDENT SAFE' : event.maturity === 'REJECTED_UNRELIABLE' ? 'REJECTED · UNRELIABLE' : 'EXPERIMENTAL · FOUNDER ONLY'}`));
      if (this.replayUrl && event.evidenceRef?.mediaId) {
        const watch = element('button', 'qBtn', `Watch ${formatDuration(event.evidenceRef.mediaStartMs)}`);
        watch.type = 'button';
        watch.addEventListener('click', () => {
          const replay = document.getElementById('communication-analytics-founder-replay');
          if (replay) { replay.currentTime = event.evidenceRef.mediaStartMs / 1_000; replay.play().catch(() => {}); }
        });
        row.append(watch);
      }
      list.append(row);
    }
    if (!result?.events?.length) list.append(element('div', 'ca-status', 'NO TIMESTAMPED EVENTS WERE EMITTED FOR THIS RUN.'));
    pad.append(list);
    pad.append(element('div', 'ca-privacy', `PRIVACY RECEIPT · analytics raw audio/frames/landmarks retained: NO · optional local replay: ${this.replayUrl ? 'YES — TAB MEMORY ONLY' : 'NO'} · external analytics egress: BLOCKED BY SAME-ORIGIN WORKER GUARD + CSP · full visual pipeline p95 (includes worker rendering): ${result?.performance?.visualInferenceP95Ms ?? 'UNRESOLVED'} ms · Founder cockpit run-wide p95 (0.25 ms histogram) overlay blit/audio/timeline/frame: ${cockpitPerformance?.overlay?.p95Ms ?? 'UNRESOLVED'}/${cockpitPerformance?.audio?.p95Ms ?? 'UNRESOLVED'}/${cockpitPerformance?.timeline?.p95Ms ?? 'UNRESOLVED'}/${cockpitPerformance?.frame?.p95Ms ?? 'UNRESOLVED'} ms`));
    if (this.replayUrl) {
      const replay = element('video', 'ca-preview');
      replay.id = 'communication-analytics-founder-replay';
      replay.controls = true;
      replay.src = this.replayUrl;
      replay.setAttribute('aria-label', 'Local Founder replay for synchronized communication evidence');
      pad.append(replay);
    }
    const actions = element('div', 'ca-actions');
    const again = element('button', 'btnGhost', 'Run another test');
    again.type = 'button';
    again.addEventListener('click', () => {
      if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
      this.replayUrl = null;this.chunks = [];this.lastDiagnostic = {};
      this.completedInstrumentationPerformance = null;this.completedRunReceipt = null;this.completedRunCleanup = null;this.activeRunPlan = null;this.runInterrupted = false;this.runInterruptionCount = 0;this.runInterruptions.length = 0;this.runOpenInterruptions.clear();this.runFirstVisualAtMs = null;this.runLastVisualAtMs = null;this.runVisualFrameCount = 0;
      this.resetInstrumentation();this.pipeline.resetSession();this.render();this.connect();
    });
    const clear = element('button', 'btnGhost', 'Clear test + release devices');
    clear.type = 'button';
    clear.addEventListener('click', () => this.clear());
    actions.append(again, clear);
    pad.append(actions);
    panel.append(pad);
    this.root.append(panel);
    this.overlayUi?.scheduleSync?.();
    panel.focus();
    for (const id of ['communication-analytics-finish', 'communication-analytics-next', 'communication-analytics-skip']) document.getElementById(id)?.setAttribute('disabled', '');
  }

  clear({ render = true } = {}) {
    this.overlayUi?.scheduleSync?.();
    this.connectEpoch += 1;
    this.runEpoch += 1;
    clearInterval(this.timer);
    this.timer = null;
    this.detachRecorder();
    this.chunks = [];
    if (this.replayUrl) URL.revokeObjectURL(this.replayUrl);
    this.replayUrl = null;
    this.lastDiagnostic = {};
    this.completedInstrumentationPerformance = null;
    this.completedRunReceipt = null;
    this.completedRunCleanup = null;
    this.activeRunPlan = null;
    this.runInterrupted = false;
    this.runInterruptionCount = 0;
    this.runInterruptions.length = 0;
    this.runOpenInterruptions.clear();
    this.runFirstVisualAtMs = null;
    this.runLastVisualAtMs = null;
    this.runVisualFrameCount = 0;
    this.lockFounderInstrumentation(false);
    this.resetInstrumentation();
    this.pipeline.resetSession();
    this.state = 'idle';
    if (this.ownsMedia) this.bridge.stopMedia();
    this.ownsMedia = false;
    if (render) this.render();
  }

  onViewChange(view, role) {
    if (view === 'analytics-test' && role === 'admin') return;
    if (this.ownsMedia || this.state !== 'idle' || this.replayUrl) this.clear();
  }

  destroy() {
    this.clear({ render: false });
    this.overlaySettings?.removeEventListener?.('change', this.onOverlaySettingsChange);
  }

  setStatus(state, message, { announce = false } = {}) {
    this.state = state;
    const status = document.getElementById('communication-analytics-status');
    if (status) {
      status.textContent = message;
      status.classList.toggle('ca-error', state === 'denied' || state === 'error');
      status.setAttribute('aria-busy', state === 'requesting' || state === 'finalizing' ? 'true' : 'false');
      status.setAttribute('aria-live', state === 'running' && !announce ? 'off' : 'polite');
    }
    this.updateStartAvailability();
    this.scheduleInstrumentationRender();
  }

  renderDiagnostics() {
    const box = document.getElementById('communication-analytics-diagnostics');
    const toggle = document.getElementById('communication-analytics-show-diagnostics');
    if (!box || !toggle) return;
    box.classList.toggle('ca-hidden', !toggle.checked);
    if (!toggle.checked) return;
    const diagnostics = this.pipeline.diagnostics();
    const audio = this.audioStale ? {} : this.lastDiagnostic.audio || {};
    const vision = this.visionDiagnosticStale ? {} : this.lastDiagnostic.vision || {};
    const voiceDb = audioLevelDb(audio);
    const clipped = clippingFraction(audio);
    const energyVariation = founderEnergyVariationDb(this.audioHistory);
    const protection = founderFaceProtectionStatus(vision, diagnostics);
    const geometry = this.state === 'running' && !this.visionStale
      ? founderOverlayGeometry(vision, { multiFaceProtection: protection.guardReady })
      : null;
    const cockpitPerformance = this.instrumentationPerformance();
    const reliability = diagnostics.workerErrors.length || protection.detectorStatus === 'unavailable'
      ? 'LIMITED'
      : protection.detectorStatus === 'initializing' ? 'WAITING FOR FACE DETECTOR' : diagnostics.workerReady ? 'COLLECTING' : 'UNAVAILABLE';
    box.textContent = [
      `Engine · active ${diagnostics.active} · vision ${this.visionUnavailableReason ? 'UNAVAILABLE' : diagnostics.workerReady ? 'READY' : 'WAITING/UNAVAILABLE'} · ${protection.label} · target ${diagnostics.targetFps} FPS · dropped ${diagnostics.droppedFrames}`,
      `Voice · level ${voiceDb === null ? 'UNAVAILABLE' : voiceDb.toFixed(1) + ' dBFS'} · clipping ${clipped === null ? 'UNAVAILABLE' : (clipped * 100).toFixed(1) + '%'} · detected speech ${audio.speaking ?? 'UNAVAILABLE'} · silence in progress ${Number.isFinite(audio.pauseInProgressMs) ? (audio.pauseInProgressMs / 1000).toFixed(1) + 's' : 'UNAVAILABLE'} · bounded live energy variation ${energyVariation === null ? 'UNAVAILABLE' : energyVariation.toFixed(1) + ' dB IQR'} (last 180 level frames; captured energy only; FOUNDER EXPERIMENTAL) · PITCH UNAVAILABLE WITHOUT VALIDATED F0 INPUT · WPM UNAVAILABLE WITHOUT VALIDATED TRANSCRIPT`,
      `Body · torso ${geometry?.pose?.torsoPresent ?? 'UNAVAILABLE'} · lateral lean ${geometry?.pose?.lateralLeanDeg ?? 'UNAVAILABLE'}° · left hand ${geometry?.hands?.left?.present ?? 'UNAVAILABLE'} (${geometry?.hands?.left?.zone ?? 'UNAVAILABLE'}) · right hand ${geometry?.hands?.right?.present ?? 'UNAVAILABLE'} (${geometry?.hands?.right?.zone ?? 'UNAVAILABLE'})`,
      `Face · present ${geometry?.face?.present ?? 'UNAVAILABLE'} · head yaw/pitch/roll ${geometry?.face?.yawProxyDeg ?? 'UNAVAILABLE'}/${geometry?.face?.pitchProxyDeg ?? 'UNAVAILABLE'}/${geometry?.face?.rollProxyDeg ?? 'UNAVAILABLE'}° · movement rate ${geometry?.face?.movementRatePerSecond ?? 'UNAVAILABLE'} score-change/s · full pipeline ${vision.inferenceMs ?? 'UNAVAILABLE'} ms (face ${vision.faceInferenceMs ?? 'UNAVAILABLE'} ms · Holistic ${vision.holisticInferenceMs ?? 'UNAVAILABLE'} ms) · overlay ${this.visionStale ? 'UNAVAILABLE/STALE' : this.overlayError ? `FAILED (${this.overlayError})` : vision.overlayRequested ? (vision.overlayRendered ? `RENDERED (${vision.overlayPrimitiveCount ?? this.lastOverlayPrimitiveCount ?? 0} transient worker-drawn primitives)` : 'UNAVAILABLE') : 'OFF'}`,
      `Reliability · audio windows ${diagnostics.audioFrameCount} · analyzable visual frames ${diagnostics.visualFrameCount} · ${reliability}`,
      `Run-wide instrumentation cost p95 · overlay blit ${cockpitPerformance.overlay.p95Ms ?? 'UNRESOLVED'} ms · audio ${cockpitPerformance.audio.p95Ms ?? 'UNRESOLVED'} ms · timeline ${cockpitPerformance.timeline.p95Ms ?? 'UNRESOLVED'} ms · full cockpit frame ${cockpitPerformance.frame.p95Ms ?? 'UNRESOLVED'} ms · bounded fixed-memory 0.25 ms histograms`,
      ...(diagnostics.workerErrors.length ? [`Vision limitation · ${diagnostics.workerErrors.at(-1)}`] : []),
      `Privacy · ${diagnostics.networkPolicy}`,
    ].join('\n');
  }
}

export function initializeAnalyticsUi(bridge) {
  const pipeline = new BrowserAnalyticsPipeline({ bridge });
  const founderPipeline = new BrowserAnalyticsPipeline({ bridge });
  const overlaySettings = new LocalOverlaySettings();
  const overlayUi = new OverlayUiController({ bridge, pipeline, settings: overlaySettings });
  const root = document.getElementById('communication-analytics-test-root');
  const founder = root ? new FounderAnalyticsSurface({ root, pipeline: founderPipeline, bridge, overlaySettings, overlayUi }) : null;
  const api = Object.freeze({
    beginAnswer: (options) => { overlayUi.beforeBeginAnswer();return pipeline.beginAnswer(options); },
    prepareEnd: (endAt) => { overlayUi.clearMainOverlay();return pipeline.prepareEnd(endAt); },
    endAnswer: (options) => { const result = pipeline.endAnswer(options);overlayUi.clearMainOverlay();return result; },
    abandonAnswer: (reason) => { const result = pipeline.abandonAnswer(reason);overlayUi.clearMainOverlay();return result; },
    renderStudentResults: renderStudentAnalytics,
    onViewChange: (view, role) => { overlayUi.onViewChange(view, role);founder?.onViewChange(view, role); },
    diagnostics: () => pipeline.diagnostics(),
    persistentEnvelopes: (value) => persistentAnalyticsEnvelopes(value),
    resetSession: () => { overlayUi.clearMainOverlay();return pipeline.resetSession(); },
    releaseRuntime: () => { overlayUi.clearMainOverlay();return pipeline.resetSession(); },
    destroy: () => { founder?.destroy();overlayUi.destroy();founderPipeline.destroy();pipeline.destroy(); },
  });
  window.addEventListener('pagehide', () => { founder?.destroy();overlayUi.destroy();founderPipeline.destroy();pipeline.destroy(); }, { once: true });
  return api;
}
