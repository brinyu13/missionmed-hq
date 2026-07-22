const ALLOWED_SCENARIO_PARAMS = new Set(['scenario', 'state', 'cursor', 'q', 'owner', 'queue', 'area']);

export class CamApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CamApiError';
    this.status = Number(options.status || 0);
    this.code = options.code || 'MMC_REQUEST_FAILED';
    this.correlationId = options.correlationId || null;
    this.retryable = options.retryable !== false;
    this.payload = options.payload || null;
  }
}

export async function query(endpoint, options = {}) {
  const url = appendAllowedSearch(endpoint, options.search);
  return request(url, {
    method: 'GET',
    signal: options.signal,
  }, validateQueryEnvelope);
}

export async function command(payload, options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (options.csrfToken) headers['X-MMHQ-CSRF'] = options.csrfToken;
  return request('/api/mmc/v2/mentor/commands', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: options.signal,
  }, validateCommandResult);
}

export async function bootstrapCsrf(options = {}) {
  let response;
  try {
    response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new CamApiError('The authenticated command session could not be checked.', {
      code: navigator.onLine === false ? 'OFFLINE' : 'AUTH_BOOTSTRAP_UNAVAILABLE',
      retryable: true,
    });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.authenticated !== true
      || typeof payload.csrfToken !== 'string'
      || !/^[A-Za-z0-9_-]{8,512}$/u.test(payload.csrfToken)) {
    throw new CamApiError('The authenticated command session is unavailable.', {
      status: response.status,
      code: response.status === 401 || response.status === 403 ? 'SESSION_EXPIRED' : 'CSRF_BOOTSTRAP_UNAVAILABLE',
      retryable: response.status >= 500,
    });
  }
  return payload.csrfToken;
}

async function request(url, options, validateSuccess) {
  let response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new CamApiError(navigator.onLine === false
      ? 'The network is offline. Unsaved browser-only work is not saved.'
      : 'The mentor service could not be reached.', {
      code: navigator.onLine === false ? 'OFFLINE' : 'NETWORK_UNAVAILABLE',
      retryable: true,
    });
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const safe = payload && typeof payload === 'object' ? payload : {};
    const nested = safe.error && typeof safe.error === 'object' && !Array.isArray(safe.error) ? safe.error : {};
    throw new CamApiError(nested.message || safe.message || statusMessage(response.status), {
      status: response.status,
      code: nested.code || safe.code || (typeof safe.error === 'string' ? safe.error : null) || statusCode(response.status),
      correlationId: nested.correlationId || safe.correlationId || safe.meta?.correlationId,
      retryable: typeof nested.retryable === 'boolean'
        ? nested.retryable
        : ![400, 401, 403, 404, 410, 422].includes(response.status),
    });
  }
  return validateSuccess(payload);
}

function validateQueryEnvelope(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw contractError('MMC returned a non-object response.');
  }
  const keys = Object.keys(payload).sort();
  if (keys.length !== 2 || keys[0] !== 'data' || keys[1] !== 'meta') {
    throw contractError('MMC response must contain exactly data and meta.');
  }
  if (!payload.meta || typeof payload.meta !== 'object' || Array.isArray(payload.meta)) {
    throw contractError('MMC response meta is unavailable.');
  }
  return Object.freeze({ data: payload.data, meta: Object.freeze({ ...payload.meta }) });
}

function validateCommandResult(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw contractError('MMC returned a non-object command result.');
  }
  const expected = [
    'aggregateVersion', 'auditId', 'commandId', 'correlationId', 'objectResults',
    'ok', 'readback', 'replayed', 'status',
  ];
  const keys = Object.keys(payload).sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw contractError('MMC command result has an invalid field set.');
  }
  if (payload.ok !== true || payload.status !== 'COMMITTED' || typeof payload.replayed !== 'boolean'
      || !Number.isSafeInteger(payload.aggregateVersion) || payload.aggregateVersion < 1
      || !Array.isArray(payload.objectResults) || !payload.objectResults.length
      || !payload.readback || typeof payload.readback !== 'object' || Array.isArray(payload.readback)) {
    throw contractError('MMC command result is internally inconsistent.');
  }
  const first = payload.objectResults[0];
  if (!first || first.id !== payload.readback.id || first.kind !== payload.readback.kind
      || first.version !== payload.readback.version) {
    throw contractError('MMC command readback does not match the committed object.');
  }
  return Object.freeze({ ...payload, objectResults: Object.freeze([...payload.objectResults]), readback: Object.freeze({ ...payload.readback }) });
}

function contractError(message) {
  return new CamApiError(message, { code: 'RESPONSE_CONTRACT_INVALID', retryable: false });
}

function appendAllowedSearch(endpoint, search) {
  if (!(search instanceof URLSearchParams)) return endpoint;
  const target = new URL(endpoint, window.location.origin);
  for (const [key, value] of search.entries()) {
    if (ALLOWED_SCENARIO_PARAMS.has(key)) target.searchParams.append(key, value);
  }
  return `${target.pathname}${target.search}`;
}

function statusMessage(status) {
  if (status === 401) return 'Your mentor session has expired.';
  if (status === 403) return 'Your current role or assignment cannot access this workspace.';
  if (status === 404 || status === 410) return 'This workspace is unavailable or has been withdrawn.';
  if (status === 409) return 'This record changed in another session. Compare before applying your work.';
  if (status === 429) return 'The service is temporarily rate limited.';
  return 'The mentor request could not be completed.';
}

function statusCode(status) {
  if (status === 401) return 'SESSION_EXPIRED';
  if (status === 403) return 'ACCESS_REVOKED';
  if (status === 404 || status === 410) return 'NOT_FOUND_OR_WITHDRAWN';
  if (status === 409) return 'VERSION_CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  return 'MMC_REQUEST_FAILED';
}

export function buildCommandEnvelope({ kind, targetId, expectedVersion = 0, purpose, payload }) {
  const commandId = crypto.randomUUID();
  return Object.freeze({
    commandId,
    idempotencyKey: `cam-v2:${commandId}`,
    expectedVersion: Number.isSafeInteger(Number(expectedVersion)) ? Number(expectedVersion) : 0,
    targetId: String(targetId),
    kind: String(kind),
    purpose: String(purpose),
    payload: payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {},
    schemaVersion: 1,
  });
}
