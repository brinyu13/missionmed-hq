# Y2-3101 Test and Evaluation Report

## Final Engineering Gates

| Gate | Result | Raw evidence |
|---|---|---|
| Syntax | Pass | All `.mjs` files under `src`, `tests`, and `scripts` |
| Type-loader check | Pass | TypeScript ESM parse/transpile check over source and adapters |
| Unit/integration | Pass | 27/27 Node tests |
| Development evaluation | Machine-proxy pass | 20/20 fixtures and deterministic reruns; this does not satisfy voice-only T6 boundaries or timed human T7 review |
| Stress | Pass | 20 fixtures x100 deterministic analyses; 1,000 ledger events; stale writer denied/rolled back |
| Security | Pass | 13 source files; zero findings; zero runtime dependencies |
| Artifact privacy | Pass | 115 files; zero credential or real-data findings |
| Frozen holdout | Historical expected failure; current rerun unavailable | Kill rule, T1/T3/T4; original external package is absent |
| One-shot final verifier | Historical pass | 8/8 commands had the expected exit status at the recorded target |

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

## Preregistered T1-T7 Gates, Verbatim

The governing blueprint defines the gates exactly as follows. These definitions are preserved verbatim here so proxy metrics cannot silently replace the acceptance law.

**T1 Answer-specific follow-up |** For >= 90% of substantive synthetic answers, the next interviewer turn references a concrete element of that answer (grounding ref resolves); blind rater judges >= 80% "plausible human follow-up". Anti-gaming riders that a scripted echo-and-transition system must fail: (i) counterfactual pairs: the same question answered with materially different synthetic answers must produce materially different next turns (divergence scored); (ii) template-similarity penalty: follow-ups whose n-gram similarity to prior follow-ups exceeds threshold count as failures; (iii) probe-chain depth: across a session, mean probe-chain length on substantive answers >= 1.5 before transition; (iv) follow-up-vs-transition ratio floor: >= 60% of substantive answers receive a probe, not a transition

**T2 Memory of earlier detail |** A detail planted in minute 2 is correctly recalled and used in a callback probe after minute 10, across >= 8/10 scripted runs, with correct attribution (no confabulated details, zero tolerance). Ledger variant (mandatory): the same test repeated with a forced mid-session reconnect and context flush, so recall must come from session-ledger re-hydration, not context-window residue

**T3 Probing incomplete/vague answers |** STAR-gap fixtures: missing component identified and probed within probe cap in >= 85% of cases; over-probing beyond cap: zero

**T4 Contradiction handling |** Planted inconsistencies (within session, and vs applicant pack): surfaced professionally (tone-checked), correctly quoted, in >= 80% of fixtures; false-positive contradiction accusations <= 5%

**T5 Persona and context discipline |** 30-minute adversarial persona test: zero red-lined claims, zero out-of-persona breaks, zero prohibited questions, zero Match promises; difficulty rungs measurably change probe depth and pacing

**T6 Graceful recovery |** Injected silence, ASR garble, barge-in, irrelevant input, and mid-session rail kill each produce the designed recovery state; no dead air > 2 s (voice phase); reconnect resumes with ledger intact

**T7 Transcript + instructor summary |** Every run yields a usable timestamped transcript and an Event Summary that a mentor can read in < 3 minutes and correctly answer "what did the interviewer probe and why" (tested with a human reviewer)

The Phase 0 harness has no transcript generator or voice rail, and no preregistered timed human reviewer completed T7. Therefore T6 is only partially exercised at text boundaries and T7 is pending regardless of structural machine projections.

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

- Policy snapshot: `764d711be19c54d81e96b2e2638904c4db2628c7585cb6ef110e4b16885b53d4` before and after holdout.
- Holdout: `eaf3494e6d763401ec5b7512ddfdeb38ea45e596758f467ee89b933888bdb0d2` before and after evaluation.
- The holdout projection was byte-identical across two complete runs.

## Conclusion

The software-quality gates pass, but the product-capability gate fails. The result is `KILL_RULE_TRIGGERED`, not `COMPLETE`.

## Amended-Prompt Reverification

On 2026-07-22, the exact 40,725-byte amended prompt already recorded in the context inventory was reconciled again. Syntax, type-loader validation, 27/27 unit and integration tests, two byte-identical 20/20 development evaluations, the 2,000-run fixture stress pass, the 1,000-event ledger pass, the 13-file source security scan, and the 115-file artifact privacy scan passed.

The external synthetic holdout package is no longer present at its recorded temporary `/tmp/Y2_3101_FROZEN_HOLDOUT/` path. It was not reconstructed or fabricated. The committed freeze, evaluation, deterministic-rerun, and independent-verifier evidence remains valid historical evidence, but a new current-byte holdout rerun is unavailable. Any future evaluation must use a newly authored frozen holdout under `Y2-3103`, never this opened set.
