# MissionMed Git Hygiene Scripts

These scripts implement minimal workspace safety guardrails.

## Scripts
- `mm-preflight.sh`: Blocks edits in unsafe contexts (`main`, protected root, dirty workspace).
- `mm-thread-start.sh`: Creates a scoped worktree branch under `/Users/brianb/MissionMed_worktrees/`.
- `mm-rescue-dirty.sh`: Prints dirty state and guides/optionally performs explicit rescue commit flow.

## Usage
```bash
bash _SYSTEM/scripts/mm-preflight.sh
bash _SYSTEM/scripts/mm-thread-start.sh G8 git-hygiene
bash _SYSTEM/scripts/mm-rescue-dirty.sh C8-pre-fix
```

## Notes
- No script performs reset/clean operations.
- `mm-rescue-dirty.sh` never commits silently.
