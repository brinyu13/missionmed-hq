# Authority and runtime inventory

Scope: current runtime, consumer, local baseline, and historical inventory surfaces.
Status: **observed and reconciled within current access**. Limitation: only the owner can
ratify corpus scope.

## Authority interpretation

Runtime observations outrank repository mirrors and historical exports. Within runtime,
the full registry is a universe-candidate surface; the drill endpoint is a filtered
consumer projection. Neither a category label nor a consumer route is a corpus attestation.

| Surface | Status | Observed scope | Count | What it does not prove |
|---|---|---|---:|---|
| Current full runtime registry | Observed twice; byte-stable | All current registry rows | 313 | Dr. J membership |
| Broad live candidate envelope | Derived from exact division predicate | Candidate sources | 105 | Canonical denominator |
| Current consumer projection | Observed twice; byte-stable | Active consumer-ready rows | 97 | Universe completeness |
| Local runtime baseline | Observed read-only | Lower-authority registry rows | 303 | Current runtime truth |
| Local candidate envelope | Same broad predicate | Lower-authority candidates | 95 | Canonical membership |
| Historical transcript index/database | Observed read-only | Broad historical sources | 509 | Dr. J scope or current state |
| Repository-only predecessor scan | Historical observation | In-repository files only | 698 inspected | Any external runtime corpus |

## Exact three-surface reconciliation

| Membership class | Count |
|---|---:|
| Live + consumer + local | 87 |
| Live + consumer, not local | 10 |
| Live + local, not consumer | 8 |
| Live only | 0 |
| Consumer outside live candidates | 0 |
| Local candidate outside live candidates | 0 |

This proves the current 97-row consumer set is a strict subset of the 105-row candidate
set. It also proves ten current live candidate identifiers are absent locally. It does not prove
that all 105 candidates were spoken by Dr. J or that no upstream source is missing.

## Current registry quality

The full runtime registry contained 313 unique identifiers, no duplicate identifier rows,
no invalid records, and no missing identifiers across both passes. All 105 nominated
candidates were active. Candidate metadata exposed 97 direct transcript references, 97
direct Nodes references, 103 transcript locator fields, 97 Nodes locator fields, and 103
cloud-video locator fields. Locator presence is not object availability.

The local baseline contained 303 unique rows with no local-only identifiers. All 303 occur
in the live registry; ten live records are absent locally. The local baseline is therefore
a useful reconciliation input, not the current authority.

## Lower-authority surfaces

- The local transcript store contains 286 transcript JSON files and 87 Nodes JSON files;
  every file is byte-unique within its class.
- A question-named export contains 19 JSON and 2 VTT artifacts. Eighteen JSON files are
  exact byte matches to the local transcript store; the one nonmatching JSON source is
  already represented in the current live registry.
- A historical index and immutable database each describe 509 broad sources and 40,197
  segment/index records. They are not Dr. J-scoped and cannot set the current denominator.

Evidence: the sanitized live receipt and lower-authority discovery receipt linked from
the handoff index.
