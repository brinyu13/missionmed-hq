# MR Zero-Enrollment Recovery — State Delta

## Source

| Object | Before | After |
|---|---|---|
| Authority | prior MR-WEB-0912 decisions | DR-336 registered at canonical OS commit `f6347fe3efeb916015a6fc8b0159c5129e86da09` |
| Production source commit | `5a6aec01bf17a4b8a36085ef3e4f2d9d6b0b7877` | `9255166fe36a3471ef5084cb68794a79e8a8e985` |
| Campaign state | Sep 26 / prior schedule | Oct 7 PIF deadline; Oct 8/11/13/15/17/18 schedule |
| Public access | verified public at preflight | preserved public; no DRJ2026 gate |
| Persistent CART | present but homepage style could be stripped by static rendering | renderer-bound style + fixed link on all accepted funnel surfaces |
| Analytics | incomplete/inconsistent recovery attribution | bounded ecommerce/offer/CTA/rail/destination/UTM contract with paid-order purchase dedupe and distinct refund event |

## WordPress / Woo objects

| ID | Delta |
|---:|---|
| 3576 | Complete parent title/excerpt/content synchronized to recovery pricing and included-IW truth |
| 5865 | Title/slug/short description moved to Oct 11; regular `$3,499`; sale `$3,099`; sale ends Oct 7 23:59:59 ET; in stock |
| 5504 | Interview Week description synchronized to Oct 8–18 and `$549/$499` |
| 5867 | Title/slug/short description moved to Oct 11; `$549`; in stock |
| 5513 | Payment-plan description synchronized to `$1,000 + 6×$400 = $3,400` |
| 5873 | Title/slug/short description moved to Oct 11; `$400` recurring plus `$1,000` sign-up fee; in stock |
| term 66 | Name changed from `Session D: Oct 4th, 2026` to `Session D: Oct 11th, 2026`; slug preserved as `session-d-start-date` |

Acceptance binding for Complete was recalculated under DR-336. Woo product/variation IDs and LearnDash mappings were not changed.

## Live offer truth

- Interview Week: `5504/5867 → LearnDash 3646`; `$549` card / `$499` Zelle.
- Complete PIF: `3576/5865 → LearnDash 5227`; `$3,099` through Oct 7 ET / `$3,499` standard.
- Complete installments: `5513/5873 → LearnDash 5227`; `$1,000` today + six `$400` monthly payments.
- Complete Zelle: same applicable PIF tuition, manual verification before access.
- Complete includes Interview Week; no separate `$549` charge.

## No-touch state

- No order, payment, refund, user, entitlement, or historical transaction was changed.
- No campaign email or WhatsApp message was sent.
- No Stripe configuration was changed.
- No LearnDash mapping was changed.
- Full-season recurring cadence was not shifted.
- Unrelated dirty work was excluded from both source commit and deployment.

## Deployment transactions

- Canonical authority lease: epoch 3678, released.
- Initial production lease epoch 3679 expired closed after a post-update cache-flush process fault; provider readback showed it inactive.
- Scoped repair leases epochs 3680, 3681, 3682, and final CART-style lease 3683: released `true`.
- Final provider readback: `active_leases=0`, `active_mr_leases=0`, `pending_waiters=0`.

## Final worktree state boundary

The recovery source and closeout evidence are committed and pushed. The worktree remains dirty only because pre-existing unrelated B Immersive, Claude-output, AAA, and prior forensic-report paths remain untouched.
