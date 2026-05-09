# AV3-003 Avatar V3 Engine Fix Report

RESULT: COMPLETE

## Summary
- Legacy avatar upload/generation code was used as the working reference and was not modified.
- Avatar Studio V3 was failing because the runtime posted directly to `POST /api/avatar/v3/generate`, while the live avatar service currently returns `404 Cannot POST /api/avatar/v3/generate`.
- The working live route remains `POST /api/avatar`, confirmed by a safe no-file probe returning `400 {"stage":"no_file"}`.
- `LIVE/arena.html` now keeps the V3 Studio UI but routes V3 generation through the working legacy avatar engine first, with V3 metadata attached to the saved locker record.

## Files Changed
- `LIVE/arena.html`

## Files Intentionally Untouched
- Legacy avatar upload handler in `LIVE/arena.html`
- `LIVE/stat.html`
- `LIVE/stat_v3.html`
- `LIVE/daily.html`
- `LIVE/drills.html`
- `LIVE/daily_drills_v3.html`
- Auth/session/bootstrap/exchange source
- Supabase schema/RLS/functions
- Railway/backend source
- Deployment scripts and production routing

## Root Cause
- Avatar Studio V3 used the planned native V3 endpoint:
  - `https://noble-harmony-production.up.railway.app/api/avatar/v3/generate`
- Current live probe result:
  - `POST /api/avatar/v3/generate` -> HTTP 404
- The existing avatar route still responds:
  - `POST /api/avatar` without a file -> HTTP 400 `{"stage":"no_file"}`
- That means the V3 frontend was wired to an unavailable generation route, while the legacy engine route remained live.

## Fix Applied
- Added V3-only generation helpers near the Avatar Studio runtime.
- Avatar Studio now:
  - verifies the Arena/Supabase identity before saving,
  - uses the working legacy `POST /api/avatar` engine first,
  - sends the legacy identity fields only to the legacy route,
  - keeps V3 metadata (`avatar_version`, `body_type`, `style`, `source`) in the V3 flow,
  - still supports the native `/api/avatar/v3/generate` route as a fallback/override if restored later,
  - accepts both legacy response URLs and V3-style `image_url` response fields.

## Validation
- `git diff --check`: passed.
- Inline script syntax extraction with Node `new Function(...)`: passed for 24 inline scripts.
- Local server probe:
  - `http://localhost:8765/LIVE/arena.html` -> HTTP 200.
- Live avatar endpoint probes:
  - `POST https://noble-harmony-production.up.railway.app/api/avatar` without file -> HTTP 400 `{"stage":"no_file"}`.
  - `POST https://noble-harmony-production.up.railway.app/api/avatar/v3/generate` -> HTTP 404 `Cannot POST /api/avatar/v3/generate`.

## Deploy/Purge/Push
- Deploy performed: NO
- Cache purge performed: NO
- Push performed: NO

## Test URL
- Local test: `http://localhost:8765/LIVE/arena.html`

## Remaining Risk
- I did not trigger a real production avatar generation from a private student photo.
- If Brian's test image still fails after this fix, the next likely issue is the live `/api/avatar` backend generation service itself, not the V3 frontend route selection.

## Confidence
86% with the reservation that the final proof requires Brian to run one real Avatar Studio upload locally while authenticated.
