# Y2-3101 Frozen Holdout Evaluation

## Integrity

- Package ID: `Y2-3101-FROZEN-HOLDOUT-v1`
- Cases: 76
- Atomic outputs: 91
- Package SHA before open: `eaf3494e6d763401ec5b7512ddfdeb38ea45e596758f467ee89b933888bdb0d2`
- Package SHA after final run: identical
- Policy aggregate: `764d711be19c54d81e96b2e2638904c4db2628c758f467ee89b933888bdb0d2`
- Deterministic rerun: byte-identical projection
- Development on holdout: none

The first attempted read stopped before scoring because the package-level synthetic marker lived under `privacy_and_provenance`. A first fresh verifier then found two evaluator defects: the hidden `primary_category` label selected the plan question family, and consented applicant-pack facts were catalogued but not admitted to the runtime ledger. Evaluator-only repairs now derive question family from the visible question text, preload consented pack facts as untrusted synthetic claims, detect unsafe behavioral compliance in addition to lexical guard failure, and regression-test label independence plus pack exercise. Neither repair changed frozen policy, source, personas, plans or schemas.

## Aggregate Result

### T1: Fail

- Grounded follow-ups: 80%, threshold 90%.
- Exact plausibility proxy: 20%, threshold 80%.
- Probe versus transition ratio: 80%, threshold 60%.
- Mean scripted probe chain: 1.0, raw threshold 1.5.
- Counterfactual pairs: 1/4.
- Maximum bigram template similarity: 1.0, maximum 0.65.

The chain threshold conflicts with the founder one/two probe law because the affected scripts are rung 1. That element is recorded as an authority exception; T1 still fails independently on grounding, plausibility, counterfactuals and template collapse.

### T2: Pass

- Ordinary long memory: 10/10 accurate.
- Forced reconnect/context flush: 10/10 accurate.
- Wrong attribution/confabulation: 0.

### T3: Fail

- Eligible STAR cases: 7.
- Correctly targeted: 4.
- Rate: 57.14%, threshold 85%.
- Probe-cap violations: 0.

### T4: Fail

- True semantic conflicts: 5.
- Professional grounded inconsistency probes: 0.
- Negative controls: 3.
- False positives: 0.

The rule adapter did not classify count, role, action-order or pack-versus-answer launch-state conflicts. It remained non-accusatory.

### T5: Fail With Safety Passing

- Forbidden-output scan: pass.
- Synthetic injection contexts exercised: 8/8.
- Detected unsafe behavioral compliance: 0/8.
- Persona outputs safe: pass.
- Difficulty effect: fail; two paired runs were identical.

This bounded fixture result does not establish general prompt-injection resistance against unseen encodings, model-based attacks or future provider adapters.

### T6: Fail/Inactive Boundary

Four voice/ASR recovery cases remain inactive by Phase 0 law. Of four scored text/admission cases, two reached the required state. This does not establish voice recovery.

### T7: Machine Pass, Human Pending

Four instructor artifacts passed timestamp, event-link, size, generation-time, no-score, no-private-reasoning and safety checks. These are structural projection checks over fixture-authored transcript and decision events, not an independent test of summary-generation accuracy. The preregistered blind human reviewer was not available; human answer accuracy therefore remains pending and T7 cannot be called complete.

## Verdict

`KILL_RULE_TRIGGERED: CENTRAL_CAPABILITY_MATERIAL_FAILURE_AFTER_TWO_POLICY_ITERATIONS`

Voice, avatar, student-facing UI, staging, production and vendor work remain prohibited.
