import { NO_RETRY } from './provider-session-controller.mjs';

export const OPENAI_REALTIME_MODEL = 'gpt-realtime-2.1';
export const OPENAI_REALTIME_BASE_URL = 'https://api.openai.com/v1';

export async function createOpenAiRealtimeModel({ apiKey, profile, openaiModule = null }) {
  if (!apiKey) throw new Error('OpenAI server configuration is unavailable.');
  const openai = openaiModule || await import('@livekit/agents-plugin-openai');
  const RealtimeModel = openai.realtime?.RealtimeModel;
  if (typeof RealtimeModel !== 'function') throw new Error('Pinned OpenAI Realtime adapter is unavailable.');
  return new RealtimeModel({
    apiKey,
    baseURL: OPENAI_REALTIME_BASE_URL,
    model: OPENAI_REALTIME_MODEL,
    modalities: profile.realtimeOutput === 'text' ? ['text'] : ['audio', 'text'],
    reasoning: { effort: 'low' },
    turnDetection: { type: 'semantic_vad', eagerness: 'low' },
    connOptions: NO_RETRY,
    maxSessionDuration: 45_000,
  });
}
