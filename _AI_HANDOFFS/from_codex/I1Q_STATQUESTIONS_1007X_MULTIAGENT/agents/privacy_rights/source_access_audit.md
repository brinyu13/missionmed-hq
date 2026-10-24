# Source Access Audit

Status: READ-ONLY EVIDENCE REVIEW COMPLETE; EXTRACTION NOT AUTHORIZED
Date: 2026-07-15
Artifact zone: evidence-only

## Scope and Method

This specialist reviewed the pinned authority and three local evidence artifacts only. No source system, registry, media object, transcript endpoint, notes service, Drive file, application, database, production data, feature flag, or deployment target was mutated. Source strings were not copied into these outputs.

## Evidence Integrity

| Evidence class | SHA-256 | Safe observations |
|---|---|---|
| Authorized registry export | `d78910d22ed3b428fd38129ec60140b70673a804a31ae3119e465d75b53631a1` | 97 records; one authoritative corpus category; playback, nodes, and transcript available for every record; no empty or duplicate media IDs; bounded creation-date range |
| Sanitized artifact probes | `ede9cc62aee72868cb4e2c96a9125bbc7be3403dbb7f3afe6b77c493bb79dae0` | 97 transcript and 97 node responses; all successful JSON; complete timestamp, speaker, and text fields |
| Hashed speaker probes | `f7d1edb339d7a2821007439f97bb70d74c2d213c8596ed43dec5b30187b87db4` | 97 multi-speaker sources; 96 explicit Dr J-label sources; one generic-only source; 146 distinct label hashes; potential identity labels in every source |

Both supplied evidence digests matched the local artifacts. The hashed-speaker evidence digest was computed during this audit and is recorded above.

## Artifact Probe Results

The sanitized evidence records a prior read-only probe, not a new network access by this specialist:

- 194 total GET observations: 97 transcript and 97 node artifacts.
- Every response was HTTP 200 with `application/json` content.
- Each artifact contained 603 to 1,331 records.
- Transcript artifacts totaled 81,604 records; node artifacts separately totaled 81,604 records.
- Every record in both families had timestamps, a speaker label, and text.
- Transcript records had one stable five-key schema; node records had the same logical fields plus a node identifier.
- There were 97 distinct transcript hashes and 97 distinct node hashes. No transcript/node pair was byte-identical.

Availability and schema completeness do not establish privacy safety, correct speaker attribution, or extraction eligibility.

## Supplemental Discovery

Restricted notes metadata was observed for 46 registry records with 651 topic entries. Its strings were not reviewed or reproduced here, and it is excluded from extraction pending the same restricted-zone handling and privacy gates.

Read-only Drive discovery observed no additional relevant corpus source. The filename query produced no relevant candidate and the content results were unrelated handoff material. This is recorded only as **no additional corpus sources observed**; it is not proof that none exist.

## Access-Control Findings

1. DR-006 authorizes read-only internal inventory and derivation from the governed MissionMed corpus.
2. Raw sources remain restricted and may not flow directly into extraction, logs, Git, evidence artifacts, or public outputs.
3. Existing candidate privacy code is not an accepted control: it co-exposes raw and redacted text, omits required classes, and permits aggregate masking of zero recall.
4. All 97 sources must remain quarantined from extraction until a compliant working copy and fail-closed pilot pass.
5. Public transcript excerpts, quotations, and media clips remain disabled without a current Rights Record.

## Audit Outcome

Read-only source availability is evidenced with high confidence. Privacy-safe source access for extraction is not evidenced. Access verdict: `BLOCK` for extraction; `ALLOW` only for continued least-privilege inventory and restricted privacy engineering under DR-006.
