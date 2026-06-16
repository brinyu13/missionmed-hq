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
  info "Repository is dirty. This is allowed for branch switching when no checkout conflict exists."
  git status --short
fi

branch="work/${ticket_id}-${short_slug}"

switch_err="$(mktemp)"
if git rev-parse --verify --quiet "$branch" >/dev/null; then
  if git switch "$branch" 2>"$switch_err"; then
    pass "Switched to existing branch: $branch"
  else
    fail "Could not switch to existing branch due to checkout conflict or blocking tracked changes."
    cat "$switch_err"
    rm -f "$switch_err"
    exit 1
  fi
else
  if git switch -c "$branch" 2>"$switch_err"; then
    pass "Created and switched to branch: $branch"
  else
    fail "Could not create/switch branch due to checkout conflict or blocking tracked changes."
    cat "$switch_err"
    rm -f "$switch_err"
    exit 1
  fi
fi

rm -f "$switch_err"
info "No deploy, push, merge, reset, or clean actions were performed."
