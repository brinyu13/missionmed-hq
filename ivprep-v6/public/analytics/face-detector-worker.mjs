import {
  PrimaryIntervieweeLock,
  faceDetectionCandidates,
  primaryLockDiagnostic,
} from './primary-interviewee-lock.mjs';

let detector = null;
let primaryLock = null;
let ready = false;
let generation = 0;
let activeAnswerEpoch = 0;
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

async function initialize(message) {
  generation = message.generation;
  activeAnswerEpoch = message.answerEpoch;
  const module = await import(message.bundleUrl);
  const fileset = await module.FilesetResolver.forVisionTasks(message.wasmRoot, true);
  detector = await module.FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: message.faceDetectorModelUrl, delegate: 'CPU' },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
    minSuppressionThreshold: 0.3,
  });
  primaryLock = new PrimaryIntervieweeLock();
  ready = true;
  self.postMessage({ type: 'ready', generation, answerEpoch: activeAnswerEpoch });
}

function analyze(message) {
  const bitmap = message.bitmap;
  const startedAt = performance.now();
  try {
    if (!ready || message.generation !== generation || message.answerEpoch !== activeAnswerEpoch) return;
    const result = detector.detectForVideo(bitmap, message.timestampMs);
    const detections = Array.isArray(result?.detections) ? result.detections : [];
    const lock = primaryLock.update({
      atMs: message.timestampMs,
      candidates: faceDetectionCandidates(detections, bitmap.width, bitmap.height),
    });
    self.postMessage({
      type: 'primary-lock',
      generation,
      answerEpoch: message.answerEpoch,
      visionEpoch: message.visionEpoch,
      frameId: message.frameId,
      timestampMs: message.timestampMs,
      faceCount: lock.faceCount,
      primaryTrackId: lock.primaryTrackId,
      primaryUsable: lock.primaryUsable,
      primaryRoi: lock.primaryRoi,
      primaryLock: primaryLockDiagnostic(lock),
      faceInferenceMs: Number((performance.now() - startedAt).toFixed(2)),
    });
  } catch (error) {
    self.postMessage({ type: 'frame-error', generation, answerEpoch: message.answerEpoch, visionEpoch: message.visionEpoch, frameId: message.frameId, timestampMs: message.timestampMs, message: String(error?.message || error).slice(0, 1_000) });
  } finally {
    bitmap?.close?.();
  }
}

function reset(message) {
  if (message.generation !== generation) return;
  activeAnswerEpoch = message.answerEpoch;
  primaryLock?.reset();
  if (ready) self.postMessage({ type: 'ready', generation, answerEpoch: activeAnswerEpoch });
}

function reselectPrimary(message) {
  if (message.generation !== generation || message.answerEpoch !== activeAnswerEpoch || !primaryLock) return;
  const lock = primaryLock.restartSelection(message.timestampMs);
  self.postMessage({
    type: 'primary-selection-restarted',
    generation,
    answerEpoch: activeAnswerEpoch,
    timestampMs: message.timestampMs,
    primaryLock: primaryLockDiagnostic(lock),
  });
}

function shutdown(message) {
  if (message.generation !== generation) return;
  ready = false;
  try { detector?.close?.(); } catch {}
  detector = null;
  primaryLock?.reset();
  primaryLock = null;
  self.postMessage({ type: 'closed', generation });
  self.close();
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'init') initialize(message).catch((error) => self.postMessage({ type: 'init-error', generation: message.generation, answerEpoch: activeAnswerEpoch, message: String(error?.message || error).slice(0, 1_000) }));
  if (message.type === 'frame') analyze(message);
  if (message.type === 'reset') reset(message);
  if (message.type === 'reselect-primary') reselectPrimary(message);
  if (message.type === 'shutdown') shutdown(message);
};
