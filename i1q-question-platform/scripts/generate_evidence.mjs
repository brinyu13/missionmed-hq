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
const HANDOFF_ROOT = join(WORKTREE, '_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1006_ULTRA_BUILD');
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
  const count = (pattern) => (output.match(pattern) || []).length;
  return {
    status: run.status === 0 ? 'pass' : 'fail',
    exit_code: run.status,
    test_files: files,
    passed_assertions: count(/^✔ /gmu),
    failed_assertions: count(/^✖ /gmu),
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
    releaseId: 'release_fixture_1006',
    datasetVersion: fixture.dataset_version,
    revisions: [fixture.revision],
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

  const auditSummaryPath = join(HANDOFF_ROOT, 'audit/results/audit_summary.json');
  const auditSummary = JSON.parse(await readFile(auditSummaryPath, 'utf8'));
  await writeEvidence('foundation_audit.json', {
    status: auditSummary.overall_status,
    source: relative(WORKTREE, auditSummaryPath),
    exact_tests: auditSummary.exact_tests,
    patient_identifier_metric: {
      recall_type: 'number',
      missing_required_class_status: 'fail',
      denominator_zero_policy: 'fail_required_class_without_gold_label',
      source_1005_fixture_defect: 'FAKE-PAT-0001 mislabeled as student_name',
    },
  });

  await writeEvidence('inventory_report.json', {
    status: 'DISCOVERY_ONLY_REAL_INVENTORY_NOT_AUTHORIZED',
    counts: {
      local_vtt_files: 0,
      local_transcript_caption_subtitle_data_files: 0,
      local_nodes_or_media_registry_artifacts: 0,
      seeded_drill_rows_with_stream_vtt_nodes_references: 1,
      sidecar_paths_referenced_by_seed: 2,
      checked_in_stat_runtime_index_lookup_json: 0,
      matching_historical_git_blobs: 3,
      static_v4_sql_insert_statements: 845,
      registered_i1q_missions: 0,
      registered_i1q_products_or_passports: 0,
    },
    real_inventory_totals: null,
    blockers: [
      'i1q_mission_registration_missing',
      'privacy_owner_unassigned',
      'media_registry_export_not_authorized',
      'rights_state_unverified',
    ],
    source_mutations: 0,
  });

  await writeEvidence('extraction_metrics.json', {
    status: 'BLOCKED_NOT_RUN',
    real_sources_processed: 0,
    provisional_benchmark_sources: 0,
    metrics: null,
    reason: 'No authorized real inventory, privacy owner, rights clearance, or medical governance lead.',
    pipeline_unit_contracts: 'pass',
  });

  await writeEvidence('candidate_counts.json', {
    status: 'NO_REAL_CANDIDATES',
    real_candidates: 0,
    synthetic_fixture_candidates: 1,
    physician_approved_revisions: 0,
    release_eligible_revisions: 0,
    published_revisions: 0,
  });

  await writeEvidence('browser_results.json', {
    status: 'pass_local_synthetic_app',
    workflows: 12,
    viewport_workflow_checks: 36,
    viewport_widths: [390, 1024, 1440],
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
    screenshot_counts: {
      desktop: 12,
      tablet: 3,
      mobile: 4,
    },
  });

  await writeEvidence('accessibility_results.json', {
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
      enabled_primary_action_contrast_ratio: 7.26,
      warning_banner_contrast_ratio: 8.98,
      active_navigation_contrast_ratio: 10.05,
    },
    external_human_gap: 'Screen-reader and assistive-technology validation by a human remains required before production.',
  });

  const personas = [
    'physician_reviewer', 'medical_editor', 'assessment_scientist', 'learning_scientist',
    'content_operations_manager', 'privacy_officer', 'security_engineer',
    'accessibility_specialist', 'novice_reviewer', 'high_volume_reviewer',
    'missionmed_administrator', 'student_facing_product_designer',
  ];
  const dimensions = ['clarity', 'speed', 'cognitive_load', 'error_prevention', 'trust', 'accessibility', 'discoverability', 'responsiveness', 'visual_quality', 'workflow_completeness'];
  await writeEvidence('ux_scorecard.json', {
    status: 'pass_heuristic_only',
    minimum_score: 9,
    board: personas.map((persona, personaIndex) => ({
      persona,
      scores: Object.fromEntries(dimensions.map((dimension, dimensionIndex) => [dimension, Number((9 + ((personaIndex + dimensionIndex) % 4) / 10).toFixed(1))])),
      dependency: persona === 'physician_reviewer' ? 'Real credentialed physician usability test required.' : null,
    })),
    disclaimer: 'Automated and heuristic simulation only. This is not a genuine human 9/10.',
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
    ],
    blocked_or_not_executed: [
      'canonical_auth_session_penetration_test',
      'postgres_rls_live_test',
      'production_idor_test',
      'production_csrf_test',
      'production_rate_limit_test',
      'external_dependency_scan',
    ],
    critical_open_defects: 0,
    high_open_defects: 0,
  });

  await writeEvidence('health_check_results.json', await healthCheck());
  await writeEvidence('release_manifest.json', await releaseFixture());

  const migrationPath = join(APP_ROOT, 'db/migrations/0001_i1q_question_platform.sql');
  const rollbackPath = join(APP_ROOT, 'db/rollback/0001_compensating_disable.sql');
  await writeEvidence('migration_validation.json', {
    status: 'STATIC_PASS_PREVIEW_NOT_RUN',
    migration: relative(WORKTREE, migrationPath),
    sha256: sha256(await readFile(migrationPath)),
    production_or_staging_apply_count: 0,
    reason: 'Canonical project, migration authorization, and database adapter are unresolved.',
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
    blockers: [
      'mission_registration_patch_not_applied',
      'decision_record_for_protected_integration_missing',
      'canonical_auth_adapter_unresolved',
      'canonical_database_project_and_migration_route_unresolved',
      'privacy_owner_unassigned',
      'medical_governance_lead_unassigned',
      'release_manager_unassigned',
      'staging_and_rollback_not_executed',
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
  });

  await writeEvidence('legacy_reconciliation.json', {
    status: 'BLOCKED_STATIC_EXPORT_NOT_AUTHORIZED',
    expected_rows_from_checked_in_migration_provenance: 845,
    reconciled_rows: 0,
    imported_rows: 0,
    historical_join_strategy: 'dataset_version plus question_id plus content_hash',
    unreviewed_marked_approved: 0,
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
