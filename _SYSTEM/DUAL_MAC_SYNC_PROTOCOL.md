# MissionMed Dual Mac Sync Protocol

This protocol makes two macOS Tahoe MacBooks behave like one MissionMed workstation by treating git as the handoff rail and `_SYSTEM/TWIN_STATE.md` as the current operator state.

## Start Session Command

Run this from the MissionMed repository root before work begins:

```bash
_SYSTEM/mm-sync-start.sh
```

For validation without network fetch or pull:

```bash
_SYSTEM/mm-sync-start.sh --no-pull
```

The start script detects the laptop name with `scutil`, blocks pulling while the worktree is dirty, offers commit/stash/abort, pulls the current branch with rebase when safe, checks nested repositories separately, then prints the twin state, active work, activity tail, branch, and last commit.

## End Session Command

Run this from the MissionMed repository root before leaving a laptop:

```bash
_SYSTEM/mm-sync-end.sh
```

The end script prompts for the session summary, next action, blocked items, active tool, and ticket. It updates `_SYSTEM/TWIN_STATE.md`, refreshes `_SYSTEM/ACTIVE_WORK.md`, appends `_SYSTEM_LOGS/MM_ACTIVITY_LOG.md`, stages safe sync files, shows `git diff --cached --stat`, commits as:

```text
twin-sync: [laptop-name] - [summary]
```

Then it pushes the current branch without force. Nested repositories are checked separately and are only committed or pushed if they are real nested checkouts and have their own changes.

## Recover A Stale Laptop

1. Open the stale laptop and go to the MissionMed repo root.
2. Run `_SYSTEM/mm-sync-start.sh`.
3. If local changes block the pull, choose one of the script options:
   - `commit` for safe tracked/sync files that should become shared state.
   - `stash` for local work that needs to be parked before syncing.
   - `abort` when the laptop should not be touched yet.
4. After sync, read `_SYSTEM/TWIN_STATE.md`, `_SYSTEM/ACTIVE_WORK.md`, and the last 20 lines of `_SYSTEM_LOGS/MM_ACTIVITY_LOG.md`.
5. Continue from the recorded next action.

If a nested repo is dirty, the start script does not pull it. Enter that nested repo, review its status, then commit, stash, or abort there before retrying.

## Store Prompts

- Coworker or architecture prompts go in `_AI_HANDOFFS/from_cowork/`.
- Codex prompts and reports go in `_AI_HANDOFFS/from_codex/`.
- Claude Code prompts and reports go in `_AI_HANDOFFS/from_claude_code/`.
- Reusable prompt templates go in `_SYSTEM/PROMPT_TEMPLATES/`.
- Claude configuration and reusable prompt assets may go in `.claude/` when they are not local worktrees, caches, secrets, or machine-only state.

## Store AI Outputs

- Codex outputs: `_AI_HANDOFFS/from_codex/[TICKET]_REPORT.md`.
- Claude outputs: `_AI_HANDOFFS/from_claude_code/[TICKET]_REPORT.md`.
- ChatGPT or cowork outputs: `_AI_HANDOFFS/from_cowork/[TICKET]_ARCHITECTURE.md`.
- Append durable session history to `_SYSTEM_LOGS/MM_ACTIVITY_LOG.md`.
- Append machine-readable learnings to `_SYSTEM_LOGS/LEARNINGS_LOG.jsonl`.
- Keep durable brain/index material under `08_AI_SYSTEM/MissionMed_AI_Brain/`.

Large screenshots, recordings, raw ingestion media, generated build output, and backups should not be auto-staged. If a media artifact must be kept, document where it lives and why before intentionally tracking it.

## Never Put In Git

- `.env`, `.env.*`, API keys, tokens, private keys, service-role secrets, database URLs, or credentials.
- `node_modules/`, `.venv*/`, `venv/`, package caches, and local build caches.
- `_BUILD_TEMP/`, `_CACHE/`, `MissionMed_AI_Sandbox/`, `_BACKUPS/`, `BACKUPS/`, `07_BACKUPS/`.
- `VIDEOS FOR INGESTION/`, large raw media, audio/video source files, and ad hoc backup folders such as `VIDEO_SYSTEM_BACKUP*/`.
- Local-only `.DS_Store` files.
- Nested repository contents staged through the root repository when the nested path has its own `.git`.

## Must Always Be Trackable

- `_AI_HANDOFFS/`
- `_SYSTEM_LOGS/MM_ACTIVITY_LOG.md`
- `_SYSTEM_LOGS/LEARNINGS_LOG.jsonl`
- `08_AI_SYSTEM/MissionMed_AI_Brain/`
- `_SYSTEM/TWIN_STATE.md`
- `_SYSTEM/ACTIVE_WORK.md`
- `_SYSTEM/DUAL_MAC_SYNC_PROTOCOL.md`
- `_SYSTEM/mm-sync-start.sh`
- `_SYSTEM/mm-sync-end.sh`
- `.claude/` prompt/config assets that are not local worktrees, caches, or secrets

## Safety Rules

- Never force-push.
- Never run `reset --hard`.
- Never delete files as part of sync.
- Never deploy or run Railway deploy from these scripts.
- Never assume untracked files are junk.
- Preserve existing work and make the next laptop read the latest state before editing.
