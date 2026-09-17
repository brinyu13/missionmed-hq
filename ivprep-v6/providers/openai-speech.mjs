import {
  DEFAULT_SPEECH_MODEL,
  normalizeSpeechSelection,
} from '../config/voices.mjs';
import { ProviderError, providerResponseError } from './errors.mjs';

const SPEECH_ENDPOINT = 'https://api.openai.com/v1/audio/speech';
const CONTENT_TYPES = Object.freeze({
  mp3: 'audio/mpeg',
  opus: 'audio/opus',
  aac: 'audio/aac',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pcm: 'audio/pcm;rate=24000',
});

export async function createOpenAISpeech({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_SPEECH_MODEL || DEFAULT_SPEECH_MODEL,
  input,
  selection = {},
  signal,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new ProviderError('OPENAI_API_KEY is not configured.', {
      code: 'openai_not_configured',
      status: 503,
      provider: 'openai',
      publicMessage: 'OpenAI Speech is not configured.',
    });
  }
  if (model !== DEFAULT_SPEECH_MODEL) throw new TypeError('Unsupported OpenAI Speech model.');
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Speech input is required.');
  if (input.length > 4096) throw new TypeError('Speech input exceeds the 4096-character alpha limit.');
  const normalized = normalizeSpeechSelection(selection);
  const startedAt = performance.now();
  let response;
  try {
    response = await fetchImpl(SPEECH_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        input: input.trim(),
        voice: normalized.voiceId,
        instructions: normalized.instructions,
        response_format: normalized.format,
        speed: normalized.speed,
      }),
    });
  } catch (cause) {
    throw new ProviderError('OpenAI Speech request failed before a response was received.', {
      code: signal?.aborted ? 'openai_speech_cancelled' : 'openai_speech_network_failed',
      provider: 'openai',
      retryable: !signal?.aborted,
      cause,
    });
  }
  if (!response?.ok) throw providerResponseError('openai', response, 'speech');
  return Object.freeze({
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers?.get?.('content-type') || CONTENT_TYPES[normalized.format],
    model,
    voiceId: normalized.voiceId,
    format: normalized.format,
    latencyMs: Math.round(performance.now() - startedAt),
    requestId: response.headers?.get?.('x-request-id') || null,
  });
}
