const API = '/api/ivoc/v1';

async function json(path, {
  method = 'GET', body = null, csrfToken = '', signal = null, keepalive = false,
} = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    signal,
    keepalive,
    headers: {
      Accept: 'application/json',
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
      ...(csrfToken ? { 'X-MMHQ-CSRF': csrfToken } : {}),
    },
    body: body == null ? null : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `ivoc_http_${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export class IvocApi {
  constructor() {
    this.csrfToken = '';
    this.identity = null;
  }

  async bootstrap() {
    const payload = await json('/bootstrap');
    this.csrfToken = String(payload.csrfToken || '');
    this.identity = payload.identity || null;
    return payload;
  }

  createSession(input) { return json('/sessions', { method: 'POST', body: input, csrfToken: this.csrfToken }); }
  abandonSession(sessionId, input = {}, { keepalive = false } = {}) {
    return json(`/sessions/${encodeURIComponent(sessionId)}/abandon`, {
      method: 'POST', body: input, csrfToken: this.csrfToken, keepalive,
    });
  }
  createRecording(sessionId, input) { return json(`/sessions/${encodeURIComponent(sessionId)}/recordings`, { method: 'POST', body: input, csrfToken: this.csrfToken }); }
  sealRecording(recordingId, input) { return json(`/recordings/${encodeURIComponent(recordingId)}/seal`, { method: 'POST', body: input, csrfToken: this.csrfToken }); }
  saveResults(sessionId, input) { return json(`/sessions/${encodeURIComponent(sessionId)}/results`, { method: 'POST', body: input, csrfToken: this.csrfToken }); }
  context(input) { return json('/context', { method: 'POST', body: input, csrfToken: this.csrfToken }); }
  markReviewed(sessionId, input = {}) { return json(`/sessions/${encodeURIComponent(sessionId)}/review`, { method: 'POST', body: input, csrfToken: this.csrfToken }); }
  library(scope = 'own') { return json(`/library?scope=${encodeURIComponent(scope)}`); }
  session(sessionId) { return json(`/sessions/${encodeURIComponent(sessionId)}`); }
  playback(recordingId, disposition = 'inline') { return json(`/recordings/${encodeURIComponent(recordingId)}/playback-url?disposition=${encodeURIComponent(disposition)}`); }
  questions() { return json('/questions'); }
  adminConfig() { return json('/admin/config'); }
  credits() { return json('/credits'); }
  addQuestion(input) { return json('/admin/questions', { method: 'POST', body: input, csrfToken: this.csrfToken }); }
  updateQuestion(questionId, input) { return json(`/admin/questions/${encodeURIComponent(questionId)}`, { method: 'PATCH', body: input, csrfToken: this.csrfToken }); }
  preferences() { return json('/preferences'); }
  savePreferences(value) { return json('/preferences', { method: 'PUT', body: value, csrfToken: this.csrfToken }); }
}

export const ivocApi = new IvocApi();
