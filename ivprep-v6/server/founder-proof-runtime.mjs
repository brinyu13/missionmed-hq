import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { InMemoryAdmissionRegistry } from './admission-registry.mjs';
import { FounderPaidTestGate, FOUNDER_TEST_AVATAR_PARTICIPANT_ID } from './founder-paid-test-gate.mjs';
import { createIvPrepHqHandler } from './hq-mount.mjs';
import { PROFILE_B_AGENT_NAME, ProviderSessionController } from './providers/provider-session-controller.mjs';
import { InMemoryVideoEntitlementStore } from './video-entitlement-store.mjs';

const MAX_CONTROL_BODY_BYTES = 32 * 1024;

function safeId(value) {
  const id = String(value || '').trim();
  return /^[A-Za-z0-9._:-]{1,160}$/u.test(id) ? id : null;
}

function exactNonce(value) {
  const nonce = String(value || '').trim();
  return /^[a-f0-9]{64}$/u.test(nonce) ? nonce : null;
}

function sessionHash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function freezeResult(value) {
  return Object.freeze(structuredClone(value));
}

async function waitFor(check, { signal, timeoutMs = 12_000, intervalMs = 10 } = {}) {
  const started = Date.now();
  while (!signal?.aborted && Date.now() - started < timeoutMs) {
    const value = check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(signal?.aborted ? 'Founder proof observation aborted.' : 'Founder proof observation timed out.');
}

export class FounderProofDurableCoordinator {
  constructor() {
    this.jobs = new Map();
  }

  armJob(input = {}) {
    const reservationNonce = exactNonce(input.reservationNonce);
    const reservationId = safeId(input.reservationId);
    const subject = safeId(input.subject);
    const interviewId = safeId(input.interviewId);
    const roomName = safeId(input.roomName);
    const participantIdentity = safeId(input.participantIdentity);
    const avatarParticipantIdentity = safeId(input.avatarParticipantIdentity);
    if (!reservationNonce || !reservationId || !subject || !interviewId || !roomName || !participantIdentity
      || avatarParticipantIdentity !== FOUNDER_TEST_AVATAR_PARTICIPANT_ID
      || input.agentName !== PROFILE_B_AGENT_NAME
      || input.profile !== 'PROFILE_B_OPENAI_NATIVE_AUDIO'
      || !['marin', 'coral', 'shimmer'].includes(input.voice)
      || Number(input.maxSeconds) !== 45
      || this.jobs.has(reservationNonce)) return freezeResult({ ok: false });
    this.jobs.set(reservationNonce, {
      reservationNonce,
      reservationId,
      subject,
      interviewId,
      roomName,
      participantIdentity,
      avatarParticipantIdentity,
      agentName: PROFILE_B_AGENT_NAME,
      profile: input.profile,
      voice: input.voice,
      maxSeconds: 45,
      dispatchId: null,
      jobId: null,
      workerJoined: null,
      browserReady: null,
      termination: null,
      reconciliation: null,
    });
    return freezeResult({ ok: true });
  }

  bindDispatch(input = {}) {
    const record = this.jobs.get(exactNonce(input.reservationNonce));
    const dispatchId = safeId(input.dispatchId);
    if (!record || !dispatchId || record.reservationId !== input.reservationId
      || record.roomName !== input.roomName || record.participantIdentity !== input.participantIdentity
      || record.avatarParticipantIdentity !== input.avatarParticipantIdentity
      || (record.dispatchId && record.dispatchId !== dispatchId)) return freezeResult({ ok: false });
    record.dispatchId = dispatchId;
    return freezeResult({ ok: true });
  }

  claimJob(input = {}) {
    const record = this.jobs.get(exactNonce(input.reservationNonce));
    const dispatchId = safeId(input.dispatchId);
    const jobId = safeId(input.jobId);
    if (!record || !dispatchId || !jobId || input.roomName !== record.roomName
      || input.agentName !== record.agentName
      || (record.dispatchId && record.dispatchId !== dispatchId)
      || (record.jobId && record.jobId !== jobId)) return freezeResult({ ok: false });
    record.dispatchId = dispatchId;
    record.jobId = jobId;
    return freezeResult({
      ok: true,
      reconciliationReady: true,
      reservationId: record.reservationId,
      participantIdentity: record.participantIdentity,
      avatarParticipantIdentity: record.avatarParticipantIdentity,
      reservationNonce: record.reservationNonce,
      dispatchId: record.dispatchId,
      roomName: record.roomName,
      agentName: record.agentName,
      profile: record.profile,
      voice: record.voice,
      maxSeconds: record.maxSeconds,
    });
  }

  observeTermination(input = {}) {
    const record = this.#exactWorkerRecord(input);
    if (!record) return freezeResult({ ok: false });
    return freezeResult(record.termination || { ok: true, requested: false });
  }

  markWorkerJoined(input = {}) {
    const record = this.#exactWorkerRecord(input);
    if (!record || input.participantIdentity !== record.participantIdentity
      || input.avatarParticipantIdentity !== record.avatarParticipantIdentity
      || !/^[a-f0-9]{64}$/u.test(String(input.providerSessionHash || ''))
      || input.audioAuthority !== 'avatar-livekit') return freezeResult({ ok: false });
    record.workerJoined = {
      providerSessionHash: input.providerSessionHash,
      providerCreateAttempted: true,
      joinedAtMs: Number(input.joinedAtMs) || Date.now(),
    };
    return freezeResult({ ok: true });
  }

  recordBrowserMediaReady(input = {}) {
    const record = this.jobs.get(exactNonce(input.reservationNonce));
    if (!record || record.reservationId !== input.reservationId
      || record.dispatchId !== input.dispatchId || record.roomName !== input.roomName
      || record.participantIdentity !== input.participantIdentity
      || input.avatarParticipantIdentity !== record.avatarParticipantIdentity
      || record.subject !== input.subject
      || input.videoDecoded !== true || input.audioPlayable !== true
      || input.audioAuthority !== 'avatar-livekit') return freezeResult({ accepted: false });
    record.browserReady = {
      videoDecoded: true,
      audioPlayable: true,
      readyAtMs: Number(input.readyAtMs) || Date.now(),
    };
    return freezeResult({ accepted: true });
  }

  async awaitMediaReady(input = {}) {
    const record = this.jobs.get(exactNonce(input.reservationNonce));
    if (!record || record.reservationId !== input.reservationId
      || record.dispatchId !== input.dispatchId || record.roomName !== input.roomName
      || record.participantIdentity !== input.participantIdentity
      || record.avatarParticipantIdentity !== input.avatarParticipantIdentity) {
      throw new Error('Worker media binding mismatch.');
    }
    await waitFor(() => record.workerJoined && record.browserReady, { timeoutMs: 12_000 });
    return freezeResult({
      roomName: record.roomName,
      dispatchId: record.dispatchId,
      reservationNonce: record.reservationNonce,
      participantIdentity: record.participantIdentity,
      avatarParticipantIdentity: record.avatarParticipantIdentity,
      agentJoined: true,
      avatarCreateObserved: true,
      avatarJoined: true,
      agentSessionStarted: true,
      browserVideoDecoded: true,
      browserAudioPlayable: true,
      audioAuthority: 'avatar-livekit',
      mediaReady: true,
      providerSessionHash: record.workerJoined.providerSessionHash,
      milestones: Object.freeze({
        workerJoinedAtMs: record.workerJoined.joinedAtMs,
        browserMediaReadyAtMs: record.browserReady.readyAtMs,
      }),
    });
  }

  requestStop(input = {}) {
    const record = this.jobs.get(exactNonce(input.reservationNonce));
    if (!record || record.reservationId !== input.reservationId
      || record.dispatchId !== input.dispatchId || record.roomName !== input.roomName
      || record.participantIdentity !== input.participantIdentity
      || record.avatarParticipantIdentity !== input.avatarParticipantIdentity) return freezeResult({ accepted: false });
    if (!record.termination) record.termination = { ok: true, requested: true, reason: String(input.reason || 'hq_stop').slice(0, 40) };
    return freezeResult({ accepted: true });
  }

  reconcileJob(input = {}) {
    const record = this.#exactWorkerRecord(input);
    if (!record || record.reconciliation) return freezeResult({ ok: false });
    record.reconciliation = freezeResult({
      roomName: record.roomName,
      dispatchId: record.dispatchId,
      reservationNonce: record.reservationNonce,
      participantIdentity: record.participantIdentity,
      avatarParticipantIdentity: record.avatarParticipantIdentity,
      providerCreateAttempted: input.providerCreateAttempted === true,
      providerSessionHash: /^[a-f0-9]{64}$/u.test(String(input.providerSessionHash || '')) ? input.providerSessionHash : null,
      terminationConfirmed: input.terminationConfirmed === true,
      reconciled: true,
      providerStatus: input.providerStatus && typeof input.providerStatus === 'object' ? input.providerStatus : null,
      localElapsedSeconds: Math.max(0, Math.min(45, Number(input.cost?.localElapsedSeconds) || 0)),
      cleanupFailures: Array.isArray(input.cleanupFailures) ? input.cleanupFailures.slice(0, 20) : [],
    });
    return freezeResult({ ok: true });
  }

  async awaitReconciliation(input = {}) {
    const record = this.jobs.get(exactNonce(input.reservationNonce));
    if (!record || record.reservationId !== input.reservationId
      || record.dispatchId !== input.dispatchId || record.roomName !== input.roomName
      || record.participantIdentity !== input.participantIdentity
      || record.avatarParticipantIdentity !== input.avatarParticipantIdentity) {
      throw new Error('Worker reconciliation binding mismatch.');
    }
    return waitFor(() => record.reconciliation, { timeoutMs: 12_000 });
  }

  workerAdapter() {
    return Object.freeze({
      armJob: async (input) => this.armJob(input),
      bindDispatch: async (input) => this.bindDispatch(input),
      awaitMediaReady: async (input) => this.awaitMediaReady(input),
      recordBrowserMediaReady: async (input) => this.recordBrowserMediaReady(input),
      requestStop: async (input) => this.requestStop(input),
      awaitReconciliation: async (input) => this.awaitReconciliation(input),
      close: async () => {},
    });
  }

  handleWorkerOperation(operation, input) {
    if (operation === 'claim') return this.claimJob(input);
    if (operation === 'observe-termination') return this.observeTermination(input);
    if (operation === 'mark-joined') return this.markWorkerJoined(input);
    if (operation === 'reconcile') return this.reconcileJob(input);
    return freezeResult({ ok: false });
  }

  #exactWorkerRecord(input) {
    const record = this.jobs.get(exactNonce(input.reservationNonce));
    if (!record || record.reservationId !== input.reservationId
      || record.dispatchId !== input.dispatchId || record.roomName !== input.roomName
      || record.jobId !== input.jobId
      || record.avatarParticipantIdentity !== input.avatarParticipantIdentity) return null;
    return record;
  }
}

export function createSyntheticProviderDependencies({ coordinator = new FounderProofDurableCoordinator() } = {}) {
  let dispatchCount = 0;
  const worker = coordinator.workerAdapter();
  const originalBind = worker.bindDispatch;
  const syntheticWorker = Object.freeze({
    ...worker,
    bindDispatch: async (input) => {
      const bound = await originalBind(input);
      if (!bound.ok) return bound;
      const claim = coordinator.claimJob({
        reservationNonce: input.reservationNonce,
        dispatchId: input.dispatchId,
        roomName: input.roomName,
        agentName: PROFILE_B_AGENT_NAME,
        jobId: `synthetic-job-${dispatchCount}`,
      });
      coordinator.markWorkerJoined({
        ...claim,
        jobId: `synthetic-job-${dispatchCount}`,
        providerSessionHash: sessionHash(`synthetic-provider-${dispatchCount}`),
        avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
        audioAuthority: 'avatar-livekit',
        joinedAtMs: Date.now(),
      });
      return bound;
    },
    requestStop: async (input) => {
      const stopped = coordinator.requestStop(input);
      const record = coordinator.jobs.get(input.reservationNonce);
      if (record && !record.reconciliation) {
        coordinator.reconcileJob({
          reservationId: record.reservationId,
          reservationNonce: record.reservationNonce,
          jobId: record.jobId,
          dispatchId: record.dispatchId,
          roomName: record.roomName,
          avatarParticipantIdentity: record.avatarParticipantIdentity,
          providerCreateAttempted: false,
          providerSessionHash: record.workerJoined?.providerSessionHash,
          terminationConfirmed: true,
          providerStatus: null,
          cost: { localElapsedSeconds: 0 },
          cleanupFailures: [],
        });
      }
      return stopped;
    },
  });
  return Object.freeze({
    coordinator,
    liveKitSignalOrigin: null,
    room: Object.freeze({
      create: async () => ({ roomName: `synthetic-room-${randomUUID()}` }),
      delete: async () => {},
    }),
    participant: Object.freeze({
      issue: async ({ participantIdentity }) => ({
        url: 'wss://synthetic.invalid',
        token: randomBytes(48).toString('base64url'),
        participantIdentity,
        synthetic: true,
      }),
    }),
    dispatch: Object.freeze({
      create: async () => { dispatchCount += 1; return { dispatchId: `synthetic-dispatch-${dispatchCount}` }; },
      delete: async () => {},
    }),
    worker: syntheticWorker,
  });
}

export function createFounderProofRuntime({
  registry = new InMemoryAdmissionRegistry(),
  entitlementStore = new InMemoryVideoEntitlementStore(),
  paidTestGate = new FounderPaidTestGate(),
  providerDependencies = createSyntheticProviderDependencies(),
  now = () => Date.now(),
  idFactory = () => randomUUID(),
} = {}) {
  const armed = paidTestGate.armInfrastructure({
    terminationArmed: true,
    reconciliationArmed: true,
    singleSessionEnforced: true,
    zeroRetry: true,
    zeroReconnect: true,
    zeroRecreation: true,
  });
  if (!armed.ok) throw new Error('Founder proof infrastructure failed closed.');
  const providerControllerFactory = ({ paidTestAuthorization }) => new ProviderSessionController({
    entitlementStore,
    room: providerDependencies.room,
    participant: providerDependencies.participant,
    dispatch: providerDependencies.dispatch,
    worker: providerDependencies.worker,
    now,
    maxSeconds: paidTestAuthorization.maxSeconds,
    onTerminal: (evidence) => paidTestGate.finish(evidence),
  });
  const handler = createIvPrepHqHandler({
    registry,
    now,
    idFactory,
    flags: Object.freeze({ enabled: true, adminCanaryEnabled: true, videoEnabled: true }),
    providerControllerFactory,
    paidTestGate,
    liveKitSignalOrigin: providerDependencies.liveKitSignalOrigin,
  });
  return Object.freeze({
    registry,
    entitlementStore,
    paidTestGate,
    providerDependencies,
    handler,
    shutdown: async (reason = 'runtime_shutdown') => handler.shutdown(reason),
  });
}

async function readControlJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_CONTROL_BODY_BYTES) throw new Error('CONTROL_BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CONTROL_BODY_INVALID');
  return value;
}

export function createDurableWorkerHttpHandler({ coordinator, token } = {}) {
  if (!(coordinator instanceof FounderProofDurableCoordinator) || !/^[A-Za-z0-9_-]{32,256}$/u.test(String(token || ''))) {
    throw new TypeError('Exact local durable worker control authority is required.');
  }
  return async function handleDurableWorker(request, response, url) {
    const match = url?.pathname?.match(/^\/_3441r\/worker\/(claim|observe-termination|mark-joined|reconcile)$/u);
    if (!match) return false;
    if (request.method !== 'POST' || request.headers['x-ivprep-proof-token'] !== token) {
      response.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end('{"ok":false}');
      return true;
    }
    try {
      const input = await readControlJson(request);
      const result = coordinator.handleWorkerOperation(match[1], input);
      response.writeHead(result?.ok ? 200 : 409, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(result));
    } catch {
      response.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end('{"ok":false}');
    }
    return true;
  };
}
