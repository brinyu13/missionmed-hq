# Product

Matrix

# Status

Protected active runtime. Evidence: `/Users/brianb/MissionMed_worktrees/MM-OS-OPTIMIZATION/MISSIONMED_SYSTEM_STATE/products.json` lists Matrix with `health` = `protected_active`; `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json` has `status` = `ACTIVE`.

# Runtime Owner

Matrix runtime truth is governed by the Matrix runtime lock protocol and manifest. Evidence: `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md` and `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`.

# Source Locations

- Manifest canonical worktrees:
  - `/Users/brianb/MissionMed_worktrees/D8-443_matrix_student_entry_learndash_phase0`
  - `/Users/brianb/MissionMed_worktrees/mm-matrix-062-calendar-app-mode-source-locked`
  - `/Users/brianb/MissionMed_worktrees/b1-storyforge-advanced-102-live-matrix-source-export`
- Manifest source paths:
  - `wp-content/plugins/missionmed-hub/assets/student-os.js`
  - `wp-content/plugins/missionmed-hub/assets/student-os.css`
  - `wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php`
  - `wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.js`
  - `wp-content/plugins/missionmed-hub/assets/student-os-calendar-v4.css`
  - `wp-content/plugins/missionmed-hub/assets/scheduler-mount.js`
  - `wp-content/plugins/missionmed-hub/assets/student-os-file-vault.js`
  - `wp-content/plugins/missionmed-hub/assets/student-os-file-vault.css`
  - `wp-content/plugins/missionmed-hub/assets/student-os-storyforge.js`
  - `wp-content/plugins/missionmed-hub/assets/student-os-storyforge.css`
- NEEDS VERIFICATION: these Matrix plugin source paths are not present on the clean `origin/main` worktree used for this passport.

# Routes and Entry Points

- `/member-dashboard/#calendar`
- `/member-dashboard/#scheduler`
- `/member-dashboard/#filevault`
- `/member-dashboard/#messages`
- `/member-dashboard/#storyforge`
- Evidence: `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md`.

# Authority Docs

- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md`
- `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`
- `/Users/brianb/MissionMed/_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`
- `/Users/brianb/MissionMed/_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`
- `/Users/brianb/MissionMed_OS/authority_index.json`

# Protected Paths

- All Matrix manifest source paths listed above.
- Student OS, Calendar, Scheduler, File Vault, Messages, and StoryForge runtime assets.
- `wp-content/plugins/missionmed-hub/**` Matrix-owned app-mode source paths.
- Matrix lock protocol and manifest files.

# Dependencies

- WordPress/Kinsta plugin runtime.
- Matrix runtime guard: `/Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py`.
- Matrix lock manifest asset hashes and canonical worktrees.
- LearnDash access rules and student portal routing. NEEDS VERIFICATION for current live behavior before changes.
- CDN/public asset delivery for public Matrix assets.

# Validation Commands

```bash
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py list-assets
python3 /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py preflight --worktree /ABSOLUTE/WORKTREE --assets all
```

Run the preflight before editing any protected Matrix runtime file. If the guard prints the stale-worktree warning, stop for Brian approval.

# Smoke Tests

- Calendar route opens Matrix-owned App Mode, not an embedded dashboard panel.
- Scheduler route opens Matrix-owned App Mode, not an embedded dashboard wizard.
- File Vault route opens File Vault 006D App Mode.
- Messages and StoryForge follow the same route-level App Mode canon when enabled.
- Dashboard does not hydrate full app modules.
- Every Matrix App Mode includes Return to Matrix Dashboard.

# Deploy and Rollback

- Do not deploy from this passport.
- Matrix deploys must use guarded deploy or a Brian-approved manual equivalent.
- Rollback backup and hash proof requirements are governed by the Matrix runtime lock protocol.

# Known Risks

- Stale worktree deploy can silently replace known-good runtime.
- Older embedded/dashboard implementations can regress Calendar, Scheduler, File Vault, Messages, or StoryForge.
- Local source availability differs by branch; use manifest canonical worktrees.
- Runtime v2 route-specific lazy loading must not be replaced by load-all behavior.

# Current State Pointer

- `/Users/brianb/MissionMed_OS/CURRENT.md`
- Mission registry: `/Users/brianb/MissionMed_OS/missions.json`

# Do Not Touch

- Do not edit or deploy Matrix runtime assets without Matrix guard preflight.
- Do not continue after a stale-worktree warning without Brian approval.
- Do not alter auth/session/bootstrap, Supabase schema/RLS/functions, storage/R2 permissions, payments, LearnDash access rules, or production student data in a Matrix ticket unless explicitly scoped.

# Last Verified

2026-07-06 by Codex using the evidence paths named in this passport.
