# 09 — DESKTOP / MOBILE QA

**Method:** candidate served at `http://127.0.0.1:8790`, exercised in a real Chromium engine (browser pane) and captured with headless Chrome. Every result below was measured, not assumed.

---

## 1. CAMPAIGN STATE MATRIX — all four states exercised

| | `STATE_PRELAUNCH` | `STATE_A_FALL_ACCESS` | `STATE_B_STANDARD` | `STATE_C_CLOSED` |
|---|---|---|---|---|
| Resolver reason | `NOT_VERIFIED_LIVE` | `IN_WINDOW` | `WINDOW_CLOSED` | `SALES_CLOSED` |
| Campaign banner | hidden | **shown** | hidden | hidden |
| Enrol CTAs | no | yes | yes | no |
| Complete (card/bank) | $3,299 / $3,199 | **$2,799 / $2,799** | $3,299 / $3,199 | $3,299 |
| Essentials | $1,399 | **$1,199** | $1,399 | $1,399 |
| Bank advantage | $100 | **$0** | $100 | $100 |
| 360 | closed | closed | closed | closed |
| PS Priority | closed | **open** | **auto-closed** | closed |

**PASS.** The Sept 8 flip requires no human action, and PS Priority self-closes on its own `sales_close` independent of global state. This is acceptance criteria 12 and 32.

---

## 2. ACCESSIBILITY

| Check | Result |
|---|---|
| Heading order | **PASS** — `h1,h2,h2,h2,h3,h3,h3,h2,h2,h3,h3,h2`, no skipped levels |
| Colour contrast (WCAG AA) | **PASS** — 55 text elements measured with correct alpha compositing over the true painted background: **0 failures** |
| Primary CTA (dark on gold gradient) | **9.52:1** |
| Ghost CTA | **19.91:1** |
| Unlabeled links/buttons | **0** |
| Touch targets ≥44px | **PASS** in production markup. Only the preview-bar `<select>` (30px) is under — preview-only chrome, dropped at productionization |
| Focus visibility | **PASS** — `:focus-visible` 3px gold outline, 3px offset, on all interactive elements |
| Reduced motion | **PASS** — `prefers-reduced-motion` disables transitions and hover transforms |
| Table semantics | **PASS** — `<caption>`, `<th scope="col">`, `<th scope="row">`; mobile reflow preserves labels via `data-label` |
| Campaign bar | `role="status"`; carries `data-suppressed-reason` when hidden so QA can prove *why* |

> **Correction worth recording:** the first contrast pass reported ~1.0 ratios and looked like a wholesale failure. That measurement was wrong — it treated `rgba(255,255,255,0.035)` card backgrounds and CSS gradients as opaque white. Re-measured with proper compositing, the result is a clean pass. No CSS was changed on account of it.

---

## 3. RESPONSIVE

| Viewport | Result |
|---|---|
| 1440px desktop | **PASS** — 3-up program grid, table comparison |
| 375px mobile | **PASS** — `scrollWidth === clientWidth === 375`, **zero horizontally overflowing elements**, single-column cards, comparison table reflows to per-program cards |

> Mobile PNGs show apparent right-edge clipping. This is a **headless-capture artifact**, not a layout bug — verified by direct DOM measurement at 375px and by a live browser-pane screenshot at 375×812, both clean.

---

## 4. CONSOLE / NETWORK

| Page | Errors | Warnings |
|---|---|---|
| `mission-residency.html` (A, B, P) | **0** | 0 |
| `compare.html` (A, B) | **0** | 0 |
| `checkout-boundary.html` (both products) | **0** | 0 |
| `home-commercial.html` (A, P) | **0** | 0 |
| `index.html` | **0** | 0 |

Only intentional output: `[MM] banned-term audit clean · state=…`.

---

## 5. BANNED-TERM AUDIT (runtime, every page load)

`auditBannedTerms()` asserts the rendered DOM against `banned_terms` + `banned_wording`: **"flex mock", "flex mocks", "unlimited mocks", "unlimited mock interviews", "SOLD OUT", "OPENING SOON"**.

**Result across all five pages and all four states: `clean: true`, `violations: []`.** Exposed at `window.__MM_AUDIT__`.

> **The guard caught a real leak during QA — on the preview hub itself.** `index.html`'s founder-review notes originally quoted `"unlimited mock interviews"` verbatim while describing the live 360 problem, and the auditor correctly reported `clean: false`. The note was rephrased to describe the claim rather than reproduce it. The guard was deliberately *not* weakened or exempted: a check that raises false alarms on its own commentary is one people learn to ignore. Re-verified clean afterwards.
>
> Note the auditor reads `innerText`, so inline `<script>` source and HTML comments are correctly not scanned — only text a visitor can actually read.

---

## 6. CONVERSION / COMPREHENSION CHECKS

| Requirement | Result |
|---|---|
| Complete vs Essentials distinguishable in 5s | **PASS** — cards lead with "who it is for"; Complete carries "Most chosen", the mock benefit, season-long support |
| One dominant CTA per section | **PASS** — exactly one `--primary` per section; alternatives are ghost/quiet |
| Price visible without scrolling past the card | **PASS** |
| Payment hierarchy not four equal boxes | **PASS** — three visually unequal ranks |
| Zelle visually preferred | **PASS** in both states, and honest in each (dollar saving only shown when one exists) |
| No stale-price leakage | **PASS** — no page contains a literal price |
| No old-name leakage | **PASS** — "Match Prep Pro" appears nowhere in the candidate |
| 360 visible but closed | **PASS** — full premium card, $5,499 reference, no add-to-cart |

---

## 7. NOT TESTED (and why)

| Not tested | Reason |
|---|---|
| Live checkout, cart, payment capture | No production mutation authorized. Candidate terminates at a labeled staging boundary |
| LearnDash entitlement grant | Requires a real purchase — **this is P0-3, the launch gate** |
| Confirmation email | Same |
| Analytics event delivery | Site Kit/GA4 binding is a Codex task; the candidate emits the dataLayer contract only |
| Screen-reader pass (VoiceOver/NVDA) | Semantics verified structurally; a human AT pass is still recommended before launch |
| Real-device mobile | Emulated at 375px only |

---

## 8. SCREENSHOTS

`screenshots/` — `mr_desktop_stateA.png` · `mr_desktop_stateB_sept8.png` · `mr_desktop_stateP_prelaunch.png` · `mr_mobile_stateA.png` · `compare_desktop_stateA.png` · `compare_mobile_stateA.png` · `checkout_boundary_stateB.png` · `home_inserts_stateA.png` · `preview_hub.png`


---

# V2 QA — after the visual correction (MR-WEB-0902B)

Re-run against the rebuilt visual system. Everything in the V1 sections above still holds; this records what changed and what the rebuild broke and fixed.

## Contrast — measured with alpha compositing over the true painted background

| Page | Elements checked | AA failures | Lowest ratio |
|---|---|---|---|
| `mission-residency.html` | **142** | **0** | **5.01** |
| `compare.html` | 46 | 0 | 4.56 |

Buttons verified against their own painted backgrounds: gold CTA **9.52:1** at the darkest end of its gradient, 13.19:1 at the lightest.

## Responsive

| Page @375px | `scrollWidth` | Overflowing elements | Targets <44px |
|---|---|---|---|
| `mission-residency.html` | **375** (= viewport) | **0** | 0 |
| `compare.html` | 375 | 0 | 0 |
| `home-corporate.html` | 375 | 0 | 0 |

## Console

Zero errors on every page in every state, verified in a **fresh tab**. (Console readings accumulate across navigations within a tab — two "banned term" errors seen mid-session were stale entries from an earlier `index.html` load, not live defects. Confirmed by reading `window.__MM_AUDIT__` on each page directly.)

## Banned-term audit
`clean: true` on all five pages across all four states.

## Defects found and fixed during the V2 rebuild

| # | Defect | Severity | Fix |
|---|---|---|---|
| 6 | Headings on light sections rendered **near-white on paper — invisible**. `.mmv h2` (0,1,1) is declared after `.v-env--paper h2` (0,1,1), so it won | **High** | Qualified the paper rules to (0,2,1) |
| 7 | The 360 card's **"2027-28 Priority Access" CTA was white-on-white at 1.04:1** — an invisible call to action. Same trap: `.mmv a.v-btn--glass` (0,2,1) beat the paper override | **High** | Added a `.mmv .v-env--paper` button block. This also rescued the Essentials "Enroll" button on the comparison table, which was invisible for the same reason |
| 8 | **Mobile overflowed**: `scrollWidth` 408 vs 375 viewport. `.v-grid--2` used a bare `minmax(380px, 1fr)`, which cannot fit a 335px content box | **High** | Every grid minimum wrapped in `min(100%, …)` |
| 9 | Status green 1.66:1 and muted gray 2.39:1 on paper | Medium | Light-environment variants at ~5:1 and ~6:1 |
| 10 | Comparison table row labels 4.14:1, closed text 2.76:1 on paper | Medium | Darkened to #556071 (6.16:1) |
| 11 | Hero looked washed out — the asset is 1277×473 and a 900px hero upscaled it ~1.9× | Medium | Hero capped at 720px; `object-position` holds the patch in frame |
| 12 | The hero scrim was a flat wash that flattened the photograph to grey | Medium | Scrim weighted horizontally (dark under the copy, image breathing on the right); flat wash restored under 900px where copy spans full width |

## Non-defects investigated and dismissed

- **Gold CTA reported at 1.02:1** — my measurement script reassigned the hero button's background to dark *after* setting it to gold. Verified directly: 9.52:1. No change made.
- **Right-edge clipping in mobile PNGs** — headless capture artifact. DOM measurement at 375px shows zero overflow. No change made.
- **The live Mission Residency hero appearing ~6,500px tall** in a full-page capture — an artifact of capturing a `100vh` layout in a very tall window, not a live defect. The fair comparison is the matched 1440×900 pair.

## Still not tested
Unchanged from V1: live checkout, entitlement grant, confirmation email, analytics delivery, screen-reader pass, real-device mobile. Plus: **video playback was verified as reachable (HTTP 206, range requests supported) but not played end-to-end in QA.**
