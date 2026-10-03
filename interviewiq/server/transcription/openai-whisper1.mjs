import {
  createOpenAITranscriptionDriver,
} from './openai-gpt-4o-transcribe.mjs';

const defaultTimeoutMs = 30_000;

export function createOpenAIWhisper1Driver({
  apiKey,
  fetchImpl = globalThis.fetch,
  model = 'whisper-1',
  timeoutMs = defaultTimeoutMs,
} = {}) {
  if (model !== 'whisper-1') {
    throw new TypeError('The whisper transcription driver requires whisper-1.');
  }
  return createOpenAITranscriptionDriver({
    apiKey,
    confidence: false,
    fetchImpl,
    model,
    timeoutMs,
  });
}
