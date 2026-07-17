import { randomUUID } from "node:crypto";
import { immutableCopy, sha256 } from "./canonical.mjs";
import { hasCapability, normalizeAuthContext, requireCapability, requireOwner } from "./authz.mjs";
import {
  validateConsentReceiptInput,
  validateConsentPolicy,
  validateMomentInput,
  validateOpportunityInput,
  validatePriorityInput,
  validateSessionInput,
  validateSkillSnapshotInput,
  validateTrackItemInput,
  validateVisibilityGrantInput
} from "./contracts.mjs";
import { CieError, invariant } from "./errors.mjs";
import { createMutationEnvelope } from "./mutation.mjs";
import { requireActiveCapability } from "./capabilities.mjs";
import { requireFound } from "./repository/memoryRepository.mjs";
import { createReplaySyncManifest } from "./replaySync.mjs";

const LOCAL_DELETION_CLASSES = Object.freeze([
  "visibility_grants",
  "opportunities",
  "moments",
  "track_items",
  "session_priorities",
  "consent_receipts",
  "mutation_receipts",
  "future_derived_artifacts"
]);
const DELETION_CLASSES = Object.freeze([...LOCAL_DELETION_CLASSES, "cam_media_revision", "audit_finalization"]);

function encodeCursor(snapshotEventSeq, item) {
  return Buffer.from(JSON.stringify({
    snapshot_event_seq: snapshotEventSeq,
    tuple: [item.t0_ms, item.t1_ms, item.track_item_id, item.item_revision]
  }), "utf8").toString("base64url");
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    invariant(parsed && typeof parsed === "object" && Number.isSafeInteger(parsed.snapshot_event_seq) && parsed.snapshot_event_seq >= 0 && Array.isArray(parsed.tuple) && parsed.tuple.length === 4, 400, "CURSOR_INVALID", "Timeline cursor is invalid");
    return parsed;
  } catch (error) {
    if (error instanceof CieError) throw error;
    throw new CieError(400, "CURSOR_INVALID", "Timeline cursor is invalid");
  }
}

function afterCursor(item, cursorTuple) {
  if (!cursorTuple) return true;
  const tuple = [item.t0_ms, item.t1_ms, item.track_item_id, item.item_revision];
  for (let index = 0; index < tuple.length; index += 1) {
    if (tuple[index] > cursorTuple[index]) return true;
    if (tuple[index] < cursorTuple[index]) return false;
  }
  return false;
}

export class CieService {
  #repository;
  #now;
  #uuid;
  #consentPolicy;
  #externalDeletionProofVerifier;
  #authorityAdapter;

  constructor(repository, options = {}) {
    invariant(typeof options.authorityAdapter?.accepts === "function", 500, "AUTHORITY_ADAPTER_REQUIRED", "CIE service requires one pinned MissionMed authority adapter");
    this.#repository = repository;
    this.#now = options.now || (() => new Date());
    this.#uuid = options.uuid || randomUUID;
    this.#consentPolicy = options.consentPolicy || null;
    this.#externalDeletionProofVerifier = options.externalDeletionProofVerifier || null;
    this.#authorityAdapter = options.authorityAdapter;
  }

  #timestamp() {
    return this.#now().toISOString();
  }

  #timestampAfter(value) {
    const floor = value ? Date.parse(value) + 1 : Number.NEGATIVE_INFINITY;
    return new Date(Math.max(this.#now().getTime(), floor)).toISOString();
  }

  #activeSession(store, sessionId) {
    const session = requireFound(store.getSession(sessionId), "RESOURCE_UNAVAILABLE", "This resource is not available");
    invariant(!["DELETING", "DELETED"].includes(session.state), 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
    return session;
  }

  #auth(input) {
    const auth = normalizeAuthContext(input);
    invariant(this.#authorityAdapter.accepts(auth), 401, "AUTH_AUTHORITY_MISMATCH", "The principal was not issued by this CIE authority boundary");
    return auth;
  }

  #author(auth) {
    return { subject_id: auth.subject_id, role: auth.role };
  }

  #segment(session, segmentId, mediaRevisionRef, t0Ms, t1Ms, rangeKind) {
    const segment = session.clock.segments.find((entry) => entry.segment_id === segmentId);
    invariant(segment && segment.media_revision_ref === mediaRevisionRef, 409, "MEDIA_SEGMENT_BINDING_INVALID", "Artifact does not match the sealed media segment");
    invariant(t0Ms >= segment.global_t0_ms && t1Ms <= segment.global_t1_ms, 422, "TIME_RANGE_OUTSIDE_SEGMENT", "Artifact range is outside its sealed media segment");
    if (rangeKind === "POINT") invariant(t0Ms === t1Ms && t0Ms < segment.global_t1_ms, 400, "POINT_RANGE_INVALID", "Point artifact range is invalid");
    else invariant(t1Ms > t0Ms && t0Ms < segment.global_t1_ms, 400, "SPAN_RANGE_INVALID", "Span artifact range is invalid");
    return segment;
  }

  #assertConsent(store, sessionId, purpose, receiptIds = []) {
    const receipt = store.latestConsent(sessionId, purpose);
    invariant(receipt?.granted === true, 409, "CONSENT_REQUIRED", `Active ${purpose} consent is required`);
    invariant(!receipt.expires_at || Date.parse(receipt.expires_at) > this.#now().getTime(), 409, "CONSENT_EXPIRED", `${purpose} consent has expired`);
    invariant(receiptIds.includes(receipt.id), 409, "CONSENT_RECEIPT_STALE", `Artifact must reference the latest ${purpose} consent receipt`);
    return receipt;
  }

  #assertVisibilityConsent(store, sessionId, visibility, receiptIds) {
    if (visibility === "mentor") this.#assertConsent(store, sessionId, "mentor_sharing", receiptIds);
    if (visibility === "showcase") this.#assertConsent(store, sessionId, "showcase_sharing", receiptIds);
  }

  #grantConsentPurpose(scope) {
    if (scope === "showcase") return "showcase_sharing";
    if (scope === "physiology") return "physiology_storage";
    return "mentor_sharing";
  }

  #grantIsLive(store, grant) {
    if (!grant || grant.revoked_at) return false;
    const now = this.#now().getTime();
    if (grant.expires_at && Date.parse(grant.expires_at) <= now) return false;
    const purpose = this.#grantConsentPurpose(grant.scope);
    const latest = store.latestConsent(grant.session_id, purpose);
    return Boolean(latest?.granted && latest.id === grant.consent_receipt_id && (!latest.expires_at || Date.parse(latest.expires_at) > now));
  }

  #findGrant(store, auth, session, request) {
    const grant = store.findActiveVisibilityGrant(session.id, auth.subject_id, request, this.#now().getTime());
    return this.#grantIsLive(store, grant) ? grant : null;
  }

  #requireReviewAuthority(store, auth, session, request) {
    invariant(auth.role === "mentor", 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
    invariant(request?.artifactType && request?.artifactId, 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
    const grant = this.#findGrant(store, auth, session, { ...request, scope: "review" });
    invariant(grant, 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
    return "mentor";
  }

  #audit(store, auth, sessionId, eventType, resourceType, resourceId, envelope, payload = {}) {
    return store.appendAudit({
      id: this.#uuid(),
      session_id: sessionId,
      owner_user_id: store.getSession(sessionId)?.owner_user_id || auth.subject_id,
      actor_user_id: auth.subject_id,
      event_type: eventType,
      resource_type: resourceType,
      resource_id: resourceId,
      request_id: envelope.request_id,
      correlation_id: envelope.correlation_id,
      payload,
      occurred_at: this.#timestamp(),
      contract_version: "cie.audit-event.v1"
    });
  }

  async #mutate(authInput, operation, payload, meta, work) {
    const auth = this.#auth(authInput);
    const envelope = createMutationEnvelope(meta, payload);
    return this.#repository.transaction(async (store) => {
      const initialSessionId = payload?.sessionId || (payload?.jobId ? store.getDeletionJob(payload.jobId)?.session_id : null) || null;
      const mutation = store.beginMutation({
        owner_user_id: auth.subject_id,
        operation,
        idempotency_key: envelope.idempotency_key,
        request_hash: envelope.request_hash,
        request_id: envelope.request_id,
        correlation_id: envelope.correlation_id,
        causation_id: envelope.causation_id,
        session_id: initialSessionId,
        state: "accepted",
        response: null,
        response_hash: null,
        redacted_at: null,
        created_at: this.#timestamp(),
        updated_at: this.#timestamp()
      });
      if (mutation.replay) {
        if (mutation.receipt.redacted_at || mutation.response === null) {
          const deletionOperations = new Set(["request_session_deletion", "run_local_deletion", "record_external_deletion_proof"]);
          invariant(deletionOperations.has(operation), 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
          const job = payload?.jobId ? store.getDeletionJob(payload.jobId) : store.getDeletionJobBySession(mutation.receipt.session_id);
          invariant(job && (auth.subject_id === job.owner_user_id || hasCapability(auth, "cie:deletion:work")), 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
          return immutableCopy({ job, steps: store.listDeletionSteps(job.id) });
        }
        return immutableCopy(mutation.response);
      }
      const result = await work(store, auth, envelope);
      const completedSessionId = initialSessionId || (operation === "create_session" ? result?.id : null) || result?.session_id || result?.job?.session_id || null;
      store.completeMutation(auth.subject_id, operation, envelope.idempotency_key, result, completedSessionId, this.#timestamp());
      return immutableCopy(result);
    });
  }

  async createSession(authInput, input, meta) {
    return this.#mutate(authInput, "create_session", input, meta, (store, auth, envelope) => {
      invariant(auth.role === "student" || hasCapability(auth, "cie:session:create"), 403, "SESSION_CREATE_FORBIDDEN", "Session creation requires a student or integration capability");
      const validated = validateSessionInput(input);
      const record = {
        id: this.#uuid(),
        owner_user_id: auth.subject_id,
        ...validated,
        state: "DRAFT",
        created_at: this.#timestamp(),
        row_version: 1
      };
      store.insertSession(record);
      this.#audit(store, auth, record.id, "cie.session.created", "session", record.id, envelope, { external_session_ref_hash: sha256(record.external_session_ref) });
      return record;
    });
  }

  async recordConsent(authInput, sessionId, input, meta) {
    return this.#mutate(authInput, "record_consent", { sessionId, input }, meta, async (store, auth, envelope) => {
      const session = this.#activeSession(store, sessionId);
      requireOwner(auth, session.owner_user_id);
      const validated = validateConsentReceiptInput(input);
      invariant(typeof this.#consentPolicy === "function", 503, "CONSENT_POLICY_UNAVAILABLE", "Consent policy authority is unavailable");
      const policy = validateConsentPolicy(await this.#consentPolicy({ purpose: validated.purpose, session_id: session.id, owner_user_id: session.owner_user_id }));
      const latest = store.latestConsent(session.id, validated.purpose);
      if (latest) {
        invariant(validated.supersedes_receipt_id === latest.id, 409, "CONSENT_SUPERSESSION_REQUIRED", "Consent change must supersede the latest receipt");
      }
      const recordedAt = this.#timestampAfter(latest?.recorded_at);
      if (validated.expires_at) invariant(Date.parse(validated.expires_at) > Date.parse(recordedAt), 400, "CONSENT_EXPIRY_INVALID", "Consent expiry must follow the server-recorded consent time");
      const record = {
        id: this.#uuid(),
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        receipt_revision: (latest?.receipt_revision || 0) + 1,
        ...validated,
        ...policy,
        authority_ref: auth.authority_ref,
        authority_session_ref: auth.authority_session_ref,
        recorded_at: recordedAt,
        created_at: this.#timestamp()
      };
      store.appendConsent(record);
      this.#audit(store, auth, session.id, validated.granted ? "cie.consent.granted" : "cie.consent.withdrawn", "consent_receipt", record.id, envelope, { purpose: record.purpose });
      return record;
    });
  }

  async importSkillSnapshot(authInput, ownerUserId, input, meta) {
    return this.#mutate(authInput, "import_skill_snapshot", { ownerUserId, input }, meta, (store, auth, envelope) => {
      requireCapability(auth, "cie:skill-snapshot:import");
      const validated = validateSkillSnapshotInput(input);
      const record = {
        id: this.#uuid(),
        owner_user_id: ownerUserId,
        ...validated,
        imported_by: auth.subject_id,
        created_at: this.#timestamp()
      };
      const stored = store.insertSkillSnapshot(record);
      store.appendAudit({
        id: this.#uuid(),
        session_id: null,
        owner_user_id: ownerUserId,
        actor_user_id: auth.subject_id,
        event_type: "cie.skill_snapshot.imported",
        resource_type: "skill_snapshot",
        resource_id: stored.id,
        request_id: envelope.request_id,
        correlation_id: envelope.correlation_id,
        payload: { skill_id: stored.skill_id, skill_version: stored.skill_version, content_hash: stored.content_hash },
        occurred_at: this.#timestamp(),
        contract_version: "cie.audit-event.v1"
      });
      return stored;
    });
  }

  async setPriorities(authInput, sessionId, input, meta) {
    return this.#mutate(authInput, "set_priorities", { sessionId, input }, meta, (store, auth, envelope) => {
      const session = this.#activeSession(store, sessionId);
      const validated = validatePriorityInput(input);
      if (!hasCapability(auth, "cie:priority:write")) {
        const reviewMoment = requireFound(store.getMoment(validated.review_moment_id), "RESOURCE_UNAVAILABLE", "This resource is not available");
        invariant(reviewMoment.session_id === session.id, 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
        this.#requireReviewAuthority(store, auth, session, { artifactType: "moment", artifactId: reviewMoment.id });
      }
      const snapshots = [validated.spotlight_snapshot_id, validated.supporting_snapshot_id].filter(Boolean).map((id) => requireFound(store.getSkillSnapshot(id), "SKILL_SNAPSHOT_NOT_FOUND", "Skill snapshot is not available"));
      invariant(snapshots.every((snapshot) => snapshot.owner_user_id === session.owner_user_id), 409, "SKILL_SNAPSHOT_OWNER_MISMATCH", "Priority snapshots must belong to the session owner");
      const consent = this.#assertConsent(store, session.id, "evidence_storage", input.consent_receipt_ids || []);
      const current = store.getPriorities(session.id);
      if (current) invariant(envelope.expected_row_version !== null, 428, "ROW_VERSION_REQUIRED", "Updating priorities requires If-Match row version");
      else invariant(envelope.expected_row_version === null, 409, "ROW_VERSION_UNEXPECTED", "Initial priorities cannot carry a stale row version");
      const firstSegment = session.clock.segments[0];
      const trackItemId = current?.track_item_id || this.#uuid();
      const itemRevision = (current?.track_item_revision || 0) + 1;
      const base = {
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        track_item_id: trackItemId,
        item_revision: itemRevision,
        supersedes_item_revision: itemRevision === 1 ? null : itemRevision - 1,
        event_seq: store.allocateEventSeq(session.id),
        segment_id: firstSegment.segment_id,
        media_revision_ref: firstSegment.media_revision_ref,
        kind: "priority",
        range_kind: "POINT",
        t0_ms: firstSegment.global_t0_ms,
        t1_ms: firstSegment.global_t0_ms,
        payload_schema_version: "cie.priority-set.v1",
        payload: { ...validated, student_visible: true },
        provenance: {
          tier: "L4",
          badge: "MISSIONMED",
          statement: "One Spotlight and one Supporting skill define the next-rep focus.",
          evidence_refs: [],
          simulated: false,
          numeric_value: null,
          unit: null,
          algorithm_id: null,
          algorithm_version: null,
          limitations: null,
          framework: null,
          evidence_tier: null,
          doctrine_ref: "CIE-A4-ONE-THING-AT-A-TIME",
          method_status: "not_applicable"
        },
        author: this.#author(auth),
        visibility: "private",
        consent_receipt_ids: [consent.id],
        contract_version: "cie.track-item.v1",
        created_at: this.#timestamp()
      };
      const trackRecord = { ...base, content_hash: sha256(base) };
      store.appendTrackItem(trackRecord);
      const priorities = store.replacePriorities({
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        ...validated,
        spotlight_lifecycle: "ACTIVE_SPOTLIGHT",
        supporting_lifecycle: validated.supporting_snapshot_id ? "CONSOLIDATING" : null,
        track_item_id: trackItemId,
        track_item_revision: itemRevision,
        consent_receipt_id: consent.id,
        contract_version: "cie.priority-set.v1",
        updated_at: this.#timestamp()
      }, envelope.expected_row_version);
      this.#audit(store, auth, session.id, "cie.priorities.activated", "priority_set", session.id, envelope, { row_version: priorities.row_version });
      return { priorities, track_item: trackRecord };
    });
  }

  async appendTrackItem(authInput, sessionId, input, meta) {
    return this.#mutate(authInput, "append_track_item", { sessionId, input }, meta, (store, auth, envelope) => {
      const session = this.#activeSession(store, sessionId);
      invariant(auth.subject_id === session.owner_user_id || hasCapability(auth, "cie:track:write"), 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
      const authorRole = auth.subject_id === session.owner_user_id ? "student" : auth.role;
      const validated = validateTrackItemInput(input, { authorRole, sourceKind: "human" });
      invariant(["event", "text"].includes(validated.kind), 409, "TRACK_KIND_INACTIVE", "Generic C0 writes accept human event or text tracks only");
      invariant(validated.provenance.tier === "L1", 409, "CLAIM_RUNG_WRITE_FORBIDDEN", "Generic C0 writes accept replay-verifiable human observations only");
      this.#segment(session, validated.segment_id, validated.media_revision_ref, validated.t0_ms, validated.t1_ms, validated.range_kind);
      this.#assertConsent(store, session.id, "evidence_storage", validated.consent_receipt_ids);
      this.#assertVisibilityConsent(store, session.id, validated.visibility, validated.consent_receipt_ids);
      const base = {
        ...validated,
        track_item_id: validated.track_item_id || this.#uuid(),
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        event_seq: store.allocateEventSeq(session.id),
        author: this.#author(auth),
        created_at: this.#timestamp()
      };
      const record = { ...base, content_hash: sha256(base) };
      store.appendTrackItem(record);
      this.#audit(store, auth, session.id, "cie.track_item.appended", "track_item", record.track_item_id, envelope, { item_revision: record.item_revision, event_seq: record.event_seq });
      return record;
    });
  }

  async createMoment(authInput, sessionId, input, meta) {
    return this.#mutate(authInput, "create_moment", { sessionId, input }, meta, (store, auth, envelope) => {
      const session = this.#activeSession(store, sessionId);
      const authorRole = auth.subject_id === session.owner_user_id ? "student" : auth.role;
      const validated = validateMomentInput(input, { authorRole, sourceKind: "human" });
      if (authorRole === "mentor") {
        const sourceMoment = requireFound(store.getMoment(validated.review_source_moment_id), "RESOURCE_UNAVAILABLE", "This resource is not available");
        invariant(sourceMoment.session_id === session.id && sourceMoment.source === "student" && sourceMoment.t0_ms <= validated.t0_ms && sourceMoment.t1_ms >= validated.t1_ms, 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
        this.#requireReviewAuthority(store, auth, session, { artifactType: "moment", artifactId: sourceMoment.id });
      } else {
        invariant(authorRole === "student", 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
        invariant(validated.review_source_moment_id === null, 400, "MOMENT_REVIEW_SOURCE_INVALID", "Student Moments cannot claim a mentor review source");
      }
      this.#segment(session, validated.segment_id, validated.media_revision_ref, validated.t0_ms, validated.t1_ms, "SPAN");
      this.#assertConsent(store, session.id, "evidence_storage", validated.consent_receipt_ids);
      this.#assertVisibilityConsent(store, session.id, validated.visibility, validated.consent_receipt_ids);
      const snapshots = validated.skill_snapshot_ids.map((id) => requireFound(store.getSkillSnapshot(id), "SKILL_SNAPSHOT_NOT_FOUND", "Skill snapshot is not available"));
      invariant(snapshots.every((snapshot) => snapshot.owner_user_id === session.owner_user_id), 409, "SKILL_SNAPSHOT_OWNER_MISMATCH", "Moment skill snapshots must belong to the session owner");
      const momentId = this.#uuid();
      const trackItemId = this.#uuid();
      const author = this.#author(auth);
      const momentBase = {
        id: momentId,
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        track_item_id: trackItemId,
        track_item_revision: 1,
        ...validated,
        author,
        created_at: this.#timestamp()
      };
      const moment = { ...momentBase, content_hash: sha256(momentBase), deep_link: `/review/${session.id}/${momentId}` };
      const trackBase = {
        track_item_id: trackItemId,
        item_revision: 1,
        supersedes_item_revision: null,
        event_seq: store.allocateEventSeq(session.id),
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        segment_id: validated.segment_id,
        media_revision_ref: validated.media_revision_ref,
        kind: "moment",
        range_kind: "SPAN",
        t0_ms: validated.t0_ms,
        t1_ms: validated.t1_ms,
        payload_schema_version: "cie.moment.v1",
        payload: { moment_id: momentId, type: moment.type, label: moment.label, skill_snapshot_ids: moment.skill_snapshot_ids, student_visible: true },
        provenance: validated.provenance,
        author,
        visibility: validated.visibility,
        consent_receipt_ids: validated.consent_receipt_ids,
        contract_version: "cie.track-item.v1",
        created_at: moment.created_at
      };
      const trackItem = { ...trackBase, content_hash: sha256(trackBase) };
      store.appendTrackItem(trackItem);
      store.insertMoment(moment);
      this.#audit(store, auth, session.id, "cie.moment.created", "moment", moment.id, envelope, { track_item_id: trackItemId });
      return { moment, track_item: trackItem };
    });
  }

  async createOpportunity(authInput, sessionId, input, meta) {
    return this.#mutate(authInput, "create_opportunity", { sessionId, input }, meta, (store, auth, envelope) => {
      const session = this.#activeSession(store, sessionId);
      invariant(auth.role === "mentor", 403, "OPPORTUNITY_MENTOR_REQUIRED", "Only a verified mentor may create an Opportunity");
      const validated = validateOpportunityInput(input, { authorRole: "mentor", sourceKind: "human" });
      requireActiveCapability("mentor_manual_opportunity");
      this.#segment(session, validated.segment_id, validated.media_revision_ref, validated.t0_ms, validated.t1_ms, "SPAN");
      this.#assertConsent(store, session.id, "evidence_storage", validated.consent_receipt_ids);
      this.#assertConsent(store, session.id, "mentor_sharing", validated.consent_receipt_ids);
      const selfMoment = store.listMoments(session.id).find((moment) => moment.source === "student" && moment.t0_ms <= validated.t0_ms && moment.t1_ms >= validated.t1_ms);
      invariant(selfMoment, 409, "SELF_FIRST_MOMENT_REQUIRED", "A student-authored Moment covering the evidence range is required first");
      this.#requireReviewAuthority(store, auth, session, { artifactType: "moment", artifactId: selfMoment.id });
      invariant(validated.evidence_claim.evidence_refs.includes(selfMoment.id), 409, "OPPORTUNITY_EVIDENCE_REF_INVALID", "Opportunity evidence claim must reference the covering student Moment");
      invariant(validated.coaching_claim.evidence_refs.includes(selfMoment.id), 409, "OPPORTUNITY_COACHING_REF_INVALID", "Opportunity coaching claim must reference the covering student Moment");
      const snapshot = requireFound(store.getSkillSnapshot(validated.skill_snapshot_id), "SKILL_SNAPSHOT_NOT_FOUND", "Skill snapshot is not available");
      invariant(snapshot.owner_user_id === session.owner_user_id, 409, "SKILL_SNAPSHOT_OWNER_MISMATCH", "Opportunity skill snapshot must belong to the session owner");
      const priorities = requireFound(store.getPriorities(session.id), "PRIORITY_SET_REQUIRED", "A current priority set is required");
      invariant([priorities.spotlight_snapshot_id, priorities.supporting_snapshot_id].includes(snapshot.id), 409, "OPPORTUNITY_OUTSIDE_PRIORITY", "C0 Opportunities must reference the active Spotlight or Supporting skill");
      const opportunityId = this.#uuid();
      const trackItemId = this.#uuid();
      const createdAt = this.#timestamp();
      const author = this.#author(auth);
      const opportunityBase = {
        id: opportunityId,
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        track_item_id: trackItemId,
        track_item_revision: 1,
        source_moment_id: selfMoment.id,
        ...validated,
        status_history: [{ status: "approved", source: "mentor-manual", reviewer_id: auth.subject_id, at: createdAt }],
        reviewer: author,
        student_visible: false,
        created_at: createdAt
      };
      const opportunity = { ...opportunityBase, content_hash: sha256(opportunityBase) };
      const trackBase = {
        track_item_id: trackItemId,
        item_revision: 1,
        supersedes_item_revision: null,
        event_seq: store.allocateEventSeq(session.id),
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        segment_id: validated.segment_id,
        media_revision_ref: validated.media_revision_ref,
        kind: "opportunity",
        range_kind: "SPAN",
        t0_ms: validated.t0_ms,
        t1_ms: validated.t1_ms,
        payload_schema_version: "cie.opportunity.v1",
        payload: { opportunity_id: opportunityId, source_moment_id: selfMoment.id, type: opportunity.type, skill_snapshot_id: opportunity.skill_snapshot_id, student_visible: false },
        provenance: validated.coaching_claim,
        author,
        visibility: "mentor",
        consent_receipt_ids: validated.consent_receipt_ids,
        contract_version: "cie.track-item.v1",
        created_at: createdAt
      };
      const trackItem = { ...trackBase, content_hash: sha256(trackBase) };
      store.appendTrackItem(trackItem);
      store.insertOpportunity(opportunity);
      this.#audit(store, auth, session.id, "cie.opportunity.created", "opportunity", opportunity.id, envelope, { track_item_id: trackItemId });
      return { opportunity, track_item: trackItem };
    });
  }

  async grantAccess(authInput, sessionId, input, meta) {
    return this.#mutate(authInput, "grant_access", { sessionId, input }, meta, (store, auth, envelope) => {
      const session = this.#activeSession(store, sessionId);
      requireOwner(auth, session.owner_user_id);
      const validated = validateVisibilityGrantInput(input);
      invariant(validated.grantee_user_id !== session.owner_user_id, 400, "VISIBILITY_SELF_GRANT_INVALID", "Owner access does not require a visibility grant");
      const purpose = this.#grantConsentPurpose(validated.scope);
      const consent = this.#assertConsent(store, session.id, purpose, [validated.consent_receipt_id]);
      if (validated.artifact_type === "moment") {
        const moment = requireFound(store.getMoment(validated.artifact_id), "RESOURCE_UNAVAILABLE", "This resource is not available");
        invariant(moment.session_id === session.id, 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
        invariant((validated.scope === "review" && moment.visibility === "mentor") || (validated.scope === "showcase" && moment.visibility === "showcase"), 409, "VISIBILITY_STATE_MISMATCH", "Moment visibility does not permit this grant");
      } else {
        const item = store.listTrackItems(session.id).find((entry) => entry.track_item_id === validated.artifact_id);
        invariant(item, 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
        invariant(validated.scope === "physiology" && item.kind === "physio", 409, "VISIBILITY_STATE_MISMATCH", "Track grant scope does not match the artifact");
      }
      if (validated.expires_at) invariant(Date.parse(validated.expires_at) > this.#now().getTime(), 400, "VISIBILITY_EXPIRY_INVALID", "Visibility grant must expire in the future");
      const issuedAt = this.#timestamp();
      const base = {
        id: this.#uuid(),
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        ...validated,
        consent_receipt_id: consent.id,
        authority_ref: auth.authority_ref,
        authority_session_ref: auth.authority_session_ref,
        issued_at: issuedAt,
        revoked_at: null,
        row_version: 1
      };
      const grant = { ...base, content_hash: sha256(base) };
      store.insertVisibilityGrant(grant);
      this.#audit(store, auth, session.id, "cie.visibility.granted", "visibility_grant", grant.id, envelope, { artifact_type: grant.artifact_type, artifact_id: grant.artifact_id, scope: grant.scope });
      return grant;
    });
  }

  async revokeAccess(authInput, sessionId, grantId, meta) {
    return this.#mutate(authInput, "revoke_access", { sessionId, grantId }, meta, (store, auth, envelope) => {
      const session = this.#activeSession(store, sessionId);
      requireOwner(auth, session.owner_user_id);
      const grant = requireFound(store.getVisibilityGrant(grantId), "RESOURCE_UNAVAILABLE", "This resource is not available");
      invariant(grant.session_id === session.id, 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
      invariant(envelope.expected_row_version !== null, 428, "ROW_VERSION_REQUIRED", "Revoking access requires If-Match row version");
      const revoked = store.revokeVisibilityGrant(grant.id, session.owner_user_id, envelope.expected_row_version, this.#timestampAfter(grant.issued_at));
      this.#audit(store, auth, session.id, "cie.visibility.revoked", "visibility_grant", grant.id, envelope, { row_version: revoked.row_version });
      return revoked;
    });
  }

  async requestSessionDeletion(authInput, sessionId, meta) {
    return this.#mutate(authInput, "request_session_deletion", { sessionId }, meta, (store, auth, envelope) => {
      const session = requireFound(store.getSession(sessionId), "RESOURCE_UNAVAILABLE", "This resource is not available");
      requireOwner(auth, session.owner_user_id);
      invariant(!["DELETING", "DELETED"].includes(session.state), 409, "DELETION_ALREADY_REQUESTED", "Session deletion is already active or complete");
      invariant(envelope.expected_row_version !== null, 428, "ROW_VERSION_REQUIRED", "Session deletion requires If-Match row version");
      const requestedAt = this.#timestamp();
      const job = {
        id: this.#uuid(),
        session_id: session.id,
        owner_user_id: session.owner_user_id,
        state: "TOMBSTONED",
        request_hash: envelope.request_hash,
        idempotency_key: envelope.idempotency_key,
        row_version: 1,
        requested_at: requestedAt,
        completed_at: null,
        contract_version: "cie.deletion-job.v1"
      };
      store.insertDeletionJob(job, DELETION_CLASSES);
      const revokedGrants = store.revokeAllVisibilityGrants(session.id, requestedAt);
      store.updateSessionState(session.id, envelope.expected_row_version, "DELETING");
      this.#audit(store, auth, session.id, "cie.deletion.requested", "deletion_job", job.id, envelope, { revoked_grants: revokedGrants });
      return { job, steps: store.listDeletionSteps(job.id) };
    });
  }

  async runLocalDeletion(authInput, jobId, meta) {
    return this.#mutate(authInput, "run_local_deletion", { jobId }, meta, (store, auth, envelope) => {
      requireCapability(auth, "cie:deletion:work");
      const job = requireFound(store.getDeletionJob(jobId), "DELETION_JOB_NOT_FOUND", "Deletion job was not found");
      invariant(["TOMBSTONED", "CLEANUP_PENDING", "FAILED_RETRYABLE"].includes(job.state), 409, "DELETION_STATE_INVALID", "Deletion job cannot run from its current state");
      const verifiedAt = this.#timestamp();
      const counts = store.purgeSessionArtifacts(job.session_id, verifiedAt);
      for (const resourceClass of LOCAL_DELETION_CLASSES) {
        const proof = resourceClass === "future_derived_artifacts"
          ? { verified_absent: true, active_future_capabilities: 0, authority_ref: "cie-capability-registry-v1" }
          : resourceClass === "mutation_receipts"
            ? { verified_redacted: true, redacted_response_count: counts[resourceClass] || 0, authority_ref: "cie-local-store-v1" }
          : { verified_absent: true, removed_count: counts[resourceClass] || 0, authority_ref: "cie-local-store-v1" };
        store.verifyDeletionStep(job.id, resourceClass, proof, sha256(proof), verifiedAt, resourceClass === "mutation_receipts" ? "VERIFIED_REDACTED" : "VERIFIED_ABSENT");
      }
      const updated = store.updateDeletionJob(job.id, job.row_version, "CLEANUP_PENDING");
      this.#audit(store, auth, job.session_id, "cie.deletion.local_cleanup_verified", "deletion_job", job.id, envelope, { resource_classes: LOCAL_DELETION_CLASSES });
      return { job: updated, steps: store.listDeletionSteps(job.id) };
    });
  }

  async recordExternalDeletionProof(authInput, jobId, resourceClass, proofInput, meta) {
    return this.#mutate(authInput, "record_external_deletion_proof", { jobId, resourceClass, proofInput }, meta, async (store, auth, envelope) => {
      requireCapability(auth, "cie:deletion:work");
      invariant(resourceClass === "cam_media_revision", 400, "DELETION_RESOURCE_INVALID", "Only the adopted CAM media boundary may submit external C0 proof");
      const job = requireFound(store.getDeletionJob(jobId), "DELETION_JOB_NOT_FOUND", "Deletion job was not found");
      invariant(job.state !== "COMPLETE", 409, "DELETION_STATE_INVALID", "Deletion job is already complete");
      invariant(proofInput?.authority_ref === undefined && proofInput?.authority_session_ref === undefined && proofInput?.checked_at === undefined && proofInput?.verified_absent === undefined && proofInput?.provider_receipt_hash === undefined, 400, "DELETION_PROOF_SERVER_FIELD_FORBIDDEN", "Deletion proof authority, result, hash, and time are server-owned");
      invariant(typeof this.#externalDeletionProofVerifier === "function", 503, "DELETION_PROOF_VERIFIER_UNAVAILABLE", "The adopted provider deletion verifier is unavailable");
      const attestation = await this.#externalDeletionProofVerifier({ auth, job, resourceClass, providerReceipt: proofInput?.provider_receipt });
      invariant(attestation?.verified_absent === true, 409, "DELETION_ABSENCE_NOT_VERIFIED", "The adopted provider boundary did not verify absence");
      invariant(/^[a-f0-9]{64}$/u.test(String(attestation.provider_receipt_hash || "")), 502, "DELETION_RECEIPT_HASH_INVALID", "The adopted provider deletion receipt hash is invalid");
      const proof = {
        verified_absent: true,
        authority_ref: auth.authority_ref,
        authority_session_ref: auth.authority_session_ref,
        checked_at: this.#timestamp(),
        provider: String(attestation.provider || "adopted-cam-media-boundary"),
        provider_receipt_hash: attestation.provider_receipt_hash
      };
      store.verifyDeletionStep(job.id, resourceClass, proof, sha256(proof), this.#timestamp());
      let current = store.getDeletionJob(job.id);
      let steps = store.listDeletionSteps(job.id);
      const nonAuditComplete = steps.filter((step) => step.resource_class !== "audit_finalization").every((step) => step.resource_class === "mutation_receipts" ? step.state === "VERIFIED_REDACTED" : step.state === "VERIFIED_ABSENT");
      if (nonAuditComplete) {
        this.#audit(store, auth, job.session_id, "cie.deletion.completed", "deletion_job", job.id, envelope, { proof_hashes: steps.filter((step) => step.proof_hash).map((step) => step.proof_hash) });
        const auditProof = { verified_preserved: true, authority_ref: "cie-append-only-audit-v1", event_type: "cie.deletion.completed" };
        store.verifyDeletionStep(job.id, "audit_finalization", auditProof, sha256(auditProof), this.#timestamp(), "VERIFIED_PRESERVED");
        steps = store.listDeletionSteps(job.id);
        invariant(steps.every((step) => step.resource_class === "audit_finalization" ? step.state === "VERIFIED_PRESERVED" : step.resource_class === "mutation_receipts" ? step.state === "VERIFIED_REDACTED" : step.state === "VERIFIED_ABSENT"), 409, "DELETION_CLOSURE_INCOMPLETE", "Deletion closure is incomplete");
        current = store.updateDeletionJob(job.id, current.row_version, "COMPLETE", { completed_at: this.#timestamp() });
        const session = requireFound(store.getSession(job.session_id), "SESSION_NOT_FOUND", "Session was not found");
        store.redactDeletedSession(session.id, session.row_version, this.#timestamp());
      }
      return { job: current, steps };
    });
  }

  getDeletionStatus(authInput, jobId) {
    const auth = this.#auth(authInput);
    const job = requireFound(this.#repository.getDeletionJob(jobId), "RESOURCE_UNAVAILABLE", "This resource is not available");
    invariant(auth.subject_id === job.owner_user_id || hasCapability(auth, "cie:deletion:work"), 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
    return immutableCopy({ job, steps: this.#repository.listDeletionSteps(job.id) });
  }

  #itemReadable(store, auth, session, item, audience) {
    if (auth.subject_id === session.owner_user_id) {
      if (audience === "student" && item.kind === "opportunity" && item.payload?.student_visible !== true) return false;
      return true;
    }
    if (item.visibility === "private") return false;
    const scope = item.kind === "physio" ? "physiology" : (item.visibility === "showcase" ? "showcase" : "review");
    let artifactType = "track_item";
    let artifactId = item.track_item_id;
    if (item.kind === "moment") {
      artifactType = "moment";
      artifactId = item.payload.moment_id;
    } else if (item.kind === "opportunity") {
      const opportunity = store.getOpportunity(item.payload?.opportunity_id);
      if (!opportunity || opportunity.reviewer?.subject_id !== auth.subject_id || opportunity.reviewer?.role !== "mentor") return false;
      artifactType = "moment";
      artifactId = item.payload.source_moment_id;
    }
    if (!this.#findGrant(store, auth, session, { scope, artifactType, artifactId })) return false;
    const purpose = item.kind === "physio" ? "physiology_storage" : (item.visibility === "showcase" ? "showcase_sharing" : "mentor_sharing");
    const consent = store.latestConsent(session.id, purpose);
    return Boolean(consent?.granted && (!consent.expires_at || Date.parse(consent.expires_at) > this.#now().getTime()) && item.consent_receipt_ids.includes(consent.id));
  }

  listTimeline(authInput, sessionId, options = {}) {
    const auth = this.#auth(authInput);
    const session = this.#activeSession(this.#repository, sessionId);
    if (auth.subject_id !== session.owner_user_id) {
      const anyGrant = this.#repository.listVisibilityGrants(session.id, { granteeUserId: auth.subject_id }).some((grant) => this.#grantIsLive(this.#repository, grant));
      invariant(anyGrant, 404, "RESOURCE_UNAVAILABLE", "This resource is not available");
    }
    const fromMs = Number(options.fromMs ?? 0);
    const toMs = Number(options.toMs ?? Number.MAX_SAFE_INTEGER);
    invariant(Number.isSafeInteger(fromMs) && fromMs >= 0 && Number.isSafeInteger(toMs) && toMs >= fromMs, 400, "TIMELINE_RANGE_INVALID", "Timeline query range is invalid");
    const limit = Math.min(200, Math.max(1, Number(options.limit || 50)));
    invariant(Number.isSafeInteger(limit), 400, "TIMELINE_LIMIT_INVALID", "Timeline limit is invalid");
    const cursor = decodeCursor(options.cursor);
    const snapshotEventSeq = cursor?.snapshot_event_seq ?? this.#repository.currentEventSeq(session.id);
    const readable = this.#repository.listTrackItems(session.id, { fromMs, toMs, maxEventSeq: snapshotEventSeq })
      .filter((item) => afterCursor(item, cursor?.tuple || null))
      .filter((item) => this.#itemReadable(this.#repository, auth, session, item, auth.subject_id === session.owner_user_id ? "student" : "reviewer"));
    const page = readable.slice(0, limit);
    return immutableCopy({
      items: page.map((item) => ({
        ...item,
        semantic_projection: {
          type: item.kind,
          range: item.range_kind === "POINT" ? `${item.t0_ms} ms` : `${item.t0_ms}-${item.t1_ms} ms`,
          author_role: item.author.role,
          claim_badge: item.provenance.simulation_badge ? `${item.provenance.simulation_badge} · ${item.provenance.badge}` : item.provenance.badge,
          limitations: item.provenance.limitations,
          visibility: item.visibility,
          gap_state: item.provenance.missing_gap_state || null
        }
      })),
      next_cursor: readable.length > limit ? encodeCursor(snapshotEventSeq, page.at(-1)) : null,
      snapshot_event_seq: snapshotEventSeq,
      partial: false
    });
  }

  resolveMomentLink(authInput, sessionId, momentId) {
    const auth = this.#auth(authInput);
    const unavailable = () => { throw new CieError(404, "RESOURCE_UNAVAILABLE", "This resource is not available"); };
    const session = this.#repository.getSession(sessionId);
    const moment = this.#repository.getMoment(momentId);
    if (!session || ["DELETING", "DELETED"].includes(session.state) || !moment || moment.session_id !== session.id) return unavailable();
    let readGrant = null;
    try {
      if (auth.subject_id !== session.owner_user_id) {
        if (moment.visibility === "private") return unavailable();
        const scope = moment.visibility === "showcase" ? "showcase" : "review";
        readGrant = this.#findGrant(this.#repository, auth, session, { scope, artifactType: "moment", artifactId: moment.id });
        if (!readGrant) return unavailable();
        const purpose = moment.visibility === "showcase" ? "showcase_sharing" : "mentor_sharing";
        const consent = this.#repository.latestConsent(session.id, purpose);
        if (!consent?.granted || (consent.expires_at && Date.parse(consent.expires_at) <= this.#now().getTime()) || !moment.consent_receipt_ids.includes(consent.id)) return unavailable();
      }
    } catch {
      return unavailable();
    }
    const manifest = createReplaySyncManifest(session, [{
      member_id: moment.id,
      segment_id: moment.segment_id,
      media_revision_ref: moment.media_revision_ref,
      t0_ms: moment.t0_ms,
      t1_ms: moment.t1_ms,
      content_hash: moment.content_hash
    }]);
    return immutableCopy({
      state: "READY",
      session: { id: session.id, mode_ref: session.mode_ref, clock_hash: session.clock.content_hash },
      moment,
      priorities: auth.subject_id === session.owner_user_id ? this.#repository.getPriorities(session.id) : null,
      replay: {
        manifest,
        seek_to_ms: manifest.members[0].media_t0_ms,
        stop_at_ms: manifest.members[0].media_t1_ms,
        playback_capability: null,
        capability_note: "Playback authority is issued by the adopted CAM media boundary, not CIE."
      }
    });
  }
}
