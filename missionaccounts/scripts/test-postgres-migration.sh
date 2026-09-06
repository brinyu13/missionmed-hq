#!/usr/bin/env bash
set -euo pipefail

for required in initdb pg_ctl psql; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "MissionAccounts PostgreSQL verification requires: $required" >&2
    exit 1
  fi
done

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
app_dir=$(cd "$script_dir/.." && pwd)
pg_tmp=$(mktemp -d /tmp/mx5301p-pg.XXXXXX)

cleanup_pg() {
  pg_ctl -D "$pg_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  if [[ "$pg_tmp" == /tmp/mx5301p-pg.* ]]; then
    rm -r "$pg_tmp"
  fi
}
trap cleanup_pg EXIT

initdb -D "$pg_tmp/data" --no-locale --encoding=UTF8 --auth=trust >/dev/null
pg_ctl -D "$pg_tmp/data" -o "-F -p 55439 -k $pg_tmp -c listen_addresses=''" -w start >/dev/null

psql -h "$pg_tmp" -p 55439 -d postgres -v ON_ERROR_STOP=1 \
  -c "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create function auth.jwt() returns jsonb language sql stable as 'select jsonb_build_object()';" \
  >/dev/null

psql -h "$pg_tmp" -p 55439 -d postgres -v ON_ERROR_STOP=1 \
  -f "$app_dir/supabase/migrations/20260906062212_missionaccounts_initial_schema.sql" \
  >/dev/null

student_id=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 \
  -c "insert into missionaccounts.student(matrix_user_ref,display_name) values ('wp:4242','Integration Test') returning id")

results=$(psql -h "$pg_tmp" -p 55439 -d postgres -Atq -v ON_ERROR_STOP=1 <<SQL
set role service_role;
select missionaccounts.api_submit_exam_plan('$student_id','s2','2026-10-14','wp:4242','student','pg-integration-0001')->>'duplicate';
select missionaccounts.api_submit_exam_plan('$student_id','s2','2026-10-14','wp:4242','student','pg-integration-0001')->>'duplicate';
reset role;
select count(*) || '|' ||
  (select count(*) from missionaccounts.exam_transition) || '|' ||
  (select count(*) from missionaccounts.audit_event) || '|' ||
  (select count(*) from missionaccounts.notification_outbox)
from missionaccounts.exam_plan;
SQL
)

expected=$'false\ntrue\n1|1|1|1'
if [[ "$results" != "$expected" ]]; then
  echo "MissionAccounts PostgreSQL verification returned unexpected controls:" >&2
  echo "$results" >&2
  exit 1
fi

echo "MissionAccounts PostgreSQL migration and exam-plan transaction: PASS"
