import { sha256, stableValue } from "./canonical.mjs";
import { invariant } from "./errors.mjs";
import { validateSessionClockContract } from "./clock.mjs";

export const CONTRACT_VERSION = "cie.c0.v1";
export const TRACK_KINDS = Object.freeze(["media_ref", "derived_signal", "event", "text", "physio", "moment", "opportunity", "priority", "snapshot_ref"]);
export const VISIBILITIES = Object.freeze(["private", "mentor", "showcase"]);
export const CLAIM_BADGES = Object.freeze({
  L0: "MEASURED",
  L1: "OBSERVED_ON_REPLAY",
  L2: "COACHING_FRAMEWORK",
  L3: "MENTOR",
  L4: "MISSIONMED"
});
export const CONSENT_PURPOSES = Object.freeze(["evidence_storage", "mentor_sharing", "showcase_sharing", "physiology_storage"]);
export const OPPORTUNITY_TYPES = Object.freeze([
  "missed_acknowledgment",
  "missed_empathy_statement",
  "missed_teach_back",
  "missed_clarifying_question",
  "missed_summary",
  "missed_shared_goal",
  "missed_agreement",
  "missed_story",
  "missed_direct_answer",
  "missed_warning_shot",
  "missed_closed_loop",
  "missed_audience_adjusted_explanation",
  "missed_invitation_for_questions",
  "missed_specific_next_step"
]);

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/u;
const HASH = /^[a-f0-9]{64}$/u;
const BANNED_PERSON_CLAIMS = /\b(confiden(?:t|ce)|empath(?:y|etic)|honest(?:y)?|personality|intelligen(?:t|ce)|anxious|anxiety|stress(?:ed)?|emotion(?:al)?|professionalism|readiness|rank(?:ing)?|residency suitability|clinical competence)\b/iu;

function object(value, code, label) {
  invariant(value && typeof value === "object" && !Array.isArray(value), 400, code, `${label} must be an object`);
  return value;
}

function safeId(value, code, label) {
  const result = String(value || "").trim();
  invariant(SAFE_ID.test(result), 400, code, `${label} is invalid`);
  return result;
}

function boundedText(value, code, label, max, required = true) {
  const result = String(value ?? "").trim();
  invariant(!required || result.length > 0, 400, code, `${label} is required`);
  invariant(result.length <= max, 400, code, `${label} is too long`);
  return result || null;
}

function integerMs(value, code, label) {
  const result = Number(value);
  invariant(Number.isSafeInteger(result) && result >= 0, 400, code, `${label} must be a non-negative integer`);
  return result;
}

function timeRange(value) {
  const t0 = integerMs(value.t0_ms, "TIME_RANGE_INVALID", "t0_ms");
  const t1 = integerMs(value.t1_ms, "TIME_RANGE_INVALID", "t1_ms");
  invariant(t1 >= t0, 400, "TIME_RANGE_INVALID", "t1_ms must be at or after t0_ms");
  const rangeKind = String(value.range_kind || (t0 === t1 ? "POINT" : "SPAN"));
  invariant(["POINT", "SPAN"].includes(rangeKind), 400, "TIME_RANGE_KIND_INVALID", "Range kind must be POINT or SPAN");
  if (rangeKind === "POINT") invariant(t0 === t1, 400, "POINT_RANGE_INVALID", "Point ranges require equal boundaries");
  else invariant(t1 > t0, 400, "SPAN_RANGE_INVALID", "Half-open span ranges require t1_ms greater than t0_ms");
  return { range_kind: rangeKind, t0_ms: t0, t1_ms: t1 };
}

function stringList(value, code, label, max = 20) {
  const input = value === undefined ? [] : value;
  invariant(Array.isArray(input) && input.length <= max, 400, code, `${label} must be an array with at most ${max} items`);
  return [...new Set(input.map((entry) => safeId(entry, code, label)))];
}

function textList(value, code, label, min, max, itemMax = 1000) {
  invariant(Array.isArray(value) && value.length >= min && value.length <= max, 400, code, `${label} must contain ${min}-${max} items`);
  return value.map((entry) => boundedText(entry, code, label, itemMax));
}

export function validateClaimMetadata(input, context = {}) {
  const value = object(input, "CLAIM_METADATA_REQUIRED", "Claim metadata");
  const tier = String(value.tier || "");
  invariant(Object.hasOwn(CLAIM_BADGES, tier), 400, "CLAIM_TIER_INVALID", "Claim tier must be L0-L4");
  invariant(value.badge === CLAIM_BADGES[tier] || (tier === "L0" && value.simulated === true && value.badge === "SIMULATED"), 400, "CLAIM_BADGE_INVALID", "Claim badge does not match its tier");
  const statement = boundedText(value.statement, "CLAIM_STATEMENT_REQUIRED", "Claim statement", 1000);
  const evidenceRefs = stringList(value.evidence_refs, "CLAIM_EVIDENCE_INVALID", "Claim evidence refs", 30);
  const numeric = value.numeric_value !== undefined && value.numeric_value !== null;
  invariant(!numeric || ["L0", "L1"].includes(tier), 400, "CLAIM_NUMERIC_FORBIDDEN", "Only L0/L1 claims may be numeric");
  if (tier === "L0") {
    invariant(typeof value.unit === "string" && value.unit.trim(), 400, "CLAIM_UNIT_REQUIRED", "L0 claims require a unit");
    invariant(typeof value.algorithm_id === "string" && value.algorithm_id.trim(), 400, "CLAIM_ALGORITHM_REQUIRED", "L0 claims require an algorithm or instrument identifier");
    invariant(typeof value.limitations === "string" && value.limitations.trim(), 400, "CLAIM_LIMITATIONS_REQUIRED", "L0 claims require limitations");
    invariant(value.method_status === "active_validated", 400, "CLAIM_METHOD_NOT_VALIDATED", "L0 measurement methods must be active and validated");
  }
  if (tier === "L1") {
    invariant(evidenceRefs.length > 0, 400, "CLAIM_EVIDENCE_REQUIRED", "L1 claims require replay-verifiable evidence");
    invariant(["active_validated", "human_observation"].includes(value.method_status), 400, "CLAIM_METHOD_NOT_VALIDATED", "L1 observation method is not active or human-verified");
  }
  if (tier === "L2") {
    invariant(typeof value.framework === "string" && value.framework.trim(), 400, "CLAIM_FRAMEWORK_REQUIRED", "L2 claims require a named framework");
    invariant(["T1", "T2", "T3", "T4"].includes(value.evidence_tier), 400, "CLAIM_EVIDENCE_TIER_REQUIRED", "L2 claims require an evidence tier");
  }
  if (tier === "L3") {
    invariant(context.authorRole === "mentor", 400, "CLAIM_MENTOR_AUTHORITY_REQUIRED", "L3 claims require a mentor author");
    invariant(evidenceRefs.length > 0, 400, "CLAIM_EVIDENCE_REQUIRED", "Mentor interpretation must anchor to evidence");
  }
  if (tier === "L4") invariant(typeof value.doctrine_ref === "string" && value.doctrine_ref.trim(), 400, "CLAIM_DOCTRINE_REQUIRED", "L4 claims require a MissionMed doctrine reference");
  if (context.sourceKind !== "human") invariant(!BANNED_PERSON_CLAIMS.test(statement), 400, "PERSON_INFERENCE_FORBIDDEN", "Machine-authored person inference is forbidden");
  return {
    tier,
    badge: value.badge,
    statement,
    evidence_refs: evidenceRefs,
    simulated: value.simulated === true,
    numeric_value: numeric ? Number(value.numeric_value) : null,
    unit: value.unit ? String(value.unit).trim() : null,
    algorithm_id: value.algorithm_id ? String(value.algorithm_id).trim() : null,
    algorithm_version: value.algorithm_version ? String(value.algorithm_version).trim() : null,
    limitations: value.limitations ? String(value.limitations).trim() : null,
    framework: value.framework ? String(value.framework).trim() : null,
    evidence_tier: value.evidence_tier || null,
    doctrine_ref: value.doctrine_ref ? String(value.doctrine_ref).trim() : null,
    method_status: value.method_status || "not_applicable"
  };
}

export function validateSessionInput(input) {
  const value = object(input, "SESSION_REQUIRED", "Session");
  const clock = validateSessionClockContract(value.clock);
  return {
    contract_version: CONTRACT_VERSION,
    external_session_ref: safeId(value.external_session_ref, "SESSION_REF_INVALID", "External session reference"),
    mode_ref: safeId(value.mode_ref, "MODE_REF_INVALID", "Mode reference"),
    media_revision_ref: value.media_revision_ref ? safeId(value.media_revision_ref, "MEDIA_REVISION_REF_INVALID", "Media revision reference") : null,
    clock: stableValue(clock)
  };
}

export function validateConsentReceiptInput(input) {
  const value = object(input, "CONSENT_REQUIRED", "Consent receipt");
  invariant(CONSENT_PURPOSES.includes(value.purpose), 400, "CONSENT_PURPOSE_INVALID", "Consent purpose is invalid");
  invariant(typeof value.granted === "boolean", 400, "CONSENT_GRANT_INVALID", "Consent granted must be boolean");
  const recordedAt = new Date(value.recorded_at).toISOString();
  const policyTextHash = String(value.policy_text_hash || "");
  invariant(HASH.test(policyTextHash), 400, "CONSENT_POLICY_HASH_INVALID", "Consent policy text hash is invalid");
  const scope = object(value.scope, "CONSENT_SCOPE_INVALID", "Consent scope");
  return {
    contract_version: CONTRACT_VERSION,
    purpose: value.purpose,
    granted: value.granted,
    authority_ref: safeId(value.authority_ref, "CONSENT_AUTHORITY_REF_INVALID", "Consent authority reference"),
    policy_version: safeId(value.policy_version, "CONSENT_POLICY_VERSION_INVALID", "Consent policy version"),
    policy_text_hash: policyTextHash,
    locale: boundedText(value.locale || "en-US", "CONSENT_LOCALE_INVALID", "Consent locale", 32),
    retention_policy_ref: safeId(value.retention_policy_ref, "CONSENT_RETENTION_REF_INVALID", "Consent retention policy reference"),
    scope: stableValue(scope),
    recorded_at: recordedAt,
    expires_at: value.expires_at ? new Date(value.expires_at).toISOString() : null,
    supersedes_receipt_id: value.supersedes_receipt_id ? safeId(value.supersedes_receipt_id, "CONSENT_SUPERSESSION_INVALID", "Superseded consent receipt") : null
  };
}

export function validateTrackItemInput(input, context) {
  const value = object(input, "TRACK_ITEM_REQUIRED", "Track item");
  const range = timeRange(value);
  const kind = String(value.kind || "");
  invariant(TRACK_KINDS.includes(kind), 400, "TRACK_KIND_INVALID", "Track item kind is not active in C0");
  const visibility = String(value.visibility || "private");
  invariant(VISIBILITIES.includes(visibility), 400, "VISIBILITY_INVALID", "Visibility is invalid");
  const itemRevision = Number(value.item_revision ?? 1);
  invariant(Number.isSafeInteger(itemRevision) && itemRevision >= 1, 400, "TRACK_REVISION_INVALID", "Track item revision must be a positive integer");
  object(value.payload, "TRACK_PAYLOAD_INVALID", "Track payload");
  invariant(Buffer.byteLength(JSON.stringify(value.payload)) <= 64 * 1024, 413, "TRACK_PAYLOAD_TOO_LARGE", "Track payload exceeds 64 KiB");
  const provenance = validateClaimMetadata(value.provenance, context);
  return {
    contract_version: CONTRACT_VERSION,
    track_item_id: value.track_item_id ? safeId(value.track_item_id, "TRACK_ID_INVALID", "Track item ID") : null,
    item_revision: itemRevision,
    supersedes_item_revision: value.supersedes_item_revision === null || value.supersedes_item_revision === undefined ? null : Number(value.supersedes_item_revision),
    payload_schema_version: safeId(value.payload_schema_version || `${kind}.v1`, "PAYLOAD_SCHEMA_VERSION_INVALID", "Payload schema version"),
    segment_id: safeId(value.segment_id, "TRACK_SEGMENT_REQUIRED", "Track segment"),
    media_revision_ref: safeId(value.media_revision_ref, "TRACK_MEDIA_REVISION_REQUIRED", "Track media revision"),
    kind,
    ...range,
    payload: stableValue(value.payload),
    provenance,
    visibility,
    consent_receipt_ids: stringList(value.consent_receipt_ids, "CONSENT_REFERENCE_INVALID", "Consent receipt IDs", 10)
  };
}

export function validateSkillSnapshotInput(input) {
  const value = object(input, "SKILL_SNAPSHOT_REQUIRED", "Skill snapshot");
  const card = object(value.full_card, "SKILL_CARD_REQUIRED", "Full skill card");
  const tier = String(card.evidence_tier || "").split(/\s/u)[0];
  invariant(["T1", "T2", "T3", "T4"].includes(tier), 400, "SKILL_TIER_INVALID", "Skill evidence tier must be T1-T4");
  invariant(card.status === "published" || value.source_authority?.kind === "synthetic_fixture", 409, "SKILL_NOT_PUBLISHED", "Only a verified published skill may be snapshotted");
  const skillId = safeId(card.skill_id, "SKILL_ID_INVALID", "Skill ID");
  invariant(!/^D[1-6]$/u.test(skillId), 400, "SKILL_DOMAIN_NOT_ASSIGNABLE", "Domains are not assignable skill cards");
  invariant(/^D[1-6]$/u.test(card.parent_domain), 400, "SKILL_DOMAIN_INVALID", "Parent domain must be D1-D6");
  const semanticVersion = safeId(card.version, "SKILL_VERSION_INVALID", "Skill semantic version");
  invariant(/^v\d+\.\d+$/u.test(semanticVersion), 400, "SKILL_VERSION_INVALID", "Skill semantic version must use v{major.minor}");
  const successCriteria = boundedText(card.next_rep_success, "SKILL_SUCCESS_REQUIRED", "Next-rep success criterion", 1000);
  invariant(!BANNED_PERSON_CLAIMS.test(successCriteria), 400, "SKILL_CLAIM_FORBIDDEN", "Success criteria must describe observable behavior, not the person");
  const publicationSeq = Number(value.publication_seq);
  invariant(Number.isSafeInteger(publicationSeq) && publicationSeq >= 1, 400, "SKILL_PUBLICATION_SEQ_INVALID", "Publication sequence must be a positive integer");
  textList(card.positive_examples, "SKILL_EXAMPLES_INVALID", "Positive examples", 2, 4);
  textList(card.counterexamples, "SKILL_COUNTEREXAMPLES_INVALID", "Counterexamples", 2, 4);
  invariant(Array.isArray(card.observable_markers) && card.observable_markers.length >= 2 && card.observable_markers.length <= 4, 400, "SKILL_MARKERS_INVALID", "Observable markers must contain 2-4 items");
  for (const marker of card.observable_markers) {
    object(marker, "SKILL_MARKER_INVALID", "Observable marker");
    invariant(["L0", "L1"].includes(marker.claim_rung), 400, "SKILL_MARKER_RUNG_INVALID", "Observable markers must be L0 or L1");
    boundedText(marker.description, "SKILL_MARKER_DESCRIPTION_REQUIRED", "Observable marker description", 1000);
  }
  invariant(Array.isArray(card.practice_drills) && card.practice_drills.length >= 1 && card.practice_drills.length <= 3, 400, "SKILL_DRILLS_INVALID", "Practice drills must contain 1-3 items");
  for (const field of ["student_title", "mentor_title", "plain_description", "competency_cluster", "atomic_target", "metric_limitations", "mode_relevance", "scenario_relevance", "age_relevance", "mm_coaching_note", "comparison_criteria", "context_guidance", "accessibility_notes", "cultural_note", "content_owner", "review_date"]) {
    boundedText(card[field], "SKILL_CARD_FIELD_REQUIRED", field, 4000);
  }
  invariant(Array.isArray(card.eligible_metrics), 400, "SKILL_METRICS_INVALID", "Eligible metrics must be an array");
  invariant(Array.isArray(card.version_history), 400, "SKILL_HISTORY_INVALID", "Version history must be an array");
  const sourceAuthority = object(value.source_authority, "SKILL_SOURCE_AUTHORITY_REQUIRED", "Skill source authority");
  invariant(["wordpress_library", "synthetic_fixture"].includes(sourceAuthority.kind), 400, "SKILL_SOURCE_AUTHORITY_INVALID", "Skill source authority is invalid");
  const fullCard = stableValue(card);
  const snapshot = {
    contract_version: CONTRACT_VERSION,
    skill_id: skillId,
    skill_version: semanticVersion,
    publication_seq: publicationSeq,
    full_card: fullCard,
    render_subset: {
      title: card.student_title,
      description: card.plain_description,
      tier,
      success_criteria: successCriteria
    },
    evidence_tier: tier,
    source_authority: stableValue(sourceAuthority)
  };
  return { ...snapshot, content_hash: sha256(snapshot) };
}

export function validatePriorityInput(input) {
  const value = object(input, "PRIORITY_REQUIRED", "Priority selection");
  const spotlight = value.spotlight_snapshot_id ? safeId(value.spotlight_snapshot_id, "PRIORITY_REF_INVALID", "Spotlight snapshot") : null;
  const supporting = value.supporting_snapshot_id ? safeId(value.supporting_snapshot_id, "PRIORITY_REF_INVALID", "Supporting snapshot") : null;
  invariant(spotlight, 400, "PRIORITY_SPOTLIGHT_REQUIRED", "An active priority set requires exactly one Spotlight");
  invariant(!spotlight || !supporting || spotlight !== supporting, 400, "PRIORITY_DUPLICATE", "Spotlight and supporting priorities must differ");
  return { contract_version: CONTRACT_VERSION, spotlight_snapshot_id: spotlight, supporting_snapshot_id: supporting };
}

export function validateMomentInput(input, context) {
  const value = object(input, "MOMENT_REQUIRED", "Moment");
  const range = timeRange(value);
  invariant(range.t1_ms > range.t0_ms, 400, "MOMENT_RANGE_REQUIRED", "A Moment must be a watchable range, not a point");
  const source = String(value.source || "");
  invariant(["student", "mentor"].includes(source), 400, "MOMENT_SOURCE_INVALID", "C0 Moments may be student- or mentor-authored only");
  invariant(source === context.authorRole, 403, "MOMENT_SOURCE_MISMATCH", "Moment source must match the verified author role");
  const visibility = String(value.visibility || "private");
  invariant(VISIBILITIES.includes(visibility), 400, "VISIBILITY_INVALID", "Moment visibility is invalid");
  const claim = validateClaimMetadata(value.provenance, context);
  return {
    contract_version: CONTRACT_VERSION,
    ...range,
    segment_id: safeId(value.segment_id, "MOMENT_SEGMENT_REQUIRED", "Moment segment"),
    media_revision_ref: safeId(value.media_revision_ref, "MOMENT_MEDIA_REVISION_REQUIRED", "Moment media revision"),
    source,
    type: safeId(value.type || "custom", "MOMENT_TYPE_INVALID", "Moment type"),
    label: boundedText(value.label, "MOMENT_LABEL_REQUIRED", "Moment label", 240),
    note: boundedText(value.note, "MOMENT_NOTE_INVALID", "Moment note", 4000, false),
    skill_snapshot_ids: stringList(value.skill_snapshot_ids, "MOMENT_SKILL_REF_INVALID", "Moment skill refs", 6),
    visibility,
    consent_receipt_ids: stringList(value.consent_receipt_ids, "CONSENT_REFERENCE_INVALID", "Consent receipt IDs", 10),
    provenance: claim
  };
}

export function validateOpportunityInput(input, context) {
  const value = object(input, "OPPORTUNITY_REQUIRED", "Opportunity");
  invariant(context.authorRole === "mentor", 403, "OPPORTUNITY_MENTOR_REQUIRED", "Only a verified mentor may author a C0 Opportunity");
  invariant(value.source === "mentor-manual", 400, "OPPORTUNITY_SOURCE_INVALID", "C0 accepts mentor-manual Opportunities only");
  invariant(OPPORTUNITY_TYPES.includes(value.type), 400, "OPPORTUNITY_TYPE_INVALID", "Opportunity type is not registered");
  const range = timeRange(value);
  invariant(range.t1_ms > range.t0_ms, 400, "OPPORTUNITY_RANGE_REQUIRED", "Opportunity evidence must be a replayable range");
  invariant(["low", "medium", "high"].includes(value.uncertainty), 400, "OPPORTUNITY_UNCERTAINTY_INVALID", "Opportunity uncertainty is invalid");
  const evidenceClaim = validateClaimMetadata(value.evidence_claim, { ...context, authorRole: "mentor", sourceKind: "human" });
  invariant(evidenceClaim.tier === "L1", 400, "OPPORTUNITY_EVIDENCE_CLAIM_INVALID", "Opportunity replay evidence must be L1");
  const coachingClaim = validateClaimMetadata(value.coaching_claim, { ...context, authorRole: "mentor", sourceKind: "human" });
  invariant(coachingClaim.tier === "L3", 400, "OPPORTUNITY_CLAIM_TIER_INVALID", "Manual Opportunity interpretation must be L3");
  return {
    contract_version: CONTRACT_VERSION,
    ...range,
    segment_id: safeId(value.segment_id, "OPPORTUNITY_SEGMENT_REQUIRED", "Opportunity segment"),
    media_revision_ref: safeId(value.media_revision_ref, "OPPORTUNITY_MEDIA_REVISION_REQUIRED", "Opportunity media revision"),
    source: "mentor-manual",
    type: value.type,
    skill_snapshot_id: safeId(value.skill_snapshot_id, "OPPORTUNITY_SKILL_REQUIRED", "Opportunity skill snapshot"),
    evidence_note: boundedText(value.evidence_note, "OPPORTUNITY_EVIDENCE_REQUIRED", "Opportunity evidence note", 2000),
    context: stableValue(object(value.context, "OPPORTUNITY_CONTEXT_REQUIRED", "Opportunity context")),
    uncertainty: value.uncertainty,
    status: "approved",
    visibility: "mentor",
    consent_receipt_ids: stringList(value.consent_receipt_ids, "CONSENT_REFERENCE_INVALID", "Consent receipt IDs", 10),
    evidence_claim: evidenceClaim,
    coaching_claim: coachingClaim,
    status_history: [{ status: "approved", source: "mentor-manual" }],
    expires_at: null
  };
}

export function validateContentHash(value, expected) {
  invariant(HASH.test(String(expected || "")), 400, "CONTENT_HASH_INVALID", "Content hash is invalid");
  invariant(sha256(value) === expected, 409, "CONTENT_HASH_MISMATCH", "Content does not match its immutable hash");
}
