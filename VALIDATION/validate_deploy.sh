#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_DIR="$ROOT_DIR/LIVE"
PROMPT_ID="${PROMPT_ID:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --live-dir)
      LIVE_DIR="$2"
      shift 2
      ;;
    --prompt-id)
      PROMPT_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

failures=0

pass() { echo "[PASS] $1"; }
warn() { echo "[WARN] $1"; }
fail() { echo "[FAIL] $1"; failures=$((failures+1)); }

require_file() {
  local file="$1"
  if [[ -s "$file" ]]; then
    pass "Exists: $file"
  else
    fail "Missing or empty: $file"
  fi
}

require_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if rg -q --fixed-strings "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

require_regex() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if rg -q "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

require_absent() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if rg -q --fixed-strings "$pattern" "$file"; then
    fail "$label"
  else
    pass "$label"
  fi
}

ARENA="$LIVE_DIR/arena.html"
STAT="$LIVE_DIR/stat.html"
DRILLS="$LIVE_DIR/drills.html"
DAILY="$LIVE_DIR/daily.html"

require_file "$ARENA"
require_file "$STAT"
require_file "$DRILLS"
require_file "$DAILY"

for f in "$ARENA" "$STAT" "$DRILLS" "$DAILY"; do
  require_regex "$f" '</html>|</HTML>' "HTML closes correctly: $(basename "$f")"
done

# MMOS presence (Daily optional)
require_contains "$ARENA" "window.MMOS" "Arena has MMOS"
require_contains "$ARENA" "MMOS.registerMode" "Arena registers MMOS mode(s)"
require_contains "$STAT" "window.MMOS" "STAT has MMOS"
require_contains "$STAT" "MMOS.registerMode" "STAT registers MMOS mode(s)"
require_contains "$DRILLS" "window.MMOS" "Drills has MMOS"
require_contains "$DRILLS" "MMOS.registerMode" "Drills registers MMOS mode(s)"
if rg -q --fixed-strings "window.MMOS" "$DAILY"; then
  pass "Daily MMOS present (optional)"
else
  pass "Daily MMOS absent (allowed)"
fi

# Routing integrity
require_contains "$ARENA" "STAT_CANONICAL_ROUTE = '/stat'" "Arena routes to /stat"
require_contains "$ARENA" "/drills?entry=daily_rounds" "Arena routes Daily launch to /drills?entry=daily_rounds"
require_contains "$ARENA" "/drills?video_id=" "Arena preserves drill contract route"
require_contains "$DAILY" "/drills?video_id=" "Daily launches drills with video_id"
require_contains "$DAILY" "mm_selected_drill" "Daily writes contract payload"
require_contains "$DRILLS" "No valid drill contract" "Drills enforces contract guard"
require_contains "$DRILLS" "query.video_id" "Drills accepts query.video_id contract path"
require_contains "$DRILLS" "daily.html" "Drills knows Daily return path"

# Contract flow markers
require_contains "$DAILY" "buildLaunchPayload" "Daily has launch payload builder"
require_contains "$DRILLS" "attemptSource(\"mm_selected_drill\"" "Drills reads mm_selected_drill contract source"

# Auth endpoints + project lock
for f in "$ARENA" "$STAT" "$DAILY"; do
  require_contains "$f" "/api/auth/exchange" "Auth exchange endpoint present in $(basename "$f")"
  require_contains "$f" "/api/auth/bootstrap" "Auth bootstrap endpoint present in $(basename "$f")"
  require_contains "$f" "fglyvdykwgbuivikqoah" "Correct Supabase project in $(basename "$f")"
done

for f in "$ARENA" "$STAT" "$DRILLS" "$DAILY"; do
  require_absent "$f" "plgndqcplokwiuimwhzh" "No deprecated Supabase project in $(basename "$f")"
  require_absent "$f" "supabase.auth.signUp" "No forbidden signUp flow in $(basename "$f")"
  require_absent "$f" "service_role" "No service role key string in $(basename "$f")"
done

# Changelog gate
CHANGELOG_FILE="$ROOT_DIR/CHANGELOG/CHANGELOG.md"
require_file "$CHANGELOG_FILE"
require_regex "$CHANGELOG_FILE" '^## \[[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} UTC\]' "Changelog has timestamped entries"
if [[ -n "$PROMPT_ID" ]]; then
  require_contains "$CHANGELOG_FILE" "$PROMPT_ID" "Changelog references prompt ID $PROMPT_ID"
else
  warn "PROMPT_ID not provided; skipping prompt-specific changelog check"
fi

if [[ $failures -gt 0 ]]; then
  echo "[RESULT] validate_deploy: FAIL ($failures issue(s))"
  exit 1
fi

echo "[RESULT] validate_deploy: PASS"
