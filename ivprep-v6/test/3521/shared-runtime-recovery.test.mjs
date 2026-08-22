import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event {
  constructor(type, init = {}) { super(type); this.detail = init.detail; }
};
globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {}, getElementById() { return null; } };

const { BrowserAnalyticsPipeline } = await import('../../public/analytics/browser-pipeline.mjs');

test('camera loss keeps a bounded vision poll alive and first recovered frame closes the observation gap', async () => {
  const priorWorker = globalThis.Worker;
  const priorSetTimeout = globalThis.setTimeout;
  const priorClearTimeout = globalThis.clearTimeout;
  const priorBitmap = globalThis.createImageBitmap;
  const scheduled = [];
  const workers = [];
  const track = { readyState: 'live', enabled: true, muted: false };
  let now = 0;
  globalThis.setTimeout = (callback, delay) => { scheduled.push({ callback, delay }); return scheduled.length; };
  globalThis.clearTimeout = () => {};
  globalThis.Worker = class FakeWorker {
    constructor(_url, options = {}) { this.name = options.name; this.messages = []; workers.push(this); }
    postMessage(message) { this.messages.push(message); }
    terminate() {}
  };
  globalThis.createImageBitmap = async () => ({ width: 480, height: 270, close() {} });
  const bridge = { media: { cam: true, stream: { getVideoTracks: () => [track] } } };
  const video = { readyState: 4, videoWidth: 640, videoHeight: 360 };
  const pipeline = new BrowserAnalyticsPipeline({ bridge, now: () => now });
  const takeVisionPoll = () => {
    const index = scheduled.findIndex((entry) => entry.delay === 125);
    assert.notEqual(index, -1, 'a target-FPS vision poll must be scheduled');
    return scheduled.splice(index, 1)[0];
  };
  try {
    pipeline.beginAnswer({ answerId: 'recover', videoElement: video });
    pipeline.workerReady = true;
    pipeline.faceWorkerReady = true;
    track.muted = true;
    now = 250;
    await takeVisionPoll().callback();
    assert.notEqual(pipeline.visionDisconnectedAt, null);
    assert.ok(scheduled.some((entry) => entry.delay === 125), 'camera recovery must keep polling');

    track.muted = false;
    now = 500;
    await takeVisionPoll().callback();
    const faceWorker = workers.find((worker) => worker.name?.includes('face-safety'));
    const faceFrame = faceWorker.messages.find((message) => message.type === 'frame');
    const primaryLock = { state: 'PRIMARY_LOCKED', selectionRequired: false, bystanderCount: 0 };
    pipeline.onFaceWorkerMessage({ ...faceFrame, type: 'primary-lock', faceCount: 1, primaryUsable: true, primaryRoi: { left: .1, top: .1, width: .8, height: .8 }, primaryLock }, pipeline.generation);
    const holistic = workers.find((worker) => worker.name?.startsWith('communication-analytics-'));
    const frame = holistic.messages.find((message) => message.type === 'frame');
    pipeline.onWorkerMessage({
      type: 'geometry', generation: pipeline.generation, answerEpoch: pipeline.answerEpoch,
      visionEpoch: frame.visionEpoch, frameId: frame.frameId, timestampMs: frame.timestampMs,
      expectedFrameMs: frame.expectedFrameMs, geometry: {
        faceCount: 1, primaryAssociated: true,
        face: { present: true, yawProxyDeg: 0, pitchProxyDeg: 0, rollProxyDeg: 0, movementRatePerSecond: 0 },
        pose: { torsoPresent: false }, hands: {},
      }, primaryLock, overlayRendered: false,
    }, pipeline.generation);
    assert.equal(pipeline.visionDisconnectedAt, null);
    assert.ok(pipeline.session.vision.gaps.some((gap) => gap.value === 'camera_or_vision_disconnected'));
  } finally {
    pipeline.destroy();
    if (priorWorker === undefined) delete globalThis.Worker; else globalThis.Worker = priorWorker;
    if (priorBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = priorBitmap;
    globalThis.setTimeout = priorSetTimeout;
    globalThis.clearTimeout = priorClearTimeout;
  }
});

test('pipeline instrumentation remains backward compatible while exposing four overlay layers', () => {
  const messages = [];
  const pipeline = new BrowserAnalyticsPipeline({ bridge: { media: {} }, now: () => 0 });
  try {
    pipeline.worker = { postMessage(message) { messages.push(message); } };
    pipeline.setInstrumentation({
      overlayEnabled: true,
      faceOverlayEnabled: false,
      handsOverlayEnabled: true,
      bodyOverlayEnabled: false,
      framingOverlayEnabled: true,
    });
    assert.deepEqual(messages.at(-1), {
      type: 'instrumentation', generation: pipeline.generation,
      overlayEnabled: true, faceOverlayEnabled: false, bodyHandsOverlayEnabled: true,
      handsOverlayEnabled: true, bodyOverlayEnabled: false, framingOverlayEnabled: true,
    });
  } finally { pipeline.destroy(); }
});

test('worker drawing gates face, hands, body, and framing independently', async () => {
  const source = await readFile(new URL('../../public/analytics/holistic-worker.mjs', import.meta.url), 'utf8');
  for (const gate of ['faceOverlayEnabled', 'handsOverlayEnabled', 'bodyOverlayEnabled', 'framingOverlayEnabled']) {
    assert.match(source, new RegExp(`if \\(${gate}(?: && box)?\\)`, 'u'));
  }
  assert.doesNotMatch(source, /if \(bodyHandsOverlayEnabled\)/u);
});
