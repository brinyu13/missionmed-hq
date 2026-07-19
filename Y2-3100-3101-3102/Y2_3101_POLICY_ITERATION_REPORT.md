# Y2-3101 Policy Iteration Report

## Baseline

The initial rule policy passed 11 of 20 development fixtures. T1, T2, T3, T5 and T6 failed. Early evidence files are retained because they show the iteration history; outputs produced before evaluator corrections are invalidated and are not used as final evidence.

## Iteration 1

One coherent revision added:

- improved evidence classification;
- delayed durable callback selection;
- more exact STAR-gap handling;
- off-topic recovery;
- encoded-injection handling;
- persona phrasing;
- plan-grounded transition/wrap-up;
- total probe caps;
- deterministic idempotent decisions.

Fixture labels reached 20/20, but T1 still failed because output templates collapsed.

## Iteration 2

One bounded revision added domain-cue-specific outcome wording while preserving every safety and probe law. The final development corpus reached:

- 20/20 fixture pass;
- T1-T7 pass;
- deterministic 20/20 rerun;
- no safety finding.

Policy revision 3 was then frozen with aggregate SHA-256:

`764d711be19c54d81e96b2e2638904c4db2628c758f467ee89b933888bdb0d2`

## Frozen Holdout

The unseen holdout disproved generalization:

- broad answer-specific targeting and counterfactual divergence failed;
- STAR targeting reached 57.14%;
- semantic contradiction handling reached 0% on five true cases;
- difficulty rung did not alter two paired outputs;
- durable memory remained strong.

## Kill Rule

Both deliberate policy iterations were consumed before holdout. The ticket forbids continued Brain expansion when T1, T2, T3, or T4 materially fail after two iterations. T1, T3 and T4 failed. No third revision was attempted.

## Failure Attribution

| Layer | Finding |
|---|---|
| Policy | Fixed ordering/templates collapse distinct unseen answers and do not use pressure rung to alter first-turn strategy |
| Model adapter | Deterministic patterns miss count, role, ordering and launch-state contradictions and several STAR distinctions |
| Ledger | Pass; 20/20 callback/reconnect holdout cases |
| Fixtures | Development corpus was too narrow and permitted overfitting |
| Evaluator | Synthetic marker lookup, hidden category steering, consented pack admission and behavioral injection accounting were repaired in scripts/tests only; frozen policy stayed unchanged and final projection is deterministic |
| Authority | Holdout three-probe labels conflict with stricter founder one/two law; stricter law prevailed |

## Next Research Question

Would a provider-neutral structured semantic model adapter, evaluated behind the unchanged MissionMed ledger/policy contracts and against a new frozen holdout, materially improve T1/T3/T4 without weakening safety or probe caps? This is plausible but unproven.
