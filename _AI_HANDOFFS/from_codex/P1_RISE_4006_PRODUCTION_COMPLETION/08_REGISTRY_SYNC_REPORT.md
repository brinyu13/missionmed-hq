# P1 RISE 4006 Registry Sync Report

## Canonical Source

- Google Sheet ID: `1sHpiFtlQgCZMN9eIR5ZtudyErPP9OkFAeCiXPmQ8uVA`
- Sheet: `MissionMed RISE Residency Database`
- Active connected account verified: `info@missionmedinstitute.com`
- Locale/timezone: `en_US` / `America/New_York`
- Tabs: 31 specialty tabs plus `Reference Lists`, `Data Dictionary`, and `Change Log`
- Specialty width: 196 columns
- Corrected local export: `MissionMed_RISE_Residency_Database_EVERY_SPECIALTY_GSHEETS.xlsx`
- Corrected file SHA-256: `c627397c69d2fad42c07a0b66951f3f3a4957a86c231d93a5bd925cdb2d87b9e`

Drive metadata and local workbook inspection agree on the canonical sheet identity and tab structure. Grid row capacity is not treated as populated-row count.

## Source-Rights Finding

The workbook contains source-controlled FREIDA material. The current AMA Terms of Use restrict use to personal, noncommercial purposes and prohibit incorporation into an information-retrieval system or reproduction without written consent. The AAMC Residency Explorer Terms, updated April 8, 2026, separately prohibit copying or exporting material to create or supplement a database, product, service, or AI system without written authorization.

- AMA terms: `https://www.ama-assn.org/about/terms-use`
- AAMC terms: `https://students-residents.aamc.org/applying-residency/residency-explorer-terms-and-conditions`
- FREIDA FAQ: `https://freida.ama-assn.org/faq`

An authenticated browser session or public page does not override those terms. MissionMed has not supplied either required written authorization record.

## Enforced Sync Contract

The import command requires reviewed authorization documents:

```bash
node rise/tools/import-registry.mjs \
  --inspect /absolute/path/to/workbook.inspect.ndjson \
  --freida-authorization /absolute/path/to/reviewed-ama-authorization.json \
  --freida-grant /absolute/path/to/ama-source-owner-grant \
  --residency-explorer-authorization /absolute/path/to/reviewed-aamc-authorization.json \
  --residency-explorer-grant /absolute/path/to/aamc-source-owner-grant \
  --out rise/data/releases
```

Only authorization declared by repository governance for the intended material is accepted, and FREIDA authorization is required for this workbook. The record must identify the provider/product, authorization ID and reference, SHA-256 of the source-owner grant, allowed use, effective and expiry dates, and a separate MissionMed decision record/reviewer/date. Its complete bytes must match the exact SHA-256 pinned in `dataset.v1.json`, and the supplied grant bytes must match the hash inside that record; the current governance pin is intentionally `null`. Dataset, collision-resolution, and combined-specialty config cannot be overridden at runtime. Missing, expired, revoked, scope-mismatched, unreviewed, caller-authored-only, or hash-mismatched authorization fails before workbook bytes are read.

## Corrected Artifact Finding

The preliminary unsuffixed workbook is not import-safe because sparse cells were shifted during export. The corrected `_GSHEETS.xlsx` export is now pinned in `rise/config/dataset.v1.json`. The replacement exporter uses declared `exceljs` parsing, preserves all 196 sparse column positions, and writes a schema-v2 inspection with deterministic content and authorization hashes. The candidate intentionally did **not** generate a real-data release from the workbook because source rights are not approved. Synthetic fixtures are the only data exercised by importer, browser, and stress tests.

## Refresh Invariants

Every future authorized refresh must preserve the prior immutable snapshot; record source and content hashes; normalize identifiers before counting; preserve exact and combined specialty identity; quarantine unresolved collisions; retain unknowns; keep retrieval, survey, update, and review dates distinct; emit evidence-coverage changes; prohibit silent deletion; and validate an inactive release before atomic activation.

## Result

- Structural source inspection: `COMPLETE`
- Corrected artifact pinning: `COMPLETE`
- Pre-read, hash-pinned, expiring/revocable source gate: `PASS`
- Real-data import: `BLOCKED_BEFORE_READ`
- Production sync: `NOT_EXECUTED`
- Production activation: `NOT_EXECUTED`

**Registry sync verdict:** `EXTERNAL_SOURCE_AUTHORIZATION_REQUIRED`
