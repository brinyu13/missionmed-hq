import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(
  new URL('../../.github/workflows/i1q-1008a-preview.yml', import.meta.url),
  'utf8',
);
const target = JSON.parse(await readFile(
  new URL('../deployment/preview-target.json', import.meta.url),
  'utf8',
));

test('preview target is phase-safe, synthetic-only, and production-denied', () => {
  assert.equal(target.contract, 'i1q.preview-target.v1');
  assert.ok(['UNASSIGNED', 'AUTHORIZED_PREVIEW'].includes(target.status));
  assert.equal(target.synthetic_data_only, true);
  assert.deepEqual(target.production_project_refs_forbidden.sort(), [
    'fglyvdykwgbuivikqoah',
    'plgndqcplokwiuimwhzh',
  ].sort());
  const authorityFields = [
    'project_ref',
    'database_host',
    'database_name',
    'baseline_backup_id',
    'baseline_backup_created_at',
    'restore_runbook_id',
    'restore_test_id',
    'authorized_operation',
    'candidate_commit',
    'expected_remote_history_sha256',
    'approval_record_path',
    'approved_by',
    'approved_at',
    'approval_record_sha256',
  ];
  assert.deepEqual(Object.keys(target.candidate_artifact_sha256), [
    'base_migration',
    'runtime_migration',
    'compensation',
    'reapply',
    'workflow',
  ]);
  if (target.status === 'UNASSIGNED') {
    for (const field of authorityFields) {
      assert.equal(target[field], null, `${field} must remain unassigned`);
    }
    for (const hash of Object.values(target.candidate_artifact_sha256)) {
      assert.equal(hash, null, 'candidate artifact hashes must remain unassigned');
    }
  } else {
    for (const field of authorityFields) {
      assert.equal(typeof target[field], 'string', `${field} must be assigned`);
      assert.ok(target[field].length > 0, `${field} must be nonempty`);
    }
    for (const hash of Object.values(target.candidate_artifact_sha256)) {
      assert.match(hash, /^[0-9a-f]{64}$/u);
    }
  }
});

test('preview workflow is manual, pinned, and refuses apply without restore evidence', () => {
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /environment: i1q-preview/u);
  assert.match(workflow, /if \(process\.env\.AUTHORIZATION !== 'I1Q-1008A-PREVIEW'\)/u);
  assert.match(workflow, /target\.status !== 'AUTHORIZED_PREVIEW'/u);
  assert.match(workflow, /preview_backup_and_restore_evidence_required/u);
  assert.match(workflow, /preview_authority_hash_mismatch/u);
  assert.match(workflow, /preview_approval_record_mismatch/u);
  assert.match(workflow, /preview_candidate_commit_mismatch/u);
  assert.match(workflow, /preview_candidate_artifact_hash_mismatch/u);
  assert.match(workflow, /preview_remote_history_hash_mismatch/u);
  assert.match(workflow, /preview_target_must_be_synthetic_only/u);
  assert.match(workflow, /production_project_ref_forbidden/u);
  assert.match(workflow, /production_database_host_forbidden/u);
  assert.match(workflow, /migration_timestamp_in_future/u);
  assert.match(workflow, /migration_timestamp_gap_too_small/u);
  assert.match(workflow, /requiredHeaders/u);
  for (const action of [
    'actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5',
    'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    'supabase/setup-cli@46f7f98c7f948ad727d22c1e67fab04c223a0520',
    'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
  ]) {
    assert.ok(workflow.includes(action), `${action} must remain commit-pinned`);
  }
});

test('preview workflow verifies role separation and redacts uploaded evidence', () => {
  assert.match(workflow, /i1q_rls_or_force_rls_missing/u);
  assert.match(workflow, /i1q_direct_table_grant_detected/u);
  assert.match(workflow, /i1q_app_runtime_browser_reachable/u);
  assert.match(workflow, /i1q_app_runtime_not_deny_all/u);
  assert.match(workflow, /i1q_identity_profile_membership_state_mismatch/u);
  assert.match(workflow, /preview_apply_history_invalid/u);
  assert.match(workflow, /preview_compensation_history_invalid/u);
  assert.match(workflow, /preview_reapply_history_invalid/u);
  assert.match(workflow, /preview_apply_collapsed_later_stage/u);
  assert.match(workflow, /preview_compensation_stage_invalid/u);
  assert.match(workflow, /preview_reapply_stage_invalid/u);
  assert.match(workflow, /supabase db diff/u);
  assert.match(workflow, /db-diff-before\.sql/u);
  assert.match(workflow, /db-diff-after\.sql/u);
  assert.match(workflow, /preview_post_action_schema_drift_detected/u);
  assert.match(workflow, /evidence_redaction_gate_failed/u);
  assert.match(workflow, /steps\.redact\.outcome == 'success'/u);
  assert.match(workflow, /artifact-inventory\.json/u);
  assert.match(workflow, /if-no-files-found: error/u);
  assert.match(workflow, /needs: validate-source/u);
  const validateJob = workflow.match(/  validate-source:[\s\S]*?\n  preview:/u)?.[0] ?? '';
  assert.ok(validateJob, 'secret-free validation job must be closed and present');
  assert.doesNotMatch(validateJob, /I1Q_PREVIEW_|SUPABASE_ACCESS_TOKEN|secrets\./u);
  assert.doesNotMatch(workflow, /i1q-schema-before\.sql" \|\| true/u);
});
