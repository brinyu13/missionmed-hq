# MissionMed RISE

This directory contains the isolated Founder-review candidate for RISE. It does not modify or deploy the protected MissionMed HQ, WordPress, Matrix, ACTN, CAM, StoryForge, Railway, Cloudflare, MissionMed OS, or Supabase runtimes.

## Isolated Service Package

RISE has its own package boundary, lockfile, pinned container recipe, and Railway config under `rise/`. A future approved Railway service must use `/rise` as its service root and `/rise/railway.json` as its config path. The contracts in `deployment-contract.v1.json` and `route-contract.v1.json` prevent the service from falling through to the shared HQ entrypoint, require an approved same-origin reverse proxy, and record every production pin. They are reviewable deployment blueprints only; no RISE Railway service or edge route currently exists.

```bash
cd rise
npm ci
npm test
npm run build
npm run test:browser
```

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

## Production Runtime

Local preview uses a synthetic fixture on a loopback address only. A hosted runtime uses the concrete HQ introspection adapter in `adapters/hq-auth.mjs`; it accepts only the named HQ session cookie, binds issuer and audience exactly to `rise`, rejects browser bearer tokens, and exposes no email or upstream access token. State-changing requests require the session CSRF token. The signed-out shell is public, while every registry and operator API remains authenticated and capability-gated.

`tools/start-production.mjs` downloads the API index, index manifest, activation receipt, and web asset manifest into a new temporary runtime directory. Each artifact is fetched from the configured same-origin HTTPS origin with the dedicated artifact credential and is size- and SHA-256-verified before the server starts. The server independently revalidates the release, manifest, activation receipt, current source-authorization set, and every web asset hash. Production also requires the shared durable abuse adapter in `adapters/http-abuse.mjs`, the live source-rights controller in `adapters/http-source-rights.mjs`, an HMAC audit key, a verified activation decision, and the exact environment listed in `deployment-contract.v1.json`. The container filesystem must be read-only except for an ephemeral runtime directory such as a `/tmp` tmpfs; application code and web assets remain root-owned while the service runs as the unprivileged `node` user.

```bash
cd rise
npm run start:production
```

That command is intentionally fail-closed today because the real source-authorization pins, activation receipt, runtime artifacts, service secrets, and approved route do not exist.

Cross-product contracts live in `contracts/`. Matrix projections are consent- and purpose-bound; ACTN and StoryForge payloads carry references without copying canonical content; all owner activation statuses remain disabled until their respective owners approve and implement them.

## Proposed Database Migrations

`001_rise_registry.proposed.sql` defines immutable, release-scoped registry data and atomic activation. `002_rise_app_and_audit.proposed.sql` defines private session, consented Matrix projection, saved/compare, assessment, handoff, operator-queue, append-only audit, and recovery-checkpoint planes. `003_rise_release_security_hardening.proposed.sql` binds each source receipt and validation receipt to the release's attested authorization-set hash, rejects future-dated activation evidence, hides an active release after an append-only source-rights revocation, binds sessions to the complete authorization identity, serializes predecessor order for externally computed HMAC audit records, and limits registry readers to active non-quarantine views. The database does not independently recompute the authorization-set hash or audit HMAC values. All app tables remain RLS-enabled and forced with no policies or runtime grants until approved owners install narrowly scoped policies. Every down migration refuses destructive weakening.

The three migrations and activation/rollback behavior can be rehearsed only in a new disposable PostgreSQL database using `tests/fixtures/postgres-rehearsal.sql`. They must not be applied to any shared or production database without database-owner approval, a backup, and an independently proven rollback point.

## Tests

```bash
cd rise
npm test
npm run test:browser
node tests/stress-synthetic.mjs
```

The browser command builds and tests the authenticated `dist` artifact, including the selected official Lucide icon bundle. The stress harness uses synthetic programs, consumes complete response bodies, and does not establish production capacity.
