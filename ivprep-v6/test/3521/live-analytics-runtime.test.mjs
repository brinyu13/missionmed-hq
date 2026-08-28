import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DeterministicLocalSignalFixture,
  LIVE_ANALYTICS_MODULES,
  LiveAnalyticsPresentationState,
  LiveAnalyticsRuntime,
} from '../../public/live-analytics/live-analytics.mjs';
import { LiveMetricProjector } from '../../public/live-analytics/live-metric-projector.mjs';

const timedWords = (count, { startMs = 0, spacingMs = 500, durationMs = 250 } = {}) => Array.from(
  { length: count },
  (_, index) => ({ startMs: startMs + index * spacingMs, endMs: startMs + index * spacingMs + durationMs, probability: 0.95 }),
);

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.value = '';
    this.listeners = new Map();
    this.attributes = new Map();
    this.focused = false;
  }

  addEventListener(type, callback) { this.listeners.set(type, callback); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  focus() { this.focused = true; }
  querySelector() { return null; }
  replaceChildren() {}
  append() {}
}

function fakeDocument() {
  const ids = [
    'live-analytics-app', 'runtime-main', 'live-video', 'camera-empty-state',
    'runtime-status', 'capture-indicator', 'session-clock', 'measurement-status',
    'measurement-presentation-state',
    'stream-quality', 'camera-select', 'microphone-select', 'connect-media',
    'start-session', 'end-session', 'mode-full-coaching', 'mode-hidden-analytics',
    'hide-all-analytics', 'restore-vision-analytics', 'restore-voice-analytics',
    'founder-diagnostics', 'toggle-diagnostics', 'close-diagnostics',
  ];
  const byId = new Map(ids.map((id) => [id, new FakeElement(id)]));
  const modules = new Map(LIVE_ANALYTICS_MODULES.map((name) => [name, new FakeElement(`module-${name}`)]));
  const toggles = new Map(LIVE_ANALYTICS_MODULES.map((name) => {
    const element = new FakeElement(`toggle-${name}`);
    element.dataset.moduleToggle = name;
    return [name, element];
  }));
  const restores = new Map(LIVE_ANALYTICS_MODULES.map((name) => {
    const element = new FakeElement(`restore-${name}`);
    element.dataset.moduleRestore = name;
    return [name, element];
  }));
  const diagnostics = new Map(['media', 'audio', 'pitch', 'wpm', 'face', 'body', 'metrics'].map((name) => [name, new FakeElement(`diagnostic-${name}`)]));
  const body = new FakeElement('body');
  return {
    body,
    getElementById: (id) => byId.get(id) || null,
    querySelector(selector) {
      const match = selector.match(/^\[data-(module|module-toggle|module-restore|diagnostic)="([^"]+)"\]$/u);
      if (!match) return null;
      if (match[1] === 'module') return modules.get(match[2]) || null;
      if (match[1] === 'module-toggle') return toggles.get(match[2]) || null;
      if (match[1] === 'module-restore') return restores.get(match[2]) || null;
      return diagnostics.get(match[2]) || null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-module-toggle]') return [...toggles.values()];
      if (selector === '[data-module-restore]') return [...restores.values()];
      return [];
    },
    createElement: (tag) => new FakeElement(tag),
    byId,
    modules,
    toggles,
    restores,
    diagnostics,
  };
}

function runtimeHarness({ fixtureMode = false, fixture = null, transcriptTimingProducer = null, fetchImpl = null } = {}) {
  const documentRef = fakeDocument();
  const calls = { prime: 0, gum: 0, visibility: [], destroy: 0 };
  const bridge = {
    media: { cam: false, mic: false, stream: null, AC: null },
    sessionClock: { sessionMs: () => 0 },
    addEventListener() {},
    removeEventListener() {},
    ensureAnalytics() {
      return {
        addEventListener() {}, removeEventListener() {}, setOverlayConsumer() {}, setInstrumentation() {}, diagnostics() { return {}; },
      };
    },
    startAnalytics() { return true; },
    endAnalytics() { return true; },
    stopMedia() { this.media.stream = null; },
    switchDevice() { return Promise.resolve(this.media); },
    setPresentationVisibility(value) { calls.visibility.push(value); return value; },
    primeAudioContext() { calls.prime += 1; },
    requestMedia() { calls.gum += 1; return Promise.reject(new Error('not granted')); },
    destroy() { calls.destroy += 1; },
  };
  const renderer = { frames: [], renderAll(frames) { this.frames.push(frames); }, resize() {} };
  const runtime = new LiveAnalyticsRuntime({
    documentRef,
    windowRef: { addEventListener() {}, requestAnimationFrame(callback) { callback(); } },
    bridge,
    renderer,
    fixtureMode,
    fixture,
    transcriptTimingProducer,
    fetchImpl,
    baselineStore: { load() { return null; }, save() { return null; }, invalidateForDeviceChange() {} },
  }).mount();
  return { runtime, bridge, calls, renderer, documentRef };
}

test('physical and deterministic sources mount the identical full Founder presentation before measurement', async () => {
  const physical = runtimeHarness();
  const deterministic = runtimeHarness({ fixtureMode: true });
  const physicalPresentation = physical.runtime.presentation.snapshot();
  const deterministicPresentation = deterministic.runtime.presentation.snapshot();

  assert.equal(physicalPresentation.preset, 'full');
  assert.deepEqual(physicalPresentation, deterministicPresentation);
  assert.deepEqual(physicalPresentation.visible, LIVE_ANALYTICS_MODULES);
  assert.deepEqual(physical.documentRef.byId.get('runtime-main').dataset, deterministic.documentRef.byId.get('runtime-main').dataset);
  assert.equal(physical.documentRef.byId.get('runtime-main').dataset.leftCollapsed, 'false');
  assert.equal(physical.documentRef.byId.get('runtime-main').dataset.rightCollapsed, 'false');
  assert.equal(physical.documentRef.modules.get('head-face').dataset.collapsed, 'false');
  assert.equal(physical.documentRef.modules.get('body').dataset.collapsed, 'false');

  const source = await readFile(new URL('../../public/live-analytics/live-analytics.mjs', import.meta.url), 'utf8');
  const fixtureConfiguration = source.split('  #configureFixtureSurface() {')[1]?.split('\n  applyPresentation() {')[0] || '';
  assert.doesNotMatch(fixtureConfiguration, /selectPreset|setMode|setMetricVisible|setFamilyVisible/u);

  const html = await readFile(new URL('../../public/live-analytics/index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../public/live-analytics/live-analytics.css', import.meta.url), 'utf8');
  assert.match(css, /founder-face-scanner\.png/u);
  assert.match(css, /founder-body-scanner\.png/u);
  const renderers = await readFile(new URL('../../public/live-analytics/hud-renderers.mjs', import.meta.url), 'utf8');
  const headUnavailable = renderers.split('export class HeadFaceHudRenderer')[1]?.split('  draw(frame) {')[0] || '';
  const bodyUnavailable = renderers.split('export class BodyHudRenderer')[1]?.split('  draw(frame) {')[0] || '';
  for (const unavailablePath of [headUnavailable, bodyUnavailable]) {
    assert.match(unavailablePath, /clearRect\(0, 0, fit\.width, fit\.height\)/u);
    assert.doesNotMatch(unavailablePath, /super\.unavailable/u, 'scanner assets must not be covered by the generic unavailable painter');
  }
  const rightOrder = ['data-module="volume"', 'data-module="speed"', 'data-module="modulation"', 'data-module="pitch"']
    .map((marker) => html.indexOf(marker));
  assert.ok(rightOrder.every((position) => position >= 0));
  assert.deepEqual([...rightOrder].sort((a, b) => a - b), rightOrder);
});

test('Start analytics activates every physical metric, including WPM, before interview start', async () => {
  const calls = { start: 0, stop: 0 };
  const producer = {
    async start({ onState, onTiming }) {
      calls.start += 1;
      onState({ state: 'live', reason: 'LOCAL_TRANSCRIPT_TIMING_LIVE' });
      onTiming({
        atMs: 4_000,
        windowStartedAtMs: 0,
        windowEndedAtMs: 4_000,
        speechDurationMs: 3_500,
        coverage: 0.9,
        wordCount: 12,
        words: timedWords(12, { spacingMs: 320, durationMs: 180 }),
        provenance: { kind: 'OBSERVED_TRANSCRIPT_TIMING', observed: true, wordTimestampsObserved: true, timingAccuracyValidated: false, tier: 'B', source: 'LOCAL_TIMED_TRANSCRIPT' },
      });
      return true;
    },
    stop() { calls.stop += 1; return true; },
  };
  const { runtime, bridge } = runtimeHarness({ transcriptTimingProducer: producer });
  bridge.media = {
    cam: true,
    mic: true,
    stream: { getAudioTracks: () => [{ readyState: 'live', enabled: true }] },
    AC: { state: 'running', sampleRate: 48_000 },
  };
  bridge.requestMedia = async () => bridge.media;
  await runtime.connect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.start, 1);
  assert.equal(runtime.active, false);
  assert.equal(runtime.captureMeasuring, true);
  assert.equal(runtime.projector.latest.metrics.SPEED_WPM.available, true);
  assert.equal(runtime.projector.latest.metrics.SPEED_WPM.wordsPerMinute, 180);
  assert.equal(runtime.transcriptTimingState.reason, 'LOCAL_TRANSCRIPT_TIMING_LIVE');
  runtime.behavior.setup.ingestAudio({ available: true, speechMs: 3_100, noiseFloorDb: -55, speechLevelDb: -25, clippedFraction: 0 });
  runtime.behavior.setup.ingestVideo({ facePresent: true, faceFraction: 0.28, centerX: 0.5, centerY: 0.4, headPitchDegrees: 0, confidence: 0.9 });
  runtime.latestBehavior = runtime.behavior.snapshot(4_000);
  await runtime.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.start, 1);
  await runtime.finish();
  assert.ok(calls.stop >= 1);
});

test('physical WPM start waits for the authenticated admission token instead of losing the producer to a bootstrap race', async () => {
  let resolveAdmission;
  const calls = [];
  const producer = {
    async start({ csrfToken }) { calls.push(csrfToken); return true; },
    stop() { return true; },
  };
  const fetchImpl = () => new Promise((resolve) => { resolveAdmission = resolve; });
  const { runtime, bridge } = runtimeHarness({ transcriptTimingProducer: producer, fetchImpl });
  bridge.media = {
    cam: true,
    mic: true,
    stream: { getAudioTracks: () => [{ readyState: 'live', enabled: true }] },
    AC: { state: 'running', sampleRate: 48_000 },
  };
  bridge.requestMedia = async () => bridge.media;
  await runtime.connect();
  runtime.behavior.setup.ingestAudio({ available: true, speechMs: 3_100, noiseFloorDb: -55, speechLevelDb: -25, clippedFraction: 0 });
  runtime.behavior.setup.ingestVideo({ facePresent: true, faceFraction: 0.28, centerX: 0.5, centerY: 0.4, headPitchDegrees: 0, confidence: 0.9 });
  runtime.latestBehavior = runtime.behavior.snapshot(4_000);
  const starting = runtime.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, []);
  resolveAdmission({
    ok: true,
    json: async () => ({
      admitted: true,
      identity: { subject: 'wp:42', founder: false, roles: ['student'] },
      mutationCsrfToken: 'authenticated_csrf_token_3522c',
    }),
  });
  assert.equal(await starting, true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['authenticated_csrf_token_3522c']);
  await runtime.finish();
});

test('physical WPM waiting state never renders the contradictory producer-live reason', () => {
  const { runtime, renderer } = runtimeHarness();
  runtime.active = true;
  runtime.captureMeasuring = true;
  runtime.consumeTranscriptTimingState({ state: 'live', reason: 'LOCAL_TRANSCRIPT_TIMING_LIVE' });
  assert.equal(renderer.frames.at(-1).speed.available, false);
  assert.equal(renderer.frames.at(-1).speed.reason, 'WAITING_FOR_LOCAL_TIMED_WORDS');
});

test('switching the active microphone restarts local timing on the replacement track', async () => {
  const calls = { start: 0, stop: 0 };
  const producer = {
    async start() { calls.start += 1; return true; },
    stop() { calls.stop += 1; return true; },
  };
  const { runtime, bridge } = runtimeHarness({ transcriptTimingProducer: producer });
  bridge.media = {
    cam: true,
    mic: true,
    stream: { getAudioTracks: () => [{ readyState: 'live', enabled: true }] },
    AC: { state: 'running', sampleRate: 48_000 },
  };
  runtime.active = true;
  runtime.captureMeasuring = true;
  runtime.activeClock = { sessionMs: () => 1_000 };
  await runtime.switchDevice('microphone', 'replacement-microphone');
  assert.equal(calls.stop, 1);
  assert.equal(calls.start, 1);
});

test('stopping pre-interview analytics stops transcript timing and releases capture', async () => {
  const calls = { start: 0, stop: 0 };
  const producer = {
    async start() { calls.start += 1; return true; },
    stop() { calls.stop += 1; return true; },
  };
  const { runtime, bridge } = runtimeHarness({ transcriptTimingProducer: producer });
  bridge.media = {
    cam: true,
    mic: true,
    stream: { getAudioTracks: () => [{ readyState: 'live', enabled: true }] },
    AC: { state: 'running', sampleRate: 48_000 },
  };
  bridge.requestMedia = async () => bridge.media;
  await runtime.connect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.start, 1);
  await runtime.stopCapture();
  assert.ok(calls.stop >= 1);
  assert.equal(runtime.captureMeasuring, false);
});

test('all six analytics modules are independently hideable and restore their prior presentation state', () => {
  const state = new LiveAnalyticsPresentationState();
  for (const name of LIVE_ANALYTICS_MODULES) state.setModuleVisible(name, false);
  assert.deepEqual(state.snapshot().hidden, LIVE_ANALYTICS_MODULES);
  state.setModuleVisible('pitch', true);
  assert.deepEqual(state.snapshot().visible, ['pitch']);
  state.setMode('interview');
  state.setMode('coaching');
  assert.deepEqual(state.snapshot().visible, ['pitch']);
  state.restoreAll();
  assert.deepEqual(state.snapshot().visible, LIVE_ANALYTICS_MODULES);
});

test('hide-all and interview-only modes mutate presentation without new capture or AudioContext work', () => {
  const { runtime, calls } = runtimeHarness();
  runtime.presentation.hideAll();
  runtime.applyPresentation();
  runtime.presentation.setMode('interview');
  runtime.applyPresentation();
  runtime.presentation.restoreAll();
  runtime.presentation.setMode('coaching');
  runtime.applyPresentation();
  assert.equal(calls.gum, 0);
  assert.equal(calls.prime, 0);
  assert.deepEqual(calls.visibility, [], 'presentation state must not enter the capture bridge');
});

test('reopening analytics keeps the latest metric values rather than resetting the projector', () => {
  const { runtime, renderer } = runtimeHarness();
  runtime.consumeDiagnostic({
    modality: 'audio', atMs: 50, rms: 0.1, peak: 0.2, clippedFraction: 0,
    pitch: { voiced: false, summary: { available: false, reason: 'INSUFFICIENT_VOICED_AUDIO' } },
  });
  const latest = runtime.projector.latest;
  runtime.presentation.hideAll();
  runtime.applyPresentation();
  runtime.presentation.restoreAll();
  runtime.applyPresentation();
  assert.equal(runtime.projector.latest, latest);
  assert.equal(renderer.frames.at(-1).volume.dbfs, latest.metrics.VOLUME.dbfs);
});

test('Vocal Variation keeps genuine raw histories while its presentation is hidden', () => {
  const { runtime, renderer } = runtimeHarness();
  const pitch = (f0Hz) => ({
    voiced: true,
    f0Hz,
    summary: {
      available: true,
      medianHz: 200,
      rangeSemitones: 5,
      variationSemitones: 1.4,
      voicedRatio: 0.8,
    },
  });
  runtime.consumeDiagnostic({ modality: 'audio', atMs: 1_000, rms: 0.05, peak: 0.1, clippedFraction: 0, speaking: true, pitch: pitch(200) });
  runtime.consumeDiagnostic({ modality: 'audio', atMs: 1_050, rms: 0.1, peak: 0.2, clippedFraction: 0, speaking: true, pitch: pitch(220) });
  runtime.consumeTranscriptTiming({
    atMs: 4_000,
    windowStartedAtMs: 0,
    windowEndedAtMs: 4_000,
    speechDurationMs: 3_500,
    coverage: 0.9,
    wordCount: 8,
    words: timedWords(8),
    provenance: { kind: 'OBSERVED_TRANSCRIPT_TIMING', observed: true, wordTimestampsObserved: true, timingAccuracyValidated: false, tier: 'B', source: 'LOCAL_TIMED_TRANSCRIPT' },
  });
  const before = renderer.frames.at(-1).modulation;
  assert.deepEqual(before.histories.volume.map((sample) => sample.value), [-26.02, -20]);
  assert.equal(before.histories.pitch.length, 2);
  assert.deepEqual(before.histories.speed.map((sample) => sample.value), [120]);
  assert.equal(before.sources.volume, 'MIC_RMS');
  assert.equal(before.sources.pitch, 'VALIDATED_F0');
  assert.equal(before.sources.speed, 'LOCAL_TIMED_TRANSCRIPT');

  runtime.presentation.setModuleVisible('modulation', false);
  runtime.applyPresentation();
  runtime.consumeDiagnostic({ modality: 'audio', atMs: 1_100, rms: 0.2, peak: 0.3, clippedFraction: 0, speaking: true, pitch: pitch(240) });
  const whileHidden = renderer.frames.at(-1).modulation;
  assert.equal(whileHidden.histories.volume.length, 3, 'hidden trace measurement must continue');
  assert.equal(whileHidden.histories.pitch.length, 3, 'hidden pitch history must continue');

  runtime.consumeDiagnostic({ modality: 'audio', atMs: 900, rms: 0.3, peak: 0.4, clippedFraction: 0, speaking: true, pitch: pitch(260) });
  const afterStaleFrame = renderer.frames.at(-1).modulation;
  assert.deepEqual(afterStaleFrame.histories, whileHidden.histories, 'stale frames must not roll history backward');

  runtime.presentation.setModuleVisible('modulation', true);
  runtime.applyPresentation();
  runtime.render(runtime.projector.latest);
  const restored = renderer.frames.at(-1).modulation;
  assert.deepEqual(restored.histories, whileHidden.histories, 'restoring presentation must not reset history');
});

test('restore controls transfer focus before their restored UI hides the trigger', () => {
  const { runtime, documentRef } = runtimeHarness();
  const stable = documentRef.byId.get('hide-all-analytics');
  runtime.presentation.setRailVisible('voice', false);
  runtime.applyPresentation();
  documentRef.byId.get('restore-voice-analytics').listeners.get('click')();
  assert.equal(stable.focused, true);

  stable.focused = false;
  runtime.presentation.setModuleVisible('volume', false);
  runtime.applyPresentation();
  documentRef.restores.get('volume').listeners.get('click')();
  assert.equal(stable.focused, true);
});

test('measurement presentation copy distinguishes visible and hidden analytics', () => {
  const { runtime, documentRef } = runtimeHarness();
  const label = documentRef.byId.get('measurement-presentation-state');
  assert.equal(label.textContent, 'Measuring · visible.');
  runtime.presentation.selectPreset('interview');
  runtime.applyPresentation();
  assert.equal(label.textContent, 'Measuring · analytics hidden.');
});

test('deterministic fixture runs the production RMS, F0, compact geometry, and trusted timing projectors', () => {
  let now = 0;
  let scheduled = null;
  const diagnostics = [];
  const timings = [];
  const projector = new LiveMetricProjector();
  const fixture = new DeterministicLocalSignalFixture({
    now: () => now,
    setIntervalFn: (callback) => { scheduled = callback; return 1; },
    clearIntervalFn: () => {},
  });
  fixture.start({
    onDiagnostic: (detail) => { diagnostics.push(detail); projector.ingest(detail); },
    onTranscriptTiming: (evidence) => {
      timings.push(evidence);
      projector.ingestTranscriptTiming(evidence, { allowDeterministicFixture: true });
    },
  });
  for (let index = 0; index < 220; index += 1) {
    now += 50;
    scheduled();
  }
  const snapshot = projector.latest;
  assert.equal(snapshot.metrics.VOLUME.available, true);
  assert.equal(snapshot.metrics.VOLUME.source, 'MIC_RMS');
  assert.equal(snapshot.metrics.VOLUME_MODULATION.available, true);
  assert.equal(snapshot.metrics.PITCH.available, true);
  assert.equal(snapshot.metrics.PITCH.reference, 'SPEAKER_ROLLING_MEDIAN');
  assert.equal(snapshot.metrics.HEAD_FACE.available, true);
  assert.equal(snapshot.metrics.BODY_HANDS.available, true);
  assert.equal(snapshot.metrics.BODY_HANDS.hands.bothPresent, true);
  assert.equal(snapshot.metrics.SPEED_WPM.available, true);
  assert.equal(snapshot.metrics.SPEED_WPM.source, 'DETERMINISTIC_TEST_FIXTURE');
  assert.equal(snapshot.metrics.SPEED_WPM.fixture, true);
  assert.ok(diagnostics.filter((detail) => detail.modality === 'audio').length >= 220);
  assert.ok(diagnostics.filter((detail) => detail.modality === 'vision').length >= 20);
  assert.equal(timings.length, 1);
  fixture.stop();
});

test('runtime forwards four independent overlay switches to the local worker', () => {
  const { runtime } = runtimeHarness();
  const calls = [];
  runtime.pipeline = { setInstrumentation(value) { calls.push(value); } };
  runtime.setOverlayVisible('face', false);
  runtime.setOverlayVisible('hands', false);
  runtime.setOverlayVisible('body', true);
  runtime.setOverlayVisible('framing', true);
  assert.deepEqual(calls.at(-1), {
    overlayEnabled: true,
    faceOverlayEnabled: false,
    bodyHandsOverlayEnabled: true,
    handsOverlayEnabled: false,
    bodyOverlayEnabled: true,
    framingOverlayEnabled: true,
  });
});

test('Interview Only disables worker overlay production while capture remains owned', () => {
  const { runtime } = runtimeHarness();
  const instrumentation = [];
  runtime.pipeline = { setInstrumentation(value) { instrumentation.push(value); } };
  runtime.presentation.setMode('interview');
  runtime.applyPresentation();
  assert.equal(instrumentation.at(-1).overlayEnabled, false);
  assert.equal(instrumentation.at(-1).faceOverlayEnabled, false);
  assert.equal(runtime.active, false);
});

test('deterministic transcript timing refreshes as labelled per-word windows without going stale', () => {
  let now = 0;
  let scheduled = null;
  const timings = [];
  const projector = new LiveMetricProjector();
  const fixture = new DeterministicLocalSignalFixture({
    now: () => now,
    setIntervalFn: (callback) => { scheduled = callback; return 1; },
    clearIntervalFn: () => {},
  });
  fixture.start({
    onDiagnostic: (detail) => projector.ingest(detail),
    onTranscriptTiming: (evidence) => {
      timings.push(evidence);
      projector.ingestTranscriptTiming(evidence, { allowDeterministicFixture: true });
    },
  });
  for (let index = 0; index < 400; index += 1) {
    now += 50;
    scheduled();
  }
  assert.ok(timings.length >= 5);
  assert.ok(timings.every((timing) => timing.wordCount >= 8 && timing.words.length === timing.wordCount));
  assert.ok(timings.every((timing) => timing.provenance.observed === false));
  assert.ok(timings.every((timing) => timing.provenance.source === 'DETERMINISTIC_TEST_TRANSCRIPT_TIMING'));
  assert.equal(projector.latest.metrics.SPEED_WPM.available, true);
  assert.equal(projector.latest.metrics.SPEED_WPM.wordsPerMinute, 120);
  assert.equal(projector.latest.metrics.SPEED_WPM.fixture, true);
  fixture.stop();
});

test('the deterministic visual-QA fixture owns one monotonic session clock and never calls physical media', async () => {
  let now = 5_000;
  const fixture = new DeterministicLocalSignalFixture({
    now: () => now,
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });
  const { runtime, calls } = runtimeHarness({ fixtureMode: true, fixture });
  await runtime.connect();
  await runtime.start();
  assert.equal(runtime.activeClock, fixture.clock);
  assert.equal(runtime.activeClock.sessionMs(), 0);
  assert.equal(calls.gum, 0);
  assert.equal(calls.prime, 0);
  now = 5_500;
  fixture.step();
  assert.equal(runtime.activeClock.sessionMs(), 500);
  await runtime.finish();
  assert.equal(fixture.running, false);
});

test('an asynchronous deterministic start failure is visible instead of silently inert', async () => {
  const fixture = {
    start() { throw new Error('bounded fixture failure'); },
  };
  const { runtime, documentRef } = runtimeHarness({ fixtureMode: true, fixture });
  await runtime.connect();
  documentRef.byId.get('start-session').listeners.get('click')();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    documentRef.byId.get('runtime-status').textContent,
    'Interview start failed · bounded fixture failure',
  );
});

test('a second deterministic interview resets histories and accepts its fresh near-zero clock', async () => {
  let now = 9_000;
  const fixture = new DeterministicLocalSignalFixture({
    now: () => now,
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });
  const { runtime } = runtimeHarness({ fixtureMode: true, fixture });
  await runtime.connect();
  await runtime.start();
  now = 11_000;
  fixture.step();
  assert.ok(runtime.projector.latest.clock.lastAcceptedAtMs.audio >= 2_000);
  await runtime.finish();

  await runtime.start();
  assert.equal(runtime.activeClock.sessionMs(), 0);
  assert.equal(runtime.projector.latest.clock.lastAcceptedAtMs.audio, 0);
  now = 11_050;
  fixture.step();
  assert.equal(runtime.projector.latest.clock.lastAcceptedAtMs.audio, 50);
  assert.ok(runtime.counts.audio <= 2, 'second-session counters must not retain the first session');
  await runtime.finish();
});

test('unsupported psychological, intent, hiring, and diagnostic scores are absent from the live surface', async () => {
  const html = await readFile(new URL('../../public/live-analytics/index.html', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../../public/live-analytics/live-analytics.mjs', import.meta.url), 'utf8');
  const combined = `${html}\n${runtime}`;
  for (const forbidden of [
    'emotion score', 'honesty score', 'confidence score', 'personality score',
    'hiring score', 'clinical score', 'fidget score', 'genuine smile score',
  ]) assert.doesNotMatch(combined, new RegExp(forbidden, 'iu'));
  assert.match(html, /No gaze, emotion, honesty, confidence, or personality inference\./u);
  assert.match(html, /Gesture meaning, fidget, note-taking, and intent remain unavailable/u);
  const renderers = await readFile(new URL('../../public/live-analytics/hud-renderers.mjs', import.meta.url), 'utf8');
  assert.match(renderers, /WAITING FOR OBSERVED MEASURED HISTORY/u);
  assert.doesNotMatch(renderers, /WAITING FOR GENUINE MEASURED HISTORY/u);
});

test('default instruments fail closed and deterministic data is prominently identified as test input', async () => {
  const html = await readFile(new URL('../../public/live-analytics/index.html', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../../public/live-analytics/live-analytics.mjs', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../public/live-analytics/live-analytics.css', import.meta.url), 'utf8');
  const renderers = await readFile(new URL('../../public/live-analytics/hud-renderers.mjs', import.meta.url), 'utf8');
  assert.match(html, /UNAVAILABLE — observed word timing required/u);
  assert.match(html, /UNAVAILABLE — voiced F0 frames required/u);
  assert.match(runtime, /DETERMINISTIC TEST INPUT · LOCAL/u);
  assert.match(runtime, /local && requested/u);
  assert.match(css, /\[data-mode="interview"\] \.stage-overlay \{ opacity: 0; \}/u);
  assert.match(html, /class="fixture-backdrop"/u);
  assert.doesNotMatch(css, /\[data-mode="interview"\] \.fixture-backdrop/u);
  assert.equal((html.match(/data-live-scan-overlay=/gu) || []).length, 0);
  assert.match(html, /id="body-overlay"/u);
  assert.doesNotMatch(html, /id="conversation-state"/u);
  assert.match(runtime, /stage\.dataset\.conversationState = conversationState/u);
  assert.match(html, /data-face-activity-state/u);
  assert.doesNotMatch(runtime, /scanFaceOverlay|scanBodyOverlay|#drawWorkerScanBitmap/u);
  assert.match(renderers, /TEACHING HUD/u);
  assert.doesNotMatch(renderers, /pointsFrom|drawConnections|drawLandmarks|POSE_CONNECTIONS|HAND_CONNECTIONS/u);
  assert.doesNotMatch(html, /placeholder metric|demo score|fake signal/iu);
});
