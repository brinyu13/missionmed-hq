# MX-ARENA-AVATAR-20261013 — Production acceptance (post backend deploy)

Date: 2026-10-13 19:24–19:40 ET · Verifier: Fable 5.1 (same session that built the fix — see §4 independence note)
Backend: Railway `mmvs-avatar-production` / `noble-harmony` / production, deployment `a426cfd9-2bc4-4bab-a0ae-2faa7d9cc268`, commit `c57960117c7eba427f0b1bd9fbd6bd4431d4d6e1`
`GET /api/avatar/health` → build `MX-ARENA-AVATAR-20261013_V2_IDENTITY_ROUTE`, `v2_engine: identity`, `v3_provider: openai`, `gpt-image-1.5`, `1024x1536`, `input_fidelity: high`, `background_removal: replicate` (started 23:09:37 UTC).
Account under test: the founder's own (`brinyu`, Supabase `a66fd7d3-c924-4369-be6a-e39c35660294`), authenticated built-in browser. No student accounts touched.

## 1. Criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `POST /api/avatar` with a consented reference photo | **PASS** — HTTP 200 in 25.8 s, `provider: openai`, `engine: identity_openai`, `prompt_set_id: avatar_v3_male_athletic_doctor`, 1024×1536 RGBA PNG | `evidence/10_live_fixed_v2_api_response.json` |
| 2 | Returned image preserves recognizable facial identity | **PASS** (human review: hair, skin tone, face shape, build all read as the founder) | `evidence/11_*` (left) |
| 3 | `identity_conditioned:true` + SHA-256 match | **PASS** — response `source_photo_sha256 = 251a4597…4a72`, `source_photo_bytes = 132099`; local `sha256sum founder_ref_1024.jpg` = `251a4597…4a72`, 132,099 B | §1 of this file + response JSON |
| 4 | Open the real authenticated Matrix Arena | **PASS** — `https://missionmedinstitute.com/arena`, logged in as brinyu, lobby + Avatar Locker | `evidence/12_*` |
| 5 | Execute the ORIGINAL "Upload Your Photo" workflow | **PASS** — Profile → Upload Your Photo → file chosen → "Photo optimized to 1024x1024 (123.7 KB). Confirm if this looks good." → Looks Good → "Photo confirmed. Ready to generate." → Generate Avatar. (The only step not driven by a physical click is the OS file picker; the file was set on the real `#avatarFileInput` and the page's own `change` handler ran.) | `evidence/12_*`, `13_*` |
| 6 | Generation succeeds | **PASS** ×2 (desktop 19:29 ET, mobile 19:32 ET) — "AVATAR READY · CHARACTER UNLOCKED · Avatar ready! Character unlocked." | `13_*`, `18_*` |
| 7 | Generated avatar resembles the uploaded photo | **PASS** — both UI runs | `14_*` (desktop crop), `18_*` (mobile) |
| 8 | Use Avatar, DB persistence, reload | **PASS** — Use Avatar → toast "Avatar applied.", nav thumbnail switched; after full reload `[AVATAR_DB_VERIFIED] active_avatar_id = 1105b204-efff-4d8f-bd75-3592c1da0b3c = player_profiles.active_avatar_id`, `avatar_count 8`; desktop run persisted as `0c890863-…` (count 7). The v2 flow commits the record and the active selection *during* generation (`persistAvatarRecord` → `persistActiveAvatarSelection` → refetch) before the Done step, so the avatar is persisted even if the student only closes the modal. | `16_*`, `19_*`, console logs |
| 9 | Desktop and mobile behaviour | **PASS** — desktop 1440×900 and mobile 375×812 (Android-UA emulation): modal, preview, generate, Use Avatar, lobby render after reload all correct | `12–19_*` |
| 10 | Download Avatar | **FAIL (pre-existing frontend defect, unchanged)** — clicking Download navigated the Arena tab to the raw CDN PNG (`cdn.missionmedinstitute.com/avatars/generated/…png`) instead of saving a file: cross-origin `<a download>` is ignored by browsers, and the hard-coded name is `.jpg` for a PNG. Fix is in `frontend_candidate/arena_frontend_candidate.patch` (fetch → same-origin blob → `missionmed-avatar.png`, fallback new tab); not deployable from this session (surface leased). | `15_*` |
| 11 | No generic fallback | **PASS with one caveat** — the deployed route has no cross-engine fallback (a provider error returns `success:false`, verified in the harness; live outage not simulated). Caveat: a non-face input (magenta/green shapes, `gender=female`) still returns `success:true` with an *invented* female doctor — the identity engine edits whatever it is given and has no face-presence gate. For real face photos this does not occur; for garbage input the student gets a plausible stranger rather than an error. Follow-up (not deployed, per "DO NOT REDEPLOY"): add a server-side face-presence check (e.g. one vision call) returning 422 `avatar_reference_no_face`, plus the frontend candidate's integrity/identity checks. | `11_*` (right), `11a_*` |
| 12 | Preserve existing avatars and student records | **PASS** — founder locker grew 4 → 8 (all earlier records intact: 4 pre-existing v2, `14fbfb4d` v3, `d5be1ee5` founder's own run, `0c890863`, `1105b204`); no deletes, no RLS/RPC changes, no other user touched. | console `avatar_count` series |

## 2. Additional live observations

- **Founder's own post-deploy run** (record `d5be1ee5-…`, ~19:15 ET, before this acceptance) produced a **feminized** version of the founder: the legacy modal defaults the Character Base to **Female**, and "Upload Your Photo" goes straight to the file picker, so the choice is never shown. The old backend ignored gender; the fixed backend honors it, which makes this default visible. Frontend candidate hunk (verified offline): move the gender toggle into the preview step so it is seen before "Looks Good".
- Each UI run stores the source photo publicly under `avatars/source/<user_id>/…` (pre-existing design).
- Beta banner still visible on desktop and mobile (frontend not deployed — see `frontend_candidate/BETA_BANNER_REMOVAL.md`).
- Test objects created in this phase: `avatars/generated/fable-acceptance/` (2), `avatars/source/fable-acceptance/` (2), background-source objects, plus the founder's two UI records.

## 3. Verdict

**Original student-facing "Upload Your Photo" workflow: PASS on desktop and mobile with verified likeness and persistence. Download: FAIL at the time of this pass → PASS after the frontend release (`ACCEPTANCE_FRONTEND.md` M). Beta banner: NOT REMOVED at the time of this pass → REMOVED by the frontend release (r1 00:48Z, verified through r3).** Backend status: **FIXED + LIVE VERIFIED**. Visual-fidelity acceptance remains founder-reviewed for the founder's face only; other faces pending a consented set.

## 4. Independence note

Builder and verifier are the same session (MMOS independence law not met). Evidence is reproducible by the Arena surface owner from this file: health URL, API command (`curl -F photo=@<file> -F gender=male https://noble-harmony-production.up.railway.app/api/avatar`), and the UI steps above.
