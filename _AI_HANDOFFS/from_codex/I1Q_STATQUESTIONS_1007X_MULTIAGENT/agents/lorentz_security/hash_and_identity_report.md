# I1Q-1007X Hash and Identity Report

Verdict: HASH PRIMITIVES PASS LOCALLY, IDENTITY MODEL INCOMPLETE

Date: 2026-07-15

## Authority Context

DR-006 and MissionMed OS PR #12 address the root-recovery authority questions by fixing the RANKLISTIQ datastore, composite metadata semantics, legacy-v4 read authority, and sealed-pack preservation. The candidate's P1 identity and release-membership defects remain current.

## Distinct Hash Domains

### Item Revision hash

An Item Revision hash identifies immutable semantic content. The candidate canonical JSON implementation normalizes strings to NFC, recursively sorts object keys, preserves array order, encodes UTF-8, and emits lowercase SHA-256 hex.

This hash must include every content field whose change creates a new revision and must exclude mutable workflow metadata. The final preimage needs one versioned schema contract before database integration.

### STAT pack hash

The pack hash is not the Item Revision hash. It uses the frozen STAT preimage:

`dataset_version=<ds>|question_ids=<qids>|choices_order=<groups>`

The candidate reproduces the fixed vector `9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f`.

### Artifact and manifest hashes

Each channel artifact is hashed from canonical JSON. A release manifest hashes the ordered artifact inventory and previous-manifest reference. The manifest must additionally bind exact release-membership tuples so an artifact cannot be detached from its Item Revisions.

### Source and working hashes

Raw source hashes identify restricted source bytes. Working hashes identify privacy-safe derived text. They are not interchangeable. Every derivation must retain both lineage references without copying raw content into working rows.

## Identity Domains

| Domain | Canonical identity |
| --- | --- |
| Semantic item | `item_id` |
| Immutable content | `(item_id,itemrev_id,revision_number,content_hash)` |
| Projected question | `(dataset_version,question_id)` |
| Historical source row | `(dataset_version,question_id,content_hash)` |
| Release membership | `(release_id,item_id,itemrev_id,revision_number,content_hash,projected_question_id)` |
| Duel pack | `duel_id` plus sealed seven-field envelope |
| Source artifact | source authority, canonical source ID, and source hash |

No domain may substitute array position, display title, mutable status, or a bare cross-version `question_id` for canonical identity.

## Candidate Passes

- Canonical JSON is deterministic for tested Unicode and key-order variants.
- STAT fixed vector passes byte-for-byte.
- Nine-field output order is frozen in code and test.
- Release artifacts derive from one in-memory release operation.

## Candidate Defects

### Ordinal projected IDs

`buildReleaseArtifacts` falls back to `I1Q-000001`, `I1Q-000002`, and so on based on sorted array position. This is unstable under insertion, deletion, and some replacement operations.

### Duplicate overwrite

`Object.fromEntries` builds lookup data by bare `question_id`. Duplicate IDs overwrite silently rather than fail.

### Incomplete release pin

Release snapshots store item-revision IDs but not complete architecture tuples or persistent projected mappings.

### Unbounded dataset-version semantics

Release assembly accepts arbitrary dataset-version strings and has no authoritative registry compatibility check.

### Application-to-SQL hash mismatch risk

The in-memory repository hashes arbitrary payload objects, while SQL requires separately named hash columns. No database adapter proves that both sides hash the same preimage or preserve the same identity.

## Canonical Documentation Note

The Data Flow Contract says clients never recompute `content_hash`, while the frozen STAT canon requires client parity recomputation of the pack hash. For I1Q, Architecture 1002.1 and DR-006 preserve the frozen sealed-pack behavior. This is now a documentation-reconciliation item, not permission to change the pack or client behavior.

## Required Proof

- Published preimage schema for each hash domain.
- Cross-language vectors for JavaScript and Postgres.
- Duplicate, normalization, delimiter, null, array-order, and Unicode adversarial cases.
- Persistent projected mapping independent of input order.
- Composite metadata and old-attempt joins across versions.
- Exact release membership and artifact-manifest binding.
- Rollback and re-promotion preserve all hashes and identities.
- Reapply produces the same schema, mappings, and vectors.

## Final Assessment

The local hash primitives are suitable foundations. Identity generation, database translation, release pinning, duplicate rejection, and historical-join proof must be repaired before migration or adapter certification.
