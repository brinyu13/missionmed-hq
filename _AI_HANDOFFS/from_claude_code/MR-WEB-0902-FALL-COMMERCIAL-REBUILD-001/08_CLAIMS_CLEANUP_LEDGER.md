# 08 — CLAIMS CLEANUP LEDGER

Rule applied throughout: **remove or quarantine what is unsupported; never invent a replacement statistic.**

---

## QUARANTINE — remove from production before advertising

| # | Claim (verbatim, live) | Where | Why | Replacement |
|---|---|---|---|---|
| 1 | **"Unlimited mock interviews"** | `/mission-residency/` 360 card **and** Woo 3575 short description | Banned by ticket §18/§26; contradicted by real calendar capacity | **"6 Mock Interviews Included"** (from config) |
| 2 | **"Match Guarantee (with attendance terms)"** | MR page, Match Prep Pro card | Undefined anywhere | **none** — quarantine until written definition |
| 3 | **"'Forever' Match Guarantee — we keep training you until you match"** | MR page, 360 card | Undefined; strongest claim on the site | **none** |
| 4 | **"No Match Guarantee"** | MR page, Essentials card | Third contradictory guarantee state on one screen | **none** |
| 5 | **"Price increases July 1."** ×3 | MR page (mu-plugin rendered) | Expired ~2 months | removed; state engine replaces it |
| 6 | **"Early Enrollment" / "Early Season Pricing · regular price $X after July 1"** ×3 | MR page | Expired | removed |
| 7 | **~~$1,699~~ $1,499 "Save $200"** | MR page | Reference price never charged — 16 CFR 233.1 | factual two-number frame |
| 8 | **~~$3,749~~ $2,799 "Save $950"** | MR page | same | *"$2,799 through September 7. Standard tuition $3,299 from September 8."* |
| 9 | **~~$5,499~~ $3,999 "Save $1,500"** | MR page | same, **and** 360 must not be sellable at all | $5,499 reference, Enrollment Closed |
| 10 | **"89.1% Match Rate"** | Homepage `hpt-stats` | Unconditioned/unsupported as stated | **qualified 86–93% with denominator stated** |
| 11 | **"191 — Lowest Step 1 Matched"** | Homepage `hpt-stats` | Not supported by approved ground truth | **none** |
| 12 | **"24 yrs — Longest Grad Gap Matched"** | Homepage `hpt-stats` | same | **none** |
| 13 | **"142"** (any use) | — | Not supported | **none** — banned pre-emptively |
| 14 | **"102 verified testimonials"** | not found live in this capture | Unsupported count | **none** |
| 15 | **"Currently training the 2026–2027 Match cohort · Limited spots"** | MR page footer strip | "Limited spots" implies a countable roster that exists in no file | drop "Limited spots"; keep the factual first half |
| 16 | **"MatchFirst™ deferred payment / 50% down, 50% after Match"** | 20 pages | Undefined credit-like product (P0-4) | **founder decision** |
| 17 | **"7 mock interviews"** / **"3 mock interviews"** | MR page + Woo descriptions | Contradicts the approved 6-mock benefit | configured label only |
| 18 | **`$5 / $50 / $150`** | `/pricing/` | Unreplaced demo content contradicting every real price | redirect or replace |
| 20 | **`89.1% MATCH RATE · 3,000+ TRAINED SINCE 2009`** in the **sitewide top bar** | every page | The 89.1% blast radius is far wider than the homepage stat band — it is site furniture | qualified 86-93% with denominator, or remove |
| 21 | **Animated `89.1%` counter labelled "Match Rate"** (`data-mr1503d-counter="89.1"`) | `/mission-residency/` | Same unsupported figure, animated for emphasis on the money page | as above |
| 22 | **"89.1% Match Rate over 5 cycles"** | `/mission-residency/` footer | Third instance on one page | as above |
| 24 | **MatchFirst™ deferred payment** — "pay a deposit to start, pay the balance only after you match; if you don't match the balance is waived" | `/mission-residency/` FAQ, twice | **Conflicts with founder canon** (Zelle PIF preferred; internal plans must cost MORE than PIF). A balance contingent on outcome is also a materially different consumer-credit product from an installment plan | **Withheld from the candidate FAQ pending founder ruling** |
| 25 | **360 "Forever guarantee"** — "we keep training you until you match" | `/mission-residency/` FAQ | One of three conflicting guarantee statements live on one page | **Withheld pending a single approved definition** |
| 26 | FAQ red-flag stats: lowest Step 1 **191**, **24-year** YOG gap, "35 of our **102** documented testimonials", "**100%** of completed cycles in that subset matched" | `/mission-residency/` FAQ | Unsupported, and the last is an implied outcome guarantee | **Removed from the ported FAQ** |
| 27 | FAQ pricing answer: $1,499/$1,699 Essentials, Match Prep Pro $2,799/$3,749, 360 $3,999/$5,499, "rates increase July 1" | `/mission-residency/` FAQ | Every figure stale; deadline expired two months ago | **Rewritten to generate from config**, so it cannot go stale again |
| 23 | **"Trained 3,000+ IMGs since 2015"** (MR footer) vs **"3,000+ TRAINED SINCE 2009"** (top bar) | same page, both live | **Direct factual contradiction on a single page** — a six-year discrepancy in the founding claim | Pick the correct year and use it everywhere |
| 19 | Conflicting tier prices between `/course-comparison/` ($5,199/$3,449/$1,199) and `/compare-programs/` ($5,499/$3,749/$1,499) | two pages | Same tiers, different numbers | consolidate to one config-driven surface |

---

## RETAINED — verified or attributed

| Claim | Status |
|---|---|
| Named alumni video testimonials with first-person quotes (Marian, Chelsey, Yamini, Gunjan, Sana, Maisha, Maksura, Mahabuba, Danny) | **RETAIN** — real, attributed, and the strongest proof asset on the site |
| "17+ years helping applicants with red flags successfully match" | RETAIN (Dr. Brian mentor card) |
| "3,000+ IMGs Trained" | **RETAIN PENDING** — not on the quarantine list; confirm substantiation before reuse |
| NRMP Program Director Survey 2024 factor table (Gate 1 / Gate 2) | **RETAIN** — sourced, cited, and genuinely differentiating |
| Unmatched-cost ledger ($81,554 / $89,853 / $98,452; PGY-1 $68,166) | **RETAIN** — every line footnoted to AAMC / NRMP / published rates |

The homepage's proof layer is strong and properly sourced. The problem is confined to the three unsupported numbers in the `hpt-stats` band — fixing those does not weaken the page.

---

## TECHNOLOGY CLAIMS

Ticket §21 asks each system to be classified VERIFIED LIVE / VERIFIED FOR FALL START / NOT READY TO MARKET.

**Could not be classified from this worktree.** The platform repo carries no production-readiness signal for Matrix, StoryForge, IV Prep On-Call, RISE, RankListIQ, File Vault, PS Tools, or MATCHBRIDGE, and no readiness evidence was retrievable from live.

**Therefore all eight default to `UNVERIFIED` → `SUPPRESS`.** The candidate's technology section renders nothing and says so explicitly rather than implying a roadmap. Flipping any one to `VERIFIED LIVE` in config makes its card appear. **This is the safe failure mode: absence, not fabrication.**
