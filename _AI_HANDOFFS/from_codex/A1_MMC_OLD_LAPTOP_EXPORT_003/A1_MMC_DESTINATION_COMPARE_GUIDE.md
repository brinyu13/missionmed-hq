# A1 MMC Destination Compare Guide

FIRST ACTION ON DESTINATION: COMPARE, NOT APPLY.

This package is quarantine evidence from the old laptop. Do not copy files over the active repository, do not check out old branches over dirty work, do not merge before review, do not apply patches automatically, do not deploy, and do not change production.

## Safe Compare Workflow

```bash
set -euo pipefail

EXPORT_ARCHIVE="$HOME/Downloads/A1_MMC_OLD_LAPTOP_EXPORT_003_20260710.tar.gz"
QUARANTINE="$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003"
mkdir -p "$QUARANTINE"

tar -xzf "$EXPORT_ARCHIVE" -C "$QUARANTINE"
cd "$QUARANTINE/A1_MMC_OLD_LAPTOP_EXPORT_003"
shasum -a 256 -c checksums/archive.sha256

mkdir -p "$QUARANTINE/bundle-inspect"
cd "$QUARANTINE/bundle-inspect"
git clone "$QUARANTINE/A1_MMC_OLD_LAPTOP_EXPORT_003/git/missionmed-old-laptop-complete.bundle" old-laptop-missionmed
cd old-laptop-missionmed
git branch -a
git log --oneline --decorate --graph --all --max-count=80
```

## Fetch Old Laptop Refs Into A Separate Namespace

Run this only from the destination laptop's current MissionMed repo after confirming the worktree is clean or after saving its dirty work elsewhere.

```bash
set -euo pipefail

CURRENT_REPO="$HOME/MissionMed"
OLD_PACKAGE="$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003/A1_MMC_OLD_LAPTOP_EXPORT_003"

cd "$CURRENT_REPO"
git status --short --branch

git fetch "$OLD_PACKAGE/git/missionmed-old-laptop-complete.bundle" \
  'refs/heads/*:refs/remotes/old-laptop/*' \
  'refs/tags/*:refs/tags/old-laptop/*'

git branch -r | grep 'old-laptop/' | sort
```

## Generate Review Diffs

```bash
set -euo pipefail
cd "$HOME/MissionMed"

mkdir -p "$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003/destination-diffs"

git diff --name-status origin/main...refs/remotes/old-laptop/codex/mmc-019-preserve-mmc \
  > "$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003/destination-diffs/mmc-019-name-status.txt" || true

git diff origin/main...refs/remotes/old-laptop/codex/mmc-019-preserve-mmc -- \
  missionmed-hq/server.mjs \
  missionmed-hq/routes/mmc-coaching-pipeline.mjs \
  missionmed-hq/lib/mmc-coaching-import-worker.mjs \
  missionmed-hq/lib/mmc-student-resolution-engine.mjs \
  missionmed-hq/lib/mmc-roster-verification-lane.mjs \
  missionmed-hq/lib/mmc-webex-triggered-pull.mjs \
  missionmed-hq/public/mmc-private \
  missionmed-hq/prompts \
  missionmed-hq/tests \
  supabase/migrations \
  _AI_HANDOFFS/from_codex \
  > "$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003/destination-diffs/mmc-019-focused.diff" || true
```

## Review Rules

1. Identify uniquely newer MMC changes by comparing old-laptop refs against destination refs.
2. Cherry-pick or manually port only approved commits/files after human review.
3. Run validators before integration.
4. Never merge the entire old-laptop repository wholesale.
5. Never deploy from this package.
