import { NO_RETRY } from './provider-session-controller.mjs';

export const ELEVENLABS_MULTI_STREAM_ORIGIN = 'wss://api.elevenlabs.io';

export function elevenLabsMultiStreamUrl(voiceId) {
  const value = String(voiceId || '').trim();
  if (!/^[A-Za-z0-9_-]{1,120}$/u.test(value)) throw new TypeError('An approved ElevenLabs voice identifier is required.');
  return `${ELEVENLABS_MULTI_STREAM_ORIGIN}/v1/text-to-speech/${value}/multi-stream-input`;
}

export async function createConditionalElevenLabsTts({ apiKey, voiceId, profileAReceipt } = {}) {
  if (!profileAReceipt?.test1UnmetItem || profileAReceipt.approvedVoiceId !== voiceId) {
    throw new Error('Profile A remains gated by a later acceptance receipt.');
  }
  if (!apiKey) throw new Error('ElevenLabs server configuration is unavailable.');
  const elevenlabs = await import('@livekit/agents-plugin-elevenlabs');
  if (typeof elevenlabs.TTS !== 'function') throw new Error('Pinned ElevenLabs adapter is unavailable.');
  return new elevenlabs.TTS({
    apiKey,
    voiceId,
    streamingLatency: 0,
    connOptions: NO_RETRY,
    websocketUrl: elevenLabsMultiStreamUrl(voiceId),
  });
}
