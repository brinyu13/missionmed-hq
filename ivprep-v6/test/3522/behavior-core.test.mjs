import test from 'node:test';
import assert from 'node:assert/strict';

import { COACHING_CONFIG, derivePersonalCorridors } from '../../public/analytics/coaching-config.mjs';
import { metricEnvelope, unavailableMetric } from '../../public/analytics/metric-contract.mjs';
import { ConversationStateMachine } from '../../public/analytics/conversation-state.mjs';
import { SileroVadLane, VadHysteresis } from '../../public/analytics/vad-silero.mjs';
import { classifyOrientation, OrientationTracker } from '../../public/analytics/orientation-state.mjs';
import { FacialActivityTracker } from '../../public/analytics/facial-activity.mjs';
import { deriveDeliverySpeed, evaluateWordTiming } from '../../public/analytics/word-timing-ladder.mjs';
import { GestureUnitDetector } from '../../public/analytics/gesture-units.mjs';
import { TurnMetrics } from '../../public/analytics/turn-metrics.mjs';
import { NodDetector } from '../../public/analytics/nod-detector.mjs';
import { EstimatedSyllableRate } from '../../public/analytics/syllable-rate.mjs';
import { BaselineStore } from '../../public/live-analytics/baseline-store.mjs';
import { SetupReadinessGate } from '../../public/live-analytics/setup-readiness.mjs';
import { CueArbiter } from '../../public/live-analytics/cue-arbiter.mjs';
import { CalibrationSession } from '../../public/analytics/calibration-session.mjs';

test('3522C keeps calibratable thresholds in one frozen config and derives personal corridors', () => {
  assert.equal(COACHING_CONFIG.calibrationStatus, 'CALIBRATE');
  assert(Object.isFrozen(COACHING_CONFIG.audio));
  const corridors = derivePersonalCorridors({ speechLufsK: -24, pitchMedianHz: 120, wordsPerMinute: 150 });
  assert.deepEqual(corridors.loudnessLufsK, { minimum: -30, maximum: -18, basis: 'PERSONAL_CALIBRATION' });
  assert.equal(corridors.wordsPerMinute.minimum, 138);
  assert.equal(corridors.wordsPerMinute.maximum, 165);
  assert(corridors.pitchHz.minimum < 120 && corridors.pitchHz.maximum > 120);
});

test('metric contract requires state, window, confidence, and provenance and suppresses unavailable numerics', () => {
  const metric = metricEnvelope({
    state: 'ANSWERING', startMs: 10, endMs: 20, confidence: 'HIGH',
    provenance: { source: 'MICROPHONE', method: 'LOCAL_DSP' }, values: { lufsK: -23.4 },
  });
  assert.equal(metric.lufsK, -23.4);
  assert.deepEqual([metric.state, metric.startMs, metric.endMs, metric.confidence], ['ANSWERING', 10, 20, 'HIGH']);
  const missing = unavailableMetric('NO_VOICED_F0', {
    state: 'ANSWERING', startMs: 10, endMs: 20,
    provenance: { source: 'MICROPHONE', method: 'YIN_F0' },
  });
  assert.equal(missing.available, false);
  assert.equal(missing.reason, 'NO_VOICED_F0');
  assert.throws(() => metricEnvelope({
    available: false, state: 'ANSWERING', startMs: 0, endMs: 1, confidence: 'UNAVAILABLE',
    provenance: { source: 'MICROPHONE', method: 'LOCAL_DSP' }, values: { value: 0 },
  }), /must not carry numeric/);
});

test('conversation state machine preserves transitions, pauses, and overlap without inferring intent', () => {
  const machine = new ConversationStateMachine({ now: () => 0 });
  assert.equal(machine.dispatch('SETUP_READY', 100).state, 'LISTENING');
  assert.equal(machine.dispatch('INTERVIEWER_SPEECH_END', 200).state, 'TRANSITION_TO_ANSWER');
  assert.equal(machine.dispatch('USER_SPEECH_START', 350).state, 'ANSWERING');
  assert.equal(machine.dispatch('INTERVIEWER_SPEECH_START', 400).overlap, true);
  assert.equal(machine.dispatch('USER_SPEECH_END', 900).state, 'PAUSE');
  assert.equal(machine.dispatch('USER_SPEECH_RESUME', 1_200).state, 'ANSWERING');
  assert.equal(machine.dispatch('ANSWER_END', 2_000).state, 'TRANSITION_TO_LISTENING');
  assert.equal(machine.dispatch('INTERVIEWER_TURN_READY', 2_100).state, 'LISTENING');
  assert(machine.history.length >= 6);
});

test('Silero probability hysteresis requires dwell and redemption', () => {
  const vad = new VadHysteresis({ minimumSpeechMs: 200, redemptionMs: 300 });
  assert.equal(vad.ingest({ atMs: 0, speechProbability: 0.8 }).speaking, false);
  const on = vad.ingest({ atMs: 200, speechProbability: 0.8 });
  assert.equal(on.speaking, true);
  assert.equal(on.event.type, 'SPEECH_START');
  assert.equal(vad.ingest({ atMs: 300, speechProbability: 0.1 }).speaking, true);
  const off = vad.ingest({ atMs: 600, speechProbability: 0.1 });
  assert.equal(off.speaking, false);
  assert.equal(off.event.type, 'SPEECH_END');
});

test('Silero lane uses v5, a local AudioWorklet, the admitted stream, and no provider', async () => {
  let options;
  const instance = { start: async () => {}, pause: async () => {}, destroy: async () => {} };
  const lane = new SileroVadLane({
    vadGlobal: { MicVAD: { new: async (value) => { options = value; return instance; } } },
    onFrame: () => {},
  });
  const stream = { id: 'admitted-stream' };
  const audioContext = { currentTime: 0 };
  await lane.start({ stream, audioContext });
  assert.equal(options.model, 'v5');
  assert.equal(options.processorType, 'AudioWorklet');
  assert.equal(options.startOnLoad, false);
  assert.equal(await options.getStream(), stream);
  assert.match(options.baseAssetPath, /^\/iv-prep-on-call\/assets\/vendor\//);
  assert.doesNotMatch(options.baseAssetPath, /^https?:/u);
  await lane.stop();
});

test('setup gate requires real speech-over-noise and an admitted centered face', () => {
  const gate = new SetupReadinessGate();
  gate.ingestAudio({ available: true, speechMs: 3_100, noiseFloorDb: -55, speechLevelDb: -28, clippedFraction: 0, processing: { actual: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } } });
  const ready = gate.ingestVideo({ facePresent: true, faceFraction: 0.28, centerX: 0.5, centerY: 0.4, headPitchDegrees: 2, confidence: 0.9 });
  assert.equal(ready.ready, true);
  assert.equal(ready.audioProcessing, 'UNPROCESSED');
  const clipped = gate.ingestAudio({ available: true, speechMs: 3_100, noiseFloorDb: -55, speechLevelDb: -2, clippedFraction: 0.02 });
  assert.equal(clipped.ready, false);
  assert(clipped.reasons.includes('CHECK_MIC_CLIPPING'));
});

test('setup gate reports processed devices and one claim-safe framing correction', () => {
  const gate = new SetupReadinessGate();
  gate.ingestAudio({ available: true, speechMs: 3_100, noiseFloorDb: -55, speechLevelDb: -25, clippedFraction: 0, processing: { actual: { autoGainControl: true } } });
  const result = gate.ingestVideo({ facePresent: true, faceFraction: 0.45, centerX: 0.7, centerY: 0.4, headPitchDegrees: 12, confidence: 0.9 });
  assert.equal(result.audioProcessing, 'PROCESSED');
  assert.equal(result.correction, 'MOVE_BACK');
  assert.deepEqual(result.reasons.slice(0, 3), ['MOVE_BACK', 'RE_CENTER', 'RAISE_CAMERA_TO_EYE_LEVEL']);
});

test('turn metrics reproduce response latency and two long pauses on the session clock', () => {
  const turns = new TurnMetrics();
  turns.ingest('INTERVIEWER_SPEECH_END', 1_000, { state: 'TRANSITION_TO_ANSWER' });
  turns.ingest('USER_SPEECH_START', 1_800, { state: 'ANSWERING' });
  turns.ingest('USER_SPEECH_END', 3_000, { state: 'PAUSE' });
  turns.ingest('USER_SPEECH_RESUME', 5_000, { state: 'ANSWERING' });
  turns.ingest('USER_SPEECH_END', 7_000, { state: 'PAUSE' });
  const result = turns.ingest('USER_SPEECH_RESUME', 9_000, { state: 'ANSWERING' });
  assert.equal(result.responseLatencyMs, 800);
  assert.equal(result.pauseCount, 2);
  assert.equal(result.longPauseCount, 2);
  assert.equal(result.p90PauseMs, 2_000);
});

test('nod detector is frame-rate and listening-state gated and makes no agreement claim', () => {
  const detector = new NodDetector({ excursionDegrees: 5 });
  for (let index = 0; index < 10; index += 1) detector.ingest({ atMs: index * 50, pitchDegrees: 0, state: 'LISTENING', targetFps: 15, confidence: 0.9 });
  detector.ingest({ atMs: 550, pitchDegrees: 9, state: 'LISTENING', targetFps: 15, confidence: 0.9 });
  const event = detector.ingest({ atMs: 700, pitchDegrees: 0, state: 'LISTENING', targetFps: 15, confidence: 0.9 });
  assert.equal(event.count, 1);
  assert.equal(event.event.type, 'HEAD_PITCH_CYCLE');
  assert.equal(event.clusterCount, 1);
  assert.equal(event.listeningNodsPerMinute, Number((60_000 / event.eligibleListeningMs).toFixed(1)));
  assert.doesNotMatch(JSON.stringify(event), /agreement|engagement|comprehension/iu);
  const lowFps = detector.ingest({ atMs: 800, pitchDegrees: 0, state: 'LISTENING', targetFps: 8, confidence: 0.9 });
  assert.equal(lowFps.available, false);
});

test('nod detector excludes speaking windows from listening rate denominator and count', () => {
  const detector = new NodDetector({ excursionDegrees: 5 });
  for (let index = 0; index < 20; index += 1) detector.ingest({ atMs: index * 50, pitchDegrees: 0, state: 'LISTENING', targetFps: 15, confidence: 0.9 });
  const beforeSpeaking = detector.latest.eligibleListeningMs;
  detector.ingest({ atMs: 1_000, pitchDegrees: 9, state: 'ANSWERING', targetFps: 15, confidence: 0.9 });
  detector.ingest({ atMs: 1_200, pitchDegrees: 0, state: 'ANSWERING', targetFps: 15, confidence: 0.9 });
  assert.equal(detector.latest.count, 0);
  assert.equal(detector.latest.eligibleListeningMs, beforeSpeaking + 50);
});

test('baseline store keeps only derived, versioned, expiring values', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  let now = 10_000;
  const store = new BaselineStore({ storage, now: () => now });
  store.save('wp:1', { speechLufsK: -26 });
  assert.equal(store.load('wp:1').derived.speechLufsK, -26);
  assert.throws(() => store.save('wp:0', { speechLufsK: -25 }), /opaque admitted identifier/);
  assert.throws(() => store.save('short', { speechLufsK: -25 }), /opaque admitted identifier/);
  store.save('student:opaque-123', { speechLufsK: -25, pitchMedianHz: 130 });
  assert.equal(store.load('student:opaque-123').derived.speechLufsK, -25);
  store.save('student:opaque-123', { speechLufsK: -25 }, { deviceProfile: { audio: { sampleRate: 48_000 } } });
  assert.equal(store.load('student:opaque-123', { deviceProfile: { audio: { sampleRate: 44_100 } } }), null);
  const physicalProfile = {
    audio: { sampleRate: 48_000, channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: { width: 1_280, height: 720, frameRate: 30 },
  };
  store.save('student:opaque-123', { speechLufsK: -25 }, { deviceProfile: physicalProfile });
  assert.deepEqual(store.load('student:opaque-123', { deviceProfile: physicalProfile }).deviceProfile, physicalProfile);
  assert.throws(() => store.save('student:opaque-123', { speechLufsK: -25 }, { deviceProfile: { deviceId: 'forbidden' } }), /rejected/);
  assert.throws(() => store.save('student:opaque-123', { rawPcmSamples: [1, 2] }), /rejected/);
  now += (COACHING_CONFIG.baseline.staleAfterDays + 1) * 86_400_000;
  assert.equal(store.load('student:opaque-123'), null);
});

test('two-phase calibration retains only derived scalars and requires enough speech', () => {
  const calibration = new CalibrationSession({ readingDurationMs: 1_000, fingerprintDurationMs: 1_000 });
  for (let atMs = 0; atMs <= 3_500; atMs += 250) {
    calibration.ingestAudio({
      atMs, speaking: true,
      loudness: { speechLufsK: -24 + (atMs % 500 ? 1 : 0), modulationRangeLu: 6 },
      pitch: { medianHz: 135 },
    });
    calibration.ingestVision({
      atMs,
      faceFamily: {
        'FACE.SMILE': { bilateral: 0.12 },
        'FACE.BROW': { magnitude: 0.08 },
        'FACE.PERIOCULAR': { bilateral: 0.06 },
      },
      faceFraction: 0.28,
    });
  }
  const snapshot = calibration.snapshot(3_500);
  assert.equal(snapshot.complete, true);
  assert.equal(snapshot.derived.pitchMedianHz, 135);
  assert.equal(snapshot.rawMediaRetained, false);
  assert.doesNotMatch(JSON.stringify(snapshot), /transcript|landmark|blendshape|pcm/iu);
});

test('orientation is a state-aware observable geometry class with UNKNOWN fallback', () => {
  assert.equal(classifyOrientation({ facePresent: true, yawDegrees: 2, pitchDegrees: 3, confidence: 0.9, state: 'ANSWERING' }).orientation, 'TOWARD_SCREEN');
  assert.equal(classifyOrientation({ facePresent: true, yawDegrees: 1, pitchDegrees: -25, confidence: 0.9, state: 'ANSWERING' }).orientation, 'DOWN');
  assert.equal(classifyOrientation({ facePresent: true, yawDegrees: 33, pitchDegrees: 2, confidence: 0.9, state: 'LISTENING' }).orientation, 'AWAY');
  assert.equal(classifyOrientation({ facePresent: false, yawDegrees: 0, pitchDegrees: 0, confidence: 0.9 }).orientation, 'UNKNOWN');
});

test('rolling orientation withholds single-frame noise and accepts a sustained change', () => {
  const tracker = new OrientationTracker({ config: { ...COACHING_CONFIG.orientation, smoothingFrames: 3, changeDwellMs: 300 } });
  tracker.ingest({ atMs: 0, facePresent: true, yawDegrees: 0, pitchDegrees: 0, confidence: 0.9, state: 'ANSWERING' });
  tracker.ingest({ atMs: 300, facePresent: true, yawDegrees: 0, pitchDegrees: 0, confidence: 0.9, state: 'ANSWERING' });
  assert.equal(tracker.ingest({ atMs: 400, facePresent: true, yawDegrees: 40, pitchDegrees: 0, confidence: 0.9, state: 'ANSWERING' }).orientation, 'TOWARD_SCREEN');
  tracker.ingest({ atMs: 500, facePresent: true, yawDegrees: 40, pitchDegrees: 0, confidence: 0.9, state: 'ANSWERING' });
  tracker.ingest({ atMs: 650, facePresent: true, yawDegrees: 40, pitchDegrees: 0, confidence: 0.9, state: 'ANSWERING' });
  assert.equal(tracker.ingest({ atMs: 850, facePresent: true, yawDegrees: 40, pitchDegrees: 0, confidence: 0.9, state: 'ANSWERING' }).orientation, 'AWAY');
});

test('facial activity is state-split, baseline-relative, derived-only, and claim-safe', () => {
  const tracker = new FacialActivityTracker({ config: { ...COACHING_CONFIG.face, activityMinimumFrames: 3 } });
  const ingest = (atMs, state, value) => tracker.ingest({
    atMs, state, confidence: 0.9,
    channels: { brow: value, mouth: value, periocular: value, yaw: value, pitch: value },
  });
  for (let index = 0; index < 5; index += 1) ingest(index * 100, 'SETUP', index * 0.01);
  let result;
  for (let index = 5; index < 9; index += 1) result = ingest(index * 100, 'ANSWERING', index * 0.04);
  assert.equal(result.available, true);
  assert.equal(result.claimBoundary, 'DESCRIPTIVE_MOVEMENT_ONLY');
  assert(result.activityRelativeToPersonalBaseline > 1);
  assert.doesNotMatch(JSON.stringify(result), /emotion|confidence trait|engagement/iu);
});

test('word timing requires per-word timestamps and Fable minimum evidence', () => {
  const words = Array.from({ length: 20 }, (_, index) => ({ startMs: index * 500, endMs: index * 500 + 250, probability: 0.95 }));
  const measured = evaluateWordTiming({
    windowStartedAtMs: 0, windowEndedAtMs: 10_000, speechDurationMs: 8_000, coverage: 0.9,
    wordCount: 20, words,
    provenance: { tier: 'B', observed: true, wordTimestampsObserved: true, timingAccuracyValidated: false, source: 'LOCAL_SIDECAR' },
  });
  assert.equal(measured.wordsPerMinute, 120);
  assert.equal(measured.articulationWordsPerMinute, 150);
  assert.equal(measured.deliverySpeed.presentationOnly, true);
  assert.equal(evaluateWordTiming({
    windowStartedAtMs: 0, windowEndedAtMs: 3_000, speechDurationMs: 3_000, coverage: 1,
    wordCount: 6, words: words.slice(0, 6),
    provenance: { tier: 'B', observed: true, wordTimestampsObserved: true, timingAccuracyValidated: false },
  }).reason, 'NEED_MORE_TIMED_WORDS');
  assert.equal(evaluateWordTiming({
    windowStartedAtMs: 0, windowEndedAtMs: 10_000, speechDurationMs: 8_000, coverage: 0.9,
    wordCount: 20,
    provenance: { tier: 'B', observed: true, wordTimestampsObserved: true, timingAccuracyValidated: false },
  }).reason, 'PER_WORD_TIMESTAMPS_REQUIRED');
  assert.deepEqual(deriveDeliverySpeed(160, { minimum: 140, maximum: 180 }), {
    score: 75, zone: 'CRUISE', corridor: { minimum: 140, maximum: 180 }, highCap: 240, presentationOnly: true,
  });
});

test('gesture units use shoulder-width velocity, speaking state, and coverage withholding', () => {
  const detector = new GestureUnitDetector({ config: { ...COACHING_CONFIG.gesture, onsetDwellMs: 100, releaseDwellMs: 100, restDwellMs: 500, minimumDurationMs: 150, refractoryMs: 0 } });
  const shoulders = { leftShoulder: { x: 0, y: 0 }, rightShoulder: { x: 1, y: 0 } };
  detector.ingest({ atMs: 0, leftHand: { x: 0, y: 1 }, speaking: true, ...shoulders });
  detector.ingest({ atMs: 500, leftHand: { x: 0, y: 1 }, speaking: true, ...shoulders });
  detector.ingest({ atMs: 1_000, leftHand: { x: 0, y: 1 }, speaking: true, ...shoulders });
  detector.ingest({ atMs: 1_100, leftHand: { x: 0.2, y: 1 }, speaking: true, ...shoulders });
  const moving = detector.ingest({ atMs: 1_250, leftHand: { x: 0.5, y: 1 }, speaking: true, ...shoulders });
  assert.equal(moving.active, true);
  detector.ingest({ atMs: 1_400, leftHand: { x: 0.5, y: 1 }, speaking: true, ...shoulders });
  const released = detector.ingest({ atMs: 1_550, leftHand: { x: 0.5, y: 1 }, speaking: true, ...shoulders });
  assert.equal(released.event.type, 'GESTURE_UNIT');
  assert.equal(released.eventCount, 1);
  assert.equal(released.rateAvailable, true);
  assert(Number.isFinite(released.movementEnergyShoulderWidthsPerSecond));
});

test('cue arbiter emits at most one, suppresses transitions/opening/low coverage, and applies dwell and priority', () => {
  const arbiter = new CueArbiter({ config: { minimumDwellMs: 500, refractoryMs: 5_000, maximumPerMinute: 4, trainingMaximumPerMinute: 8, maximumPerAnswer: 3, answerOpeningSuppressionMs: 1_000 } });
  const candidates = [
    { id: 'volume', active: true, priority: 1, message: 'Raise volume.' },
    { id: 'orientation', active: true, priority: 3, message: 'Return toward screen.' },
  ];
  assert.equal(arbiter.select(candidates, { atMs: 0, state: 'ANSWERING', answerStartedAtMs: 0 }), null);
  assert.equal(arbiter.select(candidates, { atMs: 600, state: 'TRANSITION_TO_ANSWER' }), null);
  assert.equal(arbiter.select(candidates, { atMs: 1_100, state: 'ANSWERING', answerStartedAtMs: 0 }), null);
  assert.equal(arbiter.select(candidates, { atMs: 1_700, state: 'ANSWERING', answerStartedAtMs: 0 }).id, 'orientation');
  assert.equal(arbiter.select(candidates, { atMs: 1_800, state: 'ANSWERING', answerStartedAtMs: 0 }), null, 'one cue remains on screen');
  assert.equal(arbiter.select([{ ...candidates[0], confidence: 'LOW' }], { atMs: 4_800, state: 'ANSWERING', answerStartedAtMs: 0 }), null);
});

test('Tier D syllable estimate never presents itself as WPM', () => {
  const rate = new EstimatedSyllableRate({ onsetDb: 4, refractoryMs: 100 });
  let result;
  for (let atMs = 0; atMs <= 4_000; atMs += 100) {
    const peak = atMs === 1_000 || atMs === 2_000 || atMs === 3_000 || atMs === 4_000;
    result = rate.ingest({ atMs, db: peak ? -20 : -40, speaking: true });
  }
  assert.equal(result.available, true);
  assert.equal(result.label, 'ESTIMATED SYLLABLE RATE');
  assert.equal(result.tier, 'D');
  assert.equal('wordsPerMinute' in result, false);
});
