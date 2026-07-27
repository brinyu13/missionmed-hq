#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREE_DIR="$(cd "$PACKAGE_DIR/.." && pwd)"
COMPOSE_FILE="$PACKAGE_DIR/infra/wordpress/docker-compose.yml"
SF_TMP="$(mktemp -d /tmp/storyforge-v5.integration.XXXXXX)"
SF_PGDATA="$SF_TMP/pgdata"
SF_PGSOCKET="$SF_TMP/pgsocket"

pick_free_port() {
  local candidate="$1"
  local reserved="${2:-}"
  while [[ "$candidate" == "$reserved" ]] || lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; do
    candidate=$((candidate + 1))
  done
  echo "$candidate"
}

SF_PG_PORT="${STORYFORGE_INTEGRATION_PG_PORT:-$(pick_free_port 55441)}"
SF_EDGE_PORT="${STORYFORGE_INTEGRATION_EDGE_PORT:-$(pick_free_port 4179)}"
SF_APP_PORT="${STORYFORGE_INTEGRATION_APP_PORT:-$(pick_free_port 4180 "$SF_EDGE_PORT")}"
if [[ "$SF_APP_PORT" == "$SF_EDGE_PORT" ]]; then
  echo "StoryForge integration app and edge ports must differ." >&2
  exit 1
fi
SF_SERVER_PID=""
SF_EDGE_PID=""
SF_SECRET="b1-501-local-wordpress-signing-secret-32-bytes"
SF_ISSUER="http://127.0.0.1:${SF_EDGE_PORT}/wp-json/missionmed/v1/storyforge"
EVIDENCE_DIR="$WORKTREE_DIR/_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/evidence/local-integration"

mkdir -p "$SF_PGSOCKET" "$EVIDENCE_DIR"

cleanup() {
  if [[ -n "$SF_EDGE_PID" ]]; then
    kill "$SF_EDGE_PID" >/dev/null 2>&1 || true
    wait "$SF_EDGE_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$SF_SERVER_PID" ]]; then
    kill "$SF_SERVER_PID" >/dev/null 2>&1 || true
    wait "$SF_SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -s "$SF_PGDATA/postmaster.pid" ]]; then
    pg_ctl -D "$SF_PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
  case "$SF_TMP" in
    /tmp/storyforge-v5.integration.*) rm -rf -- "$SF_TMP" ;;
    *) echo "Refusing to remove unexpected temp path: $SF_TMP" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

docker compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
npm run build --prefix "$PACKAGE_DIR"
npm run scan:secrets --prefix "$PACKAGE_DIR"

initdb -D "$SF_PGDATA" -A trust -U postgres --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$SF_PGDATA" -o "-p $SF_PG_PORT -k $SF_PGSOCKET -h 127.0.0.1" -w start >/dev/null
psql -h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c "CREATE DATABASE storyforge" >/dev/null
PSQL_ARGS=(-h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d storyforge -v ON_ERROR_STOP=1)
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/bootstrap_local.sql" >/dev/null
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/migrations/20260726150000_b1_500_storyforge_v5_foundation.sql" >/dev/null
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/migrations/20260727170000_b1_502_storyforge_submit_assignment_gate.sql" >/dev/null
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/migrations/20260727190000_b1_502_storyforge_background_preference.sql" >/dev/null
psql "${PSQL_ARGS[@]}" -f "$PACKAGE_DIR/infra/postgres/seed_local.sql" >/dev/null
psql "${PSQL_ARGS[@]}" -c "UPDATE public.sf_mentor_assignments SET active = false" >/dev/null

docker compose -f "$COMPOSE_FILE" up -d db wordpress
for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:18081/wp-admin/install.php" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

wp() {
  docker compose -f "$COMPOSE_FILE" run --rm wpcli wp "$@"
}

wp core install \
  --url="http://127.0.0.1:${SF_EDGE_PORT}" \
  --title="StoryForge Integration" \
  --admin_user="localadmin" \
  --admin_password="local-admin-password" \
  --admin_email="localadmin@example.test" \
  --skip-email
wp plugin activate missionmed-storyforge-sso
wp role create mentor Mentor --clone=subscriber
FOUNDER_ID="$(wp user get localadmin --field=ID)"
FOUNDER_STORYFORGE_ID="33333333-3333-4333-8333-333333333333"
SECOND_ADMIN_ID="$(wp user create secondadmin secondadmin@example.test --role=administrator --user_pass=storyforge-local-password --display_name='Second Admin' --porcelain)"
STUDENT_ID="$(wp user create maya maya@example.test --role=subscriber --user_pass=storyforge-local-password --display_name='Maya Student' --porcelain)"
MENTOR_ID="$(wp user create drchen drchen@example.test --role=mentor --user_pass=storyforge-local-password --display_name='Dr. Chen' --porcelain)"
MENTOR_TWO_ID="$(wp user create drrivera drrivera@example.test --role=mentor --user_pass=storyforge-local-password --display_name='Dr. Rivera' --porcelain)"
psql "${PSQL_ARGS[@]}" -c \
  "INSERT INTO public.sf_users (id, wp_user_id, display_name, role, eligible) VALUES ('$FOUNDER_STORYFORGE_ID', $FOUNDER_ID, 'Founder Integration', 'student', true)" \
  >/dev/null
psql "${PSQL_ARGS[@]}" -c \
  "UPDATE public.sf_users SET wp_user_id = $STUDENT_ID WHERE id = '11111111-1111-4111-8111-111111111111'" \
  >/dev/null
wp user meta update "$FOUNDER_ID" _missionmed_storyforge_user_id "$FOUNDER_STORYFORGE_ID"
wp user meta update "$STUDENT_ID" _missionmed_storyforge_user_id 11111111-1111-4111-8111-111111111111
wp user meta update "$STUDENT_ID" _missionmed_storyforge_cohort 2027
wp user meta update "$STUDENT_ID" _missionmed_storyforge_local_eligible 1
wp user meta update "$MENTOR_ID" _missionmed_storyforge_user_id aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
wp user meta update "$MENTOR_TWO_ID" _missionmed_storyforge_user_id bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb
wp rewrite structure '/%postname%/' --hard
wp post create \
  --post_type=page \
  --post_status=publish \
  --post_title='Matrix Test Dashboard' \
  --post_name='member-dashboard' \
  --post_content='[missionmed_storyforge_navigation] [missionmed_storyforge_dashboard_tile]' >/dev/null

DEFAULT_OFF="$(wp eval "\$u=get_user_by('id',$STUDENT_ID);wp_set_current_user(\$u->ID);echo do_shortcode('[missionmed_storyforge_navigation][missionmed_storyforge_dashboard_tile]');")"
if [[ -n "$DEFAULT_OFF" ]]; then
  echo "Default-off navigation gate failed." >&2
  exit 1
fi
wp eval '$s=mmsf_settings();$s["storyforge_enabled"]=true;update_option(MMSF_OPTION,$s,false);'
wp plugin deactivate missionmed-storyforge-sso >/dev/null
wp plugin activate missionmed-storyforge-sso >/dev/null
REACTIVATED_OFF="$(wp eval 'echo mmsf_settings()["storyforge_enabled"] ? "1" : "";')"
if [[ -n "$REACTIVATED_OFF" ]]; then
  echo "StoryForge WordPress seam did not force feature-off on reactivation." >&2
  exit 1
fi

wp eval "\$s=mmsf_settings();\$s['storyforge_enabled']=true;\$s['allowed_user_ids']=array($FOUNDER_ID);\$s['app_role_overrides']=array($FOUNDER_ID=>'student');\$s['allowed_roles']=array('student');\$s['allowed_cohorts']=array();\$s['token_ttl_seconds']=5;update_option(MMSF_OPTION,\$s,false);"

FOUNDER_ACCESS="$(wp eval "\$u=get_user_by('id',$FOUNDER_ID);\$state=mmsf_access_state(\$u);echo is_wp_error(\$state)?\$state->get_error_code():'allowed:'.\$state['role'];")"
SECOND_ADMIN_ACCESS="$(wp eval "\$u=get_user_by('id',$SECOND_ADMIN_ID);\$state=mmsf_access_state(\$u);echo is_wp_error(\$state)?\$state->get_error_code():'allowed:'.\$state['role'];")"
STUDENT_ACCESS="$(wp eval "\$u=get_user_by('id',$STUDENT_ID);\$state=mmsf_access_state(\$u);echo is_wp_error(\$state)?\$state->get_error_code():'allowed:'.\$state['role'];")"
MENTOR_ACCESS="$(wp eval "\$u=get_user_by('id',$MENTOR_ID);\$state=mmsf_access_state(\$u);echo is_wp_error(\$state)?\$state->get_error_code():'allowed:'.\$state['role'];")"
if [[ "$FOUNDER_ACCESS" != "allowed:student" ]]; then
  echo "Exact founder role override check failed: $FOUNDER_ACCESS" >&2
  exit 1
fi
for denied_state in "$SECOND_ADMIN_ACCESS" "$STUDENT_ACCESS" "$MENTOR_ACCESS"; do
  if [[ "$denied_state" != "user_not_enabled" ]]; then
    echo "Exact-user allowlist denial check failed: $denied_state" >&2
    exit 1
  fi
done

FOUNDER_NAV="$(wp eval "\$u=get_user_by('id',$FOUNDER_ID);wp_set_current_user(\$u->ID);echo do_shortcode('[missionmed_storyforge_navigation][missionmed_storyforge_dashboard_tile]');")"
DENIED_NAV="$(wp eval "\$ids=array($SECOND_ADMIN_ID,$STUDENT_ID,$MENTOR_ID);foreach(\$ids as \$id){\$u=get_user_by('id',\$id);wp_set_current_user(\$u->ID);echo do_shortcode('[missionmed_storyforge_navigation][missionmed_storyforge_dashboard_tile]');}")"
if [[ "$FOUNDER_NAV" != *"missionmed-storyforge-nav"* || "$FOUNDER_NAV" != *"missionmed-storyforge-tile"* ]]; then
  echo "Exact founder navigation check failed." >&2
  exit 1
fi
if [[ -n "$DENIED_NAV" ]]; then
  echo "Non-allowlisted navigation check failed." >&2
  exit 1
fi

export STORYFORGE_DATABASE_URL="postgresql://postgres@127.0.0.1:$SF_PG_PORT/storyforge"
export STORYFORGE_PORT="$SF_APP_PORT"
export STORYFORGE_HOST="127.0.0.1"
export STORYFORGE_PUBLIC_ORIGIN="http://127.0.0.1:$SF_EDGE_PORT"
export STORYFORGE_BASE_PATH="/storyforge/"
export STORYFORGE_MATRIX_BASE_URL="http://127.0.0.1:$SF_EDGE_PORT/member-dashboard/"
export STORYFORGE_ALLOWED_ORIGINS="http://127.0.0.1:$SF_EDGE_PORT"
export STORYFORGE_STATIC_DIR="dist"
export STORYFORGE_ORIGIN_API_ONLY=1
export STORYFORGE_JWT_SECRET="$SF_SECRET"
export STORYFORGE_JWT_ISSUER="$SF_ISSUER"
export STORYFORGE_JWT_AUDIENCE="storyforge"
export STORYFORGE_TOKEN_REFRESH_SKEW_SECONDS=1
unset STORYFORGE_DEV_AUTH STORYFORGE_DEV_JWT_SECRET

node "$PACKAGE_DIR/server/app.mjs" >"$SF_TMP/server.log" 2>&1 &
SF_SERVER_PID=$!
STORYFORGE_EDGE_PORT="$SF_EDGE_PORT" \
STORYFORGE_EDGE_APP_ORIGIN="http://127.0.0.1:$SF_APP_PORT" \
STORYFORGE_EDGE_WP_ORIGIN="http://127.0.0.1:18081" \
STORYFORGE_EDGE_STATIC_DIR="$PACKAGE_DIR/dist" \
STORYFORGE_BASE_PATH="/storyforge/" \
node "$PACKAGE_DIR/infra/edge/local-router.mjs" >"$SF_TMP/edge.log" 2>&1 &
SF_EDGE_PID=$!

for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:$SF_EDGE_PORT/storyforge/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
if ! curl -fsS "http://127.0.0.1:$SF_EDGE_PORT/storyforge/healthz" >/dev/null; then
  sed -n '1,220p' "$SF_TMP/server.log" >&2
  sed -n '1,220p' "$SF_TMP/edge.log" >&2
  exit 1
fi

HASHED_ASSET="$(find "$PACKAGE_DIR/dist/assets" -maxdepth 1 -type f -name 'app.*.js' -exec basename {} \; | head -1)"
HASHED_FONT="$(find "$PACKAGE_DIR/dist/assets/fonts" -maxdepth 1 -type f -name 'archivo-normal.*.woff2' -exec basename {} \; | head -1)"
export STORYFORGE_INTEGRATION_BASE_URL="http://127.0.0.1:$SF_EDGE_PORT"
export STORYFORGE_INTEGRATION_COMPOSE_FILE="$COMPOSE_FILE"
export STORYFORGE_INTEGRATION_FOUNDER_ID="$FOUNDER_ID"
export STORYFORGE_INTEGRATION_STUDENT_ID="$STUDENT_ID"
export STORYFORGE_INTEGRATION_USERNAME="localadmin"
export STORYFORGE_INTEGRATION_PASSWORD="local-admin-password"
export STORYFORGE_INTEGRATION_HASHED_ASSET="$HASHED_ASSET"
export STORYFORGE_INTEGRATION_HASHED_FONT="$HASHED_FONT"
curl -sS -D - -o /dev/null --max-redirs 0 \
  "http://127.0.0.1:$SF_EDGE_PORT/member-dashboard/" \
  | tee "$EVIDENCE_DIR/wordpress-permalink-probe.headers"
(
  cd "$PACKAGE_DIR"
  npx playwright test --config playwright.integration.config.mjs
) | tee "$EVIDENCE_DIR/gates-1-through-5-local-integration.log"

WP_ASSIGNMENTS="$SF_TMP/wp-assignments.json"
wp eval 'echo wp_json_encode(mmsf_assignment_rows());' >"$WP_ASSIGNMENTS"
node "$PACKAGE_DIR/scripts/reconcile-mentor-assignments.mjs" \
  --wp-json "$WP_ASSIGNMENTS" \
  --output "$EVIDENCE_DIR/gate-7-mentor-assignment-reconciliation.json"

wp eval "\$s=mmsf_settings();\$s['storyforge_enabled']=false;update_option(MMSF_OPTION,\$s,false);"
FLAG_OFF_STATE="$(wp eval "\$u=get_user_by('id',$STUDENT_ID);wp_set_current_user(\$u->ID);\$state=mmsf_access_state(\$u);echo is_wp_error(\$state)?\$state->get_error_code():'allowed';")"
if [[ "$FLAG_OFF_STATE" != "storyforge_disabled" ]]; then
  echo "Flag-off rollback check expected storyforge_disabled, got $FLAG_OFF_STATE." >&2
  exit 1
fi

ROUTE_REMOVED_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: 127.0.0.1:$SF_EDGE_PORT" "http://127.0.0.1:18081/storyforge/")"
if [[ "$ROUTE_REMOVED_CODE" != "404" ]]; then
  echo "Route-removal rollback check expected WordPress 404, got $ROUTE_REMOVED_CODE." >&2
  exit 1
fi

wp plugin deactivate missionmed-storyforge-sso >/dev/null
DEACTIVATED_FLAG="$(wp option get missionmed_storyforge_settings --format=json)"
if [[ "$DEACTIVATED_FLAG" != *'"storyforge_enabled":false'* ]]; then
  echo "Plugin deactivation did not force the feature flag off." >&2
  exit 1
fi

{
  echo "default_off_shortcodes=empty"
  echo "flag_off_access_state=$FLAG_OFF_STATE"
  echo "route_removed_wordpress_http=$ROUTE_REMOVED_CODE"
  echo "plugin_deactivation_forced_flag_off=true"
} >"$EVIDENCE_DIR/rollback-local-verification.txt"

echo "StoryForge B1-501 local integration gates passed."
