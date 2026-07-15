import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_PATH = fileURLToPath(import.meta.url);
const DEFAULT_APP_ROOT = dirname(dirname(MODULE_PATH));

export const EXPECTED_EVIDENCE_FILES = Object.freeze([
  'accessibility_results.json',
  'artifact_checksums.json',
  'browser_results.json',
  'candidate_counts.json',
  'combined_handoff_validation.json',
  'deployment_manifest.json',
  'drive_discovery.json',
  'extraction_metrics.json',
  'foundation_audit.json',
  'health_check_results.json',
  'inventory_report.json',
  'legacy_reconciliation.json',
  'load_results.json',
  'migration_validation.json',
  'openapi_validation.json',
  'release_manifest.json',
  'rollback_manifest.json',
  'security_results.json',
  'test_results.json',
  'ux_scorecard.json',
]);

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

const LEGACY_PRIVACY_CLASSES = Object.freeze([
  'address_like',
  'email',
  'patient_identifier',
  'student_name',
  'third_party_name',
]);

const REAL_PRIVACY_RULES = Object.freeze({
  NON_DRJ_SPEECH: { denominator: 970, recall: 1, lowerBound: null, precision: 0.9, zeroTolerance: true },
  STUDENT_NAME: { denominator: 300, recall: 0.99, lowerBound: 0.99, precision: 0.9 },
  STUDENT_OTHER_IDENTIFIER: { denominator: 300, recall: 0.99, lowerBound: 0.99, precision: 0.9 },
  PATIENT_DIRECT_IDENTIFIER: { denominator: 600, recall: 0.995, lowerBound: 0.995, precision: 0.9 },
  PATIENT_QUASI_IDENTIFIER: { denominator: 600, recall: 0.995, lowerBound: 0.995, precision: 0.9 },
  THIRD_PARTY_IDENTITY: { denominator: 300, recall: 0.99, lowerBound: 0.99, precision: 0.9 },
  IDENTIFYING_CLINICAL_ANECDOTE: { denominator: 600, recall: 0.995, lowerBound: 0.995, precision: 0.9 },
  SOURCE_METADATA: { denominator: 300, recall: 1, lowerBound: null, precision: 0.9, zeroTolerance: true },
});

const CHANNEL_PHASES = Object.freeze({
  stat_dataset_questions: 'server_only',
  stat_pre_answer: 'pre_answer',
  stat_post_answer_debrief: 'post_answer',
  stat_indexes: 'pre_answer',
  stat_lookup: 'pre_answer',
  question_metadata: 'server_only',
  drills: 'internal',
  daily_rounds: 'contract_only',
  tournamed: 'contract_only',
  arena: 'contract_only',
  custom_tests: 'contract_only',
  faculty_mode: 'contract_only',
  mentor_mode: 'contract_only',
});

const FLAG_NAMES = Object.freeze([
  'internal_platform_enabled',
  'internal_review_enabled',
  'student_content_enabled',
  'student_release_enabled',
  'stat_adapter_enabled',
  'drills_adapter_enabled',
]);

const INTERNAL_FLAG_NAMES = Object.freeze(FLAG_NAMES.slice(0, 2));
const RELEASE_FLAG_NAMES = Object.freeze(FLAG_NAMES.slice(2));

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const PLACEHOLDER_PATTERN = /(?:^|[^a-z0-9])(?:synthetic|fixture|placeholder|fake|example|demo|localhost|test[_ -]?only|not[_ -]?medical)(?:$|[^a-z0-9])/iu;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;

function stringSchema(options = {}) {
  return { type: 'string', ...options };
}

function numberSchema(options = {}) {
  return { type: 'number', finite: true, ...options };
}

function integerSchema(options = {}) {
  return { type: 'integer', ...options };
}

function arraySchema(items, options = {}) {
  return { type: 'array', items, ...options };
}

function objectSchema(required, properties, options = {}) {
  return {
    type: 'object',
    required,
    properties,
    additionalProperties: false,
    ...options,
  };
}

const anySchema = {};
const hashSchema = stringSchema({ pattern: HASH_PATTERN });
const generatedAtSchema = stringSchema({ pattern: ISO_PATTERN });
const nonEmptyStringSchema = stringSchema({ minLength: 1 });
const nonNegativeIntegerSchema = integerSchema({ minimum: 0 });
const ratioSchema = numberSchema({ minimum: 0, maximum: 1 });
const nullableStringSchema = { type: ['string', 'null'], minLength: 1 };
const nullableHashSchema = { type: ['string', 'null'], pattern: HASH_PATTERN };

const artifactSummarySchema = objectSchema(
  ['channel', 'phase', 'sha256', 'record_count'],
  {
    channel: stringSchema({ enum: Object.keys(CHANNEL_PHASES) }),
    phase: stringSchema({ enum: ['server_only', 'pre_answer', 'post_answer', 'internal', 'contract_only'] }),
    data_class: stringSchema({ enum: ['A', 'B', 'C', 'D', 'contract_only'] }),
    sha256: hashSchema,
    record_count: nonNegativeIntegerSchema,
  },
);

const runtimeProofSchema = objectSchema(
  [
    'classification',
    'environment',
    'deployed_commit',
    'deployment_url',
    'canonical_route',
    'smoke_status',
    'monitoring_status',
    'rollback_status',
    'rollback_sha256',
    'release_manifest_hash',
    'independent_review_status',
  ],
  {
    classification: stringSchema({ enum: ['STAGING_RUNTIME', 'PRODUCTION_RUNTIME'] }),
    environment: stringSchema({ enum: ['staging', 'production'] }),
    deployed_commit: stringSchema({ pattern: COMMIT_PATTERN }),
    deployment_url: stringSchema({ pattern: /^https:\/\/[^\s]+$/u }),
    canonical_route: stringSchema({ enum: ['canonical_github'] }),
    smoke_status: stringSchema({ const: 'pass' }),
    monitoring_status: stringSchema({ const: 'pass' }),
    rollback_status: stringSchema({ const: 'pass' }),
    rollback_sha256: hashSchema,
    release_manifest_hash: hashSchema,
    independent_review_status: stringSchema({ const: 'pass' }),
  },
);

const consumerReleaseProofSchema = objectSchema(
  [
    'classification',
    'release_manifest_hash',
    'approved_flags',
    'validation_status',
    'brian_ratification_sha256',
  ],
  {
    classification: stringSchema({ const: 'REAL_RELEASE' }),
    release_manifest_hash: hashSchema,
    approved_flags: arraySchema(stringSchema({ enum: FLAG_NAMES.slice(1) }), { minItems: 1, uniqueItems: true }),
    validation_status: stringSchema({ const: 'pass' }),
    brian_ratification_sha256: hashSchema,
    physician_approval_sha256: hashSchema,
  },
);

const physicianApprovalProofSchema = objectSchema(
  [
    'classification',
    'credential_registry_attestation_sha256',
    'medical_governance_assignment_sha256',
    'approved_revision_hashes',
    'review_event_hashes',
    'reviewer_independent',
  ],
  {
    classification: stringSchema({ const: 'REAL_VERIFIED_APPROVAL' }),
    credential_registry_attestation_sha256: hashSchema,
    medical_governance_assignment_sha256: hashSchema,
    approved_revision_hashes: arraySchema(hashSchema, { minItems: 1, uniqueItems: true }),
    review_event_hashes: arraySchema(hashSchema, { minItems: 1, uniqueItems: true }),
    reviewer_independent: { type: 'boolean', const: true },
  },
);

const releaseValidationSchema = objectSchema(
  [
    'classification',
    'status',
    'exact_revision_count',
    'rights_privacy_status',
    'validation_sha256',
    'brian_ratification_sha256',
  ],
  {
    classification: stringSchema({ const: 'REAL_RELEASE' }),
    status: stringSchema({ const: 'pass' }),
    exact_revision_count: integerSchema({ minimum: 1 }),
    rights_privacy_status: stringSchema({ const: 'pass' }),
    validation_sha256: hashSchema,
    brian_ratification_sha256: hashSchema,
  },
);

const realPrivacyClassMetricSchema = objectSchema(
  [
    'tp',
    'fp',
    'fn',
    'precision_denominator',
    'recall_denominator',
    'precision',
    'recall',
    'recall_lower_bound_95',
    'zero_tolerance_events',
  ],
  {
    tp: nonNegativeIntegerSchema,
    fp: nonNegativeIntegerSchema,
    fn: nonNegativeIntegerSchema,
    precision_denominator: nonNegativeIntegerSchema,
    recall_denominator: nonNegativeIntegerSchema,
    precision: ratioSchema,
    recall: ratioSchema,
    recall_lower_bound_95: ratioSchema,
    zero_tolerance_events: nonNegativeIntegerSchema,
  },
);

const realPrivacyMetricsSchema = objectSchema(
  [
    'classification',
    'source_count',
    'sources_evaluated',
    'speaker_attribution_accuracy',
    'required_classes',
    'by_class',
    'patient_privacy_aggregate',
    'deterministic_rerun_equal',
    'forbidden_field_scan_status',
    'per_source_validation_status',
  ],
  {
    classification: stringSchema({ const: 'REAL_CORPUS' }),
    source_count: integerSchema({ minimum: 1 }),
    sources_evaluated: integerSchema({ minimum: 1 }),
    speaker_attribution_accuracy: ratioSchema,
    required_classes: arraySchema(stringSchema({ enum: Object.keys(REAL_PRIVACY_RULES) }), {
      minItems: Object.keys(REAL_PRIVACY_RULES).length,
      maxItems: Object.keys(REAL_PRIVACY_RULES).length,
      uniqueItems: true,
    }),
    by_class: objectSchema(
      Object.keys(REAL_PRIVACY_RULES),
      Object.fromEntries(Object.keys(REAL_PRIVACY_RULES).map((name) => [name, realPrivacyClassMetricSchema])),
    ),
    patient_privacy_aggregate: realPrivacyClassMetricSchema,
    deterministic_rerun_equal: { type: 'boolean', const: true },
    forbidden_field_scan_status: stringSchema({ const: 'pass' }),
    per_source_validation_status: stringSchema({ const: 'pass' }),
  },
);

const EVIDENCE_SCHEMAS = Object.freeze({
  'accessibility_results.json': objectSchema(
    ['generated_at', 'status', 'standard_target', 'results', 'external_human_gap'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: [
        'pass_automated_and_browser_heuristics',
        'pass_staging_browser',
        'pass_production_browser',
        'BLOCKED_NOT_RUN',
      ] }),
      standard_target: stringSchema({ const: 'WCAG 2.2 AA' }),
      results: objectSchema(
        [
          'one_h1',
          'duplicate_ids',
          'unnamed_controls',
          'reduced_motion_rule',
          'visible_focus_rule',
          'status_not_color_only',
          'responsive_overflow_failures',
          'enabled_primary_action_contrast_ratio',
          'warning_banner_contrast_ratio',
          'active_navigation_contrast_ratio',
        ],
        {
          one_h1: { type: 'boolean' },
          duplicate_ids: nonNegativeIntegerSchema,
          unnamed_controls: nonNegativeIntegerSchema,
          reduced_motion_rule: { type: 'boolean' },
          visible_focus_rule: { type: 'boolean' },
          status_not_color_only: { type: 'boolean' },
          responsive_overflow_failures: nonNegativeIntegerSchema,
          enabled_primary_action_contrast_ratio: numberSchema({ minimum: 0 }),
          warning_banner_contrast_ratio: numberSchema({ minimum: 0 }),
          active_navigation_contrast_ratio: numberSchema({ minimum: 0 }),
        },
      ),
      external_human_gap: nullableStringSchema,
    },
  ),
  'artifact_checksums.json': objectSchema(
    ['generated_at', 'status', 'artifact_count', 'artifacts'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ const: 'pass' }),
      artifact_count: nonNegativeIntegerSchema,
      artifacts: arraySchema(objectSchema(
        ['path', 'bytes', 'sha256'],
        {
          path: nonEmptyStringSchema,
          bytes: nonNegativeIntegerSchema,
          sha256: hashSchema,
        },
      ), { uniqueBy: 'path' }),
    },
  ),
  'browser_results.json': objectSchema(
    [
      'generated_at',
      'status',
      'workflows',
      'viewport_workflow_checks',
      'viewport_widths',
      'page_level_horizontal_overflow_failures',
      'console_warning_or_error_count',
      'keyboard_checks',
      'state_checks',
      'screenshot_counts',
    ],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: [
        'pass_local_synthetic_app',
        'pass_staging_runtime',
        'pass_production_runtime',
        'BLOCKED_NOT_RUN',
      ] }),
      workflows: nonNegativeIntegerSchema,
      viewport_workflow_checks: nonNegativeIntegerSchema,
      viewport_widths: arraySchema(integerSchema({ minimum: 1 }), { minItems: 1, uniqueItems: true }),
      page_level_horizontal_overflow_failures: nonNegativeIntegerSchema,
      console_warning_or_error_count: nonNegativeIntegerSchema,
      keyboard_checks: objectSchema(
        ['enter_navigation', 'space_navigation', 'explicit_keydown_handler'],
        {
          enter_navigation: stringSchema({ enum: ['pass', 'not_run'] }),
          space_navigation: stringSchema({ enum: ['pass', 'not_run'] }),
          explicit_keydown_handler: stringSchema({ enum: ['pass', 'not_run'] }),
        },
      ),
      state_checks: objectSchema(
        ['autosave_unsaved_then_saved', 'physician_approve_disabled', 'release_assemble_disabled'],
        {
          autosave_unsaved_then_saved: stringSchema({ enum: ['pass', 'not_run'] }),
          physician_approve_disabled: stringSchema({ enum: ['pass', 'not_run'] }),
          release_assemble_disabled: stringSchema({ enum: ['pass', 'not_run'] }),
        },
      ),
      screenshot_counts: objectSchema(
        ['desktop', 'tablet', 'mobile'],
        {
          desktop: nonNegativeIntegerSchema,
          tablet: nonNegativeIntegerSchema,
          mobile: nonNegativeIntegerSchema,
        },
      ),
    },
  ),
  'candidate_counts.json': objectSchema(
    [
      'generated_at',
      'status',
      'real_candidates',
      'synthetic_fixture_candidates',
      'physician_approved_revisions',
      'release_eligible_revisions',
      'published_revisions',
    ],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['NO_REAL_CANDIDATES', 'QUARANTINED_REAL_CANDIDATES', 'BLOCKED_NOT_RUN'] }),
      classification: stringSchema({ enum: ['SYNTHETIC_ONLY', 'REAL_CORPUS'] }),
      real_candidates: nonNegativeIntegerSchema,
      synthetic_fixture_candidates: nonNegativeIntegerSchema,
      physician_approved_revisions: nonNegativeIntegerSchema,
      release_eligible_revisions: nonNegativeIntegerSchema,
      published_revisions: nonNegativeIntegerSchema,
    },
  ),
  'combined_handoff_validation.json': objectSchema(
    [
      'generated_at',
      'status',
      'combined_path',
      'source_count',
      'source_list',
      'final_line_count',
      'combined_bytes',
      'combined_sha256',
      'markers_found',
      'missing_sources',
      'duplicate_sources',
      'unexpected_sources',
      'exact_content_mismatches',
      'self_embedding',
    ],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ const: 'pass' }),
      combined_path: nonEmptyStringSchema,
      source_count: nonNegativeIntegerSchema,
      source_list: arraySchema(objectSchema(
        ['path', 'bytes', 'lines', 'sha256'],
        {
          path: nonEmptyStringSchema,
          bytes: nonNegativeIntegerSchema,
          lines: nonNegativeIntegerSchema,
          sha256: hashSchema,
        },
      ), { uniqueBy: 'path' }),
      final_line_count: nonNegativeIntegerSchema,
      combined_bytes: nonNegativeIntegerSchema,
      combined_sha256: hashSchema,
      markers_found: nonNegativeIntegerSchema,
      missing_sources: arraySchema(nonEmptyStringSchema, { uniqueItems: true }),
      duplicate_sources: arraySchema(nonEmptyStringSchema, { uniqueItems: true }),
      unexpected_sources: arraySchema(nonEmptyStringSchema, { uniqueItems: true }),
      exact_content_mismatches: arraySchema(nonEmptyStringSchema, { uniqueItems: true }),
      self_embedding: { type: 'boolean' },
    },
  ),
  'deployment_manifest.json': objectSchema(
    ['generated_at', 'status', 'success_level', 'deployment_urls', 'canonical_route', 'feature_flags', 'blockers'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['BLOCKED_NOT_DEPLOYED', 'STAGING_VALIDATED', 'INTERNAL_PRODUCTION_LIVE'] }),
      success_level: stringSchema({ enum: ['BELOW_LEVEL_1', 'STATE_A', 'STATE_B', 'STATE_C', 'STATE_D'] }),
      deployment_urls: arraySchema(stringSchema({ pattern: /^https:\/\/[^\s]+$/u }), { uniqueItems: true }),
      canonical_route: nullableStringSchema,
      feature_flags: objectSchema(
        FLAG_NAMES,
        Object.fromEntries(FLAG_NAMES.map((name) => [name, { type: 'boolean' }])),
      ),
      blockers: arraySchema(nonEmptyStringSchema, { uniqueItems: true }),
      release_proof: runtimeProofSchema,
      consumer_release_proof: consumerReleaseProofSchema,
    },
  ),
  'drive_discovery.json': objectSchema(
    ['generated_at', 'status', 'read_only_queries', 'files_opened', 'files_modified'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['NO_RELEVANT_I1Q_RECORD_FOUND', 'REAL_CORPUS_METADATA_FOUND', 'BLOCKED_NOT_RUN'] }),
      read_only_queries: arraySchema(objectSchema(
        ['query', 'relevant_results'],
        {
          query: nonEmptyStringSchema,
          relevant_results: nonNegativeIntegerSchema,
          unrelated_results_not_opened: { type: 'boolean' },
        },
      )),
      files_opened: nonNegativeIntegerSchema,
      files_modified: nonNegativeIntegerSchema,
      classification: stringSchema({ enum: ['DISCOVERY_ONLY', 'REAL_CORPUS_METADATA'] }),
    },
  ),
  'extraction_metrics.json': objectSchema(
    ['generated_at', 'status', 'real_sources_processed', 'provisional_benchmark_sources', 'metrics', 'reason', 'pipeline_unit_contracts'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['BLOCKED_NOT_RUN', 'INCOMPLETE_NOT_CLEARED', 'PASS_REAL_PILOT'] }),
      real_sources_processed: nonNegativeIntegerSchema,
      provisional_benchmark_sources: nonNegativeIntegerSchema,
      metrics: { anyOf: [{ type: 'null' }, realPrivacyMetricsSchema] },
      reason: nullableStringSchema,
      pipeline_unit_contracts: stringSchema({ enum: ['pass', 'fail', 'not_run'] }),
    },
  ),
  'foundation_audit.json': objectSchema(
    ['generated_at', 'status', 'source', 'exact_tests', 'patient_identifier_metric'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ const: 'pass' }),
      source: nonEmptyStringSchema,
      exact_tests: objectSchema(
        [
          'official_validators',
          'official_leak_tests',
          'official_negative_cases',
          'new_adversarial_cases',
          'privacy_contract_tests',
          'total_assertions',
        ],
        {
          official_validators: nonNegativeIntegerSchema,
          official_leak_tests: nonNegativeIntegerSchema,
          official_negative_cases: nonNegativeIntegerSchema,
          new_adversarial_cases: nonNegativeIntegerSchema,
          privacy_contract_tests: nonNegativeIntegerSchema,
          total_assertions: nonNegativeIntegerSchema,
        },
      ),
      patient_identifier_metric: objectSchema(
        ['recall_type', 'missing_required_class_status', 'denominator_zero_policy', 'source_1005_fixture_defect'],
        {
          recall_type: stringSchema({ const: 'number' }),
          missing_required_class_status: stringSchema({ const: 'fail' }),
          denominator_zero_policy: stringSchema({ const: 'fail_required_class_without_gold_label' }),
          source_1005_fixture_defect: nonEmptyStringSchema,
        },
      ),
    },
  ),
  'health_check_results.json': objectSchema(
    ['generated_at', 'status', 'http_status', 'payload', 'security_headers'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['pass', 'pass_staging_runtime', 'pass_production_runtime', 'BLOCKED_NOT_RUN'] }),
      http_status: integerSchema({ minimum: 100, maximum: 599 }),
      payload: objectSchema(
        ['ok', 'service', 'version', 'mode'],
        {
          ok: { type: 'boolean' },
          service: stringSchema({ const: 'i1q-question-platform' }),
          version: nonEmptyStringSchema,
          mode: stringSchema({ enum: ['LOCAL_SYNTHETIC_DEMO', 'STAGING', 'PRODUCTION', 'BLOCKED'] }),
        },
      ),
      security_headers: objectSchema(
        ['content_security_policy', 'x_content_type_options', 'x_frame_options'],
        {
          content_security_policy: nonEmptyStringSchema,
          x_content_type_options: stringSchema({ const: 'nosniff' }),
          x_frame_options: stringSchema({ const: 'DENY' }),
        },
      ),
    },
  ),
  'inventory_report.json': objectSchema(
    ['generated_at', 'status', 'counts', 'real_inventory_totals', 'blockers', 'source_mutations'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['DISCOVERY_ONLY_REAL_INVENTORY_NOT_AUTHORIZED', 'REAL_CORPUS_INVENTORIED', 'BLOCKED_NOT_RUN'] }),
      classification: stringSchema({ enum: ['DISCOVERY_ONLY', 'REAL_CORPUS'] }),
      registry_sha256: hashSchema,
      probe_manifest_sha256: hashSchema,
      counts: objectSchema(
        [],
        {
          local_vtt_files: nonNegativeIntegerSchema,
          local_transcript_caption_subtitle_data_files: nonNegativeIntegerSchema,
          local_nodes_or_media_registry_artifacts: nonNegativeIntegerSchema,
          seeded_drill_rows_with_stream_vtt_nodes_references: nonNegativeIntegerSchema,
          sidecar_paths_referenced_by_seed: nonNegativeIntegerSchema,
          checked_in_stat_runtime_index_lookup_json: nonNegativeIntegerSchema,
          matching_historical_git_blobs: nonNegativeIntegerSchema,
          static_v4_sql_insert_statements: nonNegativeIntegerSchema,
          registered_i1q_missions: nonNegativeIntegerSchema,
          registered_i1q_products_or_passports: nonNegativeIntegerSchema,
          authorized_sources: nonNegativeIntegerSchema,
          registry_rows: nonNegativeIntegerSchema,
          transcripts_available: nonNegativeIntegerSchema,
          nodes_available: nonNegativeIntegerSchema,
          verified_drj_sources: nonNegativeIntegerSchema,
          multi_speaker_sources: nonNegativeIntegerSchema,
          working_redacted_sources: nonNegativeIntegerSchema,
          extraction_ready_sources: nonNegativeIntegerSchema,
          duplicate_source_groups: nonNegativeIntegerSchema,
        },
      ),
      real_inventory_totals: {
        anyOf: [
          { type: 'null' },
          objectSchema(
            ['authorized_sources', 'transcripts_available', 'nodes_available', 'verified_drj_sources', 'extraction_ready_sources'],
            {
              authorized_sources: integerSchema({ minimum: 1 }),
              transcripts_available: nonNegativeIntegerSchema,
              nodes_available: nonNegativeIntegerSchema,
              verified_drj_sources: nonNegativeIntegerSchema,
              extraction_ready_sources: nonNegativeIntegerSchema,
            },
          ),
        ],
      },
      blockers: arraySchema(nonEmptyStringSchema, { uniqueItems: true }),
      source_mutations: nonNegativeIntegerSchema,
    },
  ),
  'legacy_reconciliation.json': objectSchema(
    ['generated_at', 'status', 'expected_rows_from_checked_in_migration_provenance', 'reconciled_rows', 'imported_rows', 'historical_join_strategy', 'unreviewed_marked_approved'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['BLOCKED_STATIC_EXPORT_NOT_AUTHORIZED', 'STATIC_V4_RECONCILED'] }),
      classification: stringSchema({ enum: ['STATIC_PROVENANCE_ONLY', 'REAL_STATIC_EXPORT'] }),
      expected_rows_from_checked_in_migration_provenance: nonNegativeIntegerSchema,
      reconciled_rows: nonNegativeIntegerSchema,
      imported_rows: nonNegativeIntegerSchema,
      historical_join_strategy: stringSchema({ const: 'dataset_version plus question_id plus content_hash' }),
      unreviewed_marked_approved: nonNegativeIntegerSchema,
      migration_sha256: hashSchema,
      restricted_export_sha256: hashSchema,
      static_rows: nonNegativeIntegerSchema,
      distinct_question_ids: nonNegativeIntegerSchema,
      required_field_nulls: nonNegativeIntegerSchema,
      stat_field_list: arraySchema(nonEmptyStringSchema, { minItems: 9, maxItems: 9, uniqueItems: true }),
      production_database_reads: nonNegativeIntegerSchema,
      production_database_writes: nonNegativeIntegerSchema,
    },
  ),
  'load_results.json': objectSchema(
    ['generated_at', 'status', 'workload', 'elapsed_ms', 'page_rows', 'total_rows', 'scope'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['pass', 'pass_staging_runtime', 'pass_production_runtime', 'BLOCKED_NOT_RUN'] }),
      workload: nonEmptyStringSchema,
      elapsed_ms: numberSchema({ minimum: 0 }),
      page_rows: nonNegativeIntegerSchema,
      total_rows: nonNegativeIntegerSchema,
      scope: nonEmptyStringSchema,
    },
  ),
  'migration_validation.json': objectSchema(
    ['generated_at', 'status', 'migration', 'sha256', 'production_or_staging_apply_count', 'reason'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['STATIC_PASS_PREVIEW_NOT_RUN', 'PREVIEW_PASS', 'STAGING_PASS', 'PRODUCTION_APPLIED'] }),
      migration: nonEmptyStringSchema,
      sha256: hashSchema,
      production_or_staging_apply_count: nonNegativeIntegerSchema,
      reason: nullableStringSchema,
      environment: stringSchema({ enum: ['preview', 'staging', 'production'] }),
      applied_commit: stringSchema({ pattern: COMMIT_PATTERN }),
      execution_proof_sha256: hashSchema,
      rollback_reapply_status: stringSchema({ const: 'pass' }),
    },
  ),
  'openapi_validation.json': objectSchema(
    ['generated_at', 'status', 'openapi', 'path_count', 'security_scheme', 'production_identity_url_status'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ const: 'pass_json_and_contract_shape' }),
      openapi: stringSchema({ pattern: /^3\.1\.\d+$/u }),
      path_count: integerSchema({ minimum: 1 }),
      security_scheme: arraySchema(nonEmptyStringSchema, { minItems: 1, uniqueItems: true }),
      production_identity_url_status: stringSchema({ enum: ['OPEN', 'BOUND_CANONICAL'] }),
    },
  ),
  'release_manifest.json': objectSchema(
    ['generated_at', 'status', 'classification', 'manifest', 'artifact_summaries'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['CONTRACT_FIXTURE_NOT_RELEASE', 'RELEASE_VALIDATED', 'RELEASE_RATIFIED', 'RELEASE_PUBLISHED'] }),
      classification: stringSchema({ enum: ['SYNTHETIC_NON_CLINICAL', 'REAL_RELEASE'] }),
      stat_field_list: arraySchema(nonEmptyStringSchema, { minItems: 9, maxItems: 9, uniqueItems: true }),
      manifest: objectSchema(
        ['release_id', 'dataset_version', 'previous_manifest_hash', 'artifact_hashes', 'manifest_hash'],
        {
          release_id: nonEmptyStringSchema,
          dataset_version: nonEmptyStringSchema,
          previous_manifest_hash: nullableHashSchema,
          release_membership: arraySchema(objectSchema(
            ['dataset_version', 'question_id', 'item_id', 'itemrev_id', 'revision_number', 'content_hash'],
            {
              dataset_version: nonEmptyStringSchema,
              question_id: nonEmptyStringSchema,
              item_id: nonEmptyStringSchema,
              itemrev_id: nonEmptyStringSchema,
              revision_number: integerSchema({ minimum: 1 }),
              content_hash: hashSchema,
            },
          )),
          artifact_hashes: arraySchema(artifactSummarySchema, { minItems: Object.keys(CHANNEL_PHASES).length, uniqueBy: 'channel' }),
          manifest_hash: hashSchema,
        },
      ),
      artifact_summaries: arraySchema(artifactSummarySchema, { minItems: Object.keys(CHANNEL_PHASES).length, uniqueBy: 'channel' }),
      artifacts: arraySchema(objectSchema(
        ['channel', 'phase', 'sha256', 'record_count', 'payload'],
        {
          channel: stringSchema({ enum: Object.keys(CHANNEL_PHASES) }),
          phase: stringSchema({ enum: ['server_only', 'pre_answer', 'post_answer', 'internal', 'contract_only'] }),
          data_class: stringSchema({ enum: ['A', 'B', 'C', 'D', 'contract_only'] }),
          sha256: hashSchema,
          record_count: nonNegativeIntegerSchema,
          payload: anySchema,
        },
      ), { uniqueBy: 'channel' }),
      manifest_history: arraySchema(objectSchema(
        ['manifest_hash', 'previous_manifest_hash'],
        {
          manifest_hash: hashSchema,
          previous_manifest_hash: nullableHashSchema,
        },
      ), { uniqueBy: 'manifest_hash' }),
      release_validation: releaseValidationSchema,
      physician_approval_proof: physicianApprovalProofSchema,
    },
  ),
  'rollback_manifest.json': objectSchema(
    ['generated_at', 'status', 'compensating_migration', 'sha256', 'disables', 'drops_data'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['DESIGNED_NOT_EXECUTED', 'EXECUTED_STAGING', 'EXECUTED_PRODUCTION'] }),
      compensating_migration: nonEmptyStringSchema,
      sha256: hashSchema,
      disables: arraySchema(stringSchema({ enum: FLAG_NAMES }), { minItems: FLAG_NAMES.length, maxItems: FLAG_NAMES.length, uniqueItems: true }),
      drops_data: { type: 'boolean', const: false },
      environment: stringSchema({ enum: ['staging', 'production'] }),
      execution_proof_sha256: hashSchema,
      reapply_status: stringSchema({ const: 'pass' }),
    },
  ),
  'security_results.json': objectSchema(
    ['generated_at', 'status', 'passed', 'blocked_or_not_executed', 'critical_open_defects', 'high_open_defects'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ enum: ['pass_local_candidate_with_production_blockers', 'pass_staging_runtime', 'pass_production_runtime', 'BLOCKED_NOT_RUN'] }),
      passed: arraySchema(nonEmptyStringSchema, { uniqueItems: true }),
      blocked_or_not_executed: arraySchema(nonEmptyStringSchema, { uniqueItems: true }),
      critical_open_defects: nonNegativeIntegerSchema,
      high_open_defects: nonNegativeIntegerSchema,
    },
  ),
  'test_results.json': objectSchema(
    ['generated_at', 'status', 'exit_code', 'test_files', 'passed_assertions', 'failed_assertions', 'output_sha256'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ const: 'pass' }),
      exit_code: integerSchema({ const: 0 }),
      test_files: arraySchema(nonEmptyStringSchema, { minItems: 1, uniqueItems: true }),
      passed_assertions: integerSchema({ minimum: 1 }),
      failed_assertions: integerSchema({ const: 0 }),
      output_sha256: hashSchema,
    },
  ),
  'ux_scorecard.json': objectSchema(
    ['generated_at', 'status', 'minimum_score', 'board', 'disclaimer'],
    {
      generated_at: generatedAtSchema,
      status: stringSchema({ const: 'pass_heuristic_only' }),
      minimum_score: numberSchema({ minimum: 0, maximum: 10 }),
      board: arraySchema(objectSchema(
        ['persona', 'scores', 'dependency'],
        {
          persona: nonEmptyStringSchema,
          scores: objectSchema(
            ['clarity', 'speed', 'cognitive_load', 'error_prevention', 'trust', 'accessibility', 'discoverability', 'responsiveness', 'visual_quality', 'workflow_completeness'],
            Object.fromEntries([
              'clarity',
              'speed',
              'cognitive_load',
              'error_prevention',
              'trust',
              'accessibility',
              'discoverability',
              'responsiveness',
              'visual_quality',
              'workflow_completeness',
            ].map((name) => [name, numberSchema({ minimum: 0, maximum: 10 })])),
          ),
          dependency: nullableStringSchema,
        },
      ), { minItems: 1, uniqueBy: 'persona' }),
      disclaimer: nonEmptyStringSchema,
    },
  ),
});

function normalizeValue(value) {
  if (typeof value === 'string') return value.normalize('NFC');
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key.normalize('NFC')] = normalizeValue(value[key]);
    }
    return normalized;
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(normalizeValue(value));
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value.normalize('NFC') : canonicalJson(value), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}

function binomialUpperTail(successes, trials, probability) {
  if (successes <= 0) return 1;
  if (successes > trials || probability <= 0) return 0;
  if (probability >= 1) return 1;
  const failures = trials - successes;
  const failureProbability = 1 - probability;
  let term = Math.exp(trials * Math.log(probability));
  if (term === 0) return 0;
  let sum = term;
  for (let failureCount = 0; failureCount < failures; failureCount += 1) {
    term *= ((trials - failureCount) / (failureCount + 1))
      * (failureProbability / probability);
    sum += term;
  }
  return Math.min(1, sum);
}

export function exactBinomialLowerBound(successes, trials, alpha = 0.05) {
  if (!Number.isInteger(successes)
    || !Number.isInteger(trials)
    || successes < 0
    || trials <= 0
    || successes > trials
    || !(alpha > 0 && alpha < 1)) {
    return Number.NaN;
  }
  if (successes === 0) return 0;
  let low = 0;
  let high = successes / trials;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const midpoint = (low + high) / 2;
    if (binomialUpperTail(successes, trials, midpoint) < alpha) low = midpoint;
    else high = midpoint;
  }
  return (low + high) / 2;
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number';
  return typeof value === type;
}

function issue(issues, code, file, path, message) {
  issues.push({ code, file, path, message });
}

function validateSchemaValue(value, schema, context) {
  const { issues, file, path } = context;
  if (!schema || Object.keys(schema).length === 0) return;

  if (schema.anyOf) {
    const candidates = schema.anyOf.map((candidate) => {
      const candidateIssues = [];
      validateSchemaValue(value, candidate, { ...context, issues: candidateIssues });
      return candidateIssues;
    });
    if (candidates.every((candidateIssues) => candidateIssues.length > 0)) {
      issue(issues, 'E_SCHEMA_ANY_OF', file, path, 'Value does not match an allowed schema.');
    }
    return;
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (schema.type && !types.some((type) => typeMatches(value, type))) {
    issue(issues, 'E_SCHEMA_TYPE', file, path, 'Value has the wrong JSON type.');
    return;
  }

  if (value === null) return;

  if (schema.const !== undefined && value !== schema.const) {
    issue(issues, 'E_SCHEMA_CONST', file, path, 'Value does not match the required constant.');
  }
  if (schema.enum && !schema.enum.includes(value)) {
    issue(issues, 'E_SCHEMA_STATUS', file, path, 'Value is not in the allowed enum.');
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issue(issues, 'E_SCHEMA_STRING_EMPTY', file, path, 'Required string is empty.');
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      issue(issues, 'E_SCHEMA_PATTERN', file, path, 'String does not match the required format.');
    }
    if (schema.pattern === ISO_PATTERN && Number.isNaN(Date.parse(value))) {
      issue(issues, 'E_SCHEMA_TIMESTAMP', file, path, 'Timestamp is not a valid ISO instant.');
    }
  }

  if (typeof value === 'number') {
    if (schema.finite && !Number.isFinite(value)) {
      issue(issues, 'E_METRIC_NONFINITE', file, path, 'Numeric evidence must be finite.');
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      issue(issues, 'E_SCHEMA_MINIMUM', file, path, 'Number is below the allowed minimum.');
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      issue(issues, 'E_SCHEMA_MAXIMUM', file, path, 'Number exceeds the allowed maximum.');
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      issue(issues, 'E_SCHEMA_ARRAY_SHORT', file, path, 'Array has too few entries.');
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      issue(issues, 'E_SCHEMA_ARRAY_LONG', file, path, 'Array has too many entries.');
    }
    if (schema.uniqueItems) {
      const serialized = value.map((entry) => canonicalJson(entry));
      if (new Set(serialized).size !== serialized.length) {
        issue(issues, 'E_SCHEMA_ARRAY_DUPLICATE', file, path, 'Array contains duplicate entries.');
      }
    }
    if (schema.uniqueBy) {
      const keys = value.map((entry) => entry && entry[schema.uniqueBy]);
      if (new Set(keys).size !== keys.length) {
        issue(issues, 'E_SCHEMA_ARRAY_DUPLICATE', file, path, 'Array contains duplicate identities.');
      }
    }
    if (schema.items) {
      value.forEach((entry, index) => validateSchemaValue(entry, schema.items, {
        ...context,
        path: `${path}[${index}]`,
      }));
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const required = schema.required || [];
    const properties = schema.properties || {};
    for (const key of required) {
      if (!Object.hasOwn(value, key)) {
        issue(issues, 'E_SCHEMA_REQUIRED', file, `${path}.${key}`, 'Required key is missing.');
      }
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(properties, key)) {
        if (schema.additionalProperties === false) {
          issue(issues, 'E_SCHEMA_UNKNOWN_KEY', file, `${path}.${key}`, 'Unexpected key is not allowed.');
        } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          validateSchemaValue(value[key], schema.additionalProperties, { ...context, path: `${path}.${key}` });
        }
        continue;
      }
      validateSchemaValue(value[key], properties[key], { ...context, path: `${path}.${key}` });
    }
  }
}

function isSafeRelativePath(path) {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path)) return false;
  const segments = path.split(/[\\/]/u);
  return !segments.includes('..') && !segments.includes('') && !path.includes('\0');
}

function isWithin(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function sameStringArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function sameSet(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value) => right.includes(value));
}

function countLines(content) {
  return (content.match(/\n/gu) || []).length + (content.endsWith('\n') ? 0 : 1);
}

function hasDuplicateJsonKeys(content) {
  let index = 0;
  let duplicate = false;

  function skipWhitespace() {
    while (/\s/u.test(content[index] || '')) index += 1;
  }

  function parseStringToken() {
    const start = index;
    index += 1;
    while (index < content.length) {
      if (content[index] === '\\') {
        index += 2;
      } else if (content[index] === '"') {
        index += 1;
        return JSON.parse(content.slice(start, index));
      } else {
        index += 1;
      }
    }
    return '';
  }

  function parseValue() {
    skipWhitespace();
    if (content[index] === '{') {
      index += 1;
      const keys = new Set();
      skipWhitespace();
      while (content[index] !== '}' && index < content.length) {
        const key = parseStringToken().normalize('NFC');
        if (keys.has(key)) duplicate = true;
        keys.add(key);
        skipWhitespace();
        index += 1;
        parseValue();
        skipWhitespace();
        if (content[index] === ',') {
          index += 1;
          skipWhitespace();
        }
      }
      index += 1;
      return;
    }
    if (content[index] === '[') {
      index += 1;
      skipWhitespace();
      while (content[index] !== ']' && index < content.length) {
        parseValue();
        skipWhitespace();
        if (content[index] === ',') {
          index += 1;
          skipWhitespace();
        }
      }
      index += 1;
      return;
    }
    if (content[index] === '"') {
      parseStringToken();
      return;
    }
    while (index < content.length && !/[\s,}\]]/u.test(content[index])) index += 1;
  }

  parseValue();
  return duplicate;
}

async function readJsonFile(path, file, issues) {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      issue(issues, 'E_EVIDENCE_MISSING', file, '$', 'Expected evidence file is missing.');
      return null;
    }
    issue(issues, 'E_EVIDENCE_READ', file, '$', 'Evidence file could not be inspected.');
    return null;
  }
  if (!info.isFile()) {
    issue(issues, 'E_EVIDENCE_NOT_FILE', file, '$', 'Evidence path is not a regular file.');
    return null;
  }
  if (info.size > MAX_EVIDENCE_BYTES) {
    issue(issues, 'E_EVIDENCE_TOO_LARGE', file, '$', 'Evidence file exceeds the validator size limit.');
    return null;
  }
  let content;
  try {
    content = await readFile(path, 'utf8');
  } catch {
    issue(issues, 'E_EVIDENCE_READ', file, '$', 'Evidence file could not be read.');
    return null;
  }
  try {
    const parsed = JSON.parse(content);
    if (hasDuplicateJsonKeys(content)) {
      issue(issues, 'E_JSON_DUPLICATE_KEY', file, '$', 'Evidence JSON contains a duplicate object key.');
    }
    return parsed;
  } catch {
    issue(issues, 'E_JSON_PARSE', file, '$', 'Evidence file is not valid JSON.');
    return null;
  }
}

async function walkRegularFiles(root, excludedRoot = null) {
  const files = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (excludedRoot && resolve(path) === excludedRoot) continue;
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  }
  await visit(root);
  return files;
}

async function walkMarkdown(root, combinedPath) {
  const files = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith('.md') && resolve(path) !== resolve(combinedPath)) files.push(path);
    }
  }
  await visit(root);
  return files;
}

function validateStatFieldLists(value, file, issues, path = '$') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateStatFieldLists(entry, file, issues, `${path}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (['stat_field_list', 'stat_fields', 'dataset_question_fields'].includes(key)
      && !sameStringArray(entry, STAT_DATASET_FIELDS)) {
      issue(issues, 'E_STAT_FIELDS_EXACT', file, `${path}.${key}`, 'STAT field list must contain the exact nine fields in order.');
    }
    validateStatFieldLists(entry, file, issues, `${path}.${key}`);
  }
}

const SOURCE_LEAK_KEYS = new Set([
  'raw_text',
  'source_text',
  'original_text',
  'transcript_text',
  'transcript_content',
  'caption_text',
  'source_url',
  'source_title',
  'source_filename',
  'playback_url',
  'transcript_url',
  'nodes_url',
  'speaker',
  'speaker_label',
  'patient_name',
  'student_name_value',
]);

const ANSWER_LEAK_KEYS = new Set([
  'answer',
  'answer_map',
  'answer_key',
  'answerkey',
  'correct_answer',
  'correctanswer',
  'correct_option',
  'iscorrect',
  'is_correct',
  'solution',
  'explanation',
  'correct_answer_rationale',
  'distractor_rationales',
]);

function scanKeys(value, forbidden, onFinding, path = '$') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanKeys(entry, forbidden, onFinding, `${path}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const normalized = key.replace(/[-\s]/gu, '_').toLowerCase();
    if (forbidden.has(normalized)) onFinding(`${path}.${key}`);
    scanKeys(entry, forbidden, onFinding, `${path}.${key}`);
  }
}

function validateNoSourceLeak(evidence, issues) {
  for (const [file, value] of Object.entries(evidence)) {
    if (file === 'release_manifest.json' && Array.isArray(value?.artifacts)) {
      const shallow = { ...value, artifacts: undefined };
      scanKeys(shallow, SOURCE_LEAK_KEYS, (path) => {
        issue(issues, 'E_SOURCE_LEAK', file, path, 'Evidence contains a forbidden source-content field.');
      });
      continue;
    }
    scanKeys(value, SOURCE_LEAK_KEYS, (path) => {
      issue(issues, 'E_SOURCE_LEAK', file, path, 'Evidence contains a forbidden source-content field.');
    });
  }
}

async function validateArtifactChecksums(evidence, roots, issues) {
  const file = 'artifact_checksums.json';
  const checks = evidence[file];
  if (!checks || !Array.isArray(checks.artifacts)) return;

  if (checks.artifact_count !== checks.artifacts.length) {
    issue(issues, 'E_ARTIFACT_COUNT', file, '$.artifact_count', 'Artifact count does not match the manifest list.');
  }

  const listed = new Map();
  for (const [index, record] of checks.artifacts.entries()) {
    if (!record || typeof record.path !== 'string') continue;
    if (!isSafeRelativePath(record.path)) {
      issue(issues, 'E_PATH_UNSAFE', file, `$.artifacts[${index}].path`, 'Artifact path must be a safe relative path.');
      continue;
    }
    const absolute = resolve(roots.worktreeRoot, record.path);
    if (!isWithin(roots.appRoot, absolute) || isWithin(roots.evidenceDir, absolute)) {
      issue(issues, 'E_ARTIFACT_SCOPE', file, `$.artifacts[${index}].path`, 'Artifact path is outside the checksum scope.');
      continue;
    }
    listed.set(record.path, record);
    try {
      const info = await lstat(absolute);
      if (!info.isFile()) throw new Error('not_file');
      const bytes = await readFile(absolute);
      if (record.bytes !== info.size || record.sha256 !== sha256(bytes)) {
        issue(issues, 'E_ARTIFACT_STALE', file, `$.artifacts[${index}]`, 'Artifact byte count or hash is stale.');
      }
    } catch {
      issue(issues, 'E_ARTIFACT_MISSING', file, `$.artifacts[${index}]`, 'Checksummed artifact is missing or unreadable.');
    }
  }

  let actualFiles;
  try {
    actualFiles = await walkRegularFiles(roots.appRoot, roots.evidenceDir);
  } catch {
    issue(issues, 'E_ARTIFACT_INVENTORY_READ', file, '$.artifacts', 'Application artifact inventory could not be read.');
    return;
  }
  const actualPaths = actualFiles.map((path) => relative(roots.worktreeRoot, path));
  const missingFromManifest = actualPaths.filter((path) => !listed.has(path));
  const absentFromDisk = [...listed.keys()].filter((path) => !actualPaths.includes(path));
  if (missingFromManifest.length > 0 || absentFromDisk.length > 0 || actualPaths.length !== checks.artifact_count) {
    issue(issues, 'E_ARTIFACT_INVENTORY', file, '$.artifacts', 'Artifact inventory is incomplete or stale.');
  }
}

async function validatePathHash(record, pathKey, hashKey, file, roots, issues) {
  if (!record || typeof record[pathKey] !== 'string' || typeof record[hashKey] !== 'string') return;
  const rel = record[pathKey];
  if (!isSafeRelativePath(rel)) {
    issue(issues, 'E_PATH_UNSAFE', file, `$.${pathKey}`, 'Referenced path must be a safe relative path.');
    return;
  }
  const absolute = resolve(roots.worktreeRoot, rel);
  if (!isWithin(roots.appRoot, absolute)) {
    issue(issues, 'E_REFERENCE_SCOPE', file, `$.${pathKey}`, 'Referenced application file is outside the allowed scope.');
    return;
  }
  try {
    const info = await lstat(absolute);
    if (!info.isFile()) throw new Error('not_file');
    const bytes = await readFile(absolute);
    if (sha256(bytes) !== record[hashKey]) {
      issue(issues, 'E_REFERENCE_HASH', file, `$.${hashKey}`, 'Referenced file hash does not match.');
    }
  } catch {
    issue(issues, 'E_REFERENCE_MISSING', file, `$.${pathKey}`, 'Referenced file is missing or unreadable.');
  }
}

async function validateCombinedHandoff(evidence, roots, issues) {
  const file = 'combined_handoff_validation.json';
  const validation = evidence[file];
  if (!validation) return;

  if (validation.self_embedding !== false) {
    issue(issues, 'E_COMBINED_SELF_REFERENCE', file, '$.self_embedding', 'Combined handoff must not embed itself.');
  }
  for (const key of ['missing_sources', 'duplicate_sources', 'unexpected_sources', 'exact_content_mismatches']) {
    if (Array.isArray(validation[key]) && validation[key].length > 0) {
      issue(issues, 'E_COMBINED_RECORDED_FAILURE', file, `$.${key}`, 'Combined handoff records unresolved validation failures.');
    }
  }
  if (validation.source_count !== validation.source_list?.length || validation.markers_found !== validation.source_count) {
    issue(issues, 'E_COMBINED_COUNT', file, '$.source_count', 'Combined handoff counts are inconsistent.');
  }
  if (!isSafeRelativePath(validation.combined_path)) {
    issue(issues, 'E_PATH_UNSAFE', file, '$.combined_path', 'Combined handoff path must be a safe relative path.');
    return;
  }

  const combinedPath = resolve(roots.worktreeRoot, validation.combined_path);
  if (!isWithin(roots.worktreeRoot, combinedPath)) {
    issue(issues, 'E_REFERENCE_SCOPE', file, '$.combined_path', 'Combined handoff path is outside the worktree.');
    return;
  }
  const handoffRoot = dirname(combinedPath);

  let combined;
  try {
    combined = await readFile(combinedPath, 'utf8');
  } catch {
    issue(issues, 'E_COMBINED_MISSING', file, '$.combined_path', 'Combined handoff is missing or unreadable.');
    return;
  }
  if (Buffer.byteLength(combined) !== validation.combined_bytes
    || sha256(combined) !== validation.combined_sha256
    || (combined.match(/\n/gu) || []).length !== validation.final_line_count) {
    issue(issues, 'E_COMBINED_STALE', file, '$.combined_sha256', 'Combined handoff bytes, lines, or hash are stale.');
  }

  const markerPaths = [...combined.matchAll(/^FILE: (.+)$/gmu)].map((match) => match[1]);
  const combinedName = relative(handoffRoot, combinedPath);
  if (markerPaths.includes(combinedName)) {
    issue(issues, 'E_COMBINED_SELF_REFERENCE', file, '$.combined_path', 'Combined handoff includes its own marker.');
  }
  if (new Set(markerPaths).size !== markerPaths.length) {
    issue(issues, 'E_COMBINED_DUPLICATE_MARKER', file, '$.markers_found', 'Combined handoff contains duplicate source markers.');
  }

  let actualMarkdown;
  try {
    actualMarkdown = await walkMarkdown(handoffRoot, combinedPath);
  } catch {
    issue(issues, 'E_COMBINED_SOURCE_READ', file, '$.source_list', 'Combined handoff sources could not be enumerated.');
    return;
  }
  const actualRelative = actualMarkdown.map((path) => relative(handoffRoot, path));
  const listedRelative = Array.isArray(validation.source_list)
    ? validation.source_list.map((record) => record.path)
    : [];
  if (!sameSet(actualRelative, listedRelative) || !sameSet(markerPaths, listedRelative)) {
    issue(issues, 'E_COMBINED_SOURCE_SET', file, '$.source_list', 'Combined handoff source set is stale or incomplete.');
  }

  const sections = [];
  for (const [index, record] of (validation.source_list || []).entries()) {
    if (!record || !isSafeRelativePath(record.path)) {
      issue(issues, 'E_PATH_UNSAFE', file, `$.source_list[${index}].path`, 'Handoff source path must be safe and relative.');
      continue;
    }
    const sourcePath = resolve(handoffRoot, record.path);
    if (!isWithin(handoffRoot, sourcePath) || sourcePath === combinedPath) {
      issue(issues, 'E_COMBINED_SELF_REFERENCE', file, `$.source_list[${index}].path`, 'Handoff source points outside the source root or to the combined file.');
      continue;
    }
    try {
      const content = await readFile(sourcePath, 'utf8');
      if (Buffer.byteLength(content) !== record.bytes
        || countLines(content) !== record.lines
        || sha256(content) !== record.sha256) {
        issue(issues, 'E_COMBINED_SOURCE_STALE', file, `$.source_list[${index}]`, 'Combined handoff source record is stale.');
      }
      const marker = `============================================================\nFILE: ${record.path}\n============================================================\n`;
      sections.push(`${marker}${content}${content.endsWith('\n') ? '' : '\n'}`);
    } catch {
      issue(issues, 'E_COMBINED_SOURCE_MISSING', file, `$.source_list[${index}]`, 'Combined handoff source is missing or unreadable.');
    }
  }
  if (sections.length === (validation.source_list || []).length && sections.join('\n') !== combined) {
    issue(issues, 'E_COMBINED_CONTENT_MISMATCH', file, '$.combined_sha256', 'Combined handoff is not an exact source concatenation.');
  }
}

function validateLegacyPrivacyAggregate(aggregate, file, issues) {
  if (!aggregate || typeof aggregate !== 'object') {
    issue(issues, 'E_PRIVACY_AGGREGATE_MISSING', file, '$.baseline.privacy_aggregate', 'Superseding privacy aggregate is missing.');
    return;
  }
  if (aggregate.synthetic_only !== true) {
    issue(issues, 'E_PRIVACY_CLASSIFICATION', file, '$.baseline.privacy_aggregate.synthetic_only', 'Foundation privacy proof must remain explicitly synthetic.');
  }
  if (aggregate.status !== 'pass') {
    issue(issues, 'E_PRIVACY_STATUS', file, '$.baseline.privacy_aggregate.status', 'Superseding privacy aggregate did not pass.');
  }
  if (!sameSet(aggregate.required_classes, LEGACY_PRIVACY_CLASSES)) {
    issue(issues, 'E_PRIVACY_CLASS_MISSING', file, '$.baseline.privacy_aggregate.required_classes', 'Required privacy classes are missing or unexpected.');
  }
  if (aggregate.required_classes_explicit !== true || !aggregate.by_class || typeof aggregate.by_class !== 'object') {
    issue(issues, 'E_PRIVACY_CLASS_MISSING', file, '$.baseline.privacy_aggregate.by_class', 'Required privacy classes must be explicit.');
    return;
  }
  if (!sameSet(Object.keys(aggregate.by_class), LEGACY_PRIVACY_CLASSES)) {
    issue(issues, 'E_PRIVACY_CLASS_MISSING', file, '$.baseline.privacy_aggregate.by_class', 'Privacy class metrics are missing or outside the closed taxonomy.');
  }

  for (const className of LEGACY_PRIVACY_CLASSES) {
    const metric = aggregate.by_class[className];
    const path = `$.baseline.privacy_aggregate.by_class.${className}`;
    if (!metric || typeof metric !== 'object') {
      issue(issues, 'E_PRIVACY_CLASS_MISSING', file, path, 'Required privacy class is omitted.');
      continue;
    }
    if (metric.required !== true || metric.explicitly_evaluated !== true || metric.missing_required_class !== false) {
      issue(issues, 'E_PRIVACY_CLASS_INCOMPLETE', file, path, 'Required privacy class is not explicitly and successfully evaluated.');
    }
    for (const key of ['gold_count', 'detection_count', 'tp', 'fp', 'fn']) {
      if (!Number.isInteger(metric[key]) || metric[key] < 0) {
        issue(issues, 'E_PRIVACY_DENOMINATOR_INVALID', file, `${path}.${key}`, 'Privacy counts must be nonnegative integers.');
      }
    }
    if (!Number.isInteger(metric.gold_count) || metric.gold_count <= 0 || metric.tp + metric.fn <= 0) {
      issue(issues, 'E_PRIVACY_DENOMINATOR_ZERO', file, path, 'Required privacy class has a zero recall denominator.');
    }
    if (metric.tp + metric.fp <= 0) {
      issue(issues, 'E_PRIVACY_PRECISION_DENOMINATOR_ZERO', file, path, 'Required privacy class has a zero precision denominator.');
    }
    for (const key of ['precision', 'recall']) {
      if (typeof metric[key] !== 'number' || !Number.isFinite(metric[key])) {
        issue(issues, 'E_PRIVACY_METRIC_NONFINITE', file, `${path}.${key}`, 'Privacy metric must be a finite number.');
      }
    }
    if (Number.isFinite(metric.recall) && metric.tp + metric.fn > 0
      && Math.abs(metric.recall - (metric.tp / (metric.tp + metric.fn))) > Number.EPSILON * 8) {
      issue(issues, 'E_PRIVACY_METRIC_RATIO', file, `${path}.recall`, 'Privacy recall does not match its denominator.');
    }
    if (Number.isFinite(metric.precision) && metric.tp + metric.fp > 0
      && Math.abs(metric.precision - (metric.tp / (metric.tp + metric.fp))) > Number.EPSILON * 8) {
      issue(issues, 'E_PRIVACY_METRIC_RATIO', file, `${path}.precision`, 'Privacy precision does not match its denominator.');
    }
    if (className === 'patient_identifier' && Number.isFinite(metric.recall) && metric.recall < 0.995) {
      issue(issues, 'E_PATIENT_RECALL_THRESHOLD', file, `${path}.recall`, 'Patient-identifier recall is below 0.995.');
    }
    if (className === 'student_name' && Number.isFinite(metric.recall) && metric.recall < 0.99) {
      issue(issues, 'E_STUDENT_RECALL_THRESHOLD', file, `${path}.recall`, 'Student-name recall is below 0.99.');
    }
  }
}

async function validateFoundationAudit(evidence, roots, issues) {
  const file = 'foundation_audit.json';
  const foundation = evidence[file];
  if (!foundation) return;

  const expectedTests = {
    official_validators: 20,
    official_leak_tests: 6,
    official_negative_cases: 30,
    new_adversarial_cases: 50,
    privacy_contract_tests: 5,
    total_assertions: 111,
  };
  if (canonicalJson(foundation.exact_tests) !== canonicalJson(expectedTests)) {
    issue(issues, 'E_FOUNDATION_TEST_COUNTS', file, '$.exact_tests', 'Foundation audit counts do not match the 1006 contract.');
  }
  if (!isSafeRelativePath(foundation.source)) {
    issue(issues, 'E_PATH_UNSAFE', file, '$.source', 'Foundation audit source must be a safe relative path.');
    return;
  }
  const summaryPath = resolve(roots.worktreeRoot, foundation.source);
  if (!isWithin(roots.worktreeRoot, summaryPath)) {
    issue(issues, 'E_REFERENCE_SCOPE', file, '$.source', 'Foundation audit source is outside the worktree.');
    return;
  }
  const summary = await readJsonFile(summaryPath, file, issues);
  if (!summary) return;
  if (summary.overall_status !== foundation.status
    || summary.classification !== 'SYNTHETIC_NOT_MEDICAL'
    || summary.production_status !== 'BLOCKED') {
    issue(issues, 'E_FOUNDATION_CLASSIFICATION', file, '$.source', 'Foundation audit must remain synthetic and production-blocked.');
  }
  if (canonicalJson(summary.exact_tests) !== canonicalJson(foundation.exact_tests)) {
    issue(issues, 'E_FOUNDATION_SOURCE_MISMATCH', file, '$.exact_tests', 'Foundation evidence disagrees with its source summary.');
  }
  const auditRoot = dirname(dirname(summaryPath));
  const reportRef = Array.isArray(summary.result_files)
    ? summary.result_files.find((entry) => typeof entry === 'string' && entry.endsWith('adversarial_audit_report.json'))
    : null;
  if (!reportRef || !isSafeRelativePath(reportRef)) {
    issue(issues, 'E_PRIVACY_REPORT_MISSING', file, '$.source', 'Foundation audit does not reference the adversarial privacy report.');
    return;
  }
  const reportPath = resolve(auditRoot, reportRef);
  if (!isWithin(auditRoot, reportPath)) {
    issue(issues, 'E_REFERENCE_SCOPE', file, '$.source', 'Privacy report reference is outside the audit root.');
    return;
  }
  const report = await readJsonFile(reportPath, file, issues);
  if (!report) return;
  if (report.overall_status !== 'pass' || report.classification !== 'SYNTHETIC_NOT_MEDICAL') {
    issue(issues, 'E_PRIVACY_REPORT_STATUS', file, '$.source', 'Adversarial privacy report is not a passing synthetic report.');
  }
  validateLegacyPrivacyAggregate(report.baseline?.privacy_aggregate, file, issues);
  const privacyTests = report.privacy_contract_tests?.tests;
  const expectedIds = [
    'PA-001-required-classes-explicit',
    'PA-002-patient-recall-numeric',
    'PA-003-missing-required-class-fails',
    'PA-004-zero-prediction-denominator-explicit',
    'PA-005-empty-corpus-denominators-explicit',
  ];
  if (!Array.isArray(privacyTests)
    || !sameSet(privacyTests.map((entry) => entry.id), expectedIds)
    || privacyTests.some((entry) => entry.status !== 'pass')) {
    issue(issues, 'E_PRIVACY_REGRESSION_PROOF', file, '$.source', 'Required privacy regression contracts are missing or failing.');
  }
}

function validateRealPrivacyMetrics(extraction, inventory, issues) {
  const file = 'extraction_metrics.json';
  if (!extraction) return;
  if (extraction.status === 'BLOCKED_NOT_RUN' || extraction.status === 'INCOMPLETE_NOT_CLEARED') {
    if (extraction.metrics !== null) {
      issue(issues, 'E_BLOCKED_METRICS_PRESENT', file, '$.metrics', 'Blocked or incomplete extraction must not present clearance metrics.');
    }
    if (extraction.status === 'BLOCKED_NOT_RUN' && extraction.real_sources_processed !== 0) {
      issue(issues, 'E_BLOCKED_SOURCE_COUNT', file, '$.real_sources_processed', 'Not-run extraction must report zero processed real sources.');
    }
    return;
  }
  if (extraction.status !== 'PASS_REAL_PILOT') return;
  const metrics = extraction.metrics;
  if (!metrics || typeof metrics !== 'object') {
    issue(issues, 'E_PRIVACY_METRICS_NULL', file, '$.metrics', 'A passing real pilot requires non-null metrics.');
    return;
  }
  if (inventory?.status !== 'REAL_CORPUS_INVENTORIED' || inventory?.classification !== 'REAL_CORPUS') {
    issue(issues, 'E_REAL_PILOT_INVENTORY', file, '$.status', 'A passing real pilot requires a real authorized inventory.');
  }
  if (!sameSet(metrics.required_classes, Object.keys(REAL_PRIVACY_RULES))) {
    issue(issues, 'E_PRIVACY_CLASS_MISSING', file, '$.metrics.required_classes', 'Real privacy pilot omits required classes.');
  }
  if (metrics.source_count !== metrics.sources_evaluated
    || metrics.source_count !== extraction.real_sources_processed) {
    issue(issues, 'E_PRIVACY_SOURCE_DENOMINATOR', file, '$.metrics.source_count', 'Real privacy pilot source denominators are inconsistent.');
  }
  const authorizedSources = inventory?.real_inventory_totals?.authorized_sources;
  if (Number.isInteger(authorizedSources) && metrics.source_count !== authorizedSources) {
    issue(issues, 'E_PRIVACY_SOURCE_COVERAGE', file, '$.metrics.source_count', 'Real privacy pilot does not cover the authorized source denominator.');
  }
  if (metrics.speaker_attribution_accuracy < 0.95) {
    issue(issues, 'E_SPEAKER_ATTRIBUTION_THRESHOLD', file, '$.metrics.speaker_attribution_accuracy', 'Speaker attribution accuracy is below 0.95.');
  }

  for (const [className, rule] of Object.entries(REAL_PRIVACY_RULES)) {
    const metric = metrics.by_class?.[className];
    const path = `$.metrics.by_class.${className}`;
    if (!metric) {
      issue(issues, 'E_PRIVACY_CLASS_MISSING', file, path, 'Real privacy pilot omits a required class.');
      continue;
    }
    if (metric.recall_denominator !== metric.tp + metric.fn
      || metric.precision_denominator !== metric.tp + metric.fp) {
      issue(issues, 'E_PRIVACY_DENOMINATOR_MISMATCH', file, path, 'Privacy denominators do not match TP, FP, and FN.');
    }
    if (metric.recall_denominator <= 0 || metric.precision_denominator <= 0) {
      issue(issues, 'E_PRIVACY_DENOMINATOR_ZERO', file, path, 'Required privacy class has a zero denominator.');
    }
    if (metric.recall_denominator < rule.denominator) {
      issue(issues, 'E_PRIVACY_DENOMINATOR_MINIMUM', file, `${path}.recall_denominator`, 'Privacy denominator is below the governed minimum.');
    }
    if (metric.recall_denominator > 0
      && Math.abs(metric.recall - (metric.tp / metric.recall_denominator)) > 1e-12) {
      issue(issues, 'E_PRIVACY_METRIC_RATIO', file, `${path}.recall`, 'Privacy recall does not match its denominator.');
    }
    if (metric.precision_denominator > 0
      && Math.abs(metric.precision - (metric.tp / metric.precision_denominator)) > 1e-12) {
      issue(issues, 'E_PRIVACY_METRIC_RATIO', file, `${path}.precision`, 'Privacy precision does not match its denominator.');
    }
    if (metric.recall_denominator > 0) {
      const expectedLowerBound = exactBinomialLowerBound(metric.tp, metric.recall_denominator);
      if (!Number.isFinite(expectedLowerBound)
        || Math.abs(metric.recall_lower_bound_95 - expectedLowerBound) > 1e-6) {
        issue(issues, 'E_PRIVACY_LOWER_BOUND_MISMATCH', file, `${path}.recall_lower_bound_95`, 'Reported privacy lower bound is not the exact-binomial value.');
      }
    }
    if (metric.recall < rule.recall) {
      const code = className.startsWith('PATIENT_') || className === 'IDENTIFYING_CLINICAL_ANECDOTE'
        ? 'E_PATIENT_RECALL_THRESHOLD'
        : className === 'STUDENT_NAME'
          ? 'E_STUDENT_RECALL_THRESHOLD'
          : 'E_PRIVACY_RECALL_THRESHOLD';
      issue(issues, code, file, `${path}.recall`, 'Privacy recall is below its governed threshold.');
    }
    if (rule.lowerBound !== null && metric.recall_lower_bound_95 < rule.lowerBound) {
      issue(issues, 'E_PRIVACY_LOWER_BOUND', file, `${path}.recall_lower_bound_95`, 'Privacy recall lower bound is below its governed threshold.');
    }
    if (metric.precision < rule.precision) {
      issue(issues, 'E_PRIVACY_PRECISION_THRESHOLD', file, `${path}.precision`, 'Privacy precision is below its governed threshold.');
    }
    if (rule.zeroTolerance && metric.zero_tolerance_events !== 0) {
      issue(issues, 'E_PRIVACY_ZERO_TOLERANCE', file, `${path}.zero_tolerance_events`, 'Zero-tolerance privacy class records a leak event.');
    }
  }
  const patient = metrics.patient_privacy_aggregate;
  if (patient) {
    if (patient.recall_denominator !== patient.tp + patient.fn
      || patient.precision_denominator !== patient.tp + patient.fp) {
      issue(issues, 'E_PRIVACY_DENOMINATOR_MISMATCH', file, '$.metrics.patient_privacy_aggregate', 'Patient aggregate denominators do not match TP, FP, and FN.');
    }
    if (patient.recall_denominator <= 0 || patient.precision_denominator <= 0) {
      issue(issues, 'E_PRIVACY_DENOMINATOR_ZERO', file, '$.metrics.patient_privacy_aggregate', 'Patient privacy aggregate has a zero denominator.');
    }
    if (patient.recall_denominator > 0
      && Math.abs(patient.recall - (patient.tp / patient.recall_denominator)) > 1e-12) {
      issue(issues, 'E_PRIVACY_METRIC_RATIO', file, '$.metrics.patient_privacy_aggregate.recall', 'Patient aggregate recall does not match its denominator.');
    }
    if (patient.precision_denominator > 0
      && Math.abs(patient.precision - (patient.tp / patient.precision_denominator)) > 1e-12) {
      issue(issues, 'E_PRIVACY_METRIC_RATIO', file, '$.metrics.patient_privacy_aggregate.precision', 'Patient aggregate precision does not match its denominator.');
    }
    if (patient.recall_denominator > 0) {
      const expectedLowerBound = exactBinomialLowerBound(patient.tp, patient.recall_denominator);
      if (!Number.isFinite(expectedLowerBound)
        || Math.abs(patient.recall_lower_bound_95 - expectedLowerBound) > 1e-6) {
        issue(issues, 'E_PRIVACY_LOWER_BOUND_MISMATCH', file, '$.metrics.patient_privacy_aggregate.recall_lower_bound_95', 'Reported patient lower bound is not the exact-binomial value.');
      }
    }
    if (patient.recall < 0.995) {
      issue(issues, 'E_PATIENT_RECALL_THRESHOLD', file, '$.metrics.patient_privacy_aggregate.recall', 'Patient privacy aggregate recall is below 0.995.');
    }
    if (patient.recall_lower_bound_95 < 0.995) {
      issue(issues, 'E_PRIVACY_LOWER_BOUND', file, '$.metrics.patient_privacy_aggregate.recall_lower_bound_95', 'Patient privacy aggregate lower bound is below 0.995.');
    }
  }
}

function validateReleaseManifest(release, issues) {
  const file = 'release_manifest.json';
  if (!release?.manifest) return;
  const manifest = release.manifest;
  const { manifest_hash: manifestHash, ...manifestPayload } = manifest;
  if (sha256(manifestPayload) !== manifestHash) {
    issue(issues, 'E_MANIFEST_HASH', file, '$.manifest.manifest_hash', 'Release manifest hash does not match its canonical payload.');
  }
  if (manifest.previous_manifest_hash === manifest.manifest_hash) {
    issue(issues, 'E_MANIFEST_SELF_REFERENCE', file, '$.manifest.previous_manifest_hash', 'Release manifest hash chain is self-referential.');
  }

  const hashes = manifest.artifact_hashes || [];
  const summaries = release.artifact_summaries || [];
  const expectedChannels = Object.keys(CHANNEL_PHASES);
  if (!sameSet(hashes.map((entry) => entry.channel), expectedChannels)
    || !sameSet(summaries.map((entry) => entry.channel), expectedChannels)) {
    issue(issues, 'E_RELEASE_CHANNEL_SET', file, '$.manifest.artifact_hashes', 'Release manifest must contain every governed channel exactly once.');
  }
  for (const [index, record] of hashes.entries()) {
    if (CHANNEL_PHASES[record.channel] !== record.phase) {
      issue(issues, 'E_RELEASE_CHANNEL_PHASE', file, `$.manifest.artifact_hashes[${index}].phase`, 'Release channel phase does not match its contract.');
    }
    const summary = summaries.find((entry) => entry.channel === record.channel);
    if (!summary
      || summary.phase !== record.phase
      || summary.sha256 !== record.sha256
      || summary.record_count !== record.record_count
      || (record.data_class !== undefined && summary.data_class !== undefined && record.data_class !== summary.data_class)) {
      issue(issues, 'E_RELEASE_SUMMARY_MISMATCH', file, `$.artifact_summaries[${index}]`, 'Artifact summary disagrees with the release manifest.');
    }
  }

  if (release.status === 'CONTRACT_FIXTURE_NOT_RELEASE' && release.classification !== 'SYNTHETIC_NON_CLINICAL') {
    issue(issues, 'E_SYNTHETIC_CLASSIFICATION', file, '$.classification', 'Contract fixture must be explicitly synthetic and non-clinical.');
  }
  if (release.status !== 'CONTRACT_FIXTURE_NOT_RELEASE') {
    if (release.classification !== 'REAL_RELEASE' || !release.release_validation) {
      issue(issues, 'E_RELEASE_PROOF_REQUIRED', file, '$.release_validation', 'A real release claim requires non-synthetic release validation proof.');
    }
  }

  if (manifest.previous_manifest_hash !== null) {
    if (!Array.isArray(release.manifest_history) || release.manifest_history.length === 0) {
      issue(issues, 'E_MANIFEST_CHAIN_MISSING', file, '$.manifest_history', 'Non-root release manifest requires its hash-chain evidence.');
    } else {
      const links = new Map(release.manifest_history.map((entry) => [entry.manifest_hash, entry.previous_manifest_hash]));
      links.set(manifest.manifest_hash, manifest.previous_manifest_hash);
      const seen = new Set();
      let current = manifest.manifest_hash;
      while (current !== null) {
        if (seen.has(current)) {
          issue(issues, 'E_MANIFEST_CHAIN_CYCLE', file, '$.manifest_history', 'Release manifest hash chain contains a cycle.');
          break;
        }
        seen.add(current);
        if (!links.has(current)) {
          issue(issues, 'E_MANIFEST_CHAIN_BROKEN', file, '$.manifest_history', 'Release manifest hash chain is incomplete.');
          break;
        }
        current = links.get(current);
      }
    }
  }

  if (Array.isArray(release.artifacts)) {
    for (const [index, artifact] of release.artifacts.entries()) {
      const path = `$.artifacts[${index}]`;
      if (sha256(artifact.payload) !== artifact.sha256) {
        issue(issues, 'E_EMBEDDED_ARTIFACT_HASH', file, `${path}.sha256`, 'Embedded artifact hash does not match its payload.');
      }
      const count = Array.isArray(artifact.payload) ? artifact.payload.length : 1;
      if (count !== artifact.record_count) {
        issue(issues, 'E_EMBEDDED_ARTIFACT_COUNT', file, `${path}.record_count`, 'Embedded artifact record count does not match its payload.');
      }
      scanKeys(artifact.payload, SOURCE_LEAK_KEYS, (findingPath) => {
        issue(issues, 'E_SOURCE_LEAK', file, `${path}.payload${findingPath.slice(1)}`, 'Artifact contains a forbidden source-content field.');
      });
      if (artifact.phase === 'pre_answer' || ['stat_pre_answer', 'stat_indexes', 'stat_lookup'].includes(artifact.channel)) {
        scanKeys(artifact.payload, ANSWER_LEAK_KEYS, (findingPath) => {
          issue(issues, 'E_ANSWER_LEAK', file, `${path}.payload${findingPath.slice(1)}`, 'Pre-answer artifact contains an answer or explanation field.');
        });
      }
      if (artifact.channel === 'stat_dataset_questions' && Array.isArray(artifact.payload)) {
        artifact.payload.forEach((row, rowIndex) => {
          if (!row || typeof row !== 'object' || !sameStringArray(Object.keys(row), STAT_DATASET_FIELDS)) {
            issue(issues, 'E_STAT_FIELDS_EXACT', file, `${path}.payload[${rowIndex}]`, 'STAT dataset row must contain the exact nine fields in order.');
          }
        });
      }
    }
  }
}

function containsPlaceholder(value) {
  if (typeof value === 'string') return PLACEHOLDER_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (value && typeof value === 'object') return Object.values(value).some(containsPlaceholder);
  return false;
}

function validateRuntimeClaims(evidence, issues) {
  const deployment = evidence['deployment_manifest.json'];
  const migration = evidence['migration_validation.json'];
  const rollback = evidence['rollback_manifest.json'];
  const release = evidence['release_manifest.json'];
  const candidates = evidence['candidate_counts.json'];
  if (!deployment) return;

  const flags = deployment.feature_flags || {};
  const enabledConsumerFlags = RELEASE_FLAG_NAMES.filter((name) => flags[name] === true);
  const proof = deployment.release_proof;
  const consumerProof = deployment.consumer_release_proof;

  if (deployment.status === 'BLOCKED_NOT_DEPLOYED') {
    if ((deployment.deployment_urls || []).length > 0
      || deployment.canonical_route !== null
      || FLAG_NAMES.some((name) => flags[name] === true)
      || (deployment.blockers || []).length === 0) {
      issue(issues, 'E_BLOCKED_DEPLOYMENT_CONTRADICTION', 'deployment_manifest.json', '$', 'Blocked deployment contains enabled runtime state or omits blockers.');
    }
  }

  if (deployment.status === 'STAGING_VALIDATED' || deployment.status === 'INTERNAL_PRODUCTION_LIVE') {
    const environment = deployment.status === 'STAGING_VALIDATED' ? 'staging' : 'production';
    if (!proof || proof.environment !== environment
      || proof.classification !== `${environment.toUpperCase()}_RUNTIME`) {
      issue(issues, 'E_RUNTIME_PROOF_REQUIRED', 'deployment_manifest.json', '$.release_proof', 'Staging or production claim lacks matching runtime proof.');
    }
    if (!proof || containsPlaceholder(proof)) {
      issue(issues, 'E_PLACEHOLDER_RUNTIME_PROOF', 'deployment_manifest.json', '$.release_proof', 'Synthetic or placeholder values cannot authorize runtime state.');
    }
    if (!proof || !(deployment.deployment_urls || []).includes(proof.deployment_url)
      || deployment.canonical_route !== 'canonical_github') {
      issue(issues, 'E_RUNTIME_PROOF_MISMATCH', 'deployment_manifest.json', '$.deployment_urls', 'Runtime proof does not match the deployment manifest.');
    }
  }

  if (INTERNAL_FLAG_NAMES.some((name) => flags[name] === true)
    && deployment.status !== 'INTERNAL_PRODUCTION_LIVE') {
    issue(issues, 'E_INTERNAL_FLAG_PROOF', 'deployment_manifest.json', '$.feature_flags', 'Internal platform and review flags require authenticated production proof.');
  }
  if (flags.internal_review_enabled === true && flags.internal_platform_enabled !== true) {
    issue(issues, 'E_INTERNAL_REVIEW_FLAG_ORDER', 'deployment_manifest.json', '$.feature_flags.internal_review_enabled', 'Internal review cannot be enabled while the internal platform is disabled.');
  }

  if (enabledConsumerFlags.length > 0) {
    if (!consumerProof
      || !sameSet(consumerProof.approved_flags, enabledConsumerFlags)
      || consumerProof.release_manifest_hash !== release?.manifest?.manifest_hash
      || release?.classification !== 'REAL_RELEASE'
      || !release?.release_validation) {
      issue(issues, 'E_FLAG_RELEASE_PROOF', 'deployment_manifest.json', '$.feature_flags', 'Enabled consumer flag lacks exact real release proof.');
    }
    if (!consumerProof || containsPlaceholder(consumerProof)) {
      issue(issues, 'E_PLACEHOLDER_RELEASE_PROOF', 'deployment_manifest.json', '$.consumer_release_proof', 'Synthetic or placeholder proof cannot enable consumer flags.');
    }
  }

  if ((candidates?.physician_approved_revisions || 0) > 0
    || (candidates?.release_eligible_revisions || 0) > 0
    || (candidates?.published_revisions || 0) > 0) {
    if (!release?.physician_approval_proof
      || release.classification !== 'REAL_RELEASE'
      || containsPlaceholder(release.physician_approval_proof)) {
      issue(issues, 'E_PHYSICIAN_APPROVAL_UNSUPPORTED', 'candidate_counts.json', '$.physician_approved_revisions', 'Physician approval claim lacks verifiable non-placeholder evidence.');
    }
  }

  const stagingClaim = deployment.status === 'STAGING_VALIDATED'
    || migration?.status === 'STAGING_PASS'
    || rollback?.status === 'EXECUTED_STAGING'
    || ['pass_staging_runtime', 'pass_staging_browser'].some((status) => Object.values(evidence).some((entry) => entry?.status === status));
  const productionClaim = deployment.status === 'INTERNAL_PRODUCTION_LIVE'
    || migration?.status === 'PRODUCTION_APPLIED'
    || rollback?.status === 'EXECUTED_PRODUCTION'
    || ['pass_production_runtime', 'pass_production_browser'].some((status) => Object.values(evidence).some((entry) => entry?.status === status));
  if (stagingClaim && (deployment.status !== 'STAGING_VALIDATED' || proof?.environment !== 'staging')) {
    issue(issues, 'E_STAGING_CLAIM_UNSUPPORTED', 'deployment_manifest.json', '$.status', 'Staging claim is unsupported by a coherent deployment proof.');
  }
  if (productionClaim && (deployment.status !== 'INTERNAL_PRODUCTION_LIVE' || proof?.environment !== 'production')) {
    issue(issues, 'E_PRODUCTION_CLAIM_UNSUPPORTED', 'deployment_manifest.json', '$.status', 'Production claim is unsupported by a coherent deployment proof.');
  }
  if (proof) {
    if (proof.release_manifest_hash !== release?.manifest?.manifest_hash
      || proof.rollback_sha256 !== rollback?.sha256) {
      issue(issues, 'E_RUNTIME_HASH_MISMATCH', 'deployment_manifest.json', '$.release_proof', 'Runtime proof does not match release or rollback hashes.');
    }
  }
}

function validateCrossFileState(evidence, issues) {
  const deployment = evidence['deployment_manifest.json'];
  const inventory = evidence['inventory_report.json'];
  const extraction = evidence['extraction_metrics.json'];
  const candidates = evidence['candidate_counts.json'];
  const migration = evidence['migration_validation.json'];
  const rollback = evidence['rollback_manifest.json'];
  const release = evidence['release_manifest.json'];

  if (candidates) {
    if (candidates.physician_approved_revisions > candidates.real_candidates
      || candidates.release_eligible_revisions > candidates.physician_approved_revisions
      || candidates.published_revisions > candidates.release_eligible_revisions) {
      issue(issues, 'E_CANDIDATE_COUNT_ORDER', 'candidate_counts.json', '$', 'Candidate approval and publication counts are inconsistent.');
    }
    if (candidates.status === 'NO_REAL_CANDIDATES'
      && [candidates.real_candidates, candidates.physician_approved_revisions, candidates.release_eligible_revisions, candidates.published_revisions].some((value) => value !== 0)) {
      issue(issues, 'E_CANDIDATE_STATUS_CONTRADICTION', 'candidate_counts.json', '$.status', 'No-real-candidates status contains real candidate counts.');
    }
    if (candidates.real_candidates > 0
      && (extraction?.status !== 'PASS_REAL_PILOT' || inventory?.status !== 'REAL_CORPUS_INVENTORIED')) {
      issue(issues, 'E_REAL_CANDIDATE_GATE', 'candidate_counts.json', '$.real_candidates', 'Real candidates require passing inventory and privacy pilot evidence.');
    }
  }

  if (inventory) {
    if (inventory.source_mutations !== 0) {
      issue(issues, 'E_SOURCE_MUTATION', 'inventory_report.json', '$.source_mutations', 'Evidence records a forbidden source mutation.');
    }
    if (inventory.status === 'DISCOVERY_ONLY_REAL_INVENTORY_NOT_AUTHORIZED') {
      if (inventory.real_inventory_totals !== null || inventory.blockers.length === 0) {
        issue(issues, 'E_INVENTORY_STATUS_CONTRADICTION', 'inventory_report.json', '$', 'Discovery-only inventory must retain null real totals and explicit blockers.');
      }
    }
    if (inventory.status === 'REAL_CORPUS_INVENTORIED') {
      if (inventory.classification !== 'REAL_CORPUS'
        || !inventory.real_inventory_totals
        || !HASH_PATTERN.test(inventory.registry_sha256 || '')
        || !HASH_PATTERN.test(inventory.probe_manifest_sha256 || '')) {
        issue(issues, 'E_REAL_INVENTORY_PROOF', 'inventory_report.json', '$', 'Real inventory claim lacks aggregate-only hashes and real classification.');
      }
    }
  }

  if (migration) {
    if (migration.status === 'STATIC_PASS_PREVIEW_NOT_RUN' && migration.production_or_staging_apply_count !== 0) {
      issue(issues, 'E_MIGRATION_STATUS_CONTRADICTION', 'migration_validation.json', '$', 'Static-only migration evidence records an apply count.');
    }
    if (migration.status !== 'STATIC_PASS_PREVIEW_NOT_RUN'
      && (!migration.environment || !migration.applied_commit || !migration.execution_proof_sha256)) {
      issue(issues, 'E_MIGRATION_RUNTIME_PROOF', 'migration_validation.json', '$', 'Applied migration claim lacks runtime proof.');
    }
  }

  if (rollback) {
    if (!sameSet(rollback.disables, FLAG_NAMES) || rollback.drops_data !== false) {
      issue(issues, 'E_ROLLBACK_CONTRACT', 'rollback_manifest.json', '$', 'Rollback must disable every I1Q flag without dropping data.');
    }
    if (rollback.status !== 'DESIGNED_NOT_EXECUTED'
      && (!rollback.environment || !rollback.execution_proof_sha256 || rollback.reapply_status !== 'pass')) {
      issue(issues, 'E_ROLLBACK_RUNTIME_PROOF', 'rollback_manifest.json', '$', 'Executed rollback claim lacks reapply proof.');
    }
  }

  if (release?.status === 'CONTRACT_FIXTURE_NOT_RELEASE'
    && (candidates?.release_eligible_revisions > 0 || candidates?.published_revisions > 0)) {
    issue(issues, 'E_SYNTHETIC_RELEASE_AUTHORIZATION', 'release_manifest.json', '$.status', 'Synthetic contract fixture cannot authorize release or publication.');
  }

  const successLevel = deployment?.success_level;
  const level = ['BELOW_LEVEL_1', 'STATE_A', 'STATE_B', 'STATE_C', 'STATE_D'].indexOf(successLevel);
  if (level >= 1 && inventory?.status !== 'REAL_CORPUS_INVENTORIED') {
    issue(issues, 'E_STATE_A_PROOF', 'deployment_manifest.json', '$.success_level', 'State A or higher requires a real authorized corpus inventory.');
  }
  if (level >= 2 && (extraction?.status !== 'PASS_REAL_PILOT'
    || !(candidates?.real_candidates > 0)
    || candidates.physician_approved_revisions !== 0
    || candidates.release_eligible_revisions !== 0
    || candidates.published_revisions !== 0)) {
    issue(issues, 'E_STATE_B_PROOF', 'deployment_manifest.json', '$.success_level', 'State B requires privacy-safe real candidates that remain unapproved.');
  }
  if (level >= 3 && (deployment.status !== 'INTERNAL_PRODUCTION_LIVE'
    || deployment.feature_flags?.internal_platform_enabled !== true
    || deployment.feature_flags?.internal_review_enabled !== true)) {
    issue(issues, 'E_STATE_C_PROOF', 'deployment_manifest.json', '$.success_level', 'State C requires authenticated internal production proof.');
  }
  if (successLevel === 'STATE_C' && RELEASE_FLAG_NAMES.some((name) => deployment.feature_flags?.[name] === true)) {
    issue(issues, 'E_STATE_C_FLAGS', 'deployment_manifest.json', '$.feature_flags', 'State C requires student and consumer flags to remain off.');
  }
  if (successLevel === 'STATE_D' && (!(candidates?.published_revisions > 0)
    || release?.status !== 'RELEASE_PUBLISHED'
    || !deployment.consumer_release_proof)) {
    issue(issues, 'E_STATE_D_PROOF', 'deployment_manifest.json', '$.success_level', 'State D requires genuine approved publication and consumer proof.');
  }
}

async function validateTestInventory(evidence, roots, issues) {
  const file = 'test_results.json';
  const tests = evidence[file];
  if (!tests?.test_files) return;
  let actual;
  try {
    actual = (await readdir(join(roots.appRoot, 'tests'), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.test.mjs'))
      .map((entry) => `tests/${entry.name}`);
  } catch {
    issue(issues, 'E_TEST_INVENTORY_READ', file, '$.test_files', 'Test inventory could not be read.');
    return;
  }
  if (!sameSet(actual, tests.test_files)) {
    issue(issues, 'E_TEST_EVIDENCE_STALE', file, '$.test_files', 'Test evidence does not cover the current test inventory.');
  }
  if (actual.includes('tests/evidence-validator.test.mjs')
    && !tests.test_files.includes('tests/evidence-validator.test.mjs')) {
    issue(issues, 'E_VALIDATOR_TEST_EVIDENCE', file, '$.test_files', 'Evidence omits the validator regression suite.');
  }
}

function claimedState(evidence) {
  const level = evidence['deployment_manifest.json']?.success_level;
  return level === 'BELOW_LEVEL_1' || !level ? 'BLOCKED' : level;
}

export async function validateEvidenceEstate(options = {}) {
  const appRoot = resolve(options.appRoot || DEFAULT_APP_ROOT);
  const worktreeRoot = resolve(options.worktreeRoot || dirname(appRoot));
  const evidenceDir = resolve(options.evidenceDir || join(appRoot, 'evidence'));
  const roots = { appRoot, worktreeRoot, evidenceDir };
  const issues = [];
  const evidence = {};

  let directoryEntries = [];
  try {
    directoryEntries = await readdir(evidenceDir, { withFileTypes: true });
  } catch {
    issue(issues, 'E_EVIDENCE_DIRECTORY', 'evidence', '$', 'Evidence directory is missing or unreadable.');
  }
  const jsonNames = directoryEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
  for (const name of jsonNames) {
    if (!EXPECTED_EVIDENCE_FILES.includes(name)) {
      issue(issues, 'E_UNEXPECTED_EVIDENCE_FILE', 'evidence', '$', 'Evidence directory contains an unsupported JSON file.');
      await readJsonFile(join(evidenceDir, name), 'evidence', issues);
    }
  }

  for (const file of EXPECTED_EVIDENCE_FILES) {
    const value = await readJsonFile(join(evidenceDir, file), file, issues);
    if (value === null) continue;
    evidence[file] = value;
    validateSchemaValue(value, EVIDENCE_SCHEMAS[file], { issues, file, path: '$' });
    validateStatFieldLists(value, file, issues);
  }

  validateNoSourceLeak(evidence, issues);
  await validateArtifactChecksums(evidence, roots, issues);
  await validatePathHash(evidence['migration_validation.json'], 'migration', 'sha256', 'migration_validation.json', roots, issues);
  await validatePathHash(evidence['rollback_manifest.json'], 'compensating_migration', 'sha256', 'rollback_manifest.json', roots, issues);
  await validateCombinedHandoff(evidence, roots, issues);
  await validateFoundationAudit(evidence, roots, issues);
  validateRealPrivacyMetrics(evidence['extraction_metrics.json'], evidence['inventory_report.json'], issues);
  validateReleaseManifest(evidence['release_manifest.json'], issues);
  validateRuntimeClaims(evidence, issues);
  validateCrossFileState(evidence, issues);
  await validateTestInventory(evidence, roots, issues);

  const parsedFiles = Object.keys(evidence).length;
  const report = {
    validator: 'i1q-evidence-validator',
    schema_version: 1,
    status: issues.length === 0 ? 'pass' : 'fail',
    valid: issues.length === 0,
    claimed_state: claimedState(evidence),
    files: {
      expected: EXPECTED_EVIDENCE_FILES.length,
      present: EXPECTED_EVIDENCE_FILES.filter((file) => jsonNames.includes(file)).length,
      parsed: parsedFiles,
    },
    error_count: issues.length,
    errors: issues,
  };
  return report;
}

export function formatHumanReport(report, maxErrors = 8) {
  const headline = report.valid
    ? `I1Q evidence validation PASS: ${report.files.parsed}/${report.files.expected} files, claimed state ${report.claimed_state}.`
    : `I1Q evidence validation FAIL: ${report.error_count} error(s), claimed state ${report.claimed_state}.`;
  if (report.valid) return headline;
  const lines = [headline];
  for (const entry of report.errors.slice(0, maxErrors)) {
    lines.push(`- ${entry.code} ${entry.file}:${entry.path} ${entry.message}`);
  }
  if (report.errors.length > maxErrors) {
    lines.push(`- ${report.errors.length - maxErrors} additional error(s) omitted from human output.`);
  }
  return lines.join('\n');
}

function parseCliArguments(argv) {
  const options = {};
  let outputMode = 'both';
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json-only') outputMode = 'json';
    else if (argument === '--human-only') outputMode = 'human';
    else if (['--app-root', '--worktree-root', '--evidence-dir'].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error('missing_cli_value');
      const key = argument.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
      options[key] = value;
      index += 1;
    } else {
      throw new Error('unknown_cli_argument');
    }
  }
  return { options, outputMode };
}

async function runCli() {
  let parsed;
  try {
    parsed = parseCliArguments(process.argv.slice(2));
  } catch {
    const report = {
      validator: 'i1q-evidence-validator',
      schema_version: 1,
      status: 'fail',
      valid: false,
      claimed_state: 'UNKNOWN',
      files: { expected: EXPECTED_EVIDENCE_FILES.length, present: 0, parsed: 0 },
      error_count: 1,
      errors: [{ code: 'E_CLI_ARGUMENT', file: 'cli', path: '$', message: 'CLI arguments are invalid.' }],
    };
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.stderr.write(`${formatHumanReport(report)}\n`);
    process.exitCode = 1;
    return;
  }

  const report = await validateEvidenceEstate(parsed.options);
  if (parsed.outputMode !== 'human') process.stdout.write(`${JSON.stringify(report)}\n`);
  if (parsed.outputMode !== 'json') process.stderr.write(`${formatHumanReport(report)}\n`);
  process.exitCode = report.valid ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(MODULE_PATH)) {
  await runCli();
}
