# MissionMed Live Coordination Protocol

This is V2 of the dual-Mac workflow. V1 still uses git, `_SYSTEM/TWIN_STATE.md`, `_SYSTEM/ACTIVE_WORK.md`, and the sync scripts for durable handoff. V2 adds a pinned GitHub Issue as the live browser-visible coordination board.

## Purpose

The live board lets the MacBook Air and MacBook Pro see current MissionMed work state immediately without requiring a commit, pull, or sync script just to learn what is happening.

Use it for:
- Current task
- Current laptop
- Current AI tool
- Latest status
- Latest result
- Blockers
- Next action

## How The Live Board Works

The board is one GitHub Issue in `brinyu13/missionmed-hq`. Its issue number is stored in:

```bash
_SYSTEM/.live-issue-number
```

Each comment is a short live status update. Refresh the issue page on either laptop to see the newest coordination state.

The live board is not a replacement for git. It is the fast coordination surface between durable handoffs.

## Create A New Thread

Run:

```bash
_SYSTEM/mm-new-thread.sh
```

The script creates an issue titled:

```text
MM-LIVE: [DATE] Active Work Coordination
```

It applies the `live-coord` label, attempts to pin the issue, and writes the issue number into `_SYSTEM/.live-issue-number`.

## Open The Board

Run:

```bash
_SYSTEM/mm-open-board.sh
```

This opens the configured live issue in the default macOS browser.

## Post Status Updates

Run:

```bash
_SYSTEM/mm-post.sh "Started intake validation on MacBook Air with Codex."
```

The script posts a GitHub Issue comment containing the laptop name, UTC timestamp, and status message.

## How Codex Should Use It

Codex should post when it starts meaningful implementation work, reaches a validation checkpoint, hits a blocker, or completes a ticket. During `_SYSTEM/mm-sync-end.sh`, Codex receives an automatic `SESSION END` live post when `_SYSTEM/.live-issue-number` contains a valid issue number and `gh` is available.

Codex should still create durable reports under `_AI_HANDOFFS/from_codex/` when a ticket requires a handoff or implementation report.

## How Claude Code Should Use It

Claude Code should post before editing, after validation, and whenever control should move to another laptop or AI tool. Keep comments short and action-oriented.

Claude Code should still write durable reports under `_AI_HANDOFFS/from_claude_code/` when implementation context must survive beyond the browser thread.

## How ChatGPT Should Use It

ChatGPT should post coordination summaries, architecture decisions, next actions, and blockers that the active laptop must see immediately.

ChatGPT should still store durable architecture or planning artifacts under `_AI_HANDOFFS/from_cowork/` when they need to be versioned.

## How Claude Cowork Should Use It

Claude Cowork should use the live board as the active coordination bus for current task ownership, tool assignment, status, and next action. It should link or reference durable handoff files when those files become the lasting source of truth.

## When To Use Git

Use git for:
- Code
- Reports
- Handoffs
- Knowledge files
- Logs
- Durable state files
- Work that must be reviewable, diffable, or restorable

End laptop sessions with:

```bash
_SYSTEM/mm-sync-end.sh
```

Start laptop sessions with:

```bash
_SYSTEM/mm-sync-start.sh
```

## When NOT To Use Git

Do not commit or pull just to discover what the other laptop is doing. Open or refresh the live board instead.

Do not use git for:
- In-progress status pings
- "I am starting this now"
- "Validation is running"
- "Blocked on X"
- "Handing control to MacBook Pro"
- Short-lived coordination notes that do not need durable version history

## V1 vs V2

V1 is the sequential laptop-switching protocol:
- Git is the source of truth for durable work.
- `_SYSTEM/TWIN_STATE.md` and `_SYSTEM/ACTIVE_WORK.md` record the last synced state.
- `_SYSTEM/mm-sync-start.sh` and `_SYSTEM/mm-sync-end.sh` move work safely between laptops.

V2 is the live coordination layer:
- A pinned GitHub Issue is the source of truth for active work status.
- Browser refresh shows the latest state immediately on both laptops.
- Git remains the source of truth for code, reports, durable handoffs, knowledge, and logs.

## Alias Recommendations

Add these aliases to the shell profile on each laptop:

```bash
alias mm-board='_SYSTEM/mm-open-board.sh'
alias mm-post='_SYSTEM/mm-post.sh'
alias mm-start='_SYSTEM/mm-sync-start.sh'
alias mm-end='_SYSTEM/mm-sync-end.sh'
alias mm-state='sed -n "1,160p" _SYSTEM/TWIN_STATE.md'
alias mm-work='sed -n "1,160p" _SYSTEM/ACTIVE_WORK.md'
```

Use aliases from the MissionMed repository root.
