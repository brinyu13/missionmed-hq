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

**Result across all pages and all four states: `clean: true`, `violations: []`.** Exposed at `window.__MM_AUDIT__`.

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
