import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(SCRIPT_DIRECTORY, '..', '..');
const PACKAGE_ROOT = join(APP_ROOT, 'node_modules', '@mediapipe', 'tasks-vision');
const VENDOR_ROOT = join(APP_ROOT, 'public', 'vendor', 'mediapipe');
const PACKAGE_VERSION = '1.0.1';
const MODELS = Object.freeze([
  {
    url: 'https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task',
    relativePath: join('models', 'holistic_landmarker', 'float16', '1', 'holistic_landmarker.task'),
    expectedSha256: 'e2dab61191e2dcd0a15f943d8e3ed1dce13c82dfa597b9dd39f562975a50c3f8',
    minimumBytes: 10_000_000,
    maximumBytes: 20_000_000,
  },
  {
    url: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
    relativePath: join('models', 'face_detector', 'blaze_face_short_range', 'float16', 'latest', 'blaze_face_short_range.tflite'),
    expectedSha256: 'b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f',
    minimumBytes: 100_000,
    maximumBytes: 5_000_000,
  },
]);
const PACKAGE_FILES = Object.freeze([
  'vision_bundle.mjs',
  'wasm/vision_wasm_internal.js',
  'wasm/vision_wasm_internal.wasm',
  'wasm/vision_wasm_module_internal.js',
  'wasm/vision_wasm_module_internal.wasm',
  'wasm/vision_wasm_nosimd_internal.js',
  'wasm/vision_wasm_nosimd_internal.wasm',
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function copyPackageAsset(relativePath) {
  const source = join(PACKAGE_ROOT, relativePath);
  const target = join(VENDOR_ROOT, 'tasks-vision', PACKAGE_VERSION, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  const bytes = await readFile(target);
  return { path: target.slice(APP_ROOT.length + 1), bytes: bytes.length, sha256: sha256(bytes) };
}

async function downloadModel({ url, relativePath, expectedSha256, minimumBytes, maximumBytes }) {
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok) throw new Error(`MediaPipe model download failed with HTTP ${response.status}.`);
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength && (declaredLength < minimumBytes || declaredLength > maximumBytes)) {
    throw new Error(`MediaPipe model declared an unexpected size: ${declaredLength}.`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < minimumBytes || bytes.length > maximumBytes) {
    throw new Error(`MediaPipe model has an unexpected size: ${bytes.length}.`);
  }
  const digest = sha256(bytes);
  if (expectedSha256 && digest !== expectedSha256) throw new Error(`MediaPipe model hash mismatch for ${relativePath}.`);
  const target = join(VENDOR_ROOT, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return { path: target.slice(APP_ROOT.length + 1), bytes: bytes.length, sha256: digest, source: url };
}

const packageJson = JSON.parse(await readFile(join(PACKAGE_ROOT, 'package.json'), 'utf8'));
if (packageJson.version !== PACKAGE_VERSION || packageJson.license !== 'Apache-2.0') {
  throw new Error(`Expected @mediapipe/tasks-vision ${PACKAGE_VERSION} under Apache-2.0; received ${packageJson.version}/${packageJson.license}.`);
}

const assets = [];
for (const relativePath of PACKAGE_FILES) assets.push(await copyPackageAsset(relativePath));
for (const model of MODELS) assets.push(await downloadModel(model));
process.stdout.write(`${JSON.stringify({ package: `@mediapipe/tasks-vision@${PACKAGE_VERSION}`, license: packageJson.license, assets }, null, 2)}\n`);
