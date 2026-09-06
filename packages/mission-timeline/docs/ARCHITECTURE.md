# Mission Timeline D1-412 implementation architecture

## Classification

This is a non-production, repo-backed implementation package. It advances D1-411 from architecture into an executable vertical slice, but it is not deployed and is not connected to live Matrix, PostgreSQL, R2, Mac Pro rendering, or FileVault endpoints.

## Authority map

| Concern | Authority |
|---|---|
| Authentication | Matrix / WordPress trusted BFF |
| Principal and relationship authorization | Timeline API, defended by PostgreSQL RLS |
| Editable timeline source | Versioned TimelineDocument in Timeline database |
| Offline and recovery draft | Browser IndexedDB |
| Immutable media/export bytes | Private R2-compatible object store |
| Artifact manifest | Timeline database TimelineArtifact |
| Official v1 fidelity rendering | Mac Pro renderer authority |
| Published artifact distribution | Legacy FileVault adapter through outbox |
| FileVault v2 | Disabled until contract ratification |
| Matrix counts and notifications | Metadata-only projections |

## Runtime boundaries

The Matrix lifecycle module mounts the exact D1-410 release candidate without an iframe and injects `HybridIndexedDbAdapter`. Every local save lands in IndexedDB first. Checkpoints are coalesced for remote sync; named versions are never silently merged; revision conflicts remain recoverable records.

The API validates the `d1-timeline-document-409.1` schema, derives ownership from the authenticated principal, enforces relationship authorization, stores immutable versions, binds advisor decisions to version hashes, and creates idempotent export jobs. The export worker sanitizes the selected visibility scope, rechecks approval immediately before official rendering, hashes every output, writes private immutable bytes, and records a canonical `d1-timeline-artifact-409.1` manifest.

## Intentional blockers

- Live Matrix runtime source and patch location remain unresolved.
- PostgreSQL migration has not been applied to a disposable or staging database.
- The package includes an in-memory repository for executable tests; a reviewed production database adapter and transaction wiring remain required.
- Private R2 signing and malware scanning are represented by a strict contract and deterministic in-memory implementation, not a cloud endpoint.
- Mac Pro transport is a contract; no production worker connection exists.
- Legacy FileVault client is an adapter contract and in-memory fixture; v2 is disabled.
