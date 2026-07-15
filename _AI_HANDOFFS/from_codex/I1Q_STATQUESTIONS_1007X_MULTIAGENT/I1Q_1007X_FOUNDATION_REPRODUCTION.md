# I1Q-1007X Foundation Reproduction

## Verdict

`HISTORICAL FOUNDATION PASS, 1006 APPLICATION REPAIR REQUIRED`

## 1005 Exact-Byte Reproduction

The complete 1005 foundation and the 1006 audit harness were copied to an OS-temporary directory. The copied validator was executed there, and the historical source directory was not run or modified.

| Evidence | Result |
| --- | --- |
| Source estate files | 86 |
| Source estate SHA-256 before | `2767262ab169c88d6c9fcfe4a2a76199782ca29a443cdb86e7ef329c30f34d90` |
| Source estate SHA-256 after | `2767262ab169c88d6c9fcfe4a2a76199782ca29a443cdb86e7ef329c30f34d90` |
| Source estate unchanged | PASS |
| Validator SHA-256 | `edca04a0e1f8c5160c21cc4814d819f0f03f0eb32c65dead771e6128e2db9bcb` |
| Copied validator exact-byte match | PASS |
| V1 through V20 | 20 PASS |
| LT-1 through LT-6 | 6 PASS |
| N-001 through N-030 | 30 PASS |
| N-031 through N-080 adversarial mutations | 50 PASS |
| Superseding privacy contract assertions | 5 PASS |
| Total assertions | 111 PASS |

Generated reproduction evidence hashes:

| Result | SHA-256 |
| --- | --- |
| Official 1005 suite | `5da6cf13ffb74b784b340678483273f1086e01998bf035c1afe334551f14f99b` |
| Adversarial audit | `ad3f8cee97bda6f7795fe683b9d3ce3197fef2c0aadee9c0f9c25d89e424e701` |
| Audit summary | `e64b6ae221eb87a3cd129677ae7d78b741a809168c593c6813b526e484d8a7dc` |

## Privacy Interpretation

The historical 1005 source redaction fixture has an intentional known defect: a synthetic patient identifier is mislabeled as `student_name`, leaving the required `patient_identifier` class without gold examples. The superseding evaluator correctly fails that source fixture with recall `0` for the missing class.

The 111-assertion PASS means the harness detected the expected defect and its in-memory corrected synthetic control passed. It does not mean the old source fixture or the 1006 application privacy logic is production safe.

## 1006 Application Reproduction

`npm test` completed with 30 of 30 tests passing. These tests cover the synthetic HTTP shell, bounded pagination, malformed requests, static migration characteristics, in-memory load, hashing, the exact nine-field STAT projection, answer-free pre-answer generation, immutable records, synthetic review gates, pipeline lineage, and static UI markers.

`npm run validate` failed with exit code 1 because `src/validate-evidence.mjs` does not exist. The checked-in validation command is therefore nonfunctional.

## Reproduced Blocking Defects

1. Read roles can retrieve answer-bearing `item_revisions`; sanitization leaves `answer` and `explanation` intact.
2. The post-answer artifact route trusts a caller-controlled phase query without server-authoritative finalization evidence.
3. Leak detection omits aliases including `answer_map` and `is_correct`.
4. Generic write paths permit unsafe rights, privacy, evidence, and source mutation.
5. A platform administrator can fabricate reviewer credentials, impersonate review actors, combine governance roles, and publish without independent validation or Brian ratification.
6. SQL actor and role context is self-asserted and not bound to canonical identity, assignments, or class-specific access.
7. Mutations have no proven CSRF or Origin enforcement.
8. Runtime uses only `MemoryRepository`; no tested transaction-bound database repository exists.
9. Transcript normalization returns raw `text` beside redacted text.
10. Required privacy classes omit student speech and identifying clinical anecdotes, and zero recall can aggregate to pass in the 1006 application scorer.
11. Migration naming, headers, repeatability, executable Postgres proof, rollback chain, and re-apply proof are absent.
12. Composite question identity, release membership tuples, historical joins, and complete Drills availability are not preserved by the current adapter.

## Browser Reproduction

The local synthetic server started successfully at its loopback demo address and was stopped cleanly after the test. The explicitly requested in-app browser backend reported no available browser type after the documented troubleshooting check. Visual interaction, real accessibility inspection, and browser screenshots remain externally blocked in this session. No other browser surface was substituted.

## Dependency Audit

The repository lockfile currently reports four advisories across three packages:

- `form-data`: high, CRLF injection, fixed version available
- `ws`: high denial of service and moderate memory disclosure advisories, fixed version available
- transitive `esbuild`: low Windows development-server file-read advisory, fixed version available

No source import of those packages was found in the inspected tree, and the isolated I1Q package has no package dependencies. The alerts are still a repository-wide release gate until the dependency map establishes consumers and a tested, scoped upgrade is accepted.

## Current Gate

Foundation reproduction is complete. Foundation repair is not complete. Application integration, migration, staging, or deployment must not proceed until the P0 answer and release bypasses, privacy fail-open behavior, and nonfunctional evidence validator are repaired with regression coverage.
