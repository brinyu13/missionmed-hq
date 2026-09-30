# MissionMed homepage Hero readability + story frame — live acceptance

2026-09-30 UTC. Founder scope: public homepage presentation only. Founder-approved eight-frame architecture, copy, order, height, CTA destinations, controls, motion, and dedicated Mission Residency pages were left intact. Founder override: single-thread final acceptance authorized.

## Surgical source delta

- Frame 03 now uses the existing authentic MissionMed online classroom image `b-immersive/assets/online-class.webp` (2560×1655, 132,876 bytes, SHA-256 `1a7001fb12b7d71f15699e4df80a98af9763f8028e9a781fb4837c5c947bfcfd`). No new generated or stock image was introduced. The image was already available on public production; it remains deferred until Frame 03. Dr Marian Ghaly's single portrait is no longer the dominant institutional Hero image.
- Existing Frame 03 headline, support, CTA, and approved frame position are unchanged. The exact Marian testimonial and accurate attribution remain in the homepage proof section below the rotating Hero; wording and capitalization are unchanged.
- On the homepage only, the Marian quote is warm white, the NRMP header title is warm white, the NRMP explanatory text is a light neutral, and the dark Login button label is warm white on light-theme Hero frames and while scrolled. No layout or sizing CSS was changed except the Frame 03 image crop.
- Source diff: `missionmed-mr-p0.php` one frame row; `premium-hero/hero.css` seven appended CSS lines. No JS, checkout, dedicated page, Exam Prep application, or USCE application file changed.

## Production identity and readback

- Live URL: https://missionmedinstitute.com/
- Deployment identity: `/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/HERO-CONTRAST-STORY-20260930T0716Z`; header contrast fix-forward: `/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/HERO-CONTRAST-STORY-HEADER-FINAL-20260930T0727Z`.
- Final live PHP SHA-256: `5777cd9bb474ad17ab566b6485af4bdc4f802cefc828c5407f8a9ccdb58eca0e`.
- Final live CSS SHA-256: `735899a89318b1160b8fb34c5a20eed07cddd61eca63203ee28001879dd22ae9`.
- Anonymous public homepage HTTP 200 includes the new online-class asset, final contrast rules, and zero current occurrences of the rejected stale phrases. Direct public CSS returns HTTP 200 with the final SHA-256. The old `mr-communication.webp` portrait reference is absent from the public homepage.
- Kinsta Live server page cache cleared, root URL edge cache purged without subdirectories, and CDN cache purged for the same-name CSS replacement after each deployment/fix-forward.

## Contrast audit

Computed actual public colors and WCAG ratios against solid section surfaces:

| Element | Foreground / background | Ratio | Gate |
|---|---|---:|---|
| Marian quote | `#f5f1e7` / `#152c29` | 13.07:1 | PASS |
| NRMP title | `#fffaf2` / `#0f2137` | 15.63:1 | PASS |
| NRMP explanatory copy | `#dce1df` / `#0f2137` | 12.28:1 | PASS |
| NRMP eyebrow | `#c9a96e` / `#0f2137` | 7.26:1 | PASS |
| NRMP category buttons | `#ffffff` / `#0f2a44` | 14.63:1 | PASS |
| Header Login label | `#fffaf2` / `#0a0f1a` | 18.44:1 | PASS |
| Frame 03 accent | `#9b412e` / `#f0ece2` | 5.58:1 | PASS |

All eight live frame screenshots were visually inspected at desktop and mobile. Dark photographic frames retain light copy, while the light Story and NRMP frames retain dark copy. No text/background contrast failures observed. The manual controls and CTAs remain readable.

## Live six-breakpoint acceptance

Chrome, anonymous public production, manually advanced all eight frames at each viewport: 1440×900, 1366×768, 1280×800, 1024×768, 430×932, and 390×844. All 48 transitions had exact approved order/copy/CTA, loaded assets, zero horizontal overflow, accepted Hero height, no text/control collision, zero page JS errors, and zero failed first-party requests. MR CTA links resolve to the already-live canonical `/missionresidency/#dates` route; the source href and existing redirect behavior were not changed. Full per-frame measurements and screenshot paths are in `live-qa/report.json` and `live-qa/`.

The Frame 03 online-class crop was visually checked at all six widths. It has no dominant physician portrait, no duplicate Match Day montage, readable text and CTA, and no collision. The original Marian quote remains verbatim in the proof section. The NRMP panel was visually checked at desktop and mobile; title, explanation, eyebrow, category buttons, and survey frame are readable.

## Performance and interaction

Six anonymous Chrome lab runs (three 1440 desktop, three 390 mobile): LCP element was the initial authentic MATCHED image in every run. LCP 0.188–0.300 s in this warm-network lab; no regression against the prior accepted 1.42–1.90 s measurements. Worst measured CLS 0.00162 desktop and 0.01371 mobile, effectively the prior accepted 0.0015 / 0.0137 baseline within measurement noise. The online-class image was not requested during initial load. No first-party asset failures or page JS exceptions.

Manual Next control responds to keyboard Enter and retains a visible solid focus outline in both normal and reduced-motion contexts. Reduced-motion preference remains recognized. The JS, rotation, autoplay controls, and loading strategy were unchanged.

## Rollback

Full pre-P0 source preimages: `/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/HERO-CONTRAST-STORY-20260930T0716Z/preimage/missionmed-mr-p0.php` (`65465d56ecc1c2df723709ad6e136682ba05ffa180d5ceef7934077a0ebb4e50`) and `/www/theresidencyacademy_209/private/mm-home-mr-premium-hero/HERO-CONTRAST-STORY-20260930T0716Z/preimage/hero.css` (`16c679fe34a79fcc045eafde158b372101518ab226a3771fa44288a2009d521a`). Reinstall both together and purge the same homepage/server/CDN caches if rollback is needed. The final CSS fix-forward also has a separate intermediate preimage under `HERO-CONTRAST-STORY-HEADER-FINAL-20260930T0727Z/preimage/hero.css`.

## Final matrix

| Gate | Verdict |
|---|---|
| Marian dominant portrait removed; authentic story visual | PASS |
| Marian proof exact wording and attribution | PASS |
| All eight frames and cadence | PASS |
| NRMP panel readability | PASS |
| Story quote readability | PASS |
| WCAG AA contrast for repaired solid surfaces | PASS |
| 1440 / 1366 / 1280 / 1024 / 430 / 390 | PASS |
| No Hero height, CTA, or copy regression | PASS |
| Keyboard focus, manual controls, reduced motion | PASS |
| CLS, LCP, deferred Frame 03 asset | PASS |
| No stale rejected proposed copy | PASS |
| Rollback preimages | PASS |

No noncritical deferred item is known for this surgical release.
