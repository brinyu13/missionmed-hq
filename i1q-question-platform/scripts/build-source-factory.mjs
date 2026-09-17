import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PILOT_LIBRARY } from '../content/i1q-1008c/pilot-library.mjs';
import { authoringRunArtifact, renderCandidateLibraryMarkdown } from '../src/source-factory/authoring.mjs';
import { sha256 } from '../src/hash.mjs';
import { auditCandidateDedupe } from '../src/source-factory/dedupe.mjs';
import { auditLegacyV4, parseLegacyV4Migration } from '../src/source-factory/legacy-v4.mjs';
import { validateCandidateLibrary } from '../src/source-factory/quality.mjs';
import { evaluateTranscriptFactoryGate, retainedAggregateSnapshot } from '../src/source-factory/restricted-corpus.mjs';
import { taxonomyArtifact } from '../src/source-factory/taxonomy.mjs';
import { transcriptResumeManifest } from '../src/source-factory/transcript-resume.mjs';
import {
  AUTHORITY_AUTHORING_INPUT_PATHS,
  SOURCE_FACTORY_ARTIFACT_PATHS,
  SOURCE_FACTORY_INPUT_PATHS,
} from '../src/source-factory/contracts.mjs';
import { probeWorkspaceCorpusAccess, workspaceCorpusProbeValid } from '../src/source-factory/workspace-corpus-probe.mjs';

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WORKTREE = dirname(APP_ROOT);
const CONTENT_ROOT = join(APP_ROOT, 'content/i1q-1008c/generated');
const EVIDENCE_ROOT = join(APP_ROOT, 'evidence/source-factory');
const AS_OF_DATE = '2026-07-16';

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function byteSha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeArtifact(path, content, artifacts) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  artifacts.push({
    path: relative(WORKTREE, path),
    bytes: Buffer.byteLength(content),
    sha256: byteSha256(Buffer.from(content, 'utf8')),
  });
}

async function main() {
  const inputs = [];
  for (const path of SOURCE_FACTORY_INPUT_PATHS) {
    const bytes = await readFile(join(WORKTREE, path));
    inputs.push({ path, bytes: bytes.length, sha256: byteSha256(bytes) });
  }
  const legacySql = await readFile(join(WORKTREE, 'supabase/migrations/20260420111000_stat_dataset_ingest.sql'), 'utf8');
  const legacyAudit = auditLegacyV4(parseLegacyV4Migration(legacySql));
  const workspaceProbe = await probeWorkspaceCorpusAccess(WORKTREE, {
    excludedPaths: [
      ...SOURCE_FACTORY_ARTIFACT_PATHS,
      'i1q-question-platform/evidence/source-factory/build-manifest.json',
    ],
  });
  if (!workspaceCorpusProbeValid(workspaceProbe)) {
    throw new Error(`workspace_corpus_probe_requires_reassessment:${workspaceProbe.status}`);
  }
  const inventoryEvidence = JSON.parse(await readFile(join(APP_ROOT, 'evidence/inventory_report.json'), 'utf8'));
  const corpusSnapshot = retainedAggregateSnapshot(inventoryEvidence, workspaceProbe);
  const transcriptGate = evaluateTranscriptFactoryGate({
    inventory: corpusSnapshot,
    privacyGoldEvaluation: null,
    medicalGovernanceAssigned: false,
  });
  const candidateValidation = validateCandidateLibrary(PILOT_LIBRARY);
  if (candidateValidation.errors.length > 0) {
    throw new Error(`candidate_library_validation_failed:${candidateValidation.errors.join(',')}`);
  }
  const dedupeAudit = auditCandidateDedupe(PILOT_LIBRARY);
  const taxonomy = taxonomyArtifact();
  const resumeManifest = transcriptResumeManifest({
    inventoryEvidence,
    workspaceProbe,
    corpusSnapshot,
    transcriptGate,
    legacyAudit,
    authorityCandidates: PILOT_LIBRARY,
  });
  const candidateLibrary = {
    schema_version: 'missionmed.i1q.source_factory.library.v1',
    as_of_date: AS_OF_DATE,
    classification_level: 'CLASS_D_INTERNAL_ANSWER_BEARING',
    status: 'AI_DRAFT_NOT_MEDICALLY_VALIDATED',
    library_role: 'SUPPLEMENTAL_AUTHORITY_DERIVED_EDITORIAL_BENCHMARK',
    canonical_transcript_coverage: 'ZERO_TRANSCRIPT_DERIVED_CANDIDATES',
    release_eligibility: 'BLOCKED',
    physician_review_status: 'REQUIRED_NOT_COMPLETED',
    psychometric_response_data_status: 'NOT_COLLECTED',
    form_assembly_policy: {
      status: 'REQUIRED_DOWNSTREAM_ENFORCEMENT',
      randomize_delivery_order: true,
      reject_periodic_answer_sequences: true,
      exclude_same_variant_group_from_form: true,
      review_same_primary_topic_for_local_dependence: true,
      learner_projection_excludes_internal_ids_keys_and_concept_metadata: true,
    },
    candidates: PILOT_LIBRARY,
  };
  candidateLibrary.content_hash = sha256(candidateLibrary);
  const candidateLibraryJson = json(candidateLibrary);
  const candidateLibraryPath = 'i1q-question-platform/content/i1q-1008c/generated/candidate-library.json';
  const candidateLibraryBinding = {
    path: candidateLibraryPath,
    bytes: Buffer.byteLength(candidateLibraryJson),
    sha256: byteSha256(Buffer.from(candidateLibraryJson, 'utf8')),
    content_hash: candidateLibrary.content_hash,
  };
  const authoringInputBindings = inputs.filter((binding) => AUTHORITY_AUTHORING_INPUT_PATHS.includes(binding.path));

  const artifacts = [];
  await writeArtifact(join(CONTENT_ROOT, 'candidate-library.json'), candidateLibraryJson, artifacts);
  await writeArtifact(join(CONTENT_ROOT, 'candidate-library.md'), renderCandidateLibraryMarkdown(PILOT_LIBRARY, AS_OF_DATE), artifacts);
  await writeArtifact(join(EVIDENCE_ROOT, 'legacy-v4-audit.json'), json(legacyAudit), artifacts);
  await writeArtifact(join(EVIDENCE_ROOT, 'authoring-run.json'), json(authoringRunArtifact(PILOT_LIBRARY, authoringInputBindings, candidateLibraryBinding)), artifacts);
  await writeArtifact(join(EVIDENCE_ROOT, 'restricted-corpus-snapshot.json'), json(corpusSnapshot), artifacts);
  await writeArtifact(join(EVIDENCE_ROOT, 'transcript-factory-gate.json'), json(transcriptGate), artifacts);
  await writeArtifact(join(EVIDENCE_ROOT, 'transcript-resume-manifest.json'), json(resumeManifest), artifacts);
  await writeArtifact(join(EVIDENCE_ROOT, 'workspace-corpus-access-probe.json'), json(workspaceProbe), artifacts);
  await writeArtifact(join(EVIDENCE_ROOT, 'candidate-library-validation.json'), json({
    schema_version: 'missionmed.i1q.source_factory.validation.v1',
    as_of_date: AS_OF_DATE,
    status: 'pass_quarantined_candidate_contract_only',
    ...candidateValidation.metrics,
    medical_accuracy_validated: false,
    physician_review_complete: false,
    release_eligible: false,
    validator_errors: candidateValidation.errors,
  }), artifacts);
  await writeArtifact(join(EVIDENCE_ROOT, 'candidate-dedupe-audit.json'), json(dedupeAudit), artifacts);
  await writeArtifact(join(EVIDENCE_ROOT, 'taxonomy.json'), json(taxonomy), artifacts);

  const manifestPayload = {
    schema_version: 'missionmed.i1q.source_factory.build_manifest.v1',
    as_of_date: AS_OF_DATE,
    build_status: 'pass_incomplete_corpus_handoff_and_quarantined_drafts_only',
    self_embedding: false,
    input_count: inputs.length,
    inputs: inputs.sort((left, right) => left.path.localeCompare(right.path, 'en')),
    artifact_count: artifacts.length,
    artifacts: artifacts.sort((left, right) => left.path.localeCompare(right.path, 'en')),
    invariants: {
      source_mutations: 0,
      production_mutations: 0,
      prior_point_in_time_authorized_source_aggregate: corpusSnapshot.counts.authorized_sources,
      current_transcript_artifacts_discovered: resumeManifest.mandatory_metrics.total_transcript_artifacts_discovered,
      corpus_proven_complete: resumeManifest.mandatory_metrics.corpus_proven_complete,
      transcript_artifacts_processed: resumeManifest.mandatory_metrics.total_artifacts_processed,
      explicit_questions_extracted: resumeManifest.mandatory_metrics.total_explicit_questions_extracted,
      implicit_or_reconstructed_questions_extracted: resumeManifest.mandatory_metrics.total_implicit_or_reconstructed_questions_extracted,
      teaching_statements_converted: resumeManifest.mandatory_metrics.total_medically_relevant_teaching_statements_converted,
      unique_transcript_concepts_after_deduplication: resumeManifest.mandatory_metrics.total_unique_transcript_concepts_after_deduplication,
      legacy_rows_audited_secondary_only: legacyAudit.row_count,
      legacy_rows_without_established_transcript_provenance: legacyAudit.row_count,
      transcript_derived_candidates: 0,
      authority_derived_quarantined_candidates: PILOT_LIBRARY.length,
      physician_approved_candidates: 0,
      release_eligible_candidates: 0,
    },
  };
  await mkdir(EVIDENCE_ROOT, { recursive: true });
  await writeFile(join(EVIDENCE_ROOT, 'build-manifest.json'), json({
    ...manifestPayload,
    manifest_payload_hash: sha256(manifestPayload),
  }), 'utf8');

  console.log(JSON.stringify({
    status: 'pass_incomplete_corpus_handoff_and_quarantined_drafts_only',
    legacy_rows_audited: legacyAudit.row_count,
    candidate_count: PILOT_LIBRARY.length,
    answer_distribution: candidateValidation.metrics.answer_distribution,
    transcript_factory_status: transcriptGate.status,
    corpus_proven_complete: false,
    transcript_artifacts_discovered: 0,
    transcript_artifacts_processed: 0,
  }));
}

await main();
