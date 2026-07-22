import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { Writable } from 'node:stream';

import { MMC_CAM_UI_SECURITY_HEADERS } from '../../../lib/mmc/trust/security.mjs';
import {
  isMmcCamV2LocalUiEnabled,
  resolveMmcCamV2LocalAsset,
  serveMmcCamV2LocalUi,
} from '../../../lib/mmc/ui/local-review-mount.mjs';

class TestResponse extends Writable {
  constructor() {
    super();
    this.statusCode = null;
    this.headers = {};
    this.chunks = [];
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = { ...headers };
    return this;
  }

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk));
    callback();
  }

  get body() {
    return Buffer.concat(this.chunks).toString('utf8');
  }
}

assert.equal(isMmcCamV2LocalUiEnabled({ enabled: true, environment: 'FIXTURE' }), true);
assert.equal(isMmcCamV2LocalUiEnabled({ enabled: true, environment: 'local' }), true);
assert.equal(isMmcCamV2LocalUiEnabled({ enabled: false, environment: 'LOCAL' }), false);
assert.equal(isMmcCamV2LocalUiEnabled({ enabled: true, environment: 'STAGING' }), false);
assert.equal(isMmcCamV2LocalUiEnabled({ enabled: true, environment: 'LIVE' }), false);
assert.equal(isMmcCamV2LocalUiEnabled({ enabled: true, environment: 'LOCAL', isProduction: true }), false);

assert.match(MMC_CAM_UI_SECURITY_HEADERS['Content-Security-Policy'], /default-src 'none'/u);
assert.match(MMC_CAM_UI_SECURITY_HEADERS['Content-Security-Policy'], /connect-src 'self'/u);
assert.equal(MMC_CAM_UI_SECURITY_HEADERS['Cache-Control'], 'no-store, max-age=0');
assert.equal(MMC_CAM_UI_SECURITY_HEADERS['X-Frame-Options'], 'DENY');

const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'mmc-cam-local-mount-'));
const outsidePath = path.join(path.dirname(fixtureRoot), `${path.basename(fixtureRoot)}-outside.js`);

try {
  await writeFile(path.join(fixtureRoot, 'index.html'), '<!doctype html><title>CAM fixture</title>', 'utf8');
  await writeFile(path.join(fixtureRoot, 'app.js'), 'export const fixture = true;', 'utf8');
  await writeFile(path.join(fixtureRoot, 'styles.css'), ':root { color-scheme: dark; }', 'utf8');
  await writeFile(path.join(fixtureRoot, 'data.json'), '{"private":true}', 'utf8');
  await writeFile(outsidePath, 'export const secret = true;', 'utf8');
  await symlink(outsidePath, path.join(fixtureRoot, 'escape.js'));

  for (const route of [
    '/mmc-private',
    '/mmc-private/',
    '/mmc-private/today',
    '/mmc-private/students/student-007/overview',
    '/mmc-private/reviews/ai.proposal/review.007',
    '/mmc-private/src/cam',
    '/mmc-private/src/cam/index.html',
  ]) {
    const resolved = await resolveMmcCamV2LocalAsset(route, { publicRoot: fixtureRoot });
    assert.equal(resolved.isIndex, true, `Expected CAM index for ${route}`);
    assert.equal(path.basename(resolved.absolutePath), 'index.html');
  }

  const script = await resolveMmcCamV2LocalAsset('/mmc-private/src/cam/app.js', { publicRoot: fixtureRoot });
  assert.equal(script.isIndex, false);
  assert.equal(script.contentType, 'application/javascript; charset=utf-8');

  const stylesheet = await resolveMmcCamV2LocalAsset('/mmc-private/src/cam/styles.css', { publicRoot: fixtureRoot });
  assert.equal(stylesheet.contentType, 'text/css; charset=utf-8');

  for (const denied of [
    '/mmc-private/src/app.js',
    '/mmc-private/legacy.html',
    '/mmc-private/unknown-route',
    '/mmc-private/src/cam/data.json',
    '/mmc-private/src/cam/../app.js',
    '/mmc-private/src/cam/escape.js',
    '/mmc-private/src/cam/missing.js',
  ]) {
    await assert.rejects(
      resolveMmcCamV2LocalAsset(denied, { publicRoot: fixtureRoot }),
      (error) => error?.statusCode === 404 && error?.code === 'MMC_CAM_ASSET_NOT_FOUND',
      `Historical, unsupported, escaping, or missing asset must fail closed: ${denied}`,
    );
  }

  const successResponse = new TestResponse();
  await serveMmcCamV2LocalUi(successResponse, '/mmc-private/today', { publicRoot: fixtureRoot });
  await once(successResponse, 'finish');
  assert.equal(successResponse.statusCode, 200);
  assert.equal(successResponse.headers['X-MissionMed-Private-Mount'], 'cam-v2-local-review');
  assert.equal(successResponse.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.match(successResponse.body, /CAM fixture/u);

  const failureResponse = new TestResponse();
  await serveMmcCamV2LocalUi(failureResponse, '/mmc-private/src/app.js', { publicRoot: fixtureRoot });
  if (!failureResponse.writableFinished) await once(failureResponse, 'finish');
  assert.equal(failureResponse.statusCode, 404);
  assert.equal(JSON.parse(failureResponse.body).error, 'mmc_cam_asset_not_found');
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(outsidePath, { force: true });
}

console.log(JSON.stringify({
  result: 'MMC CAM v2 local review mount validation passed',
  defaultOff: true,
  productionDenied: true,
  stagingDenied: true,
  historicalAssetsDenied: true,
  unsupportedAssetsDenied: true,
  symlinkEscapeDenied: true,
  strictUiHeaders: true,
}, null, 2));
