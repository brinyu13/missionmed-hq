# Mission Residency Montage-Hero Emergency Restoration

**Final status:** `MISSION RESIDENCY MONTAGE-HERO RESTORATION = LIVE`

**Public route:** https://missionmedinstitute.com/mission-residency/

**Completed:** 2026-09-30 UTC

## Exact historical target

The recovered presentation is the exact Mission Residency file tree at Git commit:

`88f03e5f21c0c5f3601f4128ef6ae3db6669452d`

That commit is the direct parent/tree state immediately before the rejected premium/Astra presentation commit:

`01ccd3b0db1d8f7e37337a56c9356f23eff33528`

The identification was not based on remembered copy. It was established from Git lineage and independently corroborated by the production preimage captured immediately before the rejected presentation was originally deployed:

`/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/20260930T003640Z/preimage/`

The historical source and preimage agreed byte-for-byte for the restored presentation assets:

| File | SHA-256 |
|---|---|
| `scripts/site.js` | `2f061f6d9a8312565c21a091d1bb75a2d74e02f15c2d0f330debe8db1af35a87` |
| `styles/site.css` | `77984099cd2f5c3a6b1f558801977f8352f6ab55819d74adb7aa8f8ae4be9964` |
| `student-celebrate-v2.webp` | `017dda20cf344d5369f0e234699dd73d25e8bb2045ebce9ff137405703fbd592` |

The restored authentic montage is the MissionMed student/family Match Day celebration image, not the Dr Brian portrait.

## Source and deployment identity

- Exact historical restoration commit: `94f1a2bc48d3653359e4b1e7f0d63dff729ecc10`
- Final deployed source commit: `dbe7639f0b5110e16a43c47a5416e56636a0a3dc`
- The second commit changes only the restored page's CSS/JS references to content-addressed query versions. This prevents a browser with the prior one-year static-asset cache from continuing to display the rejected version.
- Deployed `index.html` SHA-256: `00cbe4717ba40f00b9a6a134272ed9187e6cc0138b03c03076eee074dfd946a2`
- Deployed `site.js` SHA-256: `2f061f6d9a8312565c21a091d1bb75a2d74e02f15c2d0f330debe8db1af35a87`
- Deployed `site.css` SHA-256: `77984099cd2f5c3a6b1f558801977f8352f6ab55819d74adb7aa8f8ae4be9964`
- Public HTTP asset readback reproduced the exact JS, CSS and montage hashes.

Only these Mission Residency presentation files were deployed:

- `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/index.html`
- `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/scripts/site.js`
- `wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/site.css`

No main-homepage hero file was deployed or changed by this restoration.

## Live Hero result

- Authentic Match Day montage: **LIVE**
- Rejected cream/Astra Dr Brian portrait Hero: **GONE**
- Rejected `YOU BUILT THE APPLICATION...` copy: **ABSENT**
- Exact restored headline: **Train before the interview that matters.**
- Restored supporting copy: **Interview Bootcamp Week builds the live foundation. Complete stays with you through interview season.**
- Restored date ticket: **Oct 8 → Oct 18**

## Current campaign/business truth preserved

The presentation was restored without reverting live business state.

| Offer/state | Current live readback |
|---|---|
| Interview Bootcamp Week | Woo `5504` / variation `5867`; LearnDash `3646`; card `$549`; Zelle `$499` |
| IV Prep Complete | Woo `3576` / variation `5865`; LearnDash `5227`; early PIF `$3,099`; standard anchor `$3,499` |
| Complete installment | Woo `5513` / variation `5873`; `$1,000` signup plus six `$400` installments; `$3,400` contractual total |
| Public state | `public_open`; both primary offers eligible and enabled |
| Dates | Interview Bootcamp Week, October 8–18, 2026 |
| Inclusion | Complete explicitly includes Interview Bootcamp Week; no separate Bootcamp charge |

The restored page also retains the full-season Complete narrative, recurring calendar, Pre-IV Checkups, Post-IV Debriefs, Signature Mock pathway, testimonials, FAQ, pricing and enrollment choice.

## Anonymous rendered acceptance

Fresh anonymous Chromium acceptance ran after deployment and after successful site/CDN purge.

| Width | HTTP | Montage | Rejected Hero absent | Bootcamp + Complete | Dates/prices | Overflow | Broken images | Key contrast samples |
|---:|---:|---|---|---|---|---:|---:|---|
| 1440 | 200 | PASS | PASS | PASS | PASS | 0 px | 0 | PASS |
| 1366 | 200 | PASS | PASS | PASS | PASS | 0 px | 0 | PASS |
| 1024 | 200 | PASS | PASS | PASS | PASS | 0 px | 0 | PASS |
| 390 | 200 | PASS | PASS | PASS | PASS | 0 px | 0 | PASS |

Additional rendered checks:

- all page sections became visible during natural scroll;
- no JavaScript page errors;
- no first-party HTTP failures;
- no disabled enrollment CTAs;
- Facebook UTM attribution survived both the Complete and Bootcamp CTA journeys;
- Complete CTA reached `/product/match-prep-pro/`;
- Bootcamp CTA/intercept reached `/product/iv-prep-masterclass/`;
- both product routes returned HTTP 200.

## Readability and contrast

The rejected page's pale-on-cream regression was removed with the rejected presentation. Representative computed foreground/background ratios across every major restored surface all pass WCAG AA:

- Hero heading: `17.18:1`
- Hero body: `14.08:1`
- schedule heading: `12.64:1`
- schedule body: `11.39:1`
- smallest schedule note sample: `6.94:1`
- program comparison heading: `12.28:1`
- Complete/full-season headings: `14.38:1`
- closing enrollment heading: `7.02:1`
- footer: `13.89:1`

There is no standalone NRMP-survey block in the exact last-good montage presentation. Consequently the rejected NRMP cream-on-cream surface is no longer present. The current alumni/Program Director proof appears in the restored dark, high-contrast presentation and passed the same rendered review.

## Stripe, Zelle and checkout preservation

No payment was submitted and no order was created during this restoration.

Read-only/session-only checkout acceptance established:

| Offer | Cart line | Total | Stripe/Card | Zelle |
|---|---|---:|---|---|
| Interview Bootcamp Week | Correct product/variation | `$549.00` | `Credit / Debit Card` rendered | `Zelle — $499 total (save $50)` rendered |
| IV Prep Complete | Correct product/variation | `$3,099.00` | `Credit / Debit Card` rendered | `Zelle — $3,099 total` rendered |

Live operational readback:

- Stripe enabled: `yes`
- Stripe test mode: `no`
- Zelle/BACS enabled: `yes`
- Zelle verification mode: `admin_confirmation`
- Zelle destination: `missionmed`
- Zelle verifier source SHA remained `b4813d439bcf78f61ca362d77db61211abb6f90dce8931353f4999fe93d02e1d`
- Zelle QR SHA remained `7e1f116daf0b0dd23b66db87073b5db2df77d049535603a9abb8a21545ad6b15`
- Mission Residency commerce core SHA remained `65465d56ecc1c2df723709ad6e136682ba05ffa180d5ceef7934077a0ebb4e50`

Therefore the rollback was presentation-only. Stripe, Zelle, Woo mappings, LearnDash/Matrix mappings and activation behavior were not mutated.

## Cache purge

The final purge attempt passed:

- Kinsta site cache: HTTP 200 / PASS
- Kinsta CDN cache: HTTP 200 / PASS

A subsequent unparameterized request to the exact public URL returned the restored HTML from the edge cache (`CF-Cache-Status: HIT`, `x-kinsta-cache: HIT`) with the new content-versioned CSS/JS references and the montage metadata. This confirms the normal Facebook/public destination is not relying on a cache-bypass query.

The restored CSS and JS are also content-versioned in the live HTML, protecting this correction from the prior year-long static cache policy.

## Rollback-of-rollback

The exact rejected production presentation that was live immediately before this restoration is preserved at:

`/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/MR-MONTAGE-HERO-RESTORE-20260930T034647Z/preimage/`

| Rejected preimage | SHA-256 |
|---|---|
| `index.html` | `4f10376ed37c9a4c02a20a7d59bd004bbdbf6f74f542fdecc95c46a13b9717bf` |
| `scripts/site.js` | `43274ddcab26bb99346175f216275870955ff86f5eb8b0fbb35f9944e214a688` |
| `styles/site.css` | `947ae687b570f4f60975072de8da4804cc2177a5b0cacddccffa5bb0bedfa2f3` |
| manifest | `04041988a03c1e29e11fb26c045f38d4df4dccf7dd4bb84df5032a8558a6152c` |

Rollback is a three-file atomic restore followed by the same site/CDN purge. It does not touch products, pricing, orders, payments, entitlements or the main homepage.

## State delta

- Production: three Mission Residency presentation files replaced with the exact montage-era presentation plus versioned asset references.
- Git: restoration pushed in `94f1a2b` and cache-safety reference update pushed in `dbe7639`.
- WordPress data: unchanged.
- Woo products/variations: unchanged.
- Stripe/Zelle settings: unchanged.
- Orders/payments: unchanged.
- LearnDash/Matrix entitlements: unchanged.
- Main homepage Hero: unchanged by this restoration.
- Remaining launch-critical blocker: **none found**.

## Evidence

- `live-qa/montage-restore-qa.json` — four-width rendered DOM, image, content, contrast and route evidence
- `live-qa/commerce-readback.json` — CTA, product, cart/checkout and payment-rail evidence
- `live-qa/cache-purge-result.json` — successful final site/CDN purge
- `live-qa/public-asset-readback.txt` — public asset SHA readback
- `live-qa/deployed-source.txt` — deployed source identity
- `live-qa/mission-residency-*-hero.png` — final Hero screenshots
- `live-qa/mission-residency-*.png` — full-page screenshots
- `live-qa/bootcamp-checkout-readback.png` — Bootcamp checkout readback
- `live-qa/complete-checkout-readback.png` — Complete checkout readback
