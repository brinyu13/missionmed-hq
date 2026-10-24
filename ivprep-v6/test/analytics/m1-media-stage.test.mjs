// Y1-Y2-CAM-V6-3502 regression guards for the M1 media stage.
//
// Three defects each independently produced the Founder-reported failure:
// permission granted, webcam LED on, student video black, vision IDLE,
// face/torso/hands unavailable, gauges unavailable, controls unresponsive.
// None of the three was covered by a test. Source-level guards follow the existing
// convention in founder-cockpit.test.mjs.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const UI = new URL('../../public/analytics/ui.mjs', import.meta.url);
const APP = new URL('../../public/aaa/app.mjs', import.meta.url);

const ui = await readFile(UI, 'utf8');
const app = await readFile(APP, 'utf8');

function connectBody(source) {
  const start = source.indexOf('  async connect() {');
  assert.ok(start > 0, 'connect() must exist');
  const end = source.indexOf('\n  start() {', start);
  assert.ok(end > start, 'start() must follow connect()');
  return source.slice(start, end);
}

test('the bridge still publishes media as a frozen object', () => {
  // This is the contract the connect() fix respects. If the bridge stops freezing,
  // the guard below is measuring nothing and should be revisited deliberately.
  assert.match(app, /this\.media = Object\.freeze\(\{/u);
});

test('connect() never writes to the frozen bridge media object', () => {
  const body = connectBody(ui);
  // `current.cam = ...` threw "TypeError: Cannot assign to read only property 'cam'"
  // under module strict mode, aborting connect() after getUserMedia had already
  // succeeded: the camera was live but the stream never reached the preview and the
  // status never left "Waiting for browser permission...".
  assert.doesNotMatch(body, /current\.(cam|mic)\s*=[^=]/u, 'connect() must not assign to the frozen media object');
  assert.doesNotMatch(body, /\bthis\.bridge\.media\.\w+\s*=[^=]/u);
  // Liveness must still be derived, into locals.
  assert.match(body, /const camLive =/u);
  assert.match(body, /const micLive =/u);
  // And the derived values, not the frozen fields, must drive status + gating.
  assert.match(body, /camLive && micLive \? 'ready' : 'partial'/u);
  assert.match(body, /if \(!camLive && !micLive\)/u);
  // The stream must still reach the preview surface.
  assert.match(body, /preview\.srcObject = current\.stream/u);
});

test('the cockpit resolves its owning view from the DOM, not a hardcoded name', () => {
  // The old guard read `view === 'analytics-test'`, a literal only correct for the
  // public/index.html host. In the shipped AAA product the view is 'delivery', so the
  // guard never matched and every view sync fell through to clear(), which calls
  // bridge.stopMedia() and render().
  assert.match(ui, /this\.viewHost = this\.root\?\.closest\?\.\('\[data-view-panel\],\[data-view\]'\)/u);
  assert.match(ui, /this\.viewId = this\.viewHost\?\.dataset\?\.viewPanel \|\| this\.viewHost\?\.dataset\?\.view/u);
  assert.match(ui, /ownsActiveView\(view, role\) \{/u);

  // onViewChange must delegate to the resolved owner and must no longer contain the
  // stale literal as its gate.
  const start = ui.indexOf('  onViewChange(view, role) {', ui.indexOf('ownsActiveView(view, role) {'));
  assert.ok(start > 0, 'the cockpit onViewChange must follow ownsActiveView');
  const body = ui.slice(start, start + 400);
  assert.match(body, /if \(this\.ownsActiveView\(view, role\)\) return;/u);
  assert.doesNotMatch(body, /view === 'analytics-test'/u, 'the stale view literal must not gate teardown');

  // Both real host view names must be reachable through the DOM lookup rather than
  // being special-cased in JS.
  assert.doesNotMatch(ui, /view === 'delivery'/u, 'do not swap one hardcoded view name for another');
});

test('a render while media is live re-attaches the stream instead of blanking it', () => {
  // render() calls root.replaceChildren(), which discards the <video> holding
  // srcObject. Without re-attachment any render leaves a black preview while the
  // camera stays on.
  assert.match(ui, /const liveStream = this\.bridge\?\.media\?\.stream;/u);
  assert.match(ui, /if \(liveStream && this\.bridge\?\.media\?\.cam\) preview\.srcObject = liveStream;/u);
  assert.ok(
    ui.indexOf('const liveStream = this.bridge?.media?.stream;') > ui.indexOf('preview.id = \'communication-analytics-preview\''),
    're-attachment must happen after the preview element is created',
  );
});

test('the analytics cockpit is mounted in a view the DOM actually declares', async () => {
  // Ties the fix to the shipped markup: if the panel is renamed, viewId still
  // resolves, but this asserts the cockpit really does live inside a declared view.
  const html = await readFile(new URL('../../public/aaa/index.html', import.meta.url), 'utf8');
  assert.match(html, /data-view-panel="delivery"/u);
  assert.match(html, /id="communication-analytics-test-root"/u);
  // The root and the view panel must be the same element or nested, so closest() works.
  const panelIndex = html.indexOf('data-view-panel="delivery"');
  const rootIndex = html.indexOf('id="communication-analytics-test-root"');
  assert.ok(Math.abs(panelIndex - rootIndex) < 400, 'the cockpit root must sit on/inside the delivery view panel');
});
