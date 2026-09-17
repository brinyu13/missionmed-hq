import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PILOT_LIBRARY } from '../content/i1q-1008c/pilot-library.mjs';
import { sha256 } from '../src/hash.mjs';
import { authoringRunArtifact, renderCandidateLibraryMarkdown } from '../src/source-factory/authoring.mjs';
import {
  AUTHORITY_AUTHORING_INPUT_PATHS,
  SOURCE_FACTORY_ARTIFACT_PATHS,
  SOURCE_FACTORY_INPUT_PATHS,
} from '../src/source-factory/contracts.mjs';
import { auditCandidateDedupe } from '../src/source-factory/dedupe.mjs';
import { auditLegacyV4, parseLegacyV4Migration } from '../src/source-factory/legacy-v4.mjs';
import { validateCandidateLibrary } from '../src/source-factory/quality.mjs';
import { evaluateTranscriptFactoryGate, retainedAggregateSnapshot } from '../src/source-factory/restricted-corpus.mjs';
import { taxonomyArtifact } from '../src/source-factory/taxonomy.mjs';
import { transcriptResumeManifest } from '../src/source-factory/transcript-resume.mjs';
import { probeWorkspaceCorpusAccess, workspaceCorpusProbeValid } from '../src/source-factory/workspace-corpus-probe.mjs';
import {
  validateBuildManifestEnvelope,
  validateAuthoringRunEnvelope,
  validateCandidateLibraryEnvelope,
  validateTranscriptGateEnvelope,
} from '../src/source-factory/envelopes.mjs';

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WORKTREE = dirname(APP_ROOT);
const EVIDENCE_ROOT = join(APP_ROOT, 'evidence/source-factory');
const CONTENT_ROOT = join(APP_ROOT, 'content/i1q-1008c/generated');
const AS_OF_DATE = '2026-07-16';

function fail(condition, code) {
  if (!condition) throw new Error(code);
}

function byteSha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

async function load(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function validateFileRecord(record, allowedPaths, kind) {
  fail(exactKeys(record, ['path', 'bytes', 'sha256']), `${kind}_record_shape_invalid`);
  fail(allowedPaths.includes(record.path), `${kind}_path_unexpected:${record.path}`);
  const absolute = resolve(WORKTREE, record.path);
  fail(absolute.startsWith(`${WORKTREE}/`), `${kind}_outside_worktree:${record.path}`);
  const info = await stat(absolute);
  const content = await readFile(absolute);
  fail(info.isFile() && info.size === record.bytes, `${kind}_bytes_invalid:${record.path}`);
  fail(byteSha256(content) === record.sha256, `${kind}_hash_invalid:${record.path}`);
}

async function main() {
  const manifest = await load(join(EVIDENCE_ROOT, 'build-manifest.json'));
  fail(validateBuildManifestEnvelope(manifest).length === 0, `manifest_envelope_findings:${validateBuildManifestEnvelope(manifest).join(',')}`);
  fail(exactKeys(manifest, [
    'schema_version', 'as_of_date', 'build_status', 'self_embedding', 'input_count', 'inputs',
    'artifact_count', 'artifacts', 'invariants', 'manifest_payload_hash',
  ]), 'manifest_envelope_invalid');
  fail(manifest.schema_version === 'missionmed.i1q.source_factory.build_manifest.v1', 'manifest_schema_invalid');
  fail(manifest.as_of_date === AS_OF_DATE, 'manifest_as_of_date_invalid');
  fail(manifest.build_status === 'pass_incomplete_corpus_handoff_and_quarantined_drafts_only', 'manifest_build_status_invalid');
  fail(manifest.self_embedding === false, 'manifest_self_embedding_invalid');
  fail(Array.isArray(manifest.inputs) && manifest.input_count === SOURCE_FACTORY_INPUT_PATHS.length
    && manifest.inputs.length === SOURCE_FACTORY_INPUT_PATHS.length, 'manifest_input_count_invalid');
  fail(Array.isArray(manifest.artifacts) && manifest.artifact_count === SOURCE_FACTORY_ARTIFACT_PATHS.length
    && manifest.artifacts.length === SOURCE_FACTORY_ARTIFACT_PATHS.length, 'manifest_artifact_count_invalid');
  fail(isDeepStrictEqual(manifest.inputs.map((record) => record.path).sort(), [...SOURCE_FACTORY_INPUT_PATHS].sort()), 'manifest_input_membership_invalid');
  fail(isDeepStrictEqual(manifest.artifacts.map((record) => record.path).sort(), [...SOURCE_FACTORY_ARTIFACT_PATHS].sort()), 'manifest_artifact_membership_invalid');
  for (const input of manifest.inputs) await validateFileRecord(input, SOURCE_FACTORY_INPUT_PATHS, 'input');
  for (const artifact of manifest.artifacts) await validateFileRecord(artifact, SOURCE_FACTORY_ARTIFACT_PATHS, 'artifact');
  fail(exactKeys(manifest.invariants, [
    'source_mutations', 'production_mutations', 'prior_point_in_time_authorized_source_aggregate',
    'current_transcript_artifacts_discovered', 'corpus_proven_complete',
    'transcript_artifacts_processed', 'explicit_questions_extracted',
    'implicit_or_reconstructed_questions_extracted', 'teaching_statements_converted',
    'unique_transcript_concepts_after_deduplication', 'legacy_rows_audited_secondary_only',
    'legacy_rows_without_established_transcript_provenance',
    'transcript_derived_candidates', 'authority_derived_quarantined_candidates',
    'physician_approved_candidates', 'release_eligible_candidates',
  ]), 'manifest_invariants_shape_invalid');
  fail(isDeepStrictEqual(manifest.invariants, {
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
  }), 'manifest_invariants_invalid');
  const manifestPayload = structuredClone(manifest);
  delete manifestPayload.manifest_payload_hash;
  fail(manifest.manifest_payload_hash === sha256(manifestPayload), 'manifest_payload_hash_invalid');

  const candidateLibraryAbsolutePath = join(CONTENT_ROOT, 'candidate-library.json');
  const candidateLibraryBytes = await readFile(candidateLibraryAbsolutePath);
  const candidateLibrary = JSON.parse(candidateLibraryBytes.toString('utf8'));
  fail(validateCandidateLibraryEnvelope(candidateLibrary).length === 0, `candidate_library_envelope_findings:${validateCandidateLibraryEnvelope(candidateLibrary).join(',')}`);
  fail(exactKeys(candidateLibrary, [
    'schema_version', 'as_of_date', 'classification_level', 'status', 'release_eligibility',
    'library_role', 'canonical_transcript_coverage', 'physician_review_status',
    'psychometric_response_data_status', 'form_assembly_policy', 'candidates', 'content_hash',
  ]), 'candidate_library_envelope_invalid');
  fail(candidateLibrary.schema_version === 'missionmed.i1q.source_factory.library.v1', 'candidate_library_schema_invalid');
  fail(candidateLibrary.as_of_date === AS_OF_DATE, 'candidate_library_as_of_date_invalid');
  fail(candidateLibrary.classification_level === 'CLASS_D_INTERNAL_ANSWER_BEARING', 'candidate_library_classification_invalid');
  fail(candidateLibrary.status === 'AI_DRAFT_NOT_MEDICALLY_VALIDATED', 'candidate_library_medical_status_invalid');
  fail(candidateLibrary.library_role === 'SUPPLEMENTAL_AUTHORITY_DERIVED_EDITORIAL_BENCHMARK', 'candidate_library_role_invalid');
  fail(candidateLibrary.canonical_transcript_coverage === 'ZERO_TRANSCRIPT_DERIVED_CANDIDATES', 'candidate_library_transcript_coverage_invalid');
  fail(candidateLibrary.release_eligibility === 'BLOCKED', 'candidate_library_release_not_blocked');
  fail(candidateLibrary.physician_review_status === 'REQUIRED_NOT_COMPLETED', 'candidate_library_physician_status_invalid');
  fail(candidateLibrary.psychometric_response_data_status === 'NOT_COLLECTED', 'candidate_library_psychometric_status_invalid');
  fail(isDeepStrictEqual(candidateLibrary.form_assembly_policy, {
    status: 'REQUIRED_DOWNSTREAM_ENFORCEMENT',
    randomize_delivery_order: true,
    reject_periodic_answer_sequences: true,
    exclude_same_variant_group_from_form: true,
    review_same_primary_topic_for_local_dependence: true,
    learner_projection_excludes_internal_ids_keys_and_concept_metadata: true,
  }), 'candidate_library_form_assembly_policy_invalid');
  const libraryPayload = structuredClone(candidateLibrary);
  delete libraryPayload.content_hash;
  fail(candidateLibrary.content_hash === sha256(libraryPayload), 'candidate_library_content_hash_invalid');
  fail(isDeepStrictEqual(candidateLibrary.candidates, PILOT_LIBRARY), 'candidate_library_stale_against_authoring_inputs');
  fail(await readFile(join(CONTENT_ROOT, 'candidate-library.md'), 'utf8') === renderCandidateLibraryMarkdown(PILOT_LIBRARY, AS_OF_DATE), 'candidate_library_markdown_stale_against_authoring_inputs');
  const validation = validateCandidateLibrary(candidateLibrary.candidates);
  fail(validation.errors.length === 0, `candidate_validation_failed:${validation.errors.join(',')}`);
  fail(isDeepStrictEqual(validation.metrics.answer_distribution, { A: 6, B: 6, C: 6, D: 6 }), 'candidate_answer_distribution_invalid');

  const expectedValidation = {
    schema_version: 'missionmed.i1q.source_factory.validation.v1',
    as_of_date: AS_OF_DATE,
    status: 'pass_quarantined_candidate_contract_only',
    ...validation.metrics,
    medical_accuracy_validated: false,
    physician_review_complete: false,
    release_eligible: false,
    validator_errors: [],
  };
  fail(isDeepStrictEqual(await load(join(EVIDENCE_ROOT, 'candidate-library-validation.json')), expectedValidation), 'candidate_validation_artifact_invalid');
  fail(isDeepStrictEqual(await load(join(EVIDENCE_ROOT, 'candidate-dedupe-audit.json')), auditCandidateDedupe(PILOT_LIBRARY)), 'candidate_dedupe_artifact_invalid');
  fail(isDeepStrictEqual(await load(join(EVIDENCE_ROOT, 'taxonomy.json')), taxonomyArtifact()), 'taxonomy_artifact_invalid');
  const authoringInputBindings = manifest.inputs.filter((binding) => AUTHORITY_AUTHORING_INPUT_PATHS.includes(binding.path));
  const outputLibraryBinding = {
    path: 'i1q-question-platform/content/i1q-1008c/generated/candidate-library.json',
    bytes: candidateLibraryBytes.length,
    sha256: byteSha256(candidateLibraryBytes),
    content_hash: candidateLibrary.content_hash,
  };
  const expectedAuthoringRun = authoringRunArtifact(PILOT_LIBRARY, authoringInputBindings, outputLibraryBinding);
  const authoringRun = await load(join(EVIDENCE_ROOT, 'authoring-run.json'));
  fail(validateAuthoringRunEnvelope(authoringRun).length === 0, `authoring_run_envelope_findings:${validateAuthoringRunEnvelope(authoringRun).join(',')}`);
  fail(isDeepStrictEqual(authoringRun, expectedAuthoringRun), 'authoring_run_artifact_invalid');

  const legacySql = await readFile(join(WORKTREE, 'supabase/migrations/20260420111000_stat_dataset_ingest.sql'), 'utf8');
  const expectedLegacy = auditLegacyV4(parseLegacyV4Migration(legacySql));
  const legacy = await load(join(EVIDENCE_ROOT, 'legacy-v4-audit.json'));
  fail(isDeepStrictEqual(legacy, expectedLegacy), 'legacy_audit_artifact_stale');
  fail(legacy.row_count === 845 && legacy.base_rows === 517 && legacy.vignette_rows === 328, 'legacy_denominator_invalid');
  fail(legacy.exact_duplicate_prompt_group_count === 11 && legacy.normalized_duplicate_prompt_group_count === 12, 'legacy_duplicate_denominator_invalid');
  fail(legacy.quality_census.production_ready_rows === 0, 'legacy_production_readiness_overclaim');
  fail(legacy.quality_census.base_distractor_occurrences_matching_other_keyed_answers === 1527, 'legacy_distractor_reuse_denominator_invalid');
  fail(legacy.row_manifest.length === 845, 'legacy_row_manifest_incomplete');

  const expectedWorkspaceProbe = await probeWorkspaceCorpusAccess(WORKTREE, {
    excludedPaths: [
      ...SOURCE_FACTORY_ARTIFACT_PATHS,
      'i1q-question-platform/evidence/source-factory/build-manifest.json',
    ],
  });
  fail(workspaceCorpusProbeValid(expectedWorkspaceProbe), `workspace_corpus_probe_requires_reassessment:${expectedWorkspaceProbe.status}`);
  const workspaceProbe = await load(join(EVIDENCE_ROOT, 'workspace-corpus-access-probe.json'));
  fail(isDeepStrictEqual(workspaceProbe, expectedWorkspaceProbe), 'workspace_corpus_access_probe_stale');
  fail(workspaceProbe.counts.transcript_or_caption_candidates === 0, 'workspace_transcript_candidate_count_nonzero');
  fail(workspaceProbe.counts.nodes_or_media_registry_candidates === 0, 'workspace_nodes_candidate_count_nonzero');
  const inventoryEvidence = await load(join(APP_ROOT, 'evidence/inventory_report.json'));
  const expectedCorpus = retainedAggregateSnapshot(inventoryEvidence, workspaceProbe);
  const corpus = await load(join(EVIDENCE_ROOT, 'restricted-corpus-snapshot.json'));
  fail(isDeepStrictEqual(corpus, expectedCorpus), 'restricted_corpus_snapshot_stale');
  fail(corpus.counts.authorized_sources === 97 && corpus.counts.extraction_ready_sources === 0, 'drj_source_denominator_invalid');
  fail(corpus.row_manifest_retained === false, 'drj_row_manifest_overclaim');
  fail(corpus.current_access_verified === false, 'drj_current_access_overclaim');
  fail(corpus.source_universe_completeness_status === 'NOT_ESTABLISHED', 'drj_completeness_overclaim');
  fail(corpus.transcript_bytes_accessible_in_workspace === false, 'drj_transcript_access_overclaim');
  fail(corpus.segment_authority_manifest_retained === false, 'drj_segment_authority_overclaim');

  const expectedGate = evaluateTranscriptFactoryGate({ inventory: corpus, privacyGoldEvaluation: null, medicalGovernanceAssigned: false });
  const gate = await load(join(EVIDENCE_ROOT, 'transcript-factory-gate.json'));
  fail(validateTranscriptGateEnvelope(gate).length === 0, `transcript_gate_envelope_findings:${validateTranscriptGateEnvelope(gate).join(',')}`);
  fail(isDeepStrictEqual(gate, expectedGate), 'transcript_gate_artifact_stale');
  fail(exactKeys(gate, [
    'schema_version', 'status', 'transcript_candidate_generation_allowed', 'medical_approval_allowed',
    'release_allowed', 'drafting_blockers', 'approval_blockers', 'blockers', 'qualification', 'content_hash',
  ]), 'transcript_gate_envelope_invalid');
  fail(gate.status === 'BLOCKED' && gate.transcript_candidate_generation_allowed === false, 'transcript_gate_not_blocked');
  fail(gate.medical_approval_allowed === false && gate.release_allowed === false, 'transcript_gate_approval_or_release_overclaim');
  fail(gate.drafting_blockers.includes('source_complete_privacy_gold_evaluation_not_passed'), 'privacy_gold_blocker_missing');
  fail(gate.drafting_blockers.includes('current_corpus_access_not_verified'), 'current_corpus_access_blocker_missing');
  fail(gate.drafting_blockers.includes('source_universe_completeness_not_established'), 'corpus_completeness_blocker_missing');
  fail(gate.drafting_blockers.includes('segment_authority_manifest_missing'), 'segment_authority_blocker_missing');
  fail(gate.drafting_blockers.includes('transcript_bytes_not_accessible_in_workspace'), 'transcript_bytes_blocker_missing');
  fail(gate.approval_blockers.includes('credentialed_medical_governance_unassigned'), 'medical_governance_blocker_missing');

  const expectedResume = transcriptResumeManifest({
    inventoryEvidence,
    workspaceProbe,
    corpusSnapshot: corpus,
    transcriptGate: gate,
    legacyAudit: legacy,
    authorityCandidates: PILOT_LIBRARY,
  });
  const resume = await load(join(EVIDENCE_ROOT, 'transcript-resume-manifest.json'));
  fail(isDeepStrictEqual(resume, expectedResume), 'transcript_resume_manifest_stale');
  fail(resume.status === 'INCOMPLETE_CORPUS_WORK_EXTERNAL_TRUST_BOUNDARY_REQUIRED', 'transcript_resume_status_invalid');
  fail(resume.access_assessment.actual_transcript_caption_or_vtt_artifacts_discovered === 0, 'transcript_resume_access_count_invalid');
  fail(resume.mandatory_metrics.total_artifacts_processed === 0, 'transcript_resume_processed_overclaim');
  fail(resume.mandatory_metrics.total_explicit_questions_extracted === 0, 'transcript_resume_explicit_overclaim');
  fail(resume.mandatory_metrics.total_implicit_or_reconstructed_questions_extracted === 0, 'transcript_resume_reconstructed_overclaim');
  fail(resume.mandatory_metrics.total_medically_relevant_teaching_statements_converted === 0, 'transcript_resume_teaching_overclaim');
  fail(resume.mandatory_metrics.total_legacy_rows_without_established_transcript_provenance.value === 845, 'transcript_resume_legacy_provenance_denominator_invalid');
  fail(resume.mandatory_metrics.total_legacy_secondary_rows_preserved_nonrelease === 845, 'transcript_resume_legacy_nonrelease_denominator_invalid');
  fail(resume.mandatory_metrics.total_quarantined_or_nonrelease_answer_bearing_units.total === 869, 'transcript_resume_total_nonrelease_denominator_invalid');
  fail(resume.resume_entry_point.resume_requires_code_change === true, 'transcript_resume_code_change_requirement_missing');

  console.log(JSON.stringify({
    status: 'pass_quarantined_source_factory_only',
    manifest_inputs: manifest.input_count,
    manifest_artifacts: manifest.artifact_count,
    legacy_rows_audited: legacy.row_count,
    candidate_count: candidateLibrary.candidates.length,
    answer_distribution: validation.metrics.answer_distribution,
    transcript_factory_status: gate.status,
    transcript_resume_status: resume.status,
    corpus_proven_complete: false,
    transcript_artifacts_discovered: 0,
    transcript_artifacts_processed: 0,
    workspace_probe_scanned_files: workspaceProbe.scanned_file_count,
    medical_approval_allowed: false,
    release_eligible_candidates: 0,
  }));
}

await main();
