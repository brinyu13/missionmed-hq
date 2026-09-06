# MR-WEB-0906A Rollback

The release is reversible without a database restore.

## Preferred full-ticket rollback

1. Acquire a fresh `SHARED:ROUTING` Lease V2 scope covering the MU plugin path and the private MR-WEB-0906A recovery directory.
2. Verify the current production plugin SHA-256 is `9f72885a8030f41c4e588360f467a7e2f1fed4406972c6e665a2e9d8f3afb1e7`.
3. Run [mr-web-0906a-deploy.sh](evidence-scripts/mr-web-0906a-deploy.sh) in `rollback` mode on the host. It atomically restores the exact pre-ticket file whose SHA-256 is `48c48278e0c21c98e2edc9bf6c26e8b731b2ff7838c838561432bc3df14b1fa5`.
4. Purge all cache layers with [mr-web-0906a-cache-purge.php](evidence-scripts/mr-web-0906a-cache-purge.php), retrying only CDN if the provider returns `429`.
5. Verify the active plugin hash and inspect `/` logged out at desktop and `390px`.
6. Release the lease.

This rollback restores the prior priced corporate hero. Use it only if explicitly directed or if the new hero causes a production fault.

## Hotfix-only rollback

[mr-web-0906a-hotfix-deploy.sh](evidence-scripts/mr-web-0906a-hotfix-deploy.sh) in `rollback` mode restores the initial de-priced version `fcc7bc74a7b6adc57b7ab6bc31ddedcd5fa735bc7c5c9e72a9bdd843eb4a4c4f`. That version is preserved for forensic continuity but is not recommended for public use because a legacy output normalizer changes one “IV Prep Complete” phrase to “IV Prep Essentials.”

## Elementor archive

The legacy priced block remains a draft Elementor library section, ID `9044`. It is not public and does not need to be deleted during rollback. The homepage Elementor body was never changed; its SHA-256 remained `1efd33802b9d5a15fcfc520cb0a83b388370aad09ccc6b66f551099a0545310d`.

## Data safety

Neither rollback path mutates WooCommerce product IDs, product prices, orders, student records, LearnDash entitlements, Stripe configuration, or unrelated MissionMed divisions.
