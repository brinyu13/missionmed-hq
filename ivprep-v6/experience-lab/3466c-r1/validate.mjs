import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(join(root, path), 'utf8');
const hash = async (path) => createHash('sha256').update(await readFile(join(root, path))).digest('hex');

const donorHashes = Object.freeze({
  'analytics/browser-pipeline.mjs': '133e48f5d57dd7aa353d4c5049d8c82b0e3c7af75c8d52846220664c7c1f15b8',
  'analytics/analytics-session.mjs': '5ea6f2d8c25d2a9e95c84a471133fccd22f4046f63a2e76c807f5b532760388e',
  'analytics/audio-signal.mjs': 'c2ee252d2b513dbddd9231169981d82a53ec0cdc5990466f7a5dda3a71cd4634',
  'analytics/episode-detectors.mjs': '0a5d4dc9fbf05ec8d60facb01fb19667c27c1e2c525d326f52122f207440f3d1',
  'analytics/event-contract.mjs': 'e3ad4ce05ccf89672f1636e32a6778efc4b59f7addaff3cb9f6f91ecc780799d',
  'analytics/session-clock.mjs': 'eb7d5387c3d2342ca14d365333b07192f6a496edbdbb7ea11d20b633afc13997',
  'analytics/signal-registry.mjs': 'f88db0276e1fda2cafb4affff83453939db7b022d6767c65ad114223ac1454e2',
  'analytics/vision-geometry.mjs': '88507bf5e47e25bd5f9786c9878d8fe3540b56b3b6ce49a4121634f992d7915f',
  'analytics/holistic-worker.mjs': 'd9b2c5ad24bd269a6079309f85f46478d6d96f808c5e9ecc5e45b1fcae4d0fcc',
  'analytics/face-detector-worker.mjs': '3e2b87f3173f65b8dd02262c34c164f7f835f9291eadd88376bbe25b8970b513',
  'analytics/playback-overlay.mjs': '75ba00417af66bcc51fc41ae30a1bb46e58364b6824801ceb51561378526d881',
  'vendor/mediapipe/LICENSE': 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30',
  'vendor/mediapipe/NOTICE.md': 'c1ff832e19891218e256c317da15a1fcd709c30fc223b7e8cbcff7ef679d9e0e',
  'vendor/mediapipe/models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite': 'b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f',
  'vendor/mediapipe/models/holistic_landmarker/float16/1/holistic_landmarker.task': 'e2dab61191e2dcd0a15f943d8e3ed1dce13c82dfa597b9dd39f562975a50c3f8',
  'vendor/mediapipe/tasks-vision/1.0.1/vision_bundle.mjs': 'd885630c297c0b20b1fe86096cb06291c4c8080876f27852e724f24ac603713f',
  'vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_internal.js': 'e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73',
  'vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_internal.wasm': '8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886',
  'vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_module_internal.js': 'da8934057f147b622e82cfb4c0dbd85461c598e268588b5a8ba9ca963a8ff82d',
  'vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_module_internal.wasm': '2dabd8e23c60984628beb7bb338764c81a08e6837145273f59578684b5d53c1b',
  'vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_nosimd_internal.js': 'e81d715a3d42cc3373602eb2f7aff795d164934db680e32496b65dab537f9658',
  'vendor/mediapipe/tasks-vision/1.0.1/wasm/vision_wasm_nosimd_internal.wasm': 'a28483cd42e74e855bf5ebdb6b40d9b66a5b49e35e95020bc97669e6822a3192',
});

test('all accepted donor bytes are present and exact', async () => {
  for (const [path, expected] of Object.entries(donorHashes)) {
    assert.equal((await stat(join(root, path))).isFile(), true, path);
    assert.equal(await hash(path), expected, path);
  }
});

test('prototype is self-contained and blocks external runtime dependencies', async () => {
  const [html, app, css] = await Promise.all([read('Y1_Y2_CAM_V6_3466C_R1_PROTOTYPE.html'), read('app.mjs'), read('styles.css')]);
  const authored = `${html}\n${app}\n${css}`;
  const withoutSupportedLoopback = authored.replaceAll('http://127.0.0.1:8467/Y1_Y2_CAM_V6_3466C_R1_PROTOTYPE.html', '');
  assert.doesNotMatch(withoutSupportedLoopback, /https?:\/\//iu);
  assert.doesNotMatch(authored, /(?:cdn|unpkg|jsdelivr)\./iu);
  assert.match(html, /connect-src 'self'/u);
  assert.match(html, /worker-src 'self'/u);
  assert.match(html, /wasm-unsafe-eval/u);
});

test('unsupported file launch fails visibly instead of showing inert controls', async () => {
  const [html, app] = await Promise.all([read('Y1_Y2_CAM_V6_3466C_R1_PROTOTYPE.html'), read('app.mjs')]);
  assert.match(html, /id="launchGate" role="alert"/u);
  assert.match(html, /LOCALHOST REQUIRED/u);
  assert.match(html, /Chrome blocks this module-based camera lab on <code>file:\/\/<\/code>/u);
  assert.match(app, /\$\('launchGate'\)\.hidden = true/u);
});

test('flight recorder geometry survives the strict style CSP', async () => {
  const app = await read('app.mjs');
  assert.doesNotMatch(app, /style="left:/u);
  assert.match(app, /button\.style\.left/u);
  assert.match(app, /button\.style\.width/u);
});

test('real media starts only from an explicit control and duplicate starts fail closed', async () => {
  const app = await read('app.mjs');
  assert.match(app, /startSession\.addEventListener\('click', startSession\)/u);
  assert.match(app, /if \(state\.status !== 'idle'\) return/u);
  assert.match(app, /navigator\.mediaDevices\.getUserMedia/u);
  assert.doesNotMatch(app, /(?:DOMContentLoaded|load).*startSession/u);
});

test('Coach and Telemetry share one pipeline and layer changes do not recapture', async () => {
  const app = await read('app.mjs');
  const projectionBody = app.slice(app.indexOf('function setProjection'), app.indexOf('function setLayer'));
  const layerBody = app.slice(app.indexOf('function setLayer'), app.indexOf('function setReplayLayer'));
  assert.doesNotMatch(projectionBody, /getUserMedia|new BrowserAnalyticsPipeline|beginAnswer/u);
  assert.doesNotMatch(layerBody, /getUserMedia|new BrowserAnalyticsPipeline|beginAnswer/u);
  assert.match(layerBody, /setInstrumentation/u);
  assert.match(app, /data-layer="face"/u.test(await read('Y1_Y2_CAM_V6_3466C_R1_PROTOTYPE.html')) ? /faceLayer/u : /$a/u);
});

test('unsupported measurements stay unavailable and samples stay labeled', async () => {
  const [html, app] = await Promise.all([read('Y1_Y2_CAM_V6_3466C_R1_PROTOTYPE.html'), read('app.mjs')]);
  assert.match(html, /PITCH \/ F0 <b>NOT YET AVAILABLE<\/b>/u);
  assert.match(html, /SMILE \/ EMOTION <b>NOT AVAILABLE<\/b>/u);
  assert.match(html, /POSTURE SCORE <b>NOT AVAILABLE<\/b>/u);
  assert.match(app, /SAMPLE\/DEMO/u);
  assert.doesNotMatch(app, /Pitch[^\n]{0,80}REAL NOW/iu);
  assert.doesNotMatch(app, /Emotion[^\n]{0,80}REAL NOW/iu);
});

test('cleanup covers tracks, Web Audio, workers, recorder, object URLs, and memory', async () => {
  const app = await read('app.mjs');
  assert.match(app, /track\.stop\(\)/u);
  assert.match(app, /audioSource\?\.disconnect/u);
  assert.match(app, /audioContext\?\.close/u);
  assert.match(app, /pipeline\.destroy/u);
  assert.match(app, /playbackOverlay\?\.destroy/u);
  assert.match(app, /recorder\.stop/u);
  assert.match(app, /URL\.revokeObjectURL/u);
  assert.match(app, /state\.events = \[\]/u);
});

test('live mobile view is fixed-height, keyboard-visible, and Reduced Motion aware', async () => {
  const [html, css] = await Promise.all([read('Y1_Y2_CAM_V6_3466C_R1_PROTOTYPE.html'), read('styles.css')]);
  assert.match(css, /\.live-screen \{ height: calc\(100dvh - 76px\); overflow: hidden/u);
  assert.match(css, /@media \(max-width: 700px\)/u);
  assert.match(css, /prefers-reduced-motion: reduce/u);
  assert.match(css, /:focus-visible/u);
  assert.match(html, /aria-live="polite"/u);
});

test('one bounded recorder exposes whole interview to exact moment navigation', async () => {
  const [html, app] = await Promise.all([read('Y1_Y2_CAM_V6_3466C_R1_PROTOTYPE.html'), read('app.mjs')]);
  assert.match(html, /WHOLE INTERVIEW/u);
  assert.match(html, /QUESTION 01/u);
  assert.match(html, /EXACT MOMENT/u);
  assert.match(app, /const MAX_EVENTS = 420/u);
  assert.match(app, /pipeline\.session\.clock\.sessionMs/u);
  assert.doesNotMatch(app, /localStorage|indexedDB/u);
});

test('privacy boundary keeps raw geometry and media out of persistence and transport', async () => {
  const app = await read('app.mjs');
  assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/u);
  assert.doesNotMatch(app, /localStorage|sessionStorage|indexedDB/u);
  assert.match(app, /rawMediaPersisted: false/u);
  assert.match(app, /rawGeometryPersisted: false/u);
  assert.match(app, /externalAnalyticsCalls: false/u);
});
