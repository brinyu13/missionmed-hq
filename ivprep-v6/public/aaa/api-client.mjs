const API_ROOT = '/api/ivprep-v6';

let sessionState = null;

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

export async function startInterview({ mode = 'voice-only', idempotencyKey }) {
  if (!sessionState?.mutationCsrfToken) throw new Error('ivprep_authentication_required');
  return request('/interviews/start', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
      'X-MMHQ-CSRF': sessionState.mutationCsrfToken,
    },
    body: JSON.stringify({ mode }),
  });
}

export async function endInterview(interviewId) {
  if (!sessionState?.mutationCsrfToken) throw new Error('ivprep_authentication_required');
  return request(`/interviews/${encodeURIComponent(interviewId)}/end`, {
    method: 'POST',
    headers: { 'X-MMHQ-CSRF': sessionState.mutationCsrfToken },
    body: JSON.stringify({ reason: 'user_ended' }),
  });
}
