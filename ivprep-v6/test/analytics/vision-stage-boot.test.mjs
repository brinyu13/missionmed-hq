// Y1-Y2-CAM-V6-3500 regression guards for the hosted vision stage.
//
// Two independent defects each fully disabled the face / head / torso / arm / hand /
// finger wireframes and every landmark-derived signal on the hosted product while
// leaving localhost working. Both were single expressions, both failed closed and
// silently, and neither was covered by a test. These guards pin the fixes.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import test from 'node:test';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';

const NOW = Date.parse('2026-08-17T16:00:00.000Z');
const CSRF = 'csrf_token_1234567890';
const ANALYTICS_DIR = new URL('../../public/analytics/', import.meta.url);
const WASM_DIR = new URL('../../public/vendor/mediapipe/tasks-vision/1.0.1/wasm/', import.meta.url);

function registry() {
  const value = new InMemoryAdmissionRegistry({ now: () => NOW });
  value.grantSyntheticEntitlement({
    subject: 'wp:1', revision: 'vision-stage-boot-1', expiresAtMs: NOW + 600_000,
    founder: true, voice: true, video: false, grantedVideoSeconds: 0,
  });
  return value;
}

function hqSession() {
  return {
    version: 1,
    issuedAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 600_000).toISOString(),
    csrfToken: CSRF,
    authSource: 'wordpress-cookie',
    user: { id: 1, roles: ['administrator'] },
  };
}

async function head(handler, path) {
  const request = Object.assign(Readable.from([]), { method: 'HEAD', headers: {}, url: path });
  const captured = { headers: {}, status: 0 };
  const response = {
    writeHead(status, headers) { captured.status = status; Object.assign(captured.headers, headers || {}); return response; },
    setHeader(key, value) { captured.headers[key] = value; },
    end() { captured.ended = true; },
  };
  await handler({
    request, response, url: new URL(path, 'https://missionmed-hq-production.up.railway.app'),
    hqSession: hqSession(), cookieFingerprint: 'f'.repeat(64), hqSessionMaxTtlSeconds: 1800,
    expectedOrigin: 'https://missionmed-hq-production.up.railway.app',
  });
  return captured;
}

test('hosted CSP permits WebAssembly compilation without permitting JavaScript eval', async () => {
  const handler = createIvPrepHqHandler({
    registry: registry(), now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
  });
  const csp = (await head(handler, '/iv-prep-on-call/')).headers['Content-Security-Policy'];

  // Without this the vendored MediaPipe holistic landmarker cannot instantiate and
  // the hosted vision stage fails closed with a CSP CompileError.
  assert.match(csp, /script-src[^;]*'wasm-unsafe-eval'/u);

  // 'wasm-unsafe-eval' must be the narrow WebAssembly-only grant. Broad JS eval and
  // inline script must both stay forbidden on the hosted mount.
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-eval'(?!\S)/u);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/u);
  assert.match(csp, /worker-src 'self'/u);
});

test('vision workers never ask the resolver for the MODULARIZE wasm glue', async () => {
  // FilesetResolver.forVisionTasks(root, true) selects *_wasm_module_internal.js,
  // whose top-level import.meta is a SyntaxError when MediaPipe's loader parses it
  // as a classic script. Passing no second argument instead leaves the non-module
  // glue module-scoped, so self.ModuleFactory is never set. Neither works from a
  // { type: 'module' } worker, so both workers must route through the shared
  // resolver in vision-fileset.mjs.
  for (const file of ['holistic-worker.mjs', 'face-detector-worker.mjs']) {
    const source = await readFile(new URL(file, ANALYTICS_DIR), 'utf8');
    assert.doesNotMatch(source, /forVisionTasks\s*\(/u, `${file} must not call forVisionTasks directly`);
    assert.match(source, /resolveVisionFileset\s*\(/u, `${file} must resolve its fileset through vision-fileset.mjs`);
    assert.match(source, /from '\.\/vision-fileset\.mjs'/u, `${file} must import the shared resolver`);
  }
});

test('the shared resolver publishes a global factory and points at the vendored module glue', async () => {
  const { resolveVisionFileset } = await import('../../public/analytics/vision-fileset.mjs');
  const factory = () => {};
  const calls = [];
  const visionModule = { FilesetResolver: { isSimdSupported: async () => { calls.push('simd'); return true; } } };

  // The resolver runs inside a worker, where the factory global lives on self.
  const priorSelf = globalThis.self;
  globalThis.self = globalThis;
  try {
    globalThis.ModuleFactory = factory;
    const fileset = await resolveVisionFileset(visionModule, 'https://example.test/wasm/');
    assert.deepEqual(calls, ['simd']);
    assert.equal(fileset.wasmBinaryPath, 'https://example.test/wasm/vision_wasm_module_internal.wasm');
    // MediaPipe re-loads wasmLoaderPath itself; pointing it at the already-imported
    // resolver module makes that load a cached no-op instead of a parse error.
    assert.match(fileset.wasmLoaderPath, /vision-fileset\.mjs$/u);

    await assert.rejects(
      () => resolveVisionFileset({ FilesetResolver: { isSimdSupported: async () => false } }, 'https://example.test/wasm'),
      /SIMD/u,
      'a browser without WASM SIMD must fail honestly, not request an unvendored nosimd module build',
    );
    await assert.rejects(() => resolveVisionFileset(visionModule, '   '), /wasm root is required/u);
  } finally {
    delete globalThis.ModuleFactory;
    if (priorSelf === undefined) delete globalThis.self; else globalThis.self = priorSelf;
  }
});

test('the wasm glue builds the resolver depends on are actually vendored', async () => {
  // The resolver deliberately has no nosimd fallback because that build is not
  // vendored. If these files move, the stage must fail loudly in CI, not in a
  // Founder session.
  const glue = await readFile(new URL('vision_wasm_module_internal.js', WASM_DIR), 'utf8');
  assert.ok(glue.length > 1000, 'MODULARIZE wasm glue must be present');
  assert.match(glue, /import\.meta/u, 'this build is the ES module flavour, which is why it must be imported not importScripts-ed');
  const binary = await readFile(new URL('vision_wasm_module_internal.wasm', WASM_DIR));
  assert.ok(binary.length > 1_000_000, 'MODULARIZE wasm binary must be present');
});
