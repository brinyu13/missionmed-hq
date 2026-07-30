# B1-507 Backup and Restore Receipts

Status: FRESH RECOVERY POINTS NOT CREATED.

Read-only evidence:

- MyKinsta daily backup UI is available; latest observed automatic backup was 2026-07-29 18:24 local display time.
- Current Kinsta pointer is `releases/6f45dbbd2150ba11000236a4959f70434f6edb77`.
- Railway PostgreSQL volume is READY, one replica, PostgreSQL 18.
- Historical B1-503 backups and rollback receipts exist but are not accepted as fresh B1-507 recovery points.

Production writes were correctly withheld because the protected-system manifest is stale.

Before any production write, create:

1. a fresh MyKinsta manual backup;
2. a fresh private Kinsta pointer/route/plugin/settings receipt;
3. a fresh PostgreSQL 18 logical dump and SHA-256;
4. a fresh locked Railway provider backup;
5. an isolated disposable restore proving system ID/version, exact five-row ledger, 1 user, 0 assignments, and role/access expectations.

The resulting 16-field database backup receipt is a required input to `scripts/apply-production-migrations.sh preflight`.
