#!/usr/bin/env bash
set -euo pipefail

PROTECTED_MAIN_ROOT="${PROTECTED_MAIN_ROOT:-/Users/brianb/MissionMed}"

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; }
info() { echo "[INFO] $1"; }

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

if [[ "$cwd" == "$PROTECTED_MAIN_ROOT" ]]; then
  fail "Protected main root is not an editing workspace: $PROTECTED_MAIN_ROOT"
  errors=$((errors + 1))
else
  pass "Current directory is not protected main root."
fi

if [[ "${branch:-}" == "main" ]]; then
  fail "Branch main is protected; switch to a non-main worktree branch."
  errors=$((errors + 1))
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

info "Preflight result: PASS. Safe to begin scoped edits in this worktree."
