# Seam 3 — SPA Authentication and Base Path

Status: **IMPLEMENTED and locally verified.**

Implementation:

- `storyforge-v5/public/auth.js`
- auth/base-path-only changes in `public/app.js`, `public/index.html`, and `public/styles.css`
- configuration and mount handling in `server/config.mjs` and `server/app.mjs`

## Production boot behavior

1. Fetch public runtime configuration from the mounted app.
2. Call the same-origin WordPress bootstrap with the full current URL as `return_to`.
3. If WordPress reports no session, follow its login URL containing the exact deep link.
4. Exchange the WP REST nonce at the token endpoint.
5. Hold the JWT in a closure in memory only.
6. Load the existing StoryForge session/API through the bearer token.
7. Refresh silently before expiry and on focus/visibility return.
8. Retry one API `401` after a fresh exchange.
9. Render truthful ended-session or revoked-eligibility lockout states when refresh fails.

The production JWT is never placed in `localStorage`, `sessionStorage`, or a SPA cookie.

## Mount and navigation

- The router resolves client paths beneath configured `/storyforge/`.
- The build injects `<base href="/storyforge/">`.
- API URLs are derived from the configured base.
- Back-to-Matrix uses `matrixBaseUrl` from public runtime configuration.
- Server static handling supports nested client routes and applies the required cache policy.

## Existing local fixture compatibility

The pre-existing B1-500 local signed-fixture mode remains loopback-only. To preserve the unchanged browser suite across a page reload, local mode remembers only the non-secret fixture persona name in `sessionStorage` and mints a new local token after reload. It never persists a JWT, and this path is unreachable when production fixture auth is off.

No schema, RLS, state-transition, product workflow, or existing test file changed.
