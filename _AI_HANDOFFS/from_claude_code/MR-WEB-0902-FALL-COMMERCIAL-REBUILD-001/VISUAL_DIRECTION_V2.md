# VISUAL DIRECTION V2

V1 was rejected as flat, monotone, dark, sparse and text-heavy. This records what was actually wrong, what changed, and what deliberately did not.

---

## THE THREE ROOT CAUSES

### 1. One surface, forever
V1 put every section on the same near-black. Thousands of pixels of uninterrupted navy read as one endless page, which is what "flat and monotone" actually describes.

**Fix — environments.** Sections now alternate deliberately:

| | Environment | Used for |
|---|---|---|
| `v-env--dark` | `#050913` | video proof, payment |
| `v-env--deep` | gradient through `#0a1526` | the season journey, 360 |
| `v-env--navy` | `#0f2a44 → #12243c` | the Essentials-vs-Complete argument, closing CTA |
| `v-env--paper` | **`#f6f4ef` warm paper, dark text** | the need router, programs, Personal Statement |

A hairline gold rule separates adjacent environments. The Mission Residency page now moves image-led → light → deep → dark → light → navy → dark → light → deep → navy. Nothing sits on one tone for long.

Paper is warm (`#f6f4ef`), not clinical white — it reads as editorial next to the navy rather than as a different website.

### 2. Body copy was gray on dark
V1 used `#c5d0df`-class muted gray for body text. The founder called this out specifically.

**Fix — a contrast hierarchy with a rule.** `--v-ink #f7f9fc` for primary copy, `--v-ink-2 #dfe6f0` for secondary, and `--v-meta #93a1b5` **for metadata only, never body copy.** Measured result: 128 text elements, zero AA failures, lowest ratio **5.01**.

Light environments needed their own variants — the dark-surface green drops to 1.66:1 on paper and the muted gray to 2.39:1. Both were caught in QA and darkened to ~5:1 and ~6:1.

### 3. Type was small and uniform
**Fix — a real display scale.** `.v-display` runs to `clamp(3rem, 7vw, 5.75rem)` with -0.035em tracking; h2 to `clamp(2rem, 4.2vw, 3.15rem)`; lede to `clamp(1.14rem, 1.85vw, 1.42rem)`. Prices are `clamp(2.6rem, 4vw, 3.4rem)` in Playfair. Nothing important is small any more.

---

## WHAT THE PAGE GAINED

**Photography, and specifically the right photography.** The hero is the authentic embroidered *"MISSION RESIDENCY · MATCHED · ACCOMPLISHED"* patch. The season section carries the real group-mentorship screenshot with a "Live, not recorded" badge. Personal Statement carries the real Dr. Brian portrait. All already published by MissionMed; none sourced by me.

**Eight real Match Day videos, moved to where the selling happens.** They were on the corporate homepage; the flagship sales page had none. Poster-led, click-to-play, `preload="none"` — no video byte is fetched until the visitor asks, and nothing autoplays with audio.

**Proof paired with claims, not pooled at the bottom.** Real student faces in the hero proof strip; the video wall high on the page; Marian's quote sitting beside the 360 closed state.

**Iconography.** Inline SVG, `currentColor`, one per journey stage and route — no icon font request.

**Depth.** Layered hero scrims (weighted horizontally so the photograph is not flattened into grey), gradient card fills, gold-tinted shadows, a floating badge over media.

**Motion.** Scroll reveals with a small stagger, and hero parallax at 0.09. Elements are visible by default and only *armed* for animation once JS confirms it will run — a JS failure can never leave a blank page. `prefers-reduced-motion` disables all of it and the static experience stays complete.

---

## WHAT DELIBERATELY DID NOT CHANGE

- **The palette.** Every token still derives from live page 5686. This is the existing brand amplified, not a new one.
- **No strikethrough, no "save", no percentage-off.** There is still no CSS class for it anywhere, so the banned pattern stays unbuildable.
- **No countdown.**
- **No carousel.** The founder ruled it out and nothing here needs one.
- **No stock photography introduced.** The one stock image that renders on the live page (`pexels-photo-4225920.jpeg`, behind the closing CTA) is replaced with the real class photograph rather than a better stock image.
- **No invented product screenshots.** No verified interface imagery exists for Matrix, StoryForge, RankListIQ or the rest, so the technology section renders nothing. Absence, not fabrication.

---

## HONEST LIMITS

1. **The hero asset is 1277×473.** Any hero taller than ~700px upscales past 1.9× and visibly softens — this is why the first V2 hero looked washed out. Hero height is capped at 720px to compensate. **A larger original would materially improve the page.**
2. **`DrBrian_Profile_2.png` is 6.5 MB and the class photograph 2.4 MB**, unoptimized despite EWWW being installed. The candidate loads both lazily, but Codex should convert to WebP/AVIF with `srcset` — expect ~95% reduction.
3. **No motion design beyond reveals and light parallax.** No scroll-hijacking, no cinematic pinning. Those need art direction and real assets rather than more CSS.
4. **Match Day videos are portrait phone captures.** Presented at 9:13 in a four-up wall, which suits them — but they are not broadcast footage and the design does not pretend otherwise.
