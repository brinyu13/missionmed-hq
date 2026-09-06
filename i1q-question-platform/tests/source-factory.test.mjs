import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { PILOT_LIBRARY } from '../content/i1q-1008c/pilot-library.mjs';
import {
  AUTHORITY_AUTHORING_INPUT_PATHS,
  EVIDENCE_CLAIM_TYPES,
  SOURCE_FACTORY_ARTIFACT_PATHS,
  VARIANT_FORMS,
} from '../src/source-factory/contracts.mjs';
import { authoringRunArtifact, createAuthorityDerivedCandidate } from '../src/source-factory/authoring.mjs';
import { auditCandidateDedupe, tokenJaccard } from '../src/source-factory/dedupe.mjs';
import {
  validateBuildManifestEnvelope,
  validateAuthoringRunEnvelope,
  validateCandidateLibraryEnvelope,
  validateTranscriptGateEnvelope,
} from '../src/source-factory/envelopes.mjs';
import { auditLegacyV4, parseLegacyV4Migration } from '../src/source-factory/legacy-v4.mjs';
import { validateCandidate, validateCandidateLibrary, withCandidateContentHash } from '../src/source-factory/quality.mjs';
import { assertTranscriptFactoryGate, evaluateTranscriptFactoryGate, retainedAggregateSnapshot } from '../src/source-factory/restricted-corpus.mjs';
import {
  MISCONCEPTION_VOCABULARY,
  TAXONOMY,
  misconceptionIdForCategory,
  taxonomyArtifact,
  validateClassification,
} from '../src/source-factory/taxonomy.mjs';
import { transcriptResumeManifest } from '../src/source-factory/transcript-resume.mjs';
import {
  classifyWorkspaceCorpusPath,
  probeWorkspaceCorpusAccess,
  workspaceCorpusProbeValid,
} from '../src/source-factory/workspace-corpus-probe.mjs';
import { sha256 } from '../src/hash.mjs';

const APP_ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKTREE = join(APP_ROOT, '..');
const LEGACY_SQL = await readFile(join(WORKTREE, 'supabase/migrations/20260420111000_stat_dataset_ingest.sql'), 'utf8');
const LEGACY_ROWS = parseLegacyV4Migration(LEGACY_SQL);

function clone(value) {
  return structuredClone(value);
}

function withHash(value) {
  const payload = clone(value);
  payload.content_hash = sha256(payload);
  return payload;
}

function rehashEnvelope(value) {
  const payload = clone(value);
  delete payload.content_hash;
  payload.content_hash = sha256(payload);
  return payload;
}

function structurallyCompletePrivacyGold(authorizedSources) {
  const stratificationManifest = withHash({
    schema_version: 'missionmed.i1q.am11_stratification.v1',
    pilot_video_count: 8,
    pilot_source_manifest_hash: '9'.repeat(64),
    specialty_bucket_counts: [3, 3, 2],
    transcript_quality: { clean: 4, poor: 4 },
    speaker_count: { single_speaker: 4, multi_speaker: 4 },
    teaching_style: { recall_heavy: 4, reasoning_heavy: 4 },
    recording_age: { older: 4, newer: 4 },
    source_length: { short: 4, long: 4 },
  });
  return withHash({
    schema_version: 'missionmed.i1q.privacy_gold_pass.v1',
    status: 'pass',
    source_complete: true,
    evaluated_source_count: authorizedSources,
    pilot_video_count: 8,
    stratification_manifest: stratificationManifest,
    required_class_denominators_complete: true,
    metrics_gate_status: 'PASS_ALL_RATIFIED_THRESHOLDS',
    rights_manifest_complete: true,
    attribution_manifest_complete: true,
    working_artifact_manifest_complete: true,
    question_recall_denominator_complete: true,
    question_gold_count: 24,
    rights_manifest_hash: 'b'.repeat(64),
    attribution_manifest_hash: 'c'.repeat(64),
    working_artifact_manifest_hash: 'd'.repeat(64),
    privacy_exit_report_hash: 'e'.repeat(64),
    question_gold_manifest_hash: 'f'.repeat(64),
  });
}

test('legacy v4 parser preserves all rows and immutable source identifiers', () => {
  assert.equal(LEGACY_ROWS.length, 845);
  assert.equal(new Set(LEGACY_ROWS.map((row) => row.question_id)).size, 845);
  assert.equal(LEGACY_ROWS.filter((row) => row.row_type === 'base').length, 517);
  assert.equal(LEGACY_ROWS.filter((row) => row.row_type === 'vignette').length, 328);
  assert.ok(LEGACY_ROWS.every((row) => /^[a-f0-9]{64}$/u.test(row.content_hash)));
  assert.equal(LEGACY_SQL.includes("('v4',"), true);
});

test('legacy audit distinguishes exact and normalized duplicates and preserves every row', () => {
  const audit = auditLegacyV4(LEGACY_ROWS);
  assert.equal(audit.exact_duplicate_prompt_group_count, 11);
  assert.equal(audit.normalized_duplicate_prompt_group_count, 12);
  assert.equal(audit.variant_family_count, 328);
  assert.equal(audit.row_manifest.length, 845);
  assert.equal(audit.source_mutations, 0);
  assert.deepEqual(audit.answer_distribution, { A: 845, B: 0, C: 0, D: 0 });
});

test('legacy structural census reproduces independent red-team denominators', () => {
  const census = auditLegacyV4(LEGACY_ROWS).quality_census;
  assert.deepEqual({
    production_ready_rows: census.production_ready_rows,
    truncation: census.explanations_with_literal_ellipsis,
    fi_fl: census.rows_with_fi_fl_ligature,
    all_ligatures: census.rows_with_any_alphabetic_ligature,
    malformed: census.rows_with_malformed_comma_period,
    parentheses: census.rows_with_unmatched_parentheses,
    reuse: census.base_distractor_occurrences_matching_other_keyed_answers,
    denominator: census.base_distractor_occurrences,
    any: census.base_rows_with_any_reused_distractor,
    all_three: census.base_rows_with_all_three_reused_distractors,
  }, {
    production_ready_rows: 0,
    truncation: 56,
    fi_fl: 304,
    all_ligatures: 316,
    malformed: 28,
    parentheses: 28,
    reuse: 1527,
    denominator: 1551,
    any: 516,
    all_three: 495,
  });
});

test('legacy parser fails closed on malformed tuple shape', () => {
  assert.throws(() => parseLegacyV4Migration("('v4', 'id', 'too few')\n"), /legacy_v4_tuple_field_count/u);
});

test('candidate benchmark passes the quarantined contract with exact answer balance', () => {
  const result = validateCandidateLibrary(PILOT_LIBRARY);
  assert.deepEqual(result.errors, []);
  assert.equal(result.metrics.candidate_count, 24);
  assert.deepEqual(result.metrics.answer_distribution, { A: 6, B: 6, C: 6, D: 6 });
  assert.equal(result.metrics.cross_item_key_text_reuse_count, 0);
});

test('candidate validator is total for malformed arbitrary JSON shapes', () => {
  const malformed = [
    null,
    { content_sba: { choices: 'not-an-array' }, evidence_claims: [] },
    { evidence_claims: [{ authority_refs: 'not-an-array' }] },
    { content_sba: { choices: [null] }, source_bundle: { source_refs: [null] } },
    { content_sba: { answer_key: 'A', choices: {} } },
    { content_sba: { answer_key: 'A', choices: 42 } },
    { content_sba: { answer_key: 'A', choices: 'not-an-array' } },
  ];
  for (const value of malformed) {
    assert.doesNotThrow(() => validateCandidate(value));
    assert.ok(validateCandidate(value).length > 0);
  }
  assert.doesNotThrow(() => validateCandidateLibrary([null, ...malformed]));
});

test('candidate hash is mandatory and tampering is detected', () => {
  const missing = clone(PILOT_LIBRARY[0]);
  delete missing.content_hash;
  assert.ok(validateCandidate(missing).includes('content_hash_required'));
  const tampered = clone(PILOT_LIBRARY[0]);
  tampered.content_sba.stem = `${tampered.content_sba.stem} Tampered.`;
  assert.ok(validateCandidate(tampered).includes('content_hash_mismatch'));
});

test('candidate contract rejects unknown private fields and banned choice wording', () => {
  const privateField = clone(PILOT_LIBRARY[0]);
  privateField.raw_transcript = 'forbidden';
  privateField.content_hash = sha256(Object.fromEntries(Object.entries(privateField).filter(([key]) => key !== 'content_hash')));
  const privateErrors = validateCandidate(privateField);
  assert.ok(privateErrors.includes('candidate:unknown_key:raw_transcript'));
  assert.ok(privateErrors.some((error) => error.startsWith('prohibited_key:')));

  const banned = clone(PILOT_LIBRARY[0]);
  banned.content_sba.choices[3].text = 'All of the above';
  const rehashed = withCandidateContentHash(banned);
  assert.ok(validateCandidate(rehashed).some((error) => error.startsWith('banned_item_wording:')));
});

test('candidate contract rejects value-level identity signals, impossible dates, stale versions, and forged merges', () => {
  const identity = clone(PILOT_LIBRARY[0]);
  identity.content_sba.stem = `${identity.content_sba.stem} MRN: 1234567.`;
  assert.ok(validateCandidate(withCandidateContentHash(identity)).some((error) => error.startsWith('obvious_identity_marker_detected:')));

  const date = clone(PILOT_LIBRARY[0]);
  date.evidence_claims[0].authority_refs[0].review_by_date = '2026-99-99';
  date.evidence_claims[0].review_by_date = '2026-99-99';
  assert.ok(validateCandidate(withCandidateContentHash(date)).some((error) => error.includes('review_by_date_invalid')));

  const version = clone(PILOT_LIBRARY[0]);
  version.build_version = 'stale-or-invented';
  assert.ok(validateCandidate(withCandidateContentHash(version)).includes('build_version_invalid'));

  const merge = clone(PILOT_LIBRARY[0]);
  merge.source_bundle.merge_status = 'HUMAN_ADJUDICATED_CANONICAL';
  merge.source_bundle.merge_decision_hash = '0'.repeat(64);
  const mergeErrors = validateCandidate(withCandidateContentHash(merge));
  assert.ok(mergeErrors.includes('merge_status_invalid'));
  assert.ok(mergeErrors.includes('merge_decision_hash_mismatch'));
});

test('candidate contract fails closed on unsupported source lanes and answer provenance', () => {
  const transcriptLane = clone(PILOT_LIBRARY[0]);
  transcriptLane.answer_provenance_status = 'TRANSCRIPT_EXPLICIT_ANSWER';
  transcriptLane.source_bundle.transcript_linkage_status = 'VERIFIED_PRIVACY_SAFE_SEGMENT_LINKAGE';
  const errors = validateCandidate(withCandidateContentHash(transcriptLane));
  assert.ok(errors.includes('answer_provenance_must_match_authority_lane'));
  assert.ok(errors.includes('source_lane_unsupported_until_trusted_run_bindings_exist'));
});

test('candidate contract enforces exact warnings, future states, unique source refs, and earliest review date', () => {
  const warnings = clone(PILOT_LIBRARY[0]);
  warnings.warnings = [...warnings.warnings, 'UNREGISTERED_WARNING'];
  assert.ok(validateCandidate(withCandidateContentHash(warnings)).includes('candidate_warnings_invalid'));

  const future = clone(PILOT_LIBRARY[0]);
  future.future_compatibility.noncanonical_future_states = ['inactive', 'archived', 'active'];
  assert.ok(validateCandidate(withCandidateContentHash(future)).includes('future_noncanonical_states_invalid'));

  const duplicateRef = clone(PILOT_LIBRARY[0]);
  duplicateRef.source_bundle.source_refs.push(clone(duplicateRef.source_bundle.source_refs[0]));
  assert.ok(validateCandidate(withCandidateContentHash(duplicateRef)).includes('source_ref_ids_must_be_unique'));

  const reviewDate = clone(PILOT_LIBRARY[0]);
  reviewDate.evidence_claims[0].review_by_date = '2031-01-01';
  assert.ok(validateCandidate(withCandidateContentHash(reviewDate)).some((error) => error.endsWith('review_by_date_must_match_earliest_reference')));
});

test('candidate identity scan covers nested explanations, rationales, claims, and source locators', () => {
  const mutations = [
    (candidate) => { candidate.content_sba.explanation.level_1 = 'Patient Jane Doe MRN: ABC123'; },
    (candidate) => { candidate.content_sba.rationales.correct_answer = 'Patient Jane Doe MRN: ABC123'; },
    (candidate) => { candidate.evidence_claims[0].claim_text = 'Patient Jane Doe MRN: ABC123'; },
    (candidate) => { candidate.source_bundle.source_refs[0].source_locator = 'Patient Jane Doe MRN: ABC123'; },
  ];
  for (const mutate of mutations) {
    const candidate = clone(PILOT_LIBRARY[0]);
    mutate(candidate);
    const errors = validateCandidate(withCandidateContentHash(candidate));
    assert.ok(errors.some((error) => error.startsWith('obvious_identity_marker_detected:')));
  }
});

test('evidence claims support only the keyed answer and authority hashes declare metadata scope', () => {
  for (const candidate of PILOT_LIBRARY) {
    assert.deepEqual(candidate.evidence_claims[0].option_keys_supported, [candidate.content_sba.answer_key]);
    assert.equal(candidate.evidence_claims[0].claim_scope, 'KEYED_ANSWER_ONLY');
    assert.equal(candidate.evidence_claims[0].verification_status, 'UNVERIFIED_AI_DRAFT');
    assert.equal(candidate.evidence_claims[0].verified_by, null);
    assert.ok(candidate.source_bundle.source_refs.every((reference) => reference.source_hash_scope === 'BIBLIOGRAPHIC_METADATA_ONLY_NOT_RETRIEVED_CONTENT'));
  }
});

test('evidence claims use the binding Architecture 1002.1 claim-type enum', () => {
  assert.deepEqual(EVIDENCE_CLAIM_TYPES, ['diagnosis', 'management', 'mechanism', 'epidemiology', 'pharmacology', 'other']);
  assert.ok(PILOT_LIBRARY.every((candidate) => EVIDENCE_CLAIM_TYPES.includes(candidate.evidence_claims[0].claim_type)));
  const noncanonical = clone(PILOT_LIBRARY[0]);
  noncanonical.evidence_claims[0].claim_type = 'screening';
  assert.ok(validateCandidate(withCandidateContentHash(noncanonical)).some((error) => error.includes('claim_type_invalid')));
});

test('authority candidates bind a partial authoring run without claiming transcript extraction', () => {
  for (const candidate of PILOT_LIBRARY) {
    assert.equal(candidate.source_bundle.authoring_run_id, 'authoring.i1q1008c.authority.curation.20260716');
    assert.equal(candidate.source_bundle.transcript_extraction_run_id, null);
    assert.equal(candidate.source_bundle.prompt_contract_version, 'i1q-1008c-authority-curation-v1');
  }
  const inputs = AUTHORITY_AUTHORING_INPUT_PATHS.map((path, index) => ({
    path,
    bytes: index + 1,
    sha256: `${index.toString(16)}`.repeat(64),
  }));
  const output = {
    path: 'i1q-question-platform/content/i1q-1008c/generated/candidate-library.json',
    bytes: 1,
    sha256: 'a'.repeat(64),
    content_hash: 'b'.repeat(64),
  };
  const run = authoringRunArtifact(PILOT_LIBRARY, inputs, output);
  assert.deepEqual(validateAuthoringRunEnvelope(run), []);
  assert.equal(run.am4_provenance_status, 'PARTIAL_RUNTIME_MODEL_PROMPT_PARAMETERS_NOT_CAPTURED');
  assert.equal(run.model_prompt_provenance.mpv_id, null);

  const forgedModel = clone(run);
  forgedModel.model_prompt_provenance.model_label = 'fabricated-model';
  assert.ok(validateAuthoringRunEnvelope(rehashEnvelope(forgedModel)).includes('authoring_run_partial_provenance_invalid'));

  const missingInput = clone(run);
  missingInput.input_bindings.pop();
  assert.ok(validateAuthoringRunEnvelope(rehashEnvelope(missingInput)).includes('authoring_run_input_membership_invalid'));

  const duplicateCandidate = clone(run);
  duplicateCandidate.candidate_bindings[1] = clone(duplicateCandidate.candidate_bindings[0]);
  assert.ok(validateAuthoringRunEnvelope(rehashEnvelope(duplicateCandidate)).includes('authoring_run_candidate_binding_duplicate'));

  const unknown = clone(run);
  unknown.runtime_model = 'fabricated';
  assert.deepEqual(validateAuthoringRunEnvelope(rehashEnvelope(unknown)), ['authoring_run_envelope_invalid']);
});

test('candidate library detects exact cross-item keyed-answer reuse', () => {
  const first = clone(PILOT_LIBRARY[0]);
  const second = clone(PILOT_LIBRARY[1]);
  const firstAnswer = first.content_sba.choices.find((choice) => choice.key === first.content_sba.answer_key).text;
  const distractor = second.content_sba.choices.find((choice) => choice.key !== second.content_sba.answer_key);
  distractor.text = firstAnswer;
  const result = validateCandidateLibrary([first, withCandidateContentHash(second)]);
  assert.ok(result.errors.some((error) => error.startsWith('cross_item_key_text_reuse:')));
});

test('dedupe audit keeps distinct carbon-monoxide assertions in distinct concept and variant groups', () => {
  const audit = auditCandidateDedupe(PILOT_LIBRARY);
  assert.equal(audit.exact_duplicate_groups.length, 0);
  assert.equal(audit.normalized_duplicate_groups.length, 0);
  assert.equal(audit.near_duplicate_pairs.length, 0);
  assert.equal(audit.concept_variant_groups.length, 0);
  const carbonMonoxide = PILOT_LIBRARY.filter((candidate) => candidate.classification.topic === 'carbon_monoxide_poisoning');
  assert.equal(carbonMonoxide.length, 2);
  assert.equal(new Set(carbonMonoxide.map((candidate) => candidate.classification.primary_concept_id)).size, 2);
  assert.equal(new Set(carbonMonoxide.map((candidate) => candidate.variant_group_key)).size, 2);
  assert.equal(audit.semantic_adjudication_complete, false);
  assert.equal(tokenJaccard('New severe chest pain now', 'Severe new chest pain now'), 1);
});

test('aggregate corpus snapshot retains observation qualification without claiming current access or completeness', async () => {
  const input = JSON.parse(await readFile(join(APP_ROOT, 'evidence/inventory_report.json'), 'utf8'));
  const workspaceProbe = await probeWorkspaceCorpusAccess(WORKTREE, {
    excludedPaths: [
      ...SOURCE_FACTORY_ARTIFACT_PATHS,
      'i1q-question-platform/evidence/source-factory/build-manifest.json',
    ],
  });
  const snapshot = retainedAggregateSnapshot(input, workspaceProbe);
  assert.equal(snapshot.generated_at, undefined);
  assert.equal(snapshot.source_observed_at, input.generated_at);
  assert.equal(snapshot.qualification, input.qualification);
  assert.equal(snapshot.current_access_verified, false);
  assert.equal(snapshot.source_universe_completeness_status, 'NOT_ESTABLISHED');
  assert.equal(snapshot.segment_authority_manifest_retained, false);
  assert.equal(snapshot.transcript_bytes_accessible_in_workspace, false);
  assert.equal(snapshot.counts.authorized_sources, 97);
  assert.equal(snapshot.content_hash, sha256(Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'content_hash'))));
});

test('current transcript corpus is fail-closed at privacy and recall gates', async () => {
  const inventory = retainedAggregateSnapshot(JSON.parse(await readFile(join(APP_ROOT, 'evidence/inventory_report.json'), 'utf8')));
  const gate = evaluateTranscriptFactoryGate({ inventory, privacyGoldEvaluation: null, medicalGovernanceAssigned: false });
  assert.equal(gate.status, 'BLOCKED');
  assert.equal(gate.transcript_candidate_generation_allowed, false);
  assert.ok(gate.drafting_blockers.includes('privacy_safe_row_manifest_missing'));
  assert.ok(gate.drafting_blockers.includes('source_complete_privacy_gold_evaluation_not_passed'));
  assert.ok(gate.approval_blockers.includes('credentialed_medical_governance_unassigned'));
  assert.throws(() => assertTranscriptFactoryGate({ inventory, privacyGoldEvaluation: null, medicalGovernanceAssigned: false }), /transcript_source_factory_blocked/u);
});

test('structurally complete synthetic privacy evidence cannot bypass the missing trust anchor', () => {
  const inventory = withHash({
    schema_version: 'missionmed.i1q.restricted_corpus_aggregate.v2',
    retention_class: 'AGGREGATE_ONLY_NO_IDENTITY_BEARING_SOURCE_DATA',
    status: 'REAL_CORPUS_INVENTORIED',
    classification: 'REAL_CORPUS',
    evidence_scope: 'POINT_IN_TIME_AGGREGATE',
    source_observed_at: '2026-07-16T00:00:00.000Z',
    qualification: 'Synthetic complete-access fixture for trust-boundary rejection testing.',
    current_access_verified: true,
    source_universe_completeness_status: 'PROVEN_COMPLETE',
    row_manifest_retained: true,
    segment_authority_manifest_retained: true,
    transcript_bytes_accessible_in_workspace: true,
    independently_recomputable_from_git: true,
    registry_sha256: '1'.repeat(64),
    probe_manifest_sha256: '2'.repeat(64),
    counts: {
      authorized_sources: 8, registry_rows: 8, transcripts_available: 8, nodes_available: 8,
      verified_drj_sources: 8, multi_speaker_sources: 4, working_redacted_sources: 8,
      extraction_ready_sources: 8, duplicate_source_groups: 0,
    },
    real_inventory_totals: {
      authorized_sources: 8, transcripts_available: 8, nodes_available: 8,
      verified_drj_sources: 8, extraction_ready_sources: 8,
    },
    blockers: [],
    source_mutations: 0,
    source_factory_derivation_allowed: false,
  });
  const input = {
    inventory,
    privacyGoldEvaluation: structurallyCompletePrivacyGold(8),
    medicalGovernanceAssigned: false,
  };
  const gate = evaluateTranscriptFactoryGate(input);
  assert.equal(gate.status, 'BLOCKED');
  assert.equal(gate.transcript_candidate_generation_allowed, false);
  assert.equal(gate.medical_approval_allowed, false);
  assert.equal(gate.release_allowed, false);
  assert.ok(gate.drafting_blockers.includes('restricted_source_derivation_not_authorized'));
  assert.ok(gate.drafting_blockers.includes('trusted_privacy_authority_verification_unavailable'));
  assert.ok(gate.approval_blockers.includes('credentialed_medical_governance_unassigned'));
  assert.ok(gate.approval_blockers.includes('candidate_level_physician_review_not_performed'));
  assert.throws(() => assertTranscriptFactoryGate(input), /trusted_privacy_authority_verification_unavailable/u);
});

test('inconsistent aggregate denominators and incomplete AM-11 strata fail closed', () => {
  const inventory = withHash({
    schema_version: 'missionmed.i1q.restricted_corpus_aggregate.v2',
    retention_class: 'AGGREGATE_ONLY_NO_IDENTITY_BEARING_SOURCE_DATA',
    status: 'REAL_CORPUS_INVENTORIED',
    classification: 'REAL_CORPUS',
    evidence_scope: 'POINT_IN_TIME_AGGREGATE',
    source_observed_at: '2026-07-16T00:00:00.000Z',
    qualification: 'Synthetic inconsistent-denominator fixture.',
    current_access_verified: true,
    source_universe_completeness_status: 'PROVEN_COMPLETE',
    row_manifest_retained: true,
    segment_authority_manifest_retained: true,
    transcript_bytes_accessible_in_workspace: true,
    independently_recomputable_from_git: true,
    registry_sha256: '1'.repeat(64),
    probe_manifest_sha256: '2'.repeat(64),
    counts: {
      authorized_sources: 8, registry_rows: 1, transcripts_available: 0, nodes_available: 0,
      verified_drj_sources: 0, multi_speaker_sources: 8, working_redacted_sources: 8,
      extraction_ready_sources: 8, duplicate_source_groups: 0,
    },
    real_inventory_totals: {
      authorized_sources: 97, transcripts_available: 97, nodes_available: 97,
      verified_drj_sources: 96, extraction_ready_sources: 8,
    },
    blockers: [],
    source_mutations: 0,
    source_factory_derivation_allowed: false,
  });
  const gate = evaluateTranscriptFactoryGate({ inventory, privacyGoldEvaluation: structurallyCompletePrivacyGold(8), medicalGovernanceAssigned: true });
  assert.equal(gate.status, 'BLOCKED');
  assert.ok(gate.drafting_blockers.includes('authorized_source_denominator_missing_or_invalid'));
  assert.ok(gate.drafting_blockers.includes('privacy_safe_registry_denominator_incomplete'));
  assert.ok(gate.drafting_blockers.includes('transcript_or_node_artifact_denominator_incomplete'));
  assert.ok(gate.drafting_blockers.includes('drj_speaker_authority_denominator_incomplete'));
  assert.ok(gate.drafting_blockers.includes('am11_single_and_multi_speaker_inventory_strata_unavailable'));
  assert.equal(gate.medical_approval_allowed, false);
});

test('missing, zero, negative, and string corpus denominators can never pass', () => {
  const invalidCounts = [
    {},
    { authorized_sources: 0, working_redacted_sources: 0, extraction_ready_sources: 0 },
    { authorized_sources: -1, working_redacted_sources: -1, extraction_ready_sources: -1 },
    { authorized_sources: '8', working_redacted_sources: '8', extraction_ready_sources: '8' },
  ];
  for (const counts of invalidCounts) {
    const inventory = withHash({
      schema_version: 'missionmed.i1q.restricted_corpus_aggregate.v2',
      retention_class: 'AGGREGATE_ONLY_NO_IDENTITY_BEARING_SOURCE_DATA',
      status: 'REAL_CORPUS_INVENTORIED',
      classification: 'REAL_CORPUS',
      evidence_scope: 'POINT_IN_TIME_AGGREGATE',
      source_observed_at: '2026-07-16T00:00:00.000Z',
      qualification: 'Synthetic invalid-denominator fixture.',
      current_access_verified: true,
      source_universe_completeness_status: 'PROVEN_COMPLETE',
      row_manifest_retained: true,
      segment_authority_manifest_retained: true,
      transcript_bytes_accessible_in_workspace: true,
      independently_recomputable_from_git: true,
      registry_sha256: '1'.repeat(64),
      probe_manifest_sha256: '2'.repeat(64),
      counts,
      real_inventory_totals: {
        authorized_sources: 8, transcripts_available: 8, nodes_available: 8,
        verified_drj_sources: 8, extraction_ready_sources: 8,
      },
      blockers: [],
      source_mutations: 0,
      source_factory_derivation_allowed: false,
    });
    const gate = evaluateTranscriptFactoryGate({ inventory, privacyGoldEvaluation: structurallyCompletePrivacyGold(8), medicalGovernanceAssigned: true });
    assert.equal(gate.status, 'BLOCKED');
    assert.equal(gate.transcript_candidate_generation_allowed, false);
    assert.ok(gate.drafting_blockers.includes('authorized_source_denominator_missing_or_invalid'));
  }
});

test('aggregate snapshot rejects altered envelopes and identity-bearing nested additions', async () => {
  const original = JSON.parse(await readFile(join(APP_ROOT, 'evidence/inventory_report.json'), 'utf8'));
  const identity = clone(original);
  identity.counts.notes = 'patient Jane Doe at https://private.example';
  assert.throws(() => retainedAggregateSnapshot(identity), /restricted_inventory_counts_(?:envelope_)?invalid|restricted_inventory_envelope_invalid/u);
  const topLevel = clone(original);
  topLevel.source_title = 'private recording title';
  assert.throws(() => retainedAggregateSnapshot(topLevel), /restricted_inventory_envelope_invalid/u);
});

test('transcript resume manifest is content addressed, complete about zero coverage, and stale-access fail closed', async () => {
  const inventoryEvidence = JSON.parse(await readFile(join(APP_ROOT, 'evidence/inventory_report.json'), 'utf8'));
  const workspaceProbe = await probeWorkspaceCorpusAccess(WORKTREE, {
    excludedPaths: [
      ...SOURCE_FACTORY_ARTIFACT_PATHS,
      'i1q-question-platform/evidence/source-factory/build-manifest.json',
    ],
  });
  assert.equal(workspaceCorpusProbeValid(workspaceProbe), true);
  const corpusSnapshot = retainedAggregateSnapshot(inventoryEvidence, workspaceProbe);
  const transcriptGate = evaluateTranscriptFactoryGate({ inventory: corpusSnapshot, privacyGoldEvaluation: null, medicalGovernanceAssigned: false });
  const legacyAudit = auditLegacyV4(LEGACY_ROWS);
  const manifest = transcriptResumeManifest({
    inventoryEvidence,
    workspaceProbe,
    corpusSnapshot,
    transcriptGate,
    legacyAudit,
    authorityCandidates: PILOT_LIBRARY,
  });
  assert.equal(manifest.status, 'INCOMPLETE_CORPUS_WORK_EXTERNAL_TRUST_BOUNDARY_REQUIRED');
  assert.equal(manifest.mandatory_metrics.total_transcript_artifacts_discovered, 0);
  assert.equal(manifest.mandatory_metrics.total_artifacts_processed, 0);
  assert.equal(manifest.mandatory_metrics.total_legacy_rows_without_established_transcript_provenance.value, 845);
  assert.equal(manifest.mandatory_metrics.total_quarantined_or_nonrelease_answer_bearing_units.total, 869);
  assert.equal(manifest.resume_entry_point.resume_requires_code_change, true);
  assert.equal(manifest.content_hash, sha256(Object.fromEntries(Object.entries(manifest).filter(([key]) => key !== 'content_hash'))));

  const staleProbe = clone(workspaceProbe);
  staleProbe.counts.transcript_or_caption_candidates = 1;
  staleProbe.content_hash = sha256(Object.fromEntries(Object.entries(staleProbe).filter(([key]) => key !== 'content_hash')));
  assert.throws(() => transcriptResumeManifest({
    inventoryEvidence,
    workspaceProbe: staleProbe,
    corpusSnapshot,
    transcriptGate,
    legacyAudit,
    authorityCandidates: PILOT_LIBRARY,
  }), /resume_workspace_corpus_probe_invalid_or_stale/u);
});

test('live workspace corpus probe detects obvious files, stores only path hashes, and cannot prove completeness', async () => {
  assert.equal(classifyWorkspaceCorpusPath('private/session.vtt').transcript_or_caption_candidate, true);
  assert.equal(classifyWorkspaceCorpusPath('private/session_nodes.json').nodes_or_media_registry_candidate, true);
  assert.equal(classifyWorkspaceCorpusPath('src/transcript-resume.mjs').transcript_or_caption_candidate, false);
  const root = await mkdtemp(join(tmpdir(), 'i1q-corpus-probe-'));
  try {
    await writeFile(join(root, 'session.vtt'), 'WEBVTT\n', 'utf8');
    await writeFile(join(root, 'session_nodes.json'), '{}\n', 'utf8');
    const probe = await probeWorkspaceCorpusAccess(root);
    assert.equal(probe.status, 'REPROBE_REQUIRED_CORPUS_LIKE_ARTIFACTS_DETECTED');
    assert.equal(probe.counts.transcript_or_caption_candidates, 1);
    assert.equal(probe.counts.nodes_or_media_registry_candidates, 1);
    assert.equal(probe.contains_paths, false);
    assert.ok(probe.candidate_path_hashes.transcript_or_caption.every((value) => /^[a-f0-9]{64}$/u.test(value)));
    assert.equal(JSON.stringify(probe).includes('session.vtt'), false);
    assert.equal(workspaceCorpusProbeValid(probe), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('taxonomy and misconception registry are immutable content-addressed artifacts', () => {
  const artifact = taxonomyArtifact();
  assert.equal(artifact.taxonomy.version, 'i1q.taxonomy.v2');
  assert.equal(artifact.misconception_vocabulary.version, 'i1q.misconceptions.v2');
  assert.equal(artifact.content_hash, sha256(Object.fromEntries(Object.entries(artifact).filter(([key]) => key !== 'content_hash'))));
  assert.ok(artifact.taxonomy.primary_specialties.includes('preventive_medicine'));
  assert.equal(artifact.taxonomy.registries.classification_profiles.length, 24);
  assert.ok(Object.isFrozen(TAXONOMY.primary_specialties));
  assert.throws(() => TAXONOMY.primary_specialties.push('mutated'));
});

test('taxonomy rejects invented and cross-incoherent classification profiles', () => {
  const classification = clone(PILOT_LIBRARY.find((candidate) => candidate.classification.primary_specialty === 'cardiology').classification);
  classification.organ_system = 'integumentary';
  classification.topic = 'invented_topic';
  classification.subtopic = 'invented_subtopic';
  classification.primary_concept_id = 'concept.cardiology.invented.assertion';
  assert.ok(validateClassification(classification).includes('classification_profile_unregistered'));
});

test('distractor misconception IDs are stable reusable vocabulary entries', () => {
  const distractors = PILOT_LIBRARY.flatMap((candidate) => Object.values(candidate.content_sba.rationales.distractors));
  assert.equal(
    new Set(distractors.map((distractor) => distractor.misconception_id)).size,
    new Set(distractors.map((distractor) => distractor.misconception_category)).size,
  );
  assert.ok(new Set(distractors.map((distractor) => distractor.misconception_id)).size <= MISCONCEPTION_VOCABULARY.entries.length);
  assert.ok(distractors.every((distractor) => (
    distractor.misconception_id === misconceptionIdForCategory(distractor.misconception_category)
  )));
});

test('authoring helper rejects incomplete choice sets', () => {
  assert.throws(() => createAuthorityDerivedCandidate({ slug: 'invalid', answer_key: 'A', choices: ['only one'] }), /authoring_four_choices_required/u);
});

test('Architecture 1002.1 canonical variant forms remain closed', () => {
  assert.deepEqual(VARIANT_FORMS, ['drj_short', 'recall', 'vignette']);
  assert.equal(VARIANT_FORMS.includes('rapid_fire'), false);
});

test('source-factory envelopes reject medical, runtime, and release overclaims', async () => {
  const manifest = JSON.parse(await readFile(join(APP_ROOT, 'evidence/source-factory/build-manifest.json'), 'utf8'));
  const productionManifest = clone(manifest);
  productionManifest.build_status = 'production_ready';
  productionManifest.invariants.physician_approved_candidates = 24;
  productionManifest.manifest_payload_hash = sha256(Object.fromEntries(Object.entries(productionManifest).filter(([key]) => key !== 'manifest_payload_hash')));
  assert.ok(validateBuildManifestEnvelope(productionManifest).includes('manifest_build_status_invalid'));
  assert.ok(validateBuildManifestEnvelope(productionManifest).includes('manifest_invariants_invalid'));

  const library = JSON.parse(await readFile(join(APP_ROOT, 'content/i1q-1008c/generated/candidate-library.json'), 'utf8'));
  const approved = clone(library);
  approved.status = 'MEDICALLY_VALIDATED';
  approved.physician_review_status = 'COMPLETE';
  approved.runtime_enabled = true;
  approved.content_hash = sha256(Object.fromEntries(Object.entries(approved).filter(([key]) => key !== 'content_hash')));
  assert.ok(validateCandidateLibraryEnvelope(approved).includes('candidate_library_envelope_invalid'));

  const gate = JSON.parse(await readFile(join(APP_ROOT, 'evidence/source-factory/transcript-factory-gate.json'), 'utf8'));
  const openGate = clone(gate);
  openGate.medical_approval_allowed = true;
  openGate.release_allowed = true;
  openGate.content_hash = sha256(Object.fromEntries(Object.entries(openGate).filter(([key]) => key !== 'content_hash')));
  assert.ok(validateTranscriptGateEnvelope(openGate).includes('transcript_medical_approval_overclaim'));
  assert.ok(validateTranscriptGateEnvelope(openGate).includes('transcript_release_overclaim'));
});
