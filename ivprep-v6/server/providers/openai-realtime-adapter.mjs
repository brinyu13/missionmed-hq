import { NO_RETRY } from './provider-session-controller.mjs';
import { FOUNDER_TEST_VOICES } from '../founder-paid-test-gate.mjs';

export const OPENAI_REALTIME_MODEL = 'gpt-realtime-2.1';
export const OPENAI_REALTIME_BASE_URL = 'https://api.openai.com/v1';

export function strictRealtimeModelClass(realtime) {
  const BaseModel = realtime?.RealtimeModel;
  const BaseSession = realtime?.RealtimeSession;
  if (typeof BaseModel !== 'function' || typeof BaseSession !== 'function') {
    throw new Error('Pinned OpenAI Realtime strict-session surface is unavailable.');
  }
  const intentionalCloses = new WeakSet();
  class StrictNoReconnectSession extends BaseSession {
    async runWs(wsConnection) {
      const result = await super.runWs(wsConnection);
      if (!intentionalCloses.has(this)) {
        throw new Error('OpenAI Realtime connection closed; reconnect is prohibited.');
      }
      return result;
    }

    async close() {
      intentionalCloses.add(this);
      return super.close();
    }
  }
  return class StrictNoReconnectModel extends BaseModel {
    session() {
      return new StrictNoReconnectSession(this);
    }
  };
}

export async function createOpenAiRealtimeModel({ apiKey, profile, voice = 'marin', openaiModule = null }) {
  if (!apiKey) throw new Error('OpenAI server configuration is unavailable.');
  if (!FOUNDER_TEST_VOICES.has(voice) || voice === 'cedar') throw new Error('OpenAI Realtime voice binding is not approved.');
  const openai = openaiModule || await import('@livekit/agents-plugin-openai');
  const RealtimeModel = strictRealtimeModelClass(openai.realtime);
  return new RealtimeModel({
    apiKey,
    baseURL: OPENAI_REALTIME_BASE_URL,
    model: OPENAI_REALTIME_MODEL,
    voice,
    modalities: profile.realtimeOutput === 'text' ? ['text'] : ['audio', 'text'],
    reasoning: { effort: 'low' },
    turnDetection: { type: 'semantic_vad', eagerness: 'auto' },
    connOptions: NO_RETRY,
    maxSessionDuration: 45_000,
  });
}
