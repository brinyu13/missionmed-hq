# MISSION RESIDENCY HUMAN-PROOF REFINEMENT = LIVE

Verified September 30, 2026. Canonical production: https://missionmedinstitute.com/missionresidency/

## Released scope

Deployed source: `87ce78801b1cb879261526f88ed2306c95a0f78b`.
Repository: `https://github.com/brinyu13/missionmed-hq.git`.
Branch: `codex/mr-primary-promotion`.
Worktree: `/Users/brianb/.codex/worktrees/mm-home-mr-premium-hero/MissionMed`.
Baseline: `04772eb5f764683386914835d3e176810890e461`.

Exactly two production files changed: `wp-content/mu-plugins/missionmed-mr-alternate-assets/page.php` and `alternate.css`. All page bytes outside the three approved existing sections are identical to baseline. Original CSS remains intact with 22 lines of scoped overrides appended. No image files, shared JavaScript, routing, SEO, business configuration, curriculum, schedule, FAQ, enrollment, homepage, Stripe, Zelle, Woo, LearnDash or Matrix implementation was changed by this release.

## Human-proof treatment

- **Match Day:** exact existing authentic montage and full-width native depth preserved. Caption moved into a restrained high-contrast lower-left panel, exposing more real faces. Headline: **This Is What Match Day Looks Like.** Support: “Beyond the practice and feedback: real MissionMed students, sharing their Match Day moments.” Individual-experience qualifier retained. Redundant six process chips removed.
- **Marian:** exact Founder portrait, 280px desktop / 218px phone; prominent 28px desktop / 24px phone quote. Exact source wording: **“You made me fall in love with my own story and believe that my dreams are valid against all Odds.”** Identity: Dr Marian Ghaly, **Assistant Program Director**, St Joseph’s Paterson, Family Medicine. Existing authentic Match video link retained.
- **Manasa:** exact Founder 157x180 AVIF, displayed at 190px width without aggressive enlargement; equal quote and identity hierarchy, not a subordinate profile row. Exact source wording: **“Once your session is done, you will know exactly how to approach any interview question.”** Identity: Dr Manasa Kandula, **Associate Program Director**, Internal Medicine Residency, University of Illinois College of Medicine Peoria; IV Prep Alumna, Session A, June 2013 retained.
- **Editorial composition:** two aligned portrait/quote/identity columns on desktop, stacked portrait -> quote -> identity on mobile. Existing light section, headline and authentic attribution retained. No generic cards, generated people or invented testimonial.
- **Mentorship:** authentic Dr Brian image preserved; headline **Your Story. A Mentor Who Gets to Know It.** Existing direct-feedback/personal-strategy facts receive clearer hierarchy. Functional list condensed into “Practice. Direct feedback. A clearer next step.” Student remains the protagonist.

Full-page inspection confirms both educational explanation and human experience now register. This is an editorial acceptance judgment, not a measured conversion-lift claim.

## Page-length delta

Fresh anonymous production before/after measurements use identical 900px viewport heights, loaded fonts and settled lazy images. Section order unchanged. No new sections.

| Width | Before | Live | Delta |
|---|---:|---:|---:|
| 1440 | 10,981px | 10,949px | -32px (-0.29%) |
| 1366 | 10,981px | 10,949px | -32px (-0.29%) |
| 1024 | 11,225px | 11,158px | -67px (-0.60%) |
| 768 | 13,524px | 13,941px | +417px (+3.08%) |
| 430 | 16,872px | 16,682px | -190px (-1.13%) |
| 390 | 17,600px | 17,482px | -118px (-0.67%) |

The tablet increase accommodates a readable stacked proof composition. Desktop and phone pages are shorter. No substantial overall page expansion.

## Live responsive, accessibility and performance acceptance

| Width | HTTP / overflow / images / text contrast | LCP (lab) | CLS (lab) |
|---|---|---:|---:|
| 1440 | PASS / 0 / 0 broken / 0 failures | 1420ms | 0.00042 |
| 1366 | PASS / 0 / 0 broken / 0 failures | 304ms | 0.00050 |
| 1280 extra | PASS / 0 / 0 broken / 0 failures | 424ms | 0.00055 |
| 1024 | PASS / 0 / 0 broken / 0 failures | 364ms | 0.00092 |
| 768 | PASS / 0 / 0 broken / 0 failures | 296ms | 0.00359 |
| 430 | PASS / 0 / 0 broken / 0 failures | 244ms | 0.03195 |
| 390 | PASS / 0 / 0 broken / 0 failures | 240ms | 0.03585 |

Computed foreground/background contrast checked against AA 4.5:1 normal / 3:1 large. Photographic text remains on the nearly opaque navy panel, not directly on fluctuating image detail. Visual inspection included full page, desktop/mobile alumni, montage and mentor composition. No page exceptions or first-party HTTP failures. Keyboard menu opening, Escape close, returned focus, FAQ activation and visible 3px focus outline pass; measured primary touch targets >=44px.

Existing native fixed-background depth is unchanged: desktop fixed, mobile/tablet <=768 scroll, all reduced-motion scroll. No new animation dependency, no text/price/form animation. Images stay lazy-loaded with intrinsic dimensions. Lab performance is healthy; this is not field Core Web Vitals or every-device certification.

## Protected business/routing acceptance

- Hero, Bootcamp/Complete curricula, schedule, prices, FAQ, enrollment and all other section text exactly preserved in source and before/after rendered text.
- Live Bootcamp CTA -> product 5504 / variation 5867 -> card checkout: **$549**, Stripe and Zelle controls present, UTM chain retained, no overflow.
- Live Complete CTA -> product 3576 / variation 5865 -> card checkout: **$3,099**, Stripe and Zelle controls present, UTM chain retained, no overflow. No separate Bootcamp charge.
- Current checkout copy retains Bootcamp Zelle **$499** and Complete Zelle **$3,099**. Current payment/runtime config SHA256 unchanged: `d9721bf8033b61762a8521c368be3d2be4eb83b1929be0e20778f21c0c233528`.
- No payment submitted, order created intentionally, paid state changed, account provisioned or entitlement mutated. Ordinary anonymous cart QA creates temporary Woo sessions. This presentation test does not re-certify the financial lifecycle.
- Legacy `/mission-residency/` returns one-hop **301** to `/missionresidency/`, retaining the complete Facebook query string. Canonical page 200, self-canonical and index/follow unchanged.
- Product-intent analytics events observed on both paths; existing GA4 requests fire. Analytics code unchanged.
- USCE Elementor source hash unchanged: `0771af807df4bdb50bf115a3b075bb2094904fb656110f097c5506f4efe7e7c5`.
- Account, cart, USCE and administrator-login routes respond normally.

### Concurrent-state exception, not concealed

45/45 earlier legacy presentation assets and 67/68 earlier MU-plugin manifest files match. One earlier-manifest mismatch is `missionmed-mr-p0.php`: its homepage `mr-communication` slide image/caption/alt/dimensions were changed to the real online classroom. Server mtime **07:16:59 UTC**, before this **07:45 UTC** two-file deployment. Source diff contains only that one slide record; runtime commerce configuration is identical. Current file SHA256 `5777cd9bb474ad17ab566b6485af4bdc4f802cefc828c5407f8a9ccdb58eca0e`. This task neither changed nor reverted it, and does not claim every site's file remained static while other work ran.

## Deployment and recovery

Universal and MR-WEB-0912 BOOT passed. Exact two-path Supabase lease **epoch 3857**, granted and released successfully; application data was not written through Supabase. Supabase skill used for the scoped provider lease.

MyKinsta MissionMed Live recovery point read back without backup mutation: **Sep 29, 2026, 8:35 PM**, note **Pre premium hero release 2026-09-29**, expiration **Oct 13, 2026, 8:35 PM** (as displayed in local UI). Restore control available. Daily backup Sep 29 1:06 PM also visible, 14-day retention. The broad backup predates later presentation work and is NOT the surgical rollback target.

Fresh exact preimages captured immediately before deployment:
`/www/theresidencyacademy_209/private/mr-human-proof-0930/preimage/`.
Candidate preserved alongside in `candidate/`. Deployment hash-guarded both originals and candidates, PHP linted, then replaced only the two files. Exact URL purge attempted first; stale public HTML required native Kinsta page/edge purge, HTTP 200. Fresh unparameterized public readback subsequently served new markup and CSS version `fd26071d894d`.

| File | Preimage SHA256 | Deployed SHA256 |
|---|---|---|
| page.php | `2e6e8dc94475434da7c091a8bc496bb4663efb509e68c519989ac41ed2d727ef` | `be796c0e0e3aedbf47a1f74bfba31adb239ea4b20599a564ea372e5124f1aaf5` |
| alternate.css | `6c3a367b32f5e166d500b5ed58976007cbae10f8a388fa4e1e11ebc2abb480da` | `fd26071d894ded34780b007e34dfce5d0cca98a41533e6110f8357549ab1a70c` |

**Rollback:** acquire the same scoped two-file lease; guard current hashes against the deployed values; restore only these two exact preimages with preserved permissions; purge page/edge cache and recheck canonical/legacy routes. Do not restore the database, remove the promoted redirect, disable the renderer or overwrite unrelated files. Stop and rebase the rollback if a later file modification is detected.

## Evidence and STATE DELTA

- `EXECUTION.md`: scope/authority/current baseline.
- `deploy.sh`: exact two-file preimage and guarded deployment.
- `measure.mjs`, `qa.mjs`, `preservation.mjs`, `regression.mjs`: reproducible focused checks.
- `qa/before-measure.json`, `candidate-measure.json`, `live-measure.json`: measured lengths, unchanged sections and exact quotations.
- `qa/local-qa.json`, `live-qa.json`, `preservation.json`, `regression.json`: live acceptance and preservation caveat.
- Selected live full-page/alumni/mentor/montage screenshots retained; local additional screenshots remain available in this task folder.
- Production delta: two presentation files only. Provider delta: temporary scoped lease, released; page/edge cache invalidation. No business-state mutation.
- Source and evidence committed/pushed on the existing branch. Shared dirty worktrees untouched. MissionMed OS normal fast-forward to `5312e40` retained unrelated dirty files; no OS repair or policy rewrite.
- Brain product record and generated context pack updated on `codex/missionmed-brain-v0` for continuity.
- No independent agent was used; single-thread acceptance as directed. No known blocker remains for this scoped refinement. Manasa's source resolution remains an intrinsic asset limitation, contained by bounded display size.

**STOP:** No further design pass, commerce activation, homepage change or campaign action is part of this release.
