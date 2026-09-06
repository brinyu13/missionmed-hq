import { sha256 } from '../hash.mjs';
import { workspaceCorpusProbeValid } from './workspace-corpus-probe.mjs';

const AS_OF_DATE = '2026-07-16';

const AUTHORITY_ORDER = Object.freeze([
  Object.freeze({
    rank: 1,
    source: 'COMPLETE_DRJ_TRANSCRIPT_CORPUS',
    role: 'CANONICAL_EXTRACTION_AND_OCCURRENCE_SOURCE',
  }),
  Object.freeze({
    rank: 2,
    source: 'TRANSCRIPT_DERIVED_MEDICAL_TEACHING_QUESTIONS',
    role: 'CANONICAL_DERIVED_QUESTION_LAYER',
  }),
  Object.freeze({
    rank: 3,
    source: 'LEGACY_STAT_V4',
    role: 'SECONDARY_COMPARISON_ONLY',
  }),
  Object.freeze({
    rank: 4,
    source: 'FUTURE_SOURCES',
    role: 'EXCLUDED_UNLESS_EXPLICITLY_AUTHORIZED',
  }),
]);

const GX_LEDGER = Object.freeze([
  ['GX-0', 'FRESH_AUTHORITATIVE_SOURCE_UNIVERSE', 'BLOCKED'],
  ['GX-1', 'CORPUS_COMPLETENESS_ATTESTATION', 'BLOCKED'],
  ['GX-2', 'AUTHORIZED_SOURCE_BYTES_OR_OPAQUE_HANDLES', 'BLOCKED'],
  ['GX-3', 'PRIVACY_SAFE_WORKING_ARTIFACTS_AND_REDACTION_PROOF', 'BLOCKED'],
  ['GX-4', 'RIGHTS_AND_ATTRIBUTION_MANIFESTS', 'BLOCKED'],
  ['GX-5', 'SEGMENT_LEVEL_SPEAKER_AUTHORITY', 'BLOCKED'],
  ['GX-6', 'QUESTION_RECALL_GOLD_AND_OCCURRENCE_DENOMINATOR', 'BLOCKED'],
  ['GX-7', 'TRUSTED_DERIVATION_AUTHORIZATION', 'BLOCKED'],
  ['GX-8', 'EXTRACTION_RUN_MODEL_PROMPT_AND_PARAMETER_LINEAGE', 'BLOCKED'],
  ['GX-9', 'QUESTION_ANSWER_AND_TEACHING_SPAN_PROVENANCE', 'BLOCKED'],
  ['GX-10', 'SEMANTIC_DEDUPLICATION_AND_HUMAN_ADJUDICATION', 'BLOCKED'],
  ['GX-11', 'MEDICAL_PSYCHOMETRIC_AND_RELEASE_GOVERNANCE', 'BLOCKED'],
]);

function requiredInteger(value, code) {
  if (!Number.isInteger(value) || value < 0) throw new Error(code);
  return value;
}

function requiredBoolean(value, code) {
  if (typeof value !== 'boolean') throw new Error(code);
  return value;
}

export function transcriptResumeManifest({
  inventoryEvidence,
  workspaceProbe,
  corpusSnapshot,
  transcriptGate,
  legacyAudit,
  authorityCandidates,
}) {
  const counts = inventoryEvidence?.counts;
  if (!workspaceCorpusProbeValid(workspaceProbe)) throw new Error('resume_workspace_corpus_probe_invalid_or_stale');
  const localTranscriptArtifacts = requiredInteger(
    workspaceProbe.counts.transcript_or_caption_candidates,
    'resume_live_transcript_candidate_count_invalid',
  );
  const localNodesArtifacts = requiredInteger(
    workspaceProbe.counts.nodes_or_media_registry_candidates,
    'resume_live_nodes_candidate_count_invalid',
  );
  const extractionReady = requiredInteger(counts?.extraction_ready_sources, 'resume_extraction_ready_count_invalid');
  const priorAuthorizedSources = requiredInteger(counts?.authorized_sources, 'resume_prior_authorized_count_invalid');
  const historicalGitBlobs = requiredInteger(counts?.matching_historical_git_blobs, 'resume_historical_blob_count_invalid');
  const legacyRows = requiredInteger(legacyAudit?.row_count, 'resume_legacy_row_count_invalid');
  if (!Array.isArray(authorityCandidates)) throw new Error('resume_authority_candidates_invalid');
  if (localTranscriptArtifacts !== 0 || localNodesArtifacts !== 0 || extractionReady !== 0) {
    throw new Error('resume_zero_access_assumption_stale_reprobe_required');
  }
  if (legacyRows !== 845) throw new Error('resume_legacy_denominator_changed_reconcile_required');
  if (corpusSnapshot?.current_access_verified !== false
    || corpusSnapshot?.source_universe_completeness_status !== 'NOT_ESTABLISHED'
    || corpusSnapshot?.transcript_bytes_accessible_in_workspace !== false
    || requiredBoolean(corpusSnapshot?.row_manifest_retained, 'resume_row_manifest_flag_invalid') !== false
    || requiredBoolean(corpusSnapshot?.independently_recomputable_from_git, 'resume_recomputability_flag_invalid') !== false) {
    throw new Error('resume_corpus_snapshot_state_invalid');
  }
  if (transcriptGate?.status !== 'BLOCKED' || transcriptGate?.transcript_candidate_generation_allowed !== false) {
    throw new Error('resume_transcript_gate_not_blocked');
  }

  const authorityCandidateConceptCount = new Set(
    authorityCandidates.map((candidate) => candidate?.classification?.primary_concept_id).filter(Boolean),
  ).size;
  const authorityCandidateBinding = authorityCandidates.map((candidate) => ({
    candidate_id: candidate.candidate_id,
    content_hash: candidate.content_hash,
  }));

  const manifest = {
    schema_version: 'missionmed.i1q.transcript_resume_manifest.v1',
    as_of_date: AS_OF_DATE,
    status: 'INCOMPLETE_CORPUS_WORK_EXTERNAL_TRUST_BOUNDARY_REQUIRED',
    classification_level: 'CLASS_C_INTERNAL_AGGREGATE_ONLY_NO_TRANSCRIPT_CONTENT',
    authority_order: AUTHORITY_ORDER.map((entry) => ({ ...entry })),
    medical_correctness_authority: 'CURRENT_EXTERNAL_MEDICAL_EVIDENCE_PLUS_CREDENTIALED_PHYSICIAN_REVIEW',
    access_assessment: {
      current_workspace_probe_completed: true,
      current_workspace_probe_status: workspaceProbe.status,
      current_workspace_probe_scope: workspaceProbe.scope,
      current_workspace_probe_scanned_files: workspaceProbe.scanned_file_count,
      current_workspace_probe_is_completeness_proof: false,
      current_access_verified: false,
      complete_corpus_accessible: false,
      corpus_completeness_proven: false,
      source_universe_completeness_status: 'NOT_ESTABLISHED',
      transcript_bytes_accessible_in_current_workspace: false,
      actual_transcript_caption_or_vtt_artifacts_discovered: localTranscriptArtifacts,
      actual_nodes_or_media_registry_artifacts_discovered: localNodesArtifacts,
      actual_transcript_artifacts_processed: 0,
      prior_point_in_time_aggregate_authorized_sources: priorAuthorizedSources,
      prior_aggregate_source_observed_at: corpusSnapshot.source_observed_at,
      prior_aggregate_qualification: corpusSnapshot.qualification,
      prior_aggregate_is_current_access_proof: false,
      prior_aggregate_is_corpus_completeness_proof: false,
      prior_row_manifest_retained: false,
      prior_aggregate_independently_recomputable: false,
      historical_git_blobs_reported_by_prior_probe: historicalGitBlobs,
      historical_git_blobs_treated_as_current_corpus: false,
      extraction_ready_artifacts: extractionReady,
    },
    mandatory_metrics: {
      total_transcript_artifacts_discovered: 0,
      corpus_proven_complete: false,
      total_artifacts_processed: 0,
      total_explicit_questions_extracted: 0,
      total_implicit_or_reconstructed_questions_extracted: 0,
      total_medically_relevant_teaching_statements_converted: 0,
      total_unique_transcript_concepts_after_deduplication: 0,
      total_overlaps_with_legacy: {
        value: null,
        status: 'NOT_MEASURABLE_NO_TRANSCRIPT_EXTRACTION',
      },
      total_transcript_derived_absent_from_legacy: {
        value_observed: 0,
        status: 'NOT_MEASURABLE_NO_TRANSCRIPT_EXTRACTION',
      },
      total_legacy_rows_without_established_transcript_provenance: {
        value: legacyRows,
        status: 'NO_CURRENT_TRANSCRIPT_LINKAGE_ESTABLISHED',
        qualification: 'This is absence of established provenance, not evidence that the complete corpus lacks support.',
      },
      total_questions_with_four_choice_mcqs: {
        transcript_derived: 0,
        authority_derived_quarantined_benchmark: authorityCandidates.length,
        legacy_secondary_historical_rows: legacyRows,
      },
      total_medically_reviewed: 0,
      total_approved: 0,
      total_quarantined_candidates: {
        transcript_derived: 0,
        authority_derived: authorityCandidates.length,
        total: authorityCandidates.length,
      },
      total_legacy_secondary_rows_preserved_nonrelease: legacyRows,
      total_quarantined_or_nonrelease_answer_bearing_units: {
        candidate_objects: authorityCandidates.length,
        legacy_secondary_rows: legacyRows,
        total: authorityCandidates.length + legacyRows,
      },
      supplemental_authority_benchmark_unique_concepts: authorityCandidateConceptCount,
    },
    gx_gate_ledger: GX_LEDGER.map(([gate_id, requirement, status]) => ({ gate_id, requirement, status })),
    exact_blockers: [
      'fresh_authoritative_source_universe_and_completeness_receipt_missing',
      'actual_authorized_transcript_bytes_or_opaque_source_handles_missing',
      'privacy_safe_row_and_working_artifact_manifests_missing',
      'segment_level_drj_speaker_authority_manifest_missing',
      'rights_and_attribution_manifests_missing',
      'question_recall_gold_and_occurrence_denominator_missing',
      'trusted_derivation_authorization_and_verifier_missing',
      'extraction_run_model_prompt_and_parameter_lineage_missing',
      'question_answer_and_teaching_span_provenance_missing',
      'am11_single_speaker_stratum_absent_from_prior_all_multi_speaker_aggregate',
      'credentialed_physician_review_missing',
      'psychometric_response_data_missing',
    ],
    required_resume_inputs: [
      {
        id: 'complete_source_universe_manifest',
        requirement: 'Signed or equivalently trusted content-addressed enumeration of every authorized Dr. J source, with completeness authority, acquisition time, source count, opaque source IDs, per-source hashes or immutable handles, and explicit additions/removals since the prior observation.',
      },
      {
        id: 'segment_authority_manifest',
        requirement: 'Per-source and per-segment Dr. J speaker authority with opaque locators, adjudication status, and content hash; a source-level Dr. J label is insufficient.',
      },
      {
        id: 'privacy_rights_working_artifact_bundle',
        requirement: 'Authorized privacy-safe working transcript artifacts plus redaction, rights, attribution, and deterministic rerun manifests bound to the complete source universe.',
      },
      {
        id: 'recall_and_occurrence_gold',
        requirement: 'Question-recall denominator and occurrence gold covering explicit, incomplete, implicit, rapid-fire, pivot, differential, next-step, mechanism, management, interpretation, and convertible teaching-statement channels.',
      },
      {
        id: 'trusted_verifier_adapter',
        requirement: 'New ratified trusted-boundary verifier and candidate binding contract for corpus snapshot, authorization, source occurrence, question/answer spans, extraction run, model, prompt, parameters, and human adjudication.',
      },
      {
        id: 'am11_resolution',
        requirement: 'Inventory expansion yielding a valid single-speaker stratum or a ratified protocol exception; the prior aggregate reports 97 of 97 sources as multi-speaker.',
      },
    ],
    resume_entry_point: {
      resume_requires_code_change: true,
      boundary: 'NEWLY_RATIFIED_TRUSTED_RESTRICTED_CORPUS_EXECUTION_BOUNDARY',
      first_gate: 'GX-0_FRESH_AUTHORITATIVE_SOURCE_UNIVERSE',
      implementation_entry_point: 'i1q-question-platform/src/source-factory/restricted-corpus.mjs#evaluateTranscriptFactoryGate',
      verification_entry_point: 'i1q-question-platform/scripts/validate-source-factory.mjs',
      rebuild_command_after_trusted_inputs_exist: 'npm --prefix i1q-question-platform run source-factory:build',
      exact_next_action: 'Reacquire the complete authoritative Dr. J source universe inside a newly ratified trusted restricted boundary without assuming 97; emit signed content-addressed completeness and segment-authority manifests; create authorized privacy-safe working artifacts; then implement the trusted verifier adapter and resume at GX-0.',
    },
    evidence_bindings: {
      inventory_evidence_semantic_hash: sha256(inventoryEvidence),
      workspace_corpus_access_probe_content_hash: workspaceProbe.content_hash,
      restricted_corpus_snapshot_content_hash: corpusSnapshot.content_hash,
      transcript_factory_gate_content_hash: transcriptGate.content_hash,
      legacy_audit_content_hash: legacyAudit.content_hash,
      authority_candidate_binding_hash: sha256(authorityCandidateBinding),
    },
    safety_invariants: {
      contains_transcript_content: false,
      contains_identity_bearing_source_metadata: false,
      treats_prior_97_as_complete_corpus: false,
      treats_legacy_as_canonical_extraction_source: false,
      production_mutations: 0,
      consumer_connections_changed: false,
      feature_flags_changed: false,
    },
  };
  manifest.content_hash = sha256(manifest);
  return manifest;
}
