#!/usr/bin/env bash
set -euo pipefail

PROTECTED_MAIN_ROOT="${PROTECTED_MAIN_ROOT:-/Users/brianb/MissionMed}"
INTENT="${MM_PREFLIGHT_INTENT:-inspect}"

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; }
info() { echo "[INFO] $1"; }
warn() { echo "[WARN] $1"; }

usage() {
  cat <<'USAGE'
Usage: bash _SYSTEM/scripts/mm-preflight.sh [--intent inspect|edit]

--intent inspect   Validate repository state for read-only operations (default)
--intent edit      Validate repository state for code edits (fails on branch main)
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --intent)
      shift
      [[ $# -gt 0 ]] || { fail "Missing value for --intent"; usage; exit 2; }
      INTENT="$1"
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

if [[ "$INTENT" != "inspect" && "$INTENT" != "edit" ]]; then
  fail "Invalid intent: $INTENT (expected inspect or edit)"
  exit 2
fi

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
echo "intent: $INTENT"
if [[ -n "$upstream" ]]; then
  echo "upstream: $upstream"
else
  echo "upstream: (none)"
fi

echo "status_short:"
git status --short

echo "worktrees:"
git worktree list

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
  if [[ "$INTENT" == "edit" ]]; then
    fail "Branch main is protected for edit intent; switch to a task branch first."
    errors=$((errors + 1))
  else
    warn "Branch is main. Inspect intent allowed; edit intent would fail."
  fi
else
  pass "Branch is non-main."
fi

# Tracked changes check
if [[ -n "$(git diff --name-only)" || -n "$(git diff --cached --name-only)" ]]; then
  fail "Tracked changes detected (staged and/or unstaged)."
  errors=$((errors + 1))
else
  pass "No tracked changes detected."
fi

# Untracked (excluding ignored) check
untracked_count=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ "$untracked_count" -eq 0 ]]; then
    fail "Untracked files detected (outside ignore rules):"
  fi
  echo "  - $f"
  untracked_count=$((untracked_count + 1))
done < <(git ls-files --others --exclude-standard)

if [[ "$untracked_count" -gt 0 ]]; then
  errors=$((errors + 1))
else
  pass "No untracked files detected."
fi

if (( errors > 0 )); then
  info "Preflight result: FAIL ($errors issue(s))."
  exit 1
fi

if [[ "$INTENT" == "edit" ]]; then
  info "Preflight result: PASS. Safe to begin scoped edits on this branch."
else
  info "Preflight result: PASS. Repository state is clean for inspection."
fi
