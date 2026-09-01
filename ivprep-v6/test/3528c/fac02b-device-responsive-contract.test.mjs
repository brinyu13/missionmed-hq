import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('FAC-02B Setup owns an explicit device rescan and refreshes after hardware changes', async () => {
  const menus = await source('public/ivoc-standalone/app/menus.mjs');

  assert.match(menus, /data-refresh-devices[^>]*aria-label="Refresh camera and microphone list"/u);
  assert.match(menus, /mountSelectedPreview\(\{ rescan: true \}\)/u);
  assert.match(menus, /navigator\.mediaDevices\.enumerateDevices\(\)/u);
  assert.match(menus, /device\.kind === 'videoinput' && device\.deviceId === cameraDeviceId/u);
  assert.match(menus, /device\.kind === 'audioinput' && device\.deviceId === microphoneDeviceId/u);
  assert.match(menus, /addEventListener\?\.\('devicechange', handleDeviceChange\)/u);
  assert.match(menus, /removeEventListener\?\.\('devicechange', handleDeviceChange\)/u);
  assert.match(menus, /clearTimeout\(deviceRefreshTimer\)/u);
});

test('FAC-02B responsive tier compacts every right-rail instrument without changing its analog or grid contract', async () => {
  const live = await source('public/ivoc-standalone/app/live.mjs');
  const css = await source('public/ivoc-standalone/styles/cockpit.css');

  assert.match(css, /@media \(max-height: 1000px\)[\s\S]*#inst-pace \{ flex: 1\.42; \}/u);
  assert.match(css, /@media \(max-height: 1000px\)[\s\S]*\.speedometer \{ height: 76px; min-height: 76px; \}/u);
  assert.match(css, /@media \(max-height: 1000px\)[\s\S]*\.volume-segments \{ height: 26px; min-height: 26px; max-height: 26px; \}/u);
  assert.match(css, /@media \(max-height: 1000px\)[\s\S]*\.piano-svg \{ max-height: 52px; \}/u);
  assert.match(css, /grid-template-columns: var\(--left-col\) minmax\(0, 1fr\) var\(--right-col\)/u);
  assert.match(live, /class="speed-dial" viewBox="0 0 320 120"/u);
  assert.match(live, /class="speed-needle"/u);
});

test('FAC-02B product source keeps both founder scanners co-located and uncropped', async () => {
  const live = await source('public/ivoc-standalone/app/live.mjs');
  const css = await source('public/ivoc-standalone/styles/cockpit.css');

  assert.match(live, /src="assets\/founder-face-scanner\.png"/u);
  assert.match(live, /src="assets\/founder-body-scanner\.png"/u);
  assert.match(css, /\.scan-well img \{[\s\S]*object-fit: contain/u);
});
