# DRJ-EXAMPREP-0920A — Final Product Matrix

Verified against the live WooCommerce catalog and public buyer journey on 2026-09-20. All amounts are USD. No payment was submitted during acceptance.

| Offer | Price / cadence | Purchasable | Eligibility | Woo identity | Stripe routing | Grants | Explicitly does not grant |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Live Group Drilling | $300/month | Yes | Public; track variation required | Product 3651; variation 3668 | Dedicated ExamPrep division; instructor 845 | LearnDash Live Group course 3655 while active/pending-cancel | Daily Rounds 6357 without the add-on; STAT; TournaMed; Arena Pro; unrelated products |
| 1-on-1 Tutoring: Master Level | $85 one time | Yes | Public | Product 3652 | Dedicated ExamPrep division; instructor 845 | Purchased coaching service only | Daily Rounds; Live Group course; STAT; TournaMed; Arena Pro |
| Study Planning — 30 Minutes | $50 one time | Yes | Public | Product 9015 | Dedicated ExamPrep division; instructor 845 | Purchased planning service only | Daily Rounds; Live Group course; STAT; TournaMed; Arena Pro |
| 1-on-1 Tutoring — 10 Full Sessions | $800 one time | Yes | Public | Product 9016 | Dedicated ExamPrep division; instructor 845 | Purchased coaching package only | Daily Rounds; Live Group course; STAT; TournaMed; Arena Pro |
| Drills: Daily Rounds Access | $99.99/month | Yes | Public | Subscription product 6360 | Dedicated ExamPrep division; instructor 845 | Daily Rounds course 6357 and `missionmed_access_drj_drills` while active/pending-cancel | STAT; TournaMed; Arena Pro; Live Group; Mission Residency; unrelated Matrix applications |
| Drills: Daily Rounds Access — Live Drills Add-On | $19.99/month | Restricted | Logged-in account must have an active/pending-cancel Live Group subscription | Hidden subscription product 9109; `live_groups_addon` requirement | Dedicated ExamPrep division; instructor 845 | Daily Rounds course 6357 and drills-only capability while active/pending-cancel | STAT; TournaMed; Arena Pro; unrelated products |
| Approved UCC / MUL / Exam Guarantee Daily Rounds | $49.99/month after recurring $50 discount | Restricted | Logged-in MissionAccounts UUID, matching Woo user/email, current approved eligibility; 14-day, one-use account-bound code | Product 6360 plus private `recurring_fee` coupon; prefixes `DRJUCC-`, `DRJMUL-`, `DRJGUARANTEE-` | Dedicated ExamPrep division; instructor 845 | Same Daily Rounds-only entitlement as product 6360 | Premium Arena capabilities and any unrelated entitlement |
| ExamPrep: Arena Pro | $149.99/month displayed | **No — Coming Soon** | None in this release | Subscription product 9017 retained for display; zero subscriptions | No usable checkout | Nothing | All Arena Pro/premium access; no subscription or order is created |

The five old static cohort coupon posts (9023–9027) are draft/revoked. A discovered code or product ID does not prove eligibility.
