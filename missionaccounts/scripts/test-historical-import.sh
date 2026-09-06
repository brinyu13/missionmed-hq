#!/usr/bin/env bash
set -euo pipefail

for required in initdb pg_ctl psql; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "MissionAccounts historical-import verification requires: $required" >&2
    exit 1
  fi
done

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
app_dir=$(cd "$script_dir/.." && pwd)
pg_tmp=$(mktemp -d /tmp/mx5301p-history-pg.XXXXXX)
import_sql="$pg_tmp/historical-import.private.sql"

cleanup_pg() {
  pg_ctl -D "$pg_tmp/data" -m immediate stop >/dev/null 2>&1 || true
  if [[ "$pg_tmp" == /tmp/mx5301p-history-pg.* ]]; then
    rm -r "$pg_tmp"
  fi
}
trap cleanup_pg EXIT

initdb -D "$pg_tmp/data" --no-locale --encoding=UTF8 --auth=trust >/dev/null
pg_ctl -D "$pg_tmp/data" -o "-F -p 55440 -k $pg_tmp -c listen_addresses=''" -w start >/dev/null

psql -h "$pg_tmp" -p 55440 -d postgres -v ON_ERROR_STOP=1 \
  -c "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; create function auth.jwt() returns jsonb language sql stable as 'select jsonb_build_object()';" \
  >/dev/null

for migration in "$app_dir"/supabase/migrations/*.sql; do
  psql -h "$pg_tmp" -p 55440 -d postgres -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

node "$script_dir/build-historical-import.mjs" --output "$import_sql" >/dev/null

if [[ "$(stat -f '%Lp' "$import_sql")" != "600" ]]; then
  echo "Historical import bundle permissions are not private" >&2
  exit 1
fi

psql -h "$pg_tmp" -p 55440 -d postgres -v ON_ERROR_STOP=1 \
  -f "$import_sql" \
  >/dev/null

results=$(psql -h "$pg_tmp" -p 55440 -d postgres -Atq -v ON_ERROR_STOP=1 <<'SQL'
select 'artifacts|' || count(*) from missionaccounts.source_artifact;
select 'imports|' || count(*) || '|' || min(state) from missionaccounts.import_run;
select 'students|' || count(*) || '|' || count(*) filter (where identity_state = 'needs_review') || '|' || count(*) filter (where email is not null) || '|' || count(*) filter (where matrix_user_ref is not null) from missionaccounts.student;
select 'aliases|' || count(*) from missionaccounts.identity_alias;
select 'identity_clusters|' || count(*) || '|' || count(*) filter (where state = 'open') || '|' || (select count(*) from missionaccounts.identity_cluster_member) from missionaccounts.identity_cluster;
select 'sessions|' || count(*) || '|' || count(*) filter (where state = 'confirmed') from missionaccounts.session;
select 'source_rows|' || count(*) from missionaccounts.attendance_source_row;
select 'events|' || count(*) || '|' || count(*) filter (where interpretation_state = 'needs_review') from missionaccounts.attendance_event;
select 'linked_events|' || count(distinct attendance_event_id) || '|' || count(*) from missionaccounts.attendance_event_source_row;
select 'unlinked_events|' || count(*) from missionaccounts.attendance_event ae where not exists (select 1 from missionaccounts.attendance_event_source_row aesr where aesr.attendance_event_id = ae.id);
select 'days|' || count(*) || '|' || count(*) filter (where same_day_multiple_events) from missionaccounts.attendance_day;
select 'historical_accounts|' || count(*) from missionaccounts.historical_account_source;
select 'cap_candidates|' || count(*) filter (where status = 'candidate') || '|' || count(*) filter (where status = 'verified') from missionaccounts.full_cycle_ceiling;
select 'flags|' || count(*) || '|' || count(*) filter (where enabled) from missionaccounts.feature_flag;
select 'financial_mutations|' || (select count(*) from missionaccounts.billing_decision) || '|' || (select count(*) from missionaccounts.invoice) || '|' || (select count(*) from missionaccounts.charge);
select cycle_key || '|' || count(*) from missionaccounts.attendance_event group by cycle_key order by cycle_key;
select cycle_key || '|' || count(*) from missionaccounts.attendance_day group by cycle_key order by cycle_key;
SQL
)

expected=$'artifacts|6\nimports|1|applied\nstudents|271|60|0|0\naliases|370\nidentity_clusters|27|27|60\nsessions|419|100\nsource_rows|5498\nevents|3941|544\nlinked_events|3937|4378\nunlinked_events|4\ndays|3264|677\nhistorical_accounts|498\ncap_candidates|74|0\nflags|9|0\nfinancial_mutations|0|0|0\n2026-cycle-1|1295\n2026-cycle-2|1390\n2026-cycle-3|1256\n2026-cycle-1|1072\n2026-cycle-2|1141\n2026-cycle-3|1051'
if [[ "$results" != "$expected" ]]; then
  echo "MissionAccounts historical-import verification returned unexpected controls:" >&2
  echo "$results" >&2
  exit 1
fi

echo "MissionAccounts historical import verification PASS"
