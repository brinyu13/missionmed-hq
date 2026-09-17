# DR-299 Production Preimage Ledger

Captured before production mutation on 2026-09-17.

## Recovery point

- MyKinsta manual backup created Sep 17, 2026, 11:25 AM.
- Label/note: `Sept 17th`.
- Expiry: Oct 1, 2026, 11:25 AM.
- Restore control visible; 14-day retention displayed.
- No backup mutation was performed.

## Source and provider preimages

- Source preimage commit: `36aaa2fbfab507003926783b870d0079689eb7a9`.
- Production source and Git source had exact hash parity before deployment.

| File | Preimage SHA-256 | Deployed SHA-256 |
| --- | --- | --- |
| `wp-content/mu-plugins/missionmed-mr-p0.php` | `a3c5969658acc93ddc6787887240f9a4e5d9f31b08dec4f84f1b157ea5b85f52` | `62830aa98855d1b4cf2e0528fec85592a5368a4afa2e922fd5dcf202b4db27ab` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/scripts/site.js` | `06906c3cf21b47df21a8710dc433b824ab8d57a191858b649409cec8e9a7381c` | `a5a1f02eba1302af48af56c63a15bddf985fe12837283f42d96e2f48abe47b08` |
| `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/production.css` | `501ec365c40dde82f778eac098181f29f77e4125eb877d1d13d56e874d63c71e` | `c68ed0c56d702c09908431adebe34fd9df5188329ec026350bd4d661e5294bca` |

## Commerce/data preimage

- Interview Week: Woo `5504/5867`, current/regular price $549, published, in stock, purchasable, sold individually, LearnDash `[3646]`.
- Complete: Woo `3576/5865`, current sale $3,099, regular $3,499, published, in stock, purchasable, sold individually, LearnDash `[5227]`.
- Stripe enabled.
- BACS/Zelle enabled and exact-cart filtered.
- Interview Week Zelle option enabled at $499 and forced to `on-hold`.
- LearnDash granted statuses: `processing`, `completed`.
- LearnDash denied statuses include `pending`, `on-hold`, `cancelled`, `refunded`, `failed`, `checkout-draft`.
- Founder financial status: `waived_by_founder_not_executed`, authority DR-296, passed=false.
- Latest Woo order: `9102`.
- No WooCommerce or LearnDash object was in the deployment write set.
