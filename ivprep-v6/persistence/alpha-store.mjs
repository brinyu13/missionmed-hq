import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const EMPTY = Object.freeze({ version: 1, disabled: false, sessions: [], usage: [] });
export const ALPHA_BETA_SESSION_SECONDS = 120;
export const ALPHA_DEFAULT_MINUTES = ALPHA_BETA_SESSION_SECONDS / 60;
export const ALPHA_HARD_MAXIMUM_MINUTES = ALPHA_BETA_SESSION_SECONDS / 60;

function cloneEmpty() { return { ...EMPTY, sessions: [], usage: [] }; }

function cleanIdentity(value) {
  const identity = String(value || '').trim();
  if (!identity || identity.length > 80 || !/^[A-Za-z0-9._@+-]+$/u.test(identity)) {
    throw new TypeError('A valid local alpha test identity is required.');
  }
  return identity;
}

export class AlphaStore {
  constructor({ path = join(process.cwd(), '.alpha-data', 'sessions.json'), now = () => Date.now() } = {}) {
    this.path = path;
    this.now = now;
    this.data = this.#load();
    this.#expireStale();
  }

  #load() {
    if (!existsSync(this.path)) return cloneEmpty();
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8'));
      return {
        version: 1,
        disabled: Boolean(parsed.disabled),
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        usage: Array.isArray(parsed.usage) ? parsed.usage : [],
      };
    } catch {
      throw new Error('Alpha persistence could not be read safely.');
    }
  }

  #save() {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(this.data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(temporary, this.path);
  }

  #expireStale() {
    const now = this.now();
    let changed = false;
    for (const session of this.data.sessions) {
      if (session.state === 'active' && now >= session.hardEndsAt) {
        session.state = 'hard-cap-ended';
        session.endedAt = session.hardEndsAt;
        session.updatedAt = session.hardEndsAt;
        session.terminationState = 'hard-cap';
        session.usage.avatarEndedAt ||= session.hardEndsAt;
        session.usage.estimatedMinutes = session.durationMinutes;
        if (!this.data.usage.some((entry) => entry.sessionId === session.id)) {
          this.data.usage.push({
            sessionId: session.id,
            testIdentity: session.testIdentity,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            estimatedMinutes: session.durationMinutes,
            model: session.model,
            avatar: session.avatar,
          });
        }
        changed = true;
      }
    }
    if (changed) this.#save();
  }

  isDisabled() { return Boolean(this.data.disabled); }

  setDisabled(disabled) {
    this.data.disabled = Boolean(disabled);
    this.#save();
    return this.data.disabled;
  }

  startSession(input) {
    this.#expireStale();
    if (this.data.disabled) throw new Error('Alpha interviews are globally disabled.');
    const testIdentity = cleanIdentity(input.testIdentity);
    if (this.data.sessions.some((session) => session.testIdentity === testIdentity && session.state === 'active')) {
      throw new Error('This test identity already has an active interview.');
    }
    const requestedMinutes = Number(input.durationMinutes || ALPHA_DEFAULT_MINUTES);
    const durationMinutes = Math.min(ALPHA_HARD_MAXIMUM_MINUTES, Math.max(1, Number.isFinite(requestedMinutes) ? requestedMinutes : ALPHA_DEFAULT_MINUTES));
    const startedAt = this.now();
    const session = {
      id: randomUUID(),
      testIdentity,
      selectedInterviewer: input.selectedInterviewer,
      model: input.model,
      voice: input.voice,
      avatar: input.avatar,
      behavior: input.behavior,
      mode: input.mode,
      deliveryEvents: [],
      transcript: [],
      instructorRecord: [],
      terminationState: null,
      state: 'active',
      startedAt,
      updatedAt: startedAt,
      endedAt: null,
      hardEndsAt: startedAt + durationMinutes * 60_000,
      durationMinutes,
      usage: { model: [], avatarStartedAt: null, avatarEndedAt: null, estimatedMinutes: 0 },
      replayMediaReferences: [],
    };
    this.data.sessions.push(session);
    this.#save();
    return structuredClone(session);
  }

  appendEvent(id, event) {
    const session = this.data.sessions.find((candidate) => candidate.id === id);
    if (!session) throw new Error('Alpha session was not found.');
    if (session.state !== 'active') throw new Error('Alpha session is not active.');
    const timestamp = this.now();
    if (event.transcript) session.transcript.push({ ...event.transcript, timestamp });
    if (event.instructorRecord) session.instructorRecord.push({ ...event.instructorRecord, timestamp });
    if (event.modelUsage) session.usage.model.push({ ...event.modelUsage, timestamp });
    if (event.avatarStarted) session.usage.avatarStartedAt ||= timestamp;
    if (event.avatarEnded) session.usage.avatarEndedAt = timestamp;
    if (event.deliveryMode === 'avatar' || event.deliveryMode === 'voice-only') {
      session.mode = event.deliveryMode;
      session.deliveryEvents ||= [];
      session.deliveryEvents.push({ mode: event.deliveryMode, reason: String(event.deliveryReason || 'delivery-state').slice(0, 80), timestamp });
    }
    if (event.replayMediaReference) session.replayMediaReferences.push(event.replayMediaReference);
    session.updatedAt = timestamp;
    session.usage.estimatedMinutes = Math.min(ALPHA_HARD_MAXIMUM_MINUTES, Math.max(0, (timestamp - session.startedAt) / 60_000));
    this.#save();
    return structuredClone(session);
  }

  endSession(id, terminationState = 'completed') {
    const session = this.data.sessions.find((candidate) => candidate.id === id);
    if (!session) throw new Error('Alpha session was not found.');
    if (session.state === 'active') {
      session.endedAt = Math.min(this.now(), session.hardEndsAt);
      session.updatedAt = session.endedAt;
      session.state = terminationState === 'hard-cap' ? 'hard-cap-ended' : 'ended';
      session.terminationState = terminationState;
      session.usage.avatarEndedAt ||= session.endedAt;
      session.usage.estimatedMinutes = Math.min(ALPHA_HARD_MAXIMUM_MINUTES, Math.max(0, (session.endedAt - session.startedAt) / 60_000));
      this.data.usage.push({
        sessionId: session.id,
        testIdentity: session.testIdentity,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        estimatedMinutes: session.usage.estimatedMinutes,
        model: session.model,
        avatar: session.avatar,
      });
      this.#save();
    }
    return structuredClone(session);
  }

  getSession(id) {
    this.#expireStale();
    const session = this.data.sessions.find((candidate) => candidate.id === id);
    return session ? structuredClone(session) : null;
  }

  listSessions() {
    this.#expireStale();
    return structuredClone(this.data.sessions);
  }

  usageLedger() {
    this.#expireStale();
    return structuredClone(this.data.usage);
  }
}

export const INACTIVE_COMMERCIALIZATION_CONTROLS = Object.freeze({
  active: false,
  monthlyIncludedMinutes: null,
  rollingWeeklyLimit: null,
  warnings: [75, 90, 100],
  adminOverride: false,
  paidTopUps: false,
});
