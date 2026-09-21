import assert from 'node:assert/strict';
import test from 'node:test';

import { resultLaneReadouts } from '../../public/analytics/di-groups-ui.mjs';
import { persistedConversationTurns } from '../../public/studio/presentation-view-model.mjs';

test('rehydrates the bounded persisted Film Room view model without inventing lanes', () => {
  const readouts = resultLaneReadouts({
    deliveryIntelligence: {
      schema: 'ivoc.delivery-intelligence.view-model.v1',
      readouts: { 'VOICE.PITCH': '+1.2 st vs your median', 'UNKNOWN.LANE': 'ignore', 'BODY.YAW': 4 },
    },
  });
  assert.deepEqual(readouts, { 'VOICE.PITCH': '+1.2 st vs your median' });
});

test('projects legacy saved analytics from evidence and leaves absent signals unavailable', () => {
  const readouts = resultLaneReadouts({ events: [
    { metric: 'captured_level_dbfs', observation: { value: -28.24 } },
    { metric: 'energy_variation_db', observation: { value: 7.11 } },
    { metric: 'pause_episode', observation: { value: 1100 } },
    { metric: 'pause_episode', observation: { value: 2400 } },
    { metric: 'camera_facing_proxy', observation: { value: .82 } },
    { metric: 'framing_center', observation: { value: .91 } },
    { metric: 'head_orientation_proxy', observation: { value: { yawDeg: 2.25, pitchDeg: -1.5, rollDeg: .2 } } },
  ] });
  assert.equal(readouts['VOICE.VOLUME'], '-28.2 dBFS');
  assert.equal(readouts['VOICE.VOLUME_VARIATION'], '7.1 dB');
  assert.equal(readouts['VOICE.PAUSE'], '2 pauses · longest 2.4s');
  assert.equal(readouts['FACE.GAZE'], '82% camera-facing proxy');
  assert.equal(readouts['BODY.FRAMING'], '91% centered frames');
  assert.equal(readouts['BODY.YAW'], '2.3°');
  assert.equal(readouts['VOICE.PITCH'], undefined);
});

test('prefers canonical transcript turns and drops noncanonical duplicates', () => {
  const turns = persistedConversationTurns({ sessionDetail: {
    spine: { turns: [
      { speaker: 'student', startMs: 400, endMs: 900, transcript: { text: 'Canonical answer.' } },
    ] },
    results: { payload: { liveConversation: { turns: [
      { speaker: 'applicant', startMs: 420, text: 'Provider duplicate.' },
    ] } } },
  } });
  assert.deepEqual(turns, [{
    speaker: 'student', text: 'Canonical answer.', startMs: 400, endMs: 900, canonical: true,
  }]);
});

test('rehydrates saved GPT-Live turns when canonical processing is not available yet', () => {
  const turns = persistedConversationTurns({ sessionDetail: { results: { payload: { liveConversation: { turns: [
    { speaker: 'interviewer', startMs: 120, endMs: 820, text: 'Tell me about yourself.' },
    { speaker: 'applicant', startMs: 1_200, endMs: 2_100, text: 'I started in clinical research.' },
  ] } } } } });
  assert.deepEqual(turns, [
    { speaker: 'interviewer', text: 'Tell me about yourself.', startMs: 120, endMs: 820, canonical: false },
    { speaker: 'student', text: 'I started in clinical research.', startMs: 1_200, endMs: 2_100, canonical: false },
  ]);
});

test('uses the just-finished envelope before session detail has reloaded', () => {
  const turns = persistedConversationTurns({ envelope: { liveConversation: { turns: [
    { speaker: 'student', text: 'Immediate saved answer.', startMs: 50 },
  ] } } });
  assert.deepEqual(turns, [{
    speaker: 'student', text: 'Immediate saved answer.', startMs: 50, endMs: 50, canonical: false,
  }]);
});
