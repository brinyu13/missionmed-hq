# Security, Quota, and Rollback

Final provider-native database readback:

- Router revision: 4
- Global enabled: false
- Student enabled: false
- Emergency kill: true
- Canary mode: `PROGRAM_ID_ALLOWLIST`
- Canary count: 2
- Default quota: 1 per 30 days
- Concurrency: 1
- Global budget / actual spend: `$0.0000 / $0.0000`
- `PARALLEL`: PAUSED, disabled, network off, spend off
- `CLAUDE_OPUS`: PAUSED, disabled, network off, spend off
- `RISE_REPLAY_TEST`: TEST_ONLY, enabled, network off, spend off
- Research tables: 6; RLS enabled: 6; forced: 6
- Public-like table grants: 0
- Jobs: 1; Holdout A: 1; Holdout B: 0; total spend: `$0.0000`
- Quota: limit 1, reserved 0, consumed 1, refunded 0

Focused tests: 18 passed, including allowlist isolation, admin non-bypass, dedupe stability, zero-spend constraints, worker success, provider-neutral adapter selection, canonical ingest custody, and worker failure/refund behavior. Migration 008 and its down path passed an isolated rehearsal before production apply. A name-filtered legacy server test invocation hit its pre-existing teardown defect (`ERR_SERVER_NOT_RUNNING`); this did not affect the focused suite or live service.

Rollback sequence:

1. Keep global and student controls disabled and emergency kill active (current state).
2. Stop the dedicated worker service if needed.
3. Redeploy prior known-good app deployment `69049d35-9af9-451d-ada2-e9f864b8051f`.
4. Revert commit `4532feb5b1e1e698944f58f40a436d9de97ecc19` with a normal revert if source rollback is required.
5. Leave additive migration 008 dormant; do not drop production evidence or queue tables. The down migration is isolated-rehearsal-only.

Product PATH lease `e24a1a27-f18d-4d4f-942e-fc56a86cc326`, epoch 1715, was normally released. Provider readback: released=true, expired=true, active=false, active lease count=0.
