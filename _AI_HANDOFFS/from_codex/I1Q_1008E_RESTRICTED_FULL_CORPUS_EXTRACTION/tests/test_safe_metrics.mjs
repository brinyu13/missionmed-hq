import assert from 'node:assert/strict';
import test from 'node:test';

import { contentAddressedEnvelope, stableHash } from '../tools/canonical.mjs';
import { projectSafeArtifacts } from '../tools/safe-export.mjs';

const hash = (value) => stableHash(['safe-metric-fixture', value]);

function occurrence(index, overrides = {}) {
  const artifactAlias = 'opaque_artifact_fixture_safe_0001';
  return {
    candidate_occurrence_id: `opaque_occurrence_fixture_safe_${String(index).padStart(4, '0')}`,
    source_alias: 'opaque_source_fixture_safe_0001',
    artifact_alias: artifactAlias,
    extraction_class: 'EXPLICIT_QUESTION',
    speaker_authority_class: 'HIGH_CONFIDENCE_DR_J',
    lifecycle_status: 'READY_FOR_DEDUPLICATION',
    subject: 'SAFE_AGGREGATE_FIXTURE',
    question_form: 'RAPID_RECALL',
    verbatim_or_reconstructed: 'VERBATIM',
    assessment_suitability_status: 'SUITABLE',
    privacy_class: 'NO_SENSITIVE_DATA_DETECTED',
    rights_status: 'RESTRICTED',
    medical_review_status: 'INDEPENDENTLY_REVIEWED',
    privacy_review_status: 'INDEPENDENTLY_REVIEWED',
    release_status: 'RELEASE_PROHIBITED',
    provisional_concept_id: 'opaque_concept_fixture_safe_0001',
    provisional_duplicate_cluster_id: 'opaque_cluster_fixture_safe_0001',
    privacy_safe_normalized_wording: 'synthetic fixture wording only',
    content_hash: hash(`occurrence-${index}`),
    ...overrides,
  };
}

test('safe projection exports exact mandatory aggregate definitions without protected fields', () => {
  const occurrences = [
    occurrence(1),
    occurrence(2, {
      extraction_class: 'IMPLIED_QUESTION',
      verbatim_or_reconstructed: 'RECONSTRUCTED',
      lifecycle_status: 'MEDICAL_QUARANTINED',
    }),
    occurrence(3, {
      extraction_class: 'NONMEDICAL',
      lifecycle_status: 'REJECTED_NONMEDICAL',
      assessment_suitability_status: 'NOT_APPLICABLE',
    }),
  ];
  const concept = {
    provisional_concept_id: 'opaque_concept_fixture_safe_0001',
    provisional_duplicate_cluster_id: 'opaque_cluster_fixture_safe_0001',
    provisional_status: 'PROVISIONAL',
    occurrence_ids: occurrences.slice(0, 2).map((item) => item.candidate_occurrence_id),
    subject: 'SAFE_AGGREGATE_FIXTURE',
    organ_system: 'OTHER',
    discipline: 'OTHER',
    question_forms: ['RAPID_RECALL'],
    medical_ambiguity_flags: [],
    adjudication_status: 'PENDING',
    content_hash: hash('concept'),
  };
  const artifactLedger = contentAddressedEnvelope({
    schema_version: 'fixture.ledger.v1',
    extraction_complete: false,
    artifacts: [{
      final_artifact_status: 'COMPLETE_WITH_QUARANTINE',
      extraction_passes: Array.from({ length: 9 }, (_, index) => ({
        pass_id: `PASS_${index + 1}`,
        status: 'COMPLETE',
      })),
    }],
  });
  const retryLedger = contentAddressedEnvelope({
    schema_version: 'fixture.retry.v1',
    acquisition_retry_count: 1,
    extraction_retry_count: 1,
  });
  const duplicateInventory = contentAddressedEnvelope({
    schema_version: 'fixture.relationships.v1',
    relationship_count: 1,
    relationships: [{ relationship_type: 'SAME_CONCEPT_SAME_TARGET' }],
  });
  const projected = projectSafeArtifacts({
    extractionRunId: 'opaque_run_fixture_safe_0001',
    authorityTicketHash: hash('ticket'),
    predecessorCommit: hash('commit'),
    predecessorReceiptHash: hash('predecessor'),
    boundaryDecisionHash: hash('boundary'),
    roster: [{
      roster_position: 1,
      source_alias: 'opaque_source_fixture_safe_0001',
      transcript_artifact_alias: 'opaque_artifact_fixture_safe_0001',
      transcript_hash: hash('transcript'),
      transcript_availability: 'AVAILABLE',
      nodes_artifact_alias: 'opaque_artifact_fixture_nodes_0001',
      nodes_hash: hash('nodes'),
      nodes_availability: 'AVAILABLE',
      predecessor_hash_match: 'MATCH',
      processing_status: 'COMPLETE_WITH_QUARANTINE',
    }],
    artifactLedger,
    occurrences,
    concepts: [concept],
    retryLedger,
    duplicateRelationshipInventory: duplicateInventory,
    legacyComparison: {
      legacy_row_count: 845,
      likely_overlap_count: 1,
      transcript_concepts_absent_from_legacy_count: 0,
      legacy_rows_with_possible_transcript_support_count: 1,
      legacy_rows_without_established_transcript_support_count: 844,
      unresolved_comparison_count: 846,
      comparison_root: hash('legacy-comparison'),
      qualification: 'PRELIMINARY_NONPROMOTING_COMPARISON_FOR_I1Q_1008F',
      legacy_promotions: 0,
      destructive_merge_performed: false,
    },
    sourceContentMetrics: {
      transcript_segment_count: 3,
      nodes_record_count: 4,
      transcript_byte_count: 5,
      artifact_retry_count: 2,
      malformed_record_count: 1,
      repaired_record_count: 0,
      unrecoverable_record_count: 1,
      newly_recovered_transcript_count: 0,
      newly_recovered_nodes_count: 0,
    },
  });

  const candidates = projected.candidate_inventory_safe_summary;
  assert.equal(candidates.total_occurrences, 3);
  assert.equal(candidates.retained_occurrence_count, 2);
  assert.equal(candidates.exact_explicit_question_class_occurrences, 1);
  assert.equal(candidates.implicit_question_class_occurrences, 1);
  assert.equal(candidates.implicit_or_reconstructed_question_occurrences, 1);
  assert.equal(candidates.verbatim_count, 2);
  assert.equal(candidates.reconstructed_count, 1);
  assert.equal(candidates.normalized_count, 3);
  assert.equal(candidates.assessment_suitability_status_histogram.SUITABLE, 2);

  const concepts = projected.provisional_concept_summary;
  assert.equal(concepts.provisional_duplicate_cluster_count, 1);
  assert.equal(concepts.duplicate_relationship_type_histogram.SAME_CONCEPT_SAME_TARGET, 1);
  assert.equal(concepts.i1q1008f_candidate_concept_count, 1);

  assert.equal(
    projected.legacy_comparison_safe_summary.legacy_rows_with_possible_transcript_support_count,
    1,
  );
  assert.equal(projected.legacy_comparison_safe_summary.unresolved_comparison_count, 846);
  assert.equal(projected.source_content_safe_summary.nodes_record_count, 4);
  assert.equal(projected.source_content_safe_summary.transcript_byte_count, 5);
  assert.equal(JSON.stringify(projected).includes('privacy_safe_normalized_wording'), false);
  assert.equal(JSON.stringify(projected).includes('synthetic fixture wording only'), false);
});

test('safe source-content metrics reject unknown or negative values', () => {
  assert.throws(() => projectSafeArtifacts({
    extractionRunId: 'opaque_run_fixture_safe_0002',
    authorityTicketHash: hash('ticket'),
    predecessorCommit: hash('commit'),
    predecessorReceiptHash: hash('predecessor'),
    boundaryDecisionHash: hash('boundary'),
    roster: [],
    artifactLedger: contentAddressedEnvelope({
      schema_version: 'fixture.ledger.v1', extraction_complete: false, artifacts: [],
    }),
    occurrences: [],
    concepts: [],
    retryLedger: contentAddressedEnvelope({ schema_version: 'fixture.retry.v1' }),
    sourceContentMetrics: {
      transcript_segment_count: -1,
      nodes_record_count: 0,
      transcript_byte_count: 0,
      artifact_retry_count: 0,
      malformed_record_count: 0,
      repaired_record_count: 0,
      unrecoverable_record_count: 0,
      newly_recovered_transcript_count: 0,
      newly_recovered_nodes_count: 0,
    },
  }), /source_content_metric_rejected/u);
});
