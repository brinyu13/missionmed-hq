# VISUAL ASSET INVENTORY

**Method:** every asset below was found on a live MissionMed page and **verified reachable** (HTTP 200/206) on 2026-09-02. Nothing here is stock sourced by me, and nothing is used that is not already published publicly by MissionMed on its own site.

**Public-use basis:** each asset is already served publicly on `missionmedinstitute.com` today. Reusing it on another page of the same site introduces no new exposure. Assets are referenced by their existing URLs — none are copied, re-hosted, or altered.

---

## 1. MATCH DAY VIDEO TESTIMONIALS — the strongest assets MissionMed owns

Eight real students, hosted on `cdn.missionmedinstitute.com/other/`, each with a matching poster image. All return `206 video/mp4` (range requests supported → streamable). **All eight currently sit on the corporate homepage; the Mission Residency page has none.**

| Student | Poster (`/uploads/2026/06/mm-speed-home-012/`) | Video (`cdn…/other/`) | Quote on live site |
|---|---|---|---|
| Marian | `mm-home-012-03-marian-tearful-match-call.jpg` | `emotional_marianne_overwhelming_joy_family_crying_06.mp4` | "You made me fall in love with my story. You made me fall in love with me." |
| Chelsey / Danny | `…-04-chelsey-matched-after-5-cycles.jpg` | `gratitude_chelsea_danny_thanking_dr_brian_life_cha_07.mp4` | "You make a difference in people's life." |
| Yamini | `…-05-yamini-left-medicine-15-years.jpg` | `emotional_yamini_emotional_match_relief_19.mp4` | "You gave me voice… to express myself." |
| Gunjan | `…-06-gunjan-family-finds-out.jpg` | `emotional_gunjan_emotional_crying_family_reaction_93.mp4` | "This is the best feeling right now." |
| Sana | `…-07-sana-failed-last-year-matched-this-year.jpg` | `best_decision_sana_everything_worth_it_208.mp4` | "Being persistent and just trying harder… it does pay off." |
| Maisha | `…-08-maisha-best-decision.jpg` | `best_decision_maisha_best_decision_testimony_10.mp4` | "Coming up to you was one of the best decisions in my life." |
| Maksura | `…-09-maksura-found-where-she-belonged.jpg` | `support_system_maksura_belonging_community_support_137.mp4` | "It feels like I belong to somewhere." |
| Mahabuba | `…-10-mahabuba-confidence.jpg` | `best_decision_mahbuba_best_day_emotional_reaction_45.mp4` | "You are the person who gave me the confidence." |

Posters are 10–26 KB each — cheap to load. Videos are click-to-play only, never autoplay with audio.

## 2. AUTHENTIC PHOTOGRAPHY

| Asset | Size | Status | Use |
|---|---|---|---|
| `2026/03/DrBrian_Profile_2.png` | **6.5 MB** | verified 200 | Dr. Brian portrait — the scarce-access story |
| `2026/03/Mission_Class_Screenshot-1-scaled.png` | **2.4 MB** | verified 200 | Real group mentorship session on a video call. Its own alt text: *"Real MissionMed group mentorship session with multiple students on a video call"* |
| `2026/06/mm-speed-mr-006/mission-residency-run-mr006-q100.webp` | 247 KB | verified 200 | Mission Residency hero |
| `2026/01/Dr-J-ExamPrep-Hero-Section.png` | — | verified | ExamPrep division |
| `2026/02/cropped-608a69b1…-448x171.png` | — | verified | MissionMed logo |

> **Performance defect (new finding).** The two strongest photographs are a 6.5 MB and a 2.4 MB PNG, unoptimized, despite EWWW Image Optimizer being installed. On a page that must feel premium this is a real problem. **Codex: convert both to WebP/AVIF with responsive `srcset`.** Expect ~95% reduction. The candidate loads them lazily and behind posters to limit the damage in the meantime.

## 3. STOCK AND AI-GENERATED IMAGERY — corrected scope

**Correction to an earlier draft of this document.** I first recorded that the Mission Residency
page is "illustrated almost entirely with generic stock and one AI-generated image." That was
wrong, and the correction matters because it changes what needs doing.

Reading the CSS scopes rather than just the asset list:

| Asset | Actually scoped to | Verdict |
|---|---|---|
| `2026/03/pexels-photo-5215024.jpeg` | `body.page-id-3503` | Stock, but **not on page 5686** |
| `2026/03/pexels-photo-5452201.jpeg` | `body.page-id-3503` | Stock, but **not on page 5686** |
| `2026/03/pexels-photo-5452293.jpeg` | `body.page-id-3503` | Stock, but **not on page 5686** |
| `2026/03/Gemini_Generated_Image_ui21bvui21bvui21-scaled.png` | `body.page-id-3503` (plus a loose unscoped `[data-id="a0c6bb4"]` fallback that could leak) | AI-generated, **not on page 5686** |
| `2026/03/pexels-photo-4225920.jpeg` | **unscoped** `.mr-cta-bridge .bg` | **Stock, and it DOES render on the Mission Residency page** — as the closing CTA background |

These rules are injected sitewide, which is what made them look like page-5686 assets in a flat
asset list. **Page 3503 is a separate page and is outside this ticket's scope.**

**What is actually true of the Mission Residency page:**

Its hero is a **strong, authentically branded asset** — `mission-residency-run-mr006-q100.webp`,
an embroidered *"MISSION RESIDENCY · MATCHED · ACCOMPLISHED"* patch on a white coat, verified by
opening the file. That is a good photograph and the candidate keeps it.

So the real Mission Residency imagery problem is narrower and more specific than "it runs on
stock":

1. **One stock image renders on it** — `pexels-photo-4225920.jpeg`, behind the closing CTA. Replace with the real class photograph.
2. **The hero asset is only 1277x473.** Any hero taller than ~700px upscales it past 1.9x and it goes soft. The candidate caps hero height at 720px for exactly this reason. **A larger original would materially improve the page** — worth reshooting or re-exporting.
3. **There is no video anywhere on it**, while eight real Match Day videos sit on the corporate homepage. This remains the single biggest miss, and the candidate fixes it.

## 4. NOT AVAILABLE / NOT USED

- **No verified product or interface screenshots** for Matrix, StoryForge, RankListIQ, RISE, File Vault, PS Tools, or MATCHBRIDGE were found on any live page. The technology section therefore renders nothing (`08_CLAIMS_CLEANUP_LEDGER.md`). No mockups were invented.
- **No private student information** is used. Only first names and quotes already published by MissionMed.
- **No outside/stock imagery was introduced** by this ticket.
