// Y1-Y2-CAM-V6-3508 — media capture, device switching and student/debug separation.
//
// Founder physical QA in Safari reported -160 dBFS, peak 0.00 and "Detected speech NO"
// while speaking. Root cause: the Web Audio graph terminated at the AnalyserNode with
// no route to a destination. WebKit's graph is demand-driven, so an unterminated node
// is never pulled and the analyser returned silence forever. Chrome pulls analysers
// regardless, which is why every automated Chrome run passed and the real test failed.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const STUDIO = new URL('../../public/studio/studio.mjs', import.meta.url);
const HTML = new URL('../../public/studio/index.html', import.meta.url);
const CSS = new URL('../../public/studio/studio.css', import.meta.url);
const PIPELINE = new URL('../../public/analytics/browser-pipeline.mjs', import.meta.url);

const studio = await readFile(STUDIO, 'utf8');
const html = await readFile(HTML, 'utf8');
const css = await readFile(CSS, 'utf8');
const pipeline = await readFile(PIPELINE, 'utf8');

test('the audio graph terminates at a destination through a muted gain node', () => {
  // The fix. Without a route to a destination Safari never pulls the analyser.
  assert.match(studio, /sink = AC\.createGain\(\)/u);
  assert.match(studio, /sink\.gain\.value = 0/u, 'the sink must be silent so the mic is never played back');
  assert.match(studio, /analyser\.connect\(sink\)/u);
  assert.match(studio, /sink\.connect\(AC\.destination\)/u, 'the graph must reach a destination');

  // Ordering matters: source -> analyser -> sink -> destination.
  const sourceIdx = studio.indexOf('source.connect(analyser)');
  const sinkIdx = studio.indexOf('analyser.connect(sink)');
  const destIdx = studio.indexOf('sink.connect(AC.destination)');
  assert.ok(sourceIdx > 0 && sinkIdx > sourceIdx && destIdx > sinkIdx, 'graph must be wired in order');
});

test('the media source uses the original stream, not a reconstructed one', () => {
  // Safari does not reliably pull audio from a MediaStream rebuilt from getAudioTracks().
  assert.match(studio, /createMediaStreamSource\(stream\)/u);
  assert.doesNotMatch(studio, /createMediaStreamSource\(new MediaStream\(/u);
});

test('stopMedia releases the sink so switching cannot leak audio nodes', () => {
  assert.match(studio, /this\.sink\?\.disconnect\?\.\(\)/u);
});

test('device replacement keeps the retained device alive', () => {
  // bindStream() starts with stopMedia(), which stops every track of the current
  // stream when owned - including the one being carried over. Switching the microphone
  // would otherwise have killed the camera.
  assert.match(studio, /this\.ownsStream = false;\s*\n\s*await this\.bindStream\(next, \{ ownsStream: true \}\)/u,
    'ownership must be released before rebinding so retained tracks survive');
  // The outgoing device is stopped only after the replacement is live.
  const start = studio.indexOf('async replaceTrack(');
  const body = studio.slice(start, studio.indexOf('return this.media;', start));
  assert.ok(body.indexOf('await this.bindStream(next') < body.indexOf('outgoing?.stop?.()'),
    'the old device must be released only after the new one is live');
  // An exact deviceId is requested, so the picker actually selects hardware.
  assert.match(studio, /deviceId: \{ exact: deviceId \}/u);
});

test('devices are enumerated after permission and the selection persists', () => {
  // Labels are only exposed after permission is granted, so enumeration must run then.
  assert.match(studio, /enumerateDevices\(\)/u);
  assert.match(studio, /videoinput/u);
  assert.match(studio, /audioinput/u);
  assert.match(studio, /localStorage\.setItem\(DEVICE_STORE_KEY/u, 'selection must persist');
  assert.match(studio, /devicechange/u, 'hardware changes must refresh the list');
  // A device with no label yet must say so rather than render blank.
  assert.match(studio, /allow access to see its name/u);
});

test('the device surfaces exist in Device Check and in-session', () => {
  const selectors = html.match(/data-device-selectors/gu) || [];
  assert.ok(selectors.length >= 2, 'Device Check and Delivery Training both need selectors');
  assert.match(html, /id="mic-level-fill"/u, 'a live input meter must exist');
  assert.match(html, /id="mic-level-readout"/u);
  assert.match(html, /⚙ Devices/u, 'in-session quick switch must be reachable without leaving the session');
  assert.match(css, /\.mic-meter-fill/u);
});

test('vision cadence favours latency over throughput', () => {
  // A 2fps floor is a 500ms overlay interval, which reads as lag even though frames
  // are never queued (capture is skipped while one is in flight). Only the floor
  // changed; the ceiling stays at the previous default because several epoch tests are
  // coupled to that cadence.
  assert.match(pipeline, /const VISION_MIN_FPS = 8;/u);
  assert.match(pipeline, /const VISION_MAX_FPS = 8;/u);
  assert.match(pipeline, /Math\.max\(VISION_MIN_FPS, this\.targetFps - 1\)/u);
  assert.doesNotMatch(pipeline, /Math\.max\(2, this\.targetFps/u, 'the 2fps floor must not return');
  // Backpressure: a new frame is only captured when none is in flight.
  assert.match(pipeline, /!this\.frameInFlight/u);
});

test('role drives presentation, not just a badge', () => {
  assert.match(studio, /function applyRole\(role\)/u);
  assert.match(studio, /document\.body\.dataset\.role = state\.role/u);
  // Engineering instrumentation is hidden for students by presentation only.
  assert.match(css, /body\[data-role="student"\] \[data-founder-only\]/u);
  assert.match(html, /id="debug-banner"/u);
  // The debug tooling is hidden, never deleted.
  assert.match(css, /Hiding engineering instrumentation never stops measurement/u);
});
