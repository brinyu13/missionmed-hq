# MissionMed Git Workspace Hygiene Protocol

Status: Active
Owner: MissionMed operator + Codex/Claude/ChatGPT threads

## Purpose
This protocol prevents cross-thread contamination of production workspaces and keeps routine AI outputs/logs out of the protected repo.

## MISSIONMED GIT WORKSPACE HYGIENE + AI LOGGING - MANDATORY FOR EVERY THREAD

1. `/Users/brianb/MissionMed` is protected main/integration-only.
2. Codex must not edit directly on `main`.
3. Every Codex implementation thread must use a dedicated worktree under `/Users/brianb/MissionMed_worktrees/`.
4. Before editing, Codex must run `bash _SYSTEM/scripts/mm-preflight.sh`.
5. If preflight fails, Codex must stop and report.
6. Codex must not run reset, `git clean`, destructive cleanup, deploy, push, or branch merges unless explicitly authorized.
7. Claude may use the MissionMed project/folder for context, reading, planning, and design discussion.
8. Claude must not create, save, modify, or overwrite files inside `/Users/brianb/MissionMed` unless explicitly authorized for a repo-editing task.
9. Claude/Codex demos, reports, standalone HTML files, mockups, screenshots, scratch files, backups, generated outputs, and routine activity logs must go outside the repo.
10. Newest/easiest-to-find outputs should go to `/Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/`.
11. Routine AI activity logs should go to `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/`.
12. Claude logs should go to `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/CLAUDE/`.
13. Codex logs should go to `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/CODEX/`.
14. ChatGPT orchestration notes, if exported, should go to `/Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/CHATGPT/`.
15. The repo log `/Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md` is curated and versioned. Update it only intentionally during real repo implementation work in the proper worktree/branch, and commit it with related implementation.
16. Claude planning/demo/design tasks must not append repo `MM_ACTIVITY_LOG.md` by default.
17. Codex audit-only tasks must not append repo `MM_ACTIVITY_LOG.md` by default.
18. Do not broadly ignore production folders.
19. Do not touch Drill ingestion/runtime unless explicitly scoped.
20. Do not mix unrelated workstreams in one branch/worktree.
21. If unsure where to work or save output, stop and ask.

## Required Paths
- Protected main root: `/Users/brianb/MissionMed`
- Worktree parent: `/Users/brianb/MissionMed_worktrees/`
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
3. If preflight fails on protected root/main, create/switch worktree:
   - `bash _SYSTEM/scripts/mm-thread-start.sh <ticket_id> <short_slug>`
4. `cd` into the worktree printed by the script.
5. Re-run preflight before editing.

## If Preflight Fails
- Do not edit files yet.
- Read the fail reason.
- If dirty state exists and rescue is explicitly authorized, use:
  - `bash _SYSTEM/scripts/mm-rescue-dirty.sh <label>`
- Re-enter a clean non-main worktree and rerun preflight.

## Claude Output Rule
- Claude may read MissionMed context.
- Claude should save demos/reports/scratch/routine logs to sandbox paths by default.
- Claude should not write to repo files unless explicitly authorized for repo-editing scope.

## Intentional Promotion into Source
1. Keep first draft outputs in sandbox.
2. Promote selected assets into source only from a scoped worktree branch.
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
Load SESSION_PRIMER_V2.md and apply all rules.
Load the MissionMed primer/startup protocol and follow the Git workspace hygiene + AI logging guardrails.
Do not edit /Users/brianb/MissionMed directly on main.
For Codex implementation work, use a dedicated worktree under /Users/brianb/MissionMed_worktrees/ and run bash _SYSTEM/scripts/mm-preflight.sh before editing.
If preflight fails, stop and report.
For Claude demos, reports, standalone HTML, mockups, screenshots, scratch files, backups, generated outputs, and routine activity logs, do not save inside /Users/brianb/MissionMed.
Save outputs to /Users/brianb/MissionMed_AI_Sandbox/_RECENT_AI_OUTPUTS/ and save routine logs to /Users/brianb/MissionMed_AI_Sandbox/_ACTIVITY_LOGS/.
Only update /Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md when making intentional repo changes in the proper worktree, and commit that curated summary with the related work.
Do not run reset, git clean, destructive cleanup, deploy, push, or merge unless explicitly authorized.
```
