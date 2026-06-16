#!/usr/bin/env bash
set -euo pipefail

PROTECTED_MAIN_ROOT="${PROTECTED_MAIN_ROOT:-/Users/brianb/MissionMed}"
MODE="${MM_PREFLIGHT_MODE:-read-only}"
EDIT_SCOPE_RAW="${MM_PREFLIGHT_EDIT_SCOPE:-}"

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; }
info() { echo "[INFO] $1"; }
warn() { echo "[WARN] $1"; }

usage() {
  cat <<'USAGE'
Usage:
  bash _SYSTEM/scripts/mm-preflight.sh
  bash _SYSTEM/scripts/mm-preflight.sh --read-only
  bash _SYSTEM/scripts/mm-preflight.sh --intent inspect
  bash _SYSTEM/scripts/mm-preflight.sh --intent edit
  bash _SYSTEM/scripts/mm-preflight.sh --edit-scope "path1 path2"
  bash _SYSTEM/scripts/mm-preflight.sh --intent edit --edit-scope "path1 path2"

Notes:
  - Default mode is non-destructive inspection (read-only).
  - Dirty repo status does NOT auto-fail this script.
  - Use --edit-scope to enable overlap checks against dirty files.
USAGE
}

normalize_path() {
  local p="$1"
  p="${p#./}"
  p="${p#${repo_root}/}"
  while [[ "$p" == /* ]]; do
    p="${p#/}"
  done
  echo "$p"
}

paths_overlap() {
  local a="$1"
  local b="$2"
  [[ -z "$a" || -z "$b" ]] && return 1
  if [[ "$a" == "$b" ]]; then
    return 0
  fi
  if [[ "$a" == "$b/"* ]]; then
    return 0
  fi
  if [[ "$b" == "$a/"* ]]; then
    return 0
  fi
  return 1
}

is_sensitive_path() {
  local p="$1"
  case "$p" in
    missionmed-hq/server.mjs|*/missionmed-hq/server.mjs) return 0 ;;
    LIVE/*|*/LIVE/*) return 0 ;;
    wp-content/mu-plugins/*|*/wp-content/mu-plugins/*) return 0 ;;
    supabase/migrations/*|*/supabase/migrations/*) return 0 ;;
    *[Dd]rill*|*[Rr]ailway*|*[Aa]uth*|*[Ll]ogin*|*[Ww]iring*) return 0 ;;
  esac
  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --read-only)
      MODE="read-only"
      ;;
    --intent)
      shift
      [[ $# -gt 0 ]] || { fail "Missing value for --intent"; usage; exit 2; }
      case "$1" in
        inspect) MODE="read-only" ;;
        edit) MODE="edit" ;;
        *) fail "Invalid value for --intent: $1"; usage; exit 2 ;;
      esac
      ;;
    --edit-scope)
      shift
      [[ $# -gt 0 ]] || { fail "Missing value for --edit-scope"; usage; exit 2; }
      EDIT_SCOPE_RAW="$1"
      MODE="edit"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $1"
      usage
      exit 2
      ;;
  esac
  shift
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not inside a Git repository."
  exit 1
fi

cwd="$(pwd)"
repo_root="$(git rev-parse --show-toplevel)"
branch="$(git branch --show-current)"
head="$(git rev-parse HEAD)"

upstream=""
if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}')"
fi

echo "=== MissionMed Preflight ==="
echo "cwd: $cwd"
echo "repo_root: $repo_root"
echo "branch: ${branch:-DETACHED}"
echo "HEAD: $head"
echo "mode: $MODE"
if [[ -n "$upstream" ]]; then
  echo "upstream: $upstream"
else
  echo "upstream: (none)"
fi

echo "status_short:"
status_short="$(git status --short)"
if [[ -n "$status_short" ]]; then
  echo "$status_short"
else
  echo "(clean)"
fi

echo "status_branch_short:"
git status --branch --short

errors=0

if [[ "$repo_root" != "$PROTECTED_MAIN_ROOT" ]]; then
  warn "Repo root differs from expected MissionMed root: $repo_root"
else
  pass "MissionMed canonical repo root detected."
fi

if [[ "$cwd" == "$PROTECTED_MAIN_ROOT" ]]; then
  info "Running from primary repo root (allowed)."
else
  info "Running from subdirectory inside repo."
fi

if [[ "${branch:-}" == "main" ]]; then
  warn "Branch is main. Editing should happen on a scoped task branch unless explicitly authorized."
else
  pass "Branch is non-main."
fi

declare -a tracked_files
declare -a untracked_files
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  status_code="${line:0:2}"
  path_part="${line:3}"
  if [[ "$status_code" == "??" ]]; then
    untracked_files+=("$path_part")
  else
    if [[ "$path_part" == *" -> "* ]]; then
      path_part="${path_part##* -> }"
    fi
    tracked_files+=("$path_part")
  fi
done < <(git status --porcelain)

echo
echo "tracked_dirty_files:"
if [[ "${#tracked_files[@]}" -eq 0 ]]; then
  echo "  (none)"
else
  for f in "${tracked_files[@]}"; do
    echo "  - $f"
  done
fi

echo "untracked_files:"
if [[ "${#untracked_files[@]}" -eq 0 ]]; then
  echo "  (none)"
else
  for f in "${untracked_files[@]}"; do
    echo "  - $f"
  done
fi

dirty_count=$(( ${#tracked_files[@]} + ${#untracked_files[@]} ))
if (( dirty_count > 0 )); then
  echo
  echo "=== DIRTY-STATE TRIAGE REQUIRED ==="
  info "Dirty repo is not an automatic blocker."
  info "Classify each dirty file as related/unrelated to the intended task."
  info "Continue only when edit scope is explicit and does not overlap unrelated risky files."
else
  pass "Repo is currently clean."
fi

declare -a edit_scope
if [[ -n "$EDIT_SCOPE_RAW" ]]; then
  for p in $EDIT_SCOPE_RAW; do
    normalized="$(normalize_path "$p")"
    [[ -n "$normalized" ]] && edit_scope+=("$normalized")
  done
fi

echo
if [[ "${#edit_scope[@]}" -gt 0 ]]; then
  echo "declared_edit_scope:"
  for p in "${edit_scope[@]}"; do
    echo "  - $p"
  done
else
  echo "declared_edit_scope: (none provided)"
  info "No overlap decision can be made yet. Before editing, declare scope with --edit-scope \"path1 path2\"."
fi

if [[ "${#edit_scope[@]}" -gt 0 && "$dirty_count" -gt 0 ]]; then
  overlap_count=0
  risky_overlap_count=0
  for dirty in "${tracked_files[@]}" "${untracked_files[@]}"; do
    ndirty="$(normalize_path "$dirty")"
    for scope_item in "${edit_scope[@]}"; do
      nscope="$(normalize_path "$scope_item")"
      if paths_overlap "$ndirty" "$nscope"; then
        overlap_count=$((overlap_count + 1))
        if is_sensitive_path "$ndirty"; then
          risky_overlap_count=$((risky_overlap_count + 1))
          fail "Sensitive dirty overlap: dirty '$ndirty' overlaps declared scope '$nscope'."
        else
          warn "Dirty overlap detected: dirty '$ndirty' overlaps declared scope '$nscope'."
        fi
      fi
    done
  done

  if (( overlap_count == 0 )); then
    pass "No dirty-file overlap detected for the declared scope."
  fi

  if (( risky_overlap_count > 0 )); then
    errors=$((errors + 1))
  fi
fi

if (( errors > 0 )); then
  info "Preflight result: FAIL ($errors unsafe condition(s))."
  exit 1
fi

if [[ "$MODE" == "edit" ]]; then
  info "Preflight result: PASS WITH WARNINGS POSSIBLE. Scoped edits can proceed only after human triage confirmation."
else
  info "Preflight result: PASS. Repository inspection completed."
fi
