import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MIC_CONTROLLER_DEFAULTS,
  MicController,
  SilenceTurnDetector,
} from '../public/mic-controller.mjs';

function speakFor(detector, times) {
  return times.map((atMs) => detector.ingest({ speaking: true, atMs }));
}

test('defaults require genuine speech and approximately five seconds of silence', () => {
  assert.equal(MIC_CONTROLLER_DEFAULTS.silenceMs, 5_000);
  assert.ok(MIC_CONTROLLER_DEFAULTS.minimumSpeechMs > 0);

  const detector = new SilenceTurnDetector();
  assert.equal(detector.ingest({ speaking: false, atMs: 60_000 }).completed, false);
  assert.equal(detector.hasGenuineSpeech, false);
});

test('short noise does not qualify as a spoken answer', () => {
  const detector = new SilenceTurnDetector();
  speakFor(detector, [0, 50, 100]);

  const event = detector.ingest({ speaking: false, atMs: 20_000 });
  assert.equal(detector.hasGenuineSpeech, false);
  assert.equal(event.completed, false);
});

test('a natural mid-answer pause shorter than five seconds does not complete the turn', () => {
  const detector = new SilenceTurnDetector();
  speakFor(detector, [0, 100, 200, 300]);
  assert.equal(detector.hasGenuineSpeech, true);

  assert.equal(detector.ingest({ speaking: false, atMs: 5_299 }).completed, false);
  assert.equal(detector.ingest({ speaking: true, atMs: 5_300 }).completed, false);
  assert.equal(detector.ingest({ speaking: true, atMs: 5_550 }).completed, false);
  assert.equal(detector.ingest({ speaking: false, atMs: 10_549 }).completed, false);

  const completed = detector.ingest({ speaking: false, atMs: 10_550 });
  assert.equal(completed.completed, true);
  assert.equal(completed.silenceMs, 5_000);
});

test('MicController emits exactly one completion for a finished turn', () => {
  let now = 0;
  let level = 0;
  const completions = [];
  const controller = new MicController({
    clock: () => now,
    level: () => level,
    onTurnComplete: (event) => completions.push(event),
  });

  controller.start();
  level = 0.2;
  for (now of [0, 100, 200, 300]) controller.tick(now);
  level = 0;
  controller.tick(5_299);
  controller.tick(5_300);
  controller.tick(8_000);

  assert.equal(completions.length, 1);
  assert.equal(completions[0].silenceMs, 5_000);
});

test('muting cannot submit an answer and muted time does not become answer-ending silence', () => {
  let now = 0;
  let level = 0.2;
  const completions = [];
  const controller = new MicController({
    clock: () => now,
    level: () => level,
    onTurnComplete: (event) => completions.push(event),
  });

  controller.start();
  for (now of [0, 100, 200, 300]) controller.tick(now);
  controller.setMuted(true);
  level = 0;
  controller.tick(20_000);
  assert.equal(completions.length, 0);

  controller.setMuted(false);
  controller.tick(20_001);
  assert.equal(completions.length, 0, 'unmuting must not immediately submit stale pre-mute speech');
});

test('resetTurn discards prior speech and requires a new genuine answer', () => {
  let now = 0;
  let level = 0.2;
  const completions = [];
  const controller = new MicController({
    clock: () => now,
    level: () => level,
    onTurnComplete: (event) => completions.push(event),
  });

  controller.start();
  for (now of [0, 100, 200, 300]) controller.tick(now);
  now = 500;
  controller.resetTurn();
  level = 0;
  controller.tick(10_000);

  assert.equal(completions.length, 0);
  assert.equal(controller.detector.hasGenuineSpeech, false);
});

test('sustained candidate speech triggers one barge-in while interviewer audio is active', () => {
  let level = 0.2;
  const interruptions = [];
  const controller = new MicController({
    level: () => level,
    onBargeIn: (event) => interruptions.push(event),
  });

  controller.start();
  controller.setInterviewerSpeaking(true);
  controller.tick(1_000);
  controller.tick(1_179);
  controller.tick(1_180);
  controller.tick(2_000);

  assert.equal(interruptions.length, 1);
  assert.equal(interruptions[0].atMs, 1_180);
});
