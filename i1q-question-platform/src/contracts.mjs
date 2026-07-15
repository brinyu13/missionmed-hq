export const PLATFORM_VERSION = 'i1q-1006.0';

export const CORE_ENTITY_TYPES = Object.freeze([
  'taxonomy_versions',
  'blueprint_versions',
  'misconception_vocabulary_versions',
  'channel_security_policies',
  'concepts',
  'variant_groups',
  'items',
  'item_revisions',
  'evidence_claims',
  'source_records',
  'extraction_runs',
  'model_prompt_versions',
  'rights_records',
  'privacy_redaction_records',
  'reviewers',
  'review_assignments',
  'review_events',
  'reviewer_calibration_records',
  'incident_records',
  'release_snapshots',
  'release_promotion_records',
  'channel_artifacts',
  'psychometric_snapshots',
]);

export const OPERATIONAL_ENTITY_TYPES = Object.freeze([
  'inventory_sources',
  'transcript_artifacts',
  'normalized_transcript_segments',
  'extraction_candidates',
  'candidate_quality_flags',
  'batch_jobs',
  'job_checkpoints',
  'import_maps',
  'export_validation_results',
  'feature_flags',
  'audit_events',
  'api_idempotency_keys',
]);

export const ENTITY_TYPES = Object.freeze([
  ...CORE_ENTITY_TYPES,
  ...OPERATIONAL_ENTITY_TYPES,
]);

export const ROLES = Object.freeze([
  'platform_admin',
  'content_operator',
  'author',
  'editorial_reviewer',
  'physician_reviewer',
  'release_manager',
  'privacy_officer',
  'incident_owner',
  'read_only',
  'system',
]);

export const GOVERNANCE_SLOTS = Object.freeze([
  'medical_governance_lead',
  'editorial_lead',
  'taxonomy_owner',
  'misconception_vocabulary_owner',
  'release_manager',
  'incident_owner',
  'privacy_owner',
  'assessment_science_owner',
]);

export const FEATURE_FLAG_KEYS = Object.freeze([
  'internal_platform_enabled',
  'internal_review_enabled',
  'student_content_enabled',
  'student_release_enabled',
  'stat_adapter_enabled',
  'drills_adapter_enabled',
]);

export const RELEASE_RESTRICTED_FEATURE_FLAG_KEYS = Object.freeze([
  'student_content_enabled',
  'student_release_enabled',
  'stat_adapter_enabled',
  'drills_adapter_enabled',
]);

export const REQUIRED_PRIVACY_CLASSES = Object.freeze([
  'NON_DRJ_SPEECH',
  'STUDENT_NAME',
  'STUDENT_OTHER_IDENTIFIER',
  'PATIENT_DIRECT_IDENTIFIER',
  'PATIENT_QUASI_IDENTIFIER',
  'THIRD_PARTY_IDENTITY',
  'IDENTIFYING_CLINICAL_ANECDOTE',
  'SOURCE_METADATA',
]);

export const REVISION_STATES = Object.freeze([
  'draft',
  'candidate',
  'editorial_review',
  'medical_review',
  'approved',
  'rejected',
  'superseded',
  'retired',
]);

export const REVISION_TRANSITIONS = Object.freeze({
  draft: ['candidate', 'retired'],
  candidate: ['editorial_review', 'rejected', 'retired'],
  editorial_review: ['candidate', 'medical_review', 'rejected', 'retired'],
  medical_review: ['editorial_review', 'approved', 'rejected', 'retired'],
  approved: ['superseded', 'retired'],
  rejected: ['candidate', 'retired'],
  superseded: ['retired'],
  retired: [],
});

export const RELEASE_STATES = Object.freeze([
  'assembled',
  'validated',
  'ratified',
  'published',
  'superseded',
  'withdrawn',
]);

export const RELEASE_TRANSITIONS = Object.freeze({
  assembled: ['validated', 'withdrawn'],
  validated: ['ratified', 'withdrawn'],
  ratified: ['published', 'withdrawn'],
  published: ['superseded', 'withdrawn'],
  superseded: [],
  withdrawn: [],
});

export const STAT_DATASET_FIELDS = Object.freeze([
  'dataset_version',
  'question_id',
  'prompt',
  'choice_a',
  'choice_b',
  'choice_c',
  'choice_d',
  'answer',
  'explanation',
]);

export const STAT_CHANNEL_CONTRACTS = Object.freeze({
  stat_dataset_questions: Object.freeze({ phase: 'server_only', data_class: 'server_only' }),
  stat_pre_answer: Object.freeze({ phase: 'pre_answer', data_class: 'A' }),
  stat_post_answer_debrief: Object.freeze({ phase: 'post_answer', data_class: 'C' }),
  stat_indexes: Object.freeze({ phase: 'pre_answer', data_class: 'A' }),
  stat_lookup: Object.freeze({ phase: 'pre_answer', data_class: 'A' }),
  question_metadata: Object.freeze({ phase: 'server_only', data_class: 'D' }),
  drills: Object.freeze({ phase: 'internal', data_class: 'internal' }),
});

export const CLASS_A_CHANNELS = Object.freeze([
  'stat_pre_answer',
  'stat_indexes',
  'stat_lookup',
]);

export const CLASS_A_FORBIDDEN_KEY_TOKENS = Object.freeze([
  'answer',
  'answers',
  'correct',
  'correctness',
  'explanation',
  'explanations',
  'rationale',
  'rationales',
  'solution',
  'solutions',
]);

export const CLASS_A_FORBIDDEN_EXACT_KEYS = Object.freeze([
  'answer_map',
  'answer_key',
  'correct_answer',
  'correct_answer_rationale',
  'correct_choice',
  'correct_choice_key',
  'correct_key',
  'correct_option',
  'distractor_rationale',
  'distractor_rationales',
  'is_correct',
  'solution_key',
  'why_tempting',
  'why_wrong',
]);

export const DRILLS_ADAPTER_VERSION = 'i1q.drills.adapter.v1';

export const SOURCE_AVAILABILITY_STATES = Object.freeze([
  'available',
  'missing',
  'restricted',
  'invalid',
  'unknown',
]);

export const DRILLS_ALLOWED_RIGHTS_STATES = Object.freeze([
  'cleared_for',
]);

export const DRILLS_ALLOWED_PRIVACY_STATES = Object.freeze([
  'pass',
  'pass_with_redactions',
]);

export const CHANNELS = Object.freeze([
  'stat_dataset_questions',
  'stat_pre_answer',
  'stat_post_answer_debrief',
  'stat_indexes',
  'stat_lookup',
  'question_metadata',
  'drills',
  'daily_rounds',
  'tournamed',
  'arena',
  'custom_tests',
  'faculty_mode',
  'mentor_mode',
]);

export const GX_STAGES = Object.freeze([
  'GX-0_INVENTORY',
  'GX-1_RIGHTS',
  'GX-2_PRIVACY_SCRUB',
  'GX-3_SPEAKER_ATTRIBUTION',
  'GX-4_CONCEPT_EXTRACTION',
  'GX-5_CANDIDATE_QUESTION_DETECTION',
  'GX-6_ANSWER_SOURCE_DETECTION',
  'GX-7_CORRECT_ANSWER_VERIFICATION_SUPPORT',
  'GX-8_DISTRACTOR_GENERATION',
  'GX-9_EXPLANATION_GENERATION',
  'GX-10_EDITORIAL_QUEUE',
  'GX-11_PHYSICIAN_QUEUE',
]);

export const ID_PREFIXES = Object.freeze({
  taxonomy_versions: 'taxv',
  blueprint_versions: 'bpv',
  misconception_vocabulary_versions: 'mvv',
  channel_security_policies: 'csp',
  concepts: 'concept',
  variant_groups: 'vg',
  items: 'item',
  item_revisions: 'itemrev',
  evidence_claims: 'claim',
  source_records: 'src',
  extraction_runs: 'extract',
  model_prompt_versions: 'mpv',
  rights_records: 'rights',
  privacy_redaction_records: 'redact',
  reviewers: 'reviewer',
  review_assignments: 'assign',
  review_events: 'review',
  reviewer_calibration_records: 'calib',
  incident_records: 'incident',
  release_snapshots: 'release',
  release_promotion_records: 'promotion',
  channel_artifacts: 'artifact',
  psychometric_snapshots: 'psych',
  inventory_sources: 'inventory',
  transcript_artifacts: 'transcript',
  normalized_transcript_segments: 'segment',
  extraction_candidates: 'candidate',
  candidate_quality_flags: 'qualityflag',
  batch_jobs: 'job',
  job_checkpoints: 'checkpoint',
  import_maps: 'importmap',
  export_validation_results: 'exportcheck',
  feature_flags: 'flag',
  audit_events: 'audit',
  api_idempotency_keys: 'idem',
});

export const SENSITIVE_FIELDS = Object.freeze(new Set([
  'answer',
  'answers',
  'answer_map',
  'answer_key',
  'answerKey',
  'correctAnswer',
  'correct_answer',
  'correct_answer_rationale',
  'correct_choice',
  'correct_choice_key',
  'correct_key',
  'correct_option',
  'correctness',
  'distractor_rationale',
  'distractor_rationales',
  'explanation',
  'explanations',
  'is_correct',
  'rationale',
  'rationales',
  'solution',
  'solutions',
  'why_tempting',
  'why_wrong',
  'raw_text',
  'raw_transcript',
  'private_source_url',
]));

export const IMMUTABLE_ENTITY_TYPES = Object.freeze(new Set([
  'item_revisions',
  'review_events',
  'release_snapshots',
  'release_promotion_records',
  'channel_artifacts',
  'audit_events',
]));

export const WORKFLOW_MANAGED_ENTITY_TYPES = Object.freeze(new Set([
  'item_revisions',
  'reviewers',
  'review_assignments',
  'review_events',
  'release_snapshots',
  'release_promotion_records',
  'channel_artifacts',
  'feature_flags',
  'audit_events',
  'api_idempotency_keys',
]));

export const READ_ROLES = Object.freeze(new Set(ROLES));
export const WRITE_ROLES = Object.freeze(new Set([
  'platform_admin',
  'content_operator',
  'author',
  'editorial_reviewer',
  'physician_reviewer',
  'release_manager',
  'privacy_officer',
  'incident_owner',
  'system',
]));

export function assertKnownEntityType(entityType) {
  if (!ENTITY_TYPES.includes(entityType)) {
    throw new Error(`unknown_entity_type:${entityType}`);
  }
}
