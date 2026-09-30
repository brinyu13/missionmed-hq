# MISSIONMED-HOMEPAGE-DIVISION-SHOWCASE-V1

Status: deployed and verified on the anonymous public `https://missionmedinstitute.com/` homepage, 2026-09-30 UTC.

## Placement and scope

The showcase is inserted after the accepted Hero and its existing institutional ecosystem bridge, before the existing Marian proof section. It adds three equal-priority cinematic scenes, in the required order: ExamPrep, USCE + Clinicals, Mission Residency. The accepted eight-frame Hero data, Hero CSS, Hero JS, controls, height, and loading strategy were not edited. No product page, payment, account, or application source was edited.

## Version custody

- Pre-showcase named version: `MISSIONMED-HOMEPAGE-PRE-DIVISION-SHOWCASE`
- Pre-showcase source commit: `4b9afed3e55ee782671e35a66867bfaab2d0e2b4`
- Pre-showcase PHP SHA-256: `5777cd9bb474ad17ab566b6485af4bdc4f802cefc828c5407f8a9ccdb58eca0e`
- Final showcase source commit: `957bedd9d95669306dc0f9b2f096d8615dcdc984`
- Deployment identity: `MISSIONMED-HOMEPAGE-DIVISION-SHOWCASE-V1`; initial deployment `2026-09-30T18:23:13Z`, with guarded CSS/JS fix-forward later that day.
- Deployment and final-version record: `/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/MISSIONMED-HOMEPAGE-DIVISION-SHOWCASE-V1/`
- Private preimage: `/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/MISSIONMED-HOMEPAGE-PRE-DIVISION-SHOWCASE/`
- Public PHP SHA-256: `aa7e296ccce7d9a6812adee731bd19012a13ba02b853eac1fe1340326bfc31f5`
- Showcase CSS SHA-256: `5c692f5dc644a7a20401661820ab836bc8682c1d2c1574404d7dd3c3426911d0`
- Showcase JS SHA-256: `2ad69005f1c6bb5489d491e52ca10cf0956fba0b9d3598a9731b8fff3ea06055`
- Hero CSS unchanged SHA-256: `735899a89318b1160b8fb34c5a20eed07cddd61eca63203ee28001879dd22ae9`
- Hero JS unchanged SHA-256: `542a29d328dd6d24f942734c4b16c30cf9a975452de7976663cc1f8ab4ca6e10`
- Responsive ExamPrep derivative SHA-256: `6fd43ac4bdc3a56126ffad6a1ec271c9081eab8623636eb18b142bc0a9a5684e` (45,528 bytes)
- Responsive USCE derivative SHA-256: `4ab9fcfaec236f6138c9bbff7a8a59e5a4230804f88d057d8b416b3cf2b2fa8c` (45,214 bytes)

## Division mapping

| Order | Asset | Message | CTA and verified destination |
|---|---|---|---|
| 01 ExamPrep | Approved Hero video-call illustration `exam-live.webp` plus 768px derivative | “Train how you think under pressure.” Live USMLE/COMLEX/boards reasoning and feedback | “Explore ExamPrep” → `/examprep/` |
| 02 USCE + Clinicals | Approved Hero/live USCE operating-room illustration `usce-operating.webp` plus 768px derivative | “The right clinical experience. Placed with precision.” Placement matched to specialty, timeline, clinical need | “Explore Clinical Experiences” → `/usce/` |
| 03 Mission Residency | Authentic existing Mission Residency classroom/Match Day montage `montage-1702.webp` plus existing 600px Hero derivative | “Become a better communicator.” Communication, story, connection | “Explore Mission Residency” → `/missionresidency/` |

The ExamPrep and USCE images are existing, approved illustrative donors, not documented images of MissionMed students or placements. No generated person or new stock asset was introduced.

## Motion and loading

Each full-width scene is approximately 64vh (clamped at 510–680px) on desktop. An image layer moves at 0.16× bounded to ±82px while foreground content scrolls normally; a restrained radial light layer moves at a second rate and breathes slowly. Mobile stacks the image and copy, bounds image depth to ±14px, and avoids 100vh traps. Reduced motion removes image movement and ambient animation while retaining imagery, copy, and CTAs. Images use responsive srcset, explicit dimensions, low fetch priority, and an IntersectionObserver trigger 400px before viewport entry. The initial Hero image remains the only high-priority preload.
