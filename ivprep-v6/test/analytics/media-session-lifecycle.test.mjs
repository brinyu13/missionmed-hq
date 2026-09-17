// Y1-Y2-CAM-V6-3511 — the Device Check -> Delivery Training handoff.
//
// Founder physical evidence, reproducible in BOTH Chrome and Safari:
//   Device Check  : camera live, mic live, AudioContext running, level moving
//                   (real readings -48.9 dBFS peak 0.010, -58.8 dBFS peak 0.003)
//   -> navigate to Delivery Training
//   Training      : "UNAVAILABLE - NO AUDIO", every metric "-", Start Rep dead.
//
// Root cause: ownsActiveView() opened with `if (role !== 'admin') return false;`. The
// Studio shell passes 'student', so in student mode the guard never matched ANY view,
// onViewChange fell through to clear(), and clear() called bridge.stopMedia() - the
// route change stopped the hardware. It also reset state to 'idle', which made Start Rep
// a silent no-op. One line, both symptoms, and role-dependent, which is why admin-mode
// testing missed it entirely.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('../../public/analytics/ui.mjs', import.meta.url), 'utf8');
const studio = await readFile(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');

/** Executable surface only - the fix's own comment quotes the defective line. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//gu, '')
    .split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
}

function ownsActiveViewBody() {
  const at = ui.indexOf('ownsActiveView(view, role) {');
  assert.ok(at > 0, 'ownsActiveView must exist');
  return stripComments(ui.slice(at, ui.indexOf('\n  }', at)));
}

test('role never gates media ownership', () => {
  const body = ownsActiveViewBody();
  // THE regression. This exact line stopped the microphone on every student route change.
  assert.doesNotMatch(body, /role[^\n]*!==\s*'admin'[^\n]*return false/u,
    'role must not decide whether this cockpit owns its view');
  // Ownership is resolved from the DOM, which is role-independent.
  assert.match(body, /this\.viewId && String\(view \|\| ''\) === this\.viewId/u);
  assert.match(body, /this\.viewHost/u);
});

test('a route change resets UI state but never stops the hardware', () => {
  // clear() must take an explicit flag, defaulting to the previous teardown behaviour so
  // every existing explicit path is unchanged.
  assert.match(ui, /clear\(\{ render = true, stopMedia = true \} = \{\}\)/u);
  assert.match(ui, /if \(stopMedia && this\.ownsMedia\) \{/u);
  // The view-change path must opt OUT of stopping media.
  const at = ui.indexOf('onViewChange(view, role) {', ui.indexOf('ownsActiveView(view, role) {'));
  const body = ui.slice(at, at + 700);
  assert.match(body, /this\.clear\(\{ stopMedia: false \}\)/u,
    'a route change must not release devices the student is still using');
  assert.doesNotMatch(body, /this\.clear\(\);/u, 'the unguarded clear() must not remain on this path');
});

test('explicit teardown paths still stop the hardware', () => {
  // The fix must not leave devices running forever. Explicit controls keep default
  // behaviour, which stops media.
  assert.match(ui, /clear\.addEventListener\('click', \(\) => this\.clear\(\)\)/u,
    'the explicit Clear control must still tear down');
  assert.match(ui, /if \(stopMedia && this\.ownsMedia\) \{\s*\n\s*this\.bridge\.stopMedia\(\);/u);
});

test('Delivery Training consumes the existing session and never reacquires', () => {
  const at = studio.indexOf('function bindCockpitVideo()');
  const body = stripComments(studio.slice(at, studio.indexOf('\nfunction ', at + 10)));
  // Attach the SAME stream. No new capture, no new context, no new permission prompt.
  assert.match(body, /v\.srcObject = bridge\.media\.stream/u);
  assert.doesNotMatch(body, /getUserMedia|primeAudioContext|new Ctx/u,
    'entering training must not reacquire hardware');
  // Route entry re-binds rather than rebuilding.
  assert.match(studio, /if \(view === 'training'\) bindCockpitVideo\(\);/u);
});

test('Start Rep is never a dead button', () => {
  // Y1-Y2-CAM-V6-3513: the guarantee moved from an inline check into the canonical
  // session engine. Start Rep no longer proxies a click into the LEGACY cockpit's hidden
  // button - whose disabled state came from that cockpit's own connect() lifecycle, so a
  // student who never pressed it got "the session engine is not ready" forever.
  assert.match(studio, /function evaluateReadiness\(\)/u);
  assert.match(studio, /async function startRep\(\)/u);
  // Readiness derives from REAL prerequisites, each with an actionable reason.
  for (const phrase of [
    'Connect your camera and microphone to begin',
    'Camera disconnected',
    'Microphone disconnected',
    'Audio is suspended',
    'Delivery Intelligence is still loading',
  ]) {
    assert.ok(studio.includes(phrase), `missing actionable reason: ${phrase}`);
  }
  // Start drives the session engine DIRECTLY through the facade.
  const body = studio.slice(studio.indexOf('async function startRep()'), studio.indexOf('async function finishRep()'));
  assert.match(body, /state\.analytics\.beginAnswer\(\{ videoElement: video \}\)/u,
    'Start Rep must drive the engine, not a legacy button');
  assert.doesNotMatch(body, /communication-analytics-start/u, 'the legacy button must not be in the critical path');
  // A rejected start must name itself rather than being swallowed.
  assert.match(body, /catch \(error\) \{[\s\S]*?Could not start the rep/u);
  // One canonical state machine, with the required transitions.
  for (const st of ['IDLE', 'MEDIA_READY', 'ANALYTICS_READY', 'SESSION_READY', 'STARTING', 'RUNNING', 'FINISHING', 'COMPLETE']) {
    assert.ok(studio.includes(st), `state ${st} missing from the canonical machine`);
  }
});

test('connectivity is distinguished from an active rep', () => {
  // The pipeline only samples audio between beginAnswer and endAnswer, so before a rep
  // there are deliberately no audio diagnostics. That is connectivity, not failure, and
  // must not read as "NO AUDIO" to the student.
  assert.match(studio, /MEDIA_READY: 'Devices connected · analytics attaching'/u);
  assert.match(studio, /SESSION_READY: 'Ready — press Start rep'/u);
  assert.match(studio, /RUNNING: 'Rep running'/u);
});

test('the media session has one owner and the bridge is shared', () => {
  // The Studio shell owns exactly one bridge; the analytics cockpit receives it rather
  // than constructing its own, so there is a single hardware lifecycle.
  assert.equal((studio.match(/^const bridge = \{/gmu) || []).length, 1, 'exactly one media owner');
  assert.match(studio, /initializeAnalyticsUi\(bridge,/u, 'the analytics cockpit consumes the shared bridge');
  // Overlay and role toggles are presentation only and must never stop tracks.
  const overlay = studio.slice(studio.indexOf('function renderOverlayToggles'), studio.indexOf('function bindCockpitVideo'));
  assert.doesNotMatch(overlay, /stopMedia|track\.stop|resetSession/u,
    'overlay toggles must never touch the hardware lifecycle');
  const role = studio.slice(studio.indexOf('function applyRole'), studio.indexOf('/* ---', studio.indexOf('function applyRole')));
  assert.doesNotMatch(role, /stopMedia|track\.stop/u, 'role toggle must never touch the hardware lifecycle');
});
