# MR-WEB-0912 Foreman state delta

## Authority and source

- Canonical authority commit: `032ec66aed0bad97e8bfa434d0796bc0c1047f04` (DR-325), pushed and exact-read back.
- Universal and exact MR-WEB-0912 BOOT: PASS against canonical HQ `0feee579b0a9f2c90529220899f6cf6d21b8cd05`.
- Final production source commit: `a1330323b9647d4746c6f42f04693a9ebb9d2a83`.
- Branch: `codex/mr-web-0912-interview-week`; origin exact-readback matches.

## Final deployed source hashes

| File | SHA-256 |
|---|---|
| `missionmed-mr-p0.php` | `7a60cad77fb3407b97cf56d3fe1a08d7db17776549b2f2bff8487f3fcb3650ad` |
| `campaign-state.json` | `e067c5fc7b91d109009a26ed3fd37c73a266e2b56f623b5bc52b9a9f4c4f2e01` |
| `mr-0912.css` | `144d610e16f49b2b9f590aeef81ef2ca397415432f33ebb9eac5b3b7a5536054` |
| `mr-0912.js` | `ba63d371f5070ec4439c4cfe6f46ade1c9bbf3a7f738321515341673b0979ad5` |
| B `site.js` | `019216ebd82d5146e304fa34f99714c1a9de1734986e022c2311e56dd7b244c3` |
| B `site.css` | `5fe68c64a6c538523c5a740c10565d1360cfe93e88ae89a22f6a8e457f80f559` |

Local source and production hashes match exactly.

## Public/customer state

- Landing → rich product detail → explicit payment choice → protected Woo checkout remains live.
- Complete remains `$3,099` early card PIF, `$3,499` standard anchor, `$1,000 + 6 x $400` installments, and same-price PIF Zelle; Interview Week is included without a separate `$549` charge.
- Interview Week remains `$549` card or `$499` Zelle.
- Private Dr J access remains access-only; automatic public opening remains September 22, 2026 at noon ET.
- Interview Week dates remain October 1/4/6/8/10/11.
- A fixed, accessible `CART` button now remains visible throughout the verified enrollment funnel on desktop, tablet, and mobile, including static B pages and Woo cart/checkout.

## Financial acceptance and containment

- Controlled order `9153`: `$0.50` live Stripe charge, Woo/account/LearnDash `3646` lifecycle PASS, full Stripe/Woo refund, entitlement revocation, sessions/tokens/counter cleared.
- Controlled order `9155`: `$0.50` live Stripe charge, Woo/account/LearnDash `5227` lifecycle PASS, no separate Interview Week charge, full Stripe/Woo refund, entitlement revocation, sessions/tokens/counter cleared.
- Woo refunds: `9172` and `9173`.
- Runtime state now records `passed_two_offer_low_dollar_refunded_contained` at `2026-09-21T12:22:33+00:00`.
- The exact live-card bridge was removed from production; its byte-identical source is retained privately with mode `0600`. The temporary controller was removed from `/tmp`.
- Public product prices were never modified for testing.

## Explicitly unchanged

- Product/variation IDs and LearnDash mappings.
- Historical customer orders, payments, subscriptions, and entitlements other than the two isolated controlled test users/orders.
- Existing acceptance bindings, fail-closed/direct/mixed-cart protections, Emergency/360 commerce state, unrelated products, and unrelated dirty work.

## Recovery and provider state

- Pre-closeout plugin SHA: `6868952c3c40ad79a04c10d256089d3fcf5b153f1d370852c8f5fe3d842cfb16`.
- Exact recoverable preimages are in `/www/theresidencyacademy_209/private/mr-web-0912/20260921-founder-reversal-live-card-v2/`.
- Production mutations used exact fenced PATH leases; each reported `released=true` after its mutation.
- Final read-only provider query returned no active MR-WEB-0912, `missionmed-mr-p0`, or affected Kinsta-path lease rows.
- Kinsta site cache was cleared after final source deployment.

## Worktree custody

The three pre-existing B report modifications and unrelated untracked `Claude outputs`, `AAA_CORRECTION_V2`, `AAA_MASTERING`, and `WARM_AUDIENCE_AAA` directories remain preserved. Task documentation/evidence changes are separate from those unrelated paths.
