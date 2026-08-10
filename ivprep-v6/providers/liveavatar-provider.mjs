import { randomUUID } from 'node:crypto';

import WebSocket from 'ws';

import { LIVE_INTERVIEWER_TARGET, resolveLockedAvatarId } from '../avatar/live-interviewer-target.mjs';
import { MAX_AVATAR_ENDURANCE_SECONDS, MIN_AVATAR_ENDURANCE_SECONDS } from '../avatar/endurance-plan.mjs';
import { AvatarProvider, NullAvatarProvider } from './avatar-provider.mjs';
import { ProviderError, providerResponseError } from './errors.mjs';

const PROVIDER = 'liveavatar';
const API_BASE_URL = 'https://api.liveavatar.com';
const CONNECT_TIMEOUT_MS = 15_000;
const PROVIDER_REQUEST_TIMEOUT_MS = 15_000;
const KEEP_ALIVE_INTERVAL_MS = 60_000;
const SPEECH_END_TIMEOUT_MS = 90_000;
const STOP_RETRY_DELAYS_MS = Object.freeze([0, 100, 250]);
const MAX_ALPHA_SESSION_SECONDS = 120;
const DEFAULT_ALPHA_SESSION_SECONDS = 120;
const AUDIO_SAMPLE_RATE_HZ = 24_000;
const AUDIO_BYTES_PER_SAMPLE = 2;
// Base64 and the JSON envelope must also fit inside LiveAvatar's 1 MB WS limit.
const MAX_RAW_AUDIO_BYTES = 720_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER_STOP_REASONS = new Set([
  'USER_DISCONNECTED',
  'SERVER_ERROR',
  'IDLE_TIMEOUT',
  'NO_CREDITS',
  'USER_CLOSED',
  'AVATAR_DELETED',
  'MAX_DURATION_REACHED',
  'ZOMBIE_SESSION_REAP',
  'AGENT_HANG_UP',
  'UNKNOWN',
]);

function parseBoolean(value, fallback) {
  if (value == null || value === '') return fallback;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function parseDuration(value, maximum = MAX_ALPHA_SESSION_SECONDS) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ALPHA_SESSION_SECONDS;
  return Math.max(1, Math.min(parsed, maximum));
}

function normalizeStopReason(reason) {
  const candidate = String(reason || '').trim().toUpperCase();
  if (PROVIDER_STOP_REASONS.has(candidate)) return candidate;
  if (['ABANDONED', 'DISCONNECTED', 'RESTARTED'].includes(candidate)) return 'USER_DISCONNECTED';
  if (['HARD_CAP', 'MAX_DURATION', 'DURATION_LIMIT'].includes(candidate)) return 'MAX_DURATION_REACHED';
  if (['ERROR', 'FAILED', 'PROVIDER_FAILURE'].includes(candidate)) return 'SERVER_ERROR';
  return 'USER_CLOSED';
}

function unavailableReason(config) {
  if (!config.apiKey && !config.avatarId) {
    return 'LiveAvatar is not configured. The interview can continue in visible voice-only mode.';
  }
  if (!config.apiKey) {
    return 'LiveAvatar server authorization is unavailable. The interview can continue in visible voice-only mode.';
  }
  if (!config.avatarId) {
    return 'No verified LiveAvatar stock avatar is configured. The interview can continue in visible voice-only mode.';
  }
  if (!config.avatarIdValid) {
    return 'The configured LiveAvatar identifier is invalid. The interview can continue in visible voice-only mode.';
  }
  return null;
}

function readLiveAvatarConfig(env = process.env, { enduranceHarness = false, enduranceDurationSeconds } = {}) {
  const apiKey = String(env.LIVEAVATAR_API_KEY || '').trim();
  const avatarId = resolveLockedAvatarId(env.LIVEAVATAR_AVATAR_ID);
  const avatarIdValid = UUID_PATTERN.test(avatarId);
  const requestedEnduranceDuration = Number.parseInt(enduranceDurationSeconds, 10);
  if (enduranceHarness && (
    parseBoolean(env.LIVEAVATAR_SANDBOX, false)
    || !Number.isInteger(requestedEnduranceDuration)
    || requestedEnduranceDuration < MIN_AVATAR_ENDURANCE_SECONDS
    || requestedEnduranceDuration > MAX_AVATAR_ENDURANCE_SECONDS
  )) {
    throw new TypeError('The locked Dexter endurance harness requires production mode and an explicit 600–900 second duration.');
  }
  const config = Object.freeze({
    apiKey,
    avatarId,
    avatarIdValid,
    sandbox: parseBoolean(env.LIVEAVATAR_SANDBOX, false),
    maxSessionDuration: enduranceHarness
      ? requestedEnduranceDuration
      : parseDuration(env.LIVEAVATAR_MAX_SESSION_SECONDS),
    enduranceHarness: Boolean(enduranceHarness),
    videoQuality: 'high',
    videoEncoding: 'H264',
  });

  return Object.freeze({
    ...config,
    configured: Boolean(apiKey && avatarIdValid),
    unavailableReason: unavailableReason(config),
  });
}

export function liveAvatarConfigFromEnv(env = process.env) {
  const config = readLiveAvatarConfig(env);
  return Object.freeze({
    configured: config.configured,
    hasServerAuthorization: Boolean(config.apiKey),
    avatarId: config.avatarId || null,
    avatarIdValid: config.avatarIdValid,
    sandbox: config.sandbox,
    maxSessionDuration: config.maxSessionDuration,
    videoQuality: config.videoQuality,
    videoEncoding: config.videoEncoding,
    lockedVoiceTargetId: LIVE_INTERVIEWER_TARGET.voiceId,
    lockedVoiceCompatibility: 'unverified-until-authenticated-provider-proof',
    unavailableReason: config.unavailableReason,
  });
}

function websocketOn(socket, event, listener) {
  if (typeof socket.on === 'function') {
    socket.on(event, listener);
    return;
  }
  socket.addEventListener(event, listener);
}

function websocketData(value) {
  const candidate = value?.data ?? value;
  if (typeof candidate === 'string') return candidate;
  if (Buffer.isBuffer(candidate)) return candidate.toString('utf8');
  if (candidate instanceof ArrayBuffer) return Buffer.from(candidate).toString('utf8');
  if (ArrayBuffer.isView(candidate)) {
    return Buffer.from(candidate.buffer, candidate.byteOffset, candidate.byteLength).toString('utf8');
  }
  return '';
}

function normalizedError(operation, error, { retryable = true } = {}) {
  if (error instanceof ProviderError) return error;
  return new ProviderError(`LiveAvatar ${operation} failed.`, {
    code: `liveavatar_${operation}_failed`,
    status: 502,
    provider: PROVIDER,
    retryable,
    publicMessage: 'The live avatar is unavailable. Continue in voice-only mode.',
    cause: error,
  });
}

function invalidAudio(message, code = 'liveavatar_invalid_audio') {
  return new ProviderError(message, {
    code,
    status: 400,
    provider: PROVIDER,
    retryable: false,
    publicMessage: 'The live avatar could not accept this audio. Continue in voice-only mode.',
  });
}

function readResponseData(payload, operation) {
  if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
    throw normalizedError(operation, new Error('Provider response did not contain data.'), { retryable: false });
  }
  return payload.data;
}

function safeIso(timestamp) {
  return timestamp == null ? null : new Date(timestamp).toISOString();
}

export class LiveAvatarProvider extends AvatarProvider {
  #config;
  #fetch;
  #WebSocket;
  #now;
  #setInterval;
  #clearInterval;
  #setTimeout;
  #clearTimeout;
  #randomUUID;
  #connectTimeoutMs;
  #stopRetryDelays;
  #socket = null;
  #keepAliveTimer = null;
  #sessionToken = null;
  #controlSocketUrl = null;
  #livekitUrl = null;
  #livekitClientToken = null;
  #state;
  #sessionId = null;
  #lastSessionId = null;
  #createdAt = null;
  #startedAt = null;
  #endedAt = null;
  #lastError = null;
  #sessionCount = 0;
  #audioBytes = 0;
  #audioChunks = 0;
  #audioSeconds = 0;
  #interruptions = 0;
  #reconnects = 0;
  #speechWaiters = new Map();
  #openSpeechEvents = new Set();
  #cancelledSpeechEvents = new Set();
  #closed = false;

  constructor({
    env = process.env,
    fetchImpl = globalThis.fetch,
    WebSocketImpl = WebSocket,
    now = Date.now,
    setIntervalImpl = globalThis.setInterval,
    clearIntervalImpl = globalThis.clearInterval,
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    randomUUIDImpl = randomUUID,
    connectTimeoutMs = CONNECT_TIMEOUT_MS,
    stopRetryDelays = STOP_RETRY_DELAYS_MS,
    enduranceHarness = false,
    enduranceDurationSeconds,
  } = {}) {
    super();
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');
    this.#config = readLiveAvatarConfig(env, { enduranceHarness, enduranceDurationSeconds });
    this.#fetch = fetchImpl;
    this.#WebSocket = WebSocketImpl;
    this.#now = now;
    this.#setInterval = setIntervalImpl;
    this.#clearInterval = clearIntervalImpl;
    this.#setTimeout = setTimeoutImpl;
    this.#clearTimeout = clearTimeoutImpl;
    this.#randomUUID = randomUUIDImpl;
    this.#connectTimeoutMs = connectTimeoutMs;
    this.#stopRetryDelays = [...stopRetryDelays];
    this.#state = this.#config.configured ? 'idle' : 'unavailable';
  }

  #unavailableResult() {
    return {
      provider: PROVIDER,
      status: 'unavailable',
      fallback: 'voice-only',
      reason: this.#config.unavailableReason,
    };
  }

  async configure({ avatarId = LIVE_INTERVIEWER_TARGET.avatarId } = {}) {
    this.#assertOpen('configure');
    resolveLockedAvatarId(avatarId);
    if (!this.#config.configured) return this.#unavailableResult();
    return {
      provider: PROVIDER,
      status: 'configured',
      avatarId: LIVE_INTERVIEWER_TARGET.avatarId,
      voiceTargetId: LIVE_INTERVIEWER_TARGET.voiceId,
      voiceSelectionApplied: false,
      audioAuthority: 'liveavatar-livekit',
      intelligenceOwner: 'conversation-rail',
    };
  }

  #assertOpen(operation) {
    if (this.#closed) {
      throw new ProviderError(`LiveAvatar ${operation} called after close.`, {
        code: 'liveavatar_closed',
        status: 409,
        provider: PROVIDER,
        retryable: false,
        publicMessage: 'The live avatar session is closed. Continue in voice-only mode.',
      });
    }
  }

  async #post(path, { authorization, body, operation }) {
    let response;
    const controller = new AbortController();
    const timeout = this.#setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);
    timeout?.unref?.();
    try {
      response = await this.#fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          ...(authorization === 'api-key' ? { 'X-API-KEY': this.#config.apiKey } : {}),
          ...(authorization === 'session' ? { authorization: `Bearer ${this.#sessionToken}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      throw normalizedError(operation, error);
    } finally {
      this.#clearTimeout(timeout);
    }

    if (!response?.ok) {
      const error = providerResponseError(PROVIDER, response, operation);
      try {
        const payload = await response.json();
        if (payload?.code === 4033) {
          error.code = 'liveavatar_insufficient_credits';
          error.retryable = false;
          error.publicMessage = 'LiveAvatar has insufficient credits to start Dexter. Continue in voice-only mode.';
        }
      } catch {}
      error.publicMessage = 'The live avatar is unavailable. Continue in voice-only mode.';
      if (error.code === 'liveavatar_insufficient_credits') {
        error.publicMessage = 'LiveAvatar has insufficient credits to start Dexter. Continue in voice-only mode.';
      }
      throw error;
    }

    try {
      return await response.json();
    } catch (error) {
      throw normalizedError(operation, error, { retryable: false });
    }
  }

  #clearKeepAlive() {
    if (this.#keepAliveTimer != null) {
      this.#clearInterval(this.#keepAliveTimer);
      this.#keepAliveTimer = null;
    }
  }

  #closeSocket() {
    this.#clearKeepAlive();
    const socket = this.#socket;
    this.#socket = null;
    if (!socket) return;
    try {
      socket.close();
    } catch {
      // Local cleanup is best-effort and must never expose control credentials.
    }
  }

  #settleSpeech(eventId, result) {
    const waiter = this.#speechWaiters.get(eventId);
    if (!waiter) return;
    this.#speechWaiters.delete(eventId);
    this.#clearTimeout(waiter.timeout);
    waiter.resolve(result);
  }

  #settleAllSpeech(result) {
    for (const eventId of [...this.#speechWaiters.keys()]) this.#settleSpeech(eventId, result);
  }

  #waitForSpeechEnd(eventId) {
    return new Promise((resolve) => {
      const timeout = this.#setTimeout(() => {
        this.#settleSpeech(eventId, { playbackEnded: false, reason: 'provider-event-timeout' });
      }, SPEECH_END_TIMEOUT_MS);
      timeout?.unref?.();
      this.#speechWaiters.set(eventId, { resolve, timeout });
    });
  }

  #clearCredentials() {
    this.#sessionToken = null;
    this.#controlSocketUrl = null;
    this.#livekitUrl = null;
    this.#livekitClientToken = null;
  }

  #cancelSpeechEvent(eventId, reason = 'interrupted') {
    if (!eventId) return;
    this.#cancelledSpeechEvents.add(eventId);
    this.#openSpeechEvents.delete(eventId);
    this.#settleSpeech(eventId, { playbackEnded: false, reason });
  }

  #assertSpeechEventActive(eventId) {
    if (this.#cancelledSpeechEvents.has(eventId)) {
      throw new ProviderError('LiveAvatar audio arrived after the utterance was cancelled.', {
        code: 'liveavatar_audio_cancelled',
        status: 409,
        provider: PROVIDER,
        retryable: false,
        publicMessage: 'Avatar speech was interrupted.',
      });
    }
  }

  #recordFailure(error) {
    const normalized = normalizedError('session', error);
    this.#lastError = {
      code: normalized.code,
      retryable: normalized.retryable,
      at: safeIso(this.#now()),
    };
    this.#state = 'error';
    return normalized;
  }

  #send(event) {
    if (!this.#socket || this.#socket.readyState !== 1) {
      throw new ProviderError('LiveAvatar control socket is not connected.', {
        code: 'liveavatar_not_connected',
        status: 409,
        provider: PROVIDER,
        retryable: true,
        publicMessage: 'The live avatar connection was interrupted. Continue in voice-only mode.',
      });
    }
    this.#socket.send(JSON.stringify(event));
  }

  #startKeepAlive() {
    this.#clearKeepAlive();
    this.#keepAliveTimer = this.#setInterval(() => {
      try {
        this.#send({ type: 'session.keep_alive', event_id: this.#randomUUID() });
      } catch {
        // health() reports socket loss; the caller decides whether to reconnect.
      }
    }, KEEP_ALIVE_INTERVAL_MS);
    this.#keepAliveTimer?.unref?.();
  }

  async #connectControlSocket() {
    if (!this.#controlSocketUrl) {
      throw normalizedError('connect', new Error('Provider omitted the LITE control socket URL.'), { retryable: false });
    }

    this.#closeSocket();
    this.#state = 'connecting';

    await new Promise((resolve, reject) => {
      let settled = false;
      let socket;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        this.#clearTimeout(timeout);
        callback(value);
      };
      const timeout = this.#setTimeout(() => {
        try { socket?.close(); } catch {}
        finish(reject, normalizedError('connect_timeout', new Error('Connection timed out.')));
      }, this.#connectTimeoutMs);

      try {
        socket = new this.#WebSocket(this.#controlSocketUrl);
        this.#socket = socket;
      } catch (error) {
        finish(reject, normalizedError('connect', error));
        return;
      }

      websocketOn(socket, 'message', (message) => {
        let event;
        try {
          event = JSON.parse(websocketData(message));
        } catch {
          return;
        }
        if (event?.type === 'session.state_updated' && event.state === 'connected') {
          this.#state = 'connected';
          finish(resolve);
        }
        if (event?.type === 'session.state_updated' && ['disconnected', 'failed', 'closing', 'closed'].includes(event.state)) {
          this.#state = 'degraded';
          this.#settleAllSpeech({ playbackEnded: false, reason: `session-${event.state}` });
        }
        if (['agent.speak_ended', 'avatar.speak_ended'].includes(event?.type) && event.event_id) {
          this.#settleSpeech(event.event_id, { playbackEnded: true, reason: 'provider-event' });
        }
      });
      websocketOn(socket, 'error', (error) => {
        if (!settled) finish(reject, normalizedError('connect', error));
        else this.#state = 'degraded';
      });
      websocketOn(socket, 'close', () => {
        if (!settled) finish(reject, normalizedError('connect', new Error('Socket closed before ready.')));
        else if (!['stopping', 'stopped', 'closed'].includes(this.#state)) {
          this.#state = 'degraded';
          this.#settleAllSpeech({ playbackEnded: false, reason: 'connection-closed' });
        }
      });
    });

    this.#startKeepAlive();
  }

  async #safeStopRemote(reason) {
    if (!this.#sessionId || !this.#config.apiKey) return;
    await this.#post('/v1/sessions/stop', {
      authorization: 'api-key',
      operation: 'stop',
      body: { session_id: this.#sessionId, reason },
    });
  }

  async #stopRemoteWithRetries(reason) {
    let lastError = null;
    for (const delayMs of this.#stopRetryDelays) {
      if (delayMs > 0) await new Promise((resolve) => this.#setTimeout(resolve, delayMs));
      try {
        await this.#safeStopRemote(reason);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || normalizedError('stop', new Error('Remote stop failed.'));
  }

  async createSession() {
    this.#assertOpen('createSession');
    if (!this.#config.configured) return this.#unavailableResult();
    if (this.#sessionToken && this.#sessionId) {
      return {
        provider: PROVIDER,
        status: 'created',
        mode: 'LITE',
        sessionId: this.#sessionId,
        avatarId: this.#config.avatarId,
        sandbox: this.#config.sandbox,
        maxSessionDuration: this.#config.maxSessionDuration,
      };
    }

    this.#state = 'creating';
    try {
      const payload = await this.#post('/v1/sessions/token', {
        authorization: 'api-key',
        operation: 'create_session',
        body: {
          mode: 'LITE',
          avatar_id: this.#config.avatarId,
          is_sandbox: this.#config.sandbox,
          video_settings: {
            quality: this.#config.videoQuality,
            encoding: this.#config.videoEncoding,
          },
          max_session_duration: this.#config.maxSessionDuration,
        },
      });
      const data = readResponseData(payload, 'create_session');
      if (!data.session_id || !data.session_token) {
        throw normalizedError('create_session', new Error('Provider response omitted session credentials.'), { retryable: false });
      }
      this.#sessionId = data.session_id;
      this.#lastSessionId = data.session_id;
      this.#sessionToken = data.session_token;
      this.#createdAt = this.#now();
      this.#endedAt = null;
      this.#state = 'created';
      this.#lastError = null;
      this.#openSpeechEvents.clear();
      this.#cancelledSpeechEvents.clear();
      return {
        provider: PROVIDER,
        status: 'created',
        mode: 'LITE',
        sessionId: this.#sessionId,
        avatarId: this.#config.avatarId,
        sandbox: this.#config.sandbox,
        maxSessionDuration: this.#config.maxSessionDuration,
      };
    } catch (error) {
      throw this.#recordFailure(error);
    }
  }

  async start() {
    this.#assertOpen('start');
    if (!this.#config.configured) return this.#unavailableResult();
    if (this.#state === 'connected' && this.#livekitClientToken) {
      return this.#startResult();
    }
    if (!this.#sessionToken) await this.createSession();

    this.#state = 'starting';
    let providerSessionStarted = false;
    try {
      const payload = await this.#post('/v1/sessions/start', {
        authorization: 'session',
        operation: 'start',
      });
      const data = readResponseData(payload, 'start');
      // A provider-success response means a billable remote session may exist even
      // when its media payload is malformed. Preserve ownership until stop is acked.
      providerSessionStarted = true;
      if (data.session_id) this.#sessionId = data.session_id;
      if (!data.session_id || !data.livekit_url || !data.livekit_client_token || !data.ws_url) {
        throw normalizedError('start', new Error('Provider response omitted required LITE session data.'), { retryable: false });
      }
      this.#sessionId = data.session_id;
      this.#lastSessionId = data.session_id;
      this.#controlSocketUrl = data.ws_url;
      this.#livekitUrl = data.livekit_url;
      this.#livekitClientToken = data.livekit_client_token;
      await this.#connectControlSocket();
      this.#startedAt = this.#now();
      this.#sessionCount += 1;
      this.#lastError = null;
      return this.#startResult();
    } catch (error) {
      if (providerSessionStarted) {
        try {
          await this.#stopRemoteWithRetries('SERVER_ERROR');
          this.#sessionId = null;
        }
        catch (cleanupError) {
          this.#closeSocket();
          this.#clearCredentials();
          throw this.#recordFailure(normalizedError('stop', cleanupError));
        }
      } else {
        this.#sessionId = null;
      }
      this.#closeSocket();
      this.#clearCredentials();
      throw this.#recordFailure(error);
    }
  }

  #startResult() {
    return {
      provider: PROVIDER,
      status: 'connected',
      mode: 'LITE',
      sessionId: this.#sessionId,
      avatarId: this.#config.avatarId,
      sandbox: this.#config.sandbox,
      maxSessionDuration: this.#config.maxSessionDuration,
      media: {
        transport: 'livekit',
        url: this.#livekitUrl,
        clientToken: this.#livekitClientToken,
      },
      audioInput: {
        encoding: 'pcm_s16le',
        sampleRateHz: AUDIO_SAMPLE_RATE_HZ,
        channels: 1,
      },
    };
  }

  #validateAudio(audio, options) {
    const format = options.format || 'pcm_s16le';
    const sampleRateHz = options.sampleRateHz || AUDIO_SAMPLE_RATE_HZ;
    if (format !== 'pcm_s16le' || sampleRateHz !== AUDIO_SAMPLE_RATE_HZ) {
      throw invalidAudio('LiveAvatar LITE requires mono signed 16-bit PCM at 24 kHz.');
    }
    if (!Buffer.isBuffer(audio) && !(audio instanceof Uint8Array)) {
      throw invalidAudio('Audio must be a Buffer or Uint8Array.');
    }
    const chunk = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
    if (chunk.byteLength === 0 || chunk.byteLength % AUDIO_BYTES_PER_SAMPLE !== 0) {
      throw invalidAudio('Audio must contain complete signed 16-bit PCM samples.');
    }
    if (chunk.byteLength > MAX_RAW_AUDIO_BYTES) {
      throw invalidAudio('Audio chunk exceeds the safe LiveAvatar WebSocket packet size.', 'liveavatar_audio_too_large');
    }
    return chunk;
  }

  #sendAudioChunk(audio, { eventId, format, sampleRateHz }) {
    this.#assertSpeechEventActive(eventId);
    const chunk = this.#validateAudio(audio, { format, sampleRateHz });
    this.#send({
      type: 'agent.speak',
      event_id: eventId,
      audio: chunk.toString('base64'),
    });
    this.#audioBytes += chunk.byteLength;
    this.#audioChunks += 1;
    this.#audioSeconds += chunk.byteLength / (AUDIO_SAMPLE_RATE_HZ * AUDIO_BYTES_PER_SAMPLE);
    this.#openSpeechEvents.add(eventId);
    return chunk.byteLength;
  }

  async enqueueAudio(audio, options = {}) {
    this.#assertOpen('enqueueAudio');
    if (!this.#config.configured) {
      return { accepted: false, ...this.#unavailableResult() };
    }
    const eventId = options.eventId || this.#randomUUID();
    const bytes = this.#sendAudioChunk(audio, { ...options, eventId });
    let playback = null;
    if (options.final !== false) {
      const completion = this.#waitForSpeechEnd(eventId);
      this.#send({ type: 'agent.speak_end', event_id: eventId });
      playback = await completion;
      this.#openSpeechEvents.delete(eventId);
    }
    return { accepted: true, eventId, bytes, final: options.final !== false, ...playback };
  }

  async attachAudioStream(stream, options = {}) {
    this.#assertOpen('attachAudioStream');
    if (!this.#config.configured) {
      return { accepted: false, ...this.#unavailableResult() };
    }
    if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
      throw invalidAudio('Audio stream must be asynchronously iterable.');
    }

    const eventId = options.eventId || this.#randomUUID();
    let chunks = 0;
    let bytes = 0;
    try {
      for await (const audio of stream) {
        if (options.signal?.aborted) {
          throw new ProviderError('LiveAvatar audio stream was aborted.', {
            code: 'liveavatar_audio_aborted',
            status: 409,
            provider: PROVIDER,
            retryable: false,
            publicMessage: 'Avatar speech was interrupted.',
          });
        }
        bytes += this.#sendAudioChunk(audio, { ...options, eventId });
        chunks += 1;
      }
    } catch (error) {
      if (chunks > 0) {
        this.#cancelSpeechEvent(eventId, 'aborted');
        try { this.#send({ type: 'agent.interrupt' }); } catch {}
      }
      throw error;
    }
    if (chunks === 0) throw invalidAudio('Audio stream did not contain any audio.');
    const completion = this.#waitForSpeechEnd(eventId);
    this.#send({ type: 'agent.speak_end', event_id: eventId });
    const playback = await completion;
    this.#openSpeechEvents.delete(eventId);
    return { accepted: true, eventId, chunks, bytes, final: true, ...playback };
  }

  async interrupt({ eventId } = {}) {
    this.#assertOpen('interrupt');
    if (!this.#config.configured) {
      return { interrupted: false, ...this.#unavailableResult() };
    }
    const cancelled = eventId ? [eventId] : [...this.#openSpeechEvents];
    for (const id of cancelled) this.#cancelSpeechEvent(id);
    this.#send({ type: 'agent.interrupt' });
    this.#interruptions += 1;
    return { interrupted: true, eventId: eventId || null, cancelledEvents: cancelled.length };
  }

  async reconnect() {
    this.#assertOpen('reconnect');
    if (!this.#config.configured) return this.#unavailableResult();
    if (!this.#sessionId || !this.#controlSocketUrl) {
      throw new ProviderError('No active LiveAvatar session can be reconnected.', {
        code: 'liveavatar_no_session',
        status: 409,
        provider: PROVIDER,
        retryable: false,
        publicMessage: 'The live avatar session ended. Continue in voice-only mode.',
      });
    }

    this.#state = 'reconnecting';
    try {
      await this.#connectControlSocket();
      this.#reconnects += 1;
      this.#lastError = null;
      return { ...this.#startResult(), reconnected: true };
    } catch (error) {
      throw this.#recordFailure(error);
    }
  }

  async stop({ reason = 'USER_CLOSED' } = {}) {
    if (this.#closed) return { stopped: true, alreadyClosed: true };
    if (!this.#sessionId) {
      this.#state = this.#config.configured ? 'stopped' : 'unavailable';
      return { stopped: true };
    }

    const providerReason = normalizeStopReason(reason);
    this.#state = 'stopping';
    this.#settleAllSpeech({ playbackEnded: false, reason: 'stopped' });
    this.#openSpeechEvents.clear();
    this.#cancelledSpeechEvents.clear();
    let stopError = null;
    try {
      await this.#stopRemoteWithRetries(providerReason);
    } catch (error) {
      stopError = normalizedError('stop', error);
    } finally {
      this.#closeSocket();
      this.#endedAt = this.#now();
      this.#clearCredentials();
      if (!stopError) this.#sessionId = null;
      this.#state = stopError ? 'error' : 'stopped';
    }
    if (stopError) throw this.#recordFailure(stopError);
    return { stopped: true, reason: providerReason };
  }

  health() {
    const fallback = !this.#config.configured || ['degraded', 'error', 'stopped', 'closed'].includes(this.#state);
    return {
      provider: PROVIDER,
      status: this.#state,
      configured: this.#config.configured,
      available: this.#state === 'connected' && this.#socket?.readyState === 1,
      mode: 'LITE',
      avatarId: this.#config.avatarId || null,
      sessionId: this.#sessionId,
      connected: this.#state === 'connected' && this.#socket?.readyState === 1,
      fallback: fallback ? 'voice-only' : null,
      reason: fallback
        ? (this.#config.unavailableReason || 'The live avatar is unavailable. Continue in visible voice-only mode.')
        : null,
      lastError: this.#lastError,
    };
  }

  usage() {
    const end = this.#endedAt ?? (this.#startedAt == null ? null : this.#now());
    const elapsedMinutes = this.#startedAt == null || end == null
      ? 0
      : Math.max(0, end - this.#startedAt) / 60_000;
    return {
      provider: PROVIDER,
      sessions: this.#sessionCount,
      active: this.#state === 'connected' || this.#state === 'degraded',
      sessionId: this.#sessionId || this.#lastSessionId,
      createdAt: safeIso(this.#createdAt),
      startedAt: safeIso(this.#startedAt),
      endedAt: safeIso(this.#endedAt),
      estimatedMinutes: Number(elapsedMinutes.toFixed(3)),
      audioBytes: this.#audioBytes,
      audioChunks: this.#audioChunks,
      audioSeconds: Number(this.#audioSeconds.toFixed(3)),
      interruptions: this.#interruptions,
      reconnects: this.#reconnects,
    };
  }

  async close() {
    if (this.#closed) return { closed: true, alreadyClosed: true };
    let stopError = null;
    try {
      await this.stop({ reason: 'USER_CLOSED' });
    } catch (error) {
      stopError = error;
    } finally {
      this.#closeSocket();
      this.#clearCredentials();
      this.#closed = true;
      this.#state = 'closed';
    }
    if (stopError) throw stopError;
    return { closed: true };
  }
}

export function createAvatarProviderFromEnv(options = {}) {
  const config = readLiveAvatarConfig(options.env || process.env);
  if (!config.configured) return new NullAvatarProvider(config.unavailableReason);
  return new LiveAvatarProvider(options);
}

export const LIVEAVATAR_AUDIO_CONTRACT = Object.freeze({
  encoding: 'pcm_s16le',
  sampleRateHz: AUDIO_SAMPLE_RATE_HZ,
  channels: 1,
  maxRawChunkBytes: MAX_RAW_AUDIO_BYTES,
});
