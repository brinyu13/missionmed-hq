/**
 * Frozen contract constants for I1Q-1008E.
 *
 * The observed-count constants describe the predecessor-validated cohort. They
 * are input invariants for coverage validation, not claims that this run has
 * completed processing.
 */

export const OCCURRENCE_SCHEMA_VERSION =
  'missionmed.i1q-1008e.restricted-occurrence.v1';
export const CONCEPT_SCHEMA_VERSION =
  'missionmed.i1q-1008e.provisional-concept.v1';
export const ARTIFACT_PROCESSING_LEDGER_SCHEMA_VERSION =
  'missionmed.i1q-1008e.artifact-processing-ledger.v1';
export const PARSER_VERSION = 'missionmed.i1q-1008e.restricted-parser.v1';

export const EXTRACTION_CLASSES = Object.freeze([
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

export const SPEAKER_CLASSES = Object.freeze([
  'VERIFIED_DR_J',
  'HIGH_CONFIDENCE_DR_J',
  'PROBABLE_DR_J',
  'LEARNER_OR_OTHER',
  'MULTI_SPEAKER_UNRESOLVED',
  'UNKNOWN',
]);

export const LIFECYCLE_STATES = Object.freeze([
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

export const DUPLICATE_RELATIONSHIP_TYPES = Object.freeze([
  'EXACT_TEXT_DUPLICATE',
  'NEAR_TEXT_DUPLICATE',
  'SAME_CONCEPT_SAME_TARGET',
  'SAME_CONCEPT_DIFFERENT_FORM',
  'SAME_TOPIC_DIFFERENT_CONCEPT',
  'REPEATED_TEACHING_OCCURRENCE',
  'POSSIBLE_DUPLICATE',
  'NOT_DUPLICATE',
]);

export const ARTIFACT_FINAL_STATES = Object.freeze([
  'COMPLETE',
  'COMPLETE_WITH_QUARANTINE',
  'PARTIAL_WITH_PROVEN_BLOCKER',
  'FAILED_WITH_PROVEN_BLOCKER',
]);

export const PASS_DEFINITIONS = Object.freeze([
  Object.freeze({ pass_id: 'PASS_1', name: 'DIRECT_QUESTIONS' }),
  Object.freeze({ pass_id: 'PASS_2', name: 'RAPID_FIRE_AND_IMPERATIVE_PROMPTS' }),
  Object.freeze({ pass_id: 'PASS_3', name: 'IMPLIED_CLINICAL_QUESTIONS' }),
  Object.freeze({ pass_id: 'PASS_4', name: 'LEARNER_QUESTIONS_WITH_DR_J_TEACHING' }),
  Object.freeze({ pass_id: 'PASS_5', name: 'TESTABLE_TEACHING_STATEMENTS' }),
  Object.freeze({ pass_id: 'PASS_6', name: 'NODES_ASSISTED_RECOVERY' }),
  Object.freeze({ pass_id: 'PASS_7', name: 'MEDICAL_AND_ASSESSMENT_REVIEW' }),
  Object.freeze({ pass_id: 'PASS_8', name: 'ADVERSARIAL_MISSED_OCCURRENCE_SEARCH' }),
  Object.freeze({ pass_id: 'PASS_9', name: 'CROSS_PASS_MERGE' }),
]);

export const OBSERVED_TRANSCRIPT_COUNT = 97;
export const OBSERVED_NODES_COUNT = 99;
export const REQUIRED_PASS_CELL_COUNT =
  OBSERVED_TRANSCRIPT_COUNT * PASS_DEFINITIONS.length;

if (PASS_DEFINITIONS.length !== 9 || REQUIRED_PASS_CELL_COUNT !== 873) {
  throw new Error('I1Q-1008E observed-cohort coverage invariant is invalid');
}

export const OBSERVED_COHORT_INVARIANTS = Object.freeze({
  transcriptArtifactCount: OBSERVED_TRANSCRIPT_COUNT,
  nodesArtifactCount: OBSERVED_NODES_COUNT,
  requiredPassesPerTranscript: PASS_DEFINITIONS.length,
  requiredPassCellCount: REQUIRED_PASS_CELL_COUNT,
});
