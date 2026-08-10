const status = document.getElementById('status');
const report = document.getElementById('report');
const generation = 1;
let blockedEgressAttempts = 0;
let initError = null;
let ready = false;
const worker = new Worker('/analytics/holistic-worker.mjs', { type: 'module', name: '3420r-privacy-probe' });

worker.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === 'ready') {
    ready = true;
    status.textContent = 'Runtime ready. Holding for the 60-second telemetry boundary…';
  }
  if (message.type === 'egress-blocked') blockedEgressAttempts += Number(message.count || 1);
  if (message.type === 'init-error') {
    initError = message.message || 'runtime initialization failed';
    status.textContent = `Runtime initialization failed: ${initError}`;
  }
};
worker.onerror = (event) => { initError = event.message || 'worker error'; };
worker.postMessage({
  type: 'init', generation,
  bundleUrl: '/vendor/mediapipe/tasks-vision/1.0.1/vision_bundle.mjs',
  wasmRoot: '/vendor/mediapipe/tasks-vision/1.0.1/wasm',
  holisticModelUrl: '/vendor/mediapipe/models/holistic_landmarker/float16/1/holistic_landmarker.task',
  faceDetectorModelUrl: '/vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
});

setTimeout(() => worker.postMessage({ type: 'shutdown', generation }), 65_000);
setTimeout(() => {
  worker.terminate();
  const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
  const externalResources = resources.filter((name) => new URL(name, location.href).origin !== location.origin);
  const result = {
    status: ready && !initError && externalResources.length === 0 ? 'PASS' : 'FAIL',
    runtimeReady: ready,
    initError,
    observedExternalResourceRequests: externalResources.length,
    blockedWorkerEgressAttempts: blockedEgressAttempts,
    heldAcrossTelemetryBoundarySeconds: 66,
  };
  status.textContent = result.status === 'PASS' ? 'Privacy probe PASS.' : 'Privacy probe FAIL.';
  report.textContent = JSON.stringify(result, null, 2);
  document.body.dataset.probeStatus = result.status;
}, 66_000);
