#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKTREE_DIR="$(cd "$PACKAGE_DIR/.." && pwd)"
COMPOSE_FILE="$PACKAGE_DIR/infra/wordpress/docker-compose.yml"
: "${STORYFORGE_EXPECTED_COMMIT:?StoryForge release integration requires STORYFORGE_EXPECTED_COMMIT as a full commit.}"

fail() {
  printf 'StoryForge integration PostgreSQL setup failed: %s\n' "$*" >&2
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

node "$PACKAGE_DIR/scripts/assert-release-source.mjs" --mode=release
SF_PRODUCT_COMMIT="$STORYFORGE_EXPECTED_COMMIT"
SF_TMP="$(mktemp -d /tmp/storyforge-v5.integration.XXXXXX)"
SF_PGDATA="$SF_TMP/pgdata"
SF_PGSOCKET="$SF_TMP/pgsocket"
SF_WP_RUNTIME="$SF_TMP/wordpress-runtime"

pick_free_port() {
  local candidate="$1"
  local reserved="${2:-}"
  while [[ "$candidate" == "$reserved" ]] || lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; do
    candidate=$((candidate + 1))
  done
  echo "$candidate"
}

SF_PG_PORT="${STORYFORGE_INTEGRATION_PG_PORT:-$(pick_free_port 55441)}"
SF_WP_PORT="${STORYFORGE_INTEGRATION_WP_PORT:-$(pick_free_port 18081)}"
SF_APP_PORT="${STORYFORGE_INTEGRATION_APP_PORT:-$(pick_free_port 4180 "$SF_WP_PORT")}"
SF_MOCK_PORT="${STORYFORGE_INTEGRATION_MOCK_PORT:-$(pick_free_port 4190 "$SF_APP_PORT")}"
if [[ "$SF_APP_PORT" == "$SF_WP_PORT" ]]; then
  echo "StoryForge integration app and WordPress ports must differ." >&2
  exit 1
fi
SF_SERVER_PID=""
SF_MOCK_PID=""
SF_SECRET="b1-501-local-wordpress-signing-secret-32-bytes"
SF_ISSUER="http://127.0.0.1:${SF_WP_PORT}/wp-json/missionmed/v1/storyforge"
EVIDENCE_DIR=""

cleanup() {
  local sf_exit_code=$?
  if [[ -n "$EVIDENCE_DIR" && "$sf_exit_code" -ne 0 ]]; then
    STORYFORGE_EXPECTED_COMMIT="$SF_PRODUCT_COMMIT" \
      node "$PACKAGE_DIR/scripts/update-integration-evidence.mjs" \
        --status=failed \
        --exit-code="$sf_exit_code" \
        --directory="$EVIDENCE_DIR" >/dev/null 2>&1 || true
  fi
  if [[ -n "$SF_MOCK_PID" ]]; then
    kill "$SF_MOCK_PID" >/dev/null 2>&1 || true
    wait "$SF_MOCK_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$SF_SERVER_PID" ]]; then
    kill "$SF_SERVER_PID" >/dev/null 2>&1 || true
    wait "$SF_SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -s "$SF_PGDATA/postmaster.pid" ]]; then
    "$PG_CTL_BIN" -D "$SF_PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
  case "$SF_TMP" in
    /tmp/storyforge-v5.integration.*) rm -rf -- "$SF_TMP" ;;
    *) echo "Refusing to remove unexpected temp path: $SF_TMP" >&2 ;;
  esac
  trap - EXIT INT TERM
  exit "$sf_exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

EVIDENCE_DIR="$(node "$PACKAGE_DIR/scripts/create-integration-evidence-dir.mjs")"
mkdir -p "$SF_PGSOCKET"
export STORYFORGE_INTEGRATION_WP_PORT="$SF_WP_PORT"
export STORYFORGE_INTEGRATION_WP_URL="http://127.0.0.1:$SF_WP_PORT"
export STORYFORGE_INTEGRATION_APP_PORT="$SF_APP_PORT"
export STORYFORGE_ROUTE_ENABLED=1
export STORYFORGE_INTEGRATION_PLAYWRIGHT_OUTPUT_DIR="$EVIDENCE_DIR/playwright-results"
export STORYFORGE_INTEGRATION_PLAYWRIGHT_REPORT_DIR="$EVIDENCE_DIR/playwright-report"

docker compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
STORYFORGE_EXPECTED_COMMIT="$SF_PRODUCT_COMMIT" npm run build:release --prefix "$PACKAGE_DIR"
npm run scan:secrets --prefix "$PACKAGE_DIR"
mkdir -p "$SF_WP_RUNTIME/releases/$SF_PRODUCT_COMMIT"
cp "$PACKAGE_DIR/infra/wordpress/missionmed-storyforge-runtime/release.php" \
  "$SF_WP_RUNTIME/releases/$SF_PRODUCT_COMMIT/release.php"
ln -s "releases/$SF_PRODUCT_COMMIT" "$SF_WP_RUNTIME/current"
export STORYFORGE_INTEGRATION_RUNTIME_DIR="$SF_WP_RUNTIME"

"$INITDB_BIN" -D "$SF_PGDATA" -A trust -U postgres --no-locale --encoding=UTF8 >/dev/null
"$PG_CTL_BIN" -D "$SF_PGDATA" -o "-p $SF_PG_PORT -k $SF_PGSOCKET -h 127.0.0.1" -w start >/dev/null
"$PSQL_BIN" -h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c "CREATE DATABASE storyforge" >/dev/null
PSQL_ARGS=(
  -h 127.0.0.1 -p "$SF_PG_PORT" -U postgres -d storyforge
  -v ON_ERROR_STOP=1
  --set=founder_user_id=11111111-1111-4111-8111-111111111111
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
"$PSQL_BIN" "${PSQL_ARGS[@]}" -c "UPDATE public.sf_mentor_assignments SET active = false" >/dev/null

docker compose -f "$COMPOSE_FILE" up -d db wordpress
for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:$SF_WP_PORT/wp-admin/install.php" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

wp() {
  docker compose -f "$COMPOSE_FILE" run --rm wpcli wp "$@"
}

wp core install \
  --url="http://127.0.0.1:${SF_WP_PORT}" \
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
"$PSQL_BIN" "${PSQL_ARGS[@]}" -c \
  "INSERT INTO public.sf_users (id, wp_user_id, display_name, role, eligible) VALUES ('$FOUNDER_STORYFORGE_ID', $FOUNDER_ID, 'Founder Integration', 'student', true)" \
  >/dev/null
"$PSQL_BIN" "${PSQL_ARGS[@]}" -c \
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

# The legacy B1-503 integration fixture performs scoped administrator setup
# through this database while exercising the runtime and WordPress seams.
export STORYFORGE_DATABASE_URL="postgresql://postgres@127.0.0.1:$SF_PG_PORT/storyforge"
export STORYFORGE_PORT="$SF_APP_PORT"
export STORYFORGE_HOST="0.0.0.0"
export STORYFORGE_PUBLIC_ORIGIN="http://127.0.0.1:$SF_WP_PORT"
export STORYFORGE_BASE_PATH="/storyforge/"
export STORYFORGE_MATRIX_BASE_URL="http://127.0.0.1:$SF_WP_PORT/member-dashboard/"
export STORYFORGE_ALLOWED_ORIGINS="http://127.0.0.1:$SF_WP_PORT"
export STORYFORGE_STATIC_DIR="dist"
export STORYFORGE_ORIGIN_API_ONLY=1
export STORYFORGE_JWT_SECRET="$SF_SECRET"
export STORYFORGE_JWT_ISSUER="$SF_ISSUER"
export STORYFORGE_JWT_AUDIENCE="storyforge"
export STORYFORGE_TOKEN_REFRESH_SKEW_SECONDS=1
unset STORYFORGE_DEV_AUTH STORYFORGE_DEV_JWT_SECRET

node "$PACKAGE_DIR/server/app.mjs" >"$SF_TMP/server.log" 2>&1 &
SF_SERVER_PID=$!

for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:$SF_WP_PORT/storyforge/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
if ! curl -fsS "http://127.0.0.1:$SF_WP_PORT/storyforge/healthz" >/dev/null; then
  curl -sS -D - "http://127.0.0.1:$SF_WP_PORT/storyforge/healthz" >&2 || true
  sed -n '1,220p' "$SF_TMP/server.log" >&2
  exit 1
fi

for attack_path in \
  '/storyforge/api/x/../../api/dev/session/student' \
  '/storyforge/%2e%2e/api/session' \
  '/storyforge/%252e%252e/api/session'; do
  ATTACK_CODE="$(curl --path-as-is -sS -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:$SF_WP_PORT$attack_path")"
  if [[ "$ATTACK_CODE" != "400" ]]; then
    echo "Gateway path attack check expected HTTP 400 for $attack_path, got $ATTACK_CODE." >&2
    exit 1
  fi
done
REPEATED_SLASH_CODE="$(curl --path-as-is -sS -o /dev/null -w '%{http_code}' --max-redirs 0 \
  "http://127.0.0.1:$SF_WP_PORT/storyforge//api/session")"
if [[ "$REPEATED_SLASH_CODE" != "308" ]]; then
  echo "Repeated-slash canonicalization expected HTTP 308, got $REPEATED_SLASH_CODE." >&2
  exit 1
fi
curl -sS -D "$SF_TMP/alternate-host.headers" -o /dev/null \
  -H 'Host: alternate.example.test' \
  "http://127.0.0.1:$SF_WP_PORT/storyforge/" || true
if rg -qi '^X-StoryForge-Route:' "$SF_TMP/alternate-host.headers"; then
  echo "StoryForge gateway claimed a noncanonical host." >&2
  exit 1
fi
dd if=/dev/zero of="$SF_TMP/oversize-request.json" bs=1048576 count=7 2>/dev/null
OVERSIZE_REQUEST_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Authorization: Bearer aaa.bbb.ccc' \
  -H 'Content-Type: application/json' \
  -H 'Transfer-Encoding: chunked' \
  --data-binary "@$SF_TMP/oversize-request.json" \
  "http://127.0.0.1:$SF_WP_PORT/storyforge/api/stories")"
if [[ "$OVERSIZE_REQUEST_CODE" != "413" ]]; then
  echo "Chunked request bound expected HTTP 413, got $OVERSIZE_REQUEST_CODE." >&2
  exit 1
fi

HASHED_ASSET="$(find "$PACKAGE_DIR/dist/assets" -maxdepth 1 -type f -name 'app.*.js' -exec basename {} \; | head -1)"
HASHED_FONT="$(find "$PACKAGE_DIR/dist/assets/fonts" -maxdepth 1 -type f -name 'archivo-normal.*.woff2' -exec basename {} \; | head -1)"
HASHED_ASSET_ALIAS="${HASHED_ASSET#app.}"
HASHED_ASSET_ALIAS="${HASHED_ASSET_ALIAS%.js}"
HASHED_FONT_ALIAS="${HASHED_FONT#archivo-normal.}"
HASHED_FONT_ALIAS="${HASHED_FONT_ALIAS%.woff2}"
ASSET_ALIAS_MANIFEST="$(node --input-type=module -e \
  'import { pathToFileURL } from "node:url"; const loaded = await import(pathToFileURL(process.argv[1]).href); process.stdout.write(JSON.stringify(loaded.default));' \
  "$PACKAGE_DIR/infra/edge/generated-asset-aliases.mjs")"
INDEX_ALIAS="$(shasum -a 256 "$PACKAGE_DIR/dist/index.html" | awk '{print substr($1,1,12)}')"
RELEASE_BUNDLE_RELATIVE="missionmed-storyforge-runtime/current/release.php"
if [[
  ! "$HASHED_ASSET_ALIAS" =~ ^[a-f0-9]{12}$
  || ! "$HASHED_FONT_ALIAS" =~ ^[a-f0-9]{12}$
  || ! "$INDEX_ALIAS" =~ ^[a-f0-9]{12}$
  || -z "$ASSET_ALIAS_MANIFEST"
]]; then
  echo "Generated StoryForge extensionless aliases are invalid." >&2
  exit 1
fi
if [[ ! -f "$SF_WP_RUNTIME/releases/$SF_PRODUCT_COMMIT/release.php" || ! -L "$SF_WP_RUNTIME/current" ]]; then
  echo "StoryForge integration release staging is incomplete." >&2
  exit 1
fi
MU_PLUGIN_FILES="$(wp eval 'require_once ABSPATH."wp-admin/includes/plugin.php";echo wp_json_encode(array_map("basename",wp_get_mu_plugins()));')"
if [[ "$MU_PLUGIN_FILES" != *'"missionmed-storyforge-route.php"'* || "$MU_PLUGIN_FILES" == *'"release.php"'* ]]; then
  echo "Nested StoryForge release bundle crossed the MU-plugin root autoload boundary." >&2
  exit 1
fi
export STORYFORGE_INTEGRATION_BASE_URL="http://127.0.0.1:$SF_WP_PORT"
export STORYFORGE_INTEGRATION_COMPOSE_FILE="$COMPOSE_FILE"
export STORYFORGE_INTEGRATION_FOUNDER_ID="$FOUNDER_ID"
export STORYFORGE_INTEGRATION_STUDENT_ID="$STUDENT_ID"
export STORYFORGE_INTEGRATION_USERNAME="localadmin"
export STORYFORGE_INTEGRATION_PASSWORD="local-admin-password"
export STORYFORGE_INTEGRATION_APP_ALIAS="$HASHED_ASSET_ALIAS"
export STORYFORGE_INTEGRATION_FONT_ALIAS="$HASHED_FONT_ALIAS"
export STORYFORGE_INTEGRATION_ASSET_ALIASES="$ASSET_ALIAS_MANIFEST"
export STORYFORGE_INTEGRATION_INDEX_ALIAS="$INDEX_ALIAS"
export STORYFORGE_INTEGRATION_DIST_DIR="$PACKAGE_DIR/dist"
export STORYFORGE_INTEGRATION_PRODUCT_COMMIT="$SF_PRODUCT_COMMIT"
export STORYFORGE_INTEGRATION_RELEASE_BUNDLE_PATH="/wp-content/mu-plugins/$RELEASE_BUNDLE_RELATIVE"
curl -sS -D - -o /dev/null --max-redirs 0 \
  "http://127.0.0.1:$SF_WP_PORT/member-dashboard/" \
  | tr -d '\r' \
  | sed '/^$/d' \
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

STORYFORGE_GATEWAY_MOCK_PORT="$SF_MOCK_PORT" \
  node "$PACKAGE_DIR/tests/fixtures/wordpress-gateway-origin.mjs" >"$SF_TMP/gateway-mock.log" 2>&1 &
SF_MOCK_PID=$!
for _ in {1..40}; do
  if lsof -nP -iTCP:"$SF_MOCK_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
export STORYFORGE_INTEGRATION_APP_PORT="$SF_MOCK_PORT"
docker compose -f "$COMPOSE_FILE" up -d --force-recreate wordpress >/dev/null
for _ in {1..80}; do
  if curl -sS "http://127.0.0.1:$SF_WP_PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

curl -sS -D "$SF_TMP/mock-echo.headers" -o "$SF_TMP/mock-echo.json" \
  -H 'Authorization: Bearer aaa.bbb.ccc' \
  -H 'Content-Type: application/json' \
  -H "Origin: http://127.0.0.1:$SF_WP_PORT" \
  -H 'Cookie: wordpress_logged_in=must-not-forward' \
  -H 'X-WP-Nonce: must-not-forward' \
  -H 'Referer: https://example.invalid/must-not-forward' \
  -H 'X-Forwarded-For: 192.0.2.1' \
  --data '{}' \
  "http://127.0.0.1:$SF_WP_PORT/storyforge/api/test-echo"
node -e '
  const fs = require("fs");
  const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const expected = {
    authorizationPresent: true,
    contentTypePresent: true,
    originPresent: true,
    cookiePresent: false,
    noncePresent: false,
    refererPresent: false,
    forwardedPresent: false,
    bodyBytes: 2,
  };
  if (JSON.stringify(value) !== JSON.stringify(expected)) process.exit(1);
' "$SF_TMP/mock-echo.json"
if rg -qi '^(Set-Cookie|Location):' "$SF_TMP/mock-echo.headers"; then
  echo "Gateway propagated a forbidden origin response header." >&2
  exit 1
fi

for mock_path in test-redirect test-invalid-json test-oversize test-timeout; do
  MOCK_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 \
    -H 'Authorization: Bearer aaa.bbb.ccc' \
    "http://127.0.0.1:$SF_WP_PORT/storyforge/api/$mock_path")"
  if [[ "$MOCK_CODE" != "502" ]]; then
    echo "Gateway mock failure check expected HTTP 502 for $mock_path, got $MOCK_CODE." >&2
    exit 1
  fi
done
kill "$SF_MOCK_PID" >/dev/null 2>&1 || true
wait "$SF_MOCK_PID" >/dev/null 2>&1 || true
SF_MOCK_PID=""
export STORYFORGE_INTEGRATION_APP_PORT="$SF_APP_PORT"
docker compose -f "$COMPOSE_FILE" up -d --force-recreate wordpress >/dev/null
for _ in {1..80}; do
  if curl -fsS "http://127.0.0.1:$SF_WP_PORT/storyforge/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

wp eval "\$s=mmsf_settings();\$s['storyforge_enabled']=false;update_option(MMSF_OPTION,\$s,false);"
FLAG_OFF_STATE="$(wp eval "\$u=get_user_by('id',$STUDENT_ID);wp_set_current_user(\$u->ID);\$state=mmsf_access_state(\$u);echo is_wp_error(\$state)?\$state->get_error_code():'allowed';")"
if [[ "$FLAG_OFF_STATE" != "storyforge_disabled" ]]; then
  echo "Flag-off rollback check expected storyforge_disabled, got $FLAG_OFF_STATE." >&2
  exit 1
fi

FLAG_OFF_API_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Authorization: Bearer aaa.bbb.ccc' \
  "http://127.0.0.1:$SF_WP_PORT/storyforge/api/session")"
if [[ "$FLAG_OFF_API_CODE" != "403" ]]; then
  echo "Feature-off gateway check expected HTTP 403, got $FLAG_OFF_API_CODE." >&2
  exit 1
fi

wp plugin deactivate missionmed-storyforge-sso >/dev/null
DEACTIVATED_FLAG="$(wp option get missionmed_storyforge_settings --format=json)"
if [[ "$DEACTIVATED_FLAG" != *'"storyforge_enabled":false'* ]]; then
  echo "Plugin deactivation did not force the feature flag off." >&2
  exit 1
fi

wp option update missionmed_storyforge_settings '{"storyforge_enabled":true}' --format=json >/dev/null
STALE_TRUE_API_CODE="$(curl -sS -o /dev/null -w '%{http_code}' \
  -H 'Authorization: Bearer aaa.bbb.ccc' \
  "http://127.0.0.1:$SF_WP_PORT/storyforge/api/session")"
if [[ "$STALE_TRUE_API_CODE" != "403" ]]; then
  echo "Missing-SSO fail-closed check expected HTTP 403, got $STALE_TRUE_API_CODE." >&2
  exit 1
fi

export STORYFORGE_ROUTE_ENABLED=0
docker compose -f "$COMPOSE_FILE" up -d --force-recreate wordpress >/dev/null
for _ in {1..80}; do
  if curl -sS "http://127.0.0.1:$SF_WP_PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
ROUTE_REMOVED_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$SF_WP_PORT/storyforge/")"
if [[ "$ROUTE_REMOVED_CODE" != "404" ]]; then
  echo "Route-removal rollback check expected WordPress 404, got $ROUTE_REMOVED_CODE." >&2
  exit 1
fi

{
  echo "default_off_shortcodes=empty"
  echo "flag_off_access_state=$FLAG_OFF_STATE"
  echo "flag_off_gateway_api_http=$FLAG_OFF_API_CODE"
  echo "missing_sso_stale_true_api_http=$STALE_TRUE_API_CODE"
  echo "gateway_mock_controls=pass"
  echo "path_attack_matrix=pass"
  echo "route_removed_wordpress_http=$ROUTE_REMOVED_CODE"
  echo "plugin_deactivation_forced_flag_off=true"
} >"$EVIDENCE_DIR/rollback-local-verification.txt"

TERMINAL_SOURCE_PROOF="$SF_TMP/terminal-source-proof.json"
node "$PACKAGE_DIR/scripts/assert-release-source.mjs" --mode=release \
  >"$TERMINAL_SOURCE_PROOF"
node "$PACKAGE_DIR/scripts/update-integration-evidence.mjs" \
  --status=complete \
  --directory="$EVIDENCE_DIR" \
  --terminal-proof="$TERMINAL_SOURCE_PROOF" \
  --dist="$PACKAGE_DIR/dist" \
  --route="$PACKAGE_DIR/infra/wordpress/missionmed-storyforge-route.php" \
  --release="$PACKAGE_DIR/infra/wordpress/missionmed-storyforge-runtime/release.php" \
  --edge="$PACKAGE_DIR/infra/edge/generated-asset-aliases.mjs" \
  --staged-release="$SF_WP_RUNTIME/releases/$SF_PRODUCT_COMMIT/release.php" \
  --current-link="$SF_WP_RUNTIME/current"
echo "StoryForge B1-503 release integration gates passed for $SF_PRODUCT_COMMIT."
echo "Collision-safe integration evidence: $EVIDENCE_DIR"
