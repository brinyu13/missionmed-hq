# Live anonymous production QA — three-division showcase

Verified 2026-09-30 at `https://missionmedinstitute.com/` after a server-cache purge and a targeted canonical-root Edge-cache purge. Final public HTML was confirmed as a cache HIT using the updated Autoptimize CSS and JS aggregates.

- 1440×900, 1440×1000, 1366×768, 1280×800, 1024×768, 768×1024, 430×932, 390×844: all three scenes appeared in order; each image loaded; no horizontal overflow; no headline/support/CTA escaped its scene; no critical JS error or failed first-party request.
- 1440px and 390px: the accepted Hero manually cycled through all eight frame IDs in the approved order. Frame 01 still begins `YOU BUILT THE APPLICATION`; its CTA remains `Explore Interview Bootcamp Week`. Hero height remained 648px at 1440×900 and 860px at 390×844, matching the pre-showcase baseline.
- Desktop parallax: each image layer moved 35.2px relative to a 220px page scroll in the sampled section interval, while content followed normal document flow. Mobile uses bounded ±14px depth. No scroll hijack.
- Reduced motion at 390px: image transform `none`, glow animation `none`, three CTAs retained.
- Keyboard: tab advances from the first to second scene CTA; focused CTA outline is 3px. Text and CTA colors were inspected on actual screenshots at desktop/tablet/mobile; white/light text on dark scene overlays, dark CTA text on gold button. No text/image collision.
- Click-through test: the three live CTA clicks reached `/examprep/`, `/usce/`, `/missionresidency/` respectively; all returned HTTP 200. Current public homepage stale phrases “Your application got you here” and “Now they meet you”: zero.
- Hero visual/source regression: `hero.css` and `hero.js` remained byte-identical; the eight-frame data and pre-bridge Hero markup remained byte-identical to the pre-showcase commit. New section is after the existing bridge and before existing proof.
- First-scene image is ready by the time the intro is in view; initial page load still made five image requests in both final 1440px and 390px measurements. New below-fold derivatives did not enter initial image request lists.

## Lab measurements, same anonymous Chrome/viewport harness (3 runs each)

| Viewport | Before LCP range | Final LCP range | Before worst CLS | Final worst CLS | Before mean initial transferred bytes | Final mean initial transferred bytes |
|---|---:|---:|---:|---:|---:|---:|
| 1440×900 | 0.496–1.592s | 0.496–0.672s | 0.00155 | 0.00155 | 1,596,394 | 1,529,024 |
| 390×844 | 0.356–0.520s | 0.540–0.672s | 0.01371 | 0.01371 | 1,554,346 | 1,557,414 |

LCP element remained the existing Hero image in every measured run. Zero JS page errors and zero first-party request failures. Desktop transfer varied with which pre-existing Hero images were loaded; mobile increased about 3KB on average. These are lab runs, not field Core Web Vitals.

Raw evidence: `qa/responsive-motion.json`, `qa/performance-before.json`, `qa/performance-final.json`; viewport screenshots under `screenshots/live/`; prior-state screenshots under `screenshots/pre-showcase/`.
