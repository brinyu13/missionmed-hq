# 10 — FOUNDER REVIEW GUIDE

**Dr. Brian — 10 minutes. Nothing here is live. Nothing takes a payment.**

---

## Start the preview

```bash
cd /Users/brianb/MissionMed_worktrees/mr-web-0902-fall-commercial-rebuild/_AI_HANDOFFS/from_claude_code/MR-WEB-0902-FALL-COMMERCIAL-REBUILD-001/candidate && python3 .preview/serve.py
```

Then open:

```
http://127.0.0.1:8790/pages/index.html
```

Every page has a **striped bar at the top** with a state selector. Switch between *Fall Access Week*, *September 8*, *Sales closed*, and *Pre-launch* to see the same site at different moments. Ctrl-C stops the server.

---

## Two surfaces — they are not the same page

| | Job |
|---|---|
| **Corporate homepage** (`home-corporate.html`) | Catch Match-season attention, establish credibility, **route into Mission Residency**. All three divisions stay intact. No pricing, no comparison, no payment UX. |
| **Mission Residency** (`mission-residency.html`) | **The flagship.** This is where the heavy selling happens. |

Only two blocks are added to the corporate homepage. Nothing existing is removed — your videos, the unmatched-cost ledger, the program-director table and the mentors all stay.

## The five-minute walkthrough

1. **Mission Residency** → does a stranger understand in five seconds what this is and which program is theirs?
2. **Scroll to the Match Day videos.** Eight real students, on the page that sells. They are currently on the corporate homepage instead, and this page has none.
3. **Compare programs** → shrink the window to phone width. Is Complete vs Essentials obvious?
4. **Ways to pay** → is Zelle clearly the preferred route, without looking punitive?
5. **Personal Statement** → Priority and Emergency, deposits, the capacity rule.
6. **360** → capacity reached, $5,499 reference, 2027-28 interest. Is the wording right?
7. Switch the selector to **September 8**. The banner disappears and prices become $3,299 / $1,399 **with no one touching anything.**

---

## Five things to decide

### 1. 360 is on sale right now for $3,999 — P0
Product 3575 is purchasable today, and its plan (5511) too. Someone can buy a 2026-27 seat this morning. Canon says 2026-27 is closed at a $5,499 reference. **Confirm: close both, keep the card visible at $5,499.**

### 2. "Unlimited mock interviews" and "Match Guarantee" are live — P0
On the Mission Residency page and inside the 360 product description. There are currently **three** different guarantee statements on one screen ("Match Guarantee with attendance terms", "'Forever' Match Guarantee", "No Match Guarantee"), and none is defined anywhere. The candidate publishes none of them. **Do you want a guarantee at all this cycle? If yes, it needs a written definition before it goes back on the page.**

### 3. MatchFirst™ — P0
Live on 20 pages: *"deposit now, pay the rest only after you match"*, *"50% down, 50% after Match."* Nothing in this ticket or the board ruling defines its current terms, and deferring half the tuition until an uncertain event is a credit product in substance. **Keep it with written terms, or suppress it for Fall Access Week?** The candidate does neither until you say.

### 4. The payment plan shows no total — on purpose
Your requirement that the plan cost **more** than pay-in-full is intact and recorded as authoritative. But you also said not to publish an invented APR or a noncompliant finance charge — and a published premium over the PIF price **is** a finance charge under Reg Z whatever it is called. So the plan routes to Admissions with no number until Codex resolves it.

Worth knowing: the 6-month plans **already exist** in WooCommerce at 0% ($466.50 × 6 = $2,799 exactly). Your ~6-month term is built. Only the higher total isn't. **That is a compliance decision, not an engineering one.**

### 5. Which product becomes what
"IV Prep Complete" is currently the name of the **$1,499** product, not the $2,799 one. Based on what each actually delivers:

- **Match Prep Pro** ($2,799, full season, weekly checkups, debriefs) → **IV Prep Complete**
- **IV Prep Complete Masterclass** ($1,499, 5-day workshop, built for speed) → **IV Prep Essentials**
- **Interview Prep Foundation** ($499, one mock + library) → the legacy $499 tier — **retire it, or keep it?**

---

## On the visuals

The first candidate was rightly rejected as flat and text-heavy. What changed:

- **Your real assets are now doing the work.** Eight Match Day videos, the real group-session photograph, and your portrait — all already on your site, none of them stock, and none currently used on the page that sells.
- **Light and dark now alternate.** The page moves through nine environments instead of sitting on one dark surface.
- **Body copy is near-white, not grey**, and the type is much larger. 142 text elements measured, zero contrast failures.
- **One stock image gets replaced.** `pexels-photo-4225920.jpeg` sits behind your closing CTA today; the real class photograph takes its place.

Two honest limits: your hero image is only 1277×473, so it softens in a tall hero — **a larger original would visibly improve the page**. And your portrait is a 6.5 MB PNG that should be converted to WebP.

## Smaller things worth 30 seconds

- The **airline metaphor** (Business Class / First Class / Private Jet) is dropped in the candidate — it reads as price tiering rather than fit. Cards now lead with who it is for. Say if you want it back.
- Homepage stats **89.1% / 191 / 24 yrs** must come off. 89.1% becomes the qualified 86–93% with its denominator; the other two have no approved replacement and are simply removed.
- `/pricing/` still shows **$5 / $50 / $150** demo content.
- Three **`$1 Test`** products are publicly buyable in the shop.
- **"7 mock interviews"** is live on Match Prep Pro; canon says six.
- **89.1% is in your sitewide top bar**, not just the homepage — it is on every page, including the money page, and it is animated there.
- **Your top bar says "TRAINED SINCE 2009" while the Mission Residency footer says "since 2015."** Both are live on the same page. One of them is wrong.
- The live Mission Residency page has a **FAQ** the candidate does not yet carry. It should be ported over — it answers objections.

---

## What is NOT in the candidate, deliberately

No countdown · no "20% off" or strikethrough · no standalone mocks or late-cycle products · no PS 14-day tier · no Affirm · no technology/Matrix claims (nothing is verified, so the section renders nothing) · no MatchFirst.

---

## If you approve

Codex productionizes **this exact candidate**. The handoff instructs it not to reinterpret the UI or the commercial architecture. Before anything is advertised, one end-to-end test purchase must prove payment → order → correct course → correct membership → confirmation. Until someone records that, the site physically cannot display Fall Access pricing — the gate is enforced in code, not by memory.
