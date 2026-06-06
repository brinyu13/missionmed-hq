#!/usr/bin/env bash
set -euo pipefail

REPO="brinyu13/missionmed-hq"
LABEL="live-coord"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISSUE_FILE="$SCRIPT_DIR/.live-issue-number"

timestamp_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

ensure_live_label() {
  if gh label list --repo "$REPO" --search "$LABEL" 2>/dev/null | awk '{print $1}' | grep -Fxq "$LABEL"; then
    return 0
  fi

  if ! gh label create "$LABEL" --repo "$REPO" --description "MissionMed live coordination board" --color "2da44e" >/dev/null 2>&1; then
    echo "Warning: could not create or verify label '$LABEL'. Issue creation will still try to apply it." >&2
  fi
}

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is not installed. Install gh before creating a live coordination thread." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run 'gh auth login' before creating a live coordination thread." >&2
  exit 1
fi

DATE="$(date +"%Y-%m-%d")"
CREATED="$(timestamp_utc)"
TITLE="MM-LIVE: $DATE Active Work Coordination"
BODY="$(cat <<EOF
Live coordination thread for MissionMed twin workstation.

Created: $CREATED

## How This Works

Each comment is a status update from:
- Codex
- Claude Cowork
- Claude Code
- ChatGPT

Refresh this page on either laptop to see current state.

## Active On

Laptop A:
[pending]

Laptop B:
[pending]
EOF
)"

ensure_live_label

ISSUE_URL="$(gh issue create --repo "$REPO" --title "$TITLE" --body "$BODY" --label "$LABEL")"
ISSUE_NUMBER="$(printf '%s\n' "$ISSUE_URL" | sed -n 's#.*/issues/\([0-9][0-9]*\).*#\1#p' | tail -n 1)"

if ! [[ "$ISSUE_NUMBER" =~ ^[1-9][0-9]*$ ]]; then
  echo "Issue was created, but its number could not be parsed from: $ISSUE_URL" >&2
  exit 1
fi

printf '%s\n' "$ISSUE_NUMBER" > "$ISSUE_FILE"

if gh issue pin "$ISSUE_NUMBER" --repo "$REPO" >/dev/null 2>&1; then
  echo "Pinned live coordination issue $REPO#$ISSUE_NUMBER."
else
  echo "Warning: issue $REPO#$ISSUE_NUMBER was created but could not be pinned. Pin it manually if needed." >&2
fi

echo "Created live coordination thread: $ISSUE_URL"
