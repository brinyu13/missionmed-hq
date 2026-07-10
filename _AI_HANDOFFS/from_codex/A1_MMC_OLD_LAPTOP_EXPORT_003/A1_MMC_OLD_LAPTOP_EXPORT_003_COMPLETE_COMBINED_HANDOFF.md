# README FIRST — A1_MMC_OLD_LAPTOP_EXPORT_003

RESULT: SAFE QUARANTINED EXPORT PACKAGE

This package is an old-laptop evidence export for MMC / Matrix Mentor Console / Mentor Intelligence work. It is not a repository synchronization, not a production update, and not a merge package.

## Non-Destructive Rules

- Compare, do not apply.
- Do not copy files over the destination repo.
- Do not merge old-laptop branches wholesale.
- Do not deploy.
- Do not run database writes or migrations from this package.
- Treat every item as quarantine evidence until reviewed on the destination laptop.

## Package Summary

- Generated UTC: `2026-07-10T16:48:30Z`
- Source worktrees inventoried: `111`
- MMC-relevant worktrees identified: `4`
- File-matrix rows: `255`
- Relevant ahead commit records observed: `19`
- Dirty MMC worktree exports: `4`
- Non-git asset inventory rows: `3`
- Git bundle: `git/missionmed-old-laptop-complete.bundle`
- Git bundle SHA-256: `0288d80922085a9217c3dd939a654f80093c040bb242c1045d29934e133127e9`

## Required First Destination Action

Open `DESTINATION_IMPORT_SAFETY.md` and run comparison commands in a quarantine folder. Do not apply patches automatically.


# MMC Complete Context Handoff — A1_MMC_OLD_LAPTOP_EXPORT_003

This handoff preserves the old-laptop MMC evidence and the safety posture for later destination review.

## Safety Posture

- No production/live systems were touched.
- No Railway, Supabase production, WordPress, LearnDash, Matrix production, Scheduler, Calendar, Webex, R2, Stream, Daily Drills, video registry, auth, or RLS mutation was performed.
- Source worktrees were read and diffed only.
- Dirty worktrees were preserved via quarantine patches/full-file copies only.
- Destination action is compare, never apply.

## Authority Notes

- Default `/Users/brianb/MissionMed_OS` was absent. Because this mission's write boundary forbids creating that folder, the task used local `_SYSTEM` authority files from the active worktree and canonical repo.
- `MISSIONMED_MASTER_KNOWLEDGE.md` is deprecated by current authority and was not used as active context.
- Matrix runtime lock protocol was loaded. No protected Matrix runtime edit or deploy was performed, so runtime guard preflight was not invoked.
- Canonical learning-log append is blocked by the mission write boundary because `/Users/brianb/MissionMed` is read-only evidence for this task.

## Key Outputs

- `MIGRATION_MANIFEST.md`
- `DESTINATION_IMPORT_SAFETY.md`
- `git/missionmed-old-laptop-complete.bundle`
- `worktree_exports/`
- `reports_and_handoffs/`
- `checksums/`
- `_AI_HANDOFFS/from_codex/A1_MMC_OLD_LAPTOP_EXPORT_003/`


# A1 MMC Relevant Worktree Inventory

All listed source worktrees are evidence sources only. Destination action is compare, never apply.

| path | branch | head | upstream | ahead_behind | dirty | relevant | labels | evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /Users/brianb/.codex/worktrees/dfcb/MissionMed |  | 16c045c03516 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed | audit/supabase-2026-grants-20260527-101117 | 2aeee6454954 | NONE | NO_UPSTREAM | YES | YES | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, VERIFIED | path/branch/status/commit evidence matched MMC relevance |
| /Users/brianb/MissionMed-Webex | feature/webex-meeting-integration | 3e8104c032bf | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed-Webex-arena-drills | feat/arena-battles-drill-gamification | 55577a78de11 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed/.claude/worktrees/bold-pascal-7e5566 | claude/bold-pascal-7e5566 | 16c045c03516 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed/.claude/worktrees/stoic-gates-3ec552 | claude/stoic-gates-3ec552 | 40b59ef87857 | NONE | NO_UPSTREAM | YES | YES | DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, VERIFIED | path/branch/status/commit evidence matched MMC relevance |
| /Users/brianb/MissionMed/.claude/worktrees/suspicious-banzai-c023f9 |  | cd8ee1bde242 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed/.claude/worktrees/unruffled-hoover-82e42b |  | 38ad5fb1798e | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed/.claude/worktrees/xenodochial-boyd-614697 |  | 7409a82f056b | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/codex-cx-offer-318b-cdn-deploy | codex/cx-offer-318b-cdn-deploy | e7442e0859e4 | origin/cx-offer-usce-public-intake-deploy-310i | ahead 0, behind 24 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/codex-usce-public-intake-main-hotfix | codex/usce-public-intake-main-hotfix | 2d953e526d18 | origin/main | ahead 2, behind 13 | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-316e2-route-fix | cx-offer-316e2-route-fix | 27a771b35105 | origin/cx-offer-usce-public-intake-deploy-310i | ahead 0, behind 29 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-316g-railway-build-recovery | cx-offer-316g-railway-build-recovery | 224779818da6 | origin/cx-offer-usce-public-intake-deploy-310i | ahead 0, behind 31 | NO | NO | DO NOT TOUCH, OBSOLETE, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-317-endgame-efficient | cx-offer-317-endgame-efficient | 2116af4921bf | origin/cx-offer-usce-public-intake-deploy-310i | ahead 0, behind 27 | NO | NO | DO NOT TOUCH, OBSOLETE, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-320-full-engine | cx-offer-320-full-engine | 8a00a9de9d81 | origin/cx-offer-usce-public-intake-deploy-310i | ahead 0, behind 23 | NO | NO | DO NOT TOUCH, OBSOLETE, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-321-comms | cx-offer-321-comms | 8a00a9de9d81 | origin/cx-offer-usce-public-intake-deploy-310i | ahead 0, behind 23 | NO | NO | DO NOT TOUCH, OBSOLETE, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-322-gmail-auth-setup | codex/cx-offer-322-gmail-auth-setup | f008cdf9c1a2 | origin/codex/cx-offer-322-gmail-auth-setup | ahead 0, behind 0 | NO | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN, VERIFIED | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-322-gmail-postmark | codex/cx-offer-322-gmail-postmark | 029b648f0522 | origin/codex/cx-offer-322-gmail-postmark | ahead 0, behind 0 | NO | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN, VERIFIED | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-324-gmail-metadata-proof | cx-offer-324-gmail-metadata-proof | aa19be8c707d | origin/cx-offer-usce-public-intake-deploy-310i | ahead 1, behind 22 | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-325-gmail-sync-dry-run | cx-offer-325-gmail-sync-dry-run | 522291b4412e | origin/cx-offer-usce-public-intake-deploy-310i | ahead 1, behind 21 | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-326-gmail-comms-write-gate | cx-offer-326-gmail-comms-write-gate | 99efe98743cb | origin/cx-offer-usce-public-intake-deploy-310i | ahead 0, behind 19 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-328-final-admin-engine | cx-offer-328-final-admin-engine | 61d95ce28306 | origin/cx-offer-usce-public-intake-deploy-310i | ahead 0, behind 17 | NO | NO | DO NOT TOUCH, OBSOLETE, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-328c-full-operational-template | cx-offer-328c-full-operational-template | 99efe98743cb | origin/cx-offer-usce-public-intake-deploy-310i | ahead 0, behind 19 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-328d-live-admin-template | cx-offer-328d-live-admin-template | 6ebff59a41f3 | origin/cx-offer-328d-live-admin-template | ahead 0, behind 0 | NO | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN, VERIFIED | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-330-usce-status-tracker | cx-offer-331-public-intake-persistence | 261ad5d7cd1a | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-usce-public-intake-307 | cx-offer-usce-public-intake-deploy-310i | 10f9ebbe3bca | origin/cx-offer-usce-public-intake-deploy-310i | ahead 1, behind 32 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-wiring-authority-2 | codex/cx-offer-wiring-authority-2 | ca442e6e3a82 | origin/cx-offer-usce-public-intake-deploy-310i | ahead 6, behind 23 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/D3-402-drills-v3-deploy-only |  | 791da3e78fcf | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/D3-403-drills-v3-avatar-deploy-20260513T112435Z |  | cf590c715d47 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/usce-admin-auth-relay-main-hotfix | codex/usce-admin-auth-relay-main-hotfix | 40b59ef87857 | origin/main | ahead 0, behind 9 | NO | NO | DO NOT TOUCH, OBSOLETE, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003 | a1-macair-mmc-mentor-intelligence-003 | 9c1fa72e6b05 | origin/main | ahead 0, behind 0 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | path/branch/status/commit evidence matched MMC relevance; active migration/report worktree; excluded as old-laptop MMC source evidence |
| /Users/brianb/MissionMed_worktrees/ahp-profile-rls-identity-hardening-013 | ahp/profile-rls-identity-hardening-013 | 791da3e78fcf | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/ar-001-arena-stat-drills-dropdown-consolidation | codex/ar-001-arena-stat-drills-dropdown-consolidation | 88a8d83a56cc | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_Worktrees/AR-LIVELOCK-000_source_guardrails | feature/ar-livelock-000-source-guardrails | 38ad5fb1798e | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/AR-LIVELOCK-000_source_guardrails | feature/ar-livelock-000-source-guardrails | 38ad5fb1798e | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/arena-homepage-concepts-001 | arena-homepage-concepts-001 | 38ad5fb1798e | origin/main | ahead 0, behind 16 | YES | NO | DO NOT TOUCH, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-clean | av3/profile-locker-v3-parallel-002 | ddf8de1631e4 | origin/av3/profile-locker-v3-parallel-002 | ahead 0, behind 0 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-current-arena-repair | av3/profile-locker-v3-current-arena-repair-002-g | 138d1e3be8e5 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/cache-coherence-repair-001 | mr/cache-coherence-repair-001 | 7409a82f056b | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/codex-daily-rounds-stream-menu-repair-20260430 | codex/daily-rounds-stream-menu-repair-20260430 | 95efb00c7427 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/d8-432-b-calendar-scheduler-one-thread | codex/d8-432-b-calendar-scheduler-one-thread | d1819890421d | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/d8-435-admin-matrix-preview | feature/d8-435-admin-matrix-preview | 38ad5fb1798e | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/d8-435-admin-matrix-preview-plugin | feature/d8-435-admin-matrix-preview-plugin | 0a80ea1129bf | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/d8-437-matrix-runtime-v2-stage1 | d8-437-matrix-runtime-v2-stage1 | 38ad5fb1798e | origin/main | ahead 0, behind 16 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/d8-439-hq-admin-runtime-v2-stage1 | d8-439-hq-admin-runtime-v2-stage1 | 38ad5fb1798e | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_Worktrees/D8-443_matrix_student_entry_learndash_phase0 | feature/d8-443-matrix-student-entry-learndash-phase0 | 38ad5fb1798e | origin/main | ahead 0, behind 16 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/D8-443_matrix_student_entry_learndash_phase0 | feature/d8-443-matrix-student-entry-learndash-phase0 | 38ad5fb1798e | origin/main | ahead 0, behind 16 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_WORKTREES/D8-445-wp-student-ux-cleanup | worktree/d8-445-wp-student-ux-cleanup-20260528-122632 | 38ad5fb1798e | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/D8-445-wp-student-ux-cleanup | worktree/d8-445-wp-student-ux-cleanup-20260528-122632 | 38ad5fb1798e | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/D8-460_matrix_calendar_admin_student_repair | feature/d8-460-matrix-calendar-admin-student-repair | 40b59ef87857 | origin/main | ahead 0, behind 9 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/D8-461_calendar_wiring_bootstrap_authority | feature/d8-461-calendar-wiring-bootstrap-authority | 40b59ef87857 | origin/main | ahead 0, behind 9 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/d8-hq-legacy-wiring-phase1 | d8-hq-legacy-wiring-phase1 | bf540d459c26 | origin/main | ahead 13, behind 16 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/drj-jbank-revival | feature/DRJ-JBANK-001-drj-jbank-revival | 38ad5fb1798e | origin/main | ahead 0, behind 16 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_Worktrees/DRJ-LD-QBANK-CODEX-001 | drj-ld-qbank-001-audit | 38ad5fb1798e | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/DRJ-LD-QBANK-CODEX-001 | drj-ld-qbank-001-audit | 38ad5fb1798e | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/drj-zoom-notes-012-drills-v3-filevault | drj-zoom-notes-012-drills-v3-filevault | 38ad5fb1798e | origin/main | ahead 0, behind 16 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/drj-zoom-notes-automation | feature/DRJ-ZOOM-NOTES-001-automation | 38ad5fb1798e | origin/main | ahead 0, behind 16 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/e9-matrix-stat-async-bridge-905a | e9-matrix-stat-async-bridge-905a | 38ad5fb1798e | origin/main | ahead 0, behind 16 | NO | NO | DO NOT TOUCH, OBSOLETE, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/e9-stat-async-human-authority-901 | e9-stat-async-human-authority-901 | 0a20491a3afb | origin/main | ahead 5, behind 16 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/g5-avatar | g5-avatar-worktree-500 | 049ae2811055 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/gp-006-grandprix-race-prototype | codex/grandprix-race-prototype-006 | 50ade02f02de | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_WORKTREES/k9-memberships | k9-memberships-wp-setup-303 | 16c045c03516 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/k9-memberships | k9-memberships-wp-setup-303 | 16c045c03516 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/learndash-integration/mr-ldi-002-learndash-inventory-audit | codex/mr-ldi-002-learndash-inventory-audit | 38ad5fb1798e | origin/main | ahead 0, behind 16 | NO | NO | DO NOT TOUCH, OBSOLETE, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/learndash-integration/mr-ldi-004b-hub-product-alias-map | codex/mr-ldi-004b-hub-product-alias-map | 38ad5fb1798e | origin/main | ahead 0, behind 16 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/learndash-integration/mr-ldi-004d-authority-lock | codex/mr-ldi-004d-authority-lock | 38ad5fb1798e | origin/main | ahead 0, behind 16 | NO | NO | DO NOT TOUCH, OBSOLETE, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 0a82af65d580 | origin/mr/live-source-of-truth-reconcile-004 | ahead 18, behind 0 | YES | YES | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, VERIFIED | none |
| /Users/brianb/MissionMed_WORKTREES/md-merger-daily-drills | md-daily-drills-v3-side-by-side-014 | 1225074a894f | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/md-merger-daily-drills | md-daily-drills-v3-side-by-side-014 | 1225074a894f | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/merge-mm-dualmac-scripts-001 | merge/mm-dualmac-scripts-001 | 5cc9144bfc77 | origin/main | ahead 0, behind 13 | NO | NO | DO NOT TOUCH, OBSOLETE, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mm-dualmac-scripts-001 | main | 7409a82f056b | origin/main | ahead 8, behind 22 | NO | NO | DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/MM-FILEVAULT-ACCESS-UNLOCK-001 | feature/mm-filevault-access-unlock-001 | 2aeee6454954 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/MM-GMAIL-SHEETS-ARCHIVE-001 | MM-GMAIL-SHEETS-ARCHIVE-001 | 5cc9144bfc77 | origin/main | ahead 0, behind 13 | NO | NO | DO NOT TOUCH, OBSOLETE, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/MM-LAUNCH-SEV1-001-FIXES | codex/mm-launch-sev1-001-fixes | 9cf7b73896d6 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/MM-LAUNCH-SEV1-008-FINALIZE | codex/mm-launch-sev1-008-finalize | fa888464f9f1 | origin/main | ahead 0, behind 11 | NO | NO | DO NOT TOUCH, OBSOLETE, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mm-matrix-062-calendar-app-mode | mm-matrix-062-calendar-app-mode | 38ad5fb1798e | origin/main | ahead 0, behind 16 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mm-matrix-062-calendar-app-mode-source-locked | mm-matrix-062-calendar-app-mode-source-locked | 38ad5fb1798e | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/MM-PAYMENTS-LOCK-016A-cross-mac-sync-audit | MM-PAYMENTS-LOCK-016A-cross-mac-sync-audit | 40b59ef87857 | origin/main | ahead 0, behind 9 | YES | NO | DO NOT TOUCH, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mm-sched-012-schema-api-foundation | mm-sched-012-schema-api-foundation | a966e8826919 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mm-sched-047-live-integrations | mm-sched-047-live-integrations | a966e8826919 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mm-sched-055a-zoom-drj-examprep | mm-sched-055a-zoom-drj-examprep | a966e8826919 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mm-sched-sev1-008c-usce-safe-repair | codex/mm-sched-sev1-008c-usce-safe-repair | 358629fcec5b | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mm-sched-sev1-014-enrollment-gate-release | mm-sched-sev1-014-enrollment-gate-release | 40b59ef87857 | origin/main | ahead 0, behind 9 | YES | NO | DO NOT TOUCH, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mm-sched-webex-055-dr-brian-webex-booking | mm-sched-webex-055-dr-brian-webex-booking | 8007161534cb | origin/mm-sched-webex-055-dr-brian-webex-booking | ahead 13, behind 0 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c | origin/codex/mmc-019-preserve-mmc | ahead 0, behind 0 | YES | YES | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, VERIFIED | path/branch/status/commit evidence matched MMC relevance |
| /Users/brianb/MissionMed_WORKTREES/mob9-mobile | mob9-mobile-game-modes-lab-400 | 16c045c03516 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mob9-mobile | mob9-mobile-game-modes-lab-400 | 16c045c03516 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_Worktrees/MR-BRAND-TRANSITION-002-legacy-popup | feature/mr-brand-transition-002-legacy-popup | 107d988bd987 | origin/feature/mr-brand-transition-002-legacy-popup | ahead 1, behind 0 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/MR-BRAND-TRANSITION-002-legacy-popup | feature/mr-brand-transition-002-legacy-popup | 107d988bd987 | origin/feature/mr-brand-transition-002-legacy-popup | ahead 1, behind 0 | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/missionmed_worktrees/MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1 | MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1 | 2aeee6454954 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1 | MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1 | 2aeee6454954 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mx-filevault | codex/mx-filevault-phase0-preflight | 7409a82f056b | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mx-filevault-candidate-tracer-quarantine | codex/mx-filevault-candidate-tracer-quarantine | e6418ffaa9f2 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mx-filevault-source-r2-quarantine | codex/mx-filevault-source-r2-quarantine | 741bb63f2b5e | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/mx-filevault-v1-build-007 | codex/mx-filevault-v1-build-007-fresh | 0a80ea1129bf | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_Worktrees/payments_hq_frontend_rehome | codex/payments-hq-frontend-rehome | 61623a8c9687 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/payments_hq_frontend_rehome | codex/payments-hq-frontend-rehome | 61623a8c9687 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_Worktrees/payments_stripe_routing_audit | payments/multi-stripe-routing-audit | c25c0e75639f | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/payments_stripe_routing_audit | payments/multi-stripe-routing-audit | c25c0e75639f | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/qbank-003-step2ck-dual-ui-demo | qbank-003-step2ck-dual-ui-demo | 7409a82f056b | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_WORKTREES/s9-stat-advanced | s9-stat-advanced-300 | 16c045c03516 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/s9-stat-advanced | s9-stat-advanced-300 | 16c045c03516 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/stat-answer-layout-motion-058 | codex/stat-answer-layout-motion-058 | 2ca3a4f4315c | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/stat-v3-ai-rivals-privacy-cleanroom-016 | codex/stat-v3-training-rivals-authorized-upload-linkback-048 | 51aae1a4ff22 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/stat-v3-ai-rivals-staging-plan-027 | codex/stat-v3-ai-rivals-staging-plan-027 | 4bf8c103b7ea | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/stat-v3-human-opponent-roster-responsive-repair-056 | codex/stat-v3-human-opponent-roster-responsive-repair-056 | 56f301d77323 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/stat-v3-live-repair-057 | codex/stat-v3-live-repair-057 | 6355df291450 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/stat-v3-training-rivals-prod-megarun-050 | codex/stat-v3-training-rivals-prod-megarun-050 | a29e86eab8c5 | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_WORKTREES/t9-tournamed | t9-tournamed-match-madness-worktree-201 | 16c045c03516 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/t9-tournamed | t9-tournamed-match-madness-worktree-201 | 16c045c03516 | NONE | NO_UPSTREAM | YES | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |
| /Users/brianb/MissionMed_worktrees/usce-email-tracker-live-deploy-20260513 |  | 358629fcec5b | NONE | NO_UPSTREAM | NO | NO | DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, UNKNOWN | none |

## Relevant Details

### /Users/brianb/MissionMed

- Branch: `audit/supabase-2026-grants-20260527-101117`
- HEAD: `2aeee64549548d7cefd6d64d65a5fb633b525f4e`
- Upstream: `NONE`
- Commit date: `2026-06-06T12:20:50-04:00`
- Ahead/behind: `NO_UPSTREAM`
- Labels: `DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REQUIRES-DIFF-ON-DESTINATION, VERIFIED`
- Whether work already on remote branch: `NO`
- Whether work exists only on this laptop: `YES`
- Whether it overlaps with another MMC worktree: `SEE CHANGE ORIGIN MATRIX`
- Whether it appears superseded locally: `UNKNOWN_REQUIRES_DESTINATION_DIFF`
- Whether authority is uncertain: `YES`

#### Relevant Commits
- `2aeee64549548d7cefd6d64d65a5fb633b525f4e	2026-06-06T12:20:50-04:00	MM-DUALMAC-LOCAL-MERGE-LOG-CONFLICT: resolve activity log conflict`

#### Files Changed / Relevant
- `08_AI_SYSTEM/MissionMed_AI_Brain/KNOWLEDGE_INDEX.md`
- `2026 Roster, Session A 360.numbers`
- `Announcer Correct Answer.mp3`
- `CHANGELOG/CHANGELOG_MASTER.md`
- `Cheering Small Crowd.mp3`
- `Child Voice Try Again 2.mp3`
- `Dr J's Students Match 2026, Live IMG Match Q&A & Strategy Session with Dr Brian (Mission Residency)-20250903 0813-1.txt`
- `Dr J's Students_ Match 2026, Live IMG Match Q&A & Strategy Session with Dr Brian (Mission Residency)-20250903 0813-1.vtt`
- `MISSIONMED_MASTER_KNOWLEDGE.md`
- `MM_ACTIVITY_LOG.md`
- `Mission Residency ALUMNI Matched MissionMed_Alumni_Residency_List *************************.numbers`
- `Roblox.dmg`
- `Rowen_Logo_SOM.svg`
- `_AI_HANDOFFS/from_claude_code/DRJ-ZOOM-NOTES-003_REPORT.md`
- `_AI_HANDOFFS/from_claude_code/MR-1411_Premium_Cohort_Experience_Upgrade.md`
- `_AI_HANDOFFS/from_claude_code/MR-1412_Final_360_Welcome_Email_Report.md`
- `_AI_HANDOFFS/from_claude_code/MR-ORI-WEBEX-KEYNOTE-002H_BUILD_REPORT.md`
- `_AI_HANDOFFS/from_claude_code/MR-ORI-WEBEX-KEYNOTE-002I_V2_FINISH_REPORT.md`
- `_AI_HANDOFFS/from_claude_code/MX-003_StoryForge_Matrix_Mimic_Report.md`
- `_AI_HANDOFFS/from_claude_code/MX-003_StoryForge_Matrix_Visual_Rebuild_Report.md`
- `_AI_HANDOFFS/from_codex/D8-443K_Restore_Course_Shell_REST_Routes_Report.md`
- `_AI_HANDOFFS/from_codex/D8-443L_360_First_Login_Revalidation_Report.md`
- `_AI_HANDOFFS/from_codex/D8-443M_Phase2_Matrix_LearnDash_Student_Journey_Report.md`
- `_AI_HANDOFFS/from_codex/D8-443N_Phase2_App_Link_Deep_Validation_Report.md`
- `_AI_HANDOFFS/from_codex/MATRIX_RUNTIME_LOCK_GUARD_HANDOFF.md`
- `_AI_HANDOFFS/from_codex/MM-ALUMNI-NETWORK-DATA-026/DATA_026_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MM-ALUMNI-NETWORK-DATA-026/EXECUTION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MM-SCHED-CALENDAR-FINAL-001.md`
- `_AI_HANDOFFS/from_codex/MM-SCHED-WEBEX-055_DrBrian_Webex_Booking_Calendar_Report.md`
- `_AI_HANDOFFS/from_codex/MM-SUPABASE-GRANTS-001_Read_Only_Audit_Report.md`
- `_AI_HANDOFFS/from_codex/MR-1413_Final_360_Welcome_Email_Renderer_Report.md`
- `_AI_HANDOFFS/from_codex/MR-1414C_Matrix_HQ_Welcome_Emails_Placement_Fix_Report.md`
- `_AI_HANDOFFS/from_codex/MR-1414_Course_Specific_Welcome_Email_Admin_Tool_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-010A_Matrix_LearnDash_Shell_Deploy_Gate_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-010B_Matrix_My_Match_Path_Authenticated_Validation_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-011A_Matrix_Course_Shell_Source_Drift_Reconciliation_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-011_360_Match_Mentorship_Course_Build_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-012A_Controlled_Clean_Test_Student_Access_Validation_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-012_End_To_End_LearnDash_Launch_Validation_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-013_360_Course_Matrix_Detail_QA_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-014B_360_Course_Polish_Execution_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-015B_360_Matrix_LearnDash_Visual_Copy_Polish_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-016_LearnDash_Fallback_Polish_And_Course_Shell_Restore_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-017A_Student_OS_Frontend_Drift_Restore_Relock_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-017B_Final_LearnDash_Matrix_Launch_Lock_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-017C_Student_OS_Frontend_Drift_Guard_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-017D_Final_LearnDash_Matrix_Launch_Lock_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-017_LearnDash_Matrix_Known_Good_Launch_Lock.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-018A_360_Only_QA_Account_Validation_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-018A_Existing_QA_Account_Access_Validation_Report.md`
- `_AI_HANDOFFS/from_codex/MR-LDI-018_Final_QA_And_Launch_Polish_Report.md`
- `_AI_HANDOFFS/from_cowork/D8-433_MATRIX_RUNTIME_V2_ARCHITECTURE_AND_CODEX_HANDOFF.md`
- `_AI_HANDOFFS/from_cowork/D8-434_UI_First_Matrix_Admin_Mirror_Architecture_and_Codex_Handoff.md`
- `_AI_HANDOFFS/from_cowork/D8-438_HQ_ADMIN_RUNTIME_MIRROR_ARCHITECTURE_AND_CODEX_HANDOFF.md`
- `_AI_HANDOFFS/from_cowork/D8-440A_HQ_ADMIN_UI_SOURCE_RECOVERY_AND_SCREENSHOT_GATE.md`
- `_AI_HANDOFFS/from_cowork/D8-440B_CODEX_ADMIN_UI_SCREENSHOT_CAPTURE_PROMPT.md`
- `_AI_HANDOFFS/from_cowork/D8-460B9_CLAUDE_READ_ONLY_AUDIT.md`
- `_AI_HANDOFFS/from_cowork/DRJ-LEARNING-INTELLIGENCE-001_MASTER_PRODUCT_DESIGN.md`
- `_AI_HANDOFFS/from_cowork/DRJ-ZOOM-NOTES-005_ARCHITECTURE_STRATEGY_REVIEW.md`
- `_AI_HANDOFFS/from_cowork/DRJ-ZOOM-NOTES-009_UI_REDESIGN_REPORT.md`
- `_AI_HANDOFFS/from_cowork/DRJ-ZOOM-NOTES-010A_DESIGN_REVIEW.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_01_KNOWLEDGE_NOTES.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_02_SOURCE_MAP.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_03_SYSTEMS_INVENTORY.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_04_WIRING_PATTERNS.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_05_INGREDIENT_MANIFESTS.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_06_SPECIALTY_TEMPLATES.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_07_WIZARD_FLOW.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_08_TRACKER_MODEL.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_09_AI_ORCHESTRATION_MODEL.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_10_RISK_REGISTER.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_10_SAFETY_MODEL.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_11_FORGE_OS_PRODUCT_SPEC.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_12_CODEX_READ_ONLY_SOURCE_AUDIT_PROMPT.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_13_CLAUDE_CODE_UI_PROTOTYPE_PROMPT.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_14_RED_TEAM.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_AUTHORITY_REASSESSMENT.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_EVIDENCE_LEDGER.md`
- `_AI_HANDOFFS/from_cowork/MFORGE-002C/MFORGE-002C_FINAL_REPORT.md`
- `_AI_HANDOFFS/from_cowork/MM-ARENA-FABLE-QA-001_STATv3_DRILLSv3_DEEP_AUDIT.md`
- `_AI_HANDOFFS/from_cowork/MM-ARENA-FABLE-REPAIR-003_REPORT.md`
- `_AI_HANDOFFS/from_cowork/MM-ARENA-STUDY-METHODS-001_RESEARCH_REPORT.md`
- `_AI_HANDOFFS/from_cowork/MM-CAL-060_MATRIX_CALENDAR_APP_MODE_ARCHITECTURE_AND_CODEX_HANDOFF.md`
- `_AI_HANDOFFS/from_cowork/MM-LAUNCH-AUDIT-001_MASTER_REPORT.md`
- `_AI_HANDOFFS/from_cowork/MM-MATRIX-061_UNIFIED_APP_MODE_DIRECTIVE.md`
- `_AI_HANDOFFS/from_cowork/MM-MATRIX-FABLE-HANDOFF-001.md`
- `_AI_HANDOFFS/from_cowork/MMC-019A_PRE_PRODUCTION_ARCHITECTURE_REVIEW_BOARD.md`
- `_AI_HANDOFFS/from_cowork/MR-1405_Enrollment_Welcome_System.md`
- `_AI_HANDOFFS/from_cowork/MR-1410_Premium_Welcome_Email_Redesign.md`
- `_AI_HANDOFFS/from_cowork/MR-BRAND-TRANSITION-001_mission_residency_legacy_transition_spec.md`
- `_AI_HANDOFFS/from_cowork/MR-BRAND-TRANSITION-004_legacy_popup_redesign_deploy_report.md`
- `_AI_HANDOFFS/from_cowork/MR-LDI-009_Matrix_Native_LearnDash_Shell_Spec.md`
- `_AI_HANDOFFS/from_cowork/MR-LDI-015_360_Matrix_LearnDash_UX_Polish_Plan.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002C_patch_insertion_checklist.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002C_testimonial_voice_patch.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002D-RESET_matrix_and_source_hierarchy_patch.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002D-RESET_matrix_builder_checklist.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002D_matrix_slide_build_sheet.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002D_merged_keynote_builder_packet.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002D_printable_keynote_pass_checklist.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002D_testimonial_approval_sheet.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002D_theme_locked_matrix_slide_build_sheet.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002D_theme_locked_merged_keynote_builder_packet.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002D_theme_locked_printable_keynote_pass_checklist.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002E_theme_preservation_patch.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002F_PASS_canonical_base_patch.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002F_PASS_matrix_slide_build_sheet.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002F_PASS_printable_keynote_pass_checklist.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002F_PASS_theme_locked_builder_packet.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002_keynote_webex_checklist.md`
- `_AI_HANDOFFS/from_cowork/MR-ORI-WEBEX-KEYNOTE-002_orientation_rebuild_blueprint.md`
- `_AI_HANDOFFS/from_cowork/MR-WEBSITE-FABLE-REIMAGINE-001_REPORT.md`
- `_AI_HANDOFFS/from_cowork/MX-FILEVAULT-007_Orchestration_Handoff_Note.md`
- `_AI_HANDOFFS/from_cowork/WEBEX-108-FABLE-END-TO-END-LIVE-DRILLS-REPAIR_REPORT.md`
- `_SYSTEM/AUTHORITY_STACK_CURRENT.md`
- `_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`
- `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`
- `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md`
- `_SYSTEM/KNOWN_GOOD/MISSIONMED_SCHEDULER_CALENDAR_FINAL_STATE.md`
- `_SYSTEM/KNOWN_GOOD/SCHEDULER_CALENDAR_PROTECTED_KNOWN_GOOD.md`
- `_SYSTEM/PRIMER_CORE.md`
- `_SYSTEM/PRIMER_EXT_INTEGRITY.md`
- `_SYSTEM/tools/matrix_runtime_guard.py`
- `_SYSTEM_LOGS/LEARNINGS_LOG.jsonl`
- `_SYSTEM_LOGS/LEARNINGS_LOG_BACKUP_20260524T015145Z_MR-BRAND-TRANSITION-002.jsonl`
- `_SYSTEM_LOGS/LEARNINGS_LOG_BACKUP_20260524T122842Z_MR-BRAND-TRANSITION-003.jsonl`
- `_SYSTEM_LOGS/MM_ACTIVITY_LOG.md`
- `_SYSTEM_LOGS/MM_ACTIVITY_LOG_BACKUP_20260524T015145Z_MR-BRAND-TRANSITION-002.md`
- `_SYSTEM_LOGS/MM_ACTIVITY_LOG_BACKUP_20260524T122842Z_MR-BRAND-TRANSITION-003.md`
- `_SYSTEM_LOGS/append_learning.py`
- `_SYSTEM_LOGS/read_learnings.py`
- `_SYSTEM_REPORTS/D8-440A_ADMIN_UI_CANDIDATE_SOURCE_MAP.md`
- `_SYSTEM_REPORTS/MATRIX_RUNTIME_GUARD_MM-CAL-20260606-CATEGORY-TITLE-TWEAKS_20260607T002345Z.md`
- `_SYSTEM_REPORTS/MATRIX_RUNTIME_GUARD_MM-REC-002_20260606T012252Z.md`
- `_SYSTEM_REPORTS/MATRIX_RUNTIME_LOCK_GUARD_IMPLEMENTATION_REPORT.md`
- `rowan_logo_horizontal.svg`
- `supabase/.temp/gotrue-version`
- `supabase/.temp/pooler-url`
- `supabase/.temp/postgres-version`
- `supabase/.temp/project-ref`
- `supabase/.temp/rest-version`
- `supabase/.temp/storage-migration`
- `supabase/.temp/storage-version`
- `wp-content/mu-plugins/missionmed-arena-homepage-ux.php`
- `wp-content/mu-plugins/missionmed-arena-routing-fix.php`
- `wp-content/mu-plugins/missionmed-dashboard-arena-cta.php`

### /Users/brianb/MissionMed/.claude/worktrees/stoic-gates-3ec552

- Branch: `claude/stoic-gates-3ec552`
- HEAD: `40b59ef878577878c69498ab98c5511ccf7c7935`
- Upstream: `NONE`
- Commit date: `2026-06-16T10:58:22-04:00`
- Ahead/behind: `NO_UPSTREAM`
- Labels: `DO NOT TOUCH, LOCAL-ONLY, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, VERIFIED`
- Whether work already on remote branch: `YES`
- Whether work exists only on this laptop: `YES`
- Whether it overlaps with another MMC worktree: `SEE CHANGE ORIGIN MATRIX`
- Whether it appears superseded locally: `UNKNOWN_REQUIRES_DESTINATION_DIFF`
- Whether authority is uncertain: `YES`

#### Relevant Commits
- `9273263d6fe261b11dad7aa0c07d575a6f04f4a4	2026-06-24T16:46:45-04:00	Add MMC partner demo public route`
- `624bf26b4173c1877ae7b537c55b964137a006ba	2026-06-24T16:29:03-04:00	Create mmc-ownership-layer.js`
- `7ff56ecf36df287168d65163b494f9349cae35bb	2026-06-24T16:10:33-04:00	Create mmc-data-adapters.js`
- `1e645b20e7e2c0115c9a14573fd4f10e42eafa80	2026-06-24T16:05:46-04:00	MMC-101: add MMC static assets (styles.css)`
- `acbe6dd66512a7f6f05d72c8c55898f6fda5c15c	2026-06-24T15:57:47-04:00	MMC-MEGARUN-101: deploy MMC Mentor Console server with persistence`
- `1be8a3d1617c9549987982a485d7d46f18932662	2026-06-23T20:43:24-04:00	preserve MMC private review payload and schema foundation`
- `7b55f04ab6f0fca232efa5a0c2c90b822e187204	2026-06-23T15:29:20-04:00	MMC-014A: tighten private route authorization`
- `49bb583dfd87e7b5402da8d85836e9c18808a55b	2026-06-23T14:24:04-04:00	MMC-014: mount private Mentor Console review`

#### Files Changed / Relevant
- `.claude/launch.json`
- `_AI_HANDOFFS/from_claude_code/MMC-003_PROTOTYPE_REPORT.md`

### /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004

- Branch: `mr/live-source-of-truth-reconcile-004`
- HEAD: `0a82af65d580fa291f2e4080f47ff026305b91d1`
- Upstream: `origin/mr/live-source-of-truth-reconcile-004`
- Commit date: `2026-06-03T16:09:22-04:00`
- Ahead/behind: `ahead 18, behind 0`
- Labels: `DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, VERIFIED`
- Whether work already on remote branch: `YES`
- Whether work exists only on this laptop: `YES`
- Whether it overlaps with another MMC worktree: `SEE CHANGE ORIGIN MATRIX`
- Whether it appears superseded locally: `UNKNOWN_REQUIRES_DESTINATION_DIFF`
- Whether authority is uncertain: `YES`

#### Relevant Commits
- `0a82af65d580fa291f2e4080f47ff026305b91d1	2026-06-03T16:09:22-04:00	fix(scheduler): remove Mission Residency daily booking cap`
- `9457d4640954f980c791d92d29bcb31cf679b266	2026-06-03T15:51:50-04:00	fix(scheduler): restore student Matrix scheduler API path`
- `85b5998edb85935ac3e88a3e9eaf0b98dff91b19	2026-05-13T21:05:25-04:00	USCE mirror tracker emails and sender`
- `fffba4e12089ac7a4a82b508842de0813e03fe7e	2026-05-13T17:19:50-04:00	USCE tracker emails and homepage CTA polish`
- `ecec26df370ea9e056d8335245664b0e920830ca	2026-05-13T08:51:10-04:00	S9-311 polish STAT V3 menu and runtime feedback`
- `cf590c715d476ba12fe6bf83839f756bc9f68a97	2026-05-12T22:48:18-04:00	S9-310 prove STAT V3 live async runtime`
- `791da3e78fcf1caee50c2ad499694c9c3159a4b0	2026-05-11T12:37:34-04:00	Document Arena layer fix live validation`
- `707d359663c1753354ad50b42c2713623e305866	2026-05-11T12:14:53-04:00	Fix Arena avatar card foreground layering`
- `65ef3d37938b27ce813bef35bd1576413c32fc92	2026-05-11T11:47:21-04:00	Document Arena avatar play cue deploy`
- `a5c2fb8970439e94ffe504ece8be5729c34a2b74	2026-05-11T11:09:59-04:00	Fix Arena avatar staging and play cue`
- `09ac749bb96d0d98be3d445b3f330df75d6e9ec9	2026-05-11T07:57:10-04:00	Guard Woo Stripe routing against test credentials`
- `abf8cb7049da840581d54951c6cda3fde0fab3db	2026-05-11T07:23:13-04:00	Document partial Stripe account validation`
- `a5a4bf3502b99056540df263ae5ac8524f5c6e10	2026-05-10T12:25:58-04:00	Add three-account Stripe WooCommerce routing`
- `2a0f8e4c0c19d13c74b33ebc4685c0da54a7e960	2026-05-10T11:26:14-04:00	Document USCE email production validation`
- `66b323f77bfefe586f51489066d59c0b60f51f4f	2026-05-10T11:02:08-04:00	Harden USCE admin notification delivery`
- `ae75ba137b1d357d2fa83a2eb6df040f3bcfcffb	2026-05-10T10:47:18-04:00	Restore USCE Railway deploy manifest`
- `bc8091328920196603525bf7fac37e4fd03d1035	2026-05-10T10:11:25-04:00	Fix USCE email notification wiring`
- `2d060271ff2ea05cf4be1357a4e9d7f21cd93e7b	2026-05-10T00:22:00-04:00	Fix Arena lobby avatar anchoring`

#### Files Changed / Relevant
- `.gitignore`
- `CHANGELOG/CHANGELOG.md`
- `Dockerfile.railway-usce`
- `LIVE/arena.html`
- `LIVE/daily.html`
- `LIVE/daily_drills_v3.html`
- `LIVE/drills.html`
- `LIVE/stat.html`
- `LIVE/stat_v3.html`
- `LIVE/usce_admin.html`
- `LIVE/usce_offer.html`
- `LIVE/usce_request.html`
- `LIVE/usce_status_tracker.html`
- `VALIDATION/live_state_report.mjs`
- `VALIDATION/validate_live_state.sh`
- `VALIDATION/validate_stripe_three_account_routing.mjs`
- `_AI_HANDOFFS/from_claude_code/A12-001_ARENA_ACTIVITY_UIUX_CONCEPT_REPORT.md`
- `_AI_HANDOFFS/from_claude_code/A12-002_STUDENT_FULL_HISTORY_TOPIC_ANALYTICS_UI_REPORT.md`
- `_AI_HANDOFFS/from_codex/A12-003_ARENA_ACTIVITY_BACKEND_EVENT_CONTRACT_MAP.md`
- `_AI_HANDOFFS/from_codex/ARENA_AVATAR_PLAY_CUE_LIVE_VALIDATION_20260511.md`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_cdn_hard_layer_20260516T144015Z.html`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_cdn_play_cue_20260516T150423Z.html`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_cdn_postdeploy_20260516T142824Z.html`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_hard_layer_deploy_20260516T144015Z.txt`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_layer_deploy_20260516T142824Z.txt`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_no_blur_play_arrow_20260516T151209Z.txt`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_no_blur_play_arrow_html_system_20260516T151432Z.txt`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_play_cue_deploy_20260516T150423Z.txt`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_staging_hard_layer_20260516T144015Z.html`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_staging_play_cue_20260516T150423Z.html`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_staging_postdeploy_20260516T142824Z.html`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_wp_hard_layer_20260516T144015Z.headers`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_wp_hard_layer_20260516T144015Z.html`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_wp_play_cue_20260516T150423Z.headers`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_wp_play_cue_20260516T150423Z.html`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_wp_postdeploy_20260516T142824Z.headers`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/arena_wp_postdeploy_20260516T142824Z.html`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/kinsta_clear_arena_20260516T142824Z.body`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/kinsta_clear_arena_20260516T142824Z.headers`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/kinsta_clear_arena_hard_layer_20260516T144015Z.body`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/kinsta_clear_arena_hard_layer_20260516T144015Z.headers`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/kinsta_clear_arena_play_cue_20260516T150423Z.body`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_DEPLOY_20260516/kinsta_clear_arena_play_cue_20260516T150423Z.headers`
- `_AI_HANDOFFS/from_codex/ARENA_LAYER_FIX_LIVE_VALIDATION_20260511.md`
- `_AI_HANDOFFS/from_codex/ARENA_ONLY_DEPLOY_MANIFEST_20260511.json`
- `_AI_HANDOFFS/from_codex/AV3-003_AVATAR_V3_ENGINE_FIX_REPORT.md`
- `_AI_HANDOFFS/from_codex/D3-401_DRILLS_V3_LEGACY_RECONCILIATION_MAP.md`
- `_AI_HANDOFFS/from_codex/D3-401_DRILLS_V3_PRODUCTION_REPAIR_REPORT.md`
- `_AI_HANDOFFS/from_codex/D3-402_DRILLS_V3_DEPLOY_ONLY_REPORT.md`
- `_AI_HANDOFFS/from_codex/D3-403_DRILLS_V3_AVATAR_PROPAGATION_LIVE_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-002_CACHE_COHERENCE_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-003_PROVENANCE_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_LIVE_STATE_AFTER_RECONCILIATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_RECONCILIATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_arena.headers`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_arena.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_arena_cb.headers`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_daily.headers`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_daily.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_daily_cb.headers`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_drills.headers`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_drills.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_drills_cb.headers`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_stat.headers`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_stat.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-004_live_captures/cdn_stat_cb.headers`
- `_AI_HANDOFFS/from_codex/MR-CACHE-005_CANONICAL_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-005_VALIDATION_TOOLING_RECONCILIATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-006_POST_MERGE_LIVE_STATE.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-006_SAME_DAY_RECONCILIATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-007_POST_AUDIT_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-007_SEMANTIC_RECONCILIATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_POST_RECONCILIATION_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_SOURCE_ONLY_RECONCILIATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_live_captures/daily_drills_v3_cdn.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_live_captures/daily_drills_v3_cdn_cache_busted.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_live_captures/daily_drills_v3_wp.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_live_captures/daily_drills_v3_wp_cache_busted.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_live_captures/stat_v3_cdn.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_live_captures/stat_v3_cdn_cache_busted.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_live_captures/stat_v3_wp.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-008_live_captures/stat_v3_wp_cache_busted.html`
- `_AI_HANDOFFS/from_codex/MR-CACHE-009_POST_STATV3_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-009_STATV3_RECONCILIATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-010_APPLIED_SAME_DAY_FIXES_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-010_POST_APPLY_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_GHOST_CURSOR_AUDIO_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_GHOST_CURSOR_AUDIO_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_LEGACY_STAT_GAMEPLAY_CONTRACT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_POST_ASYNC_PATCH_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_POST_PATCH_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_RANDOM_OPPONENT_FIX_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_RANDOM_OPPONENT_FIX_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_STATV3_ASYNC_PARITY_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_STATV3_AUTH_HANDOFF_401_FIX_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_STATV3_GAMEPLAY_PARITY_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_STATV3_V3_UI_RUNTIME_REPAIR_REPORT.md`
- `_AI_HANDOFFS/from_codex/MR-CACHE-011_V3_UI_RUNTIME_REPAIR_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/S9-309-a_CHANGELOG.md`
- `_AI_HANDOFFS/from_codex/S9-309-a_POST_DEPLOY_LIVE_STATE.md`
- `_AI_HANDOFFS/from_codex/S9-309-a_POST_PATCH_LIVE_STATE.md`
- `_AI_HANDOFFS/from_codex/S9-309-a_POST_PURGE_ATTEMPT_LIVE_STATE.md`
- `_AI_HANDOFFS/from_codex/S9-309-a_STAT_V3_DEPLOY_REPORT.md`
- `_AI_HANDOFFS/from_codex/S9-309-a_STAT_V3_LEGACY_RECONCILIATION_MAP.md`
- `_AI_HANDOFFS/from_codex/S9-309-a_STAT_V3_PRODUCTION_REPAIR_REPORT.md`
- `_AI_HANDOFFS/from_codex/S9-309-a_backups/S9-309-a_LIVE_stat_v3_20260512T022949Z.html.bak`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_cdn_postdeploy_20260512T101744Z.html`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_cdn_postdeploy_cachebusted_20260512T101744Z.html`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_cdn_predeploy_20260512T101744Z.html`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_kinsta_exact_purge_body_20260512T103340Z.txt`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_kinsta_exact_purge_headers_20260512T103340Z.txt`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_staging_postdeploy_20260512T101744Z.html`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_wp_after_kinsta_purge_20260512T103340Z.html`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_wp_after_kinsta_purge_headers_20260512T103340Z.txt`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_wp_postdeploy_20260512T101744Z.html`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_wp_postdeploy_cachebusted_20260512T101744Z.html`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_wp_postdeploy_cb_headers_20260512T101744Z.txt`
- `_AI_HANDOFFS/from_codex/S9-309-a_deploy_captures/stat_v3_wp_postdeploy_normal_headers_20260512T101744Z.txt`
- `_AI_HANDOFFS/from_codex/S9-310-a_POST_DEPLOY_LIVE_STATE_20260512.md`
- `_AI_HANDOFFS/from_codex/S9-310-a_STAT_V3_FOLLOWUP_REPAIR_REPORT_20260512.md`
- `_AI_HANDOFFS/from_codex/S9-310-a_STAT_V3_LIVE_ASYNC_PROOF_REPORT_20260513.md`
- `_AI_HANDOFFS/from_codex/S9-310-a_STAT_V3_PAUSE_CHECKPOINT_20260512.md`
- `_AI_HANDOFFS/from_codex/S9-310-a_backups/S9-310-a_LIVE_stat_v3_20260512T142240Z.html.bak`
- `_AI_HANDOFFS/from_codex/S9-310-a_backups/stat_v3.before-live-async-proof-hardening.20260513T014427Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/S9-310-a_stat_v3_deploy_sha_20260513T001208Z.txt`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/S9-310-a_stat_v3_deploy_sha_20260513T004257Z.txt`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/S9-310-a_stat_v3_deploy_sha_20260513T012319Z.txt`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/cdn_live_busted_20260513T001208Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/cdn_live_busted_20260513T004257Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/cdn_live_busted_20260513T012319Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/cdn_live_normal_20260513T001208Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/cdn_live_normal_20260513T004257Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/cdn_live_normal_20260513T012319Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/cloudflare_exact_purge_20260513T001208Z.txt`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/cloudflare_exact_purge_20260513T004257Z.txt`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/cloudflare_exact_purge_20260513T012319Z.txt`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/kinsta_clear_stat_v3_20260513T001208Z.body`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/kinsta_clear_stat_v3_20260513T001208Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/kinsta_clear_stat_v3_20260513T004257Z.body`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/kinsta_clear_stat_v3_20260513T004257Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/kinsta_clear_stat_v3_20260513T012319Z.body`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/kinsta_clear_stat_v3_20260513T012319Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/kinsta_retry_20260513T012716Z.body`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_cdn_20260513T015200Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_cdn_20260513T022515Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_cdn_live_busted_20260513T001208Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_cdn_live_busted_20260513T004257Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_cdn_live_busted_20260513T012319Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_cdn_live_normal_20260513T001208Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_cdn_live_normal_20260513T004257Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_cdn_live_normal_20260513T012319Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_deploy_20260513T015200Z.txt`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_deploy_20260513T022515Z.txt`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_kinsta_clear_20260513T015200Z.json`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_kinsta_clear_20260513T022515Z.json`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_staging_20260513T001208Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_staging_20260513T004257Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_staging_20260513T012319Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T001208Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T004257Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T012319Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T015200Z_1.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T015200Z_2.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T015200Z_3.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T015200Z_4.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T015200Z_5.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T015200Z_6.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T015200Z_7.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T015200Z_8.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T022515Z_1.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T022515Z_2.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T022515Z_3.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T022515Z_4.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T022515Z_5.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T022515Z_6.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T022515Z_7.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_busted_20260513T022515Z_8.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T001208Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T004257Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T012319Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T015200Z_1.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T015200Z_2.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T015200Z_3.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T015200Z_4.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T015200Z_5.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T015200Z_6.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T015200Z_7.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T015200Z_8.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T022515Z_1.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T022515Z_2.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T022515Z_3.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T022515Z_4.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T022515Z_5.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T022515Z_6.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T022515Z_7.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_normal_20260513T022515Z_8.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/stat_v3_wp_retry_20260513T012716Z.html`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/wp_stat_v3_busted_20260513T001208Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/wp_stat_v3_busted_20260513T004257Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/wp_stat_v3_busted_20260513T012319Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/wp_stat_v3_normal_20260513T001208Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/wp_stat_v3_normal_20260513T004257Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/wp_stat_v3_normal_20260513T012319Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_deploy_captures/wp_stat_v3_retry_20260513T012716Z.headers`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/2026-05-13_013237825Z_live_async_proof_FAILED.json`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_015733Z_live_async_proof_FAILED.json`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_020730Z_live_async_proof_FAILED.json`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_021622Z_live_async_proof_FAILED.json`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_COMPLETE.json`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_challenger_after_attempt.png`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_challenger_after_opponent_complete.png`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_challenger_challenge_created.png`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_challenger_first_question.png`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_challenger_roster.png`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_challenger_tab1.png`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_opponent_after_attempt.png`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_opponent_first_question.png`
- `_AI_HANDOFFS/from_codex/S9-310-a_live_async_evidence/20260513_023209Z_live_async_proof_opponent_invite_opened.png`
- `_AI_HANDOFFS/from_codex/S9-311-a_POST_DEPLOY_LIVE_STATE_20260513.md`
- `_AI_HANDOFFS/from_codex/S9-311-a_STAT_V3_MENU_RUNTIME_POLISH_REPORT_20260513.md`
- `_AI_HANDOFFS/from_codex/S9-311-a_backups/stat_v3.before-menu-runtime-polish.20260513T105616Z.html`
- `_AI_HANDOFFS/from_codex/S9-311-a_deploy_captures/S9-311-a_stat_v3_deploy_sha_20260513T123143Z.txt`
- `_AI_HANDOFFS/from_codex/S9-311-a_deploy_captures/cdn_live_busted_20260513T123143Z.headers`
- `_AI_HANDOFFS/from_codex/S9-311-a_deploy_captures/kinsta_clear_20260513T123143Z.body`
- `_AI_HANDOFFS/from_codex/S9-311-a_deploy_captures/kinsta_clear_20260513T123143Z.headers`
- `_AI_HANDOFFS/from_codex/S9-311-a_deploy_captures/stat_v3_cdn_live_busted_20260513T123143Z.html`
- `_AI_HANDOFFS/from_codex/S9-311-a_deploy_captures/stat_v3_staging_20260513T123143Z.html`
- `_AI_HANDOFFS/from_codex/S9-311-a_deploy_captures/stat_v3_wp_busted_20260513T123143Z.html`
- `_AI_HANDOFFS/from_codex/S9-311-a_deploy_captures/wp_stat_v3_busted_20260513T123143Z.headers`
- `_AI_HANDOFFS/from_codex/STRIPE_3_ACCOUNT_CONFIG_RECHECK_20260511.md`
- `_AI_HANDOFFS/from_codex/STRIPE_3_ACCOUNT_CONFIG_VALIDATION_20260510.md`
- `_AI_HANDOFFS/from_codex/STRIPE_3_ACCOUNT_STRICT_VALIDATION_20260510.md`
- `_AI_HANDOFFS/from_codex/STRIPE_3_ACCOUNT_WOOCOMMERCE_ROUTING_REPORT_20260510.md`
- `_AI_HANDOFFS/from_codex/STRIPE_BRIAN_PHIL_LIVE_VALIDATION_20260511.md`
- `_AI_HANDOFFS/from_codex/STRIPE_BRIAN_PHIL_PARTIAL_VALIDATION_REPORT_20260511.md`
- `_AI_HANDOFFS/from_codex/STRIPE_WEBSITE_HQ_PRECHECK_20260511.md`
- `_AI_HANDOFFS/from_codex/STRIPE_WEBSITE_HQ_ROLLOUT_STATUS_20260511.md`
- `_AI_HANDOFFS/from_codex/USCE-EMAIL-TRACKER-20260513_backups/usce-offer-portal.mjs.before`
- `_AI_HANDOFFS/from_codex/USCE-EMAIL-TRACKER-20260513_backups/usce-public-intake.mjs.before`
- `_AI_HANDOFFS/from_codex/USCE-EMAIL-TRACKER-20260513_backups/usce_offer.html.before`
- `_AI_HANDOFFS/from_codex/USCE-EMAIL-TRACKER-20260513_backups/usce_request.html.before`
- `_AI_HANDOFFS/from_codex/USCE_EMAIL_MIRROR_CONTROLLED_INTAKE_RESPONSE_20260514.json`
- `_AI_HANDOFFS/from_codex/USCE_EMAIL_MIRROR_LIVE_CONFIG_20260514.json`
- `_AI_HANDOFFS/from_codex/USCE_EMAIL_MIRROR_SENDER_REPORT_20260514.md`
- `_AI_HANDOFFS/from_codex/USCE_EMAIL_REPAIR_REPORT_20260510.md`
- `_AI_HANDOFFS/from_codex/USCE_EMAIL_TRACKER_POLISH_REPORT_20260513.md`
- `_AI_HANDOFFS/from_codex/USCE_POSTMARK_APPROVAL_TEST_LAST_IDS_20260511.txt`
- `_AI_HANDOFFS/from_codex/USCE_POSTMARK_APPROVAL_TEST_RESPONSE_20260511.json`
- `_AI_HANDOFFS/from_codex/USCE_POSTMARK_DNS_AUTH_TEST_LAST_IDS_20260511.txt`
- `_AI_HANDOFFS/from_codex/USCE_POSTMARK_DNS_AUTH_TEST_RESPONSE_20260511.json`

### /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002

- Branch: `codex/mmc-019-preserve-mmc`
- HEAD: `1be8a3d1617c9549987982a485d7d46f18932662`
- Upstream: `origin/codex/mmc-019-preserve-mmc`
- Commit date: `2026-06-23T20:43:24-04:00`
- Ahead/behind: `ahead 0, behind 0`
- Labels: `DO NOT TOUCH, LOCAL-ONLY, PROTECTED, REMOTE-PRESENT, REQUIRES-DIFF-ON-DESTINATION, VERIFIED`
- Whether work already on remote branch: `YES`
- Whether work exists only on this laptop: `YES`
- Whether it overlaps with another MMC worktree: `SEE CHANGE ORIGIN MATRIX`
- Whether it appears superseded locally: `UNKNOWN_REQUIRES_DESTINATION_DIFF`
- Whether authority is uncertain: `YES`

#### Relevant Commits
- `9273263d6fe261b11dad7aa0c07d575a6f04f4a4	2026-06-24T16:46:45-04:00	Add MMC partner demo public route`
- `624bf26b4173c1877ae7b537c55b964137a006ba	2026-06-24T16:29:03-04:00	Create mmc-ownership-layer.js`
- `7ff56ecf36df287168d65163b494f9349cae35bb	2026-06-24T16:10:33-04:00	Create mmc-data-adapters.js`
- `1e645b20e7e2c0115c9a14573fd4f10e42eafa80	2026-06-24T16:05:46-04:00	MMC-101: add MMC static assets (styles.css)`
- `acbe6dd66512a7f6f05d72c8c55898f6fda5c15c	2026-06-24T15:57:47-04:00	MMC-MEGARUN-101: deploy MMC Mentor Console server with persistence`
- `1be8a3d1617c9549987982a485d7d46f18932662	2026-06-23T20:43:24-04:00	preserve MMC private review payload and schema foundation`
- `7b55f04ab6f0fca232efa5a0c2c90b822e187204	2026-06-23T15:29:20-04:00	MMC-014A: tighten private route authorization`
- `49bb583dfd87e7b5402da8d85836e9c18808a55b	2026-06-23T14:24:04-04:00	MMC-014: mount private Mentor Console review`

#### Files Changed / Relevant
- `08_AI_SYSTEM/MissionMed_AI_Brain/KNOWLEDGE_INDEX.md`
- `MMC_MASTER_ARCHITECTURE_AUTHORITY.md`
- `_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_FILE_MAP.md`
- `_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_MIGRATION_PLAN.md`
- `_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_REPORT.md`
- `_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_ROLLBACK_PLAN.md`
- `_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_TRUE_HARD_BLOCKER.md`
- `_AI_HANDOFFS/from_codex/MMC-002_CANONICAL_REALITY_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-002_DATA_SOURCE_AUDIT.md`
- `_AI_HANDOFFS/from_codex/MMC-002_DRJ_PIPELINE_AUDIT.md`
- `_AI_HANDOFFS/from_codex/MMC-002_PRODUCTION_PARITY_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-002_READ_ONLY_FEASIBILITY.md`
- `_AI_HANDOFFS/from_codex/MMC-002_RED_TEAM_DISCOVERY.md`
- `_AI_HANDOFFS/from_codex/MMC-002_SYSTEM_OWNERSHIP_MAP.md`
- `_AI_HANDOFFS/from_codex/MMC-002_WEBEX_PIPELINE_AUDIT.md`
- `_AI_HANDOFFS/from_codex/MMC-005A_OS_PATCHED_FROM_003_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-005_OS_PROTOTYPE_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-006_AUTH_STRATEGY.md`
- `_AI_HANDOFFS/from_codex/MMC-006_DATA_OWNERSHIP.md`
- `_AI_HANDOFFS/from_codex/MMC-006_IMPLEMENTATION_AUTHORITY.md`
- `_AI_HANDOFFS/from_codex/MMC-006_IMPLEMENTATION_READINESS.md`
- `_AI_HANDOFFS/from_codex/MMC-006_REDLINE_DOCUMENT.md`
- `_AI_HANDOFFS/from_codex/MMC-006_SCREEN_DATA_MAP.md`
- `_AI_HANDOFFS/from_codex/MMC-006_TRANSCRIPT_AUTHORITY.md`
- `_AI_HANDOFFS/from_codex/MMC-006_UNIFIED_OBJECT_MODEL.md`
- `_AI_HANDOFFS/from_codex/MMC-007_EXECUTIVE_SUMMARY.md`
- `_AI_HANDOFFS/from_codex/MMC-007_IDENTITY_VERIFICATION.md`
- `_AI_HANDOFFS/from_codex/MMC-007_MENTOR_AUTHORIZATION.md`
- `_AI_HANDOFFS/from_codex/MMC-007_R2_REALITY_AUDIT.md`
- `_AI_HANDOFFS/from_codex/MMC-007_READONLY_ACCESS.md`
- `_AI_HANDOFFS/from_codex/MMC-007_SCHEDULER_CALENDAR_SAFETY.md`
- `_AI_HANDOFFS/from_codex/MMC-007_V1_READINESS_GATE.md`
- `_AI_HANDOFFS/from_codex/MMC-007_WEBEX_REALITY_AUDIT.md`
- `_AI_HANDOFFS/from_codex/MMC-008A_RICHNESS_REPAIR_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-008B_DEMO_PARITY_REPAIR_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-008_BUILD_LOG.md`
- `_AI_HANDOFFS/from_codex/MMC-008_PROGRESS_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-008_READY_FOR_STAGING.md`
- `_AI_HANDOFFS/from_codex/MMC-009_BUILD_LOG.md`
- `_AI_HANDOFFS/from_codex/MMC-009_INTEGRATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-009_INTERNAL_TEST_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-009_REALITY_HYDRATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-010A_ACCESS_READINESS.md`
- `_AI_HANDOFFS/from_codex/MMC-010A_EXECUTIVE_SUMMARY.md`
- `_AI_HANDOFFS/from_codex/MMC-010A_IDENTITY_RESOLUTION.md`
- `_AI_HANDOFFS/from_codex/MMC-010A_MENTOR_ASSIGNMENT_AUTHORITY.md`
- `_AI_HANDOFFS/from_codex/MMC-010A_MINIMUM_HYDRATION_PATH.md`
- `_AI_HANDOFFS/from_codex/MMC-010A_READONLY_ACCESS.md`
- `_AI_HANDOFFS/from_codex/MMC-010A_SAFE_ROUTE_WHITELIST.md`
- `_AI_HANDOFFS/from_codex/MMC-010_BUILD_LOG.md`
- `_AI_HANDOFFS/from_codex/MMC-010_HARD_BLOCKER_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-010_HYDRATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-010_SOURCE_MAP.md`
- `_AI_HANDOFFS/from_codex/MMC-011_ASSIGNMENT_MODEL.md`
- `_AI_HANDOFFS/from_codex/MMC-011_BUILD_LOG.md`
- `_AI_HANDOFFS/from_codex/MMC-011_GOALS_SYSTEM.md`
- `_AI_HANDOFFS/from_codex/MMC-011_MEMORY_SYSTEM.md`
- `_AI_HANDOFFS/from_codex/MMC-011_OWNERSHIP_MODEL.md`
- `_AI_HANDOFFS/from_codex/MMC-011_OWNERSHIP_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-011_TASK_SYSTEM.md`
- `_AI_HANDOFFS/from_codex/MMC-013_ACCESS_GUARD_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-013_PRIVATE_MOUNT_BUILD_LOG.md`
- `_AI_HANDOFFS/from_codex/MMC-013_READY_FOR_PRIVATE_REVIEW_DEPLOY.md`
- `_AI_HANDOFFS/from_codex/MMC-013_ROLLBACK_PLAN.md`
- `_AI_HANDOFFS/from_codex/MMC-013_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-014A_PRIVATE_ROUTE_SECURED.md`
- `_AI_HANDOFFS/from_codex/MMC-014A_ROLE_ANALYSIS.md`
- `_AI_HANDOFFS/from_codex/MMC-014A_ROOT_CAUSE_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-014A_SECURITY_FIX_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-014A_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-014B_ADMIN_ACCESS_DIAGNOSIS.md`
- `_AI_HANDOFFS/from_codex/MMC-014_DEPLOY_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-014_ROLLBACK_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-014_SMOKE_TEST_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-016_BRIEFING_ENGINE.md`
- `_AI_HANDOFFS/from_codex/MMC-016_MENTOR_INTELLIGENCE_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-016_NEXT_MOVE_ENGINE.md`
- `_AI_HANDOFFS/from_codex/MMC-016_OPEN_LOOP_ENGINE.md`
- `_AI_HANDOFFS/from_codex/MMC-016_PROMISE_ENGINE.md`
- `_AI_HANDOFFS/from_codex/MMC-016_RELATIONSHIP_CONTEXT_ENGINE.md`
- `_AI_HANDOFFS/from_codex/MMC-017A_DEPLOY_RESUME_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-017A_PRIVATE_REVIEW_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-017A_SMOKE_TEST_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-017_DEPLOY_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-017_PRIVATE_REVIEW_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-017_SMOKE_TEST_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-018_MMC_OWNERSHIP_BOUNDARY.md`
- `_AI_HANDOFFS/from_codex/MMC-018_PERSISTENCE_ARCHITECTURE.md`
- `_AI_HANDOFFS/from_codex/MMC-018_PRODUCTION_FOUNDATION_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-018_RLS_AND_SECURITY_MODEL.md`
- `_AI_HANDOFFS/from_codex/MMC-018_SOURCE_OF_TRUTH_MAP.md`
- `_AI_HANDOFFS/from_codex/MMC-019A_SCHEMA_BUILD_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-019_PROVENANCE_REPAIR.md`
- `_AI_HANDOFFS/from_codex/MMC-019_READY_FOR_SCHEMA_BUILD.md`
- `_AI_HANDOFFS/from_codex/MMC-019_REALITY_RECONCILIATION.md`
- `_AI_HANDOFFS/from_codex/MMC-019_RLS_TEST_PLAN.md`
- `_AI_HANDOFFS/from_codex/MMC-019_SCHEMA_FOUNDATION_SPEC.md`
- `_AI_HANDOFFS/from_codex/MMC-020A_EXECUTION_LOOP_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-020A_RLS_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-020A_SCHEMA_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-020A_STAGING_SCHEMA_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-020_BLOCKERS.md`
- `_AI_HANDOFFS/from_codex/MMC-020_RLS_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-020_SCHEMA_BUILD_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-020_STAGING_READY_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-021_DATA_FLOW_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-021_PERSISTENCE_INTEGRATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-021_PERSISTENCE_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-021_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-022_FINAL_STATUS.md`
- `_AI_HANDOFFS/from_codex/MMC-022_PERSISTENCE_PROOF.md`
- `_AI_HANDOFFS/from_codex/MMC-107_READY_FOR_DEMO_REVIEW.md`
- `_AI_HANDOFFS/from_codex/MMC-107_UX_RESCUE_IMPLEMENTATION.md`
- `_AI_HANDOFFS/from_codex/MMC-107_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-400_PIPELINE_IMPLEMENTATION.md`
- `_AI_HANDOFFS/from_codex/MMC-400_PIPELINE_INVENTORY.md`
- `_AI_HANDOFFS/from_codex/MMC-400_SCHEMA_AND_PROMPT_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-400_TRUE_HARD_BLOCKER.md`
- `_AI_HANDOFFS/from_codex/MMC-400_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-401_COACHING_PIPELINE_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-401_ROUTE_SMOKE_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-401_STAGING_APPLY_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-402_MEETING_INTELLIGENCE_READBACK.md`
- `_AI_HANDOFFS/from_codex/MMC-402_PIPELINE_ADMIN_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-402_PRIVATE_ALPHA_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-402_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-403_AI_PROVIDER_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-403_PIPELINE_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MMC-403_PROMPT_SYSTEM_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-403_REAL_ANALYSIS_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-502_COACHING_WORKER_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-502_IMPLEMENTATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-502_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-502_WORKER_ARCHITECTURE_LOCK.md`
- `_AI_HANDOFFS/from_codex/MMC-503B_ASSET_DISCOVERY.md`
- `_AI_HANDOFFS/from_codex/MMC-503B_IMPORT_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-503B_MEETING_INTELLIGENCE_PROOF.md`
- `_AI_HANDOFFS/from_codex/MMC-503B_REAL_WORKER_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-503B_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-503_TRUE_HARD_BLOCKER.md`
- `_AI_HANDOFFS/from_codex/MMC-504_CONFIDENCE_ENGINE.md`
- `_AI_HANDOFFS/from_codex/MMC-504_REVIEW_QUEUE.md`
- `_AI_HANDOFFS/from_codex/MMC-504_STUDENT_RESOLUTION_ENGINE.md`
- `_AI_HANDOFFS/from_codex/MMC-504_STUDENT_RESOLUTION_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-504_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-505_IDENTITY_BRIDGE.md`
- `_AI_HANDOFFS/from_codex/MMC-505_IGNACIO_MAPPING_PROOF.md`
- `_AI_HANDOFFS/from_codex/MMC-505_ROSTER_IDENTITY_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-505_ROSTER_INVENTORY.md`
- `_AI_HANDOFFS/from_codex/MMC-505_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-506_ADMIN_REVIEW_UI.md`
- `_AI_HANDOFFS/from_codex/MMC-506_IGNACIO_PRODUCTION_STYLE_PROOF.md`
- `_AI_HANDOFFS/from_codex/MMC-506_ROSTER_SOURCE_INVENTORY.md`
- `_AI_HANDOFFS/from_codex/MMC-506_ROSTER_VERIFICATION_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-506_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-506_VERIFICATION_LANE.md`
- `_AI_HANDOFFS/from_codex/MMC-507C_DISCOVERY_IMPLEMENTATION.md`
- `_AI_HANDOFFS/from_codex/MMC-507C_END_TO_END_VALIDATION.md`
- `_AI_HANDOFFS/from_codex/MMC-507C_EXISTING_WEBEX_REUSE.md`
- `_AI_HANDOFFS/from_codex/MMC-507C_OAUTH_STATUS.md`
- `_AI_HANDOFFS/from_codex/MMC-507C_TRIGGER_POLICY.md`
- `_AI_HANDOFFS/from_codex/MMC-507C_TRUE_HARD_BLOCKER.md`
- `_AI_HANDOFFS/from_codex/MMC-507C_WEBEX_INFRASTRUCTURE_AUDIT.md`
- `_AI_HANDOFFS/from_codex/MMC-507_PULL_IMPLEMENTATION.md`
- `_AI_HANDOFFS/from_codex/MMC-507_TRIGGER_POLICY.md`
- `_AI_HANDOFFS/from_codex/MMC-507_TRUE_HARD_BLOCKER.md`
- `_AI_HANDOFFS/from_codex/MMC-507_VALIDATION_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-507_WEBEX_INVENTORY.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN-100_GAP_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN-100_LAUNCH_READINESS.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN-100_PROGRESS.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN-101_FINAL_STATUS.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN-101_OPERATIONAL_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN-101_PROGRESS.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN_BUILD_LOG.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN_FEATURE_MATRIX.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN_PROGRESS.md`
- `_AI_HANDOFFS/from_codex/MMC-MEGARUN_STATUS.md`
- `_AI_HANDOFFS/from_codex/MMC-PARTNER-DEMO-103_DEPLOY_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-PARTNER-DEMO-103_LIVE_READY.md`
- `_AI_HANDOFFS/from_codex/MMC-PARTNER-DEMO-103_SMOKE_TEST_REPORT.md`
- `_AI_HANDOFFS/from_codex/MMC-PILOT-013_GAP_ANALYSIS.md`
- `_AI_HANDOFFS/from_codex/MMC-PILOT-013_PRIORITY_MATRIX.md`
- `_AI_HANDOFFS/from_codex/MMC-PILOT-013_RECOMMENDED_MEGARUN.md`
- `_AI_HANDOFFS/from_codex/MMC-PILOT-013_REVIEW.md`
- `_AI_HANDOFFS/from_codex/MMC-PILOT-013_TOP_50_IMPROVEMENTS.md`
- `_AI_HANDOFFS/from_cowork/MMC-106_UX_RESCUE_SPEC.md`
- `_SYSTEM_LOGS/LEARNINGS_LOG.jsonl`
- `_SYSTEM_LOGS/read_learnings.py`
- `missionmed-hq/lib/mmc-coaching-import-worker.mjs`
- `missionmed-hq/lib/mmc-roster-verification-lane.mjs`
- `missionmed-hq/lib/mmc-student-resolution-engine.mjs`
- `missionmed-hq/lib/mmc-webex-triggered-pull.mjs`
- `missionmed-hq/prompts/mmc-meeting-analysis-default.md`
- `missionmed-hq/public/mmc-partner-demo/index.html`
- `missionmed-hq/public/mmc-private/index.html`
- `missionmed-hq/public/mmc-private/src/app.js`
- `missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js`
- `missionmed-hq/public/mmc-private/src/styles.css`
- `missionmed-hq/routes/mmc-coaching-pipeline.mjs`
- `missionmed-hq/server.mjs`
- `missionmed-hq/tests/mmc-coaching-import-worker-route-validation.mjs`
- `missionmed-hq/tests/mmc-coaching-import-worker-validation.mjs`
- `missionmed-hq/tests/mmc-coaching-pipeline-contract-validation.mjs`
- `missionmed-hq/tests/mmc-persistence-integration-validation.mjs`
- `missionmed-hq/tests/mmc-persistence-server-contract-validation.mjs`
- `missionmed-hq/tests/mmc-persistence-staging-smoke.mjs`
- `missionmed-hq/tests/mmc-private-mount-validation.mjs`
- `missionmed-hq/tests/mmc-roster-identity-bridge-validation.mjs`
- `missionmed-hq/tests/mmc-roster-identity-browser-smoke.mjs`
- `missionmed-hq/tests/mmc-roster-identity-staging-smoke.mjs`
- `missionmed-hq/tests/mmc-roster-verification-browser-smoke.mjs`
- `missionmed-hq/tests/mmc-roster-verification-lane-validation.mjs`
- `missionmed-hq/tests/mmc-roster-verification-staging-smoke.mjs`
- `missionmed-hq/tests/mmc-student-resolution-engine-validation.mjs`
- `missionmed-hq/tests/mmc-student-resolution-staging-smoke.mjs`
- `missionmed-hq/tests/mmc-webex-trigger-browser-smoke.mjs`
- `missionmed-hq/tests/mmc-webex-trigger-policy-validation.mjs`
- `missionmed-hq/tests/mmc-webex-trigger-route-validation.mjs`
- `mmc-v1-core/index.html`
- `mmc-v1-core/src/app.js`
- `mmc-v1-core/src/mmc-data-adapters.js`
- `mmc-v1-core/src/mmc-ownership-layer.js`
- `mmc-v1-core/src/styles.css`
- `mmc-v1-core/tests/mmc-core-validation.mjs`
- `supabase/.temp/cli-latest`
- `supabase/migrations/20260624002000_mmc_schema_foundation.sql`
- `supabase/migrations/20260626040000_mmc_coaching_intelligence_pipeline.sql`
- `supabase/snippets/20260624_mmc_schema_foundation_rls_validation.sql`
- `supabase/snippets/20260624_mmc_schema_foundation_rollback.sql`



# A1 MMC Change-Origin Matrix

Destination treatment is preservation-only. No row authorizes apply, merge, deploy, overwrite, or production mutation.

| absolute_source_path | worktree | branch | commit_sha | tracked_state | first_observed_milestone | latest_observed_milestone | present_in_origin_main | present_on_another_remote_branch | content_differs_among_local_worktrees | sha256 | destination_treatment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /Users/brianb/MissionMed/_AI_HANDOFFS/from_cowork/MMC-019A_PRE_PRODUCTION_ARCHITECTURE_REVIEW_BOARD.md | /Users/brianb/MissionMed | audit/supabase-2026-grants-20260527-101117 | UNTRACKED | untracked | MMC-005A | MMC-021 | NO | NO | NO | ddc76d0558d2665b0650a2eab78f87c3fdcc1942ecec23b2886ddaeb02fd01c3 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl | /Users/brianb/MissionMed | audit/supabase-2026-grants-20260527-101117 | UNTRACKED | untracked | MMC-005A | MMC-507 | NO | YES | YES | c1f32494c701bb97c21b5248aaa669a3a7a119d6fd32cf13b46ba7840550bccd | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md | /Users/brianb/MissionMed | audit/supabase-2026-grants-20260527-101117 | 2aeee64549548d7cefd6d64d65a5fb633b525f4e | tracked-dirty | UNKNOWN | UNKNOWN | YES | YES | NO | 5a613ed78b916dd638817aacc2ac06e776483244465196425f56515c19f8fc35 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed/.claude/worktrees/stoic-gates-3ec552/.claude/launch.json | /Users/brianb/MissionMed/.claude/worktrees/stoic-gates-3ec552 | claude/stoic-gates-3ec552 | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | bf6eb9996b4baa2b878806c314baaacee490b676ec62984cedfada0dda5c4231 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed/.claude/worktrees/stoic-gates-3ec552/_AI_HANDOFFS/from_claude_code/MMC-003_PROTOTYPE_REPORT.md | /Users/brianb/MissionMed/.claude/worktrees/stoic-gates-3ec552 | claude/stoic-gates-3ec552 | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | bc040c5eabd9fcce37d644a05a66435eeedfa4ec26f1744d536a910d8b05e1e1 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/Dockerfile.railway-usce | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | ae75ba137b1d357d2fa83a2eb6df040f3bcfcffb | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | d1568cf29f821c736f1e2e111a79a3f62206f1e15c9cba42716679bbf86cd98d | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/_AI_HANDOFFS/from_claude_code/A12-001_ARENA_ACTIVITY_UIUX_CONCEPT_REPORT.md | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 741b1932517ab0e542d35b32db4877139911ae3eb799482cd6ee3dc63fed4398 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/_AI_HANDOFFS/from_codex/A12-003_ARENA_ACTIVITY_BACKEND_EVENT_CONTRACT_MAP.md | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | fbc9da3f6b228ed1cf5b5fce688d15953522a5e72e5b60f948b0cfe14ddae8c1 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/missionmed-hq/lib/scheduler/adapters.mjs | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 9457d4640954f980c791d92d29bcb31cf679b266 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | 08feb0d727c9271885876ea9c7d746f3d31bde928f1151e0a43320adb563bee5 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/missionmed-hq/lib/scheduler/auth.mjs | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 9457d4640954f980c791d92d29bcb31cf679b266 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | 7bcf4373ec73ff55a7e40f335160352d451c3e473747d7d3368bf404bc939000 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/missionmed-hq/lib/scheduler/engine.mjs | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 9457d4640954f980c791d92d29bcb31cf679b266 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | da16f7f999be7d436478a41458ee12389a541155bf2947f871e830e11b1d440b | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/missionmed-hq/lib/scheduler/entitlements.mjs | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 9457d4640954f980c791d92d29bcb31cf679b266 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | da54ef22bdca85b38ce06b101705385bd07e60ebc645d627a25d47a1147e6701 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/missionmed-hq/lib/scheduler/persistence.mjs | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 9457d4640954f980c791d92d29bcb31cf679b266 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | f9cb0bee92354746fd3ea161939ebaa604cbd237dc14c8dfa79b1f8814601926 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/missionmed-hq/lib/scheduler/routes.mjs | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 0a82af65d580fa291f2e4080f47ff026305b91d1 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | 1fcc3acd528e468828b4503bb3517e3fd4854e67aba11413d9ac8ba168e5d844 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/missionmed-hq/lib/scheduler/routes.mjs | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 9457d4640954f980c791d92d29bcb31cf679b266 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | 1fcc3acd528e468828b4503bb3517e3fd4854e67aba11413d9ac8ba168e5d844 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/missionmed-hq/lib/scheduler/transactions.mjs | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 9457d4640954f980c791d92d29bcb31cf679b266 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | 33c5dd700e945afa2eae735fc40b085c4cec240e465ae4a61c20b50db19f8342 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/railway.json | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | ae75ba137b1d357d2fa83a2eb6df040f3bcfcffb | tracked | UNKNOWN | UNKNOWN | YES | YES | NO | 457e7c41f6983c61be50e5c470e47e276164dec5b7092e804aa3799dfc9e94c4 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/wp-content/mu-plugins/missionmed-usce-tracker-cta.php | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | fffba4e12089ac7a4a82b508842de0813e03fe7e | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | bfcc73704689c3ac5e9b54709acb59a1b7c6ae1d1f46893b0e52ddd9f68d8bbe | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/wp-content/mu-plugins/missionmed-wc-stripe-division-router.php | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | 09ac749bb96d0d98be3d445b3f330df75d6e9ec9 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | b2a9825a7f9f2219ebe8f124e1b8c641836cc004eee956ac78a15d44d4260570 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004/wp-content/mu-plugins/missionmed-wc-stripe-division-router.php | /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 | a5a4bf3502b99056540df263ae5ac8524f5c6e10 | tracked | UNKNOWN | UNKNOWN | NO | NO | NO | b2a9825a7f9f2219ebe8f124e1b8c641836cc004eee956ac78a15d44d4260570 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/08_AI_SYSTEM/MissionMed_AI_Brain/KNOWLEDGE_INDEX.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 9d16754e9ca77896f633884b7c23aada90670c232ed0f50b1ba4783d6b4141d1 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/MMC_MASTER_ARCHITECTURE_AUTHORITY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 3a960f569df38ae265b2ced577f88823ed2276573ec7739d716c3331dd6528d2 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_FILE_MAP.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | b3da6d14b94b96b9c06f0a4e8381a110741e21e716a89632571a63849724a567 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_MIGRATION_PLAN.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | c24763f4852ab568c554315f27998264b2e041f0e970fae8dbd0c21892fc300e | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | d5fb4c7821c2e7ce0542a8ec2a9ea90f5762bbd5b38e85a3f4a9ef30a469d37d | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_ROLLBACK_PLAN.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 5331200cc653ee0f30d62d8ba0ea98cae89843167ee60f23df55c5795cca2b1d | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MM-ACTN-PRODUCTION-GATE-050_TRUE_HARD_BLOCKER.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 5d6e199773c46b27759a465678f1cdbd9690d94d7baddd899b2d6c07660fc5b1 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-002_CANONICAL_REALITY_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | f56afa9545e7f12e8f8811c125b708c326cd84f06ead8d076f7f9dff73d9f236 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-002_DATA_SOURCE_AUDIT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 8c8e54189adb1c50b5815b2b6693b80f61c57dfe2a7de8bebb80a457a1d5401d | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-002_DRJ_PIPELINE_AUDIT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 94a185cf7336a00e73cb7ec030c832009acab2ed2f513aebff996e2389438bc7 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-002_PRODUCTION_PARITY_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 482a1d4345bcda993c2ab1a2361bab540c5aaa9138bf701a1848fb08d30be584 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-002_READ_ONLY_FEASIBILITY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 24aec59d8527bfa3b3749bb18629ea0e91bf8afed6b78bec1f5d5fb8ec0949ee | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-002_RED_TEAM_DISCOVERY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 9880115041a35095237a73d9c93af47e169fdcb311a267cddb318870f6fe9f7e | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-002_SYSTEM_OWNERSHIP_MAP.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 760f1dcad69fdb84f62b63e81cf6fa5ad382111cab3438b62a181d7694140ccc | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-002_WEBEX_PIPELINE_AUDIT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 4ed4a86fd0904c9b076c27caa77ec9148a04bb3e97fad3dd652b3bdf6ba96ed6 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-005A_OS_PATCHED_FROM_003_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | 2959cdf82bac2b69458e8f749112f257a29709934a52750683481c5de68522cd | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-005_OS_PROTOTYPE_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 6d58e7c9c8602ea656fbc7b4c2c2ffa2d0975707b063680b0f176058ce9fee3f | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-006_AUTH_STRATEGY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 99f42bde080b4c415db386cb265d10650e1b34e94758d69e876fd6f9e6277958 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-006_DATA_OWNERSHIP.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | c071eb4ce835941a779c118cac3fa4e04d299046d1f5d8dbebaef43b8488db6c | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-006_IMPLEMENTATION_AUTHORITY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | f4686b98ba14dff9c8a459827db6bea4684dba3f414484d78afb4e332a912456 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-006_IMPLEMENTATION_READINESS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | f9c975a92afc535b233db9bd27b1a85582e99841e6f63ec262b9d10a1db13b37 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-006_REDLINE_DOCUMENT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 03165bae7ad4ffe23d819b31d2c93994caf76ed33fd4b14aa911ba1e60d38630 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-006_SCREEN_DATA_MAP.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | 6799796b16588975e8f234f78a434a861fb28f53918ee650d02d19b57252eee2 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-006_TRANSCRIPT_AUTHORITY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | d8759189bb34429982234bfb26519e937aa8082267e0287ca95fc56c2a17e259 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-006_UNIFIED_OBJECT_MODEL.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | c5db30d8457ee75e56613ade9e07e268317dfae267a066e2e50d78505ab848a2 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-007_EXECUTIVE_SUMMARY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 3526bf9ed4fa09dee4530e36583d794df0de2c228119bd503d5ea5ee145d967a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-007_IDENTITY_VERIFICATION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | bbe8923614217dcd681d6d14f531d15c0c2a300f68aa0eb9222c5f78f7cdfd87 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-007_MENTOR_AUTHORIZATION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | d95cd278300f721bc36f27e9bc59704ae1dfd0c7897ac5ad44a3128809f35cce | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-007_R2_REALITY_AUDIT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 7439f1339e4d5ee4b2ff249bbacf79218b49e3978adaa248b66eafca68073033 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-007_READONLY_ACCESS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | c169d367e39aabeeeb41898d184e024e3aa32e7b7c3bf708a2d22adf36dcf1f8 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-007_SCHEDULER_CALENDAR_SAFETY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 496015e33af498858dbf94ab801cba13511475762d8b3fdcb83d8dae9923e9c9 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-007_V1_READINESS_GATE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | 1e17d0b50aee743634b0b97189c013692b08074eb979c2b83f469e1e02cb0d40 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-007_WEBEX_REALITY_AUDIT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | deea0a136b0c3d354b1ea5e5699147fb44630dc15a9dd73a6eece6ac4bdbecde | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-008A_RICHNESS_REPAIR_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | d32675fb439c69d0bde9dcd6854883878f4fa1910d859049e2162ccb7c0947f5 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-008B_DEMO_PARITY_REPAIR_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | e0391ba6931797127688bd8f76c53de00b02cd99f36610021f9b1d82faca4a25 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-008_BUILD_LOG.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | 9896cf0aaa9e96a97d236c7b60a1a80a8be17dd954cd6059317c1ec0b53aab67 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-008_PROGRESS_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | beb83558a71537720c51e326e2241efa5d0ffccb13492f93fc2b8bc5631f6b05 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-008_READY_FOR_STAGING.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | 7aa758cc384fa53ec2528a69f5cc58cf9a297bf2f296b05dd8fa1df3dc24979d | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-009_BUILD_LOG.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 476da66471bc5ef8f8b2224285bfc291f0ddf660647633abb23a21087adb6555 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-009_INTEGRATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 36dd79d35adfa75722665390c5747ede2e7e5a55706f970424eb4b5677ae5c89 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-009_INTERNAL_TEST_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | b1c0903d5b2c6fd3927b5ed6b51267a1ab191fcfe39ee2e9092a6f9fdfd6bc22 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-009_REALITY_HYDRATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | ba81b57f5a590c65a93328fe4e881a84e626cd26caeb2f0360868a238109ca34 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010A_ACCESS_READINESS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 872850c74ce00b616139d60bfc68271934617eaf5547fcd4b15c4e44afc1e8c5 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010A_EXECUTIVE_SUMMARY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | aebba4e0fa02183d97aaed9fe95cc4b0eecbc5bf9e4a07aa31fde8de124cee37 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010A_IDENTITY_RESOLUTION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | ef0ac38f707ed0f69194f96d024b9fdc5aa2d00e748474ebdec26ab99777e467 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010A_MENTOR_ASSIGNMENT_AUTHORITY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | b54c4f34ba493691525e8e0115be2a3a7af5bb83c79856fcd2f9065ab64eeec8 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010A_MINIMUM_HYDRATION_PATH.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | cfc48bf7f690ee5abf4e5c046c039269bd96452e5e6aad4b7c5ccdd364f4f917 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010A_READONLY_ACCESS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 8a0f22a73772b7556319a853a0837381e6687d65c1327540bbfe847ca89a6a02 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010A_SAFE_ROUTE_WHITELIST.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | b0e9009ac90cad8334e911ba6297018a19260470b336652a6077060ea8c190e4 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010_BUILD_LOG.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | ced31d8adaa5f1b20f4c82be3f20c916a21458e11d1b7d6cbb51b5d1d6587cbb | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010_HARD_BLOCKER_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | e9ef1a130624d7efea27a1077dc6fc08f54ff675168d59b00520829874d798fe | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010_HYDRATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 894a59850eb460ceac3ff48ca0f9f21641c53b3e2d3c25932056acc311a20efc | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-010_SOURCE_MAP.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 005a452a6a515a30bc3d62b20ea9ca926a91841b419c9905abaa17e7ee598886 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-011_ASSIGNMENT_MODEL.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | f7340f235748befd5ef61c0e4f993537a3c35b6f0d4825ffa0a32ceb4a22bf37 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-011_BUILD_LOG.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | e81d4e63e7a5c51a6462702cdf416cae4e1ce83478b5320f4021c32d59a4f2e9 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-011_GOALS_SYSTEM.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 02d68690e3e46464876981ce3d051d47c49efef783bb45bc71f998e8f5359ca4 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-011_MEMORY_SYSTEM.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 4be7d5264bbce2905e8f0483704e539c729c6789d641e0c3fec5037c717a3b68 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-011_OWNERSHIP_MODEL.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 7dff053603ae65e98eada906a6e2587ca0a5af99bcdf6fbb4cc183bd1d5fa998 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-011_OWNERSHIP_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | d6b3559aa451f5fb639e204d6c3ff7a5bc79bd80a080435dcb126def941e5d59 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-011_TASK_SYSTEM.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 3ff882ee638a899455b4aa7c41f12a211317ab81f375bf080408f89231b18e88 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-013_ACCESS_GUARD_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | a4d7a3da65a16cf02ba4bc54eac6171c4d6a46a5f1ca51b35171d5178094b13e | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-013_PRIVATE_MOUNT_BUILD_LOG.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | e365132787b75b11ad3d7ae956afbdf1431ecf2c359bababaf0e91a89d933a59 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-013_READY_FOR_PRIVATE_REVIEW_DEPLOY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 21d7dc6eaa260e8a23c3bd8fc9b03205d9423d46941d011961332d8d24d3ea57 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-013_ROLLBACK_PLAN.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 0621a8fb44d62d05c2bb1d9e30d9d5c5d18171fab14bb1f8ccf649d1fe4dc590 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-013_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | e66f84ebe031ad7ebc9cf32b1afb79a49662c5850ca48f7e47d108d9a2d0d52d | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-014A_PRIVATE_ROUTE_SECURED.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 2e61d16985ce72d7eba1bd053639f5863f9f43c0ce9b44b68e678ccc9b512131 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-014A_ROLE_ANALYSIS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 1929af248cac43f208bad47437e5e0595239071749c9c0b7e1b8dac44607dd0b | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-014A_ROOT_CAUSE_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 86c953db207a49fac00b97a54ab2d9391ac1a0b8a93e239368b7cce745dda51c | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-014A_SECURITY_FIX_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | bec5ea3994c2a41ee937efcbc8232a5228cd18b50d4172ad43afa8e9f92cd5f0 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-014A_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 9fffe9945772f0dff413b66dcd8c1183f589cbb1d7db17ac37c6382fc9611777 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-014B_ADMIN_ACCESS_DIAGNOSIS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | f1df82eec3f30b8bc4307f9a087a6a1224efe7cb6dae31817abc97a43fae47c1 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-014_DEPLOY_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | eee4750d9fd28f8fd1ac8e3047bf848e852a5d8010321dee2bfd01a9fc61389a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-014_ROLLBACK_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 4d1834d97d47d2fa6d71da58033b9a38d4bdcc563faebaa4bef4be5fbb1482fc | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-014_SMOKE_TEST_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 686f1b0bcb32285cd81f8c15c0523e38ab25aa680fc23534e5b21bc5758cb391 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-016_BRIEFING_ENGINE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | aec199289fc19e49dc8c7a33a15640914ae8ab47d801b79d10566fb6c6102a5e | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-016_MENTOR_INTELLIGENCE_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 9398e6f708252b38b8530a39225c3053ee2cd97d86fa0c4957369ca296e7a817 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-016_NEXT_MOVE_ENGINE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | d24f3830791127b62f7b0b7eef9c921efd5260ecf51d2869e41e3680cbe27c12 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-016_OPEN_LOOP_ENGINE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 96196947243833a444fdb90d2d8f108e3536ef5617f561bc2d9772cd553c1dd6 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-016_PROMISE_ENGINE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 19c46d6e5105470a302c71474fb18a8736ef26580c6bda7cebf1e71dfc351fc5 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-016_RELATIONSHIP_CONTEXT_ENGINE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 8df9689cabf1fb96f74605399700fd55706a2ed6e8f709871da007e45ffa0c6f | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-017A_DEPLOY_RESUME_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 08048574f7964b361d537ef8e912b3e8fe5dd4f4d4f412d177f249b4427afd86 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-017A_PRIVATE_REVIEW_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 7ceca78dc6788495e021db2a0872effe6c49d8c4b4924065ac83503c54363d3b | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-017A_SMOKE_TEST_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 54a526fb8f151dbf3da4fef712b289fcd1ad58af9e654908af18ebf2c207a0e6 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-017_DEPLOY_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 3a80d7e91850f9f2b999b606f968f2e8b3ffe6f0a91f0e73ac2c84b0c12d762c | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-017_PRIVATE_REVIEW_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 977f0b24c51325eca78d5a7ab2c9feaab56d13a6f19646cf39af7657151f6fd5 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-017_SMOKE_TEST_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | d7b57bc3166d1d20c3f440c87181338297b7731ce66902e3a0b298eb93f5aa78 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-018_MMC_OWNERSHIP_BOUNDARY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 795b705edbf16db006f26bf472b469cf6d7422e12c323e2fb209fd4949f7407a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-018_PERSISTENCE_ARCHITECTURE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | bcfa74127d2ee1c9eb256cff88100d546efbcdb912c5e473acfb47c3ccf946cc | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-018_PRODUCTION_FOUNDATION_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | cdc130ec5405faac50ea7635a840530d828374e516a01ff3204251001ace0ebb | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-018_RLS_AND_SECURITY_MODEL.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | c4cefd8b1b8c904e2e9c4dcc57f760c3649fdf3372d40d835b8e5d4dadda1892 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-018_SOURCE_OF_TRUTH_MAP.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 43ac8af31f282dad6287a1bb0e13c2e69dc7088e8bc28593ad72d8a3143358d9 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-019A_SCHEMA_BUILD_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | f290f16965920ee31748e2b2e3d7bd9be064c21b05400863e71e1aee49fb79eb | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-019_PROVENANCE_REPAIR.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | NO | YES | NO | 8b4f0c0a5eec3644f3b84285f6788b75a989693fdb1466d7addc73ac6224d0c8 | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-019_READY_FOR_SCHEMA_BUILD.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | NO | YES | NO | fe7730d718d76f50cb1e67b16e633ab69b357a0578d82bfc812f147986ec39eb | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-019_REALITY_RECONCILIATION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | NO | YES | NO | 1feaf404d90a24fa872b4e193d760f0d14ce357333312e082f8003a3a85cac2f | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-019_RLS_TEST_PLAN.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | NO | YES | NO | c358cc4d756740aff8125c66c28a4c2cc0b196dc8d8c6d22ee6851b2b836d808 | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-019_SCHEMA_FOUNDATION_SPEC.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | NO | YES | NO | 137c0cd6aa9bbfa8037f4195f8ca8826fceef466cb0ea5de5aaba525dbe9df39 | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-020A_EXECUTION_LOOP_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-020A | MMC-020A | NO | NO | NO | f690c891739967cd854dce69598613ab75f6ffed73ba8f6ec812896d1c1cab3e | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-020A_RLS_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-020A | MMC-020A | NO | NO | NO | 4701b535308d957a7cbfdf054548fca416b68d2aa13b405cb2d0fc4ff108e9f8 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-020A_SCHEMA_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-020A | MMC-020A | NO | NO | NO | 69e6e33f2dd9b3571cc423bc49856571cf7c6f31e4e826893166f125bde4ded1 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-020A_STAGING_SCHEMA_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-020A | MMC-020A | NO | NO | NO | 0291fcdaed262daf86447086d85a4492895e535c238e68e30aa297fea6fb9553 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-020_BLOCKERS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 7178124a8acc7dbe7c45b6cff157eb295510d320c2ac6a18734317a4a3887614 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-020_RLS_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | b472a570baf5cd1adbadf0e599517c8b6fa0d913d8401e31668aedae4188f361 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-020_SCHEMA_BUILD_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 8f7047c46eafbd76191659530b3f822ebbfd87e11530f5822e8f63fbcffc6518 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-020_STAGING_READY_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | e9c9319f506dca0093424f1659ddbc711e744c905c890bf37b697520e3c6f489 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-021_DATA_FLOW_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-021 | MMC-021 | NO | NO | NO | 548edbc1a46517dc172f805fdd2e907c82792986fd24cd57f5c4bb500e3b0500 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-021_PERSISTENCE_INTEGRATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-021 | MMC-021 | NO | NO | NO | 95547f45775c28cfc1e7422e101ec76bae68a22e4a435a0afff2824f6057c5d3 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-021_PERSISTENCE_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-021 | MMC-021 | NO | NO | NO | 550a5052a27da1fc3e823c4b26774130863807ae3820f13de91f9e975f5bb389 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-021_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-021 | MMC-021 | NO | NO | NO | b0d76a3c667412e41f896abf7badb8e8c5b2063be6fb8ccdf016a940debcc6fb | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-022_FINAL_STATUS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-022 | MMC-022 | NO | NO | NO | 9e81639f96a482b0ff6e00102ff4567280a726650b4e1c401064906b7a28b836 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-022_PERSISTENCE_PROOF.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-022 | MMC-022 | NO | NO | NO | 0c91cfee7a329019c329d9bb35169de7cfc43272906883ea86065c5c01937ed8 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-107_READY_FOR_DEMO_REVIEW.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-107 | MMC-107 | NO | NO | NO | bdfe2b76083f72df947d04a79ea3a0c495d6e322f89000c52b0b1aa38a40a206 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-107_UX_RESCUE_IMPLEMENTATION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-106 | MMC-107 | NO | NO | NO | ce891d0414733470a18c3418775ab2ad32f69e305299f11403df4b8a8bb1a449 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-107_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-107 | MMC-107 | NO | NO | NO | 67f72f3cc00ad4b13bea096d7586b2af093449e97bc631a4bf10077472bc7006 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-400_PIPELINE_IMPLEMENTATION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-400 | NO | NO | NO | dfd1e9fb804fab7817fcb95cc399981c092a5b4d2b9cd70a893c719d37a35d56 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-400_PIPELINE_INVENTORY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-400 | NO | NO | NO | ce65aff6a677826a1c16756cd10d8ddf8df5807276b1fdd0af9573c7534abd22 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-400_SCHEMA_AND_PROMPT_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-400 | NO | NO | NO | 3d4e67052d4c6aa14c1a6d9be1b5d7bc13c84d0df28ad107d3765c9274ac6023 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-400_TRUE_HARD_BLOCKER.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-400 | NO | NO | NO | 097da93262f75d138cb84f368fd5301a8b65fe65c4cc7c85e211b6a790cd0db4 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-400_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-400 | NO | NO | NO | 58a1a849e33aa591d076debf744d443e86f13eebf809e59c8e8f7986fc77f80a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-401_COACHING_PIPELINE_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-402 | NO | NO | NO | 0bbae622a247b7a5f3adca26a3b70dacf821bee440c99e36df310c8a959f7a6f | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-401_ROUTE_SMOKE_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-401 | MMC-401 | NO | NO | NO | 4be55a56fab062c1a6be82c8bbbe68a430bdd57ec10af09580dca1121c93cd89 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-401_STAGING_APPLY_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-020A | MMC-401 | NO | NO | NO | e139603fe0af03224333b6817245bea00d865e7b1eeb541ae05e19d3d2266df4 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-402_MEETING_INTELLIGENCE_READBACK.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-401 | MMC-402 | NO | NO | NO | 5df7323f940d2c7fc95fbe2b5e3aaf3df9cce6b68bbbea58f20b00a1b0943c4b | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-402_PIPELINE_ADMIN_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-402 | MMC-402 | NO | NO | NO | e1a0c443398acbff9a70863206ec59ec8f398dac92fcd481aebe1ad617e98bd5 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-402_PRIVATE_ALPHA_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-402 | MMC-402 | NO | NO | NO | 154e65f58cd4ff80aaa188aeaead0b137d627a74a301616089be795c1fac16a0 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-402_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-402 | MMC-402 | NO | NO | NO | e30ee3c7e3e4e01337a352a0b61984b4767110bd54a88744928c889910586b31 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-403_AI_PROVIDER_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-403 | MMC-403 | NO | NO | NO | a6440da54c5e34cc9a42f03344f3723f865127b36c52ce881b526dc5bdc9c6f0 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-403_PIPELINE_VALIDATION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-403 | MMC-403 | NO | NO | NO | ab3565b10be88c7d44b2dc6a9f92e6eb3115be6c1e7d69022b1a5676d134054c | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-403_PROMPT_SYSTEM_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-403 | MMC-403 | NO | NO | NO | 39ab97c70e10391291f2d7468d1a34619a41b0c673cbf8f60ab9bf9ad4accff0 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-403_REAL_ANALYSIS_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-403 | MMC-403 | NO | NO | NO | 2a84ffa87100c51d7172c5e9c6f2da3d8d572e619cb607fd50a6b59c16c91bdd | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-502_COACHING_WORKER_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-403 | MMC-502 | NO | NO | NO | 088ecdfff2f572b58f01c802ab959e41010ac68ee21635479008ae891463e69e | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-502_IMPLEMENTATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-402 | MMC-502 | NO | NO | NO | 2c5bf7cad39fd90147e0a6374cc711a6f1c1a0a5ab0670565a229829b0be939f | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-502_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-502 | MMC-502 | NO | NO | NO | 3c2a5b0bd98f9bc83bc61bdc3b61575837fbf6af7f64b7f8622074ce904afed9 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-502_WORKER_ARCHITECTURE_LOCK.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-502 | NO | NO | NO | 0bf721b0b359e2aece74a6694e98d3ea0e71bef1d38474eeac8358af89bcf9f8 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-503B_ASSET_DISCOVERY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-503B | MMC-503 | NO | NO | NO | 63861165f94bb8c8556b3618276099afbd1cc2699ceeddc3316c6aab4ba5629f | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-503B_IMPORT_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-503B | MMC-503 | NO | NO | NO | b2884c767d9fdbc9c44a52b3f94fd7bd811cb96de0d9cfcfc61333f9e65cb669 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-503B_MEETING_INTELLIGENCE_PROOF.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-503B | MMC-503 | NO | NO | NO | 524f0c62dab80d148c19bd7a41d668c21019a34f56d7ccbeb0ce7bad90b339ba | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-503B_REAL_WORKER_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-503B | MMC-503 | NO | NO | NO | 9dca64cae09e63ef90972b8d76190d0621c1ee14ec01ca4e98997dbbe2e290de | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-503B_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-503B | MMC-503 | NO | NO | NO | b7679e41dbd023edc2fddf03710d380fcb068ed2026f490e4dc375c4289730cd | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-503_TRUE_HARD_BLOCKER.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-502 | MMC-503 | NO | NO | NO | ca80aeb0f3d5547bf2d8372b4363b3f4e78829274342343a8c299cfcf18c2351 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-504_CONFIDENCE_ENGINE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-504 | NO | NO | NO | be9a5dd717bdd3ed728ee6a4602b8decf2f84e16b210dac43a41bf92a08fb4c1 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-504_REVIEW_QUEUE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-504 | NO | NO | NO | d34c1d2a3500164bb67a6c94f6402d0ed07127b40bdc3a2860f7edd8f9721c8a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-504_STUDENT_RESOLUTION_ENGINE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-504 | NO | NO | NO | b663c33beca6b10edb125f306beb63bbae7ba1e16d0dbb7d23dffa8008c4abdf | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-504_STUDENT_RESOLUTION_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-504 | NO | NO | NO | a4ef2c75e4ddad8dd5768b857ce7d8ca5e1bca22c1ef7169ce8c590ed80605a1 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-504_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-504 | NO | NO | NO | 56bbb726812b204e8d94ea922634b66e7f0ce0f4dff45f536466e24194716b3d | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-505_IDENTITY_BRIDGE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-505 | MMC-505 | NO | NO | NO | 6ace3993c0bf77e3eb1a24b86aa5913763f3a61176e10b39e29bb5e98090e9d9 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-505_IGNACIO_MAPPING_PROOF.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-505 | MMC-505 | NO | NO | NO | dcd256258147f14dd79086de25563f7666fa31f8f5862a7e41a6b60131fdf58a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-505_ROSTER_IDENTITY_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-505 | MMC-505 | NO | NO | NO | 5d1f602fe35e514931a294af843fe8fbc18d31714f70bba008f8526e8df30983 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-505_ROSTER_INVENTORY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-505 | MMC-505 | NO | NO | NO | 15fc21a1b4bfc0cf45cbb0e5189398376c917d6b8114e1a10469adfdd565325c | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-505_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-505 | MMC-505 | NO | NO | NO | ba55a364afa6447a36c80e63056b94ce1c8cb85132c1fb749073d5da41b893da | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-506_ADMIN_REVIEW_UI.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-506 | MMC-506 | NO | NO | NO | 5cf445e385b97f1d968e4d95ef7c34a156c2a925234c9414dc62c18eaf71b194 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-506_IGNACIO_PRODUCTION_STYLE_PROOF.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-506 | MMC-506 | NO | NO | NO | e9c82d6b13b84dbb8a0a55680bba9891d6501a536839d7c8476847f31cc2b6cb | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-506_ROSTER_SOURCE_INVENTORY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-506 | MMC-506 | NO | NO | NO | d39bcc2d96f7970c139ef11d7790b2869d505d2ce56dee3fdca8ab52a1510c5b | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-506_ROSTER_VERIFICATION_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-506 | MMC-506 | NO | NO | NO | 59447d3c877ab5f7c10d8e0e59ef1465bd1749cdd490217861f38a8f25688101 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-506_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-506 | MMC-506 | NO | NO | NO | 35e4fa3ddc679c059acb7cf8e8ac9acd2797f381e2219450d8a0b7b37a330830 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-506_VERIFICATION_LANE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-506 | MMC-506 | NO | NO | NO | 2fd2882c1074a37ce2953eebd0de8c519463786c1f4b0d11fc978d868c56fd1a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507C_DISCOVERY_IMPLEMENTATION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507C | MMC-507 | NO | NO | NO | 2dc0451288c40077b4589a0f4c91bd4a0c499618f487cda32e92a35e3804db25 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507C_END_TO_END_VALIDATION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507C | MMC-507 | NO | NO | NO | e451b72f1c226beabd2a9eb339ab1630a918207147b89a214df2236b98dc13bc | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507C_EXISTING_WEBEX_REUSE.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507C | MMC-507 | NO | NO | NO | 0a8f0bb06e6adf03d927c5570d424fa198f0414c104923ae1bf1dc6bc5a85db0 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507C_OAUTH_STATUS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507C | MMC-507 | NO | NO | NO | e2a3355f410855a0859c730ff376629e7cddff34e6e4fbba9ac68a3471cb7198 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507C_TRIGGER_POLICY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507C | MMC-507 | NO | NO | NO | cdabbc45b053cc2c222337d079d950f8637bc4ba8d3acdec5cbdd4996d383822 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507C_TRUE_HARD_BLOCKER.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507C | MMC-507 | NO | NO | NO | 027ac3d21e5faabc7f9038e642f86b8222a1450507b3aa8810ae69bda2c99a83 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507C_WEBEX_INFRASTRUCTURE_AUDIT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507C | MMC-507 | NO | NO | NO | 155991624b28635cf5b43f994772e3108a43dfbc9b803a5df7dde02fee221440 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507_PULL_IMPLEMENTATION.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507 | MMC-507 | NO | NO | NO | c62b8674b65658e29c734292454cbfdef4c705eaa5731aa6c56acee5a2db51ec | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507_TRIGGER_POLICY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507 | MMC-507 | NO | NO | NO | ce2f93c4a6e78aff0ce0e3d5d60425c9d8c4a0f030a82ab61318b396b2902107 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507_TRUE_HARD_BLOCKER.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507 | MMC-507 | NO | NO | NO | bc1d6b47cc3d670834d3ed2822e202385d5f929242a83954cd81e3b33803026a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507_VALIDATION_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507 | MMC-507 | NO | NO | NO | 628d665e02e73cfb6e474a2ab0f79c48bf2513321549ed12f161414bb44d5336 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-507_WEBEX_INVENTORY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507 | MMC-507 | NO | NO | NO | ad5f8bab1ddc1da80854230a14d1acbc7b5bdc37d1236ab388a59b8deb53e420 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN-100_GAP_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-022 | MMC-022 | NO | NO | NO | 5bb6dc5e3076c5d1601be085e0f28f02ffdda12ae851cc546e22d98c467dd4c5 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN-100_LAUNCH_READINESS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | d8c49f1784bcd0d1dd387079a3622ff6cf1fa22b3c99a7cf16a0e19164db56a4 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN-100_PROGRESS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | b93c7a84838a1745cdd056e5a60a2b7525acd1ac411689e19b01deb57a407796 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN-101_FINAL_STATUS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-022 | MMC-022 | NO | NO | NO | 0821dee10397aa95ee23a58f978eb32cd8d4596ee4d20908553cd3340bc5b56b | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN-101_OPERATIONAL_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | c6939ab73c8d51d29a5e229fd0d72c529914e50ec3f74bab6c17943458c4786a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN-101_PROGRESS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-021 | MMC-022 | NO | NO | NO | 2b0b0071ab4f32d188b4b09fd8aed79774d2d94f1d615c3a8a4682452bd7cfb5 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN_BUILD_LOG.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | 7f77d1bc09187fd79d967d6d91a2b73db497a36bc973f201748d3e66baad7bda | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN_FEATURE_MATRIX.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | e4fb591021d5418af978f358546659219c1e9143fb7ea2e6b87cb06d638fe880 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN_PROGRESS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | aed48523881fdd71cc23d7f66eea5b71c3b5336f2cb9f822c06518e6b48911ff | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-MEGARUN_STATUS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | c1d7c55244961a3c365c491253e1ecf4891d890dd4949a9ad6720004645dcbb1 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-PARTNER-DEMO-103_DEPLOY_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 4a89d8a90cb557c8326ea239021ba6466565d9f4ca6d4b84531ec64b1eb9f792 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-PARTNER-DEMO-103_LIVE_READY.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 6dada4883c9cc513b3d27b1eedac37f67f024542277ed0821ec20f3d6ff7f4cc | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-PARTNER-DEMO-103_SMOKE_TEST_REPORT.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 66e818b456dd4579e7fc897072d90b0b3b6e4cb85433609f0a14d1d9cde90fc9 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-PILOT-013_GAP_ANALYSIS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 7284ef4c6f3fe43e492617d63abfbdadbdb51d30d268aa1c7fc7b52bb915ee42 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-PILOT-013_PRIORITY_MATRIX.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | c477689f4aad1c79696ce902ffbcd3998e03a20185ab7fdeebe19a5718700c26 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-PILOT-013_RECOMMENDED_MEGARUN.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | f843a0944009b43faa05c64935d023584bad01050c3ce14ea766ad0812326cbf | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-PILOT-013_REVIEW.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 2b30b8f771a84ff44e96b5dc97b60398136b70102e4cf00785caea130acd4431 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_codex/MMC-PILOT-013_TOP_50_IMPROVEMENTS.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | e18890de722302069eeba71176f1be6c0eb3433ff1f6868cc4cc2711ea1bd38d | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_AI_HANDOFFS/from_cowork/MMC-106_UX_RESCUE_SPEC.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-106 | MMC-106 | NO | NO | NO | 480d48b3dafe0d5b3afbd359311fccdfdfa9cea3b10e72a9c5dbe3407b7d8a3e | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | YES | YES | 38ba9b2ad61affff5144e94bd04cd00693b175b61572a3843131774a0d46dfb5 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/_SYSTEM_LOGS/read_learnings.py | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | YES | NO | 8b0d4b2d0598c82dd654e0cec351c6113ada8d8b15e094c7e7d4bd025569d5cc | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/lib/mmc-coaching-import-worker.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 5dcb440e2f766b6d10c4723d6613011aed9ce0dd548b208801d56273c54d25e6 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/lib/mmc-roster-verification-lane.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-505 | MMC-506 | NO | NO | NO | dbdecaa492bee455e7ddaa700ce76dc124d12cfd3fa636a9f4705d4d214b0d2e | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/lib/mmc-student-resolution-engine.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-504 | NO | NO | NO | 6f98b6c62cc4e2045c6b7609a99d4193af43de248e9a63b16e2b321728434430 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/lib/mmc-webex-triggered-pull.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507 | MMC-507 | NO | NO | NO | 69c70ba096aa654dfa548cb69ed8e5651373038d54457bd83bf1d2026c060886 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/prompts/mmc-meeting-analysis-default.md | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | e76ebc32de6a97409a8626433aec7b0a17afd69f4808171d08e14008ed03dbd6 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/public/mmc-partner-demo/index.html | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 5b20fcd4ceeaaf85d900bd47976be469fb231e305f17070e76be2ecaf1108833 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/public/mmc-private/index.html | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | YES | YES | NO | 4ddee056a5f472d7ef92bef71f66a4fb611193ca3f516bcd2bae0bbb4f310b31 | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/public/mmc-private/index.html | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked-dirty | MMC-005A | MMC-005A | YES | YES | NO | 4ddee056a5f472d7ef92bef71f66a4fb611193ca3f516bcd2bae0bbb4f310b31 | PRESERVE_AS_PATCH |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/public/mmc-private/src/app.js | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | YES | YES | NO | b481564225d2cf9670cf29c6c0eeb8688cc5fc9c3065c05bba102057462ff888 | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/public/mmc-private/src/app.js | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked-dirty | MMC-005A | MMC-021 | YES | YES | NO | b481564225d2cf9670cf29c6c0eeb8688cc5fc9c3065c05bba102057462ff888 | PRESERVE_AS_PATCH |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | YES | YES | NO | 08c603a587db139c2e3d7f254ed2f9060ec07931026cf89b0e8534dfa0f6736b | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/public/mmc-private/src/mmc-ownership-layer.js | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked-dirty | MMC-020A | MMC-021 | YES | YES | NO | 08c603a587db139c2e3d7f254ed2f9060ec07931026cf89b0e8534dfa0f6736b | PRESERVE_AS_PATCH |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/public/mmc-private/src/styles.css | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | YES | YES | NO | 4908d4ba966662844278ad987daeab4d836ace5c39379490e46aa1c706d4d6bb | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/public/mmc-private/src/styles.css | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked-dirty | MMC-005A | MMC-107 | YES | YES | NO | 4908d4ba966662844278ad987daeab4d836ace5c39379490e46aa1c706d4d6bb | PRESERVE_AS_PATCH |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/routes/mmc-coaching-pipeline.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-506 | NO | NO | NO | c6b48e82a0539c855e31e7eeec748d49e1162b88ad95a455af652b4014c46736 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/server.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked-dirty | UNKNOWN | UNKNOWN | YES | YES | NO | 4da68b042141f4728c678f82ce8524cb473f14e2b85354d2dba1ec0029e93cc3 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-coaching-import-worker-route-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-502 | MMC-502 | NO | NO | NO | 85ac4c08c1f103fa8ec81ed51cb5b3c91f7c48cf0638ad0357e48d430503c94d | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-coaching-import-worker-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-502 | MMC-502 | NO | NO | NO | 9e669f1ae65943e6273f9dd9acc0d616715c73021b16da89c08605d0db690b6c | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-coaching-pipeline-contract-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-507 | NO | NO | NO | c5b2622a438dc95620f1744ce2c10815f14a34c2d22c359aa16f521f9b05f681 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-persistence-integration-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-021 | MMC-100 | NO | NO | NO | 087e208d21cc3f3fc5090eadebb4686f7d359be6919aea54199a91cbb4da6f4f | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-persistence-server-contract-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 22e649a8a6648b3ba03dd7d78c79eb443260cca025564562a4a50080ad93da71 | EXCLUDE_SECRET |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-persistence-staging-smoke.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-021 | MMC-021 | NO | NO | NO | f652e5f73888f360993459cb9a0f49e0d612b8c938da034c229c7bf94d41a23d | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-private-mount-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked | UNKNOWN | UNKNOWN | YES | YES | NO | eb47fa7758a3ab5a91363eb9e298f0b5586e2c5f84a3138732b0d4fb1e56cadd | PRESERVE_IN_GIT_BUNDLE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-private-mount-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked-dirty | MMC-021 | MMC-021 | YES | YES | NO | eb47fa7758a3ab5a91363eb9e298f0b5586e2c5f84a3138732b0d4fb1e56cadd | PRESERVE_AS_PATCH |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-roster-identity-bridge-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-505 | MMC-505 | NO | NO | NO | bad4d2bb936772f9b997fdeae2943d48d016568ae116eb395cff4c0b4d6da491 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-roster-identity-browser-smoke.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-505 | NO | NO | NO | b307445b31a7785f30533651e7dd1acaac251d4a6a680f88fb09bc7b1645c42e | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-roster-identity-staging-smoke.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-505 | NO | NO | NO | d53f37b3862e87703682b0680e5788ef1e866c0bcf92d02ec58df11f4f2b9252 | EXCLUDE_SECRET |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-roster-verification-browser-smoke.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-506 | NO | NO | NO | 2a5ac575917dd099d917cc4ebc155403fa10350c83bd4f8521df5ccb511e473c | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-roster-verification-lane-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-506 | MMC-506 | NO | NO | NO | 588df3e4e3b52b5ee196eb0fabb7475b63a49657e9481e23911a9206b624aa66 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-roster-verification-staging-smoke.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-506 | NO | NO | NO | 982147eaf3240d98dd3bf6bad47e1bbd1e9e00181f2986cfa872f43f728b4ce6 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-student-resolution-engine-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-502 | MMC-504 | NO | NO | NO | 7d0c7d8001cc01203c8a6e80373aac3005338abfd139256c0c59e9a8872fafbd | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-student-resolution-staging-smoke.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-504 | MMC-504 | NO | NO | NO | 17c56ca4bccbf0a1d73ed1f15b5de1530416a97dc53d7d61de02435e63144319 | EXCLUDE_SECRET |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-webex-trigger-browser-smoke.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507 | MMC-507 | NO | NO | NO | 3bb417b7b6a5aaa82c4dd1aa41ebc3f9c8bbedd6f720aedf8d73adf65ef4056a | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-webex-trigger-policy-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507 | MMC-507 | NO | NO | NO | 627240834d83745a132f4b7f2d7d5e4988b317722756358acd58f86296403fa9 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/missionmed-hq/tests/mmc-webex-trigger-route-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-507 | MMC-507 | NO | NO | NO | 8735a2a94a1310382f98c3f337b45cb90b023545f539ab5d50d4feedbca363f7 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/mmc-v1-core/index.html | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | 45bb5768e393912d46e6698cbfca70677b32b6088de0d5484c65c1ce56c83b83 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/mmc-v1-core/src/app.js | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-021 | NO | NO | NO | f87f4ace80c91894410ff23a3710b3c26471de7d9606113c6d584faaf814978b | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/mmc-v1-core/src/mmc-data-adapters.js | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | ca52086b72caad5edd99d20d72cb644b4147cd3b1b293f4f73a22702c82af532 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/mmc-v1-core/src/mmc-ownership-layer.js | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-020A | MMC-021 | NO | NO | NO | 50abd4fa8a29d0beab6df4853bf1eb5c32902ec70e8f35592f5716a9850b476c | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/mmc-v1-core/src/styles.css | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-005A | NO | NO | NO | de82ab202ff4b7e63a513dec4ca3551ed7fc3ff03ec3ca6918c084b74286e367 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/mmc-v1-core/tests/mmc-core-validation.mjs | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-005A | MMC-021 | NO | NO | NO | 47315d68b65e6a223d9ff4c1901ae443b6b9d4e844a24e9ca338733166ec58c8 | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/supabase/.temp/cli-latest | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | 1be8a3d1617c9549987982a485d7d46f18932662 | tracked-dirty | UNKNOWN | UNKNOWN | YES | YES | NO | 88d0035095b46a981aae69e91bb665b906b762f0622fcf6d90aa7a6904e8e181 | UNKNOWN_REQUIRES_REVIEW |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/supabase/migrations/20260624002000_mmc_schema_foundation.sql | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-020A | MMC-020A | NO | NO | NO | 8dbb59914814771c3aac882f5c7cef9b30b91eb8ee53e3783c6d7352bd160a2c | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/supabase/migrations/20260626040000_mmc_coaching_intelligence_pipeline.sql | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | MMC-400 | MMC-400 | NO | NO | NO | 00219bc33ea2e9a46f94df80207468b451f392653e43a7ded268aa3f7d94ca9b | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/supabase/snippets/20260624_mmc_schema_foundation_rls_validation.sql | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | f60d3f4ca318c491d19348f9dbf9695f8f6b6d673c448c0532efb9eeee47d9fd | PRESERVE_AS_FULL_FILE |
| /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002/supabase/snippets/20260624_mmc_schema_foundation_rollback.sql | /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002 | codex/mmc-019-preserve-mmc | UNTRACKED | untracked | UNKNOWN | UNKNOWN | NO | NO | NO | 660e6b1126f903178b204a8054efed9b0a9114b9d17e7da27e8df68583364a35 | PRESERVE_AS_FULL_FILE |


# A1 MMC Destination Compare Guide

FIRST ACTION ON DESTINATION: COMPARE, NOT APPLY.

This package is quarantine evidence from the old laptop. Do not copy files over the active repository, do not check out old branches over dirty work, do not merge before review, do not apply patches automatically, do not deploy, and do not change production.

## Safe Compare Workflow

```bash
set -euo pipefail

EXPORT_ARCHIVE="$HOME/Downloads/A1_MMC_OLD_LAPTOP_EXPORT_003_20260710.tar.gz"
QUARANTINE="$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003"
mkdir -p "$QUARANTINE"

tar -xzf "$EXPORT_ARCHIVE" -C "$QUARANTINE"
cd "$QUARANTINE/A1_MMC_OLD_LAPTOP_EXPORT_003"
shasum -a 256 -c checksums/archive.sha256

mkdir -p "$QUARANTINE/bundle-inspect"
cd "$QUARANTINE/bundle-inspect"
git clone "$QUARANTINE/A1_MMC_OLD_LAPTOP_EXPORT_003/git/missionmed-old-laptop-complete.bundle" old-laptop-missionmed
cd old-laptop-missionmed
git branch -a
git log --oneline --decorate --graph --all --max-count=80
```

## Fetch Old Laptop Refs Into A Separate Namespace

Run this only from the destination laptop's current MissionMed repo after confirming the worktree is clean or after saving its dirty work elsewhere.

```bash
set -euo pipefail

CURRENT_REPO="$HOME/MissionMed"
OLD_PACKAGE="$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003/A1_MMC_OLD_LAPTOP_EXPORT_003"

cd "$CURRENT_REPO"
git status --short --branch

git fetch "$OLD_PACKAGE/git/missionmed-old-laptop-complete.bundle" \
  'refs/heads/*:refs/remotes/old-laptop/*' \
  'refs/tags/*:refs/tags/old-laptop/*'

git branch -r | grep 'old-laptop/' | sort
```

## Generate Review Diffs

```bash
set -euo pipefail
cd "$HOME/MissionMed"

mkdir -p "$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003/destination-diffs"

git diff --name-status origin/main...refs/remotes/old-laptop/codex/mmc-019-preserve-mmc \
  > "$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003/destination-diffs/mmc-019-name-status.txt" || true

git diff origin/main...refs/remotes/old-laptop/codex/mmc-019-preserve-mmc -- \
  missionmed-hq/server.mjs \
  missionmed-hq/routes/mmc-coaching-pipeline.mjs \
  missionmed-hq/lib/mmc-coaching-import-worker.mjs \
  missionmed-hq/lib/mmc-student-resolution-engine.mjs \
  missionmed-hq/lib/mmc-roster-verification-lane.mjs \
  missionmed-hq/lib/mmc-webex-triggered-pull.mjs \
  missionmed-hq/public/mmc-private \
  missionmed-hq/prompts \
  missionmed-hq/tests \
  supabase/migrations \
  _AI_HANDOFFS/from_codex \
  > "$HOME/MissionMed_Migration_Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003/destination-diffs/mmc-019-focused.diff" || true
```

## Review Rules

1. Identify uniquely newer MMC changes by comparing old-laptop refs against destination refs.
2. Cherry-pick or manually port only approved commits/files after human review.
3. Run validators before integration.
4. Never merge the entire old-laptop repository wholesale.
5. Never deploy from this package.
