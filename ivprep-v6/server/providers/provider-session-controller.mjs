import { createHash } from 'node:crypto';

import { advanceProviderSession, failProviderSession, initialProviderSessionState } from './provider-session-state.mjs';

export const NO_RETRY = Object.freeze({
  maxRetry: 0,
  retryIntervalMs: 0,
  timeoutMs: 10_000,
});

export const PROFILE_B = 'PROFILE_B_OPENAI_NATIVE_AUDIO';

function hashProviderId(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

export class ProviderSessionController {
  constructor({ entitlementStore, room, dispatch, agent, avatar, clock = globalThis, now = () => Date.now(), maxSeconds = 45 } = {}) {
    this.entitlementStore = entitlementStore;
    this.room = room;
    this.dispatch = dispatch;
    this.agent = agent;
    this.avatar = avatar;
    this.clock = clock;
    this.now = now;
    this.maxSeconds = Math.min(45, Math.max(1, Math.trunc(maxSeconds)));
    this.lifecycle = initialProviderSessionState();
    this.context = null;
    this.deadline = null;
    this.teardownPromise = null;
    this.startedAtMs = null;
  }

  async start({ subject, interviewId, idempotencyKey, testNo = 1 } = {}) {
    if (this.lifecycle.state !== 'DISABLED') throw new Error('Provider session can start only once.');
    if (testNo !== 1) throw new Error('This controller is bounded to Engineering Test 1.');
    this.lifecycle = advanceProviderSession(this.lifecycle, 'ELIGIBLE');
    const reserved = this.entitlementStore.reserve({ subject, interviewId, requestedSeconds: this.maxSeconds, idempotencyKey, testNo });
    if (!reserved.ok) {
      this.lifecycle = failProviderSession(this.lifecycle, reserved.code);
      return { ok: false, code: reserved.code, lifecycle: this.lifecycle };
    }
    this.context = { subject, interviewId, reservation: reserved.reservation, roomName: null, dispatchId: null, providerSessionId: null };
    this.lifecycle = advanceProviderSession(this.lifecycle, 'RESERVED');
    this.startedAtMs = this.now();
    this.deadline = this.clock.setTimeout(() => { void this.stop('authorized_deadline'); }, this.maxSeconds * 1000);

    try {
      const createdRoom = await this.room.create({ interviewId, retry: NO_RETRY });
      this.context.roomName = createdRoom.roomName;
      this.lifecycle = advanceProviderSession(this.lifecycle, 'ROOM_CREATED');
      const createdDispatch = await this.dispatch.create({
        roomName: createdRoom.roomName,
        restartPolicy: 'JRP_NEVER',
        retry: NO_RETRY,
      });
      this.context.dispatchId = createdDispatch.dispatchId;
      this.lifecycle = advanceProviderSession(this.lifecycle, 'DISPATCH_CREATED');
      this.lifecycle = advanceProviderSession(this.lifecycle, 'AGENT_JOINING');
      await this.agent.join({ roomName: createdRoom.roomName, profile: PROFILE_B, retry: NO_RETRY });
      this.lifecycle = advanceProviderSession(this.lifecycle, 'AVATAR_CREATING');
      const createdAvatar = await this.avatar.create({ roomName: createdRoom.roomName, profile: PROFILE_B, retry: NO_RETRY });
      this.context.providerSessionId = createdAvatar.sessionId;
      this.entitlementStore.bindProvider({
        reservationId: reserved.reservation.id,
        dispatchId: createdDispatch.dispatchId,
        providerSessionHash: hashProviderId(createdAvatar.sessionId),
      });
      this.lifecycle = advanceProviderSession(this.lifecycle, 'AVATAR_JOINED');
      if (createdAvatar.mediaReady !== true) throw new Error('Avatar media readiness was not proven.');
      this.lifecycle = advanceProviderSession(this.lifecycle, 'MEDIA_READY');
      this.lifecycle = advanceProviderSession(this.lifecycle, 'ACTIVE');
      return { ok: true, lifecycle: this.lifecycle, reservationId: reserved.reservation.id, profile: PROFILE_B };
    } catch (error) {
      await this.stop('start_failed', { observedBillableSeconds: 0, terminationConfirmed: true });
      return { ok: false, code: 'provider_start_failed', lifecycle: this.lifecycle, message: 'Provider start failed closed.' };
    }
  }

  stop(reason = 'user_ended', evidence = {}) {
    if (this.teardownPromise) return this.teardownPromise;
    this.teardownPromise = this.#teardown(reason, evidence);
    return this.teardownPromise;
  }

  async #teardown(reason, evidence) {
    if (this.deadline != null) this.clock.clearTimeout(this.deadline);
    if (['CLOSED', 'FAILED_CLOSED'].includes(this.lifecycle.state)) return { ok: this.lifecycle.state === 'CLOSED', lifecycle: this.lifecycle };
    if (!['TERMINATING', 'RECONCILING'].includes(this.lifecycle.state)) this.lifecycle = advanceProviderSession(this.lifecycle, 'TERMINATING');
    let terminationConfirmed = evidence.terminationConfirmed === true;
    try {
      if (this.context?.providerSessionId) {
        const terminated = await this.avatar.terminate({ sessionId: this.context.providerSessionId, reason, retry: NO_RETRY });
        terminationConfirmed = terminated?.confirmed === true;
      }
      await this.avatar.close?.();
      await this.agent.close?.();
      if (this.context?.dispatchId) await this.dispatch.delete({ dispatchId: this.context.dispatchId, retry: NO_RETRY });
      if (this.context?.roomName) await this.room.delete({ roomName: this.context.roomName, retry: NO_RETRY });
    } catch {
      terminationConfirmed = false;
    }
    this.lifecycle = advanceProviderSession(this.lifecycle, 'RECONCILING');
    if (this.context?.reservation?.id) {
      if (!this.context.providerSessionId && terminationConfirmed) {
        this.entitlementStore.refundBeforeProviderStart(this.context.reservation.id);
      } else {
        const explicitSeconds = Number(evidence.observedBillableSeconds);
        const observedBillableSeconds = Number.isFinite(explicitSeconds)
          ? explicitSeconds
          : Math.min(this.maxSeconds, Math.max(0, (this.now() - this.startedAtMs) / 1000));
        this.entitlementStore.reconcile({
          reservationId: this.context.reservation.id,
          observedBillableSeconds,
          terminationConfirmed,
        });
      }
    }
    this.lifecycle = terminationConfirmed
      ? advanceProviderSession(this.lifecycle, 'CLOSED')
      : advanceProviderSession(this.lifecycle, 'FAILED_CLOSED');
    return { ok: terminationConfirmed, lifecycle: this.lifecycle, reason };
  }
}
