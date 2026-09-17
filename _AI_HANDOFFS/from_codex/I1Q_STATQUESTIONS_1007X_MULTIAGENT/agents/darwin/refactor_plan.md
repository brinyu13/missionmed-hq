# I1Q-1007X Darwin Refactor Plan

## Snapshot

- VERIFIED: The integrated Git commit inspected is `6ac62c5a0503981680f161fe5119d5e5e2fa031a` on branch `i1q-question-platform-ultra-1007x-ma`.
- VERIFIED: The application, evidence, validator, OpenAPI, and API-test bytes inspected are integrated at that exact commit. Unrelated shared handoff changes remain outside Darwin ownership.
- VERIFIED: A stable current run of `npm run validate` passed 20 of 20 evidence files with zero errors and claimed `STATE_A`.
- VERIFIED: A current run of `env -u I1Q_POSTGRES_TEST_URL npm test` discovered 206 tests, passed 205, failed 0, and intentionally skipped 1 disposable PostgreSQL test.
- VERIFIED: The runtime files used by the preserved benchmark retain the exact SHA-256 values recorded at measurement time.
- VERIFIED: Darwin performed no application, SQL, migration, test, evidence, package, feature-flag, provider, or Git refactor.
- PROTECTED: No production or staging system, canonical identity provider, real transcript, medical content, or student data was accessed.

## Decision

- VERIFIED: No behavior-preserving code refactor was performed because Darwin's write authority is report-only.
- INFERENCE: No latency-only refactor is warranted now for the local in-memory implementation. The point-in-time 20,000-row benchmark had repository page p95 values below 23 ms and HTTP warm-page p95 below 17 ms on the measured machine.
- INFERENCE: A behavior-defining query-contract refactor is warranted before a 10,000-plus candidate queue is treated as operationally complete. The current API accepts only cursor and limit for generic lists, while the client fetches at most 200 rows and applies search, filter, sort, and paging locally.
- UNKNOWN: Production query latency, RLS cost, lock behavior, browser render cost, and concurrency remain unknown because no approved preview or production route was available.

## Protected Invariants

1. PROTECTED: STAT `dataset_questions` remains exactly nine fields in frozen order.
2. PROTECTED: Composite identity remains `dataset_version` plus `question_id`.
3. PROTECTED: Class A and other pre-answer artifacts contain no answer, correctness, explanation, rationale, or equivalent nested material.
4. PROTECTED: Answer-bearing data remains server-only until trusted finalization and participant authorization.
5. PROTECTED: Drills transcript, VTT, nodes, and playback availability remain explicit and fail closed.
6. PROTECTED: Review access remains role-scoped, assignment-scoped, credential-scoped, and exact-revision-hash-bound.
7. PROTECTED: Draft mutation stops when a revision leaves draft state.
8. PROTECTED: Review, audit, release, and source history remains immutable where the architecture requires it.
9. PROTECTED: Release validation remains bound to exact official checks, artifacts, membership, and evidence hashes.
10. PROTECTED: Assembly, validation, medical ratification, and publication preserve actor separation.
11. PROTECTED: Both student flags and the exact consumer flag remain required for release delivery.
12. PROTECTED: Medical governance remains unassigned until an authorized, credentialed physician is explicitly appointed.
13. PROTECTED: Real sources remain extraction-blocked until governed source-complete privacy evidence passes.
14. PROTECTED: All six feature flags remain off unless a separately authorized release gate changes them.

## Future Refactors

### R1. Add Complete Server-Side List Contracts

- VERIFIED: `src/server.mjs` reads `cursor` and `limit` for generic list requests but does not read state, search, or sort parameters.
- VERIFIED: `public/app.js` requests at most 200 rows and then applies local filtering and sorting.
- VERIFIED: In the point-in-time 20,000-row synthetic check, a target at row 20,000 was found with the complete data set and omitted from the first 200 rows.
- INFERENCE: Define allowlisted filter and sort parameters for each operational resource, plus a stable keyset cursor with deterministic tie-breakers.
- INFERENCE: Return explicit invalid-cursor errors or an explicitly versioned restart contract. Add direct tests for both valid continuity and rejected stale cursors.
- UNKNOWN: Root must choose the externally visible invalid-cursor behavior. The current memory adapter silently restarts page one for an unknown cursor.
- INFERENCE: Acceptance requires complete results across more than 10,000 synthetic rows, no duplicate or omitted rows across pages, and equivalent memory and PostgreSQL behavior.

### R2. Add Bounded PostgreSQL Queue Methods

- VERIFIED: `PostgresRepository.listMyReviewAssignments` has no cursor or limit contract.
- VERIFIED: The repository does not expose a candidate-queue method equivalent to the measured memory list path.
- INFERENCE: Add purpose-scoped candidate and assignment queries with keyset pagination, explicit maximum limits, stable tie-breakers, and unprivileged role tests.
- UNKNOWN: Query plans and RLS overhead require an approved disposable or preview PostgreSQL environment with representative synthetic cardinality.

### R3. Decompose Concentrated Runtime Modules

- VERIFIED: `src/platform.mjs` is 1,450 lines and `public/app.js` is 1,902 lines at the inspected snapshot.
- INFERENCE: Preserve `QuestionPlatform` as the public facade while extracting resource visibility, revision, review, release, and governance services behind unchanged contracts.
- INFERENCE: Split the buildless client into native modules for transport and session state, selected-record context, renderers, and command handlers.
- INFERENCE: Characterization tests must pass unchanged before any new service-level tests are accepted.

### R4. Modularize Independent Evidence Validation

- VERIFIED: `src/validate-evidence.mjs` is 2,087 lines and the current stable validator run passes 20 of 20 files.
- VERIFIED: The package suite retains negative checks for missing, malformed, duplicate-key, stale-checksum, privacy, answer-leak, source-leak, release, and combined-handoff evidence failures.
- INFERENCE: Extract schemas, filesystem safety, privacy mathematics, release validation, and reporting into internal modules while preserving deterministic issue order and CLI exit semantics.
- INFERENCE: Keep intentionally independent authority constants independent, and bind cross-language behavior with frozen synthetic vectors rather than one self-validating implementation.

### R5. Preserve Migration Immutability

- VERIFIED: The candidate migration is 3,299 lines, defines 52 tables, and has not been applied by Darwin.
- PROTECTED: After the first authorized canonical application, the migration must not be edited, renamed, or replaced.
- INFERENCE: Later schema refactors should use forward migrations and preserving compensation with generated inventories for tables, functions, indexes, policies, triggers, grants, and forced RLS.

### R6. Strengthen Performance Regression Coverage

- VERIFIED: The existing performance test covers 5,000 sequential synthetic inserts and one bounded page with a 4,000 ms ceiling.
- INFERENCE: Add deterministic 10,001-row and 20,000-row cases covering first, middle, final, filtered, sorted, valid-cursor, and invalid-cursor behavior.
- INFERENCE: Record p50, p95, p99, heap delta, runtime version, machine class, and input hashes in an opt-in benchmark command separate from correctness tests.

## Blockers And Deferrals

- BLOCKED: Canonical MissionMed identity resolver and runtime session integration are not authorized or certified.
- BLOCKED: Canonical unprivileged PostgreSQL runtime wiring, grant manifest, promotion route, and rollback route are not proven.
- BLOCKED: Browser, assistive-technology, human workflow, staging, monitoring, backup, and production evidence are incomplete.
- BLOCKED: Real corpus extraction remains prohibited; no raw transcript or student-data benchmark is authorized.
- BLOCKED: Medical governance is unassigned, so no medical approval claim is permitted.
- BLOCKED: `performance_before_after.json` is ignored by the repository's broad `_AI_HANDOFFS/**` rule. Root must intentionally include it without changing ignore policy if the report is to enter a commit.

## Handoff To Root

- VERIFIED: Current local validation is green for the stable working snapshot, and no Darwin refactor needs acceptance.
- INFERENCE: Root should preserve exact commit `6ac62c5a0503981680f161fe5119d5e5e2fa031a` as the engineering checkpoint, intentionally include the ignored JSON report, and prioritize R1 before operational use at 10,000-plus queue depth.
- UNKNOWN: R2 performance acceptance remains open until an approved PostgreSQL route supports representative synthetic query-plan measurement.
