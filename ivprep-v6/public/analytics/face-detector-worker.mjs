let detector = null;
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
  ready = true;
  self.postMessage({ type: 'ready', generation, answerEpoch: activeAnswerEpoch });
}

function analyze(message) {
  const bitmap = message.bitmap;
  const startedAt = performance.now();
  try {
    if (!ready || message.generation !== generation || message.answerEpoch !== activeAnswerEpoch) return;
    const result = detector.detectForVideo(bitmap, message.timestampMs);
    const faceCount = Array.isArray(result?.detections) ? result.detections.length : null;
    self.postMessage({ type: 'face-count', generation, answerEpoch: message.answerEpoch, visionEpoch: message.visionEpoch, frameId: message.frameId, timestampMs: message.timestampMs, faceCount, faceInferenceMs: Number((performance.now() - startedAt).toFixed(2)) });
  } catch (error) {
    self.postMessage({ type: 'frame-error', generation, answerEpoch: message.answerEpoch, visionEpoch: message.visionEpoch, frameId: message.frameId, timestampMs: message.timestampMs, message: String(error?.message || error).slice(0, 1_000) });
  } finally {
    bitmap?.close?.();
  }
}

function reset(message) {
  if (message.generation !== generation) return;
  activeAnswerEpoch = message.answerEpoch;
  if (ready) self.postMessage({ type: 'ready', generation, answerEpoch: activeAnswerEpoch });
}

function shutdown(message) {
  if (message.generation !== generation) return;
  ready = false;
  try { detector?.close?.(); } catch {}
  detector = null;
  self.postMessage({ type: 'closed', generation });
  self.close();
}

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'init') initialize(message).catch((error) => self.postMessage({ type: 'init-error', generation: message.generation, answerEpoch: activeAnswerEpoch, message: String(error?.message || error).slice(0, 1_000) }));
  if (message.type === 'frame') analyze(message);
  if (message.type === 'reset') reset(message);
  if (message.type === 'shutdown') shutdown(message);
};
