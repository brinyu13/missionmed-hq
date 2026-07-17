import { clone, immutableCopy } from "../canonical.mjs";
import { CieError, invariant } from "../errors.mjs";

function emptyState() {
  return {
    sessions: new Map(),
    consentReceipts: new Map(),
    trackItems: new Map(),
    skillSnapshots: new Map(),
    priorities: new Map(),
    moments: new Map(),
    opportunities: new Map(),
    auditEvents: [],
    mutationReceipts: new Map()
  };
}

function mapValues(map) {
  return [...map.values()].map(clone);
}

export class MemoryCieRepository {
  #state;
  #writeQueue = Promise.resolve();

  constructor(initialState = null) {
    this.#state = initialState ? MemoryCieRepository.decode(initialState) : emptyState();
  }

  async transaction(work) {
    const execute = async () => {
      const backup = structuredClone(this.#state);
      try {
        return await work(this);
      } catch (error) {
        this.#state = backup;
        throw error;
      }
    };
    const pending = this.#writeQueue.then(execute, execute);
    this.#writeQueue = pending.catch(() => undefined);
    return pending;
  }

  insertSession(record) {
    invariant(!this.#state.sessions.has(record.id), 409, "SESSION_EXISTS", "Session already exists");
    this.#state.sessions.set(record.id, clone(record));
    return immutableCopy(record);
  }

  getSession(id) {
    const value = this.#state.sessions.get(id);
    return value ? immutableCopy(value) : null;
  }

  appendConsent(record) {
    invariant(!this.#state.consentReceipts.has(record.id), 409, "CONSENT_RECEIPT_EXISTS", "Consent receipt already exists");
    if (record.supersedes_receipt_id) {
      const prior = this.#state.consentReceipts.get(record.supersedes_receipt_id);
      invariant(prior && prior.session_id === record.session_id && prior.purpose === record.purpose, 409, "CONSENT_SUPERSESSION_INVALID", "Consent supersession target is invalid");
    }
    this.#state.consentReceipts.set(record.id, clone(record));
    return immutableCopy(record);
  }

  getConsentReceipt(id) {
    const value = this.#state.consentReceipts.get(id);
    return value ? immutableCopy(value) : null;
  }

  listConsentReceipts(sessionId) {
    return mapValues(this.#state.consentReceipts).filter((record) => record.session_id === sessionId).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.id.localeCompare(b.id));
  }

  latestConsent(sessionId, purpose) {
    return this.listConsentReceipts(sessionId).filter((record) => record.purpose === purpose).at(-1) || null;
  }

  appendTrackItem(record) {
    const key = `${record.track_item_id}:${record.item_revision}`;
    invariant(!this.#state.trackItems.has(key), 409, "TRACK_REVISION_EXISTS", "Track revision already exists");
    if (record.item_revision === 1) {
      invariant(record.supersedes_item_revision === null, 409, "TRACK_SUPERSESSION_INVALID", "First track revision cannot supersede another revision");
    } else {
      invariant(record.supersedes_item_revision === record.item_revision - 1, 409, "TRACK_SUPERSESSION_INVALID", "Track revisions must be contiguous");
      invariant(this.#state.trackItems.has(`${record.track_item_id}:${record.supersedes_item_revision}`), 409, "TRACK_SUPERSESSION_MISSING", "Superseded track revision does not exist");
    }
    this.#state.trackItems.set(key, clone(record));
    return immutableCopy(record);
  }

  listTrackItems(sessionId, options = {}) {
    const from = options.fromMs ?? 0;
    const to = options.toMs ?? Number.MAX_SAFE_INTEGER;
    const latest = new Map();
    for (const record of this.#state.trackItems.values()) {
      if (record.session_id !== sessionId || record.t0_ms > to || record.t1_ms < from) continue;
      const current = latest.get(record.track_item_id);
      if (!current || record.item_revision > current.item_revision) latest.set(record.track_item_id, record);
    }
    return [...latest.values()].map(clone).sort((a, b) => a.t0_ms - b.t0_ms || a.t1_ms - b.t1_ms || a.track_item_id.localeCompare(b.track_item_id) || a.item_revision - b.item_revision);
  }

  insertSkillSnapshot(record) {
    const existing = [...this.#state.skillSnapshots.values()].find((value) => value.skill_id === record.skill_id && value.skill_version === record.skill_version);
    if (existing) {
      invariant(existing.content_hash === record.content_hash, 409, "SNAPSHOT_VERSION_CONFLICT", "Skill version already exists with different content");
      return immutableCopy(existing);
    }
    this.#state.skillSnapshots.set(record.id, clone(record));
    return immutableCopy(record);
  }

  getSkillSnapshot(id) {
    const value = this.#state.skillSnapshots.get(id);
    return value ? immutableCopy(value) : null;
  }

  replacePriorities(record, expectedRowVersion = null) {
    const current = this.#state.priorities.get(record.session_id);
    if (expectedRowVersion !== null) invariant(current?.row_version === expectedRowVersion, 409, "ROW_VERSION_CONFLICT", "Priority selection changed since it was read");
    const next = { ...clone(record), row_version: (current?.row_version || 0) + 1 };
    this.#state.priorities.set(record.session_id, next);
    return immutableCopy(next);
  }

  getPriorities(sessionId) {
    const value = this.#state.priorities.get(sessionId);
    return value ? immutableCopy(value) : null;
  }

  insertMoment(record) {
    invariant(!this.#state.moments.has(record.id), 409, "MOMENT_EXISTS", "Moment already exists");
    this.#state.moments.set(record.id, clone(record));
    return immutableCopy(record);
  }

  getMoment(id) {
    const value = this.#state.moments.get(id);
    return value ? immutableCopy(value) : null;
  }

  listMoments(sessionId) {
    return mapValues(this.#state.moments).filter((record) => record.session_id === sessionId).sort((a, b) => a.t0_ms - b.t0_ms || a.id.localeCompare(b.id));
  }

  insertOpportunity(record) {
    invariant(!this.#state.opportunities.has(record.id), 409, "OPPORTUNITY_EXISTS", "Opportunity already exists");
    this.#state.opportunities.set(record.id, clone(record));
    return immutableCopy(record);
  }

  getOpportunity(id) {
    const value = this.#state.opportunities.get(id);
    return value ? immutableCopy(value) : null;
  }

  listOpportunities(sessionId) {
    return mapValues(this.#state.opportunities).filter((record) => record.session_id === sessionId).sort((a, b) => a.t0_ms - b.t0_ms || a.id.localeCompare(b.id));
  }

  appendAudit(record) {
    invariant(!this.#state.auditEvents.some((entry) => entry.id === record.id), 409, "AUDIT_EVENT_EXISTS", "Audit event already exists");
    this.#state.auditEvents.push(clone(record));
    return immutableCopy(record);
  }

  listAudit(sessionId) {
    return this.#state.auditEvents.filter((record) => record.session_id === sessionId).map(clone);
  }

  beginMutation(record) {
    const key = `${record.owner_user_id}:${record.operation}:${record.idempotency_key}`;
    const existing = this.#state.mutationReceipts.get(key);
    if (existing) {
      invariant(existing.request_hash === record.request_hash, 409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was used for different content");
      return { replay: existing.state === "completed", receipt: immutableCopy(existing), response: clone(existing.response) };
    }
    this.#state.mutationReceipts.set(key, clone(record));
    return { replay: false, receipt: immutableCopy(record), response: null };
  }

  completeMutation(ownerUserId, operation, idempotencyKey, response) {
    const key = `${ownerUserId}:${operation}:${idempotencyKey}`;
    const existing = this.#state.mutationReceipts.get(key);
    invariant(existing, 500, "MUTATION_RECEIPT_MISSING", "Mutation receipt is missing");
    const completed = { ...existing, state: "completed", response: clone(response) };
    this.#state.mutationReceipts.set(key, completed);
    return immutableCopy(completed);
  }

  exportState() {
    return {
      format: "missionmed.cie.repository.v1",
      sessions: mapValues(this.#state.sessions),
      consent_receipts: mapValues(this.#state.consentReceipts),
      track_items: mapValues(this.#state.trackItems),
      skill_snapshots: mapValues(this.#state.skillSnapshots),
      priorities: mapValues(this.#state.priorities),
      moments: mapValues(this.#state.moments),
      opportunities: mapValues(this.#state.opportunities),
      audit_events: this.#state.auditEvents.map(clone),
      mutation_receipts: mapValues(this.#state.mutationReceipts)
    };
  }

  static decode(serialized) {
    invariant(serialized?.format === "missionmed.cie.repository.v1", 500, "REPOSITORY_FORMAT_INVALID", "Repository format is invalid");
    const state = emptyState();
    for (const record of serialized.sessions || []) state.sessions.set(record.id, clone(record));
    for (const record of serialized.consent_receipts || []) state.consentReceipts.set(record.id, clone(record));
    for (const record of serialized.track_items || []) state.trackItems.set(`${record.track_item_id}:${record.item_revision}`, clone(record));
    for (const record of serialized.skill_snapshots || []) state.skillSnapshots.set(record.id, clone(record));
    for (const record of serialized.priorities || []) state.priorities.set(record.session_id, clone(record));
    for (const record of serialized.moments || []) state.moments.set(record.id, clone(record));
    for (const record of serialized.opportunities || []) state.opportunities.set(record.id, clone(record));
    state.auditEvents = (serialized.audit_events || []).map(clone);
    for (const record of serialized.mutation_receipts || []) state.mutationReceipts.set(`${record.owner_user_id}:${record.operation}:${record.idempotency_key}`, clone(record));
    return state;
  }
}

export function requireFound(value, code, message) {
  if (!value) throw new CieError(404, code, message);
  return value;
}
