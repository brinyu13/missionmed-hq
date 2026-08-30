import WebSocket from 'ws';

import {
  buildInterviewerInstructions,
  MODEL_ARCHITECTURES,
  requireModelCandidate,
} from '../config/models.mjs';
import { requireRealtimeVoiceId } from '../config/voices.mjs';
import { ProviderError } from './errors.mjs';

const REALTIME_ENDPOINT = 'wss://api.openai.com/v1/realtime';
const DEFAULT_TIMEOUT_MS = 45_000;

function normalizeSafetyIdentifier(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new TypeError('Realtime safety identifier must be a lowercase SHA-256 hex digest.');
  }
  return value;
}

function requireApiKey(apiKey) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new ProviderError('OPENAI_API_KEY is not configured.', {
      code: 'openai_not_configured',
      status: 503,
      provider: 'openai',
      publicMessage: 'OpenAI Realtime is not configured.',
    });
  }
  return apiKey;
}

function openSocket({ apiKey, model, safetyIdentifier }) {
  requireModelCandidate(model, MODEL_ARCHITECTURES.NATIVE_REALTIME);
  const headers = { Authorization: `Bearer ${requireApiKey(apiKey)}` };
  const normalizedSafetyIdentifier = normalizeSafetyIdentifier(safetyIdentifier);
  if (normalizedSafetyIdentifier) headers['OpenAI-Safety-Identifier'] = normalizedSafetyIdentifier;
  return new WebSocket(`${REALTIME_ENDPOINT}?model=${encodeURIComponent(model)}`, { headers });
}

function parseEvent(message) {
  try { return JSON.parse(message.toString()); }
  catch { return null; }
}

export function probeOpenAIRealtimeModel({
  apiKey = process.env.OPENAI_API_KEY,
  model,
  timeoutMs = 10_000,
} = {}) {
  return new Promise((resolve, reject) => {
    const socket = openSocket({ apiKey, model });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* already closed */ }
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new ProviderError('OpenAI Realtime capability probe timed out.', {
      code: 'openai_realtime_probe_timeout', provider: 'openai', retryable: true,
    })), timeoutMs);
    socket.on('message', (message) => {
      const event = parseEvent(message);
      if (event?.type === 'session.created') finish(null, { model: event.session?.model || model, capability: 'probed' });
      else if (event?.type === 'error') finish(new ProviderError('OpenAI Realtime rejected the capability probe.', {
        code: 'openai_realtime_probe_failed', provider: 'openai', retryable: false,
      }));
    });
    socket.on('error', (cause) => finish(new ProviderError('OpenAI Realtime connection failed.', {
      code: 'openai_realtime_connection_failed', provider: 'openai', retryable: true, cause,
    })));
    socket.on('close', () => {
      if (!settled) finish(new ProviderError('OpenAI Realtime closed before capability confirmation.', {
        code: 'openai_realtime_probe_closed', provider: 'openai', retryable: true,
      }));
    });
  });
}

export function createOpenAIRealtimeTurn({
  apiKey = process.env.OPENAI_API_KEY,
  model,
  voiceId,
  behaviorPresetId,
  context,
  safetyIdentifier,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) throw new TypeError('Interview context must be an object.');
  if (signal?.aborted) throw new ProviderError('OpenAI Realtime turn was cancelled.', {
    code: 'openai_realtime_cancelled', provider: 'openai', retryable: false,
  });
  const voice = requireRealtimeVoiceId(voiceId);
  const instructions = buildInterviewerInstructions(behaviorPresetId);
  const inputText = `Use this MissionMed interview context and generate only the next interviewer utterance:\n${JSON.stringify(context)}`;
  const startedAt = performance.now();

  return new Promise((resolve, reject) => {
    const socket = openSocket({ apiKey, model, safetyIdentifier });
    const audioChunks = [];
    let transcript = '';
    let providerModel = model;
    let firstAudioMs = null;
    let usage = null;
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', abortTurn);
      try { socket.close(); } catch { /* already closed */ }
      if (error) reject(error); else resolve(value);
    };
    const abortTurn = () => finish(new ProviderError('OpenAI Realtime turn was cancelled.', {
      code: 'openai_realtime_cancelled', provider: 'openai', retryable: false,
    }));
    const timer = setTimeout(() => finish(new ProviderError('OpenAI Realtime turn timed out.', {
      code: 'openai_realtime_timeout', provider: 'openai', retryable: true,
    })), timeoutMs);
    signal?.addEventListener?.('abort', abortTurn, { once: true });

    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          model,
          output_modalities: ['audio'],
          instructions,
          audio: { output: { voice } },
        },
      }));
      socket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: inputText }],
        },
      }));
      socket.send(JSON.stringify({
        type: 'response.create',
        response: { output_modalities: ['audio'] },
      }));
    });

    socket.on('message', (message) => {
      const event = parseEvent(message);
      if (!event) return;
      if ((event.type === 'session.created' || event.type === 'session.updated') && event.session?.model) providerModel = event.session.model;
      if (event.type === 'response.output_audio.delta' && typeof event.delta === 'string') {
        if (firstAudioMs === null) firstAudioMs = Math.round(performance.now() - startedAt);
        audioChunks.push(Buffer.from(event.delta, 'base64'));
      }
      if (event.type === 'response.output_audio_transcript.delta' && typeof event.delta === 'string') transcript += event.delta;
      if (event.type === 'response.output_audio_transcript.done' && typeof event.transcript === 'string') transcript = event.transcript;
      if (event.type === 'error') {
        finish(new ProviderError('OpenAI Realtime returned an error.', {
          code: 'openai_realtime_turn_failed', provider: 'openai', retryable: true,
        }));
      }
      if (event.type === 'response.done') {
        usage = event.response?.usage || null;
        if (event.response?.status && event.response.status !== 'completed') {
          finish(new ProviderError('OpenAI Realtime did not complete the turn.', {
            code: 'openai_realtime_incomplete', provider: 'openai', retryable: true,
          }));
          return;
        }
        const utterance = transcript.trim();
        if (!utterance || !audioChunks.length) {
          finish(new ProviderError('OpenAI Realtime returned incomplete audio or transcript.', {
            code: 'openai_realtime_empty_turn', provider: 'openai', retryable: true,
          }));
          return;
        }
        finish(null, Object.freeze({
          requestedModel: model,
          providerModel,
          voiceId: voice,
          utterance,
          audio: Buffer.concat(audioChunks),
          audioContentType: 'audio/pcm;rate=24000',
          firstAudioMs,
          totalMs: Math.round(performance.now() - startedAt),
          usage,
        }));
      }
    });
    socket.on('error', (cause) => finish(new ProviderError('OpenAI Realtime connection failed.', {
      code: 'openai_realtime_connection_failed', provider: 'openai', retryable: true, cause,
    })));
    socket.on('close', () => {
      if (!settled) finish(new ProviderError('OpenAI Realtime closed before the turn completed.', {
        code: 'openai_realtime_closed', provider: 'openai', retryable: true,
      }));
    });
  });
}
