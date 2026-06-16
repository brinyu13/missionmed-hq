#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
MissionMed twin workstation start sync.

Usage:
  _SYSTEM/mm-sync-start.sh [--no-pull]

Options:
  --no-pull   Display current twin state without fetching or pulling. Useful for validation.
  -h, --help  Show this help.
USAGE
}

NO_PULL=0
for arg in "$@"; do
  case "$arg" in
    --no-pull)
      NO_PULL=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

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

has_changes() {
  [ -n "$(git -C "$1" status --porcelain)" ]
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
  [ -f "$rel" ] || return 0
  if is_inside_nested_repo_path "$rel"; then
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

stage_safe_root_changes() {
  local rel
  local deleted
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
    stage_if_safe "$rel"
  done < <(git diff --name-only -z --diff-filter=ACMRT)

  while IFS= read -r -d '' rel; do
    stage_if_safe "$rel"
  done < <(git ls-files -o --exclude-standard -z -- "${whitelist[@]}" 2>/dev/null || true)

  deleted="$(git diff --name-only --diff-filter=D)"
  if [ -n "$deleted" ]; then
    echo "Deleted paths were not staged:"
    printf '%s\n' "$deleted"
  fi
}

audit_staged_or_die() {
  local rel
  local failed=0

  if ! git diff --cached --quiet --diff-filter=D; then
    echo "Refusing to commit because staged deletions are present." >&2
    failed=1
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
    elif is_inside_nested_repo_path "$rel"; then
      echo "Refusing staged nested repo path in root git: $rel" >&2
      failed=1
    fi
  done < <(git diff --cached --name-only -z)

  [ "$failed" -eq 0 ] || exit 1
}

sanitize_summary() {
  printf '%s' "$1" | tr '\r\n' '  ' | sed 's/[[:space:]][[:space:]]*/ /g; s/^ //; s/ $//' | cut -c 1-80
}

commit_before_pull() {
  local summary
  local clean_summary
  local laptop
  laptop="$(laptop_name)"

  read -r -p "Commit summary before pull: " summary
  clean_summary="$(sanitize_summary "${summary:-session sync}")"
  [ -n "$clean_summary" ] || clean_summary="session sync"

  stage_safe_root_changes
  audit_staged_or_die

  if git diff --cached --quiet; then
    echo "No safe changes were staged. Pull remains blocked by the dirty worktree."
    return 1
  fi

  section "Staged changes"
  git diff --cached --stat
  read -r -p "Commit these safe staged changes now? [y/N]: " confirm
  case "$confirm" in
    y|Y|yes|YES)
      git commit -m "twin-sync: $laptop - $clean_summary"
      ;;
    *)
      echo "Commit cancelled. Pull remains blocked."
      return 1
      ;;
  esac
}

handle_dirty_before_pull() {
  local choice
  section "Uncommitted changes detected"
  git status --short
  echo
  echo "Pull is blocked until this worktree is clean."
  echo "Choose: commit, stash, or abort."
  while true; do
    read -r -p "Action [commit/stash/abort]: " choice
    case "$choice" in
      commit|c)
        commit_before_pull || exit 1
        break
        ;;
      stash|s)
        git stash push -u -m "twin-sync-start: $(laptop_name) $(timestamp_utc)"
        echo "Changes saved to git stash. Review with: git stash list"
        break
        ;;
      abort|a|"")
        echo "Aborting before pull."
        exit 1
        ;;
      *)
        echo "Please type commit, stash, or abort."
        ;;
    esac
  done

  if has_changes "$ROOT"; then
    echo "Worktree is still dirty after chosen action; refusing to pull."
    git status --short
    exit 1
  fi
}

pull_rebase_repo() {
  local repo_dir="$1"
  local label="$2"
  local branch
  local upstream

  (
    cd "$repo_dir"
    branch="$(git branch --show-current)"
    if [ -z "$branch" ]; then
      echo "$label is detached; skipping pull."
      exit 0
    fi
    if ! git remote get-url origin >/dev/null 2>&1; then
      echo "$label has no origin remote; skipping pull."
      exit 0
    fi
    echo "Fetching $label..."
    git fetch --prune origin
    upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
    if [ -n "$upstream" ]; then
      git pull --rebase
    elif git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
      git pull --rebase origin "$branch"
    else
      echo "$label branch '$branch' has no matching upstream; fetch completed without pull."
    fi
  )
}

check_nested_repos() {
  local candidate
  section "Nested repositories"
  collect_nested_repo_paths
  for candidate in "${NESTED_CANDIDATES[@]}"; do
    if [ ! -d "$candidate" ]; then
      echo "$candidate: missing, skipped"
    elif is_nested_git_repo "$candidate"; then
      if has_changes "$candidate"; then
        echo "$candidate: dirty, skipped pull"
        git -C "$candidate" status --short
      elif [ "$NO_PULL" -eq 1 ]; then
        echo "$candidate: clean nested repo, pull skipped by --no-pull"
      else
        pull_rebase_repo "$ROOT/$candidate" "nested $candidate"
      fi
    else
      echo "$candidate: managed by root git, not a separate nested checkout here"
    fi
  done
}

display_file() {
  local path="$1"
  local title="$2"
  section "$title"
  if [ -f "$path" ]; then
    sed -n '1,220p' "$path"
  else
    echo "$path not found."
  fi
}

display_session_state() {
  display_file "_SYSTEM/TWIN_STATE.md" "TWIN_STATE.md"
  display_file "_SYSTEM/ACTIVE_WORK.md" "ACTIVE_WORK.md"
  section "Last 20 activity log lines"
  if [ -f "_SYSTEM_LOGS/MM_ACTIVITY_LOG.md" ]; then
    tail -n 20 "_SYSTEM_LOGS/MM_ACTIVITY_LOG.md"
  else
    echo "_SYSTEM_LOGS/MM_ACTIVITY_LOG.md not found."
  fi
  section "Git"
  echo "Laptop: $(laptop_name)"
  echo "Root: $ROOT"
  echo "Branch: $(git branch --show-current)"
  echo "Last commit: $(git log -1 --oneline --decorate)"
}

section "MissionMed twin workstation start"
echo "Laptop: $(laptop_name)"
echo "Timestamp: $(timestamp_utc)"
echo "Repository: $ROOT"

if [ "$NO_PULL" -eq 1 ]; then
  echo "Pull skipped by --no-pull."
else
  if has_changes "$ROOT"; then
    handle_dirty_before_pull
  fi
  pull_rebase_repo "$ROOT" "root repository"
fi

check_nested_repos
display_session_state
