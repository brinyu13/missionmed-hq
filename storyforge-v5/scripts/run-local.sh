#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SF_TMP="$(mktemp -d /tmp/storyforge-v5.local.XXXXXX)"
SF_PGDATA="$SF_TMP/data"
SF_PGSOCKET="$SF_TMP/socket"
SF_PG_PORT="${STORYFORGE_LOCAL_PG_PORT:-55441}"
SF_APP_PORT="${STORYFORGE_PORT:-4180}"

mkdir -p "$SF_PGSOCKET"

cleanup() {
  if [[ -s "$SF_PGDATA/postmaster.pid" ]]; then
    pg_ctl -D "$SF_PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  case "$SF_TMP" in
    /tmp/storyforge-v5.local.*) rm -rf -- "$SF_TMP" ;;
    *) echo "Refusing to remove unexpected temp path: $SF_TMP" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

initdb -D "$SF_PGDATA" -A trust -U postgres --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$SF_PGDATA" -o "-p $SF_PG_PORT -k $SF_PGSOCKET -h 127.0.0.1" -w start >/dev/null
psql -h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c "CREATE DATABASE storyforge" >/dev/null
PSQL_ARGS=(-h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d storyforge -v ON_ERROR_STOP=1)
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/bootstrap_local.sql" >/dev/null
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/migrations/20260726150000_b1_500_storyforge_v5_foundation.sql" >/dev/null
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/seed_local.sql" >/dev/null

export STORYFORGE_DATABASE_URL="postgresql://postgres@127.0.0.1:$SF_PG_PORT/storyforge"
export STORYFORGE_PORT="$SF_APP_PORT"
export STORYFORGE_PUBLIC_ORIGIN="http://127.0.0.1:$SF_APP_PORT"
export STORYFORGE_DEV_AUTH=1
export STORYFORGE_DEV_JWT_SECRET="b1-500-local-manual-secret-not-for-production"
export STORYFORGE_JWT_ISSUER="storyforge-local-manual"
export STORYFORGE_JWT_AUDIENCE="storyforge"

echo "StoryForge V5 local verification: http://127.0.0.1:$SF_APP_PORT"
echo "Identity is a local signed fixture, not production SSO."
exec node "$PACKAGE_DIR/server/app.mjs"
