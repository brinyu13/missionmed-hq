import { defineAgent, voice } from '@livekit/agents';
import { RoomEvent } from '@livekit/rtc-node';
import { createHash } from 'node:crypto';

import { profileBDurableGate } from './profile-b-durable-gate.mjs';
import { LemonSliceAvatarAdapter } from '../providers/lemonslice-avatar-adapter.mjs';
import { createOpenAiRealtimeModel } from '../providers/openai-realtime-adapter.mjs';
import { reconcileProviderCost } from '../providers/provider-cost-reconciler.mjs';
import { NO_RETRY, PROFILE_B_AGENT_NAME } from '../providers/provider-session-controller.mjs';
import { RENDERING_PROFILES } from '../providers/rendering-profile.mjs';

export const PROFILE_B_MAX_SECONDS = 45;
export const AGENT_SESSION_NO_RETRY = Object.freeze({
  sttConnOptions: NO_RETRY,
  llmConnOptions: NO_RETRY,
  ttsConnOptions: NO_RETRY,
  maxUnrecoverableErrors: 0,
});

const INTERVIEWER_INSTRUCTIONS = 'Conduct a concise IV preparation interview. Ask one question at a time, stay within the assigned scenario, and do not diagnose or provide medical advice.';

function providerSessionHash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function isExactClaim(claim, expected) {
  return claim?.ok === true
    && claim?.reconciliationReady === true
    && claim?.reservationNonce === expected.reservationNonce
    && claim?.dispatchId === expected.dispatchId
    && claim?.roomName === expected.roomName
    && claim?.agentName === PROFILE_B_AGENT_NAME
    && /^[A-Za-z0-9._:-]{1,120}$/u.test(String(claim?.reservationId || ''))
    && /^[A-Za-z0-9._:-]{1,120}$/u.test(String(claim?.participantIdentity || ''));
}

export function createProfileBAgentDefinition({
  agents = { defineAgent, voice },
  roomEvents = RoomEvent,
  createModel = createOpenAiRealtimeModel,
  createAvatar = (options) => new LemonSliceAvatarAdapter(options),
  durableGate = profileBDurableGate,
  environment = process.env,
  clock = globalThis,
  now = () => Date.now(),
} = {}) {
  return agents.defineAgent({
    entry: async (ctx) => {
      let agentSession = null;
      let avatar = null;
      let deadline = null;
      let participantDeadline = null;
      let startedAtMs = null;
      let claimed = false;
      let providerCreateAttempted = false;
      let workerJoinedRecorded = false;
      let claim = null;
      let providerHash = null;
      let teardownPromise = null;
      let sdkShutdownStarted = false;
      let terminalRequested = false;
      let terminalReason = null;
      let resolveTerminalSignal;
      let avatarCreatePromise = null;
      let agentSessionStartPromise = null;
      let claimPromise = null;
      let workerJoinedPromise = null;
      const terminationWatchAbort = new AbortController();
      const terminalSignal = new Promise((resolve) => { resolveTerminalSignal = resolve; });
      const reservationNonce = String(ctx.job?.metadata || '');
      const jobId = String(ctx.job?.id || '');
      const dispatchId = String(ctx.job?.dispatchId || '');
      const roomName = String(ctx.job?.room?.name || ctx.room?.name || '');
      const expectedClaim = { reservationNonce, dispatchId, roomName };

      const detachTerminalHandlers = () => {
        ctx.room.off(roomEvents.Reconnecting, onReconnect);
        ctx.room.off(roomEvents.Reconnected, onReconnect);
        ctx.room.off(roomEvents.Disconnected, onDisconnect);
        ctx.room.off(roomEvents.ParticipantDisconnected, onParticipantDisconnected);
      };

      const assertStartupActive = () => {
        if (terminalRequested) throw new Error('Worker startup is terminal.');
      };

      const awaitStartup = async (operation) => {
        assertStartupActive();
        const pending = Promise.resolve().then(() => {
          assertStartupActive();
          return operation();
        });
        const outcome = await Promise.race([
          pending.then(
            (value) => ({ value }),
            (error) => ({ error }),
          ),
          terminalSignal.then((reason) => ({ terminal: true, reason })),
        ]);
        if (outcome.terminal) throw new Error(`Worker startup stopped: ${outcome.reason}`);
        if (outcome.error) throw outcome.error;
        assertStartupActive();
        return outcome.value;
      };

      const beginTeardown = (reason = 'worker_terminal') => {
        if (!terminalRequested) {
          terminalRequested = true;
          terminalReason = String(reason || 'worker_terminal').slice(0, 40);
          resolveTerminalSignal(terminalReason);
          terminationWatchAbort.abort(terminalReason);
        }
        if (teardownPromise) return teardownPromise;
        teardownPromise = (async () => {
          if (deadline != null) clock.clearTimeout(deadline);
          if (participantDeadline != null) clock.clearTimeout(participantDeadline);
          detachTerminalHandlers();
          const cleanupFailures = [];
          const attempt = async (label, operation) => {
            try { return await operation(); }
            catch { cleanupFailures.push(label); return null; }
          };

          const agentSessionClose = attempt('agent_session_close', async () => agentSession?.close?.());
          if (avatarCreatePromise) {
            try { await avatarCreatePromise; } catch {}
          }
          if (avatar?.sessionId && !providerHash) providerHash = providerSessionHash(avatar.sessionId);
          let terminationAccepted = !providerCreateAttempted;
          let providerStatus = null;
          if (avatar?.sessionId) {
            const terminated = await attempt('avatar_terminate', () => avatar.terminate({
              sessionId: avatar.sessionId,
              reason: terminalReason,
              retry: NO_RETRY,
            }));
            terminationAccepted = terminated?.confirmed === true;
            providerStatus = await attempt('avatar_status', () => avatar.status({
              sessionId: avatar.sessionId,
              retry: NO_RETRY,
            }));
          }
          if (agentSessionStartPromise) {
            try { await agentSessionStartPromise; } catch {}
            await attempt('agent_session_post_start_close', async () => agentSession?.close?.());
          }
          if (claimPromise && !claimed) {
            try {
              const settledClaim = await claimPromise;
              if (/^[a-f0-9]{64}$/u.test(reservationNonce) && isExactClaim(settledClaim, expectedClaim)) {
                claim = settledClaim;
                claimed = true;
              }
            } catch {}
          }
          if (workerJoinedPromise) {
            try { workerJoinedRecorded = (await workerJoinedPromise)?.ok === true; } catch {}
          }
          await agentSessionClose;
          await attempt('avatar_close', async () => avatar?.close?.());

          const localElapsedSeconds = startedAtMs == null
            ? 0
            : Math.min(PROFILE_B_MAX_SECONDS, Math.max(0, (now() - startedAtMs) / 1000));
          const cost = reconcileProviderCost({ providerStatus, localElapsedSeconds });
          const unknownRemoteCreate = providerCreateAttempted && !providerHash;
          const terminationConfirmed = cleanupFailures.length === 0
            && !unknownRemoteCreate
            && (!providerCreateAttempted || (terminationAccepted && cost.costEvidence === 'VERIFIED'));
          let durableReconciled = !claimed;
          if (claimed) {
            const reconciled = await attempt('durable_reconcile', () => durableGate.reconcileJob({
              reservationId: claim.reservationId,
              reservationNonce,
              jobId,
              dispatchId,
              roomName,
              providerCreateAttempted,
              providerSessionHash: providerHash,
              workerJoinedRecorded,
              terminationAccepted,
              terminationConfirmed,
              providerStatus,
              cost,
              unknownRemoteCreate,
              cleanupFailures: Object.freeze([...cleanupFailures]),
            }));
            durableReconciled = reconciled?.ok === true;
            if (!durableReconciled && !cleanupFailures.includes('durable_reconcile')) cleanupFailures.push('durable_reconcile');
          }
          if (!sdkShutdownStarted) ctx.shutdown(terminalReason);
          return Object.freeze({
            ok: terminationConfirmed && durableReconciled && cleanupFailures.length === 0,
            terminationConfirmed,
            durableReconciled,
            cleanupFailures: Object.freeze([...cleanupFailures]),
          });
        })();
        return teardownPromise;
      };

      const requestTerminal = (reason) => beginTeardown(reason);
      const onReconnect = () => requestTerminal('transport_reconnect_prohibited');
      const onDisconnect = () => requestTerminal('transport_disconnected');
      const onParticipantDisconnected = (participant) => {
        if (participant?.identity === claim?.participantIdentity) return requestTerminal('authorized_participant_disconnected');
        return undefined;
      };

      ctx.room.on(roomEvents.Reconnecting, onReconnect);
      ctx.room.on(roomEvents.Reconnected, onReconnect);
      ctx.room.on(roomEvents.Disconnected, onDisconnect);
      ctx.room.on(roomEvents.ParticipantDisconnected, onParticipantDisconnected);
      ctx.addShutdownCallback(async () => {
        sdkShutdownStarted = true;
        await beginTeardown('sdk_shutdown_fallback');
      });

      try {
        claimPromise = Promise.resolve(durableGate.claimJob({
          reservationNonce,
          jobId,
          dispatchId,
          roomName,
          agentName: PROFILE_B_AGENT_NAME,
        }));
        claim = await claimPromise;
      } catch {
        await beginTeardown('reservation_not_authorized');
        return;
      }
      if (!/^[a-f0-9]{64}$/u.test(reservationNonce) || !isExactClaim(claim, expectedClaim)) {
        await beginTeardown('reservation_not_authorized');
        return;
      }
      claimed = true;
      if (terminalRequested) {
        await beginTeardown(terminalReason);
        return;
      }
      const terminationWatcher = Promise.resolve(durableGate.waitForTermination({
        reservationId: claim.reservationId,
        reservationNonce,
        jobId,
        dispatchId,
        roomName,
        signal: terminationWatchAbort.signal,
      })).then(
        (signal) => {
          if (signal?.requested === true) return beginTeardown(String(signal.reason || 'hq_termination_requested').slice(0, 40));
          return beginTeardown('termination_signal_uncertain');
        },
        () => beginTeardown('termination_signal_uncertain'),
      );
      void terminationWatcher;

      try {
        await awaitStartup(() => ctx.connect());
        const participant = await awaitStartup(() => Promise.race([
          ctx.waitForParticipant(claim.participantIdentity),
          new Promise((resolve, reject) => {
            participantDeadline = clock.setTimeout(() => reject(new Error('Authorized participant did not join.')), 10_000);
          }),
        ]));
        if (participantDeadline != null) clock.clearTimeout(participantDeadline);
        participantDeadline = null;
        if (participant?.identity !== claim.participantIdentity) throw new Error('Unexpected participant identity.');
        const model = await awaitStartup(() => createModel({
          apiKey: environment.OPENAI_API_KEY,
          profile: RENDERING_PROFILES.B,
        }));
        assertStartupActive();
        agentSession = new agents.voice.AgentSession({
          llm: model,
          vad: null,
          userAwayTimeout: null,
          turnHandling: { turnDetection: 'realtime_llm' },
          connOptions: AGENT_SESSION_NO_RETRY,
        });
        const interviewer = new agents.voice.Agent({ instructions: INTERVIEWER_INSTRUCTIONS, llm: model });
        avatar = createAvatar({
          apiKey: environment.LEMONSLICE_API_KEY,
          livekitUrl: environment.LIVEKIT_URL,
          livekitApiKey: environment.LIVEKIT_API_KEY,
          livekitApiSecret: environment.LIVEKIT_API_SECRET,
        });
        startedAtMs = now();
        deadline = clock.setTimeout(() => { void requestTerminal('authorized_deadline'); }, PROFILE_B_MAX_SECONDS * 1000);
        assertStartupActive();
        providerCreateAttempted = true;
        avatarCreatePromise = Promise.resolve().then(() => {
          assertStartupActive();
          return avatar.create({ agentSession, room: ctx.room });
        });
        const created = await avatarCreatePromise;
        if (avatar.sessionId) providerHash = providerSessionHash(avatar.sessionId);
        assertStartupActive();
        if (created?.avatarJoined !== true || !avatar.sessionId) throw new Error('Avatar join was not established.');
        agentSession.on(agents.voice.AgentSessionEventTypes.Error, () => { void requestTerminal('agent_session_error'); });
        agentSession.on(agents.voice.AgentSessionEventTypes.Close, () => { void requestTerminal('agent_session_closed'); });
        assertStartupActive();
        agentSessionStartPromise = agentSession.start({
          agent: interviewer,
          room: ctx.room,
          ...avatar.roomOptions(),
          record: false,
        });
        await agentSessionStartPromise;
        assertStartupActive();
        workerJoinedPromise = Promise.resolve(durableGate.markWorkerJoined({
          reservationId: claim.reservationId,
          reservationNonce,
          jobId,
          dispatchId,
          roomName,
          participantIdentity: claim.participantIdentity,
          providerSessionHash: providerHash,
          audioAuthority: 'avatar-livekit',
        }));
        const recorded = await workerJoinedPromise;
        assertStartupActive();
        if (recorded?.ok !== true) throw new Error('Worker join could not be recorded durably.');
        workerJoinedRecorded = true;
      } catch {
        await beginTeardown('worker_start_failed');
      }
    },
  });
}

export { PROFILE_B_AGENT_NAME };
export default createProfileBAgentDefinition();
