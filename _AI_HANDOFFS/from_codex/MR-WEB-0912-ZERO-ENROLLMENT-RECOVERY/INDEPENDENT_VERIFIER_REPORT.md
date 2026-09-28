# MR Zero-Enrollment Recovery — Independent Verifier Report

Date: 2026-09-28
Verifier role: fresh read-only verifier
Source commit reviewed: `9255166fe36a3471ef5084cb68794a79e8a8e985`
Branch/upstream readback: `codex/mr-web-0912-interview-week` and `origin/codex/mr-web-0912-interview-week` both resolve to the reviewed commit
Production origin: <https://missionmedinstitute.com>

## Verdict

**APPROVE**

No unexplained FAIL and no launch-blocking UNVERIFIED were found. The recovery state is independently accepted for the bounded public-funnel, schedule, pricing, journey, and non-financial measurement scope. No payment was submitted, no order was placed, and no production/provider/Git mutation was performed by this verifier.

## Finding-by-finding grading

| # | Requirement | Grade | Independent evidence and conclusion |
|---:|---|---|---|
| 1 | Public access / no `DRJ2026` requirement | **PASS** | Fresh anonymous sessions loaded landing, both rich product pages, comparison, and five checkout paths without a private prompt, token, redirect, or code request. Live runtime reports `private_access.mode=public_open`, `required=false`, `granted=true`. Historical DR-325 code remains inert because its time window is closed; it is not an active customer gate. |
| 2 | Complete PIF `$3,099` through Oct 7 with `$3,499` anchor | **PASS** | Live runtime returns Complete `3576/5865`, current Woo price `3099`, standard price `3499`, and checkout eligibility. Rendered landing and Complete pages show `$3,099` through October 7 and the `$3,499` standard anchor. Fresh isolated Complete card checkout showed one Complete variation at `$3,099.00`. |
| 3 | Sale-expiry truth | **PASS** | Runtime exposes `2026-10-07T23:59:59-04:00`. Source uses `DateTimeImmutable('2026-10-07 23:59:59', America/New_York)` and switches to `$3,499` after the timestamp. Woo deployment logic sets variation 5865 regular `$3,499`, sale `$3,099`, start Sep 28, and end Oct 7 23:59:59 ET. The deadline equals `2026-10-08T03:59:59Z`; no customer-facing UTC value is shown. Future wall-clock rollover was not time-travel tested, but the deployed timezone boundary and fallback logic are explicit and internally consistent. |
| 4 | Interview Week schedule shifted exactly +7 days | **PASS** | Live runtime and fresh rendered checks agree on Oct 8 Orientation; Oct 11 Day 1; Oct 13 Day 2; Oct 15 Day 3; Oct 17 Day 4; Oct 18 Day 5/Final. Disclosed time classifications remain evening, `11 AM–4 PM ET`, evening, evening, `11 AM–4 PM ET`, and full day respectively; no new evening clock time was invented. |
| 5 | Landing → rich product → explicit choice → protected Woo checkout | **PASS** | Active landing CTA logic routes to the rich IW or Complete product route, not generic checkout. Product renderers show explicit card/Zelle choices and Complete installments. Their offer buttons carry attribution to the exact protected Woo checkout URL. Fresh isolated checkout readbacks preserved the selected variation, amount, gateway, policy links, and mixed-cart protection. |
| 6 | Payment semantics, mappings, and no duplicate IW charge | **PASS** | Fresh checkout readbacks: IW card `$549`, IW Zelle `$499`; Complete card `$3,099`, Complete Zelle `$3,099`; installments `$1,000` now plus `$400/month for 6 months`. Live runtime verifies `5504/5867 → 3646`, `3576/5865 → 5227`, and `5513/5873 → 5227`. Rendered copy states Complete includes IW and never adds a separate IW charge. Zelle copy preserves on-hold/no-access-until-verification semantics. No live payment was attempted. |
| 7 | Analytics recovery contract and UTM support | **PASS** | Deployed code and fresh browser `dataLayer` inspection prove offer-specific `view_item`, Woo `add_to_cart`, `begin_checkout`, offer identity, CTA/rail/destination fields, and UTM preservation. Purchase code requires a paid Woo order, uses Woo order ID as `transaction_id`, and has a session dedupe key; refund is a distinct event keyed to the same order and cannot emit purchase. No PII fields are included. GA4 requests to `G-B4B4E26HMW` were observed for page views. **GA4 property-side receipt/realtime reporting for every custom ecommerce event remains UNVERIFIED and is not relabeled PASS.** This is an observability gap, not an observed production-code failure. |
| 8 | Responsive QA at 1440 / 1024 / 390 | **PASS** | I independently reran the supplied production harness in a separate `/tmp` directory. All three viewport matrices returned HTTP 200, no page errors, no private/forbidden copy, no horizontal overflow, expected prices/dates, and fixed visible CART controls with at least 44 px tap targets. A separate mobile scroll sweep confirmed each reveal-on-scroll section becomes visible as it enters the viewport; the blank regions in an unscrolled full-page capture are a screenshot artifact of the deliberate reveal behavior, not a customer blank-page failure. |
| 9 | Active-source and rendered stale-string sweep | **PASS** | Scoped active-source search found no Sep 26 active deadline, obsolete Oct 1/4/6/8/10/11 role mapping, `$2,799`, `$3,399`, `$399.84`, or active `DRJ2026` gate. Fresh rendered checks likewise found no forbidden/private/stale copy. Valid new-role occurrences of Oct 8 and Oct 11 were retained. Live public JS/config assets match the reviewed commit byte-for-byte by SHA-256. |
| 10 | Rollback readiness | **PASS** | The bounded rollback record identifies a same-day MyKinsta daily recovery point with 14-day retention and restore control, plus a mode-0700 private preimage package at `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-RECOVERY-20260928T1645Z`. It records a 162,092,821-byte database export, SHA-256 `d674b1bb8f90bd63cff9c45ed9a9b6438bbea2bc68afe4f561084f31fb2d43bb`, exact source preimage hashes, six Woo objects, term 66, affected options, and a scoped restore sequence. The restore was not exercised, as expected; full-database restore is correctly reserved for disaster authority. |

## Independent live checks

- Fresh read-only runtime API readback: public access, live product IDs, LearnDash mappings, prices, schedule, Zelle semantics, and Oct 7 ET deadline all agree with the recovery contract.
- Fresh isolated Chromium acceptance at 1440, 1024, and 390: PASS.
- Fresh isolated checkout acceptance for five rails: PASS; payment submission endpoints were not invoked.
- Mixed IW + Complete cart guard: one product row retained with the protective message visible.
- Live static asset hashes equal local reviewed hashes:
  - `mr-0912.js`: `eb6c4093510b1f5c7617a0d0675755b6d5bb843f4263ec27546e1152a60e93e0`
  - `site.js`: `2ff166d399a95a39a0fceef833a8dde5f164a6719bc9ed9b46314e93297e32f8`
  - `campaign-state.json`: `12e7905a005d788c99ce3d1546405c207015cadddcaca9859c6d3ad179dbb5a7`
- Builder machine evidence critically inspected: `evidence/RECOVERY_PRODUCTION_QA.json`, generated `2026-09-28T17:15:53.313Z`, with `livePaymentSubmitted=false`.

## Non-blocking risks / boundaries

1. GA4 property-side Realtime receipt and custom-dimension registration were not available to this read-only verifier. Code, data-layer payloads, UTM carry, and the GA4 destination are proven; reporting ingestion remains an explicit follow-up observation.
2. Both a structured `dataLayer` event and a `gtag('event', ...)` command are visible for some product-view instrumentation. No duplicate GA4 network receipt was observed, but property-side validation should confirm counts are not doubled before campaign performance is interpreted.
3. No new payment/refund lifecycle was run. This recovery did not change payment mechanics and correctly relied on prior accepted lifecycle evidence plus fresh non-financial checkout checks.
4. Sale rollover after Oct 7 was verified from the explicit ET timestamp and fallback code, not by changing production time.
5. The recovery campaign was not sent and is outside this implementation acceptance.

## Final independent determination

`MR ZERO-ENROLLMENT RECOVERY STATE = LIVE: PUBLIC ACCESS + OCT8/11–18 INTERVIEW WEEK + $3099 THROUGH OCT7 + MEASUREMENT READY + INDEPENDENTLY VERIFIED`
