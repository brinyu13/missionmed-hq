import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TranscriptionError,
  createTranscriptionAdapter,
  createTranscriptionAdapterForProvider,
  createUnavailableTranscriptionAdapter,
} from '../../server/transcription/adapter.mjs';
import {
  flagLexiconTerms,
  medicalLexiconVersion,
} from '../../server/transcription/lexicon.mjs';
import { keywordsForDraft } from '../../server/transcription/keywords.mjs';

const recordingId = '11111111-1111-4111-8111-111111111111';
const studentId = '33333333-3333-4333-8333-333333333333';

function result(text, providerId = 'internal') {
  return {
    text,
    providerId,
    modelId: 'configured-model',
  };
}

test('medical lexicon flags only evidence-backed fuzzy or casing corrections', () => {
  assert.deepEqual(flagLexiconTerms('whipple anastomoss and aspirin'), [
    {
      from: 'whipple',
      to: 'Whipple',
      source: 'lexicon',
      lexiconVersion: medicalLexiconVersion,
    },
    {
      from: 'anastomoss',
      to: 'anastomosis',
      source: 'lexicon',
      lexiconVersion: medicalLexiconVersion,
    },
  ]);
  assert.deepEqual(flagLexiconTerms('Whipple anastomosis aspirin'), []);
});

test('draft keywords are bounded, deduplicated, and tokenized rather than carrying prose', () => {
  const keywords = keywordsForDraft({
    draftTitle: 'A difficult overnight metoprolol handoff with metoprolol',
  });
  assert.equal(keywords.includes('metoprolol'), true);
  assert.equal(keywords.includes('difficult'), true);
  assert.equal(keywords.includes('overnight'), true);
  assert.equal(keywords.filter((word) => word === 'metoprolol').length, 1);
  assert.equal(keywords.includes('A difficult overnight metoprolol handoff with metoprolol'), false);
  assert.ok(keywords.length <= 27);
});

test('lexicon evidence wins an overlapping provider confidence flag', async () => {
  const adapter = createTranscriptionAdapter({
    primary: {
      async transcribeSegment() {
        return {
          ...result('anastomoss stable'),
          flaggedTerms: [
            {
              from: 'anastomoss',
              to: 'anastomoss',
              source: 'confidence',
              confidence: -2,
            },
            {
              from: 'stable',
              to: 'stable',
              source: 'confidence',
              confidence: -1.5,
            },
          ],
        };
      },
    },
  });

  const transcript = await adapter.transcribeSegment({ recordingId, seq: 0 });
  assert.deepEqual(transcript.flaggedTerms, [
    {
      from: 'anastomoss',
      to: 'anastomosis',
      source: 'lexicon',
      lexiconVersion: medicalLexiconVersion,
    },
    {
      from: 'stable',
      to: 'stable',
      source: 'confidence',
      confidence: -1.5,
    },
  ]);
});

test('adapter preserves only fixed content-free provider usage metrics', async () => {
  const adapter = createTranscriptionAdapter({
    primary: {
      async transcribeSegment() {
        return {
          ...result('Safe transcript'),
          usage: {
            inputTokens: 12,
            outputTokens: 4,
            durationSeconds: 3.5,
            transcript: 'must never pass through',
            nested: { private: true },
          },
        };
      },
    },
  });
  const transcript = await adapter.transcribeSegment({ recordingId, seq: 0 });
  assert.deepEqual(transcript.usage, {
    inputTokens: 12,
    outputTokens: 4,
    durationSeconds: 3.5,
  });
});

test('timeout gets one immediate retry without inventing transcript content', async () => {
  let calls = 0;
  const adapter = createTranscriptionAdapter({
    primary: {
      async transcribeSegment() {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('private vendor detail'), {
          name: 'AbortError',
        });
        return result('');
      },
    },
  });
  const transcript = await adapter.transcribeSegment({ recordingId, seq: 0 });
  assert.equal(calls, 2);
  assert.equal(transcript.text, '');
});

test('a rejected format routes only that segment to fallback', async () => {
  const calls = [];
  const adapter = createTranscriptionAdapter({
    primary: {
      async transcribeSegment(input) {
        calls.push(`primary:${input.seq}`);
        if (input.seq === 0) {
          throw new TranscriptionError(
            'transcribe_rejected_format',
            'Internal format rejection.',
          );
        }
        return result('primary transcript', 'primary');
      },
    },
    fallback: {
      async transcribeSegment(input) {
        calls.push(`fallback:${input.seq}`);
        return result('fallback transcript', 'fallback');
      },
    },
  });
  assert.equal((await adapter.transcribeSegment({ recordingId, seq: 0 })).providerId, 'fallback');
  assert.equal((await adapter.transcribeSegment({ recordingId, seq: 1 })).providerId, 'primary');
  assert.deepEqual(calls, ['primary:0', 'fallback:0', 'primary:1']);
});

test('a hard primary failure switches only that recording session to fallback', async () => {
  const events = [];
  const calls = [];
  const adapter = createTranscriptionAdapter({
    primary: {
      async transcribeSegment(input) {
        calls.push(`primary:${input.recordingId}:${input.seq}`);
        if (input.recordingId === recordingId) {
          throw Object.assign(new Error('private vendor detail'), { status: 401 });
        }
        return result('other session primary', 'primary');
      },
    },
    fallback: {
      async transcribeSegment(input) {
        calls.push(`fallback:${input.recordingId}:${input.seq}`);
        return result('session fallback', 'fallback');
      },
    },
    emitEvent(event) {
      events.push(event);
    },
    now: () => Date.parse('2026-07-29T12:00:00.000Z'),
  });
  assert.equal((await adapter.transcribeSegment({
    recordingId,
    studentId,
    seq: 0,
  })).providerId, 'fallback');
  assert.equal(adapter.hasPendingFailover(recordingId), true);
  assert.equal(adapter.acknowledgeFailover(recordingId), true);
  assert.equal(adapter.hasPendingFailover(recordingId), false);
  assert.equal(adapter.acknowledgeFailover(recordingId), false);
  assert.equal((await adapter.transcribeSegment({ recordingId, seq: 1 })).providerId, 'fallback');
  const other = '22222222-2222-4222-8222-222222222222';
  assert.equal((await adapter.transcribeSegment({ recordingId: other, seq: 0 })).providerId, 'primary');
  assert.deepEqual(events, [{
    t: '2026-07-29T12:00:00.000Z',
    event: 'provider_failover',
    recordingId,
    studentId,
    errorCategory: 'transcribe',
  }]);
  assert.deepEqual(calls, [
    `primary:${recordingId}:0`,
    `fallback:${recordingId}:0`,
    `fallback:${recordingId}:1`,
    `primary:${other}:0`,
  ]);
});

test('three consecutive 5xx segment failures switch the session after bounded retries', async () => {
  const events = [];
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const adapter = createTranscriptionAdapter({
    primary: {
      async transcribeSegment() {
        primaryCalls += 1;
        throw Object.assign(new Error('private vendor detail'), { status: 503 });
      },
    },
    fallback: {
      async transcribeSegment() {
        fallbackCalls += 1;
        return result('fallback transcript', 'fallback');
      },
    },
    emitEvent(event) {
      events.push(event);
    },
  });
  for (const seq of [0, 1]) {
    await assert.rejects(
      adapter.transcribeSegment({ recordingId, seq }),
      (error) => (
        error.code === 'transcribe_unavailable'
        && !error.message.includes('vendor')
      ),
    );
  }
  const third = await adapter.transcribeSegment({ recordingId, seq: 2 });
  assert.equal(third.providerId, 'fallback');
  assert.equal(primaryCalls, 6);
  assert.equal(fallbackCalls, 1);
  assert.equal(events.length, 1);
});

test('the unavailable adapter fails truthfully and exposes no fake result', async () => {
  const adapter = createUnavailableTranscriptionAdapter();
  assert.equal(adapter.available, false);
  assert.deepEqual(adapter.capabilities(), {
    keywords: false,
    confidence: false,
  });
  await assert.rejects(
    adapter.transcribeSegment({ recordingId, seq: 0 }),
    (error) => (
      error.code === 'transcribe_unavailable'
      && error.message === 'Transcription is currently unavailable.'
    ),
  );
});

test('the provider selector preserves truthful off mode and builds the inert OpenAI pair', async () => {
  const adapter = createTranscriptionAdapterForProvider(' NONE ');
  assert.equal(adapter.available, false);
  assert.deepEqual(adapter.capabilities(), {
    keywords: false,
    confidence: false,
  });
  await assert.rejects(
    adapter.transcribeSegment({ recordingId, seq: 0 }),
    (error) => error.code === 'transcribe_unavailable',
  );

  const calls = [];
  const openai = createTranscriptionAdapterForProvider(' OpEnAi ', {
    apiKey: 'test-only-openai-key',
    async fetchImpl(url, init) {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        text: 'Provider response.',
        logprobs: [
          { token: 'Provider', logprob: -0.1 },
          { token: ' response.', logprob: -0.1 },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(openai.available, true);
  assert.deepEqual(openai.capabilities(), {
    keywords: true,
    confidence: true,
  });
  const transcript = await openai.transcribeSegment({
    recordingId,
    buffer: Buffer.from([1, 2, 3]),
    mimeType: 'audio/webm',
    seq: 0,
    keywords: ['Whipple'],
    promptTail: '',
    languageHint: 'en',
  });
  assert.equal(transcript.text, 'Provider response.');
  assert.equal(transcript.modelId, 'gpt-4o-transcribe');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/audio/transcriptions');
  assert.equal(calls[0].init.body.get('model'), 'gpt-4o-transcribe');
  assert.equal(calls[0].init.body.get('include[]'), 'logprobs');

  const swappedCalls = [];
  const fixedPairSwap = createTranscriptionAdapterForProvider('openai', {
    apiKey: 'test-only-openai-key',
    primaryModel: 'whisper-1',
    fallbackModel: 'gpt-4o-transcribe',
    async fetchImpl(_url, init) {
      swappedCalls.push(init);
      return new Response(JSON.stringify({ text: '' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.deepEqual(fixedPairSwap.capabilities(), {
    keywords: true,
    confidence: false,
  });
  await fixedPairSwap.transcribeSegment({
    recordingId,
    buffer: Buffer.from([1]),
    mimeType: 'audio/wav',
    seq: 0,
  });
  assert.equal(swappedCalls[0].body.get('model'), 'whisper-1');
  assert.equal(swappedCalls[0].body.has('include[]'), false);

  assert.throws(
    () => createTranscriptionAdapterForProvider('openai'),
    /apiKey must be supplied/,
  );
  assert.throws(
    () => createTranscriptionAdapterForProvider('openai', {
      apiKey: 'test-only-openai-key',
      primaryModel: 'gpt-4o-mini-transcribe',
    }),
    /outside the fixed StoryForge pair/,
  );
  assert.throws(
    () => createTranscriptionAdapterForProvider('unapproved-provider'),
    (error) => (
      error.code === 'transcription_provider_authority_blocked'
      && !error.message.includes('unapproved-provider')
    ),
  );
});
