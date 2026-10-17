# Deployment and release gates

All release flags default off. Passing this package does not by itself authorize
staging or production. D1-500 production execution is separately governed by
MissionMed OS DR-016, DR-017, and DR-018; those records do not weaken any gate
below.

## Before staging

- Resolve and hash authoritative Matrix Runtime v2 source.
- Review the Matrix patch as a narrow feature-flagged change and run its full regression suite.
- Implement and test the PostgreSQL repository/transaction adapter.
- Apply migration to a disposable database, exercise each RLS role, run rollback, and restore from backup.
- Keep remote media/object operations fail closed unless a private staging object
  store has separately passed signed upload/download, checksum, malware-scan,
  and lifecycle-policy gates. Remote storage is disabled for D1-500.
- Preserve the accepted client-side export authority. Mac Pro worker integration
  is outside the D1-500 release scope.
- Keep FileVault v2 off. D1-500 supports the accepted local import workflow, not
  remote FileVault publication.
- Complete privacy, security, accessibility, medical-education, and operational review.

## Before production pilot

- Obtain Founder approval of the D1-500 remote-sync consent text/version and
  verify the student consent-record and withdrawal flows.
- Meet Matrix and D1 regression, accessibility, responsive, and performance budgets.
- Exercise route disable, API rollback, database restore, and access revocation.
  Queue replay and FileVault reconciliation are not applicable while those
  integrations remain disabled.
- Verify telemetry dashboards and alerts contain no document content.
- Obtain the release approval required by the governing Mission Record. D1-500
  carries the Founder's bounded production-launch authorization, while secret
  installation and any provider action reserved by DR-018 remain Founder-only.

## Production promotion

Production execution is authorized only within the D1-500 mission boundaries.
Database migration, release activation, secret installation, and provider writes
must be executed and evidenced under DR-016 through DR-018. Secret installation
remains Founder-only.
