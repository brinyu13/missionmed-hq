# I1Q-1007X Distractor Quality Report

Date: 2026-07-15
Status: MODEL_DEFINED_NO_REAL_DISTRACTORS_AUDITED
Medical approval: NOT ISSUED
Path: /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/medical_content/distractor_quality_report.md

No real question, answer, option, rationale, or reference was inspected. Real distractors reviewed: 0.

## Mandatory Gate

Each distractor and the four-option set receive PASS, FAIL, or BLOCKED_NOT_ASSESSABLE on every dimension. Any FAIL or BLOCKED_NOT_ASSESSABLE blocks promotion. Medical uncertainty maps to BLOCKED_UNCERTAIN. Known evidence disagreement maps to MEDICAL_REFERENCE_CONFLICT. Every set remains PHYSICIAN_REVIEW_REQUIRED.

| Dimension | PASS requirement | Blocking condition |
|---|---|---|
| Plausibility | The option represents a documented learner misconception, with misconception_id, trap_type, provenance, and a concise why_tempting. | Implausible filler, no misconception value, or unsupported plausibility. |
| Accidental correctness | The option is safely wrong under the full stem, population, timing, qualifiers, and current evidence. | It is correct or defensible under any reasonable reading or current authority. |
| Abstraction consistency | Stem ask and all options operate at one level, such as diagnosis, next step, or mechanism. | Mixed categories, levels, or answer forms. |
| Mutual exclusivity | Exactly one option is defensible and option truth conditions do not overlap. | Synonyms, subset relations, overlapping conditions, or more than one defensible answer. |
| Misconception value | Selecting the option exposes a specific remediable reasoning error. | Pure trivia, arbitrary proximity, wording trick, or no useful diagnostic signal. |
| Explanation sufficiency | The correct rationale and every why_wrong and why_tempting are claim-consistent and explain the distinction without adding unsupported claims. | Missing rationale, circular explanation, transcript-only authority, or unsupported new claim. |

## Required Per-Distractor Contract

- choice slot
- misconception_id from the pinned vocabulary version
- trap_type
- distractor_provenance: transcript_mentioned, vocabulary_derived, reviewer_authored, or ai_generated
- abstraction_class
- plausibility_verdict and reason code
- accidental_correctness_verdict
- mutual_exclusivity_verdict
- why_tempting and why_wrong
- linked Evidence Claim identifiers
- guideline_sensitivity
- physician_attestation_status

The correct option must not use distractor-only fields. The set-level record carries exactly_one_defensible, abstraction_consistent, and exact_revision_hash.

## Evidence And Guideline Rules

- Transcript mention establishes provenance only, never current correctness or safe wrongness.
- MEDICAL_REFERENCE_SUPPORTED is required for the scored assertion and for any distractor rationale that makes a medical claim.
- A guideline-sensitive option requires a current versioned claim. Stale, conflicting, or context-mismatched authority blocks the entire set.
- AI-generated distractors require complete editorial inspection and credentialed physician review. AI never attests plausibility or safe wrongness.
- Post-release selection behavior may flag dead or over-attractive distractors, but no empirical threshold or performance claim exists before real exposure.

## Current Contract Findings

Implemented: exactly four distinct options; why_tempting, why_wrong, and misconception_id for each distractor; exact-hash medical review; release claim checks.

Missing or incomplete: trap_type, distractor_provenance, abstraction class, mutual exclusivity, accidental-correctness verdict, physician distractor attestation, guideline sensitivity, and closed structured review findings.

## Tests, Blockers, Confidence

Transient concurrent privacy diagnostic: 56 tests, 53 passed, 3 failed while privacy code and tests were under correction. This is not final integrated evidence. STAT, class-A leak, Drills, and exact medical review checks passed only within that transient run.

Blockers: zero real candidates, privacy veto on all 97 sources, no credentialed medical review, incomplete distractor schema, and no empirical selection data.

Confidence: HIGH for the rubric and contract gap audit; NOT_ASSESSABLE for real distractor quality.

## Root Handoff

Root should implement these as fail-closed structured fields and validators before any real candidate enters physician review. No distractor set may be described as medically plausible, safely wrong, or approved from this report.
