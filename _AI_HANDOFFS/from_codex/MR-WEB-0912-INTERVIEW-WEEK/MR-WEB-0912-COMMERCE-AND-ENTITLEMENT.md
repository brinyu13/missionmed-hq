# MR-WEB-0912 Commerce and Entitlement Matrix

Status: **BLOCKED — no production mutation**

## Woo and entitlement objects

| Offer | Existing object | Current live state | MR-WEB-0912 target | Candidate behavior |
|---|---|---|---|---|
| Interview Week | parent 5504 / variation 5867 / course 3646 | IV Prep Essentials; $1,199; published/in stock; mapped to 3646 | IV Prep Essentials: Interview Week; $500 once | Server-side checkout rejected until price is exactly $500, the variation parent is 5504, the mapping is exactly course 3646 with no extras, product is purchasable/in stock, and the Interview Week acceptance pair is valid |
| Complete | parent 3576 / variation 5865 / course 5227 | IV Prep Complete; $2,799; published/in stock; mapped to 5227 | $3,099 verified early card PIF through Sept 23, then $3,499 standard | Server-side checkout rejected until the time-appropriate exact price, the variation parent is 3576, the mapping is exactly course 5227 with no extras, product eligibility passes, and the Complete acceptance pair is independently valid |
| 360 | parent 3575 / variations 5862, 5863 / course 3893 | published reference, $5,499, out of stock | preserve closed | Not intercepted by the new candidate; production object remains non-purchasable |

The current parent and variation mappings were read back from production. The
official LearnDash WooCommerce integration remains active at 2.0.2, guest
checkout is disabled, and checkout account creation is enabled. These facts
prove the mapping seam, not the new product lifecycle.

The candidate rejects direct add-to-cart URLs and stale cart entries while an
offer is inactive. It also rejects a cart containing both Interview Week and
Complete, because Complete already includes Interview Week.

## Payment and adjustment paths

| Path | Authority amount | Current evidence | Candidate/public state | Result |
|---|---:|---|---|---|
| Interview Week card | $500 | live product is $1,199; no current $500 lifecycle | hidden/disabled | BLOCKED |
| Complete early card PIF | $3,099 | Stripe enabled, but product is $2,799 and current lifecycle not rerun | amount source-only; checkout disabled | BLOCKED |
| Complete early Zelle PIF | $2,799 | BACS/Zelle disabled; no operational workflow proof | stripped from public config | BLOCKED |
| Complete installments | $3,299 total | no verified cadence/product/order lifecycle | stripped from public config | BLOCKED |
| Complete standard | $3,499 | authority approved; live product not updated | display anchor only; checkout disabled | BLOCKED |
| Dr J alumni | $100 | five unrelated coupons found; none eligible for 3576/5865 or 5504/5867 | stripped from public config | BLOCKED |
| Interview Week credit | $500 toward standard Complete only | no deterministic single-use/refund-safe mechanism found | stripped from public config | BLOCKED |

No coupon code, private customer identity, card data, provider nonce, token, or
student record is stored here.

## Entitlement and onboarding readback

- Product/variation 5504/5867 maps to LearnDash course 3646.
- Product/variation 3576/5865 maps to LearnDash course 5227.
- Course 3646 is published but retains the historical title
  `IV Prep Complete Masterclass`; its body is empty and current LearnDash step
  count is zero.
- Course 5227 is published but retains the historical title `Match Prep Pro`;
  its body is empty and current LearnDash step count is zero.
- No matching Events Calendar object was found for September 24, 26, 27, 29,
  October 1, October 3, Interview Week, or Session J.
- No approved exact evening clock time was found. The candidate uses only
  `Evening`.

This means product-to-course mapping is present, but Interview Week/Complete
onboarding, schedule delivery, and Webex truth are not currently proved.

## Lifecycle acceptance still required

For every activated path:

1. cart contains only the intended product/variation and amount;
2. checkout account creation or account binding succeeds;
3. payment and Woo order agree;
4. correct course access is granted;
5. the unrelated course is excluded;
6. onboarding, Calendar, and Webex information are correct;
7. receipt/order email is correct;
8. refund/cancel revokes the correct access and preserves unrelated access;
9. test artifacts are safely cleaned up without deleting evidence;
10. a fresh independent verifier repeats public rendered acceptance.

The September 4 $1 lifecycle is useful historical evidence for the underlying
bridge, but it does not authorize a new product identity, price, coupon,
installment, credit, or onboarding claim.
