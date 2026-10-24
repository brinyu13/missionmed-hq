# I1Q 1006 Extraction Engine

## Implemented contract

VERIFIED: `src/pipeline.mjs` implements deterministic normalization, redaction integration, candidate detection, candidate validation, and resumable batch planning against synthetic inputs.

VERIFIED: The GX stage registry includes GX-0 through GX-11:

- GX-0 inventory
- GX-1 rights
- GX-2 privacy scrub
- GX-3 speaker attribution
- GX-4 concept extraction
- GX-5 genuine medical-question detection
- GX-6 answer-source detection
- GX-7 correct-answer verification support
- GX-8 distractor generation
- GX-9 explanation generation
- GX-10 editorial queue
- GX-11 physician queue

## Normalized segment shape

VERIFIED: Normalization emits video ID, transcript ID, deterministic segment ID, speaker, speaker confidence, source text, redacted text, start/end time, source hash, working hash, node links, privacy flags, and rights flags.

VERIFIED: Text is Unicode-normalized before hashing.

VERIFIED: The working hash is derived from redacted text, not raw text.

VERIFIED: Raw transcript content is not modeled in the candidate datastore table.

## Candidate controls

- VERIFIED: Administrative, scheduling, setup, greeting, and generic non-question patterns are excluded.
- VERIFIED: Default medical classification is fail-closed. A caller must supply a positive classifier result.
- VERIFIED: Candidate lineage is always `AI_DRAFT_NOT_MEDICALLY_VALIDATED`.
- VERIFIED: Candidate validation rejects auto-approval and approved status.
- VERIFIED: Source video, transcript hash, question timestamp, context, node links, confidence, and warnings are retained.
- VERIFIED: MCQ validation requires exactly four choices and exactly three distractors when choices are supplied.
- VERIFIED: Distractor rationale fields are required at item-revision creation.

## Privacy controls

- VERIFIED: Synthetic redaction covers student names, third-party names, patient identifiers, email, phone, and address patterns.
- VERIFIED: Split punctuation in patient identifiers is tested.
- VERIFIED: Required-class aggregate metrics are explicit and numeric.
- BLOCKED: Real transcript redaction recall has not been measured.

## Resumption and operations

- VERIFIED: Deterministic source and candidate IDs support idempotent reruns.
- VERIFIED: Batch planning excludes completed source IDs and emits checkpoint cursors.
- VERIFIED: Candidate SQL models include queue, retry, checkpoint, dead-letter, and idempotency state.
- BLOCKED: No production queue, model provider, cost meter, or datastore-backed worker was executed.

## Gate 6 result

PARTIAL: Pipeline contracts and regression fixtures pass locally.

BLOCKED: Rights, real privacy, speaker attribution, source entailment, answer verification, model/prompt execution, and review-queue handoff cannot be validated without an authorized corpus and assigned governance.
