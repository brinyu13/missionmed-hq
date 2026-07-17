# Y1-CIE-C0-0001 Runtime Implementation

## Local API

The executable local API is intentionally loopback-only. `CIE_LOCAL_HOST` accepts only `127.0.0.1`, `::1`, or `localhost`; non-local bind attempts fail before repository state is opened. Caller headers are accepted only in this explicitly local harness and are not a production auth mechanism.

Responses use safe envelopes, request IDs, `Cache-Control: no-store`, and normalized errors. Malformed URIs return bounded client errors rather than uncaught 500 responses.

## Persistence

The Memory repository provides serial transactions and rollback on failure. The File repository adds:

- atomic temp-file commits;
- writer locking and stale-lock recovery;
- generation fencing;
- state and anchor hashes;
- append-only external witness entries;
- interrupted-commit recovery;
- semantic validation before state enters live maps.

Restored state is rejected for invalid UUIDs, owners, ranges, versions, content hashes, revision chains, event sequences, grants, consent links, deletion semantics, or cross-record references.

## Mutations

Retryable commands require a caller-stable idempotency key and canonical request hash. Same key plus same hash returns the original result. Same key plus different hash returns conflict. Mutable projections require expected row versions.

Timeline pagination is pinned to one event-sequence snapshot so concurrent inserts cannot silently skip data while claiming a complete page.

## Deletion

Deletion follows durable intent, local purge/redaction, external CAM-media absence proof, audit preservation, and terminal session redaction. Mutation response bodies are redacted while their hashes remain. Raw external session references are absent from retained audit.

The PostgreSQL finalizer requires exactly ten resource steps and two single-use, unexpired, job/class-bound attestations from one trusted authority session. It records the trusted worker actor, consumes attestations atomically, and refuses arbitrary hashes, wrong resources, mismatched authorities, missing/extra classes, or replay.

## Runtime Scope

The local runtime is a deterministic implementation and test harness. The SQL is a deployable candidate schema. No production Postgres adapter, provider integration, service deployment, or live route activation was performed.
