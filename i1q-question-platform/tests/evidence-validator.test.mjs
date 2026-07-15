import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_EVIDENCE_FILES,
  STAT_DATASET_FIELDS,
  canonicalJson,
  exactBinomialLowerBound,
  sha256,
  validateEvidenceEstate,
} from '../src/validate-evidence.mjs';

const TEST_ROOT = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(TEST_ROOT, 'fixtures/validator');
const VALIDATOR_PATH = join(TEST_ROOT, '../src/validate-evidence.mjs');

const CHANNEL_PHASES = {
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
};

async function readFixture(name) {
  return JSON.parse(await readFile(join(FIXTURE_ROOT, name), 'utf8'));
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function lineCount(content) {
  return (content.match(/\n/gu) || []).length + (content.endsWith('\n') ? 0 : 1);
}

function uxScores(value) {
  return Object.fromEntries([
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
  ].map((name) => [name, value]));
}

function privacyMetric(tp, fp = 0, fn = 0) {
  const recallDenominator = tp + fn;
  const precisionDenominator = tp + fp;
  return {
    tp,
    fp,
    fn,
    precision_denominator: precisionDenominator,
    recall_denominator: recallDenominator,
    precision: tp / precisionDenominator,
    recall: tp / recallDenominator,
    recall_lower_bound_95: exactBinomialLowerBound(tp, recallDenominator),
    zero_tolerance_events: 0,
  };
}

function passingRealPrivacyMetrics() {
  const byClass = {
    NON_DRJ_SPEECH: privacyMetric(970),
    STUDENT_NAME: privacyMetric(300),
    STUDENT_OTHER_IDENTIFIER: privacyMetric(300),
    PATIENT_DIRECT_IDENTIFIER: privacyMetric(600),
    PATIENT_QUASI_IDENTIFIER: privacyMetric(600),
    THIRD_PARTY_IDENTITY: privacyMetric(300),
    IDENTIFYING_CLINICAL_ANECDOTE: privacyMetric(600),
    SOURCE_METADATA: privacyMetric(300),
  };
  return {
    classification: 'REAL_CORPUS',
    source_count: 97,
    sources_evaluated: 97,
    speaker_attribution_accuracy: 1,
    required_classes: Object.keys(byClass),
    by_class: byClass,
    patient_privacy_aggregate: privacyMetric(1800),
    deterministic_rerun_equal: true,
    forbidden_field_scan_status: 'pass',
    per_source_validation_status: 'pass',
  };
}

function promoteToPassingRealPilot(evidence) {
  Object.assign(evidence['inventory_report.json'], {
    status: 'REAL_CORPUS_INVENTORIED',
    classification: 'REAL_CORPUS',
    registry_sha256: 'a'.repeat(64),
    probe_manifest_sha256: 'b'.repeat(64),
    real_inventory_totals: {
      authorized_sources: 97,
      transcripts_available: 97,
      nodes_available: 97,
      verified_drj_sources: 97,
      extraction_ready_sources: 97,
    },
    blockers: [],
  });
  Object.assign(evidence['extraction_metrics.json'], {
    status: 'PASS_REAL_PILOT',
    real_sources_processed: 97,
    provisional_benchmark_sources: 97,
    metrics: passingRealPrivacyMetrics(),
    reason: null,
  });
}

async function buildEstate(t, hooks = {}) {
  const template = await readFixture('estate-template.json');
  const worktreeRoot = await mkdtemp(join(tmpdir(), 'i1q-validator-'));
  t.after(async () => rm(worktreeRoot, { recursive: true, force: true }));
  const appRoot = join(worktreeRoot, 'i1q-question-platform');
  const evidenceDir = join(appRoot, 'evidence');
  const handoffRoot = join(worktreeRoot, '_AI_HANDOFFS/from_codex/validator-synthetic');
  const auditRoot = join(handoffRoot, 'audit');
  const generatedAt = template.generated_at;

  const supportFiles = new Map([
    ['i1q-question-platform/db/migrations/0001_synthetic.sql', '-- Synthetic aggregate-only migration fixture.\n'],
    ['i1q-question-platform/db/rollback/0001_synthetic_disable.sql', '-- Synthetic aggregate-only rollback fixture.\n'],
    ['i1q-question-platform/openapi.json', '{"openapi":"3.1.0","paths":{"/health":{}}}\n'],
    ['i1q-question-platform/tests/synthetic.test.mjs', '// Synthetic test inventory marker.\n'],
  ]);
  for (const [path, content] of supportFiles) {
    const absolute = join(worktreeRoot, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, 'utf8');
  }
  await mkdir(evidenceDir, { recursive: true });

  const sourceRecords = [];
  const sections = [];
  const handoffSources = Object.entries(template.handoff_sources)
    .sort(([left], [right]) => left.localeCompare(right, 'en'));
  for (const [path, content] of handoffSources) {
    const absolute = join(handoffRoot, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content, 'utf8');
    sourceRecords.push({
      path,
      bytes: Buffer.byteLength(content),
      lines: lineCount(content),
      sha256: sha256(content),
    });
    const marker = `============================================================\nFILE: ${path}\n============================================================\n`;
    sections.push(`${marker}${content}${content.endsWith('\n') ? '' : '\n'}`);
  }
  const combined = sections.join('\n');
  const combinedPath = join(handoffRoot, 'I1Q_SYNTHETIC_COMBINED_HANDOFF.md');
  await writeFile(combinedPath, combined, 'utf8');

  const privacyAggregate = {
    evaluator_id: 'synthetic_superseding_privacy_aggregate_v1',
    status: 'pass',
    synthetic_only: true,
    required_classes: Object.keys(template.privacy_classes),
    required_classes_explicit: true,
    by_class: structuredClone(template.privacy_classes),
    aggregate: {
      tp: 5,
      predicted_count: 5,
      gold_count: 5,
      precision: 1,
      recall: 1,
    },
    errors: [],
  };
  const auditReport = {
    overall_status: 'pass',
    classification: template.classification,
    baseline: { privacy_aggregate: privacyAggregate },
    privacy_contract_tests: {
      count: template.privacy_contract_test_ids.length,
      status: 'pass',
      tests: template.privacy_contract_test_ids.map((id) => ({ id, status: 'pass' })),
    },
  };
  const auditSummary = {
    report_id: 'synthetic_validator_audit_summary',
    mission_id: 'I1Q-SYNTHETIC',
    generated_at: generatedAt,
    overall_status: 'pass',
    classification: template.classification,
    production_status: 'BLOCKED',
    exact_tests: structuredClone(template.foundation_exact_tests),
    result_files: ['results/adversarial_audit_report.json', 'results/audit_summary.json'],
  };

  const artifactHashes = Object.entries(CHANNEL_PHASES).map(([channel, phase]) => ({
    channel,
    phase,
    sha256: sha256([]),
    record_count: 0,
  }));
  const manifestPayload = {
    release_id: 'release_synthetic_validator',
    dataset_version: 'synthetic_v1',
    previous_manifest_hash: null,
    artifact_hashes: artifactHashes,
  };

  const checksumArtifacts = [];
  for (const path of [...supportFiles.keys()].sort((left, right) => left.localeCompare(right, 'en'))) {
    const bytes = await readFile(join(worktreeRoot, path));
    checksumArtifacts.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
  }

  const evidence = {
    'accessibility_results.json': {
      generated_at: generatedAt,
      status: 'pass_automated_and_browser_heuristics',
      standard_target: 'WCAG 2.2 AA',
      results: {
        one_h1: true,
        duplicate_ids: 0,
        unnamed_controls: 0,
        reduced_motion_rule: true,
        visible_focus_rule: true,
        status_not_color_only: true,
        responsive_overflow_failures: 0,
        enabled_primary_action_contrast_ratio: 7,
        warning_banner_contrast_ratio: 7,
        active_navigation_contrast_ratio: 7,
      },
      external_human_gap: 'Synthetic fixture does not authorize runtime clearance.',
    },
    'artifact_checksums.json': {
      generated_at: generatedAt,
      status: 'pass',
      artifact_count: checksumArtifacts.length,
      artifacts: checksumArtifacts,
    },
    'browser_results.json': {
      generated_at: generatedAt,
      status: 'pass_local_synthetic_app',
      workflows: 1,
      viewport_workflow_checks: 1,
      viewport_widths: [800],
      page_level_horizontal_overflow_failures: 0,
      console_warning_or_error_count: 0,
      keyboard_checks: {
        enter_navigation: 'pass',
        space_navigation: 'pass',
        explicit_keydown_handler: 'pass',
      },
      state_checks: {
        autosave_unsaved_then_saved: 'pass',
        physician_approve_disabled: 'pass',
        release_assemble_disabled: 'pass',
      },
      screenshot_counts: { desktop: 0, tablet: 0, mobile: 0 },
    },
    'candidate_counts.json': {
      generated_at: generatedAt,
      status: 'NO_REAL_CANDIDATES',
      real_candidates: 0,
      synthetic_fixture_candidates: 1,
      physician_approved_revisions: 0,
      release_eligible_revisions: 0,
      published_revisions: 0,
    },
    'combined_handoff_validation.json': {
      generated_at: generatedAt,
      status: 'pass',
      combined_path: relative(worktreeRoot, combinedPath),
      source_count: sourceRecords.length,
      source_list: sourceRecords,
      final_line_count: (combined.match(/\n/gu) || []).length,
      combined_bytes: Buffer.byteLength(combined),
      combined_sha256: sha256(combined),
      markers_found: sourceRecords.length,
      missing_sources: [],
      duplicate_sources: [],
      unexpected_sources: [],
      exact_content_mismatches: [],
      self_embedding: false,
    },
    'deployment_manifest.json': {
      generated_at: generatedAt,
      status: 'BLOCKED_NOT_DEPLOYED',
      success_level: 'BELOW_LEVEL_1',
      deployment_urls: [],
      canonical_route: null,
      feature_flags: {
        internal_platform_enabled: false,
        internal_review_enabled: false,
        student_content_enabled: false,
        student_release_enabled: false,
        stat_adapter_enabled: false,
        drills_adapter_enabled: false,
      },
      blockers: ['synthetic_fixture_not_runtime_proof'],
    },
    'drive_discovery.json': {
      generated_at: generatedAt,
      status: 'NO_RELEVANT_I1Q_RECORD_FOUND',
      read_only_queries: [{ query: 'synthetic aggregate fixture', relevant_results: 0 }],
      files_opened: 0,
      files_modified: 0,
    },
    'extraction_metrics.json': {
      generated_at: generatedAt,
      status: 'BLOCKED_NOT_RUN',
      real_sources_processed: 0,
      provisional_benchmark_sources: 0,
      metrics: null,
      reason: 'No real source was used.',
      pipeline_unit_contracts: 'pass',
    },
    'foundation_audit.json': {
      generated_at: generatedAt,
      status: 'pass',
      source: relative(worktreeRoot, join(auditRoot, 'results/audit_summary.json')),
      exact_tests: structuredClone(template.foundation_exact_tests),
      patient_identifier_metric: {
        recall_type: 'number',
        missing_required_class_status: 'fail',
        denominator_zero_policy: 'fail_required_class_without_gold_label',
        source_1005_fixture_defect: 'historical synthetic class-label regression',
      },
    },
    'health_check_results.json': {
      generated_at: generatedAt,
      status: 'pass',
      http_status: 200,
      payload: {
        ok: true,
        service: 'i1q-question-platform',
        version: 'synthetic-validator-v1',
        mode: 'LOCAL_SYNTHETIC_DEMO',
      },
      security_headers: {
        content_security_policy: "default-src 'self'; frame-ancestors 'none'",
        x_content_type_options: 'nosniff',
        x_frame_options: 'DENY',
      },
    },
    'inventory_report.json': {
      generated_at: generatedAt,
      status: 'DISCOVERY_ONLY_REAL_INVENTORY_NOT_AUTHORIZED',
      counts: {
        local_vtt_files: 0,
        local_transcript_caption_subtitle_data_files: 0,
        local_nodes_or_media_registry_artifacts: 0,
        seeded_drill_rows_with_stream_vtt_nodes_references: 0,
        sidecar_paths_referenced_by_seed: 0,
        checked_in_stat_runtime_index_lookup_json: 0,
        matching_historical_git_blobs: 0,
        static_v4_sql_insert_statements: 0,
        registered_i1q_missions: 0,
        registered_i1q_products_or_passports: 0,
      },
      real_inventory_totals: null,
      blockers: ['synthetic_fixture_only'],
      source_mutations: 0,
    },
    'legacy_reconciliation.json': {
      generated_at: generatedAt,
      status: 'BLOCKED_STATIC_EXPORT_NOT_AUTHORIZED',
      expected_rows_from_checked_in_migration_provenance: 0,
      reconciled_rows: 0,
      imported_rows: 0,
      historical_join_strategy: 'dataset_version plus question_id plus content_hash',
      unreviewed_marked_approved: 0,
    },
    'load_results.json': {
      generated_at: generatedAt,
      status: 'pass',
      workload: 'Synthetic aggregate-only bounded operation.',
      elapsed_ms: 1,
      page_rows: 1,
      total_rows: 1,
      scope: 'Local synthetic fixture only; not runtime proof.',
    },
    'migration_validation.json': {
      generated_at: generatedAt,
      status: 'STATIC_PASS_PREVIEW_NOT_RUN',
      migration: 'i1q-question-platform/db/migrations/0001_synthetic.sql',
      sha256: checksumArtifacts.find((entry) => entry.path.includes('/db/migrations/')).sha256,
      production_or_staging_apply_count: 0,
      reason: 'Synthetic static validation only.',
    },
    'openapi_validation.json': {
      generated_at: generatedAt,
      status: 'pass_json_and_contract_shape',
      openapi: '3.1.0',
      path_count: 1,
      security_scheme: ['SyntheticInternalSession'],
      production_identity_url_status: 'OPEN',
    },
    'release_manifest.json': {
      generated_at: generatedAt,
      status: 'CONTRACT_FIXTURE_NOT_RELEASE',
      classification: 'SYNTHETIC_NON_CLINICAL',
      manifest: {
        ...manifestPayload,
        manifest_hash: sha256(manifestPayload),
      },
      artifact_summaries: structuredClone(artifactHashes),
    },
    'rollback_manifest.json': {
      generated_at: generatedAt,
      status: 'DESIGNED_NOT_EXECUTED',
      compensating_migration: 'i1q-question-platform/db/rollback/0001_synthetic_disable.sql',
      sha256: checksumArtifacts.find((entry) => entry.path.includes('/db/rollback/')).sha256,
      disables: [
        'internal_platform_enabled',
        'internal_review_enabled',
        'student_content_enabled',
        'student_release_enabled',
        'stat_adapter_enabled',
        'drills_adapter_enabled',
      ],
      drops_data: false,
    },
    'security_results.json': {
      generated_at: generatedAt,
      status: 'pass_local_candidate_with_production_blockers',
      passed: ['student_release_flag_defaults_off'],
      blocked_or_not_executed: ['runtime_validation'],
      critical_open_defects: 0,
      high_open_defects: 0,
    },
    'test_results.json': {
      generated_at: generatedAt,
      status: 'pass',
      exit_code: 0,
      test_files: ['tests/synthetic.test.mjs'],
      passed_assertions: 1,
      failed_assertions: 0,
      output_sha256: sha256('synthetic test output'),
    },
    'ux_scorecard.json': {
      generated_at: generatedAt,
      status: 'pass_heuristic_only',
      minimum_score: 9,
      board: [{ persona: 'synthetic_reviewer', scores: uxScores(9), dependency: null }],
      disclaimer: 'Synthetic heuristic only; no human or runtime claim.',
    },
  };

  const context = {
    worktreeRoot,
    appRoot,
    evidenceDir,
    handoffRoot,
    combinedPath,
    evidence,
    auditReport,
    auditSummary,
    privacyAggregate,
  };
  if (hooks.mutate) await hooks.mutate(context);

  await writeJson(join(auditRoot, 'results/adversarial_audit_report.json'), auditReport);
  await writeJson(join(auditRoot, 'results/audit_summary.json'), auditSummary);
  for (const file of EXPECTED_EVIDENCE_FILES) {
    assert.ok(evidence[file], `fixture builder must define ${file}`);
    await writeJson(join(evidenceDir, file), evidence[file]);
  }
  if (hooks.afterWrite) await hooks.afterWrite(context);
  return context;
}

function errorCodes(report) {
  return new Set(report.errors.map((entry) => entry.code));
}

async function validate(context) {
  return validateEvidenceEstate({
    appRoot: context.appRoot,
    worktreeRoot: context.worktreeRoot,
    evidenceDir: context.evidenceDir,
  });
}

test('accepts a complete truthful blocked synthetic estate deterministically', async (t) => {
  const context = await buildEstate(t);
  const first = await validate(context);
  const second = await validate(context);
  assert.equal(first.valid, true, JSON.stringify(first.errors, null, 2));
  assert.equal(first.claimed_state, 'BLOCKED');
  assert.equal(first.files.parsed, EXPECTED_EVIDENCE_FILES.length);
  assert.deepEqual(second, first);
});

test('rejects a missing expected evidence file', async (t) => {
  const context = await buildEstate(t, {
    afterWrite: ({ evidenceDir }) => unlink(join(evidenceDir, 'security_results.json')),
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_EVIDENCE_MISSING'));
});

test('rejects malformed evidence JSON', async (t) => {
  const context = await buildEstate(t, {
    afterWrite: ({ evidenceDir }) => writeFile(join(evidenceDir, 'load_results.json'), '{', 'utf8'),
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_JSON_PARSE'));
});

test('rejects duplicate JSON object keys', async (t) => {
  const context = await buildEstate(t, {
    afterWrite: async ({ evidenceDir }) => {
      const path = join(evidenceDir, 'load_results.json');
      const content = await readFile(path, 'utf8');
      await writeFile(path, content.replace(
        '"status": "pass",',
        '"status": "pass",\n  "status": "pass",',
      ), 'utf8');
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_JSON_DUPLICATE_KEY'));
});

test('rejects a stale checksummed artifact', async (t) => {
  const context = await buildEstate(t, {
    afterWrite: ({ appRoot }) => writeFile(
      join(appRoot, 'db/migrations/0001_synthetic.sql'),
      '-- Synthetic aggregate changed after checksum.\n',
      'utf8',
    ),
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_ARTIFACT_STALE'));
});

test('rejects the historical missing patient_identifier privacy class regression', async (t) => {
  const fixture = await readFixture('missing-patient-identifier.json');
  const context = await buildEstate(t, {
    mutate: ({ privacyAggregate }) => {
      privacyAggregate.required_classes = privacyAggregate.required_classes.filter((name) => name !== fixture.class);
      delete privacyAggregate.by_class[fixture.class];
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has(fixture.expected_code));
});

test('rejects a zero-denominator required privacy class', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ privacyAggregate }) => {
      Object.assign(privacyAggregate.by_class.patient_identifier, {
        gold_count: 0,
        detection_count: 0,
        tp: 0,
        fp: 0,
        fn: 0,
        precision: 0,
        recall: 0,
      });
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_PRIVACY_DENOMINATOR_ZERO'));
});

test('rejects null privacy metrics when a run claims pass', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ privacyAggregate }) => {
      privacyAggregate.by_class.patient_identifier.recall = null;
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_PRIVACY_METRIC_NONFINITE'));
});

test('rejects patient recall below 0.995', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ privacyAggregate }) => {
      Object.assign(privacyAggregate.by_class.patient_identifier, {
        gold_count: 1000,
        detection_count: 994,
        tp: 994,
        fp: 0,
        fn: 6,
        precision: 1,
        recall: 0.994,
      });
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_PATIENT_RECALL_THRESHOLD'));
});

test('rejects student-name recall below 0.99', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ privacyAggregate }) => {
      Object.assign(privacyAggregate.by_class.student_name, {
        gold_count: 1000,
        detection_count: 989,
        tp: 989,
        fp: 0,
        fn: 11,
        precision: 1,
        recall: 0.989,
      });
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_STUDENT_RECALL_THRESHOLD'));
});

test('accepts complete aggregate-only real privacy metrics without raising claimed state', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => promoteToPassingRealPilot(evidence),
  });
  const report = await validate(context);
  assert.equal(report.valid, true, JSON.stringify(report.errors, null, 2));
  assert.equal(report.claimed_state, 'BLOCKED');
});

test('rejects a fabricated exact-binomial privacy lower bound', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      promoteToPassingRealPilot(evidence);
      evidence['extraction_metrics.json'].metrics.by_class.PATIENT_DIRECT_IDENTIFIER.recall_lower_bound_95 = 1;
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_PRIVACY_LOWER_BOUND_MISMATCH'));
});

test('rejects answer leakage in a pre-answer artifact', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      const payload = [{ question_id: 'synthetic_q1', answer: 'A' }];
      evidence['release_manifest.json'].artifacts = [{
        channel: 'stat_pre_answer',
        phase: 'pre_answer',
        sha256: sha256(payload),
        record_count: 1,
        payload,
      }];
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_ANSWER_LEAK'));
});

test('rejects source-content leakage in evidence artifacts', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      const payload = [{ source_text: 'non-clinical synthetic source content' }];
      evidence['release_manifest.json'].artifacts = [{
        channel: 'drills',
        phase: 'internal',
        sha256: sha256(payload),
        record_count: 1,
        payload,
      }];
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_SOURCE_LEAK'));
});

for (const flag of ['student_content_enabled', 'student_release_enabled', 'stat_adapter_enabled', 'drills_adapter_enabled']) {
  test(`rejects enabled ${flag} without exact release proof`, async (t) => {
    const context = await buildEstate(t, {
      mutate: ({ evidence }) => {
        evidence['deployment_manifest.json'].feature_flags[flag] = true;
      },
    });
    const report = await validate(context);
    assert.ok(errorCodes(report).has('E_FLAG_RELEASE_PROOF'));
  });
}

test('rejects internal review without internal platform proof', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      evidence['deployment_manifest.json'].feature_flags.internal_review_enabled = true;
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_INTERNAL_FLAG_PROOF'));
  assert.ok(errorCodes(report).has('E_INTERNAL_REVIEW_FLAG_ORDER'));
});

test('rejects an unsupported production claim', async (t) => {
  const fixture = await readFixture('false-production-claim.json');
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      Object.assign(evidence[fixture.target], fixture.replacement);
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has(fixture.expected_code));
});

test('rejects an unsupported staging claim', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      Object.assign(evidence['migration_validation.json'], {
        status: 'STAGING_PASS',
        environment: 'staging',
        applied_commit: 'a'.repeat(40),
        execution_proof_sha256: 'b'.repeat(64),
        rollback_reapply_status: 'pass',
        production_or_staging_apply_count: 1,
        reason: null,
      });
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_STAGING_CLAIM_UNSUPPORTED'));
});

test('rejects invented physician approval counts', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      Object.assign(evidence['candidate_counts.json'], {
        status: 'QUARANTINED_REAL_CANDIDATES',
        real_candidates: 1,
        physician_approved_revisions: 1,
      });
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_PHYSICIAN_APPROVAL_UNSUPPORTED'));
});

test('rejects drift from the exact nine-field STAT list', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      evidence['release_manifest.json'].stat_field_list = [
        ...STAT_DATASET_FIELDS.slice(0, -1),
        'unexpected_field',
      ];
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_STAT_FIELDS_EXACT'));
});

test('rejects a broken release manifest hash', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      evidence['release_manifest.json'].manifest.manifest_hash = '0'.repeat(64);
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_MANIFEST_HASH'));
});

test('rejects a broken release manifest hash chain', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      const release = evidence['release_manifest.json'];
      release.manifest.previous_manifest_hash = '1'.repeat(64);
      const { manifest_hash: ignored, ...payload } = release.manifest;
      release.manifest.manifest_hash = sha256(payload);
      release.manifest_history = [{
        manifest_hash: '2'.repeat(64),
        previous_manifest_hash: null,
      }];
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_MANIFEST_CHAIN_BROKEN'));
});

test('rejects stale combined handoff validation', async (t) => {
  const context = await buildEstate(t, {
    afterWrite: ({ handoffRoot }) => writeFile(
      join(handoffRoot, 'source-a.md'),
      '# Synthetic Source\n\nAggregate changed after validation.\n',
      'utf8',
    ),
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_COMBINED_SOURCE_STALE'));
});

test('rejects self-referential combined handoff validation', async (t) => {
  const context = await buildEstate(t, {
    mutate: ({ evidence }) => {
      evidence['combined_handoff_validation.json'].self_embedding = true;
    },
  });
  const report = await validate(context);
  assert.ok(errorCodes(report).has('E_COMBINED_SELF_REFERENCE'));
});

test('CLI emits machine JSON and a concise human verdict without mutating evidence', async (t) => {
  const context = await buildEstate(t);
  const before = canonicalJson(context.evidence);
  const run = spawnSync(process.execPath, [
    VALIDATOR_PATH,
    '--app-root', context.appRoot,
    '--worktree-root', context.worktreeRoot,
    '--evidence-dir', context.evidenceDir,
  ], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const machine = JSON.parse(run.stdout);
  assert.equal(machine.valid, true);
  assert.match(run.stderr, /I1Q evidence validation PASS/u);
  assert.equal(canonicalJson(context.evidence), before);
});
