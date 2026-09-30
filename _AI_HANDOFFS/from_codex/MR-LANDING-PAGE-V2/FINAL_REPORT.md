# MISSION RESIDENCY LANDING PAGE V2 = LIVE + VERSIONED

Verified September 30, 2026. Canonical: https://missionmedinstitute.com/missionresidency/.
Sole Foreman execution. No additional worker or independent-verifier claim.

## Version control and rollback contract

| Named version | Source / deployment | Durable identity |
|---|---|---|
| MR-LANDING-PAGE-V1 | Source `8390032e4c1b33b26c4f8d7d0a7f9e2d6562eef9`; runtime source `70275a5e8675e611991f2aaa01c7a7b4dfa85de9` | `MR-LANDING-PAGE-V1.json`; deployment `mr-matrix-ecosystem-0930` |
| MR-LANDING-PAGE-V2 | Source `4ec61d14376a67d1218d56cc885d6ff5072d7493` | `MR-LANDING-PAGE-V2.json`; deployment `mr-landing-page-v2-20260930` |

V1 was frozen and committed (`d528e1c`) before V2 production presentation changes. Both source commits were normally pushed and remote-read back. Worktree: `/Users/brianb/.codex/worktrees/mm-home-mr-premium-hero/MissionMed`; branch `codex/mr-primary-promotion`.

Private server custody:

`missionmed-kinsta:/www/theresidencyacademy_209/private/mr-landing-page-versions-20260930/`

V1 has a full immutable presentation archive and separate exact page/CSS/JS preimages. V2 has its exact page/CSS/JS. All 21 other assets are unchanged and referenced by exact SHA256 in both manifests; their archive is shared from V1. Each manifest identifies all 24 files, route/runtime/cache state, source SHA and screenshots. No transactional database snapshot or restore is involved.

The template's business values continue to come from the unchanged `mm_mr_p0_runtime_config()`. No WP content/config object was modified. The wrapper header `X-MissionMed-Primary: usce-framework-v1` is an existing renderer identity, not the presentation release number; it was intentionally not relabeled.

### Exact future restore

From the authorized worktree, first run this read-only preimage/drift check:

```sh
node _AI_HANDOFFS/from_codex/MR-LANDING-PAGE-V2/restore.mjs V1
```

After current provider/registry clearance and a fresh heartbeat-protected exact three-file lease:

```sh
MR_PRESENTATION_RESTORE_LEASE_ACTIVE=1 node _AI_HANDOFFS/from_codex/MR-LANDING-PAGE-V2/restore.mjs V1 --apply
ssh missionmed-kinsta 'cd /www/theresidencyacademy_209/public && wp kinsta cache purge --site'
```

Then verify manifest hashes, protected runtime hashes, anonymous HTML, CSS/JS version readback, 1440/390 rendering and legacy redirect; release the lease. Substitute `V2` to restore this release. Both read-only restore checks passed. The script refuses an unrecognized later presentation rather than overwriting newer work. Full operational procedure: `RESTORE.md`.

## Matrix compression — measured, not estimated

| Viewport | V1 Matrix | V2 Matrix | Reduction | V1 whole page | V2 whole page | Page reduction |
|---|---:|---:|---:|---:|---:|---:|
| 1440 × 900 | 2,828.45 px | 1,350.90 px | 52.24% | 13,206 px | 11,507 px | 12.87% |
| 390 × 844 | 2,902.62 px | 1,921.05 px | 33.82% | 19,419 px | 18,448 px | 5.00% |

Desktop compression exceeds the approximate 30–40% target because the requested side-by-side screenshots and short app lines remove more vertical content than that. No spacer was added to inflate the result. Product explanations remain 16px, app explanations 15px, and primary product headings 29px on desktop.

Both authentic, previously deployed screenshots remain unchanged. Desktop shows Matrix V2 and IV Prep On-Call alongside each other; mobile stacks them. Existing accessible full-size links remain. Responsive derivatives, explicit dimensions, lazy loading and source privacy treatment are preserved. No new imagery or fake UI.

- **Matrix V2:** Your schedule, resources and available Match tools, together.
- **IV Prep On-Call:** Focused question and program practice, with supported delivery feedback.
- **StoryForge:** Develop your real experiences into stories for the interview conversation.
- **RISE:** Research programs and bring better questions to your interview preparation.
- **File Vault:** Keep your application documents organized in your protected workspace.
- **RankList IQ:** Compare programs, record your thinking and structure your own ranking decisions.

These are concise versions of the source-verified capabilities in `../MR-MATRIX-ECOSYSTEM-0930/CLAIMS_AND_ASSETS.md`, not new feature claims.

Physician-led hierarchy remains explicit: “A system around your training. Not a substitute for your mentor.” Access note remains: “Available tools and features vary by program, enrollment and account eligibility.”

## Human proof and program choice

Marian and Manasa now form a two-person editorial proof treatment: portrait/identity above a strong 30px quote, not small profile rows or generic cards. Mobile stacks portrait → quote → identity. The desktop alumni section is 840px tall, so stronger hierarchy does not create an oversized new section.

**Marian:** Exact Founder portrait; Assistant Program Director, St Joseph’s Paterson, Family Medicine. Exact quotation preserved: “You made me fall in love with my own story and believe that my dreams are valid against all Odds.”

**Manasa:** Exact Founder portrait, restrained at 180px native-aspect treatment; Associate Program Director, Internal Medicine Residency, University of Illinois College of Medicine Peoria. Exact quotation preserved: “Once your session is done, you will know exactly how to approach any interview question.” Existing June 2013 alumni attribution remains.

**Dr Brian:** The existing authentic photo and section remain. The refined paragraph emphasizes knowing the person behind the application, observing practice, direct feedback and adapting truthful experiences to the real interview. The student remains the protagonist.

**White enrollment section:** Bootcamp secondary label is **The intensive.** Complete secondary label is **Bootcamp + the season.** Every other enrollment source byte, including prices and checkout links, is unchanged.

## Motion system and actual USCE donor

Fresh read-only audit of current USCE WordPress post 5656 found native fixed-background photographic depth, CSS control transitions and mobile/iOS scroll fallbacks. It did not contain an ambient animation engine or a complete reduced-motion system. V2 reuses that actual native photographic pattern and extends it with a small, page-local system; it does not claim unsupported donor capabilities.

Desktop uses bounded image translation, two native fixed photographic backgrounds, fast one-time reveals, and six slow ambient light layers. Ambient movement is transform-only, low-opacity, 28 seconds (36 seconds on tablet), paused offscreen and when the document is hidden. One passive scroll listener schedules a single frame only when necessary. No continuous JavaScript animation loop, animation dependency, particles, scroll hijacking, background video or CTA pulsing.

Live evidence: hero matrix translation changed from 0 to 10.99px on a controlled scroll. The Complete ambient transform changed over sampled frames while reporting `running`. Both photographic backgrounds reported `fixed` on desktop. Forty elements use restrained reveal choreography. The screenshot depth is an entrance effect, not continuous floating.

### Section-by-section motion ledger

| Section | Desktop behavior | Mobile behavior | Reduced motion | Verdict |
|---|---|---|---|---|
| Montage Hero | Bounded photo depth, maximum 32px; copy fixed | Static coherent montage | Static, no transform | PASS |
| Early-interview protection | One-time restrained entry | 6px short entry | Immediately visible | PASS |
| Program relationship | One-time group entry | Short entry | Static | PASS |
| NRMP factor strip | Staged numbers/labels; slow ambient layer, no invented counting | Short entry; ambient static | Static | PASS |
| Why train | Editorial entry + subtle ambient light | Short entry | Static | PASS |
| Where interviews break down | Fast staggered cards + ambient layer | Short card entry | Static | PASS |
| What We Train | Native photographic parallax + card entry | Background scrolls normally; short entry | Static | PASS |
| NRMP evidence | Ambient light + accompanying copy entry; chart/data do not move | Short copy entry | Static | PASS |
| Bootcamp path | Staged timeline entries + slow ambient layer | Short entries | Static | PASS |
| Match Day/video | Native photo parallax; unchanged user-initiated player | Normal photo background; user-initiated video | Static photo; video still user initiated | PASS |
| Complete | Dark ambient illumination + staged inclusions | Short entries; ambient static | Static | PASS |
| Weekly rhythm | Controlled grid entry within Complete | Short entries | Static | PASS |
| Alumni | Editorial reveal + ≤3px portrait depth | Portrait → quote → identity; short reveal | Static | PASS |
| Dr Brian | ≤10px image depth in clipping frame + editorial entry | Static photo + short entry | Static | PASS |
| Matrix | One-time subtle screenshot perspective/scale; compact app entry | Short screenshot/app entry | Static, fully visible | PASS |
| FAQ / specialized options | Intentionally calm: reading and disclosure usability | Calm | Static | PASS / deliberate exception |
| Enrollment | Heading entrance only; prices, program cards and controls stable | Short heading entry | Static | PASS |
| Header/footer/cart | Utility navigation intentionally stable | Stable | Static | PASS / deliberate exception |

Visible **Pause motion** control stops background animation and photographic depth, shows all reveal content and disables fixed backgrounds. Keyboard/ARIA state reflects pause/resume. `prefers-reduced-motion: reduce` disables all decorative transforms, ambient movement and reveals, keeps all content visible and hides the unnecessary pause control. Device preference is honored; users requesting reduced motion will see the static presentation.

## Production acceptance

Actual anonymous production was scrolled at 1440×900, 1440×1000, 1366×768, 1280×800, 1024×900, 768×1024, 430×932 and 390×844. All pass: loaded images, zero horizontal overflow, readable text and correct program prices. No hidden reveal content remained after traversal.

- Computed HTML text contrast: zero failures; lowest normal-text ratio **6.17:1**, lowest tested large-text ratio **14.06:1**. Photographic text retains the approved dark overlay; ambient layers are behind content. This is not a claim to have recertified the text inside product screenshots.
- Pause: all photographed layers stop, both native backgrounds switch to scroll, all reveal content visible. Reduced-motion check: all transforms off, six ambient animations off, all content visible, pause control hidden.
- Match Day player opens its accessible dialog and initializes the existing video only after activation. Closing removes media, stops the session and returns focus. Video source, manifest, player and original JS implementation are byte-preserved; this run did not retest the entire video duration.
- No new script dependency or new image payload. HTML template −859 bytes; CSS +5,525 bytes; JavaScript +4,913 bytes: **+9,579 uncompressed source bytes net**. Existing product derivatives choose smaller sources in the compact layout.
- V1 initial measured LCP: 2,796ms desktop / 2,404ms mobile; V1 warm desktop repeat 1,600ms. V2 fresh desktop sample: **1,976ms LCP / 0 CLS**, one 71ms long task. V1 desktop CLS was 0.000654. These are bounded browser samples, not field Core Web Vitals or a statistically controlled speed claim.
- Warm same-browser local scrolling comparison: median frame interval V1 58.3ms / V2 41.7ms; p95 V1 109.3ms / V2 91.6ms. V2 recorded four long tasks (60/211/166/52ms) during the synthetic whole-page sweep, V1 none. The automation/browser environment is not a 60fps certification; no visual motion regression was observed, but these long tasks are retained in evidence rather than hidden. New code uses bounded passive/rAF work and pauses offscreen animation.
- A reload while away from the top yielded an invalid LCP=0 sample; it is retained but not used for acceptance. Fresh top-of-page measurement is `qa/v2-performance-fresh-tab.json`.

**Presentation / accessibility / bounded performance gate: PASS.** No claim of full-site accessibility certification, field performance validation or a new financial lifecycle test.

## Integrity, deployment and cache

Only `page.php`, `alternate.css`, `alternate.js` were deployed. Hash guard required the exact frozen V1 runtime immediately before atomic per-file replacement. Scoped lease fencing epoch **3868**, heartbeat confirmed, release confirmed.

Required MissionMed BOOT/dependency validation for MR-WEB-0912 and scoped worktree preflight passed before implementation. Final provider readback: zero active leases, zero pending registry waiters, V2 lease released. No canonical OS repair or authority rewrite was made. Verified release facts were appended through the existing MissionMed learning-log tool; the existing log was not replaced or cleaned.

Final public CSS SHA256: `d8ab47c3b716627a14cc04724c9d62f9030ee2ccaa92323f600786fd9fb3cd36`.
Final public JS SHA256: `a9af6d81c8026e9cd4df25206cd15a674fe1257cbe3908f5522db38137695f97`.
Page SHA256: `b412650357699ab80c49b407367b9182a93bb74b646bfb98dac1268488a6326d`.

The cache command printed “Success: Site Cache has been cleared” but exited 255 after WordPress plugin notices. An immediate HTTP sample was stale; later cookie-free canonical readback and fresh browser loads resolved V2 HTML and exact hash-versioned CSS/JS. No repeat purge loop or unrelated plugin repair was performed.

Final anonymous HTML is **byte-identical outside the allowed Matrix/teacher content, the two secondary labels and automatic CSS/JS hash versions**. All protected MR wrapper/routing/commerce/Zelle/player hashes match V1. All other static assets match. Legacy `/mission-residency/` returns 301 to `/missionresidency/` and preserves Facebook UTM parameters.

Hero copy, dates, curricula, NRMP facts, FAQ, pricing, checkout links, canonical/SEO, Zelle, Stripe, Woo, LearnDash, Matrix backend, main homepage and USCE were not changed. No order, payment, account or entitlement operation was performed.

## Evidence and comparison

All paths below are relative to this report directory:

- `MR-LANDING-PAGE-V1.json`, `MR-LANDING-PAGE-V2.json`, `RESTORE.md`, `restore.mjs`.
- `qa/v1-1440.png`, `qa/v1-390.png`, `qa/v2-1440.png`, `qa/v2-390.png`.
- `qa/v2-human-proof.png`, `qa/v2-matrix.png`, `qa/v2-method.png`, `qa/v2-match-day.png`.
- `qa/live-layout.json`, `qa/live-motion.json`, `qa/pause-motion.json`, `qa/reduced-motion-final.json`.
- `qa/v1-performance.json`, `qa/v2-performance-fresh-tab.json`, `qa/scroll-comparison.json`.
- `qa/deployment.json`, `qa/v2-public.html`, `v1/protected-hashes.txt`, `v1/usce-motion-source.txt`.

Full-page Chrome screenshots can omit off-viewport fixed backgrounds. The separate viewport captures of What We Train and Match Day show their actual live photos; those dedicated captures are the photographic-depth proof, not a blank offscreen area in a stitched full-page capture.

## Compact STATE DELTA

Production: three presentation files; same 21 remaining static assets and all protected commerce/routing/media code. No business-state mutation. Named V1/V2 private custody and manifests added. Existing USCE architecture retained. Matrix compressed, verified human proof emphasized, two program labels sharpened, optional page-wide motion added. Current user motion override is scoped to this landing page only, not a change to global MissionMed policy.

Remaining limitations: synthetic performance evidence is not field monitoring; original Manasa portrait resolution is deliberately respected; normal-motion users can pause decoration; reduced-motion users see a static page. No launch-critical blocker remains for this presentation release. No broader task is resumed.
