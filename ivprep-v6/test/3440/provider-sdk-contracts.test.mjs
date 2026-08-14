import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  LemonSliceAvatarAdapter,
  LEMONSLICE_API_URL,
} from '../../server/providers/lemonslice-avatar-adapter.mjs';
import { createLiveKitSessionCoordinator } from '../../server/providers/livekit-session-coordinator.mjs';
import { createOpenAiRealtimeModel, strictRealtimeModelClass } from '../../server/providers/openai-realtime-adapter.mjs';
import { NO_RETRY, PROFILE_B_AGENT_NAME } from '../../server/providers/provider-session-controller.mjs';
import { FOUNDER_TEST_AVATAR_PARTICIPANT_ID } from '../../server/founder-paid-test-gate.mjs';
import { RENDERING_PROFILES } from '../../server/providers/rendering-profile.mjs';

const PINNED_AGENTS_AVAILABLE = existsSync(new URL('../../node_modules/@livekit/agents/package.json', import.meta.url));
const PINNED_OPENAI_AVAILABLE = existsSync(new URL('../../node_modules/@livekit/agents-plugin-openai/package.json', import.meta.url));

async function createProfileBRaceHarness({ waitForTermination, connect, avatar, startAgentSession = async () => {} }) {
  const { createProfileBAgentDefinition } = await import('../../server/agents/profile-b-agent.mjs');
  const calls = [];
  const handlers = new Map();
  const shutdownCallbacks = [];
  let observedTerminationSignal = null;
  avatar.avatarIdentity ||= FOUNDER_TEST_AVATAR_PARTICIPANT_ID;
  if (typeof avatar.create === 'function') {
    const create = avatar.create.bind(avatar);
    avatar.create = async (...args) => {
      const result = await create(...args);
      return result?.avatarJoined === true
        ? { ...result, avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID }
        : result;
    };
  }
  if (typeof avatar.waitForTerminal !== 'function' && typeof avatar.status === 'function') {
    avatar.waitForTerminal = avatar.status.bind(avatar);
  }
  class AgentSession {
    on() {}
    async start() { calls.push(['session.start']); return startAgentSession(); }
    async close() { calls.push(['session.close']); }
  }
  class Agent {}
  const definition = createProfileBAgentDefinition({
    agents: {
      defineAgent: (value) => value,
      voice: { AgentSession, Agent, AgentSessionEventTypes: { Error: 'error', Close: 'close' } },
    },
    roomEvents: { Reconnecting: 'reconnecting', Reconnected: 'reconnected', Disconnected: 'disconnected', ParticipantDisconnected: 'participant-disconnected' },
    createModel: async () => ({ model: 'synthetic' }),
    createAvatar: () => avatar,
    durableGate: {
      claimJob: async (claim) => ({
        ok: true,
        reconciliationReady: true,
        reservationId: 'reservation-race-1',
        participantIdentity: 'wp-race-browser',
        reservationNonce: claim.reservationNonce,
        dispatchId: claim.dispatchId,
        roomName: claim.roomName,
        agentName: claim.agentName,
        profile: RENDERING_PROFILES.B.id,
        voice: 'marin',
        maxSeconds: 45,
      }),
      waitForTermination: async (binding) => {
        observedTerminationSignal = binding.signal;
        return waitForTermination(binding);
      },
      markWorkerJoined: async () => { calls.push(['worker.joined']); return { ok: true }; },
      reconcileJob: async (evidence) => { calls.push(['job.reconcile', evidence]); return { ok: true }; },
    },
    environment: {
      OPENAI_API_KEY: 'synthetic-openai',
      LEMONSLICE_API_KEY: 'synthetic-lemon',
      LIVEKIT_URL: 'wss://example.livekit.cloud',
      LIVEKIT_API_KEY: 'synthetic-livekit',
      LIVEKIT_API_SECRET: 'synthetic-secret',
    },
    clock: { setTimeout: () => 1, clearTimeout: () => {} },
    teardownBudgetMs: 50,
  });
  const ctx = {
    job: {
      id: 'job-race-1',
      metadata: 'd'.repeat(64),
      dispatchId: 'dispatch-race-1',
      agentName: PROFILE_B_AGENT_NAME,
      room: { name: 'room-race-1' },
    },
    room: {
      name: 'room-race-1',
      on: (event, handler) => handlers.set(event, handler),
      off: (event) => handlers.delete(event),
    },
    connect,
    waitForParticipant: async () => ({ identity: 'wp-race-browser' }),
    addShutdownCallback: (callback) => shutdownCallbacks.push(callback),
    shutdown: (reason) => calls.push(['ctx.shutdown', reason]),
  };
  return {
    calls,
    entryPromise: definition.entry(ctx),
    getObservedTerminationSignal: () => observedTerminationSignal,
    shutdownCallbacks,
  };
}

test('LiveKit coordinator uses one exact named JRP_NEVER dispatch and room-bound deletion', async () => {
  const calls = [];
  class RoomServiceClient {
    async createRoom(options) { calls.push(['room.create', options]); }
    async deleteRoom(roomName) { calls.push(['room.delete', roomName]); }
  }
  class AgentDispatchClient {
    async createDispatch(roomName, agentName, options) {
      calls.push(['dispatch.create', roomName, agentName, options]);
      return { id: 'dispatch-exact' };
    }
    async deleteDispatch(dispatchId, roomName) { calls.push(['dispatch.delete', dispatchId, roomName]); }
  }
  class AccessToken {
    constructor(apiKey, apiSecret, options) { calls.push(['token.construct', apiKey, apiSecret, options]); }
    addGrant(grant) { calls.push(['token.grant', grant]); }
    async toJwt() { calls.push(['token.jwt']); return 'synthetic-room-token'.padEnd(64, 'x'); }
  }
  const coordinator = await createLiveKitSessionCoordinator({
    url: 'wss://example.livekit.cloud',
    apiKey: 'synthetic-key',
    apiSecret: 'synthetic-secret',
    livekitModule: { RoomServiceClient, AgentDispatchClient, AccessToken, JobRestartPolicy: { JRP_NEVER: 'sdk-jrp-never' } },
  });
  const room = await coordinator.room.create();
  const access = await coordinator.participant.issue({ roomName: room.roomName, participantIdentity: 'ivp-browser-1', maxSeconds: 45 });
  const nonce = 'a'.repeat(64);
  const dispatch = await coordinator.dispatch.create({
    roomName: room.roomName,
    agentName: PROFILE_B_AGENT_NAME,
    reservationNonce: nonce,
    restartPolicy: 'JRP_NEVER',
  });
  await coordinator.dispatch.delete({ dispatchId: dispatch.dispatchId, roomName: room.roomName });
  await coordinator.room.delete({ roomName: room.roomName });
  const created = calls.find(([name]) => name === 'dispatch.create');
  assert.equal(created[2], PROFILE_B_AGENT_NAME);
  assert.deepEqual(created[3], { metadata: nonce, restartPolicy: 'sdk-jrp-never' });
  assert.deepEqual(calls.find(([name]) => name === 'dispatch.delete').slice(1), ['dispatch-exact', room.roomName]);
  assert.equal(calls.filter(([name]) => name === 'dispatch.create').length, 1);
  assert.equal(access.url, 'wss://example.livekit.cloud');
  assert.equal(coordinator.signalOrigin, 'wss://example.livekit.cloud');
  assert.equal(access.participantIdentity, 'ivp-browser-1');
  assert.deepEqual(calls.find(([name]) => name === 'token.grant')[1], {
    room: room.roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: false,
    canSubscribe: true,
  });
});

test('LiveKit coordinator enforces one bounded SDK attempt', async () => {
  class RoomServiceClient {
    async createRoom() { return new Promise(() => {}); }
  }
  class AgentDispatchClient {}
  class AccessToken {}
  const coordinator = await createLiveKitSessionCoordinator({
    url: 'wss://example.livekit.cloud',
    apiKey: 'synthetic-key',
    apiSecret: 'synthetic-secret',
    operationTimeoutMs: 5,
    livekitModule: {
      RoomServiceClient,
      AgentDispatchClient,
      AccessToken,
      JobRestartPolicy: { JRP_NEVER: 'sdk-jrp-never' },
    },
  });
  await assert.rejects(coordinator.room.create(), /timed out/u);
});

test('LemonSlice adapter matches pinned start, readiness, termination, authentication, and status contracts', async () => {
  const calls = [];
  class FakeAvatarSession {
    constructor(options) {
      this.options = options;
      this.avatarIdentity = options.avatarParticipantIdentity;
      calls.push(['construct', options]);
    }
    async start(agentSession, room, options) {
      calls.push(['start', agentSession, room, options]);
      this.sessionId = 'provider-session-1';
      return this.sessionId;
    }
    async waitForJoin(options) { calls.push(['waitForJoin', options]); }
    roomOptions() { return { outputOptions: { audioEnabled: true } }; }
    async aclose() { calls.push(['close']); }
  }
  const fetchCalls = [];
  const fetchImpl = async (url, options) => {
    fetchCalls.push([url, options]);
    if (options.method === 'POST') return { ok: true, status: 200, json: async () => ({ success: true }) };
    return { ok: true, status: 200, json: async () => ({ session_status: 'COMPLETED', cost: 2.5, ignored_raw_field: 'never projected' }) };
  };
  const adapter = new LemonSliceAvatarAdapter({
    apiKey: 'synthetic-lemon-key',
    livekitUrl: 'wss://example.livekit.cloud',
    livekitApiKey: 'synthetic-livekit-key',
    livekitApiSecret: 'synthetic-livekit-secret',
    fetchImpl,
    avatarSessionFactory: FakeAvatarSession,
  });
  const agentSession = { output: { audio: null } };
  const room = { name: 'room-1' };
  const created = await adapter.create({ agentSession, room });
  assert.deepEqual(created, {
    sessionId: 'provider-session-1',
    avatarJoined: true,
    avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
  });
  assert.equal(calls[0][1].idleTimeout, 45);
  assert.equal(calls[0][1].apiUrl, LEMONSLICE_API_URL);
  assert.equal(calls[0][1].avatarParticipantIdentity, FOUNDER_TEST_AVATAR_PARTICIPANT_ID);
  assert.deepEqual(calls[0][1].connOptions, NO_RETRY);
  assert.deepEqual(calls[1].slice(1), [agentSession, room, {
    livekitUrl: 'wss://example.livekit.cloud',
    livekitApiKey: 'synthetic-livekit-key',
    livekitApiSecret: 'synthetic-livekit-secret',
  }]);
  assert.deepEqual(calls[2], ['waitForJoin', { timeout: 10_000 }]);
  assert.deepEqual(adapter.roomOptions(), { outputOptions: { audioEnabled: true } });
  assert.equal((await adapter.terminate({ sessionId: created.sessionId })).confirmed, true);
  const status = await adapter.status({ sessionId: created.sessionId });
  assert.deepEqual(status, { ok: true, status: 200, sessionStatus: 'COMPLETED', cost: 2.5 });
  assert.deepEqual(await adapter.waitForTerminal({ sessionId: created.sessionId }), status);
  assert.equal(fetchCalls[0][1].headers['X-API-Key'], 'synthetic-lemon-key');
  assert.equal('Authorization' in fetchCalls[0][1].headers, false);
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), { event: 'terminate' });
  assert.equal(fetchCalls[1][1].headers['X-API-Key'], 'synthetic-lemon-key');
});

test('LemonSlice adapter retains an in-flight session identifier through local close and failed join', async () => {
  let announceJoin;
  let releaseJoin;
  let closeCalls = 0;
  const joinStarted = new Promise((resolve) => { announceJoin = resolve; });
  const joinPending = new Promise((resolve) => { releaseJoin = resolve; });
  class InFlightAvatarSession {
    constructor(options) {
      this.avatarIdentity = options.avatarParticipantIdentity;
      this.sessionId = null;
    }
    async start() {
      this.sessionId = 'provider-inflight-retained-1';
      return this.sessionId;
    }
    async waitForJoin() {
      announceJoin();
      await joinPending;
      throw new Error('avatar_join_lost');
    }
    async aclose() { closeCalls += 1; }
  }
  const fetchCalls = [];
  const adapter = new LemonSliceAvatarAdapter({
    apiKey: 'synthetic-lemon-key',
    livekitUrl: 'wss://example.livekit.cloud',
    livekitApiKey: 'synthetic-livekit-key',
    livekitApiSecret: 'synthetic-livekit-secret',
    fetchImpl: async (url, options) => {
      fetchCalls.push([url, options]);
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
    avatarSessionFactory: InFlightAvatarSession,
  });
  const createPending = adapter.create({ agentSession: {}, room: { name: 'room-race' } });
  await joinStarted;
  await adapter.close();
  assert.equal(adapter.sessionId, 'provider-inflight-retained-1');
  releaseJoin();
  await assert.rejects(createPending, /avatar_join_lost/u);
  assert.equal(adapter.sessionId, 'provider-inflight-retained-1');
  assert.equal(closeCalls, 1);
  assert.equal((await adapter.terminate({ sessionId: adapter.sessionId })).confirmed, true);
  assert.match(fetchCalls[0][0], /provider-inflight-retained-1\/control$/u);
});

test('OpenAI Realtime adapter uses exact low reasoning and zero retries', async () => {
  let captured;
  class RealtimeModel { constructor(options) { captured = options; } }
  class RealtimeSession {
    constructor(model) { this.model = model; }
    async runWs() {}
    async close() {}
  }
  await createOpenAiRealtimeModel({
    apiKey: 'synthetic-openai-key',
    profile: RENDERING_PROFILES.B,
    openaiModule: { realtime: { RealtimeModel, RealtimeSession } },
  });
  assert.deepEqual(captured.reasoning, { effort: 'low' });
  assert.equal('reasoningEffort' in captured, false);
  assert.equal(captured.model, 'gpt-realtime-2.1');
  assert.equal(captured.voice, 'marin');
  assert.deepEqual(captured.turnDetection, { type: 'semantic_vad', eagerness: 'auto' });
  assert.deepEqual(captured.connOptions, NO_RETRY);
  assert.equal(captured.maxSessionDuration, 45_000);
});

test('OpenAI strict session makes an unexpected clean close fatal and permits intentional close', async () => {
  let wsRuns = 0;
  class RealtimeSession {
    constructor(model) { this.model = model; }
    async runWs() { wsRuns += 1; }
    async close() {}
  }
  class RealtimeModel {}
  const StrictModel = strictRealtimeModelClass({ RealtimeModel, RealtimeSession });
  const model = new StrictModel();
  const unexpected = model.session();
  await assert.rejects(unexpected.runWs({}), /reconnect is prohibited/u);
  assert.equal(wsRuns, 1);
  const intentional = model.session();
  await intentional.close();
  await intentional.runWs({});
  assert.equal(wsRuns, 2);
});

test('pinned OpenAI 1.6.2 loop still dispatches through the strict runWs seam', { skip: !PINNED_OPENAI_AVAILABLE }, async () => {
  const [manifest, source] = await Promise.all([
    readFile(new URL('../../node_modules/@livekit/agents-plugin-openai/package.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../../node_modules/@livekit/agents-plugin-openai/dist/realtime/realtime_model.js', import.meta.url), 'utf8'),
  ]);
  assert.equal(manifest.version, '1.6.2');
  const mainLoop = source.indexOf('while (!this.#closed && !signal.aborted)');
  const connection = source.indexOf('wsConn = await this.createWsConn()', mainLoop);
  const dispatch = source.indexOf('await this.runWs(wsConn)', connection);
  const reconnect = source.lastIndexOf('this.emit("session_reconnected"', mainLoop);
  assert.ok(mainLoop >= 0);
  assert.ok(connection >= 0);
  assert.ok(dispatch > connection);
  assert.ok(reconnect >= 0 && reconnect < connection);
  assert.match(source, /class RealtimeSession extends llm\.RealtimeSession/u);
});

test('Profile B AgentServer and AgentSession are explicit, terminal on reconnect, and zero retry', { skip: !PINNED_AGENTS_AVAILABLE }, async () => {
  const [{ createProfileBAgentDefinition, AGENT_SESSION_NO_RETRY }, { createProfileBServerOptions }] = await Promise.all([
    import('../../server/agents/profile-b-agent.mjs'),
    import('../../server/agents/start-profile-b-worker.mjs'),
  ]);
  const calls = [];
  const handlers = new Map();
  const shutdownCallbacks = [];
  class AgentSession {
    constructor(options) { this.options = options; this.handlers = new Map(); calls.push(['session.construct', options]); }
    on(event, handler) { this.handlers.set(event, handler); }
    async start(options) { calls.push(['session.start', options]); }
    async close() { calls.push(['session.close']); }
  }
  class Agent { constructor(options) { calls.push(['agent.construct', options]); } }
  const fakeAgents = {
    defineAgent: (definition) => definition,
    voice: { AgentSession, Agent, AgentSessionEventTypes: { Error: 'error', Close: 'close' } },
  };
  const avatar = {
    sessionId: 'provider-worker-1',
    avatarIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
    create: async (options) => {
      calls.push(['avatar.create', options]);
      return {
        sessionId: 'provider-worker-1',
        avatarJoined: true,
        avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
      };
    },
    roomOptions: () => ({ outputOptions: { audioEnabled: true } }),
    terminate: async () => { calls.push(['avatar.terminate']); return { confirmed: true }; },
    waitForTerminal: async () => { calls.push(['avatar.terminal']); return { ok: true, sessionStatus: 'COMPLETED', cost: 1 }; },
    close: async () => calls.push(['avatar.close']),
  };
  const definition = createProfileBAgentDefinition({
    agents: fakeAgents,
    roomEvents: { Reconnecting: 'reconnecting', Reconnected: 'reconnected', Disconnected: 'disconnected', ParticipantDisconnected: 'participant-disconnected' },
    createModel: async () => ({ model: 'synthetic' }),
    createAvatar: () => avatar,
    durableGate: {
      claimJob: async (claim) => {
        calls.push(['job.claim', claim]);
        return {
          ok: true,
          reconciliationReady: true,
          reservationId: 'reservation-worker-1',
          participantIdentity: 'wp-1-browser',
          reservationNonce: claim.reservationNonce,
          dispatchId: claim.dispatchId,
          roomName: claim.roomName,
          agentName: claim.agentName,
          profile: RENDERING_PROFILES.B.id,
          voice: 'marin',
          maxSeconds: 45,
        };
      },
      waitForTermination: async () => new Promise(() => {}),
      markWorkerJoined: async (evidence) => { calls.push(['worker.joined', evidence]); return { ok: true }; },
      reconcileJob: async (evidence) => { calls.push(['job.reconcile', evidence]); return { ok: true }; },
    },
    environment: {
      OPENAI_API_KEY: 'synthetic-openai',
      LEMONSLICE_API_KEY: 'synthetic-lemon',
      LIVEKIT_URL: 'wss://example.livekit.cloud',
      LIVEKIT_API_KEY: 'synthetic-livekit',
      LIVEKIT_API_SECRET: 'synthetic-secret',
    },
    clock: { setTimeout: () => 1, clearTimeout: () => {} },
  });
  const room = {
    name: 'room-worker-1',
    on: (event, handler) => handlers.set(event, handler),
    off: (event) => handlers.delete(event),
  };
  const ctx = {
    job: {
      id: 'job-1',
      metadata: 'a'.repeat(64),
      dispatchId: 'dispatch-worker-1',
      agentName: PROFILE_B_AGENT_NAME,
      room: { name: 'room-worker-1' },
    },
    room,
    connect: async () => calls.push(['ctx.connect']),
    waitForParticipant: async (identity) => { calls.push(['participant.wait', identity]); return { identity }; },
    addShutdownCallback: (callback) => shutdownCallbacks.push(callback),
    shutdown: (reason) => calls.push(['ctx.shutdown', reason]),
  };
  await definition.entry(ctx);
  assert.deepEqual(calls.find(([name]) => name === 'session.construct')[1].connOptions, AGENT_SESSION_NO_RETRY);
  assert.ok(calls.findIndex(([name]) => name === 'avatar.create') < calls.findIndex(([name]) => name === 'session.start'));
  assert.ok(calls.findIndex(([name]) => name === 'participant.wait') < calls.findIndex(([name]) => name === 'avatar.create'));
  await handlers.get('reconnecting')();
  assert.deepEqual(calls.find(([name]) => name === 'ctx.shutdown'), ['ctx.shutdown', 'transport_reconnect_prohibited']);
  await shutdownCallbacks[0]();
  assert.ok(calls.findIndex(([name]) => name === 'session.close') < calls.findIndex(([name]) => name === 'avatar.terminate'));
  assert.equal(calls.filter(([name]) => name === 'avatar.terminate').length, 1);
  assert.equal(calls.filter(([name]) => name === 'avatar.terminal').length, 1);
  const reconciliation = calls.find(([name]) => name === 'job.reconcile')[1];
  assert.equal(reconciliation.jobId, 'job-1');
  assert.equal(reconciliation.dispatchId, 'dispatch-worker-1');
  assert.equal(reconciliation.roomName, 'room-worker-1');
  assert.match(reconciliation.providerSessionHash, /^[a-f0-9]{64}$/u);

  const options = createProfileBServerOptions({
    wsURL: 'wss://example.livekit.cloud',
    apiKey: 'synthetic-key',
    apiSecret: 'synthetic-secret',
  });
  assert.equal(options.agentName, PROFILE_B_AGENT_NAME);
  assert.equal(options.maxRetry, 0);
  assert.equal(options.shutdownProcessTimeout, 20_000);
});

test('Profile B terminal signal before provider creation cannot resume startup', { skip: !PINNED_AGENTS_AVAILABLE }, async () => {
  let releaseConnect;
  let providerCreateCalls = 0;
  const connectPending = new Promise((resolve) => { releaseConnect = resolve; });
  const avatar = {
    sessionId: null,
    create: async () => { providerCreateCalls += 1; throw new Error('Provider creation must not run.'); },
    close: async () => {},
  };
  const harness = await createProfileBRaceHarness({
    waitForTermination: async () => ({ requested: true, reason: 'user_ended' }),
    connect: async () => connectPending,
    avatar,
  });
  await harness.entryPromise;
  releaseConnect();
  await Promise.resolve();
  assert.equal(harness.getObservedTerminationSignal().aborted, true);
  assert.equal(providerCreateCalls, 0);
  assert.equal(harness.calls.some(([name]) => name === 'session.start'), false);
  assert.equal(harness.calls.filter(([name]) => name === 'job.reconcile').length, 1);
  assert.deepEqual(harness.calls.at(-1), ['ctx.shutdown', 'user_ended']);
});

test('Profile B teardown owns an in-flight avatar create and terminates it before reconciliation', { skip: !PINNED_AGENTS_AVAILABLE }, async () => {
  let resolveTermination;
  let resolveAvatarCreate;
  let announceAvatarCreate;
  let terminateCalls = 0;
  const termination = new Promise((resolve) => { resolveTermination = resolve; });
  const avatarCreateStarted = new Promise((resolve) => { announceAvatarCreate = resolve; });
  const avatar = {
    sessionId: null,
    create: async () => {
      announceAvatarCreate();
      return new Promise((resolve) => { resolveAvatarCreate = resolve; });
    },
    roomOptions: () => ({}),
    terminate: async () => { terminateCalls += 1; return { confirmed: true }; },
    status: async () => ({ ok: true, sessionStatus: 'COMPLETED', cost: 1 }),
    close: async () => {},
  };
  const harness = await createProfileBRaceHarness({
    waitForTermination: async () => termination,
    connect: async () => {},
    avatar,
  });
  await avatarCreateStarted;
  resolveTermination({ requested: true, reason: 'user_ended' });
  avatar.sessionId = 'provider-race-1';
  resolveAvatarCreate({ sessionId: avatar.sessionId, avatarJoined: true });
  await harness.entryPromise;
  assert.equal(harness.getObservedTerminationSignal().aborted, true);
  assert.equal(terminateCalls, 1);
  assert.equal(harness.calls.some(([name]) => name === 'session.start'), false);
  const reconciled = harness.calls.findIndex(([name]) => name === 'job.reconcile');
  const shutdown = harness.calls.findIndex(([name]) => name === 'ctx.shutdown');
  assert.ok(reconciled >= 0 && reconciled < shutdown);
  assert.equal(harness.calls.filter(([name]) => name === 'job.reconcile').length, 1);
  assert.match(harness.calls[reconciled][1].providerSessionHash, /^[a-f0-9]{64}$/u);
});

test('Profile B teardown fails closed when avatar creation never settles', { skip: !PINNED_AGENTS_AVAILABLE }, async () => {
  let resolveTermination;
  let announceAvatarCreate;
  const termination = new Promise((resolve) => { resolveTermination = resolve; });
  const avatarCreateStarted = new Promise((resolve) => { announceAvatarCreate = resolve; });
  let closeCalls = 0;
  const avatar = {
    sessionId: null,
    create: async () => {
      announceAvatarCreate();
      return new Promise(() => {});
    },
    close: async () => { closeCalls += 1; },
  };
  const harness = await createProfileBRaceHarness({
    waitForTermination: async () => termination,
    connect: async () => {},
    avatar,
  });
  await avatarCreateStarted;
  resolveTermination({ requested: true, reason: 'user_ended' });
  await harness.entryPromise;
  const evidence = harness.calls.find(([name]) => name === 'job.reconcile')[1];
  assert.equal(evidence.providerCreateAttempted, true);
  assert.equal(evidence.unknownRemoteCreate, true);
  assert.equal(evidence.terminationConfirmed, false);
  assert.ok(evidence.cleanupFailures.includes('avatar_create_settle'));
  assert.ok(closeCalls >= 1);
  assert.deepEqual(harness.calls.at(-1), ['ctx.shutdown', 'user_ended']);
});

test('Profile B teardown closes again after an in-flight AgentSession start settles', { skip: !PINNED_AGENTS_AVAILABLE }, async () => {
  let resolveTermination;
  let resolveAgentStart;
  let announceAgentStart;
  let terminateCalls = 0;
  const termination = new Promise((resolve) => { resolveTermination = resolve; });
  const agentStartBegan = new Promise((resolve) => { announceAgentStart = resolve; });
  const avatar = {
    sessionId: 'provider-start-race-1',
    create: async () => ({ sessionId: 'provider-start-race-1', avatarJoined: true }),
    roomOptions: () => ({}),
    terminate: async () => { terminateCalls += 1; return { confirmed: true }; },
    status: async () => ({ ok: true, sessionStatus: 'COMPLETED', cost: 1 }),
    close: async () => {},
  };
  const harness = await createProfileBRaceHarness({
    waitForTermination: async () => termination,
    connect: async () => {},
    avatar,
    startAgentSession: async () => {
      announceAgentStart();
      return new Promise((resolve) => { resolveAgentStart = resolve; });
    },
  });
  await agentStartBegan;
  resolveTermination({ requested: true, reason: 'user_ended' });
  resolveAgentStart();
  await harness.entryPromise;
  assert.equal(harness.getObservedTerminationSignal().aborted, true);
  assert.equal(terminateCalls, 1);
  assert.equal(harness.calls.filter(([name]) => name === 'session.start').length, 1);
  assert.equal(harness.calls.filter(([name]) => name === 'session.close').length, 2);
  const secondClose = harness.calls.map(([name]) => name).lastIndexOf('session.close');
  const reconciled = harness.calls.findIndex(([name]) => name === 'job.reconcile');
  assert.ok(secondClose >= 0 && secondClose < reconciled);
});

test('Profile B teardown is bounded when AgentSession start never settles', { skip: !PINNED_AGENTS_AVAILABLE }, async () => {
  let resolveTermination;
  let announceAgentStart;
  const termination = new Promise((resolve) => { resolveTermination = resolve; });
  const agentStartBegan = new Promise((resolve) => { announceAgentStart = resolve; });
  const avatar = {
    sessionId: 'provider-never-start-1',
    create: async () => ({ sessionId: 'provider-never-start-1', avatarJoined: true }),
    roomOptions: () => ({}),
    terminate: async () => ({ confirmed: true }),
    status: async () => ({ ok: true, sessionStatus: 'COMPLETED', cost: 1 }),
    close: async () => {},
  };
  const harness = await createProfileBRaceHarness({
    waitForTermination: async () => termination,
    connect: async () => {},
    avatar,
    startAgentSession: async () => {
      announceAgentStart();
      return new Promise(() => {});
    },
  });
  await agentStartBegan;
  resolveTermination({ requested: true, reason: 'user_ended' });
  await harness.entryPromise;
  const evidence = harness.calls.find(([name]) => name === 'job.reconcile')[1];
  assert.equal(evidence.terminationConfirmed, false);
  assert.ok(evidence.cleanupFailures.includes('agent_session_start_settle'));
  assert.deepEqual(harness.calls.at(-1), ['ctx.shutdown', 'user_ended']);
});

test('Profile B teardown completes before the pinned runner reaches shutdown callbacks', { skip: !PINNED_AGENTS_AVAILABLE }, async () => {
  const [runnerSource, workerSource] = await Promise.all([
    readFile(new URL('../../node_modules/@livekit/agents/src/ipc/job_proc_lazy_main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../server/agents/profile-b-agent.mjs', import.meta.url), 'utf8'),
  ]);
  const runnerSessionClose = runnerSource.indexOf('const sessionClosePromise = ctx._primaryAgentSession.close();');
  const runnerRoomDisconnect = runnerSource.indexOf('await room.disconnect();', runnerSessionClose);
  const runnerShutdownCallbacks = runnerSource.indexOf('for (const callback of ctx.shutdownCallbacks)', runnerRoomDisconnect);
  assert.ok(runnerSessionClose >= 0);
  assert.ok(runnerSessionClose < runnerRoomDisconnect);
  assert.ok(runnerRoomDisconnect < runnerShutdownCallbacks);

  const beginTeardown = workerSource.indexOf('const beginTeardown =');
  const providerTerminate = workerSource.indexOf("attempt('avatar_terminate'", beginTeardown);
  const durableReconcile = workerSource.indexOf("attempt('durable_reconcile'", providerTerminate);
  const requestedShutdown = workerSource.indexOf('ctx.shutdown(terminalReason)', durableReconcile);
  assert.ok(beginTeardown >= 0);
  assert.ok(beginTeardown < providerTerminate);
  assert.ok(providerTerminate < durableReconcile);
  assert.ok(durableReconcile < requestedShutdown);
  assert.match(workerSource, /ctx\.addShutdownCallback\(async \(\) => \{\s*sdkShutdownStarted = true;\s*await beginTeardown\('sdk_shutdown_fallback'\);/u);
  assert.match(workerSource, /durableGate\.waitForTermination\([\s\S]*?return beginTeardown\(/u);
});

test('default Profile B durable gate denies every child-process operation', async () => {
  const { profileBDurableGate } = await import('../../server/agents/profile-b-durable-gate.mjs');
  assert.equal((await profileBDurableGate.claimJob({})).ok, false);
  assert.equal((await profileBDurableGate.waitForTermination({})).ok, false);
  assert.equal((await profileBDurableGate.markWorkerJoined({})).ok, false);
  assert.equal((await profileBDurableGate.reconcileJob({})).ok, false);
});
