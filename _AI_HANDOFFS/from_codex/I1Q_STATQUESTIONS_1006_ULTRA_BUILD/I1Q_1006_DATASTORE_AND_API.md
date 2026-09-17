# I1Q 1006 Datastore and API

## Implemented candidate

VERIFIED: Candidate root is `i1q-question-platform/`.

VERIFIED: `db/migrations/0001_i1q_question_platform.sql` defines all 23 Architecture 1002.1 entities and 12 operational entities in schema `i1q`.

Core entities include taxonomy, blueprint, misconception vocabulary, channel policy, concepts, variant groups, items, immutable item revisions, claims, sources, extraction runs, prompts, rights, redaction, reviewers, assignments, review events, calibration, incidents, releases, promotions, artifacts, and psychometrics.

Operational entities include inventory, transcript artifacts, normalized segments, extraction candidates, quality flags, batch jobs, checkpoints, import maps, export validation, feature flags, audit events, and idempotency keys.

## Data controls

- VERIFIED: Published-history tables have update/delete rejection triggers.
- VERIFIED: No destructive deletion path exists for immutable revisions, reviews, releases, promotions, artifacts, or audit events.
- VERIFIED: Raw transcript content is excluded from normalized segment rows; only private object references and redacted working text are modeled.
- VERIFIED: Feature flags default false.
- VERIFIED: RLS is enabled and forced for every candidate table.
- VERIFIED: The migration makes no client grants.
- VERIFIED: Protected source and transcript records have narrower read policies.
- VERIFIED: Indexes cover taxonomy tags, review queues, transcript time, candidate queues, jobs, incidents, and audit lookups.

## Service behavior

- VERIFIED: `src/platform.mjs` enforces role checks, idempotency, immutable revision creation, optimistic locking for mutable rows, self-review rejection, editorial-before-medical order, physician credential checks, exact-revision approval, release eligibility, publication flags, and artifact phase gates.
- VERIFIED: `src/store.mjs` creates a deterministic append-only audit hash chain.
- VERIFIED: `src/hash.mjs` normalizes Unicode to NFC before deterministic SHA-256 hashing.
- VERIFIED: Local demo records are synthetic non-clinical fixtures.

## API contract

VERIFIED: `openapi.json` is valid JSON and defines health, dashboard, governance, generic resources, item revisions, assignments, reviews, releases, promotions, and channel artifacts.

VERIFIED: Workflow-owned records, reviewer registration, governance assignment, and feature flags use dedicated administrator endpoints and cannot be forged through the generic resource route.

VERIFIED: HTTP server protections include a one-megabyte body limit, no-store responses, restrictive CSP, no framing, MIME sniffing protection, and no broad CORS configuration.

VERIFIED: Production mode has no header-based identity bypass. It requires an injected identity resolver and otherwise returns `401`.

## Validation

- VERIFIED: 30 local application tests pass.
- VERIFIED: Migration static checks find every required entity, forced RLS, default-off flags, and immutability triggers.
- BLOCKED: SQL was not applied to local, staging, preview, or production Postgres.
- BLOCKED: No canonical database driver or MissionMed auth adapter is wired.
- INFERENCE: This is a production-shaped candidate contract, not an operational production datastore.

## Rollback

VERIFIED: `db/rollback/0001_compensating_disable.sql` disables every I1Q feature flag without dropping data.

BLOCKED: Rollback execution has not been demonstrated against an authorized staging database.
