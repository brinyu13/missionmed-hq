#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_PROJECT_ID="875e7c17-d06f-4301-a4bb-e61016f153cf"
EXPECTED_DATABASE_SERVICE_ID="a4a66362-c3ba-475a-ae21-2aa46624bafe"

: "${STORYFORGE_RAILWAY_PROJECT_ID:?STORYFORGE_RAILWAY_PROJECT_ID is required}"
: "${STORYFORGE_RAILWAY_DATABASE_SERVICE_ID:?STORYFORGE_RAILWAY_DATABASE_SERVICE_ID is required}"
: "${STORYFORGE_DB_BACKUP_ID:?STORYFORGE_DB_BACKUP_ID is required}"
: "${STORYFORGE_DEPLOY_GIT_COMMIT:?STORYFORGE_DEPLOY_GIT_COMMIT is required}"
: "${STORYFORGE_APP_DB_PASSWORD:?STORYFORGE_APP_DB_PASSWORD is required}"
: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"
: "${PGDATABASE:?PGDATABASE is required}"

if [[ "$STORYFORGE_RAILWAY_PROJECT_ID" != "$EXPECTED_PROJECT_ID" ]]; then
  echo "Refusing migration: Railway project ID does not match B1-502M authority." >&2
  exit 1
fi
if [[ "$STORYFORGE_RAILWAY_DATABASE_SERVICE_ID" != "$EXPECTED_DATABASE_SERVICE_ID" ]]; then
  echo "Refusing migration: Railway database service ID does not match B1-502M authority." >&2
  exit 1
fi
if [[ ! "$STORYFORGE_DEPLOY_GIT_COMMIT" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Refusing migration: deploy Git commit must be a full lowercase SHA-1." >&2
  exit 1
fi
if [[ ! "$STORYFORGE_DB_BACKUP_ID" =~ ^[A-Za-z0-9._:-]{1,160}$ ]]; then
  echo "Refusing migration: backup ID contains unsupported characters." >&2
  exit 1
fi
if (( ${#STORYFORGE_APP_DB_PASSWORD} < 32 )); then
  echo "Refusing migration: application database password must be at least 32 characters." >&2
  exit 1
fi

export PGSSLMODE="${PGSSLMODE:-require}"

ledger_present="$(psql -v ON_ERROR_STOP=1 -Atqc "
  SELECT (to_regclass('public.sf_schema_migrations') IS NOT NULL)::int
")"
if [[ "$ledger_present" = "1" ]]; then
  ledger_count="$(psql -v ON_ERROR_STOP=1 -Atqc 'SELECT count(*) FROM public.sf_schema_migrations')"
else
  ledger_count="0"
fi
storyforge_object_count="$(psql -v ON_ERROR_STOP=1 -Atqc "
  SELECT
    (SELECT count(*)
     FROM pg_class
     WHERE relnamespace = 'public'::regnamespace
       AND relname LIKE 'sf_%'
       AND relname <> 'sf_schema_migrations')
    +
    (SELECT count(*)
     FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname LIKE 'sf_%')
")"
if [[ "$ledger_count" = "0" && "$storyforge_object_count" != "0" ]]; then
  echo "Refusing migration: StoryForge objects exist without ledger entries." >&2
  exit 1
fi
storyforge_role_count="$(psql -v ON_ERROR_STOP=1 -Atqc "
  SELECT count(*)
  FROM pg_roles
  WHERE rolname IN ('anon', 'authenticated', 'storyforge_app')
")"
if [[ "$ledger_present" = "0" && "$storyforge_role_count" != "0" ]]; then
  echo "Refusing migration: StoryForge role names exist without the StoryForge migration ledger." >&2
  exit 1
fi

migrations=(
  "$PACKAGE_DIR/infra/postgres/migrations/20260726150000_b1_500_storyforge_v5_foundation.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260727170000_b1_502_storyforge_submit_assignment_gate.sql"
  "$PACKAGE_DIR/infra/postgres/migrations/20260727190000_b1_502_storyforge_background_preference.sql"
)
pending_migrations=()
pending_versions=()
pending_files=()
pending_hashes=()
pending_count=0

for migration in "${migrations[@]}"; do
  file_name="$(basename "$migration")"
  version="${file_name%%_*}"
  sha256="$(shasum -a 256 "$migration" | awk '{print $1}')"
  existing_sha=""
  if [[ "$ledger_present" = "1" ]]; then
    existing_sha="$(
      psql -v ON_ERROR_STOP=1 -At \
        --set=version="$version" \
        <<'SQL'
SELECT sha256
FROM public.sf_schema_migrations
WHERE version = :'version';
SQL
    )"
  fi

  if [[ -n "$existing_sha" ]]; then
    if [[ "$existing_sha" != "$sha256" ]]; then
      echo "Refusing migration: applied checksum differs for $file_name." >&2
      exit 1
    fi
    echo "Migration already verified: $file_name"
    continue
  fi

  pending_migrations+=("$migration")
  pending_versions+=("$version")
  pending_files+=("$file_name")
  pending_hashes+=("$sha256")
  pending_count=$((pending_count + 1))
done

psql_args=(
  -v ON_ERROR_STOP=1
  --single-transaction
  --set=git_commit="$STORYFORGE_DEPLOY_GIT_COMMIT"
  --set=backup_id="$STORYFORGE_DB_BACKUP_ID"
)
for ((index = 0; index < pending_count; index++)); do
  psql_args+=(
    --set="version_${index}=${pending_versions[$index]}"
    --set="file_${index}=${pending_files[$index]}"
    --set="sha_${index}=${pending_hashes[$index]}"
  )
done

{
  sed -E \
    -e '/^[[:space:]]*\\set[[:space:]]+ON_ERROR_STOP[[:space:]]+on[[:space:]]*$/d' \
    -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' \
    -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' \
    "$PACKAGE_DIR/infra/postgres/bootstrap_production.sql"
  for ((index = 0; index < pending_count; index++)); do
    sed -E \
      -e '/^[[:space:]]*\\set[[:space:]]+ON_ERROR_STOP[[:space:]]+on[[:space:]]*$/d' \
      -e '/^[[:space:]]*BEGIN;[[:space:]]*$/d' \
      -e '/^[[:space:]]*COMMIT;[[:space:]]*$/d' \
      "${pending_migrations[$index]}"
    printf '%s\n' \
      'INSERT INTO public.sf_schema_migrations' \
      '  (version, file_name, sha256, git_commit, backup_id)' \
      'VALUES' \
      "  (:'version_${index}', :'file_${index}', :'sha_${index}', :'git_commit', :'backup_id');"
  done
} | psql "${psql_args[@]}"

for ((index = 0; index < pending_count; index++)); do
  echo "Migration applied and ledgered: ${pending_files[$index]}"
done

printf '%s\n%s\n' "$STORYFORGE_APP_DB_PASSWORD" "$STORYFORGE_APP_DB_PASSWORD" |
  psql -v ON_ERROR_STOP=1 \
    -c "SET password_encryption = 'scram-sha-256'" \
    -c '\password storyforge_app'
psql -v ON_ERROR_STOP=1 -c 'ALTER ROLE storyforge_app LOGIN'

psql -v ON_ERROR_STOP=1 -Atqc "
  SELECT
    (SELECT count(*) FROM public.sf_schema_migrations) AS migration_count,
    (SELECT count(*) FROM pg_roles
     WHERE rolname = 'storyforge_app'
       AND rolcanlogin
       AND NOT rolsuper
       AND NOT rolbypassrls
       AND NOT rolinherit) AS least_privilege_app_role,
    (SELECT count(*) FROM public.sf_users) AS storyforge_user_count,
    (SELECT count(*) FROM public.sf_mentor_assignments WHERE active) AS active_assignment_count
"
