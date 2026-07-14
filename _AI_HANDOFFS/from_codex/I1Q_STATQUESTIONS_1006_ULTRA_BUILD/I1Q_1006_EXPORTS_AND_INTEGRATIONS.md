# I1Q 1006 Exports and Integrations

## Frozen STAT projection

VERIFIED: `projectStatDatasetQuestion` emits exactly and in order:

1. `dataset_version`
2. `question_id`
3. `prompt`
4. `choice_a`
5. `choice_b`
6. `choice_c`
7. `choice_d`
8. `answer`
9. `explanation`

VERIFIED: A test rejects field-order drift.

## Single-manifest rule

VERIFIED: One release snapshot generates all artifacts and one manifest hash.

Implemented artifact contracts:

- `stat_dataset_questions`, server only
- `stat_pre_answer`, no answer or explanation
- `stat_post_answer_debrief`, finalization gated
- `stat_indexes`
- `stat_lookup`
- `question_metadata`
- `drills`
- contract-only future channels for Daily Rounds, TournaMed, Arena, custom tests, Faculty Mode, and Mentor Mode

VERIFIED: Artifact hashes are deterministic SHA-256 hashes of canonical JSON.

VERIFIED: Manifest includes previous-manifest hash for a version chain.

VERIFIED: Pre-answer answer-alias scanning returns zero findings for the release fixture.

VERIFIED: Post-answer artifact access fails before finalization.

## Sealed-pack compatibility

- VERIFIED: Fixed STAT content hash vector remains `9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f`.
- VERIFIED: Candidate code does not read or expose live `answer_map`.
- PROTECTED: Existing sealed question IDs, choices order, attempts, and dataset version were not changed.
- BLOCKED: Historical attempt joins were not run against a staging database.

## Current integration risks

- INFERENCE: Public answer-bearing STAT runtime data must be reconciled with pre-answer secrecy before adapter cutover.
- INFERENCE: Current `question_metadata` primary key needs a version-collision ruling.
- INFERENCE: Frozen canon, RPC wrapper, and client pack shape require one approved adapter contract.
- INFERENCE: Drills and Daily disagree on how strictly transcript presence is required.

## Adapter status

VERIFIED: No live or staging STAT or Drills adapter was installed.

VERIFIED: Feature flags default off.

BLOCKED: Gate 10 staging adapter, old-attempt join, and sealed-pack regression require protected integration authority and staging access.
