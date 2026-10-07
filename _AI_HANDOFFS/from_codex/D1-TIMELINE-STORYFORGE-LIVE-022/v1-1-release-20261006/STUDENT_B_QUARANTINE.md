# Student-B quarantine — completed 2026-10-07 00:32:51 UTC

Founder-authorized bounded cleanup of one contaminated Timeline document (WordPress user 141,
document `timeline_6490fc8e-f3ac-4257-8585-bed603239ff0`). Executed over the established isolated
Railway PostgreSQL path (`railway ssh` → `psql`, Timeline schema only) under fresh canonical
fencing (PRODUCT:TIMELINE epoch 5206, evidence path 5207; owner
claude-timeline-studentb-quarantine-20261006; released and confirmed afterwards).

| Step | Result |
|---|---|
| Re-read before mutation | id matched; owner principal `1084171a-…` = wp_user_id 141 (STUDENT, ACTIVE); status DRAFT; revision 113; updated_at 2026-10-06 14:51:19 UTC (unchanged since the prior inspection: the CV import time); placeholder name and 9 events present; intake receipt names the applicant's CV; 113 immutable versions (incl. "Before CV import · Oct 6"), 0 checkpoints; the owner had exactly one document |
| Pre-image | Full row (document_json) plus the version index saved privately (`PREIMAGE_timeline_6490fc8e.json`, 401 746 bytes, sha256 recorded in the audit metadata); versions table untouched |
| Mutation | One transaction with row lock and preconditions (owner, DRAFT, not deleted, revision 113, updated_at, name, event count; any drift → abort): `status='ARCHIVED', deleted_at=now(), updated_at=now()` on that id only; `UPDATE` row count asserted = 1 |
| Audit event | `timeline.audit_events` row `audit_8deea92a…`: action `document:quarantine`, resource_type document, outcome SUCCESS, request_id lease-epoch-5206, metadata reason "Founder-authorized quarantine of contaminated test artifact; preserve recovery evidence." + prior status/revision/updated_at, pre-image sha256, owner wp_user_id |
| Post-mutation readback | status ARCHIVED, deleted_at set; other documents touched in the last 5 min: 0; owner active documents: 0; versions retained: 113 |
| Admin roster (production, Founder session) | Student B: Timeline "Never started", CV "Not imported", 0 events, Open Timeline disabled "No Timeline yet"; roster still 20 (19 real · 1 QA); the applicant's own row unchanged |

Semantics: the student listing (`listDocumentsForOwner`) excludes rows with `deleted_at`, so the
archived document is no longer the student's current Timeline; their next load creates a fresh
empty document; History and version routes are reachable only by document id, which the student
client no longer receives. Recovery stays available to administrators through the retained row,
its 113 versions and the private pre-image.
