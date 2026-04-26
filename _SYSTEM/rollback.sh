#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SCRIPT="$ROOT_DIR/_SYSTEM/deploy.sh"
VALIDATE_DEPLOY="$ROOT_DIR/VALIDATION/validate_deploy.sh"
VALIDATE_RUNTIME="$ROOT_DIR/VALIDATION/validate_runtime.sh"
TARGET_HASH=""
PROMPT_ID="${PROMPT_ID:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET_HASH="$2"
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

log() { echo "[ROLLBACK] $1"; }

restore_live_from_commit() {
  local hash="$1"
  local live_has_layout=1

  for p in LIVE/arena_v1.html LIVE/stat_latest.html LIVE/drills_v1.html LIVE/mode_dailyrounds_v1.html; do
    if ! git -C "$ROOT_DIR" cat-file -e "${hash}:${p}" 2>/dev/null; then
      live_has_layout=0
      break
    fi
  done

  mkdir -p "$ROOT_DIR/LIVE"

  if [[ "$live_has_layout" -eq 1 ]]; then
    git -C "$ROOT_DIR" checkout "$hash" -- LIVE
    return
  fi

  log "Target commit uses legacy root layout; reconstructing /LIVE from canonical legacy paths"
  git -C "$ROOT_DIR" show "${hash}:arena_v1.html" > "$ROOT_DIR/LIVE/arena_v1.html"
  git -C "$ROOT_DIR" show "${hash}:drills_v1.html" > "$ROOT_DIR/LIVE/drills_v1.html"
  git -C "$ROOT_DIR" show "${hash}:mode_dailyrounds_v1.html" > "$ROOT_DIR/LIVE/mode_dailyrounds_v1.html"
  git -C "$ROOT_DIR" show "${hash}:STAT MAIN folder/stat_latest.html" > "$ROOT_DIR/LIVE/stat_latest.html"
}

if [[ -z "$TARGET_HASH" ]]; then
  TARGET_HASH="$(git -C "$ROOT_DIR" rev-parse HEAD~1)"
fi

if ! git -C "$ROOT_DIR" cat-file -e "${TARGET_HASH}^{commit}" 2>/dev/null; then
  echo "Rollback target commit not found: $TARGET_HASH" >&2
  exit 1
fi

TS="$(date +%Y-%m-%d_%H%M%S)"
BACKUP_DIR="$ROOT_DIR/BACKUPS/rollback_pre_${TS}"
mkdir -p "$BACKUP_DIR"
cp -p "$ROOT_DIR"/LIVE/*.html "$BACKUP_DIR/"
log "Backup snapshot created: $BACKUP_DIR"

log "Restoring /LIVE from commit $TARGET_HASH"
restore_live_from_commit "$TARGET_HASH"

log "Validating restored LIVE files"
validate_args=(--live-dir "$ROOT_DIR/LIVE")
if [[ -n "$PROMPT_ID" ]]; then
  validate_args+=(--prompt-id "$PROMPT_ID")
fi
"$VALIDATE_DEPLOY" "${validate_args[@]}"

log "Deploying rollback state (git gate bypass for emergency recovery)"
deploy_args=(--skip-git-check)
if [[ -n "$PROMPT_ID" ]]; then
  deploy_args+=(--prompt-id "$PROMPT_ID")
fi
"$DEPLOY_SCRIPT" "${deploy_args[@]}"

log "Post-rollback runtime validation"
"$VALIDATE_RUNTIME" --env LIVE --manifest "$ROOT_DIR/_SYSTEM/DEPLOY_MANIFEST.json" --live-dir "$ROOT_DIR/LIVE"

log "Rollback completed successfully for target $TARGET_HASH"
