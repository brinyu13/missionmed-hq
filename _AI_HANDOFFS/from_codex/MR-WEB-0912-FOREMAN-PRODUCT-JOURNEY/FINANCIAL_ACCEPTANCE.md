# MR-WEB-0912 controlled live Stripe acceptance

Acceptance date: 2026-09-21. Founder-authorized ceiling: `$1.00`, executed as two exact `$0.50` live card charges. The public prices were never changed.

## Interview Week

- Woo order `9153`; controlled subscriber `1379`.
- Identity: parent `5504`, variation `5867`, LearnDash course `3646`.
- Paid inspection: `15/15 PASS`; real live Stripe `$0.50` USD charge; correct account and course grant; LearnDash `5227` excluded; no unrelated access.
- Refund: live Stripe full refund plus Woo refund `9172`; final order status `refunded`.
- Containment: course `3646` revoked; unrelated exclusion preserved; enrollment counter cleared; temporary login, sessions, and payment tokens removed.
- Final inspection: `15/15 PASS` at `2026-09-21T12:22:33+00:00`.

## IV Prep Complete

- Woo order `9155`; controlled subscriber `1380`.
- Identity: parent `3576`, variation `5865`, LearnDash course `5227`; no separate Interview Week product or charge.
- Paid inspection: `15/15 PASS` at `2026-09-21T12:18:57+00:00`; real live Stripe `$0.50` USD charge; correct account and course grant; LearnDash `3646` excluded.
- Woo automatically created one payment token despite the save-card control being off. The token was deleted before refund; readback showed zero remaining tokens.
- Refund: live Stripe full refund plus Woo refund `9173`; final order status `refunded`.
- Containment: course `5227` revoked; unrelated exclusion preserved; enrollment counter cleared; temporary login, sessions, and payment tokens removed.
- Final inspection: `15/15 PASS` at `2026-09-21T12:22:33+00:00`.

## Temporary mechanism and runtime truth

- The exact authenticated/admin-only bridge never changed a public product price and could address only the two controlled orders/users.
- Deployed bridge SHA-256 was `0e18002875af7c3627a56052f5e6ea313a7589956402dba214e021c2b2f66ed8`.
- It was removed from the live MU-plugin directory after both refunds and retained only as a mode-`0600` private rollback artifact.
- The temporary controller was removed from `/tmp`.
- Production runtime now records `passed_two_offer_low_dollar_refunded_contained`, Founder authority `FOUNDER-2026-09-21-LOW-DOLLAR-LIVE-TEST`, and verification time `2026-09-21T12:22:33+00:00`.
- Public prices separately remain Interview Week `$549` and Complete early card PIF `$3,099`.

## Verdict

`INTERVIEW WEEK LIVE STRIPE LIFECYCLE = PASS, REFUNDED, AND CONTAINED`

`IV PREP COMPLETE LIVE STRIPE LIFECYCLE = PASS, REFUNDED, AND CONTAINED`

`TOTAL TEMPORARY CHARGES = $1.00; TOTAL REFUNDED = $1.00`
