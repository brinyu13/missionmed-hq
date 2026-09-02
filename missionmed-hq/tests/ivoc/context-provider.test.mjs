import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { ANALYTICS_ENGINE_VERSION, MATURITY, createEvidenceEvent } from '../../../ivprep-v6/public/analytics/event-contract.mjs';
import {
  createContextIntelligenceProvider,
  createOpenAiTranscriptionProvider,
  resolveContextQuestion,
} from '../../ivoc/context-provider.mjs';
import { createIvocHandler } from '../../ivoc/routes.mjs';

const sessionId = '00000000-0000-4000-8000-000000000042';
const recordingId = '00000000-0000-4000-8000-000000000043';
const answerId = 'answer-1';

function analyticsEvent(metric = 'answer_duration_ms', value = 42_000, unit = 'ms', sequence = 1) {
  const clock = metric === 'answer_duration_ms';
  return createEvidenceEvent({
    eventId: `event-${sequence}`, sessionId, answerId, sequence,
    family: 'voice', metric, startMs: 0, endMs: 42_000,
    source: {
      engine: clock ? 'missionmed-monotonic-clock' : 'missionmed-web-audio',
      engineVersion: ANALYTICS_ENGINE_VERSION, modelVersion: null, input: clock ? 'clock' : 'mic',
    },
    observation: { value, unit, qualifiers: [] },
    quality: { provenance: 'observed', reliability: 'high', coverage: 1, sampleCount: 2, limitations: [] },
    maturity: MATURITY.STUDENT_SAFE,
  });
}

function realTranscript(text = 'I grew up in a family that valued careful listening, and that experience shaped how I approach patients.') {
  return {
    status: 'AVAILABLE', transcriptId: 'transcript-1', provider: 'openai', model: 'whisper-1',
    adapter: 'openai-batch-transcription', truthLabel: 'REAL', reason: null, text,
    segments: [{ id: 'seg-1', speaker: 'STUDENT', startMs: 0, endMs: 42_000, text, final: true, score: 0.9, source: 'openai-batch-transcription' }],
    wordCount: text.split(/\s+/u).length, timestamps: 'FINAL_SEGMENTS',
    provenance: { storage: 'EPHEMERAL_REQUEST_MEMORY_ONLY' },
  };
}

function semantic(text = 'The answer explicitly connects a family value of listening with the student’s approach to patients.') {
  return {
    questionIntent: { label: 'PERSONAL_NARRATIVE', score: 0.94 },
    answerStage: { label: 'EVIDENCE', score: 0.83 },
    semanticObservations: [{ kind: 'SUPPORTED_CLAIM', text, transcriptSegmentIds: ['seg-1'] }],
    contextTags: ['PERSONAL_BACKGROUND'], score: 0.86, coverage: 0.91,
    limitations: ['Only the final answer transcript was analyzed.'], providerModel: 'test-context-model',
  };
}

test('server resolves CORE-01 from the real 193-question corpus', () => {
  assert.deepEqual(resolveContextQuestion(), {
    questionId: 'CORE-01', revision: 1, canonicalText: 'Tell me about yourself.',
    tags: ['CORE'], source: 'founder_core',
  });
});

test('OpenAI transcription adapter fails closed when unconfigured or when provider returns a mock marker', async () => {
  const missing = createOpenAiTranscriptionProvider({ apiKey: '' });
  assert.equal((await missing.transcribeAnswer({ audio: Buffer.from('audio') })).reason, 'TRANSCRIPT_PROVIDER_UNCONFIGURED');
  const mocked = createOpenAiTranscriptionProvider({
    apiKey: 'test-key-long-enough',
    fetchImpl: async () => new Response(JSON.stringify({ text: '[MOCK_WHISPER] fake' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }),
  });
  const result = await mocked.transcribeAnswer({ audio: Buffer.from('audio') });
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.reason, 'TRANSCRIPT_PROVIDER_ERROR');
  assert.equal(result.segments.length, 0);
});

test('Context provider uses only student-safe events, derives pace above Analytics, and returns one command', async () => {
  const provider = createContextIntelligenceProvider({
    transcriptionProvider: { transcribeAnswer: async () => realTranscript() },
    semanticProvider: { analyze: async () => semantic() },
    now: () => 42_000,
  });
  const result = await provider.analyze({
    sessionId, answerId, questionId: 'CORE-01', analyticsEvents: [analyticsEvent()],
    audio: Buffer.from('real-audio-placeholder'), transcriptEnabled: true,
  });
  assert.equal(result.question.canonicalText, 'Tell me about yourself.');
  assert.equal(result.transcript.truthLabel, 'REAL');
  assert.equal(result.analyticsObservations.length, 1);
  assert.equal(result.masterDerived.basis, 'MASTER_DERIVED_FROM_TRANSCRIPT_WORDCOUNT_AND_ANSWER_DURATION');
  assert.ok(['SLOW_DOWN', 'PICK_UP_PACE', 'SPEAK_UP', 'EASE_VOLUME', 'NO_CUE'].includes(result.coachCommand.cue));
  assert.equal(result.persistence.transcript, false);
  assert.equal(result.persistence.analysis, false);
  assert.equal(result.persistence.coachCommand, false);
});

test('mock transcript never reaches semantic analysis', async () => {
  let semanticCalls = 0;
  const provider = createContextIntelligenceProvider({
    transcriptionProvider: { transcribeAnswer: async () => realTranscript('[MOCK_WHISPER] fake') },
    semanticProvider: { analyze: async () => { semanticCalls += 1; return semantic(); } },
  });
  await assert.rejects(() => provider.analyze({
    sessionId, answerId, analyticsEvents: [analyticsEvent()],
    audio: Buffer.from('audio'), transcriptEnabled: true,
  }), /Mock transcript/u);
  assert.equal(semanticCalls, 0);
});

test('prohibited semantic claim is suppressed and forces NO_CUE', async () => {
  const provider = createContextIntelligenceProvider({
    transcriptionProvider: { transcribeAnswer: async () => realTranscript() },
    semanticProvider: { analyze: async () => semantic('The student is honest and professionally ready.') },
  });
  const result = await provider.analyze({
    sessionId, answerId, analyticsEvents: [analyticsEvent()],
    audio: Buffer.from('audio'), transcriptEnabled: true,
  });
  assert.equal(result.analysis.status, 'UNAVAILABLE');
  assert.equal(result.analysis.reason, 'CONTEXT_CLAIM_SCREEN_REJECTED');
  assert.equal(result.coachCommand.cue, 'NO_CUE');
});

test('unvalidated Analytics event is rejected before either provider runs', async () => {
  let calls = 0;
  const provider = createContextIntelligenceProvider({
    transcriptionProvider: { transcribeAnswer: async () => { calls += 1; return realTranscript(); } },
    semanticProvider: { analyze: async () => { calls += 1; return semantic(); } },
  });
  await assert.rejects(() => provider.analyze({
    sessionId, answerId,
    analyticsEvents: [{ ...analyticsEvent(), maturity: MATURITY.FOUNDER_EXPERIMENTAL }],
    audio: Buffer.from('audio'), transcriptEnabled: true,
  }), /ANALYTICS_PROJECTION_INVALID/u);
  assert.equal(calls, 0);
});

class ResponseCapture {
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  write(body = '') { this.body = `${this.body || ''}${Buffer.from(body).toString()}`; return true; }
  end(body = '') { this.body = `${this.body || ''}${Buffer.from(body).toString()}`; }
  json() { return this.body ? JSON.parse(this.body) : null; }
}

function request(method = 'POST', body = {}, csrf = true) {
  const stream = Readable.from([Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.headers = csrf ? { origin: 'https://hq.test', 'sec-fetch-site': 'same-origin', 'x-mmhq-csrf': 'a'.repeat(24) } : {};
  return stream;
}

function hqSession(roles = ['student']) {
  return {
    version: 1, issuedAt: new Date(Date.now() - 1_000).toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    csrfToken: 'a'.repeat(24), authSource: 'wordpress-cookie',
    user: { id: 42, roles, displayName: 'Student 42', login: 'student42' },
  };
}

function registry({ entitled = true } = {}) {
  return {
    refreshSubject: async () => {}, isRevoked: () => false,
    entitlementFor: (subject) => ({ subject, revision: 'test', expiresAtMs: Date.now() + 60_000, voice: entitled, video: entitled, founder: false }),
  };
}

function route({ enabled = true, entitled = true, contextProvider, repository, storage } = {}) {
  return createIvocHandler({
    registry: registry({ entitled }),
    repository: repository || { single: async () => null, request: async () => [], insert: async () => null, update: async () => null },
    storage: storage || {},
    contextProvider: contextProvider || { question: resolveContextQuestion, analyze: async () => { throw new Error('not used'); } },
    env: {
      IVPREP_ENABLED: 'true', IVPREP_ADMIN_CANARY_ENABLED: 'true',
      IVOC_CONTEXT_CANDIDATE_ENABLED: String(enabled), IVOC_CONTEXT_TRANSCRIPT_ENABLED: 'true',
      MMHQ_SESSION_SECRET: 's'.repeat(64),
    },
  });
}

const base = {
  cookieFingerprint: 'f'.repeat(64), hqSessionMaxTtlSeconds: 28_800, expectedOrigin: 'https://hq.test',
  url: new URL('https://hq.test/api/ivoc/v1/context'),
};

test('context route inherits auth, entitlement, CSRF, and default-off feature gates', async () => {
  const anonymous = new ResponseCapture();
  await route()({ ...base, request: request('POST', { action: 'prepare' }), response: anonymous, hqSession: null });
  assert.equal(anonymous.status, 401);

  const ineligible = new ResponseCapture();
  await route({ entitled: false })({ ...base, request: request('POST', { action: 'prepare' }), response: ineligible, hqSession: hqSession() });
  assert.equal(ineligible.status, 403);

  const noCsrf = new ResponseCapture();
  await route()({ ...base, request: request('POST', { action: 'prepare' }, false), response: noCsrf, hqSession: hqSession() });
  assert.equal(noCsrf.status, 403);

  const disabled = new ResponseCapture();
  await route({ enabled: false })({ ...base, request: request('POST', { action: 'prepare' }), response: disabled, hqSession: hqSession() });
  assert.equal(disabled.status, 503);

  for (const roles of [['student'], ['administrator']]) {
    const allowed = new ResponseCapture();
    await route()({ ...base, request: request('POST', { action: 'prepare' }), response: allowed, hqSession: hqSession(roles) });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.json().question.questionId, 'CORE-01');
  }
});

test('analyze route reads only the owner sealed object and persists no context output', async () => {
  let inserts = 0;
  let updates = 0;
  let analyzeInput = null;
  const repository = {
    single: async (path) => {
      if (path.startsWith(`ivoc_sessions?id=eq.${sessionId}`)) return { id: sessionId, owner_subject: 'wp:42' };
      if (path.startsWith(`ivoc_recordings?id=eq.${recordingId}`)) return { id: recordingId, session_id: sessionId, owner_subject: 'wp:42', status: 'saved', storage_object_key: 'private/object.webm', mime_type: 'video/webm' };
      return null;
    },
    request: async () => [],
    insert: async () => { inserts += 1; },
    update: async () => { updates += 1; },
  };
  const expected = {
    schema: 'missionmed.ivoc.context.result.v1', sessionId, answerId,
    question: resolveContextQuestion(), transcript: realTranscript(), analysis: {
      status: 'UNAVAILABLE', schema: 'missionmed.ivoc.context.analysis.v1', analysisId: null,
      reason: 'TEST', semanticObservations: [], contextTags: [], limitations: ['TEST'], score: 0, coverage: 0,
      provenance: { provider: 'server-only', model: null, policyVersion: 'context-v1', truthLabel: 'UNAVAILABLE' },
    },
    analyticsObservations: [], masterDerived: null,
    coachCommand: { cue: 'NO_CUE' },
    persistence: { transcript: false, analysis: false, behaviorRegistry: false, coachCommand: false },
  };
  const response = new ResponseCapture();
  await route({
    repository,
    storage: { fetchObject: async () => new Response('real-audio', { status: 200, headers: { 'Content-Type': 'video/webm', 'Content-Length': '10' } }) },
    contextProvider: { question: resolveContextQuestion, analyze: async (input) => { analyzeInput = input; return expected; } },
  })({
    ...base,
    request: request('POST', { action: 'analyze', sessionId, recordingId, answerId, questionId: 'CORE-01', analyticsEvents: [analyticsEvent()] }),
    response, hqSession: hqSession(),
  });
  assert.equal(response.status, 200);
  assert.equal(analyzeInput.questionId, 'CORE-01');
  assert.equal(analyzeInput.transcriptEnabled, true);
  assert.equal(inserts, 0);
  assert.equal(updates, 0);
  assert.doesNotMatch(response.body, /storage_object_key|private\/object/u);
});
