#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://www.theresidencyacademy.com}"
ROUTE_PATH="${ROUTE_PATH:-/daily-drills-live-webex-v3/}"
LEGACY_PATH="${LEGACY_PATH:-/daily-drills-live-webex-preview/}"
FAST_ENDPOINT_PATH="${FAST_ENDPOINT_PATH:-/wp-content/plugins/missionmed-hub/assets/daily-drills-team-challenge-v3-action.php?mmed_v3_state=1}"
MANIFEST_PATH="${MANIFEST_PATH:-_AI_HANDOFFS/manifests/DRILLS_LIVE_MANIFEST.tsv}"
LAUNCHER_PATH="${LAUNCHER_PATH:-/Users/brianb/MissionMed/LIVE/arena.html}"
LAUNCHER_SHA256="${LAUNCHER_SHA256:-}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

failures=0

note() {
  printf '[v3-smoke] %s\n' "$*"
}

fail() {
  failures=$((failures + 1))
  printf '[v3-smoke][FAIL] %s\n' "$*" >&2
}

ok() {
  printf '[v3-smoke][OK] %s\n' "$*"
}

url_join() {
  local base="${1%/}"
  local path="$2"
  if [[ "$path" == /* ]]; then
    printf '%s%s' "$base" "$path"
  else
    printf '%s/%s' "$base" "$path"
  fi
}

fetch_body() {
  local url="$1"
  local out="$2"
  local code
  code="$(curl -fsSL -w '%{http_code}' -o "$out" "$url" || true)"
  printf '%s' "$code"
}

fetch_headers() {
  local url="$1"
  local out="$2"
  curl -fsSI "$url" -o "$out" || true
}

route_url="$(url_join "$BASE_URL" "$ROUTE_PATH")"
route_body="$tmp_dir/route.html"
route_code="$(fetch_body "$route_url" "$route_body")"
if [[ "$route_code" == "200" ]]; then
  ok "route render returned HTTP 200"
else
  fail "route render returned HTTP ${route_code:-none}: $route_url"
fi

for asset_name in daily-drills-live-webex-v3-embed.js daily-drills-live-webex-sdk-v3.js daily-drills-team-challenge-v3.js daily-drills-team-challenge-v3-studentflow.js; do
  if grep -q "$asset_name" "$route_body"; then
    ok "route references $asset_name"
  else
    fail "route does not reference $asset_name"
  fi
done

if [[ -f "$MANIFEST_PATH" ]]; then
  note "checking public asset hashes from $MANIFEST_PATH"
  while IFS=$'\t' read -r relative_path expected_sha _rest; do
    [[ -z "${relative_path:-}" || "$relative_path" == "relative_path" ]] && continue
    [[ "$relative_path" != wp-content/plugins/missionmed-hub/assets/* ]] && continue
    asset_url="$(url_join "$BASE_URL" "/$relative_path")"
    asset_out="$tmp_dir/$(basename "$relative_path")"
    asset_code="$(fetch_body "$asset_url" "$asset_out")"
    if [[ "$asset_code" != "200" ]]; then
      fail "asset fetch returned HTTP ${asset_code:-none}: $asset_url"
      continue
    fi
    actual_sha="$(sha256sum "$asset_out" | awk '{print $1}')"
    if [[ "$actual_sha" == "$expected_sha" ]]; then
      ok "asset hash matched $relative_path"
    else
      fail "asset hash mismatch $relative_path expected=$expected_sha actual=$actual_sha"
    fi
  done < "$MANIFEST_PATH"
else
  fail "manifest not found: $MANIFEST_PATH"
fi

fast_url="$(url_join "$BASE_URL" "$FAST_ENDPOINT_PATH")"
fast_body="$tmp_dir/fast.json"
fast_headers="$tmp_dir/fast.headers"
fast_code="$(fetch_body "$fast_url" "$fast_body")"
fetch_headers "$fast_url" "$fast_headers"
if [[ "$fast_code" == "200" ]]; then
  ok "fast endpoint returned HTTP 200"
else
  fail "fast endpoint returned HTTP ${fast_code:-none}: $fast_url"
fi
if grep -qi '^cache-control:.*no-store' "$fast_headers"; then
  ok "fast endpoint cache-control includes no-store"
else
  fail "fast endpoint cache-control does not include no-store"
fi

legacy_url="$(url_join "$BASE_URL" "$LEGACY_PATH")"
legacy_headers="$tmp_dir/legacy.headers"
fetch_headers "$legacy_url" "$legacy_headers"
if grep -qi '^x-missionmed-preview: *WEBEX-034' "$legacy_headers"; then
  ok "legacy preview header WEBEX-034 intact"
else
  fail "legacy preview header WEBEX-034 missing"
fi

if [[ -f "$LAUNCHER_PATH" ]]; then
  if [[ -n "$LAUNCHER_SHA256" ]]; then
    launcher_actual="$(sha256sum "$LAUNCHER_PATH" | awk '{print $1}')"
    if [[ "$launcher_actual" == "$LAUNCHER_SHA256" ]]; then
      ok "launcher hash matches expected"
    else
      fail "launcher hash mismatch expected=$LAUNCHER_SHA256 actual=$launcher_actual"
    fi
  else
    if grep -q '/daily-drills-live-webex-preview/' "$LAUNCHER_PATH" && ! grep -q '/daily-drills-live-webex-v3/' "$LAUNCHER_PATH"; then
      ok "launcher still points to legacy preview and not V3 route"
    else
      fail "launcher route pointer check failed"
    fi
  fi
else
  fail "launcher file not found: $LAUNCHER_PATH"
fi

if [[ "$failures" -gt 0 ]]; then
  note "$failures smoke check(s) failed"
  exit 1
fi

note "all smoke checks passed"
