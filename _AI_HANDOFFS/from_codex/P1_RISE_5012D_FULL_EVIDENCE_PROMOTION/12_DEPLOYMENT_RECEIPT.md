# Deployment Receipt

## Final live release

- Railway project: `c0113625-951e-46ab-939b-dd57acc0e87c`
- Environment: `549d6597-1962-44cb-b0f5-7d88bd025e31` (production)
- Service: `9bce2090-ce45-4572-8291-e8da5d42acb6` (MissionMed RISE)
- Deployment: `b9955188-a221-4ea0-b785-6bc560b29a15`
- Status: `SUCCESS`
- Image digest: `sha256:c84aaa7b620f809868b250ea8da786e55eacc62622563a46a919c966a78eece1`
- Build ID: `rise_web_b8abd476daab`
- Asset manifest SHA-256: `d2197e8a1479c4c8445683ac7aace736da61dfa874dccf2b2da4e268c57ec3fa`
- Source commit: `64ccad6411c4d307887904646828f06cf6d44a7e`
- Live health: HTTP 200; `ok=true`; active registry `rise_registry_2026-07-09_8fdb5afb84f6`; `environment=production`.

Migration 010 was applied additively to the production Railway Postgres database. A pre-migration logical dump was verified with `pg_restore --list` before mutation and recorded at SHA-256 `a427f45b287fbfb4e6acc091cbbbe6fdc93e3969097895909630178aea403bf3`. Its temporary `/tmp` copy was later cleaned and is not represented as a durable recovery artifact; the normal rollback path is the exact prior Railway image plus the non-destructive migration-down contract.

Failed/removed intermediate canaries never became the accepted release. Two candidates failed closed on stale asset/build pins; later candidates exposed and bounded the filter query cost. The final deployment is the only current `SUCCESS` release.

Provider-native SQL confirms the complete disposition matrix, 0 unreviewed claims, 2,820 lineage rows, forced-RLS denial to non-admin runtime, and both Neurology-family holdouts untouched. Git remote readback is exact: branch `codex/p1-rise-5007-private-beta-full-registry-student-intel`, ahead 0 / behind 0 before evidence filing.
