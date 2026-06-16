# MM-LAUNCH Speed Hardening Queue

Ticket: `MM-LAUNCH-SEV1-002-MEGARUN`

Date: 2026-06-15

## Scope

No risky performance optimization was performed. No asset deletion, CDN rewrite, image compression, JavaScript bundling, or Elementor restructuring was done in this pass.

## Current Findings

- Repository scan found no checked-in `.mov`, `.mp4`, `.webm`, `.png`, `.jpg`, or `.jpeg` files larger than 2 MB.
- Live crawl detected `.mov` video references on `/examprep/` in prior audit context. These are likely WordPress media-library or Elementor references, not source-controlled local assets.
- Launch pages are Elementor-heavy and likely include page-builder CSS/JS overhead.
- Legal virtual pages are lightweight and should not materially add load.
- The mu-plugin adds small inline CSS/JS only on affected public pages.

## Large Asset Queue

1. Inspect WordPress Media Library for `.mov` assets used by `/examprep/`.
2. Transcode `.mov` assets to web-optimized `.mp4` or `.webm`.
3. Set explicit poster images for video blocks.
4. Confirm videos do not autoplay above the fold unless intentionally required.
5. Replace oversized uploaded images with compressed WebP/AVIF alternatives where safe.

## Elementor Bloat Queue

1. Run GTmetrix or Lighthouse on:
   - `/`
   - `/mission-residency/`
   - `/mission-residency-courses/`
   - `/examprep/`
   - `/usce/`
2. Identify render-blocking Elementor CSS/JS bundles.
3. Disable unused Elementor widgets/modules only after visual regression testing.
4. Keep launch-critical CTA and checkout paths functionally unchanged.

## Safe Quick Wins

- Enable page cache after legal/CTA deployment is confirmed.
- Clear Elementor CSS cache after deployment.
- Confirm Cloudflare or host-level cache does not serve stale 404 policy pages.
- Add width/height attributes to large images if missing.
- Convert `.mov` to `.mp4` via media replacement, preserving page URLs where possible.

## GTmetrix Targets

- Largest Contentful Paint: under 2.5 seconds on core launch pages.
- Cumulative Layout Shift: under 0.1.
- Total Blocking Time: under 200 ms where feasible.
- Fully loaded time: under 4 seconds on mobile-tested pages.

## Do Not Do In Speed Pass

- Do not remove Elementor sections blindly.
- Do not delete WordPress media assets.
- Do not change checkout/payment scripts.
- Do not modify Arena backend routes.
- Do not run production deployment without approval.

