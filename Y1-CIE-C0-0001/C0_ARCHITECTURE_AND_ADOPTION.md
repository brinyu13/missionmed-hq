# Y1-CIE-C0-0001 Architecture and Adoption

## Topology

The C0 implementation is additive under `/cie` and has two executable forms:

1. A loopback-only reference API backed by the transactional Memory/File repositories.
2. A production-oriented PostgreSQL schema and internal deletion-command boundary tested in disposable PostgreSQL.

The local server deliberately refuses non-local runtime activation. The PostgreSQL schema deliberately grants no public, anonymous, or authenticated direct DML and does not become a production runtime until a separately reviewed host adapter is added.

## Components

- `src/clock.mjs` - canonical segmented monotonic session clock and range mapping.
- `src/contracts.mjs` - closed validators for C0 objects and Ladder metadata.
- `src/service.mjs` - transactional policy and mutation orchestration.
- `src/apiAdapter.mjs` - preverified-auth API adapter and safe envelopes.
- `src/replaySync.mjs` - independently authorized synchronized-range controller.
- `src/repository/memoryRepository.mjs` - deterministic transaction model.
- `src/repository/fileRepository.mjs` - locked, journaled, witnessed local persistence.
- `src/repository/stateValidator.mjs` - full semantic decoder for restored state.
- `public/review.*` - bounded Moment review projection.
- `migrations/*.sql` - additive schema, integrity, authority, and deletion closure.

## Adopted CAM Donor Patterns

- Monotonic, gap-aware timing rather than paint cadence or wall-clock evidence.
- Server-derived identity and preverified auth boundaries.
- Caller-stable idempotency keys, canonical request hashes, and CAS row versions.
- Explicit artifact grants and revoke-only access transitions.
- Signed/range-scoped playback as authorization, not as evidence identity.
- Server-owned deletion intent, proof, and terminal audit.
- Default-off future capability registry.

## Components Not Duplicated

C0 does not implement a second MissionMed authentication system, media provider, capture engine, or CAM replay store. CAM rep/media identifiers are referenced as external donor resources through clock segments and media revision references.

## Deliberate Separation

- WordPress/HQ remain identity and entitlement authorities outside C0.
- CAM remains capture/media owner outside C0.
- CIE stores timeline evidence, review artifacts, immutable curriculum snapshots, and policy references.
- AI/transcript/voice/provider implementations remain absent.

## Activation Boundary

The local reference runtime is executable. The migrations are executable. Production activation is false because there is no reviewed production Postgres repository/command adapter or production host-auth wiring. This is a named release boundary, not hidden incompleteness.
