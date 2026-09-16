function authError(payload, status) {
  const body = payload?.data || payload?.error || payload || {};
  const error = new Error(body.message || `MissionAccounts authentication failed (${status}).`);
  error.code = body.code || 'auth_failed';
  error.state = body.state || '';
  error.status = status;
  error.loginUrl = body.login_url || '';
  error.field = typeof body.field === 'string' ? body.field : '';
  return error;
}

function normalizedBasePath(value) {
  const clean = String(value || '/missionaccounts/').replace(/^\/+|\/+$/g, '');
  return `/${clean}/`;
}

function tokenPrincipal(token) {
  try {
    const raw = token.split('.')[1] || '';
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(raw.length / 4) * 4, '=');
    const claims = JSON.parse(atob(padded));
    return JSON.stringify([claims.sub, claims.wp_user_id, claims.student_id, claims.app_role]);
  } catch { return ''; }
}

function decodeExpiration(token) {
  try {
    const payload = token.split('.')[1] || '';
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return Number(JSON.parse(atob(padded)).exp || 0);
  } catch {
    return 0;
  }
}

export async function boundedFetch(input, init = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const relayAbort = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal) {
    if (upstreamSignal.aborted) relayAbort();
    else upstreamSignal.addEventListener('abort', relayAbort, { once: true });
  }
  const timer = globalThis.setTimeout(() => controller.abort('missionaccounts_request_timeout'), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !upstreamSignal?.aborted) {
      const timeout = new Error('Connection is taking longer than expected. MissionMed Accounts will keep your workspace open and reconnect automatically.');
      timeout.code = 'request_timeout';
      timeout.state = 'access_unavailable';
      timeout.status = 503;
      throw timeout;
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    upstreamSignal?.removeEventListener('abort', relayAbort);
  }
}

export function createMissionAccountsAuthClient({
  onLockout = () => {},
  onSessionChanged = () => {},
  onCredentialState = () => {},
} = {}) {
  let config = {};
  let token = '';
  let expiresAt = 0;
  let refreshTimer = 0;
  let exchangePromise = null;
  let generation = 0;
  let refreshFailures = 0;
  let credentialStatus = 'empty';

  function assertCurrent(expected) {
    if (expected !== generation) throw Object.assign(new Error('This session has ended. Reload MissionAccounts.'), { code: 'session_ended', status: 401 });
  }

  function lockout(state, message) {
    clear();
    onLockout(state, message);
  }

  function configure(nextConfig = {}) {
    config = { ...nextConfig, basePath: normalizedBasePath(nextConfig.basePath) };
  }

  function apiUrl(pathname) {
    const normalized = String(pathname || '').replace(/^\/+/, '').replace(/^api\/?/, '');
    return new URL(`${config.basePath || '/missionaccounts/'}api/${normalized}`, window.location.origin).toString();
  }

  function clear() {
    generation++;
    token = '';
    expiresAt = 0;
    refreshFailures = 0;
    credentialStatus = 'empty';
    window.clearTimeout(refreshTimer);
    refreshTimer = 0;
    onCredentialState({ status: credentialStatus, canMutate: false, expiresAt: 0 });
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  function canMutate() {
    return config.localAuth === true || Boolean(token && expiresAt > Math.floor(Date.now() / 1000));
  }

  function publishCredentialState(status = credentialStatus) {
    credentialStatus = status;
    onCredentialState({ status, canMutate: canMutate(), expiresAt });
  }

  function isTransientFailure(error) {
    const status = Number(error?.status || 0);
    return error?.code === 'request_timeout'
      || status === 408
      || status === 425
      || status === 429
      || status >= 500
      || status === 0;
  }

  function scheduleRefresh(delayOverrideMs = null) {
    window.clearTimeout(refreshTimer);
    if (!token || config.localAuth) return;
    let delayMs = delayOverrideMs == null ? Number.NaN : Number(delayOverrideMs);
    if (!Number.isFinite(delayMs)) {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(1, expiresAt - now);
      const skew = Math.max(1, Number(config.tokenRefreshSkewSeconds || 15));
      delayMs = Math.max(1, Math.min(Math.floor(remaining * 0.8), remaining - skew)) * 1000;
    }
    refreshTimer = window.setTimeout(() => {
      exchange({ background: true }).catch(() => {});
    }, delayMs);
  }

  function preserveAfterTransientFailure() {
    refreshFailures += 1;
    publishCredentialState(canMutate() ? 'refresh_delayed' : 'stale');
    const retryMs = Math.min(5 * 60_000, 5_000 * (2 ** Math.min(refreshFailures - 1, 6)));
    scheduleRefresh(retryMs);
  }

  function setToken(nextToken, nextExpiresAt = 0) {
    const changed = token && tokenPrincipal(token) !== tokenPrincipal(String(nextToken || ''));
    if (changed) {
      lockout('session_changed', 'Your signed-in account changed. Reloading MissionAccounts…');
      onSessionChanged();
      throw Object.assign(new Error('Your signed-in account changed.'), { code: 'session_changed', status: 401 });
    }
    token = String(nextToken || '');
    expiresAt = Number(nextExpiresAt || decodeExpiration(token));
    refreshFailures = 0;
    publishCredentialState('ready');
    scheduleRefresh();
  }

  async function bootstrapBridge({ redirectOnUnauthenticated = false } = {}) {
    const expected = generation;
    const endpoint = new URL(
      config.wpBootstrapPath || '/wp-admin/admin-ajax.php?action=missionmed_missionaccounts_bootstrap',
      window.location.origin,
    );
    endpoint.searchParams.set('return_to', window.location.href);
    const response = await boundedFetch(endpoint, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await readJson(response);
    if (!response.ok || payload?.success !== true) {
      const error = authError(payload, response.status);
      assertCurrent(expected);
      if (response.status === 401 && error.loginUrl && redirectOnUnauthenticated) {
        error.redirecting = true;
        window.location.assign(error.loginUrl);
      }
      throw error;
    }
    return payload.data;
  }

  async function performExchange() {
    if (config.localAuth) return '';
    const expected = generation;
    const bridge = await bootstrapBridge({ redirectOnUnauthenticated: !token });
    assertCurrent(expected);
    const response = await boundedFetch(bridge.token_endpoint, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-WP-Nonce': bridge.nonce,
      },
      body: '{}',
    });
    const payload = await readJson(response);
    assertCurrent(expected);
    if (!response.ok || !payload.token) throw authError(payload, response.status);
    setToken(payload.token, payload.expires_at);
    return payload.token;
  }

  async function exchange({ background = false } = {}) {
    if (config.localAuth) return '';
    if (!exchangePromise) {
      const hadToken = Boolean(token);
      exchangePromise = performExchange()
        .catch(error => {
          if (hadToken && isTransientFailure(error)) {
            preserveAfterTransientFailure();
          } else {
            lockout(error.state || error.code, error.message);
          }
          throw error;
        })
        .finally(() => { exchangePromise = null; });
    }
    return exchangePromise;
  }

  async function request(pathname, options = {}, retried = false) {
    const expected = generation;
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !(options.body instanceof Blob) && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await boundedFetch(apiUrl(pathname), {
      ...options,
      credentials: config.localAuth ? 'same-origin' : 'omit',
      cache: 'no-store',
      headers,
    });
    assertCurrent(expected);
    if (response.status === 401 && !config.localAuth && !retried) {
      await exchange();
      return request(pathname, options, true);
    }
    const payload = await readJson(response);
    assertCurrent(expected);
    if (!response.ok) {
      const error = authError(payload, response.status);
      if (response.status === 401 || response.status === 403) lockout(error.state || error.code, error.message);
      throw error;
    }
    return payload;
  }

  window.addEventListener('pagehide', () => lockout('session_ended', 'Return to Matrix to reopen MissionAccounts.'));
  window.addEventListener('pageshow', event => {
    if (event.persisted) window.location.reload();
  });

  window.addEventListener('focus', () => {
    if (token && !config.localAuth) exchange({ background: true }).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && token && !config.localAuth) exchange({ background: true }).catch(() => {});
  });

  return Object.freeze({
    configure,
    exchange,
    request,
    setToken,
    clear,
    get token() { return token; },
    get canMutate() { return canMutate(); },
    get credentialStatus() { return credentialStatus; },
    get expiresAt() { return expiresAt; },
  });
}
