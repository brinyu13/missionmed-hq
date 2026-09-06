# I1Q 1006 Media Inventory

## Verdict

BLOCKED: A real Dr. J media inventory was not authorized by the currently routed governance evidence.

VERIFIED: No production registry, Stream, R2, CDN object, transcript URL, nodes URL, or transcript table was queried.

VERIFIED: No source registry was mutated.

## Safe repository counts

| Evidence class | Count | Meaning |
|---|---:|---|
| Checked-in VTT files | 0 | Not a real corpus count |
| Checked-in transcript/caption/subtitle data files | 0 | Not a real corpus count |
| Checked-in nodes/media-registry artifacts | 0 | Not a real corpus count |
| Seeded drill rows with Stream/VTT/nodes references | 1 | Reference only |
| Sidecar paths referenced by that seed | 2 | Referenced objects absent locally |
| Checked-in STAT runtime/index/lookup JSON files | 0 | Runtime is URL-backed |
| Matching historical Git blobs | 3 | Recovery clues only |
| Static v4 SQL insert statements | 845 | Legacy provenance, not media |

## Source path findings

- VERIFIED: Drills and Daily consume URL-backed `nodes_url` and `transcript_url` fields.
- VERIFIED: A transcript-chunk table and retrieval function exist in historical migration code, with no checked-in transcript row seed.
- VERIFIED: Historical docs mention R2 sidecars under `videos/v2/usmle/` and mark those paths obsolete or incomplete for current authority.
- VERIFIED: The repository's legacy registry helper is not current route authority.
- VERIFIED: A narrow Google Drive search for `I1Q Question Platform` found no result.
- VERIFIED: A narrow Drive search for `STAT Questions` returned unrelated files that were not opened.

## Required gate before GX-0

1. OPEN: Apply I1Q MissionMed OS registration.
2. OPEN: Assign a privacy owner.
3. OPEN: Approve the exact read-only registry export request.
4. OPEN: Establish rights authority and Dr. J verification rules.
5. OPEN: Provide an approved static export boundary and output location.

## Required inventory totals

UNKNOWN: Total videos, transcripts, VTTs, nodes, likely Dr. J, verified Dr. J, extraction-ready, privacy-blocked, rights-blocked, timestamp-blocked, duplicates, and inaccessible sources remain unknown.

VERIFIED: `evidence/inventory_report.json` records unknown real totals rather than fabricating them.
