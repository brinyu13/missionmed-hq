import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../../../supabase/migrations/20260811170000_ivprep_3440_admin_canary.sql', import.meta.url);

test('offline IV Prep migration is service-role-only and deny-by-default', { skip: !existsSync(migrationUrl) }, async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /offline-only schema candidate/u);
  for (const table of [
    'ivprep_entitlements',
    'ivprep_cookie_revocations',
    'ivprep_interview_bindings',
    'ivprep_provider_reservations',
    'ivprep_provider_control',
    'ivprep_idempotency',
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'u'));
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, 'u'));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'u'));
    assert.match(sql, new RegExp(`grant select, insert, update on table public\\.${table} to service_role`, 'u'));
  }
  assert.equal(/create\s+policy/iu.test(sql), false);
  assert.equal(/security\s+definer/iu.test(sql), false);
  assert.equal(/auth\.uid|accessToken|raw_cookie/iu.test(sql), false);
  assert.match(sql, /test_number between 1 and 3/u);
  assert.match(sql, /test_number in \(1, 2\) and reserved_seconds between 1 and 45/u);
  assert.match(sql, /test_number = 3 and reserved_seconds between 1 and 59/u);
  assert.match(sql, /foreign key \(interview_id, subject\) references public\.ivprep_interview_bindings\(interview_id, subject\)/u);
  assert.match(sql, /ivprep_provider_reservations_subject_test_unique/u);
  assert.match(sql, /if new\.test_number = 3/u);
  assert.match(sql, /entitlement_is_founder is distinct from true/u);
  assert.match(sql, /select founder, video_enabled, expires_at > now\(\)/u);
  assert.match(sql, /entitlement_video_enabled is distinct from true or entitlement_is_active is distinct from true/u);
  assert.match(sql, /cookie_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/u);
  assert.match(sql, /reservation_nonce text not null unique/u);
  assert.match(sql, /profile text not null check \(profile = 'PROFILE_B_OPENAI_NATIVE_AUDIO'\)/u);
  assert.match(sql, /agent_name text not null check \(agent_name = 'ivprep-3440-profile-b'\)/u);
  assert.match(sql, /create or replace function public\.ivprep_reserve_provider_test/u);
  assert.match(sql, /create or replace function public\.ivprep_bind_provider_dispatch/u);
  assert.match(sql, /create or replace function public\.ivprep_refund_provider_before_job/u);
  assert.match(sql, /create or replace function public\.ivprep_claim_provider_job/u);
  assert.match(sql, /create or replace function public\.ivprep_mark_provider_worker_joined/u);
  assert.match(sql, /create or replace function public\.ivprep_mark_provider_media_ready/u);
  assert.match(sql, /create or replace function public\.ivprep_request_provider_termination/u);
  assert.match(sql, /create or replace function public\.ivprep_observe_provider_termination/u);
  assert.match(sql, /create or replace function public\.ivprep_reconcile_provider_job/u);
  assert.match(sql, /security invoker/gu);
  assert.match(sql, /set search_path = ''/gu);
  assert.match(sql, /control\.paid_tests_enabled\s+and not control\.kill_switch_tripped/u);
  assert.match(sql, /entitlement\.expires_at > pg_catalog\.now\(\)/u);
  assert.match(sql, /p_provider_terminal_status = 'COMPLETED'/u);
  assert.match(sql, /p_cost_evidence = 'VERIFIED'/u);
  assert.match(sql, /ivprep_trip_provider_kill_switch\('provider_reconciliation_unresolved'\)/u);
  assert.match(sql, /ivprep_trip_provider_kill_switch\('provider_reconciliation_cas_failed'\)/u);
  assert.match(sql, /entitlement\.reserved_video_seconds >= target\.reserved_seconds/u);
  assert.match(sql, /cleanup_failure_codes = array\['provider_reconciliation_cas_failed'\]::text\[\]/u);
  assert.match(sql, /provider_reservation_balance_mismatch/u);
  assert.match(sql, /provider_pre_job_refund_cas_failed/u);
  assert.match(sql, /reservation\.state in \('WORKER_CLAIMED', 'WORKER_JOINED', 'MEDIA_READY'\)/u);
  assert.match(sql, /reservation\.state in \('WORKER_CLAIMED', 'WORKER_JOINED', 'MEDIA_READY', 'TERMINATION_REQUESTED'\)/u);
  assert.match(sql, /grant execute on function public\.ivprep_reserve_provider_test\(text, text, text, text, smallint, integer, text, text, text, text\) to service_role/u);
  assert.match(sql, /grant execute on function public\.ivprep_refund_provider_before_job\(text, text, text, boolean\) to service_role/u);
  assert.match(sql, /grant execute on function public\.ivprep_observe_provider_termination\(text, text, text, text\) to service_role/u);
  const failedReconciliationStart = sql.indexOf('set provider_create_attempted = reservation.provider_create_attempted or coalesce(p_provider_create_attempted, false)');
  const failedReconciliationEnd = sql.indexOf("perform public.ivprep_trip_provider_kill_switch('provider_reconciliation_unresolved')", failedReconciliationStart);
  assert.ok(failedReconciliationStart >= 0 && failedReconciliationEnd > failedReconciliationStart);
  const failedReconciliation = sql.slice(failedReconciliationStart, failedReconciliationEnd);
  assert.equal(failedReconciliation.includes('provider_session_hash ='), false);
  assert.match(failedReconciliation, /provider_create_attempted = reservation\.provider_create_attempted or coalesce\(p_provider_create_attempted, false\)/u);
  assert.match(failedReconciliation, /reservation\.provider_session_hash is null/u);
  assert.match(failedReconciliation, /p_provider_create_attempted is distinct from reservation\.provider_create_attempted/u);
  const reconciliationSuccessGuard = sql.indexOf('if reconciliation_ok then');
  const consumedCalculation = sql.indexOf('consumed := least(', reconciliationSuccessGuard);
  const guardedSuccessUpdate = sql.indexOf('update public.ivprep_provider_reservations as reservation', consumedCalculation);
  assert.ok(reconciliationSuccessGuard >= 0);
  assert.ok(reconciliationSuccessGuard < consumedCalculation && consumedCalculation < guardedSuccessUpdate);
  assert.match(sql, /browser_video_decoded_at/u);
  assert.match(sql, /browser_audio_playable_at/u);
  assert.match(sql, /audio_authority = 'avatar-livekit'/u);
});
