import { assertCompactGeometry, deriveCompactGeometry, facialMovementRate } from './vision-geometry.mjs';

let holistic = null;
let faceDetector = null;
let ready = false;
let generation = 0;
let activeAnswerEpoch = 0;
let priorFaceCategories = null;
let priorFaceAtMs = null;
const originalFetch = self.fetch.bind(self);

function sameOriginUrl(value) {
  const url = new URL(value instanceof Request ? value.url : value, self.location.href);
  if (url.origin !== self.location.origin) {
    self.postMessage({ type: 'egress-blocked', generation, count: 1 });
    throw new TypeError('Analytics worker blocked a non-same-origin request.');
  }
  return url;
}

self.fetch = (input, init) => {
  sameOriginUrl(input);
  return originalFetch(input, init);
};

if (self.XMLHttpRequest?.prototype?.open) {
  const originalOpen = self.XMLHttpRequest.prototype.open;
  self.XMLHttpRequest.prototype.open = function guardedOpen(method, url, ...rest) {
    sameOriginUrl(url);
    return originalOpen.call(this, method, url, ...rest);
  };
}

async function createHolistic(module, wasmRoot, modelUrl) {
  const common = {
    runningMode: 'VIDEO',
    outputFaceBlendshapes: true,
    outputPoseSegmentationMasks: false,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minHandLandmarksConfidence: 0.5,
  };
  try {
    const gpuFileset = await module.FilesetResolver.forVisionTasks(wasmRoot, true);
    return await module.HolisticLandmarker.createFromOptions(gpuFileset, { ...common, baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' } });
  } catch {
    const cpuFileset = await module.FilesetResolver.forVisionTasks(wasmRoot, true);
    return module.HolisticLandmarker.createFromOptions(cpuFileset, { ...common, baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' } });
  }
}

async function initialize(message) {
  generation = message.generation;
  activeAnswerEpoch = message.answerEpoch;
  const module = await import(message.bundleUrl);
  holistic = await createHolistic(module, message.wasmRoot, message.holisticModelUrl);
  try {
    const faceFileset = await module.FilesetResolver.forVisionTasks(message.wasmRoot, true);
    faceDetector = await module.FaceDetector.createFromOptions(faceFileset, {
      baseOptions: { modelAssetPath: message.faceDetectorModelUrl, delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
      minSuppressionThreshold: 0.3,
    });
  } catch {
    faceDetector = null;
  }
  ready = true;
  self.postMessage({ type: 'ready', generation, answerEpoch: activeAnswerEpoch, multiFaceProtection: Boolean(faceDetector) });
}

async function analyze(message) {
  const bitmap = message.bitmap;
  const startedAt = performance.now();
  try {
    if (!ready || message.generation !== generation || message.answerEpoch !== activeAnswerEpoch) return;
    let faceCount = null;
    if (faceDetector) {
      try {
        const faceResult = faceDetector.detectForVideo(bitmap, message.timestampMs);
        faceCount = Array.isArray(faceResult?.detections) ? faceResult.detections.length : null;
      } catch {
        faceCount = null;
      }
    }
    const result = holistic.detectForVideo(bitmap, message.timestampMs);
    const derived = deriveCompactGeometry(result, { faceCount });
    const faceCategories = result?.faceBlendshapes?.[0]?.categories || null;
    const movementRatePerSecond = facialMovementRate(faceCategories, priorFaceCategories, message.timestampMs - priorFaceAtMs);
    priorFaceCategories = Array.isArray(faceCategories) ? faceCategories.map((category) => ({ categoryName: category.categoryName, score: category.score })) : null;
    priorFaceAtMs = message.timestampMs;
    const geometry = Object.freeze({ ...derived, face: Object.freeze({ ...derived.face, movementRatePerSecond }) });
    assertCompactGeometry(geometry);
    self.postMessage({
      type: 'geometry',
      generation,
      answerEpoch: message.answerEpoch,
      frameId: message.frameId,
      timestampMs: message.timestampMs,
      expectedFrameMs: message.expectedFrameMs,
      inferenceMs: Number((performance.now() - startedAt).toFixed(2)),
      geometry,
    });
  } catch (error) {
    self.postMessage({ type: 'frame-error', generation, answerEpoch: message.answerEpoch, frameId: message.frameId, timestampMs: message.timestampMs, expectedFrameMs: message.expectedFrameMs, message: String(error?.message || error).slice(0, 180) });
  } finally {
    bitmap?.close?.();
  }
}

async function shutdown(message) {
  if (message.generation !== generation) return;
  ready = false;
  try { holistic?.close?.(); } catch {}
  try { faceDetector?.close?.(); } catch {}
  holistic = null;
  faceDetector = null;
  priorFaceCategories = null;
  priorFaceAtMs = null;
  self.postMessage({ type: 'closed', generation });
  self.close();
}

function resetTemporalState(message) {
  if (message.generation !== generation) return;
  activeAnswerEpoch = message.answerEpoch;
  priorFaceCategories = null;
  priorFaceAtMs = null;
  if (ready) self.postMessage({ type: 'ready', generation, answerEpoch: activeAnswerEpoch, multiFaceProtection: Boolean(faceDetector) });
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'init') initialize(message).catch((error) => self.postMessage({ type: 'init-error', generation: message.generation, answerEpoch: activeAnswerEpoch, message: String(error?.message || error).slice(0, 180) }));
  if (message.type === 'frame') analyze(message);
  if (message.type === 'reset') resetTemporalState(message);
  if (message.type === 'shutdown') shutdown(message);
};
