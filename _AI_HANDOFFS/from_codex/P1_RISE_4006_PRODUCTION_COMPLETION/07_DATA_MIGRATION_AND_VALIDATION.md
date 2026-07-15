# P1 RISE 4006 Data Migration And Validation

## Verdict

No staging or production database migration was executed. No production registry release was activated. The candidate implements a fail-closed import, evidence, identity, and proposed-schema foundation, but source authorization and platform ownership are prerequisites to using the real registry.

## Implemented Foundation

| Component | Path | State |
|---|---|---|
| Import CLI | `rise/tools/import-registry.mjs` | Tested; real source blocked without authorization |
| Import engine | `rise/src/importer.mjs` | Tested with synthetic fixtures |
| Identity | `rise/src/identity.mjs` | Stable opaque program and program-specialty IDs tested |
| Evidence | `rise/src/evidence.mjs` | Unknown and quarantined states preserved |
| Specialty semantics | `rise/src/specialties.mjs` | Exact and combined browse membership tested |
| Combined map | `rise/config/combined-specialties.v1.json` | Versioned local contract |
| Source policy | `rise/config/source-policy.v1.json` | FREIDA and Residency Explorer each require written authorization |
| Proposed migration | `rise/sql/001_rise_registry.proposed.sql` | Contract-tested only; never applied |
| Proposed down migration | `rise/sql/001_rise_registry.down.proposed.sql` | Intentionally raises an exception instead of destructive `CASCADE` |

The exporter validates the governance-pinned authorization record and the exact source-owner grant bytes before reading workbook bytes, then emits a schema-v2 inspection whose metadata contains the exact authorization-record hashes and a deterministic hash of every table. The importer revalidates those current pins and grant bytes, rehashes the inspection tables, requires exact authorization-lineage equality, validates a 196-column contract across 31 specialty tabs, normalizes identifiers, resolves only explicitly reviewed collisions, derives stable IDs, and preserves blank values as unknown. Runtime CLI overrides of dataset, collision-resolution, or combined-specialty governance are prohibited. The API-index builder independently verifies the release-manifest pin and every release-file hash. Before reading a source-controlled index, the runtime verifies a separately pinned index manifest and current source-authorization set; it also authenticates the web build and every asset.

## Corrected Source Artifact

- File: `MissionMed_RISE_Residency_Database_EVERY_SPECIALTY_GSHEETS.xlsx`
- File SHA-256: `c627397c69d2fad42c07a0b66951f3f3a4957a86c231d93a5bd925cdb2d87b9e`
- Deterministic content SHA-256: `40d86561cf08ff56ede703d999849740bad36ac536518da23495cbada1262494`
- Dataset configuration: `rise/config/dataset.v1.json`
- Classification: `source_controlled_registry`
- Release gate: `sourceRightsApproved = false`

The earlier unsuffixed workbook, SHA-256 beginning `1fd54a`, has a sparse-cell alignment defect and is not import-safe. An earlier offline-shadow receipt derived from the preliminary export, including release ID `rise_registry_2026-07-09_2f33a6616015`, is superseded and must not be promoted, published, or treated as a production migration receipt.

## Reconciled Structural Counts

These are structural source-inspection counts, not a production activation receipt.

| Record | Count |
|---|---:|
| Raw specialty-tab rows | 6,346 |
| Active specialty memberships after reviewed duplicate quarantine | 6,345 |
| Quarantined stale duplicate observation | 1 |
| Normalized unique programs | 6,139 |
| Additional combined browse memberships | 206 |
| Internal Medicine browse memberships | 828 |
| Exact Internal Medicine designations | 695 |
| Specialty tabs | 31 |

The reviewed collision is `1401900001 ` versus `1401900001` for the University of Kansas School of Medicine (Olathe). The rule is exact and does not permit generic name-based merging.

## Validation Evidence

- Importer policy tests prove source denial occurs before source reading.
- Exporter and importer tests prove the exact authorization lineage is bound to the inspection artifact and its table content is independently rehashed.
- Synthetic import tests cover identity stability, collision rejection, combined memberships, missing values, visa semantics, and editorial quarantine.
- API-index tests prove quarantined known claims do not inflate evidence coverage and release-file tampering fails closed.
- Nine SQL contract tests verify release-scoped composite keys and foreign keys, no cross-release provenance, `RELATED_SPECIALTY`, atomic active-release activation/history, lifecycle-locked snapshot inserts, least-privilege roles, prior-release rollback, and a fail-closed destructive down migration.
- Full local core suite: 66 passed, 0 failed.

## Proposed Production Model

The proposed design creates a dedicated `rise` schema with separate NOLOGIN reader, importer, and release-manager group roles. It stores release-scoped programs, specialties, browse memberships, source documents, claims, quarantine records, import runs, and append-only activation history. Snapshot inserts lock the parent release and are accepted only while it is offline or staging; activation is serialized through a security-definer function and immutable pointer. Browser-direct database access is not granted. Applicant-owned state, consent, integrations, and production RLS remain intentionally absent until their owners and privacy contracts exist. The proposal does not alter an existing MissionMed schema and was not applied to any database.

## Migration Gate

Migration requires all of the following: written AMA authorization for FREIDA use; separate AAMC authorization for any Residency Explorer content; an accountable RISE data owner; isolated staging and production database projects; reviewed RLS; approved secrets; rehearsed migration and backup; immutable release storage; and a tested activation rollback. None is currently available. The unrelated RankListIQ Supabase history must not be reused or repaired for RISE.

**Migration verdict:** `NOT_EXECUTED_EXTERNAL_AUTHORITY_AND_PLATFORM_BLOCKERS`
