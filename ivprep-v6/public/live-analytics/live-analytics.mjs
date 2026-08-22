// Y1-Y2-CAM-V6-3521 — isolated Mock Interview Live Analytics Runtime (visual pass 4).
//
// There are two deliberately separate state machines in this file:
//   1. media/measurement, owned by LiveAnalyticsMediaBridge; and
//   2. presentation, owned by LiveAnalyticsPresentationState.
// Hiding an instrument never calls a media or analytics lifecycle method.

import { measurePcmFrame } from '../analytics/audio-signal.mjs';
import { estimateF0, PitchTrack } from '../analytics/pitch-f0.mjs';
import { SessionClock } from '../analytics/session-clock.mjs';
import { deriveCompactGeometry } from '../analytics/vision-geometry.mjs';
import { LiveHudRenderers } from './hud-renderers.mjs';
import { LocalTranscriptTimingProducer } from './local-transcript-timing.mjs';
import { LiveMetricProjector } from './live-metric-projector.mjs';
import { createLiveAnalyticsMediaBridge } from './media-bridge.mjs';
import {
  ANALYTICS_FAMILIES,
  ANALYTICS_METRIC_IDS,
  AnalyticsVisibilityState,
} from './visibility-state.mjs';

export { AnalyticsVisibilityState as LiveAnalyticsPresentationState } from './visibility-state.mjs';

export const LIVE_ANALYTICS_MODULES = Object.freeze([
  'head-face',
  'body',
  'volume',
  'speed',
  'modulation',
  'pitch',
]);

const VISION_MODULES = Object.freeze(['head-face', 'body']);
const VOICE_MODULES = Object.freeze(['volume', 'speed', 'modulation', 'pitch']);
const FIXTURE_QUERY = 'deterministic-local-signals';
const FIXTURE_SAMPLE_RATE = 48_000;
const FIXTURE_FRAME_SAMPLES = 2_048;
const VOCAL_VARIATION_WINDOW_MS = 60_000;
const VOCAL_VARIATION_MAX_SAMPLES = 1_200;

function fixtureLandmarks(frameIndex) {
  const phase = frameIndex / 9;
  const drift = Math.sin(phase) * 0.018;
  const face = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.34, z: 0 }));
  face[33] = { x: 0.445 + drift, y: 0.315, z: 0 };
  face[263] = { x: 0.555 + drift, y: 0.318, z: 0 };
  face[1] = { x: 0.5 + drift * 1.4, y: 0.35 + Math.cos(phase) * 0.005, z: -0.01 };
  face[152] = { x: 0.5 + drift, y: 0.445, z: 0 };

  const pose = Array.from({ length: 33 }, () => null);
  pose[11] = { x: 0.39 + drift, y: 0.49, z: 0, visibility: 0.99 };
  pose[12] = { x: 0.61 + drift, y: 0.49, z: 0, visibility: 0.99 };
  pose[23] = { x: 0.43, y: 0.77, z: 0, visibility: 0.98 };
  pose[24] = { x: 0.57, y: 0.77, z: 0, visibility: 0.98 };

  const hand = (side) => {
    const direction = side === 'left' ? -1 : 1;
    const values = Array.from({ length: 21 }, () => null);
    values[0] = { x: 0.5 + direction * 0.16, y: 0.64, z: 0 };
    values[8] = { x: 0.5 + direction * (0.22 + Math.sin(phase) * 0.015), y: 0.51, z: 0 };
    values[20] = { x: 0.5 + direction * 0.13, y: 0.53, z: 0 };
    return values;
  };

  return {
    faceLandmarks: [face],
    poseLandmarks: [pose],
    leftHandLandmarks: [hand('left')],
    rightHandLandmarks: [hand('right')],
  };
}

function fixtureFaceFamily(frameIndex) {
  const moving = Math.sin(frameIndex / 8) > 0.25;
  const channel = (values = {}) => Object.freeze({ availability: 'AVAILABLE', ...values });
  return Object.freeze({
    available: true,
    'FACE.SMILE': channel({ active: moving, bilateral: moving ? 0.31 : 0.16, symmetry: 0.93 }),
    'FACE.BLINK': channel({ closing: frameIndex % 37 === 0, count: Math.floor(frameIndex / 37) }),
    'FACE.BROW': channel({ active: moving, magnitude: moving ? 0.22 : 0.08 }),
    'FACE.PERIOCULAR': channel({ active: false, bilateral: 0.08 }),
    'FACE.GAZE': channel({ horizontal: 0.03, vertical: -0.02, offCentreMagnitude: 0.04, cameraFacing: true }),
  });
}

function fixtureFaceFamilySummary(frameIndex, atMs) {
  const facingRatio = 0.58 + Math.sin(frameIndex / 90) * 0.08;
  return Object.freeze({
    available: true,
    observedDurationMs: Math.max(1, atMs),
    cartridges: Object.freeze({
      'FACE.SMILE': Object.freeze({ availability: 'AVAILABLE', eventCount: Math.max(0, Math.floor(frameIndex / 64)) }),
      'FACE.BLINK': Object.freeze({ availability: 'AVAILABLE', eventCount: Math.max(0, Math.floor(frameIndex / 37)) }),
    }),
    cameraDwell: Object.freeze({
      available: true,
      cameraFacingRatio: facingRatio,
      offCameraRatio: 1 - facingRatio,
      longestFacingRunMs: Math.min(atMs, 3_400),
      gazeReleases: Math.max(0, Math.floor(frameIndex / 95)),
    }),
    movementVariability: Object.freeze({
      available: true,
      normalized: 0.32 + Math.sin(frameIndex / 17) * 0.16,
    }),
    fixture: 'DETERMINISTIC_LOCAL_TEST_SIGNAL',
  });
}

/**
 * A localhost-only, deterministic signal source used for visual QA without opening
 * physical devices. The metrics are still computed by the production DSP and compact
 * geometry functions; the UI is prominently labelled TEST INPUT.
 */
export class DeterministicLocalSignalFixture {
  constructor({
    now = () => performance.now(),
    setIntervalFn = (callback, delay) => setInterval(callback, delay),
    clearIntervalFn = (handle) => clearInterval(handle),
  } = {}) {
    this.now = now;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.clock = null;
    this.pitchTrack = new PitchTrack({ minVoicedFrames: 12, maxHistory: 300 });
    this.frameIndex = 0;
    this.interval = null;
    this.running = false;
    this.lastTranscriptTimingAtMs = null;
    this.onDiagnostic = null;
    this.onTranscriptTiming = null;
  }

  start({ onDiagnostic, onTranscriptTiming } = {}) {
    if (this.running) return this.clock;
    if (typeof onDiagnostic !== 'function') throw new TypeError('Fixture diagnostic consumer is required.');
    // The session clock begins with measurement, not when the page or fixture object
    // was constructed. Idle setup time must never inflate the interview duration.
    this.clock = new SessionClock({ sessionId: '3521-deterministic-local-signals', now: this.now });
    this.pitchTrack.reset();
    this.frameIndex = 0;
    this.lastTranscriptTimingAtMs = null;
    this.onDiagnostic = onDiagnostic;
    this.onTranscriptTiming = typeof onTranscriptTiming === 'function' ? onTranscriptTiming : null;
    this.running = true;
    this.step();
    this.interval = this.setIntervalFn(() => this.step(), 50);
    return this.clock;
  }

  step() {
    if (!this.running) return null;
    this.frameIndex += 1;
    const atMs = this.clock.sessionMs();
    const f0Hz = 182 + Math.sin(this.frameIndex / 13) * 24 + Math.sin(this.frameIndex / 5) * 7;
    const amplitude = 0.08 + (Math.sin(this.frameIndex / 7) + 1) * 0.055;
    const pcm = new Float32Array(FIXTURE_FRAME_SAMPLES);
    for (let index = 0; index < pcm.length; index += 1) {
      pcm[index] = amplitude * Math.sin(2 * Math.PI * f0Hz * index / FIXTURE_SAMPLE_RATE);
    }
    const measured = measurePcmFrame(pcm);
    const pitch = estimateF0(pcm, FIXTURE_SAMPLE_RATE);
    this.pitchTrack.push(pitch);
    this.onDiagnostic(Object.freeze({
      modality: 'audio',
      atMs,
      available: true,
      ...measured,
      pitch: Object.freeze({
        f0Hz: pitch.voiced ? pitch.f0Hz : null,
        voiced: pitch.voiced,
        clarity: pitch.confidence,
        summary: this.pitchTrack.summary(),
      }),
      speaking: true,
      pauseInProgressMs: 0,
      frameCount: this.frameIndex,
      inputLabel: 'DETERMINISTIC_LOCAL_TEST_SIGNAL',
    }));

    if (this.frameIndex === 1 || this.frameIndex % 3 === 0) {
      const geometry = deriveCompactGeometry(fixtureLandmarks(this.frameIndex), { faceCount: 1 });
      this.onDiagnostic(Object.freeze({
        modality: 'vision',
        atMs,
        geometry,
        primaryLock: Object.freeze({ state: 'PRIMARY_LOCKED', faceCount: 1, bystanderCount: 0 }),
        live: Object.freeze({
          gestureActive: this.frameIndex % 18 < 9 ? 'both' : null,
          headTurnActive: Math.abs(geometry.face.yawProxyDeg) > 4,
          postureMovementActive: Math.abs(geometry.pose.lateralLeanDeg) > 2,
          facialMovementActive: true,
        }),
        faceFamily: fixtureFaceFamily(this.frameIndex),
        faceFamilySummary: fixtureFaceFamilySummary(this.frameIndex, atMs),
        overlayRequested: true,
        overlayRendered: true,
        overlayPrimitiveCount: 31,
        inferenceMs: 0,
        targetFps: 8,
        droppedFrames: 0,
        inputLabel: 'DETERMINISTIC_LOCAL_TEST_SIGNAL',
      }));
    }

    if (atMs >= 3_000
      && (this.lastTranscriptTimingAtMs === null || atMs - this.lastTranscriptTimingAtMs >= 2_000)
      && this.onTranscriptTiming) {
      this.lastTranscriptTimingAtMs = atMs;
      const windowStartedAtMs = Math.max(0, atMs - 3_000);
      const durationMs = atMs - windowStartedAtMs;
      this.onTranscriptTiming(Object.freeze({
        atMs,
        windowStartedAtMs,
        windowEndedAtMs: atMs,
        wordCount: Math.max(3, Math.round(durationMs / 500)),
        provenance: Object.freeze({
          kind: 'DETERMINISTIC_TEST_TRANSCRIPT_TIMING',
          observed: false,
          source: 'DETERMINISTIC_TEST_TRANSCRIPT_TIMING',
          fixture: 'DETERMINISTIC_LOCAL_TEST_SIGNAL',
        }),
      }));
    }
    return atMs;
  }

  stop() {
    if (!this.running) return false;
    this.running = false;
    if (this.interval !== null) this.clearIntervalFn(this.interval);
    this.interval = null;
    return true;
  }
}

function setText(element, value) {
  if (element) element.textContent = String(value);
}

function canvasSize(canvas) {
  const ratio = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
  const width = Math.max(1, Math.round((canvas.clientWidth || 960) * ratio));
  const height = Math.max(1, Math.round((canvas.clientHeight || 540) * ratio));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width, height };
}

export class LiveAnalyticsRuntime {
  constructor({
    documentRef = globalThis.document,
    windowRef = globalThis.window,
    bridge = createLiveAnalyticsMediaBridge(),
    projector = new LiveMetricProjector(),
    presentation = new AnalyticsVisibilityState(),
    renderer = null,
    transcriptTimingProducer = null,
    fixtureMode = false,
    fixture = null,
  } = {}) {
    if (!documentRef) throw new TypeError('Live Analytics requires a document.');
    this.document = documentRef;
    this.window = windowRef;
    this.bridge = bridge;
    this.projector = projector;
    this.presentation = presentation;
    this.renderer = renderer || new LiveHudRenderers(documentRef);
    this.transcriptTiming = transcriptTimingProducer || new LocalTranscriptTimingProducer();
    this.transcriptTimingState = Object.freeze({ state: 'idle', reason: 'LOCAL_TRANSCRIPT_TIMING_IDLE' });
    this.fixtureMode = Boolean(fixtureMode);
    this.fixture = fixture || (this.fixtureMode ? new DeterministicLocalSignalFixture() : null);
    this.fixtureConnected = false;
    this.active = false;
    this.activeClock = null;
    this.clockTimer = null;
    this.pipeline = null;
    this.boundDiagnostic = (event) => this.consumeDiagnostic(event.detail || {});
    this.boundPipelineState = (event) => this.consumePipelineState(event.detail || {});
    this.boundReadiness = (event) => this.consumeReadiness(event.detail || {});
    this.boundDeviceChange = () => void this.refreshDevices().catch(() => false);
    this.boundPageHide = () => this.destroy();
    this.counts = { audio: 0, pitch: 0, wpm: 0, face: 0, body: 0, hand: 0 };
    this.latestAt = { audio: null, vision: null, transcript: null };
    this.metricEvents = Object.fromEntries(['VOLUME', 'SPEED_WPM', 'VOLUME_MODULATION', 'PITCH', 'HEAD_FACE', 'BODY_HANDS'].map((name) => [name, 0]));
    this.vocalVariationHistory = { volume: [], pitch: [], speed: [] };
    this.overlayVisibility = { face: true, hands: true, body: true, framing: true };
    this.overlayExpiryTimer = null;
    this.workerOverlayFresh = false;
    this.destroyed = false;
    this.elements = {};
  }

  mount() {
    const byId = (id) => this.document.getElementById(id);
    this.elements = {
      app: byId('live-analytics-app'),
      shell: byId('runtime-main'),
      video: byId('live-video'),
      fixtureBackdrop: byId('fixture-backdrop'),
      cameraEmpty: byId('camera-empty-state'),
      bodyOverlay: byId('body-overlay'),
      faceOverlay: byId('face-overlay'),
      headOverlay: byId('head-overlay'),
      scanFaceOverlay: this.document.querySelector('[data-live-scan-overlay="face"]'),
      scanBodyOverlay: this.document.querySelector('[data-live-scan-overlay="body"]'),
      status: byId('runtime-status'),
      captureIndicator: byId('capture-indicator'),
      clock: byId('session-clock'),
      measurement: byId('measurement-status'),
      measurementPresentation: byId('measurement-presentation-state'),
      streamQuality: byId('stream-quality'),
      cameraSelect: byId('camera-select'),
      microphoneSelect: byId('microphone-select'),
      connect: byId('connect-media'),
      stopCapture: byId('stop-capture'),
      refreshDevices: byId('refresh-devices'),
      start: byId('start-session'),
      end: byId('end-session'),
      reselectPrimary: byId('reselect-primary'),
      coaching: byId('mode-full-coaching'),
      interview: byId('mode-hidden-analytics'),
      hideAll: byId('hide-all-analytics'),
      restoreVision: byId('restore-vision-analytics'),
      restoreVoice: byId('restore-voice-analytics'),
      diagnostics: byId('founder-diagnostics'),
      toggleDiagnostics: byId('toggle-diagnostics'),
      closeDiagnostics: byId('close-diagnostics'),
      customizer: byId('analytics-customizer'),
      toggleCustomize: byId('toggle-customize'),
      closeCustomize: byId('close-customize'),
      resetVisibility: byId('reset-visibility'),
      visibilityAnnouncement: byId('visibility-announcement'),
    };

    if (!this.elements.app || !this.elements.shell) throw new Error('Live Analytics DOM contract is incomplete.');
    this.#bindControls();
    this.applyPresentation();
    this.render(this.projector.latest);
    this.updateDiagnostics();
    if (this.fixtureMode) this.#configureFixtureSurface();
    this.bridge.addEventListener?.('readinesschange', this.boundReadiness);
    this.bridge.addEventListener?.('devicechange', this.boundDeviceChange);
    this.window?.addEventListener?.('pagehide', this.boundPageHide, { once: true });
    return this;
  }

  #bindControls() {
    this.elements.connect?.addEventListener('click', () => void this.connect());
    this.elements.stopCapture?.addEventListener('click', () => void this.stopCapture());
    this.elements.refreshDevices?.addEventListener('click', () => void this.refreshDevices().catch(() => false));
    this.elements.start?.addEventListener('click', () => void this.start());
    this.elements.end?.addEventListener('click', () => void this.finish());
    this.elements.reselectPrimary?.addEventListener('click', () => {
      this.pipeline?.reselectPrimary?.();
      this.#clearOverlays();
      setText(this.elements.status, 'Primary-person selection reset · stay centered');
    });
    this.elements.coaching?.addEventListener('click', () => {
      this.presentation.selectPreset('full');
      this.applyPresentation();
    });
    this.elements.interview?.addEventListener('click', () => {
      this.presentation.setMode('interview');
      this.applyPresentation();
    });
    this.elements.hideAll?.addEventListener('click', () => {
      const allHidden = this.presentation.snapshot().visibleMetricIds.length === 0;
      this.presentation.setMode(allHidden ? 'coaching' : 'interview');
      this.applyPresentation();
    });
    this.elements.restoreVision?.addEventListener('click', () => {
      this.presentation.setRailVisible('vision', true);
      this.applyPresentation();
      this.#focusStableVisibilityControl();
    });
    this.elements.restoreVoice?.addEventListener('click', () => {
      this.presentation.setRailVisible('voice', true);
      this.applyPresentation();
      this.#focusStableVisibilityControl();
    });
    for (const button of this.document.querySelectorAll('[data-module-toggle]')) {
      button.addEventListener('click', () => {
        this.presentation.setModuleVisible(button.dataset.moduleToggle, false);
        this.applyPresentation();
        this.#focusStableVisibilityControl();
      });
    }
    for (const button of this.document.querySelectorAll('[data-module-restore]')) {
      button.addEventListener('click', () => {
        this.presentation.setModuleVisible(button.dataset.moduleRestore, true);
        this.applyPresentation();
        this.#focusStableVisibilityControl();
      });
    }
    for (const button of this.document.querySelectorAll('[data-metric-toggle]')) {
      button.addEventListener('click', () => {
        const id = button.dataset.metricToggle;
        const label = button.getAttribute('aria-label') || id;
        this.presentation.toggleMetric(id);
        this.applyPresentation();
        if (!this.presentation.snapshot().visibleMetricIds.includes(id)) this.#focusStableVisibilityControl();
        this.#announce(`${label.replace(/^Hide |^Show /, '')} ${this.presentation.snapshot().visibleMetricIds.includes(id) ? 'shown' : 'hidden'}. Measurement continues.`);
      });
    }
    for (const checkbox of this.document.querySelectorAll('[data-visibility-toggle]')) {
      checkbox.addEventListener('change', () => {
        this.presentation.setMetricVisible(checkbox.dataset.visibilityToggle, checkbox.checked);
        this.applyPresentation();
        this.#announce(`${checkbox.parentElement?.textContent?.trim() || checkbox.dataset.visibilityToggle} ${checkbox.checked ? 'shown' : 'hidden'}. Measurement continues.`);
      });
    }
    for (const control of this.document.querySelectorAll('[data-family-toggle], [data-family-checkbox]')) {
      const action = () => {
        const family = control.dataset.familyToggle || control.dataset.familyCheckbox;
        const currentlyOff = this.presentation.familyState(family) === 'off';
        this.presentation.setFamilyVisible(family, control.matches('input') ? control.checked : currentlyOff);
        this.applyPresentation();
        if (!control.matches('input') && this.presentation.familyState(family) === 'off') this.#focusStableVisibilityControl();
        this.#announce(`${family.replace('-', ' ')} visuals updated. Measurement continues.`);
      };
      control.addEventListener(control.matches('input') ? 'change' : 'click', action);
    }
    for (const button of this.document.querySelectorAll('[data-preset]')) {
      button.addEventListener('click', () => {
        this.presentation.selectPreset(button.dataset.preset);
        this.applyPresentation();
      });
    }
    for (const control of this.document.querySelectorAll('[data-overlay-toggle], [data-overlay-checkbox]')) {
      const eventName = control.matches('input') ? 'change' : 'click';
      control.addEventListener(eventName, () => {
        const layer = control.dataset.overlayToggle || control.dataset.overlayCheckbox;
        const visible = control.matches('input') ? control.checked : !this.overlayVisibility[layer];
        this.setOverlayVisible(layer, visible);
      });
    }
    this.elements.toggleCustomize?.addEventListener('click', () => this.setCustomizerVisible(this.elements.customizer?.hidden !== false));
    this.elements.closeCustomize?.addEventListener('click', () => this.setCustomizerVisible(false));
    this.elements.resetVisibility?.addEventListener('click', () => {
      this.presentation.resetCustom();
      this.applyPresentation();
      this.#announce('Analytics visibility reset to Minimal.');
    });
    this.document.addEventListener?.('keydown', (event) => {
      if (event.key === 'Escape' && this.elements.customizer?.hidden === false) this.setCustomizerVisible(false);
    });
    this.elements.toggleDiagnostics?.addEventListener('click', () => this.setDiagnosticsVisible(this.elements.diagnostics?.hidden !== false));
    this.elements.closeDiagnostics?.addEventListener('click', () => this.setDiagnosticsVisible(false));
    this.elements.cameraSelect?.addEventListener('change', () => void this.switchDevice('camera', this.elements.cameraSelect.value));
    this.elements.microphoneSelect?.addEventListener('change', () => void this.switchDevice('microphone', this.elements.microphoneSelect.value));
  }

  #configureFixtureSurface() {
    this.presentation.selectPreset('full');
    this.applyPresentation();
    this.elements.app.dataset.input = 'deterministic-test';
    setText(this.elements.connect?.querySelector('span'), 'Load deterministic test input');
    this.elements.cameraSelect.disabled = true;
    this.elements.microphoneSelect.disabled = true;
    setText(this.elements.cameraSelect.options?.[0], 'Local test camera');
    setText(this.elements.microphoneSelect.options?.[0], 'Local test microphone');
    setText(this.elements.streamQuality, 'LOCAL TEST INPUT · IDLE');
    setText(this.elements.measurement, 'Deterministic input available');
    this.elements.measurement.dataset.state = 'test';
    const message = this.elements.cameraEmpty?.querySelector('p');
    setText(message, 'Local synthetic PCM and landmark inputs are available for zero-permission visual QA.');
  }

  applyPresentation() {
    const snapshot = this.presentation.snapshot();
    const visible = new Set(snapshot.visibleMetricIds);
    for (const node of this.document.querySelectorAll('[data-visibility-metric]')) {
      node.hidden = !visible.has(node.dataset.visibilityMetric);
    }
    for (const checkbox of this.document.querySelectorAll('[data-visibility-toggle]')) {
      checkbox.checked = visible.has(checkbox.dataset.visibilityToggle);
    }
    for (const [family, state] of Object.entries(snapshot.familyState)) {
      const familyNode = this.document.querySelector(`[data-visibility-family="${family}"]`);
      if (familyNode) {
        const familyVisibleCount = ANALYTICS_FAMILIES[family].filter((id) => visible.has(id)).length;
        familyNode.dataset.familyState = state;
        familyNode.dataset.visibleCount = String(familyVisibleCount);
        familyNode.style?.setProperty('--family-visible-count', String(Math.max(1, familyVisibleCount)));
      }
      for (const control of this.document.querySelectorAll(`[data-family-toggle="${family}"], [data-family-checkbox="${family}"]`)) {
        if (control.matches('input')) {
          control.checked = state === 'on';
          control.indeterminate = state === 'mixed';
        } else {
          control.setAttribute('aria-pressed', String(state !== 'off'));
          control.dataset.state = state;
        }
      }
    }
    const headCollapsed = snapshot.familyState['head-face'] === 'off';
    const bodyCollapsed = snapshot.familyState['body-posture'] === 'off';
    const leftCollapsed = headCollapsed && bodyCollapsed;
    const rightCollapsed = snapshot.familyState['voice-delivery'] === 'off';
    const headSection = this.document.querySelector('[data-module="head-face"]');
    const bodySection = this.document.querySelector('[data-module="body"]');
    if (headSection) headSection.dataset.collapsed = String(headCollapsed);
    if (bodySection) bodySection.dataset.collapsed = String(bodyCollapsed);
    this.elements.shell.dataset.mode = snapshot.mode;
    this.elements.shell.dataset.preset = snapshot.preset;
    this.elements.shell.dataset.leftCollapsed = String(leftCollapsed);
    this.elements.shell.dataset.rightCollapsed = String(rightCollapsed);
    if (this.elements.restoreVision) this.elements.restoreVision.hidden = !leftCollapsed && snapshot.mode !== 'interview';
    if (this.elements.restoreVoice) this.elements.restoreVoice.hidden = !rightCollapsed && snapshot.mode !== 'interview';
    this.elements.coaching?.setAttribute('aria-pressed', String(snapshot.mode === 'coaching'));
    this.elements.interview?.setAttribute('aria-pressed', String(snapshot.mode === 'interview'));
    for (const button of this.document.querySelectorAll('[data-preset]')) {
      button.setAttribute('aria-pressed', String(button.dataset.preset === snapshot.preset));
    }
    setText(this.elements.hideAll, snapshot.visibleMetricIds.length === 0 ? 'Restore all analytics' : 'Hide all analytics');
    setText(
      this.elements.measurementPresentation,
      snapshot.visibleMetricIds.length === 0 ? 'Measuring · analytics hidden.' : 'Measuring · visible.',
    );
    this.document.body.dataset.analyticsMode = snapshot.preset;
    this.window?.requestAnimationFrame?.(() => this.renderer.resize());
    return snapshot;
  }

  #announce(message) { setText(this.elements.visibilityAnnouncement, message); }

  #focusStableVisibilityControl() {
    const target = this.elements.toggleCustomize || this.elements.hideAll;
    this.window?.requestAnimationFrame?.(() => target?.focus?.());
  }

  setCustomizerVisible(visible) {
    if (!this.elements.customizer) return false;
    this.elements.customizer.hidden = !visible;
    this.elements.toggleCustomize?.setAttribute('aria-expanded', String(Boolean(visible)));
    if (visible) this.elements.customizer.querySelector('h2')?.focus?.();
    else this.elements.toggleCustomize?.focus?.();
    return Boolean(visible);
  }

  setOverlayVisible(layer, visible) {
    if (!Object.hasOwn(this.overlayVisibility, layer)) throw new TypeError('Unknown video overlay layer.');
    this.overlayVisibility[layer] = Boolean(visible);
    for (const control of this.document.querySelectorAll(`[data-overlay-toggle="${layer}"], [data-overlay-checkbox="${layer}"]`)) {
      if (control.matches('input')) control.checked = this.overlayVisibility[layer];
      else control.setAttribute('aria-pressed', String(this.overlayVisibility[layer]));
    }
    this.#applyOverlayInstrumentation();
    if (!Object.values(this.overlayVisibility).some(Boolean)) this.#clearOverlays();
    return this.overlayVisibility[layer];
  }

  #applyOverlayInstrumentation() {
    this.pipeline?.setInstrumentation?.({
      overlayEnabled: Object.values(this.overlayVisibility).some(Boolean),
      faceOverlayEnabled: this.overlayVisibility.face,
      bodyHandsOverlayEnabled: this.overlayVisibility.body || this.overlayVisibility.hands,
      handsOverlayEnabled: this.overlayVisibility.hands,
      bodyOverlayEnabled: this.overlayVisibility.body,
      framingOverlayEnabled: this.overlayVisibility.framing,
    });
  }

  setDiagnosticsVisible(visible) {
    if (!this.elements.diagnostics) return false;
    this.elements.diagnostics.hidden = !visible;
    this.elements.toggleDiagnostics?.setAttribute('aria-expanded', String(Boolean(visible)));
    return Boolean(visible);
  }

  async connect() {
    if (this.fixtureMode) {
      this.fixtureConnected = true;
      this.elements.start.disabled = false;
      this.elements.connect.disabled = true;
      if (this.elements.stopCapture) this.elements.stopCapture.disabled = false;
      this.elements.cameraEmpty.hidden = true;
      this.#drawFixtureBackdrop();
      setText(this.elements.status, 'Deterministic local test input connected');
      setText(this.elements.streamQuality, 'DETERMINISTIC TEST INPUT · LOCAL');
      setText(this.elements.measurement, 'Test input connected · measurement idle');
      return true;
    }

    this.elements.connect.disabled = true;
    setText(this.elements.status, 'Requesting local camera and microphone');
    try {
      // Must occur in this synchronous user-gesture stack for WebKit.
      this.bridge.primeAudioContext();
      const audioId = this.elements.microphoneSelect?.value || '';
      const videoId = this.elements.cameraSelect?.value || '';
      const media = await this.bridge.requestMedia({
        audio: audioId ? { deviceId: { exact: audioId } } : true,
        video: videoId ? { deviceId: { exact: videoId } } : true,
      });
      this.elements.video.srcObject = media.stream;
      await this.elements.video.play?.();
      this.elements.cameraEmpty.hidden = Boolean(media.cam);
      this.elements.start.disabled = !(media.cam || media.mic);
      if (this.elements.stopCapture) this.elements.stopCapture.disabled = false;
      setText(this.elements.status, media.cam && media.mic ? 'Camera and microphone connected' : 'Partial media connected');
      setText(this.elements.streamQuality, media.cam ? 'CAMERA LIVE · LOCAL' : 'CAMERA UNAVAILABLE');
      await this.refreshDevices().catch(() => false);
      this.updateDiagnostics();
      return media;
    } catch (error) {
      this.bridge.stopMedia?.();
      if (this.elements.video) this.elements.video.srcObject = null;
      if (this.elements.cameraEmpty) this.elements.cameraEmpty.hidden = false;
      if (this.elements.start) this.elements.start.disabled = true;
      if (this.elements.stopCapture) this.elements.stopCapture.disabled = true;
      setText(this.elements.status, `Media unavailable · ${error?.name || 'request failed'}`);
      setText(this.elements.streamQuality, 'CAMERA IDLE');
      this.elements.connect.disabled = false;
      return false;
    }
  }

  async refreshDevices() {
    const devices = await (this.window?.navigator || globalThis.navigator)?.mediaDevices?.enumerateDevices?.();
    if (!Array.isArray(devices)) return false;
    this.#fillDeviceSelect(this.elements.cameraSelect, devices.filter((device) => device.kind === 'videoinput'), 'Camera');
    this.#fillDeviceSelect(this.elements.microphoneSelect, devices.filter((device) => device.kind === 'audioinput'), 'Microphone');
    return true;
  }

  #fillDeviceSelect(select, devices, label) {
    if (!select) return;
    const selected = select.value;
    select.replaceChildren();
    for (const [index, device] of devices.entries()) {
      const option = this.document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `${label} ${index + 1}`;
      select.append(option);
    }
    if (devices.some((device) => device.deviceId === selected)) select.value = selected;
  }

  async switchDevice(kind, deviceId) {
    if (this.fixtureMode || !deviceId || !this.bridge.media.stream) return false;
    const clock = this.activeClock;
    const pipeline = this.pipeline;
    try {
      const media = await this.bridge.switchDevice(kind, deviceId);
      this.elements.video.srcObject = media.stream;
      await this.elements.video.play?.();
      if (this.active && (clock !== this.activeClock || pipeline !== this.pipeline)) throw new Error('Active analytics identity changed during device switch.');
      if (kind === 'camera' && this.active) {
        this.#clearOverlays();
        this.pipeline?.reselectPrimary?.();
        if (!this.pipeline?.visionTimer) this.pipeline?.startVision?.(this.elements.video);
      }
      if (kind === 'microphone' && this.active) {
        this.transcriptTiming.stop();
        await this.#startTranscriptTiming();
      }
      setText(this.elements.status, `${kind === 'camera' ? 'Camera' : 'Microphone'} switched · measurement continuous`);
      this.updateDiagnostics();
      return media;
    } catch (error) {
      setText(this.elements.status, `${kind === 'camera' ? 'Camera' : 'Microphone'} switch failed · current device retained`);
      return false;
    }
  }

  async start() {
    if (this.active) return false;
    if (this.fixtureMode) {
      if (!this.fixtureConnected) return false;
      this.#resetMeasurementSession();
      this.activeClock = this.fixture.start({
        onDiagnostic: (detail) => this.consumeDiagnostic(detail),
        onTranscriptTiming: (evidence) => this.consumeTranscriptTiming(evidence),
      });
    } else {
      if (!this.bridge.media.stream) return false;
      this.#resetMeasurementSession();
      this.pipeline = this.bridge.ensureAnalytics();
      this.pipeline.addEventListener('diagnostic', this.boundDiagnostic);
      this.pipeline.addEventListener('state', this.boundPipelineState);
      this.#applyOverlayInstrumentation();
      this.pipeline.setOverlayConsumer((frame) => this.#drawWorkerOverlay(frame));
      this.bridge.startAnalytics({ videoElement: this.elements.video });
      this.activeClock = this.bridge.sessionClock;
    }
    this.active = true;
    this.elements.start.disabled = true;
    this.elements.end.disabled = false;
    this.elements.connect.disabled = true;
    this.elements.captureIndicator.dataset.state = 'live';
    this.elements.measurement.dataset.state = this.fixtureMode ? 'test' : 'live';
    setText(this.elements.status, this.fixtureMode ? 'Measuring local test input' : 'Live local measurement running');
    setText(this.elements.measurement, this.fixtureMode ? 'TEST INPUT · measurement live' : 'Measurement live');
    this.#startClockDisplay();
    this.updateDiagnostics();
    if (!this.fixtureMode) void this.#startTranscriptTiming();
    return true;
  }

  async #startTranscriptTiming() {
    const clock = this.activeClock;
    const stream = this.bridge.media.stream;
    const started = await this.transcriptTiming.start({
      stream,
      clock,
      onTiming: (evidence) => this.consumeTranscriptTiming(evidence),
      onState: (state) => this.consumeTranscriptTimingState(state),
    });
    if (!this.active || clock !== this.activeClock) {
      this.transcriptTiming.stop();
      return false;
    }
    return started;
  }

  #resetMeasurementSession() {
    this.projector.reset();
    this.counts = { audio: 0, pitch: 0, wpm: 0, face: 0, body: 0, hand: 0 };
    this.latestAt = { audio: null, vision: null, transcript: null };
    this.metricEvents = Object.fromEntries(['VOLUME', 'SPEED_WPM', 'VOLUME_MODULATION', 'PITCH', 'HEAD_FACE', 'BODY_HANDS'].map((name) => [name, 0]));
    this.vocalVariationHistory = { volume: [], pitch: [], speed: [] };
    this.#clearOverlays();
    this.render(this.projector.latest);
    this.updateDiagnostics();
  }

  consumeDiagnostic(detail) {
    const enriched = detail.modality === 'vision' && !detail.faceFamilySummary
      ? { ...detail, faceFamilySummary: this.pipeline?.faceFamily?.summary?.() || null }
      : detail;
    const snapshot = this.projector.ingest(enriched);
    if (['audio', 'vision'].includes(detail.modality) && Number.isFinite(detail.atMs)) this.latestAt[detail.modality] = detail.atMs;
    if (detail.modality === 'audio' && detail.available !== false) {
      this.counts.audio += 1;
      if (detail.pitch?.voiced === true) this.counts.pitch += 1;
      for (const name of ['VOLUME', 'VOLUME_MODULATION', 'PITCH']) this.metricEvents[name] += 1;
      this.#recordVocalVariationAudio(snapshot, detail.atMs);
    }
    if (detail.modality === 'vision' && detail.geometry) {
      if (detail.geometry.face?.present) this.counts.face += 1;
      if (detail.geometry.pose?.upperBodyPresent || detail.geometry.pose?.torsoPresent) this.counts.body += 1;
      if (detail.geometry.hands?.left?.present || detail.geometry.hands?.right?.present) this.counts.hand += 1;
      for (const name of ['HEAD_FACE', 'BODY_HANDS']) this.metricEvents[name] += 1;
      if (this.fixtureMode) this.#drawFixtureGeometry(detail.geometry);
      if (detail.primaryLock?.state !== 'PRIMARY_LOCKED') this.#clearOverlays();
    } else if (detail.modality === 'vision') {
      this.#clearOverlays();
    }
    this.render(snapshot);
    this.updateDiagnostics();
    return snapshot;
  }

  consumeTranscriptTiming(evidence) {
    const snapshot = this.projector.ingestTranscriptTiming(evidence, { allowDeterministicFixture: this.fixtureMode });
    if (Number.isFinite(evidence?.atMs)) this.latestAt.transcript = evidence.atMs;
    this.metricEvents.SPEED_WPM += 1;
    if (snapshot.metrics.SPEED_WPM.available) this.counts.wpm += 1;
    this.#recordVocalVariationSpeed(snapshot, evidence?.atMs);
    this.render(snapshot);
    this.updateDiagnostics();
    return snapshot;
  }

  #appendVocalVariationSample(traceName, atMs, value) {
    if (!Number.isFinite(atMs) || !Object.hasOwn(this.vocalVariationHistory, traceName)) return false;
    const trace = this.vocalVariationHistory[traceName];
    const sample = Object.freeze({
      atMs: Number(atMs),
      value: Number.isFinite(value) ? Number(value) : null,
    });
    if (Number.isFinite(trace.at(-1)?.atMs) && sample.atMs < trace.at(-1).atMs) return false;
    if (trace.at(-1)?.atMs === sample.atMs) trace[trace.length - 1] = sample;
    else trace.push(sample);
    const cutoff = sample.atMs - VOCAL_VARIATION_WINDOW_MS;
    while (trace.length && (trace[0].atMs < cutoff || trace.length > VOCAL_VARIATION_MAX_SAMPLES)) trace.shift();
    return true;
  }

  #recordVocalVariationAudio(snapshot, atMs) {
    const volume = snapshot?.metrics?.VOLUME;
    const pitch = snapshot?.metrics?.PITCH;
    this.#appendVocalVariationSample('volume', atMs, volume?.available === true ? volume.dbfs : null);
    this.#appendVocalVariationSample(
      'pitch',
      atMs,
      pitch?.available === true && pitch.voiced === true ? pitch.semitonesFromSpeakerMedian : null,
    );
  }

  #recordVocalVariationSpeed(snapshot, atMs) {
    const speed = snapshot?.metrics?.SPEED_WPM;
    this.#appendVocalVariationSample('speed', atMs, speed?.available === true ? speed.wordsPerMinute : null);
  }

  #vocalVariationFrame({ modulation, pitch, speed }) {
    const clone = (trace) => trace.map((sample) => ({ ...sample }));
    return {
      available: true,
      windowMs: VOCAL_VARIATION_WINDOW_MS,
      histories: {
        volume: clone(this.vocalVariationHistory.volume),
        pitch: clone(this.vocalVariationHistory.pitch),
        speed: clone(this.vocalVariationHistory.speed),
      },
      signalAvailability: {
        volume: modulation?.available === true,
        pitch: pitch?.available === true && pitch.voiced === true,
        pitchUnvoiced: pitch?.available === true && pitch.voiced === false,
        speed: speed?.available === true,
      },
      sources: {
        volume: modulation?.source || 'MIC_RMS_HISTORY',
        pitch: pitch?.source || 'VALIDATED_F0',
        speed: speed?.timingSource || null,
      },
      label: speed?.available === true ? 'NORMALIZED LIVE HISTORY · VOLUME + PITCH + SPEED' : 'NORMALIZED LIVE HISTORY · SPEED UNAVAILABLE',
      state: 'live',
    };
  }

  consumeTranscriptTimingState(state) {
    this.transcriptTimingState = Object.freeze({
      state: state?.state || 'unavailable',
      reason: state?.reason || 'LOCAL_TRANSCRIPT_TIMING_UNAVAILABLE',
      ...(state?.detail ? { detail: Object.freeze({ ...state.detail }) } : {}),
    });
    if (this.active && !this.fixtureMode) this.render(this.projector.latest);
    this.updateDiagnostics();
    return this.transcriptTimingState;
  }

  consumePipelineState(detail) {
    if (detail.state === 'partial') setText(this.elements.status, `Measurement partial · ${detail.message || detail.subsystem}`);
    if (detail.state === 'privacy-guard') setText(this.elements.status, 'Local privacy guard blocked an egress attempt');
    if (detail.state === 'primary-lock') {
      const selectionRequired = detail.primaryLock?.selectionRequired === true
        || detail.primaryLock?.state === 'PRIMARY_SELECTION_REQUIRED';
      if (this.elements.reselectPrimary) this.elements.reselectPrimary.hidden = !selectionRequired;
      if (selectionRequired || detail.primaryLock?.state !== 'PRIMARY_LOCKED') this.#clearOverlays();
    }
    if (detail.state === 'partial' && ['vision', 'all', 'multi-face'].includes(detail.subsystem)) this.#clearOverlays();
    this.updateDiagnostics();
  }

  consumeReadiness(detail) {
    if (this.destroyed) return false;
    const readiness = detail.readiness || this.bridge.readiness;
    const atMs = this.activeClock?.sessionMs?.() ?? 0;
    if (!readiness?.camera?.ready) {
      this.#clearOverlays();
      this.projector.ingest({
        modality: 'vision',
        atMs,
        geometry: null,
        primaryLock: { state: 'PRIMARY_TEMPORARILY_OCCLUDED' },
      });
      this.render(this.projector.latest);
    }
    if (!readiness?.microphone?.ready) {
      this.projector.ingest({ modality: 'audio', atMs, rms: null, pitch: null });
      this.render(this.projector.latest);
    }
    if (this.active && !readiness?.anyReady) setText(this.elements.status, 'Capture unavailable · reconnect media');
    else if (this.active && !readiness?.fullyReady) setText(this.elements.status, 'Measurement partial · one device unavailable');
    this.updateDiagnostics();
    return true;
  }

  async stopCapture() {
    if (this.active || this.fixture?.running) await this.finish();
    else if (this.fixtureMode) this.fixtureConnected = false;
    else this.bridge.stopMedia?.();
    if (this.elements.video) this.elements.video.srcObject = null;
    if (this.elements.cameraEmpty) this.elements.cameraEmpty.hidden = false;
    if (this.elements.fixtureBackdrop) this.elements.fixtureBackdrop.hidden = true;
    if (this.elements.connect) this.elements.connect.disabled = false;
    if (this.elements.start) this.elements.start.disabled = true;
    if (this.elements.stopCapture) this.elements.stopCapture.disabled = true;
    this.#clearOverlays();
    setText(this.elements.status, 'Live capture stopped · hardware released');
    setText(this.elements.streamQuality, 'CAMERA IDLE');
    return true;
  }

  render(snapshot) {
    const metrics = snapshot?.metrics || {};
    const volume = metrics.VOLUME || { available: false, reason: 'NO_AUDIO_FRAMES' };
    const projectedSpeed = metrics.SPEED_WPM || { available: false, reason: 'NO_TRUSTWORTHY_TRANSCRIPT_TIMING' };
    const timingFailure = ['unavailable', 'partial'].includes(this.transcriptTimingState.state);
    const timingWaiting = ['ready', 'live'].includes(this.transcriptTimingState.state)
      && projectedSpeed.reason === 'NO_TRUSTWORTHY_TRANSCRIPT_TIMING';
    const speed = projectedSpeed.available === false && this.active && !this.fixtureMode
      ? {
          ...projectedSpeed,
          reason: timingFailure
            ? this.transcriptTimingState.reason
            : timingWaiting
              ? (this.transcriptTimingState.reason === 'NEED_MORE_TIMED_WORDS'
                  ? 'NEED_MORE_TIMED_WORDS'
                  : 'WAITING_FOR_LOCAL_TIMED_WORDS')
              : projectedSpeed.reason,
        }
      : projectedSpeed;
    const modulation = metrics.VOLUME_MODULATION || { available: false, reason: 'NEED_MORE_RMS_HISTORY' };
    const pitch = metrics.PITCH || { available: false, reason: 'NO_VALIDATED_F0' };
    const headFace = metrics.HEAD_FACE || { available: false, reason: 'NO_VISION_FRAMES' };
    const bodyHands = metrics.BODY_HANDS || { available: false, reason: 'NO_VISION_FRAMES' };

    this.renderer.renderAll({
      volume: volume.available === false ? volume : {
        ...volume,
        corridor: [28 / 60, 44 / 60],
        zone: this.fixtureMode
          ? (volume.dbfs < -32 ? 'quiet' : volume.dbfs > -16 ? 'loud' : 'target')
          : 'observed',
        label: this.fixtureMode
          ? (volume.dbfs < -32 ? 'TEST LEVEL · BELOW REFERENCE' : volume.dbfs > -16 ? 'TEST LEVEL · ABOVE REFERENCE' : 'TEST LEVEL · REFERENCE BAND')
          : 'OBSERVED DEVICE LEVEL · NO CALIBRATED TARGET',
      },
      speed: speed.available === false ? speed : {
        ...speed,
        wpm: speed.wordsPerMinute,
        normalized: Math.max(0, Math.min(1, speed.wordsPerMinute / 240)),
        corridor: [110 / 240, 160 / 240],
        zone: speed.wordsPerMinute >= 110 && speed.wordsPerMinute <= 160 ? 'target' : 'neutral',
        label: `${speed.fixture ? 'DETERMINISTIC TEST TIMING' : 'OBSERVED WORD TIMING'} · ${speed.windowDurationMs} MS`,
      },
      modulation: this.#vocalVariationFrame({ modulation, pitch, speed }),
      pitch: pitch.available === false ? pitch : {
        ...pitch,
        semitones: pitch.semitonesFromSpeakerMedian,
        state: 'neutral',
        label: 'SPEAKER-RELATIVE · VALIDATED F0',
      },
      'head-face': headFace.available === false ? headFace : {
        available: true,
        present: headFace.facePresent,
        centered: headFace.faceCentered,
        yawProxyDeg: headFace.orientation?.yawProxyDeg,
        pitchProxyDeg: headFace.orientation?.pitchProxyDeg,
        rollProxyDeg: headFace.orientation?.rollProxyDeg,
        movementLabel: headFace.browMovement?.available ? (headFace.browMovement.active ? 'OBSERVED' : 'STABLE') : 'UNAVAILABLE',
        eventsLabel: headFace.blink?.available ? `${headFace.blink.count || 0} BLINK EVENTS` : 'UNAVAILABLE',
        mouthCornerElevation: headFace.mouthCornerElevation,
        periocularContraction: headFace.periocularContraction,
        gazeProxy: headFace.gazeProxy,
        smileEvents: headFace.smileEvents,
        cameraFacingDwell: headFace.cameraFacingDwell,
        blinkRate: headFace.blinkRate,
        geometryTrend: headFace.geometryTrend,
        headNods: headFace.headNods,
        transientOverlay: this.workerOverlayFresh,
        state: headFace.facePresent ? 'live' : 'unavailable',
      },
      body: bodyHands.available === false ? bodyHands : {
        available: true,
        present: bodyHands.upperBodyPresent || bodyHands.torsoPresent || bodyHands.hands?.left?.present || bodyHands.hands?.right?.present,
        centered: Number.isFinite(bodyHands.bodyCenter?.x) ? bodyHands.bodyCenter.x >= 0.35 && bodyHands.bodyCenter.x <= 0.65 : null,
        shoulderLabel: Number.isFinite(bodyHands.lateralLeanDeg) ? `${bodyHands.lateralLeanDeg.toFixed(1)}° LATERAL LEAN` : 'UNAVAILABLE',
        handsLabel: bodyHands.hands?.available
          ? `${bodyHands.hands.left.present ? 'L' : '—'}+${bodyHands.hands.right.present ? 'R' : '—'} OBSERVED`
          : 'UNAVAILABLE',
        gestureActive: Boolean(bodyHands.observableActivity?.handRegionActive),
        gestureLabel: bodyHands.observableActivity?.handRegionActive
          ? `${String(bodyHands.observableActivity.handRegionActive).toUpperCase()} HAND REGION ACTIVE`
          : 'NO HAND REGION EVENT',
        movementLevel: bodyHands.movementLevel,
        movementTrend: bodyHands.movementTrend,
        gestureEvents: bodyHands.gestureEvents,
        transientOverlay: this.workerOverlayFresh,
        state: 'live',
      },
    });
    const paceMirror = this.document.querySelector('[data-face-wpm]');
    setText(paceMirror, speed.available ? Math.round(speed.wordsPerMinute) : '—');
    if (paceMirror) paceMirror.dataset.state = speed.available ? 'live' : 'unavailable';
    return snapshot;
  }

  updateDiagnostics() {
    const media = this.bridge.media || {};
    const pipeline = this.pipeline?.diagnostics?.() || null;
    const settings = (track) => {
      try { return track?.getSettings?.() || {}; } catch { return {}; }
    };
    const cameraSettings = settings(media.cameraTrack);
    const microphoneSettings = settings(media.microphoneTrack);
    const trackState = (track) => track
      ? `${track.readyState || 'unknown'}/${track.enabled === false ? 'disabled' : 'enabled'}/${track.muted === true ? 'muted' : 'unmuted'}`
      : 'absent';
    const deviceId = (value) => value ? String(value).slice(0, 64) : 'UNAVAILABLE';
    const at = (value) => Number.isFinite(value) ? `${Math.round(value)}ms` : '—';
    const metricValue = (name, metric) => {
      if (!metric || metric.available === false) return `${name}:${metric?.reason || 'UNAVAILABLE'}`;
      if (name === 'VOLUME') return `${name}:${metric.dbfs}dBFS`;
      if (name === 'SPEED_WPM') return `${name}:${metric.wordsPerMinute}wpm`;
      if (name === 'VOLUME_MODULATION') return `${name}:${metric.rangeDb}dB`;
      if (name === 'PITCH') return `${name}:${metric.voiced ? `${metric.semitonesFromSpeakerMedian}st` : 'unvoiced'}`;
      if (name === 'HEAD_FACE') return `${name}:${metric.facePresent ? 'face' : 'no-face'}`;
      if (name === 'BODY_HANDS') return `${name}:${metric.torsoPresent ? 'torso' : metric.upperBodyPresent ? 'upper-body' : 'no-body'}/${metric.hands?.bothPresent ? 'both-hands' : 'partial-hands'}`;
      return `${name}:AVAILABLE`;
    };
    const projected = this.projector.latest?.metrics || {};
    const write = (name, value) => setText(this.document.querySelector(`[data-diagnostic="${name}"]`), value);
    write('media', this.fixtureMode
      ? `MEDIA · DETERMINISTIC TEST INPUT · PROVIDERS 0`
      : `MEDIA · CAM ${trackState(media.cameraTrack)} ID ${deviceId(cameraSettings.deviceId)} · MIC ${trackState(media.microphoneTrack)} ID ${deviceId(microphoneSettings.deviceId)} · VIDEO ${cameraSettings.width || this.elements.video?.videoWidth || '—'}×${cameraSettings.height || this.elements.video?.videoHeight || '—'}@${cameraSettings.frameRate || '—'} · PROVIDERS 0`);
    write('audio', `AUDIO · AC ${media.AC?.state || (this.fixtureMode ? 'TEST DSP' : 'NO CONTEXT')} @${media.AC?.sampleRate || (this.fixtureMode ? FIXTURE_SAMPLE_RATE : '—')}Hz · RMS FRAMES ${this.counts.audio} · LAST ${at(this.latestAt.audio)}`);
    write('pitch', `PITCH · F0 FRAMES ${this.counts.pitch} · ${metricValue('PITCH', projected.PITCH)}`);
    write('wpm', `TRANSCRIPT TIMING · WINDOWS ${this.counts.wpm} · ${metricValue('SPEED_WPM', projected.SPEED_WPM)} · LAST ${at(this.latestAt.transcript)} · PRODUCER ${this.transcriptTimingState.state.toUpperCase()}/${this.transcriptTimingState.reason}`);
    write('face', `VISION · WORKER ${pipeline?.workerReady ? 'READY' : (this.fixtureMode ? 'TEST INPUT' : 'IDLE')} · FACE WORKER ${pipeline?.faceWorkerReady ? 'READY' : (this.fixtureMode ? 'TEST INPUT' : 'IDLE')} · FACE FRAMES ${this.counts.face} · LOCK ${pipeline?.primaryLock?.state || (this.fixtureMode && this.active ? 'TEST PRIMARY' : 'UNAVAILABLE')} · LAST ${at(this.latestAt.vision)}`);
    write('body', `BODY FRAMES ${this.counts.body} · HAND FRAMES ${this.counts.hand} · TARGET FPS ${pipeline?.targetFps || (this.fixtureMode ? 8 : '—')} · DROPPED ${pipeline?.droppedFrames || 0} · STALE GUARD ACTIVE`);
    write('metrics', `METRIC BUS · ${Object.entries(projected).map(([name, metric]) => `${metricValue(name, metric)} · events ${this.metricEvents[name] || 0} · at ${at(metric?.atMs ?? this.projector.latest?.atMs)}`).join('  |  ')}`);
  }

  #startClockDisplay() {
    clearInterval(this.clockTimer);
    const update = () => {
      const milliseconds = this.activeClock?.sessionMs?.() || 0;
      const totalSeconds = Math.floor(milliseconds / 1_000);
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
      const seconds = String(totalSeconds % 60).padStart(2, '0');
      setText(this.elements.clock, `${minutes}:${seconds}`);
    };
    update();
    this.clockTimer = setInterval(update, 250);
  }

  async finish() {
    if (!this.active && !this.bridge.media.stream && !this.fixture?.running) return false;
    clearInterval(this.clockTimer);
    this.clockTimer = null;
    if (this.fixtureMode) {
      this.fixture.stop();
    } else {
      this.transcriptTiming.stop();
      this.bridge.endAnalytics({ transcript: '', mediaAvailable: Boolean(this.bridge.media.stream) });
      this.pipeline?.removeEventListener?.('diagnostic', this.boundDiagnostic);
      this.pipeline?.removeEventListener?.('state', this.boundPipelineState);
      this.bridge.stopMedia();
      if (this.elements.video) this.elements.video.srcObject = null;
    }
    this.active = false;
    this.activeClock = null;
    this.pipeline = null;
    this.transcriptTimingState = Object.freeze({ state: 'idle', reason: 'LOCAL_TRANSCRIPT_TIMING_IDLE' });
    this.elements.end.disabled = true;
    this.elements.start.disabled = this.fixtureMode ? !this.fixtureConnected : true;
    this.elements.connect.disabled = this.fixtureMode ? true : false;
    if (this.elements.stopCapture) this.elements.stopCapture.disabled = true;
    this.elements.captureIndicator.dataset.state = 'idle';
    this.elements.measurement.dataset.state = 'idle';
    for (const node of this.document.querySelectorAll?.('.analytics-stack .capture-state') || []) {
      node.dataset.state = 'idle';
      node.textContent = '● Idle';
    }
    setText(this.elements.status, 'Measurement stopped · local media released');
    setText(this.elements.measurement, 'Measurement stopped');
    this.#clearOverlays();
    this.updateDiagnostics();
    return true;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    clearInterval(this.clockTimer);
    this.clockTimer = null;
    clearTimeout(this.overlayExpiryTimer);
    this.overlayExpiryTimer = null;
    this.fixture?.stop?.();
    this.transcriptTiming.stop();
    this.pipeline?.removeEventListener?.('diagnostic', this.boundDiagnostic);
    this.pipeline?.removeEventListener?.('state', this.boundPipelineState);
    this.bridge.destroy?.();
    this.bridge.removeEventListener?.('readinesschange', this.boundReadiness);
    this.bridge.removeEventListener?.('devicechange', this.boundDeviceChange);
    this.window?.removeEventListener?.('pagehide', this.boundPageHide);
    this.renderer.destroy?.();
    this.#clearOverlays();
    this.active = false;
    this.activeClock = null;
    this.pipeline = null;
  }

  #drawWorkerOverlay({ bitmap, geometry }) {
    const canvas = this.elements.bodyOverlay;
    if (!canvas || !bitmap) return;
    const { width, height } = canvasSize(canvas);
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    this.workerOverlayFresh = true;
    const bitmapWidth = Number(bitmap.width) || width;
    const bitmapHeight = Number(bitmap.height) || height;
    const scale = Math.max(width / bitmapWidth, height / bitmapHeight);
    const drawWidth = bitmapWidth * scale;
    const drawHeight = bitmapHeight * scale;
    context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    const face = geometry?.face?.box;
    this.#drawWorkerScanBitmap(this.elements.scanFaceOverlay, bitmap, face ? {
      left: face.left - face.width * .18,
      top: face.top - face.height * .16,
      width: face.width * 1.36,
      height: face.height * 1.34,
    } : null);
    this.#drawWorkerScanBitmap(this.elements.scanBodyOverlay, bitmap, {
      left: .12,
      top: .08,
      width: .76,
      height: .84,
    });
    clearTimeout(this.overlayExpiryTimer);
    this.overlayExpiryTimer = setTimeout(() => this.#clearOverlays(), 1_500);
  }

  #drawWorkerScanBitmap(canvas, bitmap, crop) {
    if (!canvas || !bitmap || !crop) return;
    const { width, height } = canvasSize(canvas);
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    const bitmapWidth = Number(bitmap.width) || width;
    const bitmapHeight = Number(bitmap.height) || height;
    const left = Math.max(0, Math.min(1, Number(crop.left) || 0));
    const top = Math.max(0, Math.min(1, Number(crop.top) || 0));
    const cropWidth = Math.max(.01, Math.min(1 - left, Number(crop.width) || 1));
    const cropHeight = Math.max(.01, Math.min(1 - top, Number(crop.height) || 1));
    context.drawImage(
      bitmap,
      left * bitmapWidth,
      top * bitmapHeight,
      cropWidth * bitmapWidth,
      cropHeight * bitmapHeight,
      0,
      0,
      width,
      height,
    );
  }

  #clearOverlays() {
    clearTimeout(this.overlayExpiryTimer);
    this.overlayExpiryTimer = null;
    this.workerOverlayFresh = false;
    for (const canvas of [
      this.elements.bodyOverlay,
      this.elements.faceOverlay,
      this.elements.headOverlay,
      this.elements.scanFaceOverlay,
      this.elements.scanBodyOverlay,
    ]) {
      if (!canvas?.getContext) continue;
      const context = canvas.getContext('2d');
      context?.clearRect?.(0, 0, canvas.width || 1, canvas.height || 1);
    }
  }

  #drawFixtureBackdrop() {
    const canvas = this.elements.fixtureBackdrop;
    if (!canvas) return;
    canvas.hidden = false;
    const { width, height } = canvasSize(canvas);
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#c8b692');
    gradient.addColorStop(.43, '#d9c66c');
    gradient.addColorStop(1, '#6f5735');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    // Deterministic, visibly synthetic room/person backdrop. It approximates the
    // Founder composition without pretending to be a live camera frame.
    context.fillStyle = '#5d311d';
    context.fillRect(0, height * .43, width * .23, height * .57);
    context.fillStyle = '#8a552e';
    context.fillRect(width * .04, height * .50, width * .15, height * .37);
    context.strokeStyle = '#5d442b';
    context.lineWidth = Math.max(3, width * .004);
    context.strokeRect(width * .82, height * .42, width * .13, height * .20);
    context.fillStyle = 'rgba(229,216,169,.62)';
    context.fillRect(width * .835, height * .44, width * .10, height * .16);

    context.save();
    context.fillStyle = '#343945';
    context.beginPath();
    context.moveTo(width * .36, height);
    context.quadraticCurveTo(width * .37, height * .55, width * .44, height * .49);
    context.quadraticCurveTo(width * .50, height * .45, width * .57, height * .49);
    context.quadraticCurveTo(width * .66, height * .58, width * .72, height);
    context.closePath();
    context.fill();
    context.fillStyle = '#b97753';
    context.fillRect(width * .475, height * .43, width * .05, height * .09);
    context.fillStyle = '#c9855c';
    context.beginPath();
    context.ellipse(width * .50, height * .35, width * .072, height * .12, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2b241e';
    context.beginPath();
    context.ellipse(width * .50, height * .27, width * .078, height * .055, -.05, Math.PI, Math.PI * 2);
    context.lineTo(width * .56, height * .30);
    context.quadraticCurveTo(width * .51, height * .26, width * .43, height * .31);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(74,42,31,.70)';
    context.lineWidth = Math.max(2, width * .002);
    context.beginPath();
    context.moveTo(width * .466, height * .35);
    context.lineTo(width * .484, height * .35);
    context.moveTo(width * .516, height * .35);
    context.lineTo(width * .534, height * .35);
    context.moveTo(width * .482, height * .40);
    context.quadraticCurveTo(width * .50, height * .415, width * .521, height * .395);
    context.stroke();

    const skin = '#ca825c';
    context.strokeStyle = skin;
    context.fillStyle = skin;
    context.lineCap = 'round';
    context.lineWidth = width * .027;
    context.beginPath();
    context.moveTo(width * .39, height * .58);
    context.lineTo(width * .30, height * .55);
    context.lineTo(width * .26, height * .47);
    context.stroke();
    context.beginPath();
    context.ellipse(width * .255, height * .45, width * .038, height * .065, -.18, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = width * .012;
    for (const [dx, top] of [[-.032,.29],[-.012,.26],[.010,.27],[.030,.31]]) {
      context.beginPath();
      context.moveTo(width * (.255 + dx), height * .44);
      context.lineTo(width * (.255 + dx * .9), height * top);
      context.stroke();
    }
    context.restore();

    const vignette = context.createRadialGradient(width * .5, height * .43, width * .18, width * .5, height * .5, width * .72);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(2,8,15,.38)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);
  }

  #drawFixtureGeometry(geometry) {
    const canvas = this.elements.bodyOverlay;
    if (!canvas) return;
    const { width, height } = canvasSize(canvas);
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    context.save();
    context.strokeStyle = 'rgba(88, 238, 221, 0.92)';
    context.fillStyle = 'rgba(88, 238, 221, 0.88)';
    context.lineWidth = Math.max(2, width / 700);
    context.setLineDash([width / 120, width / 170]);
    const face = geometry.face?.box;
    if (face && this.overlayVisibility.framing) {
      context.strokeRect(face.left * width, face.top * height, face.width * width, face.height * height);
      context.beginPath();
      context.moveTo(face.centerX * width - face.width * width * 0.35, face.centerY * height);
      context.lineTo(face.centerX * width + face.width * width * 0.35, face.centerY * height);
      context.moveTo(face.centerX * width, face.centerY * height - face.height * height * 0.35);
      context.lineTo(face.centerX * width, face.centerY * height + face.height * height * 0.35);
      context.stroke();
    }
    if (face && this.overlayVisibility.face) {
      const faceX = face.centerX * width;
      const faceY = face.centerY * height;
      const faceRx = face.width * width * .46;
      const faceRy = face.height * height * .48;
      context.beginPath();
      context.ellipse(faceX, faceY, faceRx, faceRy, 0, 0, Math.PI * 2);
      context.stroke();
      for (const fraction of [-.31, -.12, .10, .30]) {
        context.beginPath();
        context.moveTo((face.left + face.width * .12) * width, (face.centerY + face.height * fraction) * height);
        context.quadraticCurveTo(face.centerX * width, (face.centerY + face.height * fraction * .7) * height, (face.left + face.width * .88) * width, (face.centerY + face.height * fraction) * height);
        context.stroke();
      }
      for (const fraction of [-.58, -.28, 0, .28, .58]) {
        context.beginPath();
        context.moveTo(faceX, faceY - faceRy);
        context.quadraticCurveTo(faceX + faceRx * fraction, faceY, faceX + faceRx * fraction * .34, faceY + faceRy);
        context.stroke();
      }
      context.lineWidth = Math.max(1.5, width / 900);
      for (const side of [-1, 1]) {
        context.beginPath();
        context.moveTo(faceX + side * faceRx * .62, faceY - faceRy * .22);
        context.quadraticCurveTo(faceX + side * faceRx * .34, faceY - faceRy * .34, faceX + side * faceRx * .10, faceY - faceRy * .22);
        context.stroke();
        context.beginPath();
        context.ellipse(faceX + side * faceRx * .38, faceY - faceRy * .10, faceRx * .18, faceRy * .065, 0, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(faceX, faceY - faceRy * .08);
      context.lineTo(faceX - faceRx * .10, faceY + faceRy * .24);
      context.lineTo(faceX + faceRx * .12, faceY + faceRy * .25);
      context.stroke();
      context.beginPath();
      context.moveTo(faceX - faceRx * .38, faceY + faceRy * .48);
      context.quadraticCurveTo(faceX, faceY + faceRy * .63, faceX + faceRx * .38, faceY + faceRy * .48);
      context.stroke();
    }
    context.setLineDash([]);
    // The deterministic fixture keeps the Founder camera surface visually quiet.
    // Physical capture still receives the worker-rendered live pose overlay; the
    // fixture's compact posture proxy remains visible in the left scanner/readouts.
    for (const hand of [geometry.hands?.left, geometry.hands?.right]) {
      if (!hand?.present || !this.overlayVisibility.hands) continue;
      const side = hand.centerX < .5 ? -1 : 1;
      const wristX = hand.centerX * width;
      const wristY = hand.centerY * height;
      context.beginPath();
      context.moveTo((side < 0 ? .39 : .61) * width, height * .50);
      context.lineTo(wristX, wristY);
      context.stroke();
      context.beginPath();
      context.moveTo(wristX - side * width * .006, wristY + height * .012);
      context.lineTo(wristX - side * width * .018, wristY - height * .010);
      context.lineTo(wristX + side * width * .003, wristY - height * .030);
      context.lineTo(wristX + side * width * .018, wristY - height * .004);
      context.closePath();
      context.stroke();
      for (let finger = -2; finger <= 2; finger += 1) {
        context.beginPath();
        context.moveTo(wristX, wristY - height * .018);
        context.lineTo(wristX + side * width * (.012 + finger * .004), wristY - height * (.050 + (2 - Math.abs(finger)) * .008));
        context.stroke();
      }
    }
    context.restore();
  }
}

function localhostFixtureEnabled(locationRef = globalThis.location) {
  if (!locationRef) return false;
  const local = ['127.0.0.1', 'localhost', '::1'].includes(locationRef.hostname);
  const requested = new URLSearchParams(locationRef.search).get('testInput') === FIXTURE_QUERY;
  return local && requested;
}

if (typeof document !== 'undefined' && document.getElementById('live-analytics-app')) {
  const runtime = new LiveAnalyticsRuntime({ fixtureMode: localhostFixtureEnabled() }).mount();
  const localQa = typeof location !== 'undefined'
    && ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
  if (localQa) {
    // Local-only, read-only QA seam. Never expose the bridge, media stream, pipeline,
    // raw landmarks, PCM, device identifiers, or lifecycle mutation methods.
    globalThis.__IVPREP_LIVE_ANALYTICS_QA__ = Object.freeze({
      snapshot: () => Object.freeze({
        fixtureMode: runtime.fixtureMode,
        active: runtime.active,
        presentation: runtime.presentation.snapshot(),
        metrics: runtime.projector.latest,
        counts: Object.freeze({ ...runtime.counts }),
        latestAt: Object.freeze({ ...runtime.latestAt }),
        transcriptTiming: runtime.transcriptTimingState,
      }),
    });
  }
}
