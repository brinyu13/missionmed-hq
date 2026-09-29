# MR-WEB-0912 Zelle Real-World Production Acceptance

Date: 2026-09-29 (America/New_York)

## Final gate

**ZELLE LAUNCH GATE = NOT APPROVED**

The controlled customer sent a real $1.00 transfer to `info@missionmedinstitute.com`, but the authorized Gmail inbox received an enrollment-required notification from `Notifications@zellepay.com`, not an incoming-payment confirmation from Chase. The message states that MissionMed must enroll that email address to receive the money before October 9, 2026. Therefore the funds are not proven deposited, and the live matcher correctly returned `not_found`.

No code change can truthfully turn an unreceived, enrollment-pending transfer into a paid WooCommerce order. Enrollment of the business email in Zelle/Chase is a Founder-controlled banking action and was not delegated to this run.

## Controlled order

- Order: `#9193`
- Customer: controlled customer ID `1391`
- Amount: `$1.00`
- Payment method: BACS-backed controlled Zelle acceptance
- Current Woo state: `on-hold`, unpaid
- Zelle state: `not_found`
- Submitted payer: normalized `kathryn bolante`
- Genuine candidate fingerprint: absent
- Woo transaction ID: absent
- LearnDash 3646: no access
- LearnDash 5227: no access
- Unrelated closed course 3893: no access
- LearnDash groups / Matrix program groups: none

## Real-world chronology

1. Before submission, order #9193 was on hold and unpaid with zero target course or Matrix entitlement.
2. The customer-side form submitted the exact sender name `Kathryn Bolante`.
3. The verifier recorded `checking` and queried the authorized Gmail integration.
4. The matcher returned `not_found`; clicking the button alone did not activate payment or access.
5. Gmail subsequently showed the real message from `Notifications@zellepay.com`, subject `Kathryn Bolante sent you $1.00 with Zelle`.
6. The message says `Enroll to receive $1.00` and identifies `info@missionmedinstitute.com` as the email to enroll. It does not assert that Chase received/deposited the payment.
7. A scheduled live retry ran after the message existed. Because the notification is not an allowlisted Chase deposit receipt, the matcher remained `not_found` and fail-closed.

## Source and runtime

- WordPress source commit: `a860765556b025c14177d7044fbf2bf5948b4a6d`
- Live verifier SHA-256: `60aa59768c50b80e393c8f9da6bb7beb6038407fe2674b1ae86169c136f6d0d2`
- MissionMed HQ matcher commit: `ab78c6e571b192cb33f394db3910f92b81c465c6`
- Matcher tests: 5/5 pass
- Existing public prices remained `$549` for Interview Week card and `$3,099` for Complete.
- No Stripe source, order, charge, refund, or entitlement was changed.
- After the failed launch gate, both public Mission Residency Zelle enable options were changed from `yes` to `no`. BACS remains globally configured but is no longer eligible for the Interview Week or Complete launch carts; card prices remain unchanged.

## What passed

- Real Gmail discovery occurred; no email or transaction evidence was fabricated.
- Customer submission and retry used the deployed HMAC-authenticated WordPress-to-HQ matcher.
- Button-only activation containment passed.
- Wrong/no-match containment passed live.
- Ambiguous, consumed, wrong-sender, wrong-subject, wrong-payer, wrong-amount, and replay protections pass the committed matcher tests; HMAC request replay was also rejected in prior live acceptance.
- Order, LearnDash, and Matrix access stayed locked throughout.
- The Zelle UI contrast correction is live and source-matched.
- Public card pricing and Stripe commerce were unaffected.

## What did not pass

- No genuine Chase incoming-payment notification exists for this transfer.
- Deterministic positive match could not occur.
- Canonical Woo `payment_complete()` was correctly not called.
- Positive LearnDash/Matrix/customer-email activation could not be tested.
- The controlled admin fallback correctly has no genuine candidate to approve and therefore could not complete its positive path.
- Real-payment fingerprint consumption against a second order could not be proven because no eligible deposited-payment fingerprint exists.
- Cleanup is intentionally deferred while a real, unresolved $1 transfer remains pending; falsifying or discarding that state would weaken accounting truth.
- New Interview Week and Complete Zelle checkout selection is fail-closed while the banking enrollment blocker is unresolved.

## Remaining customer-facing issue

Some existing campaign presentation copy still mentions the `$499` Zelle option. The eligibility flags now prevent that rail from being offered for a new launch-product checkout, but the promotional copy can still create confusion. The presentation owner must replace those references with a temporarily-unavailable treatment before Zelle traffic resumes; this run did not broaden into the concurrent landing-page integration.

## Exact next step

The Founder or an authorized banking administrator must confirm, through the official Chase/Zelle banking surface, whether `info@missionmedinstitute.com` should be enrolled to receive business payments. Do not use the email link as a substitute for direct bank authentication. After enrollment and actual receipt, obtain the genuine incoming-payment confirmation and resume order #9193 through the existing matcher. If MissionMed instead chooses an already-enrolled Zelle destination, update commercial authority and customer-facing instructions before a fresh controlled test.

Until one of those actions occurs, the Zelle rail must remain unavailable for student traffic.
