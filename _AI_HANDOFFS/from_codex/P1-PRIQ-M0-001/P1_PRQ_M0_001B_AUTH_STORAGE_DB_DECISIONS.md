# P1-PRIQ-M0-001B auth, storage, and database decisions

## Current truth

- Authentication: local loopback development principal only; provisional and not production-safe.
- Database: in-memory repository/flags/audit for local testing; provisional. One unapplied SQL proposal exists under `infra/priq/migrations`.
- Storage: no PRIQ object store or signed-media target is authorized; intake validates metadata only and stores no bytes.

## Founder decisions required

1. Canonical PRIQ database project and owner.
2. Matrix/OIDC session exchange and authoritative role/tenant claims.
3. Private-object storage project, bucket layout, signing service, malware quarantine, retention/deletion jobs, and backup owner.
4. Approved provider/data-class posture, including restricted-data no-training/ZDR evidence.
5. Migration runner, independent verifier, recovery point objective, and rollback authority.

## Gate

No production/staging auth, database, or storage connection is authorized by P1-PRIQ-M0-001B.
