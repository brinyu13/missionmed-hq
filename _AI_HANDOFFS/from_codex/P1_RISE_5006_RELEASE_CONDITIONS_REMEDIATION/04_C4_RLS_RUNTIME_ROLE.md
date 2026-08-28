# C4 — Enforced RLS Runtime Role

Result: **PASS**

The production application no longer connects as `postgres`. `RISE_DATABASE_URL` uses the dedicated LOGIN role `rise_app_login`. That role is nonsuperuser, has no `BYPASSRLS`, and is a member of the NOLOGIN privilege/policy role `rise_app_runtime`.

`rise_app_runtime` owns only the minimum grants required by the runtime. The protected student-state tables have RLS enabled and forced. The Postgres adapter continues to include `subject_key` predicates as defense in depth.

## Actual production-role verification

The verifier was re-run on 2026-08-28 through a temporary private Railway tunnel using the exact production runtime URL. The tunnel was closed immediately after the transaction:

```json
{"ok":true,"currentUser":"rise_app_login","sessionUser":"rise_app_login","checks":{"loginIsLeastPrivilege":true,"runtimeMembership":true,"rlsEnabledAndForced":true,"publicAccessDenied":true,"ownReadAllowed":true,"crossReadDenied":true,"crossUpdateDenied":true,"crossDeleteDenied":true,"mismatchedInsertDenied":true,"syntheticRowsRolledBack":true}}
```

The test creates two synthetic subjects inside one transaction, proves own-row access, proves cross-subject read/update/delete denial, proves mismatched insert denial, and rolls the transaction back. No synthetic row remains.

The 116-test suite also proves durable My Programs operations remain subject-keyed, CSRF-protected, and compatible with the runtime adapter.

C4_RLS_RUNTIME_ROLE_PASS = YES
