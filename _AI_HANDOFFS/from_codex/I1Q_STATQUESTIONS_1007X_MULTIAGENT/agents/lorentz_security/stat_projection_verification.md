# I1Q-1007X STAT Projection Verification

Verdict: PROJECTION PASS, DELIVERY BLOCKED

Date: 2026-07-15

## Authority Context

DR-006 now ratifies the RANKLISTIQ target, exact nine-field projection, composite metadata semantics, sealed-pack preservation, server-only `answer_map`, and GitHub-only staging. The earlier authority blockers were snapshot-time findings during root recovery and are addressed by DR-006 and MissionMed OS PR #12. The delivery defects below remain current.

## Exact Nine-Field Projection

`projectStatDatasetQuestion` emits exactly this ordered key list:

1. `dataset_version`
2. `question_id`
3. `prompt`
4. `choice_a`
5. `choice_b`
6. `choice_c`
7. `choice_d`
8. `answer`
9. `explanation`

Evidence:

- `i1q-question-platform/src/contracts.mjs:122-132`
- `i1q-question-platform/src/exports.mjs:14-30`
- `i1q-question-platform/tests/platform.test.mjs:125-130`
- Local `npm test`: 30 tests passed, including exact field order.

No tenth field is permitted. Metadata, quality tier, lineage, internal IDs, and hashes belong in separately governed server-side channels.

## Seven-Field Pack Is Separate

The frozen STAT duel-pack response remains exactly:

1. `duel_id`
2. `dataset_version`
3. `question_ids`
4. `choices_order`
5. `content_hash`
6. `sealed_at`
7. `finalized_at`

The nine-field `dataset_questions` projection is server storage/export. It must never be sent as the pre-answer pack.

## Hash Compatibility

The candidate reproduces the frozen pack vector:

- Preimage: `dataset_version=v4|question_ids=Q1,Q2,Q3|choices_order=A,B,C,D;A,B,C,D;A,B,C,D`
- SHA-256: `9253830103fdf96a341797f34f42fa98427be4089e4fa1483402141b6386575f`

This is a local compatibility pass. It is not evidence that a staging RPC, sealed duel, old attempt, or client has consumed an I1Q release.

## Current Delivery Defects

### P0: direct revision answers

Generic resource reads expose `item_revisions` to every read role. `#sanitizeResource` does not remove `answer`, `explanation`, correct-answer rationale, or distractor rationale. A targeted probe confirmed that a `read_only` actor receives answer-bearing fields.

### P0: caller-controlled reveal

`artifactForPhase` accepts the caller's string `post_answer_finalized` as authorization for the debrief. It does not load a duel, prove server finalization, or prove participant membership.

### P0: incomplete leak scanner

`scanForAnswerLeak` does not detect `answer_map` or `is_correct`, despite the architecture's explicit LT-2 aliases. It also lacks closed-world field-policy validation and answer-value correlation testing.

### P1: projected ID instability

When `export_question_id` is absent, the candidate derives IDs from sorted array position. Adding or removing an earlier revision can change later IDs. The mapping is not persisted and duplicate IDs are not rejected before `Object.fromEntries` overwrites a lookup entry.

### P1: dataset semantics are not validated

`assembleRelease` accepts arbitrary dataset-version text. There is no registry check, current-version rule, release collision proof, or staging compatibility test.

### P1: release membership is incomplete

The release snapshot stores item-revision IDs, but does not persist the architecture-required tuple `(item_id,itemrev_id,revision_number,content_hash)` beside the projected ID.

## Required Acceptance Tests

- Exact nine fields and order, including extra-field rejection.
- Exact seven-field pack and fixed hash vector.
- Duplicate `(dataset_version, question_id)` rejection.
- Stable persistent projected mapping across reordered release input.
- Old-attempt joins across v4 and a new version.
- Class A closed-world scan for names, nested aliases, values, ordering, logs, and errors.
- Finalized participant debrief success.
- Active duel, pending duel, void duel, nonparticipant, expired session, and direct-table read failures.
- Server-authoritative scoring unchanged.
- Consumer flags remain OFF throughout validation.

## Final Assessment

The transformation function itself is fit to preserve as a frozen primitive. The current API, identity mapping, release membership, and channel authorization around it are not safe for staging or production.
