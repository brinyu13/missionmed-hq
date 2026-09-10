# Promotion and Projection Repair

- Added Claude Sonnet to the canonical provider vocabulary through migration 009.
- Extended the provider-neutral ingest/backfill adapter to Parallel, Claude Opus, and Claude Sonnet.
- Reconciled research artifacts to canonical ACGME identities with dedupe-safe source and claim writes.
- Kept approved current facts and pending claims in separate response collections.
- Projected approved canonical registry fields into the live Program File API and all six Program File tabs.
- Added approved registry fields to card/search indexes without hard-coded program lists.
- Added pending-evidence metadata using field names/counts/provider/timestamps only; unreviewed values are never returned to students.
- Newly approved canonical current facts become visible through the same serving path without a frontend program-list release.

Live current-fact readback: 883 approved SOAP facts; 0 approved provider-derived research facts. No approved provider fact is stranded upstream.
