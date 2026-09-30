# MR primary promotion - exact rollback

This is a presentation/routing rollback, never a whole-site, commerce or database rollback. Refresh BOOT, source/runtime hashes, current ownership and Founder authority before executing it. Acquire the scoped routing lease. Stop if a newer deployment owns these objects.

## Current release identity

Runtime source: `01c26f93f185d8ccf78f8ca3c1d11074a59e16ac`, branch `codex/mr-primary-promotion`. Six scoped source files; current hashes are in `qa/preservation.json`. Kinsta additionally owns ONE new server rule: domain `missionmedinstitute.com`, FROM `^/mission-residency/?$`, TO `https://missionmedinstitute.com/missionresidency/`, status 301. It preserves arguments before the WordPress/page-cache boundary. The pre-existing all-domain `/ranklistiq` rule was not changed.

## Targets and custody

Baseline: `8416e7c12772034b0d9f2a4c70e8e03b4a4ea24d`, with deployed alternate source `c57cd227bab6f59acecef628f129e79920d9cc1a`. Legacy primary presentation `07dd87ac647d7571c3277799f52a173a4aaf10fe` remains physically unchanged behind the redirect.

Private Kinsta custody: `/www/theresidencyacademy_209/private/mr-primary-promotion-0930/`.

| File | SHA-256 | Contents/use |
|---|---|---|
| `preimages.tar.gz` | `7cbff414984cef725c41f1bc7f6a6b0150c6560257a102242e63875ac610d6b2` | Original wrapper, alternate assets, homepage hero.js |
| `pre-promotion-refined.tar.gz` | `fddbffe62e93ea628db9b45adcefe0264b7a1ee93bbbb907fd112759a0e09389` | Refined noindex candidate immediately before promotion |
| `pre-navigation-fix.tar.gz` | `134bb08d0d904322b89f049a96498b7ec45e65a0d52de4c265e66b6c6c90bbbf` | Includes original shared `missionmed-mr-0912-assets/js/mr-0912.js`; other files are intermediate promotion state, not the baseline |

Provider-native recovery point was visible: Sep 29, 2026 8:35 PM ET, `Pre premium hero release 2026-09-29`, expires Oct 13 at 8:35 PM, Restore to control available. Do NOT use that older whole-site restore for this narrow reversal.

## Exact recovery sequence

1. Hash-guard all six current files against `qa/preservation.json`; capture current files plus the exact Kinsta rule readback into a new private recovery directory. Never overwrite prior custody.
2. Remove only the newly added exact Kinsta rule through the authorized provider workflow. Preserve `/ranklistiq` and every unrelated rule. If using UI deletion, obtain the tool-required action-time confirmation. While the plugin remains present, its same-destination fallback still redirects.
3. Stage original wrapper, alternate `page.php`, alternate `alternate.css`, and homepage `premium-hero/hero.js` from `preimages.tar.gz`. Stage ONLY the original shared `js/mr-0912.js` from `pre-navigation-fix.tar.gz`. Do not extract an entire archive over the public tree.
4. Lint staged PHP. Atomically restore those five exact files. Move only `missionmed-mr-primary-routing.php` to private custody (recoverable disable), not deletion. Its absence reverses dynamic canonical/nav/sitemap filters; no database rewrite was performed.
5. Purge Kinsta page/edge cache using the installed plugin's supported mechanism. The plugin's native page/edge endpoint is `https://localhost/kinsta-clear-cache-all`, executed through the authorized SSH context. No object-cache or payment-state reset. Wait for edge propagation; an HTTP purge response alone is not proof.
6. Verify plain anonymous old URL returns the protected montage primary, new URL returns the noindex alternate with old primary canonical, homepage link targets reflect baseline, old/current sitemap is consistent, USCE and existing product/card/Zelle surfaces load, operational config hash unchanged. No payment submission.
7. Record provider and source changes, current hashes, QA and lease release/readback. Update Brain with the verified rollback, retaining the historical promotion record.

For a refinement-only rollback while keeping promotion, use a separately reviewed patch; do not blindly restore noindex metadata or remove the server rule. Runtime recovery never authorizes deleting candidate source, orders, payments, entitlements or unrelated work.
