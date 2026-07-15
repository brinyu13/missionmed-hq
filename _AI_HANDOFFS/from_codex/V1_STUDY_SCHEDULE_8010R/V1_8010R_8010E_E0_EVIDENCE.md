# V1 Study Schedule 8010R — 8010E E0 Evidence

Updated: 2026-07-15 UTC  
Accepted validation commit: `9e8e2f247c3b1fb74872eefc0e97017c5faa3a5d`  
Accepted tree: `85044a4b52195d2cf481d257edab4f8d597b76ea`  
Result: E0 VERIFIED

## Exact CI evidence

All jobs executed from the accepted exact tree and passed:

| Workflow | Run | Jobs | Result |
|---|---:|---|---|
| 8010E Week contract | `29410080140` | MySQL 8/PHP 8.3 `87334816469`; PHP 8.3 `87334816472`; MariaDB 10.11/PHP 7.4 `87334816523`; PHP 7.4 `87334816553` | PASS |
| 8010C regression | `29410080116` | five WordPress/PHP/inert-loader jobs | PASS |
| Containment | `29410080098` | four WordPress/PHP jobs | PASS |
| 8010D kernel | `29410080096` | six PHP/MySQL/MariaDB jobs | PASS |

The E0 physical fixture created the exact seven-table state in disposable
MySQL 8 and MariaDB 10.11 services, verified strict session enforcement and
exact information-schema shapes, inserted valid Week/Block cases, and proved
the database rejects invalid ownership, Monday, revision, grid, duration,
midnight, interval, tombstone, source, goal, provenance, title-length, unique,
foreign-key, and parent-delete cases with the expected engine error classes.

## Accepted source identities

| Source | SHA-256 | Git blob |
|---|---|---|
| Week domain | `34fdfce5b352e749e0ecd47b57252d5c1ade88928f9edf2234d742ff0fa812ef` | `1f55559bb7cedd525090545901cab811278be644` |
| Week schema | `699b1c52ebe566dd98e75372316b8f817c90ac2da7d9d1f58ed9aab53002f194` | `c01387b17fe58180d226e1604abb589eff381bb6` |
| Week inspector | `207d48638b815ea954f25e7c046443b94b1441594e767399ed09c2e5b7652fb1` | `cae595c198905ca0ced40c886dd60367a7cf1a1f` |
| Parent inspector | `1f48a43fe03a66c7845ca4fbb7b702563cee6e153ab428a6d6f02005e341e4aa` | `3326a91f2aea2fa6604fa1e03c92f7391c7afa20` |
| Domain test | `0195ff7535ba77f7e78878d1a48848c31132b0eed828651fa6367876d1680b93` | `98a3f7878d2fc4ca6f41a0b0886a05c42cb9bb32` |
| Schema test | `e3b3a1f3538f6bc12b9eb44632856b9ff6d281bcf6f36159bfb940be267252f8` | `4d196f8136f617ce5ab758fda61722919206debd` |
| Physical fixture | `f4827a15b2c4f778f4d2cd3523da27370c7381e4b81e15af23eefe3a58360b14` | `cd80787b2ead46234d707891f262a6a64ad83bf7` |
| Combined runner | `327a20a16fa844af809f79a06231bc38a44bb80fb69df9cba9fd834a973aa166` | `8a02117ff61d597055fac6e7a0e638fbc42403ad` |
| Domain runner | `37e6b4e6362b96223e647fd4f1ddd2a728c1fa4e9d21608400e00d2789af224a` | `f7e41eec6d5dcefd4bb5e285fe5114357f3e8f18` |
| Workflow | `49aeed2fa8484e97eda040bb4507a761b329c5cbb0227d314d7ae8bc4322e314` | `8cfcd2efbb05e754bb7406b0b32f5eea23cdedb9` |

## Adversarial closure

Three independent read-only audits identified and closed the following before
acceptance: missing explicit child FK index; tombstone SQL-UNKNOWN loophole;
empty provenance asymmetry; MySQL arithmetic-parenthesis metadata; and MariaDB
interval metadata. The final exact dual-engine run and the complete 8010C,
containment, and 8010D regression suites were green. No P0/P1 E0 finding
remained at the accepted digest.

## Runtime and mutation boundary

The full Matrix runtime guard passed with controller
`b514638b6089b12057ab53e715bc18c13b0dc21cba64e63d04be0a14cc0739d2`
and immutable Matrix JavaScript
`c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a`.
No production database, option, cache, feature flag, entitlement, learner
record, route exposure, deployment, MissionMed_OS file, or protected runtime
byte was changed by E0.

## Remaining claim boundary

E0 proves pure domain normalization, exact additive DDL portability, physical
constraint enforcement, and regression containment. It does not prove the
ledgered generation-2 migrator, consistent current reader, command writer,
Calendar/V1 arbiter, REST contract, visible product, accessibility, performance,
rollback, real-data policy, staging, or deployment. Those remain E1 and later
gates.
