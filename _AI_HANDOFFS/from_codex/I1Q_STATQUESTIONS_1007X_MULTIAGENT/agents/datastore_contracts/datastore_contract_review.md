# I1Q-1007X Datastore Contract Review

## Verdict

VERIFIED: The offline static migration checks and fake-client repository checks pass in the current worktree.

UNKNOWN: No PostgreSQL instance was used. This packet does not prove migration application, database-enforced RLS behavior, role behavior, ownership behavior, or rollback execution.

## Scope

VERIFIED: This worker inspected but did not modify:

- `i1q-question-platform/db/migrations/20260715122434_i1q_1007x_question_platform.sql`
- `i1q-question-platform/db/rollback/20260715122435_i1q_1007x_compensating_disable.sql`
- `i1q-question-platform/db/migrations/0001_i1q_question_platform.sql`
- `i1q-question-platform/src/postgres-repository.mjs`

VERIFIED: This worker created or modified only the assigned tests and this three-file report directory.

## Test Evidence

VERIFIED: Initial focused run:

- Command: `node --test tests/migration-1007x.test.mjs tests/postgres-repository.test.mjs`
- Tests: 33
- Passed: 29
- Failed: 4
- Skipped: 0

VERIFIED: One initial failure was a test inventory omission. The migration correctly included `psychometric_snapshots` in its immutable table array, while the expected test list omitted it. The expected list was corrected before the stop instruction arrived.

VERIFIED: Three initial failures exposed repository behavior:

1. An invalid dedicated client with a usable release hook was rejected without invoking that release hook.
2. Null object input to purpose-scoped reader methods escaped as native `TypeError` before stable repository validation.
3. An explicitly undefined required channel payload reached the query boundary because `JSON.stringify(undefined)` did not throw.

VERIFIED: The repository implementation changed concurrently outside this worker's write scope. The preserved regression cases then passed without further test edits.

VERIFIED: Final focused run:

- Tests: 33
- Passed: 33
- Failed: 0
- Skipped: 0

VERIFIED: Final full local application suite:

- Command: `npm test`
- Tests: 195
- Passed: 194
- Failed: 0
- Skipped: 1

VERIFIED: The skipped test is the ephemeral PostgreSQL apply, reapply, role-attack, compensation, and reapply proof. It requires `I1Q_POSTGRES_TEST_URL` pointing to an isolated disposable local database.

## Covered Contracts

VERIFIED: Static migration tests cover:

- fail-closed grants and revocations
- complete forced RLS inventory
- immutable history and release records
- all six feature flags seeded off
- `auth.uid()` actor identity and database-owned role memberships
- answer-bearing data isolation
- restricted source reference isolation
- release evidence and identity binding
- forward-only preserving compensation
- static idempotency guards

VERIFIED: Fake-client repository tests cover:

- successful commit and release
- rollback on actor, setup, callback, driver, and commit failures
- aggregate preservation of transaction and rollback errors
- closed transaction handles
- read-only and isolation-level SQL
- purpose-scoped answer and restricted-source reads
- input shape, enum, hash, duplicate, and JSON validation
- malformed driver results

## Limitations

UNKNOWN: Static SQL inspection cannot prove PostgreSQL parser acceptance or behavior under the eventual canonical runtime role.

UNKNOWN: No provider, Supabase, staging, production, secret, environment value, network, or student data was accessed.

DO NOT TOUCH: No runtime grants, deployment, migration application, feature-flag change, production write, or protected runtime mutation was performed.
