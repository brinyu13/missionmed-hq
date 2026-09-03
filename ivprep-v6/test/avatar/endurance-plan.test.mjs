import test from 'node:test';
import assert from 'node:assert/strict';

import { createAvatarEndurancePlan } from '../../avatar/endurance-plan.mjs';

test('focused endurance plan is separately bounded to 10–15 minutes and never claims final acceptance', () => {
  const ten = createAvatarEndurancePlan(600);
  const fifteen = createAvatarEndurancePlan(900);
  assert.equal(ten.durationSeconds, 600);
  assert.equal(fifteen.durationSeconds, 900);
  assert.equal(ten.finalAcceptance, false);
  assert.ok(ten.utterances.every(({ atSeconds }) => atSeconds < ten.durationSeconds));
  assert.throws(() => createAvatarEndurancePlan(599), /600 through 900/);
  assert.throws(() => createAvatarEndurancePlan(901), /600 through 900/);
});
