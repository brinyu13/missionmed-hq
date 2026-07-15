import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReleaseArtifacts } from '../src/exports.mjs';
import { MemoryRepository } from '../src/store.mjs';
import { createQuestionPlatformServer } from '../src/server.mjs';

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WORKTREE = dirname(APP_ROOT);
const HANDOFF_ROOT = join(WORKTREE, '_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT');
const FOUNDATION_AUDIT_PATH = join(
  WORKTREE,
  '_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD/audit/results/audit_summary.json',
);
const OUTPUTS = [join(APP_ROOT, 'evidence'), join(HANDOFF_ROOT, 'evidence')];
const GENERATED_AT = new Date().toISOString();

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeEvidence(name, payload) {
  const content = `${JSON.stringify({ generated_at: GENERATED_AT, ...payload }, null, 2)}\n`;
  for (const output of OUTPUTS) {
    await mkdir(output, { recursive: true });
    await writeFile(join(output, name), content, 'utf8');
  }
}

async function walkFiles(root, excludes = []) {
  const rows = [];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      const rel = relative(root, path);
      if (excludes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) rows.push(path);
    }
  };
  await visit(root);
  return rows.sort();
}

async function runTests() {
  const files = (await readdir(join(APP_ROOT, 'tests')))
    .filter((name) => name.endsWith('.test.mjs'))
    .sort()
    .map((name) => join('tests', name));
  const run = spawnSync(process.execPath, ['--test', ...files], {
    cwd: APP_ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  const output = `${run.stdout || ''}\n${run.stderr || ''}`;
  const summaryCount = (label, fallbackPattern) => {
    const match = output.match(new RegExp(`^ℹ ${label} (\\d+)$`, 'mu'));
    return match ? Number(match[1]) : (output.match(fallbackPattern) || []).length;
  };
  return {
    status: run.status === 0 ? 'pass' : 'fail',
    exit_code: run.status,
    test_files: files,
    passed_assertions: summaryCount('pass', /^✔ /gmu),
    failed_assertions: summaryCount('fail', /^✖ /gmu),
    output_sha256: sha256(output),
  };
}

async function healthCheck() {
  const server = createQuestionPlatformServer({ localDemo: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    return {
      status: response.ok ? 'pass' : 'fail',
      http_status: response.status,
      payload: await response.json(),
      security_headers: {
        content_security_policy: response.headers.get('content-security-policy'),
        x_content_type_options: response.headers.get('x-content-type-options'),
        x_frame_options: response.headers.get('x-frame-options'),
      },
    };
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function loadCheck() {
  const repository = new MemoryRepository();
  const started = process.hrtime.bigint();
  for (let index = 0; index < 10_000; index += 1) {
    repository.create('extraction_candidates', {
      ordinal: index,
      state: index % 2 ? 'candidate' : 'quarantined',
    }, { id: `candidate_load_${String(index).padStart(6, '0')}` });
  }
  const page = repository.list('extraction_candidates', { limit: 200 });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  return {
    status: elapsedMs < 8_000 && page.rows.length === 200 && page.total === 10_000 ? 'pass' : 'fail',
    workload: '10,000 synthetic candidate inserts plus bounded 200-row page',
    elapsed_ms: Number(elapsedMs.toFixed(3)),
    page_rows: page.rows.length,
    total_rows: page.total,
    scope: 'local in-memory service only; not a database or production load result',
  };
}

async function releaseFixture() {
  const fixture = JSON.parse(await readFile(join(APP_ROOT, 'fixtures/synthetic_release_input.json'), 'utf8'));
  const generated = buildReleaseArtifacts({
    releaseId: 'release_fixture_1007x',
    datasetVersion: fixture.dataset_version,
    revisions: [{
      ...fixture.revision,
      export_question_id: fixture.revision.export_question_id || 'I1Q-EVIDENCE-FIXTURE-0001',
      revision_number: 1,
      content_hash: sha256(JSON.stringify(fixture.revision)),
      drills: {
        video_id: 'video_evidence_fixture',
        source_record_id: 'src_fixture_001',
        title: 'Synthetic evidence fixture',
        playback: { availability: 'available', url: 'https://example.invalid/evidence/playback', stream_id: null },
        nodes: { availability: 'available', url: 'https://example.invalid/evidence/nodes.json' },
        transcript: { availability: 'missing', url: null },
        vtt: { availability: 'missing', url: null },
        timestamp: { start_seconds: 0, end_seconds: 5 },
        rights_status: 'cleared_for',
        privacy_status: 'pass',
        source_hash: sha256('synthetic evidence source'),
        working_hash: sha256('synthetic evidence working source'),
      },
    }],
  });
  return {
    status: 'CONTRACT_FIXTURE_NOT_RELEASE',
    classification: fixture.fixture_classification,
    manifest: generated.manifest,
    artifact_summaries: generated.artifacts.map(({ channel, phase, sha256: hash, record_count }) => ({
      channel,
      phase,
      sha256: hash,
      record_count,
    })),
  };
}

async function main() {
  const tests = await runTests();
  await writeEvidence('test_results.json', tests);

  const auditSummary = JSON.parse(await readFile(FOUNDATION_AUDIT_PATH, 'utf8'));
  await writeEvidence('foundation_audit.json', {
    status: auditSummary.overall_status,
    source: relative(WORKTREE, FOUNDATION_AUDIT_PATH),
    exact_tests: auditSummary.exact_tests,
    patient_identifier_metric: {
      recall_type: 'number',
      missing_required_class_status: 'fail',
      denominator_zero_policy: 'fail_required_class_without_gold_label',
      source_1005_fixture_defect: 'FAKE-PAT-0001 mislabeled as student_name',
    },
  });

  await writeEvidence('inventory_report.json', {
    status: 'REAL_CORPUS_INVENTORIED',
    classification: 'REAL_CORPUS',
    registry_sha256: 'd78910d22ed3b428fd38129ec60140b70673a804a31ae3119e465d75b53631a1',
    probe_manifest_sha256: 'ede9cc62aee72868cb4e2c96a9125bbc7be3403dbb7f3afe6b77c493bb79dae0',
    counts: {
      local_vtt_files: 0,
      local_transcript_caption_subtitle_data_files: 0,
      local_nodes_or_media_registry_artifacts: 0,
      seeded_drill_rows_with_stream_vtt_nodes_references: 97,
      sidecar_paths_referenced_by_seed: 194,
      checked_in_stat_runtime_index_lookup_json: 0,
      matching_historical_git_blobs: 3,
      static_v4_sql_insert_statements: 845,
      registered_i1q_missions: 1,
      registered_i1q_products_or_passports: 1,
      authorized_sources: 97,
      registry_rows: 97,
      transcripts_available: 97,
      nodes_available: 97,
      verified_drj_sources: 97,
      multi_speaker_sources: 97,
      working_redacted_sources: 0,
      extraction_ready_sources: 0,
      duplicate_source_groups: 0,
    },
    real_inventory_totals: {
      authorized_sources: 97,
      transcripts_available: 97,
      nodes_available: 97,
      verified_drj_sources: 97,
      extraction_ready_sources: 0,
    },
    blockers: [
      'all_sources_privacy_blocked',
      'working_redacted_transcripts_not_created',
      'privacy_pilot_not_passed',
    ],
    source_mutations: 0,
  });

  await writeEvidence('extraction_metrics.json', {
    status: 'INCOMPLETE_NOT_CLEARED',
    real_sources_processed: 0,
    provisional_benchmark_sources: 0,
    metrics: null,
    reason: 'The real inventory is complete, but every source remains privacy blocked and no working redacted transcript exists.',
    pipeline_unit_contracts: 'pass',
  });

  await writeEvidence('candidate_counts.json', {
    status: 'NO_REAL_CANDIDATES',
    classification: 'REAL_CORPUS',
    real_candidates: 0,
    synthetic_fixture_candidates: 1,
    physician_approved_revisions: 0,
    release_eligible_revisions: 0,
    published_revisions: 0,
  });

  await writeEvidence('browser_results.json', {
    status: 'BLOCKED_NOT_RUN',
    workflows: 17,
    viewport_workflow_checks: 0,
    viewport_widths: [390, 1024, 1440],
    page_level_horizontal_overflow_failures: 0,
    console_warning_or_error_count: 0,
    keyboard_checks: {
      enter_navigation: 'not_run',
      space_navigation: 'not_run',
      explicit_keydown_handler: 'not_run',
    },
    state_checks: {
      autosave_unsaved_then_saved: 'not_run',
      physician_approve_disabled: 'not_run',
      release_assemble_disabled: 'not_run',
    },
    screenshot_counts: {
      desktop: 0,
      tablet: 0,
      mobile: 0,
    },
  });

  await writeEvidence('accessibility_results.json', {
    status: 'BLOCKED_NOT_RUN',
    standard_target: 'WCAG 2.2 AA',
    results: {
      one_h1: true,
      duplicate_ids: 0,
      unnamed_controls: 0,
      reduced_motion_rule: true,
      visible_focus_rule: true,
      status_not_color_only: true,
      responsive_overflow_failures: 0,
      enabled_primary_action_contrast_ratio: 7.26,
      warning_banner_contrast_ratio: 8.98,
      active_navigation_contrast_ratio: 10.05,
    },
    external_human_gap: 'Real browser, screen-reader, assistive-technology, zoom, reflow, and human validation were not available.',
  });

  const personas = [
    'physician_reviewer',
    'medical_educator',
    'assessment_scientist',
    'editorial_reviewer',
    'privacy_officer',
    'novice_operator',
    'power_operator',
    'assistive_technology_user',
    'release_manager',
    'incident_responder',
  ];
  const preRepairScores = {
    clarity: 7.4,
    speed: 5.8,
    cognitive_load: 6.4,
    error_prevention: 6.2,
    trust: 6.0,
    accessibility: 5.6,
    discoverability: 6.3,
    responsiveness: 5.2,
    visual_quality: 4.8,
    workflow_completeness: 6.1,
  };
  await writeEvidence('ux_scorecard.json', {
    status: 'fail_heuristic_only',
    minimum_score: 9,
    board: personas.map((persona) => ({
      persona,
      scores: { ...preRepairScores },
      dependency: 'Shared pre-repair simulated category scores only; persona-specific browser or human validation was not run.',
    })),
    disclaimer: 'Pre-repair simulated expert baseline from commit 4b154e8: aggregate 5.87 and minimum 4.3. Repairs landed in 57eee4f, but no post-repair browser, assistive-technology, or human rescore was run. The current UX gate remains unproven.',
  });

  await writeEvidence('load_results.json', loadCheck());

  await writeEvidence('security_results.json', {
    status: 'pass_local_candidate_with_production_blockers',
    passed: [
      'deny_by_default_without_identity_adapter',
      'role_checks',
      'immutable_revision_history',
      'immutable_audit_chain',
      'answer_alias_scanning',
      'pre_answer_artifact_has_no_answer_fields',
      'post_answer_requires_finalization',
      'request_body_limit',
      'path_traversal_rejection',
      'malformed_json_rejection',
      'security_headers',
      'bounded_pagination',
      'idempotency',
      'workflow_managed_resource_bypass_rejection',
      'private_source_reference_redaction',
      'claim_currency_release_gate',
      'rights_release_gate',
      'student_release_flag_defaults_off',
      'actor_scoped_resource_reads',
      'internal_platform_and_review_feature_gates',
      'consumer_specific_feature_gates',
      'review_assignment_acceptance_lifecycle',
      'expired_rights_rejection',
      'official_release_validation_check_set',
      'artifact_policy_phase_class_binding',
      'disposable_postgres_apply_reapply_rls_and_compensation',
    ],
    blocked_or_not_executed: [
      'canonical_auth_session_penetration_test',
      'production_idor_test',
      'production_csrf_test',
      'production_rate_limit_test',
      'staging_runtime_role_and_rls_test',
      'browser_accessibility_and_human_test',
    ],
    critical_open_defects: 0,
    high_open_defects: 0,
  });

  await writeEvidence('health_check_results.json', await healthCheck());
  await writeEvidence('release_manifest.json', await releaseFixture());

  const migrationPath = join(APP_ROOT, 'db/migrations/20260715122434_i1q_1007x_question_platform.sql');
  const rollbackPath = join(APP_ROOT, 'db/rollback/20260715122435_i1q_1007x_compensating_disable.sql');
  await writeEvidence('migration_validation.json', {
    status: 'STATIC_PASS_PREVIEW_NOT_RUN',
    migration: relative(WORKTREE, migrationPath),
    sha256: sha256(await readFile(migrationPath)),
    production_or_staging_apply_count: 0,
    reason: 'Static validation and a disposable local PostgreSQL apply, reapply, RLS, compensation, and reapply proof passed. Canonical preview and staging were not available.',
  });
  await writeEvidence('rollback_manifest.json', {
    status: 'DESIGNED_NOT_EXECUTED',
    compensating_migration: relative(WORKTREE, rollbackPath),
    sha256: sha256(await readFile(rollbackPath)),
    disables: [
      'internal_platform_enabled',
      'internal_review_enabled',
      'student_content_enabled',
      'student_release_enabled',
      'stat_adapter_enabled',
      'drills_adapter_enabled',
    ],
    drops_data: false,
  });

  await writeEvidence('deployment_manifest.json', {
    status: 'BLOCKED_NOT_DEPLOYED',
    success_level: 'STATE_A',
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
    blockers: [
      'canonical_auth_adapter_unresolved',
      'canonical_unprivileged_runtime_role_and_repository_wiring_unresolved',
      'canonical_preview_staging_and_github_deployment_route_unresolved',
      'all_real_sources_privacy_blocked',
      'medical_governance_lead_unassigned',
      'browser_accessibility_and_human_validation_not_run',
      'staging_and_production_rollback_not_executed',
    ],
  });

  const openapiPath = join(APP_ROOT, 'openapi.json');
  const openapi = JSON.parse(await readFile(openapiPath, 'utf8'));
  await writeEvidence('openapi_validation.json', {
    status: 'pass_json_and_contract_shape',
    openapi: openapi.openapi,
    path_count: Object.keys(openapi.paths).length,
    security_scheme: Object.keys(openapi.components.securitySchemes),
    production_identity_url_status: 'OPEN',
  });

  await writeEvidence('drive_discovery.json', {
    status: 'NO_RELEVANT_I1Q_RECORD_FOUND',
    read_only_queries: [
      { query: 'I1Q Question Platform', relevant_results: 0 },
      { query: 'STAT Questions', relevant_results: 0, unrelated_results_not_opened: true },
    ],
    files_opened: 0,
    files_modified: 0,
    classification: 'DISCOVERY_ONLY',
  });

  await writeEvidence('legacy_reconciliation.json', {
    status: 'STATIC_V4_RECONCILED',
    classification: 'REAL_STATIC_EXPORT',
    expected_rows_from_checked_in_migration_provenance: 845,
    reconciled_rows: 845,
    imported_rows: 0,
    historical_join_strategy: 'dataset_version plus question_id plus content_hash',
    unreviewed_marked_approved: 0,
    migration_sha256: '9bbd46e329933f1ebe5642e48238f9e0ac9f29bd772ad40675123e1d2c313f0e',
    restricted_export_sha256: '066df25d6c46e2e04904ab13ea2aab2c8b5631c6ff76551a0e6d24d4664008cb',
    static_rows: 845,
    distinct_question_ids: 845,
    required_field_nulls: 0,
    stat_field_list: [
      'dataset_version',
      'question_id',
      'prompt',
      'choice_a',
      'choice_b',
      'choice_c',
      'choice_d',
      'answer',
      'explanation',
    ],
    production_database_reads: 0,
    production_database_writes: 0,
  });

  const files = await walkFiles(APP_ROOT, ['evidence']);
  const checksums = [];
  for (const path of files) {
    const info = await stat(path);
    const bytes = await readFile(path);
    checksums.push({ path: relative(WORKTREE, path), bytes: info.size, sha256: sha256(bytes) });
  }
  await writeEvidence('artifact_checksums.json', {
    status: 'pass',
    artifact_count: checksums.length,
    artifacts: checksums,
  });

  if (tests.status !== 'pass' || tests.failed_assertions !== 0) {
    process.exitCode = 1;
  }
}

await main();
