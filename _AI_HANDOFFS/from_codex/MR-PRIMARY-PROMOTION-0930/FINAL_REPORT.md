# MISSION RESIDENCY USCE-FRAMEWORK = PROMOTED TO PRIMARY AND LIVE

Verified September 30, 2026. Final end-to-end acceptance: 06:39:49 UTC / 02:39:49 America/New_York. This is a completed canonical promotion, not a preview or another alternate. Sole-Foreman acceptance as explicitly directed; no independent-verifier claim.

## Live destinations and deployment identity

- **Canonical primary:** https://missionmedinstitute.com/missionresidency/ — HTTP 200, index/follow, one self-canonical.
- **Legacy compatibility:** https://missionmedinstitute.com/mission-residency/ — one-hop HTTP 301 to primary; exact Facebook UTMs and encoded query parameters survive.
- **Runtime/source SHA:** `01c26f93f185d8ccf78f8ca3c1d11074a59e16ac`.
- Repository: `https://github.com/brinyu13/missionmed-hq.git`.
- Worktree: `/Users/brianb/.codex/worktrees/mm-home-mr-premium-hero/MissionMed`.
- Branch: `codex/mr-primary-promotion`. Later evidence-only commits do not change runtime identity.
- Provider: MissionMed Live on Kinsta, SSH alias `missionmed-kinsta`, webroot `/www/theresidencyacademy_209/public`.
- Provider addition: domain `missionmedinstitute.com`, FROM `^/mission-residency/?$`, TO `https://missionmedinstitute.com/missionresidency/`, 301. Existing `/ranklistiq` rule unchanged.
- Six exact scoped runtime files match source hashes; detailed manifest: [preservation.json](qa/preservation.json).

## Authority and exact-state preservation

Founder promotion directive: `/Users/brianb/.codex/attachments/6020be5b-8d15-43b5-9e07-d3a6bcc1b12d/Pasted text.txt`, SHA256 `555227ce5a88b10ea3c232296a4fedda8022c8fa81aeadcf8ca9538af8912c36`. It explicitly supersedes the preceding alternate-only restriction, permits current public-link migration and requires one Foreman. No new global policy or commercial authority was inferred.

Universal and MR-WEB-0912 BOOT: PASS. Readback HQ tip `0feee579b0a9f2c90529220899f6cf6d21b8cd05`; OS HEAD `88debb369978db36a4394f0793b48f650660925f`. Clean source baseline `8416e7c12772034b0d9f2a4c70e8e03b4a4ea24d`. Original user MR worktree, dirty shared MissionMed root and dirty OS workspace were not edited, reset, stashed or committed.

Scoped deployment leases were used through the Supabase skill; the final file-deployment lease (epoch 3833) released successfully. Final provider readback had no active promotion-task lease. Two unrelated teams held leases; they were untouched. One earlier native-provider UI lease expired before explicit release, recorded below rather than misreported as a successful release.

## Final acceptance matrix

| Requirement | Result | Actual proof |
|---|---|---|
| Approved USCE-family architecture | PASS | Actual donor stylesheet, structure and native photo-depth pattern retained; no page-wide redesign |
| Authentic student/Match Day montage | PASS | Same authentic montage derivatives and composition; Dr Brian not moved into hero |
| Marian proof | PASS | Exact Founder portrait; Assistant Program Director, St. Joseph's Paterson Family Medicine; verified existing quote retained |
| Manasa proof | PASS | Exact Founder portrait; Associate Program Director, Internal Medicine Residency, University of Illinois College of Medicine Peoria; verified existing quote retained |
| Alumni prominence | PASS | Larger editorial portrait/quote rows, strong hierarchy and distinct light proof section, not tiny incidental cards |
| Dr Brian strategy/mentorship | PASS | Authentic image; visible copy: “Work directly with Dr Brian on your communication, interview strategy and delivery.” |
| Bootcamp to Complete relationship | PASS | Near-top compact pathway says standalone personalized intensive, also opening phase of Complete with full-season mocks, feedback and support through February |
| Typography at 100% zoom | PASS | Measured hero body 15px; eyebrow/NRMP labels 13px; schedule, roles and payment text 15px; footer 14px |
| White enrollment finish | PASS | Computed background `rgb(255, 255, 255)`; readable two-program comparison; no extra Bootcamp charge with Complete |
| Parallax | PASS | Existing USCE native fixed backgrounds on desktop; normal scroll at 768px and below; no new motion dependency or scroll hijacking |
| Reduced motion | PASS | Background attachment resolves to `scroll` when reduced motion is requested |
| Keyboard/focus/touch | PASS, tested scope | Menu Enter/Escape/focus-return, FAQ keyboard operation and visible focus; principal mobile controls at least 44 by 44px |
| Contrast | PASS, measured scope | No detected visible-text AA failures across seven viewports; screenshot review supplements computed-color checks |
| Homepage navigation | PASS | Actual desktop and mobile clicks load canonical URL directly with one 200 navigation, not via legacy redirect |
| Homepage hero preservation | PASS | All eight frame objects are identical except four MR hrefs; no content, image, cadence or layout changes |
| Current public links | PASS | Ten-route crawl found zero legacy MR anchors after scripts settled |
| Legacy/social traffic | PASS | No-query, exact requested Facebook query and encoded-query tests each return 301 then 200; no chain/loop |
| Legacy fragments | PASS | Browser preserves fragment; meaningful `dates`, `method`, `programs`, `other-ways`, `emergency-prep` aliases present |
| Canonical/indexing/sitemap | PASS | One canonical pointing to new URL, no noindex, new sitemap URL once and old URL absent |
| Analytics | PASS, browser emission | Exactly one GA4 `page_view`, measurement `G-B4B4E26HMW`, on canonical path with incoming Facebook UTMs; program-intent event observed |
| Bootcamp card checkout | PASS, non-financial | Existing product 5504 / variation 5867; actual CTA to product to checkout, total $549 |
| Complete card checkout | PASS, non-financial | Existing product 3576 / variation 5865; actual CTA to product to checkout, total $3,099 |
| Zelle/card surfaces | PASS, smoke | Stripe and BACS controls render; settled selected-Zelle totals $499 Bootcamp / $3,099 Complete; no submission |
| Source/runtime and preservation | PASS | Six deployed file hashes match; 68 existing MU files and 45 legacy-primary files match preservation manifests; shared JS changes href-only |
| Rollback | READY, not executed | Private exact preimages, prior native backup, narrow source/provider reversal instructions in ROLLBACK.md |

Headline remains:

> YOU EARNED THE INTERVIEW.
> NOW LET'S TURN IT INTO A MATCH.

## Responsive and performance evidence

Fresh anonymous rendered production, not local preview. All seven rows have HTTP 200, zero horizontal overflow, broken images, measured contrast failures, critical JavaScript errors and first-party network failures. Hero, evidence, pathway, training, Complete, rhythm, alumni, mentor, Matrix, FAQ, enrollment and footer were included in scrolling/rendered review.

| Viewport | Visual/accessibility result | CLS | First sample LCP |
|---|---|---:|---:|
| 1440 x 900 | PASS | 0.00062 | 15.400s; exception retained |
| 1366 x 768 | PASS | 0.00064 | 0.336s |
| 1280 x 800 | PASS | 0.00082 | 0.504s |
| 1024 x 900 | PASS | 0.00083 | 0.260s |
| 768 x 1024 | PASS | 0.00371 | 0.260s |
| 430 x 932 | PASS | 0.03161 | 0.236s |
| 390 x 844 | PASS | 0.03281 | 0.248s |

**Performance verdict: steady-state laboratory retests PASS; cold-edge/field performance is not certified.** One initial post-purge desktop load recorded 15.4s LCP. The cause was not established, so this is not dismissed as a proven cache-only issue. Three subsequent fresh-browser, plain-URL samples measured desktop LCP 0.248s and 0.468s, mobile 0.288s; CLS 0.00066, 0.00066, 0.03297; no long tasks or resource durations over 500ms. Lower portraits remain lazy-loaded with explicit dimensions. The slow sample remains in `accepted-qa.json`; retests are in `performance.json`. Field data, bandwidth-throttled performance and device-specific Safari certification were not part of these results.

These checks are targeted accessibility evidence, not a blanket independent WCAG certification or screen-reader audit.

## Navigation, analytics and commerce scope

Inspected current rendered routes: `/`, `/missionresidency/`, legacy `/mission-residency/` after redirect, `/usce/`, `/examprep/`, `/homepage-arena/`, `/contact/`, `/cart/`, `/my-account/`, `/compare-programs/`. Homepage header, hero, content and footer links point directly to canonical MR. Shared render-time URL mapping targets the exact old path; no bulk database search/replace and no rewriting historical evidence or external posts.

Exact requested Facebook URL is preserved:

`/mission-residency/?utm_source=facebook&utm_medium=organic&utm_campaign=mission_residency_fall_2026&utm_content=interview_to_match`

becomes the same query at `/missionresidency/` in one permanent hop. Encoded `a%2Bb`, `fall%202026` and a QA-only `fbclid` also survive unchanged. Analytics evidence proves browser emission, not completed GA4 reporting ingestion or future conversion results.

Preserved dated business truth: October 8-18, 2026 Bootcamp; $549 card / $499 Zelle; Complete $3,099 early through October 7, $3,499 standard, existing $1,000 plus six monthly $400 installment display/path. Complete includes Bootcamp, with no separate Bootcamp charge. Emergency $3,999 contact-only and 360 $5,499 SOLD OUT remain. No schedule rewrite or new commercial claim.

Read-only runtime commerce JSON hash before/after: `d9721bf8033b61762a8521c368be3d2be4eb83b1929be0e20778f21c0c233528`. USCE Elementor content hash before/after: `0771af807df4bdb50bf115a3b075bb2094904fb656110f097c5506f4efe7e7c5`.

No new products, price changes, Stripe/Zelle edits, payment-verification changes, account/order/payment/entitlement mutations or real transaction submissions were performed by this release. Anonymous add-to-cart smoke testing creates normal temporary Woo sessions; this is not a claim of zero database writes. Payment -> entitlement -> refund lifecycle, admin Zelle verification and installments were not re-certified in this presentation promotion.

## Runtime scope and rollback

Changed files, all below `wp-content/mu-plugins/`:

1. `missionmed-mr-alternate.php`: promoted metadata/rendering mode; safe missing-dependency response.
2. `missionmed-mr-alternate-assets/page.php`: bounded proof/mentor/pathway refinement, canonical metadata, navigation and legacy anchor aliases.
3. `missionmed-mr-alternate-assets/alternate.css`: editorial portraits, readability and focus refinements.
4. NEW `missionmed-mr-primary-routing.php`: exact-path current-public navigation/canonical/sitemap migration and fallback routing; narrow late-bound anchor normalization.
5. `missionmed-mr-0912-assets/premium-hero/hero.js`: one old-path literal to canonical-path literal only.
6. `missionmed-mr-0912-assets/js/mr-0912.js`: two old-path literals to canonical-path literals only.

Plus one exact Kinsta redirect rule and page/edge cache purge. No WordPress page, theme or product database object was rewritten. Runtime metadata adapts through filters.

Rollback target: baseline `8416e7c12772034b0d9f2a4c70e8e03b4a4ea24d`; preceding alternate `c57cd227bab6f59acecef628f129e79920d9cc1a`; protected old primary `07dd87ac647d7571c3277799f52a173a4aaf10fe` remains physically intact.

Private custody: `/www/theresidencyacademy_209/private/mr-primary-promotion-0930/`. Original preimage archive SHA256 `7cbff414984cef725c41f1bc7f6a6b0150c6560257a102242e63875ac610d6b2`. Additional tranche preimages and exact sequence are in [ROLLBACK.md](ROLLBACK.md). **Rollback must remove the exact Kinsta rule as well as restore five scoped files and recoverably disable the new routing plugin.** Merely disabling the renderer cannot reverse the server rule. Never whole-site restore over commerce or unrelated advances.

Native backup readback: `Pre premium hero release 2026-09-29`, September 29 at 8:35 PM ET, expiration October 13 at 8:35 PM ET, restore control visible. Backup was not created, renamed, deleted or restored by this run.

## Fix-forward and operational exceptions

Initial tests were not all green. Their evidence was preserved; final acceptance supersedes them only for the corrected fact.

- Exact-URL purge HTTP success did not prove edge invalidation. Plain public URLs were stale; required page/edge purge and propagation were completed before final readback.
- A cached WordPress/PHP 301 dropped UTMs because Kinsta served the no-query cached Location. The native pre-cache Kinsta rule fixes this; exact warm and fresh parameter tests pass.
- Shared client-side theme code restored two legacy links after initial DOM rewriting. Href-only source corrections and the exact anchor guard fixed final settled navigation; no commerce logic changed.
- Bootcamp Zelle checkout initially displays the card amount before its existing AJAX recalculation. Acceptance waits for the settled order total and selected BACS state; no payment code was modified to satisfy the test.
- `wp kinsta cache purge --site` printed success but segfaulted on process shutdown (exit 139). No public core dump was found. Subsequent purges used the same installed plugin's native page/edge endpoint through authorized SSH; object cache was not purged. Public site remained healthy.
- Native-provider UI lease expired before explicit release; no ongoing promotion lease remains. Final file lease release succeeded. Unrelated concurrent leases were not cleared. This is an audit exception, not a claim that every lease release succeeded.

## Brain update and STATE DELTA

Brain product record and generated context pack were updated solely from current evidence. Build and verifier PASS, zero warnings, exact two-file commit pushed and remotely read back: `bc17b70da874bee51ffd2e97094619d611836211`, branch `codex/missionmed-brain-v0`.

| Before | After |
|---|---|
| `/missionresidency/` separate noindex alternate | Indexed canonical primary with final bounded refinements |
| `/mission-residency/` independent primary | One-hop permanent compatibility route preserving campaign parameters |
| Public MR links use legacy route | Audited public links and four homepage hero destinations use canonical directly |
| Alternate canonical points to legacy | Canonical self-reference; sitemap canonical once, legacy absent |
| Small alumni portraits / less explicit pathway | Larger authentic editorial proof, direct mentorship and compact personalized Bootcamp-to-Complete relationship |
| Brain records alternate-only restriction | Later Founder promotion authority and exact live routing/rollback recorded; earlier states retained as history |

Protected: USCE implementation, main-homepage hero design/copy/images/cadence, old primary presentation files, products/prices/payment architecture, orders/accounts/entitlements, dirty shared workspaces. Source and evidence are committed on the scoped branch; ignored local intermediate QA artifacts remain preserved rather than deleted. No worker/thread was spawned.

## Evidence index and remaining items

- [Final 15-check acceptance](qa/acceptance.json)
- [Seven-width measured QA](qa/accepted-qa.json)
- [Final performance retests](qa/performance.json)
- [Runtime/preservation/keyboard proof](qa/preservation.json)
- [Product-to-card-checkout smoke](qa/regression.json)
- [Final current-public route readback](accepted/readback.json)
- [Desktop full-page proof](qa/accepted-1440-full.png)
- [Mobile full-page proof](qa/accepted-390-full.png)
- [Execution contract](EXECUTION.md) and [exact rollback](ROLLBACK.md)

No known launch-critical blocker remains within this presentation/routing scope. Noncritical deferred items: investigate/reassess the isolated slow post-purge performance sample against field/cold-edge evidence; real-traffic conversion outcomes; higher-resolution original Manasa portrait if Founder supplies one (current exact 157x180 source was retained, not AI recreated). No broader CRO redesign or financial test is authorized by this closure. Task complete; stop.
