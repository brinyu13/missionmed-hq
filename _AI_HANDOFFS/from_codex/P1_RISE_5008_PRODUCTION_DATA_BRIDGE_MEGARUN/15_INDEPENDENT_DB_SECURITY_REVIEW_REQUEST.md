# Independent Database/Security Review Request

Required DR-146 gate: independent review of new migration 007 before production application.

Review commit `db19fc4cb744137d5b0ba6499485f20979489c6d` and specifically:

- `rise/sql/007_canonical_evidence_bridge.sql`
- `rise/sql/007_canonical_evidence_bridge.down.sql`
- `rise/adapters/postgres-runtime.mjs`
- `rise/adapters/research-factory-ingest.mjs`
- `rise/tools/backfill-research-factory.mjs`
- `rise/tools/import-soap-2026.mjs`
- `rise/tests/postgres-runtime.test.mjs`
- `rise/tests/sql-contract.test.mjs`
- this handoff's `09_SECURITY_VALIDATION.md` and `13_ROLLBACK.md`

Required verdict: `APPROVE` or `REJECT`, reviewer identity, reviewed commit, migration hashes, conditions, and explicit database/security findings. The builder may not self-approve this gate.

