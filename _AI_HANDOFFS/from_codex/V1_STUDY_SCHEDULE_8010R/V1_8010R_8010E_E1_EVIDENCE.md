# V1 Study Schedule 8010R — 8010E E1 Evidence

Updated: 2026-07-15 UTC  
Accepted validation commit: `e9c537abbe465289b3b6cd1037565d8cec08acf4`  
Accepted tree: `95ae6a8542dafa72e630acfef64fd523241fe20c`  
Result: E1 VERIFIED

## Exact CI evidence

All 21 jobs executed from the accepted exact tree and passed:

| Workflow | Run | Exact jobs | Result |
|---|---:|---|---|
| 8010E Week contract | `29416600642` | PHP 7.4 `87356194487`; MySQL 8/PHP 8.3 `87356194509`; MariaDB 10.11/PHP 8.3 `87356194513`; MySQL 8/PHP 7.4 `87356194521`; MariaDB 10.11/PHP 7.4 `87356194537`; PHP 8.3 `87356194598` | PASS |
| 8010C regression | `29416601387` | `87356196739`, `87356196770`, `87356196777`, `87356196804`, `87356196876` | PASS |
| Containment | `29416601224` | `87356196693`, `87356196708`, `87356196715`, `87356196716` | PASS |
| 8010D kernel | `29416601453` | `87356197451`, `87356197454`, `87356197514`, `87356197521`, `87356197545`, `87356197555` | PASS |

The two extended PHP 8.3 engine lanes executed the independent-process lock,
SIGKILL, revision-tear, and two-owner proofs. Both PHP 7.4 engine lanes executed
the complete migration/current-reader, caller-session, seven-table shadow,
oversized Plan, corruption, provenance, and bounded-cardinality suite. The pure
lanes linted and executed the source/domain contracts on PHP 7.4 and 8.3.

## Physical and adversarial coverage

- Clean generation-1 to generation-2 migration and exact idempotent rerun.
- Shared-lock exclusion in both generation directions and independent lock-
  owner observation.
- SIGKILL at 12 distinct durable gate, ledger, DDL, generation, and commit
  boundaries, followed by fresh-process reconciliation and idempotent rerun.
- Exception failpoints at every declared E1 hook.
- Immutable ledger/checksum/runner/timestamp/control/manifest verification;
  unowned DDL, future generation, excess ledger row, unknown table, and partial
  state rejection.
- Caller write transaction, caller savepoint, autocommit-off, read-only
  transaction, XA branch, non-default isolation, and connection-drift cases.
- Non-destructive temporary-shadow rejection for every one of the seven owned
  names, with the shadow sentinel preserved.
- Canonical Plan/Week/Block reconstruction; immutable watermark plus distinct
  current receipt; hash, JSON, receipt, temporal-envelope, normalized-row, and
  connection/provenance corruption failures.
- Server-side rejection of Plan JSON above 2 MiB; maximum-plus-one Week, Block,
  ledger, and owned-table source bounds; ordered rather than quadratic
  collision verification.
- A held revision-2 reader returns the exact old hash/title while a different
  connection atomically commits revision 3; a fresh reader returns the exact
  new hash/title. Distinguishable owner-8012 positive truth remains unchanged.

## Accepted source identities

| Source | SHA-256 | Git blob |
|---|---|---|
| Migrator | `373d0c6b58f723f824fa7e793337c3cb5e93697b145a8dab7cd4c9a9422129ac` | `a611e0abe993d497dc2e58c300bf1425e2bf618d` |
| InnoDB repository/current reader | `0ba527d615474f3979c717616592d467cd84fbbec6882a2c58378c0141c0d3d3` | `9278a7e9d307c819f9615f4c76cbe7498e7d52e3` |
| Week domain | `21a5819ccfb85a24e7430904fcc49a49de0ab720530f03d0ecbc40e91d8fb101` | `4e22582814f1662fe5cf46ada3acf6c2e2b669f9` |
| Week schema | `699b1c52ebe566dd98e75372316b8f817c90ac2da7d9d1f58ed9aab53002f194` | `c01387b17fe58180d226e1604abb589eff381bb6` |
| Physical E1 fixture | `bd7ca29b7273e3ada1e77707193313e25bf42d4181615e345322aa7352c154d6` | `a5f0b10d17509ff52c1cad41d177da4cfe256865` |
| Independent worker | `603e0e1f7bbef0fc42a728b2cffdec687f100c987c40e06d350afff429520418` | `872e1fb70eaaba27d2945b28e8c50fbd5ff5cc94` |
| Process controller | `260011c54aab57bd4fdb1c67212fb64853dc1778b368e6adcafe7a48a22b795f` | `5bcd263791bfda69e734a5ab1a0d30c7906683ff` |
| Isolated source contract | `873207c39b19bdcc6b55d0f446e348d00fd8d84c23384381a9d49f5023789ea2` | `451ca78dddce13aa01dd2e17c871fe1f8f4582ee` |
| Domain/property test | `16e047f5ae3390a20e299f7130270016f3151f760eb86462ef94787dda30a1b3` | `76c86c4a8cb24ff888c4f1b52c760904b1038202` |
| Combined runner | `9b7521848529afe9d701b87b4633217bebfe945d0213e6dd1bb24a1d424b1c00` | `722973853b876fd8afa4bbbba61b7cd1deb07f72` |
| Workflow | `86e0c72a46e828b72db67bdb715df938bee25551881ca8f2bf5cb5159528ad75` | `feffaaf2b3e2060426ad58d011c4db1bebb61efe` |

## Independent closure

Read-only audits first identified receipt-role ambiguity, stale provenance,
missing process crashes/races, quadratic collision checking, missing row
budgets, MySQL caller-transaction risk, absent true snapshot-tear proof,
temporary-table shadowing, and post-materialization LONGTEXT bounds. Each was
closed before the accepted digest. Two independent final re-reviews found no
remaining E1 P0 or P1 defect. Oversized receipt and physical 261-Week/4097-
Block fixtures were classified as nonblocking depth because their payload is
not transferred and the maximum-plus-one source contracts are exact.

## Runtime and mutation boundary

No local PHP, WP-CLI, database, Docker, or local Git write was used. Physical
execution occurred only in digest-pinned disposable GitHub Actions services.
No production database, option, cache, feature flag, entitlement, learner
record, route, deployment, MissionMed_OS file, or protected Matrix runtime byte
was changed. The approved Matrix controller/immutable-JavaScript pair remains
`b514638b…0739d2` / `c1d97237…9e76a`.

## Remaining claim boundary

E1 proves the restart-safe generation-2 migrator, exact physical provenance,
bounded consistent current reader, corruption behavior, crash recovery, and
cross-engine/session/concurrency safety. It does not prove the command writer,
first accepted operation, Calendar/V1 owner arbiter, REST authorization,
runtime binding, current/N-1 rollback, visible UI, accessibility, performance,
real-data policy, staging, or deployment. Those remain E2 and later gates.
