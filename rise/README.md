# MissionMed RISE

This directory contains the isolated production-candidate foundation for RISE. It does not modify or deploy the protected MissionMed HQ, WordPress, Matrix, ACTN, CAM, StoryForge, Railway, or Supabase runtimes.

## Registry Import

The importer consumes a deterministic NDJSON inspection produced from the canonical 31-specialty workbook. It can create an immutable offline-shadow release with stable program identities, exact specialty designations, combined-program browse memberships, source documents, field claims, and a validation manifest only when current written source authorization is governance-pinned.

```bash
node rise/tools/export-workbook-inspection.mjs \
  --source /absolute/path/to/canonical.xlsx \
  --out /absolute/path/to/canonical.inspect.ndjson \
  --freida-authorization /absolute/path/to/reviewed-ama-authorization.json \
  --freida-grant /absolute/path/to/ama-source-owner-grant
```

```bash
node rise/tools/import-registry.mjs \
  --inspect /absolute/path/to/workbook.inspect.ndjson \
  --freida-authorization /absolute/path/to/reviewed-ama-authorization.json \
  --freida-grant /absolute/path/to/ama-source-owner-grant \
  --residency-explorer-authorization /absolute/path/to/reviewed-aamc-authorization.json \
  --residency-explorer-grant /absolute/path/to/aamc-source-owner-grant \
  --out rise/data/releases
```

An authorization record must identify and hash the source-owner grant, carry a MissionMed approval decision, and match the exact SHA-256 pinned in `dataset.v1.json`. The grant file bytes must also match the hash in that approved record. The current pin is deliberately `null`, so the canonical workbook is blocked before the inspection is opened. Supplying caller-authored files or runtime governance-config overrides cannot open the gate.

After an authorized import, hash `release.json` and pass that independent pin to the API-index builder:

```bash
node rise/tools/build-api-index.mjs \
  --release-dir /absolute/path/to/release \
  --release-manifest-sha256 <sha256> \
  --out /absolute/path/to/indexes
```

The builder rechecks authorization expiry/revocation, the pinned release manifest, and every release file hash. The server independently rechecks source authorization and index pins before source-controlled data can be served.

The July 9 source and corrected active baseline must reconcile exactly:

- 6,346 raw specialty-tab source rows
- 6,345 active specialty memberships
- 1 preserved quarantined stale/malformed duplicate observation
- 6,139 normalized unique program identifiers
- 206 additional combined-program browse memberships
- 828 Internal Medicine browse memberships
- 695 exact Internal Medicine designations
- 31 specialty tabs

Legacy ordinal `RISE_ID` values are aliases only. Missing claims remain unknown. Any authorized release produced from the current workbook must enable zero hard-matchable claims because its cells do not carry current-cycle upstream field locators.

## Source Policy

FREIDA values are labeled as dated, program-reported census data. FREIDA and Residency Explorer ingestion are each blocked unless a separately reviewed, current written authorization record from the applicable owner explicitly permits creating or supplementing the RISE database.

## Runtime Authentication

Local preview uses a synthetic fixture on a loopback address only. A hosted runtime must set `RISE_AUTH_MODE=injected`, provide `RISE_AUTH_ADAPTER_MODULE`, and return a host-authenticated session with audience `rise` plus `rise:read` (and `rise:operator` where needed). Browser bearer tokens are rejected. Production is detected from either `NODE_ENV=production` or `RISE_ENVIRONMENT=production` and requires `RISE_INDEX_SHA256`, `RISE_INDEX_MANIFEST_PATH`, `RISE_SOURCE_AUTHORIZATION_SHA256S`, `RISE_ASSET_MANIFEST_SHA256`, an authenticated web asset manifest, and `RISE_ABUSE_ADAPTER_MODULE` exporting a shared durable abuse-controller factory. `RISE_REVOKED_SOURCE_AUTHORIZATION_SHA256S` immediately blocks listed authorization records.

## Tests

```bash
node --test rise/tests/*.test.mjs
npm run test:rise:browser
```
