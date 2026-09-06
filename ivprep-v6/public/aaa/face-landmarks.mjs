// FACE-family landmark processing for IV Prep On-Call.
//
// Claim safety: NO emotion recognition, NO deception inference.
// Metrics are physical/geometric only: head pose, blink rate, gaze direction.
// Per 3492 design system §6 and 3472 claim safety law.

const WASM_PATH = '/iv-prep-on-call/assets/vendor/mediapipe/tasks-vision/1.0.1/wasm';
const MODEL_PATH = '/iv-prep-on-call/assets/vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_internal.wasm';

let FaceLandmarker = null;
let landmarker = null;
let running = false;
let frameCallback = null;

const LEFT_EYE_UPPER = 159;
const LEFT_EYE_LOWER = 145;
const RIGHT_EYE_UPPER = 386;
const RIGHT_EYE_LOWER = 374;
const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;

export const FACE_METRICS = Object.freeze({
  HEAD_YAW: 'head_yaw',
  HEAD_PITCH: 'head_pitch',
  HEAD_ROLL: 'head_roll',
  BLINK_LEFT: 'blink_left',
  BLINK_RIGHT: 'blink_right',
  GAZE_X: 'gaze_x',
  GAZE_Y: 'gaze_y',
  FACE_DETECTED: 'face_detected',
  COVERAGE: 'coverage',
});

function eyeAspectRatio(landmarks, upper, lower) {
  const u = landmarks[upper];
  const l = landmarks[lower];
  if (!u || !l) return 1;
  return Math.abs(u.y - l.y);
}

function headPose(landmarks) {
  const nose = landmarks[NOSE_TIP];
  const forehead = landmarks[FOREHEAD];
  const chin = landmarks[CHIN];
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];
  if (!nose || !forehead || !chin || !leftEar || !rightEar) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }
  const earMidX = (leftEar.x + rightEar.x) / 2;
  const earMidY = (leftEar.y + rightEar.y) / 2;
  const yaw = (nose.x - earMidX) * 2;
  const vertMid = (forehead.y + chin.y) / 2;
  const pitch = (nose.y - vertMid) * 2;
  const roll = Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x);
  return { yaw, pitch, roll };
}

function gazeDirection(landmarks) {
  const leftIris = landmarks[LEFT_IRIS];
  const rightIris = landmarks[RIGHT_IRIS];
  const leftEyeCenter = landmarks[LEFT_EYE_UPPER];
  const rightEyeCenter = landmarks[RIGHT_EYE_UPPER];
  if (!leftIris || !rightIris || !leftEyeCenter || !rightEyeCenter) {
    return { x: 0, y: 0 };
  }
  const irisX = (leftIris.x + rightIris.x) / 2;
  const irisY = (leftIris.y + rightIris.y) / 2;
  const eyeX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
  const eyeY = (leftEyeCenter.y + rightEyeCenter.y) / 2;
  return { x: (irisX - eyeX) * 4, y: (irisY - eyeY) * 4 };
}

function extractMetrics(landmarks) {
  const pose = headPose(landmarks);
  const earLeft = eyeAspectRatio(landmarks, LEFT_EYE_UPPER, LEFT_EYE_LOWER);
  const earRight = eyeAspectRatio(landmarks, RIGHT_EYE_UPPER, RIGHT_EYE_LOWER);
  const gaze = gazeDirection(landmarks);
  return Object.freeze({
    [FACE_METRICS.HEAD_YAW]: pose.yaw,
    [FACE_METRICS.HEAD_PITCH]: pose.pitch,
    [FACE_METRICS.HEAD_ROLL]: pose.roll,
    [FACE_METRICS.BLINK_LEFT]: earLeft < 0.018 ? 1 : 0,
    [FACE_METRICS.BLINK_RIGHT]: earRight < 0.018 ? 1 : 0,
    [FACE_METRICS.GAZE_X]: gaze.x,
    [FACE_METRICS.GAZE_Y]: gaze.y,
    [FACE_METRICS.FACE_DETECTED]: true,
    [FACE_METRICS.COVERAGE]: 1,
  });
}

const UNAVAILABLE_FRAME = Object.freeze({
  [FACE_METRICS.HEAD_YAW]: 0,
  [FACE_METRICS.HEAD_PITCH]: 0,
  [FACE_METRICS.HEAD_ROLL]: 0,
  [FACE_METRICS.BLINK_LEFT]: 0,
  [FACE_METRICS.BLINK_RIGHT]: 0,
  [FACE_METRICS.GAZE_X]: 0,
  [FACE_METRICS.GAZE_Y]: 0,
  [FACE_METRICS.FACE_DETECTED]: false,
  [FACE_METRICS.COVERAGE]: 0,
});

export async function initFaceLandmarks() {
  if (landmarker) return;
  const vision = await import('../vendor/mediapipe/tasks-vision/1.0.1/vision_bundle.mjs');
  FaceLandmarker = vision.FaceLandmarker;
  const filesetResolver = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
  landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

export function onFaceFrame(callback) {
  frameCallback = callback;
}

export function startFaceProcessing(videoElement) {
  if (running || !landmarker || !videoElement) return;
  running = true;
  let lastTimestamp = -1;
  function tick() {
    if (!running) return;
    if (videoElement.readyState >= 2 && videoElement.currentTime !== lastTimestamp) {
      lastTimestamp = videoElement.currentTime;
      try {
        const result = landmarker.detectForVideo(videoElement, performance.now());
        if (result.faceLandmarks?.length > 0) {
          const metrics = extractMetrics(result.faceLandmarks[0]);
          frameCallback?.(metrics);
        } else {
          frameCallback?.(UNAVAILABLE_FRAME);
        }
      } catch {
        frameCallback?.(UNAVAILABLE_FRAME);
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export function stopFaceProcessing() {
  running = false;
}

export function destroyFaceLandmarks() {
  stopFaceProcessing();
  landmarker?.close?.();
  landmarker = null;
  FaceLandmarker = null;
  frameCallback = null;
}

export class FaceMetricRegistry {
  #buffer = [];
  #maxSize;
  #listeners = new Set();

  constructor({ maxSize = 300 } = {}) {
    this.#maxSize = maxSize;
  }

  push(frame) {
    this.#buffer.push({ t: performance.now(), ...frame });
    if (this.#buffer.length > this.#maxSize) this.#buffer.shift();
    for (const listener of this.#listeners) listener(frame);
  }

  get length() { return this.#buffer.length; }

  recent(count = 30) {
    return this.#buffer.slice(-count);
  }

  subscribe(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  blinkRate(windowMs = 10_000) {
    const now = performance.now();
    const cutoff = now - windowMs;
    const window = this.#buffer.filter((f) => f.t >= cutoff);
    if (window.length < 10) return null;
    let blinks = 0;
    let wasOpen = true;
    for (const frame of window) {
      const closed = frame[FACE_METRICS.BLINK_LEFT] === 1 || frame[FACE_METRICS.BLINK_RIGHT] === 1;
      if (closed && wasOpen) blinks++;
      wasOpen = !closed;
    }
    const seconds = windowMs / 1000;
    return (blinks / seconds) * 60;
  }

  averagePose(windowMs = 5_000) {
    const now = performance.now();
    const cutoff = now - windowMs;
    const window = this.#buffer.filter((f) => f.t >= cutoff && f[FACE_METRICS.FACE_DETECTED]);
    if (window.length === 0) return null;
    const sum = { yaw: 0, pitch: 0, roll: 0 };
    for (const f of window) {
      sum.yaw += f[FACE_METRICS.HEAD_YAW];
      sum.pitch += f[FACE_METRICS.HEAD_PITCH];
      sum.roll += f[FACE_METRICS.HEAD_ROLL];
    }
    const n = window.length;
    return { yaw: sum.yaw / n, pitch: sum.pitch / n, roll: sum.roll / n, samples: n };
  }

  coverage(windowMs = 5_000) {
    const now = performance.now();
    const cutoff = now - windowMs;
    const window = this.#buffer.filter((f) => f.t >= cutoff);
    if (window.length === 0) return 0;
    const detected = window.filter((f) => f[FACE_METRICS.FACE_DETECTED]).length;
    return detected / window.length;
  }

  reset() {
    this.#buffer = [];
  }
}
