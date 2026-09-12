# MX-MISSIONACCOUNTS-5403B policy-alignment independent verification request

Review only. Do not deploy, merge, migrate production, change WordPress, alter Railway variables, publish billing terms, contact Stripe, create a PaymentIntent, or move money.

Confirm the current head of GitHub draft PR 28 and review that exact commit against base `031a9e812de3575d225de0064cc4be209d86b72b`. The Founder-policy source/test commit is `a39a30b865793e9404bf5af3137c4ca8e1ddcbd6`; the corrective provider-attempt binding source/test commit is `292e98403519b5811786f6beab57cd4a3889da60`. Prior independent acceptance at `8a489334d0ffe8901d29e58421b51f834814956b` does not carry forward. Fresh verification of head `2f72bc2ff260050d5a905a84ddfba0326c2ac7fe` correctly failed because a delayed attempt-one webhook could mutate the latest attempt.

Authority is DR-241 and DR-242 at MissionMed OS commit `f6449c93cc8d3e9da56ce4510540bc92dc3f4d58`. Confirm those decisions permit the bounded amendment of the committed-but-production-unapplied migration under MR-078A and prohibit deployment, production mutation, terms publication, and live money movement.

Verify all of the following:

- $25 per eligible ExamPrep billable calendar day; multiple qualifying same-day sessions collapse to one day.
- Attendance confirmation/finalization starts the scheduling clock. Ordinary processing targets 24 hours and is described to students as generally within 24–48 hours, without a cooling-off promise.
- Valid obligations remain durable after 48 hours and never expire merely because the worker is delayed.
- Advance student consent is required; no per-charge student approval is required after the bounded first-canary approval gate is released.
- The first canary retains exact Dr J day/amount approval while `initial_canary_requires_admin_approval=true`.
- One retry is scheduled 12 hours after a definite first failed provider attempt. The second failed attempt stops automatic retry and sets `late_fee_eligible_review`.
- A provider outcome without a bound PaymentIntent is held for reconciliation and is not retried automatically.
- Attempt-specific idempotency keys permit only attempts 1 and 2 and prevent duplicate successful charges.
- Stripe metadata carries the immutable provider request ID and attempt number; each PaymentIntent reference is persisted on its exact `charge_attempt`; webhooks resolve that attempt instead of the latest attempt.
- A delayed attempt-one failure is idempotent after attempt two is claimed, and a conflicting delayed success fails closed; neither event may mutate the newer claim or increment its failure count.
- No late-fee amount or automatic late-fee assessment is encoded.
- Disabling consent blocks future automatic processing while preserving already-incurred obligations and submitted-payment history.
- LearnDash course 6357, canonical `student.id`, signed enrollment freshness, DIRECT sponsorship, historical cutoff, exclusions, RLS/RPC, receipt email, prior-payment, and review gates remain fail-closed.
- NULL/numeric legacy refs work only as metadata; cross-student and forged subjects remain blocked.
- Both application and database live-dispatch gates remain OFF by default.
- The migration does not insert or approve billing terms and production still lacks migration `20260911224524`.

Builder read-only production verification at `2026-09-12T21:16:00Z` found migration `20260911224524` absent, both new projection/contract tables absent, automatic dispatch rows `0`, and charge rows `0`. Recheck independently; do not treat builder evidence as acceptance.

Run the full established suite, source validation, mandatory vectors, `scripts/test-5403b-postgres-rehearsal.sh`, shell/JavaScript syntax checks, and `git diff --check`. Inspect `missionaccounts/evidence/MX-MISSIONACCOUNTS-5403B/`.

Return exactly one of:

- `INDEPENDENT VERIFICATION: PASS` with exact reviewed SHA, test counts, migration/security findings, production-untouched evidence, dispatch OFF, and money $0.
- `INDEPENDENT VERIFICATION: FAIL` with the exact blocking file/line and reason.
