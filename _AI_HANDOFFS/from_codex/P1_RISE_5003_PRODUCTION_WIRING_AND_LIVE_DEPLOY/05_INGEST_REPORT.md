# 05 — Ingest Report

## Production Ingest

`INGEST_EXECUTED = NO`

No canonical or provider data was mutated. The full registry cannot be activated without a source-owner authorization set, validation receipt, database owner, backup/restore evidence, and P1-RISE-5003 authority route.

## Safe Work Completed

- Discovered the canonical identity and coverage counts without publishing the source rows.
- Preserved ACGME-first/exact-specialty identity rules in the importer and schema.
- Retained quarantine and source-rights fail-closed controls from the isolated donor service.
- Added a single authenticated catalog bootstrap so a future active release can hydrate the locked Find Programs UX without hundreds of rate-limited requests.
- Kept every student bundle free of static program intelligence.
- Kept all research/corpus gaps as UNKNOWN, NOT YET VERIFIED, NOT PUBLISHED, or integration unavailable.

## Counts

```text
PROGRAMS_VISIBLE_COUNT_LIVE = 0
PROGRAMS_WITH_DEEP_RESEARCH_COUNT_LIVE = 0
DISCOVERED_NORMALIZED_UNIQUE_PROGRAM_IDS = 6139
DISCOVERED_ACTIVE_UNIQUE_IM_ACGME_IDS = 828
DISCOVERED_CANONICAL_FM_ROWS = 821
SYNTHETIC_BROWSER_FIXTURE_PROGRAMS = 4 (test-only, never production)
```

These discovery counts are not a live ingest receipt.
