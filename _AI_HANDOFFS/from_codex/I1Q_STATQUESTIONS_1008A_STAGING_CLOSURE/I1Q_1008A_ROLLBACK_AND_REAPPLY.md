# I1Q-1008A Rollback And Reapply

## Mechanism

The rollback is a forward compensation. It never drops schema objects or deletes history. It:

1. requires the base identity migration and both separated roles
2. revokes `i1q_identity_profile_reader` from `authenticated`
3. invokes the existing data-preserving disable function
4. records one compensation and one schema version
5. leaves `i1q_app_runtime` deny all

The reapply requires compensation history, safe role attributes, the identity RPC, and every feature flag off. It restores only identity-profile capability membership and records one idempotent audit event.

## Local Execution Result

`PASS`: on a clean disposable PostgreSQL instance, base and 1008A migrations applied twice, compensation ran twice, and reapply ran twice. History remained present, compensation and reapply audit records were idempotent, no feature flag turned on, and browser reachability never extended to `i1q_app_runtime`.

## External Status

`NOT RUN`: no authorized preview baseline, provider backup, remote compensation, exact prior-state checksum, restore, or remote reapply exists. Local execution does not satisfy the ticket's real preview rollback gate.
