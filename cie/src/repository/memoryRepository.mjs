import { clone, immutableCopy, sha256 } from "../canonical.mjs";
import { CieError, invariant } from "../errors.mjs";
import { validateSerializedRepository } from "./stateValidator.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LIFECYCLE_TIMESTAMP_FIELDS = Object.freeze([
  "created_at",
  "updated_at",
  "recorded_at",
  "issued_at",
  "revoked_at",
  "requested_at",
  "completed_at",
  "verified_at",
  "redacted_at",
  "deleted_at",
  "occurred_at",
  "checked_at"
]);

function emptyState() {
  return {
    sessions: new Map(),
    consentReceipts: new Map(),
    trackItems: new Map(),
    skillSnapshots: new Map(),
    priorities: new Map(),
    moments: new Map(),
    opportunities: new Map(),
    visibilityGrants: new Map(),
    deletionJobs: new Map(),
    deletionSteps: new Map(),
    auditEvents: [],
    mutationReceipts: new Map(),
    sessionEventSeq: new Map(),
    trackEventSeq: new Set()
  };
}

function mapValues(map) {
  return [...map.values()].map(clone);
}

function readLifecycleTimestampMs(state) {
  const collections = [
    state.sessions.values(),
    state.consentReceipts.values(),
    state.trackItems.values(),
    state.skillSnapshots.values(),
    state.priorities.values(),
    state.moments.values(),
    state.opportunities.values(),
    state.visibilityGrants.values(),
    state.deletionJobs.values(),
    state.deletionSteps.values(),
    state.auditEvents.values(),
    state.mutationReceipts.values()
  ];
  let latest = Number.NEGATIVE_INFINITY;
  for (const records of collections) {
    for (const record of records) {
      for (const field of LIFECYCLE_TIMESTAMP_FIELDS) {
        const parsed = typeof record?.[field] === "string" ? Date.parse(record[field]) : Number.NaN;
        if (Number.isFinite(parsed)) latest = Math.max(latest, parsed);
      }
    }
  }
  return latest;
}

export class MemoryCieRepository {
  #state;
  #writeQueue = Promise.resolve();
  #lifecycleTimestampMs;

  constructor(initialState = null) {
    this.#state = initialState ? MemoryCieRepository.decode(initialState) : emptyState();
    this.#lifecycleTimestampMs = readLifecycleTimestampMs(this.#state);
  }

  async transaction(work) {
    const execute = async () => {
      const backup = structuredClone(this.#state);
      try {
        const result = await work(this);
        this.#lifecycleTimestampMs = readLifecycleTimestampMs(this.#state);
        return result;
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
    invariant(UUID.test(record.id) && UUID.test(record.owner_user_id), 400, "SESSION_IDENTITY_INVALID", "Session and owner identities must be UUIDs");
    invariant(!this.#state.sessions.has(record.id), 409, "SESSION_EXISTS", "Session already exists");
    invariant(![...this.#state.sessions.values()].some((session) => session.owner_user_id === record.owner_user_id && session.external_session_ref === record.external_session_ref), 409, "SESSION_EXTERNAL_REF_EXISTS", "External session reference already exists for this owner");
    this.#state.sessions.set(record.id, clone(record));
    return immutableCopy(record);
  }

  getSession(id) {
    const value = this.#state.sessions.get(id);
    return value ? immutableCopy(value) : null;
  }

  updateSessionState(id, expectedRowVersion, state) {
    const current = this.#state.sessions.get(id);
    invariant(current, 404, "SESSION_NOT_FOUND", "Session was not found");
    invariant(current.row_version === expectedRowVersion, 409, "ROW_VERSION_CONFLICT", "Session changed since it was read");
    const transitions = {
      DRAFT: ["CAPTURING", "SEALED", "DELETING"],
      CAPTURING: ["SEALED", "DELETING"],
      SEALED: ["DELETING"],
      DELETING: ["DELETED"],
      DELETED: []
    };
    invariant(transitions[current.state || "DRAFT"].includes(state), 409, "SESSION_STATE_INVALID", "Session state transition is invalid");
    const next = { ...current, state, row_version: current.row_version + 1 };
    this.#state.sessions.set(id, next);
    return immutableCopy(next);
  }

  redactDeletedSession(id, expectedRowVersion, deletedAt) {
    const current = this.#state.sessions.get(id);
    invariant(current, 404, "SESSION_NOT_FOUND", "Session was not found");
    invariant(current.state === "DELETING" && current.row_version === expectedRowVersion, 409, "SESSION_STATE_INVALID", "Only the current deleting session may be redacted");
    const next = {
      ...current,
      external_session_ref_hash: sha256(current.external_session_ref),
      clock_hash: current.clock?.content_hash || sha256(current.clock),
      external_session_ref: null,
      mode_ref: null,
      media_revision_ref: null,
      clock: null,
      state: "DELETED",
      deleted_at: deletedAt,
      row_version: current.row_version + 1
    };
    this.#state.sessions.set(id, next);
    return immutableCopy(next);
  }

  appendConsent(record) {
    invariant(!this.#state.consentReceipts.has(record.id), 409, "CONSENT_RECEIPT_EXISTS", "Consent receipt already exists");
    if (record.supersedes_receipt_id) {
      const prior = this.#state.consentReceipts.get(record.supersedes_receipt_id);
      invariant(prior && prior.session_id === record.session_id && prior.purpose === record.purpose, 409, "CONSENT_SUPERSESSION_INVALID", "Consent supersession target is invalid");
    }
    const latest = this.latestConsent(record.session_id, record.purpose);
    invariant(record.receipt_revision === (latest?.receipt_revision || 0) + 1, 409, "CONSENT_REVISION_INVALID", "Consent revisions must be contiguous");
    if (latest) invariant(record.supersedes_receipt_id === latest.id, 409, "CONSENT_SUPERSESSION_INVALID", "Consent must supersede the latest receipt");
    this.#state.consentReceipts.set(record.id, clone(record));
    return immutableCopy(record);
  }

  getConsentReceipt(id) {
    const value = this.#state.consentReceipts.get(id);
    return value ? immutableCopy(value) : null;
  }

  listConsentReceipts(sessionId) {
    return mapValues(this.#state.consentReceipts).filter((record) => record.session_id === sessionId).sort((a, b) => a.receipt_revision - b.receipt_revision || a.id.localeCompare(b.id));
  }

  latestConsent(sessionId, purpose) {
    return this.listConsentReceipts(sessionId).filter((record) => record.purpose === purpose).at(-1) || null;
  }

  appendTrackItem(record) {
    const session = this.#state.sessions.get(record.session_id);
    invariant(session && session.owner_user_id === record.owner_user_id, 409, "TRACK_SESSION_OWNER_MISMATCH", "Track item owner must match its session owner");
    invariant(Number.isSafeInteger(record.event_seq) && record.event_seq > 0, 409, "TRACK_EVENT_SEQUENCE_INVALID", "Track item event sequence is invalid");
    const eventKey = `${record.session_id}:${record.event_seq}`;
    invariant(!this.#state.trackEventSeq.has(eventKey), 409, "TRACK_EVENT_SEQUENCE_EXISTS", "Track item event sequence already exists");
    const key = `${record.track_item_id}:${record.item_revision}`;
    invariant(!this.#state.trackItems.has(key), 409, "TRACK_REVISION_EXISTS", "Track revision already exists");
    if (record.item_revision === 1) {
      invariant(record.supersedes_item_revision === null, 409, "TRACK_SUPERSESSION_INVALID", "First track revision cannot supersede another revision");
    } else {
      invariant(record.supersedes_item_revision === record.item_revision - 1, 409, "TRACK_SUPERSESSION_INVALID", "Track revisions must be contiguous");
      const prior = this.#state.trackItems.get(`${record.track_item_id}:${record.supersedes_item_revision}`);
      invariant(prior, 409, "TRACK_SUPERSESSION_MISSING", "Superseded track revision does not exist");
      invariant(prior.session_id === record.session_id && prior.owner_user_id === record.owner_user_id && prior.kind === record.kind, 409, "TRACK_IDENTITY_DRIFT", "A track revision cannot change session, owner, or kind");
    }
    this.#state.trackItems.set(key, clone(record));
    this.#state.trackEventSeq.add(eventKey);
    if (record.event_seq > (this.#state.sessionEventSeq.get(record.session_id) || 0)) this.#state.sessionEventSeq.set(record.session_id, record.event_seq);
    return immutableCopy(record);
  }

  allocateEventSeq(sessionId) {
    invariant(this.#state.sessions.has(sessionId), 404, "SESSION_NOT_FOUND", "Session was not found");
    const next = (this.#state.sessionEventSeq.get(sessionId) || 0) + 1;
    this.#state.sessionEventSeq.set(sessionId, next);
    return next;
  }

  currentEventSeq(sessionId) {
    invariant(this.#state.sessions.has(sessionId), 404, "SESSION_NOT_FOUND", "Session was not found");
    return this.#state.sessionEventSeq.get(sessionId) || 0;
  }

  getTrackItem(trackItemId, itemRevision) {
    const value = this.#state.trackItems.get(`${trackItemId}:${itemRevision}`);
    return value ? immutableCopy(value) : null;
  }

  listTrackItems(sessionId, options = {}) {
    const from = options.fromMs ?? 0;
    const to = options.toMs ?? Number.MAX_SAFE_INTEGER;
    const maxEventSeq = options.maxEventSeq ?? Number.MAX_SAFE_INTEGER;
    const latest = new Map();
    for (const record of this.#state.trackItems.values()) {
      if (record.session_id !== sessionId) continue;
      if (record.event_seq > maxEventSeq) continue;
      const intersects = record.t0_ms === record.t1_ms
        ? record.t0_ms >= from && record.t0_ms < to
        : record.t0_ms < to && record.t1_ms > from;
      if (!intersects) continue;
      const current = latest.get(record.track_item_id);
      if (!current || record.item_revision > current.item_revision) latest.set(record.track_item_id, record);
    }
    return [...latest.values()].map(clone).sort((a, b) => a.t0_ms - b.t0_ms || a.t1_ms - b.t1_ms || a.track_item_id.localeCompare(b.track_item_id) || a.item_revision - b.item_revision);
  }

  insertSkillSnapshot(record) {
    const existing = [...this.#state.skillSnapshots.values()].find((value) => value.owner_user_id === record.owner_user_id && value.skill_id === record.skill_id && value.skill_version === record.skill_version);
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

  listSkillSnapshots(ownerUserId) {
    return mapValues(this.#state.skillSnapshots).filter((record) => record.owner_user_id === ownerUserId).sort((a, b) => a.skill_id.localeCompare(b.skill_id) || a.publication_seq - b.publication_seq);
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

  insertVisibilityGrant(record) {
    const session = this.#state.sessions.get(record.session_id);
    invariant(session && session.owner_user_id === record.owner_user_id, 409, "GRANT_SESSION_OWNER_MISMATCH", "Visibility grant owner must match its session owner");
    invariant(!this.#state.visibilityGrants.has(record.id), 409, "VISIBILITY_GRANT_EXISTS", "Visibility grant already exists");
    const duplicate = [...this.#state.visibilityGrants.values()].find((grant) => grant.session_id === record.session_id
      && grant.grantee_user_id === record.grantee_user_id
      && grant.scope === record.scope
      && grant.artifact_type === record.artifact_type
      && grant.artifact_id === record.artifact_id
      && !grant.revoked_at);
    invariant(!duplicate, 409, "VISIBILITY_GRANT_ACTIVE", "An unrevoked visibility grant already exists");
    this.#state.visibilityGrants.set(record.id, clone(record));
    return immutableCopy(record);
  }

  getVisibilityGrant(id) {
    const value = this.#state.visibilityGrants.get(id);
    return value ? immutableCopy(value) : null;
  }

  listVisibilityGrants(sessionId, options = {}) {
    return mapValues(this.#state.visibilityGrants)
      .filter((record) => record.session_id === sessionId)
      .filter((record) => !options.granteeUserId || record.grantee_user_id === options.granteeUserId)
      .sort((a, b) => a.issued_at.localeCompare(b.issued_at) || a.id.localeCompare(b.id));
  }

  findActiveVisibilityGrant(sessionId, granteeUserId, request, now = Date.now()) {
    return this.listVisibilityGrants(sessionId, { granteeUserId }).find((grant) => {
      if (grant.scope !== request.scope || grant.revoked_at) return false;
      if (grant.expires_at && Date.parse(grant.expires_at) <= now) return false;
      return grant.artifact_type === request.artifactType && grant.artifact_id === request.artifactId;
    }) || null;
  }

  revokeVisibilityGrant(id, ownerUserId, expectedRowVersion, revokedAt) {
    const current = this.#state.visibilityGrants.get(id);
    invariant(current && current.owner_user_id === ownerUserId, 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
    invariant(current.row_version === expectedRowVersion, 409, "ROW_VERSION_CONFLICT", "Visibility grant changed since it was read");
    if (current.revoked_at) return immutableCopy(current);
    const next = { ...current, revoked_at: revokedAt, row_version: current.row_version + 1 };
    this.#state.visibilityGrants.set(id, next);
    return immutableCopy(next);
  }

  revokeAllVisibilityGrants(sessionId, revokedAt) {
    let count = 0;
    for (const [id, current] of this.#state.visibilityGrants.entries()) {
      if (current.session_id !== sessionId || current.revoked_at) continue;
      this.#state.visibilityGrants.set(id, { ...current, revoked_at: revokedAt, row_version: current.row_version + 1 });
      count += 1;
    }
    return count;
  }

  insertDeletionJob(record, resourceClasses) {
    invariant(!this.#state.deletionJobs.has(record.id), 409, "DELETION_JOB_EXISTS", "Deletion job already exists");
    invariant(![...this.#state.deletionJobs.values()].some((job) => job.session_id === record.session_id), 409, "DELETION_JOB_ACTIVE", "A deletion job already exists for this session");
    this.#state.deletionJobs.set(record.id, clone(record));
    for (const resourceClass of resourceClasses) {
      const key = `${record.id}:${resourceClass}`;
      this.#state.deletionSteps.set(key, {
        job_id: record.id,
        resource_class: resourceClass,
        required: true,
        state: "PENDING",
        attempt: 0,
        proof_hash: null,
        proof: null,
        verified_at: null,
        normalized_error: null
      });
    }
    return immutableCopy(record);
  }

  getDeletionJob(id) {
    const value = this.#state.deletionJobs.get(id);
    return value ? immutableCopy(value) : null;
  }

  getDeletionJobBySession(sessionId) {
    const value = [...this.#state.deletionJobs.values()].find((job) => job.session_id === sessionId);
    return value ? immutableCopy(value) : null;
  }

  listDeletionSteps(jobId) {
    return mapValues(this.#state.deletionSteps).filter((step) => step.job_id === jobId).sort((a, b) => a.resource_class.localeCompare(b.resource_class));
  }

  verifyDeletionStep(jobId, resourceClass, proof, proofHash, verifiedAt, verifiedState = "VERIFIED_ABSENT") {
    invariant(["VERIFIED_ABSENT", "VERIFIED_PRESERVED", "VERIFIED_REDACTED"].includes(verifiedState), 500, "DELETION_VERIFICATION_STATE_INVALID", "Deletion verification state is invalid");
    const key = `${jobId}:${resourceClass}`;
    const current = this.#state.deletionSteps.get(key);
    invariant(current, 404, "DELETION_STEP_NOT_FOUND", "Deletion step was not found");
    if (["VERIFIED_ABSENT", "VERIFIED_PRESERVED", "VERIFIED_REDACTED"].includes(current.state)) {
      invariant(current.state === verifiedState && current.proof_hash === proofHash, 409, "DELETION_PROOF_CONFLICT", "Deletion step already has different proof");
      return immutableCopy(current);
    }
    const next = {
      ...current,
      state: verifiedState,
      attempt: current.attempt + 1,
      proof_hash: proofHash,
      proof: clone(proof),
      verified_at: verifiedAt,
      normalized_error: null
    };
    this.#state.deletionSteps.set(key, next);
    return immutableCopy(next);
  }

  updateDeletionJob(id, expectedRowVersion, state, values = {}) {
    const current = this.#state.deletionJobs.get(id);
    invariant(current, 404, "DELETION_JOB_NOT_FOUND", "Deletion job was not found");
    invariant(current.row_version === expectedRowVersion, 409, "ROW_VERSION_CONFLICT", "Deletion job changed since it was read");
    const next = { ...current, ...clone(values), state, row_version: current.row_version + 1 };
    this.#state.deletionJobs.set(id, next);
    return immutableCopy(next);
  }

  redactSessionMutationReceipts(sessionId, redactedAt) {
    let count = 0;
    for (const [key, current] of this.#state.mutationReceipts.entries()) {
      if (current.session_id !== sessionId || current.response === null) continue;
      this.#state.mutationReceipts.set(key, {
        ...current,
        response_hash: current.response_hash || sha256(current.response),
        response: null,
        redacted_at: redactedAt
      });
      count += 1;
    }
    return count;
  }

  purgeSessionArtifacts(sessionId, redactedAt) {
    const counts = {};
    const purge = (map, predicate) => {
      let count = 0;
      for (const [key, value] of map.entries()) {
        if (!predicate(value)) continue;
        map.delete(key);
        count += 1;
      }
      return count;
    };
    counts.visibility_grants = purge(this.#state.visibilityGrants, (value) => value.session_id === sessionId);
    counts.opportunities = purge(this.#state.opportunities, (value) => value.session_id === sessionId);
    counts.moments = purge(this.#state.moments, (value) => value.session_id === sessionId);
    counts.track_items = purge(this.#state.trackItems, (value) => value.session_id === sessionId);
    for (const key of this.#state.trackEventSeq) if (key.startsWith(`${sessionId}:`)) this.#state.trackEventSeq.delete(key);
    this.#state.sessionEventSeq.delete(sessionId);
    counts.session_priorities = this.#state.priorities.delete(sessionId) ? 1 : 0;
    counts.consent_receipts = purge(this.#state.consentReceipts, (value) => value.session_id === sessionId);
    counts.mutation_receipts = this.redactSessionMutationReceipts(sessionId, redactedAt);
    return counts;
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

  listMutationReceipts(sessionId) {
    return mapValues(this.#state.mutationReceipts).filter((record) => record.session_id === sessionId);
  }

  latestLifecycleTimestampMs() {
    return this.#lifecycleTimestampMs;
  }

  completeMutation(ownerUserId, operation, idempotencyKey, response, sessionId, completedAt) {
    const key = `${ownerUserId}:${operation}:${idempotencyKey}`;
    const existing = this.#state.mutationReceipts.get(key);
    invariant(existing, 500, "MUTATION_RECEIPT_MISSING", "Mutation receipt is missing");
    const session = sessionId ? this.#state.sessions.get(sessionId) : null;
    const shouldRedact = Boolean(session && ["DELETING", "DELETED"].includes(session.state));
    const completed = {
      ...existing,
      session_id: sessionId || existing.session_id || null,
      state: "completed",
      response_hash: sha256(response),
      response: shouldRedact ? null : clone(response),
      redacted_at: shouldRedact ? completedAt : null,
      updated_at: completedAt
    };
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
      visibility_grants: mapValues(this.#state.visibilityGrants),
      deletion_jobs: mapValues(this.#state.deletionJobs),
      deletion_steps: mapValues(this.#state.deletionSteps),
      audit_events: this.#state.auditEvents.map(clone),
      mutation_receipts: mapValues(this.#state.mutationReceipts),
      session_event_seq: [...this.#state.sessionEventSeq.entries()].map(([session_id, event_seq]) => ({ session_id, event_seq }))
    };
  }

  static decode(serialized) {
    validateSerializedRepository(serialized);
    const state = emptyState();
    for (const record of serialized.sessions || []) state.sessions.set(record.id, clone(record));
    for (const record of serialized.consent_receipts || []) state.consentReceipts.set(record.id, clone(record));
    for (const record of serialized.track_items || []) {
      state.trackItems.set(`${record.track_item_id}:${record.item_revision}`, clone(record));
      state.trackEventSeq.add(`${record.session_id}:${record.event_seq}`);
      if (record.event_seq > (state.sessionEventSeq.get(record.session_id) || 0)) state.sessionEventSeq.set(record.session_id, record.event_seq);
    }
    for (const record of serialized.skill_snapshots || []) state.skillSnapshots.set(record.id, clone(record));
    for (const record of serialized.priorities || []) state.priorities.set(record.session_id, clone(record));
    for (const record of serialized.moments || []) state.moments.set(record.id, clone(record));
    for (const record of serialized.opportunities || []) state.opportunities.set(record.id, clone(record));
    for (const record of serialized.visibility_grants || []) state.visibilityGrants.set(record.id, clone(record));
    for (const record of serialized.deletion_jobs || []) state.deletionJobs.set(record.id, clone(record));
    for (const record of serialized.deletion_steps || []) state.deletionSteps.set(`${record.job_id}:${record.resource_class}`, clone(record));
    state.auditEvents = (serialized.audit_events || []).map(clone);
    for (const record of serialized.mutation_receipts || []) state.mutationReceipts.set(`${record.owner_user_id}:${record.operation}:${record.idempotency_key}`, clone(record));
    for (const record of serialized.session_event_seq || []) if (record.event_seq > (state.sessionEventSeq.get(record.session_id) || 0)) state.sessionEventSeq.set(record.session_id, record.event_seq);
    return state;
  }
}

export function requireFound(value, code, message) {
  if (!value) throw new CieError(404, code, message);
  return value;
}
