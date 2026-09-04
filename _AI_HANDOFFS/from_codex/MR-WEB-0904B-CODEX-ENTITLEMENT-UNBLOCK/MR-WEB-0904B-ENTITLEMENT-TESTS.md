# MR-WEB-0904B Entitlement Tests

Status: **PASS**

## Pre-payment integration matrix

Two controlled production integration runs used fresh test users and non-payment Woo orders:

- First run: Complete orders 9003/9005; Essentials orders 9007/9008.
- Complete: product 3576, variation 5865, $2,799, course 5227.
- Essentials: product 5504, variation 5867, $1,199, course 3646.
- Each program passed identity, total, Processing grant, unrelated-course exclusion, entitled course-surface access, duplicate-event idempotency, refund/cancel revocation, reorder restore, and final revocation.
- Final aggregate result: **22/22 PASS**.
- Supporting harnesses passed: Hub boundary **5/5**, native integration **13/13**, product dry run **12/12**, production state verification **20/20**.

## Real $1 production lifecycle

- Woo order: 9032
- Woo refund: 9034
- Temporary product: 6319
- Stripe: live-mode $1 USD card charge was paid and fully refunded.
- Buyer account: correct account was associated with the order.
- Complete entitlement: course 5227 granted after payment.
- Unrelated Essentials entitlement: course 3646 was not granted.
- Refund revocation: Complete access removed and native order counter cleared.
- Final verification: **10/10 PASS** at `2026-09-04T18:02:20Z`.
- Temporary product cleanup: draft, hidden, out of stock, non-purchasable; temporary mapping removed.

No card data, customer email, secret, or provider nonce is stored in this evidence package.

Reproducible sanitized checks:

- [Production entitlement integration test](evidence-scripts/mr-web-0904b-production-entitlement-test.php)
- [Final real-order lifecycle verifier](../MR-WEB-0904C-LIVE-CONTENT-TRUTH/evidence-scripts/mr-web-0904c-entitlement-verify.php)
