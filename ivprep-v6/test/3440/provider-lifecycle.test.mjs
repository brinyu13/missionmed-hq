import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_RETRY, PROFILE_B, PROFILE_B_AGENT_NAME, ProviderSessionController } from '../../server/providers/provider-session-controller.mjs';
import { FOUNDER_TEST_AVATAR_PARTICIPANT_ID } from '../../server/founder-paid-test-gate.mjs';
import { InMemoryVideoEntitlementStore } from '../../server/video-entitlement-store.mjs';

function syntheticClock() {
  return { setTimeout: () => 1, clearTimeout: () => {} };
}

function paidAuthorization({ subject, interviewId, idempotencyKey, voice = 'marin' }) {
  return Object.freeze({
    authorized: true, consumed: true, authorizationId: `authorization-${interviewId}`,
    authorizationBinding: 'a'.repeat(64), subject, interviewId, idempotencyKey,
    agentId: 'agent_9bdfc50ec0086043', profile: 'PROFILE_B_OPENAI_NATIVE_AUDIO',
    avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
    voice, maxSeconds: 45, testNo: 1, terminationArmed: true,
    reconciliationArmed: true, zeroRetry: true, zeroReconnect: true, zeroRecreation: true,
  });
}

const terminalAudit = async () => ({ ok: true });

test('one Profile B reservation, dispatch, provider session, and ordered teardown are enforced', async () => {
  const calls = [];
  let now = 0;
  const store = new InMemoryVideoEntitlementStore({ idFactory: () => 'reservation-1' });
  store.grantSyntheticSeconds('wp:1', 59);
  const controller = new ProviderSessionController({
    entitlementStore: store,
    clock: syntheticClock(),
    now: () => now,
    maxSeconds: 45,
    onTerminal: terminalAudit,
    room: {
      create: async ({ retry }) => { calls.push(['room.create', retry]); return { roomName: 'room-1' }; },
      delete: async ({ retry }) => { calls.push(['room.delete', retry]); },
    },
    participant: {
      issue: async ({ participantIdentity, retry }) => {
        calls.push(['participant.issue', retry]);
        return { url: 'wss://example.livekit.cloud', token: 'synthetic-room-token'.padEnd(64, 'x'), participantIdentity };
      },
    },
    dispatch: {
      create: async ({ restartPolicy, retry, agentName, reservationNonce }) => { calls.push(['dispatch.create', restartPolicy, retry, agentName, reservationNonce]); return { dispatchId: 'dispatch-1' }; },
      delete: async ({ roomName, retry }) => { calls.push(['dispatch.delete', roomName, retry]); },
    },
    worker: {
      assertReady: async ({ retry }) => { calls.push(['worker.assertReady', retry]); return { ok: true }; },
      armJob: async ({ retry }) => { calls.push(['worker.armJob', retry]); return { ok: true }; },
      bindDispatch: async ({ retry }) => { calls.push(['worker.bindDispatch', retry]); return { ok: true }; },
      awaitMediaReady: async ({ roomName, dispatchId, reservationNonce, retry }) => {
        calls.push(['worker.awaitMediaReady', retry]);
        return {
          roomName,
          dispatchId,
          reservationNonce,
          participantIdentity: `ivp-${reservationNonce.slice(0, 48)}`,
          avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
          agentJoined: true,
          avatarCreateObserved: true,
          avatarJoined: true,
          agentSessionStarted: true,
          browserVideoDecoded: true,
          browserAudioPlayable: true,
          audioAuthority: 'avatar-livekit',
          mediaReady: true,
          providerSessionHash: 'b'.repeat(64),
        };
      },
      requestStop: async ({ retry }) => { calls.push(['worker.requestStop', retry]); return { accepted: true }; },
      awaitReconciliation: async ({ roomName, dispatchId, reservationNonce, participantIdentity, retry }) => {
        calls.push(['worker.awaitReconciliation', retry]);
        return {
          roomName,
          dispatchId,
          reservationNonce,
          participantIdentity,
          avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
          providerCreateAttempted: true,
          providerSessionHash: 'b'.repeat(64),
          terminationConfirmed: true,
          reconciled: true,
          providerStatus: { sessionStatus: 'COMPLETED', cost: 1.25 },
          localElapsedSeconds: 12.1,
        };
      },
      close: async () => { calls.push(['worker.close']); },
    },
  });

  const authorization = paidAuthorization({ subject: 'wp:1', interviewId: 'interview-1', idempotencyKey: 'idem-key-1' });
  const started = await controller.start({ subject: 'wp:1', interviewId: 'interview-1', idempotencyKey: 'idem-key-1', testNo: 1, paidTestAuthorization: authorization });
  assert.equal(started.ok, true);
  assert.equal(started.pending, true);
  assert.equal(started.profile, PROFILE_B);
  assert.equal(await controller.activationPromise, true);
  assert.equal(controller.lifecycle.state, 'ACTIVE');
  await assert.rejects(controller.start({ subject: 'wp:1', interviewId: 'interview-1', idempotencyKey: 'idem-key-1', testNo: 1, paidTestAuthorization: authorization }));
  now = 12_100;
  const stopped = await controller.stop('user_ended');
  assert.equal(stopped.ok, true);
  assert.equal(controller.lifecycle.state, 'CLOSED');
  assert.deepEqual(store.balance('wp:1'), { granted: 59, consumed: 13, reserved: 0, available: 46 });
  assert.deepEqual(calls.map(([name]) => name), [
    'room.create', 'participant.issue', 'worker.assertReady', 'worker.armJob', 'worker.assertReady', 'dispatch.create', 'worker.bindDispatch', 'worker.awaitMediaReady',
    'worker.requestStop', 'worker.awaitReconciliation', 'worker.close', 'dispatch.delete', 'room.delete',
  ]);
  for (const call of calls) {
    for (const value of call) if (value && typeof value === 'object' && 'maxRetry' in value) assert.deepEqual(value, NO_RETRY);
  }
  assert.equal(calls.find(([name]) => name === 'dispatch.create')[1], 'JRP_NEVER');
  assert.equal(calls.find(([name]) => name === 'dispatch.create')[3], PROFILE_B_AGENT_NAME);
  assert.match(calls.find(([name]) => name === 'dispatch.create')[4], /^[a-f0-9]{64}$/u);
  assert.equal(calls.find(([name]) => name === 'dispatch.delete')[1], 'room-1');
  assert.equal(stopped.cost.terminalStatus, 'COMPLETED');
  assert.equal(stopped.cost.providerNativeCost, 1.25);
});

test('reservation denial fails closed without any provider-side operation', async () => {
  const calls = [];
  const denied = async (name) => { calls.push(name); throw new Error(`${name} must not run`); };
  const controller = new ProviderSessionController({
    entitlementStore: new InMemoryVideoEntitlementStore(),
    clock: syntheticClock(),
    onTerminal: terminalAudit,
    room: {
      create: async () => denied('room.create'),
      delete: async () => denied('room.delete'),
    },
    participant: { issue: async () => denied('participant.issue') },
    dispatch: {
      create: async () => denied('dispatch.create'),
      delete: async () => denied('dispatch.delete'),
    },
    worker: {
      armJob: async () => denied('worker.armJob'),
      bindDispatch: async () => denied('worker.bindDispatch'),
      awaitMediaReady: async () => denied('worker.awaitMediaReady'),
      requestStop: async () => denied('worker.requestStop'),
      awaitReconciliation: async () => denied('worker.awaitReconciliation'),
      close: async () => denied('worker.close'),
    },
  });

  const result = await controller.start({
    subject: 'wp:not-entitled',
    interviewId: 'interview-denied',
    idempotencyKey: 'idem-key-denied',
    testNo: 1,
    paidTestAuthorization: paidAuthorization({ subject: 'wp:not-entitled', interviewId: 'interview-denied', idempotencyKey: 'idem-key-denied' }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'ivprep_video_seconds_unavailable');
  assert.equal(result.lifecycle.state, 'FAILED_CLOSED');
  assert.equal(controller.lifecycle.state, 'FAILED_CLOSED');
  assert.deepEqual(controller.lifecycle.history, ['DISABLED', 'ELIGIBLE', 'FAILED_CLOSED']);
  assert.deepEqual(calls, []);
  assert.deepEqual(await controller.stop('logout'), { ok: false, lifecycle: controller.lifecycle });
});

test('unconfirmed termination fails closed and trips the store kill switch', async () => {
  const store = new InMemoryVideoEntitlementStore({ idFactory: () => 'reservation-2' });
  store.grantSyntheticSeconds('wp:2', 45);
  const controller = new ProviderSessionController({
    entitlementStore: store,
    clock: syntheticClock(),
    onTerminal: terminalAudit,
    room: { create: async () => ({ roomName: 'room-2' }), delete: async () => {} },
    participant: { issue: async ({ participantIdentity }) => ({ url: 'wss://example.livekit.cloud', token: 'synthetic-room-token'.padEnd(64, 'x'), participantIdentity }) },
    dispatch: { create: async () => ({ dispatchId: 'dispatch-2' }), delete: async () => {} },
    worker: {
      assertReady: async () => ({ ok: true }),
      armJob: async () => ({ ok: true }),
      bindDispatch: async () => ({ ok: true }),
      awaitMediaReady: async ({ roomName, dispatchId, reservationNonce }) => ({
        roomName,
        dispatchId,
        reservationNonce,
        participantIdentity: `ivp-${reservationNonce.slice(0, 48)}`,
        avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
        agentJoined: true,
        avatarCreateObserved: true,
        avatarJoined: true,
        agentSessionStarted: true,
        browserVideoDecoded: true,
        browserAudioPlayable: true,
        audioAuthority: 'avatar-livekit',
        mediaReady: true,
        providerSessionHash: 'c'.repeat(64),
      }),
      requestStop: async () => ({ accepted: true }),
      awaitReconciliation: async ({ roomName, dispatchId, reservationNonce, participantIdentity }) => ({
        roomName,
        dispatchId,
        reservationNonce,
        participantIdentity,
        avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
        providerCreateAttempted: true,
        providerSessionHash: 'c'.repeat(64),
        terminationConfirmed: false,
        reconciled: true,
        providerStatus: { sessionStatus: 'ACTIVE', cost: null },
      }),
      close: async () => {},
    },
  });
  assert.equal((await controller.start({ subject: 'wp:2', interviewId: 'interview-2', idempotencyKey: 'idem-key-2', testNo: 1, paidTestAuthorization: paidAuthorization({ subject: 'wp:2', interviewId: 'interview-2', idempotencyKey: 'idem-key-2' }) })).ok, true);
  assert.equal(await controller.activationPromise, true);
  assert.equal((await controller.stop()).ok, false);
  assert.equal(controller.lifecycle.state, 'FAILED_CLOSED');
  assert.equal(store.reserve({ subject: 'wp:2', interviewId: 'interview-3', requestedSeconds: 1, idempotencyKey: 'idem-key-3' }).code, 'ivprep_unavailable');
});

test('paid controller refuses Test 2, Test 3, and any restart', async () => {
  const store = new InMemoryVideoEntitlementStore();
  store.grantSyntheticSeconds('wp:3', 45);
  const controller = new ProviderSessionController({ entitlementStore: store, clock: syntheticClock(), onTerminal: terminalAudit });
  await assert.rejects(controller.start({ subject: 'wp:3', interviewId: 'interview-3', idempotencyKey: 'idem-key-4', testNo: 2, paidTestAuthorization: paidAuthorization({ subject: 'wp:3', interviewId: 'interview-3', idempotencyKey: 'idem-key-4' }) }), /Test 1/u);
});

test('unregistered live worker cannot arm the 45-second clock or create a dispatch', async () => {
  let deadlineCalls = 0;
  let dispatchCalls = 0;
  const store = new InMemoryVideoEntitlementStore({ idFactory: () => 'reservation-worker-gate' });
  store.grantSyntheticSeconds('wp:worker-gate', 45);
  const controller = new ProviderSessionController({
    entitlementStore: store,
    clock: { setTimeout: () => { deadlineCalls += 1; return 1; }, clearTimeout: () => {} },
    onTerminal: terminalAudit,
    room: { create: async () => ({ roomName: 'room-worker-gate' }), delete: async () => {} },
    participant: { issue: async ({ participantIdentity }) => ({
      url: 'wss://example.livekit.cloud',
      token: 'synthetic-room-token'.padEnd(64, 'x'),
      participantIdentity,
    }) },
    dispatch: {
      create: async () => { dispatchCalls += 1; return { dispatchId: 'forbidden-dispatch' }; },
      delete: async () => {},
    },
    worker: {
      assertReady: async () => ({ ok: false }),
      close: async () => {},
    },
  });
  const result = await controller.start({
    subject: 'wp:worker-gate',
    interviewId: 'interview-worker-gate',
    idempotencyKey: 'idem-worker-gate',
    testNo: 1,
    paidTestAuthorization: paidAuthorization({
      subject: 'wp:worker-gate', interviewId: 'interview-worker-gate', idempotencyKey: 'idem-worker-gate',
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'provider_start_failed');
  assert.equal(deadlineCalls, 0);
  assert.equal(dispatchCalls, 0);
  assert.equal(controller.startedAtMs, null);
});

test('lost avatar start response remains unconfirmed and every cleanup step is attempted', async () => {
  const calls = [];
  const store = new InMemoryVideoEntitlementStore({ idFactory: () => 'reservation-4' });
  store.grantSyntheticSeconds('wp:4', 45);
  const controller = new ProviderSessionController({
    entitlementStore: store,
    clock: syntheticClock(),
    onTerminal: terminalAudit,
    room: { create: async () => ({ roomName: 'room-4' }), delete: async () => calls.push('room.delete') },
    participant: { issue: async ({ participantIdentity }) => ({ url: 'wss://example.livekit.cloud', token: 'synthetic-room-token'.padEnd(64, 'x'), participantIdentity }) },
    dispatch: { create: async () => ({ dispatchId: 'dispatch-4' }), delete: async () => calls.push('dispatch.delete') },
    worker: {
      assertReady: async () => ({ ok: true }),
      armJob: async () => ({ ok: true }),
      bindDispatch: async () => ({ ok: true }),
      awaitMediaReady: async () => { calls.push('worker.awaitMediaReady'); throw new Error('response lost'); },
      requestStop: async () => { calls.push('worker.requestStop'); return { accepted: true }; },
      awaitReconciliation: async () => { calls.push('worker.awaitReconciliation'); throw new Error('reconciliation unavailable'); },
      close: async () => { calls.push('worker.close'); throw new Error('close failed'); },
    },
  });
  const result = await controller.start({ subject: 'wp:4', interviewId: 'interview-4', idempotencyKey: 'idem-key-5', testNo: 1, paidTestAuthorization: paidAuthorization({ subject: 'wp:4', interviewId: 'interview-4', idempotencyKey: 'idem-key-5' }) });
  assert.equal(result.ok, true);
  assert.equal(result.pending, true);
  assert.equal(await controller.activationPromise, false);
  assert.equal(controller.lifecycle.state, 'FAILED_CLOSED');
  assert.deepEqual(calls, ['worker.awaitMediaReady', 'worker.requestStop', 'worker.awaitReconciliation', 'worker.close', 'dispatch.delete', 'room.delete']);
  assert.equal(store.reserve({ subject: 'wp:4', interviewId: 'interview-5', requestedSeconds: 1, idempotencyKey: 'idem-key-6', testNo: 1 }).code, 'ivprep_unavailable');
});

test('a paid test number is single-use even after confirmed reconciliation', () => {
  const store = new InMemoryVideoEntitlementStore({ idFactory: () => 'reservation-5' });
  store.grantSyntheticSeconds('wp:5', 90);
  const first = store.reserve({ subject: 'wp:5', interviewId: 'interview-5a', requestedSeconds: 45, idempotencyKey: 'idem-key-7', testNo: 1 });
  store.refundBeforeProviderStart(first.reservation.id);
  const second = store.reserve({ subject: 'wp:5', interviewId: 'interview-5b', requestedSeconds: 45, idempotencyKey: 'idem-key-8', testNo: 1 });
  assert.equal(second.code, 'ivprep_paid_test_already_used');
  assert.equal(store.reserve({ subject: 'wp:5', interviewId: 'interview-5c', requestedSeconds: 46, idempotencyKey: 'idem-key-9', testNo: 2 }).code, 'ivprep_test_duration_exceeded');
  assert.equal(store.reserve({ subject: 'wp:5', interviewId: 'interview-5d', requestedSeconds: 60, idempotencyKey: 'idem-key-10', testNo: 3 }).code, 'ivprep_test_duration_exceeded');
});
