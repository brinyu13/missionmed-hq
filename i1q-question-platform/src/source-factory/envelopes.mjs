import { isDeepStrictEqual } from 'node:util';
import { sha256 } from '../hash.mjs';
import {
  AUTHORITY_AUTHORING_INPUT_PATHS,
  SOURCE_FACTORY_ARTIFACT_PATHS,
  SOURCE_FACTORY_INPUT_PATHS,
} from './contracts.mjs';

const AS_OF_DATE = '2026-07-16';
const HASH = /^[a-f0-9]{64}$/u;

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

function add(errors, condition, code) {
  if (!condition) errors.push(code);
}

export function validateBuildManifestEnvelope(manifest) {
  const errors = [];
  if (!exactKeys(manifest, [
    'schema_version', 'as_of_date', 'build_status', 'self_embedding', 'input_count', 'inputs',
    'artifact_count', 'artifacts', 'invariants', 'manifest_payload_hash',
  ])) return ['manifest_envelope_invalid'];
  add(errors, manifest.schema_version === 'missionmed.i1q.source_factory.build_manifest.v1', 'manifest_schema_invalid');
  add(errors, manifest.as_of_date === AS_OF_DATE, 'manifest_as_of_date_invalid');
  add(errors, manifest.build_status === 'pass_incomplete_corpus_handoff_and_quarantined_drafts_only', 'manifest_build_status_invalid');
  add(errors, manifest.self_embedding === false, 'manifest_self_embedding_invalid');
  add(errors, Array.isArray(manifest.inputs) && manifest.input_count === SOURCE_FACTORY_INPUT_PATHS.length
    && manifest.inputs.length === SOURCE_FACTORY_INPUT_PATHS.length, 'manifest_input_count_invalid');
  add(errors, Array.isArray(manifest.artifacts) && manifest.artifact_count === SOURCE_FACTORY_ARTIFACT_PATHS.length
    && manifest.artifacts.length === SOURCE_FACTORY_ARTIFACT_PATHS.length, 'manifest_artifact_count_invalid');
  if (Array.isArray(manifest.inputs)) {
    add(errors, isDeepStrictEqual(manifest.inputs.map((record) => record?.path).sort(), [...SOURCE_FACTORY_INPUT_PATHS].sort()), 'manifest_input_membership_invalid');
    add(errors, manifest.inputs.every((record) => exactKeys(record, ['path', 'bytes', 'sha256'])
      && Number.isInteger(record.bytes) && record.bytes > 0 && HASH.test(record.sha256 || '')), 'manifest_input_record_invalid');
  }
  if (Array.isArray(manifest.artifacts)) {
    add(errors, isDeepStrictEqual(manifest.artifacts.map((record) => record?.path).sort(), [...SOURCE_FACTORY_ARTIFACT_PATHS].sort()), 'manifest_artifact_membership_invalid');
    add(errors, manifest.artifacts.every((record) => exactKeys(record, ['path', 'bytes', 'sha256'])
      && Number.isInteger(record.bytes) && record.bytes > 0 && HASH.test(record.sha256 || '')), 'manifest_artifact_record_invalid');
  }
  const expectedInvariants = {
    source_mutations: 0,
    production_mutations: 0,
    prior_point_in_time_authorized_source_aggregate: 97,
    current_transcript_artifacts_discovered: 0,
    corpus_proven_complete: false,
    transcript_artifacts_processed: 0,
    explicit_questions_extracted: 0,
    implicit_or_reconstructed_questions_extracted: 0,
    teaching_statements_converted: 0,
    unique_transcript_concepts_after_deduplication: 0,
    legacy_rows_audited_secondary_only: 845,
    legacy_rows_without_established_transcript_provenance: 845,
    transcript_derived_candidates: 0,
    authority_derived_quarantined_candidates: 24,
    physician_approved_candidates: 0,
    release_eligible_candidates: 0,
  };
  add(errors, isDeepStrictEqual(manifest.invariants, expectedInvariants), 'manifest_invariants_invalid');
  const payload = structuredClone(manifest);
  delete payload.manifest_payload_hash;
  add(errors, HASH.test(manifest.manifest_payload_hash || '') && manifest.manifest_payload_hash === sha256(payload), 'manifest_payload_hash_invalid');
  return errors;
}

export function validateCandidateLibraryEnvelope(library) {
  const errors = [];
  if (!exactKeys(library, [
    'schema_version', 'as_of_date', 'classification_level', 'status', 'release_eligibility',
    'library_role', 'canonical_transcript_coverage', 'physician_review_status',
    'psychometric_response_data_status', 'form_assembly_policy', 'candidates', 'content_hash',
  ])) return ['candidate_library_envelope_invalid'];
  add(errors, library.schema_version === 'missionmed.i1q.source_factory.library.v1', 'candidate_library_schema_invalid');
  add(errors, library.as_of_date === AS_OF_DATE, 'candidate_library_as_of_date_invalid');
  add(errors, library.classification_level === 'CLASS_D_INTERNAL_ANSWER_BEARING', 'candidate_library_classification_invalid');
  add(errors, library.status === 'AI_DRAFT_NOT_MEDICALLY_VALIDATED', 'candidate_library_medical_status_invalid');
  add(errors, library.library_role === 'SUPPLEMENTAL_AUTHORITY_DERIVED_EDITORIAL_BENCHMARK', 'candidate_library_role_invalid');
  add(errors, library.canonical_transcript_coverage === 'ZERO_TRANSCRIPT_DERIVED_CANDIDATES', 'candidate_library_transcript_coverage_invalid');
  add(errors, library.release_eligibility === 'BLOCKED', 'candidate_library_release_not_blocked');
  add(errors, library.physician_review_status === 'REQUIRED_NOT_COMPLETED', 'candidate_library_physician_status_invalid');
  add(errors, library.psychometric_response_data_status === 'NOT_COLLECTED', 'candidate_library_psychometric_status_invalid');
  add(errors, isDeepStrictEqual(library.form_assembly_policy, {
    status: 'REQUIRED_DOWNSTREAM_ENFORCEMENT',
    randomize_delivery_order: true,
    reject_periodic_answer_sequences: true,
    exclude_same_variant_group_from_form: true,
    review_same_primary_topic_for_local_dependence: true,
    learner_projection_excludes_internal_ids_keys_and_concept_metadata: true,
  }), 'candidate_library_form_assembly_policy_invalid');
  add(errors, Array.isArray(library.candidates) && library.candidates.length === 24, 'candidate_library_count_invalid');
  const payload = structuredClone(library);
  delete payload.content_hash;
  add(errors, HASH.test(library.content_hash || '') && library.content_hash === sha256(payload), 'candidate_library_content_hash_invalid');
  return errors;
}

export function validateAuthoringRunEnvelope(run) {
  const errors = [];
  if (!exactKeys(run, [
    'schema_version', 'authoring_run_id', 'run_type', 'as_of_date', 'status', 'classification_level',
    'am4_provenance_status', 'model_prompt_provenance', 'authoring_contract', 'authoring_contract_sha256',
    'input_bindings', 'candidate_count', 'candidate_bindings', 'output_library_binding',
    'medical_validation_status', 'physician_review_status', 'release_eligibility', 'warnings', 'content_hash',
  ])) return ['authoring_run_envelope_invalid'];
  add(errors, run.schema_version === 'missionmed.i1q.authoring_run.v2', 'authoring_run_schema_invalid');
  add(errors, run.authoring_run_id === 'authoring.i1q1008c.authority.curation.20260716', 'authoring_run_id_invalid');
  add(errors, run.run_type === 'AUTHORITY_DERIVED_AI_ASSISTED_CURATION', 'authoring_run_type_invalid');
  add(errors, run.as_of_date === AS_OF_DATE, 'authoring_run_as_of_date_invalid');
  add(errors, run.status === 'COMPLETED_QUARANTINED_DRAFTS', 'authoring_run_status_invalid');
  add(errors, run.classification_level === 'CLASS_D_INTERNAL_ANSWER_BEARING', 'authoring_run_classification_invalid');
  add(errors, run.am4_provenance_status === 'PARTIAL_RUNTIME_MODEL_PROMPT_PARAMETERS_NOT_CAPTURED', 'authoring_run_am4_status_invalid');
  const expectedModelPromptProvenance = {
    mpv_id: null,
    record_status: 'NOT_MINTED_EXACT_RUNTIME_METADATA_UNAVAILABLE',
    model_label: null,
    prompt_template_sha256: null,
    parameters: null,
    missing_fields: ['model_label', 'prompt_template_sha256', 'parameters'],
  };
  add(errors, isDeepStrictEqual(run.model_prompt_provenance, expectedModelPromptProvenance), 'authoring_run_partial_provenance_invalid');
  const expectedAuthoringContract = {
    version: 'i1q-1008c-authority-curation-v1',
    item_type: 'single_best_answer',
    choices: 4,
    required_explanation_levels: 3,
    required_status: 'AI_DRAFT_NOT_MEDICALLY_VALIDATED',
    release_eligibility: 'BLOCKED',
    evidence_mode: 'OFFICIAL_OR_PRIMARY_LINKS_PROPOSED_UNVERIFIED',
  };
  add(errors, isDeepStrictEqual(run.authoring_contract, expectedAuthoringContract), 'authoring_run_contract_invalid');
  add(errors, HASH.test(run.authoring_contract_sha256 || '')
    && run.authoring_contract_sha256 === sha256(expectedAuthoringContract), 'authoring_run_contract_hash_invalid');
  add(errors, Array.isArray(run.input_bindings)
    && isDeepStrictEqual(run.input_bindings.map((binding) => binding?.path).sort(), [...AUTHORITY_AUTHORING_INPUT_PATHS].sort()), 'authoring_run_input_membership_invalid');
  if (Array.isArray(run.input_bindings)) {
    add(errors, run.input_bindings.every((binding) => exactKeys(binding, ['path', 'bytes', 'sha256'])
      && Number.isInteger(binding.bytes) && binding.bytes > 0 && HASH.test(binding.sha256 || '')), 'authoring_run_input_binding_invalid');
  }
  add(errors, run.candidate_count === 24 && Array.isArray(run.candidate_bindings)
    && run.candidate_bindings.length === 24, 'authoring_run_candidate_count_invalid');
  if (Array.isArray(run.candidate_bindings)) {
    add(errors, run.candidate_bindings.every((binding) => exactKeys(binding, ['candidate_id', 'content_hash'])
      && typeof binding.candidate_id === 'string' && binding.candidate_id.startsWith('candidate.')
      && HASH.test(binding.content_hash || '')), 'authoring_run_candidate_binding_invalid');
    add(errors, new Set(run.candidate_bindings.map((binding) => binding?.candidate_id)).size === 24, 'authoring_run_candidate_binding_duplicate');
  }
  add(errors, exactKeys(run.output_library_binding, ['path', 'bytes', 'sha256', 'content_hash'])
    && run.output_library_binding.path === 'i1q-question-platform/content/i1q-1008c/generated/candidate-library.json'
    && Number.isInteger(run.output_library_binding.bytes) && run.output_library_binding.bytes > 0
    && HASH.test(run.output_library_binding.sha256 || '')
    && HASH.test(run.output_library_binding.content_hash || ''), 'authoring_run_output_binding_invalid');
  add(errors, run.medical_validation_status === 'NOT_PERFORMED', 'authoring_run_medical_status_invalid');
  add(errors, run.physician_review_status === 'NOT_PERFORMED', 'authoring_run_physician_status_invalid');
  add(errors, run.release_eligibility === 'BLOCKED', 'authoring_run_release_overclaim');
  add(errors, isDeepStrictEqual(run.warnings, [
    'AM4_RUNTIME_PROVENANCE_INCOMPLETE',
    'NOT_A_TRANSCRIPT_EXTRACTION_RUN',
    'MODEL_PROMPT_VERSION_NOT_MINTED',
    'PHYSICIAN_REVIEW_REQUIRED',
    'NOT_RELEASE_ELIGIBLE',
  ]), 'authoring_run_warnings_invalid');
  const payload = structuredClone(run);
  delete payload.content_hash;
  add(errors, HASH.test(run.content_hash || '') && run.content_hash === sha256(payload), 'authoring_run_content_hash_invalid');
  return errors;
}

export function validateTranscriptGateEnvelope(gate) {
  const errors = [];
  if (!exactKeys(gate, [
    'schema_version', 'status', 'transcript_candidate_generation_allowed', 'medical_approval_allowed',
    'release_allowed', 'drafting_blockers', 'approval_blockers', 'blockers', 'qualification', 'content_hash',
  ])) return ['transcript_gate_envelope_invalid'];
  add(errors, gate.schema_version === 'missionmed.i1q.transcript_factory_gate.v1', 'transcript_gate_schema_invalid');
  add(errors, gate.status === 'BLOCKED', 'transcript_gate_status_invalid');
  add(errors, gate.transcript_candidate_generation_allowed === false, 'transcript_generation_overclaim');
  add(errors, gate.medical_approval_allowed === false, 'transcript_medical_approval_overclaim');
  add(errors, gate.release_allowed === false, 'transcript_release_overclaim');
  add(errors, Array.isArray(gate.drafting_blockers) && gate.drafting_blockers.length > 0, 'transcript_drafting_blockers_missing');
  add(errors, Array.isArray(gate.approval_blockers) && gate.approval_blockers.includes('credentialed_medical_governance_unassigned'), 'transcript_approval_blocker_missing');
  add(errors, Array.isArray(gate.blockers)
    && isDeepStrictEqual(gate.blockers, [...gate.drafting_blockers, ...gate.approval_blockers]), 'transcript_blocker_union_invalid');
  const payload = structuredClone(gate);
  delete payload.content_hash;
  add(errors, HASH.test(gate.content_hash || '') && gate.content_hash === sha256(payload), 'transcript_gate_content_hash_invalid');
  return errors;
}
