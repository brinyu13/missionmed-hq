# Quota, Dedupe, and Refund QA

Production quota readback for the canary actor:

```text
window = 2026-09-11 through 2026-10-11
quota_limit = 30
reserved = 0
consumed = 1
refunded = 0
available = 29
```

Two near-simultaneous submits for Holdout A converged on job `9413325c-cd49-431c-a2e4-e74448fbcb0c`. The database contains exactly one OpenAI deep-research job, exactly one reservation audit event, and consumed count exactly one. The unique dedupe key and transaction-level quota row lock protect double clicks, duplicate tabs, and joining an active equivalent job.

Out-of-allowlist requests fail before quota reservation. With the final kill switch active, Holdout A also returns fail-closed and the student CTA is absent. NO_OP classification is non-consuming by contract. Worker/provider failures before useful work call the durable refund transition; automated acceptance exercised this transition and the full 187-test suite passed. Quota and job rows persist independently of app/worker restarts.

The live admin control center can inspect quota history and alter the default policy. An existing canary ledger was reconciled from its prior test limit to the authorized limit 30 without creating a second job or changing consumed history.
