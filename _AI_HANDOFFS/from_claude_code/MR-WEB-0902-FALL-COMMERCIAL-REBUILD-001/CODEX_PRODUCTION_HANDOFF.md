# CODEX PRODUCTION HANDOFF — MR-WEB-0902-FALL-COMMERCIAL-REBUILD-001

> **Productionize the founder-approved candidate exactly. Do not reinterpret the approved UI/UX or commercial architecture without a blocker requiring founder review.**

**Do not deploy until Dr. Brian has reviewed the preview and answered the five decisions in `10_FOUNDER_REVIEW_GUIDE.md`.**

---

## 0. COORDINATES

| | |
|---|---|
| Worktree | `/Users/brianb/MissionMed_worktrees/mr-web-0902-fall-commercial-rebuild` |
| Branch | `claude/mr-web-0902-fall-conversion-upgrade` |
| Base commit | `4d1a8f5` (`Y1-ARENA-3026: route logged-out Arena handoff to branded /my-account/ login`) |
| Visual revision | **V2** — V1 was rejected by the founder as flat/text-heavy. V2 is the candidate to productionize. |
| Candidate | `_AI_HANDOFFS/from_claude_code/MR-WEB-0902-FALL-COMMERCIAL-REBUILD-001/candidate/` |
| Production changes so far | **NONE** |

---

## 1. WHAT WAS BUILT

A config-driven commercial layer for Mission Residency: one JSON source of truth, a state resolver with two hard gates, a component renderer, styling built on tokens lifted verbatim from live page 5686, and five preview pages. Plus a full audit of the live commercial system (docs 01–09).

**Design fidelity:** no new design system. Tokens (`--mr-bg #050913`, `--mr-gold #d8b45f`, `--mr-navy #0f2a44`, Playfair Display + Inter) are taken from the live Mission Residency page. `--mr-navy` is identical to Elementor global primary.

---

## 2. DO NOT TOUCH

| System | Why |
|---|---|
| **Stripe Connect routing** (`_mmi_instructor_id`, `mmi-mixed-cart-guard.php`) | One connected account per PaymentIntent. Changing it misroutes settlement. **Explicit deployment authority required.** |
| Historical WooCommerce orders | Preserve all records through every rename |
| LearnDash course IDs and `_related_course` links | Entitlement depends on them |
| WooCommerce Memberships roles | |
| Astra 4.12.6 / Elementor kit 3372 | Reuse, do not replace |
| Cart-collision guard | Good existing UX — keep |
| Homepage proof sections (`hpv-*`, `f2-*`, `mm-ledger-*`, `mm-mentor-*`) | Preserve entirely; only the 3 unsupported stats change |
| WPCode snippet #71 (Zelle/card fee) | **Replace deliberately, do not delete blindly** — it is what makes Zelle advantaged today |

---

## 3. PRE-LAUNCH P0 GATES

### P0-1 — Close 360 (do first)
`3575` and `5511` → not purchasable, hidden from purchase. Preserve records. Display `$5,499` reference + "2026-27 Mentorship Capacity Reached / Enrollment Closed". Never "SOLD OUT".

### P0-2 — Strip banned claims
Remove **"unlimited mock interviews"** and **"Match Guarantee"** from Woo `3575` short description and from page 5686. Remove all three guarantee variants pending a written definition. Replace "7 mock interviews" (3576) and "3 mock interviews" (5504) with the configured label.

### P0-3 — Prove checkout → entitlement (the launch gate)
For each open product, using the `$1 Test` SKUs (6319/6321/6323) or a real transaction:
payment → order status → **correct** LearnDash course → membership/role → Matrix access → confirmation email → refund path.

Then set, in `campaign-state.json`:
```json
"verified_live_at": "2026-09-0XT12:00:00-04:00",
"verified_by": "<name>",
"verification_evidence": "<order id / screenshot>"
```
**Until that is set, the candidate refuses to render Fall Access pricing.** Enforced in `campaign-state.js` GATE 1, not by memory.

### P0-4 — MatchFirst™ — founder decision required
Define with written terms, or suppress for Fall Access Week.

---

## 4. WOOCOMMERCE MUTATIONS

Full detail in `05_WOOCOMMERCE_PRODUCT_MAP.md`. **Order matters** — 5504 must be renamed before 3576, or two products are briefly both called "IV Prep Complete".

| Step | ID | From | To |
|---|---|---|---|
| 1 | **5504** | `IV Prep Complete Masterclass` · $1,499 | **`IV Prep Essentials`** · $1,199 week / $1,399 standard |
| 1b | 5513 | `IV Prep Complete Masterclass – 6 Month Payment Plan` | `IV Prep Essentials – Payment Plan` |
| 2 | **3576** | `Match Prep Pro` · $2,799 | **`IV Prep Complete`** · $2,799 week / $3,299 card · $3,199 bank |
| 2b | 5512 | `Match Prep Pro – 6 Month Payment Plan` | rename + reprice (see §5) |
| 3 | **3575**, **5511** | purchasable $3,999 | **not purchasable**, $5,499 display only |
| 4 | 3577 | `Interview Prep Foundation` $499 | **founder decision** — retire or keep |
| 5 | 6319, 6321, 6323 | public `$1 Test` | hidden from catalog, reachable by URL |
| 6 | 5734, 4241 | catalog-visible, not purchasable | hide or fix |

**Redirects:** `/product/iv-prep-complete/` already 301s to 3576 and `/product/interview-emergency-prep/` to 5504. If you change slugs, keep it to **one hop — no chains.** Update CTA *labels* sitewide so buttons match destinations.

---

## 5. PAYMENT WORK

1. **Zelle mechanism (R-07).** Migrate from snippet #71's 2.9% card fee waiver to **two posted prices** ($3,299 card / $3,199 bank). Never a percentage, never the word "fee". Reconcile the separately documented `$300 off any course` Zelle discount, which matches neither model.
2. **Payment plan (R-01) — compliance blocker.** Founder requires plan total **>** PIF (ticket §14, authoritative, not withdrawn). Publishing a premium is a finance charge under **Reg Z 12 CFR 1026.4**; >4 payments can confer creditor status in states with no volume threshold. Resolve the compliant mechanism, then set `premium_amount` + `premium_published: true`. **Do not substitute a 0% same-total plan without written founder approval** — note the existing 5511/5512/5513 products are exactly that today.
3. **Affirm.** Apply via the installed Stripe gateway (not the stale native Woo Affirm plugin). Category approval needed (post-secondary education / consulting restricted). **Zero public words until written approval.** Then `payments.affirm.available: true`.
4. **Confirm which card gateway is live** — both `woocommerce-gateway-stripe` and `woocommerce-payments` are installed.

---

## 5b. THE TWO SURFACES — DO NOT COLLAPSE THEM

| Surface | Page | Gets |
|---|---|---|
| **A — corporate homepage** | **3305** | **Two added blocks only**: a seasonal Match-season band routing into Mission Residency, and a three-division band. Delete nothing. **No** pricing, comparison, payment UX, PS tiers or journey. |
| **B — Mission Residency** | **5686** | The full commercial experience — hero, journey, video wall, programs, comparison, payment hierarchy, PS, 360. |

The seasonal layer on 3305 must be **removable without redesigning the homepage** — it is one component plus a config flag. It is a merchandising priority, not a permanent division takeover. ExamPrep and Mission: Clinicals must stay first-class; the three-division band exists specifically to make them *more* discoverable than they are today.

## 5c. VISUAL ASSET WORK

1. **Move the eight Match Day videos onto page 5686.** They are on 3305 today; the page that sells has no video. Posters + `cdn.missionmedinstitute.com` mp4s, listed in `VISUAL_ASSET_INVENTORY.md`. Click-to-play, `preload="none"`, no autoplay audio.
2. **Replace `pexels-photo-4225920.jpeg`** (the one stock image that renders on 5686, behind `.mr-cta-bridge`) with `Mission_Class_Screenshot-1-scaled.png`.
3. **Optimise two images.** `DrBrian_Profile_2.png` is **6.5 MB** and `Mission_Class_Screenshot-1-scaled.png` **2.4 MB**, unoptimized despite EWWW being installed. Convert to WebP/AVIF with responsive `srcset`.
4. **Commission a larger hero original.** `mission-residency-run-mr006-q100.webp` is only 1277×473; the candidate caps hero height at 720px to avoid visible softening. Raise the cap once a larger file exists.
5. **Page 3503** carries three pexels images and an AI-generated file. **Out of scope for this ticket** — flagged, not actioned.

## 6. PAGE MUTATIONS

**Homepage 3305** (`elementor_header_footer`): insert 4 Elementor HTML widgets per `03_TARGET_COMMERCIAL_ARCHITECTURE.md` §2. Delete nothing. Fix the 3 stats in the `hpt-stats` band.

**Mission Residency 5686** (`elementor_canvas`): reorder per `03` §3; remove July/early-enrollment/strikethrough/guarantee/"unlimited"/"Limited spots"; add an enrollment CTA to `.mr1503d-nav`. The live strikethrough blocks are rendered by mu-plugin `missionmed-launch-sev1-fixes.php` — **update the plugin, not just the page**, or they will reappear.

> A full `_elementor_data` export of page 5686 exists at
> `MM-MR-HOMEPAGE-CLEANUP-001B/_AI_HANDOFFS/from_codex/MM-MR-HOMEPAGE-CLEANUP-001D_BACKUPS/20260616_104904/post_5686_elementor_data.json`
> (untracked, single copy — back it up before editing).

**Others:** `/pricing/` redirect or replace ($5/$50/$150 demo content). Consolidate `/course-comparison/` + `/compare-programs/`. Fix clobbered CTAs on `/mission-residency-courses/`.

---

## 7. CAMPAIGN STATE + ANALYTICS

Deploy `campaign-state.json` as the single source of truth; strip the preview chrome from `mm-boot.js` (the striped bar, `?state=`/`?at=` overrides). Keep the config load, state resolution, and render call.

Bind the 14 events in `analytics.events` to the **existing Google Site Kit / GA4 property**. **Do not add a second analytics system.** The candidate pushes a framework-agnostic `dataLayer` contract.

---

## 8. DEPLOYMENT SEQUENCE

1. Full backup — DB + `wp-content` + current mu-plugins (SHA256 manifest).
2. Founder approval of the preview recorded in writing.
3. Apply P0-1 (close 360) and P0-2 (strip claims).
4. Woo renames in order: 5504 → 5513 → 3576 → 5512.
5. Deploy config + candidate assets. Verify state resolves to `STATE_PRELAUNCH`.
6. **Run P0-3 end-to-end test purchases. Capture evidence.**
7. Set `verified_live_at`. Confirm `STATE_A_FALL_ACCESS` renders.
8. Publish the end date once. Never move it.
9. Re-run the banned-term audit (`window.__MM_AUDIT__`) on production.
10. Verify the Sept 8 flip in staging by time-travel before it happens live.

**Rollback:** restore mu-plugins from the SHA256 manifest; revert Woo names/prices/visibility from the backup; set `verified_live_at: null` to force pre-launch instantly (fastest kill switch — one field).

---

## 9. UNRESOLVED / NEEDS FOUNDER OR COUNSEL

| # | Item | Owner |
|---|---|---|
| 1 | Payment-plan premium — compliant mechanism (Reg Z) | Codex + counsel |
| 2 | MatchFirst™ — define or suppress | Founder |
| 3 | Match Guarantee — define or drop | Founder |
| 4 | Product 3577 ($499) — retire or keep | Founder |
| 5 | Which Stripe gateway is authoritative | Codex |
| 6 | Technology readiness — all 8 systems unclassified, all suppressed | Founder / eng |
| 7 | Zelle `$300 off` vs `2.9% fee` vs `$100 bank price` — three models on record | Founder |
| 8 | Exact mock entitlement — 20 dates vs real capacity before publishing detail | Founder / COO |
| 9 | `3,000+ IMGs Trained` substantiation | Founder |
| 11 | **"TRAINED SINCE 2009" (sitewide top bar) vs "IMGs since 2015" (MR footer)** — a six-year contradiction, both live on the same page | Founder |
| 12 | 89.1% appears in the **sitewide top bar**, as an animated counter on 5686, and in the 5686 footer — wider blast radius than the homepage stat band | Founder |
| 13 | Port the live FAQ from 5686 into the candidate | Codex |
| 10 | Kinsta origin stalled ~10 min on 2026-09-02 (~08:05–08:15 ET) while Cloudflare served stale cache. Recovered. Raise with Kinsta before a launch-day traffic spike | Ops |
