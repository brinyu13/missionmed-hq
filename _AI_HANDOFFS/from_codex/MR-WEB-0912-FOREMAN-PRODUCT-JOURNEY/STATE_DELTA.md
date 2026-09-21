# MR-WEB-0912 Foreman state delta

## Authority and source

- Canonical authority commit: `032ec66aed0bad97e8bfa434d0796bc0c1047f04` (DR-325), pushed and exact-read back.
- Universal and exact MR-WEB-0912 BOOT: PASS against canonical HQ `0feee579b0a9f2c90529220899f6cf6d21b8cd05`.
- Production source commit: `2b1f0592f5b3d1f66e6a3adaf641946a85cc2699`.
- Branch: `codex/mr-web-0912-interview-week`; origin exact-readback matches.

## Final deployed source hashes

| File | SHA-256 |
|---|---|
| `missionmed-mr-p0.php` | `6868952c3c40ad79a04c10d256089d3fcf5b153f1d370852c8f5fe3d842cfb16` |
| `campaign-state.json` | `e067c5fc7b91d109009a26ed3fd37c73a266e2b56f623b5bc52b9a9f4c4f2e01` |
| `mr-0912.css` | `144d610e16f49b2b9f590aeef81ef2ca397415432f33ebb9eac5b3b7a5536054` |
| `mr-0912.js` | `ba63d371f5070ec4439c4cfe6f46ade1c9bbf3a7f738321515341673b0979ad5` |
| B `site.js` | `019216ebd82d5146e304fa34f99714c1a9de1734986e022c2311e56dd7b244c3` |
| B `site.css` | `5fe68c64a6c538523c5a740c10565d1360cfe93e88ae89a22f6a8e457f80f559` |

Local source and production hashes match exactly.

## Public/customer state changed

- Landing CTAs now use product-detail intent rather than direct checkout.
- Rich Complete and Interview Week product pages now contain full current decision information and payment selectors.
- Interview Week shifted exactly seven days to October 1/4/6/8/10/11 with existing time truth preserved.
- Public open moved to September 22 at noon ET.
- Complete early PIF moved through September 26; automatic standard PIF is `$3,499` afterward.
- Complete Zelle added as the same applicable PIF tuition, no discount, manual verification before access.
- Mobile landing navigation corrected; pre-checkout joined the mobile-warning and analytics funnel boundary.
- Canonical product routes now preserve UTM attribution.

## Woo/runtime objects changed

- Product descriptions/titles for `3576`, `5504`, `5513`
- Variation titles/slugs/excerpts for `5865`, `5867`, `5873`
- `pa_start-date` term `66` display name changed to Session D October 4; stable slug preserved.
- Complete variation sale end set to September 26 11:59:59 PM ET.
- Complete Zelle option enabled and Complete acceptance binding rebound to the approved price schedule.

## Explicitly unchanged

- Product/variation IDs and LearnDash mappings
- Orders, payments, historical subscriptions, customers, and historical entitlements
- IW acceptance binding and all fail-closed/mixed-cart protections
- Emergency and 360 commerce state
- Unrelated products and unrelated dirty work

## Lease/provider state

Production mutations used fenced PATH leases. Final active provider lease query returned `[]`.

## Preserved worktree dirt

The three pre-existing B report modifications and unrelated untracked `Claude outputs`, `AAA_CORRECTION_V2`, `AAA_MASTERING`, and `WARM_AUDIENCE_AAA` directories remain untouched and unstaged. The final task source is committed; the shared worktree therefore remains dirty only because those unrelated paths are preserved.
