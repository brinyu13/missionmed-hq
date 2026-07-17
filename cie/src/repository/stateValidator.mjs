import { sha256, stableJson } from "../canonical.mjs";
import {
  CONSENT_PURPOSES,
  CONTRACT_VERSION,
  GRANT_ARTIFACT_TYPES,
  GRANT_SCOPES,
  validateMomentInput,
  validateOpportunityInput,
  validatePriorityInput,
  validateSkillSnapshotInput,
  validateTrackItemInput
} from "../contracts.mjs";
import { validateSessionClockContract } from "../clock.mjs";
import { invariant } from "../errors.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HASH = /^[a-f0-9]{64}$/u;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/u;
const SESSION_STATES = new Set(["DRAFT", "CAPTURING", "SEALED", "DELETING", "DELETED"]);
const DELETION_CLASSES = new Set([
  "visibility_grants", "opportunities", "moments", "track_items", "session_priorities",
  "consent_receipts", "mutation_receipts", "future_derived_artifacts", "cam_media_revision",
  "audit_finalization"
]);
const DELETION_STATES = new Set(["PENDING", "VERIFIED_ABSENT", "VERIFIED_PRESERVED", "VERIFIED_REDACTED", "FAILED_RETRYABLE"]);
const TOP_LEVEL_FIELDS = Object.freeze([
  "format", "sessions", "consent_receipts", "track_items", "skill_snapshots", "priorities",
  "moments", "opportunities", "visibility_grants", "deletion_jobs", "deletion_steps",
  "audit_events", "mutation_receipts", "session_event_seq"
]);

function valid(condition, message) {
  invariant(condition, 500, "REPOSITORY_STATE_INVALID", message);
}

function record(value, label) {
  valid(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function uuid(value, label) {
  valid(UUID.test(String(value || "")), `${label} must be a UUID`);
}

function safeRef(value, label) {
  valid(SAFE_REF.test(String(value || "")), `${label} is invalid`);
}

function hash(value, label) {
  valid(HASH.test(String(value || "")), `${label} must be a SHA-256 digest`);
}

function timestamp(value, label, optional = false) {
  if (optional && (value === null || value === undefined)) return;
  const parsed = new Date(value);
  valid(Number.isFinite(parsed.getTime()) && parsed.toISOString() === value, `${label} must be a canonical timestamp`);
}

function positiveInteger(value, label) {
  valid(Number.isSafeInteger(value) && value > 0, `${label} must be a positive safe integer`);
}

function index(records, keyOf, label) {
  const result = new Map();
  for (const value of records) {
    record(value, label);
    const key = keyOf(value);
    valid(typeof key === "string" && key.length > 0 && !result.has(key), `${label} identity is missing or duplicated`);
    result.set(key, value);
  }
  return result;
}

function verifyContentHash(value, label, omitted = []) {
  hash(value.content_hash, `${label} content_hash`);
  const body = { ...value };
  delete body.content_hash;
  for (const field of omitted) delete body[field];
  valid(sha256(body) === value.content_hash, `${label} content hash does not match its canonical body`);
}

function validateAuthor(value, label) {
  record(value, `${label} author`);
  uuid(value.subject_id, `${label} author subject`);
  safeRef(value.role, `${label} author role`);
}

function assertSegment(session, value, label) {
  const segment = session.clock?.segments?.find((entry) => entry.segment_id === value.segment_id);
  valid(segment && segment.media_revision_ref === value.media_revision_ref, `${label} is not bound to its session media segment`);
  valid(Number.isSafeInteger(value.t0_ms) && Number.isSafeInteger(value.t1_ms), `${label} range must use integer milliseconds`);
  valid(value.t0_ms >= segment.global_t0_ms && value.t1_ms <= segment.global_t1_ms, `${label} range is outside its media segment`);
  valid(value.range_kind === "POINT" ? value.t0_ms === value.t1_ms && value.t0_ms < segment.global_t1_ms : value.range_kind === "SPAN" && value.t1_ms > value.t0_ms, `${label} range semantics are invalid`);
}

function assertConsentReferences(value, session, consents, label) {
  valid(Array.isArray(value.consent_receipt_ids), `${label} consent references must be an array`);
  for (const consentId of value.consent_receipt_ids) {
    const consent = consents.get(consentId);
    valid(consent && consent.session_id === session.id && consent.owner_user_id === session.owner_user_id && consent.granted === true, `${label} references an invalid consent receipt`);
  }
}

export function validateSerializedRepository(serialized) {
  record(serialized, "Repository state");
  valid(serialized.format === "missionmed.cie.repository.v1", "Repository format is invalid");
  const fields = Object.keys(serialized).sort();
  valid(stableJson(fields) === stableJson([...TOP_LEVEL_FIELDS].sort()), "Repository field set is invalid");
  for (const field of TOP_LEVEL_FIELDS.filter((entry) => entry !== "format")) valid(Array.isArray(serialized[field]), `Repository ${field} must be an array`);

  const sessions = index(serialized.sessions, (value) => value.id, "Session");
  const externalRefs = new Set();
  for (const session of sessions.values()) {
    uuid(session.id, "Session ID");
    uuid(session.owner_user_id, "Session owner");
    valid(session.contract_version === CONTRACT_VERSION, "Session contract version is invalid");
    valid(SESSION_STATES.has(session.state), "Session state is invalid");
    positiveInteger(session.row_version, "Session row_version");
    timestamp(session.created_at, "Session created_at");
    if (session.state === "DELETED") {
      valid(session.external_session_ref === null && session.mode_ref === null && session.media_revision_ref === null && session.clock === null, "Deleted session retains active evidence fields");
      hash(session.external_session_ref_hash, "Deleted session reference hash");
      hash(session.clock_hash, "Deleted session clock hash");
      timestamp(session.deleted_at, "Deleted session deleted_at");
    } else {
      safeRef(session.external_session_ref, "Session external reference");
      safeRef(session.mode_ref, "Session mode reference");
      if (session.media_revision_ref !== null) safeRef(session.media_revision_ref, "Session media revision");
      validateSessionClockContract(session.clock);
      const externalKey = `${session.owner_user_id}:${session.external_session_ref}`;
      valid(!externalRefs.has(externalKey), "Session external reference is duplicated for its owner");
      externalRefs.add(externalKey);
    }
  }

  const consents = index(serialized.consent_receipts, (value) => value.id, "Consent receipt");
  const consentGroups = new Map();
  for (const consent of consents.values()) {
    uuid(consent.id, "Consent receipt ID");
    uuid(consent.session_id, "Consent session ID");
    uuid(consent.owner_user_id, "Consent owner");
    const session = sessions.get(consent.session_id);
    valid(session && session.owner_user_id === consent.owner_user_id && session.state !== "DELETED", "Consent owner or session binding is invalid");
    valid(consent.contract_version === CONTRACT_VERSION && CONSENT_PURPOSES.includes(consent.purpose), "Consent contract or purpose is invalid");
    valid(typeof consent.granted === "boolean" && consent.scope && typeof consent.scope === "object" && !Array.isArray(consent.scope), "Consent grant or scope is invalid");
    positiveInteger(consent.receipt_revision, "Consent receipt revision");
    hash(consent.policy_text_hash, "Consent policy hash");
    safeRef(consent.policy_version, "Consent policy version");
    safeRef(consent.authority_ref, "Consent authority reference");
    safeRef(consent.authority_session_ref, "Consent authority session reference");
    timestamp(consent.recorded_at, "Consent recorded_at");
    timestamp(consent.created_at, "Consent created_at");
    timestamp(consent.expires_at, "Consent expires_at", true);
    const key = `${consent.session_id}:${consent.purpose}`;
    if (!consentGroups.has(key)) consentGroups.set(key, []);
    consentGroups.get(key).push(consent);
  }
  for (const receipts of consentGroups.values()) {
    receipts.sort((a, b) => a.receipt_revision - b.receipt_revision);
    receipts.forEach((receipt, indexValue) => {
      valid(receipt.receipt_revision === indexValue + 1, "Consent revisions are not contiguous");
      valid(indexValue === 0 ? receipt.supersedes_receipt_id === null : receipt.supersedes_receipt_id === receipts[indexValue - 1].id, "Consent supersession chain is invalid");
    });
  }

  const snapshots = index(serialized.skill_snapshots, (value) => value.id, "Skill snapshot");
  const snapshotVersions = new Set();
  for (const snapshot of snapshots.values()) {
    uuid(snapshot.id, "Skill snapshot ID");
    uuid(snapshot.owner_user_id, "Skill snapshot owner");
    uuid(snapshot.imported_by, "Skill snapshot importer");
    timestamp(snapshot.created_at, "Skill snapshot created_at");
    valid(snapshot.contract_version === CONTRACT_VERSION, "Skill snapshot contract version is invalid");
    const validated = validateSkillSnapshotInput(snapshot);
    valid(validated.content_hash === snapshot.content_hash, "Skill snapshot content hash is invalid");
    const key = `${snapshot.owner_user_id}:${snapshot.skill_id}:${snapshot.skill_version}`;
    valid(!snapshotVersions.has(key), "Skill snapshot semantic version is duplicated");
    snapshotVersions.add(key);
  }

  const tracks = index(serialized.track_items, (value) => `${value.track_item_id}:${value.item_revision}`, "Track item revision");
  const eventKeys = new Set();
  const maximumEventSeq = new Map();
  const trackGroups = new Map();
  for (const track of tracks.values()) {
    const session = sessions.get(track.session_id);
    valid(session && session.state !== "DELETED" && session.owner_user_id === track.owner_user_id, "Track item owner or session binding is invalid");
    uuid(track.owner_user_id, "Track item owner");
    safeRef(track.track_item_id, "Track item ID");
    positiveInteger(track.item_revision, "Track item revision");
    positiveInteger(track.event_seq, "Track item event sequence");
    valid(track.contract_version === "cie.track-item.v1", "Track item contract version is invalid");
    validateAuthor(track.author, "Track item");
    verifyContentHash(track, "Track item");
    const tier = track.provenance?.tier;
    valid(tier !== "L4" || track.kind === "priority", "L4 doctrine is restricted to the priority track boundary");
    validateTrackItemInput(track, {
      authorRole: tier === "L4" ? "integration" : track.author.role,
      sourceKind: "human",
      canAuthorDoctrine: tier === "L4"
    });
    assertSegment(session, track, "Track item");
    assertConsentReferences(track, session, consents, "Track item");
    const eventKey = `${track.session_id}:${track.event_seq}`;
    valid(!eventKeys.has(eventKey), "Track item event sequence is duplicated");
    eventKeys.add(eventKey);
    maximumEventSeq.set(track.session_id, Math.max(maximumEventSeq.get(track.session_id) || 0, track.event_seq));
    if (!trackGroups.has(track.track_item_id)) trackGroups.set(track.track_item_id, []);
    trackGroups.get(track.track_item_id).push(track);
  }
  for (const revisions of trackGroups.values()) {
    revisions.sort((a, b) => a.item_revision - b.item_revision);
    revisions.forEach((item, indexValue) => {
      valid(item.item_revision === indexValue + 1, "Track item revisions are not contiguous");
      valid(indexValue === 0 ? item.supersedes_item_revision === null : item.supersedes_item_revision === revisions[indexValue - 1].item_revision, "Track item supersession chain is invalid");
      if (indexValue > 0) valid(item.session_id === revisions[0].session_id && item.owner_user_id === revisions[0].owner_user_id && item.kind === revisions[0].kind, "Track item identity drifts across revisions");
    });
  }
  const sequenceRows = index(serialized.session_event_seq, (value) => value.session_id, "Session event sequence");
  valid(sequenceRows.size === maximumEventSeq.size, "Session event sequence index is incomplete");
  for (const [sessionId, eventSeq] of maximumEventSeq) valid(sequenceRows.get(sessionId)?.event_seq === eventSeq, "Session event sequence index does not match persisted tracks");

  const moments = index(serialized.moments, (value) => value.id, "Moment");
  for (const moment of moments.values()) {
    uuid(moment.id, "Moment ID");
    uuid(moment.owner_user_id, "Moment owner");
    const session = sessions.get(moment.session_id);
    valid(session && session.state !== "DELETED" && session.owner_user_id === moment.owner_user_id, "Moment owner or session binding is invalid");
    valid(moment.contract_version === CONTRACT_VERSION, "Moment contract version is invalid");
    validateAuthor(moment.author, "Moment");
    valid(moment.author.role === moment.source, "Moment author role does not match its source");
    validateMomentInput(moment, { authorRole: moment.source, sourceKind: "human" });
    assertSegment(session, { ...moment, range_kind: "SPAN" }, "Moment");
    assertConsentReferences(moment, session, consents, "Moment");
    verifyContentHash(moment, "Moment", ["deep_link"]);
    valid(moment.deep_link === `/review/${session.id}/${moment.id}`, "Moment deep link is invalid");
    const track = tracks.get(`${moment.track_item_id}:${moment.track_item_revision}`);
    valid(track && track.kind === "moment" && track.session_id === session.id && track.owner_user_id === session.owner_user_id && track.payload?.moment_id === moment.id && track.t0_ms === moment.t0_ms && track.t1_ms === moment.t1_ms, "Moment track binding is invalid");
    for (const snapshotId of moment.skill_snapshot_ids) valid(snapshots.get(snapshotId)?.owner_user_id === session.owner_user_id, "Moment skill snapshot binding is invalid");
  }
  for (const moment of moments.values()) {
    if (moment.source === "student") valid(moment.review_source_moment_id === null, "Student Moment has a mentor review source");
    else {
      const source = moments.get(moment.review_source_moment_id);
      valid(source && source.source === "student" && source.session_id === moment.session_id && source.t0_ms <= moment.t0_ms && source.t1_ms >= moment.t1_ms, "Mentor Moment review source is invalid");
    }
  }

  const priorities = index(serialized.priorities, (value) => value.session_id, "Priority set");
  for (const priority of priorities.values()) {
    uuid(priority.session_id, "Priority session ID");
    uuid(priority.owner_user_id, "Priority owner");
    const session = sessions.get(priority.session_id);
    valid(session && session.state !== "DELETED" && session.owner_user_id === priority.owner_user_id, "Priority owner or session binding is invalid");
    valid(priority.contract_version === "cie.priority-set.v1", "Priority contract version is invalid");
    validatePriorityInput(priority);
    positiveInteger(priority.row_version, "Priority row_version");
    valid(priority.spotlight_lifecycle === "ACTIVE_SPOTLIGHT" && priority.supporting_lifecycle === "CONSOLIDATING", "Priority lifecycle is invalid");
    valid(snapshots.get(priority.spotlight_snapshot_id)?.owner_user_id === session.owner_user_id && snapshots.get(priority.supporting_snapshot_id)?.owner_user_id === session.owner_user_id, "Priority snapshot binding is invalid");
    if (priority.review_moment_id) valid(moments.get(priority.review_moment_id)?.session_id === session.id, "Priority review Moment binding is invalid");
    const track = tracks.get(`${priority.track_item_id}:${priority.track_item_revision}`);
    valid(track && track.kind === "priority" && track.session_id === session.id && track.payload?.spotlight_snapshot_id === priority.spotlight_snapshot_id && track.payload?.supporting_snapshot_id === priority.supporting_snapshot_id, "Priority track binding is invalid");
    valid(consents.get(priority.consent_receipt_id)?.session_id === session.id, "Priority consent binding is invalid");
  }

  const opportunities = index(serialized.opportunities, (value) => value.id, "Opportunity");
  for (const opportunity of opportunities.values()) {
    uuid(opportunity.id, "Opportunity ID");
    uuid(opportunity.owner_user_id, "Opportunity owner");
    const session = sessions.get(opportunity.session_id);
    valid(session && session.state !== "DELETED" && session.owner_user_id === opportunity.owner_user_id, "Opportunity owner or session binding is invalid");
    valid(opportunity.contract_version === CONTRACT_VERSION, "Opportunity contract version is invalid");
    validateAuthor(opportunity.reviewer, "Opportunity");
    valid(opportunity.reviewer.role === "mentor", "Opportunity reviewer must be a mentor");
    validateOpportunityInput(opportunity, { authorRole: "mentor", sourceKind: "human" });
    assertSegment(session, { ...opportunity, range_kind: "SPAN" }, "Opportunity");
    assertConsentReferences(opportunity, session, consents, "Opportunity");
    verifyContentHash(opportunity, "Opportunity");
    const source = moments.get(opportunity.source_moment_id);
    valid(source && source.source === "student" && source.session_id === session.id && source.t0_ms <= opportunity.t0_ms && source.t1_ms >= opportunity.t1_ms, "Opportunity source Moment is invalid");
    valid(snapshots.get(opportunity.skill_snapshot_id)?.owner_user_id === session.owner_user_id, "Opportunity skill snapshot binding is invalid");
    const priority = priorities.get(session.id);
    valid(priority && [priority.spotlight_snapshot_id, priority.supporting_snapshot_id].includes(opportunity.skill_snapshot_id), "Opportunity is outside the active priority set");
    const track = tracks.get(`${opportunity.track_item_id}:${opportunity.track_item_revision}`);
    valid(track && track.kind === "opportunity" && track.session_id === session.id && track.payload?.opportunity_id === opportunity.id, "Opportunity track binding is invalid");
  }

  const grants = index(serialized.visibility_grants, (value) => value.id, "Visibility grant");
  const activeGrantKeys = new Set();
  for (const grant of grants.values()) {
    uuid(grant.id, "Visibility grant ID");
    uuid(grant.session_id, "Visibility grant session ID");
    uuid(grant.owner_user_id, "Visibility grant owner");
    uuid(grant.grantee_user_id, "Visibility grant grantee");
    const session = sessions.get(grant.session_id);
    valid(session && session.state !== "DELETED" && session.owner_user_id === grant.owner_user_id && grant.grantee_user_id !== grant.owner_user_id, "Visibility grant identity binding is invalid");
    valid(grant.contract_version === "cie.visibility-grant.v1", "Visibility grant contract version is invalid");
    valid(GRANT_SCOPES.includes(grant.scope) && GRANT_ARTIFACT_TYPES.includes(grant.artifact_type), "Visibility grant scope or artifact type is invalid");
    positiveInteger(grant.row_version, "Visibility grant row_version");
    valid((grant.revoked_at === null && grant.row_version === 1) || (grant.revoked_at !== null && grant.row_version === 2), "Visibility grant revocation state is invalid");
    timestamp(grant.issued_at, "Visibility grant issued_at");
    timestamp(grant.expires_at, "Visibility grant expires_at", true);
    timestamp(grant.revoked_at, "Visibility grant revoked_at", true);
    const issuance = { ...grant, revoked_at: null, row_version: 1 };
    verifyContentHash(issuance, "Visibility grant");
    const consent = consents.get(grant.consent_receipt_id);
    const expectedPurpose = grant.scope === "showcase" ? "showcase_sharing" : grant.scope === "physiology" ? "physiology_storage" : "mentor_sharing";
    valid(consent && consent.session_id === session.id && consent.purpose === expectedPurpose && consent.granted === true, "Visibility grant consent binding is invalid");
    if (grant.artifact_type === "moment") {
      const moment = moments.get(grant.artifact_id);
      valid(moment && moment.session_id === session.id && ((grant.scope === "review" && moment.visibility === "mentor") || (grant.scope === "showcase" && moment.visibility === "showcase")), "Visibility grant Moment binding is invalid");
    } else {
      const item = [...tracks.values()].find((entry) => entry.track_item_id === grant.artifact_id && entry.session_id === session.id);
      valid(item && item.kind === "physio" && grant.scope === "physiology", "Visibility grant track binding is invalid");
    }
    if (!grant.revoked_at) {
      const key = `${grant.session_id}:${grant.grantee_user_id}:${grant.scope}:${grant.artifact_type}:${grant.artifact_id}`;
      valid(!activeGrantKeys.has(key), "Active visibility grant is duplicated");
      activeGrantKeys.add(key);
    }
  }

  const deletionJobs = index(serialized.deletion_jobs, (value) => value.id, "Deletion job");
  const deletionSessionKeys = new Set();
  for (const job of deletionJobs.values()) {
    uuid(job.id, "Deletion job ID");
    uuid(job.session_id, "Deletion job session ID");
    uuid(job.owner_user_id, "Deletion job owner");
    const session = sessions.get(job.session_id);
    valid(session && session.owner_user_id === job.owner_user_id && ["DELETING", "DELETED"].includes(session.state), "Deletion job owner or session state is invalid");
    valid(job.contract_version === "cie.deletion-job.v1", "Deletion job contract version is invalid");
    valid(!deletionSessionKeys.has(job.session_id), "Deletion job is duplicated for its session");
    deletionSessionKeys.add(job.session_id);
    hash(job.request_hash, "Deletion job request hash");
    positiveInteger(job.row_version, "Deletion job row_version");
    valid(["TOMBSTONED", "CLEANUP_PENDING", "FAILED_RETRYABLE", "COMPLETE"].includes(job.state), "Deletion job state is invalid");
    timestamp(job.requested_at, "Deletion job requested_at");
    timestamp(job.completed_at, "Deletion job completed_at", true);
    valid((job.state === "COMPLETE") === Boolean(job.completed_at), "Deletion job terminal timestamp is inconsistent");
    valid(job.state === "COMPLETE" ? session.state === "DELETED" : session.state === "DELETING", "Deletion job and session states are inconsistent");
  }

  const deletionSteps = index(serialized.deletion_steps, (value) => `${value.job_id}:${value.resource_class}`, "Deletion step");
  for (const step of deletionSteps.values()) {
    uuid(step.job_id, "Deletion step job ID");
    valid(deletionJobs.has(step.job_id) && DELETION_CLASSES.has(step.resource_class) && step.required === true, "Deletion step job, class, or requirement is invalid");
    valid(DELETION_STATES.has(step.state), "Deletion step state is invalid");
    if (["VERIFIED_ABSENT", "VERIFIED_PRESERVED", "VERIFIED_REDACTED"].includes(step.state)) {
      const expectedState = step.resource_class === "audit_finalization" ? "VERIFIED_PRESERVED" : step.resource_class === "mutation_receipts" ? "VERIFIED_REDACTED" : "VERIFIED_ABSENT";
      valid(step.state === expectedState, "Deletion step verification state contradicts its resource class");
    }
    valid(Number.isSafeInteger(step.attempt) && step.attempt >= 0, "Deletion step attempt is invalid");
    if (["VERIFIED_ABSENT", "VERIFIED_PRESERVED", "VERIFIED_REDACTED"].includes(step.state)) {
      valid(step.proof !== null, "Verified deletion step is missing its proof");
      hash(step.proof_hash, "Deletion step proof hash");
      valid(sha256(step.proof) === step.proof_hash, "Deletion step proof hash does not match its proof");
      timestamp(step.verified_at, "Deletion step verified_at");
    } else valid(step.proof === null && step.proof_hash === null && step.verified_at === null, "Deletion step proof state is inconsistent");
  }
  for (const job of deletionJobs.values()) {
    const classes = new Set([...deletionSteps.values()].filter((step) => step.job_id === job.id).map((step) => step.resource_class));
    valid(classes.size === DELETION_CLASSES.size && [...DELETION_CLASSES].every((entry) => classes.has(entry)), "Deletion job step set is incomplete");
    if (job.state === "COMPLETE") valid([...deletionSteps.values()].filter((step) => step.job_id === job.id).every((step) => ["VERIFIED_ABSENT", "VERIFIED_PRESERVED", "VERIFIED_REDACTED"].includes(step.state)), "Completed deletion job has an unverified step");
  }

  const auditEvents = index(serialized.audit_events, (value) => value.id, "Audit event");
  for (const event of auditEvents.values()) {
    uuid(event.id, "Audit event ID");
    uuid(event.owner_user_id, "Audit event owner");
    uuid(event.actor_user_id, "Audit event actor");
    if (event.session_id !== null) valid(sessions.get(event.session_id)?.owner_user_id === event.owner_user_id, "Audit event session or owner binding is invalid");
    valid(event.contract_version === "cie.audit-event.v1", "Audit event contract version is invalid");
    timestamp(event.occurred_at, "Audit event occurred_at");
    safeRef(event.event_type, "Audit event type");
    safeRef(event.resource_type, "Audit resource type");
    safeRef(event.resource_id, "Audit resource ID");
  }
  for (const job of deletionJobs.values()) {
    if (job.state !== "COMPLETE") continue;
    valid([...auditEvents.values()].some((event) => event.session_id === job.session_id && event.owner_user_id === job.owner_user_id && event.event_type === "cie.deletion.completed" && event.resource_type === "deletion_job" && event.resource_id === job.id), "Completed deletion job is missing its terminal audit event");
  }

  const mutationReceipts = index(serialized.mutation_receipts, (value) => `${value.owner_user_id}:${value.operation}:${value.idempotency_key}`, "Mutation receipt");
  for (const receipt of mutationReceipts.values()) {
    uuid(receipt.owner_user_id, "Mutation receipt owner");
    safeRef(receipt.operation, "Mutation receipt operation");
    safeRef(receipt.idempotency_key, "Mutation receipt idempotency key");
    hash(receipt.request_hash, "Mutation receipt request hash");
    valid(["accepted", "completed"].includes(receipt.state), "Mutation receipt state is invalid");
    if (receipt.session_id !== null) valid(sessions.has(receipt.session_id), "Mutation receipt session is invalid");
    if (receipt.response !== null) {
      hash(receipt.response_hash, "Mutation receipt response hash");
      valid(sha256(receipt.response) === receipt.response_hash && receipt.redacted_at === null, "Mutation receipt response hash or redaction state is invalid");
    } else if (receipt.state === "completed") {
      hash(receipt.response_hash, "Redacted mutation receipt response hash");
      timestamp(receipt.redacted_at, "Mutation receipt redacted_at");
    } else valid(receipt.response_hash === null && receipt.redacted_at === null, "Accepted mutation receipt carries terminal response state");
    timestamp(receipt.created_at, "Mutation receipt created_at");
    timestamp(receipt.updated_at, "Mutation receipt updated_at");
  }

  return serialized;
}
