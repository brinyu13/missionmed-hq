# CORPORATE vs MISSION RESIDENCY — SURFACE MAP

Both surfaces were audited **independently and live** on 2026-09-02. Neither was inferred from the other.

**The three divisions, confirmed from the live homepage's own filter control** ("Dr J's Exam Prep · Mission Residency · Mission: Clinicals") and from the WooCommerce category slugs (`test-prep`, `mission-residency`, `mission-clinicals`):

| Division | Public surface | Woo category |
|---|---|---|
| **Dr J's Exam Prep** | `/examprep/` | `test-prep` |
| **Mission Residency** | `/mission-residency/` | `mission-residency` |
| **Mission: Clinicals (USCE)** | `/usce/` | `mission-clinicals` |

*Arena* (`/homepage-arena/`, membership products 3520/3522/3525/5734) is a **platform/product line, not a fourth division** — it appears in the nav alongside the divisions. It must remain discoverable.

---

## SURFACE A — CORPORATE HOMEPAGE `/` (page 3305)

| | |
|---|---|
| **Purpose** | Front door for MissionMed Institute as a whole; must represent all three divisions |
| **Audience** | IMGs, DOs, reapplicants — at any stage, for any division |
| **Template** | `elementor_header_footer` (theme header/footer retained) |
| **Current hero** | *"You Don't Have to Figure This Out Alone"* — emotional, division-neutral. Two CTAs: "See What Program Directors Actually Look For", "See How Students Like You Matched" |
| **Current navigation** | Home · ExamPrep · Mission Residency · USCE · Arena · Login |
| **Current conversion path** | **None.** No program, no price, no enrollment CTA anywhere on the page. Both hero CTAs are anchors to content further down the same page |

**Visual strengths (preserve):**
- Eight real Match Day video testimonials with named students — the strongest emotional proof MissionMed owns
- The unmatched-cost ledger (`mm-ledger-*`): $81,554 / $89,853 / $98,452 scenarios, every line footnoted to AAMC / NRMP
- The NRMP PD-survey factor table (`f2-*`) with Gate 1 / Gate 2 and a working division filter
- Real group-mentorship session photograph
- Mentor cards for Dr. Jastrzembski and Dr. Brian

**Weaknesses:**
- Sells nothing. There is no route from "I'm convinced" to "I can enroll"
- Three unsupported stats in the `hpt-stats` band (89.1% / 191 / 24 yrs)
- Division routing is nav-only — no visual merchandising of the three divisions in the body
- No seasonal awareness: it is Match interview season and the page does not say so

**Preserve:** every existing section, the theme header/footer, all proof, the ledger, the factor table, the mentors.

**Change — a SEASONAL layer, not a redesign:**
1. A **seasonal Match-season hero band** above the existing hero, Mission Residency-forward, routing into `/mission-residency/`
2. A **three-division band** so ExamPrep and Mission: Clinicals stay clearly discoverable while Mission Residency carries visual priority this season
3. Quarantine the three unsupported stats
4. The seasonal layer is **one config flag** (`campaign.seasonal_takeover`) and one component — removing it restores the neutral corporate homepage without touching anything else

**Explicitly NOT done here:** full program merchandising, the comparison table, the payment hierarchy, PS tiers, the journey. Those belong on Surface B. The corporate homepage's job this season is *capture attention → establish credibility → route into Mission Residency.*

---

## SURFACE B — MISSION RESIDENCY `/mission-residency/` (page 5686)

| | |
|---|---|
| **Purpose** | The division's commercial home — the flagship sales/conversion destination |
| **Audience** | A residency applicant deciding how to prepare for interviews |
| **Template** | `elementor_canvas`. *Note: despite the canvas template the rendered page DOES show the site header and nav — verified from a live 1440x900 render, not inferred from the body class.* |
| **Current hero** | *"Scores don't decide your Match. Your STORY does."* |
| **Current navigation** | Its own sticky nav `.mr1503d-nav`: Programs · Strategy · The Real Cost · Dr. Brian · FAQ, plus "Must read first" and "Read Reviews". **No enrollment CTA in the nav** |
| **Current conversion path** | Three program cards → "View Program Details" / "Read What Alumni Said" → product pages → cart → checkout. A cart-collision modal enforces one program at a time |

**Visual strengths (preserve):**
- A genuinely strong branded hero: an embroidered *"MISSION RESIDENCY · MATCHED · ACCOMPLISHED"* patch on a white coat. The candidate keeps it
- A real dark/gold design system (`--mr-bg #050913`, `--mr-gold #d8b45f`, Playfair Display + Inter)
- The sticky section nav
- The cart-collision guard — good, real UX
- A real Dr. Brian portrait
- The airline-class metaphor is memorable, if mis-aimed

**Weaknesses:**
- **One stock image renders on it** (`pexels-photo-4225920.jpeg`, behind the closing CTA). *Correction: the other three pexels files and the AI-generated image are scoped to `page-id-3503`, a different page — an earlier draft of this map wrongly attributed them to 5686. See `VISUAL_ASSET_INVENTORY.md` §3.*
- **The hero asset is only 1277x473**, so any hero taller than ~700px visibly softens it
- **Zero video.** All eight real Match Day testimonials are on the corporate homepage instead
- Expired July deadlines ×3, strikethroughs against prices never charged ×3
- Three contradictory guarantee statements on one screen
- "Unlimited mock interviews" on the 360 card
- 360 is fully purchasable at $3,999 while strategy says 2026-27 is closed
- No enrollment CTA in its own nav
- Program cards lead with class metaphor and price, not with *who it is for*

**Preserve:** URL, page ID, `elementor_canvas` template, sticky nav, cart guard, FAQ, the cost-ledger and PD-factor sections, the Dr. Brian portrait, all commerce wiring.

**Change — this is where the full rich experience goes:**
cinematic hero on real imagery · the season journey told visually · program cards leading with fit · **the eight Match Day videos brought here** · real class photography · proof paired with claims throughout rather than pooled at the bottom · comparison · payment hierarchy · PS tiers · 360 closed state · alternating light/dark environments · retire every stock and AI-generated image.

---

## ROUTING MODEL

```
/  corporate homepage
   ├─ seasonal Match-season band  ──► /mission-residency/   (priority route this season)
   ├─ three-division band ─────────► /examprep/  ·  /usce/   (always intact)
   └─ existing proof, ledger, factors, mentors  (unchanged)

/mission-residency/   ← the heavy commercial selling happens HERE
   └─ program/service detail ─► cart ─► checkout ─► entitlement
```

## HOW THE HARD FAILURE CONDITIONS ARE AVOIDED

| Failure condition | How it is avoided |
|---|---|
| Corporate homepage becomes Mission Residency-only | Only two blocks are added; every existing section is preserved, and one of the two blocks exists specifically to surface the other two divisions |
| Other divisions hard to discover | A dedicated three-division band is **added** — ExamPrep and Mission: Clinicals are currently merchandised nowhere in the homepage body, so this is strictly better than today |
| The two pages become redundant copies | Deliberate split: corporate carries **no** pricing, comparison, payment UX, PS tiers, or journey. Those exist only on Surface B |
| Corporate screenshot treated as the MR page | Both were fetched and audited separately; this document records their distinct heroes, navs, templates, assets, and defects |
| `/mission-residency/` not independently audited | Audited live: page ID 5686, `elementor_canvas`, `.mr1503d-nav`, its own token system, and its stock/AI imagery problem — none of which is visible from the corporate homepage |
| Rich experience concentrated on corporate homepage | The journey, comparison, payment hierarchy, PS tiers, 360 state and video wall are built **only** on Surface B |
