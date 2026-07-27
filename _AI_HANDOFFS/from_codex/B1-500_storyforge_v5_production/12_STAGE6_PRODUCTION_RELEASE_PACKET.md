# B1-500 Stage 6 — Production Release Packet

**Status:** `PREPARED / NO PRODUCTION ACTION AUTHORIZED`

## Required approvals

- founder staging UAT approval for the frozen candidate;
- explicit founder production go-live approval;
- retention/deletion/export/archive policy;
- admin support/private-story access policy;
- production URL/path;
- AI remains independently closed unless its own later gate passes;
- optional email remains post-GA unless separately approved;
- legacy migration approval only if Stage 0 follow-up identifies real data.

## Go/no-go checklist

- exact commit, built artifact hash, migration hash, manifest hash, and environment variable names recorded;
- current production source/origin/public hashes green;
- protected-source preflight green;
- database backup/PITR receipt and restore drill green;
- additive migration history clean and target ref exact;
- WordPress eligibility claim verified with eligible, ineligible, revoked, expired, and forged cases;
- assignment sync verified;
- private audio CORS, TTL, object prefix, MIME, size, lifecycle, and cross-user tests green;
- 29-assertion authorization matrix green against production-equivalent staging;
- full Chrome/browser, accessibility, mobile, scale, and canonical loop green;
- no high-severity dependency advisory;
- observability and on-call owner assigned;
- rollback owner and rollback target confirmed.

## Release sequence

1. Announce change window and freeze concurrent writers.
2. Verify live and create fresh rollback receipts.
3. Apply database change through the pinned canonical project.
4. Deploy API with StoryForge route default OFF.
5. Integrate/mount protected V5 source; verify new lock before upload.
6. Enable founder-approved internal accounts only.
7. Run anonymous, student, mentor, unassigned, and admin smoke probes.
8. Enable approved cohort.
9. Observe errors, auth denials, latency, notification integrity, and storage verification.
10. Expand only if the written thresholds remain green.

## Rollback

- Disable the StoryForge route/feature flag first.
- Restore the exact prior protected asset deployment and manifest lock.
- Roll Railway back to the release-time recorded deployment, not the older Stage 0 observation by assumption.
- Leave additive database tables intact during application rollback; destructive data removal requires the retention policy and a separate founder-approved plan.
- Stop new audio signing; retain objects under the approved policy.
- Restore database only from a verified release-time backup when data integrity—not application compatibility—requires it.
- Re-run live origin/public hashes and anonymous/authenticated smoke probes.

## Hard stop

No command in this run deployed, migrated, uploaded, purged, toggled, or rolled back production. The Stage 6 gate remains closed.
