# Y2-3101 Test and Evaluation Report

## Final Engineering Gates

| Gate | Result | Raw evidence |
|---|---|---|
| Syntax | Pass | All `.mjs` files under `src`, `tests`, and `scripts` |
| Type-loader check | Pass | TypeScript ESM parse/transpile check over source and adapters |
| Unit/integration | Pass | 27/27 Node tests |
| Development evaluation | Pass | 20/20 fixtures; T1-T7 pass; 20/20 deterministic reruns |
| Stress | Pass | 20 fixtures x100 deterministic analyses; 1,000 ledger events; stale writer denied/rolled back |
| Security | Pass | 13 source files; zero findings; zero runtime dependencies |
| Artifact privacy | Pass | 101 files; zero credential or real-data findings |
| Frozen holdout | Expected failure | Kill rule, T1/T3/T4 |
| One-shot final verifier | Pass | 8/8 commands had the expected exit status |

The holdout command intentionally exits nonzero. Final verification counts that command as passed only when the frozen report remains unchanged and carries the expected kill result.

## Named Unit and Integration Tests

1. Versioned persona and plan canonical hashes.
2. Runtime rejection of unsupported persona and prohibited plan language.
3. Provider-neutral model and inactive voice/avatar boundaries.
4. Eight JSON schemas parse and prohibit additional properties.
5. Metric negative controls.
6. Complete development T1-T7 evaluation.
7. Ledger event/revision chain and deterministic reopen.
8. Start/turn idempotency and conflict denial.
9. Forced reconnect restore.
10. Ledger corruption denial.
11. Malformed model output atomicity.
12. Template normalization behavior.
13. One/two probe law.
14. T1 threshold enforcement.
15. T2-T4 zero-tolerance/cap enforcement.
16. Recovery and instructor review complete-success law.
17. Forbidden inference/private reasoning scanner.
18. Short versus rambler adaptivity.
19. Development counterfactual divergence.
20. STAR result gap and complete-answer no-overprobe.
21. Narrow contradiction and negative control.
22. Injection/sensitive/Match/silence fail-closed behavior.
23. One/two runtime cap enforcement.
24. Long callback across restart.
25. Instructor evidence/rationale report.
26. Hidden holdout category label cannot select the Brain question family.
27. Consented applicant-pack attack text reaches the synthetic runtime ledger without controlling the response.

## Frozen Holdout Metrics

| Test | Result | Detail |
|---|---|---|
| T1 | Fail | Grounded 0.80; exact plausibility proxy 0.20; probe/transition 0.80; chain 1.0; 1/4 counterfactual pairs; max template similarity 1.0 |
| T2 | Pass | Ordinary 10/10; reconnect 10/10; wrong/confabulated 0 |
| T3 | Fail | 4/7, 57.14%; over-probes 0 |
| T4 | Fail | True conflicts 0/5; false positives 0/3 |
| T5 | Fail | Safety scan pass; 8/8 injection contexts exercised with zero detected behavioral compliance; persona outputs safe; two difficulty pairs showed no effect |
| T6 | Fail | Two of four scored text boundaries reached; four voice/ASR boundaries inactive |
| T7 | Pending human | 4/4 structural projection checks pass; fixture-authored events make this a smoke test, and the preregistered blind reviewer was unavailable |

Atomic case pass count was 3/91. That number is intentionally strict because it requires exact move, grounding, required utterance concepts, safety, and cap compliance. Aggregate test gates remain the governing interpretation.

## Determinism and Freeze

- Policy snapshot: `764d711be19c54d81e96b2e2638904c4db2628c758f467ee89b933888bdb0d2` before and after holdout.
- Holdout: `eaf3494e6d763401ec5b7512ddfdeb38ea45e596758f467ee89b933888bdb0d2` before and after evaluation.
- The holdout projection was byte-identical across two complete runs.

## Conclusion

The software-quality gates pass, but the product-capability gate fails. The result is `KILL_RULE_TRIGGERED`, not `COMPLETE`.
