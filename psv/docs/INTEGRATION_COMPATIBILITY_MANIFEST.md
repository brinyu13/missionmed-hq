# Integration Compatibility Manifest · ICM-PSV-0001

Machine-readable copy: `contracts/integration-compatibility-manifest.v1.json`. Status: PROTOTYPE. Updated 2026-09-20.

| Item | Value |
|---|---|
| Provider | **RISE** (residency-program intelligence: identity, stable IDs, evidence, provenance, freshness) |
| Consumer | **File Vault · Program-Specific PS** (`missionmed-file-vault-ps`, a sibling plugin behind File Vault) |
| Contract / version | **ProgramEvidenceBundle v1**, schema id `missionmed.rise.program-evidence-bundle.v1`, file `contracts/program-evidence-bundle.v1.schema.json` |
| Authority | Program facts and program identifiers: **RISE**. Personal statement documents: **File Vault**. No duplicate authority: the consumer caches a bundle for 10 minutes and keeps, per run, a snapshot of the exact bundle it wrote from, for audit only. It never edits or republishes program facts. |
| Data direction | RISE → File Vault: program data only. File Vault → RISE: a program id or search string, under the student's own session. Nothing else. |
| PS text allowed into RISE | **NO** |
| Student data inside the bundle | **NO** |
| Current transport | `FILE_VAULT_SESSION_FORWARDED_GET_V1`: server-side GET from WordPress to the existing RISE student routes (`/api/rise/v1/me/programs`, `/programs`, `/program-specialties/:id`), forwarding the user's own RISE session the same way the existing `/rise/` route proxy does. The consumer projects the answers into the contract. **No RISE change or deploy.** |
| Transport replaceable | **YES.** Boundary: `class-mmps-rise-client.php` (transport) and `MMPS_Evidence_Bundle::project()` (projection). Planned replacements: a RISE-native `GET /api/rise/v1/me/ps-evidence/:id` that returns the same schema (PSV-0002 PKT-3), or the Matrix ecosystem bus. Nothing else in the consumer knows how RISE is reached. |
| Auth | The end user's own RISE student session. No service credential, no shared secret, no cross-app database access. Consumer side: WordPress login plus the prototype allowlist; 404 outside it. |
| Identifiers | Program: `programSpecialtyId` (RISE, stable) plus `acgmeId`. Fact: `factId` = `F-` + 12 hex of sha256 over field and content (deterministic). Bundle: `bundleSha256`. Run: `runId` (UUID). Candidate: one server-enumerated `candidateId` in the immutable run output. Document: `docUuid` (UUID). ROOT: `rootId` + `textSha256` (+ File Vault file id, version number, version uuid, storage sha256). |
| Idempotency | RISE calls are GET. Every durable batch item has a unique generation key and reuses an already stored run after a retry/reload. `POST /library` is idempotent per `runId`. Versions are unique per (user, ROOT, program, version number). |
| Provenance | Per fact: origin, authority or provider, source URL(s), retrieved-at, age, claim id and content hash where the transport supplies them, rights note. Per run: bundle hash and snapshot, prompt version, complete candidate set, recommended candidate id, per-candidate validation, provider and model. Per document: run id, selected candidate id, recommended candidate id, candidate count, ROOT hash, bundle hash, registry release, facts used and normalization rule. |
| Versioning / deprecation | Additive change keeps v1. Removing or renaming a field, changing a meaning or changing fact-id derivation needs v2 with a new schema id. Consumers ignore unknown keys and refuse a bundle whose schema string they were not built for. A superseded version is served in parallel for at least one release cycle, and its retirement date is written here first. |
| Namespaces | REST `mmed-ps-proto/v1` · tables `{prefix}mmed_ps_proto_{roots,runs,library,audit,jobs,job_items}` · options `mmed_ps_proto_*` · constants `MMED_PS_PROTO_*` · transients `mmps_bundle_*` · events: none emitted; reserved prefix `ps.program_specific.*` |
| Shared tables / cross-app DB access | **NONE / NONE** |
| Future Matrix compatibility | Ready: contract-first schema, stable ids, explicit provenance, one replaceable adapter, one-way data flow, namespaced everything. To do when the ecosystem lands: register this manifest, swap the adapter, emit `ps.program_specific.*` events if wanted, move the allowlist to the ecosystem entitlement service. |

## Known gaps of the current transport

1. Research facts arrive without claim ids. Provenance is `factId` + field + provider + source URL + retrieved-at. A RISE-native route closes this.
2. `programType` and the registry fallback for `programDirector` come from registry survey fields. They are flagged `rightsNote: REGISTRY_SURVEY_FIELD` because the prose-use rights decision for those fields is not recorded (PSV-0002 Founder decision list). Research-sourced leadership is preferred whenever it exists and is current.
3. The student's private RISE notes are present in the `me/programs` answer. The adapter drops them before anything is stored, cached or returned; the harness asserts this.
