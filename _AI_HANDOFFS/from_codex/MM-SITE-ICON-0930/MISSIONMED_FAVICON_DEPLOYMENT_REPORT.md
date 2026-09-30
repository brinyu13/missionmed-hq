# MISSIONMED FAVICON = LIVE

Completed: September 29, 2026 ET / September 30, 2026 UTC
Runtime source commit: `65436e554931b9b95cda85dd14f9bc16a061cb65`

## Implementation

- Canonical WordPress mechanism: `site_icon` changed from attachment `3465` to attachment `9199`.
- Canonical source attachment: `/wp-content/uploads/2026/09/missionmed-favicon-512.png`.
- WordPress metadata now resolves exact 32, 180, and 192 px derivatives from the Founder package plus the standard generated 270 px tile derivative.
- Root compatibility asset: `/favicon.ico`.
- Custom-renderer fallback: `/wp-content/mu-plugins/missionmed-site-icon.php` injects versioned icon metadata only when an HTML document omitted a browser icon. Normal WordPress pages continue to use WordPress's built-in site-icon output.
- Fallback assets: `/wp-content/mu-plugins/missionmed-site-icon-assets/`.
- No PWA manifest was added.

The supplied 180, 192, and 512 px PNGs contained detached wordmark residue to the right of the crest. Only the detached pixels were removed. Every remaining crest pixel was preserved byte-for-byte and translated intact to the horizontal center of the original transparent canvas. The supplied ICO and 16, 32, and 48 px PNGs were deployed byte-identically.

## Live asset identity

| Asset | SHA-256 |
|---|---|
| `favicon.ico` | `e6c3dc8c741c5de7a7985af2e2641b0a6f36df50fd80f49495c58db99d095327` |
| 16 px PNG | `07f37890a7446b6a21c7e568b9a1c2121f2671dd363e896835a8bed5585ba507` |
| 32 px PNG | `fbb72a5a7a55eb1116d7ef6adb491fc4012836ddb01610cf1d7f169f94b5b60b` |
| 48 px PNG | `e3c64ee9f86706f769c39675adc88a756231b2bd7cfeec8ccc39c09771e5a076` |
| 180 px PNG | `49809dc9afc56e57e7699481484db56f74b99ab01ca549dfd684d43f5c376af9` |
| 192 px PNG | `892448047cdb289005529368ee40fac10b451d4a19c69913140edf6cef31a860` |
| 512 px PNG | `1ab7df4a816225f0a6dd445f702d18b1d956989268f8dbe7a00ec880bc14aa83` |

Production readback matched every listed source hash. The WordPress upload derivatives at 32, 180, and 192 px also match the same exact source hashes.

## Production verification

Fresh isolated Chromium context, device scale factor 2:

| Surface | Result | Metadata path |
|---|---|---|
| Main MissionMed homepage | PASS | Canonical WordPress upload |
| Mission Residency | PASS | Versioned custom-renderer fallback |
| Exam Prep | PASS | Canonical WordPress upload |
| USCE | PASS | Canonical WordPress upload |
| Arena landing | PASS | Canonical WordPress upload |
| Arena application route | PASS | Versioned custom-renderer fallback |
| My Account | PASS | Canonical WordPress upload |
| WordPress login | PASS | Canonical WordPress upload |

All declared favicon, high-density icon, and Apple-touch URLs returned HTTP 200 with image content types. There were zero failed favicon requests. Direct `/favicon.ico` changed from HTTP 404 before deployment to HTTP 200 after deployment and matched the supplied ICO hash.

Visual/source checks passed at 16 px, 32 px, 48 px, 180 px, 192 px, and 512 px. The transparent crest is centered, recognizable, uncropped, undistorted, and contains no wordmark fragments or added background square.

Evidence: [FAVICON_LIVE_QA.json](FAVICON_LIVE_QA.json)

## Cache and fresh-browser result

- WordPress object cache flush: PASS.
- Kinsta site-cache purge: HTTP 200.
- Kinsta CDN purge: HTTP 200.
- A separate fresh Chrome tab was opened after purge and loaded the public homepage successfully.
- The automated production sweep used a new browser instance/context rather than an already-open cached tab.

## Regression containment

No Mission Residency presentation, Hero, Zelle, Stripe, WooCommerce product, price, enrollment, Matrix, or LearnDash file/object was changed.

Read-only post-deployment controls:

- Mission Residency Zelle verifier SHA remained `b4813d439bcf78f61ca362d77db61211abb6f90dce8931353f4999fe93d02e1d`.
- Mission Residency rendered HTML SHA remained `4f10376ed37c9a4c02a20a7d59bd004bbdbf6f74f542fdecc95c46a13b9717bf`.
- White closing-section CSS SHA remained `947ae687b570f4f60975072de8da4804cc2177a5b0cacddccffa5bb0bedfa2f3`.
- Bootcamp product/variation `5504/5867` remained published, in stock, purchasable, and `$549` card price.
- Complete product/variation `3576/5865` remained published, in stock, purchasable, `$3,099` current price, and `$3,499` regular price.

## Rollback and preimage

Private preimage and audit package:

`/www/theresidencyacademy_209/private/mm-site-icon/20260930T033109Z`

Manifest SHA-256:

`43ed9f9fbcbfb16a4570ffb62ede067e00c0ec96d6a7f8841155e5ccd83411d5`

It preserves the prior `site_icon` option (`3465`), prior attachment object/metadata, and all prior icon files. It also records that `/favicon.ico`, the fallback plugin, and the fallback asset directory were absent before this change. The prior attachment remains intact in WordPress.

Narrow rollback: restore `site_icon=3465`, remove only attachment `9199` and its generated upload files, remove only the three recorded new runtime paths, purge WordPress/Kinsta caches, then repeat the favicon sweep. The provider-native backup `Pre premium hero release 2026-09-29` remains the broader recovery point through October 13, 2026 at 8:35 PM ET.

## State delta

- Git: one favicon runtime commit, `65436e554931b9b95cda85dd14f9bc16a061cb65`.
- WordPress: one option update (`site_icon`), one media attachment (`9199`), its bounded derivative files.
- Runtime: one MU plugin, one asset directory, one root ICO.
- Cache: object/site/CDN purged successfully.
- Commerce/access data: unchanged.
