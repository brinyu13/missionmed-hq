#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT_DIR/_SYSTEM/DEPLOY_MANIFEST.json"
VALIDATE_DEPLOY="$ROOT_DIR/VALIDATION/validate_deploy.sh"
VALIDATE_RUNTIME="$ROOT_DIR/VALIDATION/validate_runtime.sh"
LIVE_DIR="$ROOT_DIR/LIVE"
SKIP_GIT_CHECK=0
SKIP_PURGE=0
PROMPT_ID="${PROMPT_ID:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-git-check)
      SKIP_GIT_CHECK=1
      shift
      ;;
    --skip-purge)
      SKIP_PURGE=1
      shift
      ;;
    --manifest)
      MANIFEST="$2"
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

log() { echo "[DEPLOY] $1"; }

if [[ ! -x "$VALIDATE_DEPLOY" || ! -x "$VALIDATE_RUNTIME" ]]; then
  echo "Validation scripts missing or not executable" >&2
  exit 1
fi

if [[ ! -s "$MANIFEST" ]]; then
  echo "Manifest missing: $MANIFEST" >&2
  exit 1
fi

load_r2_env() {
  if [[ -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" ]]; then
    return 0
  fi

  local shared_env="$ROOT_DIR/_SYSTEM/r2.env"
  if [[ -f "$shared_env" ]]; then
    # shellcheck disable=SC1090
    set -a
    . "$shared_env"
    set +a
  fi

  local key_file="$ROOT_DIR/cloudflare key.txt"
  if [[ -f "$key_file" ]]; then
    # shellcheck disable=SC1090
    set -a
    eval "$(grep -E '^export R2_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|ACCOUNT_ID|ENDPOINT_URL|BUCKET|REGION|CDN_BASE_URL)=' "$key_file" | head -n 7)"
    set +a
  fi

  if [[ -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" ]]; then
    echo "Missing R2 credentials (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)." >&2
    echo "Expected in env, $ROOT_DIR/_SYSTEM/r2.env, or $ROOT_DIR/cloudflare key.txt" >&2
    exit 1
  fi
}

ensure_git_gate() {
  [[ "$SKIP_GIT_CHECK" -eq 1 ]] && { log "Skipping git gate (--skip-git-check)"; return 0; }

  if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Not a git repository: $ROOT_DIR" >&2
    exit 1
  fi

  local scope=(
    LIVE/arena.html
    LIVE/stat.html
    LIVE/drills.html
    LIVE/daily.html
    CHANGELOG/CHANGELOG.md
    _SYSTEM/DEPLOY_MANIFEST.json
    VALIDATION/validate_deploy.sh
    VALIDATION/validate_runtime.sh
    _SYSTEM/deploy.sh
    _SYSTEM/rollback.sh
  )

  if ! git -C "$ROOT_DIR" diff --quiet -- "${scope[@]}"; then
    echo "Git gate failed: unstaged changes in deploy scope" >&2
    exit 1
  fi

  if ! git -C "$ROOT_DIR" diff --cached --quiet -- "${scope[@]}"; then
    echo "Git gate failed: staged but uncommitted changes in deploy scope" >&2
    exit 1
  fi

  if git -C "$ROOT_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    git -C "$ROOT_DIR" fetch --quiet origin || true
    local head_hash upstream_hash
    head_hash="$(git -C "$ROOT_DIR" rev-parse HEAD)"
    upstream_hash="$(git -C "$ROOT_DIR" rev-parse '@{u}')"
    if [[ "$head_hash" != "$upstream_hash" ]]; then
      echo "Git gate failed: HEAD is not synced to upstream. Push to GitHub before deploy." >&2
      exit 1
    fi
    log "GitHub gate passed (HEAD synced to upstream)"
  else
    echo "Git gate failed: no upstream branch configured; cannot enforce GitHub->CDN rule." >&2
    exit 1
  fi
}

r2_region() { echo "${R2_REGION:-auto}"; }
r2_bucket() { echo "${R2_BUCKET:-missionmed-videos}"; }
r2_endpoint() {
  if [[ -n "${R2_ENDPOINT_URL:-}" ]]; then
    echo "${R2_ENDPOINT_URL%/}"
    return
  fi
  if [[ -n "${R2_ACCOUNT_ID:-}" ]]; then
    echo "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    return
  fi
  echo "Missing R2_ENDPOINT_URL or R2_ACCOUNT_ID" >&2
  exit 1
}

cdn_base_url() {
  if [[ -n "${R2_CDN_BASE_URL:-}" ]]; then
    echo "${R2_CDN_BASE_URL%/}"
  else
    echo "https://cdn.missionmedinstitute.com"
  fi
}

r2_request() {
  curl --silent --show-error --fail --max-time 60 \
    --aws-sigv4 "aws:amz:$(r2_region):s3" \
    --user "${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}" \
    "$@"
}

r2_put_html() {
  local local_file="$1"
  local object_key="$2"
  r2_request \
    --request PUT \
    --header 'Content-Type: text/html; charset=utf-8' \
    --header 'Cache-Control: no-cache, no-store, must-revalidate' \
    --upload-file "$local_file" \
    "$(r2_endpoint)/$(r2_bucket)/${object_key}" \
    --output /dev/null
}

r2_copy_object() {
  local src_key="$1"
  local dst_key="$2"
  r2_request \
    --request PUT \
    --header "x-amz-copy-source: /$(r2_bucket)/${src_key}" \
    --header 'x-amz-metadata-directive: REPLACE' \
    --header 'Content-Type: text/html; charset=utf-8' \
    --header 'Cache-Control: no-cache, no-store, must-revalidate' \
    "$(r2_endpoint)/$(r2_bucket)/${dst_key}" \
    --output /dev/null
}

r2_probe_object() {
  local key="$1"
  local code
  code=$(curl --silent --show-error --max-time 30 \
    --aws-sigv4 "aws:amz:$(r2_region):s3" \
    --user "${R2_ACCESS_KEY_ID}:${R2_SECRET_ACCESS_KEY}" \
    --header 'Range: bytes=0-0' \
    --output /dev/null \
    --write-out '%{http_code}' \
    "$(r2_endpoint)/$(r2_bucket)/${key}")
  if [[ "$code" == "200" || "$code" == "206" || "$code" == "416" ]]; then
    return 0
  fi
  return 1
}

backup_live_snapshot() {
  local ts backup_dir
  ts="$(date +%Y-%m-%d_%H%M%S)"
  backup_dir="$ROOT_DIR/BACKUPS/deploy_pre_${ts}"
  mkdir -p "$backup_dir"
  cp -p "$LIVE_DIR"/*.html "$backup_dir/"
  log "Backup snapshot created: $backup_dir"
}

purge_cache() {
  local urls_json
  urls_json="$1"

  if [[ "$SKIP_PURGE" -eq 1 ]]; then
    log "Skipping cache purge (--skip-purge)"
    return 0
  fi

  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ZONE_ID:-}" ]]; then
    local response
    response=$(curl --silent --show-error --fail \
      --request POST \
      --url "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
      --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      --header 'Content-Type: application/json' \
      --data "{\"files\":${urls_json}}") || {
      echo "Cloudflare purge API call failed" >&2
      exit 1
    }
    if echo "$response" | rg -q '"success":true'; then
      log "Cloudflare cache purge: PASS"
      return 0
    fi
    echo "Cloudflare purge API did not return success=true" >&2
    exit 1
  fi

  log "Cloudflare purge token unavailable; running cache-busted fetch fallback"
  while IFS= read -r url; do
    curl --silent --show-error --fail --max-time 20 --output /dev/null "${url}?purge_fallback=$(date +%s)"
  done < <(python3 - "$urls_json" <<'PY'
import json, sys
for u in json.loads(sys.argv[1]):
    print(u)
PY
)
}

MAPPINGS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && MAPPINGS+=("$line")
done < <(python3 - "$MANIFEST" <<'PY'
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
for item in data.get('mappings', []):
    src = item['source']
    staging = item['destination']
    live = staging.replace('/STAGING/', '/LIVE/')
    print(f"{src}\t{staging}\t{live}")
PY
)

if [[ ${#MAPPINGS[@]} -eq 0 ]]; then
  echo "No mappings found in manifest" >&2
  exit 1
fi

log "Step 0/5: Local deploy validation"
validate_args=(--live-dir "$LIVE_DIR")
if [[ -n "$PROMPT_ID" ]]; then
  validate_args+=(--prompt-id "$PROMPT_ID")
fi
"$VALIDATE_DEPLOY" "${validate_args[@]}"

ensure_git_gate
load_r2_env
backup_live_snapshot

log "Step 1/5: Upload LIVE -> STAGING"
for line in "${MAPPINGS[@]}"; do
  IFS=$'\t' read -r src staging live <<<"$line"
  local_file="$ROOT_DIR/$src"
  [[ -s "$local_file" ]] || { echo "Missing source file: $local_file" >&2; exit 1; }
  r2_put_html "$local_file" "$staging"
  if r2_probe_object "$staging"; then
    log "Uploaded: $src -> $staging"
  else
    echo "Failed to verify uploaded STAGING object: $staging" >&2
    exit 1
  fi
done

log "Step 2/5: Validate STAGING"
"$VALIDATE_RUNTIME" --env STAGING --manifest "$MANIFEST" --live-dir "$LIVE_DIR" --base-url "$(cdn_base_url)"

log "Step 3/5: Promote STAGING -> LIVE"
for line in "${MAPPINGS[@]}"; do
  IFS=$'\t' read -r src staging live <<<"$line"
  r2_copy_object "$staging" "$live"
  if r2_probe_object "$live"; then
    log "Promoted: $staging -> $live"
  else
    echo "Failed to verify promoted LIVE object: $live" >&2
    exit 1
  fi
done

LIVE_URLS_JSON="$(python3 - "$MANIFEST" "$(cdn_base_url)" <<'PY'
import json, sys
manifest, base = sys.argv[1], sys.argv[2].rstrip('/')
with open(manifest, 'r', encoding='utf-8') as f:
    data = json.load(f)
urls = []
for item in data.get('mappings', []):
    live = item['destination'].replace('/STAGING/', '/LIVE/')
    urls.append(f"{base}/{live}")
print(json.dumps(urls))
PY
)"

log "Step 4/5: Purge cache"
purge_cache "$LIVE_URLS_JSON"

log "Step 5/5: Verify LIVE"
"$VALIDATE_RUNTIME" --env LIVE --manifest "$MANIFEST" --live-dir "$LIVE_DIR" --base-url "$(cdn_base_url)"

log "Deployment pipeline completed successfully"
