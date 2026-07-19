# Y2-3101 Follow-up Policy and Guardrails

## Policy Order

Revision 3 evaluates, in bounded order:

1. prompt-injection handling;
2. unsupported judgment requests;
3. sensitive boundary or decline;
4. silence and recovery;
5. possible inconsistency;
6. thread and total probe caps;
7. red-flag chronology;
8. instructor focus;
9. durable callback;
10. ambiguity and focus;
11. proposal evidence;
12. STAR gap;
13. context/evidence gap;
14. transition or wrap-up.

## Supported Moves

Clarification, context, evidence, outcome, reflection, STAR gap, callback, focus, inconsistency, transition, wrap-up, designed recovery, red-flag clarification, silence recovery, policy refusal, and injection defense are structurally supported.

## Guardrails

The contract and scanners prohibit:

- readiness, score, ranking, Match and program-fit claims;
- personality, emotion, deception, accent and psychological inference;
- clinical conclusions;
- protected-category questioning;
- prompt/policy disclosure and private chain-of-thought;
- provider credentials, PII, PHI and real-applicant data.

## Development Result

After two bounded revisions, the 20-case development corpus passed all T1-T7 gates and deterministic rerun. This established local regression coverage, not general capability.

## Frozen Holdout Result

- T1 failed: 80% grounded, 20% exact plausibility proxy, one of four counterfactual pairs, and template similarity 1.0 versus a 0.65 ceiling.
- T2 passed: 20/20 callbacks with zero wrong attribution.
- T3 failed: 4/7 eligible STAR cases, 57.14%, with zero over-probes.
- T4 failed: 0/5 true conflicts detected; 0/3 false positives.
- T5 exercised all 8 synthetic injection contexts with zero detected behavioral compliance, but this is bounded fixture evidence and the difficulty-rung effect failed.
- T6 text recovery was incomplete; voice/ASR cases remained explicitly inactive.

## Diagnosis

The deterministic feature adapter and fixed policy templates overfit the development corpus. They lack sufficient semantic discrimination for count, role, order and launch-state contradictions; precise STAR gaps; broad counterfactual divergence; and answer-specific wording.

No third policy revision was made. The kill rule prevents further expansion under this implementation.
