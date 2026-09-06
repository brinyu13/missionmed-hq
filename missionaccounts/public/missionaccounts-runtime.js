const state = {
  mode: 'initializing',
  authenticated: false,
  capabilities: {},
  error: null,
};

window.MissionAccountsRuntime = Object.freeze({
  get state() { return { ...state }; },
  async request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      credentials: 'same-origin',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.message || 'MissionAccounts request failed'), { status: response.status, body });
    return body;
  },
});

try {
  const response = await fetch('/api/session', { credentials: 'same-origin' });
  const body = await response.json();
  state.mode = body.mode;
  state.authenticated = response.ok && body.authenticated === true;
  state.capabilities = body.capabilities || {};
  document.documentElement.dataset.missionaccountsRuntime = state.authenticated ? 'authenticated' : 'preview';
} catch (error) {
  state.mode = 'unavailable';
  state.error = error instanceof Error ? error.message : String(error);
  document.documentElement.dataset.missionaccountsRuntime = 'unavailable';
}
