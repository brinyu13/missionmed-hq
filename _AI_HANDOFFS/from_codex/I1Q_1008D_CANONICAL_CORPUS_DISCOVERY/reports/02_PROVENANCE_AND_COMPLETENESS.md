# Provenance and completeness

Scope: corpus-membership evidence and completeness grading. Status: **C1_OBSERVED**.
Limitation: no owner-signed scope receipt or upstream object-listing receipt is available.

Abbreviations: Cloudflare R2 object storage (R2), MissionMed Headquarters/Content Intelligence
Engine (HQ/CIE), and Hash-based Message Authentication Code (HMAC).

## Completeness grades

| Grade | Meaning | Current result |
|---|---|---|
| C0_UNKNOWN | No usable inventory | Passed |
| C1_OBSERVED | Current candidate surfaces enumerated and internally reconciled | **Current grade** |
| C2_ATTESTED | Named owner ratifies scope predicate, denominator, exclusions, and snapshot | Blocked |
| C3_RECONCILED | Attested roster reconciles row-wise with runtime, R2, database, HQ/CIE, and artifacts | Blocked |
| C4_EXTRACTION_READY | Every member has authorized primary artifacts, privacy/rights clearance, and speaker authority | Blocked |

The 105 live candidates are a privacy-safe **universe candidate manifest**, not a canonical
corpus manifest. The predicate was selected to avoid the prior authority inversion, but it
is intentionally broader than the consumer route and remains unratified.

## Provenance chain established

For the current snapshot, the safe receipt binds:

1. two byte-stable reads of the full runtime registry;
2. two byte-stable reads of the consumer projection;
3. a read-only local baseline reconciliation;
4. one canonical derived artifact location per candidate and artifact class;
5. HEAD/GET status, byte hash, size, schema fingerprint, structural counts, timestamp
   coverage, and safe identity-binding class;
6. per-run keyed aliases that permit within-receipt joins without exposing identifiers.

This establishes current observation provenance. It does not bind an owner decision,
source-specific rights, historical completeness, or a pinned full-artifact snapshot. The
list bodies were double-scanned; artifacts and the local baseline were read once.

## Why common counts are not completeness proof

- 97 is the consumer projection and therefore cannot define its own upstream universe.
- 105 is a broad metadata predicate and lacks owner ratification.
- 95 is the local baseline candidate count; ten current live candidate identifiers are absent locally.
- 509 and 40,197 belong to a broad historical index and database, not a Dr. J scope.
- 286 local transcript JSON files include other divisions/categories and cannot be added
  to live counts without identity reconciliation.
- Source/category labels describe routing or collection membership, not segment speaker.

Counts from overlapping surfaces must never be added. Only identity-joined set operations
are permitted; the receipt performs those joins inside a zero-retention boundary.

## Exact missing completeness evidence

A C2 claim requires a named corpus owner to supply or sign:

- an inclusion/exclusion predicate and the business meaning of “complete Dr. J corpus”;
- the effective snapshot time and expected update policy;
- an opaque, stable source roster with denominator and exclusion reasons;
- the relation between session, video, transcript, and Nodes artifacts;
- whether the eight non-consumer candidates belong and how to treat the six artifact-empty sources;
- a privacy-safe stable-alias mechanism inside an approved restricted boundary.

C3 then requires row-wise reconciliation against mediated R2 listing, exact Supabase
project/index pin, and authenticated HQ/CIE inventory. Without those receipts, “all Dr. J
questions extracted” would be an unsupported claim.

Per-run HMAC roots are opaque within-run commitments. Because the key is erased, they are
intentionally non-recomputable and non-correlatable after the run; successor validation must
recompute counts in a fresh restricted run rather than compare aliases across runs.
