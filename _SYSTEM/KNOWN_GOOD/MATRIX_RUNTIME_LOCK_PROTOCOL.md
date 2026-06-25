# Matrix Runtime Lock Protocol

Status: ACTIVE
Authority: MissionMed Matrix Runtime Known-Good Lock
Effective: 2026-05-27

This protocol applies to every Codex, Claude, Cowork, or human-assisted task that touches MissionMed Matrix runtime, Matrix-owned App Mode, Matrix student/admin shell wiring, Matrix app assets, or related deploy/cache behavior.

## Protected Runtime Canon

Matrix apps are Matrix-owned full App Mode experiences. They are not standalone rewrites and they must not render as embedded dashboard panels after route selection.

Protected student routes:
- `/member-dashboard/#calendar`
- `/member-dashboard/#scheduler`
- `/member-dashboard/#filevault`
- `/member-dashboard/#messages`
- `/member-dashboard/#storyforge`

Protected global invariant:
- Dashboard route may show overview widgets, but it must not hydrate the full Calendar, Scheduler, File Vault, Messages, or StoryForge apps.
- App routes must apply `body.matrix-app-mode` plus the module-specific body class before app content paints when practical.
- App routes must include a visible Return to Matrix Dashboard control.
- Runtime v2 lazy loading must remain enabled and route-specific.

## Mandatory Guard Before Editing

Before editing any protected Matrix runtime file, run:

```bash
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py preflight \
  --worktree /ABSOLUTE/WORKTREE \
  --assets ASSET_KEY_OR_ALL
```

Use `--assets all` for shell/router work.

The guard compares local source hashes, production origin hashes, public cache-busted hashes where applicable, and the active manifest:

`/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`

If the guard prints this warning, stop:

```text
WARNING: You are about to work from an old Matrix runtime version. Do not edit or deploy without Brian approval.
```

Do not continue until Brian explicitly approves the exact stale source/asset override.

## Mandatory Guard Before Deploy

Matrix runtime deploys must use the guarded deploy command or must manually perform every equivalent step and document proof.

Preferred command:

```bash
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py guarded-deploy \
  --worktree /ABSOLUTE/WORKTREE \
  --assets ASSET_KEY[,ASSET_KEY...] \
  --ticket TICKET-ID \
  --brian-approved
```

The guarded deploy:
1. Loads the lock manifest.
2. Confirms local files exist.
3. Creates a fresh Kinsta rollback backup before upload.
4. Uploads only the requested scoped assets.
5. Verifies production origin SHA256 equals local SHA256.
6. Verifies public cache-busted SHA256 equals local SHA256 for public assets.
7. Writes a timestamped deploy report.

Do not use direct `scp` for protected Matrix runtime assets unless the guard is unavailable and Brian explicitly authorizes a manual equivalent.

## Changing The Locked Version

Scoped app changes are allowed. Silent downgrades are not.

A new locked Matrix runtime version may be accepted only after:
- Brian authorized the scoped ticket.
- Preflight confirmed the starting point was not stale, or Brian explicitly approved the stale override.
- A fresh Kinsta rollback backup exists.
- Local, production origin, and public cache-busted hashes are recorded.
- Calendar/Scheduler/File Vault/Messages/StoryForge/Dashboard route regressions are validated as applicable.
- The lock manifest is updated with new hashes, versions, backup path, and validation ticket.
- A final report records rollback instructions.

## Protected Asset Keys

Current lock asset keys:
- `student_os_js`
- `student_os_css`
- `class_mmed_student_os_php`
- `calendar_v4_js`
- `calendar_v4_css`
- `scheduler_mount_js`
- `file_vault_js`
- `file_vault_css`

Use `python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py list-assets` to print the current manifest entries.

## Required Prompt Language

Every Matrix-related task prompt should include:

```text
MATRIX RUNTIME LOCK REQUIRED:
Before editing or deploying protected Matrix assets, load:
/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md
Then run:
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py preflight --worktree <WORKTREE> --assets all
If the guard warns that the worktree/source is stale, stop and wait for Brian approval.
Do not deploy protected Matrix assets except through the guarded deploy path or a Brian-approved manual equivalent.
```

## Absolute No-Regression Rules

Do not replace:
- Prototype v4 Calendar with an older embedded Calendar UI.
- Matrix-owned Scheduler App Mode with an embedded dashboard wizard.
- 006D File Vault App Mode with the simplified fallback shell.
- Matrix app-mode route classes with dashboard-only rendering.
- Runtime v2 route-specific loading with load-all-module behavior.

Do not change as part of Matrix UI work:
- auth/session/bootstrap/exchange
- Supabase schema/RLS/functions
- storage buckets/R2 permissions
- payments/orders/products/enrollments/subscriptions
- LearnDash access rules
- Zoom/Webex/SMS/email business logic
- production student data

## Completion Standard

Do not mark a Matrix runtime task COMPLETE unless:
- The guard preflight passed or Brian approved the exact override.
- A rollback backup exists for every deployed protected asset.
- Production origin hashes match the intended local files.
- Public cache-busted hashes match the intended local files where applicable.
- Route behavior still matches the Matrix-owned App Mode canon.
- The manifest is updated if the known-good version changed.
