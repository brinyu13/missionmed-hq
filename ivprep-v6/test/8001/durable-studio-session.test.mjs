import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { DurableStudioSession, createDurableResultsEnvelope } from '../../public/studio/durable-session.mjs';

const messageReceipt = { timingBasis: 'MESSAGE_RECEIPT', provenance: 'BROWSER_DECLARED', finalization: 'PROVIDER_FINAL_MESSAGE' };

test('Guided practice preference is stored and bound to prepared session identity', async () => {
  const calls = [];
  const durable = new DurableStudioSession({ api: {
    bootstrap: async () => ({ entitlement: { admitted: true } }),
    createSession: async input => { calls.push(input); return { id: 'prepared-focus' }; },
  } });
  await durable.bootstrap();
  const wizard = { goal: 'Guided Mock IV Practice', focus: '  Explain the impact  ', pressurePractice: true };
  await durable.prepare({ wizard });
  assert.equal(calls[0].context.practiceFocus, 'Explain the impact');
  await assert.rejects(() => durable.prepare({ wizard: { ...wizard, focus: 'A different focus' } }), /context_changed/);
  const individual = durable.sessionInput({ wizard: { ...wizard, goal: 'Individual Question' } });
  assert.equal(individual.context.pressurePractice, false);
  assert.equal(Object.hasOwn(individual.context, 'practiceFocus'), false);
  assert.throws(() => durable.sessionInput({ wizard: { ...wizard, focus: {} } }), /Practice focus/);
});

function candidateHarness({ gate = true, failStart = false, failSeal = false } = {}) {
  let clock = 100; const made = []; const writes = []; let mainStops = 0; let sourceStops = 0;
  const mic = { kind: 'audio', readyState: 'live', id: 'original-mic' };
  const remote = { kind: 'audio', readyState: 'live', id: 'remote-ai' };
  class Stream {
    constructor(tracks) { this.tracks = tracks; }
    getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
    getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  }
  const receipt = { schema: 'ivoc.candidate-audio.v1', captureVersion: 'direct-mic-v1', status: 'ALLOCATED' };
  const api = { bootstrap: async () => ({ entitlement: { admitted: true }, capabilities: { candidateAudioCapture: gate } }),
    createSession: async () => ({ id: 'owned-session' }),
    saveResults: async (id, envelope) => { writes.push({ id, envelope }); return { id: 'saved-result' }; },
    abandonSession: async () => ({ abandoned: true }) };
  const durable = new DurableStudioSession({ api, nowMs: () => clock, MediaStreamCtor: Stream,
    recordingFactory: options => {
      const source = options.recordingRole === 'candidate_audio';
      const recorder = { options, recording: { id: source ? 'source' : 'main' }, captureReceipt: receipt,
        parentRecordingId: options.parentRecordingId, destroyed: 0,
        start: async () => { clock += source ? 20 : 10; if (source && failStart) throw new Error('source-start'); return true; },
        stopAndSeal: async () => {
          if (source) {
            sourceStops += 1;
            if (failSeal && sourceStops === 1) { recorder.finalBlob = new Blob(['retained-mic']); throw new Error('source-seal'); }
          } else mainStops += 1;
          return { recording: { id: source ? 'source' : 'main', status: 'saved' },
            captureReceipt: { ...receipt, status: 'SEALED', assurance: 'CLIENT_MIC_CAPTURE_DECLARATION', analysisEligibility: 'UNVERIFIED' },
            recordingStartSessionMs: source ? 30 : 10, recordingDurationMs: 1000,
            playableDurationMs: 990, pausedSpans: [] };
        }, destroy() { this.destroyed += 1; } };
      made.push(recorder); return recorder;
    } });
  return { durable, made, writes, mic, remote, Stream, stats: () => ({ mainStops, sourceStops }), advance: value => { clock = value; } };
}

test('gated mic source is separate from remote mix, keeps independent clocks and provisional identities', async () => {
  const h = candidateHarness(); await h.durable.bootstrap();
  const mixed = new h.Stream([h.remote, { kind: 'video' }]);
  await h.durable.start({ stream: mixed, candidateStream: new h.Stream([h.mic, { kind: 'video' }]) });
  assert.equal(h.made[0].options.stream, mixed);
  assert.deepEqual(h.made[1].options.stream.getAudioTracks(), [h.mic]);
  assert.deepEqual(h.made[1].options.stream.getVideoTracks(), []);
  assert.equal(h.made[1].options.parentRecordingId, 'main');
  assert.equal(h.made[0].options.sessionNow(), h.made[1].options.sessionNow());
  h.advance(200);
  h.durable.recordLiveTranscript({ speaker: 'student', final: true, text: 'A response',
    itemId: 'item1', responseId: 'response1', identity: 'item1', type: 'input.transcript.done' });
  const saved = await h.durable.finish({ durationMs: 1000, events: [] });
  assert.equal(saved.envelope.candidateAudioCapture.status, 'SAVED');
  assert.equal(saved.envelope.candidateAudioCapture.analysisEligibility, 'UNVERIFIED');
  assert.equal(saved.envelope.candidateAudioCapture.captureTiming.recordingStartSessionMs, 30);
  assert.equal(saved.envelope.liveConversation.turns[0].itemId, 'item1');
  assert.equal(saved.envelope.liveConversation.turns[0].responseId, 'response1');
  assert.equal(saved.envelope.liveConversation.turns[0].startMs, 90);
  assert.equal(saved.envelope.liveConversation.sessionId, 'owned-session');
  assert.equal(saved.envelope.liveConversation.timingBasis, 'MESSAGE_RECEIPT');
  assert.equal(saved.envelope.liveConversation.turns[0].finalization, 'PROVIDER_FINAL_MESSAGE');
  assert.equal(saved.envelope.candidateAudioCapture.blob, undefined);
  assert.equal(h.durable.candidateRecorder, null);
});

test('source seal failure preserves main saved Results and retries source alone after account session clears', async () => {
  const h = candidateHarness({ failSeal: true }); await h.durable.bootstrap();
  await h.durable.start({ stream: {}, candidateStream: new h.Stream([h.mic]) });
  const saved = await h.durable.finish({ durationMs: 1000 });
  assert.equal(saved.persisted, true);
  assert.equal(saved.recording.recording.id, 'main');
  assert.equal(saved.envelope.candidateAudioCapture.status, 'FAILED');
  assert.equal(h.durable.accountSession, null);
  assert.equal(h.durable.candidateRetry.sessionId, 'owned-session');
  const [a, b] = await Promise.all([h.durable.retryCandidateAudio(), h.durable.retryCandidateAudio()]);
  assert.equal(a.retried, true); assert.equal(b.retried, true);
  assert.deepEqual(h.stats(), { mainStops: 1, sourceStops: 2 });
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[1].id, 'owned-session');
  assert.equal(h.writes[1].envelope.candidateAudioCapture.status, 'SAVED');
  assert.equal(h.durable.candidateRetry, null);
});

test('source start failure does not block main; old/false/nonliteral bootstrap never creates source', async () => {
  for (const gate of [undefined, false, 'true']) {
    const h = candidateHarness({ gate }); await h.durable.bootstrap();
    if (gate === undefined) delete h.durable.bootstrapPayload.capabilities;
    await h.durable.start({ stream: {}, candidateStream: new h.Stream([h.mic]) });
    await h.durable.finish({ durationMs: 1000 });
    assert.equal(h.made.length, 1); assert.equal(h.writes[0].envelope.candidateAudioCapture, undefined);
  }
  const h = candidateHarness({ failStart: true }); await h.durable.bootstrap();
  await h.durable.start({ stream: {}, candidateStream: new h.Stream([h.mic]) });
  await h.durable.finish({ durationMs: 1000 });
  assert.equal(h.writes[0].envelope.candidateAudioCapture.status, 'FAILED');
  assert.equal(h.made[1].destroyed, 1);
  assert.equal(h.durable.candidateRetry, null);
});

test('late source retry Results response cannot clear or destroy a new capture', async () => {
  const h = candidateHarness({ failSeal: true }); await h.durable.bootstrap();
  await h.durable.start({ stream: {}, candidateStream: new h.Stream([h.mic]) });
  await h.durable.finish({ durationMs: 1000 });
  let resolveSave; let saveStarted;
  const started = new Promise(resolve => { saveStarted = resolve; });
  h.durable.api.saveResults = async () => { saveStarted(); return new Promise(resolve => { resolveSave = resolve; }); };
  const pending = h.durable.retryCandidateAudio();
  await started;
  await h.durable.start({ stream: {}, candidateStream: new h.Stream([h.mic]) });
  const current = h.durable.candidateRecorder;
  const currentSession = h.durable.accountSession;
  resolveSave({ id: 'old-save' });
  assert.equal((await pending).reason, 'candidate_audio_capture_closed');
  assert.equal(h.durable.candidateRecorder, current);
  assert.equal(current.destroyed, 0);
  assert.equal(h.durable.accountSession, currentSession);
  assert.equal(h.durable.candidateAudioCapture.status, 'RECORDING');
});

test('actual Results source retry handler appears only for original owner attempt and ignores stale views', async () => {
  const studio = readFileSync(new URL('../../public/studio/studio.mjs', import.meta.url), 'utf8');
  const source = studio.slice(studio.indexOf('  const sourceRetry = state.durable?.candidateRetry;'),
    studio.indexOf('  const contextButton =', studio.indexOf('  const sourceRetry = state.durable?.candidateRetry;')));
  const render = new Function('state', 'isAdminReview', 'el', '$', source);
  let handler; let button; let calls = 0; let release;
  const saved = { session: { id: 'original' } };
  const state = { lastSaved: saved, durable: { candidateRetry: { sessionId: 'original' },
    retryCandidateAudio: async () => { calls += 1; return new Promise(resolve => { release = resolve; }); } } };
  const el = () => { button = { addEventListener: (_event, callback) => { handler = callback; } }; return button; };
  const $ = () => ({ before() {} });
  render(state, () => false, el, $);
  assert.equal(button.id, 'candidate-audio-retry');
  const pending = handler(); assert.equal(button.disabled, true); assert.equal(calls, 1);
  const newer = { session: { id: 'new' }, envelope: 'unchanged' }; state.lastSaved = newer;
  release({ retried: true, envelope: { candidateAudioCapture: { status: 'SAVED' } } });
  await pending;
  assert.equal(newer.envelope, 'unchanged');
  for (const [id, admin] of [['different', false], ['original', true]]) {
    button = null; state.lastSaved = { session: { id } };
    render(state, () => admin, el, $); assert.equal(button, null);
  }
});

test('destroy and abandon dispose mic recorder, retained retries, but never stop borrowed microphone tracks', async () => {
  for (const action of ['destroy', 'abandon']) {
    const h = candidateHarness(); await h.durable.bootstrap();
    await h.durable.start({ stream: {}, candidateStream: new h.Stream([h.mic]) });
    await h.durable[action]();
    assert.equal(h.made[1].destroyed, 1); assert.equal(h.durable.candidateRecorder, null);
    assert.equal(h.mic.readyState, 'live');
  }
  const h = candidateHarness({ failSeal: true }); await h.durable.bootstrap();
  await h.durable.start({ stream: {}, candidateStream: new h.Stream([h.mic]) });
  await h.durable.finish({ durationMs: 1000 });
  await h.durable.abandon();
  assert.equal(h.durable.candidateRetry, null);
  assert.equal((await h.durable.retryCandidateAudio()).retried, false);
});

test('optional manual name coaching snapshots preparation, persists through finish and resets', async () => {
  const inputs = []; const writes = [];
  const durable = new DurableStudioSession({ api: {
    bootstrap: async () => ({ entitlement: { admitted: true } }),
    createSession: async input => { inputs.push(input); return { id: `session-${inputs.length}` }; },
    saveResults: async (id, input) => { writes.push(JSON.parse(JSON.stringify(input))); return { id }; },
    abandonSession: async () => ({ abandoned: true }),
  }, recordingFactory: () => ({ start: async () => true,
    stopAndSeal: async () => ({ recording: { id: 'recording', durationMs: 3000 } }), destroy() {} }) });
  await durable.bootstrap();
  const wizard = { interviewerName: '  Dr. Élan  ', nameUseCoaching: true };
  await durable.start({ stream: {}, wizard });
  assert.equal(inputs[0].context.nameUseCoaching.name, 'Dr. Élan');
  wizard.interviewerName = 'Different name'; wizard.nameUseCoaching = false;
  await assert.rejects(durable.prepare({ wizard }), /durable_session_context_changed/);
  const saved = await durable.finish({ durationMs: 3000, events: [] });
  assert.deepEqual(writes[0].nameUseCoaching, { schema: 'ivoc.name-use.v1', enabled: true,
    source: 'manual', name: 'Dr. Élan', sessionId: 'session-1' });
  assert.deepEqual(saved.envelope.nameUseCoaching, writes[0].nameUseCoaching);
  assert.equal(durable.preparedNameUseCoaching, null);
  await durable.start({ stream: {}, wizard });
  assert.equal(inputs[1].context.nameUseCoaching, null);
  await durable.finish({ durationMs: 3000, events: [] });
  assert.equal(writes[1].nameUseCoaching, undefined);
  await durable.prepare({ wizard: { interviewerName: 'Dr. Élan', nameUseCoaching: true } });
  await durable.abandon(); assert.equal(durable.preparedNameUseCoaching, null);
  await durable.prepare({ wizard: { interviewerName: 'Dr. Élan', nameUseCoaching: true } });
  durable.destroy(); assert.equal(durable.preparedNameUseCoaching, null);
});

test('name coaching requires literal opt-in and bounded manual name; legacy envelope stays unchanged', () => {
  const durable = new DurableStudioSession({ api: {} });
  for (const wizard of [{ interviewerName: 'Dr. Sample' }, { interviewerName: 'Dr. Sample', nameUseCoaching: 'true' },
    { interviewerName: '', nameUseCoaching: true }, { interviewerName: 'x'.repeat(101), nameUseCoaching: true },
    { interviewerName: 'Dr.\nSample', nameUseCoaching: true }]) {
    assert.equal(durable.sessionInput({ wizard }).context.nameUseCoaching, null);
  }
  assert.equal(createDurableResultsEnvelope({ sessionId: 'legacy' }).nameUseCoaching, undefined);
});

test('retry request binds only an unchanged one-question setup, never client provenance', () => {
  const durable = new DurableStudioSession({ api: {} });
  const question = { question_id: 'Q1', canonical_text: 'Why here?' };
  const wizard = { retrySourceSessionId: '00000000-0000-4000-8000-000000000007', retryQuestionId: 'Q1', retryQuestionText: 'Why here?', retrySessionType: 'mock', retry: { forged: true } };
const options = { question, interviewSet: [question], wizard, targetQuestions: 1 };
  const input = durable.sessionInput(options);
  assert.equal(input.retrySourceSessionId, wizard.retrySourceSessionId);
  assert.equal(input.sessionType, 'mock');
  assert.equal(input.context.retry, undefined);
  assert.equal(durable.sessionInput({ ...options, targetQuestions: 2 }).retrySourceSessionId, undefined);
  assert.equal(durable.sessionInput({ ...options, question: { ...question, canonical_text: 'Changed' } }).retrySourceSessionId, undefined);
});

test('durable setup preserves selected role and bounded conversation style for replay and retry', () => {
  const durable = new DurableStudioSession({ api: {} });
  for (const interviewerStyle of ['Dove', 'Peacock', 'Owl', 'Eagle']) {
    const input = durable.sessionInput({ wizard: { interviewer: 'Associate Program Director', interviewerStyle } });
    assert.equal(input.context.interviewer, 'Associate Program Director');
    assert.equal(input.context.interviewerStyle, interviewerStyle);
  }
  for (const interviewerStyle of [null, undefined, 'invented', '<instructions>']) {
    assert.equal(durable.sessionInput({ wizard: { interviewerStyle } }).context.interviewerStyle, null);
  }
});

test('Admin adapters fail closed and delegate only admitted authenticated Admin writes', async () => {
  const calls = [];
  const durable = new DurableStudioSession({ api: {
    saveAdminConfig: async (input) => calls.push(['config', input]),
    adminCredits: async (subject) => calls.push(['read', subject]),
    saveAdminCredits: async (input) => calls.push(['credits', input]),
    adminMentorPriorities: async (subject) => calls.push(['mentor-read', subject]),
    saveAdminMentorPriorities: async (input) => calls.push(['mentor-write', input]),
  } });
  for (const identity of [null, { admin: false }, { admin: 'true' }]) {
    durable.bootstrapPayload = { entitlement: { admitted: true }, identity };
    await assert.rejects(durable.saveAdminConfig({}), /ivoc_admin_required/);
    await assert.rejects(durable.adminCredits('wp:142'), /ivoc_admin_required/);
    await assert.rejects(durable.saveAdminCredits({}), /ivoc_admin_required/);
    await assert.rejects(durable.adminMentorPriorities('wp:142'), /ivoc_admin_required/);
    await assert.rejects(durable.saveAdminMentorPriorities({}), /ivoc_admin_required/);
  }
  assert.equal(calls.length, 0);
  durable.bootstrapPayload = { entitlement: { admitted: true }, identity: { admin: true } };
  await durable.saveAdminConfig({ expectedVersion: 3 });
  await durable.adminCredits('wp:142');
  await durable.saveAdminCredits({ subjectId: 'wp:142', expectedVersion: 8 });
  await durable.adminMentorPriorities('wp:142'); await durable.saveAdminMentorPriorities({ subjectId: 'wp:142', expectedVersion: 0 });
  assert.deepEqual(calls, [['config', { expectedVersion: 3 }], ['read', 'wp:142'], ['credits', { subjectId: 'wp:142', expectedVersion: 8 }], ['mentor-read', 'wp:142'], ['mentor-write', { subjectId: 'wp:142', expectedVersion: 0 }]]);
});

test('durable Studio session creates, records, seals, and persists the validated analytics envelope', async () => {
  const calls = [];
  const api = {
    async bootstrap() { calls.push(['bootstrap']); return { entitlement: { admitted: true }, identity: { displayName: 'Student' } }; },
    async createSession(input) { calls.push(['createSession', input]); return { id: 'session-1' }; },
    async saveResults(id, input) { calls.push(['saveResults', id, input]); return { id: 'result-1' }; },
  };
  const recorder = {
    async start() { calls.push(['recording.start']); return true; },
    async stopAndSeal() {
      calls.push(['recording.stopAndSeal']);
      return { recording: { id: 'recording-1', durationMs: 3_050 }, durationMs: 3_050, playableDurationMs: 3_000, recordingStartSessionMs: 25, pausedSpans: [] };
    },
  };
  let nowMs = 100;
  const durable = new DurableStudioSession({
    api,
    recordingFactory: () => recorder,
    now: () => '2026-09-16T18:00:00.000Z',
    nowMs: () => nowMs,
  });
  await durable.bootstrap();
  await durable.start({
    stream: { id: 'shared-media' },
    question: { question_id: 'CORE-01', canonical_text: 'Tell me about yourself.' },
    interviewSet: [
      { question_id: 'CORE-01', canonical_text: 'Tell me about yourself.' },
      { question_id: 'MR142-001', canonical_text: 'Why this specialty?' },
    ],
    wizard: {
      interviewer: 'Program Director', program: 'Internal Medicine',
      contextSources: ['CV', 'File Vault', 'Prior IVOC', 'forged-owner-source', 'CV'],
    },
    targetQuestions: 5,
    interviewerProvider: 'openai-gpt-live',
  });
  nowMs = 220;
  assert.equal(durable.recordLiveAudioTelemetry({
    schema: 'ivoc.audio-authority.event.v1', authority: 'openai-gpt-live-native', mode: 'single',
    state: 'configured', observedAtMs: 10,
  }), true);
  assert.equal(durable.recordLiveAudioTelemetry({
    schema: 'ivoc.audio-authority.event.v1', authority: 'openai-gpt-live-native', mode: 'single',
    state: 'bound', observedAtMs: 25,
  }), true);
  assert.equal(durable.recordLiveAudioTelemetry({
    schema: 'ivoc.audio-authority.event.v1', authority: 'openai-gpt-live-native', mode: 'single',
    state: 'released', observedAtMs: 2_900,
  }), true);
  assert.equal(durable.recordLiveTranscript({
    identity: 'response-1', speaker: 'interviewer', text: 'Tell me about yourself.',
    type: 'session.output_transcript.done', final: true,
  }), true);
  nowMs = 1_420;
  durable.recordLiveTranscript({
    identity: 'item-1', speaker: 'applicant', text: 'I value careful listening.',
    type: 'session.input_transcript.done', final: true,
  });
  const analytics = { schema: 'missionmed.ivprep.analytics.session.v1', durationMs: 2_950, events: [{ metric: 'answer_duration_ms' }] };
  const finished = await durable.finish(Promise.resolve(analytics));

  assert.equal(finished.persisted, true);
  assert.equal(finished.recording.recording.id, 'recording-1');
  assert.deepEqual(calls.map((call) => call[0]), ['bootstrap', 'createSession', 'recording.start', 'recording.stopAndSeal', 'saveResults']);
  assert.equal(calls[1][1].context.targetQuestions, 5);
  assert.deepEqual(calls[1][1].context.questionIds, ['CORE-01', 'MR142-001']);
  assert.deepEqual(calls[1][1].context.contextSources, ['CV', 'File Vault', 'Prior IVOC']);
  assert.equal(calls[4][2].schema, 'ivoc.analytics.v1');
  assert.equal(calls[4][2].analytics, analytics);
  assert.deepEqual(calls[4][2].scores, {});
  assert.equal(calls[4][2].playableDurationMs, 3_000);
  assert.deepEqual(calls[4][2].liveConversation, {
    schema: 'ivoc.live-conversation.v1', provider: 'openai-gpt-live', clock: 'recording-observed',
    sessionId: 'session-1', timingBasis: 'MESSAGE_RECEIPT', provenance: 'BROWSER_DECLARED',
    turns: [
      { ...messageReceipt, id: 'response-1', speaker: 'interviewer', startMs: 120, endMs: 120, text: 'Tell me about yourself.', final: true, providerEventType: 'session.output_transcript.done' },
      { ...messageReceipt, id: 'item-1', speaker: 'student', startMs: 1_320, endMs: 1_320, text: 'I value careful listening.', final: true, providerEventType: 'session.input_transcript.done' },
    ],
  });
  assert.deepEqual(calls[4][2].audioAuthority, {
    schema: 'ivoc.audio-authority.v1', mode: 'single', authority: 'openai-gpt-live-native',
    events: [
      { state: 'configured', observedAtMs: 10 },
      { state: 'bound', observedAtMs: 25 },
      { state: 'released', observedAtMs: 2_900 },
    ],
  });
});

test('RISE context is sent only with a verified program identity and release receipt', () => {
  const durable = new DurableStudioSession();
  const manual = durable.sessionInput({ wizard: { program: 'Typed text', contextSources: ['RISE', 'CV'] } });
  assert.equal(manual.context.program, 'Typed text');
  assert.equal(manual.context.programId, null);
  assert.deepEqual(manual.context.contextSources, ['CV']);

  const verified = durable.sessionInput({ wizard: {
    program: 'Verified Program', programVerified: true,
    programId: 'rise_ps_123', programReleaseId: 'rise_registry_456', contextSources: ['RISE'],
  } });
  assert.equal(verified.context.programId, 'rise_ps_123');
  assert.equal(verified.context.programReleaseId, 'rise_registry_456');
  assert.deepEqual(verified.context.contextSources, ['RISE']);
});

test('an unavailable browser recorder cannot enter a durable interview', async () => {
  let destroyed = false;
  const durable = new DurableStudioSession({
    api: {
      async bootstrap() { return { entitlement: { admitted: true } }; },
      async createSession() { return { id: 'unrecorded-session' }; },
    },
    recordingFactory: () => ({
      async start() { return false; },
      destroy() { destroyed = true; },
    }),
  });
  await durable.bootstrap();
  await assert.rejects(durable.start({ stream: {} }), /recording_unavailable/u);
  assert.equal(destroyed, true);
  assert.equal(durable.recorder, null);
  assert.equal(durable.conversationCaptureStartedAtMs, null);
});

test('an interview without sealed media cannot be reported as saved', async () => {
  let resultWrites = 0;
  const durable = new DurableStudioSession({
    api: {
      async bootstrap() { return { entitlement: { admitted: true } }; },
      async createSession() { return { id: 'unsealed-session' }; },
      async saveResults() { resultWrites += 1; return { id: 'should-not-exist' }; },
    },
    recordingFactory: () => ({
      async start() { return true; },
      async stopAndSeal() { return null; },
    }),
  });
  await durable.bootstrap();
  await durable.start({ stream: {} });
  await assert.rejects(durable.finish({ durationMs: 1_000, events: [] }), /recording_not_sealed/u);
  assert.equal(resultWrites, 0);
  assert.equal(durable.accountSession?.id, 'unsealed-session');
});

test('program search remains behind the admitted durable capability', async () => {
  const calls = [];
  const durable = new DurableStudioSession({ api: {
    async bootstrap() { return { entitlement: { admitted: true } }; },
    async searchPrograms(input) { calls.push(input); return { records: [], total: 0 }; },
  } });
  await assert.rejects(() => durable.programs({ q: 'Example' }), /durable_session_not_ready/u);
  await durable.bootstrap();
  await durable.programs({ q: 'Example' });
  assert.deepEqual(calls, [{ q: 'Example' }]);
});

test('live transcript deltas stay provisional until explicit Finish seals them', async () => {
  const saved = [];
  let nowMs = 0;
  const durable = new DurableStudioSession({
    nowMs: () => nowMs,
    api: {
      async bootstrap() { return { entitlement: { admitted: true } }; },
      async createSession() { return { id: 'session-live-turns' }; },
      async saveResults(_id, input) { saved.push(input); return { id: 'result-live-turns' }; },
    },
    recordingFactory: () => ({ async start() { return true; }, async stopAndSeal() { return { recording: { id: 'recording-live-turns' } }; } }),
  });
  await durable.bootstrap();
  await durable.start({ stream: {} });
  nowMs = 100;
  durable.recordLiveTranscript({ identity: 'r1', speaker: 'interviewer', text: 'Why ', type: 'response.output_audio_transcript.delta', final: false });
  nowMs = 180;
  durable.recordLiveTranscript({ identity: 'r1', speaker: 'interviewer', text: 'this program?', type: 'response.output_audio_transcript.delta', final: false });
  nowMs = 220;
  durable.recordLiveTranscript({ identity: 'r1', speaker: 'interviewer', text: 'Why this program?', type: 'response.output_audio_transcript.done', final: true });
  nowMs = 300;
  durable.recordLiveTranscript({ identity: 'partial', speaker: 'applicant', text: 'Still speaking', type: 'conversation.item.input_audio_transcription.delta', final: false });
  assert.deepEqual(durable.liveConversationSnapshot().turns, [{
    ...messageReceipt,
    id: 'r1', speaker: 'interviewer', startMs: 100, endMs: 220,
    text: 'Why this program?', final: true, providerEventType: 'response.output_audio_transcript.done',
  }]);
  const finished = await durable.finish(Promise.resolve({ durationMs: 300, events: [] }));
  assert.equal(finished.persisted, true);
  assert.deepEqual(saved[0].liveConversation.turns, [
    {
      ...messageReceipt,
      id: 'r1', speaker: 'interviewer', startMs: 100, endMs: 220,
      text: 'Why this program?', final: true, providerEventType: 'response.output_audio_transcript.done',
    },
    {
      ...messageReceipt, finalization: 'CLIENT_FINISH',
      id: 'partial', speaker: 'student', startMs: 300, endMs: 300,
      text: 'Still speaking', final: true,
      providerEventType: 'conversation.item.input_audio_transcription.delta:client-finish',
    },
  ]);
});

test('provisional capture rejects foreign session, malformed IDs and reused identity drift without changing receipt text', async () => {
  const h = candidateHarness({ gate: false }); await h.durable.bootstrap(); await h.durable.start({ stream: {} });
  h.advance(200);
  const event = { identity: 'item-1', speaker: 'applicant', text: 'Actual partial text', final: false,
    itemId: 'item-1', responseId: 'response-1', type: 'input.transcript.delta' };
  assert.equal(h.durable.recordLiveTranscript(event), true);
  for (const invalid of [{ sessionId: 'foreign-session' }, { identity: 42 }, { identity: 'x'.repeat(241) },
    { itemId: ' padded ' }, { responseId: {} }, { responseId: 'x'.repeat(241) },
    { speaker: 'interviewer' }, { itemId: 'different-item' }, { responseId: 'different-response' }]) {
    assert.equal(h.durable.recordLiveTranscript({ ...event, ...invalid, final: true, text: 'Must not replace text' }), false);
  }
  assert.equal(h.durable.liveConversationSnapshot().turns.length, 0);
  const result = await h.durable.finish({ durationMs: 1000 });
  const turn = result.envelope.liveConversation.turns[0];
  assert.equal(turn.text, 'Actual partial text');
  assert.equal(turn.finalization, 'CLIENT_FINISH');
  assert.equal(turn.itemId, 'item-1'); assert.equal(turn.responseId, 'response-1');
  assert.equal(turn.startMs, turn.endMs);
  assert.equal(turn.speechStartMs, undefined);
  assert.equal(result.envelope.liveConversation.provenance, 'BROWSER_DECLARED');
});

test('results envelope remains truthful when recording evidence is unavailable', () => {
  const envelope = createDurableResultsEnvelope({ sessionId: 'session-2', analytics: { durationMs: 910, events: [] }, recording: null });
  assert.equal(envelope.durationMs, 910);
  assert.equal(envelope.recordingDurationMs, null);
  assert.equal(envelope.playableDurationMs, 910);
  assert.deepEqual(envelope.scores, {});
  assert.deepEqual(envelope.counters, {});
});

test('a prepared canonical session is reused when the same rep begins recording', async () => {
  const calls = [];
  const api = {
    async bootstrap() { return { entitlement: { admitted: true } }; },
    async createSession(input) { calls.push(['createSession', input]); return { id: 'session-prepared' }; },
  };
  const recorder = { async start() { calls.push(['recording.start']); return true; } };
  const durable = new DurableStudioSession({ api, recordingFactory: () => recorder });
  await durable.bootstrap();
  const options = {
    question: { question_id: 'CORE-01', canonical_text: 'Tell me about yourself.' },
    wizard: { goal: 'Full interview simulation', interviewer: 'Program Director' },
    targetQuestions: 5,
    interviewerProvider: 'openai-gpt-live',
  };
  const prepared = await durable.prepare(options);
  durable.recordLiveAudioTelemetry({
    schema: 'ivoc.audio-authority.event.v1', authority: 'openai-gpt-live-native', mode: 'single',
    state: 'configured', observedAtMs: 0,
  });
  const started = await durable.start({ ...options, stream: { id: 'shared-media' } });
  assert.equal(prepared, started);
  assert.deepEqual(durable.liveAudioAuthoritySnapshot().events, [{ state: 'configured', observedAtMs: 0 }]);
  assert.deepEqual(calls.map((call) => call[0]), ['createSession', 'recording.start']);
  await assert.rejects(() => durable.prepare({ ...options, targetQuestions: 6 }), /context_changed/u);
});

test('durable operations require an admitted bootstrap and never impersonate an account', async () => {
  const durable = new DurableStudioSession({
    api: { async bootstrap() { return { entitlement: { admitted: false } }; } },
    recordingFactory: () => { throw new Error('must not construct'); },
  });
  await durable.bootstrap();
  await assert.rejects(() => durable.start({ stream: {} }), /durable_session_not_ready/u);
});

test('Admin overview stays behind the authenticated capability boundary', async () => {
  const calls = [];
  const durable = new DurableStudioSession({
    api: {
      async bootstrap() { return { entitlement: { admitted: true }, identity: { admin: true } }; },
      async adminConfig() { calls.push('config'); return { version: 3 }; },
      async credits() { calls.push('credits'); return { account: { subjectId: 'wp:1', balanceSeconds: 0 } }; },
      async questions() { calls.push('questions'); return { admin: true, questions: [{ questionId: 'CORE-01', status: 'active' }] }; },
    },
  });
  await durable.bootstrap();
  const overview = await durable.adminOverview();
  assert.deepEqual(calls.sort(), ['config', 'credits', 'questions']);
  assert.equal(overview.config.version, 3);
  assert.equal(overview.credits.account.subjectId, 'wp:1');
  assert.equal(overview.questions.questions[0].questionId, 'CORE-01');

  const student = new DurableStudioSession({
    api: { async bootstrap() { return { entitlement: { admitted: true }, identity: { admin: false } }; } },
  });
  await student.bootstrap();
  await assert.rejects(() => student.adminOverview(), /ivoc_admin_required/u);
});

test('a failed media upload retains analytics and retries the same account transaction', async () => {
  let stopAttempts = 0;
  const api = {
    async bootstrap() { return { entitlement: { admitted: true } }; },
    async createSession() { return { id: 'session-retry' }; },
    async saveResults(id, input) { assert.equal(id, 'session-retry'); assert.equal(input.analytics.durationMs, 1_200); return { id: 'result-retry' }; },
  };
  const recorder = {
    state: 'RECORDING',
    async start() { return true; },
    async stopAndSeal() {
      stopAttempts += 1;
      if (stopAttempts === 1) { this.state = 'ERROR'; throw new Error('recording_upload_503'); }
      return { recording: { id: 'recording-retry' }, durationMs: 1_210 };
    },
  };
  const durable = new DurableStudioSession({ api, recordingFactory: () => recorder });
  await durable.bootstrap();
  await durable.start({ stream: {} });
  await assert.rejects(() => durable.finish(Promise.resolve({ durationMs: 1_200, events: [] })), /recording_upload_503/u);
  assert.equal(durable.pendingAnalytics.durationMs, 1_200);
  const retried = await durable.finish(null);
  assert.equal(retried.persisted, true);
  assert.equal(stopAttempts, 2);
});

test('Results retry preserves the already-sealed recording and its timebase', async () => {
  let seals = 0; let saves = 0;
  const receipt = { recording: { id: 'recording-sealed' }, durationMs: 1210, blob: { size: 1024 } };
  const recorder = { async start() { return true; }, async stopAndSeal() { return ++seals === 1 ? receipt : null; } };
  const inputs = [];
  const durable = new DurableStudioSession({ recordingFactory: () => recorder, api: {
    async bootstrap() { return { entitlement: { admitted: true } }; },
    async createSession() { return { id: 'session-sealed' }; },
    async saveResults(id, input) { inputs.push(input); if (++saves === 1) throw new Error('results_503'); return { id: 'results-sealed' }; },
  } });
  await durable.bootstrap(); await durable.start({ stream: {} });
  await assert.rejects(durable.finish({ durationMs: 1200, events: [] }), /results_503/);
  assert.equal(durable.pendingRecording, receipt);
  const result = await durable.finish(null);
  assert.equal(seals, 1); assert.equal(result.recording, receipt);
  assert.equal(result.persisted, true); assert.equal(durable.pendingRecording, null);
  assert.equal(result.recording.recording.id, 'recording-sealed');
  assert.equal(inputs[1].playableDurationMs, 1210);
  assert.equal(inputs[1].playableDurationMs, inputs[0].playableDurationMs);
  assert.equal(inputs[1].sessionDurationMs, 1200);
});

test('context analysis sends only sealed answer identity and validated student events', async () => {
  let input = null;
  const durable = new DurableStudioSession({
    api: { async context(value) { input = value; return { schema: 'missionmed.ivoc.context.result.v1' }; } },
  });
  const result = await durable.analyze({
    sessionId: 'session-context',
    recordingId: 'recording-context',
    answerId: 'answer-context',
    questionId: 'CORE-01',
    analyticsEvents: [{ metric: 'answer_duration_ms' }],
  });
  assert.equal(input.action, 'analyze');
  assert.equal(input.recordingId, 'recording-context');
  assert.deepEqual(input.analyticsEvents, [{ metric: 'answer_duration_ms' }]);
  assert.equal(result.schema, 'missionmed.ivoc.context.result.v1');
});

test('interrupted sessions are abandoned through the authenticated owner API and local capture is destroyed', async () => {
  const calls = [];
  const api = {
    async bootstrap() { return { entitlement: { admitted: true } }; },
    async createSession() { return { id: 'session-interrupted' }; },
    async abandonSession(id, input, options) {
      calls.push(['abandonSession', id, input, options]);
      return { abandoned: true, session: { id, state: 'abandoned' } };
    },
  };
  const recorder = {
    async start() { return true; },
    destroy() { calls.push(['recording.destroy']); },
  };
  const durable = new DurableStudioSession({ api, recordingFactory: () => recorder });
  await durable.bootstrap();
  await durable.start({ stream: {} });
  const result = await durable.abandon({ reason: 'pagehide', keepalive: true });
  assert.equal(result.abandoned, true);
  assert.deepEqual(calls, [
    ['abandonSession', 'session-interrupted', { reason: 'pagehide' }, { keepalive: true }],
    ['recording.destroy'],
  ]);
  assert.equal(durable.accountSession, null);
  assert.equal(durable.recorder, null);
});
