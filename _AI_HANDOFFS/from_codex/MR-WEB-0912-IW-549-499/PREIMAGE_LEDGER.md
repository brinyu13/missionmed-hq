# MR-WEB-0912 DR-296 Production Preimage Ledger

Captured 2026-09-17 before any production mutation.

## Authority and source

- Canonical authority: DR-296, canonical MissionMed OS commit `ea604521e24525ef21540808adc1f5017ab1cf0a`.
- Source candidate: `7d006bbaf1044206ab8d7c25eac47489a9cf8621` on `codex/mr-web-0912-interview-week`.
- Production source preimage: `e7ac74e129e23e501cfdfd74c36c616162f83458`; the six live file hashes exactly match this Git object.

| Production file | Preimage SHA-256 | Candidate SHA-256 |
| --- | --- | --- |
| `wp-content/mu-plugins/missionmed-mr-p0.php` | `381283703b1b90f7495b0cecbd2303d2e22f995548392b032e43dd4b6fd33015` | `a5c13e965c1ad0ecf36d3c67bb73dcef8711375b7ceb24d4f74080346c9f5660` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/index.html` | `6b20f775c8440758edea284a86cf5fffc283d7594ccd36f3b871dd865fb06bdd` | `d031d9e0cb535bf4b275a7e87759e462d637ae1319ad4686549eef19a905915e` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/scripts/finalization.js` | `696e76460bb2cfcf1f601049e13e7b9b5f56da0cf055a71ff5d322552633b70f` | `bb0fdd9e77e2caee535e41f86ed2cab20b154de051d8c6a59807e2191c568130` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/scripts/site.js` | `58a3dabebad64c59eafbef3bae4ec6876a6cccf31f7345a4e66de400f85e395f` | `06906c3cf21b47df21a8710dc433b824ab8d57a191858b649409cec8e9a7381c` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/config/campaign-state.json` | `a33ca602d0609936d59d1a306c8c3bee02801140b30fbe317687ab00ec1c9602` | `36dbe2aa51d71841bc7df764c2c31b128dbaf96f6ee4877dd45c4d54382a32db` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/js/mr-0912.js` | `80c4832097e9acd229032ef90fed7acd7519aacb8f98ab3d6e6442177878907a` | `c6279d11f49e639abdf985403240416cbf3a985e6f2b50c465d922dac80592f2` |

## WooCommerce and LearnDash

| Object | Preimage |
| --- | --- |
| Interview Week parent | Woo `5504`; `IV Prep Essentials: Interview Week`; variable; published; visible; in stock; purchasable; sold individually; derived price `$500`; LearnDash mapping `[3646]` |
| Interview Week variation | Woo `5867`; Session D Sept 26, 2026; parent `5504`; published; in stock; purchasable; sold individually; regular/current price `$500`; LearnDash mapping `[3646]` |
| Complete parent | Woo `3576`; published; visible; in stock; purchasable; sold individually; derived price `$3,099`; LearnDash mapping `[5227]` |
| Complete variation | Woo `5865`; parent `3576`; regular `$3,499`; sale/current `$3,099`; published; in stock; purchasable; sold individually; LearnDash mapping `[5227]` |

LearnDash Woo access statuses were read directly from the active integration:

- grant: `processing`, `completed`;
- deny: `pending`, `on-hold`, `cancelled`, `refunded`, `failed`, `checkout-draft`.

Therefore a Zelle/BACS order deliberately left `on-hold` does not grant course access.

## Payment and acceptance options

- Stripe: enabled.
- BACS/Zelle: disabled.
- Old BACS/Zelle title: `Zelle | Save $300`.
- Old BACS/Zelle description recorded in the protected rollback script.
- Private payment-instruction length: `188` bytes.
- Private payment-instruction SHA-256: `93136900808d44d37bb694a0150831d0f234ed70c45af77dcbbfb23cf46da80f`.
- Private destination/account details are intentionally omitted from this report.
- Financial test status: `waived_by_founder_not_executed`.
- Financial authority: `DR-251`.
- Zelle launch option: absent.
- Interview Week verification time: `2026-09-14T12:03:20+00:00`.
- Interview Week binding: `743e0a00ffb248b233d5bf766d3beee3970053e76cf92400aa3d04945f3ceff0`.
- Complete verification time: `2026-09-14T12:03:20+00:00`.
- Complete binding: `afda532978dba40e2e643afe49ee24bfbe5e79b70c1a5bffb30e03edd81d26c0`.
- Latest Woo order before deployment: `9102`; counted order population: `25`.

## Recovery and custody gate

- MyKinsta MissionMed Institute → Live daily backup: Sep 17, 2026, 8:09 AM; 14-day retention; visible `Restore to` control.
- Provider lease state at preflight: no active leases.
- Production mutation occurred only after the recovery point was read back and the exact DR-296 lease was acquired.

## Rollback

1. Restore the six exact source objects from Git commit `e7ac74e129e23e501cfdfd74c36c616162f83458`.
2. Run `scripts/rollback-commerce.php` with `wp eval-file` under the same narrow lease.
3. Purge the targeted page/cache layer.
4. Re-read hashes, Woo products, gateway state, mappings, bindings, orders and rendered checkout.

The rollback restores `$500`, disables Zelle, restores DR-251 bindings, and does not touch Complete pricing, existing orders, users, payments or entitlements.
