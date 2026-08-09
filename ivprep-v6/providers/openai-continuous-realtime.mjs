import WebSocket from 'ws';

import { buildInterviewerInstructions, MODEL_ARCHITECTURES, requireModelCandidate } from '../config/models.mjs';
import { requireRealtimeVoiceId } from '../config/voices.mjs';
import { ConversationRail, CONVERSATION_RAIL_IDS } from './conversation-rail.mjs';
import { ProviderError } from './errors.mjs';

const REALTIME_ENDPOINT = 'wss://api.openai.com/v1/realtime';
const MAX_AUDIO_FRAME_BYTES = 32 * 1024;
const CONNECT_TIMEOUT_MS = 15_000;
const REALTIME_INPUT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';

function requireApiKey(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProviderError('OPENAI_API_KEY is not configured.', {
      code: 'openai_not_configured', status: 503, provider: 'openai', publicMessage: 'Continuous Conversation is not configured.',
    });
  }
  return value;
}

function parseEvent(raw) {
  try { return JSON.parse(raw.toString()); }
  catch { return null; }
}

function safeContext(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Interview context must be an object.');
  const encoded = JSON.stringify(value);
  if (encoded.length > 48_000) throw new TypeError('Interview context is too large.');
  return encoded;
}

function normalizedEvent(event, now) {
  const at = now();
  if (event.type === 'input_audio_buffer.speech_started') return { type: 'speech_started', at, audioStartMs: event.audio_start_ms ?? null, itemId: event.item_id || null };
  if (event.type === 'input_audio_buffer.speech_stopped') return { type: 'speech_stopped', at, audioEndMs: event.audio_end_ms ?? null, itemId: event.item_id || null };
  if (event.type === 'conversation.item.input_audio_transcription.delta') return { type: 'input_transcript_delta', at, itemId: event.item_id || null, delta: event.delta || '' };
  if (event.type === 'conversation.item.input_audio_transcription.completed') return { type: 'input_transcript_done', at, itemId: event.item_id || null, transcript: event.transcript || '', usage: event.usage || null };
  if (event.type === 'response.created') return { type: 'response_started', at, responseId: event.response?.id || null };
  if (event.type === 'response.output_item.added') return { type: 'output_item', at, responseId: event.response_id || null, itemId: event.item?.id || null };
  if (event.type === 'response.output_audio.delta') return { type: 'audio_delta', at, responseId: event.response_id || null, itemId: event.item_id || null, delta: event.delta || '' };
  if (event.type === 'response.output_audio.done') return { type: 'audio_done', at, responseId: event.response_id || null, itemId: event.item_id || null };
  if (event.type === 'response.output_audio_transcript.delta') return { type: 'assistant_transcript_delta', at, responseId: event.response_id || null, itemId: event.item_id || null, delta: event.delta || '' };
  if (event.type === 'response.output_audio_transcript.done') return { type: 'assistant_transcript_done', at, responseId: event.response_id || null, itemId: event.item_id || null, transcript: event.transcript || '' };
  if (event.type === 'response.done') return {
    type: event.response?.status === 'cancelled' ? 'response_cancelled' : 'response_done',
    at,
    responseId: event.response?.id || null,
    status: event.response?.status || null,
    usage: event.response?.usage || null,
  };
  if (event.type === 'rate_limits.updated') return { type: 'rate_limits', at, rateLimits: event.rate_limits || [] };
  if (event.type === 'error') return { type: 'error', at, code: event.error?.code || 'openai_realtime_error', message: 'Continuous Conversation provider error.' };
  return null;
}

export class OpenAIContinuousRealtimeRail extends ConversationRail {
  #apiKey;
  #WebSocketImpl;
  #now;
  #socket = null;
  #state = 'idle';
  #model = null;
  #voiceId = null;
  #speed = null;
  #startedAt = null;
  #closedAt = null;
  #audioInputBytes = 0;
  #usage = [];
  #listener;

  constructor({ apiKey = process.env.OPENAI_API_KEY, WebSocketImpl = WebSocket, now = () => Date.now(), onEvent = () => {} } = {}) {
    super();
    this.#apiKey = requireApiKey(apiKey);
    this.#WebSocketImpl = WebSocketImpl;
    this.#now = now;
    this.#listener = onEvent;
  }

  #emit(event) {
    try { this.#listener(event); } catch { /* consumer failures never own provider lifecycle */ }
  }

  #send(event) {
    if (!this.#socket || this.#socket.readyState !== 1) throw new ProviderError('Continuous Conversation is not connected.', {
      code: 'openai_realtime_not_connected', status: 409, provider: 'openai', publicMessage: 'Continuous Conversation is not connected.',
    });
    this.#socket.send(JSON.stringify(event));
  }

  async start({ model, voiceId, speed = 1, behaviorPresetId, context, reasoningEffort = 'low' } = {}) {
    if (this.#state !== 'idle') throw new ProviderError('Continuous Conversation session is already active.', {
      code: 'openai_realtime_already_active', status: 409, provider: 'openai', publicMessage: 'Continuous Conversation is already active.',
    });
    requireModelCandidate(model, MODEL_ARCHITECTURES.NATIVE_REALTIME);
    if (model !== 'gpt-realtime-2.1') throw new TypeError('Continuous Conversation requires exact model gpt-realtime-2.1.');
    const voice = requireRealtimeVoiceId(voiceId);
    const normalizedSpeed = Number(speed);
    if (!Number.isFinite(normalizedSpeed) || normalizedSpeed < 0.25 || normalizedSpeed > 1.5) throw new TypeError('Realtime voice speed must be between 0.25 and 1.5.');
    if (!['none', 'low', 'medium', 'high'].includes(reasoningEffort)) throw new TypeError('Unsupported Realtime reasoning effort.');
    const contextJson = safeContext(context);
    this.#state = 'connecting';
    this.#model = model;
    this.#voiceId = voice;
    this.#speed = normalizedSpeed;

    const socket = new this.#WebSocketImpl(`${REALTIME_ENDPOINT}?model=${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${this.#apiKey}` },
    });
    this.#socket = socket;

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
          this.#state = 'failed';
          try { socket.close(); } catch { /* already closed */ }
          reject(error);
        } else resolve(value);
      };
      const timer = setTimeout(() => finish(new ProviderError('Continuous Conversation connection timed out.', {
        code: 'openai_realtime_connect_timeout', status: 504, provider: 'openai', retryable: true, publicMessage: 'Continuous Conversation timed out while connecting.',
      })), CONNECT_TIMEOUT_MS);

      socket.on('message', (raw) => {
        const event = parseEvent(raw);
        if (!event) return;
        if (event.type === 'session.created') {
          const instructions = `${buildInterviewerInstructions(behaviorPresetId)}\n\nCONTINUOUS CONVERSATION RAIL:\nListen for the applicant to yield the floor semantically. A thoughtful pause, unfinished clause, word search, “let me think,” self-correction, or sentence restart does not by itself end the answer. Respond only after a genuine floor yield. Interrupt only when the selected interviewer behavior and context warrant a professional redirect; never interrupt on an arbitrary timer. Use sparse backchannels only if they do not steal the floor or create a new question. Keep responses concise and natural.\n\nAUTHORIZED MISSIONMED CONTEXT:\n${contextJson}`;
          socket.send(JSON.stringify({
            event_id: 'missionmed-session-configuration',
            type: 'session.update',
            session: {
              type: 'realtime', model, output_modalities: ['audio'], instructions,
              reasoning: { effort: reasoningEffort }, max_output_tokens: 512,
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: 24000 },
                  transcription: { model: REALTIME_INPUT_TRANSCRIPTION_MODEL, language: 'en' },
                  turn_detection: { type: 'semantic_vad', eagerness: 'low', create_response: true, interrupt_response: true },
                },
                output: { format: { type: 'audio/pcm', rate: 24000 }, voice, speed: normalizedSpeed },
              },
            },
          }));
          return;
        }
        if (event.type === 'session.updated') {
          this.#state = 'connected';
          this.#startedAt = this.#now();
          finish(null, this.health());
          this.#emit({ type: 'connected', at: this.#startedAt, model: event.session?.model || model, voiceId: event.session?.audio?.output?.voice || voice, turnDetection: event.session?.audio?.input?.turn_detection?.type || null });
          return;
        }
        const normalized = normalizedEvent(event, this.#now);
        if (normalized) {
          if (normalized.type === 'response_done' || normalized.type === 'response_cancelled') this.#usage.push(normalized.usage);
          this.#emit(normalized);
        }
        if (event.type === 'error' && !settled) finish(new ProviderError('OpenAI rejected the Continuous Conversation configuration.', {
          code: event.error?.code || 'openai_realtime_configuration_failed', status: 503, provider: 'openai', retryable: false, publicMessage: 'Continuous Conversation configuration was rejected.',
        }));
      });
      socket.on('error', (cause) => {
        const error = new ProviderError('Continuous Conversation connection failed.', {
          code: 'openai_realtime_connection_failed', status: 503, provider: 'openai', retryable: true, publicMessage: 'Continuous Conversation connection failed.', cause,
        });
        if (!settled) finish(error);
        else { this.#state = 'failed'; this.#emit({ type: 'error', at: this.#now(), code: error.code, message: error.publicMessage }); }
      });
      socket.on('close', () => {
        this.#closedAt ||= this.#now();
        if (this.#state !== 'closed') this.#state = this.#state === 'failed' ? 'failed' : 'closed';
        if (!settled) finish(new ProviderError('Continuous Conversation closed before configuration completed.', {
          code: 'openai_realtime_closed', status: 503, provider: 'openai', retryable: true, publicMessage: 'Continuous Conversation closed unexpectedly.',
        }));
        this.#emit({ type: 'closed', at: this.#closedAt });
      });
    });
  }

  appendInputAudio(bytes) {
    const audio = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (!audio.length || audio.length > MAX_AUDIO_FRAME_BYTES || audio.length % 2 !== 0) throw new TypeError('A bounded PCM16 audio frame is required.');
    this.#audioInputBytes += audio.length;
    this.#send({ type: 'input_audio_buffer.append', audio: audio.toString('base64') });
    return { accepted: true, bytes: audio.length };
  }

  appendInputText(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 8_000) throw new TypeError('A bounded typed answer is required.');
    this.#send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    });
    this.#send({ type: 'response.create', response: { output_modalities: ['audio'] } });
    return { accepted: true };
  }

  requestOpening(utterance) {
    const text = String(utterance || '').trim();
    if (!text || text.length > 800) throw new TypeError('A bounded opening question is required.');
    this.#send({
      event_id: 'missionmed-opening-question', type: 'response.create',
      response: { output_modalities: ['audio'], instructions: `Ask exactly this opening interview question once, naturally, without adding any preamble or second question: ${JSON.stringify(text)}` },
    });
  }

  interrupt({ itemId, playedMs = 0, cancel = true } = {}) {
    if (this.#socket?.readyState !== 1) return { cancelled: false };
    if (cancel) this.#send({ type: 'response.cancel' });
    const duration = Math.max(0, Math.round(Number(playedMs) || 0));
    if (itemId && duration > 0) this.#send({ type: 'conversation.item.truncate', item_id: itemId, content_index: 0, audio_end_ms: duration });
    return { cancelled: Boolean(cancel), truncated: Boolean(itemId && duration > 0), itemId: itemId || null, playedMs: duration };
  }

  health() {
    return Object.freeze({
      provider: 'openai', railId: CONVERSATION_RAIL_IDS.OPENAI_REALTIME, status: this.#state,
      connected: this.#state === 'connected', model: this.#model, voiceId: this.#voiceId, speed: this.#speed,
    });
  }

  usage() {
    const end = this.#closedAt || (this.#startedAt ? this.#now() : null);
    return Object.freeze({
      provider: 'openai', railId: CONVERSATION_RAIL_IDS.OPENAI_REALTIME,
      startedAt: this.#startedAt, endedAt: this.#closedAt,
      estimatedMinutes: this.#startedAt && end ? Number(((end - this.#startedAt) / 60_000).toFixed(3)) : 0,
      inputAudioBytes: this.#audioInputBytes, responses: this.#usage.length,
    });
  }

  async close() {
    if (this.#state === 'closed') return this.health();
    this.#state = 'closed';
    this.#closedAt ||= this.#now();
    const socket = this.#socket;
    this.#socket = null;
    if (socket && socket.readyState < 2) socket.close(1000, 'missionmed-session-closed');
    return this.health();
  }
}

export const OPENAI_CONTINUOUS_REALTIME_CAPABILITIES = Object.freeze({
  model: 'gpt-realtime-2.1',
  inputAudio: 'pcm16-24000-mono',
  outputAudio: 'pcm16-24000-mono',
  inputTranscriptionModel: REALTIME_INPUT_TRANSCRIPTION_MODEL,
  turnDetection: Object.freeze({ type: 'semantic_vad', eagerness: 'low', createResponse: true, interruptResponse: true }),
  reasoningEffort: 'low',
});
