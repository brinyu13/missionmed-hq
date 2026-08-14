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
  --set=admin_console_founder_user_id=cccccccc-cccc-4ccc-8ccc-cccccccccccc
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
  "20260729010000_b1_506a_voice_audit_lifecycle.sql"
  "20260730000100_b1_507b_reconciliation_state.sql"
  "20260801190000_b1_510i_admin_console.sql"
  "20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql"
  "20260806130000_b1_511a_wordpress_admin_authority.sql"
  "20260806190000_b1_512_concrete_configuration_media.sql"
  "20260810190000_b1_514_v2_r1_visibility_consent_activity.sql"
  "20260810200000_b1_514_v2_r2_story_versions_provenance.sql"
  "20260810210000_b1_514_v2_r3_inspiration.sql"
  "20260810220000_b1_514_v2_ra_requests_guest.sql"
  "20260810230000_b1_514_v2_preferences_environments.sql"
  "20260810240000_b1_514_v2_ra_lifecycle_completion.sql"
  "20260810250000_b1_514_v21_authored_segment_writes.sql"
  "20260810260000_b1_514_guest_voice_contributions.sql"
  "20260810270000_b1_514_request_delivery_attempts.sql"
  "20260810280000_b1_514_guest_voice_cleanup_recovery.sql"
  "20260812120000_b1_515_v201_reviews_collections_peer.sql"
  "20260813120000_b1_515r_admin_subject_masterkey.sql"
  "20260813130000_b1_515r_action_center_contribution_review.sql"
  "20260813140000_b1_515r_arena_avatar_directory_groups.sql"
  "20260813150000_b1_515r_inspiration_recommendation_publish_fix.sql"
  "20260814120000_b1_515r2_admin_population_avatar_sound.sql"
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
# Ephemeral/manual fixture only: mirror the complete seeded eligible-student set
# into the canonical projection after the fail-closed migration is installed.
"$PSQL_BIN" "${PSQL_ARGS[@]}" -c \
  "SELECT public.sf_sync_admin_population_snapshot('match_mentorship_360','77777777-7777-4777-8777-777777777777',now(),'mmhq_cam_build_entitlement',3893,coalesce((SELECT jsonb_agg(jsonb_build_object('storyforge_uuid',id::text,'wp_user_id',wp_user_id,'arena_avatar_id','','arena_avatar_thumbnail_url','') ORDER BY id) FROM public.sf_users WHERE role='student' AND eligible),'[]'::jsonb),false)" \
  >/dev/null
"$PSQL_BIN" "${PSQL_ARGS[@]}" \
  -c "ALTER ROLE storyforge_app LOGIN" >/dev/null

export STORYFORGE_DATABASE_URL="postgresql://storyforge_app@127.0.0.1:$SF_PG_PORT/storyforge"
export STORYFORGE_PORT="$SF_APP_PORT"
export STORYFORGE_PUBLIC_ORIGIN="http://127.0.0.1:$SF_APP_PORT"
export STORYFORGE_DEV_AUTH=1
export STORYFORGE_DEV_JWT_SECRET="b1-500-local-manual-secret-not-for-production"
export STORYFORGE_ADMIN_CONSOLE_FORCE_OFF=0
export STORYFORGE_CONTENT_DISPLAY_FORCE_OFF=0
export STORYFORGE_STORY_MEDIA_FORCE_OFF=0
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
