# I1Q-1007X Physician Review Queue

Date: 2026-07-15
Queue state: EMPTY_BLOCKED
Real queue entries: 0
Medical approval: NOT ISSUED
Path: /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/physician_review_queue.md

No physician or reviewer identity is assigned or presumed. The 97 privacy-blocked sources are not queue entries. The 845 legacy rows are not item-level queue entries because content review and exposure prioritization have not occurred.

## Queue Entry Schema

The durable queue record contains references and gates, not source text, titles, prompts, options, answers, or rationale text.

| Field | Contract |
|---|---|
| queue_entry_id | Stable opaque identifier. |
| candidate_id and item_revision_id | Internal identifiers; item_revision_id required before medical verdict. |
| exact_revision_hash | Required and immutable for assignment and verdict. |
| lineage | Always AI_DRAFT_NOT_MEDICALLY_VALIDATED for a future real candidate. |
| answer_provenance_status | Exactly one mandatory transcript or AI provenance status. |
| medical_evidence_status | MEDICAL_REFERENCE_SUPPORTED, MEDICAL_REFERENCE_CONFLICT, or BLOCKED_UNCERTAIN. |
| review_gate_status | PHYSICIAN_REVIEW_REQUIRED until exact-hash completion. |
| claim_ids and claim_currency | Current claim references and dates, with no text copied into the queue. |
| privacy_rights_attribution | Passing privacy, required rights, and source-level attribution gates. |
| distractor_gate_summary | Six fail-closed dimension results. |
| uncertainty_codes | Structured reason codes only. |
| priority and priority_reasons | P0 through P3 with deterministic reasons. |
| required_specialty | Routing requirement; nullable only with logged governance exception and second review. |
| assignment | State, reviewer_id, verified credential evidence, calibration state, due_at, and second-review flag. |
| review_event_id | Required on completion and bound to exact_revision_hash. |

Queue entries array for this audit:

    []

## Priority Plan

- P0: safety concern, disputed answer, or live incident scope. Immediate.
- P1: high-exposure legacy, flagged published content, guideline change, or resolved conflict requiring second review.
- P2: privacy-cleared pilot and new-content candidates.
- P3: low-exposure legacy background review.

Exposure metadata is unavailable, so the 845 legacy rows cannot truthfully be divided between P1 and P3. The all-answer-A property, 517 base rows, 328 vignette rows, and 11 duplicate-prompt groups justify urgent system reconciliation but do not create item-level medical findings.

## Assignment And Verdict Gates

- Medical governance lead must be assigned.
- Reviewer must be active, independently credential-verified, unexpired, calibrated, and free of self-review conflict.
- Specialty matching is required by default; a mismatch needs logged governance acceptance or a second physician review.
- Canonical structured verdicts are pass, needs_revision, and fail. The current service value changes_requested conflicts with the SQL and architecture needs_revision value.
- Pass requires MEDICAL_REFERENCE_SUPPORTED, no conflict, no active safety flag, all distractor gates passed, explanation sufficiency, and exact-hash review.
- A pass approves only the Item Revision through its Review Event. Candidate lineage remains AI_DRAFT_NOT_MEDICALLY_VALIDATED.
- P0, P1, conflict resolutions, uncalibrated reviewer work, and specialty exceptions require second review.

## Metrics, Tests, Blockers, Confidence

Medical-answer agreement and approval yield: NOT_SCORABLE before credentialed review.

Transient concurrent privacy diagnostic: 56 tests, 53 passed, 3 failed while privacy code and tests were under correction. This is not final integrated evidence. Exact-hash assignment, credential, and approval-order checks passed only within that transient run.

Blockers: zero real candidates, all 97 sources privacy-blocked, medical governance unassigned, no credentialed real reviewer assignment, incomplete priority and specialty contract, and exposure metadata unavailable.

Confidence: HIGH for schema and priority design; NOT_ASSESSABLE for queue yield or reviewer agreement.

## Root Handoff

Root should create no real queue entries until privacy clearance produces a candidate and credential governance is operational. Implement the schema, canonical needs_revision verdict, deterministic priority reasons, and second-review gates before queue activation.
