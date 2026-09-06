// Y1-Y2-CAM-V6-3510 — Safari audio chain guards.
//
// Founder physical QA in Safari: camera live, permission granted, microphone selected,
// product reporting "UNAVAILABLE - NO AUDIO". Three separate gates each independently
// disabled audio in WebKit while leaving the camera working. These pin all three.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pipeline = await readFile(new URL('../../public/analytics/browser-pipeline.mjs', import.meta.url), 'utf8');
const ui = await readFile(new URL('../../public/analytics/ui.mjs', import.meta.url), 'utf8');
const studio = await readFile(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
const html = await readFile(new URL('../../public/studio/index.html', import.meta.url), 'utf8');

test('transient track.muted never gates audio STARTUP, but still gates per-frame', () => {
  // MediaStreamTrack.muted means "temporarily not producing data", not a user mute.
  // WebKit reports it true on a freshly acquired microphone, so requiring it to be
  // false before sampling is a deadlock: no sampling -> no data -> muted never clears.
  const audioGates = [
    pipeline.slice(pipeline.indexOf('const hasMic =')).split('\n')[0],
    ui.slice(ui.indexOf('return Boolean(media.mic')).split('\n')[0],
  ];
  for (const gate of audioGates) {
    assert.ok(gate.includes('readyState') && gate.includes('enabled'), 'liveness must still be checked');
    assert.doesNotMatch(gate, /muted !== true/u, `an audio gate still blocks on transient muted: ${gate.trim().slice(0, 90)}`);
  }
  // The PER-FRAME guard deliberately keeps its muted check: a microphone that mutes
  // mid-session must create an observation gap rather than be recorded as measured.
  // Only the two startup gates tolerate the transient WebKit state, because that was a
  // bootstrap deadlock. This asymmetry is intentional and is asserted both ways.
  const frameGuard = pipeline.slice(pipeline.indexOf('audioMediaIsLive'));
  const audioLine = frameGuard.split('\n').find((l) => l.includes('getAudioTracks'));
  assert.match(audioLine, /muted !== true/u, 'mid-session muting must still create a gap');

  // VIDEO gates are deliberately untouched: a muted video track really is not usable.
  assert.ok((pipeline.match(/getVideoTracks\?\.\(\)\.some\(\(track\) => track\.readyState === 'live' && track\.enabled && track\.muted !== true\)/gu) || []).length >= 1,
    'video gates must keep their muted check');
});

test('the AudioContext is created and resumed inside the user gesture', () => {
  // 3508 terminated the graph but still constructed the context AFTER
  // `await getUserMedia()`. WebKit does not carry user activation across that await, so
  // the context stayed 'suspended' and the pipeline gates audio on state === 'running'.
  assert.match(studio, /primeAudioContext\(\) \{/u);
  assert.match(studio, /if \(this\.audioContext\.state !== 'running'\) void this\.audioContext\.resume\(\)/u);
  // bindStream must REUSE that context, never construct a fresh one.
  const bind = studio.slice(studio.indexOf('async bindStream('), studio.indexOf('async replaceTrack('));
  assert.match(bind, /AC = this\.primeAudioContext\(\)/u);
  assert.doesNotMatch(bind, /AC = new Ctx\(\)/u, 'bindStream must not create a post-await context');

  // Every media-acquiring gesture must prime first, before any await.
  // Anchor on the CLICK HANDLER, not the first mention of the id: bindCockpitVideo also
  // references #cockpit-connect and appears earlier in the file.
  for (const handler of [
    "$('#cockpit-connect')?.addEventListener",
    'async function connectDevices',
    'async function switchDevice',
  ]) {
    const at = studio.indexOf(handler);
    assert.ok(at > 0, `${handler} missing`);
    assert.match(studio.slice(at, at + 460), /primeAudioContext\(\)/u, `${handler} must prime the context`);
  }
  // A hot switch must not close the primed context.
  assert.match(studio, /stopMedia\(\{ keepContext = false \} = \{\}\)/u);
  assert.match(studio, /this\.stopMedia\(\{ keepContext: true \}\)/u);
});

test('the graph terminates at a destination that cannot reach the speakers', () => {
  // A real destination is required for WebKit to pull the graph, but the microphone
  // must never be audible. MediaStreamAudioDestinationNode has no playback path at
  // all, and unlike a gain(0) branch there is nothing for the engine to optimise away.
  assert.match(studio, /sink = AC\.createMediaStreamDestination\(\)/u);
  assert.match(studio, /analyser\.connect\(sink\)/u);
  assert.doesNotMatch(studio, /sink\.connect\(AC\.destination\)/u, 'no path to the speakers');
  assert.match(studio, /createMediaStreamSource\(stream\)/u);
});

test('the Founder audio diagnostics panel exists and is admin-only', () => {
  assert.match(html, /id="audio-debug"/u);
  const at = html.indexOf('id="audio-debug"');
  assert.match(html.slice(Math.max(0, at - 400), at), /data-founder-only/u, 'must be founder-only');
  // It must read the LIVE objects, so it cannot agree with a broken pipeline.
  assert.match(studio, /getFloatTimeDomainData\(m\.data\)/u);
  for (const field of ['Audio track', 'Track enabled', 'Track muted', 'AudioContext',
    'Sample rate', 'Channels', 'PCM frames', 'RMS', 'Peak', 'F0 input frames']) {
    assert.ok(studio.includes(field), `debug panel must report ${field}`);
  }
});
