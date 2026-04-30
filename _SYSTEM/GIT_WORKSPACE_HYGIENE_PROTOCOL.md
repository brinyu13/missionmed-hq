# MissionMed Git Workspace Hygiene Protocol

Status: Active
Owner: MissionMed operator + Codex/Claude/ChatGPT threads

## Purpose
This protocol prevents cross-thread contamination of production workspaces and keeps routine AI outputs/logs out of the protected repo.

## MISSIONMED SIMPLE GIT WORKFLOW + AI LOGGING - MANDATORY FOR EVERY THREAD

1. `/Users/brianb/MissionMed` is the primary local repo.
2. `main` should stay clean.
3. For implementation work, use a normal Git branch inside `/Users/brianb/MissionMed`.
4. Before editing, run:
   - `git status --short`
   - `git branch --show-current`
5. If on `main`, create or switch to a task branch before editing.
6. If the repo is dirty from unrelated work, stop and report.
7. Do not use `git reset`, `git clean`, destructive cleanup, deploy, push, pull, rebase, or merge unless explicitly authorized.
8. Claude/demo/scratch/report outputs must stay outside the repo in `/Users/brianb/MissionMed_AI_Sandbox/`.
9. Newest AI outputs go to `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/`.
10. Routine AI logs go to `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/`.
11. The repo `MM_ACTIVITY_LOG.md` is curated only and should not be updated by routine demo/planning tasks.
12. Worktrees are optional advanced recovery tools, not the default workflow.
13. Do not broadly ignore production folders.
14. Do not touch Drill ingestion/runtime unless explicitly scoped.
15. If unsure where to work or save output, stop and ask.

## Required Paths
- Protected main root: `/Users/brianb/MissionMed`
- Worktree parent (optional advanced workflow): `/Users/brianb/MissionMed_worktrees/`
- Sandbox root: `/Users/brianb/MissionMed_AI_Sandbox/`
- Recent output inbox: `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/`
- Routine activity logs: `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/`
- Curated candidate summaries: `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/_CURATED_FOR_REPO/`

## Logging Split (Authoritative)

### 1) Repo Curated Log
- Path: `/Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md`
- Purpose: intentional, versioned summaries attached to real implementation commits.
- Not for routine planning/audit/demo logging.

### 2) External Routine AI Logs
- Path: `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/`
- Purpose: detailed operational logs per AI system without dirtying protected repo workspaces.

### 3) Recent Output Folder
- Path: `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/`
- Purpose: easiest folder to find newest deliverables regardless of project subfolder.

## Safe Start for Every Codex Thread
1. Open terminal in repository context.
2. Run `bash _SYSTEM/scripts/mm-preflight.sh`.
3. If editing is intended and branch is `main`, create/switch to a task branch:
   - `bash _SYSTEM/scripts/mm-branch-start.sh <ticket_id> <short_slug>`
4. Re-run preflight before editing.
5. Use worktrees only when explicitly needed for advanced recovery or isolation.

## If Preflight Fails
- Do not edit files yet.
- Read the fail reason.
- If dirty state exists and rescue is explicitly authorized, use:
  - `bash _SYSTEM/scripts/mm-rescue-dirty.sh <label>`
- Re-enter a clean non-main branch and rerun preflight.
- Optional: use `mm-thread-start.sh` only for legacy worktree workflows.

## Claude Output Rule
- Claude may read MissionMed context.
- Claude should save demos/reports/scratch/routine logs to sandbox paths by default.
- Claude should not write to repo files unless explicitly authorized for repo-editing scope.

## Intentional Promotion into Source
1. Keep first draft outputs in sandbox.
2. Promote selected assets into source only from a scoped non-main branch.
3. Verify scoped diff before commit.
4. Avoid mixing unrelated promotions.

## High-Risk Source Boundaries
- WordPress runtime: `wp-content/mu-plugins/`
- LIVE runtime: `LIVE/`
- Railway runtime entrypoint: `missionmed-hq/server.mjs`
- Supabase migrations: `supabase/migrations/`
- Drill ingestion/runtime paths

Modify these only when explicitly scoped.

## Future Prompt Requirement Block (Copy/Paste)

```text
Load _SYSTEM/PRIMER_CORE.md and apply all rules.
Use the MissionMed simple Git workflow defaults.
Use /Users/brianb/MissionMed as the primary repo and keep main clean.
For implementation work, create/switch to a normal task branch in /Users/brianb/MissionMed.
Run bash _SYSTEM/scripts/mm-preflight.sh before editing.
If preflight fails, stop and report.
If currently on main and edits are planned, switch to a non-main branch first.
If repo is dirty from unrelated work, stop and report.
For Claude demos, reports, standalone HTML, mockups, screenshots, scratch files, backups, generated outputs, and routine activity logs, do not save inside /Users/brianb/MissionMed.
Save outputs to /Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/ and save routine logs to /Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/.
Only update /Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md when making intentional repo changes and commit that curated summary with related work.
Worktrees are optional tools, not the default.
Do not run reset, git clean, destructive cleanup, deploy, push, pull, rebase, or merge unless explicitly authorized.
```
