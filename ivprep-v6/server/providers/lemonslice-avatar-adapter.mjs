import { NO_RETRY } from './provider-session-controller.mjs';

export const LEMONSLICE_ORIGIN = 'https://lemonslice.com';
export const LEMONSLICE_AGENT_ID = 'agent_9bdfc50ec0086043';

function sessionUrl(sessionId) {
  if (!/^[A-Za-z0-9._:-]{1,160}$/u.test(String(sessionId || ''))) throw new TypeError('Invalid LemonSlice session identifier.');
  return `${LEMONSLICE_ORIGIN}/api/liveai/sessions/${sessionId}`;
}

export class LemonSliceAvatarAdapter {
  constructor({ apiKey, agentId = LEMONSLICE_AGENT_ID, fetchImpl = fetch } = {}) {
    if (!apiKey) throw new Error('LemonSlice server configuration is unavailable.');
    if (agentId !== LEMONSLICE_AGENT_ID) throw new Error('LemonSlice agent binding is not approved.');
    this.apiKey = apiKey;
    this.agentId = agentId;
    this.fetch = fetchImpl;
    this.session = null;
  }

  async create({ agentSession, room }) {
    if (this.session) throw new Error('LemonSlice session can be created only once.');
    const lemonslice = await import('@livekit/agents-plugin-lemonslice');
    if (typeof lemonslice.AvatarSession !== 'function') throw new Error('Pinned LemonSlice adapter is unavailable.');
    this.session = new lemonslice.AvatarSession({
      apiKey: this.apiKey,
      agentId: this.agentId,
      connOptions: NO_RETRY,
    });
    const started = await this.session.start(agentSession, { room, connOptions: NO_RETRY });
    return {
      sessionId: String(started?.sessionId || this.session.sessionId || ''),
      mediaReady: started?.mediaReady === true,
    };
  }

  async terminate({ sessionId }) {
    const response = await this.fetch(`${sessionUrl(sessionId)}/control`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'terminate' }),
      signal: AbortSignal.timeout(5_000),
    });
    return { confirmed: response.ok, status: response.status };
  }

  async status({ sessionId }) {
    const response = await this.fetch(sessionUrl(sessionId), {
      method: 'GET',
      redirect: 'error',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { ok: false, status: response.status };
    const value = await response.json();
    return { ok: true, status: response.status, value };
  }

  async close() {
    await this.session?.aclose?.();
    this.session = null;
  }
}
