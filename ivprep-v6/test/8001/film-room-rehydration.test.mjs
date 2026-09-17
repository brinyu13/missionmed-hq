import assert from 'node:assert/strict';
import test from 'node:test';

import { resultLaneReadouts } from '../../public/analytics/di-groups-ui.mjs';

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
