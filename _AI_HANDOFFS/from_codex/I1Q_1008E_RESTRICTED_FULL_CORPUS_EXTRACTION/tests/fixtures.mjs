/*
 * Synthetic-only fixtures for I1Q-1008E.
 *
 * These records do not describe a real person, source, transcript, or clinical
 * encounter. They deliberately use opaque fixture aliases and fixed dummy
 * hashes so this file is safe to commit.
 */

export const HASH_A = 'a'.repeat(64);
export const HASH_B = 'b'.repeat(64);
export const HASH_C = 'c'.repeat(64);
export const HASH_D = 'd'.repeat(64);

export const EXPECTED_PASS_IDS = Object.freeze([
  'PASS_1',
  'PASS_2',
  'PASS_3',
  'PASS_4',
  'PASS_5',
  'PASS_6',
  'PASS_7',
  'PASS_8',
  'PASS_9',
]);

export const EXPECTED_EXTRACTION_CLASSES = Object.freeze([
  'EXPLICIT_QUESTION',
  'RAPID_FIRE_PROMPT',
  'INCOMPLETE_QUESTION',
  'IMPLIED_QUESTION',
  'DIAGNOSIS_PROMPT',
  'DIFFERENTIAL_PROMPT',
  'MECHANISM_PROMPT',
  'MANAGEMENT_PROMPT',
  'NEXT_BEST_STEP_PROMPT',
  'INTERPRETATION_PROMPT',
  'RECALL_PROMPT',
  'CLINICAL_REASONING_PROMPT',
  'LEARNER_QUESTION_WITH_DRJ_TEACHING',
  'TEACHING_PIVOT',
  'TESTABLE_TEACHING_STATEMENT',
  'AMBIGUOUS_MEDICAL_OCCURRENCE',
  'NONMEDICAL',
  'DUPLICATE_OCCURRENCE',
]);

export const EXPECTED_SPEAKER_CLASSES = Object.freeze([
  'VERIFIED_DR_J',
  'HIGH_CONFIDENCE_DR_J',
  'PROBABLE_DR_J',
  'LEARNER_OR_OTHER',
  'MULTI_SPEAKER_UNRESOLVED',
  'UNKNOWN',
]);

export const EXPECTED_LIFECYCLE_STATES = Object.freeze([
  'EXTRACTED',
  'NORMALIZED',
  'REVIEW_REQUIRED',
  'AMBIGUOUS',
  'PRIVACY_QUARANTINED',
  'RIGHTS_QUARANTINED',
  'SPEAKER_QUARANTINED',
  'MEDICAL_QUARANTINED',
  'DUPLICATE_CANDIDATE',
  'READY_FOR_DEDUPLICATION',
  'REJECTED_NONMEDICAL',
  'REJECTED_UNSUPPORTED_RECONSTRUCTION',
  'REJECTED_NO_ASSESSABLE_CONCEPT',
]);

export const EXPECTED_DUPLICATE_RELATIONSHIPS = Object.freeze([
  'EXACT_TEXT_DUPLICATE',
  'NEAR_TEXT_DUPLICATE',
  'SAME_CONCEPT_SAME_TARGET',
  'SAME_CONCEPT_DIFFERENT_FORM',
  'SAME_TOPIC_DIFFERENT_CONCEPT',
  'REPEATED_TEACHING_OCCURRENCE',
  'POSSIBLE_DUPLICATE',
  'NOT_DUPLICATE',
]);

export const EXPECTED_ARTIFACT_FINAL_STATES = Object.freeze([
  'COMPLETE',
  'COMPLETE_WITH_QUARANTINE',
  'PARTIAL_WITH_PROVEN_BLOCKER',
  'FAILED_WITH_PROVEN_BLOCKER',
]);

export const SYNTHETIC_TRANSCRIPT_SEGMENTS = Object.freeze([
  Object.freeze({
    id: 'segment_fixture_0001',
    start: 0,
    end: 2,
    speaker: 'instructor_fixture',
    text: 'What is the likely diagnosis?',
  }),
  Object.freeze({
    id: 'segment_fixture_0002',
    start: 2,
    end: 4,
    speaker: 'instructor_fixture',
    text: 'Name the next step.',
  }),
  Object.freeze({
    id: 'segment_fixture_0003',
    start: 4,
    end: 6,
    speaker: 'learner_fixture',
    text: 'Why would the synthetic marker change?',
  }),
  Object.freeze({
    id: 'segment_fixture_0004',
    start: 6,
    end: 9,
    speaker: 'instructor_fixture',
    text: 'The marker changes because the modeled mechanism changes.',
  }),
  Object.freeze({
    id: 'segment_fixture_0005',
    start: 9,
    end: 11,
    speaker: 'instructor_fixture',
    text: 'Can everyone see the slide?',
  }),
  Object.freeze({
    id: 'segment_fixture_0006',
    start: 11,
    end: 14,
    speaker: 'instructor_fixture',
    text: 'The testable teaching statement links the finding to the mechanism.',
  }),
]);

export const TRANSCRIPT_SHAPE_FIXTURES = Object.freeze([
  Object.freeze({
    name: 'top_level_segments',
    payload: Object.freeze({
      schema_version: 'fixture.transcript.v1',
      source_ref: 'fixture_source_a',
      segments: SYNTHETIC_TRANSCRIPT_SEGMENTS,
    }),
    expected_record_count: SYNTHETIC_TRANSCRIPT_SEGMENTS.length,
  }),
  Object.freeze({
    name: 'nested_data_segments',
    payload: Object.freeze({
      schema_version: 'fixture.transcript.wrapper.v1',
      source_ref: 'fixture_source_a',
      data: Object.freeze({ segments: SYNTHETIC_TRANSCRIPT_SEGMENTS }),
    }),
    expected_record_count: SYNTHETIC_TRANSCRIPT_SEGMENTS.length,
  }),
  Object.freeze({
    name: 'direct_array',
    payload: SYNTHETIC_TRANSCRIPT_SEGMENTS,
    expected_record_count: SYNTHETIC_TRANSCRIPT_SEGMENTS.length,
  }),
]);

export const SYNTHETIC_NODES_RECORDS = Object.freeze([
  Object.freeze({
    id: 'node_fixture_0001',
    start: 0,
    end: 2,
    speaker: 'instructor_fixture',
    text: 'diagnosis prompt',
    kind: 'prompt',
  }),
  Object.freeze({
    id: 'node_fixture_0002',
    start: 11,
    end: 14,
    speaker: 'instructor_fixture',
    text: 'mechanism teaching point',
    kind: 'teaching_point',
  }),
]);

export const NODES_SHAPE_FIXTURES = Object.freeze([
  Object.freeze({
    name: 'top_level_nodes',
    payload: Object.freeze({
      schema_version: 'fixture.nodes.v1',
      source_ref: 'fixture_source_a',
      nodes: SYNTHETIC_NODES_RECORDS,
    }),
    expected_record_count: SYNTHETIC_NODES_RECORDS.length,
  }),
  Object.freeze({
    name: 'nested_data_nodes',
    payload: Object.freeze({
      schema_version: 'fixture.nodes.wrapper.v1',
      source_ref: 'fixture_source_a',
      data: Object.freeze({ nodes: SYNTHETIC_NODES_RECORDS }),
    }),
    expected_record_count: SYNTHETIC_NODES_RECORDS.length,
  }),
  Object.freeze({
    name: 'direct_array',
    payload: SYNTHETIC_NODES_RECORDS,
    expected_record_count: SYNTHETIC_NODES_RECORDS.length,
  }),
]);

export const MALFORMED_ARTIFACT_FIXTURES = Object.freeze([
  Object.freeze({ name: 'invalid_json', body: '{"segments":[', expected_error: 'JSON_PARSE_ERROR' }),
  Object.freeze({ name: 'unsupported_wrapper', payload: Object.freeze({ records_unknown: [] }), expected_error: 'SCHEMA_UNSUPPORTED' }),
  Object.freeze({
    name: 'missing_text',
    payload: Object.freeze({ segments: Object.freeze([{ start: 0, end: 1, speaker: 'fixture' }]) }),
    expected_error: 'MALFORMED_RECORD',
  }),
  Object.freeze({
    name: 'negative_timestamp',
    payload: Object.freeze({ segments: Object.freeze([{ start: -1, end: 1, speaker: 'fixture', text: 'Fixture.' }]) }),
    expected_error: 'TIMESTAMP_INVALID',
  }),
  Object.freeze({
    name: 'reversed_interval',
    payload: Object.freeze({ segments: Object.freeze([{ start: 4, end: 2, speaker: 'fixture', text: 'Fixture.' }]) }),
    expected_error: 'TIMESTAMP_INVALID',
  }),
]);

export const UNICODE_TRANSCRIPT_FIXTURE = Object.freeze({
  schema_version: 'fixture.transcript.unicode.v1',
  source_ref: 'fixture_source_unicode',
  segments: Object.freeze([
    Object.freeze({
      id: 'segment_fixture_unicode',
      start: 0,
      end: 1,
      speaker: 'instructor_fixture',
      text: '“Which option?” cafe\u0301 — β-blocker 👩🏽‍⚕️',
    }),
  ]),
});

export const EXTRACTION_CASES = Object.freeze([
  Object.freeze({ text: 'Could the modeled finding fit?', expected_class: 'EXPLICIT_QUESTION', expected_retain: true }),
  Object.freeze({ text: 'Tell me the finding.', expected_class: 'RAPID_FIRE_PROMPT', expected_retain: true }),
  Object.freeze({ text: 'And the likely cause…', expected_class: 'INCOMPLETE_QUESTION', expected_retain: true }),
  Object.freeze({ text: 'The scenario now changes, so the expected conclusion follows.', expected_class: 'IMPLIED_QUESTION', expected_retain: true }),
  Object.freeze({ text: 'What is the diagnosis?', expected_class: 'DIAGNOSIS_PROMPT', expected_retain: true }),
  Object.freeze({ text: 'Give me the differential.', expected_class: 'DIFFERENTIAL_PROMPT', expected_retain: true }),
  Object.freeze({ text: 'Explain the mechanism.', expected_class: 'MECHANISM_PROMPT', expected_retain: true }),
  Object.freeze({ text: 'How would you manage this synthetic case?', expected_class: 'MANAGEMENT_PROMPT', expected_retain: true }),
  Object.freeze({ text: 'What do you do next?', expected_class: 'NEXT_BEST_STEP_PROMPT', expected_retain: true }),
  Object.freeze({ text: 'Interpret the synthetic tracing.', expected_class: 'INTERPRETATION_PROMPT', expected_retain: true }),
  Object.freeze({ text: 'Name the recalled fact.', expected_class: 'RECALL_PROMPT', expected_retain: true }),
  Object.freeze({ text: 'Walk me through your reasoning.', expected_class: 'CLINICAL_REASONING_PROMPT', expected_retain: true }),
  Object.freeze({ text: 'Why does this happen?', expected_class: 'LEARNER_QUESTION_WITH_DRJ_TEACHING', expected_retain: true, speaker: 'learner_fixture' }),
  Object.freeze({ text: 'The important teaching pivot is that the cardiac context changes.', expected_class: 'TEACHING_PIVOT', expected_retain: true }),
  Object.freeze({ text: 'The cardiac finding predicts the modeled outcome.', expected_class: 'TESTABLE_TEACHING_STATEMENT', expected_retain: true }),
  Object.freeze({
    text: 'Context remains incomplete.',
    nodes_text: 'A cardiac finding requires review.',
    expected_class: 'AMBIGUOUS_MEDICAL_OCCURRENCE',
    expected_retain: true,
  }),
  Object.freeze({ text: 'Can everyone see the slide?', expected_class: 'NONMEDICAL', expected_retain: false }),
]);

export const PRECISION_NEGATIVE_CASES = Object.freeze([
  'Can everyone hear me?',
  'What a useful session.',
  'Which slide are we on?',
  'Tell me when the break starts.',
  'How is everybody doing today?',
]);

export const NORMALIZATION_CASES = Object.freeze([
  Object.freeze({
    input: '  What, um, is the likely   diagnosis  ',
    expected: 'What is the likely diagnosis?',
    permitted_operations: Object.freeze(['TRIM_WHITESPACE', 'COLLAPSE_WHITESPACE', 'REMOVE_DISFLUENCY', 'REPAIR_PUNCTUATION']),
  }),
  Object.freeze({
    input: 'Which modeled marker changes',
    expected: 'Which modeled marker changes?',
    permitted_operations: Object.freeze(['REPAIR_PUNCTUATION']),
  }),
  Object.freeze({
    input: 'Treat with [missing fact].',
    expected: null,
    required_lifecycle: 'REJECTED_UNSUPPORTED_RECONSTRUCTION',
  }),
]);

export const SPEAKER_CASES = Object.freeze([
  Object.freeze({
    name: 'owner_attested',
    evidence: Object.freeze({ owner_attestation: true, authoritative_registry: true }),
    expected_class: 'VERIFIED_DR_J',
  }),
  Object.freeze({
    name: 'corroborated_instructional_turn',
    evidence: Object.freeze({ transcript_label: true, nodes_label: true, instructional_continuity: true }),
    expected_class: 'HIGH_CONFIDENCE_DR_J',
  }),
  Object.freeze({
    name: 'single_probabilistic_signal',
    evidence: Object.freeze({ transcript_label: true }),
    expected_class: 'PROBABLE_DR_J',
  }),
  Object.freeze({
    name: 'learner_turn',
    evidence: Object.freeze({ learner_label: true, question_answer_turn: true }),
    expected_class: 'LEARNER_OR_OTHER',
  }),
  Object.freeze({
    name: 'conflicting_labels',
    evidence: Object.freeze({ transcript_label: true, nodes_label_conflict: true }),
    expected_class: 'MULTI_SPEAKER_UNRESOLVED',
  }),
  Object.freeze({ name: 'no_evidence', evidence: Object.freeze({}), expected_class: 'UNKNOWN' }),
]);

export function makeRosterFixture({ transcriptCount = 97, nodesCount = 99 } = {}) {
  const sourceCount = Math.max(transcriptCount, nodesCount);
  const entries = Array.from({ length: sourceCount }, (_, index) => {
    const suffix = String(index + 1).padStart(4, '0');
    return {
      roster_position: index + 1,
      source_alias: `source_fixture_${suffix}`,
      transcript: index < transcriptCount ? {
        artifact_alias: `transcript_fixture_${suffix}`,
        content_hash: index % 2 === 0 ? HASH_A : HASH_B,
      } : null,
      nodes: index < nodesCount ? {
        artifact_alias: `nodes_fixture_${suffix}`,
        content_hash: index % 2 === 0 ? HASH_C : HASH_D,
      } : null,
    };
  });
  return {
    schema_version: 'missionmed.i1q.processing_roster.fixture.v1',
    completeness_class: 'C1_OBSERVED',
    source_count: sourceCount,
    transcript_count: transcriptCount,
    nodes_count: nodesCount,
    entries,
  };
}

export function makeNinePassLedgerFixture({ artifactCount = 97, completedPasses = 9 } = {}) {
  return Array.from({ length: artifactCount }, (_, artifactIndex) => ({
    artifact_alias: `transcript_fixture_${String(artifactIndex + 1).padStart(4, '0')}`,
    passes: Object.fromEntries(EXPECTED_PASS_IDS.map((passId, passIndex) => [
      passId,
      { status: passIndex < completedPasses ? 'COMPLETE' : 'NOT_STARTED', attempt_count: passIndex < completedPasses ? 1 : 0 },
    ])),
  }));
}

export const DEDUPE_OCCURRENCE_FIXTURES = Object.freeze([
  Object.freeze({
    candidate_occurrence_id: 'occurrence_fixture_0001',
    privacy_safe_normalized_wording: 'What is the modeled diagnosis?',
    target_answer: 'modeled target alpha',
    provisional_concept_id: 'concept_fixture_alpha',
    extraction_class: 'DIAGNOSIS_PROMPT',
    lifecycle_status: 'READY_FOR_DEDUPLICATION',
    subject: 'SYNTHETIC_MEDICINE',
    organ_system: 'SYNTHETIC_SYSTEM',
    discipline: 'SYNTHETIC_DISCIPLINE',
    educational_intent: 'SYNTHETIC_FIXTURE',
    question_form: 'DIAGNOSIS',
    medical_ambiguity_flags: Object.freeze([]),
  }),
  Object.freeze({
    candidate_occurrence_id: 'occurrence_fixture_0002',
    privacy_safe_normalized_wording: 'What is the modeled diagnosis?',
    target_answer: 'modeled target alpha',
    provisional_concept_id: 'concept_fixture_alpha',
    extraction_class: 'DUPLICATE_OCCURRENCE',
    lifecycle_status: 'DUPLICATE_CANDIDATE',
    subject: 'SYNTHETIC_MEDICINE',
    organ_system: 'SYNTHETIC_SYSTEM',
    discipline: 'SYNTHETIC_DISCIPLINE',
    educational_intent: 'SYNTHETIC_FIXTURE',
    question_form: 'DIAGNOSIS',
    medical_ambiguity_flags: Object.freeze([]),
  }),
  Object.freeze({
    candidate_occurrence_id: 'occurrence_fixture_0003',
    privacy_safe_normalized_wording: 'Which modeled diagnosis is most likely?',
    target_answer: 'modeled target alpha',
    provisional_concept_id: 'concept_fixture_alpha',
    extraction_class: 'DIAGNOSIS_PROMPT',
    lifecycle_status: 'READY_FOR_DEDUPLICATION',
    subject: 'SYNTHETIC_MEDICINE',
    organ_system: 'SYNTHETIC_SYSTEM',
    discipline: 'SYNTHETIC_DISCIPLINE',
    educational_intent: 'SYNTHETIC_FIXTURE',
    question_form: 'DIAGNOSIS',
    medical_ambiguity_flags: Object.freeze([]),
  }),
  Object.freeze({
    candidate_occurrence_id: 'occurrence_fixture_0004',
    privacy_safe_normalized_wording: 'What is the modeled mechanism?',
    target_answer: 'modeled target beta',
    provisional_concept_id: 'concept_fixture_beta',
    extraction_class: 'MECHANISM_PROMPT',
    lifecycle_status: 'READY_FOR_DEDUPLICATION',
    subject: 'SYNTHETIC_MEDICINE',
    organ_system: 'SYNTHETIC_SYSTEM',
    discipline: 'SYNTHETIC_DISCIPLINE',
    educational_intent: 'SYNTHETIC_FIXTURE',
    question_form: 'MECHANISM',
    medical_ambiguity_flags: Object.freeze([]),
  }),
]);

export const DETERMINISTIC_ID_INPUT = Object.freeze({
  source_alias: 'source_fixture_0001',
  artifact_alias: 'transcript_fixture_0001',
  transcript_hash_binding: HASH_A,
  segment_ordinal_start: 3,
  segment_ordinal_end: 3,
  codepoint_offset_start: 0,
  codepoint_offset_end: 28,
  occurrence_ordinal: 1,
});

export const SAFE_EXPORT_FIXTURE = Object.freeze({
  schema_version: 'missionmed.i1q.candidate_inventory_safe_summary.v1',
  extraction_run_id: 'run_fixture_0001',
  completeness_class: 'C1_OBSERVED',
  transcript_artifacts_processed: 97,
  nodes_artifacts_processed: 99,
  transcript_pass_cells_complete: 873,
  production_mutations: 0,
  raw_protected_artifacts_committed: 0,
  protected_source_locations_committed: 0,
  credentials_or_secrets_committed: 0,
  content_hash: HASH_A,
});

export const RESTRICTED_CANARY = ['restricted', 'fixture', 'canary', '7f3b'].join('::');
export const SOURCE_LOCATION_CANARY = ['protected', 'source', 'locator', 'fixture'].join('::');
export const SECRET_CANARY = ['fixture', 'credential', 'canary'].join('::');

export function cloneFixture(value) {
  return structuredClone(value);
}
