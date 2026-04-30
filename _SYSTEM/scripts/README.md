# MissionMed Git Hygiene Scripts

These scripts implement minimal workspace safety guardrails.

## Scripts
- `mm-preflight.sh`: Reports branch/status and enforces dirty-state triage (dirty repo is not an automatic blocker).
- `mm-branch-start.sh`: Creates/switches to a scoped branch (`work/<ticket>-<slug>`) in `/Users/brianb/MissionMed`.
- `mm-thread-start.sh`: Legacy optional helper for worktree creation under `/Users/brianb/MissionMed_worktrees/`.
- `mm-rescue-dirty.sh`: Prints dirty state and guides/optionally performs explicit rescue commit flow.

## Usage
```bash
bash _SYSTEM/scripts/mm-preflight.sh
bash _SYSTEM/scripts/mm-branch-start.sh G8 git-hygiene
bash _SYSTEM/scripts/mm-thread-start.sh G8 git-hygiene
bash _SYSTEM/scripts/mm-rescue-dirty.sh C8-pre-fix
```

## Notes
- No script performs reset/clean operations.
- `mm-rescue-dirty.sh` never commits silently.
