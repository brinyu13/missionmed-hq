import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, init = {}) { super(type);this.detail=init.detail; } };
if (!globalThis.document) globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {}, getElementById() { return null; } };

const {
  LocalPlaybackOverlayRuntime,
  containFitRect,
  exactPlaybackFrameMatch,
  normalizePlaybackOverlayLayers,
  normalizePlaybackOverlayResult,
  playbackFrameDimensions,
} = await import('../../public/analytics/playback-overlay.mjs');
const { BrowserAnalyticsPipeline, normalizeOverlayFrameMetadata, normalizeOverlayInstrumentation } = await import('../../public/analytics/browser-pipeline.mjs');

class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    const values = this.listeners.get(type) || new Set();
    values.add(listener);
    this.listeners.set(type, values);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  fire(type) { for (const listener of this.listeners.get(type) || []) listener({ type }); }
}

class FakeVideo extends FakeEventTarget {
  constructor() {
    super();
    this.paused = false;
    this.ended = false;
    this.seeking = false;
    this.readyState = 4;
    this.videoWidth = 640;
    this.videoHeight = 480;
    this.currentTime = 0;
    this.currentSrc = 'blob:take-a';
    this.src = this.currentSrc;
    this.srcObject = null;
    this.callbacks = new Map();
    this.nextCallback = 0;
  }
  requestVideoFrameCallback(callback) { const id = ++this.nextCallback;this.callbacks.set(id, callback);return id; }
  cancelVideoFrameCallback(id) { this.callbacks.delete(id); }
  present(presentedAt, mediaTime) {
    const entry = this.callbacks.entries().next().value;
    assert.ok(entry, 'a video-frame callback must be scheduled');
    this.callbacks.delete(entry[0]);
    this.currentTime = mediaTime;
    entry[1](presentedAt, { mediaTime });
  }
}

class FakeDocument extends FakeEventTarget { constructor() { super();this.hidden = false; } }

class FakeWorker {
  constructor(url, options) { this.url = url;this.name = options?.name;this.messages = [];this.terminated = 0;this.onmessage = null;this.onerror = null; }
  postMessage(message, transfer = []) { this.messages.push({ message, transfer }); }
  emit(message) { this.onmessage?.({ data: message }); }
  fail(message = 'worker failed') { this.onerror?.({ message }); }
  terminate() { this.terminated += 1; }
}

const settle = async () => { await Promise.resolve();await Promise.resolve();await Promise.resolve(); };

async function waitForMessage(messages, predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const match = messages.findLast(predicate);
    if (match) return match;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('Timed out waiting for deterministic worker message.');
}

function createHarness(options = {}) {
  const video = new FakeVideo();
  const documentRef = new FakeDocument();
  const drawCalls = [];
  const clearCalls = [];
  let drawFailure = Boolean(options.throwOnDraw);
  const context = {
    clearRect: (...args) => clearCalls.push(args),
    drawImage: (...args) => {
      drawCalls.push(args);
      if (drawFailure) throw new Error('playback canvas draw failed '.repeat(40));
    },
  };
  const canvas = {
    width: 300,
    height: 150,
    clientWidth: 400,
    clientHeight: 300,
    getContext() { return context; },
  };
  const workers = [];
  const bitmaps = [];
  const states = [];
  const workerFactory = (url, workerOptions) => {
    const worker = new FakeWorker(url, workerOptions);
    workers.push(worker);
    return worker;
  };
  const createBitmap = async (input) => {
    const bitmap = { width: 480, height: 270, kind: input === video ? 'source' : 'face-clone', closed: 0, close() { this.closed += 1; } };
    bitmaps.push(bitmap);
    return bitmap;
  };
  const runtime = new LocalPlaybackOverlayRuntime({
    video, canvas, documentRef, workerFactory, createBitmap,
    onState: (state) => states.push(state),
    devicePixelRatio: () => 1,
    ...options,
  });
  const namedWorkers = () => ({
    face: workers.findLast((worker) => worker.name?.includes('playback-face')),
    holistic: workers.findLast((worker) => worker.name?.includes('playback-holistic')),
  });
  const ready = () => {
    const { face, holistic } = namedWorkers();
    const faceInit = face.messages.findLast(({ message }) => message.type === 'init')?.message;
    const holisticInit = holistic.messages.findLast(({ message }) => message.type === 'init')?.message;
    face.emit({ type: 'ready', generation: faceInit.generation, answerEpoch: faceInit.answerEpoch });
    holistic.emit({ type: 'ready', generation: holisticInit.generation, answerEpoch: holisticInit.answerEpoch });
  };
  return {
    video, documentRef, canvas, drawCalls, clearCalls, workers, bitmaps, states, runtime, namedWorkers, ready,
    setDrawFailure(value) { drawFailure = Boolean(value); },
  };
}

function lastMessage(worker, type) {
  return worker.messages.findLast(({ message }) => message.type === type)?.message;
}

function deferredBitmapFactory() {
  const requests = [];
  return {
    requests,
    createBitmap(input) {
      let resolve;
      let reject;
      const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      requests.push({ input, promise, resolve, reject });
      return promise;
    },
  };
}

function testBitmap(kind) {
  return { width: 480, height: 270, kind, closed: 0, close() { this.closed += 1; } };
}

function readyResetWorkers(harness) {
  const { face, holistic } = harness.namedWorkers();
  const faceReset = lastMessage(face, 'reset');
  const holisticReset = lastMessage(holistic, 'reset');
  assert.ok(faceReset);
  assert.ok(holisticReset);
  face.emit({ type: 'ready', generation: faceReset.generation, answerEpoch: faceReset.answerEpoch });
  holistic.emit({ type: 'ready', generation: holisticReset.generation, answerEpoch: holisticReset.answerEpoch });
}

test('overlay masks default to both layers, clamp playback to four FPS, and contain-fit source aspect', () => {
  assert.deepEqual(normalizePlaybackOverlayLayers(), { overlayEnabled: true, faceEnabled: true, bodyEnabled: true });
  assert.deepEqual(normalizePlaybackOverlayLayers({ face: false, body: true }), { overlayEnabled: true, faceEnabled: false, bodyEnabled: true });
  assert.deepEqual(normalizeOverlayInstrumentation({ overlayEnabled: true }), { overlayEnabled: true, faceEnabled: true, bodyEnabled: true });
  assert.deepEqual(playbackFrameDimensions(640, 480), { width: 360, height: 270 });
  assert.deepEqual(containFitRect(480, 270, 400, 300), { x: 0, y: 37.5, width: 400, height: 225 });
  const harness = createHarness({ targetFps: 20 });
  assert.equal(harness.runtime.targetFps, 4);
  harness.runtime.destroy();
});

test('live instrumentation forwards independently normalized face and body layers', () => {
  const pipeline = new BrowserAnalyticsPipeline({ bridge: { media: {} }, now: () => 0 });
  const posted = [];
  pipeline.worker = { postMessage: (message) => posted.push(message), terminate() {} };
  pipeline.setInstrumentation({ overlayEnabled: true });
  assert.deepEqual(posted.at(-1), { type: 'instrumentation', generation: pipeline.generation, overlayEnabled: true, faceEnabled: true, bodyEnabled: true });
  pipeline.setInstrumentation({ overlayEnabled: true, faceEnabled: false, bodyEnabled: true });
  assert.deepEqual(posted.at(-1), { type: 'instrumentation', generation: pipeline.generation, overlayEnabled: true, faceEnabled: false, bodyEnabled: true });
  const postedCount = posted.length;
  pipeline.setInstrumentation({ overlayEnabled: true, faceEnabled: false, bodyEnabled: true });
  assert.equal(posted.length, postedCount, 'unchanged masks must not flood the worker control queue');
  assert.deepEqual(pipeline.diagnostics().overlayLayers, { enabled: true, face: false, body: true });
  pipeline.destroy();
});

test('Holistic overlay render throw is display-only: live geometry survives and playback response stays geometry-free', async () => {
  const priorSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
  const priorOffscreenCanvas = Object.getOwnPropertyDescriptor(globalThis, 'OffscreenCanvas');
  const messages = [];
  const fakeSelf = {
    fetch: globalThis.fetch?.bind(globalThis) || (async () => { throw new Error('fetch unavailable'); }),
    location: { href: 'http://127.0.0.1:8420/analytics/holistic-worker.mjs' },
    postMessage(message) { messages.push(message); },
    close() {},
  };
  class ThrowingOffscreenCanvas {
    constructor(width, height) { this.width = width;this.height = height; }
    getContext() {
      return {
        canvas: this,
        clearRect() { throw new Error('renderer exploded '.repeat(40)); },
      };
    }
  }
  const visionBundle = `data:text/javascript,${encodeURIComponent(`
    export const FilesetResolver = { forVisionTasks: async () => ({}) };
    export class HolisticLandmarker {
      static async createFromOptions() {
        return {
          detectForVideo() { return { faceLandmarks: [], poseLandmarks: [], leftHandLandmarks: [], rightHandLandmarks: [], faceBlendshapes: [] }; },
          close() {},
        };
      }
    }
  `)}`;
  Object.defineProperty(globalThis, 'self', { configurable: true, writable: true, value: fakeSelf });
  Object.defineProperty(globalThis, 'OffscreenCanvas', { configurable: true, writable: true, value: ThrowingOffscreenCanvas });
  try {
    const workerUrl = new URL('../../public/analytics/holistic-worker.mjs', import.meta.url);
    workerUrl.searchParams.set('render-fault-test', 'display-only-isolation');
    await import(workerUrl.href);

    fakeSelf.onmessage({ data: {
      type: 'init', generation: 31, answerEpoch: 41,
      bundleUrl: visionBundle, wasmRoot: '/local-wasm', holisticModelUrl: '/local-model',
      overlayEnabled: true, faceEnabled: true, bodyEnabled: true,
    } });
    await waitForMessage(messages, (message) => message.type === 'ready' && message.generation === 31);
    const liveBitmap = { width: 320, height: 180, closed: 0, close() { this.closed += 1; } };
    fakeSelf.onmessage({ data: {
      type: 'frame', generation: 31, answerEpoch: 41, visionEpoch: 51, frameId: 61,
      timestampMs: 125, expectedFrameMs: 125, faceCount: 1, bitmap: liveBitmap,
    } });
    const live = await waitForMessage(messages, (message) => message.type === 'geometry' && message.generation === 31 && message.frameId === 61);
    assert.equal(Object.hasOwn(live, 'geometry'), true, 'valid compact live geometry must survive an overlay-only renderer exception');
    assert.equal(live.geometry.faceCount, 1);
    assert.equal(live.overlayRendered, false);
    assert.equal(live.overlayStatus, 'error');
    assert.equal(live.overlayUnavailableReason, 'render_failed');
    assert.equal(live.overlayErrorCode, 'overlay_render_failed');
    assert.ok(live.overlayErrorMessage.length <= 180);
    assert.equal(messages.some((message) => message.type === 'frame-error' && message.frameId === 61), false);
    assert.equal(liveBitmap.closed, 1);

    fakeSelf.onmessage({ data: {
      type: 'init', generation: 32, answerEpoch: 42,
      bundleUrl: visionBundle, wasmRoot: '/local-wasm', holisticModelUrl: '/local-model',
      overlayEnabled: true, faceEnabled: true, bodyEnabled: true, responseMode: 'overlay-only',
    } });
    await waitForMessage(messages, (message) => message.type === 'ready' && message.generation === 32);
    const playbackBitmap = { width: 320, height: 180, closed: 0, close() { this.closed += 1; } };
    fakeSelf.onmessage({ data: {
      type: 'frame', generation: 32, answerEpoch: 42, visionEpoch: 52, frameId: 62,
      timestampMs: 250, expectedFrameMs: 250, faceCount: 1, bitmap: playbackBitmap,
    } });
    const playback = await waitForMessage(messages, (message) => message.type === 'geometry' && message.generation === 32 && message.frameId === 62);
    assert.equal(Object.hasOwn(playback, 'geometry'), false, 'playback overlay-only responses must never cross the compact geometry boundary');
    assert.equal(playback.faceCount, 1);
    assert.equal(playback.overlayStatus, 'error');
    assert.equal(playback.overlayErrorCode, 'overlay_render_failed');
    assert.equal(playbackBitmap.closed, 1);
  } finally {
    if (priorSelf) Object.defineProperty(globalThis, 'self', priorSelf);
    else delete globalThis.self;
    if (priorOffscreenCanvas) Object.defineProperty(globalThis, 'OffscreenCanvas', priorOffscreenCanvas);
    else delete globalThis.OffscreenCanvas;
  }
});

test('playback joins exact FaceDetector and Holistic replies, draws contain-fit, closes transient overlay, and stays at or below four FPS', async () => {
  const harness = createHarness();
  harness.runtime.start();
  harness.ready();
  const { face, holistic } = harness.namedWorkers();
  harness.video.present(0, 0.1);
  await settle();
  const faceFrame = lastMessage(face, 'frame');
  assert.ok(faceFrame);
  assert.equal(harness.bitmaps.length, 2);
  face.emit({ ...faceFrame, type: 'face-count', faceCount: 1, faceInferenceMs: 4 });
  const holisticFrame = lastMessage(holistic, 'frame');
  assert.equal(exactPlaybackFrameMatch(faceFrame, holisticFrame), true);
  assert.equal(holisticFrame.faceCount, 1);
  const overlay = { width: 480, height: 270, closed: 0, close() { this.closed += 1; } };
  holistic.emit({ ...holisticFrame, type: 'geometry', faceCount: 1, overlayRendered: true, overlayBitmap: overlay });
  assert.equal(overlay.closed, 1);
  assert.equal(harness.drawCalls.length, 1);
  assert.deepEqual(harness.drawCalls[0].slice(1), [0, 37.5, 400, 225]);

  harness.video.present(100, 0.2);
  await settle();
  assert.equal(harness.bitmaps.length, 2, 'a second sample inside 250ms must be skipped');
  harness.video.present(250, 0.35);
  await settle();
  assert.equal(harness.bitmaps.length, 4);
  harness.runtime.destroy();
});

test('playback fails closed for non-single-face input and closes stale overlay replies without disturbing the owned frame', async () => {
  const harness = createHarness();
  harness.runtime.start();
  harness.ready();
  const { face, holistic } = harness.namedWorkers();
  harness.video.present(0, 0.1);
  await settle();
  const rejectedFaceFrame = lastMessage(face, 'frame');
  const held = harness.bitmaps[0];
  face.emit({ ...rejectedFaceFrame, type: 'face-count', faceCount: 2 });
  assert.equal(held.closed, 1);
  assert.equal(holistic.messages.some(({ message }) => message.type === 'frame'), false);
  assert.equal(harness.runtime.frameInFlight, false);
  assert.equal(harness.states.at(-1).reason, 'face_count_not_one');

  harness.video.present(300, 0.4);
  await settle();
  const acceptedFaceFrame = lastMessage(face, 'frame');
  face.emit({ ...acceptedFaceFrame, type: 'face-count', faceCount: 1 });
  const ownedHolistic = lastMessage(holistic, 'frame');
  const stale = { width: 480, height: 270, closed: 0, close() { this.closed += 1; } };
  holistic.emit({ ...ownedHolistic, frameId: ownedHolistic.frameId + 1, type: 'geometry', faceCount: 1, overlayRendered: true, overlayBitmap: stale });
  assert.equal(stale.closed, 1);
  assert.equal(harness.runtime.frameInFlight, true);
  const current = { width: 480, height: 270, closed: 0, close() { this.closed += 1; } };
  holistic.emit({ ...ownedHolistic, type: 'geometry', faceCount: 1, overlayRendered: true, overlayBitmap: current });
  assert.equal(current.closed, 1);
  assert.equal(harness.runtime.frameInFlight, false);
  harness.runtime.destroy();
});

test('playback surfaces display-only render error and unavailable states without worker recovery', async () => {
  const harness = createHarness();
  harness.runtime.start();
  harness.ready();
  const { face, holistic } = harness.namedWorkers();
  harness.video.present(0, 0.1);
  await settle();
  const firstFaceFrame = lastMessage(face, 'frame');
  face.emit({ ...firstFaceFrame, type: 'face-count', faceCount: 1 });
  const firstHolisticFrame = lastMessage(holistic, 'frame');
  holistic.emit({
    ...firstHolisticFrame,
    type: 'geometry', faceCount: 1, overlayRequested: true, overlayRendered: false,
    overlayStatus: 'error', overlayUnavailableReason: 'render_failed',
    overlayErrorCode: 'overlay_render_failed', overlayErrorMessage: 'Local overlay rendering failed for this frame.',
  });
  assert.equal(harness.states.at(-1).state, 'overlay-error');
  assert.equal(harness.states.at(-1).overlayErrorCode, 'overlay_render_failed');
  assert.equal(harness.runtime.active, true);
  assert.equal(harness.runtime.frameInFlight, false);
  assert.equal(harness.workers.length, 2, 'display-only render errors must not recover or replace analytics workers');
  assert.equal(harness.drawCalls.length, 0);

  harness.video.present(300, 0.4);
  await settle();
  const secondFaceFrame = lastMessage(face, 'frame');
  face.emit({ ...secondFaceFrame, type: 'face-count', faceCount: 1 });
  const secondHolisticFrame = lastMessage(holistic, 'frame');
  holistic.emit({
    ...secondHolisticFrame,
    type: 'geometry', faceCount: 1, overlayRequested: true, overlayRendered: false,
    overlayStatus: 'unavailable', overlayUnavailableReason: 'render_surface_unavailable',
  });
  assert.equal(harness.states.at(-1).state, 'unavailable');
  assert.equal(harness.states.at(-1).overlayUnavailableReason, 'render_surface_unavailable');
  assert.equal(harness.runtime.active, true);
  assert.equal(harness.workers.length, 2);

  harness.video.present(600, 0.7);
  await settle();
  const thirdFaceFrame = lastMessage(face, 'frame');
  face.emit({ ...thirdFaceFrame, type: 'face-count', faceCount: 1 });
  const thirdHolisticFrame = lastMessage(holistic, 'frame');
  holistic.emit({
    ...thirdHolisticFrame,
    type: 'geometry', faceCount: 1, overlayRequested: true, overlayRendered: true,
    overlayStatus: 'rendered', overlayBitmap: null,
  });
  assert.equal(harness.states.at(-1).state, 'unavailable');
  assert.equal(harness.states.at(-1).overlayStatus, 'unavailable');
  assert.equal(harness.states.at(-1).overlayUnavailableReason, 'overlay_bitmap_unavailable');
  harness.runtime.destroy();
});

test('playback canvas blit failure closes once, clears stale pixels, reports bounded error, and recovers on the next frame', async () => {
  const harness = createHarness({ throwOnDraw: true });
  harness.runtime.start();
  harness.ready();
  const { face, holistic } = harness.namedWorkers();
  harness.video.present(0, 0.1);
  await settle();
  const faceFrame = lastMessage(face, 'frame');
  face.emit({ ...faceFrame, type: 'face-count', faceCount: 1 });
  const holisticFrame = lastMessage(holistic, 'frame');
  const failedBitmap = { width: 480, height: 270, closed: 0, close() { this.closed += 1; } };
  const clearsBefore = harness.clearCalls.length;
  assert.doesNotThrow(() => holistic.emit({
    ...holisticFrame,
    type: 'geometry', faceCount: 1, overlayRequested: true, overlayRendered: true,
    overlayStatus: 'rendered', overlayBitmap: failedBitmap,
  }));
  const failure = harness.states.at(-1);
  assert.equal(failure.state, 'overlay-error');
  assert.equal(failure.overlayStatus, 'error');
  assert.equal(failure.overlayUnavailableReason, 'canvas_blit_failed');
  assert.equal(failure.overlayErrorCode, 'overlay_blit_failed');
  assert.ok(failure.overlayErrorMessage.length <= 180);
  assert.equal(failedBitmap.closed, 1, 'failed blit bitmap must close exactly once');
  assert.ok(harness.clearCalls.length > clearsBefore, 'failed blit must clear potentially stale canvas pixels');
  assert.equal(harness.runtime.frameInFlight, false);
  assert.equal(harness.runtime.inFlightHolistic, null);
  assert.equal(harness.runtime.active, true);
  assert.equal(harness.workers.length, 2);
  assert.equal(harness.states.some((state) => ['recovering', 'failed'].includes(state.state)), false);

  harness.setDrawFailure(false);
  harness.video.present(300, 0.4);
  await settle();
  const nextFaceFrame = lastMessage(face, 'frame');
  face.emit({ ...nextFaceFrame, type: 'face-count', faceCount: 1 });
  const nextHolisticFrame = lastMessage(holistic, 'frame');
  const recoveredBitmap = { width: 480, height: 270, closed: 0, close() { this.closed += 1; } };
  holistic.emit({
    ...nextHolisticFrame,
    type: 'geometry', faceCount: 1, overlayRequested: true, overlayRendered: true,
    overlayStatus: 'rendered', overlayBitmap: recoveredBitmap,
  });
  assert.equal(harness.states.at(-1).state, 'rendered');
  assert.equal(recoveredBitmap.closed, 1);
  assert.equal(harness.runtime.active, true);
  assert.equal(harness.workers.length, 2, 'successful next-frame render must reuse the same workers');
  harness.runtime.destroy();
});

test('a deferred capture rejection made stale by source replacement cannot recover current playback workers', async () => {
  const deferred = deferredBitmapFactory();
  const harness = createHarness({ createBitmap: deferred.createBitmap });
  harness.runtime.start();
  harness.ready();
  const initialWorkers = harness.namedWorkers();
  harness.video.present(0, 0.1);
  assert.equal(deferred.requests.length, 1);

  harness.video.currentSrc = 'blob:take-b';
  harness.video.src = harness.video.currentSrc;
  harness.video.fire('loadstart');
  assert.equal(harness.runtime.frameInFlight, false);
  deferred.requests[0].reject(new Error('old source capture rejected'));
  await settle();

  assert.equal(harness.runtime.active, true);
  assert.equal(harness.runtime.recoveryAttempts, 0);
  assert.equal(initialWorkers.face.terminated, 0);
  assert.equal(initialWorkers.holistic.terminated, 0);
  assert.equal(harness.workers.length, 2);
  assert.equal(harness.states.some((state) => state.reason === 'frame_capture_failed'), false);
  assert.equal(harness.states.some((state) => ['recovering', 'failed'].includes(state.state)), false);
  harness.runtime.destroy();
});

test('a deferred rejection from the current capture owner still enters bounded recovery', async () => {
  const deferred = deferredBitmapFactory();
  const harness = createHarness({ createBitmap: deferred.createBitmap });
  harness.runtime.start();
  harness.ready();
  const initialWorkers = harness.namedWorkers();
  harness.video.present(0, 0.1);
  deferred.requests[0].reject(new Error('current capture rejected'));
  await settle();

  assert.equal(harness.runtime.recoveryAttempts, 1);
  assert.equal(harness.runtime.frameInFlight, false);
  assert.equal(harness.runtime.activeCaptureToken, null);
  assert.equal(initialWorkers.face.terminated, 1);
  assert.equal(initialWorkers.holistic.terminated, 1);
  assert.equal(harness.states.at(-1).state, 'recovering');
  assert.equal(harness.states.at(-1).reason, 'frame_capture_failed');
  harness.runtime.destroy();
});

test('seek and layer epoch invalidation suppress their stale deferred capture rejections', async (t) => {
  for (const scenario of [
    {
      name: 'seek',
      invalidate(harness) { harness.video.seeking = true;harness.video.fire('seeking'); },
    },
    {
      name: 'layer change',
      invalidate(harness) { harness.runtime.setLayers({ overlayEnabled: true, faceEnabled: false, bodyEnabled: true }); },
    },
  ]) {
    await t.test(scenario.name, async () => {
      const deferred = deferredBitmapFactory();
      const harness = createHarness({ createBitmap: deferred.createBitmap });
      harness.runtime.start();
      harness.ready();
      const initialWorkers = harness.namedWorkers();
      harness.video.present(0, 0.1);
      assert.equal(deferred.requests.length, 1);
      const priorAnswerEpoch = harness.runtime.answerEpoch;
      const priorVisionEpoch = harness.runtime.visionEpoch;

      scenario.invalidate(harness);
      assert.ok(harness.runtime.answerEpoch > priorAnswerEpoch);
      assert.ok(harness.runtime.visionEpoch > priorVisionEpoch);
      assert.equal(harness.runtime.frameInFlight, false);
      deferred.requests[0].reject(new Error(`old ${scenario.name} capture rejected`));
      await settle();

      assert.equal(harness.runtime.recoveryAttempts, 0);
      assert.equal(initialWorkers.face.terminated, 0);
      assert.equal(initialWorkers.holistic.terminated, 0);
      assert.equal(harness.states.some((state) => state.reason === 'frame_capture_failed'), false);
      assert.equal(harness.runtime.active, true);
      harness.runtime.destroy();
    });
  }
});

test('an older deferred rejection cannot release a newer capture frame slot', async () => {
  const deferred = deferredBitmapFactory();
  const harness = createHarness({ createBitmap: deferred.createBitmap });
  harness.runtime.start();
  harness.ready();
  const workers = harness.namedWorkers();
  harness.video.present(0, 0.1);
  assert.equal(deferred.requests.length, 1);
  const oldCapture = deferred.requests[0];

  harness.video.seeking = true;
  harness.video.fire('seeking');
  harness.video.seeking = false;
  harness.video.fire('seeked');
  readyResetWorkers(harness);
  harness.video.present(300, 0.4);
  assert.equal(deferred.requests.length, 2);
  const newerOwner = harness.runtime.activeCaptureToken;
  assert.ok(newerOwner);
  assert.equal(harness.runtime.frameInFlight, true);

  oldCapture.reject(new Error('older capture rejected after replacement began'));
  await settle();
  assert.equal(harness.runtime.frameInFlight, true, 'the older rejection must not release the newer frame slot');
  assert.equal(harness.runtime.activeCaptureToken, newerOwner);
  assert.equal(harness.runtime.recoveryAttempts, 0);
  assert.equal(workers.face.terminated, 0);
  assert.equal(workers.holistic.terminated, 0);
  assert.equal(harness.states.some((state) => state.reason === 'frame_capture_failed'), false);

  const newerSourceBitmap = testBitmap('newer-source');
  deferred.requests[1].resolve(newerSourceBitmap);
  await settle();
  assert.equal(deferred.requests.length, 3);
  const newerFaceBitmap = testBitmap('newer-face-clone');
  deferred.requests[2].resolve(newerFaceBitmap);
  await settle();
  const faceFrame = lastMessage(workers.face, 'frame');
  assert.equal(faceFrame.frameId, newerOwner.frameId);
  assert.equal(harness.runtime.pendingFaceFrame.frameId, newerOwner.frameId);
  assert.equal(harness.runtime.frameInFlight, true);
  harness.runtime.destroy();
  assert.equal(newerSourceBitmap.closed, 1);
});

test('pause, seek, hidden state, source change, stop, and destroy clear pending data and release lifecycle resources', async () => {
  const harness = createHarness();
  harness.runtime.start();
  harness.runtime.start();
  assert.equal(harness.workers.length, 2, 'start must be idempotent');
  harness.ready();
  const firstWorkers = harness.namedWorkers();
  harness.video.present(0, 0.1);
  await settle();
  const pending = harness.bitmaps[0];
  harness.video.paused = true;
  harness.video.fire('pause');
  assert.equal(pending.closed, 1);
  assert.equal(harness.runtime.frameInFlight, false);
  assert.ok(lastMessage(firstWorkers.face, 'reset'));
  assert.ok(lastMessage(firstWorkers.holistic, 'reset'));

  const reset = lastMessage(firstWorkers.face, 'reset');
  firstWorkers.face.emit({ type: 'ready', generation: reset.generation, answerEpoch: reset.answerEpoch });
  firstWorkers.holistic.emit({ type: 'ready', generation: reset.generation, answerEpoch: reset.answerEpoch });
  harness.video.paused = false;
  harness.video.fire('play');
  harness.video.present(300, 0.4);
  await settle();
  const seekPending = harness.bitmaps[2];
  harness.video.seeking = true;
  harness.video.fire('seeking');
  assert.equal(seekPending.closed, 1);
  harness.video.currentSrc = 'blob:take-b';
  harness.video.src = harness.video.currentSrc;
  harness.video.fire('loadstart');
  assert.equal(harness.states.some((state) => state.reason === 'source_changed'), true);
  harness.documentRef.hidden = true;
  harness.documentRef.fire('visibilitychange');
  assert.equal(harness.states.at(-1).reason, 'document_hidden');

  harness.runtime.stop({ reason: 'ui_disabled' });
  assert.equal(harness.runtime.active, false);
  harness.runtime.destroy();
  assert.equal(firstWorkers.face.terminated, 1);
  assert.equal(firstWorkers.holistic.terminated, 1);
  assert.equal([...harness.video.listeners.values()].every((listeners) => listeners.size === 0), true);
  assert.equal(harness.documentRef.listeners.get('visibilitychange')?.size || 0, 0);
  assert.equal(harness.states.at(-1).state, 'destroyed');
});

test('worker failure is visible, recovery is bounded, and final failure does not spin', () => {
  const timers = new Map();
  let nextTimer = 0;
  const harness = createHarness({
    maximumRecoveryAttempts: 1,
    setTimer(callback, delay) { const id = ++nextTimer;timers.set(id, { callback, delay });return id; },
    clearTimer(id) { timers.delete(id); },
  });
  harness.runtime.start();
  harness.ready();
  const failedPair = harness.namedWorkers();
  failedPair.face.fail('first failure');
  assert.equal(harness.states.at(-1).state, 'recovering');
  failedPair.holistic.fail('paired stale failure');
  assert.equal(harness.states.filter((state) => state.state === 'recovering').length, 1);
  const recoveryEntry = [...timers.entries()].find(([, { delay }]) => delay === 250);
  const recovery = recoveryEntry?.[1];
  assert.ok(recovery);
  timers.delete(recoveryEntry[0]);
  recovery.callback();
  assert.equal(harness.workers.length, 4);
  harness.namedWorkers().face.fail('second failure');
  assert.equal(harness.states.at(-1).state, 'failed');
  assert.equal(harness.runtime.active, false);
  assert.equal([...timers.values()].some(({ delay }) => delay === 250), false);
  harness.runtime.destroy();
});

test('successful face safety cannot reset persistent Holistic failure recovery', async () => {
  const timers = new Map();
  let nextTimer = 0;
  const harness = createHarness({
    maximumRecoveryAttempts: 1,
    setTimer(callback, delay) { const id = ++nextTimer;timers.set(id, { callback, delay });return id; },
    clearTimer(id) { timers.delete(id); },
  });
  harness.runtime.start();
  harness.ready();

  const failHolisticFrame = async (presentedAt, mediaTime) => {
    const { face, holistic } = harness.namedWorkers();
    harness.video.present(presentedAt, mediaTime);
    await settle();
    const faceFrame = lastMessage(face, 'frame');
    face.emit({ ...faceFrame, type: 'face-count', faceCount: 1 });
    const holisticFrame = lastMessage(holistic, 'frame');
    holistic.emit({ ...holisticFrame, type: 'frame-error', message: 'persistent holistic failure' });
  };

  await failHolisticFrame(0, 0.1);
  assert.equal(harness.states.at(-1).state, 'recovering');
  const recoveryEntry = [...timers.entries()].find(([, value]) => value.delay === 250);
  assert.ok(recoveryEntry);
  timers.delete(recoveryEntry[0]);
  recoveryEntry[1].callback();
  harness.ready();
  await failHolisticFrame(300, 0.4);
  assert.equal(harness.states.at(-1).state, 'failed');
  assert.equal(harness.runtime.active, false);
  assert.equal(harness.states.filter((state) => state.state === 'recovering').length, 1);
  harness.runtime.destroy();
});

test('layer-mask changes clear the prior playback bitmap immediately', () => {
  const harness = createHarness();
  harness.runtime.start();
  harness.ready();
  const before = harness.clearCalls.length;
  harness.runtime.setLayers({ overlayEnabled: true, faceEnabled: false, bodyEnabled: true });
  assert.ok(harness.clearCalls.length > before);
  const afterFace = harness.clearCalls.length;
  harness.runtime.setLayers({ overlayEnabled: true, faceEnabled: true, bodyEnabled: false });
  assert.ok(harness.clearCalls.length > afterFace);
  harness.runtime.destroy();
});

test('accepted non-rendered live frames and vision invalidation clear through the overlay consumer', () => {
  let now = 20;
  const pipeline = new BrowserAnalyticsPipeline({ bridge: { media: {} }, now: () => now });
  const payloads = [];
  pipeline.setOverlayConsumer((payload) => payloads.push(payload));
  pipeline.setInstrumentation({ overlayEnabled: true, faceEnabled: true, bodyEnabled: true });
  pipeline.generation = 3;
  pipeline.answerEpoch = 4;
  pipeline.visionEpoch = 5;
  pipeline.answer = { startedAtMs: 0 };
  pipeline.answerSealed = false;
  pipeline.session = {
    ingestVision() {},
    clock: { sessionMs: () => 25 },
    vision: { trackers: {} },
  };
  for (const faceCount of [0, 2, null]) {
    const frameId = payloads.length + 1;
    pipeline.inFlightVision = { generation: 3, answerEpoch: 4, visionEpoch: 5, frameId, timestampMs: frameId * 10, captureStartedAt: 0 };
    pipeline.frameInFlight = true;
    pipeline.onWorkerMessage({
      type: 'geometry', generation: 3, answerEpoch: 4, visionEpoch: 5, frameId,
      timestampMs: frameId * 10, expectedFrameMs: 125,
      geometry: { faceCount }, overlayRendered: false, overlayPrimitiveCount: 0,
    }, 3);
    assert.equal(payloads.at(-1).bitmap, null);
    assert.equal(payloads.at(-1).geometry.faceCount, faceCount);
    now += 10;
  }
  const beforeInvalidation = payloads.length;
  pipeline.invalidateVision('camera_disconnected', { subsystem: 'vision', atMs: 40 });
  assert.equal(payloads.length, beforeInvalidation + 1);
  assert.deepEqual({ bitmap: payloads.at(-1).bitmap, geometry: payloads.at(-1).geometry, atMs: payloads.at(-1).atMs }, { bitmap: null, geometry: null, atMs: 40 });
  pipeline.answer = null;
  pipeline.destroy();
});

test('live pipeline ingests compact geometry while surfacing bounded overlay renderer failure', () => {
  const pipeline = new BrowserAnalyticsPipeline({ bridge: { media: {} }, now: () => 80 });
  const payloads = [];
  const states = [];
  const diagnostics = [];
  const ingested = [];
  pipeline.setOverlayConsumer((payload) => payloads.push(payload));
  pipeline.setInstrumentation({ overlayEnabled: true, faceEnabled: true, bodyEnabled: true });
  pipeline.addEventListener('state', (event) => states.push(event.detail));
  pipeline.addEventListener('diagnostic', (event) => diagnostics.push(event.detail));
  pipeline.generation = 13;
  pipeline.answerEpoch = 14;
  pipeline.visionEpoch = 15;
  pipeline.answer = { startedAtMs: 0 };
  pipeline.session = {
    ingestVision(value) { ingested.push(value); },
    clock: { sessionMs: () => 80 },
    vision: { trackers: {} },
  };
  pipeline.inFlightVision = { generation: 13, answerEpoch: 14, visionEpoch: 15, frameId: 16, timestampMs: 75, captureStartedAt: 0 };
  pipeline.frameInFlight = true;
  const geometry = { faceCount: 1, face: { present: false }, pose: { torsoPresent: false }, hands: {} };
  pipeline.onWorkerMessage({
    type: 'geometry', generation: 13, answerEpoch: 14, visionEpoch: 15, frameId: 16,
    timestampMs: 75, expectedFrameMs: 125, geometry, faceCount: 1,
    overlayRequested: true, overlayRendered: false, overlayPrimitiveCount: 0,
    overlayLayers: { face: true, body: true }, overlayStatus: 'error',
    overlayUnavailableReason: 'render_failed', overlayErrorCode: 'overlay_render_failed',
    overlayErrorMessage: 'Local overlay rendering failed for this frame.',
  }, 13);
  assert.equal(ingested.length, 1, 'analytics ingestion must survive display renderer failure');
  assert.equal(ingested[0].geometry, geometry);
  assert.equal(payloads.at(-1).bitmap, null);
  assert.equal(payloads.at(-1).overlayStatus, 'error');
  assert.equal(states.at(-1).subsystem, 'overlay-display');
  assert.match(states.at(-1).message, /analytics continued/iu);
  assert.equal(diagnostics.at(-1).geometry, geometry);
  assert.equal(diagnostics.at(-1).overlayErrorCode, 'overlay_render_failed');
  assert.equal(pipeline.diagnostics().overlayRendererErrorActive, true);
  pipeline.answer = null;
  pipeline.destroy();
});

test('overlay result metadata is enum-bounded and truncates worker error copy', () => {
  assert.deepEqual(normalizeOverlayFrameMetadata({
    overlayRequested: true,
    overlayRendered: false,
    overlayStatus: 'error',
    overlayUnavailableReason: 'render_failed',
    overlayErrorCode: 'overlay_render_failed',
    overlayErrorMessage: 'x'.repeat(500),
  }), {
    overlayStatus: 'error',
    overlayUnavailableReason: 'render_failed',
    overlayErrorCode: 'overlay_render_failed',
    overlayErrorMessage: 'x'.repeat(180),
  });
  assert.deepEqual(normalizePlaybackOverlayResult({
    overlayRequested: true,
    overlayRendered: false,
    overlayStatus: 'invented',
    overlayUnavailableReason: 'raw coordinates: 1,2',
    overlayErrorCode: 'arbitrary',
  }), {
    overlayStatus: 'unavailable',
    overlayUnavailableReason: 'no_renderable_primitives',
    overlayErrorCode: null,
    overlayErrorMessage: null,
  });
});

test('an in-flight live bitmap rendered under an old layer mask cannot repaint a disabled layer', () => {
  const pipeline = new BrowserAnalyticsPipeline({ bridge: { media: {} }, now: () => 50 });
  const payloads = [];
  const states = [];
  const diagnostics = [];
  pipeline.setOverlayConsumer((payload) => payloads.push(payload));
  pipeline.addEventListener('state', (event) => states.push(event.detail));
  pipeline.addEventListener('diagnostic', (event) => diagnostics.push(event.detail));
  pipeline.setInstrumentation({ overlayEnabled: true, faceEnabled: false, bodyEnabled: true });
  pipeline.generation = 7;
  pipeline.answerEpoch = 8;
  pipeline.visionEpoch = 9;
  pipeline.answer = { startedAtMs: 0 };
  pipeline.session = { ingestVision() {}, clock: { sessionMs: () => 50 }, vision: { trackers: {} } };
  pipeline.inFlightVision = { generation: 7, answerEpoch: 8, visionEpoch: 9, frameId: 10, timestampMs: 40, captureStartedAt: 0 };
  const oldMaskBitmap = { closed: 0, close() { this.closed += 1; } };
  pipeline.onWorkerMessage({
    type: 'geometry', generation: 7, answerEpoch: 8, visionEpoch: 9, frameId: 10,
    timestampMs: 40, expectedFrameMs: 125, geometry: { faceCount: 1 },
    overlayRequested: true, overlayLayers: { face: true, body: true }, overlayRendered: true, overlayBitmap: oldMaskBitmap,
    overlayStatus: 'error', overlayUnavailableReason: 'render_failed', overlayErrorCode: 'overlay_render_failed',
  }, 7);
  assert.equal(payloads.at(-1).bitmap, null);
  assert.equal(payloads.at(-1).overlayStatus, 'unavailable');
  assert.equal(payloads.at(-1).overlayUnavailableReason, 'layer_mask_changed');
  assert.equal(diagnostics.at(-1).overlayRendered, false);
  assert.equal(diagnostics.at(-1).overlayStatus, 'unavailable');
  assert.equal(diagnostics.at(-1).overlayUnavailableReason, 'layer_mask_changed');
  assert.equal(diagnostics.at(-1).overlayErrorCode, null);
  assert.equal(diagnostics.at(-1).overlayErrorMessage, null);
  assert.equal(states.some((state) => state.subsystem === 'overlay-display'), false, 'a stale old-mask renderer error must not overwrite current display truth');
  assert.equal(oldMaskBitmap.closed, 1);
  pipeline.answer = null;
  pipeline.destroy();
});

test('an already queued recovery callback cannot replace workers created by an explicit restart', () => {
  const timers = new Map();
  let nextTimer = 0;
  const harness = createHarness({
    setTimer(callback, delay) { const id = ++nextTimer;timers.set(id, { callback, delay });return id; },
    clearTimer(id) { timers.delete(id); },
  });
  harness.runtime.start();
  harness.ready();
  harness.namedWorkers().face.fail('recover once');
  const pending = [...timers.values()].find(({ delay }) => delay === 250)?.callback;
  assert.equal(typeof pending, 'function');
  const workersBeforeRestart = harness.workers.length;
  harness.runtime.start();
  const workersAfterRestart = harness.workers.length;
  assert.equal(workersAfterRestart, workersBeforeRestart + 2);
  pending();
  assert.equal(harness.workers.length, workersAfterRestart, 'stale queued recovery must be epoch-rejected');
  harness.runtime.destroy();
});

test('playback overlay source contains no capture, persistence, raw-coordinate, recording, or analytics-event path', async () => {
  const root = new URL('../../', import.meta.url);
  const playback = await readFile(new URL('public/analytics/playback-overlay.mjs', root), 'utf8');
  const holistic = await readFile(new URL('public/analytics/holistic-worker.mjs', root), 'utf8');
  assert.doesNotMatch(playback, /getUserMedia|MediaRecorder|localStorage|sessionStorage|indexedDB|AnalyticsSession|landmarks|coordinates/iu);
  assert.doesNotMatch(playback, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/iu);
  assert.match(playback, /message\.faceCount !== 1/u);
  assert.match(playback, /responseMode: 'overlay-only'/u);
  assert.match(playback, /message\.faceCount === 1/u);
  assert.match(playback, /finally \{\s*closeBitmap\(bitmap\);/u);
  assert.match(holistic, /if \(overlayFaceEnabled\)/u);
  assert.match(holistic, /if \(overlayBodyEnabled\)/u);
  assert.match(holistic, /if \(responseMode !== 'overlay-only'\) response\.geometry = geometry/u);
  assert.doesNotMatch(holistic, /overlayVectors|connectionVectors|Float32Array/iu);
});
