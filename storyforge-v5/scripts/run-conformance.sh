#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SF_CONFORMANCE_TMP="$(mktemp -d /tmp/storyforge-v5.conformance.XXXXXX)"
SF_CONFORMANCE_PGDATA="$SF_CONFORMANCE_TMP/data"
SF_CONFORMANCE_PGSOCKET="$SF_CONFORMANCE_TMP/socket"
SF_CONFORMANCE_PG_PORT="${STORYFORGE_CONFORMANCE_PG_PORT:-55453}"
SF_CONFORMANCE_APP_PORT="${STORYFORGE_CONFORMANCE_APP_PORT:-4193}"
SF_CONFORMANCE_SERVER_PID=""

mkdir -p "$SF_CONFORMANCE_PGSOCKET"

cleanup() {
  if [[ -n "$SF_CONFORMANCE_SERVER_PID" ]]; then
    kill "$SF_CONFORMANCE_SERVER_PID" >/dev/null 2>&1 || true
    wait "$SF_CONFORMANCE_SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -s "$SF_CONFORMANCE_PGDATA/postmaster.pid" ]]; then
    pg_ctl -D "$SF_CONFORMANCE_PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  case "$SF_CONFORMANCE_TMP" in
    /tmp/storyforge-v5.conformance.*) rm -rf -- "$SF_CONFORMANCE_TMP" ;;
    *) echo "Refusing to remove unexpected conformance temp path: $SF_CONFORMANCE_TMP" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

if lsof -nP -iTCP:"$SF_CONFORMANCE_PG_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "StoryForge conformance PostgreSQL port $SF_CONFORMANCE_PG_PORT is already in use." >&2
  exit 1
fi
if lsof -nP -iTCP:"$SF_CONFORMANCE_APP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "StoryForge conformance application port $SF_CONFORMANCE_APP_PORT is already in use." >&2
  exit 1
fi

initdb -D "$SF_CONFORMANCE_PGDATA" -A trust -U postgres --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$SF_CONFORMANCE_PGDATA" \
  -o "-p $SF_CONFORMANCE_PG_PORT -k $SF_CONFORMANCE_PGSOCKET -h 127.0.0.1" \
  -w start >/dev/null
psql -h 127.0.0.1 -p "$SF_CONFORMANCE_PG_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c "CREATE DATABASE storyforge" >/dev/null

PSQL_ARGS=(
  -h 127.0.0.1
  -p "$SF_CONFORMANCE_PG_PORT"
  -U postgres
  -d storyforge
  -v ON_ERROR_STOP=1
)
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/bootstrap_local.sql" >/dev/null
while IFS= read -r migration_file; do
  psql "${PSQL_ARGS[@]}" -f "$migration_file" >/dev/null
done < <(find "$PACKAGE_DIR/infra/postgres/migrations" -maxdepth 1 -type f -name '*.sql' | sort)
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/seed_local.sql" >/dev/null

export STORYFORGE_DATABASE_URL="postgresql://postgres@127.0.0.1:$SF_CONFORMANCE_PG_PORT/storyforge"
export STORYFORGE_PORT="$SF_CONFORMANCE_APP_PORT"
export STORYFORGE_HOST="127.0.0.1"
export STORYFORGE_PUBLIC_ORIGIN="http://127.0.0.1:$SF_CONFORMANCE_APP_PORT"
export STORYFORGE_BASE_PATH="/"
export STORYFORGE_MATRIX_BASE_URL="http://127.0.0.1:$SF_CONFORMANCE_APP_PORT/member-dashboard/"
export STORYFORGE_ALLOWED_ORIGINS="http://127.0.0.1:$SF_CONFORMANCE_APP_PORT"
export STORYFORGE_DEV_AUTH=1
export STORYFORGE_DEV_JWT_SECRET="b1-503-local-conformance-secret-not-for-production"
export STORYFORGE_JWT_ISSUER="storyforge-local-conformance"
export STORYFORGE_JWT_AUDIENCE="storyforge"
export STORYFORGE_CONFORMANCE_BASE_URL="http://127.0.0.1:$SF_CONFORMANCE_APP_PORT"

node "$PACKAGE_DIR/server/app.mjs" >"$SF_CONFORMANCE_TMP/server.log" 2>&1 &
SF_CONFORMANCE_SERVER_PID=$!

for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:$SF_CONFORMANCE_APP_PORT/healthz" >/dev/null; then
    break
  fi
  sleep 0.25
done
if ! curl -fsS "http://127.0.0.1:$SF_CONFORMANCE_APP_PORT/healthz" >/dev/null; then
  sed -n '1,240p' "$SF_CONFORMANCE_TMP/server.log" >&2
  exit 1
fi

(
  cd "$PACKAGE_DIR"
  npx playwright test --config playwright.conformance.config.mjs "$@"
)
