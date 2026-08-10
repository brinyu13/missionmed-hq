export const CONVERSATION_RAIL_IDS = Object.freeze({
  RESPONSES_SPEECH: 'responses-speech',
  OPENAI_REALTIME: 'openai-realtime-continuous',
  GPT_LIVE: 'gpt-live',
});

export const CONVERSATION_RAILS = Object.freeze([
  Object.freeze({
    id: CONVERSATION_RAIL_IDS.OPENAI_REALTIME,
    label: 'CONTINUOUS CONVERSATION',
    provider: 'openai',
    model: 'gpt-realtime-2.1',
    architecture: 'continuous-realtime-speech-to-speech',
    status: 'experimental',
  }),
  Object.freeze({
    id: CONVERSATION_RAIL_IDS.RESPONSES_SPEECH,
    label: 'HIGH-INTELLIGENCE FALLBACK',
    provider: 'openai',
    model: 'gpt-5.6-terra',
    architecture: 'responses-openai-speech',
    status: 'available',
  }),
  Object.freeze({
    id: CONVERSATION_RAIL_IDS.GPT_LIVE,
    label: 'FUTURE — GPT-Live',
    provider: 'openai',
    model: null,
    architecture: 'gpt-live',
    status: 'unavailable',
    reason: 'provider_api_not_available',
  }),
]);

export function publicConversationRailConfig({ realtimeAvailable = false } = {}) {
  return {
    founderOnly: true,
    defaultRailId: realtimeAvailable
      ? CONVERSATION_RAIL_IDS.OPENAI_REALTIME
      : CONVERSATION_RAIL_IDS.RESPONSES_SPEECH,
    experimentalRailId: CONVERSATION_RAIL_IDS.OPENAI_REALTIME,
    rails: CONVERSATION_RAILS.map((rail) => ({
      ...rail,
      status: rail.id === CONVERSATION_RAIL_IDS.OPENAI_REALTIME
        ? (realtimeAvailable ? 'experimental' : 'unavailable')
        : rail.status,
      reason: rail.id === CONVERSATION_RAIL_IDS.OPENAI_REALTIME && !realtimeAvailable
        ? 'authenticated_model_unavailable'
        : rail.reason || null,
    })),
  };
}

export class ConversationRail {
  async start() { throw new Error('ConversationRail.start must be implemented.'); }
  appendInputAudio() { throw new Error('ConversationRail.appendInputAudio must be implemented.'); }
  appendInputText() { throw new Error('ConversationRail.appendInputText must be implemented.'); }
  requestOpening() { throw new Error('ConversationRail.requestOpening must be implemented.'); }
  interrupt() { throw new Error('ConversationRail.interrupt must be implemented.'); }
  health() { throw new Error('ConversationRail.health must be implemented.'); }
  usage() { throw new Error('ConversationRail.usage must be implemented.'); }
  async close() { throw new Error('ConversationRail.close must be implemented.'); }
}
