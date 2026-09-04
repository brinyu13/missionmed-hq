# MR-WEB-0904A P1 backlog

`P1_READY = YES`

P1 is documented but must not be used to bypass the unresolved P0 backup, payment, entitlement, 360, legacy-plan, pricing, page, route, and mobile gates.

## P0 blockers to clear before deployment

1. Authenticate to MyKinsta, create/read back a provider-native snapshot, and prove a non-production restore path. The encrypted local recovery set already passes streaming restore checks but does not satisfy this provider gate.
2. Replace or harden the discovered MissionMed Hub product-to-course bridge: require an account, map each active variation through the official integration or an equivalent counter-safe path, and preserve existing-student rights.
3. Prove refund and cancel access behavior.
4. Choose one authoritative card implementation and pass a controlled test purchase.
5. Disable Affirm/Klarna unless written account/category approval exists.
6. Disable BACS unless receiving instructions, order status, entitlement workflow, and operating owner are proven.
7. Remove the live 2.9% surcharge/Zelle waiver behavior for the launch products.
8. Make 360 product 3575 technically non-purchasable while preserving existing students and the public closed/history page.
9. Make 5511–5513 and their legacy variations technically non-purchasable.
10. Audit and neutralize launch-affecting coupons and unexplained member discounts.
11. Translate the accepted candidate into the identified Elementor/Woo source with archives and a Woo-driven price/state source.
12. Run desktop/mobile card, receipt, onboarding, access, refund, and closed-SKU production acceptance.

## P1 product and presentation work

- Full corporate Elementor redesign
- Visual legacy-module library
- Matrix homepage section
- Arena homepage section
- Theme Builder Woo templates
- Mock-Ready Core Library
- IV Prep On-Call Beta
- Standalone Signature Mock product at $299
- Continued-Training Commitment / Match Guarantee after independent approval
- Affirm/Pay Later after approval
- Six- or twelve-month financing only after counsel and operational approval
- SEO and slug migration
- Expanded comparison experience
- Additional visual polish and production performance work

## Suggested execution slices

- `MR-WEB-0904B`: backup, snapshot, restore rehearsal, and complete before-state archive
- `MR-WEB-0904C`: entitlement mapping/bridge plus refund-cancel tests in staging
- `MR-WEB-0904D`: payment and subtraction closure for gateways, surcharge, coupons, 360, and legacy plans
- `MR-WEB-0904E`: Elementor/Woo translation of the accepted candidate and single-price-source integration
- `MR-WEB-0904F`: controlled production deployment, fresh buyer smoke, mobile acceptance, and final evidence

Each slice should use bounded authority and a fresh independent verifier. None should infer production acceptance from this local candidate.
