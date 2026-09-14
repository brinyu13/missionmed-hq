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
    20260909105200_promote_antonio_real_student.sql|20260914111824_dedicated_examprep_onboarding_5404a.sql) continue ;;
  esac
  "${psql_cmd[@]}" -f "$migration" >/dev/null
done

expected_header=$'-- Migration: 20260914111824_dedicated_examprep_onboarding_5404a.sql\n-- Authority: DR-252 / MX-MISSIONACCOUNTS-5404A\n-- Date: 2026-09-14\n-- Depends on: 20260911224524_autobilling_contract_closeout_5403b.sql\n-- Description: Add a private, canonical-student ExamPrep onboarding profile, server-derived completion, and least-privilege self/admin RPCs.\n-- Idempotent: NO'
[[ "$(head -n 6 "$target")" == "$expected_header" ]] || { echo "5404A migration MR-078A header mismatch" >&2; exit 1; }
[[ "$(sed -n '8p' "$target")" == "BEGIN;" && "$(tail -n 1 "$target")" == "COMMIT;" ]] || { echo "5404A transaction wrapper mismatch" >&2; exit 1; }

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

security=$("${psql_cmd[@]}" -Atq <<'SQL'
select
  (select relrowsecurity and relforcerowsecurity from pg_class where oid='missionaccounts.student_onboarding_profile'::regclass) || '|' ||
  (select relrowsecurity and relforcerowsecurity from pg_class where oid='missionaccounts.student_onboarding_submission'::regclass) || '|' ||
  (not has_table_privilege('authenticated','missionaccounts.student_onboarding_profile','select')) || '|' ||
  (not has_table_privilege('authenticated','missionaccounts.student_onboarding_submission','select')) || '|' ||
  (not has_function_privilege('authenticated','missionaccounts.api_get_student_onboarding(uuid,text,text)','execute')) || '|' ||
  (not has_function_privilege('authenticated','missionaccounts.api_save_student_onboarding(uuid,text,text,text,text,text,text,text,text,text,integer,text,text,text)','execute')) || '|' ||
  (not has_function_privilege('authenticated','missionaccounts.api_admin_onboarding_queue(text,text)','execute')) || '|' ||
  has_function_privilege('service_role','missionaccounts.api_get_student_onboarding(uuid,text,text)','execute') || '|' ||
  has_function_privilege('service_role','missionaccounts.api_save_student_onboarding(uuid,text,text,text,text,text,text,text,text,text,integer,text,text,text)','execute') || '|' ||
  has_function_privilege('service_role','missionaccounts.api_admin_onboarding_queue(text,text)','execute');
SQL
)
[[ "$security" == 'true|true|true|true|true|true|true|true|true|true' ]] || { echo "5404A security verification failed: $security" >&2; exit 1; }

results=$("${psql_cmd[@]}" -Atq <<'SQL'
insert into missionaccounts.student(id,matrix_user_ref,display_name,email,phone,identity_state,sponsor_type,sponsor_name,sponsor_updated_at,sponsor_updated_by,sponsor_request_id)
values
  ('00000000-0000-4000-8000-000000005401',null,'Canonical Direct','direct@example.test','+15555550101','verified','DIRECT',null,null,null,null),
  ('00000000-0000-4000-8000-000000005402',null,'Canonical Sponsored','sponsored@example.test','+15555550102','verified','UCC','UCC',clock_timestamp(),'pg-rehearsal','pg-sponsor-5404a-0001');

set role service_role;
select missionaccounts.api_get_student_onboarding(
  '00000000-0000-4000-8000-000000005401','00000000-0000-4000-8000-000000005401','student'
)->>'status';
select missionaccounts.api_save_student_onboarding(
  '00000000-0000-4000-8000-000000005401','Ari','Mission Medical School','email',
  '100 Learning Way','Unit 4','Atlanta','GA','30303','US',0,
  '00000000-0000-4000-8000-000000005401','student','pg-onboard-direct-0001'
)->>'duplicate';
select missionaccounts.api_save_student_onboarding(
  '00000000-0000-4000-8000-000000005401','Ari','Mission Medical School','email',
  '100 Learning Way','Unit 4','Atlanta','GA','30303','US',0,
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
      '100 Learning Way',null,'Atlanta','GA','30303','US',0,
      '00000000-0000-4000-8000-000000005401','student','pg-onboard-stale-0001');
    raise exception 'stale_revision_accepted';
  exception when serialization_failure then
    if sqlerrm <> 'onboarding_revision_conflict' then raise; end if;
  end;
end;
$$;

select jsonb_array_length(missionaccounts.api_admin_onboarding_queue('dr-j','missionaccounts_admin'));
reset role;
select
  (select count(*) from missionaccounts.student_onboarding_profile) || '|' ||
  (select count(*) from missionaccounts.student_onboarding_submission) || '|' ||
  (select count(*) from missionaccounts.notification_outbox) || '|' ||
  (select count(*) from missionaccounts.charge) || '|' ||
  (select count(*) from missionaccounts.stripe_invoice_dispatch);
SQL
)

expected=$'NOT_STARTED\nfalse\ntrue\nIN_PROGRESS\n2\n1|1|0|0|0'
[[ "$results" == "$expected" ]] || { echo "5404A PostgreSQL controls returned unexpected results:" >&2; echo "$results" >&2; exit 1; }

echo "MissionAccounts 5404A PostgreSQL rehearsal passed: atomic migration, replay rejection, forced RLS, service-only RPCs, subject isolation, revision/idempotency, zero notifications, zero charges, zero invoice dispatch."
