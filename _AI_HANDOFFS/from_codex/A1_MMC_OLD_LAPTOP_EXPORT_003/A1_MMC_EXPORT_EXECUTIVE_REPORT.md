# A1 MMC Export Bootstrap Inventory

- Export ID: `A1_MMC_OLD_LAPTOP_EXPORT_003`
- Generated UTC: `2026-07-10T16:46:57Z`
- Risk Level: `HIGH` (audit/export with Git packaging; no production changes)

## Boot Notes
- `/Users/brianb/MissionMed_OS` was absent.
- The mission write boundary allows writes only to the active migration worktree and the external migration package, so no clone was created at `/Users/brianb/MissionMed_OS`.
- Local authority files were loaded from the active migration worktree and canonical MissionMed repo.
- BOOT.md was not found locally by the targeted search.
- `read_learnings.py` succeeded and recent MMC learnings were loaded.
- Matrix runtime lock protocol was loaded; no Matrix runtime mutation was performed.


## pwd
```text
$ pwd
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
/Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
```

## repo_root
```text
$ git rev-parse --show-toplevel
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
/Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
```

## branch
```text
$ git branch --show-current
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
a1-macair-mmc-mentor-intelligence-003
```

## head_sha
```text
$ git rev-parse HEAD
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
9c1fa72e6b056db8b6fe0e17031fcaa688f78569
```

## upstream
```text
$ git rev-parse --abbrev-ref --symbolic-full-name @{u}
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
origin/main
```

## status
```text
$ git status --short --branch
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
## a1-macair-mmc-mentor-intelligence-003...origin/main
?? _AI_HANDOFFS/from_codex/A1_MMC_OLD_LAPTOP_EXPORT_003/
```

## remotes
```text
$ git remote -v
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
origin	https://github.com/brinyu13/missionmed-hq.git (fetch)
origin	https://github.com/brinyu13/missionmed-hq.git (push)
```

## worktree_list
```text
$ git worktree list --porcelain
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
worktree /Users/brianb/MissionMed
HEAD 2aeee64549548d7cefd6d64d65a5fb633b525f4e
branch refs/heads/audit/supabase-2026-grants-20260527-101117

worktree /sessions/friendly-upbeat-cerf/mnt/brianb/MissionMed_worktrees/matrix-access-gate-dashboard-020
HEAD 3ac03bd05c97688edf5996afba0296b71084a42b
branch refs/heads/cowork/matrix-access-gate-dashboard-020
locked initializing

worktree /Users/brianb/.codex/worktrees/dfcb/MissionMed
HEAD 16c045c0351609ef4a151601d3b0835a48be376d
detached

worktree /Users/brianb/MissionMed-Webex
HEAD 3e8104c032bf256978c1acd57b335a34a80561e3
branch refs/heads/feature/webex-meeting-integration

worktree /Users/brianb/MissionMed-Webex-arena-drills
HEAD 55577a78de116591c73d9845019af6f9665f9149
branch refs/heads/feat/arena-battles-drill-gamification

worktree /Users/brianb/MissionMed/.claude/worktrees/bold-pascal-7e5566
HEAD 16c045c0351609ef4a151601d3b0835a48be376d
branch refs/heads/claude/bold-pascal-7e5566

worktree /Users/brianb/MissionMed/.claude/worktrees/stoic-gates-3ec552
HEAD 40b59ef878577878c69498ab98c5511ccf7c7935
branch refs/heads/claude/stoic-gates-3ec552

worktree /Users/brianb/MissionMed/.claude/worktrees/suspicious-banzai-c023f9
HEAD cd8ee1bde242b89434cd35a3cebac8aaf4d9c0d8
detached

worktree /Users/brianb/MissionMed/.claude/worktrees/unruffled-hoover-82e42b
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
detached

worktree /Users/brianb/MissionMed/.claude/worktrees/xenodochial-boyd-614697
HEAD 7409a82f056b58335e996dda7e101c310c982f1f
detached

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/codex-cx-offer-318b-cdn-deploy
HEAD e7442e0859e4e24e7b09b45306103984bef55a13
branch refs/heads/codex/cx-offer-318b-cdn-deploy

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/codex-usce-public-intake-main-hotfix
HEAD 2d953e526d180d23679d3a59d1e241db2f6d38a6
branch refs/heads/codex/usce-public-intake-main-hotfix

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-316e2-route-fix
HEAD 27a771b35105823fed1bb981c9d208bb62a1f0d3
branch refs/heads/cx-offer-316e2-route-fix

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-316g-railway-build-recovery
HEAD 224779818da6c2b63c9e3a24fb81905432fe7059
branch refs/heads/cx-offer-316g-railway-build-recovery

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-317-endgame-efficient
HEAD 2116af4921bfde899d3ce8ecb1b96f8ad2290356
branch refs/heads/cx-offer-317-endgame-efficient

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-320-full-engine
HEAD 8a00a9de9d811dc41390b99de63c47090573da45
branch refs/heads/cx-offer-320-full-engine

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-321-comms
HEAD 8a00a9de9d811dc41390b99de63c47090573da45
branch refs/heads/cx-offer-321-comms

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-322-gmail-auth-setup
HEAD f008cdf9c1a2493c427c61d56063feca5a92c0d0
branch refs/heads/codex/cx-offer-322-gmail-auth-setup

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-322-gmail-postmark
HEAD 029b648f0522240752deecb8867d7e67994129ff
branch refs/heads/codex/cx-offer-322-gmail-postmark

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-324-gmail-metadata-proof
HEAD aa19be8c707d8fb58ceedb251d4d428be3665569
branch refs/heads/cx-offer-324-gmail-metadata-proof

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-325-gmail-sync-dry-run
HEAD 522291b4412e844d2100fae0d1fe793166f670d8
branch refs/heads/cx-offer-325-gmail-sync-dry-run

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-326-gmail-comms-write-gate
HEAD 99efe98743cbcec5c8490b18bdea6feb2440de7c
branch refs/heads/cx-offer-326-gmail-comms-write-gate

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-328-final-admin-engine
HEAD 61d95ce28306a799fd43d19a5fb81a2442ad4f9d
branch refs/heads/cx-offer-328-final-admin-engine

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-328c-full-operational-template
HEAD 99efe98743cbcec5c8490b18bdea6feb2440de7c
branch refs/heads/cx-offer-328c-full-operational-template

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-328d-live-admin-template
HEAD 6ebff59a41f32036148d8392aafe3ffe7a9cbb96
branch refs/heads/cx-offer-328d-live-admin-template

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-330-usce-status-tracker
HEAD 261ad5d7cd1a04a82ee8a1e67857f7970f712acb
branch refs/heads/cx-offer-331-public-intake-persistence

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-usce-public-intake-307
HEAD 10f9ebbe3bcaea313853f16f72835572914ebbb8
branch refs/heads/cx-offer-usce-public-intake-deploy-310i

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-wiring-authority-2
HEAD ca442e6e3a820e7a7aabcf57eecccdae55e4caa1
branch refs/heads/codex/cx-offer-wiring-authority-2

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/D3-402-drills-v3-deploy-only
HEAD 791da3e78fcf1caee50c2ad499694c9c3159a4b0
detached

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/D3-403-drills-v3-avatar-deploy-20260513T112435Z
HEAD cf590c715d476ba12fe6bf83839f756bc9f68a97
detached

worktree /Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/usce-admin-auth-relay-main-hotfix
HEAD 40b59ef878577878c69498ab98c5511ccf7c7935
branch refs/heads/codex/usce-admin-auth-relay-main-hotfix

worktree /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
HEAD 9c1fa72e6b056db8b6fe0e17031fcaa688f78569
branch refs/heads/a1-macair-mmc-mentor-intelligence-003

worktree /Users/brianb/MissionMed_worktrees/ahp-profile-rls-identity-hardening-013
HEAD 791da3e78fcf1caee50c2ad499694c9c3159a4b0
branch refs/heads/ahp/profile-rls-identity-hardening-013

worktree /Users/brianb/MissionMed_worktrees/ar-001-arena-stat-drills-dropdown-consolidation
HEAD 88a8d83a56cc09becaa2c3783e99d3b29ffa68c5
branch refs/heads/codex/ar-001-arena-stat-drills-dropdown-consolidation

worktree /Users/brianb/MissionMed_Worktrees/AR-LIVELOCK-000_source_guardrails
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/feature/ar-livelock-000-source-guardrails

worktree /Users/brianb/MissionMed_worktrees/arena-homepage-concepts-001
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/arena-homepage-concepts-001

worktree /Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-clean
HEAD ddf8de1631e42f0e86c60a4f172e0d075e76be4f
branch refs/heads/av3/profile-locker-v3-parallel-002

worktree /Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-current-arena-repair
HEAD 138d1e3be8e5ab04d002482c23e4a7661bbacbda
branch refs/heads/av3/profile-locker-v3-current-arena-repair-002-g

worktree /Users/brianb/MissionMed_worktrees/cache-coherence-repair-001
HEAD 7409a82f056b58335e996dda7e101c310c982f1f
branch refs/heads/mr/cache-coherence-repair-001

worktree /Users/brianb/MissionMed_worktrees/codex-daily-rounds-stream-menu-repair-20260430
HEAD 95efb00c7427cb71c51bf5ec1c00a875a1b7c1d7
branch refs/heads/codex/daily-rounds-stream-menu-repair-20260430

worktree /Users/brianb/MissionMed_worktrees/d8-432-b-calendar-scheduler-one-thread
HEAD d1819890421dd1dd234b0a56fd540bfb7946c40d
branch refs/heads/codex/d8-432-b-calendar-scheduler-one-thread

worktree /Users/brianb/MissionMed_worktrees/d8-435-admin-matrix-preview
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/feature/d8-435-admin-matrix-preview

worktree /Users/brianb/MissionMed_worktrees/d8-435-admin-matrix-preview-plugin
HEAD 0a80ea1129bf12939346a697a8f1ffaa03371420
branch refs/heads/feature/d8-435-admin-matrix-preview-plugin

worktree /Users/brianb/MissionMed_worktrees/d8-437-matrix-runtime-v2-stage1
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/d8-437-matrix-runtime-v2-stage1

worktree /Users/brianb/MissionMed_worktrees/d8-439-hq-admin-runtime-v2-stage1
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/d8-439-hq-admin-runtime-v2-stage1

worktree /Users/brianb/MissionMed_Worktrees/D8-443_matrix_student_entry_learndash_phase0
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/feature/d8-443-matrix-student-entry-learndash-phase0

worktree /Users/brianb/MissionMed_WORKTREES/D8-445-wp-student-ux-cleanup
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/worktree/d8-445-wp-student-ux-cleanup-20260528-122632

worktree /Users/brianb/MissionMed_worktrees/D8-460_matrix_calendar_admin_student_repair
HEAD 40b59ef878577878c69498ab98c5511ccf7c7935
branch refs/heads/feature/d8-460-matrix-calendar-admin-student-repair

worktree /Users/brianb/MissionMed_worktrees/D8-461_calendar_wiring_bootstrap_authority
HEAD 40b59ef878577878c69498ab98c5511ccf7c7935
branch refs/heads/feature/d8-461-calendar-wiring-bootstrap-authority

worktree /Users/brianb/MissionMed_worktrees/d8-hq-legacy-wiring-phase1
HEAD bf540d459c26caa044523df67de2ee87f952ed86
branch refs/heads/d8-hq-legacy-wiring-phase1

worktree /Users/brianb/MissionMed_worktrees/drj-jbank-revival
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/feature/DRJ-JBANK-001-drj-jbank-revival

worktree /Users/brianb/MissionMed_Worktrees/DRJ-LD-QBANK-CODEX-001
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/drj-ld-qbank-001-audit

worktree /Users/brianb/MissionMed_worktrees/drj-zoom-notes-012-drills-v3-filevault
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/drj-zoom-notes-012-drills-v3-filevault

worktree /Users/brianb/MissionMed_worktrees/drj-zoom-notes-automation
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/feature/DRJ-ZOOM-NOTES-001-automation

worktree /Users/brianb/MissionMed_worktrees/e9-matrix-stat-async-bridge-905a
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/e9-matrix-stat-async-bridge-905a

worktree /Users/brianb/MissionMed_worktrees/e9-stat-async-human-authority-901
HEAD 0a20491a3afb0b6e13a83b9e39b343a4fde2c3f1
branch refs/heads/e9-stat-async-human-authority-901

worktree /Users/brianb/MissionMed_worktrees/g5-avatar
HEAD 049ae2811055482b6fc6312acf19425d14c9c56c
branch refs/heads/g5-avatar-worktree-500

worktree /Users/brianb/MissionMed_worktrees/gp-006-grandprix-race-prototype
HEAD 50ade02f02ded4b4fd832274f964c50f2d718c2f
branch refs/heads/codex/grandprix-race-prototype-006

worktree /Users/brianb/MissionMed_WORKTREES/k9-memberships
HEAD 16c045c0351609ef4a151601d3b0835a48be376d
branch refs/heads/k9-memberships-wp-setup-303

worktree /Users/brianb/MissionMed_worktrees/learndash-integration/mr-ldi-002-learndash-inventory-audit
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/codex/mr-ldi-002-learndash-inventory-audit

worktree /Users/brianb/MissionMed_worktrees/learndash-integration/mr-ldi-004b-hub-product-alias-map
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/codex/mr-ldi-004b-hub-product-alias-map

worktree /Users/brianb/MissionMed_worktrees/learndash-integration/mr-ldi-004d-authority-lock
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/codex/mr-ldi-004d-authority-lock

worktree /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004
HEAD 0a82af65d580fa291f2e4080f47ff026305b91d1
branch refs/heads/mr/live-source-of-truth-reconcile-004

worktree /Users/brianb/MissionMed_WORKTREES/md-merger-daily-drills
HEAD 1225074a894f993dbabeba2d20c57c26432b4060
branch refs/heads/md-daily-drills-v3-side-by-side-014

worktree /Users/brianb/MissionMed_worktrees/merge-mm-dualmac-scripts-001
HEAD 5cc9144bfc770e5eda78124cc1fa886640041767
branch refs/heads/merge/mm-dualmac-scripts-001

worktree /Users/brianb/MissionMed_worktrees/mm-dualmac-scripts-001
HEAD 7409a82f056b58335e996dda7e101c310c982f1f
branch refs/heads/main

worktree /Users/brianb/MissionMed_worktrees/MM-FILEVAULT-ACCESS-UNLOCK-001
HEAD 2aeee64549548d7cefd6d64d65a5fb633b525f4e
branch refs/heads/feature/mm-filevault-access-unlock-001

worktree /Users/brianb/MissionMed_worktrees/MM-GMAIL-SHEETS-ARCHIVE-001
HEAD 5cc9144bfc770e5eda78124cc1fa886640041767
branch refs/heads/MM-GMAIL-SHEETS-ARCHIVE-001

worktree /Users/brianb/MissionMed_worktrees/MM-LAUNCH-SEV1-001-FIXES
HEAD 9cf7b73896d65f5ecee2f990a5e43ed1ac71a5fb
branch refs/heads/codex/mm-launch-sev1-001-fixes

worktree /Users/brianb/MissionMed_worktrees/MM-LAUNCH-SEV1-008-FINALIZE
HEAD fa888464f9f1f9bf084a2b5038b9c2abb66e047d
branch refs/heads/codex/mm-launch-sev1-008-finalize

worktree /Users/brianb/MissionMed_worktrees/mm-matrix-062-calendar-app-mode
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/mm-matrix-062-calendar-app-mode

worktree /Users/brianb/MissionMed_worktrees/mm-matrix-062-calendar-app-mode-source-locked
HEAD 38ad5fb1798e9eae40b4fedc844c4b1c1231be81
branch refs/heads/mm-matrix-062-calendar-app-mode-source-locked

worktree /Users/brianb/MissionMed_worktrees/MM-PAYMENTS-LOCK-016A-cross-mac-sync-audit
HEAD 40b59ef878577878c69498ab98c5511ccf7c7935
branch refs/heads/MM-PAYMENTS-LOCK-016A-cross-mac-sync-audit

worktree /Users/brianb/MissionMed_worktrees/mm-sched-012-schema-api-foundation
HEAD a966e882691905370df4a497524b3cbd65ef9ca4
branch refs/heads/mm-sched-012-schema-api-foundation

worktree /Users/brianb/MissionMed_worktrees/mm-sched-047-live-integrations
HEAD a966e882691905370df4a497524b3cbd65ef9ca4
branch refs/heads/mm-sched-047-live-integrations

worktree /Users/brianb/MissionMed_worktrees/mm-sched-055a-zoom-drj-examprep
HEAD a966e882691905370df4a497524b3cbd65ef9ca4
branch refs/heads/mm-sched-055a-zoom-drj-examprep

worktree /Users/brianb/MissionMed_worktrees/mm-sched-sev1-008c-usce-safe-repair
HEAD 358629fcec5b33331ca2f2420659222c405df80f
branch refs/heads/codex/mm-sched-sev1-008c-usce-safe-repair

worktree /Users/brianb/MissionMed_worktrees/mm-sched-sev1-014-enrollment-gate-release
HEAD 40b59ef878577878c69498ab98c5511ccf7c7935
branch refs/heads/mm-sched-sev1-014-enrollment-gate-release

worktree /Users/brianb/MissionMed_worktrees/mm-sched-webex-055-dr-brian-webex-booking
HEAD 8007161534cb96e83b373948d7c1a46c21286b00
branch refs/heads/mm-sched-webex-055-dr-brian-webex-booking

worktree /Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002
HEAD 1be8a3d1617c9549987982a485d7d46f18932662
branch refs/heads/codex/mmc-019-preserve-mmc

worktree /Users/brianb/MissionMed_WORKTREES/mob9-mobile
HEAD 16c045c0351609ef4a151601d3b0835a48be376d
branch refs/heads/mob9-mobile-game-modes-lab-400

worktree /Users/brianb/MissionMed_Worktrees/MR-BRAND-TRANSITION-002-legacy-popup
HEAD 107d988bd98770982f791d3e46f8e222a0fc057d
branch refs/heads/feature/mr-brand-transition-002-legacy-popup

worktree /Users/brianb/missionmed_worktrees/MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1
HEAD 2aeee64549548d7cefd6d64d65a5fb633b525f4e
branch refs/heads/MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1

worktree /Users/brianb/MissionMed_worktrees/mx-filevault
HEAD 7409a82f056b58335e996dda7e101c310c982f1f
branch refs/heads/codex/mx-filevault-phase0-preflight

worktree /Users/brianb/MissionMed_worktrees/mx-filevault-candidate-tracer-quarantine
HEAD e6418ffaa9f2b3bac9bf46c1cf5a3d3d0307361c
branch refs/heads/codex/mx-filevault-candidate-tracer-quarantine

worktree /Users/brianb/MissionMed_worktrees/mx-filevault-source-r2-quarantine
HEAD 741bb63f2b5e05a40ef73c48fe12c741af5e5ded
branch refs/heads/codex/mx-filevault-source-r2-quarantine

worktree /Users/brianb/MissionMed_worktrees/mx-filevault-v1-build-007
HEAD 0a80ea1129bf12939346a697a8f1ffaa03371420
branch refs/heads/codex/mx-filevault-v1-build-007-fresh

worktree /Users/brianb/MissionMed_Worktrees/payments_hq_frontend_rehome
HEAD 61623a8c9687fe08db4897107969677c3ac15928
branch refs/heads/codex/payments-hq-frontend-rehome

worktree /Users/brianb/MissionMed_Worktrees/payments_stripe_routing_audit
HEAD c25c0e75639fd40eaa101b26d675c87ad4f1bc87
branch refs/heads/payments/multi-stripe-routing-audit

worktree /Users/brianb/MissionMed_worktrees/qbank-003-step2ck-dual-ui-demo
HEAD 7409a82f056b58335e996dda7e101c310c982f1f
branch refs/heads/qbank-003-step2ck-dual-ui-demo

worktree /Users/brianb/MissionMed_WORKTREES/s9-stat-advanced
HEAD 16c045c0351609ef4a151601d3b0835a48be376d
branch refs/heads/s9-stat-advanced-300

worktree /Users/brianb/MissionMed_worktrees/stat-answer-layout-motion-058
HEAD 2ca3a4f4315c56c053d5d5dc71cc77699f7d6934
branch refs/heads/codex/stat-answer-layout-motion-058

worktree /Users/brianb/MissionMed_worktrees/stat-v3-ai-rivals-privacy-cleanroom-016
HEAD 51aae1a4ff22242be7e380e0a3660642b4f6451b
branch refs/heads/codex/stat-v3-training-rivals-authorized-upload-linkback-048

worktree /Users/brianb/MissionMed_worktrees/stat-v3-ai-rivals-staging-plan-027
HEAD 4bf8c103b7ea72d35e6b6d308ae1816afaa1c0cc
branch refs/heads/codex/stat-v3-ai-rivals-staging-plan-027

worktree /Users/brianb/MissionMed_worktrees/stat-v3-human-opponent-roster-responsive-repair-056
HEAD 56f301d773237fef950f6a248de9090e8283d524
branch refs/heads/codex/stat-v3-human-opponent-roster-responsive-repair-056

worktree /Users/brianb/MissionMed_worktrees/stat-v3-live-repair-057
HEAD 6355df2914509e467a1b153306d51dc1c7a731ba
branch refs/heads/codex/stat-v3-live-repair-057

worktree /Users/brianb/MissionMed_worktrees/stat-v3-training-rivals-prod-megarun-050
HEAD a29e86eab8c576edcb7e0b409e6428a4e7e66961
branch refs/heads/codex/stat-v3-training-rivals-prod-megarun-050

worktree /Users/brianb/MissionMed_WORKTREES/t9-tournamed
HEAD 16c045c0351609ef4a151601d3b0835a48be376d
branch refs/heads/t9-tournamed-match-madness-worktree-201

worktree /Users/brianb/MissionMed_worktrees/usce-email-tracker-live-deploy-20260513
HEAD 358629fcec5b33331ca2f2420659222c405df80f
detached
```

## local_branches
```text
$ git branch -vv
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
+ MM-GMAIL-SHEETS-ARCHIVE-001                                  5cc9144 (/Users/brianb/MissionMed_worktrees/MM-GMAIL-SHEETS-ARCHIVE-001) [origin/main: behind 13] Merge MM-DUALMAC-SCRIPTS-001 twin workstation sync system
+ MM-PAYMENTS-LOCK-016A-cross-mac-sync-audit                   40b59ef (/Users/brianb/MissionMed_worktrees/MM-PAYMENTS-LOCK-016A-cross-mac-sync-audit) [origin/main: behind 9] fix(usce): wire admin request APIs
+ MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1                           2aeee64 (/Users/brianb/missionmed_worktrees/MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1) MM-DUALMAC-LOCAL-MERGE-LOG-CONFLICT: resolve activity log conflict
* a1-macair-mmc-mentor-intelligence-003                        9c1fa72 [origin/main] Merge MM-SPINE-006A product boot stop rule
+ ahp/profile-rls-identity-hardening-013                       791da3e (/Users/brianb/MissionMed_worktrees/ahp-profile-rls-identity-hardening-013) Document Arena layer fix live validation
+ arena-homepage-concepts-001                                  38ad5fb (/Users/brianb/MissionMed_worktrees/arena-homepage-concepts-001) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ audit/supabase-2026-grants-20260527-101117                   2aeee64 (/Users/brianb/MissionMed) MM-DUALMAC-LOCAL-MERGE-LOG-CONFLICT: resolve activity log conflict
+ av3/profile-locker-v3-current-arena-repair-002-g             138d1e3 (/Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-current-arena-repair) AV3-002-g repair arena baseline and profile locker deploy
+ av3/profile-locker-v3-parallel-002                           ddf8de1 (/Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-clean) [origin/av3/profile-locker-v3-parallel-002] AV3-002-f surface Avatar Studio locker tile
  backup/C8-usce-auth-200a-before-reconcile-20260428-042257    dafea51 Auth: complete token handoff on /api/auth/session and lock WP redirect host
  backup/C8-usce-routes-200d-before-mount-20260428-063839      140aaa2 (C8)-usCe+OFFERsystem-200d mount USCE API routes
  backup/pre-clean-history-20260426-1537                       2a711cd MR-E3-OUTBOX-REINTRODUCTION-016 — add feature-flagged STAT outbox
  c8-usce-202-launch-runtime                                   5e75ee3 [origin/c8-usce-202-launch-runtime] (C8)-usCe+OFFERsystem-202g align admin/student pages to refined demo UX
  c8-usce-auth-permanentize-200a                               15f2561 [origin/c8-usce-auth-permanentize-200a] (C8)-usCe+OFFERsystem-200a log validation and smoke status
+ claude/bold-pascal-7e5566                                    16c045c (/Users/brianb/MissionMed/.claude/worktrees/bold-pascal-7e5566) fix(arena): finalize avatar runtime follow-up
  claude/quirky-bouman-00380f                                  7409a82 Fix Arena STAT lobby mode metadata and fallback copy
+ claude/stoic-gates-3ec552                                    40b59ef (/Users/brianb/MissionMed/.claude/worktrees/stoic-gates-3ec552) fix(usce): wire admin request APIs
  claude/suspicious-banzai-c023f9                              cd8ee1b CX-OFFER-312-WIRING: add protected admin intake actions
  claude/unruffled-hoover-82e42b                               38ad5fb E8 auth: add resilient Supabase bootstrap link fallbacks
  claude/xenodochial-boyd-614697                               7409a82 Fix Arena STAT lobby mode metadata and fallback copy
  clean/source-of-truth-iv-build                               e22ba28 Standardize CDN LIVE paths across runtime assets
  codex/Statv3_AVATARS                                         38937d9 STATV3 AI Rivals: wire online and random student safe states
+ codex/ar-001-arena-stat-drills-dropdown-consolidation        88a8d83 (/Users/brianb/MissionMed_worktrees/ar-001-arena-stat-drills-dropdown-consolidation) AR-001-c consolidate Arena STAT and Drills version dropdowns
  codex/arena-login-recovery-001-railway-fix                   62be095 [origin/cx-offer-usce-public-intake-deploy-310i: behind 38] CX-OFFER-310K: enforce privileged HQ API role gate
+ codex/cx-offer-318b-cdn-deploy                               e7442e0 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/codex-cx-offer-318b-cdn-deploy) [origin/cx-offer-usce-public-intake-deploy-310i: behind 24] CX-OFFER-319: fix live offer payload mapping
+ codex/cx-offer-322-gmail-auth-setup                          f008cdf (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-322-gmail-auth-setup) [origin/codex/cx-offer-322-gmail-auth-setup] CX-OFFER-323: document Gmail DWD proof gate
+ codex/cx-offer-322-gmail-postmark                            029b648 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-322-gmail-postmark) [origin/codex/cx-offer-322-gmail-postmark] CX-OFFER-322: define USCE Postmark Gmail routing policy
+ codex/cx-offer-wiring-authority-2                            ca442e6 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-wiring-authority-2) [origin/cx-offer-usce-public-intake-deploy-310i: ahead 6, behind 23] feat(stat): overhaul STAT V3 student UX shell
+ codex/d8-432-b-calendar-scheduler-one-thread                 d181989 (/Users/brianb/MissionMed_worktrees/d8-432-b-calendar-scheduler-one-thread) D8-432-c lock Matrix Messages source of truth
+ codex/daily-rounds-stream-menu-repair-20260430               95efb00 (/Users/brianb/MissionMed_worktrees/codex-daily-rounds-stream-menu-repair-20260430) Merge remote-tracking branch 'origin/main'
  codex/e9-drills-return-url-cleanup-901                       ce73361 fix(arena): preserve avatar flow with responsive lobby stage
+ codex/grandprix-race-prototype-006                           50ade02 (/Users/brianb/MissionMed_worktrees/gp-006-grandprix-race-prototype) feat(matrix): Supabase account linking bridge for RankListIQ + Arena
  codex/mm-dualmac-scripts-001                                 372af59 [origin/codex/mm-dualmac-scripts-001] MM-DUALMAC-SCRIPTS-001: tighten sync gitignore safety
+ codex/mm-launch-sev1-001-fixes                               9cf7b73 (/Users/brianb/MissionMed_worktrees/MM-LAUNCH-SEV1-001-FIXES) Merge origin/main into MM launch branch
+ codex/mm-launch-sev1-008-finalize                            fa88846 (/Users/brianb/MissionMed_worktrees/MM-LAUNCH-SEV1-008-FINALIZE) [origin/main: behind 11] MM-LAUNCH-SEV1-008: PR merge finalize report
+ codex/mm-sched-sev1-008c-usce-safe-repair                    358629f (/Users/brianb/MissionMed_worktrees/mm-sched-sev1-008c-usce-safe-repair) USCE mirror tracker emails and sender
+ codex/mmc-019-preserve-mmc                                   1be8a3d (/Users/brianb/MissionMed_worktrees/mmc-canonical-discovery-002) [origin/codex/mmc-019-preserve-mmc] preserve MMC private review payload and schema foundation
+ codex/mr-ldi-002-learndash-inventory-audit                   38ad5fb (/Users/brianb/MissionMed_worktrees/learndash-integration/mr-ldi-002-learndash-inventory-audit) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ codex/mr-ldi-004b-hub-product-alias-map                      38ad5fb (/Users/brianb/MissionMed_worktrees/learndash-integration/mr-ldi-004b-hub-product-alias-map) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ codex/mr-ldi-004d-authority-lock                             38ad5fb (/Users/brianb/MissionMed_worktrees/learndash-integration/mr-ldi-004d-authority-lock) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ codex/mx-filevault-candidate-tracer-quarantine               e6418ff (/Users/brianb/MissionMed_worktrees/mx-filevault-candidate-tracer-quarantine) MX-FILEVAULT-005 identify live source and quarantine unsafe V0 file exposure
+ codex/mx-filevault-phase0-preflight                          7409a82 (/Users/brianb/MissionMed_worktrees/mx-filevault) Fix Arena STAT lobby mode metadata and fallback copy
+ codex/mx-filevault-source-r2-quarantine                      741bb63 (/Users/brianb/MissionMed_worktrees/mx-filevault-source-r2-quarantine) MX-FILEVAULT-005 resolve live source and R2 student file quarantine
  codex/mx-filevault-v1-build-007                              38ad5fb [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ codex/mx-filevault-v1-build-007-fresh                        0a80ea1 (/Users/brianb/MissionMed_worktrees/mx-filevault-v1-build-007) MX-FILEVAULT-018 force File Vault UI fidelity to Claude 006D demo
+ codex/payments-hq-frontend-rehome                            61623a8 (/Users/brianb/MissionMed_Worktrees/payments_hq_frontend_rehome) fix(hq): honor first-party wordpress session
  codex/rollback-usce-public-intake-deploy-before-20260608     358629f [origin/cx-offer-usce-public-intake-deploy-310i: behind 2] USCE mirror tracker emails and sender
  codex/rollback-usce-public-intake-main-before-20260608       5cc9144 [origin/main: behind 13] Merge MM-DUALMAC-SCRIPTS-001 twin workstation sync system
+ codex/stat-answer-layout-motion-058                          2ca3a4f (/Users/brianb/MissionMed_worktrees/stat-answer-layout-motion-058) STAT: stack choices and humanize opponent cursor
  codex/stat-v3-ai-rivals-avatar-prep-023                      38937d9 STATV3 AI Rivals: wire online and random student safe states
  codex/stat-v3-ai-rivals-avatar-prep-023-20260516134204       07f7cb8 STATV3 AI Rivals: prepare avatar generation queue dry run
  codex/stat-v3-ai-rivals-bgremove-upload-linkback-041         cacb076 STATV3 AI Rivals: background remove and prepare avatar linkback
  codex/stat-v3-ai-rivals-flux2-avatar-prompt-prep-029         26da9fd STATV3 AI Rivals: prepare Flux 2 Pro avatar prompts
  codex/stat-v3-ai-rivals-flux2-playground-pilot-034           42b4c51 STATV3 AI Rivals: generate Flux 2 Pro avatar set for review
  codex/stat-v3-ai-rivals-online-random-wiring-021             38937d9 STATV3 AI Rivals: wire online and random student safe states
  codex/stat-v3-ai-rivals-privacy-cleanroom-016                f951654 STATV3 AI Rivals: privacy-safe cleanroom staging build
  codex/stat-v3-ai-rivals-production-staging-patch-013         09b8cda STATV3 AI Rivals: fix roster shuffle and staging polish
  codex/stat-v3-ai-rivals-safety-gated-megarun-015             ddd9512 STATV3 AI Rivals: safety-gated megarun blocked report
+ codex/stat-v3-ai-rivals-staging-plan-027                     4bf8c10 (/Users/brianb/MissionMed_worktrees/stat-v3-ai-rivals-staging-plan-027) Add STATV3 AI Rivals staging finalization plan
  codex/stat-v3-ai-rivals-transparent-upload-linkback-042      5877911 STATV3 AI Rivals: block transparent avatar upload pending approval
  codex/stat-v3-ai-rivals-worktree-rescue-010                  f89cd8c Add STATV3 AI Rivals worktree rescue proof
+ codex/stat-v3-human-opponent-roster-responsive-repair-056    56f301d (/Users/brianb/MissionMed_worktrees/stat-v3-human-opponent-roster-responsive-repair-056) STATV3: repair human opponent roster cards and responsive layout
+ codex/stat-v3-live-repair-057                                6355df2 (/Users/brianb/MissionMed_worktrees/stat-v3-live-repair-057) STATV3: document live reconcile deploy
+ codex/stat-v3-training-rivals-authorized-upload-linkback-048 51aae1a (/Users/brianb/MissionMed_worktrees/stat-v3-ai-rivals-privacy-cleanroom-016) STATV3 Training Rivals: authorized transparent avatar upload linkback
+ codex/stat-v3-training-rivals-prod-megarun-050               a29e86e (/Users/brianb/MissionMed_worktrees/stat-v3-training-rivals-prod-megarun-050) STATV3 Training Rivals: production upload linkback and deployment report
  codex/stat-v3-training-rivals-upload-linkback-047            9d35fdd STATV3 Training Rivals: gate avatar upload linkback for review
  codex/upgradePRIMER                                          87427a5 G8: bake Git hygiene and external AI logging into primer
+ codex/usce-admin-auth-relay-main-hotfix                      40b59ef (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/usce-admin-auth-relay-main-hotfix) [origin/main: behind 9] fix(usce): wire admin request APIs
+ codex/usce-public-intake-main-hotfix                         2d953e5 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/codex-usce-public-intake-main-hotfix) [origin/main: ahead 2, behind 13] fix(scheduler): restore HQ scheduler routes
  codex/usceoffer                                              04cad90 fix(stat): resolve async duel results after both submissions
  cowork/matrix-access-gate-020                                50ade02 feat(matrix): Supabase account linking bridge for RankListIQ + Arena
+ cowork/matrix-access-gate-dashboard-020                      3ac03bd (/sessions/friendly-upbeat-cerf/mnt/brianb/MissionMed_worktrees/matrix-access-gate-dashboard-020) feat(matrix): Frontend access gate - tier gating, FOMO overlay, Arena open access
+ cx-offer-316e2-route-fix                                     27a771b (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-316e2-route-fix) [origin/cx-offer-usce-public-intake-deploy-310i: behind 29] chore: retrigger Railway deploy for CX-OFFER-316E
+ cx-offer-316g-railway-build-recovery                         2247798 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-316g-railway-build-recovery) [origin/cx-offer-usce-public-intake-deploy-310i: behind 31] CX-OFFER-316G2: resolve Railway build blocker for USCE offer backend
+ cx-offer-317-endgame-efficient                               2116af4 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-317-endgame-efficient) [origin/cx-offer-usce-public-intake-deploy-310i: behind 27] chore: retrigger Railway deploy for CX-OFFER-317
+ cx-offer-320-full-engine                                     8a00a9d (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-320-full-engine) [origin/cx-offer-usce-public-intake-deploy-310i: behind 23] CX-OFFER-320-FULL: complete USCE offer engine automation layer
+ cx-offer-321-comms                                           8a00a9d (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-321-comms) [origin/cx-offer-usce-public-intake-deploy-310i: behind 23] CX-OFFER-320-FULL: complete USCE offer engine automation layer
+ cx-offer-324-gmail-metadata-proof                            aa19be8 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-324-gmail-metadata-proof) [origin/cx-offer-usce-public-intake-deploy-310i: ahead 1, behind 22] CX-OFFER-324B: document Gmail metadata proof
+ cx-offer-325-gmail-sync-dry-run                              522291b (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-325-gmail-sync-dry-run) [origin/cx-offer-usce-public-intake-deploy-310i: ahead 1, behind 21] CX-OFFER-325: document Gmail sync dry-run handoff
+ cx-offer-326-gmail-comms-write-gate                          99efe98 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-326-gmail-comms-write-gate) [origin/cx-offer-usce-public-intake-deploy-310i: behind 19] CX-OFFER-326: add service RPC for Gmail comms write gate
+ cx-offer-328-final-admin-engine                              61d95ce (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-328-final-admin-engine) [origin/cx-offer-usce-public-intake-deploy-310i: behind 17] CX-OFFER-328: add final admin engine handoff
+ cx-offer-328c-full-operational-template                      99efe98 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-328c-full-operational-template) [origin/cx-offer-usce-public-intake-deploy-310i: behind 19] CX-OFFER-326: add service RPC for Gmail comms write gate
+ cx-offer-328d-live-admin-template                            6ebff59 (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-328d-live-admin-template) [origin/cx-offer-328d-live-admin-template] CX-OFFER-328E: surface USCE admin auth connect
  cx-offer-330-usce-status-tracker                             045bcc6 [origin/cx-offer-330-usce-status-tracker: behind 5] CX-OFFER-330: add USCE status tracker
+ cx-offer-331-public-intake-persistence                       261ad5d (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-330-usce-status-tracker) CX-OFFER-337: relabel USCE admin login copy
  cx-offer-usce-public-intake-307                              cd8ee1b CX-OFFER-312-WIRING: add protected admin intake actions
+ cx-offer-usce-public-intake-deploy-310i                      10f9ebb (/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-usce-public-intake-307) [origin/cx-offer-usce-public-intake-deploy-310i: ahead 1, behind 32] CX-OFFER-318B: deploy student offer portal live adapter shell
  d3/drills-v3-legacy-runtime-repair-401                       791da3e Document Arena layer fix live validation
+ d8-437-matrix-runtime-v2-stage1                              38ad5fb (/Users/brianb/MissionMed_worktrees/d8-437-matrix-runtime-v2-stage1) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ d8-439-hq-admin-runtime-v2-stage1                            38ad5fb (/Users/brianb/MissionMed_worktrees/d8-439-hq-admin-runtime-v2-stage1) E8 auth: add resilient Supabase bootstrap link fallbacks
+ d8-hq-legacy-wiring-phase1                                   bf540d4 (/Users/brianb/MissionMed_worktrees/d8-hq-legacy-wiring-phase1) [origin/main: ahead 13, behind 16] fix: restore USCE student intake adapter
+ drj-ld-qbank-001-audit                                       38ad5fb (/Users/brianb/MissionMed_Worktrees/DRJ-LD-QBANK-CODEX-001) E8 auth: add resilient Supabase bootstrap link fallbacks
+ drj-zoom-notes-012-drills-v3-filevault                       38ad5fb (/Users/brianb/MissionMed_worktrees/drj-zoom-notes-012-drills-v3-filevault) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
  e8-stat-async-auth-500h                                      2bf556d [origin/e8-stat-async-auth-500h] (E8)-STAT+Async-codex-extra-high-500-ac — disable embedded Arena login injection and canonicalize /arena slash routing
  e8-stat-async-auth-500h-rootfix-003                          95efb00 Merge remote-tracking branch 'origin/main'
  e8-stat-async-duel-finalize-600                              5e567b6 Fix Arena STAT lobby mode metadata and fallback copy
  e8-stat-auth-final-repair                                    47e7989 [origin/e8-stat-auth-final-repair: ahead 4] (E8)-STAT+Async-codex-computer-use-extra-high-601 — remove forbidden HQ token fallback from STAT runtime auth
  e8-stat-auth-final-repair-clean                              38ad5fb [origin/e8-stat-auth-final-repair-clean] E8 auth: add resilient Supabase bootstrap link fallbacks
  e9-arena-avatar-full-system-925                              049ae28 fix(daily): map screenshot-sourced drills to topics
  e9-arena-ui-avatar-system-fix-918                            ce73361 fix(arena): preserve avatar flow with responsive lobby stage
  e9-consolidated-arena-drills-stat-20260502                   16c045c fix(arena): finalize avatar runtime follow-up
+ e9-matrix-stat-async-bridge-905a                             38ad5fb (/Users/brianb/MissionMed_worktrees/e9-matrix-stat-async-bridge-905a) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
  e9-stat-approved-test-accounts-player-search-909             2fc0c6b fix(stat): validate approved account challenge flow
+ e9-stat-async-human-authority-901                            0a20491 (/Users/brianb/MissionMed_worktrees/e9-stat-async-human-authority-901) [origin/main: ahead 5, behind 16] E9 STAT v3 classmate avatar roster fix
  e9-stat-final-async-duel-900-a                               55b2bd6 fix(stat): hydrate sealed async duel pack questions
  e9-stat-identity-friend-selector-907                         1621786 fix(stat): repair identity hydration and friend challenge selector
  e9-stat-production-ready-steps-1-8                           6ad61ac fix(stat): harden async duel production flow
  e9-stat-result-display-polish-909b                           b3ebb01 fix(stat): polish async result labels and player names
  e9-system-primer-learning-scripts-repair-926                 be62e84 fix(arena): persist generated avatar URLs without reupload
+ feat/arena-battles-drill-gamification                        55577a7 (/Users/brianb/MissionMed-Webex-arena-drills) Build report, Webex setup walkthrough, and final verification
+ feature/DRJ-JBANK-001-drj-jbank-revival                      38ad5fb (/Users/brianb/MissionMed_worktrees/drj-jbank-revival) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ feature/DRJ-ZOOM-NOTES-001-automation                        38ad5fb (/Users/brianb/MissionMed_worktrees/drj-zoom-notes-automation) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ feature/ar-livelock-000-source-guardrails                    38ad5fb (/Users/brianb/MissionMed_Worktrees/AR-LIVELOCK-000_source_guardrails) E8 auth: add resilient Supabase bootstrap link fallbacks
+ feature/d8-435-admin-matrix-preview                          38ad5fb (/Users/brianb/MissionMed_worktrees/d8-435-admin-matrix-preview) E8 auth: add resilient Supabase bootstrap link fallbacks
+ feature/d8-435-admin-matrix-preview-plugin                   0a80ea1 (/Users/brianb/MissionMed_worktrees/d8-435-admin-matrix-preview-plugin) MX-FILEVAULT-018 force File Vault UI fidelity to Claude 006D demo
+ feature/d8-443-matrix-student-entry-learndash-phase0         38ad5fb (/Users/brianb/MissionMed_Worktrees/D8-443_matrix_student_entry_learndash_phase0) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ feature/d8-460-matrix-calendar-admin-student-repair          40b59ef (/Users/brianb/MissionMed_worktrees/D8-460_matrix_calendar_admin_student_repair) [origin/main: behind 9] fix(usce): wire admin request APIs
+ feature/d8-461-calendar-wiring-bootstrap-authority           40b59ef (/Users/brianb/MissionMed_worktrees/D8-461_calendar_wiring_bootstrap_authority) [origin/main: behind 9] fix(usce): wire admin request APIs
+ feature/mm-filevault-access-unlock-001                       2aeee64 (/Users/brianb/MissionMed_worktrees/MM-FILEVAULT-ACCESS-UNLOCK-001) MM-DUALMAC-LOCAL-MERGE-LOG-CONFLICT: resolve activity log conflict
+ feature/mr-brand-transition-002-legacy-popup                 107d988 (/Users/brianb/MissionMed_Worktrees/MR-BRAND-TRANSITION-002-legacy-popup) [origin/feature/mr-brand-transition-002-legacy-popup: ahead 1] MR-BRAND-TRANSITION-004 redesign legacy Mission Residency popup
+ feature/webex-meeting-integration                            3e8104c (/Users/brianb/MissionMed-Webex) fix(webex): prevent admin settings secret exposure
  fix/arena-favicon-404                                        f041d3d (A8)-501 fix Arena favicon 404
  fix/daily-drills-auto-hydration-mapping                      5817ad4 fix(drills): support direct mp4 playback when stream id is missing
  fix/remove-obsolete-primer-hard-stops                        faf7ddf fix: soften obsolete primer hard stops
+ g5-avatar-worktree-500                                       049ae28 (/Users/brianb/MissionMed_worktrees/g5-avatar) fix(daily): map screenshot-sourced drills to topics
  g8-auth-guardrails-501                                       4e117dc (G8)-MISSIONMED-AUTH-GUARDRAILS-501 — lock known-good Arena STAT auth contract
+ k9-memberships-wp-setup-303                                  16c045c (/Users/brianb/MissionMed_WORKTREES/k9-memberships) fix(arena): finalize avatar runtime follow-up
+ main                                                         7409a82 (/Users/brianb/MissionMed_worktrees/mm-dualmac-scripts-001) [origin/main: ahead 8, behind 22] Fix Arena STAT lobby mode metadata and fallback copy
  main-sync-temp                                               8eabc58 (C8)-usCe+OFFERsystem-202g align admin/student pages to refined demo UX
  md-daily-drills-nonwiring-megarun-007                        5c19f4a [origin/md-daily-drills-nonwiring-megarun-007] MD Daily/Drills non-wiring merge completion
  md-daily-drills-return-handoff-005                           753d4c2 MD Daily/Drills SOT reconciliation contract B partial
  md-daily-drills-single-html-t16-011                          dcc73b5 [origin/md-daily-drills-single-html-t16-011] MD Daily/Drills single HTML essential engine parity
  md-daily-drills-sot-recon-004                                753d4c2 [origin/md-daily-drills-sot-recon-004] MD Daily/Drills SOT reconciliation contract B partial
+ md-daily-drills-v3-side-by-side-014                          1225074 (/Users/brianb/MissionMed_WORKTREES/md-merger-daily-drills) MD Daily/Drills v3 start runtime from beginning
  md-merger-daily-drills-lab-914                               16c045c fix(arena): finalize avatar runtime follow-up
+ merge/mm-dualmac-scripts-001                                 5cc9144 (/Users/brianb/MissionMed_worktrees/merge-mm-dualmac-scripts-001) [origin/main: behind 13] Merge MM-DUALMAC-SCRIPTS-001 twin workstation sync system
  missionmed-matrix-phases-1-4                                 50ade02 feat(matrix): Supabase account linking bridge for RankListIQ + Arena
+ mm-matrix-062-calendar-app-mode                              38ad5fb (/Users/brianb/MissionMed_worktrees/mm-matrix-062-calendar-app-mode) [origin/main: behind 16] E8 auth: add resilient Supabase bootstrap link fallbacks
+ mm-matrix-062-calendar-app-mode-source-locked                38ad5fb (/Users/brianb/MissionMed_worktrees/mm-matrix-062-calendar-app-mode-source-locked) E8 auth: add resilient Supabase bootstrap link fallbacks
+ mm-sched-012-schema-api-foundation                           a966e88 (/Users/brianb/MissionMed_worktrees/mm-sched-012-schema-api-foundation) docs(stat): add STAT V3 validation summary
+ mm-sched-047-live-integrations                               a966e88 (/Users/brianb/MissionMed_worktrees/mm-sched-047-live-integrations) docs(stat): add STAT V3 validation summary
+ mm-sched-055a-zoom-drj-examprep                              a966e88 (/Users/brianb/MissionMed_worktrees/mm-sched-055a-zoom-drj-examprep) docs(stat): add STAT V3 validation summary
+ mm-sched-sev1-014-enrollment-gate-release                    40b59ef (/Users/brianb/MissionMed_worktrees/mm-sched-sev1-014-enrollment-gate-release) [origin/main: behind 9] fix(usce): wire admin request APIs
+ mm-sched-webex-055-dr-brian-webex-booking                    8007161 (/Users/brianb/MissionMed_worktrees/mm-sched-webex-055-dr-brian-webex-booking) [origin/mm-sched-webex-055-dr-brian-webex-booking: ahead 13] fix(scheduler): guard booking conflict flow
  mmc/canonical-discovery-002                                  7b55f04 [origin/main: behind 7] MMC-014A: tighten private route authorization
+ mob9-mobile-game-modes-lab-400                               16c045c (/Users/brianb/MissionMed_WORKTREES/mob9-mobile) fix(arena): finalize avatar runtime follow-up
+ mr/cache-coherence-repair-001                                7409a82 (/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001) Fix Arena STAT lobby mode metadata and fallback copy
+ mr/live-source-of-truth-reconcile-004                        0a82af6 (/Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004) [origin/mr/live-source-of-truth-reconcile-004: ahead 18] fix(scheduler): remove Mission Residency daily booking cap
+ payments/multi-stripe-routing-audit                          c25c0e7 (/Users/brianb/MissionMed_Worktrees/payments_stripe_routing_audit) feat(arena): trigger STAT diagnostic refresh from Career HUD
  pre-clean-history                                            d120688 CLEAN SYSTEM CORE — removed heavy artifacts
+ qbank-003-step2ck-dual-ui-demo                               7409a82 (/Users/brianb/MissionMed_worktrees/qbank-003-step2ck-dual-ui-demo) Fix Arena STAT lobby mode metadata and fallback copy
  rescue/A8-001-l-20260428_111147                              d4b882a Add Elementor widget export and deployment manual
  rescue/C8-hq-proxy-dirty-after-align-20260428_0610           abbdc9a [origin/rescue/C8-hq-proxy-dirty-after-align-20260428_0610] RESCUE ONLY: preserve hq proxy dirty work after C8 main alignment
  rescue/C8-main-dirty-before-align-20260428_045040            b9e837d [origin/rescue/C8-main-dirty-before-align-20260428_045040] RESCUE ONLY: preserve dirty main before C8 origin alignment
  rescue/C8-pre-200e-dirty-main-20260428_0719                  008362c [origin/rescue/C8-pre-200e-dirty-main-20260428_0719] RESCUE ONLY: preserve dirty main before C8 200e
  rescue/C8-pre-200e-untracked-demos-20260428_0724             beaff41 [origin/rescue/C8-pre-200e-untracked-demos-20260428_0724] RESCUE ONLY: preserve untracked demo files before C8 200e
  rescue/G8-dirty-main-before-simple-workflow-20260429_195701  dd3bb93 G8: rescue dirty main before simple workflow reset
+ s9-stat-advanced-300                                         16c045c (/Users/brianb/MissionMed_WORKTREES/s9-stat-advanced) fix(arena): finalize avatar runtime follow-up
  s9/stat-v3-legacy-runtime-repair-309a                        791da3e Document Arena layer fix live validation
  stat-async-500b-deploy                                       7ad1d5e [origin/main: ahead 3, behind 27] (E8)-STAT+Async-codex-high-500-d — deploy STAT human opponent lookup and friend challenge UX
  t9-tournamed-match-madness-lab-101                           a966e88 docs(stat): add STAT V3 validation summary
+ t9-tournamed-match-madness-worktree-201                      16c045c (/Users/brianb/MissionMed_WORKTREES/t9-tournamed) fix(arena): finalize avatar runtime follow-up
  work/A8-001-l-arena-auth-final-repair                        bd3a09e [origin/main: behind 24] (C8)-usCe+OFFERsystem-200d mount USCE API routes
  work/G8-dirty-triage-protocol                                8764522 G8: replace dirty repo hardstop with triage workflow
  work/G8-git-hygiene-guardrails                               0ffc371 [origin/main: ahead 1, behind 24] G8: add Git workspace hygiene guardrails
  work/G8-primer-logging-final                                 87427a5 G8: bake Git hygiene and external AI logging into primer
  work/G8-simple-git-workflow-final                            8a75298 G8: retire mandatory worktrees and restore simple Git workflow
+ worktree/d8-445-wp-student-ux-cleanup-20260528-122632        38ad5fb (/Users/brianb/MissionMed_WORKTREES/D8-445-wp-student-ux-cleanup) E8 auth: add resilient Supabase bootstrap link fallbacks
```

## remote_branches
```text
$ git branch -r -vv
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
  origin/HEAD                                                     -> origin/main
  origin/MM-DNS-REDIRECT-SEV1-001                                 45c3f36 MM-DNS-REDIRECT-SEV1-001 complete legacy redirect transition page
  origin/MM-MR-HOMEPAGE-CLEANUP-001B                              9b22da0 MM-MR-HOMEPAGE-CLEANUP-001B add Mission Residency homepage cleanup mu-plugin
  origin/audit/supabase-2026-grants-20260527-101117               e850386 MM-USCE-EMAIL-027: add live validation report
  origin/av3/profile-locker-v3-parallel-002                       ddf8de1 AV3-002-f surface Avatar Studio locker tile
  origin/c8-usce-202-launch-runtime                               5e75ee3 (C8)-usCe+OFFERsystem-202g align admin/student pages to refined demo UX
  origin/c8-usce-auth-permanentize-200a                           15f2561 (C8)-usCe+OFFERsystem-200a log validation and smoke status
  origin/codex/cx-offer-322-gmail-auth-setup                      f008cdf CX-OFFER-323: document Gmail DWD proof gate
  origin/codex/cx-offer-322-gmail-postmark                        029b648 CX-OFFER-322: define USCE Postmark Gmail routing policy
  origin/codex/cx-offer-wiring-authority-2                        ca442e6 feat(stat): overhaul STAT V3 student UX shell
  origin/codex/mm-dualmac-live-coord-002                          dbd8219 MM-DUALMAC-LIVE-COORD-002: record live coordination issue
  origin/codex/mm-dualmac-scripts-001                             372af59 MM-DUALMAC-SCRIPTS-001: tighten sync gitignore safety
  origin/codex/mm-launch-sev1-001-fixes                           9cf7b73 Merge origin/main into MM launch branch
  origin/codex/mmc-019-preserve-mmc                               1be8a3d preserve MMC private review payload and schema foundation
  origin/codex/rollback-usce-public-intake-deploy-before-20260608 358629f USCE mirror tracker emails and sender
  origin/codex/rollback-usce-public-intake-main-before-20260608   5cc9144 Merge MM-DUALMAC-SCRIPTS-001 twin workstation sync system
  origin/codex/usce-public-intake-main-hotfix                     420c366 Create index.html
  origin/cx-offer-328-final-admin-engine                          61d95ce CX-OFFER-328: add final admin engine handoff
  origin/cx-offer-328d-live-admin-template                        6ebff59 CX-OFFER-328E: surface USCE admin auth connect
  origin/cx-offer-330-usce-status-tracker                         9f1b5e6 CX-OFFER-335: restore polished USCE request UX
  origin/cx-offer-331-public-intake-persistence                   261ad5d CX-OFFER-337: relabel USCE admin login copy
  origin/cx-offer-usce-public-intake-deploy-310i                  364696b chore: retrigger Railway deploy for USCE offer repair
  origin/dependabot/npm_and_yarn/form-data-4.0.6                  db50116 Bump form-data from 4.0.5 to 4.0.6
  origin/dependabot/npm_and_yarn/multi-988c95afa2                 b083e25 Bump esbuild and tsx
  origin/dependabot/npm_and_yarn/ws-8.21.0                        5dac590 Bump ws from 8.20.0 to 8.21.0
  origin/e8-stat-async-auth-500h                                  2bf556d (E8)-STAT+Async-codex-extra-high-500-ac — disable embedded Arena login injection and canonicalize /arena slash routing
  origin/e8-stat-auth-final-repair                                5dc57ae E8 auth: add resilient Supabase bootstrap link fallbacks
  origin/e8-stat-auth-final-repair-clean                          38ad5fb E8 auth: add resilient Supabase bootstrap link fallbacks
  origin/feature/mr-brand-transition-002-legacy-popup             b82d3f6 MR-BRAND-TRANSITION-003 document legacy popup live deploy
  origin/main                                                     9c1fa72 Merge MM-SPINE-006A product boot stop rule
  origin/md-daily-drills-nonwiring-megarun-007                    5c19f4a MD Daily/Drills non-wiring merge completion
  origin/md-daily-drills-single-html-t16-011                      dcc73b5 MD Daily/Drills single HTML essential engine parity
  origin/md-daily-drills-sot-recon-004                            753d4c2 MD Daily/Drills SOT reconciliation contract B partial
  origin/md-daily-drills-v3-side-by-side-014                      1225074 MD Daily/Drills v3 start runtime from beginning
  origin/missionmed-matrix-phases-1-4                             50ade02 feat(matrix): Supabase account linking bridge for RankListIQ + Arena
  origin/mm-sched-webex-055-dr-brian-webex-booking                8940a47 docs(scheduler): record live Postmark email proof
  origin/mr/live-source-of-truth-reconcile-004                    86df235 Fix Drills V3 schedule track safety
  origin/rescue/C8-hq-proxy-dirty-after-align-20260428_0610       abbdc9a RESCUE ONLY: preserve hq proxy dirty work after C8 main alignment
  origin/rescue/C8-main-dirty-before-align-20260428_045040        b9e837d RESCUE ONLY: preserve dirty main before C8 origin alignment
  origin/rescue/C8-pre-200e-dirty-main-20260428_0719              008362c RESCUE ONLY: preserve dirty main before C8 200e
  origin/rescue/C8-pre-200e-untracked-demos-20260428_0724         beaff41 RESCUE ONLY: preserve untracked demo files before C8 200e
  origin/stat-async-500b-deploy                                   7ad1d5e (E8)-STAT+Async-codex-high-500-d — deploy STAT human opponent lookup and friend challenge UX
  origin/t9-tournamed-match-madness-lab-101                       a966e88 docs(stat): add STAT V3 validation summary
  origin/z1-missionmedos2workflow-2006                            014a7f0 MM-SPINE-006A: restore product boot stop rule
```

## tags
```text
$ git tag -n
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
MR-GOLD-STABLE-2026-04-27 Gold Stable Build after CDN LIVE normalization, R2 mirror repair, runtime validation, and deploy pipeline verification.
STABLE_DRILL_SYSTEM_PRE_STREAM BASELINE — STABLE DRILL SYSTEM BEFORE STREAM INTEGRATION
dboc_iv_p0p1_checkpoint_20260426_091154 temp clean state
dboc_iv_preflight_20260426_084849 [MR-SYSTEM-IMPLEMENTATION-HANDOFF-005] Append execution activity log entry
known-good/2026-06-25-critical-auth-usce-arena-matrix Known-good MissionMed critical auth/USCE/Matrix baseline 2026-06-25
mm-rec-002-pre-deploy-20260606T012224Z feat(scheduler): add Webex recording lookup for appointments
mm-rec-003-pre-recording-lookup-20260606T020244Z docs(scheduler): record Webex recording MVP live deploy
mm-rec-003-pre-title-derive-20260606T021810Z fix(scheduler): find Webex recordings by scheduled meeting context
mm-sched-webex-055L-pre-title-deploy-20260606T210051-0400 docs(scheduler): record Webex recording lookup proof
```

## stashes
```text
$ git stash list
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
stash@{0}: On audit/supabase-2026-grants-20260527-101117: pre-twin local activity log only
stash@{1}: On feature/webex-meeting-integration: pre-codex-mx-filevault-v1-build-007 20260520-130855
stash@{2}: On fix/daily-drills-auto-hydration-mapping: WIP E8/E9 handoff: preserve Arena STAT launch + changelog/activity before branch switch
stash@{3}: WIP on main: eb666d0 [MR-SYSTEM-IMPLEMENTATION-HANDOFF-005] Append execution activity log entry
stash@{4}: WIP on main: eb666d0 [MR-SYSTEM-IMPLEMENTATION-HANDOFF-005] Append execution activity log entry
```

## git_lfs_status
```text
$ git lfs status
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 1

STDERR:
git: 'lfs' is not a git command. See 'git --help'.

The most similar command is
	refs
```

## repo_size
```text
$ du -sh /Users/brianb/MissionMed /Users/brianb/MissionMed_worktrees
# cwd: /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-003
# exit: 0
141G	/Users/brianb/MissionMed
3.0G	/Users/brianb/MissionMed_worktrees
```

