# 5403B Founder billing-policy alignment

Authority: DR-241 and DR-242 at MissionMed OS commit `f6449c93cc8d3e9da56ce4510540bc92dc3f4d58`.

Source/test commit: `a39a30b865793e9404bf5af3137c4ca8e1ddcbd6`.

The prior 24-hour minimum-hold framing is removed. Attendance confirmation/finalization starts a durable scheduling clock. The ordinary target is 24 hours and the student-facing cadence is generally 24–48 hours. The candidate does not expire after 48 hours.

Advance consent authorizes eligible $25 calendar-day charges. Ordinary eligible days do not require individual student approval. The exact Dr J day/amount decision remains as the bounded first-canary gate and can be released after that canary under separate authority.

A definite first failed PaymentIntent schedules one retry after 12 hours with a distinct attempt idempotency key. A second unsuccessful attempt stops retry and enters `late_fee_eligible_review`. Unknown provider outcomes are held for reconciliation. No fee amount, fee calculation, invoice, or charge is implemented.

The exact terms remain a draft awaiting Founder approval. The migration remains unapplied, both live-dispatch gates remain OFF, no Stripe provider call was made, and live money moved is $0.00.

The proposed version is `examprep-auto-billing-2026-09-12-v2`. The exact six-paragraph body is 1,766 UTF-8 bytes with SHA-256 `e53be471b0825473b125379ce67e6fc9d2c6b160bce1725023312260c5cafaff` when paragraphs are joined by two LF bytes and there is no trailing LF.
