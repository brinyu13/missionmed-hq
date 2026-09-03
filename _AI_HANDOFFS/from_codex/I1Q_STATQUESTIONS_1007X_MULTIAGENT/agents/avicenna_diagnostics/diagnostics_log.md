# Avicenna Diagnostics Log

## Scope

Read-only diagnosis of the integrated I1Q Question Platform application, tests, evidence validator, and the untracked 1007X PostgreSQL migration pair. Avicenna made no changes to application code, migrations, tests, evidence, feature flags, Git state, protected systems, or provider state. Writes were limited to the five files in this diagnostics directory.

## Snapshot

- Observed at: `2026-07-15T13:40:06Z`
- Worktree: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000`
- Branch: `i1q-question-platform-ultra-1007x-ma`
- HEAD: `04f1c7ac5221b1b5232ec6ac7966776fd5bb8644`
- Application: `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform`
- Migration candidate: `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- Compensation candidate: `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`

The migration, compensation, PostgreSQL repository, and three associated test files were untracked at the final snapshot. Concurrent file arrivals changed earlier test counts, so only the final stable run below is authoritative.

## Tests Performed

### Complete local application suite

Command: `npm test` from `i1q-question-platform`

Result:

- Exit code: `0`
- Tests: `195`
- Passed: `194`
- Failed: `0`
- Skipped: `1`
- Duration reported by Node: `731.915792 ms`

The skipped test is `ephemeral PostgreSQL apply, reapply, role attacks, compensation, and reapply proof`. The skip reason is that `I1Q_POSTGRES_TEST_URL` is not configured. `/opt/homebrew/bin/psql` is present, but no disposable database target was authorized or supplied.

### Evidence validator

Command: `node src/validate-evidence.mjs` from `i1q-question-platform`

Result, reproduced twice against the final snapshot:

- Exit code: `1`
- Claimed state: `BLOCKED`
- Evidence files expected, present, and parsed: `20`, `20`, `20`
- Errors: `19`

Error groups:

1. Two required feature flags are absent from the generated deployment manifest.
2. The rollback manifest lists only four of the six current I1Q flags.
3. Twelve listed application artifacts have stale hashes or byte counts.
4. The checksum inventory lists 26 files while the current application estate has 43 files outside `evidence`.
5. The recorded test inventory is stale and omits the validator regression suite.
6. The rollback contract fails because its generated manifest does not cover every current flag.

### Syntax checks

All exited `0`:

- `node --check scripts/generate_evidence.mjs`
- `node --check src/postgres-repository.mjs`
- `node --check src/validate-evidence.mjs`
- `node --check public/app.js`

## Evidence Inspected

- All 12 current `tests/*.test.mjs` files
- `src/validate-evidence.mjs`
- `scripts/generate_evidence.mjs`
- All 20 current evidence JSON files
- The complete 2,561-line 1007X migration
- The complete compensating migration
- `src/postgres-repository.mjs`
- Architecture 1002.1 channel, review, immutability, rights, and release rulings

## Findings

The integrated in-memory application, UI, security, privacy, adapter, validator regression, static migration, and fake-driver repository suites are green. This does not prove the new migration can apply, reapply, enforce RLS, survive attacks, compensate, or reapply on PostgreSQL because that one execution test did not run.

The evidence validator is functioning as a fail-closed detector. Its failure is primarily a stale generated-evidence condition, but the evidence generator still targets the old `0001` migration pair and carries stale deployment blockers. A blind regeneration would therefore not certify the new 1007X pair truthfully.

Static review also found migration and application contract gaps that the green regex and fake-driver tests do not exercise. These are detailed in `failure_root_causes.md`.

## Changes

No repair was made by Avicenna. No test was added by Avicenna. The diagnostics packet is the only output.

## Risks And Blockers

- No PostgreSQL execution proof exists for the new migration pair.
- The current generated evidence estate is invalid.
- The SQL artifact path does not enforce the binding class and phase policy against payload content.
- Release validation accepts caller-named passing checks without proving all six official leak tests.
- The application still uses `MemoryRepository`; the new PostgreSQL repository is not wired into the server.

## Confidence

High for the observed local test and validator results. High for the cited static contradictions. No confidence claim is made for live PostgreSQL behavior, staging, production, or protected consumers.

## Root Handoff

Root should treat the local suite as green but incomplete, not as staging certification. Repair the static contract gaps, add focused regressions, run the migration test on an authorized disposable PostgreSQL instance, update the evidence generator to the accepted 1007X pair and current blockers, regenerate once, and rerun the fail-closed validator.
