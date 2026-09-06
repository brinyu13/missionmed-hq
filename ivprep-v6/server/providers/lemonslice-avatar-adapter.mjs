import { NO_RETRY } from './provider-session-controller.mjs';
import { FOUNDER_TEST_AVATAR_PARTICIPANT_ID } from '../founder-paid-test-gate.mjs';

export const LEMONSLICE_ORIGIN = 'https://lemonslice.com';
export const LEMONSLICE_API_URL = `${LEMONSLICE_ORIGIN}/api/liveai/sessions`;
export const LEMONSLICE_AGENT_ID = 'agent_9bdfc50ec0086043';
export const LEMONSLICE_TERMINAL_STATUSES = Object.freeze(new Set(['COMPLETED', 'TIMED_OUT', 'FAILED']));

function sessionUrl(sessionId) {
  if (!/^[A-Za-z0-9._:-]{1,160}$/u.test(String(sessionId || ''))) throw new TypeError('Invalid LemonSlice session identifier.');
  return `${LEMONSLICE_API_URL}/${sessionId}`;
}

export class LemonSliceAvatarAdapter {
  constructor({
    apiKey,
    agentId = LEMONSLICE_AGENT_ID,
    livekitUrl,
    livekitApiKey,
    livekitApiSecret,
    fetchImpl = fetch,
    avatarSessionFactory = null,
  } = {}) {
    if (!apiKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) throw new Error('LemonSlice server configuration is unavailable.');
    if (agentId !== LEMONSLICE_AGENT_ID) throw new Error('LemonSlice agent binding is not approved.');
    this.apiKey = apiKey;
    this.agentId = agentId;
    this.livekit = Object.freeze({ livekitUrl, livekitApiKey, livekitApiSecret });
    this.fetch = fetchImpl;
    this.avatarSessionFactory = avatarSessionFactory;
    this.session = null;
  }

  async create({ agentSession, room }) {
    if (this.session) throw new Error('LemonSlice session can be created only once.');
    const lemonslice = this.avatarSessionFactory ? null : await import('@livekit/agents-plugin-lemonslice');
    const AvatarSession = this.avatarSessionFactory || lemonslice?.AvatarSession;
    if (typeof AvatarSession !== 'function') throw new Error('Pinned LemonSlice adapter is unavailable.');
    this.session = new AvatarSession({
      apiKey: this.apiKey,
      apiUrl: LEMONSLICE_API_URL,
      agentId: this.agentId,
      avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
      idleTimeout: 45,
      connOptions: NO_RETRY,
    });
    if (this.session.avatarIdentity !== FOUNDER_TEST_AVATAR_PARTICIPANT_ID) {
      throw new Error('LemonSlice avatar participant binding is unavailable.');
    }
    const sessionId = String(await this.session.start(agentSession, room, this.livekit));
    if (!/^[A-Za-z0-9._:-]{1,160}$/u.test(sessionId)) throw new Error('LemonSlice returned an invalid session identifier.');
    await this.session.waitForJoin({ timeout: NO_RETRY.timeoutMs });
    return {
      sessionId,
      avatarJoined: true,
      avatarParticipantIdentity: FOUNDER_TEST_AVATAR_PARTICIPANT_ID,
    };
  }

  get sessionId() {
    const value = String(this.session?.sessionId || '');
    return /^[A-Za-z0-9._:-]{1,160}$/u.test(value) ? value : null;
  }

  roomOptions() {
    return this.session?.roomOptions?.() || {};
  }

  async terminate({ sessionId }) {
    const response = await this.fetch(`${sessionUrl(sessionId)}/control`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event: 'terminate' }),
      signal: AbortSignal.timeout(5_000),
    });
    let success = false;
    try { success = (await response.json())?.success === true; } catch {}
    return { confirmed: response.ok && success, status: response.status };
  }

  async status({ sessionId }) {
    const response = await this.fetch(sessionUrl(sessionId), {
      method: 'GET',
      redirect: 'error',
      headers: { 'X-API-Key': this.apiKey },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { ok: false, status: response.status };
    const value = await response.json();
    const sessionStatus = String(value?.session_status || '').toUpperCase();
    const cost = value?.cost == null ? Number.NaN : Number(value.cost);
    return {
      ok: ['QUEUED', 'ACTIVE', ...LEMONSLICE_TERMINAL_STATUSES].includes(sessionStatus),
      status: response.status,
      sessionStatus,
      cost: Number.isFinite(cost) && cost >= 0 && sessionStatus === 'COMPLETED' ? cost : null,
    };
  }

  async waitForTerminal({ sessionId, timeoutMs = 8_000, intervalMs = 250 } = {}) {
    const deadline = Date.now() + Math.max(1, Math.min(8_000, Number(timeoutMs) || 0));
    let last = null;
    do {
      last = await this.status({ sessionId });
      if (last?.ok && LEMONSLICE_TERMINAL_STATUSES.has(last.sessionStatus)) return last;
      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, Math.max(25, Math.min(500, Number(intervalMs) || 250))));
    } while (Date.now() < deadline);
    return last && typeof last === 'object' ? { ...last, terminalObserved: false } : { ok: false, terminalObserved: false };
  }

  get avatarIdentity() {
    return this.session?.avatarIdentity === FOUNDER_TEST_AVATAR_PARTICIPANT_ID
      ? FOUNDER_TEST_AVATAR_PARTICIPANT_ID
      : null;
  }

  async close() {
    await this.session?.aclose?.();
  }
}
