import { sha256 } from '../hash.mjs';

const SHA256_HEX = /^[a-f0-9]{64}$/u;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const RETAINED_COUNT_KEYS = Object.freeze([
  'authorized_sources',
  'registry_rows',
  'transcripts_available',
  'nodes_available',
  'verified_drj_sources',
  'multi_speaker_sources',
  'working_redacted_sources',
  'extraction_ready_sources',
  'duplicate_source_groups',
]);
const INPUT_COUNT_KEYS = Object.freeze([
  'local_vtt_files',
  'local_transcript_caption_subtitle_data_files',
  'local_nodes_or_media_registry_artifacts',
  'seeded_drill_rows_with_stream_vtt_nodes_references',
  'sidecar_paths_referenced_by_seed',
  'checked_in_stat_runtime_index_lookup_json',
  'matching_historical_git_blobs',
  'static_v4_sql_insert_statements',
  'registered_i1q_missions',
  'registered_i1q_products_or_passports',
  ...RETAINED_COUNT_KEYS,
]);
const RETAINED_TOTAL_KEYS = Object.freeze([
  'authorized_sources',
  'transcripts_available',
  'nodes_available',
  'verified_drj_sources',
  'extraction_ready_sources',
]);
const ALLOWED_BLOCKERS = Object.freeze([
  'all_sources_privacy_blocked',
  'working_redacted_transcripts_not_created',
  'privacy_pilot_not_passed',
]);
const PRIVACY_PASS_KEYS = Object.freeze([
  'schema_version', 'status', 'source_complete', 'evaluated_source_count', 'pilot_video_count',
  'stratification_manifest',
  'required_class_denominators_complete', 'metrics_gate_status', 'rights_manifest_complete', 'attribution_manifest_complete',
  'working_artifact_manifest_complete', 'question_recall_denominator_complete', 'question_gold_count',
  'rights_manifest_hash', 'attribution_manifest_hash', 'working_artifact_manifest_hash',
  'privacy_exit_report_hash', 'question_gold_manifest_hash', 'content_hash',
]);
const STRATIFICATION_MANIFEST_KEYS = Object.freeze([
  'schema_version', 'pilot_video_count', 'pilot_source_manifest_hash', 'specialty_bucket_counts',
  'transcript_quality', 'speaker_count', 'teaching_style', 'recording_age', 'source_length',
  'content_hash',
]);
const BINARY_STRATA = Object.freeze({
  transcript_quality: Object.freeze(['clean', 'poor']),
  speaker_count: Object.freeze(['single_speaker', 'multi_speaker']),
  teaching_style: Object.freeze(['recall_heavy', 'reasoning_heavy']),
  recording_age: Object.freeze(['older', 'newer']),
  source_length: Object.freeze(['short', 'long']),
});
const AGGREGATE_SNAPSHOT_KEYS = Object.freeze([
  'schema_version', 'retention_class', 'status', 'classification', 'evidence_scope',
  'source_observed_at', 'qualification', 'current_access_verified',
  'source_universe_completeness_status', 'row_manifest_retained',
  'segment_authority_manifest_retained', 'transcript_bytes_accessible_in_workspace',
  'independently_recomputable_from_git', 'registry_sha256', 'probe_manifest_sha256',
  'counts', 'real_inventory_totals', 'blockers', 'source_mutations',
  'source_factory_derivation_allowed', 'content_hash',
]);

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function selectCounts(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}_object_required`);
  const selected = {};
  for (const key of keys) {
    if (!nonNegativeInteger(value[key])) throw new Error(`${label}_invalid:${key}`);
    selected[key] = value[key];
  }
  return selected;
}

function validateCountEnvelope(value, keys, label) {
  if (!exactKeys(value, keys)) throw new Error(`${label}_envelope_invalid`);
  for (const key of keys) if (!nonNegativeInteger(value[key])) throw new Error(`${label}_invalid:${key}`);
}

function contentHashMatches(value) {
  if (!value || !SHA256_HEX.test(value.content_hash || '')) return false;
  const payload = structuredClone(value);
  delete payload.content_hash;
  return value.content_hash === sha256(payload);
}

function aggregateSnapshotValid(snapshot) {
  if (!exactKeys(snapshot, AGGREGATE_SNAPSHOT_KEYS) || !contentHashMatches(snapshot)) return false;
  if (snapshot.schema_version !== 'missionmed.i1q.restricted_corpus_aggregate.v2'
    || snapshot.retention_class !== 'AGGREGATE_ONLY_NO_IDENTITY_BEARING_SOURCE_DATA'
    || snapshot.status !== 'REAL_CORPUS_INVENTORIED'
    || snapshot.classification !== 'REAL_CORPUS'
    || snapshot.evidence_scope !== 'POINT_IN_TIME_AGGREGATE'
    || !ISO_INSTANT.test(snapshot.source_observed_at || '')
    || typeof snapshot.qualification !== 'string'
    || snapshot.qualification.trim().length === 0
    || typeof snapshot.current_access_verified !== 'boolean'
    || !['NOT_ESTABLISHED', 'PROVEN_COMPLETE'].includes(snapshot.source_universe_completeness_status)
    || typeof snapshot.row_manifest_retained !== 'boolean'
    || typeof snapshot.segment_authority_manifest_retained !== 'boolean'
    || typeof snapshot.transcript_bytes_accessible_in_workspace !== 'boolean'
    || typeof snapshot.independently_recomputable_from_git !== 'boolean'
    || !SHA256_HEX.test(snapshot.registry_sha256 || '')
    || !SHA256_HEX.test(snapshot.probe_manifest_sha256 || '')
    || snapshot.source_mutations !== 0
    || snapshot.source_factory_derivation_allowed !== false
    || !Array.isArray(snapshot.blockers)
    || snapshot.blockers.some((blocker) => !ALLOWED_BLOCKERS.includes(blocker))) return false;
  try {
    validateCountEnvelope(snapshot.counts, RETAINED_COUNT_KEYS, 'aggregate_counts');
    validateCountEnvelope(snapshot.real_inventory_totals, RETAINED_TOTAL_KEYS, 'aggregate_totals');
  } catch {
    return false;
  }
  if (snapshot.source_universe_completeness_status === 'PROVEN_COMPLETE'
    && (snapshot.current_access_verified !== true || snapshot.row_manifest_retained !== true)) return false;
  const counts = snapshot.counts;
  const totals = snapshot.real_inventory_totals;
  return totals.authorized_sources === counts.authorized_sources
    && totals.transcripts_available === counts.transcripts_available
    && totals.nodes_available === counts.nodes_available
    && totals.verified_drj_sources === counts.verified_drj_sources
    && totals.extraction_ready_sources === counts.extraction_ready_sources
    && counts.registry_rows <= counts.authorized_sources
    && counts.transcripts_available <= counts.authorized_sources
    && counts.nodes_available <= counts.authorized_sources
    && counts.verified_drj_sources <= counts.authorized_sources
    && counts.multi_speaker_sources <= counts.authorized_sources
    && counts.working_redacted_sources <= counts.authorized_sources
    && counts.extraction_ready_sources <= counts.working_redacted_sources
    && counts.duplicate_source_groups <= counts.authorized_sources;
}

function binaryStratumValid(value, keys, pilotVideoCount) {
  return exactKeys(value, keys)
    && keys.every((key) => Number.isInteger(value[key]) && value[key] > 0)
    && keys.reduce((sum, key) => sum + value[key], 0) === pilotVideoCount;
}

function stratificationManifestValid(manifest, inventory, pilotVideoCount) {
  if (!exactKeys(manifest, STRATIFICATION_MANIFEST_KEYS) || !contentHashMatches(manifest)) return false;
  if (manifest.schema_version !== 'missionmed.i1q.am11_stratification.v1'
    || manifest.pilot_video_count !== pilotVideoCount
    || !SHA256_HEX.test(manifest.pilot_source_manifest_hash || '')
    || !Array.isArray(manifest.specialty_bucket_counts)
    || manifest.specialty_bucket_counts.length < 3
    || manifest.specialty_bucket_counts.some((count) => !Number.isInteger(count) || count <= 0)
    || manifest.specialty_bucket_counts.reduce((sum, count) => sum + count, 0) !== pilotVideoCount) return false;
  for (const [dimension, keys] of Object.entries(BINARY_STRATA)) {
    if (!binaryStratumValid(manifest[dimension], keys, pilotVideoCount)) return false;
  }
  const authorizedSources = inventory?.counts?.authorized_sources;
  const inventoryMultiSpeaker = inventory?.counts?.multi_speaker_sources;
  return Number.isInteger(authorizedSources)
    && Number.isInteger(inventoryMultiSpeaker)
    && manifest.speaker_count.multi_speaker <= inventoryMultiSpeaker
    && manifest.speaker_count.single_speaker <= authorizedSources - inventoryMultiSpeaker;
}

function privacyPassRecordStructurallyValid(record, inventory) {
  if (!exactKeys(record, PRIVACY_PASS_KEYS) || !contentHashMatches(record)) return false;
  const authorizedSources = inventory?.counts?.authorized_sources;
  const requiredHashes = [
    'rights_manifest_hash', 'attribution_manifest_hash', 'working_artifact_manifest_hash',
    'privacy_exit_report_hash', 'question_gold_manifest_hash',
  ];
  return record.schema_version === 'missionmed.i1q.privacy_gold_pass.v1'
    && record.status === 'pass'
    && record.source_complete === true
    && record.evaluated_source_count === authorizedSources
    && Number.isInteger(record.pilot_video_count)
    && record.pilot_video_count >= 8
    && stratificationManifestValid(record.stratification_manifest, inventory, record.pilot_video_count)
    && record.required_class_denominators_complete === true
    && record.metrics_gate_status === 'PASS_ALL_RATIFIED_THRESHOLDS'
    && record.rights_manifest_complete === true
    && record.attribution_manifest_complete === true
    && record.working_artifact_manifest_complete === true
    && record.question_recall_denominator_complete === true
    && Number.isInteger(record.question_gold_count)
    && record.question_gold_count > 0
    && requiredHashes.every((key) => SHA256_HEX.test(record[key] || ''));
}

export function retainedAggregateSnapshot(inventoryEvidence, workspaceProbe = null) {
  if (!exactKeys(inventoryEvidence, [
    'generated_at', 'status', 'classification', 'evidence_scope', 'row_manifest_retained',
    'independently_recomputable_from_git', 'qualification', 'registry_sha256',
    'probe_manifest_sha256', 'counts', 'real_inventory_totals', 'blockers', 'source_mutations',
  ])) throw new Error('restricted_inventory_envelope_invalid');
  if (inventoryEvidence.status !== 'REAL_CORPUS_INVENTORIED') throw new Error('restricted_inventory_status_invalid');
  if (inventoryEvidence.classification !== 'REAL_CORPUS') throw new Error('restricted_inventory_classification_invalid');
  if (inventoryEvidence.evidence_scope !== 'POINT_IN_TIME_AGGREGATE') throw new Error('restricted_inventory_scope_invalid');
  if (typeof inventoryEvidence.row_manifest_retained !== 'boolean') throw new Error('restricted_inventory_row_manifest_flag_invalid');
  if (typeof inventoryEvidence.independently_recomputable_from_git !== 'boolean') throw new Error('restricted_inventory_recomputability_flag_invalid');
  if (!SHA256_HEX.test(inventoryEvidence.registry_sha256 || '')) throw new Error('restricted_inventory_registry_hash_invalid');
  if (!SHA256_HEX.test(inventoryEvidence.probe_manifest_sha256 || '')) throw new Error('restricted_inventory_probe_hash_invalid');
  if (!Array.isArray(inventoryEvidence.blockers) || inventoryEvidence.blockers.some((blocker) => !ALLOWED_BLOCKERS.includes(blocker))) {
    throw new Error('restricted_inventory_blockers_invalid');
  }
  if (inventoryEvidence.source_mutations !== 0) throw new Error('restricted_inventory_source_mutations_invalid');
  validateCountEnvelope(inventoryEvidence.counts, INPUT_COUNT_KEYS, 'restricted_inventory_counts');
  validateCountEnvelope(inventoryEvidence.real_inventory_totals, RETAINED_TOTAL_KEYS, 'restricted_inventory_totals');

  const snapshot = {
    schema_version: 'missionmed.i1q.restricted_corpus_aggregate.v2',
    retention_class: 'AGGREGATE_ONLY_NO_IDENTITY_BEARING_SOURCE_DATA',
    status: inventoryEvidence.status,
    classification: inventoryEvidence.classification,
    evidence_scope: inventoryEvidence.evidence_scope,
    source_observed_at: inventoryEvidence.generated_at,
    qualification: inventoryEvidence.qualification,
    current_access_verified: false,
    source_universe_completeness_status: 'NOT_ESTABLISHED',
    row_manifest_retained: inventoryEvidence.row_manifest_retained,
    segment_authority_manifest_retained: false,
    transcript_bytes_accessible_in_workspace: workspaceProbe
      ? workspaceProbe.counts?.transcript_or_caption_candidates > 0
      : inventoryEvidence.counts.local_vtt_files > 0
        || inventoryEvidence.counts.local_transcript_caption_subtitle_data_files > 0,
    independently_recomputable_from_git: inventoryEvidence.independently_recomputable_from_git,
    registry_sha256: inventoryEvidence.registry_sha256,
    probe_manifest_sha256: inventoryEvidence.probe_manifest_sha256,
    counts: selectCounts(inventoryEvidence.counts, RETAINED_COUNT_KEYS, 'restricted_inventory_counts'),
    real_inventory_totals: selectCounts(inventoryEvidence.real_inventory_totals, RETAINED_TOTAL_KEYS, 'restricted_inventory_totals'),
    blockers: [...inventoryEvidence.blockers],
    source_mutations: 0,
    source_factory_derivation_allowed: false,
  };
  snapshot.content_hash = sha256(snapshot);
  return snapshot;
}

export function evaluateTranscriptFactoryGate({ inventory, privacyGoldEvaluation, medicalGovernanceAssigned = false }) {
  const draftingBlockers = [];
  const counts = inventory?.counts;
  const authorizedSources = counts?.authorized_sources;
  if (!Number.isInteger(authorizedSources) || authorizedSources <= 0 || !aggregateSnapshotValid(inventory)) {
    draftingBlockers.push('authorized_source_denominator_missing_or_invalid');
  }
  if (!Number.isInteger(counts?.registry_rows) || counts.registry_rows !== authorizedSources) {
    draftingBlockers.push('privacy_safe_registry_denominator_incomplete');
  }
  if (!Number.isInteger(counts?.transcripts_available) || counts.transcripts_available !== authorizedSources
    || !Number.isInteger(counts?.nodes_available) || counts.nodes_available !== authorizedSources) {
    draftingBlockers.push('transcript_or_node_artifact_denominator_incomplete');
  }
  if (!Number.isInteger(counts?.verified_drj_sources) || counts.verified_drj_sources !== authorizedSources) {
    draftingBlockers.push('drj_speaker_authority_denominator_incomplete');
  }
  if (inventory?.current_access_verified !== true) draftingBlockers.push('current_corpus_access_not_verified');
  if (inventory?.source_universe_completeness_status !== 'PROVEN_COMPLETE') {
    draftingBlockers.push('source_universe_completeness_not_established');
  }
  if (inventory?.segment_authority_manifest_retained !== true) draftingBlockers.push('segment_authority_manifest_missing');
  if (inventory?.transcript_bytes_accessible_in_workspace !== true) draftingBlockers.push('transcript_bytes_not_accessible_in_workspace');
  if (!Number.isInteger(counts?.multi_speaker_sources) || counts.multi_speaker_sources <= 0
    || !Number.isInteger(authorizedSources) || counts.multi_speaker_sources >= authorizedSources) {
    draftingBlockers.push('am11_single_and_multi_speaker_inventory_strata_unavailable');
  }
  if (inventory?.row_manifest_retained !== true) draftingBlockers.push('privacy_safe_row_manifest_missing');
  if (inventory?.source_factory_derivation_allowed !== true) draftingBlockers.push('restricted_source_derivation_not_authorized');
  if (!Number.isInteger(counts?.working_redacted_sources) || counts.working_redacted_sources < 0
    || counts.working_redacted_sources !== authorizedSources) {
    draftingBlockers.push('working_redacted_source_denominator_incomplete');
  }
  if (!Number.isInteger(counts?.extraction_ready_sources) || counts.extraction_ready_sources < 0
    || counts.extraction_ready_sources !== authorizedSources) {
    draftingBlockers.push('extraction_ready_source_denominator_incomplete');
  }
  if (!privacyPassRecordStructurallyValid(privacyGoldEvaluation, inventory)) {
    draftingBlockers.push('source_complete_privacy_gold_evaluation_not_passed');
  }
  if (privacyGoldEvaluation?.question_recall_denominator_complete !== true
    || !Number.isInteger(privacyGoldEvaluation?.question_gold_count)
    || privacyGoldEvaluation.question_gold_count <= 0) {
    draftingBlockers.push('question_recall_denominator_not_established');
  }
  draftingBlockers.push('trusted_privacy_authority_verification_unavailable');
  const approvalBlockers = medicalGovernanceAssigned === true ? [] : ['credentialed_medical_governance_unassigned'];
  approvalBlockers.push('candidate_level_physician_review_not_performed');
  const gate = {
    schema_version: 'missionmed.i1q.transcript_factory_gate.v1',
    status: draftingBlockers.length === 0 ? 'PASS_INTERNAL_DRAFTING_ONLY' : 'BLOCKED',
    transcript_candidate_generation_allowed: draftingBlockers.length === 0,
    medical_approval_allowed: false,
    release_allowed: false,
    drafting_blockers: draftingBlockers,
    approval_blockers: approvalBlockers,
    blockers: [...draftingBlockers, ...approvalBlockers],
    qualification: 'This local gate cannot establish trusted privacy authority or authorize restricted-source derivation. A future externally trusted execution boundary may authorize quarantined drafting only; editorial, medical, privacy, rights, release-validator, and Brian ratification gates still apply.',
  };
  gate.content_hash = sha256(gate);
  return gate;
}

export function assertTranscriptFactoryGate(input) {
  const gate = evaluateTranscriptFactoryGate(input);
  if (gate.transcript_candidate_generation_allowed !== true) {
    throw new Error(`transcript_source_factory_blocked:${gate.blockers.join(',')}`);
  }
  return gate;
}
