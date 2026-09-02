#!/usr/bin/env bash
# MissionMed Scheduler bundle publisher — MX-APPT-5002A
#
# Adds what _SYSTEM/deploy.sh does not provide for any app today:
#   - pre-publish hash verification against _SYSTEM/SCHEDULER_SOURCE_LOCK.json
#   - immutable content-hashed versioned artifact
#   - LIVE key kept as a thin alias of a versioned artifact
#   - post-publish hash verification of BOTH keys, re-fetched over the CDN
#   - rollback by repointing the alias at a prior version
#
# Scheduler-scoped ON PURPOSE. It does not touch Arena / STAT / Drills / Daily,
# and it does not modify the shared deploy pipeline those four depend on.
#
# DRY RUN BY DEFAULT. Publishing requires --publish. There is no way to publish
# by accident.
#
#   ./scheduler_publish.sh                 # verify + plan, no writes
#   ./scheduler_publish.sh --publish       # verify, publish, verify again
#   ./scheduler_publish.sh --capture-live-rollback
#   ./scheduler_publish.sh --rollback <sha12>
#   ./scheduler_publish.sh --list

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK="$ROOT_DIR/_SYSTEM/SCHEDULER_SOURCE_LOCK.json"
SOURCE_REL="LIVE/scheduler/scheduler_v1.html"
SOURCE="$ROOT_DIR/$SOURCE_REL"
CANONICAL_CDN="https://cdn.missionmedinstitute.com"
LIVE_KEY="html-system/LIVE/scheduler/scheduler_v1.html"
VERSION_PREFIX="html-system/LIVE/scheduler/versions"
PATCH_AUDIT="$ROOT_DIR/_SYSTEM/tools/scheduler_patch_audit.mjs"

DO_PUBLISH=0
ROLLBACK_TO=""
DO_LIST=0
SKIP_PATCH_AUDIT=0
CAPTURE_LIVE_ROLLBACK=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish)          DO_PUBLISH=1; shift ;;
    --rollback)         ROLLBACK_TO="${2:-}"; DO_PUBLISH=1; shift 2 ;;
    --capture-live-rollback) CAPTURE_LIVE_ROLLBACK=1; shift ;;
    --list)             DO_LIST=1; shift ;;
    --skip-patch-audit) SKIP_PATCH_AUDIT=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

log()  { echo "[SCHED-PUB] $1"; }
fail() { echo "[SCHED-PUB][FAIL] $1" >&2; exit 1; }

sha256_file() { shasum -a 256 "$1" | awk '{print $1}'; }

json_get() { python3 -c "
import json,sys
d=json.load(open('$LOCK'))
cur=d
for k in sys.argv[1].split('.'):
    cur=cur[k]
print(cur)" "$1"; }

# ---------------------------------------------------------------- R2 plumbing
load_r2_env() {
  if [[ -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then return 0; fi
  local shared_env="$ROOT_DIR/_SYSTEM/r2.env"
  if [[ -f "$shared_env" ]]; then set -a; . "$shared_env"; set +a; fi
  local key_file="$ROOT_DIR/cloudflare key.txt"
  if [[ -f "$key_file" ]]; then
    set -a
    eval "$(grep -E '^export R2_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|ACCOUNT_ID|ENDPOINT_URL|BUCKET|REGION|CDN_BASE_URL)=' "$key_file" | head -n 7)"
    set +a
  fi
  [[ -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]] \
    || fail "Missing R2 credentials. Expected in env, $ROOT_DIR/_SYSTEM/r2.env, or '$ROOT_DIR/cloudflare key.txt'"
}
r2_region() { echo "${R2_REGION:-auto}"; }
r2_bucket() { echo "${R2_BUCKET:-missionmed-videos}"; }
r2_endpoint() {
  if [[ -n "${R2_ENDPOINT_URL:-}" ]]; then echo "${R2_ENDPOINT_URL%/}"; return; fi
  if [[ -n "${R2_ACCOUNT_ID:-}" ]]; then echo "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"; return; fi
  fail "Missing R2_ENDPOINT_URL or R2_ACCOUNT_ID"
}
cdn_base() {
  local base="${R2_CDN_BASE_URL:-$CANONICAL_CDN}"; base="${base%/}"
  [[ "$base" == "$CANONICAL_CDN" ]] || fail "Invalid R2_CDN_BASE_URL: $base (must be $CANONICAL_CDN)"
  echo "$base"
}
r2_request() {
  curl --silent --show-error --fail --max-time 60 \
    --aws-sigv4 "aws:amz:$(r2_region):s3" \
    --user "${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}" "$@"
}
r2_put_html() {
  r2_request --request PUT \
    --header 'Content-Type: text/html; charset=utf-8' \
    --header 'Cache-Control: no-cache, no-store, must-revalidate' \
    --upload-file "$1" "$(r2_endpoint)/$(r2_bucket)/$2" --output /dev/null
}
r2_copy_object() {
  r2_request --request PUT \
    --header "x-amz-copy-source: /$(r2_bucket)/$1" \
    --header 'x-amz-metadata-directive: REPLACE' \
    --header 'Content-Type: text/html; charset=utf-8' \
    --header 'Cache-Control: no-cache, no-store, must-revalidate' \
    "$(r2_endpoint)/$(r2_bucket)/$2" --output /dev/null
}
r2_list_versions() {
  r2_request --request GET \
    "$(r2_endpoint)/$(r2_bucket)?list-type=2&prefix=${VERSION_PREFIX}/" \
  | grep -oE '<Key>[^<]+</Key>' | sed 's|</\?Key>||g'
}

# Re-fetch over the public CDN (not the S3 API) so we verify what a student gets.
verify_published_hash() {
  local key="$1" expect="$2" label="$3" tmp got
  tmp="$(mktemp)"
  curl --silent --show-error --fail --max-time 60 --compressed \
       --output "$tmp" "$(cdn_base)/${key}?verify=$(date +%s)" \
    || { rm -f "$tmp"; fail "$label: could not fetch $(cdn_base)/${key}"; }
  got="$(sha256_file "$tmp")"; rm -f "$tmp"
  if [[ "$got" == "$expect" ]]; then
    log "$label: hash verified $got"
  else
    fail "$label: HASH MISMATCH
  key      $key
  expected $expect
  actual   $got"
  fi
}

# ---------------------------------------------------------------- operations
[[ -s "$LOCK" ]]   || fail "Source lock missing: $LOCK"
[[ -s "$SOURCE" ]] || fail "Canonical source missing: $SOURCE"

if [[ "$DO_LIST" -eq 1 ]]; then
  load_r2_env
  log "Published versions under ${VERSION_PREFIX}/:"
  r2_list_versions | sed 's/^/  /' || log "  (none, or listing not permitted)"
  exit 0
fi

if [[ "$CAPTURE_LIVE_ROLLBACK" -eq 1 ]]; then
  load_r2_env
  expected_hash="$(json_get adoption.adopted_sha256)"
  version_key="${VERSION_PREFIX}/scheduler_v1.${expected_hash:0:12}.html"
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' EXIT

  log "CAPTURE LIVE ROLLBACK: fetching current public alias"
  curl --silent --show-error --fail --max-time 60 --compressed \
       --output "$tmp" "$(cdn_base)/${LIVE_KEY}?capture=$(date +%s)" \
    || fail "Could not fetch current public LIVE alias"
  actual_hash="$(sha256_file "$tmp")"
  [[ "$actual_hash" == "$expected_hash" ]] \
    || fail "Current LIVE alias does not match adopted rollback hash (expected $expected_hash, got $actual_hash)"

  existing="$(mktemp)"
  if curl --silent --show-error --fail --max-time 60 --compressed \
      --output "$existing" "$(cdn_base)/${version_key}?verify=$(date +%s)" 2>/dev/null; then
    existing_hash="$(sha256_file "$existing")"
    rm -f "$existing"
    [[ "$existing_hash" == "$expected_hash" ]] \
      || fail "Existing immutable key has unexpected content (expected $expected_hash, got $existing_hash)"
    log "Immutable rollback already exists and is hash-correct: $version_key"
  else
    rm -f "$existing"
    r2_put_html "$tmp" "$version_key"
    log "Wrote immutable rollback: $version_key"
  fi

  verify_published_hash "$version_key" "$expected_hash" "ROLLBACK artifact"
  log "CAPTURE COMPLETE — LIVE alias was not changed"
  exit 0
fi

if [[ -n "$ROLLBACK_TO" ]]; then
  [[ "$ROLLBACK_TO" =~ ^[0-9a-f]{12}$ ]] || fail "Rollback target must be a 12-char sha256 prefix, got: $ROLLBACK_TO"
  load_r2_env
  TARGET_KEY="${VERSION_PREFIX}/scheduler_v1.${ROLLBACK_TO}.html"
  log "ROLLBACK: repointing LIVE alias -> $TARGET_KEY"
  tmp="$(mktemp)"
  curl --silent --show-error --fail --max-time 60 --compressed \
       --output "$tmp" "$(cdn_base)/${TARGET_KEY}?verify=$(date +%s)" \
    || { rm -f "$tmp"; fail "Rollback target not published: $TARGET_KEY"; }
  target_hash="$(sha256_file "$tmp")"; rm -f "$tmp"
  [[ "$target_hash" == "$ROLLBACK_TO"* ]] \
    || fail "Rollback target content does not match its own name (got $target_hash)"
  r2_copy_object "$TARGET_KEY" "$LIVE_KEY"
  sleep 2
  verify_published_hash "$LIVE_KEY" "$target_hash" "POST-ROLLBACK LIVE alias"
  log "ROLLBACK COMPLETE -> $target_hash"
  exit 0
fi

# ---- Step 1/5: pre-publish hash verification
log "Step 1/5: pre-publish verification"
LOCKED_HASH="$(json_get adoption.adopted_sha256)"
ACTUAL_HASH="$(sha256_file "$SOURCE")"
VER12="${ACTUAL_HASH:0:12}"
VERSION_KEY="${VERSION_PREFIX}/scheduler_v1.${VER12}.html"

log "  source        $SOURCE_REL"
log "  sha256        $ACTUAL_HASH"
log "  adopted       $LOCKED_HASH"
if [[ "$ACTUAL_HASH" == "$LOCKED_HASH" ]]; then
  log "  state         UNMODIFIED (byte-identical to the adopted production baseline)"
else
  log "  state         MODIFIED since adoption"
  python3 - "$LOCK" "$ACTUAL_HASH" <<'PY' || fail "Modified source is not recorded in the lock history. Add a history entry with this sha256 before publishing."
import json,sys
d=json.load(open(sys.argv[1]))
if not any(h.get('sha256')==sys.argv[2] for h in d.get('history',[])):
    sys.exit(1)
print("[SCHED-PUB]   history       entry found for this sha256")
PY
fi

# ---- Step 2/5: patch integrity audit
log "Step 2/5: adapter patch integrity audit"
if [[ "$SKIP_PATCH_AUDIT" -eq 1 ]]; then
  log "  SKIPPED (--skip-patch-audit)"
elif [[ -f "$PATCH_AUDIT" ]]; then
  node "$PATCH_AUDIT" --bundle "$SOURCE" --quiet \
    || fail "Patch audit reported a REQUIRED patch failure against this source. Refusing to publish."
  log "  patch audit   PASS"
else
  fail "Patch audit script missing: $PATCH_AUDIT (run with --skip-patch-audit to override, at your own risk)"
fi

# ---- Step 3/5: plan
log "Step 3/5: publish plan"
log "  versioned ->  $(cdn_base)/$VERSION_KEY"
log "  alias     ->  $(cdn_base)/$LIVE_KEY"

if [[ "$DO_PUBLISH" -ne 1 ]]; then
  log "DRY RUN — nothing was written. Re-run with --publish to execute."
  exit 0
fi

# ---- Step 4/5: publish
load_r2_env
log "Step 4/5: publishing"
r2_put_html "$SOURCE" "$VERSION_KEY"; log "  wrote immutable version: $VERSION_KEY"
r2_copy_object "$VERSION_KEY" "$LIVE_KEY"; log "  repointed alias:         $LIVE_KEY"

# ---- Step 5/5: post-publish hash verification
log "Step 5/5: post-publish verification"
sleep 2
verify_published_hash "$VERSION_KEY" "$ACTUAL_HASH" "POST-PUBLISH versioned artifact"
verify_published_hash "$LIVE_KEY"    "$ACTUAL_HASH" "POST-PUBLISH LIVE alias"

log "PUBLISH COMPLETE"
log "  version  $VER12"
log "  rollback ./scheduler_publish.sh --rollback <previous-sha12>"
