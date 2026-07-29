# Deployment and release gates

All release flags default off. Passing this local package does not authorize staging or production.

## Before staging

- Resolve and hash authoritative Matrix Runtime v2 source.
- Review the Matrix patch as a narrow feature-flagged change and run its full regression suite.
- Implement and test the PostgreSQL repository/transaction adapter.
- Apply migration to a disposable database, exercise each RLS role, run rollback, and restore from backup.
- Connect a private staging object store with signed upload/download, checksum confirmation, malware scan, and lifecycle policy.
- Connect a staging Mac Pro worker and prove canonical asset/font hash checks and deterministic output.
- Ratify and integrate the legacy FileVault endpoint contract; keep v2 off.
- Complete privacy, security, accessibility, medical-education, and operational review.

## Before production pilot

- Complete a student/advisor pilot with explicit consent and support plan.
- Meet Matrix and D1 regression, accessibility, responsive, and performance budgets.
- Exercise route disable, API rollback, queue pause/replay, database restore, and FileVault reconciliation.
- Verify telemetry dashboards and alerts contain no document content.
- Obtain Brian release approval.

## Production promotion

Production requires a separate explicitly authorized prompt. This package performs no deployment, database migration, stage, commit, or production write.
