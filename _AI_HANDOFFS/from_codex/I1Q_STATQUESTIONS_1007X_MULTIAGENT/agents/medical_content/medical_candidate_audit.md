# I1Q-1007X Medical Candidate Audit

Date: 2026-07-15
Status: BLOCKED_NO_REAL_MEDICAL_CANDIDATES
Medical approval: NOT ISSUED
Scope: Aggregate and contract audit only
Path: /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/medical_candidate_audit.md

This report was prepared by a non-credentialed medical content safety specialist. It is not a medical review or approval.

## Current Determination

- Real sources: 97.
- Source-level attribution: 97 verified_drj.
- Privacy-blocked sources: 97.
- Compliant working transcripts: 0.
- Real candidates: 0.
- Physician-reviewed or physician-approved real revisions: 0.
- Release-eligible and published real revisions: 0.
- No source wording, title, speaker label, question row, answer, distractor, reference, or medical claim was inspected.
- All future real candidates must retain AI_DRAFT_NOT_MEDICALLY_VALIDATED lineage. Approval, if later earned, belongs to a separate exact-hash Item Revision review event and never rewrites candidate lineage.
- Medical-answer agreement and candidate approval yield are NOT_SCORABLE, not zero, until credentialed physician review supplies valid denominators.

## Authority Reconciliation

| Authority or contract | Binding medical-safety effect |
|---|---|
| Architecture 1002.1 | Separates immutable transcript provenance from current medical truth; requires current Evidence Claims and credentialed physician review. |
| DR-006 | Authorizes internal engineering and privacy-safe derivation but leaves medical governance unassigned and student publication closed. |
| Privacy veto | No extraction or candidate generation may consume a raw or privacy-blocked transcript. All 97 sources stop before candidate creation. |
| STAT contract | Preserves the exact nine-field server projection and keeps answer secrets server-only until finalization. Only approved exact revisions may enter a release. |
| Drills contract | Requires explicit asset availability, rights and privacy clearance, source hashes, and timestamp linkage. Drills consumer activation remains off. |
| Product passport | Requires editorial review, credentialed physician review, current non-conflicted claims, no active safety flag, privacy and rights clearance, release validation, and Brian publication ratification. |

DR-006 resolves the older 1006 registration and internal-integration authority gaps. It does not clear the 97-source privacy veto, assign medical governance, validate an answer, or enable any consumer flag.

## Exact Future-Candidate Decision Model

Every materialized real candidate has four independent fields. Combining them into one status is prohibited.

| Field | Required value and meaning |
|---|---|
| lineage | AI_DRAFT_NOT_MEDICALLY_VALIDATED for every future real candidate, permanently. |
| answer_provenance_status | Exactly one of TRANSCRIPT_EXPLICIT_ANSWER, TRANSCRIPT_INFERRED_ANSWER, or AI_PROPOSED_ANSWER. |
| medical_evidence_status | Exactly one of MEDICAL_REFERENCE_SUPPORTED, MEDICAL_REFERENCE_CONFLICT, or BLOCKED_UNCERTAIN. |
| review_gate_status | PHYSICIAN_REVIEW_REQUIRED until a credentialed review event passes on the exact immutable revision hash. |

Status meanings:

- TRANSCRIPT_EXPLICIT_ANSWER: A privacy-cleared answer span directly answers the source question. The redacted source wording and hashes remain immutable. This status says nothing about current correctness.
- TRANSCRIPT_INFERRED_ANSWER: The answer is inferred from privacy-cleared context rather than directly stated. The inference basis is recorded separately and may not be presented as a quote.
- AI_PROPOSED_ANSWER: The answer is proposed by AI or concept derivation and may not be attributed to the transcript or to Dr. J.
- MEDICAL_REFERENCE_SUPPORTED: A current atomic Evidence Claim supports the proposed scored assertion with authority class, locator, review date, review-by date, and no unresolved conflict. This is evidence support, not approval.
- MEDICAL_REFERENCE_CONFLICT: Transcript teaching, references, guidelines, reviewers, or answer interpretations conflict. Provenance remains unchanged and release eligibility stops.
- PHYSICIAN_REVIEW_REQUIRED: Mandatory for every real candidate regardless of provenance or evidence support. AI cannot clear this gate.
- BLOCKED_UNCERTAIN: Evidence is missing, stale, context-mismatched, ambiguous, or leaves more than one defensible answer. The candidate is blocked or rejected, never auto-repaired.

Decision rules:

1. Privacy or rights failure prevents candidate materialization.
2. Preserve privacy-cleared source wording and current-answer wording in separate fields and hashes.
3. Assign exactly one answer provenance status.
4. Evaluate an atomic current-truth claim. Transcript provenance is never evidence authority.
5. Any known conflict produces MEDICAL_REFERENCE_CONFLICT. Inability to decide produces BLOCKED_UNCERTAIN.
6. MEDICAL_REFERENCE_SUPPORTED still requires PHYSICIAN_REVIEW_REQUIRED.
7. A physician pass must bind reviewer credential evidence, assignment, exact revision hash, claim set, distractor findings, and review event.
8. A passed Item Revision may become approved only through the architecture workflow. The source candidate remains AI_DRAFT_NOT_MEDICALLY_VALIDATED.
9. Claim expiry, guideline change, new conflict, or safety flag reopens review and blocks new releases.

## Current Contract Audit

Implemented safeguards:

- Candidate creation requires privacy pass and verified_drj segment attribution.
- Candidate lineage is constrained to AI_DRAFT_NOT_MEDICALLY_VALIDATED and auto-approval is rejected.
- Four choices, distinct choice text, answer rationale, and per-distractor why_tempting, why_wrong, and misconception_id are required.
- Medical assignments and review events bind exact revision hashes and verified, unexpired MD or DO credential evidence.
- Editorial review must precede medical approval; an unassigned medical governance lead blocks approval.
- Release assembly requires an exact credentialed medical pass, verified unexpired claims, rights clearance, privacy clearance, and answer-isolation checks.

Contract gaps requiring remediation before real medical review:

1. The seven mandatory provenance, evidence, review, and uncertainty statuses are not centrally enumerated or schema-enforced. extraction_candidates.answer_source_type is unconstrained.
2. The Evidence Claim SQL contract lacks explicit verified_by, authority_refs, currency_class, and review_by_date fields required by Architecture 1002.1.
3. Review Assignment storage and service contracts do not fully encode priority tier, required specialty, second-review requirement, or queue reason codes.
4. Distractor contracts omit trap_type, distractor_provenance, abstraction-level attestation, mutual-exclusivity attestation, accidental-correctness verdict, and physician plausibility attestation.
5. Revision-level active safety flags and open conflict are not modeled as release-gate checks. Claim conflict is blocked indirectly because only verified claims assemble.
6. The SQL verdict enum uses needs_revision while the current service checks changes_requested. Canonical Architecture 1002.1 uses needs_revision.
7. The OpenAPI ItemRevisionDraft schema does not expose the full evidence, status, distractor, or review contract.

## Transient Concurrent Privacy Diagnostic

Command run:

    node --test i1q-question-platform/tests/adapters-security.test.mjs i1q-question-platform/tests/api.test.mjs i1q-question-platform/tests/platform.test.mjs

Observed result: 56 tests, 53 passed, 3 failed while privacy code and tests were under concurrent correction. This run is diagnostic only and is not final integrated evidence.

- STAT, class-A leak, Drills adapter, exact-hash review, credential, and release-gate checks passed within this transient run only.
- Two privacy aggregate tests expected pass or fail but the concurrent working tree returned INCOMPLETE.
- One privacy redaction test expected an older reason-code token than the concurrent implementation returned.
- The mismatches identify concurrent privacy contract and test drift. Final integrated privacy evidence requires a fresh run after correction.

## Blockers And Confidence

Blockers: 97 privacy-blocked sources, zero compliant working transcripts, unassigned medical governance lead, no credentialed real review, incomplete status and evidence contracts, final integrated privacy evidence pending, and all student, STAT, and Drills consumer flags closed.

Confidence: HIGH for aggregate state, authority reconciliation, and contract findings. NO MEDICAL-ACCURACY CONFIDENCE is possible because no medical content was examined.

## Root Handoff

Root must carry the four-field decision model into schema and validator remediation, preserve the privacy veto, keep all future candidates AI_DRAFT_NOT_MEDICALLY_VALIDATED, leave all consumer flags off, and avoid any claim of medical agreement, approval yield, physician validation, or release eligibility.
