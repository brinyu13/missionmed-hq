import { assertCompactGeometry, deriveCompactGeometry, facialMovementRate } from './vision-geometry.mjs';
import { resolveVisionFileset } from './vision-fileset.mjs';

let holistic = null;
let visionModule = null;
let ready = false;
let generation = 0;
let activeAnswerEpoch = 0;
let overlayEnabled = false;
let faceOverlayEnabled = true;
let bodyHandsOverlayEnabled = true;
let handsOverlayEnabled = true;
let bodyOverlayEnabled = true;
let framingOverlayEnabled = true;
let overlayCanvas = null;
let overlayContext = null;
let inferenceCanvas = null;
let inferenceContext = null;
let priorFaceCategories = null;
let priorFaceAtMs = null;
let priorPrimaryTrackId = null;
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
  const fileset = await resolveVisionFileset(module, wasmRoot);
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

function normalizedRoi(value) {
  if (![value?.left, value?.top, value?.width, value?.height].every(Number.isFinite)) return null;
  const left = Math.max(0, Math.min(1, value.left));
  const top = Math.max(0, Math.min(1, value.top));
  const width = Math.max(0, Math.min(1 - left, value.width));
  const height = Math.max(0, Math.min(1 - top, value.height));
  return width > 0 && height > 0 ? Object.freeze({ left, top, width, height }) : null;
}

function primaryInferenceSurface(bitmap, roi) {
  if (typeof OffscreenCanvas !== 'function') return null;
  const width = Math.max(1, Math.round(bitmap.width * roi.width));
  const height = Math.max(1, Math.round(bitmap.height * roi.height));
  if (!inferenceCanvas || inferenceCanvas.width !== width || inferenceCanvas.height !== height) {
    inferenceCanvas = new OffscreenCanvas(width, height);
    inferenceContext = inferenceCanvas.getContext('2d', { alpha: false });
  }
  if (!inferenceContext) return null;
  inferenceContext.clearRect(0, 0, width, height);
  inferenceContext.drawImage(
    bitmap,
    roi.left * bitmap.width,
    roi.top * bitmap.height,
    roi.width * bitmap.width,
    roi.height * bitmap.height,
    0,
    0,
    width,
    height,
  );
  return inferenceCanvas;
}

function remapLandmarkSets(sets, roi) {
  if (!Array.isArray(sets)) return sets;
  return sets.map((landmarks) => Array.isArray(landmarks) ? landmarks.map((point) => ({
    ...point,
    x: Number.isFinite(point?.x) ? roi.left + point.x * roi.width : point?.x,
    y: Number.isFinite(point?.y) ? roi.top + point.y * roi.height : point?.y,
  })) : landmarks);
}

function remapPrimaryResult(result, roi) {
  return {
    ...result,
    faceLandmarks: remapLandmarkSets(result?.faceLandmarks, roi),
    poseLandmarks: remapLandmarkSets(result?.poseLandmarks, roi),
    leftHandLandmarks: remapLandmarkSets(result?.leftHandLandmarks, roi),
    rightHandLandmarks: remapLandmarkSets(result?.rightHandLandmarks, roi),
  };
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

function renderOverlay(result, geometry, width, height) {
  if (!overlayEnabled || geometry?.primaryAssociated !== true) return { bitmap: null, primitiveCount: 0 };
  const surface = overlaySurface(width, height);
  if (!surface) return { bitmap: null, primitiveCount: 0 };
  const { canvas, context } = surface;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const face = result?.faceLandmarks?.[0];
  const pose = result?.poseLandmarks?.[0];
  const leftHand = result?.leftHandLandmarks?.[0];
  const rightHand = result?.rightHandLandmarks?.[0];
  let primitiveCount = 0;
  if (faceOverlayEnabled) {
    primitiveCount += drawConnections(context, face, visionModule?.HolisticLandmarker?.FACE_LANDMARKS_TESSELATION, 'rgba(72,220,255,.32)', 0.7);
    primitiveCount += drawConnections(context, face, visionModule?.HolisticLandmarker?.FACE_LANDMARKS_CONTOURS, 'rgba(94,255,208,.95)', 1.2);
  }
  if (bodyOverlayEnabled) {
    primitiveCount += drawConnections(context, pose, visionModule?.HolisticLandmarker?.POSE_CONNECTIONS, 'rgba(94,255,208,.92)', 2, true);
    primitiveCount += drawPoints(context, pose, 'rgba(220,255,247,.98)', 2, true);
  }
  if (handsOverlayEnabled) {
    primitiveCount += drawConnections(context, leftHand, visionModule?.HolisticLandmarker?.HAND_CONNECTIONS, 'rgba(65,214,255,.98)', 1.5);
    primitiveCount += drawPoints(context, leftHand, 'rgba(65,214,255,.98)', 1.8);
    primitiveCount += drawConnections(context, rightHand, visionModule?.HolisticLandmarker?.HAND_CONNECTIONS, 'rgba(195,115,255,.98)', 1.5);
    primitiveCount += drawPoints(context, rightHand, 'rgba(220,175,255,.98)', 1.8);
  }
  const box = geometry?.face?.box;
  if (framingOverlayEnabled && box) {
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
  faceOverlayEnabled = message.faceOverlayEnabled !== false;
  bodyHandsOverlayEnabled = message.bodyHandsOverlayEnabled !== false;
  handsOverlayEnabled = message.handsOverlayEnabled === undefined ? bodyHandsOverlayEnabled : Boolean(message.handsOverlayEnabled);
  bodyOverlayEnabled = message.bodyOverlayEnabled === undefined ? bodyHandsOverlayEnabled : Boolean(message.bodyOverlayEnabled);
  framingOverlayEnabled = message.framingOverlayEnabled === undefined ? faceOverlayEnabled : Boolean(message.framingOverlayEnabled);
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
    const roi = message.primaryUsable === true ? normalizedRoi(message.primaryRoi) : null;
    const inferenceSurface = roi ? primaryInferenceSurface(bitmap, roi) : null;
    let result = null;
    if (inferenceSurface) {
      if (message.primaryTrackId !== priorPrimaryTrackId) {
        priorFaceCategories = null;
        priorFaceAtMs = null;
      }
      priorPrimaryTrackId = message.primaryTrackId;
      result = remapPrimaryResult(holistic.detectForVideo(inferenceSurface, message.timestampMs), roi);
      inferenceContext?.clearRect?.(0, 0, inferenceCanvas.width, inferenceCanvas.height);
    } else {
      priorFaceCategories = null;
      priorFaceAtMs = null;
      priorPrimaryTrackId = null;
    }
    const derived = deriveCompactGeometry(result || {}, { faceCount });
    const faceCategories = result?.faceBlendshapes?.[0]?.categories || null;
    const movementRatePerSecond = facialMovementRate(faceCategories, priorFaceCategories, message.timestampMs - priorFaceAtMs);
    priorFaceCategories = Array.isArray(faceCategories) ? faceCategories.map((category) => ({ categoryName: category.categoryName, score: category.score })) : null;
    priorFaceAtMs = result ? message.timestampMs : null;
    const geometry = Object.freeze({
      ...derived,
      primaryAssociated: Boolean(result),
      primaryLockState: typeof message.primaryLock?.state === 'string' ? message.primaryLock.state : 'SEARCHING',
      bystanderCount: Math.max(0, Math.round(Number(message.primaryLock?.bystanderCount) || 0)),
      face: Object.freeze({ ...derived.face, movementRatePerSecond }),
    });
    assertCompactGeometry(geometry);
    const overlay = renderOverlay(result, geometry, bitmap.width, bitmap.height);
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
      // Y1-Y2-CAM-V6-3504: the blendshape categories were computed every frame, spent
      // on a single movementRatePerSecond scalar, and then dropped - which is why FACE
      // was one Flight Recorder lane. Forward them so the FACE family can derive its
      // cartridges (smile, mouth, eye aperture, blink, brow, periocular, gaze).
      // These are derived cue scores, the same privacy class as the geometry already
      // sent: no raw frames, crops or coordinates leave the worker.
      faceCategories: Array.isArray(faceCategories)
        ? faceCategories.map((category) => ({ categoryName: category.categoryName, score: category.score }))
        : null,
      primaryLock: message.primaryLock || null,
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
    if (inferenceCanvas) inferenceContext?.clearRect?.(0, 0, inferenceCanvas.width, inferenceCanvas.height);
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
  if (inferenceCanvas) inferenceContext?.clearRect?.(0, 0, inferenceCanvas.width, inferenceCanvas.height);
  inferenceCanvas = null;
  inferenceContext = null;
  priorFaceCategories = null;
  priorFaceAtMs = null;
  priorPrimaryTrackId = null;
  self.postMessage({ type: 'closed', generation });
  self.close();
}

function resetTemporalState(message) {
  if (message.generation !== generation) return;
  activeAnswerEpoch = message.answerEpoch;
  priorFaceCategories = null;
  priorFaceAtMs = null;
  priorPrimaryTrackId = null;
  if (inferenceCanvas) inferenceContext?.clearRect?.(0, 0, inferenceCanvas.width, inferenceCanvas.height);
  if (ready) self.postMessage({ type: 'ready', generation, answerEpoch: activeAnswerEpoch });
}

function configureInstrumentation(message) {
  if (message.generation !== generation) return;
  overlayEnabled = Boolean(message.overlayEnabled);
  faceOverlayEnabled = message.faceOverlayEnabled !== false;
  bodyHandsOverlayEnabled = message.bodyHandsOverlayEnabled !== false;
  handsOverlayEnabled = message.handsOverlayEnabled === undefined ? bodyHandsOverlayEnabled : Boolean(message.handsOverlayEnabled);
  bodyOverlayEnabled = message.bodyOverlayEnabled === undefined ? bodyHandsOverlayEnabled : Boolean(message.bodyOverlayEnabled);
  framingOverlayEnabled = message.framingOverlayEnabled === undefined ? faceOverlayEnabled : Boolean(message.framingOverlayEnabled);
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'init') initialize(message).catch((error) => self.postMessage({ type: 'init-error', generation: message.generation, answerEpoch: activeAnswerEpoch, message: String(error?.message || error).slice(0, 180) }));
  if (message.type === 'frame') analyze(message);
  if (message.type === 'reset') resetTemporalState(message);
  if (message.type === 'instrumentation') configureInstrumentation(message);
  if (message.type === 'shutdown') shutdown(message);
};
