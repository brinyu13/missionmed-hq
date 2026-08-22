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

function runtimeHarness({ fixtureMode = false, fixture = null } = {}) {
  const documentRef = fakeDocument();
  const calls = { prime: 0, gum: 0, visibility: [], destroy: 0 };
  const bridge = {
    media: { cam: false, mic: false, stream: null, AC: null },
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
  }).mount();
  return { runtime, bridge, calls, renderer, documentRef };
}

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
  for (let index = 0; index < 75; index += 1) {
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
  assert.ok(diagnostics.filter((detail) => detail.modality === 'audio').length >= 75);
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

test('deterministic transcript timing refreshes as labelled aggregate windows without going stale', () => {
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
  for (let index = 0; index < 240; index += 1) {
    now += 50;
    scheduled();
  }
  assert.ok(timings.length >= 5);
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
});

test('default instruments fail closed and deterministic data is prominently identified as test input', async () => {
  const html = await readFile(new URL('../../public/live-analytics/index.html', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../../public/live-analytics/live-analytics.mjs', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../public/live-analytics/live-analytics.css', import.meta.url), 'utf8');
  assert.match(html, /UNAVAILABLE — validated transcript timing required/u);
  assert.match(html, /UNAVAILABLE — voiced F0 frames required/u);
  assert.match(runtime, /DETERMINISTIC TEST INPUT · LOCAL/u);
  assert.match(runtime, /local && requested/u);
  assert.match(css, /\[data-mode="interview"\] \.stage-overlay \{ opacity: 0; \}/u);
  assert.match(html, /class="fixture-backdrop"/u);
  assert.doesNotMatch(css, /\[data-mode="interview"\] \.fixture-backdrop/u);
  assert.equal((html.match(/data-live-scan-overlay=/gu) || []).length, 2);
  assert.match(runtime, /#drawWorkerScanBitmap\(this\.elements\.scanFaceOverlay, bitmap/u);
  assert.doesNotMatch(html, /placeholder metric|demo score|fake signal/iu);
});
