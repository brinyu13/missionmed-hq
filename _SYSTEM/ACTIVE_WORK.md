# MissionMed Active Work

## Current Ticket

- Ticket: MM-DUALMAC-SCRIPTS-001
- Branch: codex/mm-dualmac-scripts-001
- Tool: Codex
- Repository: MissionMed
- Status: COMPLETE

## Active Objective

Make two macOS Tahoe MacBooks operate as one MissionMed workstation by adding guarded start/end sync scripts, shared state files, and a written dual-Mac protocol.

## Next Action

Review the generated sync system, then run `_SYSTEM/mm-sync-start.sh` at the beginning of laptop work and `_SYSTEM/mm-sync-end.sh` before leaving a laptop.

## Blocked Items

- `_AI_HANDOFFS/from_cowork/MM-DUALMAC-SEAMLESS-001_ARCHITECTURE.md` was not present in this ticket worktree at implementation time.

## Safety Notes

- Do not deploy from the sync scripts.
- Do not force-push from the sync scripts.
- Do not stage `.env`, secret-looking files, large media, archives, or nested repo contents into the root repository.
