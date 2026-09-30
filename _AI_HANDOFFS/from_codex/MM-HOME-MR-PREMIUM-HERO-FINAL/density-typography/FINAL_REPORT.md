# MissionMed homepage Hero density and typography — live release

**Verdict:** `MISSIONMED HERO DENSITY + TYPOGRAPHY REFINEMENT = LIVE`

The anonymous public homepage at <https://missionmedinstitute.com/> serves the approved eight-frame Hero with the corrected desktop density and restrained typography. Frame 01 retains the full-bleed authentic MATCHED / ACCOMPLISHED image, exact Founder-approved message, support, and CTA. No message, frame order, image, destination, campaign, commerce, or dedicated Mission Residency page source was changed for this refinement.

## Source, deployment, and rollback

- Canonical source branch: `codex/mm-home-mr-premium-hero`; deployed Hero source commit: `cf7319983044d5f99060e3d45198154c4adb7a4e`. The substantive Hero commits are `95e12c8f4299cc80348c2b11ca07ec6db8daf09e` (desktop density and type) and `cf7319983044d5f99060e3d45198154c4adb7a4e` (mobile type). Each changes only `premium-hero/hero.css`; intervening Mission Residency restoration evidence is separate concurrent work.
- Final production deployment identity: `/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/HERO-DENSITY-TYPOGRAPHY-MOBILE-CF73199-20260930`.
- Final live `hero.css` SHA-256: `16c679fe34a79fcc045eafde158b372101518ab226a3771fa44288a2009d521a`, matching the canonical source file and the anonymous public CSS response. The live Hero PHP SHA-256 remained `65465d56ecc1c2df723709ad6e136682ba05ffa180d5ceef7934077a0ebb4e50` before the second deployment.
- Immediate rollback: `HERO-DENSITY-TYPOGRAPHY-MOBILE-CF73199-20260930/preimage/hero.css`, SHA-256 `8f659a5f9cc12291fbaaea035538db083d3fce7185e09132a3dd80a4fcee4f19`. Full P0 refinement rollback: `HERO-DENSITY-TYPOGRAPHY-20260930T035137Z/preimage/hero.css`, SHA-256 `c47ac87f6b1c6d0367fa27c46cd241870fc9cdf3c17138fff897d9d35944d0a4`.
- Atomic deployment compared the previous live hash to its expected preimage, saved a byte-identical server preimage, verified the staged candidate hash, preserved ownership/mode, and read back the installed hash. Kinsta Live server cache was cleared; edge cache was purged for the root URL only; CDN cache was cleared for the same-filename CSS replacement. Anonymous public HTML and direct CSS returned HTTP 200 with the final rule and hash.

## Visual implementation

- Desktop Hero height is `clamp(620px,72vh,700px)`, replacing the fixed 880px first-view treatment. The next section starts at 648px on 1440×900, 620px on 1366×768, 1280×800, and 1024×768, and 700px on 1440×1000. Header, CTA, and controls remain visible without overlap.
- Desktop display type is fluid and constrained. The Frame 01 payoff `INTO A MATCH.` is upright and gold; the smaller connector remains the only deliberate italic in that opening. Exam Prep and USCE headings use Inter, and mobile accent lines across all eight frames are upright. The Hero system uses Inter and MMEditorial as its two principal families.
- Mobile preserves its 860px stacked composition, authentic visual crops, readable CTA, controls, and 44px manual targets. The floating cart is positioned below the header on short mobile viewports so it does not cover the controls. Tablet navigation remains available at 768px.

## Public acceptance

| Check | Result |
|---|---|
| 8 frames × 1440×900, 1440×1000, 1366×768, 1280×800, 1024×768, 768×1024, 430×932, 390×844 at Chrome 100% | **PASS** — 64/64 frame checks; exact approved headline/CTA/destination, loaded authentic image, zero horizontal overflow, accessible CTA/control hit targets, no CTA/control collision |
| Frame 01 full-bleed image and copy | **PASS** — application → interview → Match; upright payoff; next section visible on desktop |
| First-load CLS | **PASS** — two anonymous Chrome runs per measured viewport; worst 0.0015 desktop (1440×900), 0.0137 mobile (390×844), below 0.1 threshold |
| LCP / initial loading | **PASS** — measured LCP 1,424–1,900 ms across ten runs; Hero image loaded; critical head CSS present on first render |
| Keyboard, focus, manual controls | **PASS** — first Tab reaches skip link, visible focus outline, ArrowRight/ArrowLeft rotate and preserve focus/scroll, Next hit target usable on desktop and mobile |
| Reduced motion | **PASS** — autoplay remains stopped during the 12.5s observation, transitions disabled, manual keyboard navigation works |
| Browser/network | **PASS** — no page errors or failed critical same-origin requests across public runs |
| Current stale phrases | **PASS** — zero current public HTML instances of “Your application got you here” or “Now they meet you”; old static opening absent |
| Focused Hero source tests | **PASS** — 4/4 frame order, motion, stale copy, and image-budget tests; `git diff --check` clean |

The pre-existing broad test file also contains dedicated Mission Residency presentation assertions, which diverged after a separate concurrent landing-page restoration. Those assertions are outside this Hero CSS-only refinement; this release did not modify that page.

## Evidence

- [`live-qa/production-visual-qa.json`](live-qa/production-visual-qa.json) — all 64 actual public frame checks with geometry, assets, copy, destinations, console and network status.
- [`live-qa/performance.json`](live-qa/performance.json) — first-load CLS and LCP entries from ten anonymous Chrome runs.
- [`live-qa/interaction.json`](live-qa/interaction.json) — desktop, mobile, reduced-motion keyboard and focus results.
- [`live-qa/1440x900-frame-01.jpg`](live-qa/1440x900-frame-01.jpg), [`live-qa/1366x768-frame-01.jpg`](live-qa/1366x768-frame-01.jpg), [`live-qa/390x844-frame-01.jpg`](live-qa/390x844-frame-01.jpg) — final public first-frame screenshots; remaining eight-frame and viewport screenshots are alongside them.

**State delta:** The public homepage moved from an 880px presentation-like Hero with oversized theatrical italics to a 620–700px desktop Hero with controlled upright typography and visible next-section context. The approved creative architecture and product boundaries remain intact. The Founder-authorized single-thread final acceptance is recorded here.
