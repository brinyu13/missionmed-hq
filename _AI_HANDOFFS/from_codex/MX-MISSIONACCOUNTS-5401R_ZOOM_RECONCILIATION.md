# MX-MISSIONACCOUNTS-5401R

Recorded 2026-09-07; final HTTP/provider readback 2026-09-07T04:47:30.118310+00:00. All times UTC unless stated otherwise.
**Engineering repair deployed; task remains PARTIAL / NOT READY for reopening or 5402A.** FAIL below means the requested acceptance criterion is unmet, including an unperformed witness; it does not necessarily mean the repaired code failed a test. This is not Founder acceptance.

## Applied repair

**REPAIRED:** canonical June/July/August counts are 34/35/31. Raw Zoom evidence and Dr J historical truth were preserved. Five unmatched occurrences remain held for review; no human identities were fabricated.

The two API classes on June 8 (Step 1 start 16:16:34 UTC; Step 2/3 start 18:03:16 UTC) corroborated two existing historical classes. Source-preserving mappings now prevent their duplicate canonical status. Seventy-two of 77 raw participant observations exactly match the normalized name/join/leave/class-start/Step historical evidence. The five remaining observations are unresolved corroborations attached to the source crosswalk. Seventy-six sole-purpose technical student projections and associated active review days are retired; their physical records and the 77 physical events remain available for audit.

| Control | Before repair | Final readback |
|---|---:|---:|
| Historical confirmed canonical June / July / August | 36 / 35 / 31 | 34 / 35 / 31 |
| Physical student records | 347 | 347 |
| Visible student identity projections | 347 | 271 |
| Physical session records | 421 | 421 |
| Physical attendance events | 4018 | 4018 |
| Effective attendance events | 4018 | 3941 |
| Raw source rows | 5575 | 5575 |
| Active attendance days | 3340 | 3264 |
| Active technical retirements | 0 | 76 |
| Exact / unresolved corroborations for repaired pair | 0 / 0 | 72 / 5 |
| Invoices / charges / consents / billing decisions | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |

Receipt: `44f24da2-b69e-4a20-af39-ec9d87a393d0`; request `mx-missionaccounts-5401r-june8-repair-20260907`; audit actor `codex:mx-missionaccounts-5401r`; applied approximately 04:11:47 UTC. The private preimage is stored in a forced-RLS service-only immutable receipt, not exported into this report.

Before-state SHA `9cc1d863951c7c203b89394a90499e0b562668a27b728585a9e0378374bd2d00`.

The repair, immediate replay and final readback preserved:

- Raw source SHA `ffbaed5efb7136a60c18c9e711ed82031750cad527b770eda01eca4bc3be18a0`.
- Historical SHA `5549bc9983bc4d6a21aa489fd855709382860cbaf512bcf9f4848bd7ccc4deb6`.
- Financial SHA `863d902001a4e227b0894489fa2c2ace4ae59006d7c07da7957cf621d6d9bc0a`.

These are bounded observed hashes, not a claim that legitimate future imports can never change global artifact hashes. Final receipt operation digest equality also passed.

## Forward reconciliation behavior

Canonicalization runs before identity creation. Historical/API matching requires exact class start and Step, custodied historical provenance, at least 16 distinct valid participant intervals, equal occurrence sets and at least 90 percent normalized-name corroboration. Ambiguous same-time candidates, shifted times, and uncertain API-to-API matches stay in review. Distinct same-Step classes at different starts and same-day Step 1 / Step 2/3 classes are preserved. The existing provider ingestion allowlist still controls approved Drills source scope.

Same-provider-ID, same-name nonoverlapping reconnects can extend the existing attendance duration without creating another event/person; ambiguous identity, changed name or overlapping observations are held. Later observations do not auto-create duplicate historical attendance or financial effects. Review classification is conservative and sticky: there is not yet a general audited class-reassessment workflow for every future late/partial ambiguous import. Such cases require a separately reviewed source-preserving operation; this report does not claim fully automatic resolution of future ambiguity.

Reconciliation locks imports/classes before sessions, and uses the weaker session lock needed to avoid foreign-key deadlock. Technical retirement locks dependent domain rows; concurrent new domain references wait and then reject retired students. Replays use a strict sorted payload fingerprint for new requests, with legacy compatibility where required.

The bounded repair checks exactly two source classes, the 42/35 partition, 77 one-to-one raw/event bindings, 76 sole-purpose student/alias/day relationships, one allowed import, no unrelated class rows, no prior canonicalization/retirement effects and no independent financial/domain ownership. It supersedes active review days before retirement. Unexpected scope or concurrent operation changes refuse the transaction.

## Migrations and production custody

| Source migration | SHA-256 | Provider history version |
|---|---|---|
| 20260907025337_workflow_request_integrity_5401.sql | 9dc8546101d5203884cd654b04557e62674c6dac2e5e98dccd6c378da98038e9 | 20260907041036 |
| 20260907025905_bounded_billing_reversal_batch_5401.sql | 43c9fc377c867ef3c459bd4e93639dec7a5dbcb31c59fa9da892fca7ec2a3e07 | 20260907041038 |
| 20260907025943_zoom_canonical_occurrence_5401.sql | 84b83bc940154faa6014d3b724bf8fbb303eace83185f258e7449ae937ed3a89 | 20260907041042 |
| 20260907034102_bounded_zoom_repair_5401.sql | 1a0876fae43e46c6fc7fc01e3693be62a3174a9cbe4a66863ab963c021ec8fcf | 20260907041045 |

Provider history uses provider-assigned apply timestamps with the full source basename as the migration name. Previously applied migrations were not edited or removed.

The worker was paused and read back before migrations/repair, then resumed only after repaired backend deployment and production replay verification. Current dedicated worker deployment `ebbf2d4b-612c-4e21-90ad-cb7934af34bd` is SUCCESS, image `sha256:be57502e4471184b367f9c715cb67fa37e4cb51a5733fa422d1dae67b65a8de4` unchanged. Schedule is `30 6 * * *`; next observed run 2026-09-07 06:30 UTC. Actual completion of that next scheduled job is not yet witnessed. The app's schedule display now uses this verified provider schedule metadata.

## Replay and regression

Production historical import replay request `mx-missionaccounts-5401r-postrepair-replay-20260907` returned duplicate true, two duplicate source sessions and zero new mappings, corroborations, identities, historical recomputations or billing mutations. Raw, historical, financial and bounded operation digest equality passed afterwards and in the final readback.

Disposable PostgreSQL tests cover historical/API exact duplicates, restart/reimport, changed provider IDs/payload conflict, distinct same-day Steps, distinct same-Step classes, safe reconnect duration, ambiguous holds, all bounded preimage guards, repair/replay/reverse/retry and intervening-state refusal. Two actual concurrent PostgreSQL connections prove reimport does not deadlock and domain insertion waits then rejects a retired student. A distinct read-only reviewer inspected the final migration sources; this is code review, not independent Founder acceptance.

Evidence: [database-repair.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/database-repair.json), [final-provider-readback.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/final-provider-readback.json), [worker-pause.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/worker-pause.json), [worker-resume.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/worker-resume.json), [local-validation.json](/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/local-validation.json).

## Rollback custody and sequence

Keep the current unconditional 503 guard. Never restore the pre-containment unsafe gateway. Revalidate BOOT, exact live targets, and a narrow Lease V2 fence before any rollback; commands below are a runbook, not permission to skip those checks.

1. If any private cross-user response appears, preserve or immediately restore the dedicated route's unconditional containment, then verify generic repeated GET/HEAD responses. The current route already implements it.
2. Pause only Railway worker `ed6498e3-81dd-479a-a659-28b1783e1a75`, project `244bf2d1-1eca-4b97-95ab-95a565a8b4d0`, environment `db6dae0e-cc37-4eff-9bed-3d5fe7cc8f9f`: scoped deployment removal plus `serviceInstanceUpdate` setting `cronSchedule:null`. Both were executed and read back during this repair. Verify no active deployment, no schedule, and no next run. Do not delete the service or variables.
3. Disable only the six core capability variables to their preimage false/0 and redeploy the repaired image. Runtime enforcement is Railway environmentConfig. Restore the six separate DB feature_flag audit records from the `capabilities.enabled` audit event's `from_val` through an audited transaction; changing that table alone does not disable runtime features. Keep auto billing false and Live disabled.
4. App pre-5401R deployment `7baf5aa4-e51a-4d0c-8896-f3611731185c`, image `sha256:f5a2a891d4278936f0b42c3a914bd351acf94997393c841ab6159adfe88a103f`, is recorded. Prefer disabling the bounded feature on repaired source where possible. A historical-image redeploy must first verify provider retention/identity, schema compatibility and contained/paused posture; do not deploy its older public route or enable flags. A full app rollback was not executed.
5. Dedicated WP preimages, mode 0600, are `/www/theresidencyacademy_209/private/MX-MISSIONACCOUNTS-5401R-48e4283-route-preimage.php` (SHA `ac5053d7ce7e86b5417a8fa67a380f1c365da97832d0908bb33b319688ba1eee`) and `.../MX-MISSIONACCOUNTS-5401R-48e4283-sso-preimage.php` (SHA `e2e6e5a0caba6099cd5b1e17e1adcaed8817ea63ff757605a9969cfdef89d22a`). Verify exact source/target, PHP lint and post-copy SHA before use. The route preimage is the contained version. Do not overwrite shared Matrix files.
6. Data receipt `44f24da2-b69e-4a20-af39-ec9d87a393d0` holds the private preimage and immutable operation digests in the production DB. `missionaccounts.api_reverse_zoom_5401(p_repair_id uuid,p_reversal_request_id text,p_actor_id text,p_posture_sha256 text)` requires a new auditable request and SHA of independently verified closed/paused posture. The caller must obtain that posture evidence; the DB cannot observe Kinsta or Railway. The function refuses intervening operation changes, preserves raw/historical/financial truth, and appends compensating mapping/corroboration versions before restoring isolated review projections. It restores the known defective 36/35/31 view, so use only while public access is closed and Zoom is paused. Production reversal was intentionally not executed; apply/replay/conflict/reverse/retry were tested in disposable PostgreSQL.
7. Do not drop applied migrations or broad-restore the whole database for this repair. Any new defect requires a reviewed forward migration. A provider scheduled physical backup at 2026-09-06 17:35:10 UTC was verified in the authenticated Supabase dashboard before apply; Restore was not clicked. The repair's transactional private preimage covers the more recent bounded state.

No rollback requires exposing credentials, tokens, cookies or private student records. Do not run the old temporary mutation scripts blindly: they include exact-state preconditions and one-time operations.

Sanitized evidence commit: `f3f3d0c1dfc2880891cc4d0a7a1be15c481830dc`. Final filing review corrected the 498 human-cycle-row label and redacted two student UUIDs from denied-request paths before remote push.
