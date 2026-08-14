const API_ROOT = '/api/ivprep-v6';

let sessionState = null;

export function createNoReconnectPolicy() {
  return Object.freeze({ nextRetryDelayInMs: () => null });
}

export function createFounderTransportTerminationGate({
  onPreReadyFailure,
  onPostReadyFailure,
} = {}) {
  if (typeof onPreReadyFailure !== 'function' || typeof onPostReadyFailure !== 'function') {
    throw new TypeError('Founder transport termination callbacks are required.');
  }
  let ready = false;
  let terminal = false;
  return Object.freeze({
    markReady() {
      if (terminal) return false;
      ready = true;
      return true;
    },
    fail(reason = 'media_transport_failed') {
      if (terminal) return false;
      terminal = true;
      const callback = ready ? onPostReadyFailure : onPreReadyFailure;
      try {
        const pending = callback(reason);
        if (pending && typeof pending.catch === 'function') void pending.catch(() => {});
      } catch {
        // The one-shot terminal decision remains closed even if local cleanup throws.
      }
      return true;
    },
    state() {
      return Object.freeze({ ready, terminal });
    },
  });
}

export function createFounderMediaReadinessGate({ avatarParticipantIdentity, onReady, onFail } = {}) {
  if (!/^[A-Za-z0-9._:-]{8,160}$/u.test(String(avatarParticipantIdentity || ''))
    || typeof onReady !== 'function'
    || typeof onFail !== 'function') {
    throw new TypeError('Exact Founder media readiness authority is required.');
  }
  let videoDecoded = false;
  let audioPlayable = false;
  let terminal = false;
  let readyPromise = null;
  return Object.freeze({
    observe({ participantIdentity, kind, ready } = {}) {
      if (terminal || participantIdentity !== avatarParticipantIdentity) return false;
      if (ready !== true || !['video', 'audio'].includes(kind)) {
        terminal = true;
        onFail();
        return false;
      }
      if (kind === 'video') videoDecoded = true;
      if (kind === 'audio') audioPlayable = true;
      if (videoDecoded && audioPlayable && !readyPromise) {
        readyPromise = Promise.resolve().then(onReady).catch((error) => {
          terminal = true;
          onFail(error);
          return false;
        });
      }
      return true;
    },
    fail(reason = 'media_transport_failed') {
      if (terminal) return false;
      terminal = true;
      onFail(reason);
      return true;
    },
    state() {
      return Object.freeze({ videoDecoded, audioPlayable, terminal, readyStarted: Boolean(readyPromise) });
    },
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'ivprep_request_failed');
    error.code = body.error || 'ivprep_request_failed';
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function loadIvPrepSession() {
  sessionState = await request('/session');
  return structuredClone(sessionState);
}

export async function loadVault() {
  const body = await request('/vault');
  return Array.isArray(body.sessions) ? body.sessions : [];
}

export async function authorizeFounderTest({ agentId, profile, voice, maxSeconds, idempotencyKey }) {
  if (!sessionState?.mutationCsrfToken) throw new Error('ivprep_authentication_required');
  return request('/provider-tests/authorize', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
      'X-MMHQ-CSRF': sessionState.mutationCsrfToken,
    },
    body: JSON.stringify({ agentId, profile, voice, maxSeconds }),
  });
}

export async function startInterview({ mode = 'voice-only', idempotencyKey, authorization = null }) {
  if (!sessionState?.mutationCsrfToken) throw new Error('ivprep_authentication_required');
  const body = mode === 'video' ? {
    mode,
    authorizationId: authorization?.id,
    agentId: authorization?.agentId,
    profile: authorization?.profile,
    voice: authorization?.voice,
    maxSeconds: authorization?.maxSeconds,
  } : { mode };
  return request('/interviews/start', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
      'X-MMHQ-CSRF': sessionState.mutationCsrfToken,
    },
    body: JSON.stringify(body),
  });
}

export async function recordInterviewMediaReady(interviewId, avatarParticipantIdentity) {
  if (!sessionState?.mutationCsrfToken) throw new Error('ivprep_authentication_required');
  return request(`/interviews/${encodeURIComponent(interviewId)}/media-ready`, {
    method: 'POST',
    headers: { 'X-MMHQ-CSRF': sessionState.mutationCsrfToken },
    body: JSON.stringify({
      avatarParticipantIdentity,
      videoDecoded: true,
      audioPlayable: true,
      audioAuthority: 'avatar-livekit',
    }),
  });
}

export async function loadInterviewStatus(interviewId) {
  return request(`/interviews/${encodeURIComponent(interviewId)}/status`);
}

export async function endInterview(interviewId) {
  if (!sessionState?.mutationCsrfToken) throw new Error('ivprep_authentication_required');
  return request(`/interviews/${encodeURIComponent(interviewId)}/end`, {
    method: 'POST',
    headers: { 'X-MMHQ-CSRF': sessionState.mutationCsrfToken },
    body: JSON.stringify({ reason: 'user_ended' }),
  });
}
