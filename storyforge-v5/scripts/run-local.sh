#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'StoryForge local PostgreSQL setup failed: %s\n' "$*" >&2
  exit 1
}

pg_tool() {
  local name="$1"
  local resolved=""
  if [[ -n "${STORYFORGE_PG_BIN:-}" ]]; then
    [[ "$STORYFORGE_PG_BIN" = /* && -d "$STORYFORGE_PG_BIN" ]] \
      || fail "STORYFORGE_PG_BIN must be an absolute PostgreSQL bin directory"
    resolved="$STORYFORGE_PG_BIN/$name"
  else
    resolved="$(command -v "$name" || true)"
  fi
  [[ -n "$resolved" && "$resolved" = /* && -x "$resolved" ]] \
    || fail "$name is unavailable"
  printf '%s\n' "$resolved"
}

INITDB_BIN="$(pg_tool initdb)"
PG_CTL_BIN="$(pg_tool pg_ctl)"
POSTGRES_BIN="$(pg_tool postgres)"
PSQL_BIN="$(pg_tool psql)"
postgres_major="$("$POSTGRES_BIN" --version | sed -E 's/^postgres \(PostgreSQL\) ([0-9]+).*/\1/')"
psql_major="$("$PSQL_BIN" --version | sed -E 's/^psql \(PostgreSQL\) ([0-9]+).*/\1/')"
[[ "$postgres_major" = "18" && "$psql_major" = "18" ]] \
  || fail "PostgreSQL 18 is required (postgres=$postgres_major, psql=$psql_major)"

SF_TMP="$(mktemp -d /tmp/storyforge-v5.local.XXXXXX)"
SF_PGDATA="$SF_TMP/data"
SF_PGSOCKET="$SF_TMP/socket"
SF_PG_PORT="${STORYFORGE_LOCAL_PG_PORT:-55441}"
SF_APP_PORT="${STORYFORGE_PORT:-4180}"
SF_APP_PID=""

mkdir -p "$SF_PGSOCKET"

cleanup() {
  local exit_status=$?
  trap - EXIT INT TERM
  if [[ -n "$SF_APP_PID" ]] && kill -0 "$SF_APP_PID" >/dev/null 2>&1; then
    if [[ "$exit_status" = "130" || "$exit_status" = "143" ]]; then
      for _ in {1..40}; do
        kill -0 "$SF_APP_PID" >/dev/null 2>&1 || break
        sleep 0.05
      done
    fi
    if kill -0 "$SF_APP_PID" >/dev/null 2>&1; then
      kill -TERM "$SF_APP_PID" >/dev/null 2>&1 || true
    fi
    wait "$SF_APP_PID" >/dev/null 2>&1 || true
  fi
  if [[ -s "$SF_PGDATA/postmaster.pid" ]]; then
    "$PG_CTL_BIN" -D "$SF_PGDATA" -m fast -w stop >/dev/null 2>&1 || true
  fi
  case "$SF_TMP" in
    /tmp/storyforge-v5.local.*) rm -rf -- "$SF_TMP" ;;
    *) echo "Refusing to remove unexpected temp path: $SF_TMP" >&2 ;;
  esac
  exit "$exit_status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"$INITDB_BIN" -D "$SF_PGDATA" -A trust -U postgres --no-locale --encoding=UTF8 >/dev/null
"$PG_CTL_BIN" -D "$SF_PGDATA" \
  -o "-p $SF_PG_PORT -k $SF_PGSOCKET -h 127.0.0.1" \
  -l "$SF_TMP/postgres.log" -w start >/dev/null
"$PSQL_BIN" -h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c "CREATE DATABASE storyforge" >/dev/null
PSQL_ARGS=(
  -h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d storyforge
  -v ON_ERROR_STOP=1
  --set=founder_user_id=11111111-1111-4111-8111-111111111111
)
"$PSQL_BIN" "${PSQL_ARGS[@]}" \
  -f "$PACKAGE_DIR/infra/postgres/bootstrap_production.sql" >/dev/null

base_migrations=(
  "20260726150000_b1_500_storyforge_v5_foundation.sql"
  "20260727170000_b1_502_storyforge_submit_assignment_gate.sql"
  "20260727190000_b1_502_storyforge_background_preference.sql"
  "20260728045100_b1_503_story_domain_conformance.sql"
  "20260728045444_b1_503_interview_mentor_conformance.sql"
)
phase_one_migrations=(
  "20260729000100_b1_506_voice_recording_sessions.sql"
  "20260729000200_b1_506_feature_flags.sql"
)
for migration in "${base_migrations[@]}"; do
  "$PSQL_BIN" "${PSQL_ARGS[@]}" \
    -f "$PACKAGE_DIR/infra/postgres/migrations/$migration" >/dev/null
done
"$PSQL_BIN" "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/seed_local.sql" >/dev/null
for migration in "${phase_one_migrations[@]}"; do
  "$PSQL_BIN" "${PSQL_ARGS[@]}" \
    -f "$PACKAGE_DIR/infra/postgres/migrations/$migration" >/dev/null
done
"$PSQL_BIN" "${PSQL_ARGS[@]}" \
  -c "ALTER ROLE storyforge_app LOGIN" >/dev/null

export STORYFORGE_DATABASE_URL="postgresql://storyforge_app@127.0.0.1:$SF_PG_PORT/storyforge"
export STORYFORGE_PORT="$SF_APP_PORT"
export STORYFORGE_PUBLIC_ORIGIN="http://127.0.0.1:$SF_APP_PORT"
export STORYFORGE_DEV_AUTH=1
export STORYFORGE_DEV_JWT_SECRET="b1-500-local-manual-secret-not-for-production"
export STORYFORGE_JWT_ISSUER="storyforge-local-manual"
export STORYFORGE_JWT_AUDIENCE="storyforge"

echo "StoryForge V5 local verification: http://127.0.0.1:$SF_APP_PORT"
echo "Identity is a local signed fixture, not production SSO."
echo "PostgreSQL parity: $("$POSTGRES_BIN" --version)"
node "$PACKAGE_DIR/server/app.mjs" &
SF_APP_PID=$!
set +e
wait "$SF_APP_PID"
app_status=$?
set -e
SF_APP_PID=""
exit "$app_status"
