import { mkdir, open as openFile, readFile, rename, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { contentHash, deepClone, sha256 } from "./canonical.mjs";
import { eventHash, sealContent, validateBrainEventEnvelope, validateSessionLedgerRevision, VERSIONS } from "./contracts.mjs";
import { fail, invariant } from "./errors.mjs";

function envelope(state) {
  const value = { contract_version: VERSIONS.fileLedger, generation: state.generation, sessions: state.sessions };
  return { ...value, content_hash: contentHash(value) };
}

function verifyState(state) {
  invariant(state?.contract_version === VERSIONS.fileLedger, "LEDGER_FILE_VERSION", "Ledger file version is invalid");
  invariant(contentHash(state) === state.content_hash, "LEDGER_FILE_HASH", "Ledger file hash is invalid");
  const sessionIds = new Set();
  for (const session of state.sessions) {
    invariant(!sessionIds.has(session.session_id), "LEDGER_DUPLICATE_SESSION", "Duplicate session");
    sessionIds.add(session.session_id);
    let prior = null;
    session.events.forEach((event, index) => {
      validateBrainEventEnvelope(event);
      invariant(event.session_id === session.session_id && event.sequence === index + 1 && event.previous_event_hash === prior, "LEDGER_EVENT_CHAIN", "Event chain is invalid");
      prior = event.event_hash;
    });
    let priorRevision = null;
    session.revisions.forEach((revision, index) => {
      validateSessionLedgerRevision(revision);
      invariant(revision.session_id === session.session_id && revision.revision === index + 1 && revision.previous_revision_hash === priorRevision, "LEDGER_REVISION_CHAIN", "Revision chain is invalid");
      priorRevision = revision.content_hash;
    });
    invariant(session.revisions.at(-1)?.last_event_sequence === session.events.length, "LEDGER_SEQUENCE_MISMATCH", "Ledger/event sequence mismatch");
  }
}

export class FileSessionLedger {
  #path; #clock; #state;
  constructor(path, clock, state) { this.#path = path; this.#clock = clock; this.#state = state; }

  static async open({ path, clock = () => new Date().toISOString() }) {
    invariant(typeof path === "string" && path.length > 0, "LEDGER_PATH_REQUIRED", "Ledger path is required");
    let state;
    try { state = JSON.parse(await readFile(path, "utf8")); verifyState(state); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      state = envelope({ generation: 0, sessions: [] });
    }
    return new FileSessionLedger(path, clock, state);
  }

  async createSession({ sessionId, personaRef, planRef, policyRef, modelRef, firstQuestionId, ledgerState, idempotencyKey }) {
    const existing = this.#state.sessions.find((entry) => entry.session_id === sessionId);
    const payload = { persona_ref: personaRef, plan_ref: planRef, first_question_id: firstQuestionId };
    if (existing) {
      const started = existing.events[0];
      invariant(started.idempotency_key === idempotencyKey && started.payload_hash === sha256(payload), "SESSION_EXISTS", "Session already exists with different start authority");
      return this.getSession(sessionId);
    }
    const event = this.#makeEvent({ sessionId, sequence: 1, eventType: "session.started", actor: { type: "system", id: "system:phase0" }, payload, idempotencyKey, correlationId: `correlation:${sessionId}`, causationId: null, previousEventHash: null });
    const revision = validateSessionLedgerRevision(ledgerState);
    this.#state.sessions.push({ session_id: sessionId, events: [event], revisions: [revision] });
    try { await this.#persist(); }
    catch (error) { this.#state.sessions.pop(); throw error; }
    return this.getSession(sessionId);
  }

  async commit({ sessionId, expectedRevision, eventType, actor, payload, idempotencyKey, correlationId, causationId = null, ledgerState }) {
    const session = this.#session(sessionId);
    const existing = session.events.find((entry) => entry.idempotency_key === idempotencyKey);
    if (existing) {
      invariant(existing.event_type === eventType && existing.payload_hash === sha256(payload), "IDEMPOTENCY_CONFLICT", "Idempotency key payload conflict");
      return { event: deepClone(existing), session: this.getSession(sessionId) };
    }
    invariant(session.revisions.at(-1).revision === expectedRevision, "LEDGER_STALE_REVISION", "Expected revision is stale");
    const event = this.#makeEvent({ sessionId, sequence: session.events.length + 1, eventType, actor, payload, idempotencyKey, correlationId, causationId, previousEventHash: session.events.at(-1).event_hash });
    const revision = validateSessionLedgerRevision(ledgerState);
    invariant(revision.revision === expectedRevision + 1 && revision.last_event_sequence === event.sequence, "LEDGER_REVISION_MISMATCH", "Committed revision is inconsistent");
    session.events.push(event); session.revisions.push(revision);
    try { await this.#persist(); }
    catch (error) { session.events.pop(); session.revisions.pop(); throw error; }
    return { event: deepClone(event), session: this.getSession(sessionId) };
  }

  getSession(sessionId) { return deepClone(this.#session(sessionId)); }
  getLatestRevision(sessionId) { return deepClone(this.#session(sessionId).revisions.at(-1)); }

  #session(sessionId) { const found = this.#state.sessions.find((entry) => entry.session_id === sessionId); if (!found) fail("SESSION_NOT_FOUND", "Session was not found"); return found; }
  #makeEvent({ sessionId, sequence, eventType, actor, payload, idempotencyKey, correlationId, causationId, previousEventHash }) {
    const base = { contract_version: VERSIONS.event, event_id: `event:${sha256(`${sessionId}:${sequence}:${idempotencyKey}`).slice(0, 24)}`, session_id: sessionId, sequence, emitted_at: this.#clock(), actor, event_type: eventType, correlation_id: correlationId, causation_id: causationId, idempotency_key: idempotencyKey, privacy_zone: "synthetic_phase0", payload, payload_hash: sha256(payload), previous_event_hash: previousEventHash };
    return validateBrainEventEnvelope({ ...base, event_hash: eventHash(base) });
  }

  async #persist() {
    await mkdir(dirname(this.#path), { recursive: true });
    const lockPath = `${this.#path}.lock`;
    let lock;
    try {
      lock = await openFile(lockPath, "wx", 0o600);
      try {
        const disk = JSON.parse(await readFile(this.#path, "utf8")); verifyState(disk);
        invariant(disk.content_hash === this.#state.content_hash, "LEDGER_STALE_WRITER", "Ledger changed on disk");
      } catch (error) { if (error.code !== "ENOENT") throw error; }
      const next = envelope({ generation: this.#state.generation + 1, sessions: this.#state.sessions });
      const temp = join(dirname(this.#path), `.${basename(this.#path)}.${process.pid}.${next.generation}.tmp`);
      const handle = await openFile(temp, "wx", 0o600);
      try { await handle.writeFile(`${JSON.stringify(next)}\n`, "utf8"); await handle.sync(); } finally { await handle.close(); }
      await rename(temp, this.#path);
      this.#state = next;
    } finally { await lock?.close(); await rm(lockPath, { force: true }); }
  }
}
