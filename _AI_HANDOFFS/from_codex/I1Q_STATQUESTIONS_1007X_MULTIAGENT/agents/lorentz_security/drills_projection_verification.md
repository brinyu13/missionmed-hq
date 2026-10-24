# I1Q-1007X Drills Projection Verification

Verdict: BLOCKED, ADAPTER CONTRACT NOT IMPLEMENTED

Date: 2026-07-15

## Authority Context

DR-006 resolves the earlier policy question: I1Q may emit read-only Drills adapter artifacts, must represent transcript, VTT, and nodes availability explicitly, and must not mutate Drills ingestion. The original authority uncertainty was a root-recovery snapshot finding addressed by DR-006 and MissionMed OS PR #12.

## Current Consumer Contracts

| Consumer | Required today | Transcript behavior | Evidence |
| --- | --- | --- | --- |
| Daily Rounds | `video_id`, `title`, `playback_url`, `nodes_url`, `transcript_url` | Non-empty HTTPS or local URL required | `LIVE/daily.html:2511-2543` |
| Arena drill registry | Same five fields | Non-empty HTTPS URL required | `LIVE/arena.html:10560-10622` |
| Drills player | `video_id`, playback URL or stream ID, and `nodes_url` | Missing transcript is non-blocking; invalid supplied URL warns | `LIVE/drills.html:6638-6682`, `9535-9565` |

Daily/Arena and the Drills player therefore do not share one transcript requirement. A single ambiguous nullable URL cannot safely represent both contracts.

## Candidate Artifact

The candidate emits only:

- `item_revision_id`
- `prompt`
- `concept_id`
- `source_ids`
- `review_status`

Evidence: `i1q-question-platform/src/exports.mjs:120-126`.

It omits every runtime delivery field and all explicit source-availability, timestamp, rights, privacy, and source-hash state. It cannot be consumed by current Drills, Daily, or Arena.

## Proposed Versioned Drills Adapter

A proposed `i1q.drills.adapter.v1` record should include:

| Field | Purpose |
| --- | --- |
| `contract_version` | Pins adapter semantics |
| `release_id` | Immutable release source |
| `item_revision_id` | Exact internal question revision |
| `video_id` | Canonical source video identity |
| `title` | Consumer display title |
| `playback` | `{availability, url, stream_id}` |
| `nodes` | `{availability, url, source_hash}` |
| `transcript` | `{availability, url, source_hash}` |
| `vtt` | `{availability, url, source_hash}` |
| `remediation` | `{start_seconds, end_seconds}` |
| `rights_status` | Must permit intended internal use |
| `privacy_status` | Must pass the working-artifact gate |
| `source_record_id` | Internal lineage; never student-visible |

Proposed availability values are `available`, `missing`, `restricted`, `invalid`, and `unknown`. An `available` value requires a validated location and matching source hash. A null URL without a status is invalid.

## Consumer-Specific Projection Rules

### Drills

- Playback must be available through URL or stream ID.
- Nodes must be available and parse to a non-empty supported payload.
- Transcript and VTT may be explicitly unavailable without blocking the player.
- Timestamp remediation must be suppressed when the referenced source is unavailable, restricted, or hash-mismatched.

### Daily/Arena

- Do not route the proposed adapter directly into current registry functions.
- Their existing five-field URL contract rejects missing transcript URLs.
- Any relaxation requires a separately approved, backwards-compatible consumer adapter and protected regression suite.

## Rights and Privacy Gates

No adapter row is eligible when:

- Rights are unverified, restricted for the intended use, or expired.
- Privacy is blocked or the source lacks a passing redaction record.
- The source is raw rather than a privacy-safe working artifact.
- Dr. J identity is only likely but the UI would present it as verified.
- A timestamp or URL points outside the approved source lineage.

## Required Tests

- Drills success with playback and nodes available and transcript explicitly missing.
- Drills rejection for missing, invalid, empty, or hash-mismatched nodes.
- Daily/Arena rejection for absent transcript under the current contract.
- Flat nodes arrays and supported `drill_nodes`, `drillNodes`, and `nodes` wrappers.
- Supported transcript segment/chunk wrappers and aliases.
- Invalid URL schemes, cross-boundary URLs, and open redirects.
- Restricted rights, failed privacy, raw source, and stale hash rejection.
- Read-only proof against every source system.
- Drills ingestion state unchanged before and after the adapter test.
- Drills and student consumer flags remain OFF.

## Final Assessment

The Drills artifact is a placeholder internal question list, not a compatibility adapter. No Drills or Daily staging claim is supportable until the versioned availability contract and its protected consumer tests exist.
