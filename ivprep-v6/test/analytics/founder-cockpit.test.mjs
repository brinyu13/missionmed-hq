import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnalyticsSession } from '../../analytics/analytics-session.mjs';
import {
  FOUNDER_DIAGNOSTIC_CONTRACT,
  FOUNDER_ENDURANCE_STARTUP_ALLOWANCE_MS,
  FOUNDER_ENDURANCE_VISUAL_FRESHNESS_MS,
  FOUNDER_RUN_MODES,
  FOUNDER_TIMELINE_LEVEL_CAPACITY,
  FounderAnalyticsSurface,
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
  founderPostRunReport,
  founderRunClock,
  founderRunPlan,
  founderRunProgress,
  founderRunReceipt,
  founderScalePresentation,
  founderVisionDiagnosticFreshness,
  recordFounderTiming,
} from '../../public/analytics/ui.mjs';

const ROOT = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), 'utf8');

function reportEvent(metric, value, {
  startMs = 0, endMs = 10_000, unit = null, input = 'camera',
  reliability = 'high', coverage = 0.9, sampleCount = 72,
  limitations = [], qualifiers = [], maturity = 'FOUNDER_EXPERIMENTAL',
} = {}) {
  return {
    metric, startMs, endMs, durationMs: endMs - startMs,
    source: { input }, observation: { value, unit, qualifiers },
    quality: { reliability, coverage, sampleCount, limitations }, maturity,
  };
}

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

test('Founder endurance latches one canvas blit interruption while analytics and later overlay frames continue', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.state = 'running';
  surface.activeRunPlan = founderRunPlan('endurance-10');
  surface.pipeline = {
    diagnostics: () => ({ faceDetectorStatus: 'ready', faceWorkerReady: true, multiFaceProtection: true }),
    session: { clock: { sessionMs: () => 275 } },
  };
  surface.runInterrupted = false;
  surface.runInterruptionCount = 0;
  surface.runInterruptions = [];
  surface.runOpenInterruptions = new Set();
  surface.runVisualFrameCount = 590;
  surface.timelineLatestAtMs = 200;
  surface.lastOverlayPrimitiveCount = 0;
  let drawShouldFail = true;
  let drawCount = 0;
  let clearCount = 0;
  surface.drawOverlayBitmap = () => {
    drawCount += 1;
    if (drawShouldFail) throw new Error('synthetic founder canvas blit failure');
  };
  surface.clearOverlay = () => { clearCount += 1; };
  const geometry = { faceCount: 1, face: { present: true }, pose: {}, hands: {} };
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: () => ({ checked: true }) };
  try {
    assert.doesNotThrow(() => surface.consumeOverlay({ bitmap: {}, geometry, atMs: 250.4, pipelineMs: 25 }));
    assert.doesNotThrow(() => surface.consumeOverlay({ bitmap: {}, geometry, atMs: 260, pipelineMs: 25 }));
    drawShouldFail = false;
    assert.doesNotThrow(() => surface.consumeOverlay({ bitmap: {}, geometry, atMs: 300, primitiveCount: 12, pipelineMs: 25 }));
  } finally {
    if (priorDocument === undefined) delete globalThis.document;
    else globalThis.document = priorDocument;
  }

  assert.equal(drawCount, 3);
  assert.equal(clearCount, 2);
  assert.equal(surface.state, 'running');
  assert.equal(surface.runVisualFrameCount, 590, 'display-only failure must not alter analytics coverage');
  assert.equal(surface.runInterrupted, true);
  assert.equal(surface.runInterruptionCount, 1);
  assert.equal(surface.runInterruptions.length, 1);
  assert.deepEqual(surface.runInterruptions[0], {
    atMs: 250,
    subsystem: 'overlay-display',
    message: 'Founder overlay canvas drawing failed; analytics continued.',
  });
  assert.equal(Number.isFinite(surface.runInterruptions[0].atMs), true);
  assert.equal(surface.runOpenInterruptions.has('overlay-display'), true);
  assert.equal(surface.overlayError, null, 'a later successful draw clears the display error only');
  assert.equal(surface.lastOverlayPrimitiveCount, 12);

  const receipt = founderRunReceipt({
    modeId: 'endurance-10', elapsedMs: 600_000,
    interrupted: surface.runInterrupted, interruptionCount: surface.runInterruptionCount,
    visualFrameCount: surface.runVisualFrameCount, firstVisualAtMs: 10_000, lastVisualAtMs: 599_000,
  });
  assert.equal(receipt.targetCompleted, false);
  assert.match(receipt.incompleteReasons.join(' '), /1 instrumentation interruption recorded/u);
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

test('Founder endurance lock forces both overlay layers before running state and restores local preferences afterward', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  const controls = new Map();
  const targets = new Map();
  for (const id of ['communication-analytics-show-overlay', 'communication-analytics-show-gauges', 'communication-analytics-show-audio', 'communication-analytics-show-timeline', 'communication-analytics-show-face-overlay', 'communication-analytics-show-body-overlay']) controls.set(id, { checked: false, disabled: false });
  for (const id of ['communication-analytics-overlay', 'communication-analytics-gauges', 'communication-analytics-audio', 'communication-analytics-timeline']) targets.set(id, { classList: { remove() {}, toggle() {} } });
  controls.set('communication-analytics-founder-overlay-policy-status', { textContent: '' });
  surface.founderInstrumentationLocked = false;
  surface.overlaySettings = {
    policy: () => ({ masterEnabled: true }),
    preferences: () => ({ founderLiveFace: false, founderLiveBody: false }),
  };
  const applied = [];
  surface.pipeline = { setInstrumentation: (layers) => applied.push(layers) };
  surface.clearOverlay = () => {};
  surface.scheduleInstrumentationRender = () => {};
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => controls.get(id) || targets.get(id) || null };
  try {
    surface.lockFounderInstrumentation(true);
    assert.equal(surface.founderInstrumentationLocked, true);
    assert.equal(controls.get('communication-analytics-show-overlay').disabled, true);
    assert.equal(controls.get('communication-analytics-show-face-overlay').checked, true);
    assert.equal(controls.get('communication-analytics-show-face-overlay').disabled, true);
    assert.equal(controls.get('communication-analytics-show-body-overlay').checked, true);
    assert.deepEqual(applied.at(-1), { overlayEnabled: true, faceEnabled: true, bodyEnabled: true });
    surface.lockFounderInstrumentation(false);
    assert.equal(surface.founderInstrumentationLocked, false);
    assert.equal(controls.get('communication-analytics-show-face-overlay').checked, false);
    assert.equal(controls.get('communication-analytics-show-body-overlay').checked, false);
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
  }
});

test('Founder endurance cannot start with local overlay master off and a mid-run disable latches an interruption', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  const controls = new Map([
    ['communication-analytics-start', { disabled: false, textContent: '' }],
    ['communication-analytics-run-mode', { disabled: false }],
    ['communication-analytics-replay', { disabled: false, checked: true }],
    ['communication-analytics-show-overlay', { checked: true }],
  ]);
  surface.selectedRunModeId = 'endurance-10';
  surface.state = 'ready';
  surface.cameraIsLive = () => true;
  surface.microphoneIsLive = () => true;
  surface.overlaySettings = { policy: () => ({ masterEnabled: false }) };
  surface.updateStartAvailability = FounderAnalyticsSurface.prototype.updateStartAvailability;
  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: (id) => controls.get(id) || null };
  try {
    surface.updateStartAvailability();
    assert.equal(controls.get('communication-analytics-start').disabled, true);
    surface.overlaySettings = { policy: () => ({ masterEnabled: true }) };
    surface.updateStartAvailability();
    assert.equal(controls.get('communication-analytics-start').disabled, false);

    surface.state = 'running';
    surface.activeRunPlan = founderRunPlan('endurance-10');
    surface.overlaySettings = { policy: () => ({ masterEnabled: false }) };
    surface.pipeline = { session: { clock: { sessionMs: () => 12_500 } } };
    surface.runInterrupted = false;
    surface.runInterruptionCount = 0;
    surface.runInterruptions = [];
    surface.runOpenInterruptions = new Set();
    surface.syncFounderOverlayControls = () => {};
    surface.configureOverlay = () => {};
    surface.updateStartAvailability = () => {};
    surface.handleOverlaySettingsChange();
    assert.equal(surface.runInterrupted, true);
    assert.equal(surface.runInterruptionCount, 1);
    assert.deepEqual(surface.runInterruptions[0], {
      subsystem: 'overlay-display', atMs: 12_500,
      message: 'Local overlay policy was disabled during the endurance run.',
    });
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
  }
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

test('Founder face safety distinguishes zero, one, multiple, unknown, and unavailable', () => {
  const ready = { faceDetectorStatus: 'ready', faceWorkerReady: true, multiFaceProtection: true };
  const detail = (faceCount) => ({ modality: 'vision', geometry: { faceCount } });
  const zero = founderFaceProtectionStatus(detail(0), ready);
  assert.equal(zero.guardReady, false);
  assert.match(zero.label, /FACE COUNT 0.*NO PERSON DETECTED.*SUPPRESSED/u);
  const one = founderFaceProtectionStatus(detail(1), ready);
  assert.equal(one.guardReady, true);
  assert.equal(one.label, 'FACE COUNT 1 · EXACTLY-ONE-PERSON GUARD READY');
  const multiple = founderFaceProtectionStatus(detail(3), ready);
  assert.equal(multiple.guardReady, false);
  assert.match(multiple.label, /FACE COUNT 2\+ \(3 DETECTED\).*MULTIPLE PEOPLE.*SUPPRESSED/u);
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

test('Founder live tracking status prints the finite face count and suppression state', () => {
  const surface = Object.create(FounderAnalyticsSurface.prototype);
  surface.state = 'running';
  surface.visionUnavailableReason = null;
  surface.lastDiagnostic = { vision: { geometry: { faceCount: 2 }, live: {} } };
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
  assert.match(status.textContent, /FACE COUNT 2\+ \(2 DETECTED\).*PERSON-SPECIFIC ANALYTICS \+ OVERLAY SUPPRESSED/u);
  assert.doesNotMatch(status.textContent, /EXACTLY-ONE-PERSON GUARD READY/u);
});

test('Founder live energy variation is a bounded experimental IQR', () => {
  assert.equal(founderEnergyVariationDb([{ db: -60 }, { db: -50 }, { db: -40 }, { db: -30 }]), 15);
  assert.equal(founderEnergyVariationDb([{ db: -30 }, { db: -30 }, { db: -30 }]), null);
  const history = [{ db: -160 }, ...Array.from({ length: 180 }, () => ({ db: -30 }))];
  assert.equal(founderEnergyVariationDb(history), 0);
});

test('Founder post-run report gives an immediate factual multimodal summary while retaining exact partial safety coverage', () => {
  const result = {
    startedAtMs: 0, endedAtMs: 10_000, durationMs: 10_000,
    modalities: {
      mic: { available: true, coverage: 0.96, frameCount: 200 },
      camera: { available: true, coverage: 0.9, frameCount: 80, analyzableFrames: 72, personSpecificCoverage: 0.75, personSpecificSampleCount: 60 },
    },
    performance: { visualInferenceP95Ms: 72.5 },
    privacy: { rawAudioStored: false, rawFramesStored: false, rawLandmarksStored: false, externalAnalyticsCalls: false, blockedExternalAttemptCount: 2 },
    events: [
      reportEvent('answer_duration_ms', 10_000, { input: 'clock', unit: 'ms', maturity: 'VALIDATED_STUDENT_SAFE', coverage: 1, sampleCount: 2 }),
      reportEvent('captured_level_dbfs', -42.68, { input: 'mic', unit: 'dBFS', maturity: 'VALIDATED_STUDENT_SAFE', coverage: 0.96, sampleCount: 200 }),
      reportEvent('digital_clipping_fraction', 0, { input: 'mic', unit: 'fraction', maturity: 'VALIDATED_STUDENT_SAFE', coverage: 0.96, sampleCount: 200 }),
      reportEvent('speech_active_ratio', 0.55, { input: 'mic', unit: 'fraction', reliability: 'unavailable', limitations: ['voice_activity_ground_truth_not_validated'] }),
      reportEvent('energy_variation_db', 22.35, { input: 'mic', unit: 'dB' }),
      reportEvent('pause_episode', 3_000, { input: 'mic', startMs: 1_000, endMs: 4_000, unit: 'ms', reliability: 'unavailable', limitations: ['voice_activity_ground_truth_not_validated'] }),
      reportEvent('hand_presence', 0.6, { unit: 'fraction' }),
      reportEvent('hand_motion_episode', { hands: 'left', leftZone: 'chest', rightZone: null }, { startMs: 2_000, endMs: 3_000 }),
      reportEvent('gesture_zone', { left: { chest: 12 }, right: { lower: 4 } }, { unit: 'frame_counts' }),
      reportEvent('torso_presence', 0.8, { unit: 'fraction' }),
      reportEvent('lateral_torso_lean', { degrees: 18, direction: 'right' }, { startMs: 3_000, endMs: 4_000, unit: 'degrees' }),
      reportEvent('face_presence', 0.8, { unit: 'fraction' }),
      reportEvent('head_orientation_proxy', { yawDeg: 1.5, pitchDeg: -2, rollDeg: 0.5 }, { unit: 'degrees' }),
      reportEvent('camera_facing_proxy', 0.7, { unit: 'fraction' }),
      reportEvent('sustained_head_turn_episode', { facing: false, yawProxyDeg: 25 }, { startMs: 5_000, endMs: 6_000 }),
      reportEvent('facial_movement_episode', 1.1, { startMs: 6_000, endMs: 6_500, unit: 'score_change_per_second' }),
      reportEvent('framing_center', 0.75, { unit: 'fraction' }),
      reportEvent('multiple_faces_detected', true, { startMs: 7_000, endMs: 7_600, input: 'camera', qualifiers: ['affected_interval_suppressed', 'no_identity_selection'] }),
      reportEvent('observation_gap', 'multiple_face_frames_excluded', { startMs: 7_000, endMs: 7_600, input: 'system', reliability: 'unavailable', coverage: 0, sampleCount: 0, limitations: ['person_specific_visual_signals_suppressed'] }),
      reportEvent('observation_gap', 'face_absence', { startMs: 8_000, endMs: 8_500, input: 'system', reliability: 'unavailable', coverage: 0, sampleCount: 0 }),
    ],
  };
  const report = founderPostRunReport(result, {
    cockpitPerformance: { overlay: { p95Ms: 0.25 }, audio: { p95Ms: 0.5 }, timeline: { p95Ms: 0.25 }, frame: { p95Ms: 1.5 } },
  });
  assert.equal(report.heading, 'Founder multimodal analytics report');
  assert.equal(report.suppression.partial, true);
  assert.equal(report.suppression.affectedDurationMs, 600);
  assert.equal(report.suppression.affectedRatio, 0.06);
  assert.match(report.suppression.summary, /Safe exactly-one-person sample evidence remains available.*600 ms \(6\.0%\).*other gaps and exact safe coverage are reported separately/u);
  assert.match(report.coverage.find((item) => item.label === 'Camera').text, /exactly-one-person coverage 75\.0%.*60 exactly-one-person samples/u);
  assert.equal(report.coverage.find((item) => item.label === 'Camera').status, 'LIMITED EXACTLY-ONE-PERSON COVERAGE');
  assert.equal(report.sections.find((section) => section.id === 'gestures').items[0].label, 'Hand visible in exactly-one-person analyzable frames');
  assert.equal(report.sections.find((section) => section.id === 'posture').items[0].label, 'Torso visible in exactly-one-person analyzable frames');
  assert.equal(report.sections.find((section) => section.id === 'head').items[0].label, 'Face visible in exactly-one-person analyzable frames');
  const voice = report.sections.find((section) => section.id === 'voice');
  assert.match(voice.items.find((item) => item.label === 'Digital clipping').value, /^0\.00%/u);
  assert.match(voice.items.find((item) => item.label === 'Words per minute').value, /UNAVAILABLE.*WPM/u);
  assert.match(voice.items.find((item) => item.label === 'Pitch \/ F0').value, /UNAVAILABLE.*F0/u);
  const pauses = report.sections.find((section) => section.id === 'pauses');
  assert.match(pauses.items[0].value, /1 TIMESTAMPED EPISODE · 3\.00 s/u);
  assert.match(pauses.items[0].meta, /analysis-path coverage.*quality sample count/u);
  const framing = report.sections.find((section) => section.id === 'framing');
  assert.match(framing.items.find((item) => item.label === 'Face absent / out of view').value, /1 TIMESTAMPED INTERVAL · 500 ms.*5\.0% OF RUN/u);
  assert.match(framing.items.find((item) => item.label === 'Multiple-face frames excluded').value, /600 ms.*6\.0% OF RUN/u);
  const performance = report.sections.find((section) => section.id === 'performance-privacy');
  assert.match(performance.items.find((item) => item.label === 'Raw analytics retention').value, /AUDIO NO · FRAMES NO · LANDMARKS NO/u);
  assert.match(performance.items.find((item) => item.label === 'External analytics calls').meta, /^2 blocked external attempts/u);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /emotion|identity|strength|eye contact|communication quality/iu);
});

test('Founder post-run report distinguishes explicit zero events from unavailable observations and bounds legacy whole-result suppression claims', () => {
  const zero = founderPostRunReport({
    startedAtMs: 0, endedAtMs: 5_000, durationMs: 5_000,
    modalities: { mic: { available: true, coverage: 1, frameCount: 100 }, camera: { available: false, coverage: 0, frameCount: 0, analyzableFrames: 0 } },
    events: [
      reportEvent('answer_duration_ms', 5_000, { endMs: 5_000, input: 'clock', unit: 'ms' }),
      reportEvent('digital_clipping_fraction', 0, { endMs: 5_000, input: 'mic', unit: 'fraction' }),
      reportEvent('speech_active_ratio', 0.5, { endMs: 5_000, input: 'mic', unit: 'fraction', reliability: 'unavailable' }),
      reportEvent('observation_gap', 'camera_unavailable', { endMs: 5_000, input: 'system', reliability: 'unavailable', coverage: 0, sampleCount: 0 }),
    ],
  });
  assert.match(zero.sections.find((section) => section.id === 'pauses').items[0].value, /0 QUALIFYING EPISODES RECORDED/u);
  assert.equal(zero.sections.find((section) => section.id === 'gestures').items[0].value, 'UNAVAILABLE — VISUAL OBSERVATION NOT AVAILABLE');
  assert.match(zero.overview.join(' '), /0 qualifying pause episodes recorded.*Hand-movement observation unavailable/u);

  const withheld = founderPostRunReport({
    startedAtMs: 0, endedAtMs: 5_000, durationMs: 5_000,
    modalities: { mic: { available: false, coverage: 0, frameCount: 0 }, camera: { available: true, coverage: 0.9, frameCount: 40, analyzableFrames: 36, personSpecificCoverage: 0, personSpecificSampleCount: 0 } },
    events: [
      reportEvent('multiple_faces_detected', true, { endMs: 5_000, qualifiers: ['affected_interval_suppressed'] }),
      reportEvent('observation_gap', 'multiple_faces', { endMs: 5_000, input: 'system', reliability: 'unavailable', coverage: 0, sampleCount: 0, qualifiers: ['person_specific_visual_signals_suppressed'] }),
    ],
  });
  assert.equal(withheld.suppression.partial, false);
  assert.equal(withheld.suppression.affectedRatio, 1);
  assert.equal(withheld.coverage.find((item) => item.label === 'Camera').status, 'NO EXACTLY-ONE-PERSON COVERAGE');
  assert.match(withheld.suppression.summary, /5\.00 s \(100\.0%\).*does not prove that another person was present throughout.*Safe-interval person-specific values were not emitted/u);

  const untrackable = founderPostRunReport({
    startedAtMs: 0, endedAtMs: 5_000, durationMs: 5_000,
    modalities: { mic: { available: false, coverage: 0, frameCount: 0 }, camera: { available: true, coverage: 1, frameCount: 40, analyzableFrames: 40, personSpecificCoverage: 1, personSpecificSampleCount: 40 } },
    events: [
      reportEvent('hand_presence', 0, { unit: 'fraction' }),
      reportEvent('gesture_zone', { left: {}, right: {} }, { unit: 'frame_counts' }),
      reportEvent('torso_presence', 0, { unit: 'fraction' }),
      reportEvent('face_presence', 0, { unit: 'fraction' }),
    ],
  });
  assert.equal(untrackable.sections.find((section) => section.id === 'gestures').items.find((item) => item.label === 'Hand movement').value, 'NO OBSERVATION AVAILABLE');
  assert.equal(untrackable.sections.find((section) => section.id === 'posture').items.find((item) => item.label === 'Lateral torso lean').value, 'NO OBSERVATION AVAILABLE');
  assert.equal(untrackable.sections.find((section) => section.id === 'head').items.find((item) => item.label === 'Sustained head turn').value, 'NO OBSERVATION AVAILABLE');
  assert.equal(untrackable.sections.find((section) => section.id === 'facial').items.find((item) => item.label === 'Facial movement').value, 'NO OBSERVATION AVAILABLE');
  assert.match(untrackable.overview.join(' '), /Hand-movement observation unavailable.*Posture-movement observation unavailable.*Head-turn observation unavailable.*Facial-movement observation unavailable/u);
});

test('Founder report withholds experimental transcript rate, filler, and unvalidated F0 values', () => {
  let now = 0;
  const session = new AnalyticsSession({ sessionId: 'founder-transcript-boundary', now: () => now, wallClock: () => 0 });
  session.beginAnswer({ answerId: 'answer-1' });
  now = 6_000;
  const result = session.endAnswer({ transcript: 'one two three four five six seven eight nine um' });
  assert.equal(result.events.some((event) => event.metric === 'word_rate_wpm'), true);
  assert.equal(result.events.some((event) => event.metric === 'filler_token_count'), true);
  const report = founderPostRunReport({ ...result, events: [...result.events, reportEvent('fundamental_frequency_hz', 180, { input: 'mic', unit: 'Hz' })] });
  const voice = report.sections.find((section) => section.id === 'voice');
  assert.match(voice.items.find((item) => item.label === 'Words per minute').value, /UNAVAILABLE.*WPM/u);
  assert.match(voice.items.find((item) => item.label === 'Transcript-derived filler tokens').value, /UNAVAILABLE.*TRANSCRIPT/u);
  assert.match(voice.items.find((item) => item.label === 'Pitch \/ F0').value, /UNAVAILABLE.*F0/u);
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
  const geometry = { faceCount: 1, face: { present: true }, pose: { torsoPresent: false }, hands: {} };
  surface.consumeDiagnostic({ modality: 'vision', atMs: 250, inferenceMs: 1_500, geometry, overlayRendered: true });
  assert.equal(surface.timelineStates.get('visionAvailable'), false);
  assert.equal(surface.timelineStates.get('face'), false);
  assert.match(surface.visionUnavailableReason, /stale/u);

  const priorDocument = globalThis.document;
  globalThis.document = { getElementById: () => null };
  try {
    surface.consumeDiagnostic({ modality: 'vision', atMs: 2_000, inferenceMs: 50, geometry, live: {}, overlayRendered: false });
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
    surface.consumeOverlay({ bitmap: {}, geometry, atMs: 250, pipelineMs: 1_500 });
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
  const geometry = { faceCount: 1, face: { present: true }, pose: { torsoPresent: false }, hands: {} };
  const priorDocument = globalThis.document;
  const priorSetTimeout = globalThis.setTimeout;
  let scheduledDelay = null;
  globalThis.document = { getElementById: () => ({ checked: true }) };
  globalThis.setTimeout = (_callback, delay) => { scheduledDelay = delay;return 1; };
  try {
    surface.consumeDiagnostic({ modality: 'vision', atMs: 2_000, inferenceMs: 900, geometry, live: {}, overlayRendered: true });
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
    globalThis.setTimeout = priorSetTimeout;
  }
  assert.equal(scheduledDelay, 100);
});

test('fresh zero or multi-face counts remain explicit for one second, then expire to unknown', () => {
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
    surface.consumeDiagnostic({ modality: 'vision', atMs: 2_000, inferenceMs: 50, geometry: { faceCount: 2, face: { present: true }, pose: {}, hands: {} }, live: {}, overlayRendered: false });
    assert.equal(surface.visionDiagnosticStale, false);
    assert.equal(surface.visionUnavailableReason, null);
    assert.equal(scheduledDelay, 950);
    assert.match(founderFaceProtectionStatus(surface.lastDiagnostic.vision, surface.pipeline.diagnostics()).label, /FACE COUNT 2\+.*SUPPRESSED/u);
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

test('Founder person-specific geometry fails closed without exactly-one-person protection', () => {
  const geometry = { faceCount: 1, face: { present: true }, pose: {}, hands: {} };
  const detail = { modality: 'vision', geometry };
  assert.equal(founderOverlayGeometry(detail), null);
  assert.equal(founderOverlayGeometry(detail, { multiFaceProtection: false }), null);
  assert.equal(founderOverlayGeometry({ ...detail, geometry: { ...geometry, faceCount: 0 } }, { multiFaceProtection: true }), null);
  assert.equal(founderOverlayGeometry({ ...detail, geometry: { ...geometry, faceCount: 2 } }, { multiFaceProtection: true }), null);
  assert.equal(founderOverlayGeometry({ modality: 'audio', geometry }, { multiFaceProtection: true }), null);
  assert.equal(founderOverlayGeometry(detail, { multiFaceProtection: true }), geometry);
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
  assert.match(source, /plan\.endurance && this\.overlaySettings\?\.policy\?\.\(\)\.masterEnabled === false/u);
  assert.match(source, /this\.timer = setInterval\(\(\) => this\.tickRun\(runEpoch\), 250\)/u);
  assert.match(source, /this\.lockFounderInstrumentation\(plan\.endurance\)/u);
  assert.match(source, /clearInterval\(this\.timer\)/u);
  for (const id of ['show-overlay', 'show-gauges', 'show-audio', 'show-timeline']) {
    assert.match(source, new RegExp(`\\['communication-analytics-${id}'`, 'u'));
  }
  for (const id of ['communication-analytics-show-face-overlay', 'communication-analytics-show-body-overlay']) assert.match(source, new RegExp(id, 'u'));
  assert.match(source, /function toggleControl\(id, text, checked = true\)/u);
  assert.match(source, /overlay\.id = 'communication-analytics-overlay'/u);
  assert.match(source, /overlay\.setAttribute\('aria-hidden', 'true'\)/u);
  assert.match(source, /tracking\.setAttribute\('role', 'status'\)/u);
  assert.match(source, /audioCanvas\.setAttribute\('role', 'img'\)/u);
  assert.match(source, /timelineCanvas\.setAttribute\('role', 'img'\)/u);
  assert.match(source, /UNAVAILABLE — NO VALIDATED F0 INPUT/u);
  assert.match(source, /TRANSCRIPT REQUIRED — UNAVAILABLE IN LIVE COCKPIT/u);
  assert.match(source, /energy_variation_db.*FOUNDER EXPERIMENTAL/su);
  assert.match(source, /Engine · active \$\{diagnostics\.active\}[\s\S]*\$\{protection\.label\}/u);
  const studentRenderer = source.slice(source.indexOf('export function renderStudentAnalytics'), source.indexOf('class FounderAnalyticsSurface'));
  assert.doesNotMatch(studentRenderer, /founder-cockpit|tracking-overlay|live-timeline/iu);
  assert.doesNotMatch(studentRenderer, /energy_variation_db/iu);
  const founderSurface = source.slice(source.indexOf('export class FounderAnalyticsSurface'));
  assert.doesNotMatch(founderSurface, /console\./u);
});

test('overlay consumes only a transient worker-rendered bitmap and never landmark coordinates', async () => {
  const source = await read('public/analytics/ui.mjs');
  assert.match(source, /pipeline\.setInstrumentation\?\.\(\{ overlayEnabled, faceEnabled, bodyEnabled \}\)/u);
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
  assert.match(css, /\.ca-instrument-grid\{display:grid/u);
  assert.match(css, /\.ca-run-config\{display:grid/u);
  assert.match(css, /\.ca-run-(?:complete|limited)/u);
  assert.match(css, /\.ca-toggle\{[^}]*min-height:44px/u);
  assert.match(css, /\.ca-founder-report\{display:grid/u);
  assert.match(css, /\.ca-report-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/u);
  assert.ok(css.includes('@media(max-width:1024px){.ca-grid{grid-template-columns:1fr}.ca-instrument-grid,.ca-report-grid{grid-template-columns:1fr}'));
  assert.match(css, /@media\(max-width:600px\).*\.ca-report-coverage,.ca-founder-overview\{grid-template-columns:1fr\}.*\.ca-report-details\{grid-template-columns:1fr\}/u);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/u);
});

test('Founder result renders the multimodal report synchronously above the complete timestamped catalog without changing student output', async () => {
  const source = await read('public/analytics/ui.mjs');
  const founderResult = source.slice(source.indexOf('  renderFounderResult(result) {'), source.indexOf('\n  clear({ render = true }'));
  assert.ok(founderResult.indexOf('founderPostRunReport(result') < founderResult.indexOf("'Full timestamped evidence catalog'"));
  assert.ok(founderResult.indexOf('renderFounderPostRunReport(report)') < founderResult.indexOf('for (const event of (result?.events || []))'));
  for (const title of ['Voice / Delivery', 'Silence / Pauses', 'Gesture / Hands', 'Posture / Body', 'Head / Camera-facing', 'Facial movement', 'Framing / Tracking safety', 'Performance / Privacy']) {
    assert.match(source, new RegExp(title.replace('/', '\\/'), 'u'));
  }
  for (const reason of ['face_absence', 'multiple_face_frames_excluded', 'multi_face_protection_unavailable']) assert.match(source, new RegExp(`'${reason}'`, 'u'));
  assert.match(source, /region\.setAttribute\('aria-labelledby', 'communication-analytics-founder-report-overview'\)/u);
  assert.match(source, /card\.setAttribute\('aria-labelledby', titleId\)/u);
  const studentRenderer = source.slice(source.indexOf('export function renderStudentAnalytics'), source.indexOf('export class FounderAnalyticsSurface'));
  assert.doesNotMatch(studentRenderer, /founderPostRunReport|Founder multimodal analytics report|ca-founder-report/u);
});
