# MM-AUTH-ARCH-001: MissionMed Auth Architecture Specification

**Version:** 1.0 | **Date:** 2026-04-23 | **Authority:** Validated against deployed codebase
**Status:** LOCKED
**Risk Level:** HIGH (production auth system)

---

## Overview

MissionMed uses a multi-layer authentication architecture spanning WordPress (identity provider), Railway (session backend), and Supabase (data-layer auth for RLS). Two distinct frontends consume this architecture differently:

- **Arena** (`arena_v1.html`): Full Supabase client-side auth via bootstrap
- **MissionMed HQ** (`app.js`): Railway Bearer token only, no client-side Supabase auth

WordPress is the root identity provider. Railway is the session authority. Supabase auth users are provisioned server-side by Railway.

---

## Architecture Diagram (Text)

```
ARENA FRONTEND (served from missionmedinstitute.com)
  |
  |-- (1) POST /api/auth/exchange [relative path, credentials: include]
  |       |
  |       v
  |   WORDPRESS (missionmedinstitute.com)
  |       |-- mu-plugin: missionmed-hq-proxy.php
  |       |-- Intercepts /api/auth/*, forwards to Railway
  |       |-- Forwards headers + cookies
  |       v
  |   RAILWAY (missionmed-hq-production.up.railway.app)
  |       |-- Validates WP token against WP REST auth endpoint
  |       |-- Creates encrypted session record
  |       |-- Returns: accessToken (encrypted) + Set-Cookie (HttpOnly)
  |       v
  |-- (2) POST /api/auth/bootstrap [Bearer: accessToken]
  |       |
  |       v
  |   RAILWAY
  |       |-- Resolves WP user from session
  |       |-- Ensures Supabase auth user exists (create/sync)
  |       |-- Signs in Supabase user (email + derived password)
  |       |-- Returns: access_token + refresh_token
  |       v
  |-- (3) supabase.auth.setSession({ access_token, refresh_token })
  |-- (4) supabase.auth.getUser() -- verify identity
  |-- (5) RLS-enforced Supabase queries
```

```
HQ FRONTEND (login.html / app.js)
  |
  |-- (1) User clicks Login -> redirect to WordPress /my-account/
  |-- (2) WordPress authenticates -> redirects to HQ /hq with signed token
  |-- (3) POST /api/auth/exchange { token: wpToken }
  |       |-- Via WP proxy or direct to Railway (API_BASE dependent)
  |       v
  |   RAILWAY
  |       |-- Validates WP token
  |       |-- Returns: accessToken + Set-Cookie
  |       v
  |-- (4) Store accessToken in localStorage
  |-- (5) All API calls use Authorization: Bearer {accessToken}
  |-- No Supabase client auth. All Supabase ops server-mediated.
```

---

## Step-by-Step Flow: Arena Auth

| Step | Actor | Action | Transport |
|------|-------|--------|-----------|
| 1 | Arena | Check existing Supabase session via `getUser()` | Supabase JS client |
| 2 | Arena | If no session, POST `/api/auth/exchange` with `credentials: include` | Fetch, relative path |
| 3 | WP Proxy | Forward request + cookies to Railway | `wp_remote_request()` |
| 4 | Railway | Validate WP token against `MMHQ_WP_AUTH_ENDPOINT` | Server-to-server HTTPS |
| 5 | Railway | Create session record (user, CSRF, expiry, WP authorization) | Internal |
| 6 | Railway | Return encrypted `accessToken` + `Set-Cookie` | HTTP response |
| 7 | Arena | POST `/api/auth/bootstrap` with Bearer token | Fetch via WP proxy |
| 8 | Railway | Resolve/create Supabase auth user | Supabase Admin API |
| 9 | Railway | Sign in Supabase user (email + derived password) | Supabase GoTrue |
| 10 | Railway | Return `access_token` + `refresh_token` | HTTP response |
| 11 | Arena | `supabase.auth.setSession(tokens)` | Supabase JS client |
| 12 | Arena | `supabase.auth.getUser()` verification | Supabase JS client |

---

## Step-by-Step Flow: HQ Auth

| Step | Actor | Action | Transport |
|------|-------|--------|-----------|
| 1 | User | Visit `/login.html` | Browser |
| 2 | User | Click Login, redirect to WP `/my-account/?redirect_to=...` | Browser redirect |
| 3 | WordPress | Authenticate user, redirect to HQ `/hq?token={signed_token}` | WP login flow |
| 4 | HQ Frontend | POST `/api/auth/exchange` with `{ token }` | Fetch + API_BASE |
| 5 | Railway | Validate token, create session, return `accessToken` + cookie | HTTP response |
| 6 | HQ Frontend | Store `accessToken` in `localStorage` | Browser |
| 7 | HQ Frontend | All API calls use `Authorization: Bearer {accessToken}` | Fetch |

---

## Constraints

### WordPress

- WordPress owns user identity. No user creation outside WordPress.
- `logged_in` cookie is HttpOnly, same-origin. Cannot be read or sent cross-origin.
- WP proxy (`missionmed-hq-proxy.php`) is the only mechanism for forwarding WP cookies to Railway.
- Only users with roles in `MMHQ_ALLOWED_WP_ROLES` (default: `administrator`) may access HQ.
- Login flow uses WooCommerce My Account page with redirect support.
- Legacy AJAX auth endpoint (`mm_arena_check_auth`) is hard-disabled.

### Railway

- Session cookie: HttpOnly, SameSite=Lax, Secure (on HTTPS), Path=/, 8h TTL.
- Session encryption: AES with `MMHQ_SESSION_SECRET`.
- CSRF: Generated per session, required for mutation endpoints.
- CORS: Allows `Authorization`, `Content-Type`, `X-MMHQ-CSRF` headers. Does NOT include `Access-Control-Allow-Credentials: true`.
- Bearer token is primary transport; cookie is fallback.

### Supabase

- Auth users are provisioned server-side by Railway using Supabase Admin API.
- Authentication uses email + derived password (deterministic from WP user + Supabase UUID).
- Supabase service role key is used for admin operations (user creation, credential sync).
- RLS policies must gate on `auth.uid()` for Arena queries.

### Browser

- Arena MUST be served from the WordPress domain for same-origin auth to work.
- Cross-origin requests to Railway with `credentials: 'include'` will fail (missing `Access-Control-Allow-Credentials`).
- Bearer tokens in `localStorage` are vulnerable to XSS.

---

## Failure Modes

| Failure | Cause | Impact | Mitigation |
|---------|-------|--------|------------|
| WP proxy unreachable | Railway down | 502 returned to browser | Monitor Railway uptime |
| Session secret missing | `MMHQ_SESSION_SECRET` unset | Sessions non-persistent, 503 on exchange | Env var validation on deploy |
| WP base unconfigured | `MMHQ_WP_BASE` unset | No login redirect, 503 on auth/start | Env var validation |
| WP token rejected | Invalid/expired WP token | 401 on exchange | User must re-login |
| Unauthorized role | User lacks admin role | 403 on exchange | Role configuration |
| Supabase user unresolved | UUID resolution failure | 502 on bootstrap | Admin API connectivity |
| Supabase sign-in failure | Password mismatch after sync | Retried once, then error | Credential sync before sign-in |
| Cross-origin CORS block | Frontend not on WP domain | Browser blocks response entirely | Serve from WP domain or fix CORS |
| XSS token theft | Script injection on domain | Full session hijack | CSP, input sanitization |

---

## Integration Rules

1. Any thread modifying auth flow MUST load this file first.
2. Any thread modifying Arena auth MUST test the full chain: exchange -> bootstrap -> setSession -> getUser.
3. Any thread modifying CORS or proxy configuration MUST verify both same-origin and cross-origin scenarios.
4. Any thread modifying Supabase user provisioning MUST verify RLS policies still enforce correctly.
5. Any thread adding new `/api/auth/*` endpoints MUST update the WP proxy if they should be proxied.
6. The two auth models (Arena/HQ) must not be conflated. Changes to one do not automatically apply to the other.

---

## Key Files

| File | Location | Purpose |
|------|----------|---------|
| `missionmed-hq-proxy.php` | `wp-content/mu-plugins/` | WP proxy for `/api/auth/*` to Railway |
| `missionmed-supabase-session-cookie-auth.php` | `wp-content/mu-plugins/` | WP cookie auth shim for supabase-session endpoint |
| `missionmed-global-auth-ui.php` | `wp-content/mu-plugins/` | Header auth UI (Login/Profile/Logout) |
| `missionmed-login-flow-restore.php` | `wp-content/mu-plugins/` | Post-login redirect handling |
| `server.mjs` | `missionmed-hq/` | Railway backend (all auth endpoints) |
| `api.js` | `missionmed-hq/public/assets/core/` | HQ frontend API client |
| `app.js` | `missionmed-hq/public/assets/` | HQ frontend session management |
| `login.js` | `missionmed-hq/public/assets/` | HQ login page logic |
| `arena_v1.html` | Root | Arena frontend (full Supabase auth flow) |

---

## Known Issues Requiring Future Resolution

1. **CORS: Add `Access-Control-Allow-Credentials: true`** to `buildCorsHeaders()` in `server.mjs` and replace `*` origin with explicit allowed origins.
2. **Cookie forwarding: Filter proxy cookies** to only send necessary cookies to Railway.
3. **Session rotation: Implement refresh token mechanism** for Railway sessions to reduce stolen-token window.
4. **Supabase bootstrap: Evaluate migration** from password-based to service-role token-based session issuance.
5. **Session expiry: Verify `readEncryptedSession`** correctly rejects expired sessions (current `console.warn` may be masking acceptance of expired sessions).

---

END OF MM-AUTH-ARCH-001
