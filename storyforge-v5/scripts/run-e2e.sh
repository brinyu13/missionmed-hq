#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'StoryForge E2E PostgreSQL setup failed: %s\n' "$*" >&2
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
    "$PG_CTL_BIN" -D "$SF_PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  case "$SF_TMP" in
    /tmp/storyforge-v5.e2e.*) rm -rf -- "$SF_TMP" ;;
    *) echo "Refusing to remove unexpected temp path: $SF_TMP" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

"$INITDB_BIN" -D "$SF_PGDATA" -A trust -U postgres --no-locale --encoding=UTF8 >/dev/null
"$PG_CTL_BIN" -D "$SF_PGDATA" -o "-p $SF_PG_PORT -k $SF_PGSOCKET -h 127.0.0.1" -w start >/dev/null
"$PSQL_BIN" -h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c "CREATE DATABASE storyforge" >/dev/null

PSQL_ARGS=(
  -h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d storyforge
  -v ON_ERROR_STOP=1
  --set=founder_user_id=11111111-1111-4111-8111-111111111111
  --set=admin_console_founder_user_id=cccccccc-cccc-4ccc-8ccc-cccccccccccc
)
"$PSQL_BIN" "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/bootstrap_production.sql" >/dev/null
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
  "20260729010000_b1_506a_voice_audit_lifecycle.sql"
  "20260730000100_b1_507b_reconciliation_state.sql"
  "20260801190000_b1_510i_admin_console.sql"
  "20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql"
  "20260806130000_b1_511a_wordpress_admin_authority.sql"
  "20260806190000_b1_512_concrete_configuration_media.sql"
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
"$PSQL_BIN" "${PSQL_ARGS[@]}" -c "ALTER ROLE storyforge_app LOGIN" >/dev/null
"$PSQL_BIN" "${PSQL_ARGS[@]}" -c \
  "UPDATE public.sf_mentor_assignments SET active = false WHERE student_id = '22222222-2222-4222-8222-222222222222'" \
  >/dev/null

# The legacy B1-503 browser fixture uses this same URL for narrowly scoped
# administrator setup mutations while the server is running.
export STORYFORGE_DATABASE_URL="postgresql://postgres@127.0.0.1:$SF_PG_PORT/storyforge"
export STORYFORGE_PORT="$SF_APP_PORT"
export STORYFORGE_PUBLIC_ORIGIN="http://127.0.0.1:$SF_APP_PORT"
export STORYFORGE_DEV_AUTH=1
export STORYFORGE_DEV_JWT_SECRET="b1-500-local-e2e-secret-not-for-production"
export STORYFORGE_ADMIN_CONSOLE_FORCE_OFF=0
export STORYFORGE_CONTENT_DISPLAY_FORCE_OFF=0
export STORYFORGE_STORY_MEDIA_FORCE_OFF=0
export STORYFORGE_MENTOR_NOTES_FORCE_OFF=0
export STORYFORGE_JWT_ISSUER="storyforge-local-e2e"
export STORYFORGE_JWT_AUDIENCE="storyforge"

node "$PACKAGE_DIR/tests/e2e/server-with-assembly-stub.mjs" >"$SF_TMP/server.log" 2>&1 &
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
npx playwright test --config "$PACKAGE_DIR/playwright.config.mjs" "$@"
