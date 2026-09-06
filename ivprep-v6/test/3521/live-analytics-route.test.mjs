import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import test from 'node:test';

import { InMemoryAdmissionRegistry } from '../../server/admission-registry.mjs';
import { createIvPrepHqHandler } from '../../server/hq-mount.mjs';

const NOW = Date.parse('2026-08-21T16:00:00.000Z');

function admittedHandler() {
  const registry = new InMemoryAdmissionRegistry({ now: () => NOW });
  registry.grantSyntheticEntitlement({
    subject: 'wp:3521', revision: 'local-3521', expiresAtMs: NOW + 120_000,
    founder: true, voice: true, video: false, grantedVideoSeconds: 0,
  });
  return createIvPrepHqHandler({
    registry,
    now: () => NOW,
    flags: { enabled: true, adminCanaryEnabled: true, videoEnabled: false },
  });
}

async function invoke(path) {
  const request = Readable.from([]);
  request.method = 'HEAD';
  request.headers = { host: 'hq.local' };
  const response = {
    status: null,
    headers: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end() {},
  };
  const handled = await admittedHandler()({
    request,
    response,
    url: new URL(path, 'http://hq.local'),
    hqSession: {
      version: 1,
      issuedAt: new Date(NOW - 1_000).toISOString(),
      expiresAt: new Date(NOW + 60_000).toISOString(),
      csrfToken: 'local_harness_csrf_3521',
      authSource: 'wordpress-cookie',
      user: { id: 3521, roles: ['administrator'] },
    },
    cookieFingerprint: '5'.repeat(64),
    hqSessionMaxTtlSeconds: 300,
    expectedOrigin: 'http://hq.local',
  });
  return { handled, ...response };
}

test('dedicated live analytics path redirects to its canonical trailing-slash route', async () => {
  const response = await invoke('/iv-prep-on-call/live-analytics');
  assert.equal(response.handled, true);
  assert.equal(response.status, 308);
  assert.equal(response.headers.Location, '/iv-prep-on-call/live-analytics/');
});

test('dedicated live analytics HTML and module assets are served inside the authenticated mount', async () => {
  const html = await invoke('/iv-prep-on-call/live-analytics/');
  const module = await invoke('/iv-prep-on-call/assets/live-analytics/live-analytics.mjs');
  const style = await invoke('/iv-prep-on-call/assets/live-analytics/live-analytics.css');
  const vadRuntime = await invoke('/iv-prep-on-call/assets/vendor/vad-web/0.0.30/bundle.min.js');
  const vadWorklet = await invoke('/iv-prep-on-call/assets/vendor/vad-web/0.0.30/vad.worklet.bundle.min.js');
  const vadModel = await invoke('/iv-prep-on-call/assets/vendor/vad-web/0.0.30/silero_vad_v5.onnx');
  assert.equal(html.status, 200);
  assert.match(html.headers['Content-Type'], /text\/html/u);
  assert.match(html.headers['Content-Security-Policy'], /connect-src 'self';/u);
  assert.equal(module.status, 200);
  assert.match(module.headers['Content-Type'], /text\/javascript/u);
  assert.equal(style.status, 200);
  assert.match(style.headers['Content-Type'], /text\/css/u);
  assert.equal(vadRuntime.status, 200);
  assert.match(vadRuntime.headers['Content-Type'], /text\/javascript/u);
  assert.equal(vadWorklet.status, 200);
  assert.match(vadWorklet.headers['Content-Type'], /text\/javascript/u);
  assert.equal(vadModel.status, 200);
  assert.match(vadModel.headers['Content-Type'], /application\/octet-stream/u);
});

test('3521 localhost harness cannot create provider sessions or enable a paid provider', async () => {
  const source = await readFile(new URL('../../scripts/3521/start-live-analytics-harness.mjs', import.meta.url), 'utf8');
  assert.match(source, /providerSessionsCreatedAtReadiness: 0/u);
  assert.match(source, /paidProviderCreationEnabled: false/u);
  assert.match(source, /videoEnabled: false/u);
  assert.doesNotMatch(source, /providerControllerFactory|LemonSlice|Railway|SUPABASE/u);
});
