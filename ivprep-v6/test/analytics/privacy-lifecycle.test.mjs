import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROOT=new URL('../../',import.meta.url);
const read=(path)=>readFile(new URL(path,ROOT),'utf8');

test('pipeline reuses bridge media and never opens a second capture or storage path',async()=>{
  const source=await read('public/analytics/browser-pipeline.mjs');
  assert.doesNotMatch(source,/getUserMedia|MediaRecorder|localStorage|indexedDB/iu);
  assert.match(source,/this\.bridge\.media/u);
});

test('worker installs same-origin egress guards before importing MediaPipe',async()=>{
  for(const path of ['public/analytics/holistic-worker.mjs','public/analytics/face-detector-worker.mjs']){
    const source=await read(path);
    assert.ok(source.indexOf('self.fetch =')>=0);
    assert.ok(source.indexOf('self.fetch =')<source.indexOf('await import(message.bundleUrl)'));
    assert.match(source,/XMLHttpRequest/u);
    assert.match(source,/url\.origin !== self\.location\.origin/u);
  }
});

test('FaceDetector and Holistic use isolated workers and join only ephemeral primary-lock evidence',async()=>{
  const pipeline=await read('public/analytics/browser-pipeline.mjs');
  const holistic=await read('public/analytics/holistic-worker.mjs');
  const face=await read('public/analytics/face-detector-worker.mjs');
  assert.match(pipeline,/new Worker\(`\/analytics\/holistic-worker\.mjs\?v=\$\{WORKER_REVISION\}`/u);
  assert.match(pipeline,/new Worker\(`\$\{FACE_WORKER\}\?v=\$\{WORKER_REVISION\}`/u);
  assert.match(face,/type: 'primary-lock'[\s\S]{0,260}faceCount[\s\S]{0,260}primaryRoi/u);
  assert.match(face,/primaryLockDiagnostic\(lock\)/u);
  assert.doesNotMatch(face,/postMessage\([\s\S]{0,120}(?:landmarks|detections):/iu);
  assert.match(holistic,/new OffscreenCanvas\(width, height\)/u);
  assert.match(holistic,/holistic\.detectForVideo\(inferenceSurface, message\.timestampMs\)/u);
  assert.match(holistic,/remapPrimaryResult\(/u);
  assert.match(holistic,/primaryAssociated: Boolean\(result\)/u);
  assert.match(holistic,/if \(faceOverlayEnabled\)[\s\S]{0,900}if \(bodyOverlayEnabled\)[\s\S]{0,900}if \(handsOverlayEnabled\)[\s\S]{0,900}if \(framingOverlayEnabled && box\)/u);
  assert.match(holistic,/canvas\.transferToImageBitmap\(\)/u);
  assert.match(holistic,/self\.postMessage\(response, overlayBitmap \? \[overlayBitmap\] : \[\]\)/u);
  assert.doesNotMatch(holistic,/Float32Array|overlayVectors|connectionVectors/iu);
  assert.doesNotMatch(pipeline,/overlayVectors|ArrayBuffer\.isView/iu);
  assert.match(pipeline,/this\.overlayConsumer\(\{[\s\S]{0,120}bitmap,[\s\S]{0,120}geometry,[\s\S]{0,120}primaryLock:/u);
  assert.match(pipeline,/finally \{\s*closeOverlayBitmap\(bitmap\);/u);
  assert.match(holistic,/inferenceContext\?\.clearRect\?\./u);
  assert.match(pipeline,/invalidateVision[\s\S]{0,500}this\.resetEphemeralVisionState\(\)/u);
  assert.match(pipeline,/if \(!terminateWorker\) this\.resetEphemeralVisionState\(\)/u);
  assert.match(face,/primaryLock\?\.reset\(\)/u);
  assert.match(holistic,/priorPrimaryTrackId = null/u);
});

test('server keeps analytics same-origin with explicit worker and WASM policy',async()=>{
  const source=await read('server/serve.mjs');
  assert.match(source,/'\.wasm': 'application\/wasm'/u);
  assert.match(source,/worker-src 'self'/u);
  assert.match(source,/connect-src 'self'/u);
});

test('optional analytics hooks remain fail-soft and preserve protected navigation literal',async()=>{
  const source=await read('public/index.html');
  assert.match(source,/function analyticsCall\(method/u);
  assert.match(source,/cancelTurn\('navigation'\);stopMedia\(\)/u);
  assert.match(source,/analyticsCall\('abandonAnswer','media_stopped'\)/u);
  assert.match(source,/\/analytics\/index\.mjs/u);
  assert.match(source,/const replayTake=.*blobUrl&&.*communicationAnalytics/u);
  assert.match(source,/blobUrl:replayTake\?\.blobUrl/u);
  assert.match(source,/communicationAnalyticsReplayMediaId:replayTake\?\.communicationAnalytics\?\.answerId/u);
  assert.match(source,/persistentCommunicationAnalytics\(value\).*persistentEnvelopes/u);
  assert.match(source,/frontierSafeTake\(take\)/u);
  assert.match(source,/pauses:communicationAnalyticsAttempted\?null:AUD\.pauses/u);
  assert.match(source,/analyticsCall\('releaseRuntime'\)/u);
});

test('Founder failure and replay lifecycle release state instead of trapping devices',async()=>{
  const source=await read('public/analytics/ui.mjs');
  assert.match(source,/if \(!result\)[\s\S]{0,500}this\.clear\(\);[\s\S]{0,500}devices were released/u);
  assert.match(source,/videoElement: document\.getElementById\('communication-analytics-preview'\)/u);
  assert.doesNotMatch(source,/events \|\| \[\]\)\.slice\(0, 30\)/u);
});

test('only the vendored dependency contains the blocked Google metrics endpoint',async()=>{
  const firstParty=await Promise.all(['public/analytics/holistic-worker.mjs','public/analytics/face-detector-worker.mjs','public/analytics/browser-pipeline.mjs','public/analytics/ui.mjs'].map(read));
  assert.equal(firstParty.join('\n').includes('odml.pa.googleapis.com'),false);
  const vendor=await read('public/vendor/mediapipe/tasks-vision/1.0.1/vision_bundle.mjs');
  assert.equal(vendor.includes('https://odml.pa.googleapis.com/v1/log'),true);
});
