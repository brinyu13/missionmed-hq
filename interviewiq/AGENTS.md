# InterviewIQ mandatory preservation gate

Read `docs/IIQ_PRODUCTION_DATA_PRESERVATION_INVARIANT.md`,
`docs/IIQ-1202_MIGRATION_SAFETY_CONTRACT.md`, and
`docs/IIQ-1202_PRODUCTION_DATA_MAP.md` before changing this product.
Resolve the current MissionMed OS BOOT chain and DR-370; preserve its exact leases
and independent-review requirements. This rule applies to new threads, Fable,
Codex, integrations, task packets, release scripts, and future maintainers.

Production InterviewIQ user/admin data is protected state. Application code, UI and schemas may evolve, but production data must be preserved across deployments, migrations, refactors, rollbacks, integrations, test runs and feature development. Destructive production-data operations require explicit Founder authorization plus verified backup and restore evidence.

Never run fixtures, resets, cleanup, or test migrations against production. Use
the guarded disposable PostgreSQL harness. Never rewrite an applied migration.
Never use a database snapshot rollback as an ordinary application rollback.
No future feature packet may omit the preservation invariant, current backup and
restore gate, existing-record compatibility tests, or release preservation checks.
IIQ-1200 feature work stays blocked until the independently verified IIQ-1202 gate.
