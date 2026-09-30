# Performance QA

## Homepage initial navigation

- TTFB: `1684.8 ms`
- FCP: `1864 ms`
- Initial LCP candidate: `1864 ms`, `mr-application.webp`, rendered size `162,289 px²`
- CLS: `0.01582188`
- DOMContentLoaded: `2109.9 ms`
- Load: `2626.2 ms`
- HTML transfer: `322,070 bytes`

The carousel can produce later LCP candidates after its 12-second rotation; release evaluation uses the initial navigation window. All seven premium WebP assets are below the approved `140 KB` per-image ceiling.

## Dedicated Mission Residency warm-cache navigation

- TTFB: `1281.5 ms`
- DOMContentLoaded: `1338.4 ms`
- Load: `1352 ms`
- HTML transfer: `2,212 bytes` (`1,912` encoded body bytes)
- Versioned release asset observed: `scripts/site.js?v=83506b88e775`

The visual asset strategy retains explicit image dimensions, high priority for the presentation image, lazy loading for downstream media, and no rotating hero workload on the dedicated page.

