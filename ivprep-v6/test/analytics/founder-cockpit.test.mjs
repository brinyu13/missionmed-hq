import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  FOUNDER_DIAGNOSTIC_CONTRACT,
  FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS,
  FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS,
  FOUNDER_RUN_MODES,
  FOUNDER_TIMELINE_LEVEL_CAPACITY,
  FounderAnalyticsSurface,
  StudentSurfaceOverlayController,
  appendFounderTimelineTransition,
  boundedFounderHistory,
  createFounderTimingAccumulator,
  founderAudioDiagnosticAvailable,
  founderDiagnosticAtMs,
  founderEnergyVariationDb,
  founderFaceProtectionStatus,
  founderInstrumentationPerformance,
  founderOverlayGeometry,
  founderOverlayDrawRect,
  founderPauseTimelineTransition,
  founderRunClock,
  founderRunPlan,
  founderRunProgress,
  founderRunReceipt,
  founderScalePresentation,
  founderVisionDiagnosticFreshness,
  recordFounderTiming,
  studentSurfaceOverlayContract,
  studentOverlayDrawRect,
} from '../../public/analytics/ui.mjs';

const ROOT = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), 'utf8');

test('Founder offers truthful guided and real-WASM endurance run plans', () => {
  assert.equal(founderRunPlan('guided').targetDurationMs, 125_000);
  assert.equal(founderRunPlan('endurance-10').targetDurationMs, 600_000);
  assert.equal(founderRunPlan('endurance-15').targetDurationMs, 900_000);
  assert.equal(founderRunPlan('endurance-10').requiresCamera, true);
  assert.equal(founderRunPlan('not-a-mode'), FOUNDER_RUN_MODES.guided);
  assert.deepEqual(founderRunProgress('endurance-10', 599_999), {
    modeId: 'endurance-10', elapsedMs: 599_999, remainingMs: 1, targetDurationMs: 600_000, targetReached: false,
  });
  assert.equal(founderRunClock(599_999), '9:59');
  assert.equal(founderRunClock(1, { rounding: 'ceil' }), '0:01');

  const completed = founderRunReceipt({ modeId: 'endurance-10', elapsedMs: 600_000, visualFrameCount: 2_400, firstVisualAtMs: 125, lastVisualAtMs: 599_875 });
  assert.equal(completed.targetCompleted, true);
  assert.equal(completed.realWasmObserved, true);
  assert.equal(completed.minimumVisualFrameCount, 590);
  assert.equal(completed.meaningfulVisualCoverage, true);
  assert.deepEqual(completed.incompleteReasons, []);
  assert.match(completed.summary, /REAL-WASM ENDURANCE TARGET COMPLETE/u);
  const interrupted = founderRunReceipt({ modeId: 'endurance-15', elapsedMs: 900_000, visualFrameCount: 3_000, firstVisualAtMs: 125, lastVisualAtMs: 899_875, interrupted: true, interruptionCount: 1 });
  assert.equal(interrupted.targetCompleted, false);
  assert.match(interrupted.summary, /NOT AN UNINTERRUPTED REAL-WASM PASS/u);
  const early = founderRunReceipt({ modeId: 'endurance-10', elapsedMs: 120_000, visualFrameCount: 400 });
  assert.equal(early.targetCompleted, false);
  assert.match(early.summary, /ENDED EARLY · 2:00 OF 10:00/u);
});

test('Founder endurance receipt requires scheduler-aligned visual coverage, not a token frame', () => {
  assert.equal(FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS, 10_000);
  assert.equal(FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS, 1_000);
  const healthy = founderRunReceipt({
    modeId: 'endurance-10', elapsedMs: 600_000, visualFrameCount: 590,
    firstVisualAtMs: 10_000, lastVisualAtMs: 599_000,
  });
  assert.equal(healthy.targetCompleted, true);
  assert.equal(healthy.visualFrameMinimumMet, true);
  assert.equal(healthy.visualStartedWithinBound, true);
  assert.equal(healthy.visualFreshThroughTarget, true);

  const tokenFrame = founderRunReceipt({
    modeId: 'endurance-10', elapsedMs: 600_000, visualFrameCount: 1,
    firstVisualAtMs: 125, lastVisualAtMs: 125,
  });
  assert.equal(tokenFrame.targetCompleted, false);
  assert.equal(tokenFrame.visualFrameMinimumMet, false);
  assert.equal(tokenFrame.visualFreshThroughTarget, false);
  assert.equal(tokenFrame.visualFrameMinimumRatio, 0.0017);
  assert.match(tokenFrame.incompleteReasons.join(' '), /last analyzable visual frame.*minimum 590 required/u);
  assert.match(tokenFrame.summary, /NOT AN UNINTERRUPTED REAL-WASM PASS.*1 ANALYZABLE VISUAL FRAMES OBSERVED; MINIMUM 590 REQUIRED/u);
});

test('Founder records one visual interruption when a first frame is followed by a silent 10-minute stall', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.state = 'running';
  surface.activeRunPlan = founderRunPlan('endurance-10');
  surface.runInterrupted = false;
  surface.runInterruptionCount = 0;
  surface.runInterruptions = [];
  surface.runOpenInterruptions = new Set();
  surface.runFirstVisualAtMs = 125;
  surface.runLastVisualAtMs = 125;
  surface.visionStale = false;
  surface.visionDiagnosticStale = false;
  surface.visionUnavailableReason = null;
  surface.timelineTransitions = [];
  surface.timelineTransitionAnchors = new Map();
  surface.timelineStates = new Map([['visionAvailable',true],['face',true]]);
  surface.timelineLatestAtMs = 125;
  surface.overlayExpiryTimer = null;
  surface.clearOverlay = () => {};
  surface.renderDiagnostics = () => {};
  surface.scheduleInstrumentationRender = () => {};
  surface.expireVision(1_125, 'vision diagnostics stale — local inference stopped updating');
  surface.consumePipelineState({ state: 'partial', subsystem: 'vision', atMs: 1_125, message: 'vision_worker_unavailable' });
  assert.equal(surface.runInterrupted, true);
  assert.equal(surface.runInterruptionCount, 1);
  assert.equal(surface.runInterruptions[0].atMs, 1_125);
  const receipt = founderRunReceipt({
    modeId: 'endurance-10', elapsedMs: 600_000, interrupted: surface.runInterrupted,
    interruptionCount: surface.runInterruptionCount, visualFrameCount: 1,
    firstVisualAtMs: surface.runFirstVisualAtMs, lastVisualAtMs: surface.runLastVisualAtMs,
  });
  assert.equal(receipt.targetCompleted, false);
  assert.match(receipt.incompleteReasons.join(' '), /1 instrumentation interruption.*minimum 590 required/u);
});

test('Founder treats a fresh-timestamped frame error as an interruption, never visual coverage', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.state = 'running';
  surface.activeRunPlan = founderRunPlan('endurance-10');
  surface.pipeline = { diagnostics: () => ({ faceDetectorStatus: 'ready', multiFaceProtection: true }) };
  surface.lastDiagnostic = {};
  surface.runInterrupted = false;
  surface.runInterruptionCount = 0;
  surface.runInterruptions = [];
  surface.runOpenInterruptions = new Set();
  surface.runFirstVisualAtMs = null;
  surface.runLastVisualAtMs = null;
  surface.runVisualFrameCount = 0;
  surface.visionStale = false;
  surface.visionDiagnosticStale = false;
  surface.visionUnavailableReason = null;
  surface.timelineTransitions = [];
  surface.timelineTransitionAnchors = new Map();
  surface.timelineStates = new Map([['visionAvailable',true]]);
  surface.timelineLatestAtMs = 100;
  surface.overlayExpiryTimer = null;
  surface.clearOverlay = () => {};
  surface.renderDiagnostics = () => {};
  surface.scheduleInstrumentationRender = () => {};
  surface.consumeDiagnostic({ modality: 'vision', atMs: 200, inferenceMs: 50, geometry: null, overlayRendered: false });
  assert.equal(surface.runInterrupted,true);
  assert.equal(surface.runInterruptionCount,1);
  assert.equal(surface.runVisualFrameCount,0);
  assert.equal(surface.runFirstVisualAtMs,null);
  assert.equal(surface.visionStale,true);
  assert.match(surface.visionUnavailableReason,/geometry unavailable/u);
});

test('Founder endurance tick auto-finishes only at the selected session-clock target', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.state = 'running';
  surface.runEpoch = 4;
  surface.startedAt = 1_000;
  surface.activeRunPlan = founderRunPlan('endurance-10');
  surface.renderStep = () => {};
  const reasons = [];
  surface.finish = (reason) => { reasons.push(reason); };
  surface.tickRun(4, 600_999);
  assert.deepEqual(reasons, []);
  surface.tickRun(4, 601_000);
  assert.deepEqual(reasons, ['target_elapsed']);
  surface.tickRun(3, 700_000);
  assert.deepEqual(reasons, ['target_elapsed']);
});

test('Founder completed-run cleanup releases owned media and the local WASM session', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  let resets = 0;let stops = 0;
  const preview = { srcObject: {} };
  surface.pipeline = { resetSession: () => { resets += 1; } };
  surface.bridge = { stopMedia: () => { stops += 1; } };
  surface.ownsMedia = true;
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => id === 'communication-analytics-preview' ? preview : null };
  try {
    assert.equal(surface.releaseCompletedRunResources(), true);
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
  }
  assert.equal(resets, 1);
  assert.equal(stops, 1);
  assert.equal(surface.ownsMedia, false);
  assert.equal(preview.srcObject, null);
});

test('Founder primary lock distinguishes searching, locked with bystanders, unknown, and unavailable', () => {
  const ready = { faceDetectorStatus: 'ready', faceWorkerReady: true, multiFaceProtection: true };
  const detail = (faceCount, state='SEARCHING', bystanderCount=0, primaryAssociated=false) => ({
    modality: 'vision',
    geometry: { faceCount, primaryAssociated },
    primaryLock: { state, bystanderCount, zoneStatus:'primary_inside', continuity: primaryAssociated?'locked':'searching', selectionRequired:false },
  });
  const zero = founderFaceProtectionStatus(detail(0), ready);
  assert.equal(zero.guardReady, false);
  assert.match(zero.label, /FACE COUNT 0.*NO PERSON DETECTED.*SUPPRESSED/u);
  const one = founderFaceProtectionStatus(detail(1,'PRIMARY_LOCKED',0,true), ready);
  assert.equal(one.guardReady, true);
  assert.equal(one.label, 'PRIMARY INTERVIEWEE LOCKED · NO BYSTANDER PRESENT');
  const multiple = founderFaceProtectionStatus(detail(3,'PRIMARY_LOCKED',2,true), ready);
  assert.equal(multiple.guardReady, true);
  assert.match(multiple.label, /PRIMARY INTERVIEWEE LOCKED · 2 BYSTANDERS EXCLUDED · PERSON-SPECIFIC ANALYTICS CONTINUE/u);
  const unknown = founderFaceProtectionStatus(detail(null), ready);
  assert.equal(unknown.faceCount, null);
  assert.match(unknown.label, /FACE COUNT UNKNOWN.*SUPPRESSED/u);
  const unavailable = founderFaceProtectionStatus(detail(1), { faceDetectorStatus: 'unavailable', faceWorkerReady: false, multiFaceProtection: false });
  assert.equal(unavailable.guardReady, false);
  assert.match(unavailable.label, /FACE DETECTOR UNAVAILABLE.*FACE COUNT UNKNOWN.*SUPPRESSED/u);
  const initializing = founderFaceProtectionStatus(detail(1), { faceDetectorStatus: 'initializing', faceWorkerReady: false, multiFaceProtection: false });
  assert.equal(initializing.guardReady, false);
  assert.match(initializing.label, /INITIALIZING.*PENDING GUARD/u);
});

test('Founder live tracking status keeps the primary active while bystanders are excluded', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.state = 'running';
  surface.visionUnavailableReason = null;
  surface.lastDiagnostic = { vision: { geometry: { faceCount: 2, primaryAssociated:true }, primaryLock:{state:'PRIMARY_LOCKED',bystanderCount:1,continuity:'locked_bystander_excluded'}, live: {} } };
  surface.lastTrackingSummary = '';
  const status = { textContent: '' };
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => id === 'communication-analytics-tracking-status' ? status : null };
  try {
    const diagnostics = { workerReady: true, faceDetectorStatus: 'ready', faceWorkerReady: true, multiFaceProtection: true, targetFps: 8, droppedFrames: 0 };
    const protection = founderFaceProtectionStatus(surface.lastDiagnostic.vision, diagnostics);
    surface.renderTrackingStatus(diagnostics, null, protection);
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
  }
  assert.match(status.textContent, /PRIMARY INTERVIEWEE LOCKED · 1 BYSTANDER EXCLUDED · PERSON-SPECIFIC ANALYTICS CONTINUE/u);
  assert.doesNotMatch(status.textContent, /SUPPRESSED/u);
});

test('Founder live energy variation is a bounded experimental IQR', () => {
  assert.equal(founderEnergyVariationDb([{ db: -60 }, { db: -50 }, { db: -40 }, { db: -30 }]), 15);
  assert.equal(founderEnergyVariationDb([{ db: -30 }, { db: -30 }, { db: -30 }]), null);
  const history = [{ db: -160 }, ...Array.from({ length: 180 }, () => ({ db: -30 }))];
  assert.equal(founderEnergyVariationDb(history), 0);
});

test('Founder timeline accepts only finite non-negative session-clock timestamps', () => {
  assert.equal(founderDiagnosticAtMs({ atMs: 12.6 }), 13);
  assert.equal(founderDiagnosticAtMs({ atMs: 0 }), 0);
  for (const atMs of [undefined, null, -1, Number.NaN, Number.POSITIVE_INFINITY, '12']) {
    assert.equal(founderDiagnosticAtMs({ atMs }), null);
  }
  assert.match(FOUNDER_DIAGNOSTIC_CONTRACT.clock, /finite, non-negative atMs/u);
});

test('Founder live histories are deterministically bounded and evict oldest values', () => {
  const history = [];
  for (let value = 0; value < 8; value += 1) boundedFounderHistory(history, value, 3);
  assert.deepEqual(history, [5, 6, 7]);
  assert.throws(() => boundedFounderHistory([], 1, 0), TypeError);
  assert.throws(() => boundedFounderHistory({}, 1, 3), TypeError);
});

test('Founder pause timeline backdates a qualifying pause to the observed silence onset', () => {
  assert.deepEqual(founderPauseTimelineTransition({ atMs: 5_000, pauseInProgressMs: 4_000 }), { active: true, atMs: 1_000 });
  assert.deepEqual(founderPauseTimelineTransition({ atMs: 5_050, pauseInProgressMs: 0 }), { active: false, atMs: 5_050 });
  assert.equal(founderPauseTimelineTransition({ atMs: 5_000 }), null);
});

test('Founder timeline retains a true 30-second level window and anchors evicted active rows', () => {
  const levels = [];
  for (let index = 0; index <= 700; index += 1) boundedFounderHistory(levels, { atMs: index * 50, db: -30 }, FOUNDER_TIMELINE_LEVEL_CAPACITY);
  const visible = levels.filter((sample) => sample.atMs >= 5_000 && sample.atMs <= 35_000);
  assert.equal(levels.length, FOUNDER_TIMELINE_LEVEL_CAPACITY);
  assert.equal(visible.length, 601);
  assert.equal(visible[0].atMs, 5_000);
  assert.equal(visible.at(-1).atMs, 35_000);

  const transitions = [];
  const anchors = new Map();
  appendFounderTimelineTransition(transitions, anchors, { key: 'face', active: true, atMs: 0 }, 3);
  appendFounderTimelineTransition(transitions, anchors, { key: 'speech', active: true, atMs: 1 }, 3);
  appendFounderTimelineTransition(transitions, anchors, { key: 'speech', active: false, atMs: 2 }, 3);
  appendFounderTimelineTransition(transitions, anchors, { key: 'speech', active: true, atMs: 3 }, 3);
  assert.deepEqual(anchors.get('face'), { key: 'face', active: true, atMs: 0 });
});

test('Founder audio diagnostics fail closed when the pipeline marks the microphone unavailable', () => {
  assert.equal(founderAudioDiagnosticAvailable({ modality: 'audio', atMs: 10, available: true, rms: 0.1 }), true);
  assert.equal(founderAudioDiagnosticAvailable({ modality: 'audio', atMs: 20, available: false }), false);
  assert.equal(founderAudioDiagnosticAvailable({ modality: 'audio', available: true }), false);
});

test('Founder silent vision expiry closes active visual rows and changes READY to unavailable', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.visionStale = false;
  surface.visionUnavailableReason = null;
  surface.timelineTransitions = [];
  surface.timelineTransitionAnchors = new Map();
  surface.timelineStates = new Map([
    ['visionAvailable', true], ['face', true], ['leftHand', true], ['gesture', true], ['head', true], ['posture', true], ['framing', true],
  ]);
  surface.timelineLatestAtMs = 250;
  surface.overlayExpiryTimer = null;
  let cleared = 0;let rendered = 0;let diagnosticsRendered = 0;
  surface.clearOverlay = () => { cleared += 1; };
  surface.renderDiagnostics = () => { diagnosticsRendered += 1; };
  surface.scheduleInstrumentationRender = () => { rendered += 1; };
  surface.expireVision(1_250, 'vision diagnostics stale');
  assert.equal(surface.visionStale, true);
  assert.equal(surface.visionUnavailableReason, 'vision diagnostics stale');
  assert.equal(surface.timelineLatestAtMs, 1_250);
  for (const key of ['visionAvailable', 'face', 'leftHand', 'gesture', 'head', 'posture', 'framing']) assert.equal(surface.timelineStates.get(key), false);
  assert.equal(cleared, 1);
  assert.equal(rendered, 1);
  assert.equal(diagnosticsRendered, 1);
});

test('a late vision result cannot redraw or reopen stale rows, while a later fresh frame can recover', () => {
  assert.deepEqual(founderVisionDiagnosticFreshness({ atMs: 250, inferenceMs: 1_500 }), {
    fresh: false, atMs: 250, inferenceMs: 1_500, staleAtMs: 1_250, remainingMs: 0,
  });
  assert.deepEqual(founderVisionDiagnosticFreshness({ atMs: 2_000, inferenceMs: 50 }), {
    fresh: true, atMs: 2_000, inferenceMs: 50, staleAtMs: null, remainingMs: 950,
  });
  assert.equal(founderVisionDiagnosticFreshness({ atMs: 2_000, inferenceMs: 900 }).remainingMs, 100);
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.state = 'idle';
  surface.pipeline = { diagnostics: () => ({ multiFaceProtection: true }) };
  surface.lastDiagnostic = {};
  surface.visionStale = true;
  surface.visionUnavailableReason = 'prior stall';
  surface.timelineTransitions = [];
  surface.timelineTransitionAnchors = new Map();
  surface.timelineStates = new Map([['visionAvailable', false], ['face', false]]);
  surface.timelineLatestAtMs = 1_250;
  surface.overlayExpiryTimer = null;
  surface.clearOverlay = () => {};
  surface.renderDiagnostics = () => {};
  surface.scheduleInstrumentationRender = () => {};
  const geometry = { faceCount: 1, primaryAssociated:true, face: { present: true }, pose: { torsoPresent: false }, hands: {} };
  const primaryLock={state:'PRIMARY_LOCKED',bystanderCount:0,selectionRequired:false};
  surface.consumeDiagnostic({ modality: 'vision', atMs: 250, inferenceMs: 1_500, geometry, primaryLock, overlayRendered: true });
  assert.equal(surface.timelineStates.get('visionAvailable'), false);
  assert.equal(surface.timelineStates.get('face'), false);
  assert.match(surface.visionUnavailableReason, /stale/u);

  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: () => null };
  try {
    surface.consumeDiagnostic({ modality: 'vision', atMs: 2_000, inferenceMs: 50, geometry, primaryLock, live: {}, overlayRendered: false });
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
  }
  assert.equal(surface.timelineStates.get('visionAvailable'), true);
  assert.equal(surface.timelineStates.get('face'), true);
  assert.equal(surface.visionUnavailableReason, null);
  assert.ok(surface.timelineTransitions.filter((item) => item.active).every((item) => item.atMs === 2_000));

  let draws = 0;let clears = 0;
  surface.state = 'running';
  surface.drawOverlayBitmap = () => { draws += 1; };
  surface.clearOverlay = () => { clears += 1; };
  globalThis.document = { getElementById: () => ({ checked: true }) };
  try {
    surface.consumeOverlay({ bitmap: {}, geometry, primaryLock, atMs: 250, pipelineMs: 1_500 });
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
  }
  assert.equal(draws, 0);
  assert.equal(clears, 1);
});

test('a near-stale vision result receives only its remaining live-display budget', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.state = 'running';
  surface.pipeline = { diagnostics: () => ({ multiFaceProtection: true }) };
  surface.lastDiagnostic = {};
  surface.visionStale = true;
  surface.visionUnavailableReason = null;
  surface.timelineTransitions = [];
  surface.timelineTransitionAnchors = new Map();
  surface.timelineStates = new Map();
  surface.timelineLatestAtMs = null;
  surface.overlayExpiryTimer = null;
  surface.clearOverlay = () => {};
  surface.renderDiagnostics = () => {};
  surface.scheduleInstrumentationRender = () => {};
  const geometry = { faceCount: 1, primaryAssociated:true, face: { present: true }, pose: { torsoPresent: false }, hands: {} };
  const primaryLock={state:'PRIMARY_LOCKED',bystanderCount:0,selectionRequired:false};
  const priorDocument = globalThis.document;
  const priorSetTimeout = globalThis.setTimeout;
  let scheduledDelay = null;
  globalThis.document = { getElementById: () => ({ checked: true }) };
  globalThis.setTimeout = (_callback, delay) => { scheduledDelay = delay;return 1; };
  try {
    surface.consumeDiagnostic({ modality: 'vision', atMs: 2_000, inferenceMs: 900, geometry, primaryLock, live: {}, overlayRendered: true });
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
    globalThis.setTimeout = priorSetTimeout;
  }
  assert.equal(scheduledDelay, 100);
});

test('fresh bystander exclusion remains explicit for one second, then expires to unknown', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.state = 'running';
  surface.pipeline = { diagnostics: () => ({ faceDetectorStatus: 'ready', faceWorkerReady: true, multiFaceProtection: true }) };
  surface.lastDiagnostic = {};
  surface.visionStale = true;
  surface.visionDiagnosticStale = true;
  surface.visionUnavailableReason = 'prior stall';
  surface.timelineTransitions = [];
  surface.timelineTransitionAnchors = new Map();
  surface.timelineStates = new Map();
  surface.timelineLatestAtMs = null;
  surface.overlayExpiryTimer = null;
  surface.clearOverlay = () => {};
  surface.renderDiagnostics = () => {};
  surface.scheduleInstrumentationRender = () => {};
  const priorDocument = globalThis.document;
  const priorSetTimeout = globalThis.setTimeout;
  let expiry = null;let scheduledDelay = null;
  globalThis.document = { getElementById: () => ({ checked: true }) };
  globalThis.setTimeout = (callback, delay) => { expiry = callback;scheduledDelay = delay;return 1; };
  try {
    surface.consumeDiagnostic({ modality: 'vision', atMs: 2_000, inferenceMs: 50, geometry: { faceCount: 2, primaryAssociated:true, face: { present: true }, pose: {}, hands: {} }, primaryLock:{state:'PRIMARY_LOCKED',bystanderCount:1,continuity:'locked_bystander_excluded',selectionRequired:false}, live: {}, overlayRendered: false });
    assert.equal(surface.visionDiagnosticStale, false);
    assert.equal(surface.visionUnavailableReason, null);
    assert.equal(scheduledDelay, 950);
    assert.match(founderFaceProtectionStatus(surface.lastDiagnostic.vision, surface.pipeline.diagnostics()).label, /1 BYSTANDER EXCLUDED.*ANALYTICS CONTINUE/u);
    expiry();
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
    globalThis.setTimeout = priorSetTimeout;
  }
  assert.equal(surface.visionDiagnosticStale, true);
  assert.match(surface.visionUnavailableReason, /stale/u);
  assert.match(founderFaceProtectionStatus({}, surface.pipeline.diagnostics()).label, /FACE COUNT UNKNOWN.*SUPPRESSED/u);
});

test('Founder scale copy preserves actual out-of-range values while bounding only the marker', () => {
  assert.deepEqual(founderScalePresentation(52, -45, 45, '°', 1), {
    available: true, bounded: 45, text: '52.0° — ABOVE 45.0° DISPLAY RANGE',
  });
  assert.deepEqual(founderScalePresentation(-100, -80, 0, ' dBFS', 1), {
    available: true, bounded: -80, text: '-100.0 dBFS — BELOW -80.0 dBFS DISPLAY RANGE',
  });
  assert.deepEqual(founderScalePresentation(1.2, 0, 1, '', 2, { allowOutOfRange: false }), {
    available: false, bounded: null, text: 'UNAVAILABLE',
  });
});

test('Founder person-specific geometry fails closed without primary association and accepts bystanders with the same primary', () => {
  const geometry = { faceCount: 1, primaryAssociated:true, face: { present: true }, pose: {}, hands: {} };
  const detail = { modality: 'vision', geometry, primaryLock:{state:'PRIMARY_LOCKED'} };
  assert.equal(founderOverlayGeometry(detail), null);
  assert.equal(founderOverlayGeometry(detail, { multiFaceProtection: false }), null);
  assert.equal(founderOverlayGeometry({ ...detail, geometry: { ...geometry, faceCount: 0, primaryAssociated:false } }, { multiFaceProtection: true }), null);
  const bystanderGeometry={...geometry,faceCount:2};
  assert.equal(founderOverlayGeometry({ ...detail, geometry: bystanderGeometry }, { multiFaceProtection: true }), bystanderGeometry);
  assert.equal(founderOverlayGeometry({ modality: 'audio', geometry }, { multiFaceProtection: true }), null);
  assert.equal(founderOverlayGeometry(detail, { multiFaceProtection: true }), geometry);
});

test('G/H: the operational overlay stays on the actual student surface through swap, mirror, playback, and independent toggles',()=>{
  class FakeNode{
    constructor(tag='div'){
      this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.style={};this.dataset={};this.attributes=new Map();this.listeners=new Map();this._classes=new Set();this._className='';
      this.clientWidth=640;this.clientHeight=360;this.videoWidth=640;this.videoHeight=360;this.readyState=4;this.paused=true;this.ended=false;this.width=0;this.height=0;
      this.context={clears:0,draws:[],clearRect:()=>{this.context.clears+=1},drawImage:(...args)=>this.context.draws.push(args)};
      this.classList={add:(...names)=>{names.forEach((name)=>this._classes.add(name));this._className=[...this._classes].join(' ')},remove:(...names)=>{names.forEach((name)=>this._classes.delete(name));this._className=[...this._classes].join(' ')},contains:(name)=>this._classes.has(name),toggle:(name,force)=>{const next=force===undefined?!this._classes.has(name):Boolean(force);if(next)this._classes.add(name);else this._classes.delete(name);this._className=[...this._classes].join(' ');return next}};
    }
    set className(value){this._className=String(value);this._classes=new Set(this._className.split(/\s+/u).filter(Boolean))}
    get className(){return this._className}
    get nextSibling(){if(!this.parentNode)return null;const index=this.parentNode.children.indexOf(this);return this.parentNode.children[index+1]||null}
    append(...nodes){for(const node of nodes){node.remove?.();node.parentNode=this;this.children.push(node)}}
    insertBefore(node,reference){node.remove?.();node.parentNode=this;const index=reference?this.children.indexOf(reference):-1;if(index<0)this.children.push(node);else this.children.splice(index,0,node)}
    remove(){if(!this.parentNode)return;const index=this.parentNode.children.indexOf(this);if(index>=0)this.parentNode.children.splice(index,1);this.parentNode=null}
    setAttribute(name,value){this.attributes.set(name,String(value))}
    getAttribute(name){return this.attributes.get(name)??null}
    addEventListener(type,listener){const items=this.listeners.get(type)||[];items.push(listener);this.listeners.set(type,items)}
    removeEventListener(type,listener){this.listeners.set(type,(this.listeners.get(type)||[]).filter((item)=>item!==listener))}
    dispatch(type){for(const listener of this.listeners.get(type)||[])listener({type,stopPropagation(){}})}
    querySelector(selector){const match=/^\[data-overlay-control="([^"]+)"\]$/u.exec(selector);if(match&&this.dataset.overlayControl===match[1])return this;for(const child of this.children){const found=child.querySelector?.(selector);if(found)return found}return null}
    getContext(type){return this.tagName==='CANVAS'&&type==='2d'?this.context:null}
  }
  const nodes=new Map();
  const register=(id,tag='div')=>{const node=new FakeNode(tag);node.id=id;nodes.set(id,node);return node};
  const documentRef={createElement:(tag)=>new FakeNode(tag),getElementById:(id)=>nodes.get(id)||null,defaultView:{getComputedStyle:(node)=>({transform:node.style.transform||'none'})}};
  const meetwrap=register('meetwrap');meetwrap.classList.add('mp-zoom');
  const room=register('roomstage');const self=register('selfpip');const live=register('pipvid','video');live.style.transform='scaleX(-1)';
  meetwrap.append(room);room.append(self);self.append(live);
  const resultPanel=new FakeNode('div');const playback=register('playback','video');resultPanel.append(playback);
  const pipeline=()=>({
    active:false,instrumentation:[],consumer:null,starts:[],stops:[],
    setInstrumentation(options){this.instrumentation.push(options)},setOverlayConsumer(consumer){this.consumer=consumer},diagnostics(){return{active:this.active}},
    beginPlayback(options){this.active=true;this.starts.push(options)},endPlayback(reason){const prior=this.active;this.active=false;this.stops.push(reason);return prior},
  });
  const livePipeline=pipeline();const playbackPipeline=pipeline();
  const controller=new StudentSurfaceOverlayController({pipeline:livePipeline,playbackPipeline,documentRef,scheduleMicrotask:(callback)=>callback()});
  controller.onViewChange('room','admin');
  assert.equal(controller.mode,null);
  const denied=controller.configure({authorized:false,enabled:true,face:true,bodyHands:true});
  assert.equal(denied.active,false);
  assert.equal(controller.mode,null);
  const policy=controller.configure({authorized:true,enabled:true,face:true,bodyHands:false,studentPrimary:true});
  assert.equal(policy.active,true);
  assert.equal(room.classList.contains('ca-student-primary'),true);
  assert.equal(controller.overlay.parentNode,self);
  assert.deepEqual(controller.overlay.dataset,{overlayLayer:'student-analytics',anchorSurface:'pipvid',layoutMode:'zoom',studentLayoutRole:'primary',playback:'false'});
  assert.equal(controller.overlay.style.transform,'scaleX(-1)');
  assert.deepEqual(livePipeline.instrumentation.at(-1),{overlayEnabled:true,faceOverlayEnabled:true,bodyHandsOverlayEnabled:false});
  controller.toggleOverlayPart('bodyHands');
  assert.deepEqual(livePipeline.instrumentation.at(-1),{overlayEnabled:true,faceOverlayEnabled:true,bodyHandsOverlayEnabled:true});
  const bitmap={width:480,height:270};
  assert.equal(controller.consumeOverlay({bitmap},'live'),true);
  assert.equal(controller.overlay.context.draws.length,1);
  const liveOverlay=controller.overlay;
  assert.equal(controller.toggleStudentPrimary(),true);
  assert.equal(room.classList.contains('ca-student-primary'),false);
  assert.equal(controller.overlay,liveOverlay);
  assert.equal(controller.overlay.dataset.studentLayoutRole,'inset');
  live.style.transform='scaleX(1)';controller.syncSurfaceContract();
  assert.equal(controller.overlay.style.transform,'none');

  controller.onViewChange('results','student');
  assert.equal(controller.mode,'playback');
  assert.equal(playback.parentNode,controller.playbackWrapper);
  assert.equal(controller.overlay.dataset.anchorSurface,'playback');
  assert.equal(controller.overlay.dataset.playback,'true');
  playback.paused=false;playback.dispatch('play');
  assert.equal(playbackPipeline.starts.length,1);
  assert.equal(playbackPipeline.starts[0].videoElement,playback);
  assert.equal(controller.consumeOverlay({bitmap},'playback'),true);
  playback.dispatch('seeking');
  assert.equal(playbackPipeline.active,false);
  playback.dispatch('seeked');
  assert.equal(playbackPipeline.starts.length,2);
  assert.equal(playbackPipeline.active,true);
  playback.paused=true;playback.dispatch('pause');
  assert.equal(playbackPipeline.active,false);
  assert.ok(playbackPipeline.stops.includes('playback_paused'));
  controller.destroy();
  assert.equal(playback.parentNode,resultPanel);
  assert.equal(livePipeline.consumer,null);
  assert.equal(playbackPipeline.consumer,null);
});

test('student overlay geometry cover-fits worker bitmaps without exposing coordinates',()=>{
  assert.deepEqual(studentOverlayDrawRect(480,270,480,270),{width:480,height:270,left:0,top:0});
  assert.deepEqual(studentOverlayDrawRect(360,270,480,270),{width:480,height:360,left:0,top:-45});
  assert.equal(studentSurfaceOverlayContract({layoutMode:'teams',playback:true}).remainsStudentAnchored,true);
});

test('Founder overlay letterboxes to the same source aspect as the contain-fit preview', () => {
  assert.deepEqual(founderOverlayDrawRect(480, 270, 480, 270), { width: 480, height: 270, left: 0, top: 0 });
  assert.deepEqual(founderOverlayDrawRect(360, 270, 480, 270), { width: 360, height: 270, left: 60, top: 0 });
  assert.deepEqual(founderOverlayDrawRect(152, 270, 480, 270), { width: 152, height: 270, left: 164, top: 0 });
});

test('Founder cockpit is default-on, accessible, and does not enter the student renderer', async () => {
  const source = await read('public/analytics/ui.mjs');
  assert.match(source, /runMode\.id = 'communication-analytics-run-mode'/u);
  for (const mode of ['guided', 'endurance-10', 'endurance-15']) assert.match(source, new RegExp(`'${mode}'`, 'u'));
  assert.match(source, /plan\.requiresCamera && !this\.cameraIsLive\(\)/u);
  assert.match(source, /this\.timer = setInterval\(\(\) => this\.tickRun\(runEpoch\), 250\)/u);
  assert.match(source, /this\.lockFounderInstrumentation\(plan\.endurance\)/u);
  assert.match(source, /clearInterval\(this\.timer\)/u);
  for (const id of ['show-overlay', 'show-gauges', 'show-audio', 'show-timeline', 'show-face-overlay', 'show-body-hands-overlay']) {
    assert.match(source, new RegExp(`\\['communication-analytics-${id}'`, 'u'));
  }
  assert.match(source, /function toggleControl\(id, text, checked = true\)/u);
  assert.match(source, /overlay\.id = 'communication-analytics-overlay'/u);
  assert.match(source, /overlay\.setAttribute\('aria-hidden', 'true'\)/u);
  assert.match(source, /overlay\.dataset\.anchorSurface = preview\.id/u);
  assert.match(source, /LOCK TO ME \/ RESELECT PRIMARY/u);
  assert.match(source, /tracking\.setAttribute\('role', 'status'\)/u);
  assert.match(source, /audioCanvas\.setAttribute\('role', 'img'\)/u);
  assert.match(source, /timelineCanvas\.setAttribute\('role', 'img'\)/u);
  assert.match(source, /UNAVAILABLE — NO VALIDATED F0 INPUT/u);
  assert.match(source, /TRANSCRIPT REQUIRED — UNAVAILABLE IN LIVE COCKPIT/u);
  assert.match(source, /energy_variation_db.*FOUNDER EXPERIMENTAL/su);
  assert.match(source, /Engine · active \$\{diagnostics\.active\}[\s\S]*\$\{protection\.label\}/u);
  const publicApi = source.slice(source.indexOf('export function initializeAnalyticsUi'));
  assert.doesNotMatch(publicApi, /configureStudentOverlay/u);
  const studentRenderer = source.slice(source.indexOf('export function renderStudentAnalytics'), source.indexOf('class FounderAnalyticsSurface'));
  assert.doesNotMatch(studentRenderer, /founder-cockpit|tracking-overlay|live-timeline/iu);
  assert.doesNotMatch(studentRenderer, /energy_variation_db/iu);
  const founderSurface = source.slice(source.indexOf('export class FounderAnalyticsSurface'));
  assert.doesNotMatch(founderSurface, /console\./u);
});

test('overlay consumes only a transient worker-rendered bitmap and never landmark coordinates', async () => {
  const source = await read('public/analytics/ui.mjs');
  assert.match(source, /pipeline\.setInstrumentation\?\.\(\{ overlayEnabled: Boolean\(enabled\), faceOverlayEnabled, bodyHandsOverlayEnabled \}\)/u);
  assert.match(source, /pipeline\.setOverlayConsumer\?\.\(\(payload\) => this\.consumeOverlay\(payload\)\)/u);
  assert.match(source, /this\.drawOverlayBitmap\(bitmap\)/u);
  assert.match(source, /context\.drawImage\(bitmap, rect\.left, rect\.top, rect\.width, rect\.height\)/u);
  assert.doesNotMatch(source, /overlayVectors|Float32Array|faceMesh/u);
  assert.match(source, /this\.lastDiagnostic\[modality\] = detail/u);
  assert.doesNotMatch(source, /faceLandmarks|poseLandmarks|handLandmarks/u);
});

test('Founder audio and timeline instrumentation are bounded, truthful, and cleaned up', async () => {
  const source = await read('public/analytics/ui.mjs');
  assert.match(source, /const MAX_AUDIO_HISTORY = 180/u);
  assert.match(source, /const MAX_TIMELINE_TRANSITIONS = 4_800/u);
  assert.match(source, /FOUNDER_TIMELINE_LEVEL_CAPACITY = 640/u);
  assert.match(source, /createFounderTimingAccumulator/u);
  assert.match(source, /const LIVE_TIMELINE_WINDOW_MS = 30_000/u);
  assert.match(source, /\{ atMs, db, peak, clipping \}, MAX_AUDIO_HISTORY/u);
  assert.match(source, /AWAITING TIMESTAMPED DIAGNOSTICS — NO SYNCHRONIZED EVENTS SHOWN/u);
  assert.match(source, /cancelAnimationFrame\(this\.instrumentationFrame\)/u);
  assert.match(source, /clearTimeout\(this\.overlayExpiryTimer\)/u);
  assert.match(source, /this\.audioHistory\.length = 0/u);
  assert.match(source, /this\.timelineTransitions\.length = 0/u);
  assert.match(source, /this\.timelineTransitionAnchors\.clear\(\)/u);
  assert.match(source, /this\.timelineLevels\.length = 0/u);
  assert.match(source, /this\.timelineStates\.clear\(\)/u);
  for (const label of ['AUDIO DATA', 'SPEECH', 'SILENCE', 'PAUSE', 'CLIP', 'LEVEL', 'VISION DATA', 'FACE', 'L HAND', 'R HAND', 'GESTURE', 'HEAD', 'POSTURE', 'FRAMING']) assert.match(source, new RegExp(`'${label}'`, 'u'));
  assert.match(source, /Vision limitation · \$\{diagnostics\.workerErrors\.at\(-1\)\}/u);
});

test('Founder instrumentation cost summaries are bounded and deterministic', () => {
  const summary = founderInstrumentationPerformance({
    overlay: [1, 2, 3, 4, 5],
    audio: [0.2, 0.5],
    timeline: [],
    frame: [10, 20, 30, 40, 50],
  });
  assert.deepEqual(summary.overlay, { samples: 5, p95Ms: 5, maxMs: 5 });
  assert.deepEqual(summary.audio, { samples: 2, p95Ms: 0.5, maxMs: 0.5 });
  assert.deepEqual(summary.timeline, { samples: 0, p95Ms: null, maxMs: null });
  assert.deepEqual(summary.frame, { samples: 5, p95Ms: 50, maxMs: 50 });
});

test('Founder run-wide p95 retains early jank instead of reporting only a low tail', () => {
  const frame = createFounderTimingAccumulator();
  for (let index = 0; index < 120; index += 1) recordFounderTiming(frame, 100);
  for (let index = 0; index < 240; index += 1) recordFounderTiming(frame, 1);
  const summary = founderInstrumentationPerformance({ frame });
  assert.deepEqual(summary.frame, { samples: 360, p95Ms: 100, maxMs: 100 });
  const bucketCount = frame.buckets.length;
  const bounded = createFounderTimingAccumulator();
  for (let index = 0; index < 1_000_000; index += 1) recordFounderTiming(bounded, index % 2 ? 1 : 50);
  assert.equal(bounded.buckets.length, bucketCount);
  assert.equal(founderInstrumentationPerformance({ frame: bounded }).frame.samples, 1_000_000);
});

test('Founder cockpit stylesheet layers the real canvas over preview and remains responsive', async () => {
  const css = await read('public/analytics/analytics.css');
  assert.match(css, /\.ca-preview-stage\{position:relative/u);
  assert.match(css, /\.ca-tracking-overlay\{position:absolute;inset:0;width:100%;height:100%;pointer-events:none/u);
  assert.match(css, /\.ca-student-surface-overlay\{position:absolute;inset:0;width:100%;height:100%;pointer-events:none/u);
  assert.match(css, /\.roomstage\.ca-student-primary #selfpip\{inset:4%!important/u);
  assert.match(css, /\.roomstage\.ca-student-primary #ivtile\{inset:auto 14px 14px auto/u);
  assert.match(css, /\.ca-instrument-grid\{display:grid/u);
  assert.match(css, /\.ca-run-config\{display:grid/u);
  assert.match(css, /\.ca-run-(?:complete|limited)/u);
  assert.ok(css.includes('@media(max-width:1024px){.ca-grid{grid-template-columns:1fr}.ca-instrument-grid{grid-template-columns:1fr}'));
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/u);
});
