# TIMELINE-RC1-RECOVERY-003 — Local Export Fidelity Report

Status: LOCAL PASS; LIVE PRODUCTION VISUAL CONFIRMATION REQUIRED AFTER IMMUTABLE RELEASE

## Root cause

The WordPress runtime builder rewrote every URL in the protected D1-409H stylesheet to an absolute `/timeline/_asset/<alias>` route. The protected same-DOM export serializes its committed board into a data-URI SVG. Its compatibility inliner recognizes the accepted relative `assets/...` references, but not the WordPress aliases. Fonts, board textures, paper textures, and other CSS images therefore remained external inside the data-URI SVG and could disappear during rasterization.

The PDF adapter also supplied `792 × 445.5 pt` for both declared PDF formats. This was a 16:9 canvas size, not Letter landscape and not A4 landscape.

## Bounded repair

- The WordPress release builder now packages a separate protected capture stylesheet with 26 embedded data URLs. The capture CSS contains zero external Timeline asset URLs and zero relative asset URLs. MIME types are limited to `font/woff2`, `image/jpeg`, and `image/png`. The normal on-screen stylesheet remains the smaller alias-based asset, so the 2.69 MB capture payload is fetched only when export is requested rather than during initial rendering.
- PNG remains a capture of the exact committed D1-409H-A1 DOM.
- PDF now derives from that same protected PNG raster, places it without distortion on a true paper page, and centers it on a white print surface.
- Letter page: `792 × 612 pt`; board box `792 × 445.5 pt` at `x=0`, `y=83.25`.
- A4 page: `841.89 × 595.28 pt`; board box approximately `841.89 × 473.563125 pt` at `x=0`, `y=60.8584375`.
- Builder preview replacement is keyed to the visual document signature, namespace, surface, and entitlement. Nonvisual save timestamps no longer replace the last-good board with the loading surface.

Protected D1-409H HTML, CSS, and JavaScript were not modified.

## Verification

- Focused unit/contract tests: 22/22 PASS.
- Administrator browser workflows: 13/13 PASS.
- PNG generation: 289.2 ms.
- Letter PDF generation: 653.4 ms.
- A4 PDF generation: 513.8 ms.
- 3-, 7-, and 13-event renderer checks: zero collision, out-of-bounds, or text-fit warnings.
- Five surfaces project one identical presentation model. Revision fingerprints may differ when a prior last-good preview is intentionally retained across a nonvisual save.
- Nonvisual save probe retained the same connected Builder kernel and never exposed the loading replacement.
- Browser console/request errors during export: zero.
- Built protected capture stylesheet: 2,685,744 bytes, 26 embedded assets, zero external/relative asset dependencies.
- PNG versus scaled on-screen preview diagnostic: SSIM `0.832753`, PSNR `27.658475 dB`. This comparison includes expected antialiasing differences from scaling a 736 × 414 browser screenshot to 1920 × 1080; visual inspection confirmed the same composition, textures, fonts, colors, and geometry.

## Opened artifact inspection

The generated PNG, Letter PDF page, and A4 PDF page were opened and visually inspected. The board denim, paper textures, title plaque, color key, profile card, axis, event arrows, typography, and placement were present. No label collisions were observed in the seven-event artifact.

## Evidence

- `evidence/export-fidelity-local/canonical-export-preview.png`
- `evidence/export-fidelity-local/generated-export-1920x1080.png`
- `evidence/export-fidelity-local/generated-export-letter.pdf`
- `evidence/export-fidelity-local/generated-export-a4.pdf`
- `evidence/export-fidelity-local/opened-letter-page.png`
- `evidence/export-fidelity-local/opened-a4-page.png`

## Remaining gate

This evidence is local and does not count a required production UI journey. After the next immutable Timeline release, the visible production Export journey must download both PNG and PDF, open each artifact, compare them against the same live approved preview, and confirm the production self-contained stylesheet is active.
