# Artifact integrity and duplicates

Scope: canonical CDN JSON availability, structure, timestamp coverage, and byte identity.
Status: **probe complete for 105 candidates**. Limitation: byte identity is not semantic
equivalence and artifact availability is not corpus authority.

Abbreviations: content delivery network (CDN), JavaScript Object Notation (JSON), and
Cloudflare R2 object storage (R2).

## Availability result

| Artifact class | Probe-defined checks | Available | Not found at pinned CDN location | Unique byte hashes | Primary records | Records with at least one recognized timestamp field |
|---|---:|---:|---:|---:|---:|---:|
| Transcript JSON | 105 | 97 | 8 | 97 | 81,604 | 81,604 |
| Nodes JSON | 105 | 99 | 6 | 99 | 82,510 | 82,510 |
| Total | 210 | 196 | 14 | 196 across class-qualified artifacts | 164,114 | 164,114 |

Per-source pairing:

- 97 sources have both transcript and Nodes artifacts;
- 2 have Nodes only;
- 6 have neither;
- 0 have transcript only.

Two transcript metadata references were malformed or outside the pinned canonical mapping.
The probe did not follow them. It separately checked the exact runtime-documented canonical
location, which returned not found. No valid direct-reference conflict was observed.

All 97 transcript payloads corroborated their source identity internally. Of the 99 Nodes
payloads, 97 corroborated identity internally and 2 were locator-bound because the payload
did not declare an identity. Locator-only is structurally usable evidence, not a source
authority decision.

## Duplicate result

The current live artifact sweep found:

- 0 byte-identical duplicate clusters among 196 available artifacts;
- 97 unique transcript body hashes for 97 transcript bodies;
- 99 unique Nodes body hashes for 99 Nodes bodies.

This rules out exact byte duplication in the current available candidate artifacts. It
does **not** rule out semantically equivalent transcripts, duplicate sessions with different
serialization, overlapping excerpts, or repeated questions. Semantic deduplication was not
performed because extraction and speaker authority are blocked.

The lower-authority local store similarly has 286 unique raw transcript hashes and 87
unique raw Nodes hashes. The separate question-named JSON export has 19 unique hashes, of
which 18 are exact overlaps with the local transcript store. Those overlaps prove mirror
duplication, not additional corpus members.

## Integrity boundaries

- JSON schema recognition and timestamp presence do not validate transcript accuracy.
- Timestamp coverage means at least one recognized field per primary record; it does not
  validate complete, ordered, or accurate start/end intervals.
- Record-count equality between transcript and Nodes is not assumed; the two extra Nodes
  sources account for a larger Nodes record total.
- Content hashes prove bytes only and are never used for semantic merging.
- A pinned-location not-found response does not prove absence from R2 or alternate storage.
- No transcript text, source location, title, identifier, or speaker string was retained.
