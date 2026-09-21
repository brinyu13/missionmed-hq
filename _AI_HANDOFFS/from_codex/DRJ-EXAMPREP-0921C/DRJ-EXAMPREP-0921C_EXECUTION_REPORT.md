# DRJ-EXAMPREP-0921C — Execution Report

## Result

`WORKED` — deployed live and verified on 2026-09-21.

## Founder payment acceptance

Order `9148` is the real acceptance case.

- Woo status: paid / processing.
- Amount: `$1.00 USD`.
- Product: `Drills: Daily Rounds Access` (`6360`).
- Stripe: live PaymentIntent succeeded; live charge paid and captured; amount received `100` cents; order metadata matched; owner `dr_j`; division `examprep`.
- Stripe event: `payment_intent.succeeded`, live, `pending_webhooks=0`.
- Subscription: `9149`, renewal contract `$99.99/month`, subsequently cancelled at the Founder’s request; no next billing date.
- Access: managed Daily Rounds course `6357` and `missionmed_access_drj_drills` capability revoked after cancellation.
- Premium isolation: STAT, TournaMed, and Arena Pro were never granted.
- Cleanup: failed-attempt subscription `9144` cancelled; `DRJFOUNDER1` retired; order retained; no refund.

## Enrollment and merchandising

- Replaced the old two-program hierarchy with a premium three-path enrollment shell: Live Training, On-Demand, and 1-on-1.
- Added an honest feature comparison, Dr. J’s source-grounded Learn → Drill → Repeat → Test method, and sixteen decision FAQs.
- Added the supplied Daily Rounds and Arena screenshots to the relevant on-demand cards.
- Connected upcoming published Dr. J sessions from Matrix Calendar through a public, sanitized read-only endpoint.
- Added exact free-trial language from the source session: one free week, up to five consecutive weekday sessions, card required, first `$300` charge in seven days unless cancelled.
- Added a visible cart link in the global header and ensured ExamPrep add-to-cart paths reach the real Woo cart.
- Hid the irrelevant generic membership-discount upsell on the scoped ExamPrep product set.

## Live add-on funnel

The `$19.99/month` Daily Rounds add-on is available only from the Live Drills buying path and is never preselected.

- Server enforcement accepts a same-cart Live purchase or an existing active/pending-cancel Live subscription.
- A direct/forced anonymous add-on attempt is rejected.
- Removing Live from the cart removes an orphaned add-on.
- When the final eligible Live subscription ends, the separately created add-on subscription is cancelled.
- Zero-money lifecycle acceptance proved the cancellation behavior, then deleted all fixtures.

## Purchase-aware success system

One shared renderer now classifies authoritative order/product metadata and injects family-specific content.

- ExamPrep: actual order products, subscription/access state, ExamPrep CTAs, `drj@missionmedinstitute.com`, no clinical instructions.
- Mission Residency: actual program/tier, Matrix Dashboard v2.0 CTA, `info@missionmedinstitute.com`.
- USCE: retains clinical onboarding, hospital paperwork where appropriate, and `clinicals@missionmedinstitute.com`.
- Unknown or mixed family: neutral MissionMed fallback; never defaults to USCE.

The live Founder order page was inspected directly. It rendered `examprep`, showed `Drills: Daily Rounds Access`, correct cancelled subscription state and `$99.99/month` contract, `drj@missionmedinstitute.com`, a two-column hero and enrollment summary, and no hospital/rotation language.

## Acceptance evidence

- `verify_enrollment_0921c.php`: PASS; trial, images, Arena lock, and 20 sanitized calendar events.
- `verify_live_addon_cart.php`: PASS; `$0` Live-only today, `$19.99` bundle today, `$300` and `$19.99` recurring carts, forced add-on rejection, orphan cleanup, zero money moved.
- Browser anonymous cart: PASS; two expected products, visible one-week trial, correct recurring totals, checkout available.
- `verify_addon_subscription_lifecycle.php`: PASS; add-on cancelled when Live ended; fixtures deleted; emails/webhooks disabled; zero money moved.
- `live_runtime_acceptance.php`: PASS; private-code shape and lifecycle, entitlement grant/revoke, overlap preservation, pre-existing access preservation, premium lock.
- `verify_purchase_success_contract.php`: PASS for ExamPrep, Mission Residency, USCE, legacy ExamPrep, neutral unknown, and neutral mixed.
- Direct browser Founder success page: PASS; family/product/support/layout/absence assertions.
- Desktop 1280/1440 and emulated 390px: PASS; no horizontal page overflow.
- Scoped mobile polish: PASS; the unrelated Matrix/Match desktop-warning overlay is hidden on ExamPrep enrollment/product and purchase-success surfaces, with live 390px DOM readback confirming it is not visible.
- Independent verifier: PASS on all requested user-facing and commerce lanes; no failures. Historical webhook replay and independently observed email delivery remain intentionally unverified because no duplicate payment or email was generated.

## Evidence files

- `evidence/enrollment-desktop-1440.png`
- `evidence/enrollment-mobile-390.png`
- `evidence/live-product-desktop-1440.png`
- `evidence/live-product-mobile-390.png`
- `evidence-order-9148-mobile-390-pre-overlay-fix.png` (pre-polish visual reference; current live DOM verification confirms the warning is now hidden)
