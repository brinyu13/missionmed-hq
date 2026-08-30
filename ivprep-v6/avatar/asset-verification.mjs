import { LIVE_INTERVIEWER_TARGET } from './live-interviewer-target.mjs';
import { ProviderError, providerResponseError } from '../providers/errors.mjs';

const API_BASE_URL = 'https://api.liveavatar.com';
const REQUEST_TIMEOUT_MS = 15_000;

function dataFrom(payload, operation) {
  if (!payload || typeof payload !== 'object' || payload.code !== 1000 || !payload.data || typeof payload.data !== 'object') {
    throw new ProviderError(`LiveAvatar ${operation} response did not contain data.`, {
      code: `liveavatar_${operation}_invalid`, status: 502, provider: 'liveavatar', retryable: false,
      publicMessage: 'LiveAvatar target verification returned an invalid response.',
    });
  }
  return payload.data;
}

async function authenticatedGet(path, { apiKey, fetchImpl }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  timeout.unref?.();
  let response;
  try {
    response = await fetchImpl(`${API_BASE_URL}${path}`, {
      method: 'GET', signal: controller.signal, headers: { 'X-API-KEY': apiKey },
    });
  } catch (error) {
    throw new ProviderError('LiveAvatar authenticated target verification failed.', {
      code: 'liveavatar_target_verification_failed', status: 502, provider: 'liveavatar', retryable: true,
      publicMessage: 'LiveAvatar target verification failed.', cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response?.ok) throw providerResponseError('liveavatar', response, 'target_verification');
  try { return await response.json(); }
  catch (error) {
    throw new ProviderError('LiveAvatar target verification returned invalid JSON.', {
      code: 'liveavatar_target_verification_invalid', status: 502, provider: 'liveavatar', retryable: false,
      publicMessage: 'LiveAvatar target verification returned an invalid response.', cause: error,
    });
  }
}

export async function verifyLockedLiveAvatarAssets({ apiKey, fetchImpl = globalThis.fetch } = {}) {
  if (!String(apiKey || '').trim()) throw new TypeError('LiveAvatar server authorization is required.');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function.');
  const [avatarPayload, voicePayload] = await Promise.all([
    authenticatedGet(`/v1/avatars/${LIVE_INTERVIEWER_TARGET.avatarId}`, { apiKey, fetchImpl }),
    authenticatedGet(`/v1/voices/${LIVE_INTERVIEWER_TARGET.voiceId}`, { apiKey, fetchImpl }),
  ]);
  const avatar = dataFrom(avatarPayload, 'avatar_lookup');
  const voice = dataFrom(voicePayload, 'voice_lookup');
  const avatarVerified = avatar.id === LIVE_INTERVIEWER_TARGET.avatarId
    && avatar.name === LIVE_INTERVIEWER_TARGET.avatarDisplayName
    && avatar.is_expired !== true;
  const voiceVerified = voice.id === LIVE_INTERVIEWER_TARGET.voiceId
    && voice.name === LIVE_INTERVIEWER_TARGET.voiceDisplayName;
  return Object.freeze({
    authenticated: true,
    avatar: Object.freeze({
      verified: avatarVerified,
      id: avatar.id === LIVE_INTERVIEWER_TARGET.avatarId ? LIVE_INTERVIEWER_TARGET.avatarId : null,
      name: avatar.name === LIVE_INTERVIEWER_TARGET.avatarDisplayName ? LIVE_INTERVIEWER_TARGET.avatarDisplayName : null,
      type: typeof avatar.type === 'string' ? avatar.type.slice(0, 40) : null,
      status: typeof avatar.status === 'string' ? avatar.status.slice(0, 40) : null,
      expired: avatar.is_expired === true,
      defaultVoiceMatchesLockedTarget: avatar.default_voice?.id === LIVE_INTERVIEWER_TARGET.voiceId,
    }),
    voice: Object.freeze({
      verified: voiceVerified,
      id: voice.id === LIVE_INTERVIEWER_TARGET.voiceId ? LIVE_INTERVIEWER_TARGET.voiceId : null,
      name: voice.name === LIVE_INTERVIEWER_TARGET.voiceDisplayName ? LIVE_INTERVIEWER_TARGET.voiceDisplayName : null,
      language: typeof voice.language === 'string' ? voice.language.slice(0, 40) : null,
      gender: typeof voice.gender === 'string' ? voice.gender.slice(0, 40) : null,
    }),
    liteCompatibility: Object.freeze({
      compatible: false,
      reason: 'LITE accepts supplied PCM and has no provider voice-selection field; the audible identity is the supplied TTS audio.',
      truthfulFallbackVoice: 'OpenAI cedar',
    }),
  });
}
