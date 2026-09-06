import { createMissionAccountsAuthClient } from './missionaccounts-auth.js';

const state = {
  mode: 'initializing',
  authenticated: false,
  capabilities: {},
  user: null,
  error: null,
};

const auth = createMissionAccountsAuthClient({
  onLockout(lockoutState, message) {
    state.mode = lockoutState || 'unavailable';
    state.authenticated = false;
    state.user = null;
    state.error = message || 'MissionAccounts access is unavailable.';
    document.documentElement.dataset.missionaccountsRuntime = 'unavailable';
  },
});

function requestId(prefix = 'missionaccounts') {
  return `${prefix}:${crypto.randomUUID()}`;
}

window.MissionAccountsRuntime = Object.freeze({
  get state() {
    return {
      ...state,
      capabilities: { ...state.capabilities },
      user: state.user ? { ...state.user } : null,
    };
  },
  request(path, options = {}) { return auth.request(path, options); },
  mutation(path, { method = 'POST', body, idempotencyKey = requestId('ui') } = {}) {
    return auth.request(path, {
      method,
      headers: { 'Idempotency-Key': idempotencyKey },
      body: body == null ? undefined : JSON.stringify(body),
    });
  },
});

try {
  const configResponse = await fetch(new URL('./api/config', document.baseURI), {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const config = await configResponse.json();
  if (!configResponse.ok) throw new Error(config.message || 'MissionAccounts configuration is unavailable.');
  auth.configure(config);
  if (!config.localAuth) await auth.exchange();
  const session = await auth.request('/session');
  state.mode = session.mode;
  state.authenticated = session.authenticated === true;
  state.capabilities = session.capabilities || {};
  state.user = session.user || null;
  document.documentElement.dataset.missionaccountsRuntime = state.authenticated ? 'authenticated' : 'preview';
} catch (error) {
  if (!error.redirecting) {
    state.mode = 'unavailable';
    state.error = error instanceof Error ? error.message : String(error);
    document.documentElement.dataset.missionaccountsRuntime = 'unavailable';
  }
}
