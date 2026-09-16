import assert from 'node:assert/strict';
import test from 'node:test';
import { CueArbiter } from './arbiter.mjs';

test('cue arbiter enforces dwell, priority, refractory and per-answer limits', () => {
  const arbiter = new CueArbiter({ dwellMs: 100, showMs: 3000, refractoryMs: 500, maxPerAnswer: 1 });
  arbiter.beginAnswer();
  assert.equal(arbiter.decide({ nowMs: 0, candidates: [{ cue_id: 'pace', priority: 1 }] }).decision, 'NO_CUE');
  assert.equal(arbiter.decide({ nowMs: 101, candidates: [{ cue_id: 'pace', priority: 1 }, { cue_id: 'volume', priority: 2 }] }).cue_id, 'pace');
  assert.equal(arbiter.decide({ nowMs: 1000, candidates: [{ cue_id: 'volume', priority: 2 }] }).reason, 'answer_limit');
});

test('fault cues bypass coaching timing without becoming coaching text', () => {
  const result = new CueArbiter().decide({ nowMs: 5, fault: 'camera_lost' });
  assert.deepEqual({ cue_id: result.cue_id, reason: result.reason }, { cue_id: 'camera_lost', reason: 'fault_bypass' });
});
