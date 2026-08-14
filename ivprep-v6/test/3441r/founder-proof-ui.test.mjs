import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  canUsePaidFounderControls,
  createFounderMediaReadinessGate,
  createFounderTransportTerminationGate,
  createNoReconnectPolicy,
} from '../../public/aaa/api-client.mjs';

const ROOT = new URL('../../', import.meta.url);

test('Founder room is student-primary, Dr Kelly inset, accessible swap, and one audio surface', async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL('public/aaa/index.html', ROOT), 'utf8'),
    readFile(new URL('public/aaa/app.mjs', ROOT), 'utf8'),
    readFile(new URL('public/aaa/styles.css', ROOT), 'utf8'),
  ]);
  assert.match(html, /class="student-stage" aria-label="Student primary video surface"/u);
  assert.match(html, /id="founder-avatar-video"/u);
  assert.equal((html.match(/id="founder-avatar-audio"/gu) || []).length, 1);
  assert.match(html, /id="room-swap" aria-pressed="false"/u);
  assert.match(html, /Dr Kelly/u);
  assert.match(css, /\.room-stage\.layout-swapped/u);
  assert.match(app, /audibleInterviewerTrack/u);
  assert.match(app, /Track\.Kind\.Audio/u);
  assert.match(app, /track\.detach\(\)/u);
  assert.match(app, /if \(interview\?\.id\) \{[\s\S]*?await endInterview\(interview\.id\);[\s\S]*?state\.currentInterview = null;/u);
  assert.match(app, /status\.interview\?\.state === 'ended'[\s\S]*?skipServerEnd: true/u);
  assert.match(app, /provider cleanup is confirmed/u);
  assert.match(app, /status\.interview\?\.state === 'failed_closed'[\s\S]*?fresh authorization/u);
  assert.match(app, /participant\?\.identity !== avatarParticipantIdentity/u);
  assert.match(app, /requestVideoFrameCallback/u);
  assert.match(app, /await audio\.play\(\)/u);
  assert.match(app, /setMicrophoneEnabled\(!targetMuted\)/u);
  assert.match(app, /participant\.isMicrophoneEnabled !== !targetMuted/u);
  assert.match(app, /waitForFounderProofActive/u);
  assert.match(app, /room\.canPlaybackAudio === false/u);
});

test('browser readiness gate ignores bystanders, requires exact avatar video and audio, and never reconnects', async () => {
  const events = [];
  const gate = createFounderMediaReadinessGate({
    avatarParticipantIdentity: 'ivprep-3441r-lemonslice-avatar',
    onReady: async () => { events.push('ready'); },
    onFail: () => { events.push('failed'); },
  });
  assert.equal(gate.observe({ participantIdentity: 'bystander', kind: 'video', ready: true }), false);
  assert.deepEqual(gate.state(), {
    videoDecoded: false,
    audioPlayable: false,
    terminal: false,
    readyStarted: false,
  });
  assert.equal(gate.observe({
    participantIdentity: 'ivprep-3441r-lemonslice-avatar',
    kind: 'video',
    ready: true,
  }), true);
  assert.equal(events.length, 0);
  assert.equal(gate.observe({
    participantIdentity: 'ivprep-3441r-lemonslice-avatar',
    kind: 'audio',
    ready: true,
  }), true);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ['ready']);
  assert.equal(createNoReconnectPolicy().nextRetryDelayInMs(0), null);
});

test('browser readiness gate fails closed on an unsafe exact-avatar media event', () => {
  let failures = 0;
  const gate = createFounderMediaReadinessGate({
    avatarParticipantIdentity: 'ivprep-3441r-lemonslice-avatar',
    onReady: async () => {},
    onFail: () => { failures += 1; },
  });
  assert.equal(gate.observe({
    participantIdentity: 'ivprep-3441r-lemonslice-avatar',
    kind: 'audio',
    ready: false,
  }), false);
  assert.equal(gate.state().terminal, true);
  assert.equal(failures, 1);
  assert.equal(gate.observe({
    participantIdentity: 'ivprep-3441r-lemonslice-avatar',
    kind: 'audio',
    ready: true,
  }), false);
  assert.equal(failures, 1);
});

test('browser readiness gate contains an activation rejection and fails closed once', async () => {
  const failures = [];
  const gate = createFounderMediaReadinessGate({
    avatarParticipantIdentity: 'ivprep-3441r-lemonslice-avatar',
    onReady: async () => { throw new Error('activation_rejected'); },
    onFail: (error) => { failures.push(error?.message || error); },
  });
  assert.equal(gate.observe({
    participantIdentity: 'ivprep-3441r-lemonslice-avatar',
    kind: 'video',
    ready: true,
  }), true);
  assert.equal(gate.observe({
    participantIdentity: 'ivprep-3441r-lemonslice-avatar',
    kind: 'audio',
    ready: true,
  }), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(failures, ['activation_rejected']);
  assert.equal(gate.state().terminal, true);
  assert.equal(gate.fail('late_failure'), false);
});

test('post-readiness avatar transport loss triggers terminal cleanup exactly once', async () => {
  const events = [];
  const gate = createFounderTransportTerminationGate({
    onPreReadyFailure: (reason) => { events.push(`pre:${reason}`); },
    onPostReadyFailure: async (reason) => { events.push(`post:${reason}`); },
  });
  assert.equal(gate.markReady(), true);
  assert.equal(gate.fail('avatar_track_unsubscribed'), true);
  assert.equal(gate.fail('livekit_reconnecting'), false);
  assert.equal(gate.fail('livekit_disconnected'), false);
  await Promise.resolve();
  assert.deepEqual(events, ['post:avatar_track_unsubscribed']);
  assert.deepEqual(gate.state(), { ready: true, terminal: true });

  const app = await readFile(new URL('public/aaa/app.mjs', ROOT), 'utf8');
  assert.match(app, /onPostReadyFailure:\s*\(\) => stopProductionRoom\(\{/u);
  assert.match(app, /RoomEvent\.Reconnecting, failClosed/u);
  assert.match(app, /RoomEvent\.Disconnected, failClosed/u);
  assert.match(app, /TrackUnsubscribed[\s\S]*?mediaGate\.fail\('avatar_track_unsubscribed'\)/u);
});

test('UI cannot authorize on page load and binds exact visible test truth', async () => {
  const [html, app, api] = await Promise.all([
    readFile(new URL('public/aaa/index.html', ROOT), 'utf8'),
    readFile(new URL('public/aaa/app.mjs', ROOT), 'utf8'),
    readFile(new URL('public/aaa/api-client.mjs', ROOT), 'utf8'),
  ]);
  assert.match(html, /FOUNDER TEST #1 · ONE SHOT/u);
  assert.match(html, /gpt-realtime-2\.1 native speech → LiveKit → LemonSlice/u);
  assert.match(html, /Authorization alone creates no provider session/u);
  assert.match(html, /id="founder-acquire-lease"/u);
  assert.match(html, /id="founder-lease-state">NOT_ACQUIRED/u);
  assert.match(html, /Cedar is prohibited/u);
  assert.match(app, /addEventListener\("click", \(\) => \{ void authorizeFounderProof\(\); \}\)/u);
  const initializeStart = app.indexOf('async function initialize()');
  const initializeEnd = app.indexOf('void initialize();', initializeStart);
  assert.ok(initializeStart >= 0 && initializeEnd > initializeStart);
  assert.doesNotMatch(app.slice(initializeStart, initializeEnd), /authorizeFounderProof\(/u);
  assert.doesNotMatch(app.slice(initializeStart, initializeEnd), /acquireFounderProofLease\(/u);
  assert.match(api, /request\('\/provider-tests\/authorize'/u);
  assert.match(api, /method: 'POST'/u);
  assert.doesNotMatch(api, /request\('\/provider-tests\/authorize'\)/u);
});

test('Founder paid controls are READY-only and lease loss disables them immediately', async () => {
  for (const state of ['NOT_ACQUIRED', 'STABILIZING', 'LOST', 'RELEASED']) {
    assert.equal(canUsePaidFounderControls(state), false);
  }
  assert.equal(canUsePaidFounderControls('READY'), true);
  const [app, api] = await Promise.all([
    readFile(new URL('public/aaa/app.mjs', ROOT), 'utf8'),
    readFile(new URL('public/aaa/api-client.mjs', ROOT), 'utf8'),
  ]);
  assert.match(app, /!canUsePaidFounderControls\(state\.t1Lease\.state\)/u);
  assert.match(app, /state\.t1Lease\.state === 'LOST'[\s\S]*?stopProductionRoom/u);
  assert.match(app, /releaseT1Lease\(\)/u);
  assert.match(api, /request\('\/t1-lease\/acquire'/u);
  assert.match(api, /request\('\/t1-lease\/release'/u);
});

test('Realtime adapter uses semantic turn detection without a fixed five-second silence wait', async () => {
  const source = await readFile(new URL('server/providers/openai-realtime-adapter.mjs', ROOT), 'utf8');
  assert.match(source, /model: OPENAI_REALTIME_MODEL/u);
  assert.match(source, /voice,/u);
  assert.match(source, /type: 'semantic_vad'/u);
  assert.match(source, /eagerness: 'auto'/u);
  assert.match(source, /voice === 'cedar'/u);
  assert.doesNotMatch(source, /voice\s*=\s*'cedar'|voice:\s*'cedar'/u);
  assert.doesNotMatch(source, /(?<![0-9])(?:5_000|5000)(?![0-9])|five.second/iu);
});
