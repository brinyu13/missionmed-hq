# MR-CACHE-011 STAT V3 Auth Handoff 401 Fix

Generated: 2026-05-09

## RESULT

COMPLETE for the reported STAT V3 `401` auth-exchange blocker.

## Issue

STAT V3 was posting directly to Railway `/api/auth/exchange` and stopping on:

- `auth_exchange_http_401`
- message from Railway: signed WordPress HQ token required

That meant the frontend could authenticate only if a Supabase session already existed. A fresh WordPress login could not complete the Railway/Supabase handoff inside STAT V3.

## Legacy / Current Runtime Pattern Checked

Legacy STAT has the basic Railway exchange/bootstrap path, but the stronger same-day route pattern exists in current Daily/Arena runtime:

- On `401`, read the `wordpress_handoff_url` returned by Railway.
- Rewrite the handoff final return target to the current mode route.
- Navigate through WordPress `admin-post.php?action=mmac_hq_auth_redirect`.
- Receive `#mmhq_handoff_token=...`.
- Exchange that token with Railway.
- Bootstrap Supabase session.
- Continue runtime.

STAT V3 was missing that handoff-token branch.

## Changes Applied

Modified only:

- `LIVE/stat_v3.html`

Added:

- STAT V3 auth handoff state keys.
- Handoff token read/store/clear helpers.
- `just_logged_in`/referrer retry delay handling.
- WordPress handoff URL final-return rewriting to `/stat-v3?just_logged_in=1`.
- Token exchange branch before normal cookie exchange.
- Handoff navigation branch when direct exchange returns `401`.
- Current-player hydration from the verified Supabase user after bootstrap.

No changes were made to:

- `LIVE/stat.html`
- auth/login/session/bootstrap/exchange backend code
- Supabase schema/RLS/functions
- Railway/backend
- WordPress production files
- secrets/env files

## Validation

Static:

- Extracted `<script>` syntax check with `node --check`: PASS
- `git diff --check`: PASS
- Safety search found no service role key, no frontend `supabase.auth.signUp`, and no deprecated Supabase project marker.

Auth handoff smoke:

- Logged into WordPress with a provided test account.
- Requested a signed WordPress handoff token through the existing MissionMed handoff route.
- Opened patched local STAT V3 with the handoff token in the URL hash.
- STAT V3 exchanged token with Railway: `POST /api/auth/exchange` returned `200`.
- STAT V3 bootstrapped Supabase: `POST /api/auth/bootstrap` returned `200`.
- STAT V3 loaded opponent roster: 15 rows.
- STAT V3 hydrated current player identity in the V3 shell.

Async smoke:

- Logged in as two provided test accounts.
- Account A loaded patched STAT V3 with handoff token.
- Account A searched Account B.
- Account A created a human async STAT V3 challenge.
- Account B loaded patched STAT V3 with the same duel id and handoff token.
- Account B accepted/loaded the duel.
- Both sides loaded a 10-question sealed pack.

No answer attempts were submitted.

## Deploy / Purge / Push

- Deploy performed: NO
- Purge performed: NO
- CDN invalidation performed: NO
- Push performed: NO

## Remaining Notes

- Localhost cannot be the final target of the production WordPress handoff; Railway returns handoff tokens to MissionMed routes. The local validation therefore obtained a handoff token through MissionMed and then opened the patched local file with that token.
- After deploy, production `/stat-v3` should perform this flow directly and return to `/stat-v3?just_logged_in=1`, not `/arena`.

Confidence: 93%.

Reservation: The auth handoff and create/accept async smoke passed with test accounts, but no full best-of-3 answer submission sequence was run in this pass.
