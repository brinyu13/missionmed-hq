# MissionMed Git Workspace Hygiene Protocol

Status: Active
Owner: MissionMed operator + Codex/Claude threads

## Purpose
This protocol prevents unrelated AI outputs from dirtying protected `main` and from contaminating active production workstreams.

## Core Rules
1. `/Users/brianb/MissionMed` is protected clean-main and integration-only.
2. Active coding must happen in dedicated worktrees under `/Users/brianb/MissionMed_worktrees/`.
3. One project/thread per branch and per worktree.
4. Claude/Codex demos, reports, screenshots, and scratch files belong in `/Users/brianb/MissionMed_AI_Sandbox/`.
5. `_RECENT_AI_OUTPUTS/` is the first folder to check for newest deliverables.

## Required Paths
- Protected main root: `/Users/brianb/MissionMed`
- Worktree parent: `/Users/brianb/MissionMed_worktrees/`
- Sandbox root: `/Users/brianb/MissionMed_AI_Sandbox/`
- Recent output inbox: `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/`

## Safe Start for Every Codex Thread
1. Open terminal in repository context.
2. Run: `bash _SYSTEM/scripts/mm-preflight.sh`
3. If preflight fails because you are on protected root or `main`, create/switch to a worktree:
   - `bash _SYSTEM/scripts/mm-thread-start.sh <ticket_id> <short_slug>`
4. `cd` into the worktree printed by the script.
5. Re-run preflight before editing.

## If Preflight Fails
- Do not edit files yet.
- Read the FAIL reason.
- If dirty state exists, run rescue flow guidance:
  - `bash _SYSTEM/scripts/mm-rescue-dirty.sh <label>`
- Switch to a clean non-main worktree and re-run preflight.

## When Claude Creates Standalone Demos
- Save outputs to sandbox folders first.
- Put a current copy in:
  - `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/`
- Only promote into source repo intentionally, in a scoped branch, with explicit file-level review.

## Demo Promotion Into Source (Intentional Only)
1. Confirm the target file path is production-relevant.
2. Move/copy from sandbox into the correct tracked path from a scoped worktree branch.
3. Verify `git diff -- <target_file>` shows only intended changes.
4. Do not batch unrelated demo files into one commit.

## WordPress mu-plugin Handling
- Treat `wp-content/mu-plugins/` as high-risk tracked source.
- Edit only in scoped branches/worktrees.
- No unrelated mu-plugin edits while doing non-WordPress tasks.
- Backup files should eventually move outside tracked source; do not delete/move existing backups in ad hoc cleanup.

## LIVE/CDN Runtime Handling
- `LIVE/` files are production-sensitive.
- Only modify `LIVE/` when task scope explicitly targets runtime deploy assets.
- Never mix LIVE edits with unrelated feature work.

## Supabase Handling
- `supabase/migrations/` remains tracked and protected.
- Never hide migrations via broad ignore rules.
- Local volatile CLI temp files under `supabase/.temp/` may be ignored selectively.

## MM_ACTIVITY_LOG.md Handling
- `_SYSTEM_LOGS/MM_ACTIVITY_LOG.md` remains tracked for now.
- Do not append noisy unrelated entries during tasks that do not require activity-log updates.
- If update is required, keep it scoped to the active thread and task.

## What Not To Do
- Do not run AI coding sessions on protected root `main`.
- Do not write demos/scratch files into repo root.
- Do not mix Arena/STAT/USCE/IV/Dashboard edits in one workspace session unless explicitly scoped.
- Do not use reset/clean commands to hide workflow mistakes.

## Quick Command Summary
- Preflight: `bash _SYSTEM/scripts/mm-preflight.sh`
- Start thread worktree: `bash _SYSTEM/scripts/mm-thread-start.sh <ticket_id> <short_slug>`
- Dirty rescue guidance: `bash _SYSTEM/scripts/mm-rescue-dirty.sh <label>`
