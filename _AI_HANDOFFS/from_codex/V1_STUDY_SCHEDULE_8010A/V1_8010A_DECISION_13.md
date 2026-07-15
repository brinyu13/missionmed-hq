# V1-8010A Decision 13 — Release Modes, Flags, and Cutover

**Status:** ACCEPTED

## Canonical modes

| Mode | V1 exposure/read | V1 writer | Legacy writer |
|---|---|---|---|
| `LEGACY_PRECUTOVER` | Off | Denied | Existing behavior allowed; no V1 watermark |
| `V1_ACTIVE_READ_WRITE` | Current V1 reader | V1 only | Denied |
| `V1_DEGRADED_READ_ONLY` | Current/N-1 reader | Denied | Denied |
| `V1_HIDDEN_NO_TRUTH` | Hidden | Denied | Existing behavior may remain only if no V1 watermark exists |

Entitlement, exposure, write mode, and reader compatibility are separate
server decisions. A boolean feature flag cannot represent this state machine.
The first V1 operation/import and cutover watermark commit atomically.

## Progression

All source ships default-off. Visible staging requires fail-closed entitlement,
learner-principal proof, synthetic data, and rollback readiness. V1-8020 must
independently achieve UI and UX scores of at least 9.0/10. V1-8030 freezes the
exact tested release-candidate digest; any byte change invalidates it. V1-8040
performs controlled cohort rollout only after every release gate, including
Decision 12, passes.

The governing authorization already covers ordinary reversible flag, cohort,
cache, deploy, and rollback actions; no redundant founder prompt is required.
It does not authorize skipping quality, privacy, exact-digest, or rollback gates.

## Stop/rollback

On authorization leakage, foreign mutation, dual writers, persistence drift,
runtime-hash mismatch, restore failure, P0/P1 defect, or cross-app regression,
deny both writers and enter `V1_DEGRADED_READ_ONLY` for any learner with V1
truth. Pre-watermark users may return to legacy.
