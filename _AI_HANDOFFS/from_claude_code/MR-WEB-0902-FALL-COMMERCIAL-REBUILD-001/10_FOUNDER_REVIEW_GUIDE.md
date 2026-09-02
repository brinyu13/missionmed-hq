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

## The five-minute walkthrough

1. **Mission Residency** → does a stranger understand in five seconds what this is and which program is theirs?
2. **Compare programs** → shrink the window to phone width. Is Complete vs Essentials obvious?
3. **Ways to pay** → is Zelle clearly the preferred route, without looking punitive?
4. **Personal Statement** → Priority and Emergency, deposits, the capacity rule.
5. **360** → capacity reached, $5,499 reference, 2027-28 interest. Is the wording right?
6. Switch the selector to **September 8**. The banner disappears and prices become $3,299 / $1,399 **with no one touching anything.**

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

## Smaller things worth 30 seconds

- The **airline metaphor** (Business Class / First Class / Private Jet) is dropped in the candidate — it reads as price tiering rather than fit. Cards now lead with who it is for. Say if you want it back.
- Homepage stats **89.1% / 191 / 24 yrs** must come off. 89.1% becomes the qualified 86–93% with its denominator; the other two have no approved replacement and are simply removed.
- `/pricing/` still shows **$5 / $50 / $150** demo content.
- Three **`$1 Test`** products are publicly buyable in the shop.
- **"7 mock interviews"** is live on Match Prep Pro; canon says six.

---

## What is NOT in the candidate, deliberately

No countdown · no "20% off" or strikethrough · no standalone mocks or late-cycle products · no PS 14-day tier · no Affirm · no technology/Matrix claims (nothing is verified, so the section renders nothing) · no MatchFirst.

---

## If you approve

Codex productionizes **this exact candidate**. The handoff instructs it not to reinterpret the UI or the commercial architecture. Before anything is advertised, one end-to-end test purchase must prove payment → order → correct course → correct membership → confirmation. Until someone records that, the site physically cannot display Fall Access pricing — the gate is enforced in code, not by memory.
