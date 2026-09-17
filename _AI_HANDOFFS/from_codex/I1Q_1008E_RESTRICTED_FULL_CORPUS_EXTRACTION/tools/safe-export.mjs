import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import {
  DUPLICATE_RELATIONSHIP_TYPES,
  EXTRACTION_CLASSES,
  LIFECYCLE_STATES,
  OBSERVED_NODES_COUNT,
  OBSERVED_TRANSCRIPT_COUNT,
  REQUIRED_PASS_CELL_COUNT,
  SPEAKER_CLASSES,
} from './constants.mjs';
import { contentAddressedEnvelope, merkleRoot, stableHash } from './canonical.mjs';

export const SAFE_ROSTER_KEYS = Object.freeze([
  'roster_position', 'source_alias', 'transcript_artifact_alias', 'transcript_hash',
  'transcript_availability', 'nodes_artifact_alias', 'nodes_hash', 'nodes_availability',
  'predecessor_hash_match', 'processing_status',
]);
export const SAFE_OCCURRENCE_KEYS = Object.freeze([
  'candidate_occurrence_id', 'source_alias', 'artifact_alias', 'extraction_class',
  'speaker_authority_class', 'lifecycle_status', 'subject', 'question_form',
  'verbatim_or_reconstructed', 'assessment_suitability_status',
  'privacy_class', 'rights_status', 'medical_review_status',
  'privacy_review_status', 'release_status', 'provisional_concept_id',
  'provisional_duplicate_cluster_id', 'content_hash',
]);
export const SAFE_CONCEPT_KEYS = Object.freeze([
  'provisional_concept_id', 'provisional_duplicate_cluster_id', 'status',
  'occurrence_count', 'subject', 'organ_system', 'discipline', 'question_forms',
  'ambiguity_flag_count', 'adjudication_status', 'content_hash',
]);
export const SAFE_SUMMARY_KEYS = Object.freeze([
  'schema_version', 'extraction_run_id', 'completeness_class',
  'transcript_artifacts_processed', 'nodes_artifacts_processed',
  'transcript_pass_cells_complete', 'production_mutations',
  'raw_protected_artifacts_committed', 'protected_source_locations_committed',
  'credentials_or_secrets_committed', 'content_hash',
]);

const SAFE_TEXT_EXTENSIONS = new Set(['.json', '.md', '.mjs', '.js', '.sh', '.txt']);
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ALIAS = /^(?:opaque_)?(?:source|artifact|occurrence|concept|cluster|legacy|review|receipt|run)(?:_sha256)?_[A-Za-z0-9_-]{8,}$/u;
const FORBIDDEN_KEY_PATTERN = /"(?:restricted_verbatim_content|privacy_safe_normalized_wording|speaker_label|raw_id|raw_identifier|source_url|transcript_url|nodes_url|cdn_key|r2_key|authorization|cookie|token|secret|raw_body|canonical_path)"\s*:/iu;
const URL_PATTERN = /(?:https?:\/\/|s3:\/\/|r2:\/\/)/iu;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const ABSOLUTE_USER_PATH = /\/(?:Users|home)\/[A-Za-z0-9._-]+\//u;
const PRIVATE_SOURCE_HINT = /(?:\.transcript\.json|\.nodes\.json|transcript[_-]url|nodes[_-]url|video[_-]id|source[_-]id)/iu;

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function histogram(values, allowedValues = null) {
  const result = Object.fromEntries((allowedValues ?? []).map((value) => [value, 0]));
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function assertExactKeys(value, allowed, code) {
  const keys = Object.keys(value).sort();
  const invalid = keys.filter((key) => !allowed.includes(key));
  if (invalid.length > 0) throw new TypeError(`${code}:${invalid.join(',')}`);
}

function safeRosterRow(row, index) {
  const safe = {
    roster_position: Number(row.roster_position ?? index + 1),
    source_alias: row.source_alias,
    transcript_artifact_alias: row.transcript_artifact_alias ?? null,
    transcript_hash: row.transcript_hash ?? null,
    transcript_availability: row.transcript_availability,
    nodes_artifact_alias: row.nodes_artifact_alias ?? null,
    nodes_hash: row.nodes_hash ?? null,
    nodes_availability: row.nodes_availability,
    predecessor_hash_match: row.predecessor_hash_match ?? 'NOT_ESTABLISHED',
    processing_status: row.processing_status ?? 'PENDING',
  };
  assertExactKeys(safe, SAFE_ROSTER_KEYS, 'safe_roster_unknown_key');
  if (!SAFE_ALIAS.test(safe.source_alias ?? '')) throw new TypeError('safe_source_alias_invalid');
  for (const key of ['transcript_artifact_alias', 'nodes_artifact_alias']) {
    if (safe[key] !== null && !SAFE_ALIAS.test(safe[key])) throw new TypeError('safe_artifact_alias_invalid');
  }
  for (const key of ['transcript_hash', 'nodes_hash']) {
    if (safe[key] !== null && !SHA256.test(safe[key])) throw new TypeError('safe_artifact_hash_invalid');
  }
  return safe;
}

function safeOccurrence(occurrence) {
  const safe = {
    candidate_occurrence_id: occurrence.candidate_occurrence_id,
    source_alias: occurrence.source_alias,
    artifact_alias: occurrence.artifact_alias,
    extraction_class: occurrence.extraction_class,
    speaker_authority_class: occurrence.speaker_authority_class,
    lifecycle_status: occurrence.lifecycle_status,
    subject: occurrence.subject,
    question_form: occurrence.question_form,
    verbatim_or_reconstructed: occurrence.verbatim_or_reconstructed,
    assessment_suitability_status: occurrence.assessment_suitability_status,
    privacy_class: occurrence.privacy_class,
    rights_status: occurrence.rights_status,
    medical_review_status: occurrence.medical_review_status,
    privacy_review_status: occurrence.privacy_review_status,
    release_status: occurrence.release_status,
    provisional_concept_id: occurrence.provisional_concept_id,
    provisional_duplicate_cluster_id: occurrence.provisional_duplicate_cluster_id,
    content_hash: occurrence.content_hash,
  };
  assertExactKeys(safe, SAFE_OCCURRENCE_KEYS, 'safe_occurrence_unknown_key');
  return safe;
}

function safeConcept(concept) {
  const safe = {
    provisional_concept_id: concept.provisional_concept_id,
    provisional_duplicate_cluster_id: concept.provisional_duplicate_cluster_id,
    status: concept.provisional_status ?? concept.status,
    occurrence_count: concept.occurrence_ids.length,
    subject: concept.subject,
    organ_system: concept.organ_system,
    discipline: concept.discipline,
    question_forms: [...concept.question_forms],
    ambiguity_flag_count: (concept.medical_ambiguity_flags ?? concept.ambiguity_flags ?? []).length,
    adjudication_status: concept.adjudication_status,
    content_hash: concept.content_hash,
  };
  assertExactKeys(safe, SAFE_CONCEPT_KEYS, 'safe_concept_unknown_key');
  return safe;
}

export function assertSafeSerialization(serialized, forbiddenValues = [], {
  schemaContract = false,
  implementationSource = false,
} = {}) {
  let inspected = serialized.replaceAll('https://json-schema.org/draft/2020-12/schema', '');
  if (schemaContract) {
    inspected = inspected
      .replace(/https:\/\/missionmed\.internal\/contracts\/[A-Za-z0-9/_-]+/gu, '');
  }
  const findings = [];
  if (!schemaContract && !implementationSource && FORBIDDEN_KEY_PATTERN.test(inspected)) {
    findings.push('FORBIDDEN_RESTRICTED_KEY');
  }
  if (URL_PATTERN.test(inspected)) findings.push('URL_OR_REMOTE_LOCATOR');
  if (EMAIL_PATTERN.test(inspected)) findings.push('EMAIL_PATTERN');
  if (ABSOLUTE_USER_PATH.test(inspected)) findings.push('ABSOLUTE_USER_PATH');
  if (!schemaContract && !implementationSource && PRIVATE_SOURCE_HINT.test(inspected)) {
    findings.push('PRIVATE_SOURCE_HINT');
  }
  for (const value of forbiddenValues) {
    if (typeof value === 'string' && value.length >= 4 && inspected.includes(value)) {
      findings.push(`FORBIDDEN_RAW_VALUE:${stableHash(value).slice(0, 16)}`);
    }
  }
  return uniqueSorted(findings);
}

export function projectSafeArtifacts({
  extractionRunId,
  authorityTicketHash,
  predecessorCommit,
  predecessorReceiptHash,
  boundaryDecisionHash,
  roster,
  artifactLedger,
  occurrences,
  concepts,
  retryLedger,
  legacyComparison = null,
  duplicateRelationshipInventory = null,
  sourceContentMetrics = null,
  sourceMutationCount = 0,
}) {
  if (!Array.isArray(roster)) {
    const input = arguments[0] ?? {};
    const projected = Object.fromEntries(
      SAFE_SUMMARY_KEYS.filter((key) => Object.hasOwn(input, key)).map((key) => [key, input[key]]),
    );
    const findings = assertSafeSerialization(JSON.stringify(projected));
    if (findings.length > 0) throw new Error(`safe_projection_rejected:${findings.join(',')}`);
    return projected;
  }
  const safeRoster = roster.map(safeRosterRow).sort((left, right) => left.source_alias.localeCompare(right.source_alias));
  const safeOccurrences = occurrences.map(safeOccurrence);
  const safeConcepts = concepts.map(safeConcept);
  const finalizationSummary = artifactLedger.finalization_summary ?? {
    completed_specialist_verification_cell_count: 0,
    completed_specialist_role_review_count: 0,
    status: 'PENDING_SPECIALIST_REVIEW',
  };
  const transcriptRows = safeRoster.filter((row) => row.transcript_availability === 'AVAILABLE');
  const nodesRows = safeRoster.filter((row) => row.nodes_availability === 'AVAILABLE');
  const nodesOnlyRows = safeRoster.filter((row) => (
    row.transcript_availability !== 'AVAILABLE' && row.nodes_availability === 'AVAILABLE'
  ));
  const neitherRows = safeRoster.filter((row) => (
    row.transcript_availability !== 'AVAILABLE' && row.nodes_availability !== 'AVAILABLE'
  ));
  const medicalOccurrences = safeOccurrences.filter((item) => item.extraction_class !== 'NONMEDICAL');
  const retainedOccurrences = safeOccurrences.filter(
    (item) => !item.lifecycle_status.startsWith('REJECTED_'),
  );
  const quarantineOccurrences = safeOccurrences.filter((item) => (
    item.lifecycle_status.endsWith('_QUARANTINED') || item.lifecycle_status === 'AMBIGUOUS'
  ));
  const explicitClasses = new Set(['EXPLICIT_QUESTION', 'DIAGNOSIS_PROMPT', 'DIFFERENTIAL_PROMPT', 'MECHANISM_PROMPT', 'MANAGEMENT_PROMPT', 'NEXT_BEST_STEP_PROMPT', 'INTERPRETATION_PROMPT', 'RECALL_PROMPT', 'CLINICAL_REASONING_PROMPT']);
  const implicitClasses = new Set(['INCOMPLETE_QUESTION', 'IMPLIED_QUESTION', 'RAPID_FIRE_PROMPT', 'LEARNER_QUESTION_WITH_DRJ_TEACHING']);
  const reconstructedOccurrences = safeOccurrences.filter(
    (item) => item.verbatim_or_reconstructed === 'RECONSTRUCTED',
  );
  const verbatimOccurrences = safeOccurrences.filter(
    (item) => item.verbatim_or_reconstructed === 'VERBATIM',
  );
  const implicitOrReconstructedOccurrences = safeOccurrences.filter((item) => (
    implicitClasses.has(item.extraction_class)
      || item.verbatim_or_reconstructed === 'RECONSTRUCTED'
  ));
  const normalizedOccurrenceCount = occurrences.filter((item) => (
    typeof item.privacy_safe_normalized_wording === 'string'
      && item.privacy_safe_normalized_wording.length > 0
  )).length;
  const duplicateRelationships = duplicateRelationshipInventory?.relationships ?? [];
  const duplicateClusterIds = new Set(safeConcepts.filter(
    (item) => item.occurrence_count > 1,
  ).map((item) => item.provisional_duplicate_cluster_id).filter(Boolean));

  if (sourceContentMetrics !== null) {
    const requiredMetricKeys = [
      'transcript_segment_count', 'nodes_record_count', 'transcript_byte_count',
      'artifact_retry_count', 'malformed_record_count', 'repaired_record_count',
      'unrecoverable_record_count', 'newly_recovered_transcript_count',
      'newly_recovered_nodes_count',
    ];
    assertExactKeys(sourceContentMetrics, requiredMetricKeys, 'source_content_unknown_key');
    if (requiredMetricKeys.some((key) => (
      !Number.isSafeInteger(sourceContentMetrics[key]) || sourceContentMetrics[key] < 0
    ))) throw new TypeError('source_content_metric_rejected');
  }

  const runManifest = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.extraction_run_manifest.v1',
    extraction_run_id: extractionRunId,
    mission_id: 'I1Q-1008E',
    authority_ticket_sha256: authorityTicketHash,
    predecessor_commit: predecessorCommit,
    predecessor_receipt_sha256: predecessorReceiptHash,
    boundary_decision_sha256: boundaryDecisionHash,
    corpus_claim: 'PROVEN_ACCESSIBLE_OBSERVED_CORPUS_NOT_HISTORICAL_UNIVERSE',
    historical_completeness_claimed: false,
    observed_transcript_denominator: OBSERVED_TRANSCRIPT_COUNT,
    observed_nodes_denominator: OBSERVED_NODES_COUNT,
    automated_pass_cell_denominator: REQUIRED_PASS_CELL_COUNT,
    specialist_verification_cell_denominator: OBSERVED_TRANSCRIPT_COUNT * 2,
    specialist_role_review_denominator: OBSERVED_TRANSCRIPT_COUNT * 4,
    source_mutation_count: sourceMutationCount,
    release_allowed: false,
    medical_approval_allowed: false,
    final_mcq_generation_performed: false,
    stable_roster_root: merkleRoot(safeRoster.map((row) => stableHash(row)), 'i1q.1008e.safe_roster'),
    artifact_ledger_hash: artifactLedger.content_hash,
    retry_ledger_hash: retryLedger.content_hash,
    extraction_complete: artifactLedger.extraction_complete === true,
  });
  const rosterEnvelope = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.processing_roster_safe.v1',
    extraction_run_id: extractionRunId,
    claim_class: 'C1_OBSERVED',
    source_count: safeRoster.length,
    transcript_available_count: transcriptRows.length,
    nodes_available_count: nodesRows.length,
    nodes_only_reconciliation_scope: 'OBSERVED_TWO_NODES_ONLY_ARTIFACTS',
    nodes_only_reconciled_count: nodesOnlyRows.filter(
      (row) => row.processing_status === 'RECONCILED_NODES_ONLY_NO_TRANSCRIPT',
    ).length,
    neither_unresolved_count: neitherRows.length,
    outside_consumer_projection_count: safeRoster.length - transcriptRows.length,
    overall_lane_b_status: 'OPEN_CONSTRAINS_COMPLETENESS',
    registry_cdn_r2_historical_reconciliation_status: 'UNRESOLVED_OUT_OF_SCOPE',
    exclusion_tombstone_reconciliation_status: 'UNRESOLVED_OUT_OF_SCOPE',
    rows: safeRoster,
  });
  const coverageReceipt = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.coverage_receipt.v1',
    extraction_run_id: extractionRunId,
    transcript_artifacts_expected: OBSERVED_TRANSCRIPT_COUNT,
    transcript_artifacts_processed: artifactLedger.artifacts.filter((item) => (
      ['COMPLETE', 'COMPLETE_WITH_QUARANTINE'].includes(item.final_artifact_status)
    )).length,
    nodes_artifacts_accounted: nodesRows.length,
    automated_pass_cells_required: REQUIRED_PASS_CELL_COUNT,
    automated_pass_cells_complete: artifactLedger.artifacts.reduce((sum, item) => (
      sum + (item.extraction_passes ?? Object.values(item.pass_status ?? {}))
        .filter((receipt) => receipt.status === 'COMPLETE').length
    ), 0),
    specialist_verification_cells_required: OBSERVED_TRANSCRIPT_COUNT * 2,
    specialist_verification_cells_complete:
      finalizationSummary.completed_specialist_verification_cell_count,
    specialist_role_reviews_required: OBSERVED_TRANSCRIPT_COUNT * 4,
    specialist_role_reviews_complete:
      finalizationSummary.completed_specialist_role_review_count,
    specialist_verification_status: finalizationSummary.status,
    extraction_complete: artifactLedger.extraction_complete === true,
    artifact_final_state_histogram: histogram(artifactLedger.artifacts.map((item) => item.final_artifact_status)),
    no_silent_omission: artifactLedger.artifacts.length === OBSERVED_TRANSCRIPT_COUNT,
  });
  const candidateSummary = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.candidate_inventory_safe_summary.v1',
    extraction_run_id: extractionRunId,
    total_occurrences: safeOccurrences.length,
    retained_occurrence_count: retainedOccurrences.length,
    retained_occurrence_definition: 'LIFECYCLE_STATUS_DOES_NOT_BEGIN_WITH_REJECTED_',
    medically_relevant_or_review_occurrences: medicalOccurrences.length,
    exact_explicit_question_class_occurrences: safeOccurrences.filter(
      (item) => item.extraction_class === 'EXPLICIT_QUESTION',
    ).length,
    explicit_question_occurrences: safeOccurrences.filter((item) => explicitClasses.has(item.extraction_class)).length,
    expanded_explicit_prompt_group_definition:
      'EXPLICIT_QUESTION_PLUS_NAMED_DIAGNOSIS_DIFFERENTIAL_MECHANISM_MANAGEMENT_NEXT_STEP_INTERPRETATION_RECALL_AND_REASONING_PROMPTS',
    implicit_question_class_occurrences: safeOccurrences.filter(
      (item) => implicitClasses.has(item.extraction_class),
    ).length,
    implicit_or_reconstructed_question_occurrences: implicitOrReconstructedOccurrences.length,
    implicit_or_reconstructed_definition:
      'SET_UNION_OF_IMPLICIT_CLASS_GROUP_AND_VERBATIM_OR_RECONSTRUCTED_EQUALS_RECONSTRUCTED',
    teaching_statement_occurrences: safeOccurrences.filter((item) => ['TEACHING_PIVOT', 'TESTABLE_TEACHING_STATEMENT'].includes(item.extraction_class)).length,
    teaching_statement_occurrence_definition:
      'SET_UNION_OF_TEACHING_PIVOT_AND_TESTABLE_TEACHING_STATEMENT_CLASSES',
    teaching_pivot_occurrences: safeOccurrences.filter(
      (item) => item.extraction_class === 'TEACHING_PIVOT',
    ).length,
    testable_teaching_statement_occurrences: safeOccurrences.filter(
      (item) => item.extraction_class === 'TESTABLE_TEACHING_STATEMENT',
    ).length,
    extraction_class_histogram: histogram(safeOccurrences.map((item) => item.extraction_class), EXTRACTION_CLASSES),
    speaker_class_histogram: histogram(safeOccurrences.map((item) => item.speaker_authority_class), SPEAKER_CLASSES),
    lifecycle_histogram: histogram(safeOccurrences.map((item) => item.lifecycle_status), LIFECYCLE_STATES),
    subject_histogram: histogram(safeOccurrences.map((item) => item.subject)),
    question_form_histogram: histogram(safeOccurrences.map((item) => item.question_form)),
    assessment_suitability_status_histogram: histogram(
      safeOccurrences.map((item) => item.assessment_suitability_status),
    ),
    medical_review_status_histogram: histogram(
      safeOccurrences.map((item) => item.medical_review_status),
    ),
    verbatim_count: verbatimOccurrences.length,
    reconstructed_count: reconstructedOccurrences.length,
    normalized_count: normalizedOccurrenceCount,
    normalized_count_definition:
      'NONEMPTY_PRIVACY_SAFE_NORMALIZED_WORDING_PRESENT_INSIDE_RESTRICTED_INVENTORY',
    approved_count: 0,
    released_count: 0,
    final_four_choice_mcq_count: 0,
  });
  const quarantineSummary = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.quarantine_summary.v1',
    extraction_run_id: extractionRunId,
    quarantined_occurrence_count: quarantineOccurrences.length,
    lifecycle_histogram: histogram(quarantineOccurrences.map((item) => item.lifecycle_status)),
    privacy_class_histogram: histogram(safeOccurrences.map((item) => item.privacy_class)),
    rights_status_histogram: histogram(safeOccurrences.map((item) => item.rights_status)),
    release_status_histogram: histogram(safeOccurrences.map((item) => item.release_status)),
  });
  const conceptSummary = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.provisional_concept_summary.v1',
    extraction_run_id: extractionRunId,
    provisional_concept_count: safeConcepts.length,
    multi_occurrence_concept_count: safeConcepts.filter((item) => item.occurrence_count > 1).length,
    provisional_duplicate_cluster_count: duplicateClusterIds.size,
    occurrence_membership_count: safeConcepts.reduce((sum, item) => sum + item.occurrence_count, 0),
    status_histogram: histogram(safeConcepts.map((item) => item.status)),
    subject_histogram: histogram(safeConcepts.map((item) => item.subject)),
    no_destructive_deduplication: true,
    final_canonical_concept_count: 0,
    duplicate_relationship_count: duplicateRelationshipInventory?.relationship_count ?? 0,
    duplicate_relationship_type_histogram: histogram(
      duplicateRelationships.map((item) => item.relationship_type),
      DUPLICATE_RELATIONSHIP_TYPES,
    ),
    duplicate_relationship_inventory_root: duplicateRelationshipInventory?.content_hash ?? null,
    duplicate_relationship_final_adjudication_performed: false,
    i1q1008f_candidate_concept_count: safeConcepts.length,
    i1q1008f_candidate_qualification:
      'ALL_PROVISIONAL_CONCEPTS_INCLUDE_QUARANTINED_ITEMS_AND_REQUIRE_1008F_ADJUDICATION',
    concept_set_root: merkleRoot(safeConcepts.map((item) => item.content_hash), 'i1q.1008e.safe_concepts'),
  });
  const provenanceResults = contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.provenance_invariant_results.v1',
    extraction_run_id: extractionRunId,
    occurrence_count: safeOccurrences.length,
    transcript_hash_bound_count: occurrences.filter((item) => SHA256.test(item.transcript_hash_binding ?? '')).length,
    artifact_alias_bound_count: safeOccurrences.filter((item) => SAFE_ALIAS.test(item.artifact_alias ?? '')).length,
    source_alias_bound_count: safeOccurrences.filter((item) => SAFE_ALIAS.test(item.source_alias ?? '')).length,
    content_hash_valid_shape_count: safeOccurrences.filter((item) => SHA256.test(item.content_hash ?? '')).length,
    pass6_nodes_binding_violation_count: occurrences.filter((item) => (
      item.extraction_pass_bindings?.includes('PASS_6') && !SHA256.test(item.nodes_hash_binding ?? '')
    )).length,
    release_overclaim_count: safeOccurrences.filter(
      (item) => !['RELEASE_PROHIBITED', 'RESTRICTED_ONLY', 'QUARANTINED'].includes(item.release_status),
    ).length,
    result: 'PENDING_INDEPENDENT_RECOMPUTATION',
  });
  const legacySummary = legacyComparison ? contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.legacy_comparison_safe_summary.v1',
    extraction_run_id: extractionRunId,
    legacy_row_count: legacyComparison.legacy_row_count,
    likely_overlap_count: legacyComparison.likely_overlap_count,
    transcript_concepts_absent_from_legacy_count: legacyComparison.transcript_concepts_absent_from_legacy_count,
    legacy_rows_with_possible_transcript_support_count:
      legacyComparison.legacy_rows_with_possible_transcript_support_count,
    legacy_rows_without_established_transcript_support_count: legacyComparison.legacy_rows_without_established_transcript_support_count,
    unresolved_comparison_count: legacyComparison.unresolved_comparison_count,
    legacy_promotion_count: legacyComparison.legacy_promotions,
    destructive_merge_performed: legacyComparison.destructive_merge_performed,
    comparison_root: legacyComparison.comparison_root,
    qualification: legacyComparison.qualification,
  }) : null;
  const sourceContentSummary = sourceContentMetrics ? contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.source_content_safe_summary.v1',
    extraction_run_id: extractionRunId,
    ...sourceContentMetrics,
    repaired_record_definition: 'PIPELINE_RECORD_REPAIR_PERFORMED',
    unrecoverable_record_definition: 'PARSER_ERRORS_NOT_REPAIRED_IN_THIS_RUN',
    transcript_byte_count_is_safe_aggregate: true,
  }) : null;

  const outputs = {
    run_manifest: runManifest,
    processing_roster_safe: rosterEnvelope,
    coverage_receipt: coverageReceipt,
    candidate_inventory_safe_summary: candidateSummary,
    quarantine_summary: quarantineSummary,
    provisional_concept_summary: conceptSummary,
    provenance_invariant_results: provenanceResults,
    legacy_comparison_safe_summary: legacySummary,
    source_content_safe_summary: sourceContentSummary,
  };
  for (const [name, value] of Object.entries(outputs)) {
    if (value === null) continue;
    const findings = assertSafeSerialization(JSON.stringify(value));
    if (findings.length > 0) throw new Error(`safe_projection_rejected:${name}:${findings.join(',')}`);
  }
  return outputs;
}

async function walkFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const path = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      output.push({ path, type: 'symlink' });
    } else if (entry.isDirectory()) {
      output.push(...await walkFiles(root, path));
    } else if (entry.isFile()) {
      output.push({ path, type: 'file' });
    }
  }
  return output;
}

export async function scanSafeTree(rootPath, {
  forbiddenValues = [], restrictedCanaries = [], scanCode = false,
} = {}) {
  const root = await realpath(rootPath);
  const files = await walkFiles(root);
  const findings = [];
  let filesScanned = 0;
  for (const item of files) {
    const rel = relative(root, item.path);
    if (rel === '..' || rel.startsWith(`..${sep}`)) {
      findings.push({ file_hash: stableHash(rel), code: 'PATH_ESCAPE' });
      continue;
    }
    if (item.type === 'symlink') {
      findings.push({ file_hash: stableHash(rel), code: 'SYMLINK_REJECTED' });
      continue;
    }
    const extension = extname(item.path).toLowerCase();
    if (!SAFE_TEXT_EXTENSIONS.has(extension)) {
      findings.push({ file_hash: stableHash(rel), code: 'UNAPPROVED_FILE_EXTENSION' });
      continue;
    }
    if (!scanCode && ['.mjs', '.js', '.sh'].includes(extension)) continue;
    const metadata = await stat(item.path);
    if (metadata.size > 64 * 1024 * 1024) {
      findings.push({ file_hash: stableHash(rel), code: 'SAFE_FILE_TOO_LARGE' });
      continue;
    }
    const serialized = await readFile(item.path, 'utf8');
    filesScanned += 1;
    const schemaContract = rel.startsWith(`schemas${sep}`) && extension === '.json';
    const implementationSource = ['.mjs', '.js', '.sh'].includes(extension);
    for (const code of assertSafeSerialization(
      serialized,
      [...forbiddenValues, ...restrictedCanaries],
      { schemaContract, implementationSource },
    )) {
      findings.push({ file_hash: stableHash(rel), code });
    }
    if (/\.(?:transcript|nodes)\.json$/iu.test(basename(item.path))) {
      findings.push({ file_hash: stableHash(rel), code: 'RAW_ARTIFACT_FILENAME' });
    }
  }
  return contentAddressedEnvelope({
    schema_version: 'missionmed.i1q.1008e.leakage_scan_results.v1',
    files_scanned: filesScanned,
    finding_count: findings.length,
    findings: findings.sort((left, right) => `${left.file_hash}:${left.code}`.localeCompare(`${right.file_hash}:${right.code}`)),
    result: findings.length === 0 ? 'pass' : 'fail',
  });
}
