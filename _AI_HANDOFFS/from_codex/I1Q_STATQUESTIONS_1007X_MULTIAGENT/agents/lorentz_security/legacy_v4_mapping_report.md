# I1Q-1007X Legacy v4 Mapping Report

Status: AUTHORIZED DESIGN, STATIC EXPORT NOT INSPECTED IN THIS AUDIT

Date: 2026-07-15

## Authority Context

DR-006 authorizes a read-only hashed static export of canonical legacy v4 questions and necessary non-student aggregate exposure metadata. It also resolves `question_metadata` compatibility in favor of composite `dataset_version` plus `question_id` semantics. These were snapshot-time authority blockers during root recovery and are now addressed by DR-006 and MissionMed OS PR #12.

No v4 export rows or production student attempts were read for this baseline. No count, quality, medical accuracy, duplicate rate, or migration-completeness claim is made here.

## Immutable Source Identity

Every imported source row must retain:

`(dataset_version, question_id, content_hash)`

For v4, `dataset_version` remains `v4`. The canonical source row is never edited, renumbered, corrected in place, or republished under a changed meaning.

## Required Internal Mapping

A versioned import map should record at least:

| Field | Requirement |
| --- | --- |
| `import_type` | Fixed legacy-v4 identifier |
| `source_dataset_version` | `v4` |
| `source_question_id` | Original question identity |
| `source_content_hash` | Hash of the authorized static row under the approved v4 hashing rule |
| `item_id` | New stable semantic item identity |
| `itemrev_id` | Immutable imported revision identity |
| `revision_number` | Starts at 1 for the exact import |
| `item_content_hash` | Canonical I1Q revision hash |
| `legacy_import` | `true` |
| `lineage_status` | Complete, partial, or incomplete; never fabricated |
| `disposition` | Quarantined, retro-review, replacement candidate, retired, or rejected |
| `created_at` | Immutable import timestamp |

The import map itself is immutable. A correction creates a new Item Revision or replacement relationship.

## `question_metadata` Compatibility

The current legacy table was reported to key only on `question_id`, which can collide across dataset versions. I1Q must not silently rewrite that protected table.

The approved compatibility boundary is:

- I1Q projection identity: `(dataset_version, question_id)`.
- I1Q historical identity: `(dataset_version, question_id, content_hash)`.
- A versioned adapter or sidecar mapping translates for each consumer.
- Any legacy consumer that can accept only `question_id` must receive an explicit collision analysis and migration decision before cutover.

## Old Attempt Compatibility

A successful mapping must prove that an old attempt continues to resolve to the exact question content that existed when the attempt was recorded. The join must not select a newer revision merely because it shares an item or question ID.

Required staging cases:

- Same `question_id` in two dataset versions resolves to two distinct records.
- Same source identity and hash is idempotent.
- Same source identity with a different hash is a blocking conflict, not an overwrite.
- Replacement and retirement preserve old attempt display.
- Corrective release does not mutate the original attempt's content join.
- Missing or ambiguous mapping fails closed and emits an internal incident finding.

## Release Eligibility

Import does not create medical truth or approval. Every legacy revision remains ineligible for a new release until it has:

- Current Evidence Claims.
- Editorial review.
- Exact credentialed physician review.
- No unresolved conflict or safety flag.
- Rights and privacy clearance.
- Complete release validation.

Medical governance is unassigned, so approved release eligibility remains blocked.

## Candidate Gaps

- The candidate does not execute an authorized v4 import.
- `buildReleaseArtifacts` can synthesize ordinal projected IDs rather than use a persistent mapping.
- The lookup object keys only on `question_id` and can overwrite duplicates.
- Release snapshots do not pin complete internal identity tuples.
- Historical attempt joins have not run against preview or staging.

## Verdict

The mapping design is now authorized, but legacy-v4 reconciliation remains unexecuted and unverified. No legacy content may enter an I1Q release based on the current candidate alone.
