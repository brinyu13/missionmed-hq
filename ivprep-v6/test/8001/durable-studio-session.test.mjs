import assert from 'node:assert/strict';
import test from 'node:test';

import { DurableStudioSession, createDurableResultsEnvelope } from '../../public/studio/durable-session.mjs';

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
    turns: [
      { id: 'response-1', speaker: 'interviewer', startMs: 120, endMs: 120, text: 'Tell me about yourself.', final: true, providerEventType: 'session.output_transcript.done' },
      { id: 'item-1', speaker: 'student', startMs: 1_320, endMs: 1_320, text: 'I value careful listening.', final: true, providerEventType: 'session.input_transcript.done' },
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

test('live transcript deltas collapse into final provider turns and incomplete text is not persisted', async () => {
  let nowMs = 0;
  const durable = new DurableStudioSession({
    nowMs: () => nowMs,
    api: {
      async bootstrap() { return { entitlement: { admitted: true } }; },
      async createSession() { return { id: 'session-live-turns' }; },
    },
    recordingFactory: () => ({ async start() {} }),
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
    id: 'r1', speaker: 'interviewer', startMs: 100, endMs: 220,
    text: 'Why this program?', final: true, providerEventType: 'response.output_audio_transcript.done',
  }]);
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
  const recorder = { async start() { calls.push(['recording.start']); } };
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
    async start() {},
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
    async start() {},
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
