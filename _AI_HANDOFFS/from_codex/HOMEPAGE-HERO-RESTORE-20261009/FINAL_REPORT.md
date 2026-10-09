# HOMEPAGE-HERO-RESTORE-20261009 — production release and acceptance

Status: **RESTORED / LIVE VERIFIED** on anonymous `https://missionmedinstitute.com/` (2026-10-09 UTC).

## Cause and surgical change

The PROOF-INTEL-1300 homepage integration prepended a ninth `mr-testimonials` slide to the approved eight-frame premium Hero. It used `b-immersive/assets/frame-marian-aaa.jpg`, a still of Dr Marian Ghaly's recording, as the dominant opening image. The Hero itself contained no `<video>` tag. The testimonial video, dedicated `/testimonials/` page, and lower-page Marian proof were left intact.

Previous production was synchronized as source commit `cce119f` from live PHP/CSS/JS preimages. Deployment commit `cfc8d21923bfab7b860460c803c3b02ae84860d2` removes only the added slide and its CSS/JS accommodation, restores `mr-application.webp` as the opening MATCHED frame, and adds `Watch Student Testimonials` in the existing Hero copy/CTA area to the verified `/testimonials/` destination. The enrollment CTA remains `Explore Interview Bootcamp Week` → `/missionresidency/#dates`. The eight-frame order, approved copy, other imagery, visual density, controls, motion, and unrelated homepage sections remain intact.

Diff: 4 files, 49 insertions/24 deletions including a focused 3-test file. No Mission Residency landing, checkout, Zelle, Stripe, entitlement, or other product files changed.

## Source and production identity

- Canonical branch: `codex/homepage-hero-restoration-20261009`
- Pre-repair source commit: `cce119f` (live preimage sync)
- Deployed source commit: `cfc8d21923bfab7b860460c803c3b02ae84860d2`
- Historical visual reference only: `cf7319983044d5f99060e3d45198154c4adb7a4e`
- Deployment ID: `HOMEPAGE-HERO-RESTORE-20261009T1834Z`
- Production PHP SHA-256: `6b8d84f8ae6b8d9b6f7e9ddae1b43d1bf38c94e369b6d72029e35aaf10f5b2da`
- Production CSS SHA-256: `21849f7041b19c83558003d9fac7d5da6ffdb90c74fd8fc66d024670bf2d888a`
- Production JS SHA-256: `f86b937ae45a02777374c5451d7081177cdef20e9530950faefc4b5967ff4dc6`
- Pre-repair PHP SHA-256: `0ebdbc5f8901874027d8dd6d2b6a371269d18dc34f7932bb0a83308bf3a9db07`
- Pre-repair CSS SHA-256: `bd7fc33ed97c791a93e0b549ab3d7316b269194557c163ec39be7419f1fe571d`
- Pre-repair JS SHA-256: `23d847d6a44d802b6de3ccd0dc40884e70b16b265c76a13981728931cbaa0b0a`
- Private preimages/candidate: `/www/theresidencyacademy_209/private/mm-homepage-hero-restore/HOMEPAGE-HERO-RESTORE-20261009T1834Z/`
- Kinsta site cache cleared via authenticated admin toolbar; anonymous homepage, versioned Autoptimize JS, and public CSS read back current code.

## Focused acceptance

| Gate | Result |
| --- | --- |
| Anonymous public opening | PASS: approved MATCHED full-bleed Frame 01 with application → interview → Match message |
| Frames 01–08 | PASS: `mr-application`, `exam-live`, `mr-communication`, `usce-fit`, `mr-ranking`, `exam-reasoning`, `mr-story`, `usce-pathway`; 8 of 8 images loaded, no Marian Hero media |
| Hero CTAs | PASS: Testimonials → `/testimonials/`; enrollment → `/missionresidency/#dates` |
| Responsive | PASS: manual cycle at 1440×900, 1024×768, 430×932, 390×844; no horizontal overflow or CTA/control collision |
| Contrast and visual layout | PASS: inspected opening and dark/light frames, including NRMP and story frames; accepted Hero height preserved (648px desktop; 860px mobile) |
| Keyboard/focus | PASS: ArrowRight advances frame; focus remains on control with visible outline |
| Motion and reduced motion | PASS: desktop autoplay advances at normal motion; mobile starts paused; reduced motion disables transition and autoplay while retaining manual controls |
| Dedicated proof | PASS: `/testimonials/` remains live; existing lower-page Marian proof remains in homepage DOM |
| Code validation | PASS: 3/3 focused tests, JS check, PHP lint, `git diff --check` |
| Critical runtime | PASS: no critical JS exceptions or failed same-origin requests in four fresh headless runs |
| CLS | PASS: desktop 0.00142, mobile 0.01398–0.01492; no major shift |
| LCP | **OBSERVED, CAUTION**: cold anonymous Chrome runs 3.28–4.28s desktop and 3.43–3.86s mobile. The LCP element is the restored approved `mr-application.webp`; image/preload/loading strategy was not changed. Response completion alone took 2.12–2.86s in those runs, so this record cannot prove the historical 1.42–1.90s site timing still holds. Do not present this as a measured before/after regression pass. |

The primary browser QA used a public page without a WordPress admin toolbar, plus separate no-cookie HTTP and fresh headless runs. A fresh read-only verifier independently returned **PASS** after cycling all eight frames at 1440×900 and 390×844, finding loaded images, correct CTAs and no overflow or visible contrast collision. Its browser inherited a signed-in session, so its anonymous confirmation came from a separate no-cookie HTTP request; it did not independently test autoplay or formal contrast ratios. It made no changes.

## Evidence

`qa/1440-frame01.png` and `qa/390-frame01.png` are the restored public opening screenshots. `qa/1440-frame01.png` through `qa/1440-frame08.png` and `qa/390-frame01.png` through `qa/390-frame08.png` record all frames. `qa/*-frames.json` records per-frame image, CTA, media, overflow and geometry checks for all requested breakpoints. `qa/performance-headless.json` and `qa/performance.json` record timings.

## Rollback and state closeout

Rollback target is the exact private `preimage/` PHP, CSS and JS set above. Under a fresh authorized OS PATH lease, compare all three live SHA-256 hashes to this deployment record, atomically copy back the three preimages with original ownership/modes, clear Kinsta site cache, and verify anonymous readback. Do not roll back the full site or unrelated business/runtime data. The deployment lease expired afterward. Following expiry of an unrelated GLOBAL lease, the QA report and captures were committed to the protected source branch as evidence-only commits `855270f` and `a2abe52`; no further production files were changed. Production remains on deployment commit `cfc8d21`.

MissionMed Brain should only ingest the verified facts in this report. No generated Brain product context pack or registry was rewritten for this surgical release.
