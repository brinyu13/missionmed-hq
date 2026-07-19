import { assertPersistable, contentHash, deepClone, deepFreeze, sha256 } from "./canonical.mjs";
import { fail, invariant } from "./errors.mjs";

export const VERSIONS = deepFreeze({
  persona: "missionmed.interviewer-persona.v1",
  plan: "missionmed.interview-plan.v1",
  grounding: "missionmed.grounding-ref.v1",
  event: "missionmed.brain-event-envelope.v1",
  ledger: "missionmed.session-ledger-revision.v1",
  decision: "missionmed.interviewer-turn-decision.v1",
  modelAdapter: "missionmed.model-adapter.v1",
  voiceAdapter: "missionmed.voice-rail-adapter.v1",
  avatarAdapter: "missionmed.avatar-adapter.v1",
  fileLedger: "missionmed.file-session-ledger.v1",
});

export const MOVE_TYPES = deepFreeze([
  "clarification",
  "context",
  "evidence",
  "outcome",
  "reflection",
  "star_gap",
  "callback",
  "focus",
  "inconsistency",
  "transition",
  "wrap_up",
  "designed_recovery",
  "red_flag_clarification",
  "silence_recovery",
  "policy_refusal",
  "injection_defense",
]);

export const RATIONALE_TAGS = deepFreeze([
  "CLARIFY_AMBIGUITY",
  "CONTEXT_MISSING",
  "EVIDENCE_REQUEST",
  "OUTCOME_PROBE",
  "REFLECTION_PROBE",
  "STAR_GAP",
  "CALLBACK_OPEN_THREAD",
  "INSTRUCTOR_FOCUS",
  "POSSIBLE_INCONSISTENCY",
  "QUESTION_COMPLETE",
  "SESSION_WRAP_UP",
  "RECOVERY_RECONNECT",
  "RED_FLAG_CHRONOLOGY",
  "SILENCE_SUPPORT",
  "POLICY_BOUNDARY",
  "PROMPT_INJECTION_BLOCKED",
  "PROBE_1_OF_1",
  "PROBE_1_OF_2",
  "PROBE_2_OF_2",
  "PROBE_CAP_REACHED",
  "GROUNDED",
  "GROUNDED_OR_SILENT",
  "SENSITIVE_BOUNDARY",
  "GUARDS_PASS",
  "ABSTAINED",
]);

const ID = /^[a-z0-9][a-z0-9._:-]{2,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const SAFE_TEXT = /^[\t\n\r\x20-\x7e]{1,4000}$/;
const PROHIBITED_LANGUAGE = /\b(?:match probability|rank(?:ing)?|program fit|residency readiness|clinical competence|personality|deceptive|dishonest|emotion(?:al)? state|anxiety|stress score|accent score|intelligence|worth)\b/i;

function object(value, path) {
  invariant(value && typeof value === "object" && !Array.isArray(value), "SCHEMA_OBJECT_REQUIRED", `${path} must be an object`);
  return value;
}

function exactKeys(value, required, optional, path) {
  object(value, path);
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail("SCHEMA_REQUIRED_FIELD", `${path}.${key} is required`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail("SCHEMA_UNKNOWN_FIELD", `${path}.${key} is not allowed`);
  }
}

function string(value, path, { min = 1, max = 4000, pattern } = {}) {
  invariant(typeof value === "string", "SCHEMA_STRING_REQUIRED", `${path} must be a string`);
  invariant(value.length >= min && value.length <= max, "SCHEMA_STRING_LENGTH", `${path} length is invalid`);
  if (pattern) invariant(pattern.test(value), "SCHEMA_STRING_FORMAT", `${path} has an invalid format`);
  return value;
}

function nullableString(value, path, options) {
  if (value === null) return null;
  return string(value, path, options);
}

function integer(value, path, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  invariant(Number.isSafeInteger(value) && value >= min && value <= max, "SCHEMA_INTEGER_RANGE", `${path} must be a safe integer in range`);
  return value;
}

function boolean(value, path) {
  invariant(typeof value === "boolean", "SCHEMA_BOOLEAN_REQUIRED", `${path} must be boolean`);
  return value;
}

function enumeration(value, choices, path) {
  invariant(choices.includes(value), "SCHEMA_ENUM", `${path} must be one of ${choices.join(", ")}`);
  return value;
}

function array(value, path, { min = 0, max = 1000 } = {}) {
  invariant(Array.isArray(value), "SCHEMA_ARRAY_REQUIRED", `${path} must be an array`);
  invariant(value.length >= min && value.length <= max, "SCHEMA_ARRAY_LENGTH", `${path} length is invalid`);
  return value;
}

function uniqueStrings(value, path, options = {}) {
  const entries = array(value, path, options).map((entry, index) => string(entry, `${path}[${index}]`, { max: 256 }));
  invariant(new Set(entries).size === entries.length, "SCHEMA_DUPLICATE", `${path} contains duplicates`);
  return entries;
}

function id(value, path) {
  return string(value, path, { min: 3, max: 128, pattern: ID });
}

function hash(value, path) {
  return string(value, path, { min: 64, max: 64, pattern: HASH });
}

function iso(value, path) {
  string(value, path, { min: 20, max: 40 });
  invariant(Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, "SCHEMA_ISO_TIMESTAMP", `${path} must be a canonical ISO timestamp`);
  return value;
}

function safeText(value, path, { max = 4000 } = {}) {
  string(value, path, { min: 1, max });
  invariant(SAFE_TEXT.test(value), "SCHEMA_UNSAFE_TEXT", `${path} contains unsupported characters`);
  return value;
}

function validateHash(value, path = "$") {
  hash(value.content_hash, `${path}.content_hash`);
  invariant(contentHash(value) === value.content_hash, "CONTENT_HASH_MISMATCH", `${path}.content_hash does not match canonical content`);
}

function assertNoUnsupportedInference(text, path) {
  invariant(!PROHIBITED_LANGUAGE.test(text), "UNSUPPORTED_INFERENCE_LANGUAGE", `${path} contains prohibited inference language`);
}

function validateRef(ref, path, idKey) {
  exactKeys(ref, [idKey, "revision", "content_hash"], [], path);
  id(ref[idKey], `${path}.${idKey}`);
  integer(ref.revision, `${path}.revision`, { min: 1 });
  hash(ref.content_hash, `${path}.content_hash`);
}

export function validatePersonaPack(input) {
  const value = deepClone(input);
  exactKeys(value, ["contract_version", "persona_id", "revision", "display_name", "role", "pressure_rung", "warmth_directness_balance", "style", "boundaries", "probe_limits", "approved_grounding_sources", "voice_reference", "provenance", "content_hash"], [], "$persona");
  invariant(value.contract_version === VERSIONS.persona, "PERSONA_VERSION_UNSUPPORTED", "Persona contract version is unsupported");
  id(value.persona_id, "$persona.persona_id");
  integer(value.revision, "$persona.revision", { min: 1 });
  safeText(value.display_name, "$persona.display_name", { max: 120 });
  invariant(value.role === "residency_interviewer", "PERSONA_ROLE_UNSUPPORTED", "Phase 0 persona role must be residency_interviewer");
  integer(value.pressure_rung, "$persona.pressure_rung", { min: 0, max: 4 });
  exactKeys(value.warmth_directness_balance, ["warmth", "directness"], [], "$persona.warmth_directness_balance");
  integer(value.warmth_directness_balance.warmth, "$persona.warmth_directness_balance.warmth", { min: 0, max: 4 });
  integer(value.warmth_directness_balance.directness, "$persona.warmth_directness_balance.directness", { min: 0, max: 4 });

  exactKeys(value.style, ["tone", "pacing", "follow_up_style", "transition_style", "wrap_up_style"], [], "$persona.style");
  for (const key of Object.keys(value.style)) safeText(value.style[key], `$persona.style.${key}`, { max: 240 });

  exactKeys(value.boundaries, ["restricted_topics", "prohibited_inferences", "prohibited_behaviors"], [], "$persona.boundaries");
  uniqueStrings(value.boundaries.restricted_topics, "$persona.boundaries.restricted_topics", { max: 64 });
  uniqueStrings(value.boundaries.prohibited_behaviors, "$persona.boundaries.prohibited_behaviors", { min: 6, max: 64 });
  const prohibited = uniqueStrings(value.boundaries.prohibited_inferences, "$persona.boundaries.prohibited_inferences", { min: 8, max: 64 });
  for (const required of ["clinical_competence", "personality", "emotion", "deception", "readiness", "match_outcome", "ranking", "program_fit"]) {
    invariant(prohibited.includes(required), "PERSONA_BOUNDARY_MISSING", `Persona must prohibit ${required}`);
  }

  exactKeys(value.probe_limits, ["pressure_rungs_0_1", "pressure_rungs_2_plus"], [], "$persona.probe_limits");
  invariant(value.probe_limits.pressure_rungs_0_1 === 1, "PERSONA_PROBE_CAP", "Pressure rungs 0-1 must cap probes at 1");
  invariant(value.probe_limits.pressure_rungs_2_plus === 2, "PERSONA_PROBE_CAP", "Pressure rungs 2+ must cap probes at 2");
  const groundingSources = uniqueStrings(value.approved_grounding_sources, "$persona.approved_grounding_sources", { min: 3, max: 8 });
  for (const source of groundingSources) invariant(["synthetic_answer", "synthetic_domain_pack", "synthetic_instructor_focus"].includes(source), "PERSONA_GROUNDING_SOURCE_UNSUPPORTED", `Unsupported persona grounding source ${source}`);
  invariant(value.voice_reference === null, "PERSONA_VOICE_MUST_BE_NULL", "Phase 0 persona voice reference must be null");

  exactKeys(value.provenance, ["source_type", "source_id", "source_version", "simulated"], [], "$persona.provenance");
  invariant(value.provenance.source_type === "synthetic", "PERSONA_SOURCE_NOT_SYNTHETIC", "Phase 0 personas must be synthetic");
  id(value.provenance.source_id, "$persona.provenance.source_id");
  string(value.provenance.source_version, "$persona.provenance.source_version", { max: 64 });
  invariant(value.provenance.simulated === true, "PERSONA_SIMULATION_REQUIRED", "Phase 0 persona must be marked simulated");
  validateHash(value, "$persona");
  return deepFreeze(value);
}

export function validateInterviewPlan(input) {
  const value = deepClone(input);
  exactKeys(value, ["contract_version", "plan_id", "revision", "title", "mode", "session_objective", "persona_ref", "duration_target_seconds", "total_probe_budget", "question_families", "required_coverage", "optional_coverage", "transition_conditions", "callback_opportunities", "wrap_up_criteria", "questions", "restricted_topics", "synthetic_only", "content_hash"], [], "$plan");
  invariant(value.contract_version === VERSIONS.plan, "PLAN_VERSION_UNSUPPORTED", "Plan contract version is unsupported");
  id(value.plan_id, "$plan.plan_id");
  integer(value.revision, "$plan.revision", { min: 1 });
  safeText(value.title, "$plan.title", { max: 160 });
  invariant(value.mode === "synthetic_text_phase0", "PLAN_MODE_UNSUPPORTED", "Plan must remain synthetic text Phase 0");
  safeText(value.session_objective, "$plan.session_objective", { max: 400 });
  validateRef(value.persona_ref, "$plan.persona_ref", "persona_id");
  integer(value.duration_target_seconds, "$plan.duration_target_seconds", { min: 300, max: 1800 });
  integer(value.total_probe_budget, "$plan.total_probe_budget", { min: 1, max: 80 });
  uniqueStrings(value.question_families, "$plan.question_families", { min: 2, max: 20 });
  uniqueStrings(value.required_coverage, "$plan.required_coverage", { min: 1, max: 20 });
  uniqueStrings(value.optional_coverage, "$plan.optional_coverage", { max: 20 });
  uniqueStrings(value.transition_conditions, "$plan.transition_conditions", { min: 3, max: 20 });
  uniqueStrings(value.callback_opportunities, "$plan.callback_opportunities", { min: 1, max: 20 });
  uniqueStrings(value.wrap_up_criteria, "$plan.wrap_up_criteria", { min: 2, max: 20 });

  const questionIds = new Set();
  for (const [index, question] of array(value.questions, "$plan.questions", { min: 1, max: 40 }).entries()) {
    const path = `$plan.questions[${index}]`;
    exactKeys(question, ["question_id", "prompt", "category", "pressure_rung", "focus_tags", "red_flag_boundary", "wrap_up"], [], path);
    id(question.question_id, `${path}.question_id`);
    invariant(!questionIds.has(question.question_id), "PLAN_DUPLICATE_QUESTION", `Duplicate question ${question.question_id}`);
    questionIds.add(question.question_id);
    safeText(question.prompt, `${path}.prompt`, { max: 600 });
    assertNoUnsupportedInference(question.prompt, `${path}.prompt`);
    enumeration(question.category, ["behavioral", "situational", "context", "red_flag", "general"], `${path}.category`);
    integer(question.pressure_rung, `${path}.pressure_rung`, { min: 0, max: 4 });
    uniqueStrings(question.focus_tags, `${path}.focus_tags`, { max: 16 });
    nullableString(question.red_flag_boundary, `${path}.red_flag_boundary`, { max: 400 });
    boolean(question.wrap_up, `${path}.wrap_up`);
    if (question.category === "red_flag") invariant(question.red_flag_boundary !== null, "PLAN_RED_FLAG_BOUNDARY_REQUIRED", `${path} needs a neutral clarification boundary`);
  }
  uniqueStrings(value.restricted_topics, "$plan.restricted_topics", { min: 8, max: 64 });
  invariant(value.synthetic_only === true, "PLAN_SYNTHETIC_ONLY", "Phase 0 plan must be synthetic only");
  validateHash(value, "$plan");
  return deepFreeze(value);
}

export function validateGroundingRef(input) {
  const value = deepClone(input);
  exactKeys(value, ["contract_version", "grounding_id", "source_kind", "source_id", "source_version", "source_hash", "turn_id", "span", "consent_receipt_ids", "authorization", "untrusted_data", "simulated", "content_hash"], [], "$grounding");
  invariant(value.contract_version === VERSIONS.grounding, "GROUNDING_VERSION_UNSUPPORTED", "Grounding contract version is unsupported");
  id(value.grounding_id, "$grounding.grounding_id");
  enumeration(value.source_kind, ["synthetic_answer", "synthetic_domain_pack", "synthetic_instructor_focus"], "$grounding.source_kind");
  id(value.source_id, "$grounding.source_id");
  string(value.source_version, "$grounding.source_version", { max: 64 });
  hash(value.source_hash, "$grounding.source_hash");
  nullableString(value.turn_id, "$grounding.turn_id", { min: 3, max: 128, pattern: ID });
  exactKeys(value.span, ["start", "end", "quote"], [], "$grounding.span");
  integer(value.span.start, "$grounding.span.start");
  integer(value.span.end, "$grounding.span.end", { min: value.span.start + 1 });
  safeText(value.span.quote, "$grounding.span.quote");
  invariant(value.span.quote.length === value.span.end - value.span.start, "GROUNDING_SPAN_LENGTH", "Grounding quote length must match span");
  uniqueStrings(value.consent_receipt_ids, "$grounding.consent_receipt_ids", { max: 32 });
  exactKeys(value.authorization, ["decision", "basis"], [], "$grounding.authorization");
  invariant(value.authorization.decision === "ALLOWED" && value.authorization.basis === "synthetic_phase0", "GROUNDING_AUTHORITY_REQUIRED", "Phase 0 grounding must be explicitly synthetic-authorized");
  invariant(value.untrusted_data === true, "GROUNDING_UNTRUSTED_REQUIRED", "Grounding data must remain marked untrusted");
  invariant(value.simulated === true, "GROUNDING_SIMULATION_REQUIRED", "Grounding must be marked simulated");
  validateHash(value, "$grounding");
  return deepFreeze(value);
}

function validateActor(value, path) {
  exactKeys(value, ["type", "id"], [], path);
  enumeration(value.type, ["synthetic_applicant", "interviewer_brain", "system"], `${path}.type`);
  id(value.id, `${path}.id`);
}

export function eventHash(input) {
  const copy = { ...input };
  delete copy.event_hash;
  return sha256(copy);
}

export function validateBrainEventEnvelope(input) {
  const value = deepClone(input);
  exactKeys(value, ["contract_version", "event_id", "session_id", "sequence", "emitted_at", "actor", "event_type", "correlation_id", "causation_id", "idempotency_key", "privacy_zone", "payload", "payload_hash", "previous_event_hash", "event_hash"], [], "$event");
  invariant(value.contract_version === VERSIONS.event, "EVENT_VERSION_UNSUPPORTED", "Event contract version is unsupported");
  id(value.event_id, "$event.event_id");
  id(value.session_id, "$event.session_id");
  integer(value.sequence, "$event.sequence", { min: 1 });
  iso(value.emitted_at, "$event.emitted_at");
  validateActor(value.actor, "$event.actor");
  enumeration(value.event_type, ["session.started", "applicant.turn.accepted", "interviewer.turn.decided", "session.reconnected", "session.completed", "session.aborted"], "$event.event_type");
  id(value.correlation_id, "$event.correlation_id");
  nullableString(value.causation_id, "$event.causation_id", { min: 3, max: 128, pattern: ID });
  string(value.idempotency_key, "$event.idempotency_key", { min: 8, max: 200 });
  invariant(value.privacy_zone === "synthetic_phase0", "EVENT_PRIVACY_ZONE", "Event privacy zone must remain synthetic Phase 0");
  assertPersistable(value.payload, "$event.payload");
  hash(value.payload_hash, "$event.payload_hash");
  invariant(value.payload_hash === sha256(value.payload), "EVENT_PAYLOAD_HASH_MISMATCH", "Event payload hash is invalid");
  if (value.previous_event_hash !== null) hash(value.previous_event_hash, "$event.previous_event_hash");
  hash(value.event_hash, "$event.event_hash");
  invariant(value.event_hash === eventHash(value), "EVENT_HASH_MISMATCH", "Event hash is invalid");
  return deepFreeze(value);
}

function validateGroundingIdList(value, path) {
  return uniqueStrings(value, path, { max: 16 }).map((entry) => id(entry, `${path}[]`));
}

function validateStateItem(item, path, type) {
  const shapes = {
    claim: ["claim_id", "turn_id", "grounding_ref_id", "text", "status"],
    topic: ["topic_id", "label", "status"],
    callback: ["callback_id", "grounding_ref_id", "label", "status"],
    thread: ["thread_id", "question_id", "probe_count", "status"],
    inconsistency: ["inconsistency_id", "left_grounding_ref_id", "right_grounding_ref_id", "status"],
  };
  exactKeys(item, shapes[type], [], path);
  for (const [key, entry] of Object.entries(item)) {
    if (key === "probe_count") integer(entry, `${path}.${key}`, { max: 2 });
    else if (key === "text" || key === "label") safeText(entry, `${path}.${key}`, { max: 1000 });
    else if (key === "status") {
      const options = type === "claim" ? ["ASSERTED_UNVERIFIED"] : type === "inconsistency" ? ["POSSIBLE", "CLARIFIED"] : ["OPEN", "USED", "CLOSED"];
      enumeration(entry, options, `${path}.${key}`);
    } else id(entry, `${path}.${key}`);
  }
}

export function validateSessionLedgerRevision(input) {
  const value = deepClone(input);
  exactKeys(value, ["contract_version", "session_id", "revision", "last_event_sequence", "previous_revision_hash", "reconnect_epoch", "persona_ref", "plan_ref", "policy_ref", "model_ref", "claims", "topics", "callbacks", "threads", "possible_inconsistencies", "star_coverage", "status", "content_hash"], [], "$ledger");
  invariant(value.contract_version === VERSIONS.ledger, "LEDGER_VERSION_UNSUPPORTED", "Ledger contract version is unsupported");
  id(value.session_id, "$ledger.session_id");
  integer(value.revision, "$ledger.revision", { min: 1 });
  integer(value.last_event_sequence, "$ledger.last_event_sequence", { min: 1 });
  if (value.previous_revision_hash !== null) hash(value.previous_revision_hash, "$ledger.previous_revision_hash");
  integer(value.reconnect_epoch, "$ledger.reconnect_epoch");
  validateRef(value.persona_ref, "$ledger.persona_ref", "persona_id");
  validateRef(value.plan_ref, "$ledger.plan_ref", "plan_id");
  validateRef(value.policy_ref, "$ledger.policy_ref", "policy_id");
  validateRef(value.model_ref, "$ledger.model_ref", "adapter_id");

  for (const [key, type] of [["claims", "claim"], ["topics", "topic"], ["callbacks", "callback"], ["threads", "thread"], ["possible_inconsistencies", "inconsistency"]]) {
    for (const [index, item] of array(value[key], `$ledger.${key}`, { max: 10000 }).entries()) validateStateItem(item, `$ledger.${key}[${index}]`, type);
  }
  exactKeys(value.star_coverage, ["situation", "task", "action", "result", "reflection"], [], "$ledger.star_coverage");
  for (const [key, entry] of Object.entries(value.star_coverage)) boolean(entry, `$ledger.star_coverage.${key}`);
  enumeration(value.status, ["ACTIVE", "RECOVERING", "COMPLETE", "ABORTED"], "$ledger.status");
  validateHash(value, "$ledger");
  return deepFreeze(value);
}

export function validateInterviewerTurnDecision(input) {
  const value = deepClone(input);
  exactKeys(value, ["contract_version", "decision_id", "session_id", "turn_id", "move", "utterance", "grounding_ref_ids", "policy_rule", "probe_index", "probe_cap", "active_thread_id", "unresolved_item_ids", "possible_inconsistency_ref_ids", "guardrails", "decision_uncertainty", "instructor_rationale_tags", "content_hash"], [], "$decision");
  invariant(value.contract_version === VERSIONS.decision, "DECISION_VERSION_UNSUPPORTED", "Decision contract version is unsupported");
  id(value.decision_id, "$decision.decision_id");
  id(value.session_id, "$decision.session_id");
  id(value.turn_id, "$decision.turn_id");
  enumeration(value.move, MOVE_TYPES, "$decision.move");
  safeText(value.utterance, "$decision.utterance", { max: 1000 });
  assertNoUnsupportedInference(value.utterance, "$decision.utterance");
  validateGroundingIdList(value.grounding_ref_ids, "$decision.grounding_ref_ids");
  id(value.policy_rule, "$decision.policy_rule");
  integer(value.probe_index, "$decision.probe_index", { max: 2 });
  integer(value.probe_cap, "$decision.probe_cap", { min: 1, max: 2 });
  invariant(value.probe_index <= value.probe_cap, "DECISION_PROBE_CAP_EXCEEDED", "Decision exceeds probe cap");
  nullableString(value.active_thread_id, "$decision.active_thread_id", { min: 3, max: 128, pattern: ID });
  uniqueStrings(value.unresolved_item_ids, "$decision.unresolved_item_ids", { max: 32 });
  const inconsistencyRefs = uniqueStrings(value.possible_inconsistency_ref_ids, "$decision.possible_inconsistency_ref_ids", { max: 2 });
  if (value.move === "inconsistency") {
    invariant(value.grounding_ref_ids.length === 2 && inconsistencyRefs.length === 2, "DECISION_INCONSISTENCY_EVIDENCE", "Inconsistency clarification requires exactly two evidence references");
    invariant(!/\b(?:lie|lying|liar|dishonest|deceptive|evasive)\b/i.test(value.utterance), "DECISION_ACCUSATORY_LANGUAGE", "Inconsistency language must remain neutral");
  }
  exactKeys(value.guardrails, ["grounded_or_silent", "sensitive_boundary", "prohibited_inference", "persona_consistency", "prompt_injection"], [], "$decision.guardrails");
  for (const [key, entry] of Object.entries(value.guardrails)) enumeration(entry, ["PASS", "ABSTAIN"], `$decision.guardrails.${key}`);
  enumeration(value.decision_uncertainty, ["LOW", "MEDIUM", "ABSTAIN"], "$decision.decision_uncertainty");
  const tags = uniqueStrings(value.instructor_rationale_tags, "$decision.instructor_rationale_tags", { min: 1, max: 8 });
  for (const tag of tags) enumeration(tag, RATIONALE_TAGS, "$decision.instructor_rationale_tags[]");
  validateHash(value, "$decision");
  return deepFreeze(value);
}

export function validateModelAdapterDescriptor(input) {
  const value = deepClone(input);
  exactKeys(value, ["contract_version", "adapter_id", "revision", "mode", "network_access", "provider", "retention_profile", "raw_output_persisted", "content_hash"], [], "$adapter");
  invariant(value.contract_version === VERSIONS.modelAdapter, "MODEL_ADAPTER_VERSION", "Model adapter version is unsupported");
  id(value.adapter_id, "$adapter.adapter_id");
  integer(value.revision, "$adapter.revision", { min: 1 });
  invariant(value.mode === "deterministic_rule", "MODEL_ADAPTER_MODE", "Phase 0 requires deterministic rule mode");
  invariant(value.network_access === false && value.provider === null && value.retention_profile === "none" && value.raw_output_persisted === false, "MODEL_ADAPTER_ISOLATION", "Model adapter must be zero-network and zero-provider");
  validateHash(value, "$adapter");
  return deepFreeze(value);
}

export function validateInactiveCapabilityDescriptor(input, kind) {
  const value = deepClone(input);
  const version = kind === "voice" ? VERSIONS.voiceAdapter : VERSIONS.avatarAdapter;
  exactKeys(value, ["contract_version", "capability", "activation_state", "provider", "accepted_writes", "content_hash"], [], `$${kind}`);
  invariant(value.contract_version === version && value.capability === kind, "CAPABILITY_DESCRIPTOR_VERSION", `${kind} capability descriptor is invalid`);
  invariant(value.activation_state === "INACTIVE" && value.provider === null && value.accepted_writes === false, "CAPABILITY_MUST_BE_INACTIVE", `${kind} capability must remain inactive`);
  validateHash(value, `$${kind}`);
  return deepFreeze(value);
}

export function sealContent(value) {
  const copy = deepClone(value);
  delete copy.content_hash;
  copy.content_hash = contentHash(copy);
  return deepFreeze(copy);
}

export function makeGroundingRef(input) {
  return validateGroundingRef(sealContent({ contract_version: VERSIONS.grounding, ...input }));
}

export function makeDecision(input) {
  return validateInterviewerTurnDecision(sealContent({ contract_version: VERSIONS.decision, ...input }));
}
