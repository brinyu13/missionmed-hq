# A1 MMC Bundle Import Report

RESULT: `VERIFIED_ISOLATED_IMPORT_COMPLETE`

## Verification and import

- Bundle: `/Users/brianb/MissionMed_Migration/Quarantine/A1_MMC_OLD_LAPTOP_EXPORT_003/git/missionmed-old-laptop-complete.bundle`
- SHA-256: `6b1453f344b3debcd7ac8ebe34bba2f96ca448e3f70cfc09e312cd5fccf8d95b` — exact match.
- `git bundle verify`: PASS.
- Advertised refs: 324 total — 168 heads, 45 remote-tracking refs, 9 tags, 97 worktree refs, 2 Codex refs, 1 stash, 1 main-worktree ref, and HEAD.
- Imported: exactly the 168 advertised `refs/heads/*` tips, mapped atomically to `refs/remotes/old-laptop/*`.
- Not imported: bundle tags, remotes, stash, worktree refs, Codex refs, HEAD.
- Destination mapping check: 168 expected / 168 present / 168 exact SHA matches.
- Missing-object scan: 0 for all imported tips. A storage-aware `git unpack-objects --strict` added only 274 objects that were absent on the Pro; it did not duplicate the bundle's multi-gigabyte pack.
- Protection proof: integration HEAD, all local heads, `origin/*`, six local tags, and seven stashes were not overwritten. Full-repository `git fsck` remains obstructed by a pre-existing `.git/refs/.DS_Store`; no evidence path was mutated to work around it.

## Mapping definitions

Relationship and counts are computed against `origin/main` at `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`. “Unique commits” means commits reachable only from the Air tip in `origin/main...Air`. “Duplicate commits” means common reachable history through the selected merge base. Missing objects are the targeted imported-tip result.

| Original Air branch | Isolated destination ref | SHA | Relationship | Unique commits | Duplicate commits | Missing objects |
| --- | --- | --- | --- | ---: | ---: | ---: |
| `MM-GMAIL-SHEETS-ARCHIVE-001` | `refs/remotes/old-laptop/MM-GMAIL-SHEETS-ARCHIVE-001` | `5cc9144bfc770e5eda78124cc1fa886640041767` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 28 | 0 |
| `MM-PAYMENTS-LOCK-016A-cross-mac-sync-audit` | `refs/remotes/old-laptop/MM-PAYMENTS-LOCK-016A-cross-mac-sync-audit` | `40b59ef878577878c69498ab98c5511ccf7c7935` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 32 | 0 |
| `MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1` | `refs/remotes/old-laptop/MR-ORI-WEBEX-KEYNOTE-002H-BUILD-V1` | `2aeee64549548d7cefd6d64d65a5fb633b525f4e` | DIVERGED | 1 | 28 | 0 |
| `a1-macair-mmc-mentor-intelligence-003` | `refs/remotes/old-laptop/a1-macair-mmc-mentor-intelligence-003` | `b5536abb69a54def477558e9c54e9e6f733ce167` | ORIGIN_MAIN_ANCESTOR_OF_AIR | 1 | 41 | 0 |
| `ahp/profile-rls-identity-hardening-013` | `refs/remotes/old-laptop/ahp/profile-rls-identity-hardening-013` | `791da3e78fcf1caee50c2ad499694c9c3159a4b0` | DIVERGED | 39 | 19 | 0 |
| `arena-homepage-concepts-001` | `refs/remotes/old-laptop/arena-homepage-concepts-001` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `audit/supabase-2026-grants-20260527-101117` | `refs/remotes/old-laptop/audit/supabase-2026-grants-20260527-101117` | `2aeee64549548d7cefd6d64d65a5fb633b525f4e` | DIVERGED | 1 | 28 | 0 |
| `av3/profile-locker-v3-current-arena-repair-002-g` | `refs/remotes/old-laptop/av3/profile-locker-v3-current-arena-repair-002-g` | `138d1e3be8e5ab04d002482c23e4a7661bbacbda` | DIVERGED | 40 | 19 | 0 |
| `av3/profile-locker-v3-parallel-002` | `refs/remotes/old-laptop/av3/profile-locker-v3-parallel-002` | `ddf8de1631e42f0e86c60a4f172e0d075e76be4f` | DIVERGED | 34 | 19 | 0 |
| `backup/C8-usce-auth-200a-before-reconcile-20260428-042257` | `refs/remotes/old-laptop/backup/C8-usce-auth-200a-before-reconcile-20260428-042257` | `dafea5120dc734840d62401d272421ad2acdee4b` | DIVERGED | 1 | 12 | 0 |
| `backup/C8-usce-routes-200d-before-mount-20260428-063839` | `refs/remotes/old-laptop/backup/C8-usce-routes-200d-before-mount-20260428-063839` | `140aaa2f3fef2dae238c240b159eba2776e9096c` | DIVERGED | 1 | 16 | 0 |
| `backup/pre-clean-history-20260426-1537` | `refs/remotes/old-laptop/backup/pre-clean-history-20260426-1537` | `2a711cde551bb9232b93b7d3fe168b3f9c877a40` | UNRELATED | 28 | 0 | 0 |
| `c8-usce-202-launch-runtime` | `refs/remotes/old-laptop/c8-usce-202-launch-runtime` | `5e75ee38e6c3705da8e4c37ea2f00247bce0647e` | DIVERGED | 6 | 17 | 0 |
| `c8-usce-auth-permanentize-200a` | `refs/remotes/old-laptop/c8-usce-auth-permanentize-200a` | `15f25613333c82cd2abffd3bfbf8b30b1148effc` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 16 | 0 |
| `claude/bold-pascal-7e5566` | `refs/remotes/old-laptop/claude/bold-pascal-7e5566` | `16c045c0351609ef4a151601d3b0835a48be376d` | DIVERGED | 33 | 19 | 0 |
| `claude/quirky-bouman-00380f` | `refs/remotes/old-laptop/claude/quirky-bouman-00380f` | `7409a82f056b58335e996dda7e101c310c982f1f` | DIVERGED | 8 | 19 | 0 |
| `claude/stoic-gates-3ec552` | `refs/remotes/old-laptop/claude/stoic-gates-3ec552` | `40b59ef878577878c69498ab98c5511ccf7c7935` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 32 | 0 |
| `claude/suspicious-banzai-c023f9` | `refs/remotes/old-laptop/claude/suspicious-banzai-c023f9` | `cd8ee1bde242b89434cd35a3cebac8aaf4d9c0d8` | DIVERGED | 40 | 19 | 0 |
| `claude/unruffled-hoover-82e42b` | `refs/remotes/old-laptop/claude/unruffled-hoover-82e42b` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `claude/xenodochial-boyd-614697` | `refs/remotes/old-laptop/claude/xenodochial-boyd-614697` | `7409a82f056b58335e996dda7e101c310c982f1f` | DIVERGED | 8 | 19 | 0 |
| `clean/source-of-truth-iv-build` | `refs/remotes/old-laptop/clean/source-of-truth-iv-build` | `e22ba28f39a4d115e26c9d576881fe7b797bfe4e` | DIVERGED | 3 | 1 | 0 |
| `codex/Statv3_AVATARS` | `refs/remotes/old-laptop/codex/Statv3_AVATARS` | `38937d9d58acc93d04ef8878c27c7946bee4058f` | DIVERGED | 45 | 19 | 0 |
| `codex/ar-001-arena-stat-drills-dropdown-consolidation` | `refs/remotes/old-laptop/codex/ar-001-arena-stat-drills-dropdown-consolidation` | `88a8d83a56cc09becaa2c3783e99d3b29ffa68c5` | DIVERGED | 44 | 19 | 0 |
| `codex/arena-login-recovery-001-railway-fix` | `refs/remotes/old-laptop/codex/arena-login-recovery-001-railway-fix` | `62be095e0ff05a7bcff1e4a2e5dab0dff5a554c8` | DIVERGED | 7 | 25 | 0 |
| `codex/cx-offer-318b-cdn-deploy` | `refs/remotes/old-laptop/codex/cx-offer-318b-cdn-deploy` | `e7442e0859e4e24e7b09b45306103984bef55a13` | DIVERGED | 21 | 25 | 0 |
| `codex/cx-offer-322-gmail-auth-setup` | `refs/remotes/old-laptop/codex/cx-offer-322-gmail-auth-setup` | `f008cdf9c1a2493c427c61d56063feca5a92c0d0` | DIVERGED | 25 | 25 | 0 |
| `codex/cx-offer-322-gmail-postmark` | `refs/remotes/old-laptop/codex/cx-offer-322-gmail-postmark` | `029b648f0522240752deecb8867d7e67994129ff` | DIVERGED | 23 | 25 | 0 |
| `codex/cx-offer-wiring-authority-2` | `refs/remotes/old-laptop/codex/cx-offer-wiring-authority-2` | `ca442e6e3a820e7a7aabcf57eecccdae55e4caa1` | DIVERGED | 28 | 25 | 0 |
| `codex/d8-432-b-calendar-scheduler-one-thread` | `refs/remotes/old-laptop/codex/d8-432-b-calendar-scheduler-one-thread` | `d1819890421dd1dd234b0a56fd540bfb7946c40d` | DIVERGED | 2 | 25 | 0 |
| `codex/daily-rounds-stream-menu-repair-20260430` | `refs/remotes/old-laptop/codex/daily-rounds-stream-menu-repair-20260430` | `95efb00c7427cb71c51bf5ec1c00a875a1b7c1d7` | DIVERGED | 4 | 19 | 0 |
| `codex/e9-drills-return-url-cleanup-901` | `refs/remotes/old-laptop/codex/e9-drills-return-url-cleanup-901` | `ce7336101ea613711c7489f7c092f8d03c08b774` | DIVERGED | 21 | 19 | 0 |
| `codex/grandprix-race-prototype-006` | `refs/remotes/old-laptop/codex/grandprix-race-prototype-006` | `50ade02f02ded4b4fd832274f964c50f2d718c2f` | DIVERGED | 44 | 19 | 0 |
| `codex/mm-dualmac-scripts-001` | `refs/remotes/old-laptop/codex/mm-dualmac-scripts-001` | `372af59ce3b3c3e993a24861b1de0dd4c9dadf98` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 27 | 0 |
| `codex/mm-launch-sev1-001-fixes` | `refs/remotes/old-laptop/codex/mm-launch-sev1-001-fixes` | `9cf7b73896d65f5ecee2f990a5e43ed1ac71a5fb` | DIVERGED | 14 | 28 | 0 |
| `codex/mm-launch-sev1-008-finalize` | `refs/remotes/old-laptop/codex/mm-launch-sev1-008-finalize` | `fa888464f9f1f9bf084a2b5038b9c2abb66e047d` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 30 | 0 |
| `codex/mm-sched-sev1-008c-usce-safe-repair` | `refs/remotes/old-laptop/codex/mm-sched-sev1-008c-usce-safe-repair` | `358629fcec5b33331ca2f2420659222c405df80f` | DIVERGED | 43 | 25 | 0 |
| `codex/mmc-019-preserve-mmc` | `refs/remotes/old-laptop/codex/mmc-019-preserve-mmc` | `1be8a3d1617c9549987982a485d7d46f18932662` | DIVERGED | 1 | 34 | 0 |
| `codex/mr-ldi-002-learndash-inventory-audit` | `refs/remotes/old-laptop/codex/mr-ldi-002-learndash-inventory-audit` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `codex/mr-ldi-004b-hub-product-alias-map` | `refs/remotes/old-laptop/codex/mr-ldi-004b-hub-product-alias-map` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `codex/mr-ldi-004d-authority-lock` | `refs/remotes/old-laptop/codex/mr-ldi-004d-authority-lock` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `codex/mx-filevault-candidate-tracer-quarantine` | `refs/remotes/old-laptop/codex/mx-filevault-candidate-tracer-quarantine` | `e6418ffaa9f2b3bac9bf46c1cf5a3d3d0307361c` | DIVERGED | 9 | 19 | 0 |
| `codex/mx-filevault-phase0-preflight` | `refs/remotes/old-laptop/codex/mx-filevault-phase0-preflight` | `7409a82f056b58335e996dda7e101c310c982f1f` | DIVERGED | 8 | 19 | 0 |
| `codex/mx-filevault-source-r2-quarantine` | `refs/remotes/old-laptop/codex/mx-filevault-source-r2-quarantine` | `741bb63f2b5e05a40ef73c48fe12c741af5e5ded` | DIVERGED | 66 | 19 | 0 |
| `codex/mx-filevault-v1-build-007` | `refs/remotes/old-laptop/codex/mx-filevault-v1-build-007` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `codex/mx-filevault-v1-build-007-fresh` | `refs/remotes/old-laptop/codex/mx-filevault-v1-build-007-fresh` | `0a80ea1129bf12939346a697a8f1ffaa03371420` | DIVERGED | 13 | 19 | 0 |
| `codex/payments-hq-frontend-rehome` | `refs/remotes/old-laptop/codex/payments-hq-frontend-rehome` | `61623a8c9687fe08db4897107969677c3ac15928` | DIVERGED | 44 | 19 | 0 |
| `codex/rollback-usce-public-intake-deploy-before-20260608` | `refs/remotes/old-laptop/codex/rollback-usce-public-intake-deploy-before-20260608` | `358629fcec5b33331ca2f2420659222c405df80f` | DIVERGED | 43 | 25 | 0 |
| `codex/rollback-usce-public-intake-main-before-20260608` | `refs/remotes/old-laptop/codex/rollback-usce-public-intake-main-before-20260608` | `5cc9144bfc770e5eda78124cc1fa886640041767` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 28 | 0 |
| `codex/stat-answer-layout-motion-058` | `refs/remotes/old-laptop/codex/stat-answer-layout-motion-058` | `2ca3a4f4315c56c053d5d5dc71cc77699f7d6934` | DIVERGED | 59 | 19 | 0 |
| `codex/stat-v3-ai-rivals-avatar-prep-023` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-avatar-prep-023` | `38937d9d58acc93d04ef8878c27c7946bee4058f` | DIVERGED | 45 | 19 | 0 |
| `codex/stat-v3-ai-rivals-avatar-prep-023-20260516134204` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-avatar-prep-023-20260516134204` | `07f7cb8ea4697afe1c73afcc39de10567c3e707a` | DIVERGED | 46 | 19 | 0 |
| `codex/stat-v3-ai-rivals-bgremove-upload-linkback-041` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-bgremove-upload-linkback-041` | `cacb0764263d0be6deb0202e883a57e1ff1b61f2` | DIVERGED | 48 | 19 | 0 |
| `codex/stat-v3-ai-rivals-flux2-avatar-prompt-prep-029` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-flux2-avatar-prompt-prep-029` | `26da9fd5ec1bb93a481fb7a171ac0743e9d6d49f` | DIVERGED | 46 | 19 | 0 |
| `codex/stat-v3-ai-rivals-flux2-playground-pilot-034` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-flux2-playground-pilot-034` | `42b4c5115b12ed6606dae637f49d05d3e6a0ec5e` | DIVERGED | 47 | 19 | 0 |
| `codex/stat-v3-ai-rivals-online-random-wiring-021` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-online-random-wiring-021` | `38937d9d58acc93d04ef8878c27c7946bee4058f` | DIVERGED | 45 | 19 | 0 |
| `codex/stat-v3-ai-rivals-privacy-cleanroom-016` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-privacy-cleanroom-016` | `f951654c7cc40df712054e032fd49ac38a3191e5` | DIVERGED | 44 | 19 | 0 |
| `codex/stat-v3-ai-rivals-production-staging-patch-013` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-production-staging-patch-013` | `09b8cda268676eed94f9d5cd1ed31b045d00854c` | DIVERGED | 46 | 19 | 0 |
| `codex/stat-v3-ai-rivals-safety-gated-megarun-015` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-safety-gated-megarun-015` | `ddd9512983018d93c06652e1eb0e72b9b664d2a7` | DIVERGED | 48 | 19 | 0 |
| `codex/stat-v3-ai-rivals-staging-plan-027` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-staging-plan-027` | `4bf8c103b7ea72d35e6b6d308ae1816afaa1c0cc` | DIVERGED | 46 | 19 | 0 |
| `codex/stat-v3-ai-rivals-transparent-upload-linkback-042` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-transparent-upload-linkback-042` | `58779111bac36cff8599396e3c21786ee8361dc9` | DIVERGED | 49 | 19 | 0 |
| `codex/stat-v3-ai-rivals-worktree-rescue-010` | `refs/remotes/old-laptop/codex/stat-v3-ai-rivals-worktree-rescue-010` | `f89cd8cc53149f62e323a854b461abe01221edab` | DIVERGED | 45 | 19 | 0 |
| `codex/stat-v3-human-opponent-roster-responsive-repair-056` | `refs/remotes/old-laptop/codex/stat-v3-human-opponent-roster-responsive-repair-056` | `56f301d773237fef950f6a248de9090e8283d524` | DIVERGED | 55 | 19 | 0 |
| `codex/stat-v3-live-repair-057` | `refs/remotes/old-laptop/codex/stat-v3-live-repair-057` | `6355df2914509e467a1b153306d51dc1c7a731ba` | DIVERGED | 58 | 19 | 0 |
| `codex/stat-v3-training-rivals-authorized-upload-linkback-048` | `refs/remotes/old-laptop/codex/stat-v3-training-rivals-authorized-upload-linkback-048` | `51aae1a4ff22242be7e380e0a3660642b4f6451b` | DIVERGED | 51 | 19 | 0 |
| `codex/stat-v3-training-rivals-prod-megarun-050` | `refs/remotes/old-laptop/codex/stat-v3-training-rivals-prod-megarun-050` | `a29e86eab8c576edcb7e0b409e6428a4e7e66961` | DIVERGED | 54 | 19 | 0 |
| `codex/stat-v3-training-rivals-upload-linkback-047` | `refs/remotes/old-laptop/codex/stat-v3-training-rivals-upload-linkback-047` | `9d35fdd9c5f2d3687ef5f06e0a25fcadbef54792` | DIVERGED | 50 | 19 | 0 |
| `codex/upgradePRIMER` | `refs/remotes/old-laptop/codex/upgradePRIMER` | `87427a562f0eb163af76308ce5e716e0fd514152` | DIVERGED | 2 | 17 | 0 |
| `codex/usce-admin-auth-relay-main-hotfix` | `refs/remotes/old-laptop/codex/usce-admin-auth-relay-main-hotfix` | `40b59ef878577878c69498ab98c5511ccf7c7935` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 32 | 0 |
| `codex/usce-public-intake-main-hotfix` | `refs/remotes/old-laptop/codex/usce-public-intake-main-hotfix` | `2d953e526d180d23679d3a59d1e241db2f6d38a6` | DIVERGED | 2 | 28 | 0 |
| `codex/usceoffer` | `refs/remotes/old-laptop/codex/usceoffer` | `04cad900594f455f4b1ef921e3ebc42f4284f697` | DIVERGED | 25 | 19 | 0 |
| `cowork/matrix-access-gate-020` | `refs/remotes/old-laptop/cowork/matrix-access-gate-020` | `50ade02f02ded4b4fd832274f964c50f2d718c2f` | DIVERGED | 44 | 19 | 0 |
| `cowork/matrix-access-gate-dashboard-020` | `refs/remotes/old-laptop/cowork/matrix-access-gate-dashboard-020` | `3ac03bd05c97688edf5996afba0296b71084a42b` | DIVERGED | 46 | 19 | 0 |
| `cx-offer-316e2-route-fix` | `refs/remotes/old-laptop/cx-offer-316e2-route-fix` | `27a771b35105823fed1bb981c9d208bb62a1f0d3` | DIVERGED | 16 | 25 | 0 |
| `cx-offer-316g-railway-build-recovery` | `refs/remotes/old-laptop/cx-offer-316g-railway-build-recovery` | `224779818da6c2b63c9e3a24fb81905432fe7059` | DIVERGED | 14 | 25 | 0 |
| `cx-offer-317-endgame-efficient` | `refs/remotes/old-laptop/cx-offer-317-endgame-efficient` | `2116af4921bfde899d3ce8ecb1b96f8ad2290356` | DIVERGED | 18 | 25 | 0 |
| `cx-offer-320-full-engine` | `refs/remotes/old-laptop/cx-offer-320-full-engine` | `8a00a9de9d811dc41390b99de63c47090573da45` | DIVERGED | 22 | 25 | 0 |
| `cx-offer-321-comms` | `refs/remotes/old-laptop/cx-offer-321-comms` | `8a00a9de9d811dc41390b99de63c47090573da45` | DIVERGED | 22 | 25 | 0 |
| `cx-offer-324-gmail-metadata-proof` | `refs/remotes/old-laptop/cx-offer-324-gmail-metadata-proof` | `aa19be8c707d8fb58ceedb251d4d428be3665569` | DIVERGED | 24 | 25 | 0 |
| `cx-offer-325-gmail-sync-dry-run` | `refs/remotes/old-laptop/cx-offer-325-gmail-sync-dry-run` | `522291b4412e844d2100fae0d1fe793166f670d8` | DIVERGED | 25 | 25 | 0 |
| `cx-offer-326-gmail-comms-write-gate` | `refs/remotes/old-laptop/cx-offer-326-gmail-comms-write-gate` | `99efe98743cbcec5c8490b18bdea6feb2440de7c` | DIVERGED | 26 | 25 | 0 |
| `cx-offer-328-final-admin-engine` | `refs/remotes/old-laptop/cx-offer-328-final-admin-engine` | `61d95ce28306a799fd43d19a5fb81a2442ad4f9d` | DIVERGED | 28 | 25 | 0 |
| `cx-offer-328c-full-operational-template` | `refs/remotes/old-laptop/cx-offer-328c-full-operational-template` | `99efe98743cbcec5c8490b18bdea6feb2440de7c` | DIVERGED | 26 | 25 | 0 |
| `cx-offer-328d-live-admin-template` | `refs/remotes/old-laptop/cx-offer-328d-live-admin-template` | `6ebff59a41f32036148d8392aafe3ffe7a9cbb96` | DIVERGED | 32 | 25 | 0 |
| `cx-offer-330-usce-status-tracker` | `refs/remotes/old-laptop/cx-offer-330-usce-status-tracker` | `045bcc6807d1d2b47a4996c056e241ccc3d2c7a8` | DIVERGED | 33 | 25 | 0 |
| `cx-offer-331-public-intake-persistence` | `refs/remotes/old-laptop/cx-offer-331-public-intake-persistence` | `261ad5d7cd1a04a82ee8a1e67857f7970f712acb` | DIVERGED | 41 | 25 | 0 |
| `cx-offer-usce-public-intake-307` | `refs/remotes/old-laptop/cx-offer-usce-public-intake-307` | `cd8ee1bde242b89434cd35a3cebac8aaf4d9c0d8` | DIVERGED | 40 | 19 | 0 |
| `cx-offer-usce-public-intake-deploy-310i` | `refs/remotes/old-laptop/cx-offer-usce-public-intake-deploy-310i` | `10f9ebbe3bcaea313853f16f72835572914ebbb8` | DIVERGED | 14 | 25 | 0 |
| `d3/drills-v3-legacy-runtime-repair-401` | `refs/remotes/old-laptop/d3/drills-v3-legacy-runtime-repair-401` | `791da3e78fcf1caee50c2ad499694c9c3159a4b0` | DIVERGED | 39 | 19 | 0 |
| `d8-437-matrix-runtime-v2-stage1` | `refs/remotes/old-laptop/d8-437-matrix-runtime-v2-stage1` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `d8-439-hq-admin-runtime-v2-stage1` | `refs/remotes/old-laptop/d8-439-hq-admin-runtime-v2-stage1` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `d8-hq-legacy-wiring-phase1` | `refs/remotes/old-laptop/d8-hq-legacy-wiring-phase1` | `bf540d459c26caa044523df67de2ee87f952ed86` | DIVERGED | 13 | 25 | 0 |
| `drj-ld-qbank-001-audit` | `refs/remotes/old-laptop/drj-ld-qbank-001-audit` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `drj-zoom-notes-012-drills-v3-filevault` | `refs/remotes/old-laptop/drj-zoom-notes-012-drills-v3-filevault` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `e8-stat-async-auth-500h` | `refs/remotes/old-laptop/e8-stat-async-auth-500h` | `2bf556d0f7bda4f0b1561928260292ccd096da31` | DIVERGED | 23 | 14 | 0 |
| `e8-stat-async-auth-500h-rootfix-003` | `refs/remotes/old-laptop/e8-stat-async-auth-500h-rootfix-003` | `95efb00c7427cb71c51bf5ec1c00a875a1b7c1d7` | DIVERGED | 4 | 19 | 0 |
| `e8-stat-async-duel-finalize-600` | `refs/remotes/old-laptop/e8-stat-async-duel-finalize-600` | `5e567b612512f5ebb06d1789b390654b67870fce` | DIVERGED | 8 | 19 | 0 |
| `e8-stat-auth-final-repair` | `refs/remotes/old-laptop/e8-stat-auth-final-repair` | `47e79899a9681f82bfe4a4e547ee05df3e1a3b43` | DIVERGED | 15 | 19 | 0 |
| `e8-stat-auth-final-repair-clean` | `refs/remotes/old-laptop/e8-stat-auth-final-repair-clean` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `e9-arena-avatar-full-system-925` | `refs/remotes/old-laptop/e9-arena-avatar-full-system-925` | `049ae2811055482b6fc6312acf19425d14c9c56c` | DIVERGED | 31 | 19 | 0 |
| `e9-arena-ui-avatar-system-fix-918` | `refs/remotes/old-laptop/e9-arena-ui-avatar-system-fix-918` | `ce7336101ea613711c7489f7c092f8d03c08b774` | DIVERGED | 21 | 19 | 0 |
| `e9-consolidated-arena-drills-stat-20260502` | `refs/remotes/old-laptop/e9-consolidated-arena-drills-stat-20260502` | `16c045c0351609ef4a151601d3b0835a48be376d` | DIVERGED | 33 | 19 | 0 |
| `e9-matrix-stat-async-bridge-905a` | `refs/remotes/old-laptop/e9-matrix-stat-async-bridge-905a` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `e9-stat-approved-test-accounts-player-search-909` | `refs/remotes/old-laptop/e9-stat-approved-test-accounts-player-search-909` | `2fc0c6b8994cf8a6be43371ebfbbc65dbf19f585` | DIVERGED | 29 | 19 | 0 |
| `e9-stat-async-human-authority-901` | `refs/remotes/old-laptop/e9-stat-async-human-authority-901` | `0a20491a3afb0b6e13a83b9e39b343a4fde2c3f1` | DIVERGED | 5 | 25 | 0 |
| `e9-stat-final-async-duel-900-a` | `refs/remotes/old-laptop/e9-stat-final-async-duel-900-a` | `55b2bd6d1849e200134c05641e618f086c4863d1` | DIVERGED | 19 | 19 | 0 |
| `e9-stat-identity-friend-selector-907` | `refs/remotes/old-laptop/e9-stat-identity-friend-selector-907` | `1621786a8d583033524e244d2aeb797df452b032` | DIVERGED | 26 | 19 | 0 |
| `e9-stat-production-ready-steps-1-8` | `refs/remotes/old-laptop/e9-stat-production-ready-steps-1-8` | `6ad61ac914c5588ea2f48319b40ebc98e3971db6` | DIVERGED | 22 | 19 | 0 |
| `e9-stat-result-display-polish-909b` | `refs/remotes/old-laptop/e9-stat-result-display-polish-909b` | `b3ebb013eac51a442b8815a78834e63909b54185` | DIVERGED | 29 | 19 | 0 |
| `e9-system-primer-learning-scripts-repair-926` | `refs/remotes/old-laptop/e9-system-primer-learning-scripts-repair-926` | `be62e8452b7124ea58026c8abbd02b23836657a7` | DIVERGED | 28 | 19 | 0 |
| `feat/arena-battles-drill-gamification` | `refs/remotes/old-laptop/feat/arena-battles-drill-gamification` | `55577a78de116591c73d9845019af6f9665f9149` | DIVERGED | 48 | 19 | 0 |
| `feature/DRJ-JBANK-001-drj-jbank-revival` | `refs/remotes/old-laptop/feature/DRJ-JBANK-001-drj-jbank-revival` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `feature/DRJ-ZOOM-NOTES-001-automation` | `refs/remotes/old-laptop/feature/DRJ-ZOOM-NOTES-001-automation` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `feature/ar-livelock-000-source-guardrails` | `refs/remotes/old-laptop/feature/ar-livelock-000-source-guardrails` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `feature/d8-435-admin-matrix-preview` | `refs/remotes/old-laptop/feature/d8-435-admin-matrix-preview` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `feature/d8-435-admin-matrix-preview-plugin` | `refs/remotes/old-laptop/feature/d8-435-admin-matrix-preview-plugin` | `0a80ea1129bf12939346a697a8f1ffaa03371420` | DIVERGED | 13 | 19 | 0 |
| `feature/d8-443-matrix-student-entry-learndash-phase0` | `refs/remotes/old-laptop/feature/d8-443-matrix-student-entry-learndash-phase0` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `feature/d8-460-matrix-calendar-admin-student-repair` | `refs/remotes/old-laptop/feature/d8-460-matrix-calendar-admin-student-repair` | `40b59ef878577878c69498ab98c5511ccf7c7935` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 32 | 0 |
| `feature/d8-461-calendar-wiring-bootstrap-authority` | `refs/remotes/old-laptop/feature/d8-461-calendar-wiring-bootstrap-authority` | `40b59ef878577878c69498ab98c5511ccf7c7935` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 32 | 0 |
| `feature/mm-filevault-access-unlock-001` | `refs/remotes/old-laptop/feature/mm-filevault-access-unlock-001` | `2aeee64549548d7cefd6d64d65a5fb633b525f4e` | DIVERGED | 1 | 28 | 0 |
| `feature/mr-brand-transition-002-legacy-popup` | `refs/remotes/old-laptop/feature/mr-brand-transition-002-legacy-popup` | `107d988bd98770982f791d3e46f8e222a0fc057d` | DIVERGED | 3 | 25 | 0 |
| `feature/webex-meeting-integration` | `refs/remotes/old-laptop/feature/webex-meeting-integration` | `3e8104c032bf256978c1acd57b335a34a80561e3` | DIVERGED | 65 | 19 | 0 |
| `fix/arena-favicon-404` | `refs/remotes/old-laptop/fix/arena-favicon-404` | `f041d3df349f702bcf4c7017cf32283fc7149f1c` | DIVERGED | 5 | 19 | 0 |
| `fix/daily-drills-auto-hydration-mapping` | `refs/remotes/old-laptop/fix/daily-drills-auto-hydration-mapping` | `5817ad487b2a517a634ca2756afecabe2ced59d6` | DIVERGED | 20 | 19 | 0 |
| `fix/remove-obsolete-primer-hard-stops` | `refs/remotes/old-laptop/fix/remove-obsolete-primer-hard-stops` | `faf7ddf8dc56e2b30306cf163ac06601a79b4c6f` | DIVERGED | 20 | 19 | 0 |
| `g5-avatar-worktree-500` | `refs/remotes/old-laptop/g5-avatar-worktree-500` | `049ae2811055482b6fc6312acf19425d14c9c56c` | DIVERGED | 31 | 19 | 0 |
| `g8-auth-guardrails-501` | `refs/remotes/old-laptop/g8-auth-guardrails-501` | `4e117dce0d5514eeb31194fbff682ae90290bc98` | DIVERGED | 13 | 19 | 0 |
| `k9-memberships-wp-setup-303` | `refs/remotes/old-laptop/k9-memberships-wp-setup-303` | `16c045c0351609ef4a151601d3b0835a48be376d` | DIVERGED | 33 | 19 | 0 |
| `main` | `refs/remotes/old-laptop/main` | `7409a82f056b58335e996dda7e101c310c982f1f` | DIVERGED | 8 | 19 | 0 |
| `main-sync-temp` | `refs/remotes/old-laptop/main-sync-temp` | `8eabc5840435ad62d33a67d1b9a1d8152575478e` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 19 | 0 |
| `md-daily-drills-nonwiring-megarun-007` | `refs/remotes/old-laptop/md-daily-drills-nonwiring-megarun-007` | `5c19f4a6a90fcb1a92f75c674f4c908aa8b4a01c` | DIVERGED | 2 | 25 | 0 |
| `md-daily-drills-return-handoff-005` | `refs/remotes/old-laptop/md-daily-drills-return-handoff-005` | `753d4c22c2b3800e5dc73b6bdffaa2b6311683ea` | DIVERGED | 1 | 25 | 0 |
| `md-daily-drills-single-html-t16-011` | `refs/remotes/old-laptop/md-daily-drills-single-html-t16-011` | `dcc73b5b14a725224db8bbdfcbf4851cba873abc` | DIVERGED | 5 | 25 | 0 |
| `md-daily-drills-sot-recon-004` | `refs/remotes/old-laptop/md-daily-drills-sot-recon-004` | `753d4c22c2b3800e5dc73b6bdffaa2b6311683ea` | DIVERGED | 1 | 25 | 0 |
| `md-daily-drills-v3-side-by-side-014` | `refs/remotes/old-laptop/md-daily-drills-v3-side-by-side-014` | `1225074a894f993dbabeba2d20c57c26432b4060` | DIVERGED | 16 | 25 | 0 |
| `md-merger-daily-drills-lab-914` | `refs/remotes/old-laptop/md-merger-daily-drills-lab-914` | `16c045c0351609ef4a151601d3b0835a48be376d` | DIVERGED | 33 | 19 | 0 |
| `merge/mm-dualmac-scripts-001` | `refs/remotes/old-laptop/merge/mm-dualmac-scripts-001` | `5cc9144bfc770e5eda78124cc1fa886640041767` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 28 | 0 |
| `missionmed-matrix-phases-1-4` | `refs/remotes/old-laptop/missionmed-matrix-phases-1-4` | `50ade02f02ded4b4fd832274f964c50f2d718c2f` | DIVERGED | 44 | 19 | 0 |
| `mm-matrix-062-calendar-app-mode` | `refs/remotes/old-laptop/mm-matrix-062-calendar-app-mode` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `mm-matrix-062-calendar-app-mode-source-locked` | `refs/remotes/old-laptop/mm-matrix-062-calendar-app-mode-source-locked` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
| `mm-sched-012-schema-api-foundation` | `refs/remotes/old-laptop/mm-sched-012-schema-api-foundation` | `a966e882691905370df4a497524b3cbd65ef9ca4` | DIVERGED | 42 | 19 | 0 |
| `mm-sched-047-live-integrations` | `refs/remotes/old-laptop/mm-sched-047-live-integrations` | `a966e882691905370df4a497524b3cbd65ef9ca4` | DIVERGED | 42 | 19 | 0 |
| `mm-sched-055a-zoom-drj-examprep` | `refs/remotes/old-laptop/mm-sched-055a-zoom-drj-examprep` | `a966e882691905370df4a497524b3cbd65ef9ca4` | DIVERGED | 42 | 19 | 0 |
| `mm-sched-sev1-014-enrollment-gate-release` | `refs/remotes/old-laptop/mm-sched-sev1-014-enrollment-gate-release` | `40b59ef878577878c69498ab98c5511ccf7c7935` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 32 | 0 |
| `mm-sched-webex-055-dr-brian-webex-booking` | `refs/remotes/old-laptop/mm-sched-webex-055-dr-brian-webex-booking` | `8007161534cb96e83b373948d7c1a46c21286b00` | DIVERGED | 35 | 25 | 0 |
| `mmc/canonical-discovery-002` | `refs/remotes/old-laptop/mmc/canonical-discovery-002` | `7b55f04ab6f0fca232efa5a0c2c90b822e187204` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 34 | 0 |
| `mob9-mobile-game-modes-lab-400` | `refs/remotes/old-laptop/mob9-mobile-game-modes-lab-400` | `16c045c0351609ef4a151601d3b0835a48be376d` | DIVERGED | 33 | 19 | 0 |
| `mr/cache-coherence-repair-001` | `refs/remotes/old-laptop/mr/cache-coherence-repair-001` | `7409a82f056b58335e996dda7e101c310c982f1f` | DIVERGED | 8 | 19 | 0 |
| `mr/live-source-of-truth-reconcile-004` | `refs/remotes/old-laptop/mr/live-source-of-truth-reconcile-004` | `0a82af65d580fa291f2e4080f47ff026305b91d1` | DIVERGED | 45 | 19 | 0 |
| `payments/multi-stripe-routing-audit` | `refs/remotes/old-laptop/payments/multi-stripe-routing-audit` | `c25c0e75639fd40eaa101b26d675c87ad4f1bc87` | DIVERGED | 39 | 19 | 0 |
| `pre-clean-history` | `refs/remotes/old-laptop/pre-clean-history` | `d12068890ae51b658ecac71f119860b3879d1e45` | UNRELATED | 8 | 0 | 0 |
| `qbank-003-step2ck-dual-ui-demo` | `refs/remotes/old-laptop/qbank-003-step2ck-dual-ui-demo` | `7409a82f056b58335e996dda7e101c310c982f1f` | DIVERGED | 8 | 19 | 0 |
| `rescue/A8-001-l-20260428_111147` | `refs/remotes/old-laptop/rescue/A8-001-l-20260428_111147` | `d4b882ab09442389cbf6a4837923302855b2bb29` | DIVERGED | 3 | 17 | 0 |
| `rescue/C8-hq-proxy-dirty-after-align-20260428_0610` | `refs/remotes/old-laptop/rescue/C8-hq-proxy-dirty-after-align-20260428_0610` | `abbdc9a587f8c779c6281da6b7d4894798f13563` | DIVERGED | 1 | 16 | 0 |
| `rescue/C8-main-dirty-before-align-20260428_045040` | `refs/remotes/old-laptop/rescue/C8-main-dirty-before-align-20260428_045040` | `b9e837d4ad67b06b49463ebcaf07133e1af878c4` | DIVERGED | 2 | 12 | 0 |
| `rescue/C8-pre-200e-dirty-main-20260428_0719` | `refs/remotes/old-laptop/rescue/C8-pre-200e-dirty-main-20260428_0719` | `008362cd68fb440cf0b9616105d122cab05aba91` | DIVERGED | 1 | 17 | 0 |
| `rescue/C8-pre-200e-untracked-demos-20260428_0724` | `refs/remotes/old-laptop/rescue/C8-pre-200e-untracked-demos-20260428_0724` | `beaff41d5b7c5dc4381e6ac1b272cd9fcd3f2bda` | DIVERGED | 1 | 17 | 0 |
| `rescue/G8-dirty-main-before-simple-workflow-20260429_195701` | `refs/remotes/old-laptop/rescue/G8-dirty-main-before-simple-workflow-20260429_195701` | `dd3bb93ab827ed683ec4228029ecdc8ae341e8dc` | DIVERGED | 4 | 17 | 0 |
| `s9-stat-advanced-300` | `refs/remotes/old-laptop/s9-stat-advanced-300` | `16c045c0351609ef4a151601d3b0835a48be376d` | DIVERGED | 33 | 19 | 0 |
| `s9/stat-v3-legacy-runtime-repair-309a` | `refs/remotes/old-laptop/s9/stat-v3-legacy-runtime-repair-309a` | `791da3e78fcf1caee50c2ad499694c9c3159a4b0` | DIVERGED | 39 | 19 | 0 |
| `stat-async-500b-deploy` | `refs/remotes/old-laptop/stat-async-500b-deploy` | `7ad1d5e236586daf05130fd57b49613a72f2a489` | DIVERGED | 3 | 14 | 0 |
| `t9-tournamed-match-madness-lab-101` | `refs/remotes/old-laptop/t9-tournamed-match-madness-lab-101` | `a966e882691905370df4a497524b3cbd65ef9ca4` | DIVERGED | 42 | 19 | 0 |
| `t9-tournamed-match-madness-worktree-201` | `refs/remotes/old-laptop/t9-tournamed-match-madness-worktree-201` | `16c045c0351609ef4a151601d3b0835a48be376d` | DIVERGED | 33 | 19 | 0 |
| `work/A8-001-l-arena-auth-final-repair` | `refs/remotes/old-laptop/work/A8-001-l-arena-auth-final-repair` | `bd3a09ee172c93cbccffbcfdd057ff96a21695a9` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 17 | 0 |
| `work/G8-dirty-triage-protocol` | `refs/remotes/old-laptop/work/G8-dirty-triage-protocol` | `87645229a2a3c0afa89b223defacf005296c079c` | DIVERGED | 6 | 19 | 0 |
| `work/G8-git-hygiene-guardrails` | `refs/remotes/old-laptop/work/G8-git-hygiene-guardrails` | `0ffc37194cd44a52ab0a95a3e26196c15d4accdc` | DIVERGED | 1 | 17 | 0 |
| `work/G8-primer-logging-final` | `refs/remotes/old-laptop/work/G8-primer-logging-final` | `87427a562f0eb163af76308ce5e716e0fd514152` | DIVERGED | 2 | 17 | 0 |
| `work/G8-simple-git-workflow-final` | `refs/remotes/old-laptop/work/G8-simple-git-workflow-final` | `8a75298e7cf98301c9d22d0f5e266483898e4888` | DIVERGED | 3 | 17 | 0 |
| `worktree/d8-445-wp-student-ux-cleanup-20260528-122632` | `refs/remotes/old-laptop/worktree/d8-445-wp-student-ux-cleanup-20260528-122632` | `38ad5fb1798e9eae40b4fedc844c4b1c1231be81` | AIR_ANCESTOR_OF_ORIGIN_MAIN | 0 | 25 | 0 |
