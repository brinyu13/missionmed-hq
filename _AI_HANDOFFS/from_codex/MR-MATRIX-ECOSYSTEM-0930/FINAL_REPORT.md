# MISSION RESIDENCY MATRIX ECOSYSTEM SECTION = LIVE

September 30, 2026. Canonical live section: https://missionmedinstitute.com/missionresidency/#story

## Outcome and exact scope

Headline: **Your Training Continues Inside Matrix.**

The single screenshot / four-tag treatment is replaced by two large authentic product visuals, four substantial editorial app explanations, a concise physician-mentorship connection and one existing enrollment CTA. Desktop uses a two-column editorial app grid; mobile stacks the same content. This is not a redesign of the page.

Deployed source: **70275a5e8675e611991f2aaa01c7a7b4dfa85de9**, normal push and exact remote readback. Worktree `/Users/brianb/.codex/worktrees/mm-home-mr-premium-hero/MissionMed`, branch `codex/mr-primary-promotion`.

Eight production files changed: `page.php`, `alternate.css`, and six new screenshot WebP derivatives. No JavaScript change. No WordPress content/config object, price, order, payment, account or entitlement changed. Existing routing, commerce, Zelle, Match Day player and media manifest hashes are identical before/after. The homepage and USCE were not changed.

The final anonymous HTTP response is byte-identical outside the replaced section after normalizing only the automatic CSS hash-version parameter. Browser DOM comparisons of every other main section also match at all six widths. Hero, video, NRMP, curriculum, schedule, alumni, teacher, FAQ and enrollment remain intact.

## Authentic screenshot identities

1. **Matrix V2 Dashboard**: current production Student dashboard at `https://missionmedinstitute.com/member-dashboard/#dashboard`, captured September 30. Personal greeting/account identity and lower personal activity omitted. Published master `media/ecosystem-matrix-1440.webp`, 1440 x 1060, 210,758 bytes, SHA256 `1c60ed9011103cc2a3c568de54088f4cec6efbc0dce29eee0a2dffa3dba2d55b`.
2. **IV Prep On-Call**: current production Home at `https://missionmed-hq-production.up.railway.app/iv-prep-on-call/#home`, captured September 30. Personal greeting/initials and saved-practice/activity omitted. Published master `media/ecosystem-oncall-1440.webp`, 1440 x 605, 63,136 bytes, SHA256 `192205228ecef197b7ab1e93a414f3f5a41654865b10bcb3da86a06de71ad429`.

Assets live under `/wp-content/mu-plugins/missionmed-mr-alternate-assets/`. No fake UI, invented student data, generated screenshots, private email, file, token or account ID is published. The prior On-Call prototype image was not used because it explicitly represented a fictional/local prototype. Current sanitized screenshots were already deployed when the follow-on screenshot-reuse steer arrived; no additional asset hunt followed.

Source capabilities and exclusions are documented in `CLAIMS_AND_ASSETS.md`. Product illustrations visible inside these screenshots belong to the real existing product interface; the screenshots themselves are actual production captures.

## Final copy

### Matrix V2

Your schedule, resources and available Match tools, brought together. Start with what you need to do, then find the right place to work.

### StoryForge

**Your experiences. Ready for the conversation.**

Capture and develop your real stories, organize them in your library, and connect truthful examples to the interview questions you want to prepare for.

### RISE

**Know the program. Ask better questions.**

Explore residency programs, review available program intelligence and build your research list. Bring specific context—not generic questions—to your preparation.

### File Vault

**The materials behind your Match season.**

Keep your CV, application documents and supporting files organized in your protected workspace, ready to find and revisit as your preparation develops.

### RankList IQ

**When interviews become decisions.**

Compare programs, record your thinking and work through a structured ranking process. The priorities and the final decision stay yours.

### IV Prep On-Call

Build a focused practice session around your questions and program. Work on your delivery with feedback on pace, voice and camera framing where supported—then bring that practice back to your physician-led training.

### Access truth

**Technology supports the work. Physician mentorship stays at the center.**

**Available tools and features vary by program, enrollment and account eligibility.**

No claim that all Bootcamp enrollments receive all applications; no guarantee of outcomes, universal RISE coverage, automated rank-list submission or unreleased On-Call capabilities. CTA remains `Choose your training path` to `#enroll`.

## Production acceptance

| Width | Visual/layout | Both images loaded | Overflow | Minimum section text contrast | Other sections unchanged |
|---|---|---|---|---|---|
| 1440 | PASS | PASS | None | 6.17:1 | PASS |
| 1366 | PASS | PASS | None | 6.17:1 | PASS |
| 1024 | PASS | PASS | None | 6.17:1 | PASS |
| 768 | PASS | PASS | None | 6.17:1 | PASS |
| 430 | PASS | PASS | None | 6.17:1 | PASS |
| 390 | PASS | PASS | None | 6.17:1 | PASS |

Contrast values are computed foreground/background comparisons for new HTML text, not an assertion that every pixel of the existing product interfaces has been recertified. Body text is 16px or larger. Muted labels and entitlement note also pass 4.5:1. Native screenshot links have descriptive names/new-tab announcements; image alt text identifies the real products. Keyboard activation and pointer activation opened the correct 1440px originals. Keyboard focus is a visible 3px blue outline with 5px offset. Full-size text links are 44px high; primary CTA 56px. No new modal, dependency or interaction script.

The product images are naturally smaller on phones; tapping the image or its full-size link opens the original for native zoom. Both screenshots remain separate prominent visual anchors, with readable explanatory HTML rather than expecting mobile users to read all dashboard microtext.

### Optimization and performance

**Focused performance regression gate: PASS.** Not a field Core Web Vitals certification or a statistically controlled speed comparison.

- Each screenshot has 720/1080/1440 WebP derivatives, `srcset`/`sizes`, lazy loading, async decoding and explicit dimensions.
- At fresh 390px / DPR2, browser selected 720px variants: 58,478 + 21,004 bytes, about 79.5 KB combined.
- At desktop, largest originals total 273,894 bytes. No raw Retina PNG is shipped.
- Fresh top-of-page desktop and mobile loads requested **zero** new ecosystem images before scrolling down.
- Fresh mobile LCP sample 1,708ms, CLS 0 through loading both screenshots.
- Fresh desktop LCP sample 1,852ms, CLS 0.000654; all recorded shift sources were outside `#story`, matching the small pre-existing baseline shift. No ecosystem-section shift recorded.
- First broad resize/scroll run recorded 0.07955 overall CLS at 1440, below 0.1 but not treated as zero. The dedicated fresh-load follow-up isolated sources and measured zero new-section shift. Other five broad widths recorded zero.
- Shared JavaScript and previous CSS rules are byte-preserved; new CSS is scoped to `#story`. No new animation or change to the existing parallax/reduced-motion system.
- No browser console error observed in focused live acceptance.

The requested richer section increases its own height: desktop about 571px to 2,828px; 390px mobile about 941px to 2,903px. No extra sections or unrelated content were added. This is the cost of two large real dashboards and four readable capabilities instead of four tags.

### Anonymous serving and cache

Canonical route returned HTTP 200 without cookies. All seven public deployed assets (CSS plus six WebPs) returned HTTP 200 with exact source SHA256 using the actual hash-version URLs. Legacy `/mission-residency/?utm_source=facebook&utm_medium=acceptance` returned 301 to the canonical route with both UTM values preserved.

Kinsta cache purge printed `Success: Site Cache has been cleared.` but the WP-CLI process then exited 139 (segmentation fault). This is not reported as a clean process exit. Fresh anonymous page and exact versioned asset readbacks prove the intended release is serving. The unversioned CSS URL still returned a cached older body; production HTML references the new content-hashed URL, which matched exactly. No unrelated PHP/cache-stack repair was attempted.

## Safety, authority and rollback

Universal/MR mission prerequisite validation passed; canonical custody and bounded Founder presentation authority were checked. Deployment used exact eight-path lease epoch 3863, three successful heartbeats and confirmed release. An earlier epoch 3862 expired before deployment while the lease-result parser was corrected; no production file changed under that expired lease.

Existing MyKinsta recovery point: Sep 29, 2026 8:35 PM, `Pre premium hero release 2026-09-29`; expires Oct 13, 2026 8:35 PM; restore control visible. No backup was created, changed or restored.

Exact rollback source: **b4fb762a9861ef3221c77f0805546fd97ee4dbb2**.

Fresh rollback-of-change custody: `/www/theresidencyacademy_209/private/mr-matrix-ecosystem-0930/preimage/`. Restore only the prior page/CSS under a new lease and drift check. New media may remain unreferenced. Never restore the database or touch payments/entitlements for this presentation rollback. Exact preimage hashes and procedure are in `ROLLBACK.md` and `qa/deployment.json`.

## Evidence / state delta

- `qa/deployment.json`: exact deployed/preimage/protected hashes.
- `qa/source-gates.json`: section-only source gate.
- `qa/live-readback.json`: cookie-free public hash and legacy redirect acceptance.
- `qa/live-responsive.json`: six-width DOM/layout/contrast evidence.
- `qa/live-performance.json`, `qa/live-performance-desktop.json`: fresh lazy-loading and layout-shift evidence.
- `qa/live-1440.png`, `qa/live-1366.png`, `qa/live-1024.png`, `qa/live-768.png`, `qa/live-430.png`, `qa/live-390.png`: live rendered screenshots.

Source and evidence are separate: the deployed runtime SHA is 70275a5; the final evidence-only commit does not deploy anything additional. No independent verifier was requested or claimed for this narrowly scoped pass. Product capability review does not certify every open acceptance item in the six underlying applications.

Browser-only privacy styling was used to omit personal details from source captures. The original source tabs lost their automation attachment during the run, so restoration of those transient source-tab styles could not be verified; a normal refresh clears them. No product source, account data or persistent setting changed. Responsive overrides on the final production and active preview tabs were cleared. This is a local browser cleanup caveat, not a production blocker.

**Final acceptance: PASS for the requested section deployment.** Both product dashboards are visibly present, each application has a concrete student purpose, physician mentorship remains central, and access limitations are truthful. All out-of-scope website and commerce surfaces are preserved.
