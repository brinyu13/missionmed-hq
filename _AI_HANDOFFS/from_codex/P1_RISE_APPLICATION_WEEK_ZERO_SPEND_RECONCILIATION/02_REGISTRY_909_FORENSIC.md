# Registry 909 vs 6,139 Forensic

## Finding

There is no live catalog split-brain, but there are three deliberately different persistence roles:

| Layer | Count | Contract |
|---|---:|---|
| Authenticated file-backed production catalog | 6,139 programs / 31 student-facing tabs | Authoritative browse/search/Program File identity catalog loaded by `rise/server.mjs` from the signed release index. |
| Postgres `registry_releases` active legacy release | 909 declared / 909 rows | Earlier rights-safe partial snapshot `rise_rights_safe_beta_20260828_460f459a0359`; retained for historical/source-rights compatibility, not current catalog enumeration. |
| Postgres `canonical_program_identities` | 1,298 identities | Evidence attachment index for researched/hydrated programs, not a national registry table. |

The active live health response identifies `rise_registry_2026-07-09_8fdb5afb84f6`, not the 909-row legacy release. The server's production index path is `/app/releases/student-rights-safe/api-index.json`; runtime tests prove authenticated catalog bootstrap uses the full index.

## Integrity readback

- File catalog `id`: 6,139 rows, 6,139 unique, 0 blank.
- File catalog `programSpecialtyId`: 6,139 rows, 6,139 unique, 0 blank.
- File catalog ACGME IDs: 6,139 rows, 6,139 unique.
- DB current facts: 5,005.
- DB canonical evidence claims: 19,166.
- DB evidence claims without source: 0.
- The 883 current facts without a `canonical_program_identities` row are exactly historical `NRMP_SOAP_CLOSURE` projections bound directly to stable file-catalog program IDs; they are not dangling facts.
- Approved-current source claims without promotion lineage: 0 of 4,745.

## Resolution

No 6,139-row DB backfill was performed. Treating the 909 legacy release as the live full catalog would be incorrect, and manufacturing 6,139 DB rows under that old release would blur release authority. No current runtime catalog code assumes that the 909 rows are complete. The authoritative contract is now recorded here: file-backed catalog for all identities; Postgres for canonical evidence, reviews, lineage, research jobs, and private student state.

No IDs were regenerated, duplicated, or detached. A future migration may create a separately named full-registry DB release, but it must be additive and must not overwrite the legacy release.

