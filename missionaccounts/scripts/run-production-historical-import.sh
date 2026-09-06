#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
app_dir=$(cd "$script_dir/.." && pwd)

for required in node psql shasum; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "MissionAccounts production import requires: $required" >&2
    exit 1
  fi
done

: "${MISSIONACCOUNTS_DATABASE_URL:?Set the isolated MissionAccounts production database URL through the approved secret channel}"
: "${MISSIONACCOUNTS_SUPABASE_PROJECT_REF:?Set the exact isolated MissionAccounts Supabase project ref}"
: "${MISSIONACCOUNTS_IMPORT_APPROVAL:?Set MISSIONACCOUNTS_IMPORT_APPROVAL=MX-MISSIONACCOUNTS-5301P-REAL-DATA}"

if [[ "$MISSIONACCOUNTS_IMPORT_APPROVAL" != "MX-MISSIONACCOUNTS-5301P-REAL-DATA" ]]; then
  echo "Historical import approval token is invalid" >&2
  exit 1
fi
if [[ ! "$MISSIONACCOUNTS_SUPABASE_PROJECT_REF" =~ ^[a-z]{20}$ ]]; then
  echo "Supabase project ref must be an exact 20-letter project reference" >&2
  exit 1
fi

database_host=$(node -e "const u=new URL(process.env.MISSIONACCOUNTS_DATABASE_URL); if(u.protocol!=='postgres:'&&u.protocol!=='postgresql:') process.exit(2); process.stdout.write(u.hostname)")
if [[ "$database_host" != *"$MISSIONACCOUNTS_SUPABASE_PROJECT_REF"* ]]; then
  echo "Database hostname does not bind to the approved MissionAccounts Supabase project ref" >&2
  exit 1
fi

import_tmp=$(mktemp -d /tmp/mx5301p-production-import.XXXXXX)
cleanup_import() {
  if [[ "$import_tmp" == /tmp/mx5301p-production-import.* ]]; then
    rm -r "$import_tmp"
  fi
}
trap cleanup_import EXIT
chmod 700 "$import_tmp"
import_sql="$import_tmp/historical-import.private.sql"
import_manifest="$import_tmp/historical-import.manifest.json"

schema_ready=$(psql "$MISSIONACCOUNTS_DATABASE_URL" -Atq -v ON_ERROR_STOP=1 -c "select to_regnamespace('missionaccounts') is not null")
if [[ "$schema_ready" != "t" ]]; then
  echo "MissionAccounts migrations have not been applied to the approved target" >&2
  exit 1
fi

preflight=$(psql "$MISSIONACCOUNTS_DATABASE_URL" -Atq -v ON_ERROR_STOP=1 <<'SQL'
select (select count(*) from missionaccounts.student)
  || '|' || (select count(*) from missionaccounts.session)
  || '|' || (select count(*) from missionaccounts.attendance_source_row)
  || '|' || (select count(*) from missionaccounts.billing_decision)
  || '|' || (select count(*) from missionaccounts.invoice)
  || '|' || (select count(*) from missionaccounts.charge)
  || '|' || (select count(*) from missionaccounts.import_run where state='applied');
SQL
)
if [[ "$preflight" != "0|0|0|0|0|0|0" && "$preflight" != "271|419|5498|0|0|0|1" ]]; then
  echo "Target is not an empty isolated MissionAccounts database or the exact applied historical dataset: $preflight" >&2
  exit 1
fi

node "$script_dir/build-historical-import.mjs" --output "$import_sql" --manifest "$import_manifest" >/dev/null
if [[ "$(stat -f '%Lp' "$import_sql")" != "600" || "$(stat -f '%Lp' "$import_manifest")" != "600" ]]; then
  echo "Private import artifacts do not have mode 600" >&2
  exit 1
fi

expected_sql_sha=$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1])); process.stdout.write(m.output_sql.sha256)" "$import_manifest")
actual_sql_sha=$(shasum -a 256 "$import_sql" | awk '{print $1}')
if [[ "$actual_sql_sha" != "$expected_sql_sha" ]]; then
  echo "Generated import SQL hash does not match its manifest" >&2
  exit 1
fi

psql "$MISSIONACCOUNTS_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$import_sql" >/dev/null
verification=$(psql "$MISSIONACCOUNTS_DATABASE_URL" -Atq -v ON_ERROR_STOP=1 -f "$script_dir/verify-historical-import.sql")
if [[ "$verification" != PASS\|students=271\|sessions=419\|events=3941\|days=3264\|ready=320\|identity_hold=107\|cap_hold=69\|source_link_hold=2\|financial_mutations=0 ]]; then
  echo "Historical import post-check returned unexpected evidence: $verification" >&2
  exit 1
fi

if [[ -n "${MISSIONACCOUNTS_IMPORT_MANIFEST_OUTPUT:-}" ]]; then
  cp -n "$import_manifest" "$MISSIONACCOUNTS_IMPORT_MANIFEST_OUTPUT"
  chmod 600 "$MISSIONACCOUNTS_IMPORT_MANIFEST_OUTPUT"
fi

echo "$verification"
