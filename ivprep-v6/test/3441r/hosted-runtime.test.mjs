import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { FOUNDER_TEST_PLAN, founderTestPlanFor } from '../../server/founder-paid-test-gate.mjs';

test('hosted runtime binds three exact tests and never a fourth', async () => {
  assert.deepEqual(FOUNDER_TEST_PLAN.map((entry) => entry.maxSeconds), [45, 45, 59]);
  assert.equal(founderTestPlanFor(4), null);
  const adapter = await readFile(new URL('../../server/providers/supabase-durable-adapter.mjs', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../../server/providers/provider-session-controller.mjs', import.meta.url), 'utf8');
  assert.match(adapter, /plan\?\.maxSeconds === Number\(input\.maxSeconds\)/u);
  assert.match(adapter, /testNo: plan\.testNo/u);
  assert.match(controller, /this\.testPlan\.find\(\(entry\) => entry\?\.testNo === testNo\)/u);
  assert.match(controller, /testNo: this\.authorization\.testNo/u);
});
