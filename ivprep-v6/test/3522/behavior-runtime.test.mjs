import test from 'node:test';
import assert from 'node:assert/strict';
import { BehaviorIntelligenceRuntime } from '../../public/live-analytics/behavior-intelligence-runtime.mjs';
import { buildPostAnswerCard, PostAnswerStore } from '../../public/live-analytics/post-answer-store.mjs';
import { readFile } from 'node:fs/promises';

const audio = (atMs, speaking, overrides = {}) => ({
  modality: 'audio',
  atMs,
  available: true,
  rms: speaking ? 0.08 : 0.001,
  clippedFraction: 0,
  captureMethod: 'AUDIO_WORKLET_PCM',
  vad: {
    available: true,
    speaking,
    probability: speaking ? 0.9 : 0.05,
    provenance: { source: 'SILERO_V5', method: 'LOCAL_ONNX_AUDIOWORKLET' },
  },
  loudness: { available: speaking, speechLufsK: -24, provenance: { method: 'BS1770_K_WEIGHTING_48K' } },
  estimatedSyllableRate: { available: speaking, tier: 'D', estimatedSyllablesPerMinute: speaking ? 180 : null },
  ...overrides,
});

const vision = (atMs, yawDeg = 0) => ({
  modality: 'vision',
  atMs,
  primaryLock: { state: 'PRIMARY_LOCKED' },
  geometry: {
    face: {
      present: true,
      box: { width: 0.3, height: 0.28, centerX: 0.5, centerY: 0.4 },
      yawDeg,
      pitchDeg: 0,
      headPoseMethod: 'FACIAL_TRANSFORMATION_MATRIX',
    },
    pose: { shoulderWidth: 0.3, centerX: 0.5, centerY: 0.5 },
    hands: {
      left: { present: true, centerX: 0.35, centerY: 0.6 },
      right: { present: true, centerX: 0.65, centerY: 0.6 },
    },
  },
});

test('behavior runtime gates setup then state-tags answering, pause, orientation, and Tier D estimate', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.beginInterview(0);
  for (let atMs = 0; atMs <= 500; atMs += 100) {
    runtime.ingestDiagnostic(vision(atMs));
    runtime.ingestDiagnostic(audio(atMs, false));
  }
  for (let atMs = 600; atMs <= 3_800; atMs += 100) {
    runtime.ingestDiagnostic(vision(atMs));
    runtime.ingestDiagnostic(audio(atMs, true));
  }
  assert.equal(runtime.latest.setup.ready, true);
  assert.equal(runtime.latest.conversation.state, 'ANSWERING');
  assert.equal(runtime.latest.audio.captureMethod, 'AUDIO_WORKLET_PCM');
  assert.equal(runtime.latest.audio.estimatedSyllableRate.tier, 'D');
  runtime.ingestDiagnostic(audio(3_900, false));
  assert.equal(runtime.latest.conversation.state, 'PAUSE_SHORT');
  for (let atMs = 5_000; atMs <= 5_800; atMs += 100) runtime.ingestDiagnostic(vision(atMs, 35));
  assert.equal(runtime.latest.orientation.orientation, 'AWAY');
  assert.equal(runtime.latest.orientation.state, 'PAUSE_LONG');
});

test('explicit analytics start establishes listening immediately and independent voiced F0 can begin answering', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.beginInterview(0, { explicitMeasurementStart: true });
  assert.equal(runtime.latest.conversation.state, 'LISTENING');
  runtime.ingestDiagnostic(audio(100, false, {
    speaking: false,
    pitch: { voiced: true, f0Hz: 150, summary: { available: true, medianHz: 150 } },
  }));
  assert.equal(runtime.latest.audio.speaking, true);
  assert.equal(runtime.latest.conversation.state, 'ANSWERING');
  runtime.ingestDiagnostic(vision(200));
  assert.equal(runtime.latest.conversation.state, 'ANSWERING');
});

test('cross-modality observations cannot regress the live conversation clock', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.beginInterview(0, { explicitMeasurementStart: true });
  runtime.ingestDiagnostic(audio(220, true));
  assert.equal(runtime.latest.conversation.state, 'ANSWERING');
  assert.doesNotThrow(() => runtime.ingestDiagnostic(vision(180)));
  assert.equal(runtime.latest.conversation.state, 'ANSWERING');
  runtime.ingestDiagnostic(audio(260, false));
  assert.equal(runtime.latest.conversation.state, 'PAUSE_SHORT');
  assert.doesNotThrow(() => runtime.ingestDiagnostic(vision(240)));
  assert.equal(runtime.latest.conversation.state, 'PAUSE_SHORT');
});

test('standalone behavior runtime admits listening nod evidence at the production 8 FPS floor', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.beginInterview(0, { explicitMeasurementStart: true });
  for (let index = 0; index < 10; index += 1) {
    runtime.ingestDiagnostic({ ...vision(index * 125), targetFps: 8 });
  }
  runtime.ingestDiagnostic({ ...vision(1_250), targetFps: 8, geometry: {
    ...vision(1_250).geometry,
    face: { ...vision(1_250).geometry.face, pitchDeg: 9 },
  } });
  runtime.ingestDiagnostic({ ...vision(1_375), targetFps: 8 });
  assert.equal(runtime.latest.nod.available, true);
  assert.equal(runtime.latest.nod.count, 1);
});

test('standalone gesture unit survives a bounded natural VAD gap inside an answer', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.beginInterview(0, { explicitMeasurementStart: true });
  const handFrame = (atMs, leftX) => ({
    ...vision(atMs),
    geometry: {
      ...vision(atMs).geometry,
      hands: {
        left: { present: true, centerX: leftX, centerY: 0.6 },
        right: { present: false },
      },
    },
  });
  for (let atMs = 0; atMs <= 1_000; atMs += 125) runtime.ingestDiagnostic(handFrame(atMs, 0.35));
  runtime.ingestDiagnostic(audio(1_100, true));
  runtime.ingestDiagnostic(handFrame(1_125, 0.35));
  runtime.ingestDiagnostic(audio(1_200, false));
  assert.equal(runtime.latest.conversation.state, 'PAUSE_SHORT');
  runtime.ingestDiagnostic(handFrame(1_250, 0.55));
  runtime.ingestDiagnostic(handFrame(1_375, 0.75));
  runtime.ingestDiagnostic(audio(1_425, true));
  runtime.ingestDiagnostic(handFrame(1_500, 0.75));
  runtime.ingestDiagnostic(handFrame(2_050, 0.75));
  assert.equal(runtime.latest.gesture.eventCount, 1);
  assert.equal(runtime.latest.gesture.event.type, 'GESTURE_UNIT');
});

test('WPM stays unavailable without observed per-word timestamps even when aggregate counts exist', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.ingestWordTiming({
    atMs: 10_000,
    windowStartedAtMs: 0,
    windowEndedAtMs: 10_000,
    wordCount: 25,
    provenance: { observed: true, source: 'LOCAL_TIMED_TRANSCRIPT' },
  });
  assert.equal(runtime.latest.wordTiming.available, false);
  assert.equal(runtime.latest.wordTiming.wordsPerMinute, null);
  assert.equal(runtime.latest.wordTiming.missingDependency, 'APPROVED_LOCAL_TRANSCRIBER_WITH_WORD_TIMESTAMPS');
});

test('observed word timestamps unlock genuine WPM and never retain transcript text', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.ingestWordTiming({
    atMs: 10_000,
    windowStartedAtMs: 0,
    windowEndedAtMs: 10_000,
    wordCount: 25,
    words: Array.from({ length: 25 }, (_, index) => ({ startMs: index * 380, endMs: index * 380 + 180, probability: 0.9 })),
    speechDurationMs: 8_000,
    coverage: 0.85,
    transcript: 'must be ignored',
    provenance: { observed: true, wordTimestampsObserved: true, timingAccuracyValidated: false, tier: 'B', source: 'LOCAL_TIMED_TRANSCRIPT' },
  });
  assert.equal(runtime.latest.wordTiming.wordsPerMinute, 150);
  assert.doesNotMatch(JSON.stringify(runtime.latest), /must be ignored/u);
});

test('orientation fuses observable eye-look proxy with head pose without claiming eye contact', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  const frame = vision(0, 0);
  frame.faceFamily = { 'FACE.GAZE': { availability: 'AVAILABLE', horizontal: 0.8, vertical: 0 } };
  for (let atMs = 0; atMs <= 1_000; atMs += 200) runtime.ingestDiagnostic({ ...frame, atMs });
  assert.equal(runtime.latest.orientation.provenance, 'FUSED_HEAD_POSE_EYELOOK_PROXY');
  assert.doesNotMatch(JSON.stringify(runtime.latest.orientation), /eye.?contact/iu);
});

test('simulation mode suppresses live coaching while drill mode remains bounded', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.setCoachingMode('SIMULATION');
  assert.equal(runtime.latest.coachingMode, 'SIMULATION');
  assert.equal(runtime.latest.cue, null);
  runtime.setCoachingMode('DRILL');
  assert.equal(runtime.latest.coachingMode, 'DRILL');
});

test('notes state is explicit Tier 0 input and never inferred from movement', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.conversation.dispatch('SETUP_READY', 1);
  runtime.setNotesActive(true, 2);
  assert.equal(runtime.latest.conversation.state, 'NOTES');
  assert.equal(runtime.latest.notes.active, true);
  assert.equal(runtime.latest.notes.claimBoundary, 'EXPLICIT_CONTROL_NOT_INFERRED_BEHAVIOR');
  runtime.setNotesActive(false, 3);
  assert.equal(runtime.latest.notes.active, false);
});

test('finish retains the existing derived analytics result without raw payloads', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  const retained = runtime.finish({
    answerId: 'answer-derived', endedAtMs: 1_000,
    analyticsResult: { score: 0.7, rawAudio: [1, 2, 3], transcript: 'private' },
  });
  assert.equal(retained.analyticsResult.score, 0.7);
  assert.equal('rawAudio' in retained.analyticsResult, false);
  assert.equal('transcript' in retained.analyticsResult, false);
});

test('post-answer export retains only derived bounded envelopes', () => {
  const store = new PostAnswerStore({ maximumAnswers: 1 });
  const retained = store.retain({
    answerId: 'answer-1',
    startedAtMs: 0,
    endedAtMs: 5_000,
    metrics: { volume: { speechLufsK: -24 }, rawPcmSamples: [1, 2, 3] },
    transcript: 'private words',
  });
  assert.equal(retained.rawMediaRetained, false);
  const exported = store.exportJson();
  assert.match(exported, /speechLufsK/u);
  assert.doesNotMatch(exported, /rawPcm|private words/u);
  store.retain({ answerId: 'answer-2', startedAtMs: 0, endedAtMs: 1_000 });
  assert.equal(store.exportObject().answers.length, 1);
});

test('post-answer card is derived-only, bounded to 10–20 seconds, and never fabricates structure analysis', () => {
  const card = buildPostAnswerCard({
    durationMs: 8_500,
    behavior: {
      setup: { ready: true },
      wordTiming: { available: true, wordsPerMinute: 152, deliverySpeed: { zone: 'IN_RANGE' } },
      turnMetrics: { longPauseCount: 0 },
    },
  }, { displayMs: 99_000 });
  assert.equal(card.displayMs, 20_000);
  assert.equal(card.items.length, 2);
  assert.match(card.items[0].text, /Observed private word timing estimated/u);
  assert.equal(card.items[1].kind, 'unavailable');
  assert.match(card.items[1].text, /no validated content-analysis source/u);
  assert.equal(card.replay.available, false);
  assert.equal(card.rawMediaRetained, false);
});

test('first-party interviewer events replace fabricated response-latency boundaries', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.conversation.dispatch('SETUP_READY', 1);
  runtime.interviewerTurnStarted({ atMs: 100, questionId: 'q1', source: 'QUESTION_ENGINE' });
  assert.equal(runtime.latest.conversation.state, 'LISTENING');
  runtime.interviewerTurnEnded({ atMs: 1_000, questionId: 'q1' });
  runtime.ingestDiagnostic(audio(1_800, true));
  assert.equal(runtime.latest.turnMetrics.responseLatencyMs, 800);
  assert.equal(runtime.latest.interviewerChannel.source, 'QUESTION_ENGINE');
});

test('Admin LAB targets change coaching corridors without changing measurements', () => {
  const runtime = new BehaviorIntelligenceRuntime({ now: () => 0 });
  runtime.setBaseline({ wordsPerMinute: 150, speechLufsK: -24 });
  const wordTimingBefore = runtime.latest.wordTiming;
  runtime.setCoachingTargets({
    wordsPerMinute: { minimum: 135, maximum: 175 },
    loudnessHalfWidthLu: 4,
  }, { editorRole: 'ADMIN', atMs: 500 });
  assert.deepEqual(runtime.latest.corridors.wordsPerMinute, {
    minimum: 135, maximum: 175, basis: 'ADMIN_SESSION_TARGET',
  });
  assert.deepEqual(runtime.latest.corridors.loudnessLufsK, {
    minimum: -28, maximum: -20, basis: 'ADMIN_SESSION_TARGET',
  });
  assert.equal(runtime.latest.wordTiming, wordTimingBefore);
  assert.equal(runtime.latest.coachingTargetAudit.measurementChanged, false);
  assert.throws(() => runtime.setCoachingTargets({
    wordsPerMinute: { minimum: 80, maximum: 240 },
  }), /110–210 WPM/u);
});

test('Founder runtime wires behavior state, unprocessed capture requests, local export, and post-answer card', async () => {
  const source = await readFile(new URL('../../public/live-analytics/live-analytics.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../../public/live-analytics/index.html', import.meta.url), 'utf8');
  assert.match(source, /new BehaviorIntelligenceRuntime\(\)/u);
  assert.match(source, /echoCancellation: false/u);
  assert.match(source, /noiseSuppression: false/u);
  assert.match(source, /autoGainControl: false/u);
  assert.match(source, /behavior\.ingestDiagnostic/u);
  assert.match(source, /behavior\.finish/u);
  assert.match(source, /ivprep:interviewer-turn-started/u);
  assert.match(source, /buildPostAnswerCard/u);
  const pipeline = await readFile(new URL('../../public/analytics/browser-pipeline.mjs', import.meta.url), 'utf8');
  assert.match(pipeline, /faceFamily\.reset\(\)/u);
  assert.doesNotMatch(pipeline, /faceFamily\.reset\(\)\.beginBaseline\(\)/u);
  assert.match(pipeline, /setPersonalCalibration/u);
  assert.match(pipeline, /freezeCalibrationBaseline\(values\.pitchMedianHz\)/u);
  assert.match(html, /id="post-answer-card"/u);
  assert.match(html, /id="export-derived-answer"/u);
  assert.match(html, /id="track-post-answer-goal"/u);
  assert.match(html, /id="replay-answer" disabled/u);
  assert.match(html, /id="toggle-diagnostics"[^>]* hidden/u);
  assert.match(html, /id="admin-lab-controls" hidden/u);
  assert.match(html, /Targets change coaching corridors only; measurement is immutable/u);
  assert.equal((html.match(/id="live-video"/gu) || []).length, 1);
  assert.match(html, /id="notes-state-control"/u);
  assert.match(html, /Camera movement is never used to infer note-taking/u);
});
