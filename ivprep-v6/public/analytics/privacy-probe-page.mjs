const status = document.getElementById('status');
const report = document.getElementById('report');
const generation = 1;
let blockedEgressAttempts = 0;
const initErrors = [];
const ready = { holistic: false, faceDetector: false };
const workers = {
  holistic: new Worker('/analytics/holistic-worker.mjs', { type: 'module', name: '3420r-privacy-holistic' }),
  faceDetector: new Worker('/analytics/face-detector-worker.mjs', { type: 'module', name: '3420r-privacy-face-detector' }),
};

function onWorkerMessage(kind, event) {
  const message = event.data || {};
  if (message.type === 'ready') {
    ready[kind] = true;
    status.textContent = Object.values(ready).every(Boolean)
      ? 'Both isolated runtimes ready. Holding for the 60-second telemetry boundary…'
      : 'One isolated runtime ready; waiting for its safety pair…';
  }
  if (message.type === 'egress-blocked') blockedEgressAttempts += Number(message.count || 1);
  if (message.type === 'init-error') {
    initErrors.push(`${kind}: ${message.message || 'runtime initialization failed'}`);
    status.textContent = `Runtime initialization failed: ${kind}`;
  }
}
for (const [kind, worker] of Object.entries(workers)) {
  worker.onmessage = (event) => onWorkerMessage(kind, event);
  worker.onerror = (event) => { initErrors.push(`${kind}: ${event.message || 'worker error'}`); };
}
workers.holistic.postMessage({
  type: 'init', generation,
  answerEpoch: 1,
  bundleUrl: '/vendor/mediapipe/tasks-vision/1.0.1/vision_bundle.mjs',
  wasmRoot: '/vendor/mediapipe/tasks-vision/1.0.1/wasm',
  holisticModelUrl: '/vendor/mediapipe/models/holistic_landmarker/float16/1/holistic_landmarker.task',
});
workers.faceDetector.postMessage({
  type: 'init', generation,
  answerEpoch: 1,
  bundleUrl: '/vendor/mediapipe/tasks-vision/1.0.1/vision_bundle.mjs',
  wasmRoot: '/vendor/mediapipe/tasks-vision/1.0.1/wasm',
  faceDetectorModelUrl: '/vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
});

setTimeout(() => Object.values(workers).forEach((worker) => worker.postMessage({ type: 'shutdown', generation })), 65_000);
setTimeout(() => {
  Object.values(workers).forEach((worker) => worker.terminate());
  const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
  const externalResources = resources.filter((name) => new URL(name, location.href).origin !== location.origin);
  const result = {
    status: Object.values(ready).every(Boolean) && initErrors.length === 0 && externalResources.length === 0 ? 'PASS' : 'FAIL',
    holisticRuntimeReady: ready.holistic,
    faceDetectorRuntimeReady: ready.faceDetector,
    initErrors,
    observedExternalResourceRequests: externalResources.length,
    blockedWorkerEgressAttempts: blockedEgressAttempts,
    heldAcrossTelemetryBoundarySeconds: 66,
  };
  status.textContent = result.status === 'PASS' ? 'Privacy probe PASS.' : 'Privacy probe FAIL.';
  report.textContent = JSON.stringify(result, null, 2);
  document.body.dataset.probeStatus = result.status;
}, 66_000);
