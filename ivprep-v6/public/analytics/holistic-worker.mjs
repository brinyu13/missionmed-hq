import { assertCompactGeometry, deriveCompactGeometry, facialMovementRate } from './vision-geometry.mjs';

let holistic = null;
let visionModule = null;
let ready = false;
let generation = 0;
let activeAnswerEpoch = 0;
let overlayEnabled = false;
let overlayCanvas = null;
let overlayContext = null;
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
  const fileset = await module.FilesetResolver.forVisionTasks(wasmRoot, true);
  return module.HolisticLandmarker.createFromOptions(fileset, { ...common, baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' } });
}

function overlaySurface(width, height) {
  if (typeof OffscreenCanvas !== 'function') return null;
  if (!overlayCanvas || overlayCanvas.width !== width || overlayCanvas.height !== height) {
    overlayCanvas = new OffscreenCanvas(width, height);
    overlayContext = overlayCanvas.getContext('2d');
  }
  return overlayContext ? { canvas: overlayCanvas, context: overlayContext } : null;
}

function drawConnections(context, landmarks, connections, color, width, respectVisibility = false) {
  if (!Array.isArray(landmarks) || !Array.isArray(connections)) return 0;
  let count = 0;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  for (const connection of connections) {
    const start = landmarks[connection.start];
    const end = landmarks[connection.end];
    if (![start?.x, start?.y, end?.x, end?.y].every(Number.isFinite)) continue;
    if (respectVisibility && ((start.visibility ?? 1) < 0.35 || (end.visibility ?? 1) < 0.35)) continue;
    context.moveTo(start.x * context.canvas.width, start.y * context.canvas.height);
    context.lineTo(end.x * context.canvas.width, end.y * context.canvas.height);
    count += 1;
  }
  context.stroke();
  return count;
}

function drawPoints(context, landmarks, color, radius, respectVisibility = false) {
  if (!Array.isArray(landmarks)) return 0;
  let count = 0;
  context.fillStyle = color;
  for (const value of landmarks) {
    if (![value?.x, value?.y].every(Number.isFinite) || (respectVisibility && (value.visibility ?? 1) < 0.35)) continue;
    context.beginPath();
    context.arc(value.x * context.canvas.width, value.y * context.canvas.height, radius, 0, Math.PI * 2);
    context.fill();
    count += 1;
  }
  return count;
}

function renderOverlay(result, geometry, faceCount, width, height) {
  if (!overlayEnabled || faceCount !== 1) return { bitmap: null, primitiveCount: 0 };
  const surface = overlaySurface(width, height);
  if (!surface) return { bitmap: null, primitiveCount: 0 };
  const { canvas, context } = surface;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const face = result?.faceLandmarks?.[0];
  const pose = result?.poseLandmarks?.[0];
  const leftHand = result?.leftHandLandmarks?.[0];
  const rightHand = result?.rightHandLandmarks?.[0];
  let primitiveCount = 0;
  primitiveCount += drawConnections(context, face, visionModule?.HolisticLandmarker?.FACE_LANDMARKS_TESSELATION, 'rgba(72,220,255,.32)', 0.7);
  primitiveCount += drawConnections(context, face, visionModule?.HolisticLandmarker?.FACE_LANDMARKS_CONTOURS, 'rgba(94,255,208,.95)', 1.2);
  primitiveCount += drawConnections(context, pose, visionModule?.HolisticLandmarker?.POSE_CONNECTIONS, 'rgba(94,255,208,.92)', 2, true);
  primitiveCount += drawPoints(context, pose, 'rgba(220,255,247,.98)', 2, true);
  primitiveCount += drawConnections(context, leftHand, visionModule?.HolisticLandmarker?.HAND_CONNECTIONS, 'rgba(65,214,255,.98)', 1.5);
  primitiveCount += drawPoints(context, leftHand, 'rgba(65,214,255,.98)', 1.8);
  primitiveCount += drawConnections(context, rightHand, visionModule?.HolisticLandmarker?.HAND_CONNECTIONS, 'rgba(195,115,255,.98)', 1.5);
  primitiveCount += drawPoints(context, rightHand, 'rgba(220,175,255,.98)', 1.8);
  const box = geometry?.face?.box;
  if (box) {
    context.strokeStyle = 'rgba(94,255,208,.98)';
    context.lineWidth = 1.5;
    context.strokeRect(box.left * canvas.width, box.top * canvas.height, box.width * canvas.width, box.height * canvas.height);
    const centerX = box.centerX * canvas.width;
    const centerY = box.centerY * canvas.height;
    const yaw = Math.max(-1, Math.min(1, (geometry.face.yawProxyDeg || 0) / 45));
    const pitch = Math.max(-1, Math.min(1, (geometry.face.pitchProxyDeg || 0) / 35));
    context.strokeStyle = 'rgba(255,209,102,.98)';
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + yaw * 34, centerY + pitch * 25);
    context.stroke();
    context.fillStyle = 'rgba(255,209,102,.98)';
    context.beginPath();
    context.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
    context.fill();
    primitiveCount += 3;
  }
  return primitiveCount > 0
    ? { bitmap: canvas.transferToImageBitmap(), primitiveCount }
    : { bitmap: null, primitiveCount: 0 };
}

async function initialize(message) {
  generation = message.generation;
  activeAnswerEpoch = message.answerEpoch;
  overlayEnabled = Boolean(message.overlayEnabled);
  visionModule = await import(message.bundleUrl);
  holistic = await createHolistic(visionModule, message.wasmRoot, message.holisticModelUrl);
  ready = true;
  self.postMessage({ type: 'ready', generation, answerEpoch: activeAnswerEpoch });
}

async function analyze(message) {
  const bitmap = message.bitmap;
  let overlayBitmap = null;
  const startedAt = performance.now();
  try {
    if (!ready || message.generation !== generation || message.answerEpoch !== activeAnswerEpoch) return;
    const faceCount = Number.isFinite(message.faceCount) ? Math.max(0, Math.round(message.faceCount)) : null;
    const result = holistic.detectForVideo(bitmap, message.timestampMs);
    const derived = deriveCompactGeometry(result, { faceCount });
    const faceCategories = result?.faceBlendshapes?.[0]?.categories || null;
    const movementRatePerSecond = facialMovementRate(faceCategories, priorFaceCategories, message.timestampMs - priorFaceAtMs);
    priorFaceCategories = Array.isArray(faceCategories) ? faceCategories.map((category) => ({ categoryName: category.categoryName, score: category.score })) : null;
    priorFaceAtMs = message.timestampMs;
    const geometry = Object.freeze({ ...derived, face: Object.freeze({ ...derived.face, movementRatePerSecond }) });
    assertCompactGeometry(geometry);
    const overlay = renderOverlay(result, geometry, faceCount, bitmap.width, bitmap.height);
    overlayBitmap = overlay.bitmap;
    const response = {
      type: 'geometry',
      generation,
      answerEpoch: message.answerEpoch,
      visionEpoch: message.visionEpoch,
      frameId: message.frameId,
      timestampMs: message.timestampMs,
      expectedFrameMs: message.expectedFrameMs,
      holisticInferenceMs: Number((performance.now() - startedAt).toFixed(2)),
      faceInferenceMs: Number.isFinite(message.faceInferenceMs) ? message.faceInferenceMs : null,
      geometry,
      overlayRequested: overlayEnabled,
      overlayRendered: Boolean(overlayBitmap),
      overlayPrimitiveCount: overlay.primitiveCount,
      overlayBitmap,
    };
    self.postMessage(response, overlayBitmap ? [overlayBitmap] : []);
    overlayBitmap = null;
  } catch (error) {
    overlayBitmap?.close?.();
    self.postMessage({ type: 'frame-error', generation, answerEpoch: message.answerEpoch, visionEpoch: message.visionEpoch, frameId: message.frameId, timestampMs: message.timestampMs, expectedFrameMs: message.expectedFrameMs, message: String(error?.message || error).slice(0, 180) });
  } finally {
    bitmap?.close?.();
  }
}

async function shutdown(message) {
  if (message.generation !== generation) return;
  ready = false;
  try { holistic?.close?.(); } catch {}
  holistic = null;
  visionModule = null;
  if (overlayCanvas) overlayContext?.clearRect?.(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayCanvas = null;
  overlayContext = null;
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
  if (ready) self.postMessage({ type: 'ready', generation, answerEpoch: activeAnswerEpoch });
}

function configureInstrumentation(message) {
  if (message.generation !== generation) return;
  overlayEnabled = Boolean(message.overlayEnabled);
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'init') initialize(message).catch((error) => self.postMessage({ type: 'init-error', generation: message.generation, answerEpoch: activeAnswerEpoch, message: String(error?.message || error).slice(0, 180) }));
  if (message.type === 'frame') analyze(message);
  if (message.type === 'reset') resetTemporalState(message);
  if (message.type === 'instrumentation') configureInstrumentation(message);
  if (message.type === 'shutdown') shutdown(message);
};
