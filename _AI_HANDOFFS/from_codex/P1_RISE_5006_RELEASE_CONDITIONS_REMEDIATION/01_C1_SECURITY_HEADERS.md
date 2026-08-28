# C1 — Security Headers Through WordPress

Result: **PASS**

## Implementation

`wp-content/mu-plugins/missionmed-rise-route.php` now forwards the bounded upstream response set:

- `Content-Type`
- `Cache-Control`
- `ETag`
- `X-Request-ID`
- `Content-Security-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- `Permissions-Policy`
- `Referrer-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`

Every forwarded value is rejected if it contains CR or LF. Hop-by-hop headers, upstream `Set-Cookie`, `Connection`, and arbitrary headers are not forwarded. The proxy adds only `X-MissionMed-RISE-Proxy: 1`. Proxied API origin responses are emitted as `private, no-store`; authenticated requests also carry WordPress login cookies and bypass Kinsta page caching.

Kinsta's route layer does not serve `.js` and `.css` paths through WordPress. The production HTML therefore uses extensionless `/rise/assets/app` and `/rise/assets/styles`; the isolated service and proxy map them to the unchanged locked JavaScript and CSS bytes. This is a non-visual transport adaptation.

## Public evidence

`GET https://missionmedinstitute.com/api/rise/v1/health` returned HTTP 200 and the current build `rise_web_08a83ea8553d`. The browser-visible response included:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; script-src-attr 'unsafe-inline'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-MissionMed-RISE-Proxy: 1
```

The anonymous session endpoint returned HTTP 401 with `no-store, private`. The public health probe is intentionally non-sensitive; Kinsta had retained its prior public build value, so the exact health path was group- and single-purged. The live cache now contains the current build. The rollback/runbook requires this bounded health purge after later deployments.

## Regression evidence

- WordPress proxy integration test exercises the complete header set, blocks upstream `Set-Cookie` and `Connection`, verifies the extensionless asset aliases, verifies the RISE cookie rename, and verifies the API origin `private, no-store` header.
- RISE unit/security suite: 116 pass, 0 fail.
- Playwright: 12 pass, including CSP-compatible core routes and zero critical accessibility violations.
- Live signed-in browser: Home, Find Programs, grid toggle, Program File, all six tabs, Sources & Freshness, and Admin Research rendered with zero console errors after repeated hard reloads.

C1_SECURITY_HEADERS_PASS = YES
