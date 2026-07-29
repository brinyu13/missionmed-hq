import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LOW_CONFIDENCE_LOGPROB,
  createOpenAIGpt4oTranscribeDriver,
} from '../../server/transcription/openai-gpt-4o-transcribe.mjs';
import {
  createOpenAIWhisper1Driver,
} from '../../server/transcription/openai-whisper1.mjs';

const testApiKey = 'test-only-openai-key';
const endpoint = 'https://api.openai.com/v1/audio/transcriptions';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function capturingFetch(payload) {
  const calls = [];
  return {
    calls,
    async fetchImpl(url, init) {
      calls.push({ url, init });
      return jsonResponse(payload);
    },
  };
}

function formValues(form) {
  return Object.fromEntries([...form.entries()].map(([name, value]) => [
    name,
    typeof value === 'string'
      ? value
      : { name: value.name, size: value.size, type: value.type },
  ]));
}

test('gpt-4o driver sends the exact bounded multipart request and maps confidence', async () => {
  const double = capturingFetch({
    text: 'Lowword stable. ',
    logprobs: [
      { token: 'Low', logprob: -1.4 },
      { token: 'word', logprob: -1.2 },
      { token: ' stable.', logprob: -0.2 },
      { token: ' ', logprob: -0.1 },
    ],
    usage: {
      input_tokens: 11,
      output_tokens: 4,
      total_tokens: 15,
      input_token_details: { audio_tokens: 8, text_tokens: 3 },
      private_provider_detail: 'must not escape',
    },
  });
  const driver = createOpenAIGpt4oTranscribeDriver({
    apiKey: testApiKey,
    fetchImpl: double.fetchImpl,
  });

  const result = await driver.transcribeSegment({
    buffer: Buffer.from('private-test-audio'),
    mimeType: 'audio/mp4',
    seq: 7,
    keywords: ['Whipple', 'overnight'],
    promptTail: 'Previous final text.',
    languageHint: 'ES',
  });

  assert.deepEqual(driver.capabilities(), { keywords: true, confidence: true });
  assert.equal(double.calls.length, 1);
  const [{ url, init }] = double.calls;
  assert.equal(url, endpoint);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, `Bearer ${testApiKey}`);
  assert.equal(init.signal instanceof AbortSignal, true);
  assert.deepEqual(formValues(init.body), {
    file: {
      name: 'seg-00007.m4a',
      size: Buffer.byteLength('private-test-audio'),
      type: 'audio/mp4',
    },
    model: 'gpt-4o-transcribe',
    language: 'es',
    prompt: 'Previous final text.\nVocabulary: Whipple, overnight',
    response_format: 'json',
    'include[]': 'logprobs',
  });
  assert.equal(init.body.has('keywords'), false);
  assert.equal(init.body.has('languages'), false);
  assert.equal(init.body.has('stream'), false);
  assert.equal(init.body.has('temperature'), false);

  assert.equal(result.text, 'Lowword stable. ');
  assert.equal(result.providerId, 'openai');
  assert.equal(result.modelId, 'gpt-4o-transcribe');
  assert.equal(result.words[0].word, 'Lowword');
  assert.equal(result.words[0].confidence, -1.2999999999999998);
  assert.equal(result.words[1].confidence, -0.2);
  assert.deepEqual(result.flaggedTerms, [{
    from: 'Lowword',
    to: 'Lowword',
    source: 'confidence',
    confidence: -1.2999999999999998,
  }]);
  assert.ok(result.flaggedTerms[0].confidence < LOW_CONFIDENCE_LOGPROB);
  assert.deepEqual(result.usage, {
    inputTokens: 11,
    outputTokens: 4,
    totalTokens: 15,
    inputAudioTokens: 8,
    inputTextTokens: 3,
  });
  assert.equal('private_provider_detail' in result.usage, false);
});

test('whisper driver folds vocabulary into prompt and never invents confidence', async () => {
  const double = capturingFetch({
    text: 'Whipple was discussed.',
    usage: { seconds: 4.25 },
    logprobs: [{ token: 'Whipple', logprob: -9 }],
  });
  const driver = createOpenAIWhisper1Driver({
    apiKey: testApiKey,
    fetchImpl: double.fetchImpl,
  });

  const result = await driver.transcribeSegment({
    buffer: new Uint8Array([1, 2, 3]),
    mimeType: 'audio/ogg',
    seq: 0,
    keywords: ['Whipple', 'paracentesis'],
    promptTail: '',
  });

  assert.deepEqual(driver.capabilities(), { keywords: true, confidence: false });
  assert.deepEqual(formValues(double.calls[0].init.body), {
    file: {
      name: 'seg-00000.ogg',
      size: 3,
      type: 'audio/ogg',
    },
    model: 'whisper-1',
    language: 'en',
    prompt: 'Vocabulary: Whipple, paracentesis',
    response_format: 'json',
  });
  assert.equal(double.calls[0].init.body.has('include[]'), false);
  assert.equal(result.text, 'Whipple was discussed.');
  assert.equal('words' in result, false);
  assert.equal('confidence' in result, false);
  assert.deepEqual(result.flaggedTerms, []);
  assert.deepEqual(result.usage, { durationSeconds: 4.25 });
});

test('prompt truncation keeps the full 200-character tail and drops whole terms from the end', async () => {
  const double = capturingFetch({ text: '' });
  const driver = createOpenAIGpt4oTranscribeDriver({
    apiKey: testApiKey,
    fetchImpl: double.fetchImpl,
  });
  const tail = `discarded-${'T'.repeat(200)}`;
  const terms = [
    `lexicon-a-${'a'.repeat(110)}`,
    `lexicon-b-${'b'.repeat(110)}`,
    `title-a-${'c'.repeat(110)}`,
    `title-b-${'d'.repeat(110)}`,
  ];

  await driver.transcribeSegment({
    buffer: Buffer.from([1]),
    mimeType: 'audio/wav',
    seq: 12,
    keywords: terms,
    promptTail: tail,
  });

  const prompt = double.calls[0].init.body.get('prompt');
  assert.ok(prompt.length <= 600);
  assert.equal(prompt.startsWith('T'.repeat(200)), true);
  assert.equal(prompt.includes('discarded-'), false);
  assert.equal(prompt.includes(terms[0]), true);
  assert.equal(prompt.includes(terms[1]), true);
  assert.equal(prompt.includes(terms[2]), true);
  assert.equal(prompt.includes(terms[3]), false);
  assert.equal(prompt.endsWith(terms[2]), true);
});

test('drivers map fixed HTTP and abort failures without exposing provider bodies', async () => {
  const cases = [
    [400, 'transcribe_rejected_format', undefined],
    [401, 'transcribe_unavailable', 'hard'],
    [403, 'transcribe_unavailable', 'hard'],
    [404, 'transcribe_unavailable', 'hard'],
    [408, 'transcribe_timeout', undefined],
    [429, 'transcribe_unavailable', undefined],
    [503, 'transcribe_unavailable', undefined],
  ];
  for (const [status, code, providerFailure] of cases) {
    const driver = createOpenAIGpt4oTranscribeDriver({
      apiKey: testApiKey,
      fetchImpl: async () => jsonResponse({
        error: { message: 'private vendor response must not escape' },
      }, status),
    });
    await assert.rejects(
      driver.transcribeSegment({
        buffer: Buffer.from([1]),
        mimeType: 'audio/webm',
        seq: 0,
      }),
      (error) => (
        error.code === code
        && error.status === status
        && error.providerFailure === providerFailure
        && !error.message.includes('vendor')
      ),
    );
  }

  const aborting = createOpenAIGpt4oTranscribeDriver({
    apiKey: testApiKey,
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('private timeout detail'), { name: 'AbortError' }));
      }, { once: true });
    }),
  });
  await assert.rejects(
    aborting.transcribeSegment({
      buffer: Buffer.from([1]),
      mimeType: 'audio/webm',
      seq: 0,
    }),
    (error) => (
      error.code === 'transcribe_timeout'
      && !error.message.includes('private')
    ),
  );
});

test('driver factories reject missing credentials, unfixed models, and invalid input locally', async () => {
  assert.throws(
    () => createOpenAIGpt4oTranscribeDriver(),
    /apiKey must be supplied/,
  );
  assert.throws(
    () => createOpenAIGpt4oTranscribeDriver({
      apiKey: testApiKey,
      model: 'gpt-4o-mini-transcribe',
    }),
    /requires gpt-4o-transcribe/,
  );
  assert.throws(
    () => createOpenAIWhisper1Driver({
      apiKey: testApiKey,
      model: 'gpt-4o-transcribe',
    }),
    /requires whisper-1/,
  );

  let called = false;
  const driver = createOpenAIWhisper1Driver({
    apiKey: testApiKey,
    fetchImpl: async () => {
      called = true;
      return jsonResponse({ text: 'must not run' });
    },
  });
  await assert.rejects(
    driver.transcribeSegment({
      buffer: Buffer.from([1]),
      mimeType: 'audio/aac',
      seq: 0,
    }),
    (error) => error.code === 'transcribe_rejected_format',
  );
  assert.equal(called, false);
});
