import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  LIVE_METRIC_IDS,
  LiveMetricProjector,
  OBSERVED_TRANSCRIPT_TIMING_SOURCES,
  UNSUPPORTED_LIVE_CLAIMS,
  rmsToDbfs,
} from '../../public/live-analytics/live-metric-projector.mjs';

const timedWords = (count, { startMs = 0, spacingMs = 500, durationMs = 250 } = {}) => Array.from(
  { length: count },
  (_, index) => ({ startMs: startMs + index * spacingMs, endMs: startMs + index * spacingMs + durationMs, probability: 0.95 }),
);

const audio = (overrides = {}) => ({
  modality: 'audio',
  atMs: 1_000,
  rms: 0.1,
  peak: 0.2,
  clippedFraction: 0,
  speaking: true,
  pitch: {
    voiced: false,
    f0Hz: null,
    summary: { available: false, reason: 'INSUFFICIENT_VOICED_AUDIO' },
  },
  ...overrides,
});

const vision = (overrides = {}) => ({
  modality: 'vision',
  atMs: 2_000,
  primaryLock: {
    state: 'PRIMARY_LOCKED',
    bystanderCount: 0,
    selectionRequired: false,
  },
  geometry: {
    primaryAssociated: true,
    face: {
      present: true,
      box: { left: 0.35, top: 0.2, width: 0.3, height: 0.45, centerX: 0.5, centerY: 0.425 },
      yawProxyDeg: 7,
      pitchProxyDeg: -3,
      rollProxyDeg: 2,
    },
    pose: {
      torsoPresent: true,
      shoulderWidth: 0.3,
      centerX: 0.51,
      centerY: 0.48,
      lateralLeanDeg: 1.5,
    },
    hands: {
      left: { present: true, centerX: 0.35, centerY: 0.62, zone: 'chest' },
      right: { present: false, zone: 'unresolved' },
    },
  },
  faceFamily: {
    available: true,
    'FACE.SMILE': { availability: 'AVAILABLE', active: true, bilateral: 0.42, symmetry: 0.91 },
    'FACE.BLINK': { availability: 'AVAILABLE', closing: false, count: 2 },
    'FACE.BROW': { availability: 'PARTIAL', active: true, magnitude: 0.31 },
    'FACE.PERIOCULAR': { availability: 'AVAILABLE', active: false, bilateral: 0.08 },
    'FACE.GAZE': {
      availability: 'AVAILABLE', horizontal: 0.05, vertical: -0.03,
      offCentreMagnitude: 0.05, cameraFacing: true,
    },
  },
  live: {
    gestureActive: 'left',
    headTurnActive: false,
    postureMovementActive: true,
  },
  ...overrides,
});

test('the projector exposes exactly the six 3521 live presentation metrics', () => {
  assert.deepEqual([...LIVE_METRIC_IDS], [
    'VOLUME', 'SPEED_WPM', 'VOLUME_MODULATION', 'PITCH', 'HEAD_FACE', 'BODY_HANDS',
  ]);
  const snapshot = new LiveMetricProjector().latest;
  assert.deepEqual(Object.keys(snapshot.metrics), [...LIVE_METRIC_IDS]);
  for (const metric of Object.values(snapshot.metrics)) assert.equal(metric.available, false);
  assert.equal(snapshot.metrics.SPEED_WPM.reason, 'NO_TRUSTWORTHY_TRANSCRIPT_TIMING');
  assert.equal(snapshot.clock.basis, 'ANALYTICS_SESSION_MS');
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.metrics));
});

test('volume and modulation project only real mic RMS and keep a bounded envelope history', () => {
  assert.equal(rmsToDbfs(0.1), -20);
  assert.equal(rmsToDbfs(0), -96);
  assert.equal(rmsToDbfs(-1), null);

  const projector = new LiveMetricProjector({ maximumAudioFrames: 12, minimumModulationFrames: 3 });
  const levels = [0.02, 0.04, 0.08, 0.16];
  for (let index = 0; index < 20; index += 1) {
    projector.ingest(audio({ atMs: 1_000 + index * 50, rms: levels[index % levels.length] }));
  }

  const { VOLUME, VOLUME_MODULATION } = projector.latest.metrics;
  assert.equal(VOLUME.available, true);
  assert.equal(VOLUME.source, 'MIC_RMS');
  assert.equal(VOLUME.state, 'UNKNOWN');
  assert.equal(VOLUME.windowMs, 950);
  assert.equal(Object.hasOwn(VOLUME, 'inCorridor'), false, 'raw level must not invent a target corridor');
  assert.equal(VOLUME.dbfs, Number((20 * Math.log10(levels[3])).toFixed(2)));
  assert.equal(VOLUME_MODULATION.available, true);
  assert.equal(VOLUME_MODULATION.source, 'SPEECH_GATED_MIC_RMS_HISTORY');
  assert.equal(VOLUME_MODULATION.trace.length, 12, 'history must be bounded');
  assert.ok(VOLUME_MODULATION.rangeDb > 10, 'the actual RMS changes must create modulation');
  assert.equal(Object.hasOwn(VOLUME_MODULATION, 'flat'), false, 'raw variation must not invent a flatness judgment');
  assert.ok(VOLUME_MODULATION.trace.every((frame) => Object.keys(frame).join(',') === 'atMs,dbfs'));
  assert.ok(Object.isFrozen(VOLUME_MODULATION.trace));

  const beforeSilence = VOLUME_MODULATION.trace.length;
  const silence = projector.ingest(audio({ atMs: 2_100, rms: 0.0001, speaking: false }));
  assert.equal(silence.metrics.VOLUME_MODULATION.trace.length, beforeSilence, 'silence must not become vocal modulation');

  const missing = new LiveMetricProjector().ingest(audio({ rms: undefined }));
  assert.equal(missing.metrics.VOLUME.available, false);
  assert.equal(missing.metrics.VOLUME.reason, 'NO_MIC_RMS');
  assert.equal(missing.metrics.VOLUME_MODULATION.available, false);
});

test('pitch is genuine F0 rendered only against the speaker rolling median', () => {
  const projector = new LiveMetricProjector();
  let snapshot = projector.ingest(audio());
  assert.equal(snapshot.metrics.PITCH.available, false);
  assert.equal(snapshot.metrics.PITCH.reason, 'ESTABLISHING_SPEAKER_RANGE');

  snapshot = projector.ingest(audio({
    atMs: 1_050,
    pitch: {
      voiced: true,
      f0Hz: 220,
      summary: {
        available: true,
        medianHz: 110,
        rangeSemitones: 14,
        variationSemitones: 2.5,
        voicedRatio: 0.7,
      },
    },
  }));
  const pitch = snapshot.metrics.PITCH;
  assert.equal(pitch.available, true);
  assert.equal(pitch.source, 'VALIDATED_F0');
  assert.equal(pitch.reference, 'SPEAKER_ROLLING_MEDIAN');
  assert.equal(pitch.semitonesFromSpeakerMedian, 12);
  assert.equal(pitch.register, 2);
  assert.equal(pitch.absoluteHzTarget, null);

  snapshot = projector.ingest(audio({
    atMs: 1_100,
    pitch: {
      voiced: false,
      f0Hz: null,
      summary: { available: true, medianHz: 110, rangeSemitones: 14, variationSemitones: 2.5 },
    },
  }));
  assert.equal(snapshot.metrics.PITCH.available, true, 'the established speaker range remains real');
  assert.equal(snapshot.metrics.PITCH.voiced, false);
  assert.equal(snapshot.metrics.PITCH.semitonesFromSpeakerMedian, null);
  assert.equal(snapshot.metrics.PITCH.register, null, 'an unvoiced frame must not fabricate a register');
});

test('WPM fails closed unless per-word observed transcript timing has trusted provenance', () => {
  const projector = new LiveMetricProjector();
  const untrusted = projector.ingestTranscriptTiming({
    atMs: 30_000,
    windowStartedAtMs: 0,
    windowEndedAtMs: 30_000,
    wordCount: 60,
    transcript: 'this content must never enter projector state',
  });
  assert.equal(untrusted.metrics.SPEED_WPM.available, false);
  assert.equal(untrusted.metrics.SPEED_WPM.reason, 'NO_TRUSTWORTHY_TRANSCRIPT_TIMING');
  assert.doesNotMatch(JSON.stringify(untrusted), /this content/u);

  assert.deepEqual([...OBSERVED_TRANSCRIPT_TIMING_SOURCES], [
    'LOCAL_TIMED_TRANSCRIPT', 'FIRST_PARTY_TIMED_TRANSCRIPT', 'OBSERVED_TRANSCRIPT_SEGMENTS',
  ]);
  const firstParty = new LiveMetricProjector().ingestTranscriptTiming({
    atMs: 30_000,
    windowStartedAtMs: 0,
    windowEndedAtMs: 30_000,
    wordCount: 60,
    words: timedWords(60),
    speechDurationMs: 24_000,
    coverage: 0.9,
    provenance: {
      kind: 'OBSERVED_TRANSCRIPT_TIMING',
      observed: true,
      wordTimestampsObserved: true,
      timingAccuracyValidated: false,
      tier: 'B',
      source: 'FIRST_PARTY_TIMED_TRANSCRIPT',
    },
  });
  assert.equal(firstParty.metrics.SPEED_WPM.available, true);
  const trusted = projector.ingestTranscriptTiming({
    atMs: 30_000,
    windowStartedAtMs: 0,
    windowEndedAtMs: 30_000,
    wordCount: 60,
    words: timedWords(60),
    speechDurationMs: 24_000,
    coverage: 0.9,
    transcript: 'still ignored and never retained',
    provenance: {
      kind: 'OBSERVED_TRANSCRIPT_TIMING',
      observed: true,
      wordTimestampsObserved: true,
      timingAccuracyValidated: false,
      tier: 'B',
      source: 'LOCAL_TIMED_TRANSCRIPT',
    },
  });
  const speed = trusted.metrics.SPEED_WPM;
  assert.equal(speed.available, true);
  assert.equal(speed.wordsPerMinute, 120);
  assert.equal(speed.wordCount, 60);
  assert.equal(speed.windowDurationMs, 30_000);
  assert.equal(speed.source, 'OBSERVED_TRANSCRIPT_TIMING');
  assert.equal(speed.confidence, 'MODERATE');
  assert.doesNotMatch(JSON.stringify(trusted), /still ignored/u);

  const tooThin = new LiveMetricProjector().ingestTranscriptTiming({
    atMs: 500,
    windowStartedAtMs: 0,
    windowEndedAtMs: 500,
    wordCount: 1,
    words: timedWords(1),
    speechDurationMs: 500,
    coverage: 1,
    provenance: {
      kind: 'OBSERVED_TRANSCRIPT_TIMING', observed: true, wordTimestampsObserved: true, timingAccuracyValidated: false, tier: 'B', source: 'OBSERVED_TRANSCRIPT_SEGMENTS',
    },
  });
  assert.equal(tooThin.metrics.SPEED_WPM.available, false);
  assert.equal(tooThin.metrics.SPEED_WPM.reason, 'NEED_MORE_TIMED_WORDS');
});

test('vision maps the emitted proxy field names and live face-family cartridges', () => {
  const projector = new LiveMetricProjector();
  const snapshot = projector.ingest(vision());
  const face = snapshot.metrics.HEAD_FACE;
  assert.equal(face.available, true);
  assert.equal(face.orientation.yawProxyDeg, 7);
  assert.equal(face.orientation.pitchProxyDeg, -3);
  assert.equal(face.orientation.rollProxyDeg, 2);
  assert.equal(face.orientation.cameraFacingProxy, true);
  assert.equal(face.faceCentered, true);
  assert.equal(face.mouthCornerElevation.available, true);
  assert.equal(face.mouthCornerElevation.claim, 'OBSERVABLE_MOUTH_CORNER_ELEVATION');
  assert.equal(face.blink.count, 2);
  assert.equal(face.gazeProxy.method, 'BLENDSHAPE_GAZE_PROXY');
  assert.equal(face.gazeProxy.target, null);
  assert.equal(face.affectClassification.available, false);
  assert.equal(face.genuineSmileClassification.available, false);

  // The old consumer bug looked for yawDeg. A made-up legacy value must not override
  // the geometry contract's actual yawProxyDeg field.
  const legacyOnly = new LiveMetricProjector().ingest(vision({
    geometry: {
      primaryAssociated: true,
      face: { present: true, yawDeg: 40 },
      pose: {},
      hands: {},
    },
  }));
  assert.equal(legacyOnly.metrics.HEAD_FACE.orientation.yawProxyDeg, null);
  assert.equal(legacyOnly.metrics.HEAD_FACE.orientation.cameraFacingProxy, null);
});

test('body and hand presentation remains observable and unsupported interpretations stay unavailable', () => {
  const body = new LiveMetricProjector().ingest(vision()).metrics.BODY_HANDS;
  assert.equal(body.available, true);
  assert.equal(body.upperBodyPresent, true);
  assert.equal(body.torsoPresent, true);
  assert.deepEqual(body.bodyCenter, { x: 0.51, y: 0.48 });
  assert.equal(body.lateralLeanDeg, 1.5);
  assert.equal(body.hands.left.present, true);
  assert.equal(body.hands.left.zone, 'chest');
  assert.equal(body.observableActivity.handRegionActive, 'left');
  assert.equal(body.observableActivity.postureMovementActive, true);
  assert.equal(body.gestureClassification.available, false);
  assert.equal(body.noteTakingClassification.available, false);
  assert.equal(body.fidgetClassification.available, false);

  const upperBodyOnly = new LiveMetricProjector().ingest(vision({
    geometry: {
      primaryAssociated: true,
      face: { present: true },
      pose: { upperBodyPresent: true, torsoPresent: false, shoulderWidth: 0.3, centerX: 0.5, centerY: 0.45, lateralLeanDeg: null },
      hands: { left: { present: false }, right: { present: false } },
    },
  })).metrics.BODY_HANDS;
  assert.equal(upperBodyOnly.available, true);
  assert.equal(upperBodyOnly.upperBodyPresent, true);
  assert.equal(upperBodyOnly.torsoPresent, false);
  assert.equal(upperBodyOnly.lateralLeanDeg, null);

  for (const claim of Object.values(UNSUPPORTED_LIVE_CLAIMS)) {
    assert.equal(claim.available, false);
    assert.equal(claim.reason, 'UNSUPPORTED_INFERENCE');
  }
});

test('person-derived metrics fail closed across primary-lock ambiguity and recover only after re-lock', () => {
  const projector = new LiveMetricProjector();
  const locked = projector.ingest(vision());
  assert.equal(locked.metrics.HEAD_FACE.available, true);
  assert.equal(locked.metrics.BODY_HANDS.available, true);

  const ambiguous = projector.ingest(vision({
    atMs: 2_125,
    primaryLock: { state: 'PRIMARY_SELECTION_REQUIRED', selectionRequired: true, bystanderCount: 1 },
  }));
  assert.equal(ambiguous.metrics.HEAD_FACE.available, false);
  assert.equal(ambiguous.metrics.HEAD_FACE.reason, 'PRIMARY_SELECTION_REQUIRED');
  assert.equal(ambiguous.metrics.BODY_HANDS.available, false);

  const missing = projector.ingest(vision({ atMs: 2_250, primaryLock: null }));
  assert.equal(missing.metrics.HEAD_FACE.reason, 'PRIMARY_LOCK_UNAVAILABLE');
  assert.equal(missing.metrics.BODY_HANDS.reason, 'PRIMARY_LOCK_UNAVAILABLE');

  const restored = projector.ingest(vision({
    atMs: 2_375,
    primaryLock: { state: 'PRIMARY_LOCKED', selectionRequired: false, bystanderCount: 1 },
  }));
  assert.equal(restored.metrics.HEAD_FACE.available, true, 'a locked primary remains usable with excluded bystanders');
  assert.equal(restored.metrics.BODY_HANDS.available, true);

  const mismatched = projector.ingest(vision({
    atMs: 2_500,
    geometry: { ...vision().geometry, primaryAssociated: false },
  }));
  assert.equal(mismatched.metrics.HEAD_FACE.reason, 'PRIMARY_ASSOCIATION_UNVERIFIED');
  assert.equal(mismatched.metrics.BODY_HANDS.reason, 'PRIMARY_ASSOCIATION_UNVERIFIED');
});

test('trusted WPM expires after a bounded shared-clock gap', () => {
  const projector = new LiveMetricProjector({ maximumTranscriptGapMs: 2_000 });
  const timing = projector.ingestTranscriptTiming({
    atMs: 4_000,
    windowStartedAtMs: 0,
    windowEndedAtMs: 4_000,
    wordCount: 8,
    words: timedWords(8),
    speechDurationMs: 3_500,
    coverage: 0.9,
    provenance: {
      kind: 'OBSERVED_TRANSCRIPT_TIMING', observed: true, wordTimestampsObserved: true, timingAccuracyValidated: false, tier: 'B', source: 'LOCAL_TIMED_TRANSCRIPT',
    },
  });
  assert.equal(timing.metrics.SPEED_WPM.available, true);

  const fresh = projector.ingest(audio({ atMs: 6_000 }));
  assert.equal(fresh.metrics.SPEED_WPM.available, true, 'the exact freshness boundary remains available');

  const expired = projector.ingest(audio({ atMs: 6_001 }));
  assert.equal(expired.metrics.SPEED_WPM.available, false);
  assert.equal(expired.metrics.SPEED_WPM.reason, 'STALE_TRANSCRIPT_TIMING');
  assert.deepEqual(expired.metrics.SPEED_WPM.detail, { timingGapMs: 2_001, maximumGapMs: 2_000 });
});

test('reset starts a fresh session and accepts timestamps below the prior session clock', () => {
  const projector = new LiveMetricProjector({ minimumModulationFrames: 3 });
  projector.ingest(audio({ atMs: 20_000, rms: 0.1 }));
  assert.equal(projector.latest.clock.lastAcceptedAtMs.audio, 20_000);

  projector.reset();
  assert.equal(projector.latest.clock.lastAcceptedAtMs.audio, null);
  assert.equal(projector.latest.metrics.VOLUME.available, false);
  const restarted = projector.ingest(audio({ atMs: 50, rms: 0.2 }));
  assert.equal(restarted.clock.lastAcceptedAtMs.audio, 50);
  assert.equal(restarted.metrics.VOLUME.rms, 0.2);
});

test('stale frames cannot roll live instruments backward on the shared session clock', () => {
  const projector = new LiveMetricProjector({ minimumModulationFrames: 3 });
  projector.ingest(audio({ atMs: 2_000, rms: 0.2 }));
  const accepted = projector.latest;
  const stale = projector.ingest(audio({ atMs: 1_999, rms: 0.001 }));
  assert.strictEqual(stale, accepted);
  assert.equal(stale.metrics.VOLUME.rms, 0.2);
  assert.equal(stale.clock.lastAcceptedAtMs.audio, 2_000);
});

test('projector source has no storage, logging, media acquisition, or timer-driven telemetry path', async () => {
  const source = await readFile(new URL('../../public/live-analytics/live-metric-projector.mjs', import.meta.url), 'utf8');
  for (const forbidden of [
    'console.log', 'localStorage', 'sessionStorage', 'indexedDB', 'getUserMedia(',
    'new AudioContext', 'setInterval(', 'setTimeout(', 'Math.random(',
  ]) {
    assert.ok(!source.includes(forbidden), `projector must not contain ${forbidden}`);
  }
});

test('every presentation metric carries a state, time, confidence, and provenance window', () => {
  const projector = new LiveMetricProjector();
  projector.setConversationState('ANSWERING');
  const snapshot = projector.ingest(audio({ atMs: 1_000, captureMethod: 'AUDIO_WORKLET_PCM' }));
  for (const metric of Object.values(snapshot.metrics)) {
    assert.equal(metric.window.state, 'ANSWERING');
    assert(Number.isFinite(metric.window.startMs));
    assert(Number.isFinite(metric.window.endMs));
    assert(['HIGH', 'MODERATE', 'UNAVAILABLE'].includes(metric.window.confidence));
    assert.equal(typeof metric.window.provenance.source, 'string');
    assert.equal(typeof metric.window.provenance.method, 'string');
  }
  assert.equal(snapshot.metrics.VOLUME.window.provenance.method, 'AUDIO_WORKLET_PCM');
});
