import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  DEFAULT_OVERLAY_PREFERENCES,
  LocalOverlaySettings,
  OVERLAY_POLICY_STORAGE_KEY,
  OVERLAY_PREFERENCES_STORAGE_KEY,
  overlayPolicyForRole,
  persistedOverlaySettingsAreBooleanOnly,
  readOverlayPolicy,
} from '../../public/analytics/overlay-policy.mjs';
import { OverlayUiController, overlayAvailabilityCopy, overlayCoverDrawRect, overlayMirrorTransform, overlayPreferenceKeys, overlayRenderStatusCopy } from '../../public/analytics/overlay-ui.mjs';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

class FakeDomNode {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.id = '';
    this.textContent = '';
    this.currentSrc = '';
    this.srcObject = null;
    this.active = false;
    this.classList = {
      toggle: (name, force) => {
        const names = new Set(this.className.split(/\s+/u).filter(Boolean));
        const enabled = force === undefined ? !names.has(name) : Boolean(force);
        if (enabled) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
        return enabled;
      },
    };
  }

  get isConnected() {
    let current = this;
    while (current) {
      if (current === this.ownerDocument.root) return true;
      current = current.parentElement;
    }
    return false;
  }

  append(...values) {
    for (const value of values) {
      if (!value) continue;
      value.remove?.();
      value.parentElement = this;
      this.children.push(value);
    }
  }

  insertBefore(value, reference) {
    const referenceIndex = this.children.indexOf(reference);
    if (referenceIndex < 0) throw new Error('reference node is not a child');
    value.remove?.();
    value.parentElement = this;
    this.children.splice(referenceIndex, 0, value);
  }

  insertAdjacentElement(position, value) {
    if (position !== 'afterend' || !this.parentElement) throw new Error('unsupported insertion');
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    value.remove?.();
    value.parentElement = this.parentElement;
    siblings.splice(index + 1, 0, value);
  }

  replaceWith(value) {
    if (!this.parentElement) return;
    const parent = this.parentElement;
    const index = parent.children.indexOf(this);
    value.remove?.();
    parent.children[index] = value;
    value.parentElement = parent;
    this.parentElement = null;
  }

  remove() {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  addEventListener() {}
  removeEventListener() {}
  getContext() { return { clearRect() {}, setTransform() {} }; }
  querySelector() { return null; }
}

class FakeDomDocument {
  constructor() { this.root = new FakeDomNode('document', this); }
  createElement(tagName) { return new FakeDomNode(tagName, this); }
  createTextNode(text) {
    const value = new FakeDomNode('#text', this);
    value.textContent = String(text);
    return value;
  }
  getElementById(id) {
    const visit = (value) => {
      if (value.id === id) return value;
      for (const child of value.children) {
        const match = visit(child);
        if (match) return match;
      }
      return null;
    };
    return visit(this.root);
  }
}

function fakeDomMatches(root, predicate) {
  const matches = [];
  const visit = (value) => {
    if (predicate(value)) matches.push(value);
    for (const child of value.children) visit(child);
  };
  visit(root);
  return matches;
}

test('local admin master and student allowance clamp every student overlay layer', () => {
  const allowed = overlayPolicyForRole({ role: 'student', surface: 'live', policy: { masterEnabled: true, studentAllowed: true } });
  assert.deepEqual(allowed, {
    allowed: true, overlayEnabled: true, faceEnabled: true, bodyEnabled: true, reason: 'available',
  });
  const masterOff = overlayPolicyForRole({ role: 'student', surface: 'playback', policy: { masterEnabled: false, studentAllowed: true } });
  assert.deepEqual(masterOff, {
    allowed: false, overlayEnabled: false, faceEnabled: false, bodyEnabled: false, reason: 'disabled_by_local_admin_master',
  });
  const studentOff = overlayPolicyForRole({ role: 'student', surface: 'live', policy: { masterEnabled: true, studentAllowed: false } });
  assert.equal(studentOff.overlayEnabled, false);
  assert.equal(studentOff.reason, 'student_overlay_disabled_by_local_admin');
  const founderStillAllowed = overlayPolicyForRole({ role: 'admin', surface: 'live', policy: { masterEnabled: true, studentAllowed: false } });
  assert.equal(founderStillAllowed.overlayEnabled, true);
  assert.equal(overlayPolicyForRole({ role: 'coach', surface: undefined }).allowed, false);
  assert.equal(overlayPolicyForRole({ role: 'admin', surface: 'typo', policy: { masterEnabled: true, studentAllowed: true } }).reason, 'role_or_surface_not_supported');
});

test('blocked browser storage falls back to in-memory boolean defaults', () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('blocked', 'SecurityError'); },
  });
  try {
    assert.deepEqual(readOverlayPolicy(), { masterEnabled: false, studentAllowed: false });
    const settings = new LocalOverlaySettings();
    assert.deepEqual(settings.policy(), { masterEnabled: false, studentAllowed: false });
    assert.doesNotThrow(() => settings.updatePreferences({ studentLiveFace: false }, { role: 'student' }));
  } finally {
    if (prior) Object.defineProperty(globalThis, 'localStorage', prior);
    else delete globalThis.localStorage;
  }
});

test('face and body layers are independent and combined-off only hides display', () => {
  const faceOff = overlayPolicyForRole({
    role: 'student', surface: 'live',
    policy: { masterEnabled: true, studentAllowed: true },
    preferences: { ...DEFAULT_OVERLAY_PREFERENCES, studentLiveFace: false, studentLiveBody: true },
  });
  assert.deepEqual({ overlay: faceOff.overlayEnabled, face: faceOff.faceEnabled, body: faceOff.bodyEnabled }, { overlay: true, face: false, body: true });
  const bodyOff = overlayPolicyForRole({
    role: 'student', surface: 'playback',
    policy: { masterEnabled: true, studentAllowed: true },
    preferences: { ...DEFAULT_OVERLAY_PREFERENCES, studentPlaybackFace: true, studentPlaybackBody: false },
  });
  assert.deepEqual({ overlay: bodyOff.overlayEnabled, face: bodyOff.faceEnabled, body: bodyOff.bodyEnabled }, { overlay: true, face: true, body: false });
  const bothOff = overlayPolicyForRole({
    role: 'student', surface: 'live',
    policy: { masterEnabled: true, studentAllowed: true },
    preferences: { ...DEFAULT_OVERLAY_PREFERENCES, studentLiveFace: false, studentLiveBody: false },
  });
  assert.deepEqual({ overlay: bothOff.overlayEnabled, face: bothOff.faceEnabled, body: bothOff.bodyEnabled, reason: bothOff.reason }, { overlay: false, face: false, body: false, reason: 'all_layers_hidden' });
  assert.match(overlayAvailabilityCopy(bothOff), /ANALYTICS CONTINUE WITHOUT DISPLAY/u);
});

test('students cannot mutate policy and each role can change only its own boolean preferences', () => {
  const storage = new MemoryStorage();
  const settings = new LocalOverlaySettings({ storage });
  settings.updatePolicy({ masterEnabled: true, studentAllowed: true }, { role: 'admin' });
  assert.throws(() => settings.updatePolicy({ masterEnabled: false }, { role: 'student' }), { name: 'NotAllowedError' });
  assert.throws(() => settings.updatePolicy({ masterEnabled: false }, { role: 'coach' }), { name: 'NotAllowedError' });
  settings.updatePreferences({ studentLiveFace: false, founderLiveFace: false }, { role: 'student' });
  assert.equal(settings.preferences().studentLiveFace, false);
  assert.equal(settings.preferences().founderLiveFace, true);
  settings.updatePolicy({ studentAllowed: false }, { role: 'admin' });
  assert.equal(settings.policy().studentAllowed, false);
  assert.equal(settings.layers('student', 'playback').overlayEnabled, false);
});

test('persisted overlay policy and preferences are whitelist-projected booleans only', () => {
  const storage = new MemoryStorage({
    [OVERLAY_POLICY_STORAGE_KEY]: JSON.stringify({ masterEnabled: false, studentAllowed: true, studentId: 'p-1', event: { raw: true } }),
    [OVERLAY_PREFERENCES_STORAGE_KEY]: JSON.stringify({ studentLiveFace: false, studentLiveBody: true, coordinates: [1, 2], mediaId: 'blob:secret' }),
  });
  const settings = new LocalOverlaySettings({ storage });
  settings.updatePolicy({ masterEnabled: true, rawFrame: true }, { role: 'admin' });
  settings.updatePreferences({ founderPlaybackBody: false, landmark: { x: 1 } }, { role: 'admin' });
  for (const key of [OVERLAY_POLICY_STORAGE_KEY, OVERLAY_PREFERENCES_STORAGE_KEY]) {
    const value = JSON.parse(storage.getItem(key));
    assert.equal(persistedOverlaySettingsAreBooleanOnly(value), true);
    assert.equal(JSON.stringify(value).includes('studentId'), false);
    assert.equal(JSON.stringify(value).includes('mediaId'), false);
    assert.equal(JSON.stringify(value).includes('coordinate'), false);
    assert.equal(JSON.stringify(value).includes('landmark'), false);
  }
});

test('role/surface preference routing and cover-fit geometry are deterministic', () => {
  assert.deepEqual(overlayPreferenceKeys('student', 'live'), { face: 'studentLiveFace', body: 'studentLiveBody' });
  assert.deepEqual(overlayPreferenceKeys('student', 'playback'), { face: 'studentPlaybackFace', body: 'studentPlaybackBody' });
  assert.deepEqual(overlayPreferenceKeys('admin', 'playback'), { face: 'founderPlaybackFace', body: 'founderPlaybackBody' });
  assert.deepEqual(overlayPreferenceKeys('coach', 'playback'), { face: 'coachPlaybackFace', body: 'coachPlaybackBody' });
  assert.equal(overlayPreferenceKeys('visitor', 'playback'), null);
  assert.deepEqual(overlayCoverDrawRect(480, 270, 360, 270), { width: 480, height: 270, left: -60, top: 0 });
  assert.deepEqual(overlayCoverDrawRect(360, 270, 480, 270), { width: 480, height: 360, left: 0, top: -45 });
  assert.equal(overlayCoverDrawRect(0, 270, 480, 270), null);
  assert.equal(overlayMirrorTransform({ style: { transform: 'scaleX(-1)' } }), 'scaleX(-1)');
  assert.equal(overlayMirrorTransform({ style: { transform: 'scaleX(1)' } }), 'scaleX(1)');
  assert.equal(overlayMirrorTransform({ style: { transform: 'rotate(2deg)' } }), 'scaleX(-1)');
  assert.doesNotMatch(overlayAvailabilityCopy({ allowed: true, overlayEnabled: true, faceEnabled: true, bodyEnabled: true }), /VISIBLE|READY/u);
  assert.match(overlayRenderStatusCopy({ overlayStatus: 'error', overlayUnavailableReason: 'render_failed' }), /DISPLAY ERROR.*ANALYTICS CONTINUE/u);
  assert.match(overlayRenderStatusCopy({ overlayStatus: 'unavailable', overlayUnavailableReason: 'render_surface_unavailable' }, { playback: true }), /TEMPORARILY UNAVAILABLE.*VIDEO PLAYBACK IS UNCHANGED/u);
});

test('controller applies student live policy synchronously and clears it on role/view lifecycle changes', async () => {
  const storage = new MemoryStorage();
  const settings = new LocalOverlaySettings({ storage });
  settings.updatePolicy({ masterEnabled: true, studentAllowed: true }, { role: 'admin' });
  let role = 'student';
  let view = 'room';
  const bridge = { get role() { return role; }, get view() { return view; } };
  const instrumentation = [];
  const consumers = [];
  const pipeline = {
    setInstrumentation(value) { instrumentation.push({ ...value }); },
    setOverlayConsumer(value) { consumers.push(value); },
  };
  const documentRef = {
    body: {}, documentElement: {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const controller = new OverlayUiController({ bridge, pipeline, settings, documentRef, windowRef: {}, PlaybackRuntime: class {} });
  const before = controller.beforeBeginAnswer();
  assert.deepEqual({ overlay: before.overlayEnabled, face: before.faceEnabled, body: before.bodyEnabled }, { overlay: true, face: true, body: true });
  assert.deepEqual(instrumentation.at(-1), { overlayEnabled: true, faceEnabled: true, bodyEnabled: true });
  assert.equal(typeof consumers[0], 'function');

  settings.updatePreferences({ studentLiveFace: false }, { role: 'student' });
  assert.deepEqual(instrumentation.at(-1), { overlayEnabled: true, faceEnabled: false, bodyEnabled: true });
  settings.updatePreferences({ studentLiveBody: false }, { role: 'student' });
  assert.deepEqual(instrumentation.at(-1), { overlayEnabled: false, faceEnabled: false, bodyEnabled: false });

  view = 'home';
  controller.onViewChange(view, role);
  assert.deepEqual(instrumentation.at(-1), { overlayEnabled: false, faceEnabled: false, bodyEnabled: false });
  role = 'coach';
  view = 'mreview';
  controller.onViewChange(view, role);
  assert.deepEqual(instrumentation.at(-1), { overlayEnabled: false, faceEnabled: false, bodyEnabled: false });
  controller.destroy();
  assert.equal(consumers.at(-1), null);
  await Promise.resolve();
});

test('live mask changes, safety frames, lifecycle states, and mirror changes clear or realign immediately', () => {
  let faceEnabled = true;
  let bodyEnabled = true;
  const clears = [];
  const transforms = [];
  const video = { style: { transform: 'scaleX(-1)' } };
  const context = {
    setTransform() {},
    clearRect: (...args) => clears.push(args),
    drawImage() {},
  };
  const canvas = {
    width: 180, height: 112, clientWidth: 180, clientHeight: 112,
    parentElement: { clientWidth: 180, clientHeight: 112 },
    style: { set transform(value) { transforms.push(value);this.value = value; }, get transform() { return this.value; } },
    getBoundingClientRect: () => ({ width: 180, height: 112 }),
    getContext: () => context,
  };
  const controller = Object.create(OverlayUiController.prototype);
  controller.role = 'student';
  controller.view = 'room';
  controller.liveCanvas = canvas;
  controller.mainLayers = null;
  controller.settings = { layers: () => ({ allowed: true, overlayEnabled: faceEnabled || bodyEnabled, faceEnabled, bodyEnabled, reason: 'available' }) };
  controller.pipeline = { setInstrumentation() {} };
  controller.document = { getElementById: (id) => id === 'pipvid' ? video : null };
  const status = { textContent: '' };
  controller.liveControls = { querySelector: () => status };

  controller.applyMainLiveLayers();
  const initialClears = clears.length;
  faceEnabled = false;
  controller.applyMainLiveLayers();
  assert.ok(clears.length > initialClears, 'disabling a displayed layer must clear the old pixels immediately');

  const bitmap = { width: 480, height: 270 };
  controller.consumeMainOverlay({ bitmap, geometry: { faceCount: 1 } });
  assert.equal(transforms.at(-1), 'scaleX(-1)');
  assert.match(status.textContent, /LOCAL OVERLAY RENDERED/u);
  video.style.transform = 'scaleX(1)';
  controller.consumeMainOverlay({ bitmap, geometry: { faceCount: 1 } });
  assert.equal(transforms.at(-1), 'scaleX(1)');

  const beforeUnsafe = clears.length;
  controller.consumeMainOverlay({ bitmap: null, geometry: { faceCount: 2 } });
  assert.ok(clears.length > beforeUnsafe);
  assert.match(status.textContent, /TEMPORARILY UNAVAILABLE.*EXACTLY ONE PERSON/u);
  controller.consumeMainOverlay({
    bitmap: null,
    geometry: { faceCount: 1 },
    overlayStatus: 'error',
    overlayUnavailableReason: 'render_failed',
    overlayErrorCode: 'overlay_render_failed',
  });
  assert.match(status.textContent, /DISPLAY ERROR.*ANALYTICS CONTINUE/u);
  const beforePartial = clears.length;
  controller.consumePipelineState({ state: 'partial', subsystem: 'vision' });
  controller.consumePipelineState({ state: 'partial', subsystem: 'audio' });
  controller.consumePipelineState({ state: 'partial', subsystem: 'overlay-display', overlayUnavailableReason: 'bitmap_transfer_failed' });
  assert.match(status.textContent, /DISPLAY ERROR.*FRAME COULD NOT BE TRANSFERRED/u);
  controller.consumePipelineState({ state: 'complete' });
  assert.equal(clears.length, beforePartial + 3, 'vision, overlay-display, and complete clear; audio-only partial does not');
  assert.match(status.textContent, /OVERLAY CANVAS CLEARED.*ANSWER COMPLETE/u);
});

test('playback status distinguishes enabled/waiting, rendered, unavailable, and display error truthfully', () => {
  const status = { textContent: '' };
  const controller = Object.create(OverlayUiController.prototype);
  controller.playbackBindings = new Map([['playback', {
    role: 'student',
    controls: { querySelector: () => status },
  }]]);
  controller.settings = { layers: () => ({ allowed: true, overlayEnabled: true, faceEnabled: true, bodyEnabled: true, reason: 'available' }) };

  controller.onPlaybackState('playback', { state: 'ready' });
  assert.match(status.textContent, /ENABLED.*WAITING FOR A RENDERABLE/u);
  assert.doesNotMatch(status.textContent, /VISIBLE|OVERLAY READY/u);
  controller.onPlaybackState('playback', { state: 'unavailable', overlayUnavailableReason: 'render_surface_unavailable' });
  assert.match(status.textContent, /TEMPORARILY UNAVAILABLE.*BROWSER CANNOT CREATE/u);
  controller.onPlaybackState('playback', { state: 'overlay-error', overlayUnavailableReason: 'render_failed', overlayErrorCode: 'overlay_render_failed' });
  assert.match(status.textContent, /DISPLAY ERROR.*VIDEO PLAYBACK IS UNCHANGED/u);
  controller.onPlaybackState('playback', { state: 'overlay-error', overlayUnavailableReason: 'canvas_blit_failed', overlayErrorCode: 'overlay_blit_failed' });
  assert.match(status.textContent, /DISPLAY ERROR.*CANVAS COULD NOT DRAW.*VIDEO PLAYBACK IS UNCHANGED/u);
  controller.onPlaybackState('playback', { state: 'rendered', overlayStatus: 'rendered' });
  assert.match(status.textContent, /LOCAL OVERLAY RENDERED/u);
});

test('playback sync replaces a same-ID video without nesting or leaking the old overlay stage', () => {
  const documentRef = new FakeDomDocument();
  const host = documentRef.createElement('section');
  documentRef.root.append(host);
  const oldVideo = documentRef.createElement('video');
  oldVideo.id = 'playback';
  oldVideo.currentSrc = 'blob:old-local-replay';
  host.append(oldVideo);

  const runtimes = [];
  class FakePlaybackRuntime {
    constructor({ video, canvas }) {
      this.video = video;
      this.canvas = canvas;
      this.active = false;
      this.destroyCount = 0;
      runtimes.push(this);
    }
    setLayers(layers) { this.layers = layers; }
    start() { this.active = true; }
    stop() { this.active = false; }
    destroy() { this.destroyCount += 1;this.active = false; }
  }

  const controller = Object.create(OverlayUiController.prototype);
  controller.document = documentRef;
  controller.role = 'student';
  controller.view = 'results';
  controller.PlaybackRuntime = FakePlaybackRuntime;
  controller.playbackBindings = new Map();
  controller.settings = {
    layers: () => ({ allowed: true, overlayEnabled: true, faceEnabled: true, bodyEnabled: true, reason: 'available' }),
  };
  controller.buildLayerControls = ({ id }) => {
    const controls = documentRef.createElement('div');
    controls.id = id;
    controls.className = 'ca-overlay-controls';
    return controls;
  };

  controller.syncPlaybackTargets();
  const oldBinding = controller.playbackBindings.get('playback');
  assert.ok(oldBinding);
  assert.equal(oldVideo.parentElement, oldBinding.stage);

  const replacementVideo = documentRef.createElement('video');
  replacementVideo.id = 'playback';
  replacementVideo.currentSrc = 'blob:new-local-replay';
  oldVideo.replaceWith(replacementVideo);
  assert.equal(replacementVideo.parentElement, oldBinding.stage, 'the external replacement initially occupies the controller-owned stage');

  controller.syncPlaybackTargets();
  const replacementBinding = controller.playbackBindings.get('playback');
  assert.ok(replacementBinding);
  assert.equal(controller.playbackBindings.size, 1);
  assert.equal(replacementBinding.video, replacementVideo);
  assert.equal(replacementBinding.stage.parentElement, host);
  assert.equal(replacementVideo.parentElement, replacementBinding.stage);
  assert.equal(oldVideo.parentElement, null);
  assert.equal(oldBinding.stage.parentElement, null);
  assert.equal(oldBinding.canvas.parentElement, null);
  assert.equal(oldBinding.controls.parentElement, null);
  assert.equal(runtimes.length, 2);
  assert.equal(runtimes[0].destroyCount, 1);
  assert.equal(runtimes[1].destroyCount, 0);

  const stages = fakeDomMatches(documentRef.root, (value) => value.className.split(/\s+/u).includes('ca-overlay-media-stage'));
  const canvases = fakeDomMatches(documentRef.root, (value) => value.id === 'communication-overlay-playback-canvas');
  assert.equal(stages.length, 1);
  assert.equal(canvases.length, 1);
  assert.equal(stages[0], replacementBinding.stage);
  assert.equal(canvases[0], replacementBinding.canvas);
  assert.equal(stages[0].parentElement, host, 'the replacement stage is not nested in a stale wrapper');
});

test('DOM observation is restricted to overlay hosts and never subscribes to the room telemetry subtree', async () => {
  const observed = [];
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(target, options) { observed.push({ target, options }); }
    disconnect() {}
  }
  const roots = {
    results: {}, review: {}, founder: {}, playback: { style: {} }, reviewVideo: { style: {} }, body: {}, documentElement: {},
  };
  const documentRef = {
    body: roots.body,
    documentElement: roots.documentElement,
    querySelector(selector) {
      return {
        'section[data-view="results"]': roots.results,
        'section[data-view="mreview"]': roots.review,
        '#communication-analytics-test-root': roots.founder,
      }[selector] || null;
    },
    getElementById(id) {
      return { playback: roots.playback, mrVideo: roots.reviewVideo }[id] || null;
    },
    querySelectorAll() { return []; },
  };
  const pipeline = { setOverlayConsumer() {}, setInstrumentation() {}, addEventListener() {}, removeEventListener() {} };
  const priorMutationObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = FakeMutationObserver;
  try {
    const controller = new OverlayUiController({
      bridge: { role: 'student', view: 'home' }, pipeline,
      settings: new LocalOverlaySettings({ storage: new MemoryStorage() }), documentRef, windowRef: {}, PlaybackRuntime: class {},
    });
    assert.equal(observed.some(({ target }) => target === roots.body || target === roots.documentElement), false);
    for (const target of [roots.results, roots.review, roots.founder, roots.playback, roots.reviewVideo]) {
      assert.equal(observed.some((entry) => entry.target === target), true);
    }
    controller.destroy();
    await Promise.resolve();
  } finally {
    if (priorMutationObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = priorMutationObserver;
  }
});

test('UI wiring is dynamic, role-bounded, lifecycle-clean, and applies live layers before beginAnswer', async () => {
  const [ui, overlayUi, css, html] = await Promise.all([
    read('public/analytics/ui.mjs'),
    read('public/analytics/overlay-ui.mjs'),
    read('public/analytics/analytics.css'),
    read('public/index.html'),
  ]);
  for (const copy of ['LOCAL ALPHA', 'THIS BROWSER ONLY', 'NOT AUTHENTICATED OR SHARED']) assert.match(`${ui}\n${overlayUi}`, new RegExp(copy, 'u'));
  for (const id of ['pipvid', 'playback', 'mrVideo', 'communication-analytics-founder-replay']) assert.match(overlayUi, new RegExp(`['\"]${id}['\"]`, 'u'));
  assert.match(overlayUi, /geometry\?\.faceCount !== 1/u);
  assert.match(overlayUi, /ca-media-overlay ca-media-overlay-mirrored/u);
  assert.match(overlayUi, /runtime\.stop\(\{ clear: true/u);
  assert.match(overlayUi, /runtime\.destroy\(\)/u);
  assert.match(overlayUi, /attributeFilter: \['style'\]/u);
  assert.match(overlayUi, /observeHostTargets\(\)/u);
  assert.doesNotMatch(overlayUi, /observe\(this\.document\.body|observe\(this\.document\.documentElement/u);
  assert.match(overlayUi, /existing && existing\.video !== video/u);
  assert.match(overlayUi, /communication-overlay-admin-policy'\)\?\.remove/u);
  assert.match(ui, /beginAnswer: \(options\) => \{ overlayUi\.beforeBeginAnswer\(\);return pipeline\.beginAnswer\(options\); \}/u);
  assert.match(ui, /pagehide.*founder\?\.destroy\(\);overlayUi\.destroy\(\)/u);
  assert.match(css, /\.ca-overlay-toggle\{[^}]*min-height:44px/u);
  assert.match(css, /\.ca-media-overlay\{position:absolute;inset:0/u);
  assert.doesNotMatch(html, /communication-overlay-admin-policy|communication-overlay-student-live-canvas/u);
});

test('student analytics result projection renderer remains free of overlay policy and experimental geometry', async () => {
  const source = await read('public/analytics/ui.mjs');
  const studentRenderer = source.slice(source.indexOf('export function renderStudentAnalytics'), source.indexOf('export class FounderAnalyticsSurface'));
  assert.doesNotMatch(studentRenderer, /LocalOverlaySettings|OverlayUiController|overlay-policy|founderPostRunReport|faceLandmarks|poseLandmarks|handLandmarks/iu);
  assert.match(studentRenderer, /studentResultProjection\(result\)/u);
  assert.match(studentRenderer, /projection\.events\.slice\(0, 9\)/u);
});
