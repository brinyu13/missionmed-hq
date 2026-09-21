# DRJ-EXAMPREP-0921D Rollback

This pass changed only two live MU-plugin files. It did not change Woo product prices, subscriptions, orders, coupons, Stripe settings, entitlements, webhooks, or database schema.

Final production backup created immediately before the final accessibility fix-forward:

`/www/theresidencyacademy_209/private/codex-backups/DRJ-EXAMPREP-0921D/20260921-144705-visual-acceptance`

Earlier 0921D preimages retained for stepwise recovery:

- `/www/theresidencyacademy_209/private/codex-backups/DRJ-EXAMPREP-0921D/20260921-143850-visual-acceptance`
- `/www/theresidencyacademy_209/private/codex-backups/DRJ-EXAMPREP-0921D/20260921-144103-visual-acceptance`

To roll back only this visual pass:

1. Confirm the intended production site and current live hashes.
2. Acquire the same exact PATH lease for the two MU-plugin paths.
3. Copy both files from the chosen backup directory to:
   - `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-drj-examprep-commerce.php`
   - `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-examprep-enrollment.php`
4. Set file mode `0644`, clear WordPress/Elementor caches, and read back SHA-256.
5. Rerun the enrollment, add-on, and purchase-success focused regression files from this handoff.
6. Release the PATH lease and record the rollback receipt.

Do not roll back the 0921C purchase-success, webhook, subscription, or entitlement architecture as part of a visual rollback.
