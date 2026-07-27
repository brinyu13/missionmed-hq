# Seam 2 — Same-Origin Edge Routing

Status: **IMPLEMENTED as code and locally verified; NOT DEPLOYED.**

Implementation:

- `storyforge-v5/infra/edge/worker.mjs`
- `storyforge-v5/infra/edge/wrangler.toml`
- `storyforge-v5/infra/edge/local-router.mjs`
- `storyforge-v5/scripts/build-static.mjs`
- `storyforge-v5/scripts/scan-bundle-secrets.mjs`
- `storyforge-v5/dist/`

## Routing and caching

- The edge route owns `/storyforge/*` before WordPress.
- Static client routes fall back to the built `index.html`.
- `index.html` is `no-store`.
- content-hashed assets are `public, max-age=31536000, immutable`.
- `/storyforge/api/*` and `/storyforge/healthz` proxy to the StoryForge application origin.
- Non-StoryForge paths remain WordPress-owned.
- The local proxy forwards public host/protocol information so ordinary WordPress permalinks remain canonical and functional.

## Configuration and safety

- `workers_dev=false` and preview URLs are disabled.
- The route pattern is declared as `missionmedinstitute.com/storyforge/*`.
- `STORYFORGE_ORIGIN` is intentionally not populated in source; B1-502 must place it in the protected platform store.
- The application pins allowed origins to the configured Matrix origin and rejects a foreign `Origin`.
- The build step produces deterministic 12-character SHA-256 asset names.
- The bundle scan rejects service-role markers, signing-secret names, private-key blocks, and common secret-key forms.

Final local artifact hashes:

| Artifact | SHA-256 |
|---|---|
| `dist/index.html` | `ab6ef723444d5fbde8d651d8252423820972bee92670f0741a9db34dda69ba9c` |
| `dist/assets/app.af177a227970.js` | `af177a227970f40d65fd07318526fcf66e3f5d9fe7e947bd2c1f9dcd0c0f1659` |
| `dist/assets/auth.888214ef5fbc.js` | `888214ef5fbcfb81854aa740a1cea7ca892bea4ae21329818efa90e88e6fac7e` |
| `dist/assets/styles.6c4c7db3b9f3.css` | `6c4c7db3b9f3ce781487ee136643fc404f6a04ed40e95e8a191df473263e0ee7` |

These are local candidate artifacts, not production receipts.
