# Remaining known issues

1. No independent real 360 test identity was available for this run. Admin/Founder authenticated QA passed; anonymous HTTP controls fail closed. Do not relabel this as independent 360 acceptance.
2. The runtime package excluded source CSVs because of a pre-existing unrelated `.railwayignore`; the approved data was imported through a bounded provider PostgreSQL tunnel. Startup does not auto-reimport it.
3. Some upstream leadership/faculty role duplication remains in evidence; the UI now deterministically deduplicates names.
4. Program-reported and roster-derived composition may differ and are intentionally displayed as distinct, labeled facts. Unknown roster coverage is never converted to zero.
5. PATH hierarchy lease epoch 2379 expired before a normal release RPC; provider readback showed expired=true, active=false and active lease count zero. Other completed leases were normally released.
6. Supabase security advisors report RLS disabled on MissionMed OS coordination tables. Enabling it without a compatibility plan is outside 5012K authority.
7. During an earlier diagnostic command, credential values from a local environment file were exposed in terminal/tool output. They were not written to repository files and are not reproduced here. The affected WordPress application credential and Stripe live/webhook credentials require urgent rotation by an authorized operator.
8. Live screenshots were emitted inline but could not be exported as local files from the agent-controlled browser tab.
9. The current Founder Matrix profile is incomplete for medical school, Step 2 CK and COMLEX Level 2, so those profile-specific one-click controls correctly remain disabled in live QA. Complete-profile fixtures pass; no Founder profile data was invented.
10. Final Railway logs retain a pre-existing source-rights seed warning while file-level verification and health report `sourceRightsCurrent=true`, plus a `pg` client deprecation warning. Neither produced a request-time application error; schema/runtime cleanup is outside this UI acceptance ticket.
11. Final release attempts exposed two stale environment pins (manifest SHA, then build ID). Both failed closed and were corrected before the successful active deployment; the pinned preflight should be automated in a future operations-hardening ticket.
