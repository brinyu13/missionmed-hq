const endpoint = 'https://api.openai.com/v1/audio/transcriptions';
const defaultTimeoutMs = 30_000;
const maxPromptCharacters = 600;
const contextTailCharacters = 200;
const maxProviderBytes = 25 * 1024 * 1024;
const fixedModels = new Set(['gpt-4o-transcribe', 'whisper-1']);
const mimeExtensions = Object.freeze({
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
});

export const LOW_CONFIDENCE_LOGPROB = -1.2;

function transcriptionError(code, message, {
  cause,
  providerFailure,
  status,
} = {}) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = 'TranscriptionError';
  error.code = code;
  if (Number.isInteger(status)) error.status = status;
  if (providerFailure) error.providerFailure = providerFailure;
  return error;
}

function normalizeMimeType(value) {
  const mimeType = String(value || '').split(';', 1)[0].trim().toLowerCase();
  if (!mimeExtensions[mimeType]) {
    throw transcriptionError(
      'transcribe_rejected_format',
      'The audio format could not be transcribed.',
    );
  }
  return mimeType;
}

function normalizeBytes(value) {
  let bytes = null;
  if (Buffer.isBuffer(value)) {
    bytes = value;
  } else if (value instanceof Uint8Array) {
    bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  } else if (value instanceof ArrayBuffer) {
    bytes = Buffer.from(value);
  }
  if (!bytes || bytes.byteLength < 1 || bytes.byteLength > maxProviderBytes) {
    throw transcriptionError(
      'transcribe_rejected_format',
      'The audio format could not be transcribed.',
    );
  }
  return bytes;
}

function normalizeSequence(value) {
  const seq = Number(value);
  if (!Number.isInteger(seq) || seq < 0) {
    throw transcriptionError(
      'transcribe_rejected_format',
      'The audio format could not be transcribed.',
    );
  }
  return seq;
}

function normalizeLanguage(value) {
  const language = String(value || '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(language) ? language : 'en';
}

function normalizeKeywords(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const terms = [];
  for (const raw of value) {
    const term = String(raw || '').trim();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

function composePrompt({ keywords, promptTail }) {
  const tail = String(promptTail || '').slice(-contextTailCharacters);
  const terms = normalizeKeywords(keywords);
  const prefix = tail ? `${tail}\nVocabulary: ` : 'Vocabulary: ';
  while (
    terms.length
    && `${prefix}${terms.join(', ')}`.length > maxPromptCharacters
  ) {
    terms.pop();
  }
  return terms.length ? `${prefix}${terms.join(', ')}` : tail;
}

function responseTokens(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.content)) return value.content;
  return [];
}

function wordConfidence(text, logprobs) {
  const tokenSpans = [];
  let offset = 0;
  for (const entry of responseTokens(logprobs)) {
    const token = typeof entry?.token === 'string' ? entry.token : '';
    const start = offset;
    const end = start + token.length;
    offset = end;
    const logprob = Number(entry?.logprob);
    if (!token || !Number.isFinite(logprob)) continue;
    tokenSpans.push({ start, end, logprob });
  }

  const words = [];
  for (const match of String(text || '').matchAll(/\S+/gu)) {
    const word = match[0];
    const start = Number(match.index);
    const end = start + word.length;
    const overlapping = tokenSpans.filter((token) => (
      token.end > start && token.start < end
    ));
    if (!overlapping.length) {
      words.push(Object.freeze({ word, start, end }));
      continue;
    }
    const confidence = overlapping.reduce(
      (total, token) => total + token.logprob,
      0,
    ) / overlapping.length;
    words.push(Object.freeze({ word, start, end, confidence }));
  }
  return words;
}

function confidenceFlags(words) {
  return words
    .filter((word) => (
      Number.isFinite(word.confidence)
      && word.confidence < LOW_CONFIDENCE_LOGPROB
    ))
    .map((word) => Object.freeze({
      from: word.word,
      to: word.word,
      source: 'confidence',
      confidence: word.confidence,
    }));
}

function aggregateConfidence(words) {
  const values = words
    .map((word) => word.confidence)
    .filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function finiteMetric(value) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function contentFreeUsage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return Object.freeze({});
  }
  const metrics = [
    ['inputTokens', value.input_tokens],
    ['outputTokens', value.output_tokens],
    ['totalTokens', value.total_tokens],
    ['durationSeconds', value.seconds],
    ['inputAudioTokens', value.input_token_details?.audio_tokens],
    ['inputTextTokens', value.input_token_details?.text_tokens],
    ['outputAudioTokens', value.output_token_details?.audio_tokens],
    ['outputTextTokens', value.output_token_details?.text_tokens],
  ];
  return Object.freeze(Object.fromEntries(
    metrics
      .map(([name, metric]) => [name, finiteMetric(metric)])
      .filter(([, metric]) => metric !== null),
  ));
}

function errorForStatus(status) {
  if (status === 400) {
    return transcriptionError(
      'transcribe_rejected_format',
      'The audio format could not be transcribed.',
      { status },
    );
  }
  if (status === 408) {
    return transcriptionError(
      'transcribe_timeout',
      'Transcription timed out.',
      { status },
    );
  }
  if (status === 429 || (status >= 500 && status <= 599)) {
    return transcriptionError(
      'transcribe_unavailable',
      'Transcription is currently unavailable.',
      { status },
    );
  }
  if ([401, 403, 404].includes(status)) {
    return transcriptionError(
      'transcribe_unavailable',
      'Transcription is currently unavailable.',
      { providerFailure: 'hard', status },
    );
  }
  return transcriptionError(
    'transcribe_failed_permanent',
    'Transcription could not be completed.',
    {
      ...(status >= 400 && status <= 499 ? { providerFailure: 'hard' } : {}),
      status,
    },
  );
}

function modelValue(value) {
  const model = String(value || '').trim();
  if (!fixedModels.has(model)) {
    throw new TypeError('model must be one of the fixed StoryForge transcription models.');
  }
  return model;
}

function timeoutValue(value) {
  const timeoutMs = Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('timeoutMs must be a positive integer.');
  }
  return timeoutMs;
}

export function createOpenAITranscriptionDriver({
  apiKey,
  confidence,
  fetchImpl = globalThis.fetch,
  model,
  timeoutMs = defaultTimeoutMs,
}) {
  const token = String(apiKey || '').trim();
  if (!token) throw new TypeError('apiKey must be supplied.');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');
  const selectedModel = modelValue(model);
  const requestConfidence = confidence === true;
  if (requestConfidence !== (selectedModel === 'gpt-4o-transcribe')) {
    throw new TypeError('confidence mode must match the fixed transcription model.');
  }
  const requestTimeoutMs = timeoutValue(timeoutMs);

  async function transcribeSegment(input = {}) {
    const mimeType = normalizeMimeType(input.mimeType);
    const bytes = normalizeBytes(input.buffer);
    const seq = normalizeSequence(input.seq);
    const prompt = composePrompt(input);
    const form = new FormData();
    form.set('file', new Blob([bytes], { type: mimeType }), (
      `seg-${String(seq).padStart(5, '0')}.${mimeExtensions[mimeType]}`
    ));
    form.set('model', selectedModel);
    form.set('language', normalizeLanguage(input.languageHint));
    if (prompt) form.set('prompt', prompt);
    form.set('response_format', 'json');
    if (requestConfidence) form.append('include[]', 'logprobs');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response;
    const startedAt = Date.now();
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (controller.signal.aborted || error?.name === 'AbortError') {
        throw transcriptionError(
          'transcribe_timeout',
          'Transcription timed out.',
          { cause: error },
        );
      }
      throw transcriptionError(
        'transcribe_unavailable',
        'Transcription is currently unavailable.',
        { cause: error },
      );
    }

    if (!response?.ok) {
      clearTimeout(timeoutId);
      throw errorForStatus(Number(response?.status || 0));
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        throw transcriptionError(
          'transcribe_timeout',
          'Transcription timed out.',
          { cause: error },
        );
      }
      throw transcriptionError(
        'transcribe_unavailable',
        'Transcription is currently unavailable.',
        { cause: error },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const text = typeof payload?.text === 'string' ? payload.text : '';
    const words = requestConfidence ? wordConfidence(text, payload?.logprobs) : [];
    const overallConfidence = aggregateConfidence(words);
    return Object.freeze({
      text,
      ...(requestConfidence ? {
        words,
        ...(overallConfidence === null ? {} : { confidence: overallConfidence }),
      } : {}),
      flaggedTerms: requestConfidence ? confidenceFlags(words) : [],
      providerId: 'openai',
      modelId: selectedModel,
      latencyMs: Math.max(0, Date.now() - startedAt),
      usage: contentFreeUsage(payload?.usage),
    });
  }

  function capabilities() {
    return Object.freeze({
      keywords: true,
      confidence: requestConfidence,
    });
  }

  return Object.freeze({
    capabilities,
    transcribeSegment,
  });
}

export function createOpenAIGpt4oTranscribeDriver({
  apiKey,
  fetchImpl = globalThis.fetch,
  model = 'gpt-4o-transcribe',
  timeoutMs = defaultTimeoutMs,
} = {}) {
  if (model !== 'gpt-4o-transcribe') {
    throw new TypeError('The gpt-4o transcription driver requires gpt-4o-transcribe.');
  }
  return createOpenAITranscriptionDriver({
    apiKey,
    confidence: true,
    fetchImpl,
    model,
    timeoutMs,
  });
}
