export const SOURCE_FACTORY_SCHEMA_VERSION = 'missionmed.i1q.source_factory.candidate.v1';
export const SOURCE_FACTORY_BUILD_VERSION = 'i1q-1008c.2';

export const SOURCE_FACTORY_INPUT_PATHS = Object.freeze([
  'supabase/migrations/20260420111000_stat_dataset_ingest.sql',
  'i1q-question-platform/evidence/inventory_report.json',
  'i1q-question-platform/content/i1q-1008c/pilot-authoring.mjs',
  'i1q-question-platform/content/i1q-1008c/pilot-authoring-b.mjs',
  'i1q-question-platform/content/i1q-1008c/pilot-library.mjs',
  'i1q-question-platform/scripts/build-source-factory.mjs',
  'i1q-question-platform/src/hash.mjs',
  'i1q-question-platform/src/source-factory/authoring.mjs',
  'i1q-question-platform/src/source-factory/contracts.mjs',
  'i1q-question-platform/src/source-factory/dedupe.mjs',
  'i1q-question-platform/src/source-factory/legacy-v4.mjs',
  'i1q-question-platform/src/source-factory/quality.mjs',
  'i1q-question-platform/src/source-factory/restricted-corpus.mjs',
  'i1q-question-platform/src/source-factory/taxonomy.mjs',
  'i1q-question-platform/src/source-factory/transcript-resume.mjs',
  'i1q-question-platform/src/source-factory/workspace-corpus-probe.mjs',
]);

export const SOURCE_FACTORY_ARTIFACT_PATHS = Object.freeze([
  'i1q-question-platform/content/i1q-1008c/generated/candidate-library.json',
  'i1q-question-platform/content/i1q-1008c/generated/candidate-library.md',
  'i1q-question-platform/evidence/source-factory/authoring-run.json',
  'i1q-question-platform/evidence/source-factory/candidate-dedupe-audit.json',
  'i1q-question-platform/evidence/source-factory/candidate-library-validation.json',
  'i1q-question-platform/evidence/source-factory/legacy-v4-audit.json',
  'i1q-question-platform/evidence/source-factory/restricted-corpus-snapshot.json',
  'i1q-question-platform/evidence/source-factory/taxonomy.json',
  'i1q-question-platform/evidence/source-factory/transcript-factory-gate.json',
  'i1q-question-platform/evidence/source-factory/transcript-resume-manifest.json',
  'i1q-question-platform/evidence/source-factory/workspace-corpus-access-probe.json',
]);

export const AUTHORITY_AUTHORING_INPUT_PATHS = Object.freeze([
  'i1q-question-platform/content/i1q-1008c/pilot-authoring.mjs',
  'i1q-question-platform/content/i1q-1008c/pilot-authoring-b.mjs',
  'i1q-question-platform/content/i1q-1008c/pilot-library.mjs',
  'i1q-question-platform/src/hash.mjs',
  'i1q-question-platform/src/source-factory/authoring.mjs',
  'i1q-question-platform/src/source-factory/contracts.mjs',
  'i1q-question-platform/src/source-factory/quality.mjs',
  'i1q-question-platform/src/source-factory/taxonomy.mjs',
]);

export const CANDIDATE_CONTRACT_STATUS = 'CURATED_CANDIDATE_NOT_PLATFORM_ITEM';
export const MEDICAL_VALIDATION_STATUS = 'AI_DRAFT_NOT_MEDICALLY_VALIDATED';
export const REVIEW_GATE_STATUS = 'PHYSICIAN_REVIEW_REQUIRED';
export const RELEASE_ELIGIBILITY = 'BLOCKED';

export const CURRENT_ITEM_TYPES = Object.freeze(['single_best_answer']);
export const VARIANT_FORMS = Object.freeze(['drj_short', 'recall', 'vignette']);
export const WORKFLOW_TARGET_STATES = Object.freeze([
  'draft',
  'candidate',
  'editorial_review',
  'medical_review',
  'approved',
  'rejected',
  'superseded',
  'retired',
]);

export const ANSWER_KEYS = Object.freeze(['A', 'B', 'C', 'D']);
export const DISTRACTOR_PROVENANCE = Object.freeze([
  'transcript_mentioned',
  'vocabulary_derived',
  'reviewer_authored',
  'ai_generated',
]);

export const ANSWER_PROVENANCE_STATUSES = Object.freeze([
  'TRANSCRIPT_EXPLICIT_ANSWER',
  'TRANSCRIPT_INFERRED_ANSWER',
  'AI_PROPOSED_ANSWER',
  'LEGACY_STATIC_ANSWER_RECONCILED',
]);

export const EVIDENCE_DRAFT_STATUSES = Object.freeze([
  'CITATIONS_PROPOSED_UNVERIFIED',
  'CITATION_CONFLICT_UNRESOLVED',
  'BLOCKED_UNCERTAIN',
]);

export const AUTHORITY_CLASSES = Object.freeze([
  'major_guideline',
  'standard_reference',
  'landmark_evidence',
]);

export const CURRENCY_CLASSES = Object.freeze(['stable', 'standard', 'volatile']);

export const EVIDENCE_CLAIM_TYPES = Object.freeze([
  'diagnosis',
  'management',
  'mechanism',
  'epidemiology',
  'pharmacology',
  'other',
]);

export const BANNED_ITEM_WORDING = Object.freeze([
  /\ball of the above\b/iu,
  /\bnone of the above\b/iu,
  /\bexcept\b/iu,
  /\bleast (?:likely|appropriate|correct)\b/iu,
  /\bwhich .* is not\b/iu,
]);

export const REQUIRED_WARNINGS = Object.freeze([
  'PHYSICIAN_REVIEW_REQUIRED',
  'NOT_RELEASE_ELIGIBLE',
  'CITATIONS_NOT_IMMUTABLY_RESOLVED',
  'NO_PSYCHOMETRIC_RESPONSE_DATA',
  'DISTRACTOR_AND_LEVEL3_CLAIMS_UNMAPPED_UNVERIFIED',
  'NOT_VALIDATED_FOR_RESIDENCY_SELECTION_OR_PERFORMANCE_PREDICTION',
]);

export const FUTURE_COMPATIBILITY_MAP = Object.freeze({
  active: 'Item lifecycle state active',
  inactive: 'Derived operational visibility; no release membership or enabled consumer projection',
  draft: 'Item Revision workflow state draft',
  archived: 'Derived retained-history view; never deletion and not a new revision workflow enum',
  retired: 'Item or Item Revision lifecycle state retired',
  versioned: 'Monotonic revision_number plus immutable content_hash',
});
