# Registry Refresh Contract

Implementation: rise/tools/refresh-acgme-registry.py

Inputs:

- Existing immutable RISE API index.
- Dated text exports of ACGME ADS Public Reports 1 and 8.
- Explicit source URLs, source hashes, source-checked date, and academic year.

Behavior:

1. Parse current programs and newly accredited rows.
2. Restrict to the existing RISE-supported report-code universe.
3. Reconcile by exact ACGME Program ID.
4. Preserve every existing RISE identity and all richer research fields.
5. Add missing current programs as honest Basic Profile / Research Pending records.
6. Attach accreditation status, effective date, academic year, source URL, source check date, and newly-accredited state.
7. Emit deterministic current-universe diff, added-program list, zero-spend research queue, source snapshot, release manifests, and checksums.
8. Fail closed on missing source/report codes, implausibly small current universe, identity collisions, or destructive shrink.
9. A second run is idempotent and creates no duplicates.

Cadence recommendation: daily during application season, with promotion only after the same validation gates pass. Students are served from the local immutable release; ACGME is not queried per request.

The tested command is ready for scheduling, but scheduler perfection did not delay the P0 live reconciliation.
