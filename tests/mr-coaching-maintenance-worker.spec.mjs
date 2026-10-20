import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startCoachingMaintenanceWorker } from '../missionmed-hq/lib/scheduler/coaching-worker.mjs';
const settle = () => new Promise(resolve => setImmediate(resolve));
test('disabled production flag creates no timer, database, provider or email action', async () => {
  const worker = startCoachingMaintenanceWorker({ enabled: false, setIntervalImpl: () => { throw new Error('must not start'); } });
  assert.equal(worker.enabled, false); await worker.stop();
});
test('bounded interval does not overlap and shutdown waits for active protected work', async () => {
  let tick; let finish; let calls = 0; let cleared = 0; let unref = 0;
  const worker = startCoachingMaintenanceWorker({ enabled: true,
    run: async () => { ++calls; await new Promise(resolve => { finish = resolve; }); },
    setIntervalImpl: (fn, ms) => { tick = fn; assert.equal(ms, 60000); return { unref: () => ++unref }; },
    clearIntervalImpl: () => { ++cleared; },
  });
  tick(); await settle(); tick(); await settle(); assert.equal(calls, 1); assert.equal(unref, 1);
  let stopped = false; const pending = worker.stop().then(() => { stopped = true; });
  await settle(); assert.equal(stopped, false); assert.equal(cleared, 1);
  finish(); await pending; tick(); await settle(); assert.equal(calls, 1);
});
test('failure is bounded, no automatic immediate retry and no private error disclosure', async () => {
  let tick; let calls = 0; const errors = [];
  const worker = startCoachingMaintenanceWorker({ enabled: true,
    run: async () => { ++calls; throw new Error('fixture-sensitive-provider-response'); },
    onFailure: value => errors.push(value), setIntervalImpl: fn => { tick = fn; return {}; }, clearIntervalImpl: () => {},
  });
  tick(); await settle(); await settle(); assert.equal(calls, 1);
  assert.deepEqual(errors, ['coaching_maintenance_requires_review']); await worker.stop();
});
test('shutdown stops new ticks immediately and bounds drain without claiming active work finished', async () => {
  let tick; let finish; let timeout; let calls = 0; const events = [];
  const worker = startCoachingMaintenanceWorker({ enabled: true,
    run: async () => { ++calls; await new Promise(resolve => { finish = resolve; }); },
    setIntervalImpl: fn => { tick = fn; return {}; }, clearIntervalImpl: () => events.push('timer_closed'),
    setTimeoutImpl: (fn, ms) => { timeout = fn; assert.equal(ms, 10000); return 1; }, clearTimeoutImpl: () => {},
  });
  tick(); await settle();
  // This is the server integration order: initiate stop, close HTTP, then drain.
  const drain = worker.stop(); events.push('http_closed');
  assert.deepEqual(events, ['timer_closed', 'http_closed']);
  tick(); await settle(); assert.equal(calls, 1);
  timeout(); assert.deepEqual(await drain, { drained: false, active_work_continues: true });
  finish(); await settle(); tick(); await settle(); assert.equal(calls, 1);
});
