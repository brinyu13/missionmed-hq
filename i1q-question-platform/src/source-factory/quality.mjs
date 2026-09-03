import { isDeepStrictEqual } from 'node:util';

import { sha256 } from '../hash.mjs';
import {
  ANSWER_KEYS,
  ANSWER_PROVENANCE_STATUSES,
  AUTHORITY_CLASSES,
  BANNED_ITEM_WORDING,
  CANDIDATE_CONTRACT_STATUS,
  CURRENCY_CLASSES,
  DISTRACTOR_PROVENANCE,
  EVIDENCE_CLAIM_TYPES,
  EVIDENCE_DRAFT_STATUSES,
  MEDICAL_VALIDATION_STATUS,
  RELEASE_ELIGIBILITY,
  REQUIRED_WARNINGS,
  REVIEW_GATE_STATUS,
  SOURCE_FACTORY_BUILD_VERSION,
  SOURCE_FACTORY_SCHEMA_VERSION,
  VARIANT_FORMS,
} from './contracts.mjs';
import {
  MISCONCEPTION_VOCABULARY,
  MISCONCEPTION_VOCABULARY_VERSION,
  TAXONOMY_VERSION,
  misconceptionIdForCategory,
  validateClassification,
} from './taxonomy.mjs';

const SHA256_HEX = /^[a-f0-9]{64}$/u;
const IDENTIFIER = /^[a-z][a-z0-9_.:-]{2,127}$/u;
const URL_PATTERN = /^https:\/\/[^\s]+$/u;
const OPAQUE_SEGMENT_LOCATOR = /^opaque:[a-z0-9._:-]{3,160}$/u;
const LEGACY_ROW_LOCATOR = /^legacy:[a-z0-9._:-]{3,160}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const OBVIOUS_IDENTITY_VALUE_PATTERNS = Object.freeze([
  /\b(?:patient|student)\s+(?:named\s+)?[A-Z][a-z]{1,30}\s+[A-Z][a-z]{1,30}\b/u,
  /\b(?:mrn|medical record|patient id|student id)\s*[:#-]?\s*[a-z0-9-]{3,}\b/iu,
  /\b\d{3}-\d{2}-\d{4}\b/u,
  /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/u,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
]);

const TOP_LEVEL_KEYS = [
  'schema_version', 'build_version', 'classification_level', 'contract_status', 'candidate_id',
  'candidate_revision_number', 'medical_validation_status', 'review_gate_status',
  'release_eligibility', 'workflow_target_status', 'item_type', 'variant_form', 'variant_group_key',
  'answer_provenance_status', 'evidence_support_status', 'teaching_content_evidence_status', 'content_sba', 'classification',
  'source_bundle', 'evidence_claims', 'quality_attestations', 'authoring', 'warnings',
  'future_compatibility', 'content_hash',
];

const PROHIBITED_KEYS = new Set([
  'raw_transcript', 'transcript_text', 'source_wording', 'detected_answer_wording', 'speaker_name',
  'student_name', 'patient_identifier', 'third_party_name', 'video_id', 'playback_url', 'transcript_url',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDate(value) {
  if (!DATE_PATTERN.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function obviousIdentityMarker(value) {
  return OBVIOUS_IDENTITY_VALUE_PATTERNS.some((pattern) => pattern.test(String(value || '')));
}

function optionLengthPass(content) {
  if (!Array.isArray(content?.choices) || content.choices.length !== 4 || !ANSWER_KEYS.includes(content.answer_key)) return false;
  const correct = content.choices.find((choice) => choice?.key === content.answer_key)?.text;
  const distractors = content.choices.filter((choice) => choice?.key !== content.answer_key).map((choice) => choice?.text);
  if (!present(correct) || distractors.length !== 3 || !distractors.every(present)) return false;
  const distractorMean = distractors.reduce((sum, value) => sum + [...value].length, 0) / distractors.length;
  const ratio = [...correct].length / distractorMean;
  return ratio >= 0.65 && ratio <= 1.5;
}

function add(errors, condition, code) {
  if (!condition) errors.push(code);
}

function normalizedText(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function periodicAnswerSequenceWindows(sequence) {
  const windows = [];
  for (let period = 1; period <= 4; period += 1) {
    const width = period * 3;
    for (let start = 0; start + width <= sequence.length; start += 1) {
      const pattern = sequence.slice(start, start + period).join('');
      if (sequence.slice(start, start + width).join('') === pattern.repeat(3)) {
        windows.push({ start_index: start, period, sequence: pattern.repeat(3) });
      }
    }
  }
  return windows;
}

function shape(errors, value, allowedKeys, prefix) {
  if (!isObject(value)) {
    errors.push(`${prefix}:object_required`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) errors.push(`${prefix}:unknown_key:${key}`);
  }
  return true;
}

function scanProhibitedKeys(value, errors, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanProhibitedKeys(entry, errors, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (PROHIBITED_KEYS.has(key)) errors.push(`prohibited_key:${path}.${key}`);
    scanProhibitedKeys(child, errors, `${path}.${key}`);
  }
}

function scanIdentityValues(value, errors, path = '$') {
  if (typeof value === 'string') {
    if (obviousIdentityMarker(value)) errors.push(`obvious_identity_marker_detected:${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanIdentityValues(entry, errors, `${path}[${index}]`));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) scanIdentityValues(child, errors, `${path}.${key}`);
}

export function candidateHashPayload(candidate) {
  const clone = structuredClone(candidate);
  if (isObject(clone)) delete clone.content_hash;
  return clone;
}

export function computeCandidateContentHash(candidate) {
  return sha256(candidateHashPayload(candidate));
}

export function withCandidateContentHash(candidate) {
  const normalized = structuredClone(candidate);
  normalized.content_hash = computeCandidateContentHash(normalized);
  return normalized;
}

function validateAuthorityReference(reference, errors, prefix) {
  if (!shape(errors, reference, [
    'title', 'publisher', 'url', 'locator', 'accessed_date', 'publication_or_revision_date',
    'review_by_date', 'source_class', 'retrieval_status', 'content_snapshot_sha256',
  ], prefix)) return;
  add(errors, present(reference.title), `${prefix}:title_required`);
  add(errors, present(reference.publisher), `${prefix}:publisher_required`);
  add(errors, URL_PATTERN.test(reference.url || ''), `${prefix}:https_url_required`);
  add(errors, present(reference.locator), `${prefix}:locator_required`);
  add(errors, validDate(reference.accessed_date), `${prefix}:accessed_date_invalid`);
  add(errors, reference.publication_or_revision_date === null || validDate(reference.publication_or_revision_date), `${prefix}:publication_or_revision_date_invalid`);
  add(errors, validDate(reference.review_by_date), `${prefix}:review_by_date_invalid`);
  if (validDate(reference.accessed_date) && validDate(reference.review_by_date)) {
    add(errors, reference.review_by_date >= reference.accessed_date, `${prefix}:review_by_date_expired`);
  }
  add(errors, reference.source_class === 'OFFICIAL_OR_PRIMARY_AUTHORITY_PROPOSED', `${prefix}:source_class_invalid`);
  add(errors, reference.retrieval_status === 'URL_REVIEWED_BY_AI_NO_IMMUTABLE_SNAPSHOT', `${prefix}:retrieval_status_invalid`);
  add(errors, reference.content_snapshot_sha256 === null, `${prefix}:snapshot_must_remain_unresolved`);
}

function validateEvidenceClaim(claim, errors, prefix, answerKey) {
  if (!shape(errors, claim, [
    'claim_id', 'claim_text', 'claim_type', 'claim_scope', 'authority_class', 'currency_class',
    'status', 'verification_status', 'verified_by', 'evidence_review_date', 'review_by_date',
    'claim_entailment_status', 'option_keys_supported', 'authority_refs',
  ], prefix)) return;
  add(errors, IDENTIFIER.test(claim.claim_id || ''), `${prefix}:claim_id_invalid`);
  add(errors, present(claim.claim_text), `${prefix}:claim_text_required`);
  add(errors, EVIDENCE_CLAIM_TYPES.includes(claim.claim_type), `${prefix}:claim_type_invalid`);
  add(errors, claim.claim_scope === 'KEYED_ANSWER_ONLY', `${prefix}:claim_scope_invalid`);
  add(errors, AUTHORITY_CLASSES.includes(claim.authority_class), `${prefix}:authority_class_invalid`);
  add(errors, CURRENCY_CLASSES.includes(claim.currency_class), `${prefix}:currency_class_invalid`);
  add(errors, claim.status === 'AI_DRAFT_UNVERIFIED', `${prefix}:status_must_remain_ai_draft`);
  add(errors, claim.verification_status === 'UNVERIFIED_AI_DRAFT', `${prefix}:verification_status_invalid`);
  add(errors, claim.verified_by === null, `${prefix}:verified_by_must_be_null`);
  add(errors, claim.evidence_review_date === null, `${prefix}:evidence_review_date_must_be_null`);
  add(errors, validDate(claim.review_by_date), `${prefix}:review_by_date_invalid`);
  if (Array.isArray(claim.authority_refs) && claim.authority_refs.length > 0) {
    const earliestReferenceReview = claim.authority_refs
      .map((reference) => reference?.review_by_date)
      .filter(validDate)
      .sort()[0];
    add(errors, claim.review_by_date === earliestReferenceReview, `${prefix}:review_by_date_must_match_earliest_reference`);
  }
  add(errors, claim.claim_entailment_status === 'AI_ASSESSED_PENDING_PHYSICIAN', `${prefix}:claim_entailment_must_remain_pending`);
  add(errors, Array.isArray(claim.option_keys_supported)
    && claim.option_keys_supported.length === 1
    && claim.option_keys_supported[0] === answerKey, `${prefix}:option_keys_supported_must_be_key_only`);
  add(errors, Array.isArray(claim.authority_refs) && claim.authority_refs.length > 0, `${prefix}:authority_refs_required`);
  if (Array.isArray(claim.authority_refs)) {
    claim.authority_refs.forEach((reference, index) => validateAuthorityReference(reference, errors, `${prefix}:authority_ref_${index}`));
  }
}

function validateSourceRef(reference, errors, prefix, transcriptStatus) {
  if (!shape(errors, reference, [
    'ref_id', 'ref_type', 'opaque_source_id', 'source_hash', 'source_hash_scope', 'source_locator', 'privacy_status',
    'rights_status', 'question_timestamp_ms', 'answer_timestamp_ms', 'segment_hash',
  ], prefix)) return;
  add(errors, IDENTIFIER.test(reference.ref_id || ''), `${prefix}:ref_id_invalid`);
  add(errors, ['legacy_static_row', 'privacy_safe_drj_segment', 'authoritative_reference_seed'].includes(reference.ref_type), `${prefix}:ref_type_invalid`);
  add(errors, IDENTIFIER.test(reference.opaque_source_id || ''), `${prefix}:opaque_source_id_invalid`);
  add(errors, SHA256_HEX.test(reference.source_hash || ''), `${prefix}:source_hash_invalid`);
  const expectedHashScope = reference.ref_type === 'authoritative_reference_seed'
    ? 'BIBLIOGRAPHIC_METADATA_ONLY_NOT_RETRIEVED_CONTENT'
    : 'SOURCE_CONTENT_BYTES';
  add(errors, reference.source_hash_scope === expectedHashScope, `${prefix}:source_hash_scope_invalid`);
  add(errors, present(reference.source_locator), `${prefix}:source_locator_required`);
  add(errors, ['LEGACY_STATIC_NO_TRANSCRIPT_PII', 'PRIVACY_GOLD_PASSED_WORKING_SEGMENT', 'PUBLIC_AUTHORITY_NO_TRANSCRIPT_PII'].includes(reference.privacy_status), `${prefix}:privacy_status_invalid`);
  add(errors, ['INTERNAL_DERIVATION_ONLY_NO_PUBLIC_MEDIA_RIGHTS', 'PUBLIC_EXCERPT_RIGHTS_VERIFIED', 'LINK_ONLY_NO_CONTENT_REPUBLICATION'].includes(reference.rights_status), `${prefix}:rights_status_invalid`);
  if (reference.ref_type === 'legacy_static_row') {
    add(errors, transcriptStatus === 'NOT_AVAILABLE_LEGACY_STATIC_SEED', `${prefix}:legacy_transcript_status_invalid`);
    add(errors, LEGACY_ROW_LOCATOR.test(reference.source_locator || ''), `${prefix}:legacy_source_locator_must_be_opaque`);
    add(errors, reference.privacy_status === 'LEGACY_STATIC_NO_TRANSCRIPT_PII', `${prefix}:legacy_privacy_status_invalid`);
    add(errors, reference.rights_status === 'INTERNAL_DERIVATION_ONLY_NO_PUBLIC_MEDIA_RIGHTS', `${prefix}:legacy_rights_status_invalid`);
    add(errors, reference.question_timestamp_ms === null, `${prefix}:legacy_question_timestamp_must_be_null`);
    add(errors, reference.answer_timestamp_ms === null, `${prefix}:legacy_answer_timestamp_must_be_null`);
    add(errors, reference.segment_hash === null, `${prefix}:legacy_segment_hash_must_be_null`);
  } else if (reference.ref_type === 'privacy_safe_drj_segment') {
    add(errors, transcriptStatus === 'VERIFIED_PRIVACY_SAFE_SEGMENT_LINKAGE', `${prefix}:privacy_transcript_status_invalid`);
    add(errors, OPAQUE_SEGMENT_LOCATOR.test(reference.source_locator || ''), `${prefix}:privacy_source_locator_must_be_opaque`);
    add(errors, reference.privacy_status === 'PRIVACY_GOLD_PASSED_WORKING_SEGMENT', `${prefix}:privacy_status_not_gold_passed`);
    add(errors, ['INTERNAL_DERIVATION_ONLY_NO_PUBLIC_MEDIA_RIGHTS', 'PUBLIC_EXCERPT_RIGHTS_VERIFIED'].includes(reference.rights_status), `${prefix}:privacy_rights_status_invalid`);
    add(errors, Number.isInteger(reference.question_timestamp_ms) && reference.question_timestamp_ms >= 0, `${prefix}:question_timestamp_invalid`);
    add(errors, reference.answer_timestamp_ms === null || (Number.isInteger(reference.answer_timestamp_ms) && reference.answer_timestamp_ms >= reference.question_timestamp_ms), `${prefix}:answer_timestamp_invalid`);
    add(errors, SHA256_HEX.test(reference.segment_hash || ''), `${prefix}:segment_hash_invalid`);
  } else {
    add(errors, transcriptStatus === 'NOT_APPLICABLE_AUTHORITY_DERIVED', `${prefix}:authority_transcript_status_invalid`);
    add(errors, reference.privacy_status === 'PUBLIC_AUTHORITY_NO_TRANSCRIPT_PII', `${prefix}:authority_privacy_status_invalid`);
    add(errors, reference.rights_status === 'LINK_ONLY_NO_CONTENT_REPUBLICATION', `${prefix}:authority_rights_status_invalid`);
    add(errors, reference.question_timestamp_ms === null, `${prefix}:authority_question_timestamp_must_be_null`);
    add(errors, reference.answer_timestamp_ms === null, `${prefix}:authority_answer_timestamp_must_be_null`);
    add(errors, reference.segment_hash === null, `${prefix}:authority_segment_hash_must_be_null`);
  }
}

function validateDistractor(rationale, errors, prefix) {
  if (!shape(errors, rationale, [
    'misconception_id', 'misconception_category', 'trap_type', 'provenance', 'why_tempting',
    'why_wrong', 'same_abstraction_level_attested', 'mutually_exclusive_attested',
    'accidental_correctness_verdict',
  ], prefix)) return;
  add(errors, IDENTIFIER.test(rationale.misconception_id || ''), `${prefix}:misconception_id_invalid`);
  add(errors, MISCONCEPTION_VOCABULARY.categories.includes(rationale.misconception_category), `${prefix}:misconception_category_invalid`);
  add(errors, rationale.misconception_id === misconceptionIdForCategory(rationale.misconception_category), `${prefix}:misconception_id_category_mismatch`);
  add(errors, present(rationale.trap_type), `${prefix}:trap_type_required`);
  add(errors, DISTRACTOR_PROVENANCE.includes(rationale.provenance), `${prefix}:provenance_invalid`);
  add(errors, present(rationale.why_tempting), `${prefix}:why_tempting_required`);
  add(errors, present(rationale.why_wrong), `${prefix}:why_wrong_required`);
  add(errors, rationale.same_abstraction_level_attested === true, `${prefix}:same_abstraction_level_required`);
  add(errors, rationale.mutually_exclusive_attested === true, `${prefix}:mutual_exclusivity_required`);
  add(errors, rationale.accidental_correctness_verdict === 'SAFELY_WRONG_AI_REVIEW_PENDING_PHYSICIAN', `${prefix}:safely_wrong_pending_physician_required`);
}

function validateContent(content, errors) {
  if (!shape(errors, content, ['stem', 'lead_in', 'choices', 'answer_key', 'rationales', 'explanation'], 'content_sba')) return;
  add(errors, present(content.stem), 'stem_required');
  add(errors, present(content.lead_in) && content.lead_in.trim().endsWith('?'), 'lead_in_question_required');
  const choices = Array.isArray(content.choices) ? content.choices : [];
  add(errors, Array.isArray(content.choices) && choices.length === 4, 'exactly_four_choices_required');
  choices.forEach((choice, index) => {
    if (!shape(errors, choice, ['key', 'text'], `choice_${index}`)) return;
    add(errors, choice.key === ANSWER_KEYS[index], `choice_${index}:key_order_invalid`);
    add(errors, present(choice.text), `choice_${index}:text_required`);
  });
  add(errors, choices.length === 4 && new Set(choices.map((choice) => normalizedText(choice?.text))).size === 4, 'choices_must_be_distinct');
  add(errors, ANSWER_KEYS.includes(content.answer_key), 'answer_key_invalid');
  const allVisibleText = `${content.stem || ''} ${content.lead_in || ''} ${choices.map((choice) => choice?.text || '').join(' ')}`;
  for (const pattern of BANNED_ITEM_WORDING) add(errors, !pattern.test(allVisibleText), `banned_item_wording:${pattern.source}`);
  add(errors, optionLengthPass(content), 'correct_option_length_outlier');

  const rationales = content.rationales;
  if (shape(errors, rationales, ['correct_answer', 'distractors'], 'rationales')) {
    add(errors, present(rationales.correct_answer), 'correct_answer_rationale_required');
    const distractors = rationales.distractors;
    if (shape(errors, distractors, ANSWER_KEYS.filter((key) => key !== content.answer_key), 'distractors')) {
      for (const key of ANSWER_KEYS.filter((choiceKey) => choiceKey !== content.answer_key)) {
        validateDistractor(distractors[key], errors, `distractor_${key}`);
      }
    }
  }

  const explanation = content.explanation;
  if (shape(errors, explanation, ['level_1', 'level_2', 'level_3'], 'explanation')) {
    add(errors, present(explanation.level_1), 'explanation_level_1_required');
    if (shape(errors, explanation.level_2, ANSWER_KEYS, 'explanation_level_2')) {
      for (const key of ANSWER_KEYS) add(errors, present(explanation.level_2[key]), `explanation_level_2_${key}_required`);
    }
    if (shape(errors, explanation.level_3, [
      'clinical_pearls', 'board_relevance', 'interview_relevance', 'common_traps', 'memory_aid',
    ], 'explanation_level_3')) {
      add(errors, Array.isArray(explanation.level_3.clinical_pearls) && explanation.level_3.clinical_pearls.length > 0 && explanation.level_3.clinical_pearls.every(present), 'clinical_pearls_required');
      add(errors, present(explanation.level_3.board_relevance), 'board_relevance_required');
      add(errors, present(explanation.level_3.interview_relevance), 'interview_relevance_required');
      add(errors, Array.isArray(explanation.level_3.common_traps) && explanation.level_3.common_traps.length > 0 && explanation.level_3.common_traps.every(present), 'common_traps_required');
      add(errors, present(explanation.level_3.memory_aid), 'memory_aid_required');
    }
  }
}

export function validateCandidate(candidate) {
  const errors = [];
  if (!shape(errors, candidate, TOP_LEVEL_KEYS, 'candidate')) return errors;
  scanProhibitedKeys(candidate, errors);
  scanIdentityValues(candidate, errors);
  add(errors, candidate.schema_version === SOURCE_FACTORY_SCHEMA_VERSION, 'schema_version_invalid');
  add(errors, candidate.build_version === SOURCE_FACTORY_BUILD_VERSION, 'build_version_invalid');
  add(errors, candidate.classification_level === 'CLASS_D_INTERNAL_ANSWER_BEARING', 'classification_level_invalid');
  add(errors, candidate.contract_status === CANDIDATE_CONTRACT_STATUS, 'contract_status_invalid');
  add(errors, IDENTIFIER.test(candidate.candidate_id || ''), 'candidate_id_invalid');
  add(errors, Number.isInteger(candidate.candidate_revision_number) && candidate.candidate_revision_number > 0, 'candidate_revision_number_invalid');
  add(errors, candidate.medical_validation_status === MEDICAL_VALIDATION_STATUS, 'medical_validation_status_invalid');
  add(errors, candidate.review_gate_status === REVIEW_GATE_STATUS, 'review_gate_status_invalid');
  add(errors, candidate.release_eligibility === RELEASE_ELIGIBILITY, 'release_eligibility_must_be_blocked');
  add(errors, candidate.workflow_target_status === 'draft', 'workflow_target_status_must_be_draft');
  add(errors, candidate.item_type === 'single_best_answer', 'item_type_not_current_mvp');
  add(errors, VARIANT_FORMS.includes(candidate.variant_form), 'variant_form_invalid');
  add(errors, IDENTIFIER.test(candidate.variant_group_key || ''), 'variant_group_key_invalid');
  add(errors, ANSWER_PROVENANCE_STATUSES.includes(candidate.answer_provenance_status), 'answer_provenance_status_invalid');
  add(errors, candidate.answer_provenance_status === 'AI_PROPOSED_ANSWER', 'answer_provenance_must_match_authority_lane');
  add(errors, EVIDENCE_DRAFT_STATUSES.includes(candidate.evidence_support_status), 'evidence_support_status_invalid');
  add(errors, candidate.teaching_content_evidence_status === 'DISTRACTOR_AND_LEVEL3_CLAIMS_UNMAPPED_UNVERIFIED', 'teaching_content_evidence_status_invalid');
  validateContent(candidate.content_sba, errors);

  for (const classificationError of validateClassification(candidate.classification)) errors.push(classificationError);
  if (isObject(candidate.classification)) {
    shape(errors, candidate.classification, [
      'taxonomy_version', 'misconception_vocabulary_version', 'primary_specialty', 'organ_system',
      'topic', 'subtopic', 'primary_concept_id', 'clinical_task', 'reasoning_pattern',
      'difficulty_tier', 'interview_competency', 'question_mode', 'cognitive_level', 'learner_stage', 'risk_tier',
      'difficulty_evidence_status', 'interview_competency_evidence_status', 'misconception_inference_status',
      'ai_draft_confidence', 'confidence_limit',
      'img_fairness_review_status',
    ], 'classification');
    add(errors, candidate.classification.taxonomy_version === TAXONOMY_VERSION, 'taxonomy_version_invalid');
    add(errors, candidate.classification.misconception_vocabulary_version === MISCONCEPTION_VOCABULARY_VERSION, 'misconception_vocabulary_version_invalid');
    add(errors, ['recall', 'application', 'clinical_reasoning'].includes(candidate.classification.cognitive_level), 'cognitive_level_invalid');
    add(errors, candidate.classification.learner_stage === 'pre_residency_clinical_review', 'learner_stage_invalid');
    add(errors, ['low', 'moderate', 'high'].includes(candidate.classification.risk_tier), 'risk_tier_invalid');
    add(errors, candidate.classification.difficulty_evidence_status === 'EDITORIAL_LABEL_NOT_EMPIRICALLY_CALIBRATED', 'difficulty_evidence_status_invalid');
    add(errors, candidate.classification.interview_competency_evidence_status === 'CONTENT_TARGET_NOT_MEASURED_BY_SBA', 'interview_competency_evidence_status_invalid');
    add(errors, candidate.classification.misconception_inference_status === 'AUTHOR_HYPOTHESIS_NOT_LEARNER_OBSERVED', 'misconception_inference_status_invalid');
    add(errors, ['low', 'moderate', 'high'].includes(candidate.classification.ai_draft_confidence), 'ai_draft_confidence_invalid');
    add(errors, candidate.classification.confidence_limit === 'NOT_MEDICAL_VALIDATION_OR_PSYCHOMETRIC_EVIDENCE', 'confidence_limit_invalid');
    add(errors, candidate.classification.img_fairness_review_status === 'AI_REVIEWED_PENDING_HUMAN', 'img_fairness_review_status_invalid');
  }

  const sourceBundle = candidate.source_bundle;
  if (shape(errors, sourceBundle, [
    'transcript_linkage_status', 'authoring_run_id', 'transcript_extraction_run_id', 'prompt_contract_version', 'source_refs',
    'merge_status', 'merge_decision_hash', 'all_occurrences_preserved', 'occurrence_preservation_status',
  ], 'source_bundle')) {
    add(errors, ['NOT_AVAILABLE_LEGACY_STATIC_SEED', 'VERIFIED_PRIVACY_SAFE_SEGMENT_LINKAGE', 'NOT_APPLICABLE_AUTHORITY_DERIVED'].includes(sourceBundle.transcript_linkage_status), 'transcript_linkage_status_invalid');
    add(errors, IDENTIFIER.test(sourceBundle.authoring_run_id || ''), 'authoring_run_id_invalid');
    add(errors, present(sourceBundle.prompt_contract_version), 'prompt_contract_version_required');
    add(errors, Array.isArray(sourceBundle.source_refs) && sourceBundle.source_refs.length > 0, 'source_refs_required');
    if (Array.isArray(sourceBundle.source_refs)) {
      sourceBundle.source_refs.forEach((reference, index) => validateSourceRef(reference, errors, `source_ref_${index}`, sourceBundle.transcript_linkage_status));
      add(errors, new Set(sourceBundle.source_refs.map((reference) => reference?.ref_id)).size === sourceBundle.source_refs.length, 'source_ref_ids_must_be_unique');
    }
    add(errors, sourceBundle.transcript_linkage_status === 'NOT_APPLICABLE_AUTHORITY_DERIVED', 'source_lane_unsupported_until_trusted_run_bindings_exist');
    add(errors, ['UNMERGED_UNIQUE_CANDIDATE', 'HUMAN_SEMANTIC_ADJUDICATION_REQUIRED'].includes(sourceBundle.merge_status), 'merge_status_invalid');
    add(errors, SHA256_HEX.test(sourceBundle.merge_decision_hash || ''), 'merge_decision_hash_invalid');
    if (sourceBundle.transcript_linkage_status === 'NOT_APPLICABLE_AUTHORITY_DERIVED') {
      add(errors, Array.isArray(sourceBundle.source_refs)
        && sourceBundle.source_refs.every((reference) => reference?.ref_type === 'authoritative_reference_seed'), 'authority_source_ref_type_invalid');
      add(errors, sourceBundle.transcript_extraction_run_id === null, 'authority_transcript_extraction_run_must_be_null');
      add(errors, sourceBundle.all_occurrences_preserved === false, 'authority_occurrences_must_not_be_claimed');
      add(errors, sourceBundle.occurrence_preservation_status === 'AUTHORITY_SEED_REFS_ONLY_NO_TRANSCRIPT_OCCURRENCES', 'authority_occurrence_status_invalid');
    } else if (sourceBundle.transcript_linkage_status === 'VERIFIED_PRIVACY_SAFE_SEGMENT_LINKAGE') {
      add(errors, Array.isArray(sourceBundle.source_refs)
        && sourceBundle.source_refs.every((reference) => reference?.ref_type === 'privacy_safe_drj_segment'), 'transcript_source_ref_type_invalid');
      add(errors, IDENTIFIER.test(sourceBundle.transcript_extraction_run_id || ''), 'transcript_extraction_run_id_invalid');
      add(errors, sourceBundle.all_occurrences_preserved === true, 'all_occurrences_preserved_required');
      add(errors, sourceBundle.occurrence_preservation_status === 'ALL_TRANSCRIPT_OCCURRENCES_HUMAN_VERIFIED', 'transcript_occurrence_status_invalid');
    } else if (sourceBundle.transcript_linkage_status === 'NOT_AVAILABLE_LEGACY_STATIC_SEED') {
      add(errors, Array.isArray(sourceBundle.source_refs)
        && sourceBundle.source_refs.every((reference) => reference?.ref_type === 'legacy_static_row'), 'legacy_source_ref_type_invalid');
      add(errors, sourceBundle.transcript_extraction_run_id === null, 'legacy_transcript_extraction_run_must_be_null');
      add(errors, sourceBundle.all_occurrences_preserved === false, 'legacy_occurrences_must_not_be_claimed');
      add(errors, sourceBundle.occurrence_preservation_status === 'LEGACY_ROW_LINKAGE_ONLY_SEMANTIC_OCCURRENCES_NOT_ADJUDICATED', 'legacy_occurrence_status_invalid');
    }
    const mergePayload = {
      merge_status: sourceBundle.merge_status,
      candidate_id: candidate.candidate_id,
      source_ref_ids: Array.isArray(sourceBundle.source_refs) ? sourceBundle.source_refs.map((reference) => reference?.ref_id) : [],
      all_occurrences_preserved: sourceBundle.all_occurrences_preserved,
      occurrence_preservation_status: sourceBundle.occurrence_preservation_status,
    };
    add(errors, sourceBundle.merge_decision_hash === sha256(mergePayload), 'merge_decision_hash_mismatch');
  }

  add(errors, Array.isArray(candidate.evidence_claims) && candidate.evidence_claims.length > 0, 'evidence_claims_required');
  if (Array.isArray(candidate.evidence_claims)) {
    candidate.evidence_claims.forEach((claim, index) => validateEvidenceClaim(claim, errors, `evidence_${index}`, candidate.content_sba?.answer_key));
  }
  add(errors, Array.isArray(candidate.warnings) && isDeepStrictEqual(candidate.warnings, REQUIRED_WARNINGS), 'candidate_warnings_invalid');

  if (shape(errors, candidate.quality_attestations, [
    'one_best_answer_ai_review', 'no_giveaway_wording_ai_review', 'no_trick_wording_ai_review',
    'choice_homogeneity_ai_review', 'grammar_parallelism_ai_review', 'no_length_giveaway_ai_review',
    'pre_residency_clinical_review_relevance_ai_attestation', 'img_fairness_ai_screen_pending_human',
  ], 'quality_attestations')) {
    for (const key of Object.keys(candidate.quality_attestations)) add(errors, candidate.quality_attestations[key] === true, `quality_attestation_required:${key}`);
  }
  if (shape(errors, candidate.authoring, ['generated_by', 'authorship_status', 'as_of_date'], 'authoring')) {
    add(errors, candidate.authoring.generated_by === 'I1Q_1008C_SOURCE_FACTORY', 'generated_by_invalid');
    add(errors, candidate.authoring.authorship_status === 'AI_ASSISTED_DRAFT', 'authorship_status_invalid');
    add(errors, validDate(candidate.authoring.as_of_date), 'as_of_date_invalid');
  }
  if (shape(errors, candidate.future_compatibility, ['current_contract', 'versioning', 'noncanonical_future_states'], 'future_compatibility')) {
    add(errors, candidate.future_compatibility.current_contract === 'SBA_ONLY_ARCHITECTURE_1002_1', 'future_current_contract_invalid');
    add(errors, candidate.future_compatibility.versioning === 'REVISION_NUMBER_PLUS_IMMUTABLE_CONTENT_HASH', 'future_versioning_invalid');
    add(errors, isDeepStrictEqual(candidate.future_compatibility.noncanonical_future_states, ['inactive', 'archived']), 'future_noncanonical_states_invalid');
  }

  add(errors, SHA256_HEX.test(candidate.content_hash || ''), 'content_hash_required');
  if (SHA256_HEX.test(candidate.content_hash || '')) add(errors, candidate.content_hash === computeCandidateContentHash(candidate), 'content_hash_mismatch');
  return errors;
}

export function validateCandidateLibrary(candidates) {
  const errors = [];
  add(errors, Array.isArray(candidates) && candidates.length > 0, 'candidate_library_nonempty_required');
  if (!Array.isArray(candidates)) return { errors, metrics: null };
  const seenIds = new Set();
  const seenHashes = new Set();
  const seenQuestions = new Set();
  const correctAnswerTexts = new Map();
  const distractorTexts = [];
  const answerSequence = [];
  const answerDistribution = Object.fromEntries(ANSWER_KEYS.map((key) => [key, 0]));
  candidates.forEach((candidate, index) => {
    for (const error of validateCandidate(candidate)) errors.push(`candidate_${index}:${error}`);
    if (!isObject(candidate)) return;
    if (seenIds.has(candidate.candidate_id)) errors.push(`candidate_${index}:duplicate_candidate_id`);
    seenIds.add(candidate.candidate_id);
    if (candidate.content_hash) {
      if (seenHashes.has(candidate.content_hash)) errors.push(`candidate_${index}:duplicate_content_hash`);
      seenHashes.add(candidate.content_hash);
    }
    const questionFingerprint = normalizedText(`${candidate.content_sba?.stem || ''} ${candidate.content_sba?.lead_in || ''}`);
    if (seenQuestions.has(questionFingerprint)) errors.push(`candidate_${index}:duplicate_question_text`);
    seenQuestions.add(questionFingerprint);
    const answerKey = candidate.content_sba?.answer_key;
    const candidateChoices = Array.isArray(candidate.content_sba?.choices) ? candidate.content_sba.choices : [];
    if (ANSWER_KEYS.includes(answerKey)) {
      answerSequence.push(answerKey);
      answerDistribution[answerKey] += 1;
      const correct = candidateChoices.find((choice) => choice?.key === answerKey)?.text;
      if (present(correct)) correctAnswerTexts.set(normalizedText(correct), candidate.candidate_id);
    }
    for (const choice of candidateChoices) {
      if (choice?.key !== answerKey && present(choice?.text)) distractorTexts.push({ text: normalizedText(choice.text), candidate_id: candidate.candidate_id });
    }
  });
  for (const distractor of distractorTexts) {
    const otherCandidate = correctAnswerTexts.get(distractor.text);
    if (otherCandidate && otherCandidate !== distractor.candidate_id) {
      errors.push(`cross_item_key_text_reuse:${distractor.candidate_id}:${otherCandidate}`);
    }
  }
  const counts = Object.values(answerDistribution);
  if (counts.length > 0) add(errors, Math.max(...counts) - Math.min(...counts) <= 1, 'answer_position_distribution_unbalanced');
  const periodicWindows = periodicAnswerSequenceWindows(answerSequence);
  add(errors, periodicWindows.length === 0, 'answer_position_sequence_periodic');
  return {
    errors,
    metrics: {
      candidate_count: candidates.length,
      answer_distribution: answerDistribution,
      answer_sequence: answerSequence.join(''),
      periodic_answer_sequence_windows: periodicWindows,
      distinct_candidate_ids: seenIds.size,
      distinct_content_hashes: seenHashes.size,
      distinct_question_texts: seenQuestions.size,
      cross_item_key_text_reuse_count: errors.filter((error) => error.startsWith('cross_item_key_text_reuse:')).length,
    },
  };
}
