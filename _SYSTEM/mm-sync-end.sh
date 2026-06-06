#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  echo "Not inside a git repository." >&2
  exit 1
fi
cd "$ROOT"

MAX_SAFE_BYTES=$((5 * 1024 * 1024))
NESTED_CANDIDATES=("missionmed-hq" "VIDEO_SYSTEM")
NESTED_REPO_PATHS=()

timestamp_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

laptop_name() {
  scutil --get ComputerName 2>/dev/null \
    || scutil --get LocalHostName 2>/dev/null \
    || hostname -s 2>/dev/null \
    || hostname
}

section() {
  printf '\n== %s ==\n' "$1"
}

sanitize_summary() {
  printf '%s' "$1" | tr '\r\n' '  ' | sed 's/[[:space:]][[:space:]]*/ /g; s/^ //; s/ $//' | cut -c 1-80
}

default_if_blank() {
  local value="$1"
  local fallback="$2"
  if [ -n "$value" ]; then
    printf '%s' "$value"
  else
    printf '%s' "$fallback"
  fi
}

is_nested_git_repo() {
  local candidate="$1"
  local top
  [ -d "$candidate" ] || return 1
  top="$(git -C "$candidate" rev-parse --show-toplevel 2>/dev/null || true)"
  [ -n "$top" ] && [ "$top" != "$ROOT" ]
}

collect_nested_repo_paths() {
  local candidate
  NESTED_REPO_PATHS=()
  for candidate in "${NESTED_CANDIDATES[@]}"; do
    if is_nested_git_repo "$candidate"; then
      NESTED_REPO_PATHS+=("$candidate")
    fi
  done
}

is_inside_nested_repo_path() {
  local rel="$1"
  local nested
  for nested in "${NESTED_REPO_PATHS[@]}"; do
    case "$rel" in
      "$nested"|"$nested"/*)
        return 0
        ;;
    esac
  done
  return 1
}

is_secret_path() {
  local rel="$1"
  local lower
  lower="$(printf '%s' "$rel" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    .env.example|*/.env.example)
      return 1
      ;;
    .env|.env.*|*/.env|*/.env.*|*.pem|*.p12|*.pfx|*id_rsa*|*id_ed25519*|*credentials*|*secret*|*/secrets/*|secrets/*)
      return 0
      ;;
  esac
  return 1
}

is_media_or_archive_path() {
  local rel="$1"
  local lower
  lower="$(printf '%s' "$rel" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    *.mp3|*.wav|*.aiff|*.aif|*.mp4|*.mov|*.m4v|*.numbers|*.zip|*.tar|*.tgz|*.tar.gz|*.gz|*.dmg|*.iso)
      return 0
      ;;
  esac
  return 1
}

is_too_large() {
  local rel="$1"
  local bytes
  [ -f "$rel" ] || return 1
  bytes="$(wc -c < "$rel" | tr -d ' ')"
  [ "${bytes:-0}" -gt "$MAX_SAFE_BYTES" ]
}

has_secret_content() {
  local rel="$1"
  [ -f "$rel" ] || return 1
  if LC_ALL=C grep -Iq . "$rel"; then
    LC_ALL=C grep -Eq -- '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|sk-(live|test)-[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{20,}|(OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|POSTGRES_PASSWORD|RAILWAY_TOKEN)[[:space:]]*=' "$rel"
  else
    return 1
  fi
}

stage_if_safe() {
  local rel="$1"
  local mode="$2"
  [ -f "$rel" ] || return 0
  if [ "$mode" = "root" ] && is_inside_nested_repo_path "$rel"; then
    echo "skip nested repo file: $rel"
    return 0
  fi
  if is_secret_path "$rel"; then
    echo "skip secret-looking path: $rel"
    return 0
  fi
  if is_media_or_archive_path "$rel"; then
    echo "skip media/archive path: $rel"
    return 0
  fi
  if is_too_large "$rel"; then
    echo "skip file over 5 MB: $rel"
    return 0
  fi
  if has_secret_content "$rel"; then
    echo "skip possible secret content: $rel"
    return 0
  fi
  git add -- "$rel"
  echo "staged: $rel"
}

stage_safe_changes() {
  local repo_dir="$1"
  local mode="$2"
  local rel
  local deleted

  (
    cd "$repo_dir"
    if [ "$mode" = "root" ]; then
      local whitelist=(
        "_SYSTEM/TWIN_STATE.md"
        "_SYSTEM/ACTIVE_WORK.md"
        "_SYSTEM/DUAL_MAC_SYNC_PROTOCOL.md"
        "_SYSTEM/mm-sync-start.sh"
        "_SYSTEM/mm-sync-end.sh"
        "_SYSTEM_LOGS/MM_ACTIVITY_LOG.md"
        "_SYSTEM_LOGS/LEARNINGS_LOG.jsonl"
        "_AI_HANDOFFS"
        "08_AI_SYSTEM/MissionMed_AI_Brain"
        ".claude"
      )
      collect_nested_repo_paths
      while IFS= read -r -d '' rel; do
        stage_if_safe "$rel" "$mode"
      done < <(git diff --name-only -z --diff-filter=ACMRT)
      while IFS= read -r -d '' rel; do
        stage_if_safe "$rel" "$mode"
      done < <(git ls-files -o --exclude-standard -z -- "${whitelist[@]}" 2>/dev/null || true)
    else
      while IFS= read -r -d '' rel; do
        stage_if_safe "$rel" "$mode"
      done < <(git diff --name-only -z --diff-filter=ACMRT)
      echo "Nested repo untracked files are left unstaged for manual review."
    fi

    deleted="$(git diff --name-only --diff-filter=D)"
    if [ -n "$deleted" ]; then
      echo "Deleted paths were not staged:"
      printf '%s\n' "$deleted"
    fi
  )
}

audit_staged_or_die() {
  local repo_dir="$1"
  local mode="$2"
  local rel
  local failed=0

  (
    cd "$repo_dir"
    if ! git diff --cached --quiet --diff-filter=D; then
      echo "Refusing to commit because staged deletions are present." >&2
      exit 1
    fi

    while IFS= read -r -d '' rel; do
      if is_secret_path "$rel"; then
        echo "Refusing staged secret-looking path: $rel" >&2
        failed=1
      elif is_media_or_archive_path "$rel"; then
        echo "Refusing staged media/archive path: $rel" >&2
        failed=1
      elif [ -f "$rel" ] && is_too_large "$rel"; then
        echo "Refusing staged file over 5 MB: $rel" >&2
        failed=1
      elif [ -f "$rel" ] && has_secret_content "$rel"; then
        echo "Refusing staged possible secret content: $rel" >&2
        failed=1
      elif [ "$mode" = "root" ] && is_inside_nested_repo_path "$rel"; then
        echo "Refusing staged nested repo path in root git: $rel" >&2
        failed=1
      fi
    done < <(git diff --cached --name-only -z)

    [ "$failed" -eq 0 ]
  )
}

push_current_branch() {
  local repo_dir="$1"
  local branch
  (
    cd "$repo_dir"
    branch="$(git branch --show-current)"
    if [ -z "$branch" ]; then
      echo "Detached HEAD; skipping push." >&2
      exit 1
    fi
    if ! git remote get-url origin >/dev/null 2>&1; then
      echo "No origin remote; skipping push." >&2
      exit 1
    fi
    git push origin "$branch"
  )
}

commit_if_staged() {
  local repo_dir="$1"
  local message="$2"
  (
    cd "$repo_dir"
    if git diff --cached --quiet; then
      echo "No safe staged changes to commit in $repo_dir."
      exit 0
    fi
    section "Staged diff stat for $repo_dir"
    git diff --cached --stat
    git commit -m "$message"
    push_current_branch "$repo_dir"
  )
}

has_changes() {
  [ -n "$(git -C "$1" status --porcelain)" ]
}

update_state_and_log() {
  local summary="$1"
  local next_action="$2"
  local blocked_items="$3"
  local active_tool="$4"
  local ticket="$5"
  local laptop="$6"
  local branch
  local stamp
  branch="$(git branch --show-current)"
  stamp="$(timestamp_utc)"

  mkdir -p _SYSTEM _SYSTEM_LOGS

  cat > _SYSTEM/TWIN_STATE.md <<EOF
# MissionMed Twin State

Last Updated: $stamp
Active Laptop: $laptop
Active Tool: $active_tool
Active Ticket: $ticket
Active Branch: $branch
Session Summary: $summary
Next Action: $next_action
Blocked Items: $blocked_items

## Sync Contract

- Start every session by pulling the latest safe state with \`_SYSTEM/mm-sync-start.sh\`.
- End every session by writing a summary, updating this file, committing safe state, and pushing with \`_SYSTEM/mm-sync-end.sh\`.
- Keep \`_SYSTEM/ACTIVE_WORK.md\` aligned with the current ticket, tool, branch, and next action.
- Treat nested repositories as separate repositories. Never stage their files into the root repository when they have their own \`.git\` directory.
- Never force-push, run \`reset --hard\`, delete work, deploy, expose \`.env\` values, or commit secret material.
EOF

  cat > _SYSTEM/ACTIVE_WORK.md <<EOF
# MissionMed Active Work

## Current Ticket

- Ticket: $ticket
- Branch: $branch
- Tool: $active_tool
- Active Laptop: $laptop
- Last Updated: $stamp

## Session Summary

$summary

## Next Action

$next_action

## Blocked Items

$blocked_items
EOF

  {
    printf '\n---\n\n'
    printf '## %s | %s | Twin sync end\n\n' "$(date -u +"%Y-%m-%d")" "$ticket"
    printf '**Laptop:** %s\n' "$laptop"
    printf '**Tool:** %s\n' "$active_tool"
    printf '**Branch:** %s\n' "$branch"
    printf '**Summary:** %s\n' "$summary"
    printf '**Next Action:** %s\n' "$next_action"
    printf '**Blocked Items:** %s\n' "$blocked_items"
    printf '**Status:** COMPLETE\n'
  } >> _SYSTEM_LOGS/MM_ACTIVITY_LOG.md
}

check_nested_repos_end() {
  local message="$1"
  local candidate
  local answer

  section "Nested repositories"
  collect_nested_repo_paths
  for candidate in "${NESTED_CANDIDATES[@]}"; do
    if [ ! -d "$candidate" ]; then
      echo "$candidate: missing, skipped"
    elif is_nested_git_repo "$candidate"; then
      if has_changes "$candidate"; then
        echo "$candidate has changes:"
        git -C "$candidate" status --short
        read -r -p "Commit and push safe tracked changes in nested repo '$candidate'? [y/N]: " answer
        case "$answer" in
          y|Y|yes|YES)
            stage_safe_changes "$ROOT/$candidate" "nested"
            audit_staged_or_die "$ROOT/$candidate" "nested"
            commit_if_staged "$ROOT/$candidate" "$message"
            ;;
          *)
            echo "$candidate skipped by user."
            ;;
        esac
      else
        echo "$candidate: clean"
      fi
    else
      echo "$candidate: managed by root git, not a separate nested checkout here"
    fi
  done
}

post_live_session_end() {
  local summary="$1"
  local next_action="$2"
  local laptop="$3"
  local branch="$4"
  local issue_file="_SYSTEM/.live-issue-number"
  local issue_number
  local status_message

  [ -f "$issue_file" ] || return 0

  issue_number="$(tr -d '[:space:]' < "$issue_file")"
  if ! [[ "$issue_number" =~ ^[1-9][0-9]*$ ]]; then
    return 0
  fi

  command -v gh >/dev/null 2>&1 || return 0

  if [ ! -x "_SYSTEM/mm-post.sh" ]; then
    echo "Live coordination issue is configured, but _SYSTEM/mm-post.sh is missing or not executable." >&2
    return 0
  fi

  status_message="$(cat <<EOF
SESSION END
Laptop: $laptop
Branch: $branch
Summary: $summary
Next Action: $next_action
EOF
)"

  if ! _SYSTEM/mm-post.sh "$status_message"; then
    echo "Live coordination post failed; sync already completed." >&2
  fi
}

section "MissionMed twin workstation end"
echo "Laptop: $(laptop_name)"
echo "Repository: $ROOT"
echo "Branch: $(git branch --show-current)"

read -r -p "Session summary: " SESSION_SUMMARY
read -r -p "Next action: " NEXT_ACTION
read -r -p "Blocked items: " BLOCKED_ITEMS
read -r -p "Active tool: " ACTIVE_TOOL
read -r -p "Ticket: " TICKET

SESSION_SUMMARY="$(default_if_blank "$SESSION_SUMMARY" "session sync")"
NEXT_ACTION="$(default_if_blank "$NEXT_ACTION" "None recorded")"
BLOCKED_ITEMS="$(default_if_blank "$BLOCKED_ITEMS" "None recorded")"
ACTIVE_TOOL="$(default_if_blank "$ACTIVE_TOOL" "Codex")"
TICKET="$(default_if_blank "$TICKET" "NO-TICKET")"

LAPTOP="$(laptop_name)"
CLEAN_SUMMARY="$(sanitize_summary "$SESSION_SUMMARY")"
[ -n "$CLEAN_SUMMARY" ] || CLEAN_SUMMARY="session sync"
COMMIT_MESSAGE="twin-sync: $LAPTOP - $CLEAN_SUMMARY"

update_state_and_log "$SESSION_SUMMARY" "$NEXT_ACTION" "$BLOCKED_ITEMS" "$ACTIVE_TOOL" "$TICKET" "$LAPTOP"

section "Root repository safe staging"
collect_nested_repo_paths
stage_safe_changes "$ROOT" "root"
audit_staged_or_die "$ROOT" "root"
commit_if_staged "$ROOT" "$COMMIT_MESSAGE"

check_nested_repos_end "$COMMIT_MESSAGE"

section "Twin sync end complete"
git status --short
post_live_session_end "$SESSION_SUMMARY" "$NEXT_ACTION" "$LAPTOP" "$(git branch --show-current)"
