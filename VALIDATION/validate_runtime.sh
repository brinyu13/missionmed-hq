#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/_SYSTEM/DEPLOY_MANIFEST.json"
LIVE_DIR="$ROOT_DIR/LIVE"
BASE_URL="${CDN_BASE_URL:-https://cdn.missionmedinstitute.com}"
TARGET_ENV="LIVE"
TIMEOUT="30"
CANONICAL_CDN_BASE_URL="https://cdn.missionmedinstitute.com"
CANONICAL_STAGING_PREFIX="html-system/STAGING/"
CANONICAL_LIVE_PREFIX="html-system/LIVE/"
WP_BASE_URL="${WP_BASE_URL:-https://missionmedinstitute.com}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      TARGET_ENV="$2"
      shift 2
      ;;
    --manifest)
      MANIFEST="$2"
      shift 2
      ;;
    --live-dir)
      LIVE_DIR="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

TARGET_ENV="$(echo "$TARGET_ENV" | tr '[:lower:]' '[:upper:]')"
if [[ "$TARGET_ENV" != "STAGING" && "$TARGET_ENV" != "LIVE" ]]; then
  echo "--env must be STAGING or LIVE" >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"
if [[ "$BASE_URL" != "$CANONICAL_CDN_BASE_URL" ]]; then
  echo "--base-url must be $CANONICAL_CDN_BASE_URL" >&2
  exit 2
fi

failures=0
pass() { echo "[PASS] $1"; }
warn() { echo "[WARN] $1"; }
fail() { echo "[FAIL] $1"; failures=$((failures+1)); }

require_contains_file() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if rg -q --fixed-strings "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

require_absent_file() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if rg -q --fixed-strings "$pattern" "$file"; then
    fail "$label"
  else
    pass "$label"
  fi
}

if [[ ! -s "$MANIFEST" ]]; then
  echo "Manifest missing: $MANIFEST" >&2
  exit 1
fi

MAPPINGS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && MAPPINGS+=("$line")
done < <(python3 - "$MANIFEST" "$TARGET_ENV" <<'PY'
import json, sys
manifest_path, env = sys.argv[1], sys.argv[2]
with open(manifest_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
for item in data.get('mappings', []):
    source = item['source']
    staging = item['destination']
    live = staging.replace('/STAGING/', '/LIVE/')
    dest = staging if env == 'STAGING' else live
    print(f"{source}\t{staging}\t{live}\t{dest}")
PY
)

if [[ ${#MAPPINGS[@]} -eq 0 ]]; then
  echo "No mappings in manifest" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for line in "${MAPPINGS[@]}"; do
  IFS=$'\t' read -r source staging_key live_key target_key <<<"$line"

  if [[ "$staging_key" != ${CANONICAL_STAGING_PREFIX}* ]]; then
    fail "Manifest STAGING key invalid (expected ${CANONICAL_STAGING_PREFIX}*): $staging_key"
    continue
  fi
  if [[ "$live_key" != ${CANONICAL_LIVE_PREFIX}* ]]; then
    fail "Manifest LIVE key invalid (expected ${CANONICAL_LIVE_PREFIX}*): $live_key"
    continue
  fi

  local_file="$ROOT_DIR/$source"
  remote_url="${BASE_URL%/}/${target_key}"
  remote_file="$TMP_DIR/$(basename "$target_key")"

  if [[ ! -s "$local_file" ]]; then
    fail "Local source missing: $local_file"
    continue
  fi

  http_code=$(curl --silent --show-error --location --max-time "$TIMEOUT" \
    --output "$remote_file" --write-out '%{http_code}' \
    "${remote_url}?cb=$(date +%s)") || http_code="000"

  if [[ "$http_code" != "200" ]]; then
    fail "CDN reachable check failed ($http_code): $remote_url"
    continue
  fi
  pass "CDN reachable: $remote_url"

  local_sha=$(shasum -a 256 "$local_file" | awk '{print $1}')
  remote_sha=$(shasum -a 256 "$remote_file" | awk '{print $1}')
  if [[ "$local_sha" == "$remote_sha" ]]; then
    pass "Checksum match: $target_key"
  else
    fail "Checksum mismatch: $target_key"
  fi

done

ARENA_REMOTE="$TMP_DIR/arena.html"
STAT_REMOTE="$TMP_DIR/stat.html"
DRILLS_REMOTE="$TMP_DIR/drills.html"
DAILY_REMOTE="$TMP_DIR/daily.html"
IVONCALL_REMOTE="$TMP_DIR/ivoncall.html"

for f in "$ARENA_REMOTE" "$STAT_REMOTE" "$DRILLS_REMOTE"; do
  if [[ -s "$f" ]]; then
    require_contains_file "$f" "window.MMOS" "MMOS present in $(basename "$f")"
    require_contains_file "$f" "MMOS.registerMode" "MMOS.registerMode present in $(basename "$f")"
  else
    fail "Downloaded file missing for MMOS check: $f"
  fi
done

if [[ -s "$DAILY_REMOTE" ]]; then
  if rg -q --fixed-strings "window.MMOS" "$DAILY_REMOTE"; then
    pass "Daily MMOS present (optional)"
  else
    pass "Daily MMOS absent (allowed)"
  fi
else
  fail "Downloaded file missing: $DAILY_REMOTE"
fi

if [[ -s "$ARENA_REMOTE" ]]; then
  require_contains_file "$ARENA_REMOTE" "STAT_CANONICAL_ROUTE = '/stat'" "Arena route to /stat intact"
  require_contains_file "$ARENA_REMOTE" "/drills?entry=daily_rounds" "Arena daily menu routing intact"
  require_contains_file "$ARENA_REMOTE" "IV_ON_CALL_CANONICAL_ROUTE = '/ivoncall.html'" "Arena IV On-Call routing intact"
  require_absent_file "$ARENA_REMOTE" "/dboc_interview_v1.html" "Arena legacy IV route removed"
fi

if [[ -s "$DAILY_REMOTE" ]]; then
  require_contains_file "$DAILY_REMOTE" "mm_selected_drill" "Daily contract payload marker present"
  require_contains_file "$DAILY_REMOTE" "/drills?video_id=" "Daily drill launch query marker present"
fi

if [[ -s "$IVONCALL_REMOTE" ]]; then
  require_contains_file "$IVONCALL_REMOTE" "/api/dboc/" "IV On-Call DBOC route markers present"
else
  fail "Downloaded file missing: $IVONCALL_REMOTE"
fi

if [[ -s "$DRILLS_REMOTE" ]]; then
  require_contains_file "$DRILLS_REMOTE" "No valid drill contract" "Drills contract guard marker present"
  require_contains_file "$DRILLS_REMOTE" "query.video_id" "Drills query.video_id path marker present"
fi

for f in "$ARENA_REMOTE" "$STAT_REMOTE" "$DAILY_REMOTE"; do
  if [[ -s "$f" ]]; then
    require_contains_file "$f" "/api/auth/exchange" "Auth exchange marker present in $(basename "$f")"
    require_contains_file "$f" "/api/auth/bootstrap" "Auth bootstrap marker present in $(basename "$f")"
  fi
done

for f in "$ARENA_REMOTE" "$STAT_REMOTE" "$DRILLS_REMOTE" "$DAILY_REMOTE" "$IVONCALL_REMOTE"; do
  if [[ -s "$f" ]]; then
    require_absent_file "$f" "plgndqcplokwiuimwhzh" "No deprecated Supabase project in $(basename "$f")"
  fi
done

if [[ "$TARGET_ENV" == "LIVE" ]]; then
  for page in arena stat drills daily ivoncall; do
    canonical_url="${CANONICAL_CDN_BASE_URL}/html-system/LIVE/${page}.html"
    canonical_code=$(curl --silent --show-error --location --max-time "$TIMEOUT" \
      --output /dev/null --write-out '%{http_code}' \
      "${canonical_url}?cb=$(date +%s)") || canonical_code="000"
    if [[ "$canonical_code" == "200" ]]; then
      pass "Canonical LIVE URL reachable: $canonical_url"
    else
      fail "Canonical LIVE URL failed ($canonical_code): $canonical_url"
    fi
  done

  WP_BASE_URL="${WP_BASE_URL%/}"
  proxy_endpoints=(
    "/arena"
    "/stat"
    "/drills"
    "/daily"
    "/ivoncall.html"
    "/drills?entry=daily_rounds"
  )
  for endpoint in "${proxy_endpoints[@]}"; do
    proxy_url="${WP_BASE_URL}${endpoint}"
    if [[ "$proxy_url" == *"?"* ]]; then
      probe_url="${proxy_url}&cb=$(date +%s)"
    else
      probe_url="${proxy_url}?cb=$(date +%s)"
    fi
    proxy_code=$(curl --silent --show-error --location --max-time "$TIMEOUT" \
      --output /dev/null --write-out '%{http_code}' \
      "$probe_url") || proxy_code="000"
    if [[ "$proxy_code" == "200" ]]; then
      pass "WordPress proxy reachable: $proxy_url"
    else
      fail "WordPress proxy failed ($proxy_code): $proxy_url"
    fi
  done
fi

AUTH_TMP="$TMP_DIR/auth_exchange.json"
auth_code=$(curl --silent --show-error --location --max-time "$TIMEOUT" \
  --output "$AUTH_TMP" --write-out '%{http_code}' \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{}' \
  'https://missionmedinstitute.com/api/auth/exchange') || auth_code="000"

if [[ "$auth_code" == "000" ]]; then
  fail "Auth exchange endpoint unreachable"
elif [[ "$auth_code" == "404" || "$auth_code" =~ ^5 ]]; then
  fail "Auth exchange endpoint unexpected status ($auth_code)"
else
  pass "Auth exchange endpoint reachable with expected status ($auth_code)"
fi

if [[ $failures -gt 0 ]]; then
  echo "[RESULT] validate_runtime ($TARGET_ENV): FAIL ($failures issue(s))"
  exit 1
fi

echo "[RESULT] validate_runtime ($TARGET_ENV): PASS"
