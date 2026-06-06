#!/usr/bin/env bash
set -euo pipefail

REPO_OWNER="brinyu13"
REPO_NAME="missionmed-hq"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISSUE_FILE="$SCRIPT_DIR/.live-issue-number"

if [ ! -f "$ISSUE_FILE" ]; then
  echo "Live issue number file is missing: $ISSUE_FILE" >&2
  exit 1
fi

ISSUE_NUMBER="$(tr -d '[:space:]' < "$ISSUE_FILE")"
if ! [[ "$ISSUE_NUMBER" =~ ^[1-9][0-9]*$ ]]; then
  echo "Live issue number is not set. Create a thread with _SYSTEM/mm-new-thread.sh first." >&2
  exit 1
fi

if ! command -v open >/dev/null 2>&1; then
  echo "macOS 'open' command is not available on this machine." >&2
  exit 1
fi

open "https://github.com/$REPO_OWNER/$REPO_NAME/issues/$ISSUE_NUMBER"
