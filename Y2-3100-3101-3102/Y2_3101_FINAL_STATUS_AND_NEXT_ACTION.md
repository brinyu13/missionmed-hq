# Y2-3101 Final Status and Next Action

## Result

`KILL_RULE_TRIGGERED`

The isolated Brain Harness is runnable and deterministic under the tested synthetic corpus, with a durable local ledger. It is not capable or safely bounded enough to proceed to voice or student-facing integration because the frozen unseen holdout materially failed T1, T3 and T4 after both permitted policy iterations, and the amended-prompt audit found additional contract and safety gaps.

## Proven Strengths

- Versioned personas, plan, policy and inactive adapters.
- Runtime validators and canonical hashes; JSON-schema parity and provider substitution remain incomplete.
- Durable idempotent event/revision ledger.
- 20/20 long-memory and reconnect callbacks with zero confabulation.
- One/two probe cap with zero holdout violations.
- Zero runtime dependencies and no network/provider path.
- All eight synthetic injection contexts reached the evaluated runtime and produced zero detected behavioral compliance; this is a bounded fixture result, not broad prompt-injection validation.
- Instructor artifact structural machine checks passed; blind human accuracy remains pending.

## Blocking Findings

1. Answer-specific adaptivity did not generalize: exact plausibility proxy 20%, counterfactual 1/4, template similarity 1.0.
2. STAR targeting reached only 4/7 eligible cases.
3. Semantic contradiction handling reached 0/5 true cases, though it produced no false accusations.
4. Difficulty rung did not change paired behavior.
5. Text recovery coverage is incomplete; voice recovery remains inactive.
6. T7 human blind-review accuracy is pending.

## Product Decision

- Voice integration: prohibited.
- LiveKit/ElevenLabs account or SDK work: prohibited.
- Avatar work: prohibited.
- Y1 integration implementation: deferred.
- Ten-student pilot: not ready.
- Additional tuning against this holdout: prohibited.

## Named Nonblocking Evidence Limitations

- Iteration count is evidenced but not mechanically enforced by the kill function.
- Injection evidence covers eight fixed synthetic cases; one encoded pack attack is outside the lexical attack detector, so general resistance is not claimed.
- T7 blind human accuracy remains pending.
- Raw path and timing fields are environment-specific, though normalized reruns are semantically identical.

## Amended-Prompt Reconciliation

The exact amended prompt at `/Users/brianb/.codex/attachments/13bc2e3f-94b6-4a67-b2c1-1cfd9afe84fc/pasted-text.txt` has SHA-256 `50d7e2d6ac8d18306698fc647e7ac62f1de3eb23cb71e0eef79732b3c6ef8ddc` and was already the canonical founder ticket in the committed context inventory. A 2026-07-22 rerun reconfirmed every available non-holdout gate without changing policy or runtime code.

The external holdout package is no longer present at its recorded temporary path, so its current bytes cannot be rerun. The committed pre-open hash, unchanged post-run hash, full evaluation, and independent deterministic rerun remain preserved; future work must create a new holdout rather than reconstruct or tune against this one.

Fresh adversarial probes also confirmed arbitrary instructor-focus authorization, persistence of sensitive refused text, false-positive guardrail `PASS` states, ASCII-only evidence input, policy/model provenance ambiguity, ledger-lock and commit-integrity gaps, schema/runtime divergence, and a model boundary that is not yet genuinely replaceable. These defects strengthen the existing kill decision and are mandatory `Y2-3103` prerequisites. They do not authorize a third policy iteration here.

## Smallest Exact Next Ticket

`Y2-3103: Provider-Neutral Semantic Model Adapter Bakeoff and New Frozen Holdout`

Scope:

1. Preserve the current ledger, contracts, cap law, guardrails and instructor projection.
2. Build a model-adapter benchmark only, using synthetic text and structured output.
3. Include count, role, temporal-order, launch-state, nuanced STAR and counterfactual cases in development.
4. Create a new independently authored frozen holdout before tuning.
5. Compare the rule baseline with candidate replaceable adapters; no voice, production or real data.
6. Require T1, T3 and T4 plus safety to pass without weakening one/two probe law.
7. Stop again if the new holdout fails.
8. Repair and independently test instructor-focus authorization, sensitive-text minimization, guardrail-result derivation, Unicode/code-switching support, ledger locking and provenance binding before opening the new holdout.
9. Make runtime and JSON schemas executable against the same instances and add a validated provider-neutral `ModelAnalysisV1` boundary.
10. Run a timed blind instructor review on the actual runtime projection; machine generation timing is not a substitute for three-minute comprehension.

Do not reuse this opened holdout as a future unseen gate.
