import { assertSession, canTransition } from '../contracts/session.mjs';

function clone(value) {
  return structuredClone(value);
}

export class SessionStore {
  #sessions = new Map();
  #commands = new Map();

  create(session) {
    assertSession(session);
    if (session.state !== 'draft' || session.state_version !== 0) {
      throw new Error('new sessions must begin at draft version 0');
    }
    if (this.#sessions.has(session.session_id)) throw new Error('session already exists');
    this.#sessions.set(session.session_id, Object.freeze(clone(session)));
    return this.get(session.session_id);
  }

  get(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (!session) throw new Error('session not found');
    return clone(session);
  }

  transition(sessionId, to, { expectedVersion, idempotencyKey, at }) {
    if (typeof idempotencyKey !== 'string' || !idempotencyKey) throw new TypeError('idempotencyKey is required');
    const commandKey = `${sessionId}:${idempotencyKey}`;
    const prior = this.#commands.get(commandKey);
    const fingerprint = JSON.stringify({ to, expectedVersion, at });
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new Error('transition idempotency conflict');
      return clone(prior.session);
    }
    const current = this.get(sessionId);
    if (current.state_version !== expectedVersion) throw new Error('session state_version conflict');
    if (!canTransition(current.state, to)) throw new Error(`invalid session transition ${current.state} -> ${to}`);
    if (current.state === 'armed' && current.subject_id !== this.#sessions.get(sessionId).subject_id) {
      throw new Error('subject_id is immutable after armed');
    }
    const updated = Object.freeze({
      ...current,
      state: to,
      state_version: current.state_version + 1,
      updated_at: at,
      ...(to === 'complete' ? { ended_at: at } : {}),
    });
    assertSession(updated);
    this.#sessions.set(sessionId, updated);
    this.#commands.set(commandKey, { fingerprint, session: updated });
    return clone(updated);
  }
}
