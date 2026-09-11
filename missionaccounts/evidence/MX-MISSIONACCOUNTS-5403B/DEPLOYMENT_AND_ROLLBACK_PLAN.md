# 5403B protected deployment and rollback plan

Execution is gated on an independent `PASS` from a session other than the builder.

## Apply order

1. Acquire and revalidate the exact MissionAccounts source, Supabase, Railway, and WordPress option leases required by DR-233.
2. Verify PR 28 head, the reviewed migration SHA-256, Supabase project `dwwsahpzblgrgducxtzw`, Railway project/service IDs, deployed SSO SHA-256, course 6357 title/status, and the empty `mmed_course_usmle` preimage.
3. Apply only migration `20260911224524_autobilling_contract_closeout_5403b.sql`. It creates no terms, consent, charge, PaymentIntent, or hosted invoice.
4. Read back tables, functions, grants, forced RLS, contract values, cutoff, and `live_dispatch_allowed=false`; run Supabase security and performance advisors.
5. Set only the WordPress option `mmed_course_usmle=6357`, then read it back and prove course 6357 remains `Dr J, Drills On-Call` and published. Do not change user enrollment.
6. Deploy the reviewed `missionaccounts/` source to the isolated `missionaccounts-production` Railway service.
7. Set `MISSIONACCOUNTS_AUTO_BILLING_CONSENT=1` only after exact Founder-approved terms exist. Keep `MISSIONACCOUNTS_AUTO_BILLING=0`, hosted invoices OFF, and notifications OFF.
8. Verify direct Railway health, public route/cache privacy, genuine Dr J view, genuine enrolled student view, non-enrolled denial, and admin inability to grant consent.
9. Run the production `$0` shadow and save sanitized counts. Confirm no PaymentIntent, charge, or provider dispatch row was created.
10. File the final 5403B report and stop for separate one-student, one-day, `$25` canary authority.

## Rollback and forward-disable

- First force `MISSIONACCOUNTS_AUTO_BILLING_CONSENT=0`; `MISSIONACCOUNTS_AUTO_BILLING` remains `0` throughout.
- Keep `missionaccounts.automatic_billing_contract.live_dispatch_allowed=false`.
- Restore the Railway application to source `031a9e812de3575d225de0064cc4be209d86b72b` or the captured immediately preceding successful deployment.
- Restore `mmed_course_usmle` to its exact empty/absent preimage only if the option binding causes a verified regression. Do not alter course membership.
- Leave additive database structures in place but inert. Do not drop tables, delete audit/history, or edit the applied migration.
- Re-probe health, cache/privacy, manual Dr J charge availability, saved methods, Zoom worker state, and zero automatic dispatch.
