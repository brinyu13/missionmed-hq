#!/usr/bin/env bash
set -euo pipefail

PROTECTED_MAIN_ROOT="${PROTECTED_MAIN_ROOT:-/Users/brianb/MissionMed}"
WORKTREE_PARENT="${WORKTREE_PARENT:-/Users/brianb/MissionMed_worktrees}"

usage() {
  echo "Usage: bash _SYSTEM/scripts/mm-thread-start.sh <ticket_id> <short_slug>"
}

if [[ $# -ne 2 ]]; then
  usage
  exit 2
fi

ticket_id="$1"
short_slug="$2"
branch="work/${ticket_id}-${short_slug}"
worktree_path="${WORKTREE_PARENT}/${ticket_id}-${short_slug}"

echo "[INFO] Legacy optional helper: worktrees are no longer the default workflow."
echo "[INFO] Default workflow: use bash _SYSTEM/scripts/mm-branch-start.sh <ticket_id> <short_slug> from /Users/brianb/MissionMed."

if ! git -C "$PROTECTED_MAIN_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[FAIL] Protected main root is not a git repository: $PROTECTED_MAIN_ROOT"
  exit 1
fi

# Dirty protected main root is no longer an automatic blocker.
if [[ -n "$(git -C "$PROTECTED_MAIN_ROOT" status --porcelain)" ]]; then
  echo "[WARN] Protected main root is dirty. Run dirty-state triage before editing."
  git -C "$PROTECTED_MAIN_ROOT" status --short
else
  echo "[PASS] Protected main root is clean."
fi

mkdir -p "$WORKTREE_PARENT"

if git -C "$PROTECTED_MAIN_ROOT" worktree list | awk '{print $1}' | grep -Fxq "$worktree_path"; then
  echo "[FAIL] Worktree path is already registered: $worktree_path"
  exit 1
fi

if [[ -e "$worktree_path" ]]; then
  echo "[FAIL] Target path already exists: $worktree_path"
  exit 1
fi

base_ref="main"
if git -C "$PROTECTED_MAIN_ROOT" rev-parse --verify --quiet origin/main >/dev/null; then
  base_ref="origin/main"
fi

if git -C "$PROTECTED_MAIN_ROOT" rev-parse --verify --quiet "$branch" >/dev/null; then
  echo "[INFO] Branch already exists locally: $branch"
  if ! git -C "$PROTECTED_MAIN_ROOT" worktree add "$worktree_path" "$branch"; then
    echo "[FAIL] Could not create worktree. Branch checkout is blocked by current repo state."
    exit 1
  fi
else
  if ! git -C "$PROTECTED_MAIN_ROOT" worktree add -b "$branch" "$worktree_path" "$base_ref"; then
    echo "[FAIL] Could not create worktree branch. Branch checkout is blocked by current repo state."
    exit 1
  fi
fi

echo "[PASS] Worktree created."
echo "Next command:"
echo "cd $worktree_path"
