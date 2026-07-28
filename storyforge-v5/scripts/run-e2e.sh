#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SF_TMP="$(mktemp -d /tmp/storyforge-v5.e2e.XXXXXX)"
SF_PGDATA="$SF_TMP/data"
SF_PGSOCKET="$SF_TMP/socket"
SF_PG_PORT="${STORYFORGE_E2E_PG_PORT:-55440}"
SF_APP_PORT="${STORYFORGE_E2E_APP_PORT:-4179}"
SF_SERVER_PID=""

mkdir -p "$SF_PGSOCKET"

cleanup() {
  if [[ -n "$SF_SERVER_PID" ]]; then
    kill "$SF_SERVER_PID" >/dev/null 2>&1 || true
    wait "$SF_SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -s "$SF_PGDATA/postmaster.pid" ]]; then
    pg_ctl -D "$SF_PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  case "$SF_TMP" in
    /tmp/storyforge-v5.e2e.*) rm -rf -- "$SF_TMP" ;;
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
while IFS= read -r migration; do
  psql "${PSQL_ARGS[@]}" -f "$migration" >/dev/null
done < <(find "$PACKAGE_DIR/infra/postgres/migrations" -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort)
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/seed_local.sql" >/dev/null
psql "${PSQL_ARGS[@]}" -c \
  "UPDATE public.sf_mentor_assignments SET active = false WHERE student_id = '22222222-2222-4222-8222-222222222222'" \
  >/dev/null

export STORYFORGE_DATABASE_URL="postgresql://postgres@127.0.0.1:$SF_PG_PORT/storyforge"
export STORYFORGE_PORT="$SF_APP_PORT"
export STORYFORGE_PUBLIC_ORIGIN="http://127.0.0.1:$SF_APP_PORT"
export STORYFORGE_DEV_AUTH=1
export STORYFORGE_DEV_JWT_SECRET="b1-500-local-e2e-secret-not-for-production"
export STORYFORGE_JWT_ISSUER="storyforge-local-e2e"
export STORYFORGE_JWT_AUDIENCE="storyforge"

node "$PACKAGE_DIR/server/app.mjs" >"$SF_TMP/server.log" 2>&1 &
SF_SERVER_PID=$!

for _ in {1..40}; do
  if curl -fsS "http://127.0.0.1:$SF_APP_PORT/healthz" >/dev/null; then
    break
  fi
  sleep 0.25
done

if ! curl -fsS "http://127.0.0.1:$SF_APP_PORT/healthz" >/dev/null; then
  sed -n '1,220p' "$SF_TMP/server.log" >&2
  exit 1
fi

export STORYFORGE_E2E_BASE_URL="http://127.0.0.1:$SF_APP_PORT"
npx playwright test --config "$PACKAGE_DIR/playwright.config.mjs"
