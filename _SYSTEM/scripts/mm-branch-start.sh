#!/usr/bin/env bash
set -euo pipefail

PROTECTED_MAIN_ROOT="${PROTECTED_MAIN_ROOT:-/Users/brianb/MissionMed}"

usage() {
  echo "Usage: bash _SYSTEM/scripts/mm-branch-start.sh <ticket_id> <short_slug>"
}

fail() { echo "[FAIL] $1"; }
pass() { echo "[PASS] $1"; }
info() { echo "[INFO] $1"; }

if [[ $# -ne 2 ]]; then
  usage
  exit 2
fi

ticket_id="$1"
short_slug="$2"

if [[ ! "$ticket_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
  fail "ticket_id must match [A-Za-z0-9._-]+"
  exit 2
fi

if [[ ! "$short_slug" =~ ^[A-Za-z0-9._-]+$ ]]; then
  fail "short_slug must match [A-Za-z0-9._-]+"
  exit 2
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not inside a Git repository."
  exit 1
fi

cwd="$(pwd)"
repo_root="$(git rev-parse --show-toplevel)"

if [[ "$repo_root" != "$PROTECTED_MAIN_ROOT" || "$cwd" != "$PROTECTED_MAIN_ROOT" ]]; then
  fail "Run this script from $PROTECTED_MAIN_ROOT only."
  echo "cwd: $cwd"
  echo "repo_root: $repo_root"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  fail "Repository is dirty. Resolve or preserve state before creating/switching branches."
  git status --short
  exit 1
fi

branch="work/${ticket_id}-${short_slug}"

if git rev-parse --verify --quiet "$branch" >/dev/null; then
  git switch "$branch"
  pass "Switched to existing branch: $branch"
else
  git switch -c "$branch"
  pass "Created and switched to branch: $branch"
fi

info "No deploy, push, merge, reset, or clean actions were performed."
