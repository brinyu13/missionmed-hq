# Narrow route HTML cache mechanism — research only

Verdict: a precise installed-vendor single-URL server purge request exists; no purge was executed. Its edge fanout and backend acknowledgement semantics are not proven by static PHP alone. Independently review the packet below before any operation; do not substitute a broad purge if either layer remains stale.

Scope is exactly https://missionmedinstitute.com/interview-ready/ and https://missionmedinstitute.com/ separately, preserving trailing slash. The site transport below is provider-local localhost; localhost is not a substitute target hostname in the payload. No app/private/stateAPI route, sibling path, wildcard/group, shared JS/CSS, object cache or global cache is admitted.

DR-376_ir_phase1_bounded_execution_annex.md current SHA256 452a9e6259f6ae2f9e1441c725f79156b2d099d88a38af694b248e345b7dbe0e was read. It expressly permits “narrow route cache invalidation” after filing/lease admission and separately conditions scoped invalidation on independent exact-byte review/fresh BOOT/normal lease gates. This research does not extend that authority or the already released INSTALL claim. Prior independent attempt2 custody report is dbd041578def0ffdd97474fba530f7e95df5cee8b3a6f3e22b06a52d2bb4893d. Foreman's current anonymous homepage Kinsta/CF HIT with age1698 and IRhref0, and cached public-guide HIT, are motivation supplied by Foreman, not independently measured in this task.

## Primary provider documentation

[Kinsta Server Caching](https://kinsta.com/docs/wordpress-hosting/caching/site-caching/) (updated June3,2026, accessed October4) documents broad WP-CLI/server purge commands and custom-path automatic purging. Those commands do not establish a one-URL CLI selector. Site-wide server clear may affect edge/object cache; do not invoke it for this packet.

[Kinsta MU Plugin](https://kinsta.com/docs/wordpress-hosting/kinsta-mu-plugin/) (updated April27,2026, accessed October4) documents exact single paths versus group/prefix paths. Trailing slash is significant. Its settings UI disallows adding root / as a custom automatic rule because that can broaden invalidation; do not change plugin settings or trigger post-save autopurge to purge homepage.

[Kinsta Edge Caching](https://kinsta.com/docs/wordpress-hosting/caching/edge-caching/) (accessed October4) independently documents a narrow edge operation: MyKinsta > selected site > Caching > Edge Caching > Clear URL cache. Enter a complete target URL; leave the subdirectory-clear checkbox unchecked. This clears edge only. Documentation says propagation can require2–5 minutes. It does not prove the installed loopback endpoint's edge behavior. This existing dashboard operation requires authorized existing MyKinsta access; none was accessed or acquired here.

The old2023 [Kinsta community API response](https://community.kinsta.com/t/clear-cache-for-specific-url-path/2479) says its then-current public API lacked page-specific clear-cache parameters. This is historical context, not current API absence proof and not justification to invent a public REST endpoint.

## Exact installed vendor source

Read-only SSH discovery was limited to /www/theresidencyacademy_209/public/wp-content/mu-plugins/*kinsta*, then PHP source inside the matched kinsta-mu-plugins directory. No WP bootstrap, eval, options, wp-config, environment, credential or private user data was read. Static vendor code was hashed and only cache-relevant spans inspected.

Installed loader header Version3.6.1:

| Vendor path relative to MU root | SHA256 | Relevant evidence |
| --- | --- | --- |
| kinsta-mu-plugins.php | fac0c7361bdc6c02e150b60aaf02c82044141ef1276afbfd73684d37f8491e13 | Version3.6.1; exact vendor cache/CLI includes |
| kinsta-mu-plugins/cache/class-cache.php | 28c60318fb0ccc757cbc6feb4950e2f063724755bfc6bc0623acdf3fa2c578a9 | lines70–77: immediate_path https://localhost/kinsta-clear-cache/v2/immediate; separate throttled path |
| kinsta-mu-plugins/cache/class-cache-purge.php | 0ad40fe4c17b36cdcf20914cba7dcb2a615696a1adbc35f61ef5848d817405af | lines451–482 send_cache_purge_request; lines492–507 convert_purge_list_to_request |
| kinsta-mu-plugins/wp-cli/class-kmp-wpcli.php | 69caf5a1289ff3c294a1faecef754d7b859285a9dd8a1f5b39a77f1002ec703b | registers kinsta cache purge command |
| kinsta-mu-plugins/wp-cli/commands/class-cache-purge-command.php | 2cce8f85826d2887edfcff3a9381881230334e693788a2b8b2644e30fd5e9c29 | lines70–94 default/--site calls purge_complete_site_cache; no URL selection |

Exact static vendor call contract: Cache_Purge::convert_purge_list_to_request(['single'=>[key=>completeURL]]) yields form key single|key with value stripped of http:// or https://. Cache_Purge::send_cache_purge_request(immediate_path,convertedPayload) issues POST with http_build_query(post_body), cURL timeout/connect timeout default5 seconds, no redirect-follow option and no token/auth/header requirement. Vendor loopback TLS verification is disabled. This finding does not authorize disabling TLS verification for a public host.

initiate_purge(post_id) is unsuitable: it includes homepage/blog, archives, feeds, sitemap, AMP and custom paths and fires hooks. Do not call it or instantiate/load the vendor/WordPress stack for this task. Direct bounded transport can reproduce the exact static form without invoking constructor/hooks/options. PHP request construction shows one-key single intent; the provider's underlying service implementation was not inspected, and exact semantic acknowledgement/body was not invented.

## Prospective independently reviewable action packet

No command below was run, no helper was created, and no new credential is required by the observed loopback call. Existing fixed SSH custody would be the transport; any actual cache operation needs fresh applicable lease/provider authority and independent exact operation review. No released INSTALL claim is reused.

Operation1 (public guide only):

- Local provider endpoint: POST https://localhost/kinsta-clear-cache/v2/immediate, executed inside this exact site's SSH environment.
- Form Content-Type: application/x-www-form-urlencoded; one key/value only: single|ir_route = missionmedinstitute.com/interview-ready/.
- Exact encoded body: single%7Cir_route=missionmedinstitute.com%2Finterview-ready%2F.

Operation2 (homepage HTML only), separately guarded:

- Same local provider endpoint/method/content type; one key/value only: single|ir_home = missionmedinstitute.com/.
- Exact encoded body: single%7Cir_home=missionmedinstitute.com%2F.

No group key, throttled request, extra hostname, scheme-changing redirect, alternate origin, /kinsta-clear-cache-all, /kinsta-clear-cache-cdn, --site/--all/--cdn/--object, wp cache flush, Redis flush, post update or settings mutation. WP-CLI --url chooses WordPress context; it is not a narrow cache path parameter. No HTTP PURGE endpoint or undocumented public-host path is proposed.

Before each prospective request: fresh BOOT/scope clearance, actual guard, exact vendor hashes, precise body/path and applicable server/session deadline checks. A bounded implementation must cap response bytes, suppress raw body/errors, stop on redirects/timeout/unknown acknowledgement, retain uncertainty rather than retry or broaden. No request/acknowledgement capability is supplied by this research report.

After an admitted request, perform normal anonymous GET of only the exact target HTML and compare source-derived route/menu facts and Kinsta/CF cache headers. A cache HIT alone may reflect successful refill; assess current content. Check all15 shared origin and9 shared public byte hashes for preservation. Public response HTML may undergo provider transformation, so endpoint acceptance must distinguish approved original bytes from transformed delivery; do not claim exactbody from HTTP200 alone.

If server content remains stale, stop: do not replace single payload with group/root wildcard/global clear. If origin is fresh but edge stale, the documented MyKinsta exact Clear URL cache operation above is the narrow fallback, each complete URL separately with subdirectories unchecked. Existing authenticated dashboard access must be qualified separately; no new token/password acquisition is authorized. If dashboard access or loopback semantics are unsupported/unavailable, require provider confirmation or hold the route; do not fall back to broad purge. Even a successful scoped cache refresh does not finish public/native/LIVE acceptance.

STOP UNCOMMITTED. Only this research report written; no purge, HTTP POST/PURGE, provider DML, runtime/source/auth/Git mutation, bootstrap, credential read or cleanup occurred.
