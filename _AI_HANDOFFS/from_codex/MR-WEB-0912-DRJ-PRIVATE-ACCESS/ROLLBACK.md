# DR-299 Private Early Access Rollback

This release is source-only. It changed no WooCommerce, LearnDash, Stripe, order, payment, refund, user, entitlement, coupon, or inventory object.

Under a fresh exact-path MissionMed lease:

1. Restore these three files byte-exact from Git commit `36aaa2fbfab507003926783b870d0079689eb7a9`:
   - `wp-content/mu-plugins/missionmed-mr-p0.php`;
   - `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/scripts/site.js`;
   - `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/production.css`.
2. Verify their SHA-256 values match `PREIMAGE_LEDGER.md`.
3. Purge Kinsta cache under the same protected-change workflow.
4. Confirm the public landing, Interview Week, Complete, cart, and checkout render the pre-release behavior.
5. Re-read Woo prices/mappings, payment gateways, LearnDash status rules, acceptance bindings, and latest order `9102` to prove no data-plane drift.

The signed access cookie becomes inert when the PHP preimage is restored. No browser-cookie deletion or database cleanup is needed.
