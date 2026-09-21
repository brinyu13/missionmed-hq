import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInterviewRoomModel, preserveInterviewLifecycle } from '../../public/studio/presentation-view-model.mjs';

test('readiness, connection, live, saving and retry have distinct lifecycle-first presentations', () => {
  for (const [sessionState, providerState, phase] of [
    ['IDLE', 'idle', 'readiness'], ['SESSION_READY', 'idle', 'ready'],
    ['STARTING', 'connecting', 'connecting'], ['RUNNING', 'active', 'live'],
    ['RUNNING', 'error', 'live'], ['FINISHING', 'closed', 'saving'], ['COMPLETE', 'closed', 'complete'],
  ]) {
    const model = buildInterviewRoomModel({ sessionState, providerState });
    assert.equal(model.phase, phase);
    assert.equal(model.showStart, ['readiness', 'ready'].includes(phase));
    assert.equal(model.canEnd, phase === 'live');
  }
  const failed = buildInterviewRoomModel({ sessionState: 'BLOCKED', providerState: 'closed', saveRetry: true });
  assert.equal(failed.phase, 'save-error'); assert.equal(failed.showStart, false);
  assert.equal(failed.canEnd, true); assert.equal(failed.endLabel, 'Retry save');
});

test('realistic mode is quiet by default, coached display is deliberate and independent of actor role', () => {
  assert.equal(buildInterviewRoomModel({ sessionState: 'RUNNING' }).coached, false);
  assert.equal(buildInterviewRoomModel({ interviewMode: 'Coached / Live Analytics Mode' }).coached, true);
  assert.equal(buildInterviewRoomModel({ interviewMode: 'Coached / Live Analytics Mode', showAnalytics: false }).coached, false);
  assert.equal(buildInterviewRoomModel({ showAnalytics: true }).coached, true);
});

test('camera callbacks cannot rewind the active lifecycle', () => {
  for (const phase of ['STARTING', 'RUNNING', 'FINISHING']) assert.equal(preserveInterviewLifecycle(phase), true);
  for (const phase of ['IDLE', 'SESSION_READY', 'COMPLETE']) assert.equal(preserveInterviewLifecycle(phase), false);
});

const runtime = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../public/studio/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../public/studio/studio.css', import.meta.url), 'utf8');
test('compact camera geometry uses the same cover transform as its authoritative overlay', () => {
  assert.match(css, /#founder-student-video \{[^}]*object-fit:cover/);
  assert.match(css, /aspect-ratio:var\(--room-camera-ratio/);
  assert.doesNotMatch(css, /#founder-student-stage \{[^}]*aspect-ratio:auto/);
  assert.match(runtime, /camera\.videoWidth \/ camera\.videoHeight/);
});
test('room recomposition preserves exact media anchors and calls only display adapters', () => {
  for (const id of ['founder-student-video', 'founder-student-stage', 'founder-room-stage', 'founder-room-wrapper', 'live-interviewer-audio']) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1);
  }
  const render = runtime.slice(runtime.indexOf('function renderInterviewRoom()'), runtime.indexOf('function liveInterviewContext()'));
  assert.doesNotMatch(render, /srcObject\s*=|innerHTML|replaceChildren|requestMedia|new AudioContext|\.stop\(\).*liveInterview/);
  assert.match(render, /state\.analytics\.setInstrumentation/);
  const readiness = runtime.slice(runtime.indexOf('function evaluateReadiness()'), runtime.indexOf('async function startRep()'));
  assert.ok(readiness.indexOf('preserveInterviewLifecycle') < readiness.indexOf("setSessionState('MEDIA_READY')"));
  assert.match(html, /id="live-transcript" aria-live="off"/);
});

test('reopened Results derive evidence only from the selected recording', () => {
  const results = runtime.slice(runtime.indexOf('function renderPostAnswer('), runtime.indexOf('function supportedAnalyticsEvent('));
  assert.doesNotMatch(results, /state\.bus\.latest/);
  assert.match(results, /analytics\?\.studentEvents/);
});

test('retained save, live device failures and unexpected provider closure stay actionable', () => {
  assert.match(runtime, /saveRetry: state\.session\.finishFailed === true/);
  assert.match(runtime, /state\.session\.finishAnalytics = analyticsPromise/);
  assert.match(runtime, /retryingDurableSave \? state\.session\.finishAnalytics/);
  assert.match(runtime, /\['error', 'closed'\]\.includes\(state\.room\.providerState\)/);
  assert.match(runtime, /const mediaProblem = startBlockedReason\(\)/);
  assert.match(runtime, /state\.wizard\.program \|\| 'General interview'/);
});
