# Mission Residency USCE-framework alternate - final acceptance

**MISSION RESIDENCY USCE-FRAMEWORK ALTERNATE = LIVE, OPERATIONAL, AND FINAL-ACCEPTED**

Verified 2026-09-30, final preservation readback 05:32 UTC. Sole Foreman acceptance as requested; no worker or independent-verifier claim. This is a presentation release, not a new financial-lifecycle certification.

## Public comparison

- Protected primary: https://missionmedinstitute.com/mission-residency/ - HTTP 200, unchanged montage/refinement presentation.
- New alternate: https://missionmedinstitute.com/missionresidency/ - HTTP 200, operational existing enrollment links, noindex/follow.
- Read-only framework donor: https://missionmedinstitute.com/usce/ - HTTP 200, unchanged.
- Neither Mission Residency route redirects to the other. Alternate without trailing slash also returns 200.

## Source, deployment and authority

| Item | Exact record |
|---|---|
| Product repo | https://github.com/brinyu13/missionmed-hq.git |
| Worktree | `/Users/brianb/.codex/worktrees/mm-home-mr-premium-hero/MissionMed` |
| Branch | `codex/mr-usce-alternate` |
| Immutable starting checkpoint | `f6257ed428181cdb14e7a7a8c348ab6e8078910f` |
| Protected primary source | `07dd87ac647d7571c3277799f52a173a4aaf10fe` |
| First alternate deployment | `842dd85d2651ac623b87d8e2ff8c470556291740` |
| Final deployed source | `c57cd227bab6f59acecef628f129e79920d9cc1a` |
| Deployment identity | MyKinsta MissionMed Institute / Live; new isolated MU-plugin plus alternate assets |
| Private deployment custody | `/www/theresidencyacademy_209/private/mr-usce-alternate/842dd85/` |
| Founder authority | `FOUNDER_AUTHORITY.md`, SHA256 `47f2ef1cd7e8ec4fed0289398160e5c060622af3de1844262daf1221af633ef9` |
| BOOT | Universal and MR-WEB-0912 passed; canonical local prerequisites present; scoped clean-worktree preflight passed |
| Brain closure | `d9fd0146de1f52d8fcf26f1641d1e98b3a5e07d8`, `codex/missionmed-brain-v0`, pushed; product record and generated context pack only; validation passed with zero warnings |

Final source is pushed and public JS/CSS hashes match it. Later evidence-only commit containing this report does not change deployed source. No source or production files from the original dirty MR worktree, shared HQ root or dirty OS root were changed, staged or committed.

Actual USCE Elementor page 5656 and its live header were inspected and copied into alternate custody. See [implementation and component donor map](IMPLEMENTATION_AND_DONOR_MAP.md). Unmodified complete CL-1403D stylesheet and observed header CSS are pinned locally. The hero, problem/evidence/card/timeline/photo/FAQ/footer structures reuse actual donor classes and nesting, not a new visual approximation. Necessary scoped changes are documented: second CTA, six-date timeline, authentic proof, native accessible FAQ/menu, AA colors, white enrollment finish, reduced-motion/mobile treatment and a 640px cap on the donor's 88vh hero to satisfy the non-viewport-filling directive.

## Public acceptance matrix

| Gate | Result / evidence |
|---|---|
| Alternate route and isolation | PASS - exact-path GET/HEAD renderer; only two new runtime paths; no shared renderer modification |
| Primary healthy and unchanged | PASS - rendered HTML SHA before/after identical; 45 primary files and 68 existing MU-plugin files all hash-check OK |
| USCE unchanged | PASS - Elementor source SHA before/after identical; source is a read-only donor |
| SEO and discoverability | PASS - HTTP and HTML `noindex, follow`; primary canonical; alternate absent from page sitemap, primary present; no WP page/navigation/rewrite registration |
| Donor fidelity | PASS - actual shell/type/spacing/component/CSS and fixed-background pattern reused; adaptations explicitly bounded in donor map |
| Hero | PASS - authentic student montage; `YOU EARNED THE INTERVIEW. NOW LET'S TURN IT INTO A MATCH.` with exact Founder support copy; no portrait takeover/script/giant italic payoff |
| Program truth | PASS - standalone personalized Bootcamp October 8-18, 2026; Complete includes Bootcamp plus full-season work, mocks, feedback and support through February; inclusion never adds a separate Bootcamp charge |
| Early interview protection | PASS - existing on/before October 18 individualized-prep offer retained, not invented |
| Evidence | PASS - NRMP 89/87/76 ranking-factor endorsement, not Match rates; official report linked and caveated |
| Authentic human proof | PASS - real montage/Brian imagery, exact Marian and Manasa portrait bytes, current-source quotes and institution/role attribution |
| Enrollment finish | PASS - white background, two clear choices, current prices and existing product destinations |
| Motion | PASS - donor-native fixed-background photo parallax only; no new engine/scroll hijack; off at mobile/reduced-motion; text, chart, pricing and controls static |
| Responsive | PASS - seven widths below; no horizontal overflow, broken images or critical page/first-party network errors |
| Keyboard/touch | PASS - native FAQ Enter interaction, 3px visible focus; mobile menu Enter/Escape and returned focus; main product CTAs 78-80px high, menu 44px, cart 48px |
| Contrast | PASS - computed visible text checks against composited backgrounds meet 4.5:1 normal / 3:1 large; dark image overlays tested conservatively against white behind the overlay; visual readback agrees |
| Performance | PASS within controlled lab scope - responsive compressed montage, priority hero, lazy lower assets, fixed layout dimensions; measured LCP/CLS below |
| Existing checkout | PASS non-financial smoke - both actual product/variation/card checkouts load with correct totals, Stripe and Zelle controls; UTMs retained; zero payments submitted |
| Account/cart/admin navigation | PASS - account/cart 200, admin correctly redirects unauthenticated browser to login; no auth implementation change |
| Analytics requirement | PASS - existing GA4 measurement ID `G-B4B4E26HMW`, one page_view per alternate load in all seven final runs, alternate path distinguishable; Facebook UTMs survive product and checkout |
| Runtime/source integrity | PASS - direct public JS/CSS match final source; commerce config unchanged |
| Recovery | PASS - additive route rollback, source/private custody, exact current preservation manifests, native backup readback |

### Responsive and performance evidence

Final source public fresh-context Chromium runs, not a physical-device or field-CWV claim:

| Viewport | Status | Overflow / contrast failures / broken images | LCP ms | CLS |
|---|---|---|---:|---:|
| 1440x900 | PASS | 0 / 0 / 0 | 252 | 0.00040 |
| 1366x768 | PASS | 0 / 0 / 0 | 244 | 0.00073 |
| 1280x800 | PASS | 0 / 0 / 0 | 276 | 0.00052 |
| 1024x900 | PASS | 0 / 0 / 0 | 380 | 0.00079 |
| 768x1024 | PASS | 0 / 0 / 0 | 356 | 0.00437 |
| 430x932 | PASS | 0 / 0 / 0 | 260 | 0.03364 |
| 390x844 | PASS | 0 / 0 / 0 | 312 | 0.02603 |

The first public 1440 run measured LCP 1,508ms. Subsequent runs benefit from warm edge/browser-process caches. These numbers are observations, not a promise of subsecond cold LCP. No CPU/network throttling was applied. Native fixed-background behavior was verified computed and visually; mobile/reduced motion gives `background-attachment: scroll`. Later images were scrolled into view before broken-image validation. The page remains coherent without animation.

Founder-level visual self-critique: donor's 48px desktop / 32px mobile hero, compact header and 80/100px section rhythm remain recognizable; the community montage is immediate, both program paths visible, authentic people prominent, evidence structured and white enrollment calm. No generated people, fake quotes, theatrical lettering or extra animation dependency. Verified content depth makes this a long page, not sparse viewport slides.

### Current prices and destinations preserved

| Offer | Woo / variation | Course | Current amount / destination |
|---|---|---|---|
| Interview Bootcamp Week | 5504 / 5867 | 3646 | $549 card / $499 Zelle; `/product/iv-prep-masterclass/` |
| IV Prep Complete PIF | 3576 / 5865 | 5227 | $3,099 through Oct 7; $3,499 standard; `/product/match-prep-pro/` |
| Existing Complete plan | 5513 / 5873 | 5227 | $1,000 today + six monthly $400 payments; $3,400 total; unchanged existing product flow |

Smoke followed real alternate links through existing product detail to card checkout and checked correct amount/identity and card/Zelle rendering. No payment submitted, no order created, no customer account created, no entitlement grant/revoke, no changes to Stripe/Zelle/Woo/LearnDash/Matrix. Isolated anonymous test carts were used and their browser contexts closed. Existing financial acceptance remains its own prior evidence; it was not re-executed here.

### QA corrections and honest limits

- One bounded source fix (`c57cd22`) added an at-most-450ms analytics flush opportunity before product navigation, with an unconditional fallback so blocked tracking cannot trap the journey.
- A QA runner initially waited for checkout `networkidle`, which timed out despite loaded checkout. It was corrected to wait for the actual checkout URL and attached Stripe control; no commerce fix was required.
- Extra custom `mr_product_detail_intent` network events were observed for each offer across tests, but not consistently in every rapid automated navigation. Do not equate this optional beacon with guaranteed event delivery. The required existing page_view and UTM checks passed. GA4 reporting/DebugView ingestion and real-traffic attribution quality are not certified by browser request evidence.
- Pre-existing WP-CLI translation-timing notices appeared during read-only bootstrap. No such critical error or message appeared on the alternate's public pages. They were not changed under this task.
- Existing checkout includes shipping terminology for virtual products; preserved rather than expanded into unrelated checkout redesign.

## Preservation hashes

| Surface | SHA256 before = after |
|---|---|
| Primary public HTML | `4f825d9afeecc3b481a32902638f530565f2b62688057be4ed666565b06327df` |
| USCE Elementor source | `0771af807df4bdb50bf115a3b075bb2094904fb656110f097c5506f4efe7e7c5` |
| Canonical commerce config | `d9721bf8033b61762a8521c368be3d2be4eb83b1929be0e20778f21c0c233528` |

All baseline MU-plugin hashes include the existing main-page/commerce handlers. Complete lists are under `donor/`; final checks under `qa/final-readback.json`. The main homepage was not edited or re-certified.

## Guardian, cache, lease and rollback

MyKinsta Live manual backup readback: Sep 29 2026 8:35PM, note `Pre premium hero release 2026-09-29`, expires Oct 13 2026 8:35PM, restore control available. No backup created/deleted/restored. It predates the primary refinement; never use it as a blind release rollback.

Initial alternate deploy used scoped lease epoch 3807 and final JS fix epoch 3808, each mutation within the live TTL. Both released successfully, provider readback at 05:30 UTC confirmed release times 05:18:44.914157 and 05:23:03.031379. Earlier epoch 3806 expired during lease-result parsing without mutation. No active lease for this mission remained. One unrelated IVOC product lease was observed and left untouched; registry/global provider state was not falsely reported empty.

Only alternate URL variants were purged via existing Kinsta local native purge endpoint; both returned HTTP 200. HTML is no-cache/private and direct public assets use content-hash versioning. Primary/USCE/global caches were not purged.

Final provider readback at `2026-09-30 05:35:34.539432+00`: mission active leases **0**, registry active leases **0**. Both live comparison pages were opened as retained browser tabs and visibly rendered their approved montage headline.

Rollback target: **new route absent / previous 404**, while current primary montage/refinement, USCE and commerce remain live. Follow [ROLLBACK.md](ROLLBACK.md). Do not reset source or restore old primary files. Private custody preserves first archive plus pre/post fix JS. Initial archive SHA256 `795e45ed00bb06672e3bd49fd86d04e48029086bb31f0bd78dc1010ec5751528`.

## Evidence index

- `FOUNDER_AUTHORITY.md` - exact full directive.
- `IMPLEMENTATION_AND_DONOR_MAP.md` - actual donor components, source/asset/content provenance.
- `donor/` - Elementor/header readbacks, current commerce snapshot, baseline manifests.
- `qa/final-qa.json` - final seven-width responsive, accessibility, analytics and performance results.
- `qa/live-qa.json` - first public responsive/performance measurements.
- `qa/regression.json` - actual offer to checkout, UTMs, rail rendering and public route smoke.
- `qa/final-readback.json` - final hashes, isolation, sitemap, keyboard menu and direct assets.
- `qa/final-1440-full.png`, `qa/final-390-full.png`, desktop/mobile hero/alumni/enrollment screenshots - minimum retained visual evidence.
- `qa.mjs`, `regression.mjs`, `final-readback.mjs` - reproducible read-only/non-financial browser checks.
- `ROLLBACK.md` - exact additive disable/recovery procedure.
- Brain `products/mission-residency-commerce.md` and generated `packs/mission-residency-commerce.pack.md` - current state, stale historical claim explicitly superseded, no silent rewriting of history.

## STATE DELTA

**Before:** alternate 404; new handler/assets absent. Refined montage primary and actual USCE healthy. Brain still described rejected dedicated premium portrait page.

**After:** alternate live as isolated USCE-framework sibling, noindex/follow with primary canonical, no nav/sitemap entry, authentic current MR content and existing commercial links. Both URLs available to compare. Primary, donor and commerce byte-identical to captured baselines. Brain corrected from verified evidence and regenerated. Scoped leases released. No workers spawned.

**Writes:** one new MU-plugin, one new alternate-owned asset directory; scoped implementation/QA/report artifacts; two Brain files. No primary/USCE file, WordPress page, product, price, payment, user, order, entitlement, nav, global option or schema mutation. Local artifact commit only adds evidence after final deployed source.

**Remaining noncritical work:** field CWV/conversion comparison after real traffic; GA4 reporting ingestion and optional custom-click beacon consistency. Alternate promotion/indexing is not authorized by this release. No genuine Founder blocker remains. Task closed; do not start additional redesign or commerce work.
