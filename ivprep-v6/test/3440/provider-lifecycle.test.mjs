import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_RETRY, PROFILE_B, ProviderSessionController } from '../../server/providers/provider-session-controller.mjs';
import { InMemoryVideoEntitlementStore } from '../../server/video-entitlement-store.mjs';

function syntheticClock() {
  return { setTimeout: () => 1, clearTimeout: () => {} };
}

test('one Profile B reservation, dispatch, provider session, and ordered teardown are enforced', async () => {
  const calls = [];
  const store = new InMemoryVideoEntitlementStore({ idFactory: () => 'reservation-1' });
  store.grantSyntheticSeconds('wp:1', 59);
  const controller = new ProviderSessionController({
    entitlementStore: store,
    clock: syntheticClock(),
    maxSeconds: 45,
    room: {
      create: async ({ retry }) => { calls.push(['room.create', retry]); return { roomName: 'room-1' }; },
      delete: async ({ retry }) => { calls.push(['room.delete', retry]); },
    },
    dispatch: {
      create: async ({ restartPolicy, retry }) => { calls.push(['dispatch.create', restartPolicy, retry]); return { dispatchId: 'dispatch-1' }; },
      delete: async ({ retry }) => { calls.push(['dispatch.delete', retry]); },
    },
    agent: {
      join: async ({ profile, retry }) => { calls.push(['agent.join', profile, retry]); },
      close: async () => { calls.push(['agent.close']); },
    },
    avatar: {
      create: async ({ profile, retry }) => { calls.push(['avatar.create', profile, retry]); return { sessionId: 'provider-1', mediaReady: true }; },
      terminate: async ({ retry }) => { calls.push(['avatar.terminate', retry]); return { confirmed: true }; },
      close: async () => { calls.push(['avatar.close']); },
    },
  });

  const started = await controller.start({ subject: 'wp:1', interviewId: 'interview-1', idempotencyKey: 'idem-key-1', testNo: 1 });
  assert.equal(started.ok, true);
  assert.equal(started.profile, PROFILE_B);
  assert.equal(controller.lifecycle.state, 'ACTIVE');
  await assert.rejects(controller.start({ subject: 'wp:1', interviewId: 'interview-1', idempotencyKey: 'idem-key-1', testNo: 1 }));
  const stopped = await controller.stop('user_ended', { observedBillableSeconds: 12.1 });
  assert.equal(stopped.ok, true);
  assert.equal(controller.lifecycle.state, 'CLOSED');
  assert.deepEqual(store.balance('wp:1'), { granted: 59, consumed: 13, reserved: 0, available: 46 });
  assert.deepEqual(calls.map(([name]) => name), [
    'room.create', 'dispatch.create', 'agent.join', 'avatar.create',
    'avatar.terminate', 'avatar.close', 'agent.close', 'dispatch.delete', 'room.delete',
  ]);
  for (const call of calls) {
    for (const value of call) if (value && typeof value === 'object' && 'maxRetry' in value) assert.deepEqual(value, NO_RETRY);
  }
  assert.equal(calls.find(([name]) => name === 'dispatch.create')[1], 'JRP_NEVER');
});

test('unconfirmed termination fails closed and trips the store kill switch', async () => {
  const store = new InMemoryVideoEntitlementStore({ idFactory: () => 'reservation-2' });
  store.grantSyntheticSeconds('wp:2', 45);
  const controller = new ProviderSessionController({
    entitlementStore: store,
    clock: syntheticClock(),
    room: { create: async () => ({ roomName: 'room-2' }), delete: async () => {} },
    dispatch: { create: async () => ({ dispatchId: 'dispatch-2' }), delete: async () => {} },
    agent: { join: async () => {}, close: async () => {} },
    avatar: { create: async () => ({ sessionId: 'provider-2', mediaReady: true }), terminate: async () => ({ confirmed: false }), close: async () => {} },
  });
  assert.equal((await controller.start({ subject: 'wp:2', interviewId: 'interview-2', idempotencyKey: 'idem-key-2', testNo: 1 })).ok, true);
  assert.equal((await controller.stop()).ok, false);
  assert.equal(controller.lifecycle.state, 'FAILED_CLOSED');
  assert.equal(store.reserve({ subject: 'wp:2', interviewId: 'interview-3', requestedSeconds: 1, idempotencyKey: 'idem-key-3' }).code, 'ivprep_unavailable');
});

test('paid controller refuses Test 2, Test 3, and any restart', async () => {
  const store = new InMemoryVideoEntitlementStore();
  store.grantSyntheticSeconds('wp:3', 45);
  const controller = new ProviderSessionController({ entitlementStore: store, clock: syntheticClock() });
  await assert.rejects(controller.start({ subject: 'wp:3', interviewId: 'interview-3', idempotencyKey: 'idem-key-4', testNo: 2 }), /Test 1/u);
});
