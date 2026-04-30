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

# Refuse to proceed if protected main root has dirty state.
if [[ -n "$(git -C "$PROTECTED_MAIN_ROOT" status --porcelain)" ]]; then
  echo "[FAIL] Protected main root is dirty. Resolve/snapshot first."
  git -C "$PROTECTED_MAIN_ROOT" status --short
  exit 1
fi

echo "[PASS] Protected main root is clean."

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
  git -C "$PROTECTED_MAIN_ROOT" worktree add "$worktree_path" "$branch"
else
  git -C "$PROTECTED_MAIN_ROOT" worktree add -b "$branch" "$worktree_path" "$base_ref"
fi

echo "[PASS] Worktree created."
echo "Next command:"
echo "cd $worktree_path"
