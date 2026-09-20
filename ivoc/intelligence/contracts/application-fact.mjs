// IVOC Application Intelligence — ApplicationFact contract.
// Pure module: no Node-only imports, no I/O, no provider coupling.
// Authority: IVOC_FABLE51_REMAINING_ARCHITECTURE_AND_DONOR_PACKET.md §3.2.

export const APPLICATION_FACT_SCHEMA = 'ivoc.application_fact.v1';

export const FACT_TYPES = Object.freeze([
  'research_item',
  'publication',
  'presentation',
  'clinical_experience',
  'education',
  'exam',
  'chronology_period',
  'gap_period',
  'leadership_role',
  'teaching_role',
  'language',
  'personal_statement_claim',
  'mspe_statement',
  'story_theme',
  'program_interest',
  'mentor_priority',
  'prior_ivoc_pattern',
  'applicant_field',
]);

export const SENSITIVITIES = Object.freeze(['routine', 'guarded', 'restricted']);
export const EXTRACTORS = Object.freeze(['owner_structured', 'deterministic_parser', 'model_assisted']);
export const TIME_PRECISIONS = Object.freeze(['day', 'month', 'year', 'unknown']);
export const CLINICAL_SUBTYPES = Object.freeze([
  'usce', 'observership', 'externship', 'home_country', 'volunteer_clinical',
]);
export const EXAM_OUTCOMES = Object.freeze(['pass', 'fail', 'pending', 'unknown']);

// Attribute keys that may never be stored as a fact value, whatever the source
// claims (packet §3.2 "Prohibited by construction"). Matching is on normalized key.
export const PROHIBITED_ATTRIBUTE_KEYS = Object.freeze([
  'race', 'ethnicity', 'religion', 'religious_affiliation', 'disability',
  'health', 'health_condition', 'medical_condition', 'diagnosis', 'pregnancy',
  'family_status', 'marital_status', 'children', 'dependents',
  'sexual_orientation', 'gender', 'gender_identity', 'sex',
  'age', 'date_of_birth', 'dob', 'birth_date', 'birth_year',
  'visa', 'visa_status', 'immigration_status', 'citizenship', 'citizenship_status',
  'national_origin', 'political_affiliation', 'union_membership',
]);

// Closed attribute schema per fact type. Unknown keys are dropped by
// `sanitizeAttributes` and logged by the caller; required keys must be present.
export const FACT_ATTRIBUTE_SCHEMAS = Object.freeze({
  research_item: { required: ['title'], optional: ['field', 'role', 'institution', 'year', 'specialty_tags', 'status'] },
  publication: { required: ['title'], optional: ['venue', 'role', 'year', 'field', 'institution', 'specialty_tags', 'status'] },
  presentation: { required: ['title'], optional: ['venue', 'role', 'year', 'field', 'institution', 'specialty_tags'] },
  clinical_experience: { required: ['subtype', 'setting'], optional: ['institution', 'country', 'supervisor_role', 'specialty_tags', 'responsibilities', 'duration_months'] },
  education: { required: ['degree', 'institution'], optional: ['country', 'year', 'field'] },
  exam: { required: ['name'], optional: ['attempt_count', 'outcome', 'score_band'] },
  chronology_period: { required: ['role'], optional: ['organization', 'kind', 'country', 'specialty_tags'] },
  gap_period: { required: [], optional: ['reason', 'months'] },
  leadership_role: { required: ['title'], optional: ['organization', 'year', 'scope'] },
  teaching_role: { required: ['title'], optional: ['organization', 'year', 'audience'] },
  language: { required: ['name'], optional: ['proficiency'] },
  personal_statement_claim: { required: ['text'], optional: ['themes', 'claim_type', 'asserts'] },
  mspe_statement: { required: ['text'], optional: ['topic'] },
  story_theme: { required: ['story_id', 'story_version', 'title'], optional: ['themes', 'summary', 'maturity', 'consent_state'] },
  program_interest: { required: ['program_id'], optional: ['name', 'specialty', 'fact', 'source_ref', 'as_of', 'people_role'] },
  mentor_priority: { required: ['text'], optional: ['priority_id', 'set_by', 'set_at', 'visibility', 'rank'] },
  prior_ivoc_pattern: { required: ['facet', 'polarity'], optional: ['sessions', 'evidence_refs'] },
  applicant_field: { required: ['field', 'value'], optional: ['as_of'] },
});

export const MAX_TEXT_WORDS = Object.freeze({
  personal_statement_claim: 40,
  mspe_statement: 60,
  story_theme_summary: 60,
});

// Words that, when they appear in a free-text reason, make a derived gap
// restricted (packet §3.2 gap_period rule). Matching is case-insensitive.
export const SENSITIVE_REASON_PATTERN = /\b(health|medical|illness|surgery|hospitali[sz]ed|pregnan\w*|maternity|paternity|family|caregiv\w*|bereave\w*|legal|court|arrest\w*|visa|immigration|deport\w*|asylum|mental)\b/iu;

const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export class ApplicationFactError extends TypeError {
  constructor(code, message) {
    super(message || code);
    this.name = 'ApplicationFactError';
    this.code = code;
  }
}

export function normalizeKey(key) {
  return String(key || '').trim().toLowerCase().replace(/[\s-]+/gu, '_');
}

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/u).filter(Boolean).length;
}

export function isProhibitedAttributeKey(key) {
  return PROHIBITED_ATTRIBUTE_KEYS.includes(normalizeKey(key));
}

/**
 * Drop every attribute the closed schema does not name and every prohibited key.
 * Returns `{ attributes, excluded }` where `excluded` maps key → reason.
 * Never throws for unknown keys; throws only when the fact type itself is unknown.
 */
export function sanitizeAttributes(factType, attributes) {
  const schema = FACT_ATTRIBUTE_SCHEMAS[factType];
  if (!schema) throw new ApplicationFactError('unknown_fact_type', `unknown fact type ${factType}`);
  const allowed = new Set([...schema.required, ...schema.optional]);
  const clean = {};
  const excluded = {};
  for (const [rawKey, value] of Object.entries(attributes || {})) {
    const key = normalizeKey(rawKey);
    if (value === undefined || value === null || value === '') continue; // absent values are simply absent
    if (isProhibitedAttributeKey(key)) { excluded[rawKey] = 'prohibited_attribute'; continue; }
    if (!allowed.has(key)) { excluded[rawKey] = 'not_in_closed_schema'; continue; }
    clean[key] = value;
  }
  return { attributes: clean, excluded };
}

function assertTimeRange(range, label) {
  if (range === undefined) return;
  if (!range || typeof range !== 'object' || Array.isArray(range)) {
    throw new ApplicationFactError('invalid_time_range', `${label} must be an object`);
  }
  if (!TIME_PRECISIONS.includes(range.precision)) {
    throw new ApplicationFactError('invalid_time_range', `${label}.precision is invalid`);
  }
  for (const key of ['start', 'end']) {
    if (range[key] !== undefined && range[key] !== null && !NON_EMPTY(range[key])) {
      throw new ApplicationFactError('invalid_time_range', `${label}.${key} must be a string when present`);
    }
  }
  if (NON_EMPTY(range.start) && NON_EMPTY(range.end) && range.end < range.start) {
    throw new ApplicationFactError('invalid_time_range', `${label}.end precedes start`);
  }
}

export function assertApplicationFact(fact) {
  if (!fact || typeof fact !== 'object' || Array.isArray(fact)) {
    throw new ApplicationFactError('invalid_fact', 'fact must be an object');
  }
  if (fact.schema_version !== '1') throw new ApplicationFactError('invalid_fact', 'fact.schema_version must be 1');
  for (const key of ['fact_id', 'subject_id', 'fact_type']) {
    if (!NON_EMPTY(fact[key])) throw new ApplicationFactError('invalid_fact', `fact.${key} is required`);
  }
  if (!FACT_TYPES.includes(fact.fact_type)) throw new ApplicationFactError('unknown_fact_type', `unknown fact type ${fact.fact_type}`);
  if (!fact.attributes || typeof fact.attributes !== 'object' || Array.isArray(fact.attributes)) {
    throw new ApplicationFactError('invalid_fact', 'fact.attributes must be an object');
  }
  const schema = FACT_ATTRIBUTE_SCHEMAS[fact.fact_type];
  const allowed = new Set([...schema.required, ...schema.optional]);
  for (const key of Object.keys(fact.attributes)) {
    if (isProhibitedAttributeKey(key)) throw new ApplicationFactError('prohibited_attribute', `fact.attributes.${key} is prohibited`);
    if (!allowed.has(key)) throw new ApplicationFactError('attribute_not_in_schema', `fact.attributes.${key} is not in the ${fact.fact_type} schema`);
  }
  for (const key of schema.required) {
    if (fact.attributes[key] === undefined || fact.attributes[key] === null || fact.attributes[key] === '') {
      throw new ApplicationFactError('missing_required_attribute', `fact.attributes.${key} is required for ${fact.fact_type}`);
    }
  }
  if (fact.fact_type === 'clinical_experience' && !CLINICAL_SUBTYPES.includes(fact.attributes.subtype)) {
    throw new ApplicationFactError('invalid_attribute', 'clinical_experience.subtype is invalid');
  }
  if (fact.fact_type === 'exam') {
    if (fact.attributes.outcome !== undefined && !EXAM_OUTCOMES.includes(fact.attributes.outcome)) {
      throw new ApplicationFactError('invalid_attribute', 'exam.outcome is invalid');
    }
    if (fact.sensitivity !== 'restricted') throw new ApplicationFactError('sensitivity_law', 'exam facts must be restricted');
  }
  if (fact.fact_type === 'personal_statement_claim' && wordCount(fact.attributes.text) > MAX_TEXT_WORDS.personal_statement_claim) {
    throw new ApplicationFactError('text_too_long', 'personal_statement_claim.text exceeds 40 words');
  }
  if (fact.fact_type === 'mspe_statement') {
    if (wordCount(fact.attributes.text) > MAX_TEXT_WORDS.mspe_statement) throw new ApplicationFactError('text_too_long', 'mspe_statement.text exceeds 60 words');
    if (fact.sensitivity === 'routine') throw new ApplicationFactError('sensitivity_law', 'mspe_statement must be at least guarded');
  }
  assertTimeRange(fact.time_range, 'fact.time_range');
  const p = fact.provenance;
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new ApplicationFactError('invalid_provenance', 'fact.provenance must be an object');
  for (const key of ['projection_id', 'owner_app', 'projection_type', 'source_version', 'source_receipt_hash', 'extracted_at']) {
    if (!NON_EMPTY(p[key])) throw new ApplicationFactError('invalid_provenance', `fact.provenance.${key} is required`);
  }
  if (!EXTRACTORS.includes(p.extracted_by)) throw new ApplicationFactError('invalid_provenance', 'fact.provenance.extracted_by is invalid');
  if (p.excerpt_ref !== undefined && !NON_EMPTY(p.excerpt_ref)) throw new ApplicationFactError('invalid_provenance', 'fact.provenance.excerpt_ref must be a string');
  if (p.derived_from !== undefined && (!Array.isArray(p.derived_from) || p.derived_from.some((ref) => !NON_EMPTY(ref)))) {
    throw new ApplicationFactError('invalid_provenance', 'fact.provenance.derived_from must be an array of fact ids');
  }
  if (!Number.isFinite(fact.confidence) || fact.confidence < 0 || fact.confidence > 1) {
    throw new ApplicationFactError('invalid_fact', 'fact.confidence must be between 0 and 1');
  }
  if (p.extracted_by === 'model_assisted' && fact.confidence > 0.8) {
    throw new ApplicationFactError('confidence_law', 'model_assisted facts are capped at confidence 0.8');
  }
  if (!SENSITIVITIES.includes(fact.sensitivity)) throw new ApplicationFactError('invalid_fact', 'fact.sensitivity is invalid');
  if (typeof fact.student_visible !== 'boolean') throw new ApplicationFactError('invalid_fact', 'fact.student_visible must be boolean');
  if (!Number.isInteger(fact.version) || fact.version < 1) throw new ApplicationFactError('invalid_fact', 'fact.version must be a positive integer');
  if (fact.stale !== undefined && typeof fact.stale !== 'boolean') throw new ApplicationFactError('invalid_fact', 'fact.stale must be boolean');
  return fact;
}
