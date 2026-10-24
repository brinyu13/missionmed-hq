import { sha256 } from '../hash.mjs';
import {
  AUTHORITY_AUTHORING_INPUT_PATHS,
  CANDIDATE_CONTRACT_STATUS,
  MEDICAL_VALIDATION_STATUS,
  RELEASE_ELIGIBILITY,
  REVIEW_GATE_STATUS,
  SOURCE_FACTORY_BUILD_VERSION,
  SOURCE_FACTORY_SCHEMA_VERSION,
} from './contracts.mjs';
import { withCandidateContentHash } from './quality.mjs';
import {
  MISCONCEPTION_VOCABULARY_VERSION,
  TAXONOMY_VERSION,
  misconceptionIdForCategory,
} from './taxonomy.mjs';

const KEYS = ['A', 'B', 'C', 'D'];
export const AUTHORITY_AUTHORING_RUN_ID = 'authoring.i1q1008c.authority.curation.20260716';
export const AUTHORITY_PROMPT_VERSION = 'i1q-1008c-authority-curation-v1';
const AUTHORITY_AUTHORING_AS_OF_DATE = '2026-07-16';

function identifier(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '.')
    .replace(/^\.+|\.+$/gu, '')
    .slice(0, 96);
}

function reviewByDate(currencyClass) {
  if (currencyClass === 'volatile') return '2026-10-16';
  if (currencyClass === 'standard') return '2027-01-16';
  return '2027-07-16';
}

function optionLengthPass(choices, answerKey) {
  const answerIndex = KEYS.indexOf(answerKey);
  const correctLength = [...choices[answerIndex]].length;
  const distractorMean = choices
    .filter((_, index) => index !== answerIndex)
    .reduce((sum, value) => sum + [...value].length, 0) / 3;
  const ratio = correctLength / distractorMean;
  return ratio >= 0.65 && ratio <= 1.5;
}

function authorityReference(reference, currencyClass) {
  return {
    title: reference.title,
    publisher: reference.publisher,
    url: reference.url,
    locator: reference.locator,
    accessed_date: '2026-07-16',
    publication_or_revision_date: reference.publication_or_revision_date || null,
    review_by_date: reference.review_by_date || reviewByDate(currencyClass),
    source_class: 'OFFICIAL_OR_PRIMARY_AUTHORITY_PROPOSED',
    retrieval_status: 'URL_REVIEWED_BY_AI_NO_IMMUTABLE_SNAPSHOT',
    content_snapshot_sha256: null,
  };
}

export function createAuthorityDerivedCandidate(spec) {
  const slug = identifier(spec.slug);
  const answerIndex = KEYS.indexOf(spec.answer_key);
  if (answerIndex < 0) throw new Error(`authoring_answer_key_invalid:${spec.answer_key}`);
  if (!Array.isArray(spec.choices) || spec.choices.length !== 4) throw new Error('authoring_four_choices_required');
  const references = (spec.references || []).map((reference) => authorityReference(reference, spec.currency_class));
  if (references.length === 0) throw new Error('authoring_reference_required');

  const distractors = {};
  const level2 = {};
  for (const [index, key] of KEYS.entries()) {
    if (key === spec.answer_key) {
      level2[key] = spec.why_correct;
      continue;
    }
    const draft = spec.distractors?.[key];
    if (!draft) throw new Error(`authoring_distractor_required:${key}`);
    distractors[key] = {
      misconception_id: misconceptionIdForCategory(draft.misconception_category),
      misconception_category: draft.misconception_category,
      trap_type: draft.trap_type,
      provenance: 'ai_generated',
      why_tempting: draft.why_tempting,
      why_wrong: draft.why_wrong,
      same_abstraction_level_attested: true,
      mutually_exclusive_attested: true,
      accidental_correctness_verdict: 'SAFELY_WRONG_AI_REVIEW_PENDING_PHYSICIAN',
    };
    level2[key] = `${draft.why_tempting} ${draft.why_wrong}`;
    if (!spec.choices[index]) throw new Error(`authoring_choice_missing:${key}`);
  }

  const sourceSeed = {
    titles: references.map((reference) => reference.title),
    publishers: references.map((reference) => reference.publisher),
    urls: references.map((reference) => reference.url),
    locators: references.map((reference) => reference.locator),
  };
  const sourceHash = sha256(sourceSeed);
  const sourceRefs = [{
    ref_id: `ref.authority.${slug}`,
    ref_type: 'authoritative_reference_seed',
    opaque_source_id: `authority.${sourceHash.slice(0, 24)}`,
    source_hash: sourceHash,
    source_hash_scope: 'BIBLIOGRAPHIC_METADATA_ONLY_NOT_RETRIEVED_CONTENT',
    source_locator: references.map((reference) => `${reference.publisher}: ${reference.locator}`).join('; '),
    privacy_status: 'PUBLIC_AUTHORITY_NO_TRANSCRIPT_PII',
    rights_status: 'LINK_ONLY_NO_CONTENT_REPUBLICATION',
    question_timestamp_ms: null,
    answer_timestamp_ms: null,
    segment_hash: null,
  }];
  const mergeDecision = {
    merge_status: spec.merge_status || 'UNMERGED_UNIQUE_CANDIDATE',
    candidate_id: `candidate.${slug}`,
    source_ref_ids: sourceRefs.map((reference) => reference.ref_id),
    all_occurrences_preserved: false,
    occurrence_preservation_status: 'AUTHORITY_SEED_REFS_ONLY_NO_TRANSCRIPT_OCCURRENCES',
  };

  const candidate = {
    schema_version: SOURCE_FACTORY_SCHEMA_VERSION,
    build_version: SOURCE_FACTORY_BUILD_VERSION,
    classification_level: 'CLASS_D_INTERNAL_ANSWER_BEARING',
    contract_status: CANDIDATE_CONTRACT_STATUS,
    candidate_id: `candidate.${slug}`,
    candidate_revision_number: 1,
    medical_validation_status: MEDICAL_VALIDATION_STATUS,
    review_gate_status: REVIEW_GATE_STATUS,
    release_eligibility: RELEASE_ELIGIBILITY,
    workflow_target_status: 'draft',
    item_type: 'single_best_answer',
    variant_form: spec.variant_form || 'vignette',
    variant_group_key: spec.variant_group_key || `variant.${slug}`,
    answer_provenance_status: 'AI_PROPOSED_ANSWER',
    evidence_support_status: 'CITATIONS_PROPOSED_UNVERIFIED',
    teaching_content_evidence_status: 'DISTRACTOR_AND_LEVEL3_CLAIMS_UNMAPPED_UNVERIFIED',
    content_sba: {
      stem: spec.stem,
      lead_in: spec.lead_in,
      choices: KEYS.map((key, index) => ({ key, text: spec.choices[index] })),
      answer_key: spec.answer_key,
      rationales: {
        correct_answer: spec.why_correct,
        distractors,
      },
      explanation: {
        level_1: spec.why_correct,
        level_2: level2,
        level_3: {
          clinical_pearls: spec.clinical_pearls,
          board_relevance: spec.board_relevance,
          interview_relevance: `Educational oral-reasoning relevance only; not validated for residency selection: ${spec.interview_relevance}`,
          common_traps: spec.common_traps,
          memory_aid: spec.memory_aid,
        },
      },
    },
    classification: {
      taxonomy_version: TAXONOMY_VERSION,
      misconception_vocabulary_version: MISCONCEPTION_VOCABULARY_VERSION,
      primary_specialty: spec.primary_specialty,
      organ_system: spec.organ_system,
      topic: spec.topic,
      subtopic: spec.subtopic,
      primary_concept_id: `concept.${identifier(spec.primary_specialty)}.${identifier(spec.concept)}`,
      clinical_task: spec.clinical_task,
      reasoning_pattern: spec.reasoning_pattern,
      difficulty_tier: spec.difficulty_tier,
      interview_competency: spec.interview_competency,
      question_mode: spec.question_mode || 'clinical_scenario',
      cognitive_level: spec.cognitive_level,
      learner_stage: 'pre_residency_clinical_review',
      risk_tier: spec.risk_tier,
      difficulty_evidence_status: 'EDITORIAL_LABEL_NOT_EMPIRICALLY_CALIBRATED',
      interview_competency_evidence_status: 'CONTENT_TARGET_NOT_MEASURED_BY_SBA',
      misconception_inference_status: 'AUTHOR_HYPOTHESIS_NOT_LEARNER_OBSERVED',
      ai_draft_confidence: spec.ai_draft_confidence || 'moderate',
      confidence_limit: 'NOT_MEDICAL_VALIDATION_OR_PSYCHOMETRIC_EVIDENCE',
      img_fairness_review_status: 'AI_REVIEWED_PENDING_HUMAN',
    },
    source_bundle: {
      transcript_linkage_status: 'NOT_APPLICABLE_AUTHORITY_DERIVED',
      authoring_run_id: AUTHORITY_AUTHORING_RUN_ID,
      transcript_extraction_run_id: null,
      prompt_contract_version: AUTHORITY_PROMPT_VERSION,
      source_refs: sourceRefs,
      merge_status: mergeDecision.merge_status,
      merge_decision_hash: sha256(mergeDecision),
      all_occurrences_preserved: false,
      occurrence_preservation_status: mergeDecision.occurrence_preservation_status,
    },
    evidence_claims: [{
      claim_id: `claim.${slug}.answer`,
      claim_text: spec.claim_text || spec.why_correct,
      claim_type: spec.claim_type,
      claim_scope: 'KEYED_ANSWER_ONLY',
      authority_class: spec.authority_class || 'standard_reference',
      currency_class: spec.currency_class,
      status: 'AI_DRAFT_UNVERIFIED',
      verification_status: 'UNVERIFIED_AI_DRAFT',
      verified_by: null,
      evidence_review_date: null,
      review_by_date: references.map((reference) => reference.review_by_date).sort()[0],
      claim_entailment_status: 'AI_ASSESSED_PENDING_PHYSICIAN',
      option_keys_supported: [spec.answer_key],
      authority_refs: references,
    }],
    quality_attestations: {
      one_best_answer_ai_review: true,
      no_giveaway_wording_ai_review: true,
      no_trick_wording_ai_review: true,
      choice_homogeneity_ai_review: true,
      grammar_parallelism_ai_review: true,
      no_length_giveaway_ai_review: optionLengthPass(spec.choices, spec.answer_key),
      pre_residency_clinical_review_relevance_ai_attestation: true,
      img_fairness_ai_screen_pending_human: true,
    },
    authoring: {
      generated_by: 'I1Q_1008C_SOURCE_FACTORY',
      authorship_status: 'AI_ASSISTED_DRAFT',
      as_of_date: '2026-07-16',
    },
    warnings: [
      'PHYSICIAN_REVIEW_REQUIRED',
      'NOT_RELEASE_ELIGIBLE',
      'CITATIONS_NOT_IMMUTABLY_RESOLVED',
      'NO_PSYCHOMETRIC_RESPONSE_DATA',
      'DISTRACTOR_AND_LEVEL3_CLAIMS_UNMAPPED_UNVERIFIED',
      'NOT_VALIDATED_FOR_RESIDENCY_SELECTION_OR_PERFORMANCE_PREDICTION',
    ],
    future_compatibility: {
      current_contract: 'SBA_ONLY_ARCHITECTURE_1002_1',
      versioning: 'REVISION_NUMBER_PLUS_IMMUTABLE_CONTENT_HASH',
      noncanonical_future_states: ['inactive', 'archived'],
    },
  };
  return withCandidateContentHash(candidate);
}

export function authoringRunArtifact(candidates, inputBindings, outputLibraryBinding) {
  const authoringContract = {
    version: AUTHORITY_PROMPT_VERSION,
    item_type: 'single_best_answer',
    choices: 4,
    required_explanation_levels: 3,
    required_status: 'AI_DRAFT_NOT_MEDICALLY_VALIDATED',
    release_eligibility: 'BLOCKED',
    evidence_mode: 'OFFICIAL_OR_PRIMARY_LINKS_PROPOSED_UNVERIFIED',
  };
  const artifact = {
    schema_version: 'missionmed.i1q.authoring_run.v2',
    authoring_run_id: AUTHORITY_AUTHORING_RUN_ID,
    run_type: 'AUTHORITY_DERIVED_AI_ASSISTED_CURATION',
    as_of_date: AUTHORITY_AUTHORING_AS_OF_DATE,
    status: 'COMPLETED_QUARANTINED_DRAFTS',
    classification_level: 'CLASS_D_INTERNAL_ANSWER_BEARING',
    am4_provenance_status: 'PARTIAL_RUNTIME_MODEL_PROMPT_PARAMETERS_NOT_CAPTURED',
    model_prompt_provenance: {
      mpv_id: null,
      record_status: 'NOT_MINTED_EXACT_RUNTIME_METADATA_UNAVAILABLE',
      model_label: null,
      prompt_template_sha256: null,
      parameters: null,
      missing_fields: ['model_label', 'prompt_template_sha256', 'parameters'],
    },
    authoring_contract: authoringContract,
    authoring_contract_sha256: sha256(authoringContract),
    input_bindings: [...inputBindings]
      .filter((binding) => AUTHORITY_AUTHORING_INPUT_PATHS.includes(binding.path))
      .sort((left, right) => left.path.localeCompare(right.path, 'en')),
    candidate_count: candidates.length,
    candidate_bindings: candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      content_hash: candidate.content_hash,
    })),
    output_library_binding: structuredClone(outputLibraryBinding),
    medical_validation_status: 'NOT_PERFORMED',
    physician_review_status: 'NOT_PERFORMED',
    release_eligibility: 'BLOCKED',
    warnings: [
      'AM4_RUNTIME_PROVENANCE_INCOMPLETE',
      'NOT_A_TRANSCRIPT_EXTRACTION_RUN',
      'MODEL_PROMPT_VERSION_NOT_MINTED',
      'PHYSICIAN_REVIEW_REQUIRED',
      'NOT_RELEASE_ELIGIBLE',
    ],
  };
  artifact.content_hash = sha256(artifact);
  return artifact;
}

export function renderCandidateLibraryMarkdown(candidates, asOfDate = AUTHORITY_AUTHORING_AS_OF_DATE) {
  const lines = [
    '# I1Q-1008C Quarantined SBA Benchmark',
    '',
    '> CLASS D — INTERNAL ANSWER-BEARING CONTENT. AI-assisted drafts only. Physician review is required. Every item is blocked from release and has no psychometric response data.',
    '',
    '> Supplemental authority-derived editorial benchmark only: 0 transcript-derived candidates and 0 canonical Dr. J corpus coverage. This reviewer-facing rendering exposes internal IDs and draft keys and must never be used as a learner projection.',
    '',
    `As-of date: ${asOfDate}. Candidate count: ${candidates.length}.`,
    '',
  ];
  candidates.forEach((candidate, index) => {
    const content = candidate.content_sba;
    lines.push(`## ${index + 1}. ${candidate.classification.topic.replaceAll('_', ' ')}`);
    lines.push('');
    lines.push(`Candidate: \`${candidate.candidate_id}\``);
    lines.push('');
    lines.push(`Specialty: ${candidate.classification.primary_specialty}`);
    lines.push('');
    lines.push(`Status: ${candidate.medical_validation_status}; ${candidate.review_gate_status}; ${candidate.release_eligibility}`);
    lines.push('');
    lines.push(content.stem);
    lines.push('');
    lines.push(content.lead_in);
    lines.push('');
    for (const choice of content.choices) lines.push(`- ${choice.key}. ${choice.text}`);
    lines.push('');
    lines.push(`**Draft key:** ${content.answer_key}`);
    lines.push('');
    lines.push(`**Level 1:** ${content.explanation.level_1}`);
    lines.push('');
    lines.push('**Level 2:**');
    lines.push('');
    for (const key of KEYS) lines.push(`- ${key}: ${content.explanation.level_2[key]}`);
    lines.push('');
    lines.push('**Level 3:**');
    lines.push('');
    for (const pearl of content.explanation.level_3.clinical_pearls) lines.push(`- Clinical pearl: ${pearl}`);
    lines.push(`- Board relevance: ${content.explanation.level_3.board_relevance}`);
    lines.push(`- Interview relevance: ${content.explanation.level_3.interview_relevance}`);
    for (const trap of content.explanation.level_3.common_traps) lines.push(`- Common trap: ${trap}`);
    lines.push(`- Memory aid: ${content.explanation.level_3.memory_aid}`);
    lines.push('');
    lines.push('**Proposed authority links (unverified draft citations):**');
    lines.push('');
    for (const claim of candidate.evidence_claims) {
      for (const reference of claim.authority_refs) lines.push(`- [${reference.title}](${reference.url}) — ${reference.publisher}; ${reference.locator}`);
    }
    lines.push('');
  });
  return `${lines.join('\n').trimEnd()}\n`;
}
