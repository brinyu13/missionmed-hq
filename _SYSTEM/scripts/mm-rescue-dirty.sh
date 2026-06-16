#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: bash _SYSTEM/scripts/mm-rescue-dirty.sh <label>"
}

if [[ $# -ne 1 ]]; then
  usage
  exit 2
fi

label="$1"
if [[ ! "$label" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "[FAIL] Label must match [A-Za-z0-9._-]+"
  exit 2
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[FAIL] Not inside a Git repository."
  exit 1
fi

ts="$(date +%Y%m%d_%H%M%S)"
rescue_branch="rescue/${label}-${ts}"

echo "=== MissionMed Dirty Rescue Helper ==="
echo "repo_root: $(git rev-parse --show-toplevel)"
echo "current_branch: $(git branch --show-current)"
echo "proposed_rescue_branch: $rescue_branch"
echo
echo "Current dirty status:"
git status --short

if [[ -z "$(git status --porcelain)" ]]; then
  echo "[INFO] Workspace is clean. No rescue needed."
  exit 0
fi

can_prompt=0
if [[ -t 0 && -t 1 ]]; then
  can_prompt=1
fi

if [[ "$can_prompt" -eq 1 ]]; then
  read -r -p "Create rescue commit now? [y/N]: " answer
  if [[ "$answer" =~ ^[Yy]$ ]]; then
    echo "[INFO] Creating rescue branch and commit with explicit confirmation."
    git checkout -b "$rescue_branch"
    git add -A
    git commit -m "RESCUE ONLY: snapshot dirty state ($label)"
    echo "[PASS] Rescue commit created on $rescue_branch"
    exit 0
  fi
fi

echo "[INFO] Dry-run mode (or confirmation not granted). No commit created."
echo "Manual rescue commands:"
echo "  git checkout -b $rescue_branch"
echo "  git add -A"
echo "  git commit -m \"RESCUE ONLY: snapshot dirty state ($label)\""
echo "  git checkout -"
