# AV3-002-d Avatar v3 Backend Smoke Report

RESULT: WORKED

## Summary
- Diagnosed the Avatar Railway backend local startup issue on `av3/avatar-backend-v3-generate-002-c`.
- Root cause: top-level ESM imports for generation/storage libraries delayed `server.js` startup before the app reached `app.listen`.
- Fixed startup by lazy-loading heavy generation/storage modules only when request paths need them.
- Preserved existing `/api/avatar` v2 behavior and kept `/api/avatar/v3/generate` additive.
- Revalidated backend startup, v2 route presence, v3 validation boundaries, frontend v3 payload shape, Supabase migration safety, and local UI flow.

## Branches
- Backend branch: `av3/avatar-backend-v3-generate-002-c`
- Frontend branch: `av3/profile-locker-v3-parallel-002`
- Protected baseline branch exists: `av3/avatar-backend-v2-baseline-capture-002-c`
- Protected baseline commit confirmed: `60bb3a2`

## Git Status
- Backend status before: `M server.js`
- Frontend status before: `M LIVE/arena.html`, untracked `_AI_HANDOFFS/`, untracked `supabase/migrations/20260507193500_avatar_v3_metadata_additive.sql`
- Backend status after validation, before commit: `M server.js`
- Frontend status after validation, before commit: `M LIVE/arena.html`, untracked `_AI_HANDOFFS/`, untracked migration

## Backend Startup Diagnosis
Initial smoke command:

```bash
PORT=4194 npm start
```

Observed:
- Process remained alive after 8 seconds.
- No process was listening on the test port.
- stdout contained only the npm start wrapper.
- stderr was empty.
- No `server.js` startup logs appeared.

Import timing probe showed the app was blocked before executing server body code:
- `express`: 22089 ms
- `cors`: 949 ms
- `multer`: 15156 ms
- `sharp`: 38710 ms
- `heic-convert`: 28386 ms
- `@aws-sdk/client-s3`: 113612 ms
- `@imgly/background-removal-node`: 20387 ms
- `replicate`: 14359 ms
- Total before request code could execute: 253649 ms

Diagnosis: not an env-var failure, route-registration failure, or health-route issue. The local process was alive but stuck in slow top-level ESM dependency loading.

## Startup Fix
Changed `server.js` to lazy-load these modules:
- `sharp`
- `heic-convert`
- `@aws-sdk/client-s3`
- `@imgly/background-removal-node`
- `replicate`

Preserved route behavior by loading each dependency at the same use site:
- R2 upload path loads AWS S3 client lazily.
- image normalization/composite paths load `sharp`/`heic-convert` lazily.
- background-removal helper loads `@imgly/background-removal-node` lazily.
- Replicate generation path loads `replicate` lazily.

Post-fix startup commands:

```bash
R2_ACCESS_KEY_ID=dummy R2_SECRET_ACCESS_KEY=dummy R2_BUCKET=dummy R2_ENDPOINT=https://example.invalid R2_PUBLIC_BASE=https://cdn.example.invalid PORT=4197 node server.js
```

Result: listened in `0.457s`.

```bash
R2_ACCESS_KEY_ID=dummy R2_SECRET_ACCESS_KEY=dummy R2_BUCKET=dummy R2_ENDPOINT=https://example.invalid R2_PUBLIC_BASE=https://cdn.example.invalid PORT=4198 npm start
```

Result: listened in `0.832s`.

Dummy env values were used only to avoid R2 config failure during no-generation route validation. No production secrets were used.

## v2 Route Validation
- Existing route remains registered: `POST /api/avatar`
- Safe no-file request with dummy R2 env returned:

```json
{"stage":"no_file"}
```

- This confirms the v2 handler is reachable without triggering Replicate/OpenAI/R2 generation.
- Existing `/api/avatar` route name, response shape for no-file validation, v2 storage key logic, and v2 generation selection logic were not replaced.

## v3 Route Validation
Route: `POST /api/avatar/v3/generate`

Validated responses:
- invalid `gender` -> `400 avatar_v3_invalid_gender`
- invalid `body_type` -> `400 avatar_v3_invalid_body_type`
- invalid `style` -> `400 avatar_v3_invalid_style`
- browser-supplied `prompt` -> `400 avatar_v3_forbidden_field`
- browser-supplied `negative_prompt` -> `400 avatar_v3_forbidden_field`
- browser-supplied `model_slug` -> `400 avatar_v3_forbidden_field`
- browser-supplied `user_id` override -> `400 avatar_v3_forbidden_field`
- valid enums without photo -> `400 avatar_v3_no_photo`

This confirms valid enum payloads reach the safe v3 handler path without requiring frontend prompt text or model selection.

## Prompt Config Validation
- Server-side `AVATAR_V3_PROMPT_SETS` exists.
- Prompt matrix count: `18`.
- Startup guard enforces exactly 18 prompt sets.
- Prompt construction remains server-side.
- Frontend does not send prompt, negative prompt, Replicate model slug, storage path, or user override fields for Avatar v3.

## Secret Exposure Validation
- `LIVE/arena.html` and the Avatar v3 migration contain no `REPLICATE_API_TOKEN`, R2 secret keys, Supabase service-role keys, or forbidden old Supabase project reference.
- Backend references Replicate/R2/Supabase secrets server-side only.
- No service-role value was moved to browser code.

## Frontend Payload Validation
Local UI smoke intercepted the Avatar v3 request body. Captured keys:

```json
["gender","body_type","style","photo"]
```

Captured values:

```json
{
  "gender": "female",
  "body_type": "athletic",
  "style": "superhero",
  "photo": {
    "name": "avatar-v3-desktop.png",
    "type": "image/png",
    "size": 250912
  }
}
```

Forbidden v3 keys captured: `[]`.

Existing Avatar v2 code still sends v2-only fields such as `user_id` to the existing `/api/avatar` route; that path was intentionally preserved and not treated as Avatar v3 payload.

## Supabase Migration Safety
Migration checked:

`/Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-clean/supabase/migrations/20260507193500_avatar_v3_metadata_additive.sql`

Result:
- Additive columns only.
- No deletes.
- No v2 record migration.
- No RLS changes.
- No anon grants.
- No old Supabase project reference.
- Not applied to production.

Rollback note: do not apply this migration until deployment approval. If applied and rollback is required, disable v3 first, then remove the additive nullable v3 metadata columns/constraints only after confirming no v3 records need those fields.

## Local UI Smoke
In-app Browser Use:
- Local file opened, but DOM inspection against `file://` was blocked by browser security policy.
- Local HTTP target then opened; unauthenticated runtime correctly showed auth-required overlay.

Headless local Chrome smoke:
- Local server: `http://127.0.0.1:4178/LIVE/arena.html`
- Fake local Supabase/auth layer used, no real credentials.
- Avatar v3 generation response mocked locally, no live Replicate/R2/Supabase side effects.
- `Avatar Studio` button visible.
- Existing `Upload Your Photo` v2 button visible.
- Avatar Studio opened.
- Gender/body/style steps worked.
- Upload step enforced disabled Next before photo.
- 512px+ PNG upload accepted.
- Summary screen showed selected choices.
- Progress/success path completed after mocked backend response.
- New v3 avatar was inserted into locker state.
- `Use This Avatar` worked against fake local Supabase active-avatar stub.
- Mobile overflow check: `false`.
- Screenshots:
  - `/tmp/avatar-v3-d-smoke-desktop.png`
  - `/tmp/avatar-v3-d-smoke-mobile.png`

## Files Modified
Backend:
- `/Users/brianb/Desktop/GIT_TEMP_HOLD/missionmed-avatar-v1/server.js`

Frontend/migration/report:
- `/Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-clean/LIVE/arena.html`
- `/Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-clean/supabase/migrations/20260507193500_avatar_v3_metadata_additive.sql`
- `/Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-clean/_AI_HANDOFFS/from_codex/AV3-002-d_avatar_v3_backend_smoke_report.md`

## Files Intentionally Untouched
- Arena auth/login/session/exchange/bootstrap runtime.
- STAT files and logic.
- Drills.
- Daily Rounds.
- VIDEO_SYSTEM.
- WooCommerce.
- LearnDash.
- WordPress login bridge.
- Avatar v2 route name and storage path conventions.
- Production Supabase schema/RLS.
- Production Railway deployment.

## Validation Commands
- `node --check server.js`
- `git diff --check` in backend repo
- `git diff --check` in frontend worktree
- local backend startup via `node server.js`
- local backend startup via `npm start`
- curl route validation against local backend
- static grep for prompt matrix, forbidden fields, frontend payload fields, secret exposure, old Supabase project references
- local headless Chrome UI smoke

## What Could Not Be Verified
- No live Replicate generation was run.
- No real R2 object was written.
- No production Supabase migration was applied.
- No authenticated real-user browser session was used.
- No Railway deploy or production route validation was performed.

## Remaining Production Blockers
- Apply Supabase migration only after approval.
- Deploy backend only after approval.
- Deploy/promote frontend only after approval.
- Run authenticated live Profile Locker validation.
- Run one safe production v3 generation or approved mocked backend path to verify real R2/CDN persistence.
- Confirm MatchPoints enforcement if/when the real credit backend is connected.

## Rollback / Disable Path
- Backend: set `AVATAR_V3_ENABLED=false` to disable `/api/avatar/v3/generate`.
- Frontend: set `window.MISSIONMED_AVATAR_V3_ENABLED=false` before frontend load or remove/hide the Avatar Studio entry point.
- V2 remains live because existing `/api/avatar`, v2 UI, v2 storage paths, v2 active-avatar selection, and v2 records were not replaced.
- Revert the Avatar v3 backend branch commit if needed; protected v2 baseline remains at `60bb3a2`.

## Confidence
- Confidence after local backend smoke, route validation, static checks, and isolated browser UI smoke: `90%`.
- To raise confidence to 95-98%: authenticated live browser validation, approved Railway deploy, safe real v3 generation, verified R2/CDN public URL, and production Supabase metadata persistence check.
