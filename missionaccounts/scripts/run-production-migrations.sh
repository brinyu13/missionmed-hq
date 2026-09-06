#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
app_dir=$(cd "$script_dir/.." && pwd)
migrations_dir="$app_dir/supabase/migrations"

for required in node psql; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "MissionAccounts production migration requires: $required" >&2
    exit 1
  fi
done

: "${MISSIONACCOUNTS_DATABASE_URL:?Set the isolated MissionAccounts production database URL through the approved secret channel}"
: "${MISSIONACCOUNTS_SUPABASE_PROJECT_REF:?Set the exact isolated MissionAccounts Supabase project ref}"
: "${MISSIONACCOUNTS_MIGRATION_APPROVAL:?Set MISSIONACCOUNTS_MIGRATION_APPROVAL=MX-MISSIONACCOUNTS-5301P-SCHEMA}"

if [[ "$MISSIONACCOUNTS_MIGRATION_APPROVAL" != "MX-MISSIONACCOUNTS-5301P-SCHEMA" ]]; then
  echo "MissionAccounts migration approval token is invalid" >&2
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

release_digest=$(node - "$migrations_dir" <<'NODE'
const { createHash } = require('node:crypto');
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const dir = process.argv[2];
const hash = createHash('sha256');
for (const name of readdirSync(dir).filter(name => name.endsWith('.sql')).sort()) {
  const bytes = readFileSync(join(dir, name));
  hash.update(name).update('\0').update(createHash('sha256').update(bytes).digest('hex')).update('\n');
}
process.stdout.write(hash.digest('hex'));
NODE
)

schema_exists=$(psql "$MISSIONACCOUNTS_DATABASE_URL" -Atq -v ON_ERROR_STOP=1 -c "select to_regnamespace('missionaccounts') is not null")
if [[ "$schema_exists" == "t" ]]; then
  current_digest=$(psql "$MISSIONACCOUNTS_DATABASE_URL" -Atq -v ON_ERROR_STOP=1 -c "select release_digest from missionaccounts.schema_release where release_id='mx-missionaccounts-5301p'" 2>/dev/null || true)
  if [[ "$current_digest" == "$release_digest" ]]; then
    echo "PASS|schema_release=mx-missionaccounts-5301p|digest=$release_digest|duplicate=true"
    exit 0
  fi
  echo "MissionAccounts schema already exists without the exact approved release digest" >&2
  exit 1
fi

migration_args=()
while IFS= read -r migration; do migration_args+=( -f "$migration" ); done < <(find "$migrations_dir" -maxdepth 1 -type f -name '*.sql' | sort)
psql "$MISSIONACCOUNTS_DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction \
  "${migration_args[@]}" \
  -v release_digest="$release_digest" \
  -c "create table missionaccounts.schema_release(release_id text primary key, release_digest text not null check(release_digest ~ '^[0-9a-f]{64}$'), applied_at timestamptz not null default now()); alter table missionaccounts.schema_release enable row level security; alter table missionaccounts.schema_release force row level security; revoke all on missionaccounts.schema_release from public, anon, authenticated; grant select on missionaccounts.schema_release to service_role; insert into missionaccounts.schema_release(release_id,release_digest) values ('mx-missionaccounts-5301p', :'release_digest');" \
  >/dev/null

postcheck=$(psql "$MISSIONACCOUNTS_DATABASE_URL" -Atq -v ON_ERROR_STOP=1 <<'SQL'
select (select count(*) from missionaccounts.feature_flag)
  || '|' || (select count(*) from missionaccounts.feature_flag where enabled)
  || '|' || (select count(*) from missionaccounts.cycle)
  || '|' || (select count(*) from missionaccounts.student)
  || '|' || (select count(*) from missionaccounts.invoice)
  || '|' || (select count(*) from missionaccounts.charge);
SQL
)
if [[ "$postcheck" != "11|0|3|0|0|0" ]]; then
  echo "MissionAccounts schema post-check returned unexpected controls: $postcheck" >&2
  exit 1
fi

echo "PASS|schema_release=mx-missionaccounts-5301p|digest=$release_digest|flags=11|enabled=0|students=0|invoices=0|charges=0"
