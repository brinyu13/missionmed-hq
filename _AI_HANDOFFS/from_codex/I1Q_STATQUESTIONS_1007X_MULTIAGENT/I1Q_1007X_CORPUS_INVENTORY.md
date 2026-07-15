# I1Q-1007X Corpus Inventory

## Verdict

`REAL_CORPUS_INVENTORIED, EXTRACTION BLOCKED PENDING PRIVACY NORMALIZATION`

The authorized production Drills registry and its referenced transcript and nodes artifacts were read without mutation on 2026-07-15. No raw transcript text, title, filename, URL, personal name, or source object is stored in this report or the repository evidence.

## Authority

MissionMed OS decision `DR-006` authorizes read-only inventory and internal privacy-safe derivation from MissionMed-owned Dr. J drill sources. It does not authorize source mutation, public excerpts, public quotations, public clips, student-speech reuse, patient-identifying content, or student-facing publication.

## Registry Observation

Source route: canonical production Drills read API used by Daily Rounds. The endpoint address is intentionally omitted from repository evidence because its authority and consumer path are already recorded in the ecosystem map.

| Measure | Observed |
| --- | ---: |
| Registry rows | 97 |
| Registry SHA-256 | `d78910d22ed3b428fd38129ec60140b70673a804a31ae3119e465d75b53631a1` |
| Response bytes | 125,354 |
| Rows categorized `DRJ_DRILLS` | 97 |
| Rows with playback | 97 |
| Rows with nodes | 97 |
| Rows with transcript | 97 |
| Rows with all three | 97 |
| Empty video IDs | 0 |
| Duplicate video-ID groups | 0 |
| Earliest registry creation time | 2026-04-09T09:26:40Z |
| Latest registry creation time | 2026-07-06T17:31:20Z |

VERIFIED: the response was an array with the canonical consumer fields `video_id`, `title`, `playback_url`, `nodes_url`, `transcript_url`, `stream_id`, `subcategory`, `created_at`, Zoom timing fields, and metadata.

## Artifact Probe

Each transcript and nodes reference was fetched read-only. Only status, media type, byte count, hash, JSON shape, record count, record keys, timestamp coverage, and speaker-label coverage were retained.

| Measure | Transcripts | Nodes |
| --- | ---: | ---: |
| Requests | 97 | 97 |
| HTTP 200 | 97 | 97 |
| Failures | 0 | 0 |
| `application/json` | 97 | 97 |
| Distinct content hashes | 97 | 97 |
| Total bytes | 34,939,049 | 20,305,542 |
| Total records | 81,604 | 81,604 |
| Minimum records per source | 603 | 603 |
| Maximum records per source | 1,331 | 1,331 |
| Records with timestamp fields | 81,604 | 81,604 |
| Records with speaker labels | 81,604 | 81,604 |
| Records with text fields | 81,604 | 81,604 |
| Transcript/nodes pairs with identical file hash | 0 | 0 |

Transcript records expose `segment_id`, `speaker`, `start_time`, `end_time`, and `text`. Nodes records expose the same fields plus `node_id`.

The sanitized probe manifest SHA-256 is `ede9cc62aee72868cb4e2c96a9125bbc7be3403dbb7f3afe6b77c493bb79dae0`.

## Speaker Evidence

Speaker strings were evaluated in memory and retained only as truncated hashes and aggregate classes.

| Measure | Observed |
| --- | ---: |
| Multi-speaker sources | 97 |
| Single-speaker sources | 0 |
| Sources with explicit Dr. J speaker label | 96 |
| Sources with only generic Dr. J role evidence | 1 |
| Sources containing potential identity labels | 97 |
| Distinct speaker-label hashes | 146 |

VERIFIED: all sources require speaker-aware privacy processing before extraction.

VERIFIED: the interim privacy owner accepted authoritative `DRJ_DRILLS` registry metadata as sufficient for source-level `verified_drj` classification under `DR-006`. This is not segment-level attribution, medical credential verification, public-rights clearance, or permission to publish quotations.

VERIFIED: 96 sources have explicit speaker evidence that may support a restricted exact-match Dr. J segment allowlist after privacy gates pass. The one generic-only source retains zero segments unless an authoritative source-owner mapping is recorded.

## Enrichment Coverage

Forty-six registry records contain Zoom AI notes metadata with 651 topic entries and subject labels. They split evenly between Step 1 and Step 2 plus Step 3 designations, 23 each. Those metadata may help stratify the pilot, but titles, paths, note text, and source labels remain restricted until privacy normalization.

UNKNOWN: the remaining 51 sources have no observed Zoom AI notes metadata in this registry response. This does not imply the absence of other authorized metadata.

## Drive Discovery

The connected MissionMed Google Drive was searched read-only using both keyword and exact filename filters.

| Search | Filename matches |
| --- | ---: |
| `.vtt` | 0 |
| `transcript` | 0 |
| `drill` | 0 |
| `Dr. J` | 0 |
| `Daily Rounds` | 0 |

Keyword content search returned unrelated handoffs and operating artifacts, not corpus media or transcript files.

VERIFIED: no additional Drive corpus source was observed by these searches.

UNKNOWN: this is not proof that no Drive corpus exists. Search indexing, access scope, naming, and shared-drive boundaries may limit discovery.

## Classification and Readiness

| Gate | Current state |
| --- | --- |
| Real registry inventory | PASS |
| Transcript availability | PASS, 97 of 97 |
| Nodes availability | PASS, 97 of 97 |
| Source hash coverage | PASS, 97 of 97 for both artifact classes |
| Duplicate-ID check | PASS |
| Source-level Dr. J classification | PASS, 97 of 97 `verified_drj` |
| Segment-level Dr. J attribution | 96 potentially resolvable; 1 zero-retention; all blocked pending privacy gates |
| Working redacted transcripts | NOT CREATED |
| Student-speech removal | NOT RUN |
| Patient and third-party redaction | NOT RUN |
| Privacy gold pilot | NOT RUN |
| Extraction suitability | BLOCKED for all 97 |
| Public rights | NOT CLEARED |
| Internal derivation rights | AUTHORIZED by `DR-006` after privacy gates |

## State Result

State A `REAL_CORPUS_INVENTORIED` is technically demonstrated by canonical registration, an effective protected integration decision, a complete 97-row real registry inventory, and full referenced-artifact availability evidence.

This report does not claim State B. No privacy-safe working transcript or real candidate has been generated or stored.
