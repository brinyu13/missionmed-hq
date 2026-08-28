# C3 — Migration 005 Rollback

Result: **PASS**

`rise/sql/005_rights_safe_runtime.down.sql` is the controlled rollback paired with `005_rights_safe_runtime.sql`.

## Safety laws

The down script:

- requires `SET rise.rollback_005_empty_confirmed = 'YES'`;
- refuses any database not named `rise_rollback_005_*`;
- refuses rollback if any of the five migration-owned tables contains a row;
- drops only the migration-owned policy, tables, and `rise_runtime` schema;
- does not use `CASCADE`;
- does not drop the database;
- deliberately preserves the cluster-level NOLOGIN role `rise_app_runtime` because it can be shared by other databases.

Production data is never a valid target for this down script. Production recovery is forward-compatible service rollback plus the locked provider backup; the down script is only for an isolated, explicitly empty rehearsal database.

## Actual Postgres rehearsal

Migration up, schema verification, empty down, nonempty refusal, row-preservation verification, cleanup, repeat up/down, and cluster-role preservation were executed against an isolated database on the RISE Railway Postgres cluster:

```json
{"ok":true,"database":"rise_rollback_005_20260828a","firstUp":"5:true","firstDown":"t","nonEmptyRollbackRefused":true,"studentRowsPreservedAfterRefusal":true,"secondDown":"t","clusterRuntimeRolePreservedNoLogin":true}
```

Final readback found zero remaining `rise_rollback_005_*` rehearsal databases. The SQL contract suite also asserts the confirmation flag, database-name boundary, no-CASCADE law, nonempty-row checks, and role-preservation rule.

C3_MIGRATION_ROLLBACK_PASS = YES
