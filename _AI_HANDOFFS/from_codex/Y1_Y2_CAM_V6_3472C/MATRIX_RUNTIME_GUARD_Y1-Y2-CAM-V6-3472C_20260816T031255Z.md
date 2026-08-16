# Matrix Runtime Guard Deploy Report - Y1-Y2-CAM-V6-3472C

RESULT: FIRST DEPLOY ROLLED BACK; DR-113 COMPATIBILITY CORRECTION IN PROGRESS

Manifest: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3441-HQ-PREFLIGHT/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`
Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3472C-MATRIX`
Backup: `/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/Y1-Y2-CAM-V6-3472C/20260816T031250Z`

## Assets

### student_os_js
- App: matrix-shell
- Source: `wp-content/plugins/missionmed-hub/assets/student-os.js`
- Production: `assets/student-os.c1d97237eab4936d.js`
- Local/deployed SHA256: `16ca42c53ca2e890a1e791fc2731fc3b0c86a9082f5f801198fc1a12274593fa`

### class_mmed_student_os_php
- App: matrix-shell
- Source: `wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php`
- Production: `includes/class-mmed-student-os.php`
- Local/deployed SHA256: `aebc208fcf4d253cc2086dd24489f011f1f62cc8e1c6f1684f87f4c371a44d7e`

## Rollback

Restore the corresponding files from:
`/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/Y1-Y2-CAM-V6-3472C/20260816T031250Z`

Do not rollback with broad git reset/clean. Restore only the scoped protected assets.

## First authenticated browser outcome

- Logged-in WordPress administrator `brinyu` saw the exact existing Matrix
  left-column label `IV Prep On-Call`.
- The link used the exact fixed HQ `/api/auth/start` route.
- The first click returned to `/arena?just_logged_in=1`; the hosted IV Prep UI
  did not load.
- Root cause: HQ nests its fixed final destination inside the allowlisted
  `return_to` URL, while the WordPress MU-plugin previously read only a
  top-level `final` parameter and allowed only WordPress hosts as final hosts.
- Production Matrix assets were restored to the exact predeployment backup and
  the transient content-addressed asset was removed before DR-113 filing.

## DR-113 correction custody

- Canonical OS authority: `00ea1694aa5987e531c31a85c677459f4156ac3c`.
- Matrix feature base: `0a09411520acedb7a4ffdc7c48470674917302d0`.
- GLOBAL lease: `7b85f945-a53f-4bda-b637-6aeed0723af6`.
- Fencing epoch: `42`.
- Binding SHA-256: `a21f4a0d02ec77fb813b5136e27d887d931c429a8ad044f25180527bd8619b43`.
- Nonce SHA-256 only: `b8854b90a7e1731c59a310aa3e23aa44878a0b28dcbfbdbe3a9c7be35b2d145a`.
- No provider session was created and no LemonSlice credit was consumed.
