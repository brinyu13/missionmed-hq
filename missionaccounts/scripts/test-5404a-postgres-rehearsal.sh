#!/usr/bin/env bash
set -euo pipefail

pg_bin=$(pg_config --bindir)
for required in initdb pg_ctl psql; do
  if [[ ! -x "$pg_bin/$required" ]]; then
    echo "MissionAccounts 5404A PostgreSQL rehearsal requires: $required" >&2
    exit 1
  fi
done

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
app_dir=$(cd "$script_dir/.." && pwd)
pg_tmp=$(mktemp -d /tmp/mx5404a-onboarding-pg.XXXXXX)
pg_port=$((55800 + RANDOM % 300))
target="$app_dir/supabase/migrations/20260914111824_dedicated_examprep_onboarding_5404a.sql"
visibility="$app_dir/supabase/migrations/20260914114700_onboarding_queue_visibility_5404a.sql"

cleanup_pg() {
  "$pg_bin/pg_ctl" -D "$pg_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  [[ "$pg_tmp" == /tmp/mx5404a-onboarding-pg.* ]] && rm -rf "$pg_tmp"
}
trap cleanup_pg EXIT

"$pg_bin/initdb" -D "$pg_tmp/data" --no-locale --encoding=UTF8 --auth=trust >/dev/null
"$pg_bin/pg_ctl" -D "$pg_tmp/data" -o "-F -p $pg_port -k $pg_tmp -c listen_addresses=''" -w start >/dev/null
psql_cmd=("$pg_bin/psql" -h "$pg_tmp" -p "$pg_port" -d postgres -v ON_ERROR_STOP=1)
"${psql_cmd[@]}" -c "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create function auth.jwt() returns jsonb language sql stable as 'select jsonb_build_object()';" >/dev/null

for migration in "$app_dir"/supabase/migrations/*.sql; do
  name=$(basename "$migration")
  case "$name" in
    20260909105200_promote_antonio_real_student.sql|20260914111824_dedicated_examprep_onboarding_5404a.sql|20260914114700_onboarding_queue_visibility_5404a.sql) continue ;;
  esac
  "${psql_cmd[@]}" -f "$migration" >/dev/null
done

expected_header=$'-- Migration: 20260914111824_dedicated_examprep_onboarding_5404a.sql\n-- Authority: DR-252 / MX-MISSIONACCOUNTS-5404A\n-- Date: 2026-09-14\n-- Depends on: 20260911224524_autobilling_contract_closeout_5403b.sql\n-- Description: Add a private, canonical-student ExamPrep onboarding profile, server-derived completion, and least-privilege self/admin RPCs.\n-- Idempotent: NO'
[[ "$(head -n 6 "$target")" == "$expected_header" ]] || { echo "5404A migration MR-078A header mismatch" >&2; exit 1; }
[[ "$(sed -n '8p' "$target")" == "BEGIN;" && "$(tail -n 1 "$target")" == "COMMIT;" ]] || { echo "5404A transaction wrapper mismatch" >&2; exit 1; }

expected_visibility_header=$'-- Migration: 20260914114700_onboarding_queue_visibility_5404a.sql\n-- Authority: DR-254 / MX-MISSIONACCOUNTS-5404A\n-- Date: 2026-09-14\n-- Depends on: 20260914111824_dedicated_examprep_onboarding_5404a.sql\n-- Description: Keep enrolled canonical students visible in the read-only onboarding queue after enrollment freshness expires.\n-- Idempotent: YES'
[[ "$(head -n 6 "$visibility")" == "$expected_visibility_header" ]] || { echo "5404A visibility migration MR-078A header mismatch" >&2; exit 1; }
[[ "$(sed -n '8p' "$visibility")" == "BEGIN;" && "$(tail -n 1 "$visibility")" == "COMMIT;" ]] || { echo "5404A visibility transaction wrapper mismatch" >&2; exit 1; }

forced="$pg_tmp/forced.sql"
awk '
  /create table missionaccounts.student_onboarding_submission/ && !inserted {
    print "select 1 / 0; -- disposable forced mid-migration failure"; inserted=1
  }
  { print }
  END { if (!inserted) exit 42 }
' "$target" > "$forced"
if "${psql_cmd[@]}" -f "$forced" >/dev/null 2>&1; then
  echo "5404A forced-failure migration unexpectedly succeeded" >&2
  exit 1
fi
partial=$("${psql_cmd[@]}" -Atq -c "select count(*) from information_schema.tables where table_schema='missionaccounts' and table_name like 'student_onboarding_%';")
[[ "$partial" == "0" ]] || { echo "5404A forced failure left partial tables" >&2; exit 1; }

"${psql_cmd[@]}" -f "$target" >/dev/null
if "${psql_cmd[@]}" -f "$target" >/dev/null 2>&1; then
  echo "5404A non-idempotent migration unexpectedly replayed" >&2
  exit 1
fi
"${psql_cmd[@]}" -f "$visibility" >/dev/null
"${psql_cmd[@]}" -f "$visibility" >/dev/null

security=$("${psql_cmd[@]}" -Atq <<'SQL'
select
  (select relrowsecurity and relforcerowsecurity from pg_class where oid='missionaccounts.student_onboarding_profile'::regclass) || '|' ||
  (select relrowsecurity and relforcerowsecurity from pg_class where oid='missionaccounts.student_onboarding_submission'::regclass) || '|' ||
  (not has_table_privilege('authenticated','missionaccounts.student_onboarding_profile','select')) || '|' ||
  (not has_table_privilege('authenticated','missionaccounts.student_onboarding_submission','select')) || '|' ||
  (not has_function_privilege('authenticated','missionaccounts.api_get_student_onboarding(uuid,text,text)','execute')) || '|' ||
  (not has_function_privilege('authenticated','missionaccounts.api_save_student_onboarding(uuid,text,text,text,text,text,text,text,text,text,text[],integer,text,text,text)','execute')) || '|' ||
  (not has_function_privilege('authenticated','missionaccounts.api_admin_onboarding_queue(text,text)','execute')) || '|' ||
  has_function_privilege('service_role','missionaccounts.api_get_student_onboarding(uuid,text,text)','execute') || '|' ||
  has_function_privilege('service_role','missionaccounts.api_save_student_onboarding(uuid,text,text,text,text,text,text,text,text,text,text[],integer,text,text,text)','execute') || '|' ||
  has_function_privilege('service_role','missionaccounts.api_admin_onboarding_queue(text,text)','execute');
SQL
)
[[ "$security" == 'true|true|true|true|true|true|true|true|true|true' ]] || { echo "5404A security verification failed: $security" >&2; exit 1; }

results=$("${psql_cmd[@]}" -Atq <<'SQL'
insert into missionaccounts.student(id,matrix_user_ref,display_name,email,phone,identity_state,sponsor_type,sponsor_name,sponsor_updated_at,sponsor_updated_by,sponsor_request_id)
values
  ('00000000-0000-4000-8000-000000005401',null,'Canonical Direct','direct@example.test','+15555550101','verified','DIRECT',null,null,null,null),
  ('00000000-0000-4000-8000-000000005402',null,'Canonical Sponsored','sponsored@example.test','+15555550102','verified','UCC','UCC',clock_timestamp(),'pg-rehearsal','pg-sponsor-5404a-0001');

insert into missionaccounts.program_enrollment_projection(
  student_id,program_key,provider,course_id,enrolled,source_subject,
  source_observed_at,verified_at,valid_until,last_request_id
) values (
  '00000000-0000-4000-8000-000000005401','examprep','learndash',6357,true,
  '00000000-0000-4000-8000-000000005401',clock_timestamp(),clock_timestamp(),
  clock_timestamp() + interval '1 day','pg-enrollment-5404a-0001'
);

set role service_role;
select missionaccounts.api_get_student_onboarding(
  '00000000-0000-4000-8000-000000005401','00000000-0000-4000-8000-000000005401','student'
)->>'status';
select missionaccounts.api_save_student_onboarding(
  '00000000-0000-4000-8000-000000005402',null,'First saved field',null,
  null,null,null,null,null,null,array['school_name'],0,
  '00000000-0000-4000-8000-000000005402','student','pg-onboard-partial-0001'
)->>'duplicate';
select missionaccounts.api_get_student_onboarding(
  '00000000-0000-4000-8000-000000005402','00000000-0000-4000-8000-000000005402','student'
)->'profile'->>'school_name';
select missionaccounts.api_save_student_onboarding(
  '00000000-0000-4000-8000-000000005401','Ari','Mission Medical School','email',
  '100 Learning Way','Unit 4','Atlanta','GA','30303','US',
  array['preferred_name','school_name','best_contact_method','mailing_line1','mailing_line2','mailing_city','mailing_region','mailing_postal_code','mailing_country_code'],0,
  '00000000-0000-4000-8000-000000005401','student','pg-onboard-direct-0001'
)->>'duplicate';
select missionaccounts.api_save_student_onboarding(
  '00000000-0000-4000-8000-000000005401','Ari','Mission Medical School','email',
  '100 Learning Way','Unit 4','Atlanta','GA','30303','US',
  array['preferred_name','school_name','best_contact_method','mailing_line1','mailing_line2','mailing_city','mailing_region','mailing_postal_code','mailing_country_code'],0,
  '00000000-0000-4000-8000-000000005401','student','pg-onboard-direct-0001'
)->>'duplicate';
select missionaccounts.api_get_student_onboarding(
  '00000000-0000-4000-8000-000000005401','00000000-0000-4000-8000-000000005401','student'
)->>'status';

do $$
begin
  begin
    perform missionaccounts.api_get_student_onboarding(
      '00000000-0000-4000-8000-000000005402','00000000-0000-4000-8000-000000005401','student');
    raise exception 'cross_student_read_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'onboarding_student_subject_mismatch' then raise; end if;
  end;
  begin
    perform missionaccounts.api_save_student_onboarding(
      '00000000-0000-4000-8000-000000005401','Ari','Changed School','email',
      '100 Learning Way',null,'Atlanta','GA','30303','US',
      array['preferred_name','school_name','best_contact_method','mailing_line1','mailing_line2','mailing_city','mailing_region','mailing_postal_code','mailing_country_code'],0,
      '00000000-0000-4000-8000-000000005401','student','pg-onboard-stale-0001');
    raise exception 'stale_revision_accepted';
  exception when sqlstate 'PT409' then
    if sqlerrm <> 'onboarding_revision_conflict' then raise; end if;
  end;
  update missionaccounts.student set identity_state = 'needs_review'
  where id = '00000000-0000-4000-8000-000000005402';
  begin
    perform missionaccounts.api_get_student_onboarding(
      '00000000-0000-4000-8000-000000005402','00000000-0000-4000-8000-000000005402','student');
    raise exception 'ambiguous_identity_read_accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'onboarding_canonical_identity_required' then raise; end if;
  end;
  update missionaccounts.student set identity_state = 'verified'
  where id = '00000000-0000-4000-8000-000000005402';
end;
$$;

update missionaccounts.program_enrollment_projection
set source_observed_at = clock_timestamp() - interval '7 hours',
    valid_until = clock_timestamp() - interval '1 hour'
where student_id = '00000000-0000-4000-8000-000000005401';
select jsonb_array_length(missionaccounts.api_admin_onboarding_queue('dr-j','missionaccounts_admin'));
select (missionaccounts.api_admin_onboarding_queue('dr-j','missionaccounts_admin')->0 ? 'last_seen_at');
update missionaccounts.program_enrollment_projection
set enrolled = false
where student_id = '00000000-0000-4000-8000-000000005401';
select jsonb_array_length(missionaccounts.api_admin_onboarding_queue('dr-j','missionaccounts_admin'));
update missionaccounts.program_enrollment_projection
set enrolled = true
where student_id = '00000000-0000-4000-8000-000000005401';
reset role;
select
  (select count(*) from missionaccounts.student_onboarding_profile) || '|' ||
  (select count(*) from missionaccounts.student_onboarding_submission) || '|' ||
  (select count(*) from missionaccounts.notification_outbox) || '|' ||
  (select count(*) from missionaccounts.charge) || '|' ||
  (select count(*) from missionaccounts.stripe_invoice_dispatch);
SQL
)

expected=$'NOT_STARTED\nfalse\nFirst saved field\nfalse\ntrue\nIN_PROGRESS\n1\nt\n0\n2|2|0|0|0'
[[ "$results" == "$expected" ]] || { echo "5404A PostgreSQL controls returned unexpected results:" >&2; echo "$results" >&2; exit 1; }

first_out="$pg_tmp/concurrent-first.out"
second_out="$pg_tmp/concurrent-second.out"
(
  "${psql_cmd[@]}" -Atq >"$first_out" <<'SQL'
set role service_role;
begin;
select missionaccounts.api_save_student_onboarding(
  '00000000-0000-4000-8000-000000005401',null,'Concurrent School',null,
  null,null,null,null,null,null,array['school_name'],1,
  '00000000-0000-4000-8000-000000005401','student','pg-onboard-concurrent-0001'
)->>'duplicate';
select pg_sleep(1);
commit;
SQL
) &
first_pid=$!
sleep 0.2
(
  "${psql_cmd[@]}" -Atq >"$second_out" <<'SQL'
set role service_role;
select missionaccounts.api_save_student_onboarding(
  '00000000-0000-4000-8000-000000005401',null,'Concurrent School',null,
  null,null,null,null,null,null,array['school_name'],1,
  '00000000-0000-4000-8000-000000005401','student','pg-onboard-concurrent-0001'
)->>'duplicate';
SQL
) &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
[[ "$(grep -E '^(true|false)$' "$first_out")" == 'false' ]] || { echo "5404A first concurrent save did not create the mutation" >&2; exit 1; }
[[ "$(grep -E '^(true|false)$' "$second_out")" == 'true' ]] || { echo "5404A identical concurrent retry did not deduplicate" >&2; exit 1; }
concurrency=$("${psql_cmd[@]}" -Atq -c "select revision || '|' || (select count(*) from missionaccounts.student_onboarding_submission where student_id='00000000-0000-4000-8000-000000005401') from missionaccounts.student_onboarding_profile where student_id='00000000-0000-4000-8000-000000005401';")
[[ "$concurrency" == '2|2' ]] || { echo "5404A concurrent save changed profile or submission count unexpectedly: $concurrency" >&2; exit 1; }

echo "MissionAccounts 5404A PostgreSQL rehearsal passed: atomic migration, declared replay behavior, forced RLS, service-only RPCs, subject isolation, partial saves, concurrent idempotency, stale-enrollment queue visibility, billing-freshness isolation, zero notifications, zero charges, zero invoice dispatch."
