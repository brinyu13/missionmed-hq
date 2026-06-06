#!/usr/bin/env bash
set -euo pipefail

REPO="brinyu13/missionmed-hq"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISSUE_FILE="$SCRIPT_DIR/.live-issue-number"

usage() {
  cat <<'USAGE'
MissionMed live coordination status post.

Usage:
  _SYSTEM/mm-post.sh "status message"
USAGE
}

timestamp_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

laptop_name() {
  scutil --get ComputerName 2>/dev/null \
    || scutil --get LocalHostName 2>/dev/null \
    || hostname -s 2>/dev/null \
    || hostname
}

if [ "$#" -eq 0 ]; then
  echo "Status message is required." >&2
  usage >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is not installed. Install gh before posting live coordination updates." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run 'gh auth login' before posting live coordination updates." >&2
  exit 1
fi

if [ ! -f "$ISSUE_FILE" ]; then
  echo "Live issue number file is missing: $ISSUE_FILE" >&2
  exit 1
fi

ISSUE_NUMBER="$(tr -d '[:space:]' < "$ISSUE_FILE")"
if ! [[ "$ISSUE_NUMBER" =~ ^[1-9][0-9]*$ ]]; then
  echo "Live issue number is not set. Create a thread with _SYSTEM/mm-new-thread.sh first." >&2
  exit 1
fi

STATUS_MESSAGE="$*"
LAPTOP="$(laptop_name)"
STAMP="$(timestamp_utc)"

BODY="$(cat <<EOF
## MissionMed Live Status

**Laptop:** $LAPTOP
**Timestamp:** $STAMP

**Status:**

$STATUS_MESSAGE
EOF
)"

gh issue comment "$ISSUE_NUMBER" --repo "$REPO" --body "$BODY"
echo "Posted live coordination update to $REPO#$ISSUE_NUMBER."
