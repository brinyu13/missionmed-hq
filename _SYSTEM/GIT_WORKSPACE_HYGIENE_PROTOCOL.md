# MissionMed Git Workspace Hygiene Protocol

Status: Active
Owner: MissionMed operator + Codex/Claude/ChatGPT threads

## Purpose
This protocol prevents cross-thread contamination of production workspaces and keeps routine AI outputs/logs out of the protected repo.

## MISSIONMED SIMPLE GIT WORKFLOW + AI LOGGING - MANDATORY FOR EVERY THREAD

### MISSIONMED DIRTY-STATE TRIAGE — CURRENT DEFAULT

1. Dirty repo status is not an automatic blocker.
2. Dirty repo status requires inspection and classification.
3. AI must identify dirty tracked files and untracked files before editing.
4. AI may continue only if dirty files do not overlap the intended task and no destructive cleanup is required.
5. AI must stop if dirty files overlap intended edits or touch production-sensitive areas outside the task scope.
6. AI must never reset, clean, delete, stash, force checkout, pull, rebase, merge, push, or deploy unless explicitly authorized.
7. Codex must stage only intended files.
8. Claude planning/demo/design may continue if outputs stay outside the repo.
9. Routine AI outputs/logs must stay outside the repo.
10. Worktrees are optional advanced tools, not default workflow.
11. New threads must load PRIMER_CORE.md, KNOWLEDGE_INDEX.md, and MISSIONMED_MASTER_KNOWLEDGE.md.
12. SESSION_PRIMER_V2.md is deprecated for new threads and must not be used as the active primer.

Additional MissionMed defaults:

1. `/Users/brianb/MissionMed` is the primary local repo.
2. `main` is protected for routine edits; use a scoped task branch unless explicitly authorized.
3. Before editing, run `git branch --show-current` and `git status --short`.
4. Claude/demo/scratch/report outputs must stay outside the repo in `/Users/brianb/MissionMed_AI_Sandbox/`.
5. Newest AI outputs go to `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/`.
6. Routine AI logs go to `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/`.
7. The repo `MM_ACTIVITY_LOG.md` is curated only and should not be updated by routine demo/planning tasks.
8. Do not broadly ignore production folders.
9. Do not touch Drill ingestion/runtime unless explicitly scoped.
10. If unsure where to work or save output, stop and ask.

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
4. If repo is dirty, classify tracked/untracked files and confirm non-overlap with intended edits.
5. Re-run preflight with explicit scope before editing:
   - `bash _SYSTEM/scripts/mm-preflight.sh --edit-scope "path1 path2"`
6. Use worktrees only when explicitly needed for advanced recovery or isolation.

## If Preflight Fails
- Do not edit files yet.
- Read the fail reason.
- If dirty state exists and rescue is explicitly authorized, use:
  - `bash _SYSTEM/scripts/mm-rescue-dirty.sh <label>`
- If preflight reported sensitive overlap, narrow scope or switch to an explicitly authorized task.
- Re-run preflight after scope correction.
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
Load KNOWLEDGE_INDEX.md and MISSIONMED_MASTER_KNOWLEDGE.md for MissionMed knowledge routing.
Use /Users/brianb/MissionMed as the primary repo and follow the MissionMed simple Git workflow.
Run bash _SYSTEM/scripts/mm-preflight.sh before editing and apply dirty-state triage results.
Dirty repo does not mean automatic stop; inspect, classify, and proceed only when scope is safe and non-overlapping.
If currently on main and edits are planned, create/switch to a scoped task branch first unless explicitly authorized.
Do not use SESSION_PRIMER_V2.md as the active primer for new threads.
For Claude demos, reports, standalone HTML, mockups, screenshots, scratch files, backups, generated outputs, and routine activity logs, do not save inside /Users/brianb/MissionMed.
Save outputs to /Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/ and save routine logs to /Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/.
Only update /Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md when making intentional repo changes and commit that curated summary with related work.
Worktrees are optional tools, not the default.
Do not run reset, git clean, destructive cleanup, deploy, push, pull, rebase, or merge unless explicitly authorized.
```
