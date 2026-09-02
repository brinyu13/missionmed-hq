# 03 — TARGET COMMERCIAL ARCHITECTURE

**Principle:** PRESERVE → REUSE → MODIFY → ADD. Astra, Elementor, WooCommerce, LearnDash, Memberships, Stripe Connect routing, the cart-collision guard, URLs, and SEO equity are all preserved. What changes is the commercial hierarchy, the copy, the prices, and the state machine behind them.

---

## 1. THE CORE PROBLEM

The live site has a clean split that costs it money:

- **Homepage (3305)** is an excellent *proof* page — video testimonials, a footnoted unmatched-cost ledger, the NRMP PD-survey factor table, the mentors. It **sells nothing**: no program, no price, no enrollment path anywhere on it.
- **Mission Residency (5686)** is the only commercial page, and it is *contradicting itself* — expired July deadlines, strikethroughs against prices never charged, three different guarantee states, "unlimited mocks", and a 360 tier that is closed in strategy but purchasable in fact.

So traffic that arrives convinced has nowhere to convert, and traffic that reaches the money page meets stale claims.

**Target:** give the homepage a commercial spine without touching its proof layer, and make Mission Residency legible in five seconds.

---

## 2. HOMEPAGE 3305 — FOUR INSERTS, ZERO DELETIONS

Every existing section stays. Four blocks are inserted (preview: `candidate/pages/home-commercial.html`).

| # | Insert | Position | Why there |
|---|---|---|---|
| 1 | **Need router** — "What do you need help with right now?" → PS / Essentials / Complete / 360 | After the hero, before `ity-*` ("This Is For You If") | The hero earns attention; nothing currently catches it. Routes by need, not by internal product names. |
| 2 | **Program cards** with live prices and one dominant CTA | After the proof block (`hpv-*` videos / `hpt-*` alumni) | Proof is the strongest asset on the page; the ask belongs immediately after it. |
| 3 | **Personal Statement** — Priority / Emergency | After `mm-mentor-*` (Dr. Brian) | PS is a founder-delivered service; it converts best directly after his credibility. |
| 4 | **Technology** — renders only VERIFIED systems | Before the footer | Differentiation without fabrication. Currently renders nothing (all systems UNVERIFIED). |

**Also on 3305:** quarantine `89.1%`, `191`, `24 yrs` in the `hpt-stats` band (see `08`). Keep the band; replace 89.1% with the qualified range and drop the other two rather than inventing substitutes.

**Delivery mechanism:** the page already contains hand-authored HTML widgets inside Elementor (`elementor-element-mm0000e` and the `mm-*` / `hp*` / `f2-*` namespaces). These inserts use the same mechanism — Elementor HTML widgets with `mm-*`-prefixed classes. **No new design system, no new page template, no theme change.**

---

## 3. MISSION RESIDENCY 5686 — REORDERED FOR COMPREHENSION

Current order buries the decision. Target order (preview: `candidate/pages/mission-residency.html`):

1. **Hero** — what this is, who it is for, one dominant CTA. *(No auto-rotating carousel.)*
2. **Need router** — choose without learning our naming.
3. **The season** — the five-stage journey: Build the Foundation → Practice → Get Assessed → Prep for Real Interviews → Keep Training Through the Season. **Sells the experience, not a feature grid.**
4. **Programs** — three cards, one flagged "Most chosen", availability explicit on every card.
5. **Ways to pay** — the ranked hierarchy (§5).
6. **Personal Statement** — Priority / Emergency.
7. **360** — capacity reached, $5,499 reference, 2027-28 priority access off-card.

**Preserved from the live page:** the `.mr1503d-nav` sticky nav (plus an enrollment CTA it currently lacks), the cart-collision modal, the PD-factor and cost-ledger sections, the FAQ, the alumni routes.

**Removed:** July deadlines, "Early Enrollment", every strikethrough/"Save $X", "unlimited mocks", all three guarantee variants, "Limited spots".

**The airline metaphor** ("Business Class / First Class / Private Jet") is dropped in the candidate. It signals price tiering rather than *fit*, and the ticket's test is whether a visitor can tell Complete from Essentials in five seconds. The cards now lead with "who it is for". Worth a founder opinion — it is a deliberate change, not an oversight.

---

## 4. COMPARISON

One surface, config-driven, replacing the two that currently disagree (`/course-comparison/` vs `/compare-programs/`).

Rows in decision order: **who it is for → availability → tuition → depth of support → time with Dr. Brian → mocks → after a real interview → personal statement → payment plan → next step.**

Desktop: a real `<table>` with proper `<th scope>`. Mobile: the same markup reflows to one card per program via `data-label`, because a three-column feature grid is unreadable on a phone.

---

## 5. PAYMENT HIERARCHY

Not four equal boxes. Three ranks, visually unequal by construction:

| Rank | | Treatment |
|---|---|---|
| 1 | **BEST VALUE — Pay in Full by Bank Transfer (Zelle)** | Large, gold-bordered, elevated. Shows the bank price and, when a spread exists, *"$100 less than paying by card."* |
| 2 | **PAY IN FULL — Credit or Debit Card** | Ordinary card |
| 3 | **NEED FLEXIBILITY? — MissionMed Payment Plan** | Quiet dashed strip, routes to Admissions |

**Honesty rule built in:** during Fall Access Week there is one price on all rails, so rank 1 says *"Fastest way to secure your seat this week"* — **not** a dollar saving that does not exist. The claim appears only when `bankAdvantage() > 0`.

**Affirm** has a structural slot inside rank 3 and renders nothing while `available: false`. Zero public words until written category approval.

---

## 6. WHAT IS DELIBERATELY NOT BUILT

| Not built | Why |
|---|---|
| Countdown timer | Only permitted bound to a verified coded flip; `enabled: false` |
| Percentage-off / strikethrough / "save" | Banned; no CSS class exists for it |
| Standalone mocks, late-cycle products | `visible: false` until ≥ Oct 6 **and** founder authorization |
| PS Standard 14-day | Not sold this cycle — `render: SUPPRESS` |
| Affirm messaging | Not approved |
| Any technology claim | All systems UNVERIFIED |
| MatchFirst™ | Undefined (P0-4) — neither reproduced nor removed pending founder decision |
| A second analytics system | Site Kit/GA4 already exists; the candidate emits a dataLayer contract for Codex to bind |
