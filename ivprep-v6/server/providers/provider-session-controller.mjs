import { createHash } from 'node:crypto';

import {
  FOUNDER_TEST_AGENT_ID,
  FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
  FOUNDER_TEST_PROFILE,
  FOUNDER_TEST_VOICES,
} from '../founder-paid-test-gate.mjs';
import { advanceProviderSession, failProviderSession, initialProviderSessionState } from './provider-session-state.mjs';
import { reconcileProviderCost } from './provider-cost-reconciler.mjs';

export const NO_RETRY = Object.freeze({
  maxRetry: 0,
  retryIntervalMs: 0,
  timeoutMs: 10_000,
});

export const PROFILE_B = 'PROFILE_B_OPENAI_NATIVE_AUDIO';
export const PROFILE_B_AGENT_NAME = 'ivprep-3440-profile-b';

function dispatchNonce({ reservationId, interviewId, subject }) {
  return createHash('sha256')
    .update('missionmed.ivprep.dispatch.v1\0')
    .update(String(reservationId || ''))
    .update('\0')
    .update(String(interviewId || ''))
    .update('\0')
    .update(String(subject || ''))
    .digest('hex');
}

function validWorkerReport(report, context) {
  return report?.reservationNonce === context.reservationNonce
    && report?.roomName === context.roomName
    && report?.dispatchId === context.dispatchId
    && report?.participantIdentity === context.participantIdentity
    && report?.avatarParticipantIdentity === context.avatarParticipantIdentity;
}

function validProviderHash(value) {
  return /^[a-f0-9]{64}$/u.test(String(value || ''));
}

function validPaidTestAuthorization(value, { subject, interviewId, idempotencyKey, maxSeconds }) {
  return value?.authorized === true
    && value?.consumed === true
    && value?.subject === subject
    && value?.interviewId === interviewId
    && value?.idempotencyKey === idempotencyKey
    && value?.agentId === FOUNDER_TEST_AGENT_ID
    && value?.avatarParticipantIdentity === FOUNDER_TEST_AVATAR_PARTICIPANT_ID
    && value?.profile === FOUNDER_TEST_PROFILE
    && FOUNDER_TEST_VOICES.has(value?.voice)
    && value?.maxSeconds === maxSeconds
    && value?.testNo === 1
    && value?.terminationArmed === true
    && value?.reconciliationArmed === true
    && value?.zeroRetry === true
    && value?.zeroReconnect === true
    && value?.zeroRecreation === true
    && /^[a-f0-9]{64}$/u.test(String(value?.authorizationBinding || ''));
}

export class ProviderSessionController {
  constructor({ entitlementStore, room, participant, dispatch, worker, onTerminal = null, clock = globalThis, now = () => Date.now(), maxSeconds = 45 } = {}) {
    this.entitlementStore = entitlementStore;
    this.room = room;
    this.participant = participant;
    this.dispatch = dispatch;
    this.worker = worker;
    this.clock = clock;
    this.now = now;
    this.maxSeconds = Math.min(45, Math.max(1, Math.trunc(maxSeconds)));
    this.onTerminal = onTerminal;
    this.lifecycle = initialProviderSessionState();
    this.context = null;
    this.deadline = null;
    this.teardownPromise = null;
    this.activationPromise = null;
    this.startedAtMs = null;
    this.authorization = null;
    this.terminalNotified = false;
  }

  async start({ subject, interviewId, idempotencyKey, testNo = 1, paidTestAuthorization = null } = {}) {
    if (this.lifecycle.state !== 'DISABLED') throw new Error('Provider session can start only once.');
    if (testNo !== 1) throw new Error('This controller is bounded to Engineering Test 1.');
    if (!validPaidTestAuthorization(paidTestAuthorization, { subject, interviewId, idempotencyKey, maxSeconds: this.maxSeconds })) {
      throw new Error('An exact consumed Founder Test 1 authorization is required.');
    }
    this.authorization = paidTestAuthorization;
    this.lifecycle = advanceProviderSession(this.lifecycle, 'ELIGIBLE');
    const reserved = this.entitlementStore.reserve({ subject, interviewId, requestedSeconds: this.maxSeconds, idempotencyKey, testNo });
    if (!reserved.ok) {
      this.lifecycle = failProviderSession(this.lifecycle, reserved.code);
      await this.#notifyTerminal({ providerCreateAttempted: false, terminationConfirmed: true, reconciliationConfirmed: true, reason: reserved.code });
      return { ok: false, code: reserved.code, lifecycle: this.lifecycle };
    }
    this.context = {
      subject,
      interviewId,
      reservation: reserved.reservation,
      reservationNonce: dispatchNonce({ reservationId: reserved.reservation.id, interviewId, subject }),
      roomName: null,
      participantIdentity: null,
      avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
      dispatchId: null,
      providerSessionHash: null,
      roomCreateAttempted: false,
      dispatchCreateAttempted: false,
      workerObservationAttempted: false,
      workerMediaReady: false,
    };
    this.lifecycle = advanceProviderSession(this.lifecycle, 'RESERVED');

    try {
      this.context.roomCreateAttempted = true;
      const createdRoom = await this.room.create({ interviewId, retry: NO_RETRY });
      this.context.roomName = createdRoom.roomName;
      this.lifecycle = advanceProviderSession(this.lifecycle, 'ROOM_CREATED');
      const participantIdentity = `ivp-${this.context.reservationNonce.slice(0, 48)}`;
      const access = await this.participant.issue({
        roomName: createdRoom.roomName,
        participantIdentity,
        avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
        maxSeconds: this.maxSeconds,
        retry: NO_RETRY,
      });
      if (access?.participantIdentity !== participantIdentity
        || !/^wss:\/\/[^/?#]+$/u.test(String(access?.url || ''))
        || typeof access?.token !== 'string'
        || access.token.length < 40
        || access.token.length > 4096) {
        throw new Error('Scoped browser room access was not established.');
      }
      this.context.participantIdentity = participantIdentity;
      if (typeof this.worker?.armJob !== 'function' || typeof this.worker?.bindDispatch !== 'function') {
        throw new Error('Durable worker authorization bridge is unavailable.');
      }
      const armed = await this.worker.armJob({
        reservationId: this.context.reservation.id,
        reservationNonce: this.context.reservationNonce,
        subject,
        interviewId,
        roomName: createdRoom.roomName,
        participantIdentity,
        avatarParticipantIdentity: this.context.avatarParticipantIdentity,
        agentName: PROFILE_B_AGENT_NAME,
        profile: this.authorization.profile,
        voice: this.authorization.voice,
        maxSeconds: this.maxSeconds,
        retry: NO_RETRY,
      });
      if (armed?.ok !== true) throw new Error('Durable worker authorization could not be armed.');
      this.context.dispatchCreateAttempted = true;
      this.startedAtMs = this.now();
      this.deadline = this.clock.setTimeout(() => { void this.stop('authorized_deadline'); }, this.maxSeconds * 1000);
      const createdDispatch = await this.dispatch.create({
        roomName: createdRoom.roomName,
        agentName: PROFILE_B_AGENT_NAME,
        reservationNonce: this.context.reservationNonce,
        restartPolicy: 'JRP_NEVER',
        retry: NO_RETRY,
      });
      this.context.dispatchId = createdDispatch.dispatchId;
      const dispatchBound = await this.worker.bindDispatch({
        reservationId: this.context.reservation.id,
        reservationNonce: this.context.reservationNonce,
        roomName: this.context.roomName,
        participantIdentity: this.context.participantIdentity,
        avatarParticipantIdentity: this.context.avatarParticipantIdentity,
        dispatchId: this.context.dispatchId,
        retry: NO_RETRY,
      });
      if (dispatchBound?.ok !== true) throw new Error('Durable dispatch binding could not be established.');
      this.lifecycle = advanceProviderSession(this.lifecycle, 'DISPATCH_CREATED');
      this.lifecycle = advanceProviderSession(this.lifecycle, 'AGENT_JOINING');
      this.activationPromise = this.#observeMediaReady();
      void this.activationPromise;
      return {
        ok: true,
        pending: true,
        lifecycle: this.lifecycle,
        reservationId: reserved.reservation.id,
        profile: PROFILE_B,
        proof: Object.freeze({
          agentId: this.authorization.agentId,
          profile: this.authorization.profile,
          voice: this.authorization.voice,
          maxSeconds: this.authorization.maxSeconds,
          audioAuthority: 'avatar-livekit',
          avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
        }),
        connection: Object.freeze({
          url: access.url,
          token: access.token,
          participantIdentity,
          avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
          synthetic: access.synthetic === true,
        }),
      };
    } catch (error) {
      await this.stop('start_failed');
      return { ok: false, code: 'provider_start_failed', lifecycle: this.lifecycle, message: 'Provider start failed closed.' };
    }
  }

  async #observeMediaReady() {
    try {
      this.context.workerObservationAttempted = true;
      const ready = await this.worker.awaitMediaReady({
        roomName: this.context.roomName,
        dispatchId: this.context.dispatchId,
        reservationNonce: this.context.reservationNonce,
        reservationId: this.context.reservation.id,
        participantIdentity: this.context.participantIdentity,
        avatarParticipantIdentity: this.context.avatarParticipantIdentity,
        subject: this.context.subject,
        interviewId: this.context.interviewId,
        maxSeconds: this.maxSeconds,
        retry: NO_RETRY,
      });
      if (!validWorkerReport(ready, this.context)
        || ready?.agentJoined !== true
        || ready?.avatarCreateObserved !== true
        || ready?.avatarJoined !== true
        || ready?.agentSessionStarted !== true
        || ready?.browserVideoDecoded !== true
        || ready?.browserAudioPlayable !== true
        || ready?.audioAuthority !== 'avatar-livekit'
        || ready?.mediaReady !== true
        || !validProviderHash(ready?.providerSessionHash)) {
        throw new Error('Durable worker and browser media readiness was not established.');
      }
      if (this.lifecycle.state !== 'AGENT_JOINING') return false;
      this.context.workerMediaReady = true;
      this.context.providerSessionHash = ready.providerSessionHash;
      this.lifecycle = advanceProviderSession(this.lifecycle, 'AVATAR_CREATING');
      this.lifecycle = advanceProviderSession(this.lifecycle, 'AVATAR_JOINED');
      this.entitlementStore.bindProvider({
        reservationId: this.context.reservation.id,
        dispatchId: this.context.dispatchId,
        providerSessionHash: ready.providerSessionHash,
      });
      this.lifecycle = advanceProviderSession(this.lifecycle, 'MEDIA_READY');
      this.lifecycle = advanceProviderSession(this.lifecycle, 'ACTIVE');
      return true;
    } catch {
      await this.stop('worker_start_failed');
      return false;
    }
  }

  async recordBrowserMediaReady({
    subject,
    cookieFingerprint,
    entitlementRevision,
    avatarParticipantIdentity,
    videoDecoded,
    audioPlayable,
    audioAuthority,
  } = {}) {
    if (this.lifecycle.state !== 'AGENT_JOINING' || subject !== this.context?.subject) return { ok: false };
    if (avatarParticipantIdentity !== this.context.avatarParticipantIdentity) return { ok: false };
    const recorded = await this.worker.recordBrowserMediaReady({
      reservationId: this.context.reservation.id,
      reservationNonce: this.context.reservationNonce,
      dispatchId: this.context.dispatchId,
      roomName: this.context.roomName,
      participantIdentity: this.context.participantIdentity,
      avatarParticipantIdentity: this.context.avatarParticipantIdentity,
      subject,
      cookieFingerprint,
      entitlementRevision,
      videoDecoded: videoDecoded === true,
      audioPlayable: audioPlayable === true,
      audioAuthority,
      retry: NO_RETRY,
    });
    return { ok: recorded?.accepted === true };
  }

  status() {
    return Object.freeze({ state: this.lifecycle.state, active: this.lifecycle.state === 'ACTIVE' });
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
    const failures = [];
    let workerStopAccepted = false;
    let workerReport = null;
    const attempt = async (label, operation) => {
      try { return await operation(); }
      catch { failures.push(label); return null; }
    };
    if (this.context?.dispatchId) {
      const stopped = await attempt('worker_stop', () => this.worker.requestStop({
        reservationNonce: this.context.reservationNonce,
        reservationId: this.context.reservation.id,
        dispatchId: this.context.dispatchId,
        roomName: this.context.roomName,
        participantIdentity: this.context.participantIdentity,
        avatarParticipantIdentity: this.context.avatarParticipantIdentity,
        reason,
        retry: NO_RETRY,
      }));
      workerStopAccepted = stopped?.accepted === true;
      workerReport = await attempt('worker_reconciliation', () => this.worker.awaitReconciliation({
        reservationNonce: this.context.reservationNonce,
        reservationId: this.context.reservation.id,
        dispatchId: this.context.dispatchId,
        roomName: this.context.roomName,
        participantIdentity: this.context.participantIdentity,
        avatarParticipantIdentity: this.context.avatarParticipantIdentity,
        retry: NO_RETRY,
      }));
    }
    await attempt('worker_close', async () => this.worker?.close?.());
    if (this.context?.dispatchId) {
      await attempt('dispatch_delete', () => this.dispatch.delete({
        dispatchId: this.context.dispatchId,
        roomName: this.context.roomName,
        retry: NO_RETRY,
      }));
    }
    if (this.context?.roomName) {
      await attempt('room_delete', () => this.room.delete({ roomName: this.context.roomName, retry: NO_RETRY }));
    }
    const localElapsedSeconds = this.startedAtMs == null
      ? 0
      : Math.min(this.maxSeconds, Math.max(0, (this.now() - this.startedAtMs) / 1000));
    const reportedElapsed = Number(workerReport?.localElapsedSeconds);
    const reconciledElapsed = Number.isFinite(reportedElapsed)
      ? Math.max(localElapsedSeconds, Math.min(this.maxSeconds, Math.max(0, reportedElapsed)))
      : localElapsedSeconds;
    const cost = reconcileProviderCost({ providerStatus: workerReport?.providerStatus, localElapsedSeconds: reconciledElapsed });
    const unknownRemoteCreate = Boolean(
      (this.context?.roomCreateAttempted && !this.context.roomName)
      || (this.context?.dispatchCreateAttempted && !this.context.dispatchId)
    );
    const noProviderCreate = workerReport?.providerCreateAttempted === false;
    const durableWorkerReconciled = validWorkerReport(workerReport, this.context)
      && workerReport?.reconciled === true
      && workerReport?.terminationConfirmed === true
      && (noProviderCreate || cost.costEvidence === 'VERIFIED')
      && (!workerReport?.providerSessionHash || validProviderHash(workerReport.providerSessionHash));
    if (workerReport?.providerSessionHash && this.context?.dispatchId) {
      this.context.providerSessionHash = workerReport.providerSessionHash;
      await attempt('reservation_bind', async () => this.entitlementStore.bindProvider({
        reservationId: this.context.reservation.id,
        dispatchId: this.context.dispatchId,
        providerSessionHash: workerReport.providerSessionHash,
      }));
    }
    let terminationConfirmed = failures.length === 0
      && !unknownRemoteCreate
      && (!this.context?.dispatchCreateAttempted || (workerStopAccepted && durableWorkerReconciled));
    this.lifecycle = advanceProviderSession(this.lifecycle, 'RECONCILING');
    if (this.context?.reservation?.id) {
      if (!this.context.dispatchCreateAttempted && terminationConfirmed) {
        this.entitlementStore.refundBeforeProviderStart(this.context.reservation.id);
      } else {
        this.entitlementStore.reconcile({
          reservationId: this.context.reservation.id,
          observedBillableSeconds: cost.localElapsedSeconds,
          terminationConfirmed,
        });
      }
    }
    const terminalAudit = await this.#notifyTerminal({
      providerCreateAttempted: workerReport?.providerCreateAttempted === true,
      terminationConfirmed,
      reconciliationConfirmed: durableWorkerReconciled,
      reason,
    });
    if (!terminalAudit) terminationConfirmed = false;
    this.lifecycle = terminationConfirmed
      ? advanceProviderSession(this.lifecycle, 'CLOSED')
      : advanceProviderSession(this.lifecycle, 'FAILED_CLOSED');
    return { ok: terminationConfirmed, lifecycle: this.lifecycle, reason, cost, cleanupFailures: Object.freeze(failures) };
  }

  async #notifyTerminal(evidence) {
    if (this.terminalNotified) return true;
    this.terminalNotified = true;
    if (typeof this.onTerminal !== 'function') return false;
    try { return (await this.onTerminal({ authorizationId: this.authorization?.authorizationId, ...evidence }))?.ok === true; }
    catch { return false; }
  }
}
