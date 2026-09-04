# MR-WEB-0904A payment and entitlement evidence

Verification timestamp: 2026-09-04T11:22Z

## Gate result

`CARD_PURCHASE = FAIL`

`BANK_PURCHASE = FAIL`

`ENTITLEMENT = FAIL`

The values mean the required production gates remain unsatisfied. No charge, order, refund, customer, course-access, or existing-student mutation was attempted.

## Live gateway state

- Stripe gateway: enabled, live mode, immediate capture.
- Stripe credit-card method: enabled.
- BACS: enabled without a verified receiving/fulfilment owner.
- Stripe Affirm and Klarna: enabled without the written category/account approval required by the directive.
- WooPayments parent: disabled; Apple Pay and Google Pay child methods report enabled.
- Active Code Snippet 71: `AHP-019 MissionMed 2.9% Card Fee + Zelle Waiver`.

This is not the approved P0 rail state. The live surcharge conflicts with the directive, lender methods are not approved, and more than one card surface makes the authoritative route ambiguous.

## Live product state

| ID | Live product | Price | Observed state |
|---:|---|---:|---|
| 3575 | 360 Match Mentorship | $3,999 | published, visible, purchasable |
| 3576 | Match Prep Pro | $2,799 | published, visible, purchasable |
| 5504 | IV Prep Complete Masterclass | $1,499 | published, visible, purchasable |
| 3577 | Interview Prep Foundation | $499 | hidden, purchasable |
| 5511 | legacy 360 six-month plan | — | hidden, purchasable |
| 5512 | legacy MPP six-month plan | — | hidden, purchasable |
| 5513 | legacy IV six-month plan | — | hidden, purchasable |
| 6319 | Mission Residency $1 Test | $1 | published, visible, purchasable |

Variations 5862–5873 are published and purchasable. Hidden catalog visibility is not technical closure.

## Exact entitlement implementation found

The earlier claim that no Mission Residency bridge existed was wrong. A second read-only audit located the live custom implementation at:

- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/missionmed-hub.php`
- `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/includes/class-mmed-access-audit.php`

The live files match the clean local source in `/Users/brianb/MissionMed/missionmed_worktrees/MX-DASH-6000C-build` at commit `eba31899799c11d598f1cbd2c1824146aaa403d9`.

The custom map resolves a variation through its parent and grants direct LearnDash course access:

| Product family | Course |
|---|---:|
| 3575 / 5511 and child variations | 3893 |
| 3576 / 5512 and child variations | 5227 |
| 3577 / 5504 / 5513 and child variations | 3646 |

The custom group ID is `0`; this is course access, not a membership/group grant.

## Why the mapping is not safe enough to launch

- The custom handler runs on Woo `processing` and `completed` transitions and calls `ld_update_course_access` directly.
- It has no corresponding refund, cancellation, failed-order, or subscription-expiry revocation path.
- It maintains no official LearnDash Woo access counter, so overlapping purchases and refunds cannot be reasoned about safely.
- Guest checkout is enabled, while the handler returns without granting access when the order has no WordPress user ID. A guest can therefore pay and receive no course access.
- The official LearnDash Woo 2.0.2 integration reads `_related_course`. Only product 3577 currently has `_related_course=[3646]`; the other audited products and variations do not.
- For variable products, official mapping belongs on each purchased variation. The official integration also enforces account creation and manages refund/status access transitions.
- Variations 5864–5867 had no matching orders in both HPOS and legacy order-table checks at audit time. That makes a bounded future mapping repair plausible, but it is not authorization to mutate production before the snapshot gate and staging test.
- Product 6319 has no mapping and cannot validate entitlement behavior.

## Required acceptance sequence

After the provider snapshot exists, repair the active variation mappings or replace the custom bridge with one authoritative, counter-safe path in staging. Then prove, for each enabled rail: account creation, displayed and charged amount, product/variation ID, order status, course/member grant, authenticated access, receipt/onboarding, refund/cancel behavior, and correct access removal or retention. Payment success without every entitlement step is still FAIL.
