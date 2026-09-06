# MR-WEB-0906A Cache Purge

Status: **PASS**

The final post-hotfix purge completed as follows:

| Layer | Result | Final evidence |
|---|---|---|
| Elementor generated CSS/data | PASS | Files manager cache clear returned true at `2026-09-06T23:19:53Z` |
| Autoptimize | PASS | `autoptimizeCache::clearall()` returned true at `2026-09-06T23:19:53Z` |
| WordPress object cache | PASS | `wp_cache_flush()` returned true at `2026-09-06T23:19:53Z` |
| Kinsta object cache | PASS | Complete object-cache purge returned true at `2026-09-06T23:19:53Z` |
| Kinsta page/site cache | PASS | Provider endpoint returned HTTP `200` at `2026-09-06T23:19:53Z` |
| Kinsta CDN cache | PASS | Narrow provider retry returned HTTP `200` at `2026-09-06T23:22:27Z` |

Kinsta rate-limited the CDN call embedded in the full purge with HTTP `429`. The already-successful layers were preserved, and only the CDN layer was retried after the provider window reset. The retry used a fresh narrow lease and succeeded. Final logged-out desktop/mobile captures and the 5/5 rendered acceptance sweep were taken after that success.

Scripts:

- [Full cache purge](evidence-scripts/mr-web-0906a-cache-purge.php)
- [Narrow CDN retry](evidence-scripts/mr-web-0906a-cdn-purge.php)
