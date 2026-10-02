import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { ANALYTICS_ENGINE_VERSION, MATURITY, createEvidenceEvent } from '../../../ivprep-v6/public/analytics/event-contract.mjs';
import {
  createContextIntelligenceProvider,
  createOpenAiTranscriptionProvider,
  normalizeAnalysis,
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

function semantic(text = 'The answer explicitly connects a family value of listening with the student’s approach to patients.', coachingPatterns = []) {
  return {
    questionIntent: { label: 'PERSONAL_NARRATIVE', score: 0.94 },
    answerStage: { label: 'EVIDENCE', score: 0.83 },
    semanticObservations: [{ kind: 'SUPPORTED_CLAIM', text, transcriptSegmentIds: ['seg-1'] }],
    coachingPatterns,
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

test('OpenAI transcription adapter never transfers an unproven recording or accepts client attribution', async () => {
  const missing = createOpenAiTranscriptionProvider({ apiKey: '' });
  assert.equal((await missing.transcribeAnswer({ audio: Buffer.from('audio') })).reason, 'TRANSCRIPT_PROVIDER_UNCONFIGURED');
  let calls = 0;
  const mocked = createOpenAiTranscriptionProvider({
    apiKey: 'test-key-long-enough',
    fetchImpl: async () => { calls += 1; return new Response(JSON.stringify({ text: '[MOCK_WHISPER] fake' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }); },
  });
  const result = await mocked.transcribeAnswer({ audio: Buffer.from('audio'), candidateOnly: true,
    sourceReceipt: { status: 'VERIFIED', role: 'candidate', channel: 0 } });
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
  assert.equal(result.segments.length, 0);
  assert.equal(calls, 0);
});

test('Context provider preserves student-safe sensor events but withholds candidate-derived pace and coaching', async () => {
  let calls = 0;
  const provider = createContextIntelligenceProvider({
    transcriptionProvider: { transcribeAnswer: async () => { calls += 1; return realTranscript(); } },
    semanticProvider: { analyze: async () => { calls += 1; return semantic(); } },
    now: () => 42_000,
  });
  const result = await provider.analyze({
    sessionId, answerId, questionId: 'CORE-01', analyticsEvents: [analyticsEvent()],
    audio: Buffer.from('real-audio-placeholder'), transcriptEnabled: true,
  });
  assert.equal(result.question.canonicalText, 'Tell me about yourself.');
  assert.equal(result.transcript.truthLabel, 'UNAVAILABLE');
  assert.equal(result.transcript.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
  assert.equal(result.analyticsObservations.length, 1);
  assert.equal(result.masterDerived, null);
  assert.equal(result.coachCommand.cue, 'NO_CUE');
  assert.equal(calls, 0);
  assert.equal(result.persistence.transcript, false);
  assert.equal(result.persistence.analysis, false);
  assert.equal(result.persistence.coachCommand, false);
});

test('pure synthetic teaching normalization keeps coaching evidence structured, cited, and bounded', () => {
  const analysis = normalizeAnalysis(semantic(undefined, [{
      facet: 'specificity', polarity: 'strength',
      text: 'The answer gives one concrete family example.', transcriptSegmentIds: ['seg-1'],
    }]), { sessionId, answerId, transcript: realTranscript(), durationMs: 42000, model: 'offline-fixture' });
  assert.deepEqual(analysis.coachingPatterns, [{
    facet: 'specificity', polarity: 'strength',
    text: 'The answer gives one concrete family example.', transcriptSegmentIds: ['seg-1'],
  }]);
});

test('mock transcript never reaches semantic analysis', async () => {
  let semanticCalls = 0;
  const provider = createContextIntelligenceProvider({
    transcriptionProvider: { transcribeAnswer: async () => realTranscript('[MOCK_WHISPER] fake') },
    semanticProvider: { analyze: async () => { semanticCalls += 1; return semantic(); } },
  });
  const result = await provider.analyze({
    sessionId, answerId, analyticsEvents: [analyticsEvent()],
    audio: Buffer.from('audio'), transcriptEnabled: true,
  });
  assert.equal(result.analysis.status, 'UNAVAILABLE');
  assert.equal(semanticCalls, 0);
  assert.throws(() => normalizeAnalysis(semantic(), { sessionId, answerId,
    transcript: realTranscript('[MOCK_WHISPER] fake'), durationMs: 42000, model: 'offline-fixture' }), /Mock transcript/u);
});

test('short unsupported or unfinished answers do not earn concision strength', async () => {
  for (const stage of ['UNSUPPORTED', 'EVIDENCE', 'COMPLETE']) {
    const analysis = normalizeAnalysis({ ...semantic(undefined, [
        {facet:'concision',polarity:'strength',text:'The response is brief.',transcriptSegmentIds:['seg-1']},
        {facet:'specificity',polarity:'weakness',text:'No specific actions are stated.',transcriptSegmentIds:['seg-1']},
      ]), answerStage:{label:stage,score:.9} }, { sessionId, answerId,
      transcript: realTranscript('I learned a lot and everything worked out well.'), durationMs: 42000, model: 'offline-fixture' });
    assert.equal(analysis.status,'AVAILABLE');
    assert.equal(analysis.coachingPatterns.some(pattern=>pattern.facet==='concision'),stage==='COMPLETE');
    assert.equal(analysis.coachingPatterns.some(pattern=>pattern.facet==='specificity'),true);
    assert.equal(analysis.provenance.policyVersion,'context-v1.1');
    if(stage!=='COMPLETE') assert.match(analysis.limitations[0],/Brevity alone/);
  }
});

test('prohibited semantic fixture is rejected; production containment forces NO_CUE', async () => {
  assert.throws(() => normalizeAnalysis(semantic('The student is honest and professionally ready.'), {
    sessionId, answerId, transcript: realTranscript(), durationMs: 42000, model: 'offline-fixture',
  }), /CONTEXT_CLAIM_SCREEN_REJECTED/u);
  const provider = createContextIntelligenceProvider({
    transcriptionProvider: { transcribeAnswer: async () => realTranscript() },
    semanticProvider: { analyze: async () => semantic('The student is honest and professionally ready.') },
  });
  const result = await provider.analyze({
    sessionId, answerId, analyticsEvents: [analyticsEvent()],
    audio: Buffer.from('audio'), transcriptEnabled: true,
  });
  assert.equal(result.analysis.status, 'UNAVAILABLE');
  assert.equal(result.analysis.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
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

test('analyze route contains even historical candidate-labeled media before download/provider/canonical writes', async () => {
  // The provider result remains server-owned through persistence; no client transcript is trusted.
  let inserts = 0;
  let updates = 0;
  const upserts = [];
  let analyzeInput = null;
  let downloads = 0;
  const repository = {
    single: async (path) => {
      if (path.startsWith(`ivoc_sessions?id=eq.${sessionId}`)) return { id: sessionId, owner_subject: 'wp:42', session_type: 'question', interviewer_provider: 'missionmed-static', analytics_schema: 'ivoc.analytics.v1', context: {}, started_at: '2026-09-17T20:00:00.000Z' };
      if (path.startsWith(`ivoc_recordings?id=eq.${recordingId}`)) return { id: recordingId, session_id: sessionId, owner_subject: 'wp:42', status: 'saved', storage_object_key: 'private/object.webm', mime_type: 'video/webm', duration_ms: 42_000 };
      return null;
    },
    request: async () => [],
    insert: async () => { inserts += 1; },
    update: async () => { updates += 1; },
    upsert: async (table, conflict, body) => { upserts.push({ table, conflict, body }); return body; },
  };
  const expected = {
    schema: 'missionmed.ivoc.context.result.v1', sessionId, answerId,
    question: resolveContextQuestion(), transcript: realTranscript(), analysis: {
      status: 'AVAILABLE', schema: 'missionmed.ivoc.context.analysis.v1', analysisId: 'analysis-1',
      range: { startMs: 0, endMs: 42_000 },
      questionIntent: { label: 'PERSONAL_NARRATIVE', score: 0.9 },
      answerStage: { label: 'EVIDENCE', score: 0.8 },
      semanticObservations: [{ kind: 'SUPPORTED_CLAIM', text: 'The answer cites a family value.', transcriptSegmentIds: ['seg-1'] }],
      coachingPatterns: [{ facet: 'specificity', polarity: 'strength', text: 'The answer gives a concrete example.', transcriptSegmentIds: ['seg-1'] }],
      contextTags: ['PERSONAL_BACKGROUND'], limitations: ['Only the final transcript was analyzed.'], score: 0.86, coverage: 0.91,
      provenance: { provider: 'openai', model: 'test-context-model', policyVersion: 'context-v1', truthLabel: 'REAL' },
    },
    analyticsObservations: [], masterDerived: null,
    coachCommand: { cue: 'NO_CUE' },
    persistence: { transcript: false, analysis: false, behaviorRegistry: false, coachCommand: false },
  };
  const response = new ResponseCapture();
  await route({
    repository,
    storage: { fetchObject: async () => { downloads += 1; return new Response('real-audio', { status: 200, headers: { 'Content-Type': 'video/webm', 'Content-Length': '10' } }); } },
    contextProvider: { question: resolveContextQuestion, analyze: async (input) => { analyzeInput = input; return expected; } },
  })({
    ...base,
    request: request('POST', { action: 'analyze', sessionId, recordingId, answerId, questionId: 'CORE-01', analyticsEvents: [analyticsEvent()] }),
    response, hqSession: hqSession(),
  });
  assert.equal(response.status, 409);
  assert.equal(response.json().error, 'context_candidate_audio_source_unverified');
  assert.equal(response.json().candidateAttribution.status, 'UNVERIFIED');
  assert.equal(analyzeInput, null);
  assert.equal(downloads, 0);
  assert.deepEqual(upserts, []);
  assert.equal(inserts, 0);
  assert.equal(updates, 0);
  assert.doesNotMatch(response.body, /storage_object_key|private\/object/u);
});

test('mixed, unknown, historical and forged candidate receipts cannot activate analysis or download', async () => {
  for (const fixture of [
    { session_type: 'simulation', interviewer_provider: 'openai-gpt-live' },
    { session_type: 'unknown', interviewer_provider: null },
    { session_type: 'question', interviewer_provider: 'missionmed-static', created_at: '2020-01-01T00:00:00Z' },
    { session_type: 'question', context: { candidateOnly: true, candidateAttribution: { status: 'VERIFIED' } } },
  ]) {
    let downloads = 0; let providerCalls = 0; let canonicalWrites = 0;
    const repository = {
      single: async path => path.startsWith('ivoc_sessions?')
        ? { id: sessionId, owner_subject: 'wp:42', ...fixture }
        : { id: recordingId, session_id: sessionId, owner_subject: 'wp:42', status: 'saved',
          candidate_audio_source: { role: 'candidate', verified: true }, storage_object_key: 'private/mixed.webm' },
      request: async () => [], insert: async () => null,
      upsert: async () => { canonicalWrites += 1; }, update: async () => { canonicalWrites += 1; },
    };
    const response = new ResponseCapture();
    await route({ repository, storage: { fetchObject: async () => { downloads += 1; throw Error('No download'); } },
      contextProvider: { question: resolveContextQuestion, analyze: async () => { providerCalls += 1; throw Error('No provider'); } },
    })({ ...base, request: request('POST', { action: 'analyze', sessionId, recordingId, answerId,
      questionId: 'CORE-01', sourceReceipt: { status: 'VERIFIED', role: 'candidate', channel: 0 },
      candidateOnly: true, transcript: realTranscript(), analyticsEvents: [] }), response, hqSession: hqSession() });
    assert.equal(response.status, 409);
    assert.equal(response.json().candidateAttribution.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
    assert.deepEqual([downloads, providerCalls, canonicalWrites], [0, 0, 0]);
  }
});

test('provider containment ignores mixed/unknown/client source claims even with injected transcription', async () => {
  let calls = 0;
  const provider = createContextIntelligenceProvider({
    transcriptionProvider: { transcribeAnswer: async () => { calls += 1; return realTranscript(); } },
    semanticProvider: { analyze: async () => { calls += 1; return semantic(); } },
  });
  for (const source of [null, 'mixed', { status: 'VERIFIED', role: 'candidate' }]) {
    const result = await provider.analyze({ sessionId, answerId, transcriptEnabled: true,
      audio: Buffer.from('synthetic mixed fixture'), sourceReceipt: source, candidateOnly: true, analyticsEvents: [] });
    assert.equal(result.transcript.reason, 'CANDIDATE_AUDIO_SOURCE_UNVERIFIED');
    assert.equal(result.analysis.status, 'UNAVAILABLE');
    assert.deepEqual(result.analysis.coachingPatterns, []);
    assert.equal(result.masterDerived, null);
    assert.equal(result.coachCommand.cue, 'NO_CUE');
    assert.equal(result.persistence.transcript, false);
  }
  assert.equal(calls, 0);
});

test('context analysis retains owner privacy denial before revealing containment state', async () => {
  let calls = 0;
  const response = new ResponseCapture();
  await route({ repository: { single: async () => ({ owner_subject: 'wp:7' }), insert: async () => null },
    storage: { fetchObject: async () => { calls += 1; } },
    contextProvider: { question: resolveContextQuestion, analyze: async () => { calls += 1; } },
  })({ ...base, request: request('POST', { action: 'analyze', sessionId, recordingId, answerId }),
    response, hqSession: hqSession() });
  assert.equal(response.status, 404);
  assert.deepEqual(response.json(), { error: 'not_found' });
  assert.equal(calls, 0);
});
