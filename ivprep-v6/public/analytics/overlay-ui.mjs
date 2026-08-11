import { LocalPlaybackOverlayRuntime } from './playback-overlay.mjs';
import { LOCAL_OVERLAY_AUTHORITY_COPY, LocalOverlaySettings } from './overlay-policy.mjs';

const LOCAL_AUTHORITY_LABEL = LOCAL_OVERLAY_AUTHORITY_COPY.join(' · ');
const OVERLAY_RENDER_REASON_COPY = Object.freeze({
  display_disabled: 'DISPLAY IS DISABLED',
  face_count_not_one: 'EXACTLY ONE PERSON IS REQUIRED',
  render_surface_unavailable: 'THIS BROWSER CANNOT CREATE THE LOCAL OVERLAY SURFACE',
  no_renderable_primitives: 'NO FACE OR BODY LANDMARKS WERE RENDERABLE FOR THIS FRAME',
  render_failed: 'THE LOCAL OVERLAY RENDERER FAILED FOR THIS FRAME',
  bitmap_transfer_failed: 'THE LOCAL OVERLAY FRAME COULD NOT BE TRANSFERRED',
  layer_mask_changed: 'THE FACE OR BODY DISPLAY SETTING CHANGED DURING THIS FRAME',
  overlay_bitmap_unavailable: 'NO LOCAL OVERLAY FRAME WAS AVAILABLE',
  canvas_blit_failed: 'THE LOCAL PLAYBACK CANVAS COULD NOT DRAW THIS OVERLAY FRAME',
  vision_unavailable: 'LOCAL VISUAL ANALYSIS IS UNAVAILABLE',
});

function node(documentRef, tag, className = '', text = '') {
  const value = documentRef.createElement(tag);
  if (className) value.className = className;
  if (text) value.textContent = text;
  return value;
}

function checkbox(documentRef, { id, label, checked, disabled = false, preferenceKey = null }) {
  const wrapper = node(documentRef, 'label', 'ca-overlay-toggle');
  const input = documentRef.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = Boolean(checked);
  input.disabled = Boolean(disabled);
  if (preferenceKey) input.dataset.overlayPreference = preferenceKey;
  wrapper.append(input, documentRef.createTextNode(label));
  return { wrapper, input };
}

export function overlayCoverDrawRect(sourceWidth, sourceHeight, surfaceWidth, surfaceHeight) {
  if (![sourceWidth, sourceHeight, surfaceWidth, surfaceHeight].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.max(surfaceWidth / sourceWidth, surfaceHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return Object.freeze({ width, height, left: (surfaceWidth - width) / 2, top: (surfaceHeight - height) / 2 });
}

export function overlayMirrorTransform(video) {
  return video?.style?.transform === 'scaleX(1)' ? 'scaleX(1)' : 'scaleX(-1)';
}

export function overlayPreferenceKeys(role, surface) {
  if (role === 'student') return Object.freeze({
    face: surface === 'live' ? 'studentLiveFace' : 'studentPlaybackFace',
    body: surface === 'live' ? 'studentLiveBody' : 'studentPlaybackBody',
  });
  if (role === 'admin') return Object.freeze({
    face: surface === 'live' ? 'founderLiveFace' : 'founderPlaybackFace',
    body: surface === 'live' ? 'founderLiveBody' : 'founderPlaybackBody',
  });
  if (role === 'coach' && surface === 'playback') return Object.freeze({ face: 'coachPlaybackFace', body: 'coachPlaybackBody' });
  return null;
}

export function overlayAvailabilityCopy(layers) {
  if (layers?.reason === 'disabled_by_local_admin_master') return 'OVERLAY OFF IN LOCAL ADMIN SETTINGS · ANALYTICS CONTINUE WITHOUT DISPLAY';
  if (layers?.reason === 'student_overlay_disabled_by_local_admin') return 'STUDENT OVERLAY NOT ALLOWED IN THIS BROWSER · ANALYTICS CONTINUE WITHOUT DISPLAY';
  if (layers?.reason === 'all_layers_hidden') return 'FACE + BODY HIDDEN · ANALYTICS CONTINUE WITHOUT DISPLAY';
  if (!layers?.allowed) return 'OVERLAY UNAVAILABLE FOR THIS ROLE OR VIEW';
  return `LOCAL OVERLAY ${layers.overlayEnabled ? 'ENABLED' : 'HIDDEN'} · FACE ${layers.faceEnabled ? 'ON' : 'OFF'} · BODY ${layers.bodyEnabled ? 'ON' : 'OFF'} · ANALYTICS UNCHANGED`;
}

export function overlayRenderStatusCopy(detail = {}, { playback = false } = {}) {
  const continuity = playback ? 'VIDEO PLAYBACK IS UNCHANGED' : 'ANALYTICS CONTINUE';
  const status = detail.overlayStatus || detail.state;
  const reason = OVERLAY_RENDER_REASON_COPY[detail.overlayUnavailableReason || detail.reason]
    || 'THE LOCAL OVERLAY FRAME WAS NOT RENDERABLE';
  if (status === 'error' || status === 'overlay-error') return `OVERLAY DISPLAY ERROR · ${reason} · ${continuity}`;
  if (status === 'unavailable') return `OVERLAY TEMPORARILY UNAVAILABLE · ${reason} · ${continuity}`;
  if (status === 'rendered') return `LOCAL OVERLAY RENDERED · ${continuity}`;
  return null;
}

function clearCanvas(canvas) {
  const context = canvas?.getContext?.('2d');
  if (!canvas || !context) return;
  try {
    context.setTransform?.(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  } catch {}
}

function setText(target, value) {
  if (target && target.textContent !== value) target.textContent = value;
}

function canvasSurface(canvas, fallbackWidth = 320, fallbackHeight = 180) {
  const rect = canvas?.getBoundingClientRect?.() || {};
  const cssWidth = Math.max(1, Math.round(rect.width || canvas?.clientWidth || fallbackWidth));
  const cssHeight = Math.max(1, Math.round(rect.height || canvas?.clientHeight || fallbackHeight));
  const ratio = Math.max(1, Math.min(2, globalThis.devicePixelRatio || 1));
  const width = Math.round(cssWidth * ratio);
  const height = Math.round(cssHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext?.('2d');
  context?.setTransform?.(ratio, 0, 0, ratio, 0, 0);
  return context ? { context, width: cssWidth, height: cssHeight } : null;
}

function videoHasLocalSource(video) {
  if (!video) return false;
  return Boolean(video.srcObject || video.getAttribute?.('src') || video.currentSrc);
}

export class OverlayUiController {
  constructor({
    bridge,
    pipeline,
    settings = new LocalOverlaySettings(),
    documentRef = globalThis.document,
    windowRef = globalThis.window,
    PlaybackRuntime = LocalPlaybackOverlayRuntime,
  } = {}) {
    if (!bridge || !pipeline || !documentRef) throw new TypeError('Overlay UI requires the V6 bridge, analytics pipeline, and document.');
    this.bridge = bridge;
    this.pipeline = pipeline;
    this.settings = settings;
    this.document = documentRef;
    this.window = windowRef;
    this.PlaybackRuntime = PlaybackRuntime;
    this.role = bridge.role;
    this.view = bridge.view;
    this.liveCanvas = null;
    this.liveControls = null;
    this.playbackBindings = new Map();
    this.mainLayers = null;
    this.syncQueued = false;
    this.destroyed = false;
    this.onSettingsChange = () => {
      this.applyMainLiveLayers();
      this.refreshMountedControls();
      this.scheduleSync();
    };
    this.onPipelineState = (event) => this.consumePipelineState(event?.detail || {});
    this.settings.addEventListener('change', this.onSettingsChange);
    this.pipeline.setOverlayConsumer?.((payload) => this.consumeMainOverlay(payload));
    this.pipeline.addEventListener?.('state', this.onPipelineState);
    this.observedMutationTargets = new WeakSet();
    this.observer = typeof globalThis.MutationObserver === 'function'
      ? new globalThis.MutationObserver(() => this.scheduleSync())
      : null;
    this.mirrorObserver = typeof globalThis.MutationObserver === 'function'
      ? new globalThis.MutationObserver(() => this.syncLiveMirror())
      : null;
    this.mirrorVideo = null;
    this.observeHostTargets();
    this.scheduleSync();
  }

  onViewChange(view, role) {
    this.view = view;
    this.role = role;
    this.clearMainOverlay();
    this.applyMainLiveLayers();
    this.destroyPlaybackBindings();
    this.scheduleSync();
  }

  beforeBeginAnswer() {
    this.role = this.bridge.role;
    this.view = this.bridge.view;
    this.sync();
    return this.applyMainLiveLayers();
  }

  scheduleSync() {
    if (this.destroyed || this.syncQueued) return;
    this.syncQueued = true;
    queueMicrotask(() => {
      this.syncQueued = false;
      if (!this.destroyed) this.sync();
    });
  }

  sync() {
    if (this.destroyed) return;
    this.observeHostTargets();
    this.role = this.bridge.role;
    this.view = this.bridge.view;
    if (this.role === 'admin' && this.view === 'ops') this.mountAdminPolicyPanel();
    else this.document.getElementById('communication-overlay-admin-policy')?.remove?.();
    if (this.role === 'student' && this.view === 'room') this.mountStudentLiveControls();
    else this.unmountStudentLiveControls();
    this.syncPlaybackTargets();
    this.applyMainLiveLayers();
    this.refreshMountedControls();
  }

  observeHostTargets() {
    if (!this.observer) return;
    for (const selector of ['section[data-view="results"]', 'section[data-view="mreview"]', '#communication-analytics-test-root']) {
      const target = this.document.querySelector?.(selector);
      if (!target || this.observedMutationTargets.has(target)) continue;
      this.observer.observe(target, { subtree: true, childList: true });
      this.observedMutationTargets.add(target);
    }
    for (const id of ['playback', 'mrVideo', 'communication-analytics-founder-replay']) {
      const target = this.document.getElementById(id);
      if (!target || this.observedMutationTargets.has(target)) continue;
      this.observer.observe(target, { attributes: true, attributeFilter: ['src', 'style'] });
      this.observedMutationTargets.add(target);
    }
  }

  mountAdminPolicyPanel() {
    const section = this.document.querySelector('section[data-view="ops"]');
    if (!section || this.document.getElementById('communication-overlay-admin-policy')) return;
    const panel = node(this.document, 'div', 'panel ca-overlay-admin-panel');
    panel.id = 'communication-overlay-admin-policy';
    const pad = node(this.document, 'div', 'pPad');
    const heading = node(this.document, 'h2', 'pLbl', 'Camera overlay display policy');
    heading.id = 'communication-overlay-admin-policy-title';
    const authority = node(this.document, 'p', 'ca-overlay-authority', LOCAL_AUTHORITY_LABEL);
    const note = node(this.document, 'p', 'ca-overlay-note', 'Display controls only. The setting is stored as booleans in this browser; it is not an authenticated organization policy and does not change analytics collection or results. Interview Vault bare pop-up playback is not supported in this local alpha.');
    const fieldset = node(this.document, 'fieldset', 'ca-overlay-fieldset');
    fieldset.setAttribute('aria-labelledby', heading.id);
    const policy = this.settings.policy();
    const master = checkbox(this.document, { id: 'communication-overlay-policy-master', label: ' Enable camera overlays in this browser', checked: policy.masterEnabled });
    const student = checkbox(this.document, { id: 'communication-overlay-policy-student', label: ' Allow student live + replay overlay controls', checked: policy.studentAllowed });
    master.input.dataset.overlayPolicy = 'masterEnabled';
    student.input.dataset.overlayPolicy = 'studentAllowed';
    for (const control of [master, student]) {
      control.input.addEventListener('change', () => {
        this.settings.updatePolicy({ [control.input.dataset.overlayPolicy]: control.input.checked }, { role: this.bridge.role });
      });
      fieldset.append(control.wrapper);
    }
    const status = node(this.document, 'p', 'ca-overlay-status');
    status.id = 'communication-overlay-admin-policy-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    pad.append(heading, authority, note, fieldset, status);
    panel.append(pad);
    section.append(panel);
  }

  mountStudentLiveControls() {
    const video = this.document.getElementById('pipvid');
    const stage = video?.closest?.('#selfpip');
    const room = this.document.querySelector('section[data-view="room"]');
    const media = this.document.getElementById('meetwrap');
    if (!video || !stage || !room || !media) return;
    let canvas = this.document.getElementById('communication-overlay-student-live-canvas');
    if (!canvas) {
      canvas = this.document.createElement('canvas');
      canvas.id = 'communication-overlay-student-live-canvas';
      canvas.className = 'ca-media-overlay ca-media-overlay-mirrored';
      canvas.setAttribute('aria-hidden', 'true');
      stage.append(canvas);
    }
    canvas.style.transform = overlayMirrorTransform(video);
    if (this.mirrorVideo !== video) {
      this.mirrorObserver?.disconnect?.();
      this.mirrorObserver?.observe?.(video, { attributes: true, attributeFilter: ['style'] });
      this.mirrorVideo = video;
    }
    this.liveCanvas = canvas;
    let controls = this.document.getElementById('communication-overlay-student-live-controls');
    if (!controls) {
      controls = this.buildLayerControls({ id: 'communication-overlay-student-live-controls', role: 'student', surface: 'live', legend: 'Your live tracking overlay' });
      media.insertAdjacentElement('afterend', controls);
    }
    this.liveControls = controls;
  }

  unmountStudentLiveControls() {
    this.clearMainOverlay();
    this.liveCanvas?.remove?.();
    this.liveControls?.remove?.();
    this.mirrorObserver?.disconnect?.();
    this.mirrorVideo = null;
    this.liveCanvas = null;
    this.liveControls = null;
  }

  buildLayerControls({ id, role, surface, legend }) {
    const wrap = node(this.document, 'div', 'ca-overlay-controls');
    wrap.id = id;
    wrap.dataset.overlayRole = role;
    wrap.dataset.overlaySurface = surface;
    const fieldset = node(this.document, 'fieldset', 'ca-overlay-fieldset');
    const title = node(this.document, 'legend', 'ca-overlay-legend', legend);
    const authority = node(this.document, 'span', 'ca-overlay-authority', LOCAL_AUTHORITY_LABEL);
    const keys = overlayPreferenceKeys(role, surface);
    const preferences = this.settings.preferences();
    const face = checkbox(this.document, { id: `${id}-face`, label: ' Face', checked: preferences[keys.face], preferenceKey: keys.face });
    const body = checkbox(this.document, { id: `${id}-body`, label: ' Body + hands', checked: preferences[keys.body], preferenceKey: keys.body });
    for (const control of [face, body]) {
      control.input.addEventListener('change', () => {
        this.settings.updatePreferences({ [control.input.dataset.overlayPreference]: control.input.checked }, { role: this.bridge.role });
      });
    }
    const toggles = node(this.document, 'span', 'ca-overlay-toggle-row');
    toggles.append(face.wrapper, body.wrapper);
    const status = node(this.document, 'span', 'ca-overlay-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    fieldset.append(title, authority, toggles, status);
    wrap.append(fieldset);
    return wrap;
  }

  refreshMountedControls() {
    const policy = this.settings.policy();
    const preferences = this.settings.preferences();
    const admin = this.document.getElementById('communication-overlay-admin-policy');
    if (admin) {
      const master = admin.querySelector('[data-overlay-policy="masterEnabled"]');
      const student = admin.querySelector('[data-overlay-policy="studentAllowed"]');
      if (master) master.checked = policy.masterEnabled;
      if (student) student.checked = policy.studentAllowed;
      const status = this.document.getElementById('communication-overlay-admin-policy-status');
      setText(status, `${policy.masterEnabled ? 'MASTER ON' : 'MASTER OFF'} · STUDENT ${policy.studentAllowed ? 'ALLOWED' : 'NOT ALLOWED'} · ${LOCAL_AUTHORITY_LABEL}`);
    }
    for (const controls of this.document.querySelectorAll?.('[data-overlay-role][data-overlay-surface]') || []) {
      const role = controls.dataset.overlayRole;
      const surface = controls.dataset.overlaySurface;
      const layers = this.settings.layers(role, surface);
      for (const input of controls.querySelectorAll('[data-overlay-preference]')) {
        input.checked = Boolean(preferences[input.dataset.overlayPreference]);
        input.disabled = !layers.allowed || this.bridge.role !== role;
      }
      const status = controls.querySelector('.ca-overlay-status');
      setText(status, overlayAvailabilityCopy(layers));
      controls.classList.toggle('ca-overlay-disabled', !layers.allowed);
    }
    for (const binding of this.playbackBindings.values()) this.applyPlaybackLayers(binding);
  }

  applyMainLiveLayers() {
    const inStudentRoom = this.role === 'student' && this.view === 'room';
    const layers = inStudentRoom
      ? this.settings.layers('student', 'live')
      : Object.freeze({ allowed: false, overlayEnabled: false, faceEnabled: false, bodyEnabled: false, reason: 'role_or_surface_not_supported' });
    const changed = !this.mainLayers
      || layers.overlayEnabled !== this.mainLayers.overlayEnabled
      || layers.faceEnabled !== this.mainLayers.faceEnabled
      || layers.bodyEnabled !== this.mainLayers.bodyEnabled;
    if (changed) this.clearMainOverlay();
    this.mainLayers = layers;
    this.pipeline.setInstrumentation?.({
      overlayEnabled: layers.overlayEnabled,
      faceEnabled: layers.faceEnabled,
      bodyEnabled: layers.bodyEnabled,
    });
    return layers;
  }

  consumeMainOverlay({
    bitmap,
    geometry,
    overlayStatus = bitmap ? 'rendered' : 'unavailable',
    overlayUnavailableReason = bitmap ? null : 'overlay_bitmap_unavailable',
    overlayErrorCode = null,
    overlayErrorMessage = null,
  } = {}) {
    const layers = this.applyMainLiveLayers();
    const canvas = this.liveCanvas;
    if (!layers.overlayEnabled || !canvas) {
      this.clearMainOverlay();
      return;
    }
    if (overlayStatus === 'error') {
      this.clearMainOverlay();
      this.setMainOverlayStatus({ overlayStatus, overlayUnavailableReason, overlayErrorCode, overlayErrorMessage });
      return;
    }
    if (geometry?.faceCount !== 1 || overlayStatus !== 'rendered' || !bitmap) {
      this.clearMainOverlay();
      this.setMainOverlayStatus({
        overlayStatus: 'unavailable',
        overlayUnavailableReason: geometry?.faceCount === 1 ? overlayUnavailableReason : 'face_count_not_one',
      });
      return;
    }
    const surface = canvasSurface(canvas, canvas.parentElement?.clientWidth || 180, canvas.parentElement?.clientHeight || 112);
    if (!surface) {
      this.clearMainOverlay();
      this.setMainOverlayStatus({ overlayStatus: 'unavailable', overlayUnavailableReason: 'render_surface_unavailable' });
      return;
    }
    this.syncLiveMirror();
    const { context, width, height } = surface;
    const rect = overlayCoverDrawRect(bitmap.width, bitmap.height, width, height);
    if (!rect) {
      this.clearMainOverlay();
      this.setMainOverlayStatus({ overlayStatus: 'unavailable', overlayUnavailableReason: 'overlay_bitmap_unavailable' });
      return;
    }
    try {
      context.clearRect(0, 0, width, height);
      context.drawImage(bitmap, rect.left, rect.top, rect.width, rect.height);
      this.setMainOverlayStatus({ overlayStatus: 'rendered' });
    } catch {
      this.clearMainOverlay();
      this.setMainOverlayStatus({ overlayStatus: 'error', overlayUnavailableReason: 'render_failed' });
    }
  }

  setMainOverlayStatus(detail = {}) {
    const status = this.liveControls?.querySelector?.('.ca-overlay-status');
    const copy = overlayRenderStatusCopy(detail);
    if (status && copy) setText(status, copy);
  }

  clearMainOverlay() {
    clearCanvas(this.liveCanvas);
  }

  syncLiveMirror() {
    if (this.liveCanvas) this.liveCanvas.style.transform = overlayMirrorTransform(this.document.getElementById('pipvid'));
  }

  consumePipelineState(detail = {}) {
    const visionPartial = detail.state === 'partial' && ['vision', 'multi-face-protection', 'all'].includes(detail.subsystem);
    const overlayPartial = detail.state === 'partial' && detail.subsystem === 'overlay-display';
    if (visionPartial || overlayPartial || ['idle', 'complete'].includes(detail.state)) this.clearMainOverlay();
    if (overlayPartial) this.setMainOverlayStatus({
      overlayStatus: 'error',
      overlayUnavailableReason: detail.overlayUnavailableReason || 'render_failed',
      overlayErrorCode: detail.overlayErrorCode || null,
    });
    else if (visionPartial) this.setMainOverlayStatus({ overlayStatus: 'unavailable', overlayUnavailableReason: 'vision_unavailable' });
    else if (['idle', 'complete'].includes(detail.state)) {
      const status = this.liveControls?.querySelector?.('.ca-overlay-status');
      if (status) setText(status, `${overlayAvailabilityCopy(this.mainLayers)} · OVERLAY CANVAS CLEARED · ${detail.state === 'complete' ? 'ANSWER COMPLETE' : 'ANALYTICS IDLE'}`);
    }
  }

  syncPlaybackTargets() {
    const candidates = [];
    if (this.role === 'student' && this.view === 'results') candidates.push({ id: 'playback', role: 'student', label: 'Your replay tracking overlay' });
    if (this.role === 'coach' && this.view === 'mreview') candidates.push({ id: 'mrVideo', role: 'coach', label: 'Shared rep tracking overlay' });
    if (this.role === 'admin' && this.view === 'analytics-test') candidates.push({ id: 'communication-analytics-founder-replay', role: 'admin', label: 'Founder replay tracking overlay' });
    const keep = new Set();
    for (const candidate of candidates) {
      const video = this.document.getElementById(candidate.id);
      if (!video || !videoHasLocalSource(video) || video.style?.display === 'none') continue;
      keep.add(candidate.id);
      const existing = this.playbackBindings.get(candidate.id);
      if (existing && existing.video !== video) this.destroyPlaybackBinding(candidate.id);
      if (!this.playbackBindings.has(candidate.id)) this.mountPlaybackTarget(video, candidate);
    }
    for (const id of [...this.playbackBindings.keys()]) if (!keep.has(id)) this.destroyPlaybackBinding(id);
  }

  mountPlaybackTarget(video, { id, role, label }) {
    const parent = video.parentElement;
    if (!parent) return;
    const stage = node(this.document, 'div', 'ca-overlay-media-stage');
    stage.dataset.overlayFor = id;
    parent.insertBefore(stage, video);
    stage.append(video);
    const canvas = this.document.createElement('canvas');
    canvas.className = 'ca-media-overlay';
    canvas.id = `communication-overlay-${id}-canvas`;
    canvas.setAttribute('aria-hidden', 'true');
    stage.append(canvas);
    const controls = this.buildLayerControls({ id: `communication-overlay-${id}-controls`, role, surface: 'playback', legend: label });
    stage.insertAdjacentElement('afterend', controls);
    const binding = {
      id, role, video, canvas, stage, controls, parent,
      runtime: new this.PlaybackRuntime({
        video,
        canvas,
        onState: (detail) => this.onPlaybackState(id, detail),
      }),
    };
    this.playbackBindings.set(id, binding);
    this.applyPlaybackLayers(binding);
  }

  applyPlaybackLayers(binding) {
    if (!binding) return;
    const contextMatches = (binding.role === 'student' && this.role === 'student' && this.view === 'results')
      || (binding.role === 'coach' && this.role === 'coach' && this.view === 'mreview')
      || (binding.role === 'admin' && this.role === 'admin' && this.view === 'analytics-test');
    const layers = contextMatches
      ? this.settings.layers(binding.role, 'playback')
      : { overlayEnabled: false, faceEnabled: false, bodyEnabled: false };
    binding.runtime.setLayers(layers);
    binding.canvas.classList.toggle('ca-hidden', !layers.overlayEnabled);
    if (layers.overlayEnabled && videoHasLocalSource(binding.video)) {
      if (!binding.runtime.active) binding.runtime.start();
    }
    else binding.runtime.stop({ clear: true, reason: layers.overlayEnabled ? 'source_unavailable' : 'layers_hidden' });
  }

  onPlaybackState(id, detail = {}) {
    const binding = this.playbackBindings.get(id);
    const status = binding?.controls?.querySelector?.('.ca-overlay-status');
    if (!status) return;
    if (detail.state === 'failed') setText(status, `OVERLAY UNAVAILABLE · ${detail.message || detail.reason || 'LOCAL PLAYBACK ANALYSIS FAILED'} · VIDEO PLAYBACK IS UNCHANGED`);
    else if (['initializing', 'recovering'].includes(detail.state)) setText(status, `LOCAL OVERLAY ${detail.state.toUpperCase()} · VIDEO PLAYBACK IS UNCHANGED`);
    else {
      const runtimeCopy = overlayRenderStatusCopy(detail, { playback: true });
      if (runtimeCopy) setText(status, runtimeCopy);
      else if (detail.state === 'cleared' && detail.reason === 'face_count_not_one') setText(status, overlayRenderStatusCopy({ overlayStatus: 'unavailable', overlayUnavailableReason: 'face_count_not_one' }, { playback: true }));
      else if (['ready', 'running'].includes(detail.state)) setText(status, `${overlayAvailabilityCopy(this.settings.layers(binding.role, 'playback'))} · WAITING FOR A RENDERABLE EXACTLY-ONE-PERSON FRAME`);
      else if (['cleared', 'stopped'].includes(detail.state)) setText(status, `${overlayAvailabilityCopy(this.settings.layers(binding.role, 'playback'))} · OVERLAY CANVAS CLEARED · VIDEO PLAYBACK IS UNCHANGED`);
    }
  }

  destroyPlaybackBinding(id) {
    const binding = this.playbackBindings.get(id);
    if (!binding) return;
    binding.runtime.destroy();
    binding.controls.remove?.();

    const replacement = this.document.getElementById(id);
    const distinctReplacement = replacement && replacement !== binding.video ? replacement : null;
    const stageParent = binding.stage?.parentElement || null;
    const restoreParent = stageParent || binding.parent || null;
    const restoreBeforeStage = (video) => {
      if (!video || !restoreParent) return;
      if (stageParent === restoreParent) restoreParent.insertBefore(video, binding.stage);
      else restoreParent.append?.(video);
    };

    if (distinctReplacement?.parentElement === binding.stage) restoreBeforeStage(distinctReplacement);
    if (binding.video?.parentElement === binding.stage) {
      if (distinctReplacement) binding.video.remove?.();
      else restoreBeforeStage(binding.video);
    }
    binding.canvas?.remove?.();
    binding.stage?.remove?.();
    this.playbackBindings.delete(id);
  }

  destroyPlaybackBindings() {
    for (const id of [...this.playbackBindings.keys()]) this.destroyPlaybackBinding(id);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.observer?.disconnect();
    this.mirrorObserver?.disconnect?.();
    this.settings.removeEventListener('change', this.onSettingsChange);
    this.pipeline.removeEventListener?.('state', this.onPipelineState);
    this.pipeline.setInstrumentation?.({ overlayEnabled: false, faceEnabled: false, bodyEnabled: false });
    this.pipeline.setOverlayConsumer?.(null);
    this.unmountStudentLiveControls();
    this.destroyPlaybackBindings();
    this.document.getElementById('communication-overlay-admin-policy')?.remove?.();
  }
}
