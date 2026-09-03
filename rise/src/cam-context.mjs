import { CRITERION_OUTCOMES } from "./matching.mjs";

const ALLOWED_FIELDS = new Set([
  "audience",
  "subject",
  "expiresAt",
  "issuedAt",
  "jti",
  "programId",
  "programSpecialtyId",
  "registryReleaseId",
  "claimIds",
  "assessmentId",
  "criterionOutcomes",
  "questionIds",
  "consentedStoryForgeReferenceIds",
]);

const GEOGRAPHY_FIELDS = new Set([
  "address",
  "city",
  "coarsegeography",
  "coordinates",
  "exactgeography",
  "homeaddress",
  "latitude",
  "location",
  "longitude",
  "postalcode",
  "state",
  "streetaddress",
  "zip",
  "zipcode",
]);

const CRITERION_OUTCOME_FIELDS = new Set(["criterionId", "outcome"]);
const CRITERION_OUTCOME_STATES = new Set(Object.values(CRITERION_OUTCOMES));
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const MAX_ID_LENGTH = 160;
const MAX_SUBJECT_LENGTH = 256;
const MAX_CONTEXT_BYTES = 32 * 1024;
const ARRAY_LIMITS = Object.freeze({
  claimIds: 128,
  criterionOutcomes: 64,
  questionIds: 64,
  consentedStoryForgeReferenceIds: 32,
});
const STREET_ADDRESS_PATTERN = /\b\d{1,6}\s+[a-z0-9][a-z0-9 .'-]{1,60}\s(?:avenue|ave|boulevard|blvd|court|ct|drive|dr|highway|hwy|lane|ln|parkway|pkwy|road|rd|street|st|way)\b/i;
const COORDINATE_PATTERN = /(?:^|[^\d])[-+]?\d{1,2}\.\d{3,}\s*,\s*[-+]?\d{1,3}\.\d{3,}(?:$|[^\d])/;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isOpaqueId(value, { prefix, minLength = 1 } = {}) {
  return typeof value === "string"
    && value.length >= minLength
    && value.length <= MAX_ID_LENGTH
    && value.trim() === value
    && ID_PATTERN.test(value)
    && (!prefix || value.startsWith(prefix));
}

function inspectPayloadContent(context, errors) {
  let serialized;
  try {
    serialized = JSON.stringify(context);
  } catch {
    errors.push("context_not_serializable");
    return;
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_CONTEXT_BYTES) errors.push("context_too_large");
  if (/<\/?[a-z][^>]*>/i.test(serialized)) errors.push("html_not_allowed");
  if (STREET_ADDRESS_PATTERN.test(serialized) || COORDINATE_PATTERN.test(serialized)) {
    errors.push("exact_geography_not_allowed");
  }

  const lower = serialized.toLowerCase();
  for (const forbidden of [
    "synthetic",
    "demo",
    "homeaddress",
    "immigrationdocument",
    "examidentifier",
    "alumniname",
    "storytext",
  ]) {
    if (lower.includes(forbidden)) errors.push(`prohibited_content:${forbidden}`);
  }
}

function validateIdArray(context, field, errors) {
  const value = context[field];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`invalid_array:${field}`);
    return [];
  }
  if (value.length > ARRAY_LIMITS[field]) errors.push(`array_too_large:${field}`);

  const validated = [];
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const id = value[index];
    if (!isOpaqueId(id)) {
      errors.push(`invalid_id:${field}[${index}]`);
      continue;
    }
    if (seen.has(id)) {
      errors.push(`duplicate_id:${field}[${index}]`);
      continue;
    }
    seen.add(id);
    validated.push(id);
  }
  return validated;
}

function validateCriterionOutcomes(context, errors) {
  const value = context.criterionOutcomes;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push("invalid_array:criterionOutcomes");
    return [];
  }
  if (value.length > ARRAY_LIMITS.criterionOutcomes) errors.push("array_too_large:criterionOutcomes");

  const validated = [];
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const outcome = value[index];
    if (!isPlainObject(outcome)) {
      errors.push(`invalid_criterion_outcome:${index}`);
      continue;
    }
    for (const key of Object.keys(outcome)) {
      if (!CRITERION_OUTCOME_FIELDS.has(key)) {
        errors.push(`invalid_criterion_outcome_field:${index}:${key}`);
      }
    }
    if (!isOpaqueId(outcome.criterionId)) {
      errors.push(`invalid_id:criterionOutcomes[${index}].criterionId`);
    } else if (seen.has(outcome.criterionId)) {
      errors.push(`duplicate_id:criterionOutcomes[${index}].criterionId`);
    } else {
      seen.add(outcome.criterionId);
    }
    if (!CRITERION_OUTCOME_STATES.has(outcome.outcome)) {
      errors.push(`invalid_criterion_outcome_state:${index}`);
    }
    if (
      Object.keys(outcome).every((key) => CRITERION_OUTCOME_FIELDS.has(key))
      && isOpaqueId(outcome.criterionId)
      && CRITERION_OUTCOME_STATES.has(outcome.outcome)
    ) {
      validated.push({ criterionId: outcome.criterionId, outcome: outcome.outcome });
    }
  }
  return validated;
}

function validateConfiguration({ expectedSubject, currentRegistryReleaseId, resolver, replayStore }, errors) {
  if (
    typeof expectedSubject !== "string"
    || expectedSubject.length === 0
    || expectedSubject.length > MAX_SUBJECT_LENGTH
  ) {
    errors.push("missing_subject_binding");
  }
  if (!isOpaqueId(currentRegistryReleaseId, { prefix: "rise_registry_" })) {
    errors.push("missing_registry_release_binding");
  }
  if (!resolver || typeof resolver !== "object") {
    errors.push("missing_reference_resolver");
  } else {
    if (typeof resolver.validateProgramSpecialty !== "function") {
      errors.push("missing_program_specialty_validator");
    }
    if (typeof resolver.validateReference !== "function") errors.push("missing_reference_validator");
  }
  if (!replayStore || typeof replayStore.consumeOnce !== "function") {
    errors.push("missing_atomic_replay_store");
  }
}

function result(errors) {
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export async function validateCamContext(context, {
  now = Date.now(),
  expectedSubject,
  currentRegistryReleaseId,
  resolver,
  replayStore,
} = {}) {
  const errors = [];
  if (!isPlainObject(context)) return { ok: false, errors: ["context_must_be_an_object"] };

  for (const key of Object.keys(context)) {
    if (!ALLOWED_FIELDS.has(key)) errors.push(`field_not_allowed:${key}`);
    if (GEOGRAPHY_FIELDS.has(key.toLowerCase())) errors.push(`geography_not_allowed:${key}`);
  }
  validateConfiguration({ expectedSubject, currentRegistryReleaseId, resolver, replayStore }, errors);
  inspectPayloadContent(context, errors);

  if (context.audience !== "cam") errors.push("wrong_audience");
  if (
    typeof context.subject !== "string"
    || context.subject.length === 0
    || context.subject.length > MAX_SUBJECT_LENGTH
    || context.subject !== expectedSubject
  ) {
    errors.push("wrong_subject");
  }
  if (!isOpaqueId(context.jti, { minLength: 16 })) errors.push("invalid_one_time_id");
  if (!isOpaqueId(context.programId, { prefix: "rise_prg_" })) errors.push("invalid_program_id");
  if (!isOpaqueId(context.programSpecialtyId, { prefix: "rise_ps_" })) {
    errors.push("invalid_program_specialty_id");
  }
  if (!isOpaqueId(context.registryReleaseId, { prefix: "rise_registry_" })) {
    errors.push("missing_registry_release");
  } else if (context.registryReleaseId !== currentRegistryReleaseId) {
    errors.push("wrong_registry_release");
  }

  if (!Number.isSafeInteger(context.issuedAt)) errors.push("invalid_issued_at");
  else if (context.issuedAt > now + 30_000) errors.push("issued_in_future");
  if (!Number.isSafeInteger(context.expiresAt)) errors.push("invalid_expires_at");
  else if (context.expiresAt <= now) errors.push("expired");
  if (Number.isSafeInteger(context.issuedAt) && Number.isSafeInteger(context.expiresAt)) {
    if (context.expiresAt <= context.issuedAt) errors.push("invalid_ttl");
    if (context.expiresAt - context.issuedAt > 5 * 60 * 1000) errors.push("ttl_exceeds_five_minutes");
  }

  const claimIds = validateIdArray(context, "claimIds", errors);
  const questionIds = validateIdArray(context, "questionIds", errors);
  const consentedStoryForgeReferenceIds = validateIdArray(
    context,
    "consentedStoryForgeReferenceIds",
    errors,
  );
  const criterionOutcomes = validateCriterionOutcomes(context, errors);
  if (context.assessmentId !== undefined && !isOpaqueId(context.assessmentId)) {
    errors.push("invalid_id:assessmentId");
  }

  if (errors.length) return result(errors);

  const binding = Object.freeze({
    subject: expectedSubject,
    registryReleaseId: currentRegistryReleaseId,
    programId: context.programId,
    programSpecialtyId: context.programSpecialtyId,
  });

  try {
    if (await resolver.validateProgramSpecialty(binding) !== true) {
      errors.push("invalid_program_specialty_pair");
    }
  } catch {
    errors.push("program_specialty_resolver_unavailable");
  }
  if (errors.length) return result(errors);

  const references = [
    ...claimIds.map((id, index) => ({ kind: "claim", id, path: `claimIds[${index}]` })),
    ...criterionOutcomes.map(({ criterionId }, index) => ({
      kind: "criterion",
      id: criterionId,
      path: `criterionOutcomes[${index}].criterionId`,
    })),
    ...questionIds.map((id, index) => ({ kind: "question", id, path: `questionIds[${index}]` })),
    ...consentedStoryForgeReferenceIds.map((id, index) => ({
      kind: "storyforge_reference",
      id,
      path: `consentedStoryForgeReferenceIds[${index}]`,
    })),
  ];
  if (context.assessmentId !== undefined) {
    references.push({ kind: "assessment", id: context.assessmentId, path: "assessmentId" });
  }

  const referenceResults = await Promise.all(references.map(async (reference) => {
    try {
      const valid = await resolver.validateReference(Object.freeze({
        ...binding,
        assessmentId: context.assessmentId ?? null,
        kind: reference.kind,
        id: reference.id,
      }));
      return { ...reference, valid: valid === true };
    } catch {
      return { ...reference, unavailable: true };
    }
  }));
  for (const reference of referenceResults) {
    if (reference.unavailable) errors.push(`reference_resolver_unavailable:${reference.path}`);
    else if (!reference.valid) errors.push(`unresolved_reference:${reference.path}`);
  }
  if (errors.length) return result(errors);

  try {
    const consumed = await replayStore.consumeOnce(Object.freeze({
      audience: "cam",
      jti: context.jti,
      subject: expectedSubject,
      registryReleaseId: currentRegistryReleaseId,
      programId: context.programId,
      programSpecialtyId: context.programSpecialtyId,
      expiresAt: context.expiresAt,
    }));
    if (consumed === false) errors.push("replayed_one_time_id");
    else if (consumed !== true) errors.push("invalid_replay_store_response");
  } catch {
    errors.push("replay_store_unavailable");
  }

  return result(errors);
}
