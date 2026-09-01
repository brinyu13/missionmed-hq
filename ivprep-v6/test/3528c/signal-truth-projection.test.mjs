import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function loadRuntimeModule() {
  const url = new URL('../../public/ivoc-standalone/app/real-runtime.mjs', import.meta.url);
  const source = (await readFile(url, 'utf8')).replace(/^import .*;\n/gmu, '');
  const prelude = `
    const COACHING_CONFIG = {
      face: { smileQualityMaximumPoseDegrees: 30, smileQualityMinimumFaceFraction: 0.15 },
      varietyScale: { minimumVoicedFrames: 8 },
    };
    export const __testCalibration = {
      paceCorridor: [140, 175], volumeCorridorLu: [-6, 6], gestureCorridor: [6, 14],
    };
    const CALIBRATION = __testCalibration;
  `;
  return import(`data:text/javascript;base64,${Buffer.from(prelude + source).toString('base64')}`);
}

function bareEngine(RealAnalyticsEngine) {
  const engine = Object.create(RealAnalyticsEngine.prototype);
  Object.assign(engine, {
    t: 1_000,
    latestAudioSpeaking: false,
    wordTimingState: { reason: 'WAITING_FOR_TIMED_WORDS' },
    faceBaselineState: { capturing: false, available: false, reason: 'WAITING_FOR_ADMITTED_FACE', admittedFrames: 0, startedAtMs: null, attempts: 0 },
    history: [],
    lastHistoryAt: -Infinity,
  });
  return engine;
}

function snapshot(overrides = {}) {
  return {
    metrics: {
      SPEED_WPM: {},
      VOLUME: {},
      VOLUME_MODULATION: {},
      PITCH: {},
      HEAD_FACE: {},
      BODY_HANDS: {},
      ...overrides,
    },
  };
}

const behavior = ({ state = 'LISTENING', loudness = null } = {}) => ({
  conversation: { state },
  corridors: { loudnessLufsK: loudness },
});

function admittedFace(atMs, overrides = {}) {
  return {
    modality: 'vision',
    atMs,
    primaryLock: { state: 'PRIMARY_LOCKED' },
    geometry: {
      face: {
        present: true,
        box: { height: 0.25 },
        yawDeg: 0,
        pitchDeg: 0,
        ...overrides,
      },
    },
  };
}

test('volume keeps raw dBFS visible but gates coaching on speech and a personal LUFS corridor', async () => {
  const { RealAnalyticsEngine, __testCalibration } = await loadRuntimeModule();
  const engine = bareEngine(RealAnalyticsEngine);
  const dbfsOnly = snapshot({ VOLUME: { available: true, dbfs: -30, normalized: 0.5 } });

  let frame = engine.mapFrame(dbfsOnly, behavior());
  assert.equal(frame.volume.available, true);
  assert.equal(frame.volume.scientificUnit, 'dBFS');
  assert.equal(frame.volume.rawBasis, 'UNCALIBRATED_DEVICE_DBFS');
  assert.equal(frame.volume.coachingAvailable, false);
  assert.equal(frame.volume.score, null);
  assert.equal(frame.volume.cue, null);
  assert.equal(frame.volume.corridor, null);

  engine.latestAudioSpeaking = true;
  frame = engine.mapFrame(dbfsOnly, behavior({ state: 'ANSWERING' }));
  assert.equal(frame.volume.available, true);
  assert.equal(frame.volume.coachingAvailable, false, 'voiced dBFS remains an uncalibrated raw observation');
  assert.equal(frame.volume.score, null);

  const calibrated = snapshot({ VOLUME: { available: true, dbfs: -26, speechLufsK: -22, normalized: 0.55 } });
  frame = engine.mapFrame(calibrated, behavior({ state: 'ANSWERING', loudness: { minimum: -30, maximum: -18 } }));
  assert.equal(frame.volume.coachingAvailable, true);
  assert.deepEqual(frame.volume.corridor, [-30, -18]);
  assert(Number.isFinite(frame.volume.score));

  __testCalibration.volumeCorridorLu.splice(0, 2, -4, 5);
  frame = engine.mapFrame(calibrated, behavior({ state: 'ANSWERING', loudness: { minimum: -30, maximum: -18 } }));
  assert.deepEqual(frame.volume.corridor, [-28, -19], 'live calibration offsets update the next projected frame');
});

test('volume flight history contains speech only', async () => {
  const { RealAnalyticsEngine } = await loadRuntimeModule();
  const engine = bareEngine(RealAnalyticsEngine);
  const level = snapshot({ VOLUME: { available: true, dbfs: -30, normalized: 0.5 } });

  let frame = engine.mapFrame(level, behavior());
  engine.recordHistory(frame, true);
  assert.equal(engine.history[0].vol, null);

  engine.t = 2_000;
  engine.latestAudioSpeaking = true;
  frame = engine.mapFrame(level, behavior({ state: 'ANSWERING' }));
  engine.recordHistory(frame, true);
  assert.equal(engine.history[1].vol, 0.5);
});

test('qualified gesture count is immediate while gesture rate remains immature', async () => {
  const { RealAnalyticsEngine } = await loadRuntimeModule();
  const engine = bareEngine(RealAnalyticsEngine);
  engine.latestAudioSpeaking = true;
  const frame = engine.mapFrame(snapshot({
    BODY_HANDS: {
      hands: { left: { present: true }, right: { present: false }, bothPresent: false },
      gestureUnits: {
        eventCount: 1,
        rateAvailable: false,
        unitsPerSpeakingMinute: null,
        rateUnavailableReason: 'INSUFFICIENT_SPEAKING_TIME',
      },
      gestureEvents: { count: 3 },
    },
  }), behavior({ state: 'ANSWERING' }));

  assert.equal(frame.bodyHands.gesturesAvailable, true);
  assert.equal(frame.bodyHands.gestures, 1);
  assert.equal(frame.bodyHands.rawGestureActivityCount, 3);
  assert.equal(frame.bodyHands.gestureRateAvailable, false);
  assert.equal(frame.bodyHands.gestureRate, null);
});

test('hand absence is reported only after the hand channel is available', async () => {
  const { RealAnalyticsEngine } = await loadRuntimeModule();
  const engine = bareEngine(RealAnalyticsEngine);

  let frame = engine.mapFrame(snapshot({
    BODY_HANDS: {
      available: false,
      hands: { available: false },
    },
  }), behavior());
  assert.equal(frame.bodyHands.handsAvailable, false);
  assert.equal(frame.bodyHands.visibility, 'UNAVAILABLE');
  assert.equal(frame.bodyHands.handCount, null);
  assert.equal(frame.bodyHands.handsVisible, null);
  assert.equal(frame.bodyHands.bothHandsVisible, null);

  frame = engine.mapFrame(snapshot({
    BODY_HANDS: {
      available: true,
      hands: {
        available: true,
        left: { present: false },
        right: { present: false },
        bothPresent: false,
      },
    },
  }), behavior());
  assert.equal(frame.bodyHands.handsAvailable, true);
  assert.equal(frame.bodyHands.visibility, 'NONE');
  assert.equal(frame.bodyHands.handCount, 0);
  assert.equal(frame.bodyHands.handsVisible, false);
  assert.equal(frame.bodyHands.bothHandsVisible, false);
});

test('face baseline begins on admitted frames, rejects broken runs, and retries to measured availability', async () => {
  const { RealAnalyticsEngine } = await loadRuntimeModule();
  const engine = bareEngine(RealAnalyticsEngine);
  let begins = 0;
  let ends = 0;
  let clears = 0;
  engine.pipeline = {
    beginPersonalFaceBaseline() {
      begins += 1;
      return { capturing: true, available: false, reason: 'CAPTURING_PERSONAL_FACE_BASELINE' };
    },
    endPersonalFaceBaseline() {
      ends += 1;
      return { capturing: false, available: true, reason: null };
    },
    faceFamily: { clearPersonalBaseline() { clears += 1; } },
  };

  assert.equal(engine.advanceFaceBaseline({ modality: 'vision', atMs: 0, primaryLock: { state: 'SEARCHING' } }).capturing, false);
  assert.equal(begins, 0);
  assert.equal(engine.advanceFaceBaseline(admittedFace(0)).capturing, true);
  assert.equal(begins, 1);

  const rejected = admittedFace(125, { present: false });
  assert.equal(engine.advanceFaceBaseline(rejected).reason, 'FACE_BASELINE_FRAME_REJECTED_RETRY');
  assert.equal(ends, 1);
  assert.equal(clears, 1);

  assert.equal(engine.advanceFaceBaseline(admittedFace(1_000)).capturing, true);
  assert.equal(begins, 2);
  for (let atMs = 1_125; atMs <= 4_000; atMs += 125) engine.advanceFaceBaseline(admittedFace(atMs));
  assert.equal(engine.faceBaselineState.available, true);
  assert.equal(engine.faceBaselineState.capturing, false);
  assert.equal(engine.faceBaselineState.attempts, 2);
  assert.equal(ends, 2);
});
