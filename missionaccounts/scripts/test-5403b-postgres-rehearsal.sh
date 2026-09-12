#!/usr/bin/env bash
set -euo pipefail

for required_command in initdb pg_ctl psql; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "MissionAccounts 5403B PostgreSQL rehearsal requires: $required_command" >&2
    exit 1
  fi
done

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
app_dir=$(cd "$script_dir/.." && pwd)
pg_tmp=$(mktemp -d /tmp/mx5403b-revfix-pg.XXXXXX)
pg_port=$((55500 + RANDOM % 300))

cleanup_pg() {
  pg_ctl -D "$pg_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  if [[ "$pg_tmp" == /tmp/mx5403b-revfix-pg.* ]]; then
    rm -r "$pg_tmp"
  fi
}
trap cleanup_pg EXIT

initdb -D "$pg_tmp/data" --no-locale --encoding=UTF8 --auth=trust >/dev/null
pg_ctl -D "$pg_tmp/data" -o "-F -p $pg_port -k $pg_tmp -c listen_addresses=''" -w start >/dev/null

psql -h "$pg_tmp" -p "$pg_port" -d postgres -v ON_ERROR_STOP=1 \
  -c "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create function auth.jwt() returns jsonb language sql stable as 'select jsonb_build_object()';" \
  >/dev/null

for migration in "$app_dir"/supabase/migrations/*.sql; do
  if [[ "$(basename "$migration")" == "20260909105200_promote_antonio_real_student.sql" ]]; then
    continue
  fi
  psql -h "$pg_tmp" -p "$pg_port" -d postgres -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

result=$(psql -h "$pg_tmp" -p "$pg_port" -d postgres -Atq -v ON_ERROR_STOP=1 <<'SQL'
insert into missionaccounts.student(id, matrix_user_ref, display_name, email, identity_state, sponsor_type)
values
  ('00000000-0000-4000-8000-000000005401', null, 'Canonical Student A', 'student-a@example.test', 'verified', 'DIRECT'),
  ('00000000-0000-4000-8000-000000005402', '902', 'Canonical Student B', 'student-b@example.test', 'verified', 'DIRECT');

set role service_role;

-- Case A: the signed canonical UUID succeeds with a NULL legacy ref.
select missionaccounts.api_sync_program_enrollment(
  '00000000-0000-4000-8000-000000005401', 'examprep', 6357, true,
  '00000000-0000-4000-8000-000000005401', clock_timestamp(),
  '00000000-0000-4000-8000-000000005401', 'student', 'revfix-enrollment-null-ref'
)->>'accepted';

reset role;
update missionaccounts.student set matrix_user_ref = '471'
where id = '00000000-0000-4000-8000-000000005401';
set role service_role;

-- Case B: a legacy numeric ref does not replace the canonical UUID subject.
select missionaccounts.api_sync_program_enrollment(
  '00000000-0000-4000-8000-000000005401', 'examprep', 6357, true,
  '00000000-0000-4000-8000-000000005401', clock_timestamp(),
  '00000000-0000-4000-8000-000000005401', 'student', 'revfix-enrollment-numeric-ref'
)->>'accepted';

-- Cases C and D must fail closed with the documented subject error.
do $$
begin
  begin
    perform missionaccounts.api_sync_program_enrollment(
      '00000000-0000-4000-8000-000000005402', 'examprep', 6357, true,
      '00000000-0000-4000-8000-000000005401', clock_timestamp(),
      '00000000-0000-4000-8000-000000005401', 'student', 'revfix-cross-student'
    );
    raise exception 'cross_student_attack_was_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'student_enrollment_subject_mismatch' then raise; end if;
  end;

  begin
    perform missionaccounts.api_sync_program_enrollment(
      '00000000-0000-4000-8000-000000005401', 'examprep', 6357, true,
      '00000000-0000-4000-8000-000000005402', clock_timestamp(),
      '00000000-0000-4000-8000-000000005401', 'student', 'revfix-subject-mismatch'
    );
    raise exception 'source_subject_mismatch_was_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'student_enrollment_subject_mismatch' then raise; end if;
  end;
end;
$$;

reset role;
update missionaccounts.automatic_billing_contract
set rollout_cutoff = clock_timestamp() - interval '72 hours';

insert into missionaccounts.billing_terms(
  version, summary, body_sha256, status, approved_by, approved_at, body_text
) values (
  'revfix-test-v1', 'Disposable test terms',
  encode(extensions.digest(convert_to('Disposable test terms body', 'UTF8'), 'sha256'), 'hex'),
  'approved', 'disposable-founder', clock_timestamp(), 'Disposable test terms body'
);
insert into missionaccounts.stripe_customer_private(student_id, provider, provider_customer_ref)
values
  ('00000000-0000-4000-8000-000000005401', 'stripe', 'cus_disposable_revfix_a'),
  ('00000000-0000-4000-8000-000000005402', 'stripe', 'cus_disposable_revfix_b');
insert into missionaccounts.payment_method_private(
  student_id, provider, provider_customer_ref, provider_pm_ref, brand, last4, status, verified_at
) values
  (
    '00000000-0000-4000-8000-000000005401', 'stripe', 'cus_disposable_revfix_a',
    'pm_disposable_revfix_a', 'visa', '4242', 'on_file', clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000005402', 'stripe', 'cus_disposable_revfix_b',
    'pm_disposable_revfix_b', 'visa', '4444', 'on_file', clock_timestamp()
  );

-- Consent subject binding uses the canonical student UUID, never matrix_user_ref.
update missionaccounts.student set matrix_user_ref = null
where id = '00000000-0000-4000-8000-000000005401';
set role service_role;
select missionaccounts.api_set_billing_consent(
  '00000000-0000-4000-8000-000000005401', 'authorize', 'revfix-test-v1', '127.0.0.1',
  'Grant with NULL legacy ref', '00000000-0000-4000-8000-000000005401',
  'student', 'revfix-consent-grant-null'
)->>'accepted';
select missionaccounts.api_set_billing_consent(
  '00000000-0000-4000-8000-000000005401', 'revoke', null, '127.0.0.1',
  'Revoke with NULL legacy ref', '00000000-0000-4000-8000-000000005401',
  'student', 'revfix-consent-revoke-null'
)->'consent'->>'state';

reset role;
update missionaccounts.student set matrix_user_ref = '471'
where id = '00000000-0000-4000-8000-000000005401';
set role service_role;
select missionaccounts.api_set_billing_consent(
  '00000000-0000-4000-8000-000000005401', 'authorize', 'revfix-test-v1', '127.0.0.1',
  'Grant with numeric legacy ref', '00000000-0000-4000-8000-000000005401',
  'student', 'revfix-consent-grant-numeric'
)->>'accepted';
select missionaccounts.api_set_billing_consent(
  '00000000-0000-4000-8000-000000005401', 'revoke', null, '127.0.0.1',
  'Revoke with numeric legacy ref', '00000000-0000-4000-8000-000000005401',
  'student', 'revfix-consent-revoke-numeric'
)->'consent'->>'state';

do $$
begin
  begin
    perform missionaccounts.api_set_billing_consent(
      '00000000-0000-4000-8000-000000005402', 'authorize', 'revfix-test-v1', '127.0.0.1',
      'Cross-student grant must fail', '00000000-0000-4000-8000-000000005401',
      'student', 'revfix-consent-cross-grant'
    );
    raise exception 'cross_student_consent_grant_was_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'student_consent_subject_mismatch' then raise; end if;
  end;

  begin
    perform missionaccounts.api_set_billing_consent(
      '00000000-0000-4000-8000-000000005402', 'revoke', null, '127.0.0.1',
      'Cross-student revoke must fail', '00000000-0000-4000-8000-000000005401',
      'student', 'revfix-consent-cross-revoke'
    );
    raise exception 'cross_student_consent_revoke_was_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'student_consent_subject_mismatch' then raise; end if;
  end;

  begin
    perform missionaccounts.api_set_billing_consent(
      '00000000-0000-4000-8000-000000005401', 'authorize', 'revfix-test-v1', '127.0.0.1',
      'Forged legacy actor must fail', '471',
      'student', 'revfix-consent-forged-legacy-actor'
    );
    raise exception 'forged_legacy_ref_actor_was_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'student_consent_subject_mismatch' then raise; end if;
  end;
end;
$$;

-- Leave one active canonical consent for the durable-queue rehearsal.
select missionaccounts.api_set_billing_consent(
  '00000000-0000-4000-8000-000000005401', 'authorize', 'revfix-test-v1', '127.0.0.1',
  'Disposable explicit consent', '00000000-0000-4000-8000-000000005401',
  'student', 'revfix-consent-authorize'
)->>'accepted';

reset role;
insert into missionaccounts.engine_run(id, engine_version, source_digest, state, finished_at)
values (
  '10000000-0000-4000-8000-000000005403', 'revfix-rehearsal-v1', repeat('5', 64),
  'succeeded', clock_timestamp()
);
insert into missionaccounts.attendance_day(
  id, engine_run_id, student_id, cycle_key, day, kind, engine_version, source_digest, computed_at
) values
  (
    '20000000-0000-4000-8000-000000005403', '10000000-0000-4000-8000-000000005403',
    '00000000-0000-4000-8000-000000005401', '2026-cycle-3',
    ((select rollout_cutoff from missionaccounts.automatic_billing_contract where singleton) at time zone 'America/New_York')::date + 1,
    'billable', 'revfix-rehearsal-v1', repeat('6', 64),
    (select rollout_cutoff + interval '1 hour' from missionaccounts.automatic_billing_contract where singleton)
  ),
  (
    '20000000-0000-4000-8000-000000005404', '10000000-0000-4000-8000-000000005403',
    '00000000-0000-4000-8000-000000005401', '2026-cycle-3',
    ((select rollout_cutoff from missionaccounts.automatic_billing_contract where singleton) at time zone 'America/New_York')::date - 1,
    'billable', 'revfix-rehearsal-v1', repeat('7', 64),
    (select rollout_cutoff + interval '1 hour' from missionaccounts.automatic_billing_contract where singleton)
  );
insert into missionaccounts.billing_decision(
  student_id, cycle_key, treatment, amount_cents, note, basis, basis_sha256,
  state, decided_by, decided_at, request_id
) values (
  '00000000-0000-4000-8000-000000005401', '2026-cycle-3', 'confirm', 2500,
  'Disposable exact-day approval',
  jsonb_build_object('days', jsonb_build_array(jsonb_build_object(
    'id', '20000000-0000-4000-8000-000000005403', 'kind', 'billable'
  ))),
  repeat('8', 64), 'approved', 'disposable-dr-j', clock_timestamp(), 'revfix-decision'
);

set role service_role;
select missionaccounts.api_refresh_auto_charge_candidates(clock_timestamp())->>'inserted';

-- Case E: signed course access false projects inactive and blocks new eligibility.
select missionaccounts.api_sync_program_enrollment(
  '00000000-0000-4000-8000-000000005401', 'examprep', 6357, false,
  '00000000-0000-4000-8000-000000005401', clock_timestamp(),
  '00000000-0000-4000-8000-000000005401', 'student', 'revfix-enrollment-inactive'
)->'projection'->>'enrolled';
select missionaccounts.api_refresh_auto_charge_candidates(clock_timestamp())->>'inserted';
select missionaccounts.api_set_billing_consent(
  '00000000-0000-4000-8000-000000005401', 'revoke', null, '127.0.0.1',
  'Disposable revocation after eligibility loss', '00000000-0000-4000-8000-000000005401',
  'student', 'revfix-consent-revoke'
)->'consent'->>'state';

reset role;
select
  (select count(*) from missionaccounts.program_enrollment_projection) || '|' ||
  (select count(*) from missionaccounts.auto_charge_dispatch where state = 'pending') || '|' ||
  (select count(*) from missionaccounts.auto_charge_dispatch where attendance_day_id = '20000000-0000-4000-8000-000000005404') || '|' ||
  (select count(*) from missionaccounts.charge) || '|' ||
  (select state from missionaccounts.billing_consent where student_id = '00000000-0000-4000-8000-000000005401' and superseded_by_id is null) || '|' ||
  (select live_dispatch_allowed from missionaccounts.automatic_billing_contract where singleton) || '|' ||
  (select relforcerowsecurity from pg_class where oid = 'missionaccounts.program_enrollment_projection'::regclass) || '|' ||
  (not has_function_privilege('authenticated', 'missionaccounts.api_sync_program_enrollment(uuid,text,bigint,boolean,text,timestamptz,text,text,text)', 'execute')) || '|' ||
  has_function_privilege('service_role', 'missionaccounts.api_sync_program_enrollment(uuid,text,bigint,boolean,text,timestamptz,text,text,text)', 'execute');
SQL
)

expected=$'true\ntrue\ntrue\nrevoked\ntrue\nrevoked\ntrue\n1\nfalse\n0\nrevoked\n1|1|0|0|revoked|false|true|true|true'
if [[ "$result" != "$expected" ]]; then
  echo "MissionAccounts 5403B PostgreSQL rehearsal returned unexpected controls:" >&2
  echo "$result" >&2
  exit 1
fi

echo "MissionAccounts 5403B canonical enrollment/consent subjects, NULL/numeric consent grant/revoke, cross-student denial, inactive-enrollment, durable-queue, RLS, and grant rehearsal: PASS"
