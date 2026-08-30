import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { COACHING_CONFIG, mapToLiveScale } from '../../public/analytics/coaching-config.mjs';
import { ConversationStateMachine } from '../../public/analytics/conversation-state.mjs';
import { GestureUnitDetector } from '../../public/analytics/gesture-units.mjs';
import { PRIMARY_LOCK_STATE, PrimaryIntervieweeLock } from '../../public/analytics/primary-interviewee-lock.mjs';
import { SmilePatternEventDetector } from '../../public/analytics/smile-pattern.mjs';
import { SetupReadinessGate } from '../../public/live-analytics/setup-readiness.mjs';
import { WordEventStream } from '../../public/live-analytics/word-stream.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (path) => readFile(`${root}/${path}`, 'utf8');

test('MissionMed Live Scale maps the personal corridor exactly to 7–8', () => {
  assert.equal(mapToLiveScale(0, 140, 175, 235), 0);
  assert.equal(mapToLiveScale(140, 140, 175, 235), 7);
  assert.equal(mapToLiveScale(157.5, 140, 175, 235), 7.5);
  assert.equal(mapToLiveScale(175, 140, 175, 235), 8);
  assert.equal(mapToLiveScale(235, 140, 175, 235), 10);
  assert.equal(mapToLiveScale(400, 140, 175, 235), 10);
});

test('3526 config centralizes the frozen display, hold, smile, gesture and lock laws', () => {
  assert.equal(COACHING_CONFIG.version, '3526-p1.0');
  assert.equal(COACHING_CONFIG.scale.renderHz, 1);
  assert.equal(COACHING_CONFIG.scale.easeMs, 300);
  assert.equal(COACHING_CONFIG.deliverySpeed.staleAfterMs, 8_000);
  assert.equal(COACHING_CONFIG.face.smileRefractoryMs, 8_000);
  assert.equal(COACHING_CONFIG.face.smileCheekOnDelta, 0.12);
  assert.equal(COACHING_CONFIG.face.smileAnsweringMinimumDurationMs, 700);
  assert.equal(COACHING_CONFIG.gesture.minimumRateSpeechMs, 15_000);
  assert.equal(COACHING_CONFIG.personLock.graceMs, 5_000);
  assert.equal(COACHING_CONFIG.varietyScale.minimumVoicedFrames, 50);
});

test('word stream deduplicates overlapping decoder windows without retaining text', () => {
  const stream = new WordEventStream();
  const words = Array.from({ length: 8 }, (_, index) => ({
    startMs: index * 500,
    endMs: index * 500 + 420,
    probability: .9,
  }));
  assert.equal(stream.ingest(words, { atMs: 4_000 }).accepted, 8);
  assert.equal(stream.ingest(words.map((word) => ({ ...word })), { atMs: 4_100 }).duplicate, 8);
  assert.equal(stream.snapshot().eventCount, 8);
  assert.equal(stream.snapshot().rawTextRetained, false);
});

test('word stream produces real rolling articulation rate after the minimum evidence', () => {
  const stream = new WordEventStream();
  stream.ingest(Array.from({ length: 10 }, (_, index) => ({
    startMs: index * 420,
    endMs: index * 420 + 360,
    probability: .8,
  })), { atMs: 4_200 });
  const rate = stream.articulationRate({ atMs: 4_200 });
  assert.equal(rate.available, true);
  assert.ok(rate.wordsPerMinute > 150 && rate.wordsPerMinute < 180);
});

test('conversation state distinguishes short and long pauses without blanking delivery', () => {
  const state = new ConversationStateMachine({ now: () => 0 });
  state.dispatch('SETUP_READY', 0);
  state.dispatch('USER_SPEECH_START', 100);
  state.dispatch('USER_SPEECH_END', 1_000);
  assert.equal(state.snapshot(1_100).state, 'PAUSE_SHORT');
  state.dispatch('TICK', 2_100);
  assert.equal(state.snapshot(2_100).state, 'PAUSE_LONG');
  state.dispatch('USER_SPEECH_RESUME', 2_200);
  assert.equal(state.snapshot(2_200).state, 'ANSWERING');
});

test('setup front door requires floor plus 15 dB and absolute -45 dBFS', () => {
  const gate = new SetupReadinessGate();
  gate.ingestVideo({ facePresent: true, faceFraction: .28, centerX: .5, centerY: .4, confidence: .9 });
  gate.ingestAudio({ available: true, speechMs: 3_000, noiseFloorDb: -70, speechLevelDb: -46 });
  assert.equal(gate.snapshot().audioSignal, false);
  gate.ingestAudio({ available: true, speechMs: 3_000, noiseFloorDb: -70, speechLevelDb: -44 });
  assert.equal(gate.snapshot().audioSignal, true);
});

test('camera height is advisory while gross size and centering remain setup gates', () => {
  const gate = new SetupReadinessGate();
  gate.ingestAudio({ available: true, speechMs: 3_000, noiseFloorDb: -70, speechLevelDb: -40 });
  gate.ingestVideo({ facePresent: true, faceFraction: .28, centerX: .5, centerY: .4, headPitchDegrees: 20, confidence: .9 });
  const snapshot = gate.snapshot();
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.cameraHeightAdvisory, true);
});

test('person lock gives a true no-face occlusion five seconds without extending unsafe replacement candidates', () => {
  const face = (centerX = .5) => ({ left: centerX - .09, top: .26, width: .18, height: .24 });
  const absent = new PrimaryIntervieweeLock();
  absent.update({ atMs: 0, candidates: [face()] });
  absent.update({ atMs: 325, candidates: [face(.505)] });
  absent.update({ atMs: 650, candidates: [face(.51)] });
  assert.equal(absent.update({ atMs: 5_400, candidates: [] }).state, PRIMARY_LOCK_STATE.PRIMARY_TEMPORARILY_OCCLUDED);
  assert.equal(absent.update({ atMs: 5_650, candidates: [] }).state, PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED);

  const replacement = new PrimaryIntervieweeLock();
  replacement.update({ atMs: 0, candidates: [face()] });
  replacement.update({ atMs: 325, candidates: [face(.505)] });
  replacement.update({ atMs: 650, candidates: [face(.51)] });
  replacement.update({ atMs: 900, candidates: [face(.82)] });
  assert.equal(replacement.update({ atMs: 3_200, candidates: [face(.82)] }).state, PRIMARY_LOCK_STATE.PRIMARY_SELECTION_REQUIRED);
});

test('gesture detector supports face-box normalization but withholds a rate before 15 seconds', () => {
  const detector = new GestureUnitDetector();
  detector.ingest({ atMs: 0, faceBox: { width: .12 }, leftHand: { x: .4, y: .6 }, speaking: true });
  const frame = detector.ingest({ atMs: 1_000, faceBox: { width: .12 }, leftHand: { x: .6, y: .4 }, speaking: true });
  assert.match(frame.provenance.method, /FACE_BOX_NORMALIZED/u);
  assert.equal(frame.rateAvailable, false);
  assert.equal(frame.rateUnavailableReason, 'INSUFFICIENT_SPEAKING_TIME');
});

test('qualifying smile events require simultaneous mouth and cheek/periocular geometry', () => {
  const detector = new SmilePatternEventDetector();
  detector.setBaseline(0.05, 0.05);
  const base = { faceAvailable: true, confidence: 0.9, faceFraction: 0.25, state: 'LISTENING' };
  detector.ingest({ ...base, atMs: 0, bilateral: 0.40, cheekBilateral: 0.08 });
  detector.ingest({ ...base, atMs: 700, bilateral: 0.05, cheekBilateral: 0.05 });
  assert.equal(detector.summary().eventCount, 0, 'mouth-only movement never qualifies');
  detector.ingest({ ...base, atMs: 9_000, bilateral: 0.40, cheekBilateral: 0.22 });
  const completed = detector.ingest({ ...base, atMs: 9_700, bilateral: 0.05, cheekBilateral: 0.05 });
  assert.equal(completed.event?.kind, 'full_face_smile_pattern');
  assert.equal(detector.summary().eventCount, 1);
});

test('frozen cockpit keeps 16:9 center, exact voice order, tuning and Mentor controls', async () => {
  const [html, css] = await Promise.all([
    read('public/live-analytics/index.html'),
    read('public/live-analytics/live-analytics.css'),
  ]);
  assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/u);
  assert.match(css, /\[data-module="speed"\]\s*\{\s*order:\s*1/u);
  assert.match(css, /\[data-module="volume"\]\s*\{\s*order:\s*2/u);
  assert.match(css, /\[data-module="pitch"\]\s*\{\s*order:\s*3/u);
  assert.match(html, /data-tune="pace"/u);
  assert.match(html, /data-tune="volume"/u);
  assert.match(html, /data-tune="pitch"/u);
  assert.match(html, /data-tune="gesture"/u);
  assert.match(html, /id="toggle-live-cues"/u);
  assert.match(html, /id="mentor-drawer"/u);
});

test('deterministic analytics begins measuring before the interview state starts', async () => {
  const source = await read('public/live-analytics/live-analytics.mjs');
  assert.match(source, /#startFixtureCaptureMeasurement\(\)/u);
  assert.match(source, /Measuring local test input · interview not started/u);
  assert.match(source, /if \(!this\.captureMeasuring\) this\.#startFixtureCaptureMeasurement\(\)/u);
});

test('student voice instruments expose 0–10 primaries and raw engineering secondaries', async () => {
  const html = await read('public/live-analytics/index.html');
  assert.match(html, /data-hud-value="speed">—<\/span><span>\/ 10/u);
  assert.match(html, /data-speed-raw>— WPM/u);
  assert.match(html, /data-hud-value="volume">—<\/span><span data-hud-unit="volume">\/ 10/u);
  assert.match(html, /data-volume-raw>— LU/u);
  assert.match(html, /data-hud-value="pitch">—<\/span><span>\/ 10 vocal variety/u);
  assert.match(html, /data-pitch-raw>— st/u);
});

test('Vocal Variation is continuous, independently toggleable and windowed through full session', async () => {
  const [html, source] = await Promise.all([
    read('public/live-analytics/index.html'),
    read('public/live-analytics/live-analytics.mjs'),
  ]);
  for (const trace of ['volume', 'pitch', 'speed']) assert.match(html, new RegExp(`data-vocal-trace-toggle="${trace}"`, 'u'));
  for (const value of ['30000', '60000', '180000', '300000', 'full']) assert.match(html, new RegExp(`data-vocal-window="${value}"`, 'u'));
  assert.match(source, /vocalVariationWindowMs = 60_000/u);
});

test('left plates are teaching instruments and center retains raw overlay canvases', async () => {
  const [html, css] = await Promise.all([
    read('public/live-analytics/index.html'),
    read('public/live-analytics/live-analytics.css'),
  ]);
  assert.match(css, /founder-face-scanner/u);
  assert.match(html, /data-face-map-region="mouth"/u);
  assert.match(html, /data-body-map-region="left-hand"/u);
  assert.match(html, /id="face-overlay"/u);
  assert.match(html, /id="body-overlay"/u);
  assert.match(html, /id="position-guide"/u);
});

test('claim-safety vocabulary excludes psychological judgments from product HTML', async () => {
  const html = (await read('public/live-analytics/index.html')).toLowerCase();
  for (const forbidden of ['genuine smile', 'honesty score', 'personality score', 'emotion score', 'confidence score']) {
    assert.equal(html.includes(forbidden), false);
  }
});
