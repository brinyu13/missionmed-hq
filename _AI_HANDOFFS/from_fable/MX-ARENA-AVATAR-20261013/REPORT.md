# MX-ARENA-AVATAR-20261013 — Arena Avatar Studio forensic repair report

Author: Fable 5.1 (Claude), session `01NGJijpg2e3BDZSPUR8zT1h` · Date: 2026-10-13 (America/New_York)
Ticket worktree: `/Users/brianb/MissionMed_worktrees/MX-ARENA-AVATAR-20261013` (branch `fable/mx-arena-avatar-20261013`)
Backend repo: `/Users/brianb/Desktop/GIT_TEMP_HOLD/missionmed-avatar-v1` (GitHub `brinyu13/mmvs-avatar-service`, base HEAD `778f306` AV3-011)

## Executive status

**UPDATE 21:20 ET — `FRONTEND POLISH RELEASED + LIVE VERIFIED (r3, sha256 4d6580fa…)`: Beta banner removed, official logo across Avatar Studio surfaces, two-step avatar deletion, Download fixed, integrity check + gender toggle live on `https://missionmedinstitute.com/arena/`. Backend untouched. Live acceptance A–N: `ACCEPTANCE_FRONTEND.md`. Git commit/push pending on the founder's Mac (§11).**

**UPDATE 19:40 ET — `BACKEND FIXED + LIVE VERIFIED` (Railway deployment `a426cfd9-2bc4-4bab-a0ae-2faa7d9cc268`, commit `c5796011…`, deployed by the founder via `_fable/deploy_v2_identity.sh`). Original "Upload Your Photo" workflow PASSES on desktop + mobile with verified likeness and persistence; Download FAILS (frontend, patch staged); Beta banner NOT removed (frontend, patch staged, surface leased). Full criteria table: `ACCEPTANCE.md`.**

Original pre-deploy status: `FOUNDER ACCOUNT HYDRATED + LIVE VERIFIED (via Avatar Studio v3) · BACKEND FIX FOR LEGACY ROUTE BUILT + TESTED · DEPLOY BLOCKED AT CREDENTIAL/APPROVAL GATE · FRONTEND CANDIDATE STAGED ONLY`

| Item | State |
|---|---|
| Root cause | **VERIFIED** by live reproduction (see §2) |
| Founder's (`brinyu`, Supabase `a66fd7d3-…0294`) active Arena avatar | **LIVE, recognizable likeness, persisted**; verified after full reload (desktop + 375×812 mobile), DB-verified log `player_profiles.active_avatar_id = 14fbfb4d-bda3-46cb-9f4c-4c82f0a17735`, locker count 4 → 5 |
| Legacy `POST /api/avatar` ("Create Your Avatar" / Upload Your Photo modal) | **Still broken in production** (old build). Fix is written, syntax-checked, 12/12 harness tests pass + outage case; **not deployed** (see §6 blocker) |
| Avatar Studio `POST /api/avatar/v3/generate` | Working in production, identity-preserving (OpenAI gpt-image edit, `input_fidelity=high`) |
| Frontend `arena.html` | **No change deployed**. Candidate patch (Download fix + integrity check) staged for Codex; live CDN asset has **drifted from the critical-systems pin** (see §7) |
| Ownership lease | **NOT acquired** — MMOS Lease V2 keeper requires `MMOS_LEASE_SUPABASE_SERVICE_ROLE_KEY`, unavailable to this session; the avatar service repo is also outside every registered PRODUCT/PATH mapping. No protected path in `missionmed-hq` or the CDN was mutated. |

## 1. Pipeline map (as found, production)

```
source file (browser)
 → v2 modal: canvas center-weighted square crop, max 1024 px, JPEG ≤1 MB (preprocessAvatarFile)      | v3 modal: file validated (JPG/PNG/HEIC ≤8 MB, ≥512 px short side), sent as-is
 → preview <img> from blob: URL                                                                         | preview from blob: URL
 → multipart POST (field `photo`) — v2 adds gender,user_id,wp_user_id,username,display_name,avatar_id,source | v3 sends gender, body_type, style, photo only
 → no auth on the avatar service (CORS locked to missionmedinstitute.com + cdn)                         | same
 → Railway service noble-harmony (project mmvs-avatar-production, env production), source server.js (local HEAD 778f306)
 → sharp normalize → PNG; >15 MB re-encoded 2048 px JPEG                                                | HEIC→PNG, sharp normalize, size/dimension gates
 → R2 PUT avatars/source/<user_id>/<uuid>.png (PUBLIC bucket, unguessable key)                          | R2 PUT avatars/avatar-v3/source/<ts>-<uuid>.png
 → AVATAR_PIPELINE=replicate: Replicate FLUX (REPLICATE_MODEL_FLUX, default flux-kontext-pro)          | AVATAR_V3_PROVIDER=openai: OpenAI /v1/images/edits gpt-image-1.5 1024×1536 medium, input_fidelity=high, server-owned 18-prompt matrix (+ Railway env overrides AVATAR_V3_PROMPT_*)
      input sent as {image:<url>, prompt:<AVATAR_PROMPT_FORTNITE>, output_format} ← BUG (§2)            | then Replicate background removal (REPLICATE_MODEL_BGREMOVER)
   on failure → OpenAI 3-step composite (face edit + text-only body + sharp composite)                   |
 → R2 PUT avatars/generated/<user_id>/<ts>-<uuid>.png → {success, avatar_url, provider}                | R2 PUT avatars/avatar-v3/generated/… → {success, avatar_version:'v3', …, provider}
 → frontend: persistAvatarRecord (Supabase RPC upsert_user_avatar_record) → persistActiveAvatarSelection (set_active_user_avatar) → hydrateAvatarState refetch → "Avatar ready! Character unlocked." (Download / Use Avatar)   | frontend: persistAvatarV3Record → locker insert → "Use This Avatar" → set_active → hydrate
 → display: #arena-avatar lobby stage, nav thumbnail, Avatar Locker; Supabase project fglyvdykwgbuivikqoah tables user_avatars / player_profiles (self-only RLS)
```

Frontend endpoint constants (live `arena.html`, lines ~6429): `AVATAR_API_ENDPOINT = https://noble-harmony-production.up.railway.app/api/avatar`, `AVATAR_V3_API_ENDPOINT = …/api/avatar/v3/generate`. The v3 flow silently falls back to the v2 endpoint on 404/"Cannot POST" (`getAvatarV3GenerationEndpoints`) — not triggered today (v3 is live) but it is a latent path to the broken engine.

## 2. Root-cause matrix

| # | Finding | Status | Evidence |
|---|---|---|---|
| 1 | The flow in the founder's screenshots ("Photo optimized to 1024×1024 … Confirm", "Avatar Ready", "Character Unlocked", Download/Use Avatar) is the **legacy v2 modal** (`#arenaAvatarModal`, "Create Your Avatar"/"Upload Your Photo"), not the 5-step Avatar Studio v3 modal | VERIFIED | strings at live arena.html L10842, L10299-10302, L5630 |
| 2 | Live `POST /api/avatar` returns `provider:"replicate"` in ~10 s and a generic bearded doctor for the founder's photo | VERIFIED | `evidence/02_*`, `repro_v2_response.json` |
| 3 | The same route returns **another generic male doctor for a non-face magenta/green test image with `gender=female`** → the reference photo and gender have **no influence**; the route is effectively text-to-image | VERIFIED | `evidence/03_*`, `03a_*`, `probe_v2_response.json` |
| 4 | Cause in code: `generateAvatarWithReplicate()` sends the reference as `image:` (server.js L1211-1215). FLUX Kontext models define `input_image` (the server's own v3 builder uses `input_image`/`input_images`); Replicate ignores the unknown field so the model runs text-only from `AVATAR_PROMPT_FORTNITE`. The `input_image` retry only fires if Replicate's error text mentions it, which it does not. The v2 backend also never reads `gender`. | VERIFIED (code) + consistent with 2–3; exact Railway env values not inspected (no Railway access) | server.js L1196-1231 |
| 5 | Live `POST /api/avatar/v3/generate` returns `provider:"openai"`, ~24 s, recognizable likeness of the founder | VERIFIED | `evidence/04_*`, `v3_resp.json` |
| 6 | Last known-good identity behavior = Avatar Studio v3 OpenAI high-fidelity edit (backend commits AV3-006 "switch Avatar Studio to high-fidelity OpenAI edits" … AV3-011, 2026-05-28); the legacy route was never migrated to it | LIKELY (git reflog of backend repo; commit dates) | `.git/logs/HEAD` |
| 7 | Deployed Railway code = local HEAD 778f306: response shapes of both routes match the local source exactly (`prompt_source`, `prompt_env_key`, `credits.reason`, `active_avatar_supported`) | LIKELY | live responses vs source |
| 8 | Frontend preview ≙ bytes sent (preprocessAvatarFile output is both previewed and uploaded) | VERIFIED by code read; no checksum existed (added in fix) | arena.html L9937-10000 |
| 9 | Legacy modal defaults to **Female** (`arenaAvatarGenderFemale` active) — the founder's broken record is stored `gender=female`; backend ignored it anyway | VERIFIED | arena.html L5595-5598; locker tile "FEMALE · 10/13/2026 5:58:43 PM" |
| 10 | Frontend Download: `<a download="missionmed-avatar.jpg">` pointing at a cross-origin CDN PNG → browsers ignore `download` cross-origin (navigates away) and the extension is wrong | LIKELY (code read; not click-tested to avoid leaving the authenticated page) | arena.html L10449-10457 |
| 11 | Frontend v2 "safe fallback": when generation fails, the **raw uploaded photo** is stored and shown as the avatar ("Avatar ready. Saved with safe fallback.") | VERIFIED (code) | arena.html L10598-10700 |
| 12 | No authentication on the avatar service endpoints; source photos stored in the public R2 bucket under unguessable UUID keys (both routes) | VERIFIED | server.js (no auth middleware); R2 keys |
| 13 | Live CDN `html-system/LIVE/arena.html` SHA-256 `bd44e33f…7444c` ≠ critical-systems pin `19a519f5…cb12a` (last-modified 2026-10-12 11:04 UTC); no exact-match commit in `missionmed-hq` (closest: MM-SPEED-HOME-011 / MM-DRILLS-V3-SCHEDULE-BACKFILL-062 at 972,893 B vs 975,617 B live) | VERIFIED | `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json`, curl |

Determinism: 3/3 live v2 calls produced unrelated generic characters (two with the founder photo pre-processed exactly like the browser, one with the non-face probe) → deterministic, not intermittent.

## 3. Repair (backend `server.js`, additive, not yet deployed)

Candidate `server.js` SHA-256 `bf95d8d0a945b2e734c8f15f9d04c127ed165ef665363656ebd627796e62f71c` (base `d8e7bce16a85d897520bbaa87221cf6fcfd7cfa5a8bea21bba930eff5e667d4b`). Diff: `backend/server.js.MX-ARENA-AVATAR-20261013.patch` (~400 lines). Already written into the backend repo folder on the Mac (uncommitted) together with `test/` and `_fable/`.

- `AVATAR_V2_ENGINE` (default **`identity`**): `/api/avatar` generation now uses `generateAvatarV3WithOpenAI` (or the v3 Replicate builder if `AVATAR_V3_PROVIDER=replicate`) + the same Replicate background removal as v3. Prompt set = request `gender` + `AVATAR_V2_DEFAULT_BODY_TYPE` (athletic) + `AVATAR_V2_DEFAULT_STYLE` (doctor); optional `body_type`/`style` honored when valid.
- Gender validated **before** the photo is stored (400 `avatar_v2_invalid_gender`, nothing persisted).
- **No silent cross-engine fallback**: provider failure → HTTP error `{success:false, stage, message}` (fail visible). Legacy engines only via explicit `AVATAR_V2_ENGINE=replicate` (field corrected to `input_image`/`input_images`) or `openai_composite`.
- Integrity/telemetry in both routes: `source_photo_sha256`, `source_photo_bytes`, `engine`, `identity_conditioned`, `model`, `prompt_set_id`, `generation_latency_ms`, `build`; logs carry hashes/keys/latency only (source URL and `avatarUrl` log lines removed).
- `GET /api/avatar/health` (non-secret build + engine config) for deployment verification.
- Response contract preserved (`success`, `avatar_url`, `provider`) — the live frontend needs no change to benefit.

Tests (`backend/test/`, local harness with fake R2 + intercepted OpenAI/Replicate, no secrets, no spend): **12/12 pass** — health, no-file 400, invalid gender 400 with zero R2 writes, identity generation success with SHA/bytes correlation + prompt-set + storage key, provider called with reference bytes and identity prompt and **no text-only generations call**, generated URL resolves, 3 s rate limit 429, body/style honored and invalid → defaults, direct-upload passthrough preserved, v3 route unchanged + integrity fields, v3 forbidden field 400. Outage case (`HARNESS_OPENAI_FAIL=1`): **503 `avatar_v3_openai_generate`**, 0 text-only calls, 0 Replicate calls, no photo bytes/base64 in logs.

Not exercised against a real provider: the candidate build itself (needs the Railway deploy, §6). The generator it calls is the unchanged live v3 code path, which was exercised live 4× today (§4).

## 4. Acceptance evidence (live, identity engine = v3 route, same generator the fix uses)

| Test | Result |
|---|---|
| Founder photo, browser-equivalent 1024² JPEG, male/athletic/doctor | recognizable likeness (hair, skin tone, face shape, build) — `evidence/04_*` |
| Founder photo through the **real Avatar Studio UI** in the authenticated built-in browser (file → 5 steps → Generate → Use This Avatar) | "Avatar added to your locker" → "Active avatar updated." — `evidence/05_*`; persisted after reload on desktop and 375×812 mobile — `evidence/06/07/08_*`; console `[AVATAR_DB_VERIFIED] player_profiles_active_avatar_id = 14fbfb4d-…` on a fresh page load |
| Wide frame (face ≈6 % of a 1600×1200 canvas) | recognizable — `evidence/09_*` left pair |
| EXIF orientation 6 (stored rotated) | upright, recognizable — `evidence/09_*` right pair |
| Malformed JPEG | v3 415 `image_normalize`; v2 (old build) 415 — no false success |
| Oversized (17 MB PNG) | v3 413 `avatar_v3_file_too_large` |
| Too small (300 px) | v3 422 `avatar_v3_image_too_small` |
| Invalid style | v3 400 `avatar_v3_invalid_style` |
| Rate limit (<3 s) | 429 (harness, same code live) |
| Provider outage | 503, no stock avatar (harness) |
| Repeatability | 4 live generations from the same person (3 framings) all recognizable; stylization varies (scrubs color, pose) |
| Privacy/telemetry | candidate logs: hashes, keys, byte counts, latency only; existing v2 records untouched (locker 4 → 5 rows, nothing deleted); RLS self-only unchanged |

Not done / pending: a **diverse multi-person consented test set** (different skin tones, hair, glasses, facial hair, lighting). Only the founder's consented photo was available; synthetic-face generation tools were not available in this session. The engine's identity prompt and `input_fidelity=high` are the same for all inputs, but this remains **visual-fidelity acceptance pending** for other faces. Founder side-by-side review of `evidence/04`, `05`, `09` is also required by the release gate.

## 5. Release gate (per mission §5)

- Real generation produced an unrelated person → **BLOCK for the legacy route until the backend candidate is deployed**; Avatar Studio v3 passes.
- Reference conditioning verified → v3 yes; v2 candidate yes (harness) / live no (old build).
- Source photo leakage → none observed in candidate logs; existing public-bucket storage of source photos is a pre-existing design (§8).
- Cross-account access → not tested beyond RLS/self-only reads observed in console (`avatar.hydrate.*` with the user's own id); no student accounts were touched.
- Download/Use Avatar → Use Avatar (v3) verified live; Download (v2) LIKELY broken cross-origin, candidate patch staged.

## 6. Deployment — exact blocker and ready-to-execute handoff

Blocker: the Railway deploy must run with Brian's Railway CLI login. This session could not (a) read `~/.railway` (folder access denied by policy), (b) drive Finder/Terminal to launch the prepared script (computer-use action denied by policy as a production deploy), (c) use the MMOS lease keeper (no service-role credential). One concrete next action — **on the Mac, in Terminal:**

```bash
bash ~/Desktop/GIT_TEMP_HOLD/missionmed-avatar-v1/_fable/deploy_v2_identity.sh
```
(or double-click `_fable/RUN_DEPLOY.command`). The script: syntax-checks the candidate, confirms `railway whoami`/`railway status` is linked to **noble-harmony**, commits the candidate on branch `fable/mx-arena-avatar-20261013-v2-identity` (prior HEAD saved to `_fable/ROLLBACK_TARGET_COMMIT.txt`), runs `railway up --detach --ci`, polls `GET /api/avatar/health` until `build = MX-ARENA-AVATAR-20261013_V2_IDENTITY_ROUTE`, and writes `_fable/deploy_log_<ts>.txt` + `_fable/release_receipt_<ts>.json`. If `railway` reports not logged in or not linked: `railway login`, then `railway link` → mmvs-avatar-production / production / noble-harmony, re-run. No Railway env changes are needed.

Post-deploy verification (Fable can run these on request): `curl https://noble-harmony-production.up.railway.app/api/avatar/health` shows the build; one `POST /api/avatar` with a consented photo returns `engine:"identity_openai"`, `identity_conditioned:true`, `source_photo_sha256` equal to the local `sha256sum` of the sent file, and a recognizable PNG; then an authenticated "Upload Your Photo" run in Arena.

Rollback: `bash _fable/rollback_v2_identity.sh` (redeploys `778f306`; health route returns 404 again), or Railway dashboard → noble-harmony → Deployments → redeploy previous. Prior deployment stays available in Railway history.

## 7. Frontend (not deployed — staged candidate only)

`frontend_candidate/arena_frontend_candidate.patch` against the **live CDN bytes** (SHA-256 `bd44e33f…`): Download fetches the asset and saves a same-origin blob with the real extension (fallback: open in new tab); the v2 flow verifies `source_photo_sha256` against the bytes it sent and refuses `identity_conditioned:false`. All 26 inline scripts parse after the patch. Not deployed because: the live asset already drifted from the critical-systems pin (`19a519f5…`) with no exact source commit, the deploy script pushes stat/drills/daily from the stale repo `LIVE/` too, and an active Arena mission (MX-IVPREP-LIVE-ARENA-20261012) holds the surface. Requires: source reconciliation (live bytes → committed source), manifest pin update via decision record, single-file deploy, Kinsta/CDN purge.

Recommended frontend follow-ups (not patched): remove the raw-photo "safe fallback" (stores the user's photo as the avatar on failure); make the gender choice explicit instead of defaulting to Female; route the legacy modal's primary CTA into Avatar Studio or retire the v2 modal once the backend fix is live; drop the v3→v2 endpoint fallback.

## 8. Remaining limitations / founder decisions

1. Deploy the backend candidate (one Terminal command, §6) — until then "Upload Your Photo" still produces stock characters.
2. Visual-fidelity acceptance for faces other than the founder's needs consented photos (or a synthetic set) — pending.
3. Keep or delete the generic record `4bc3f0b3-ad87-4164-8cc5-b301817c5100` (and 3 earlier v2 records) in the founder's locker — preserved per no-destructive-ops rule.
4. Pre-existing design risks to schedule: no auth on the avatar service (anyone can spend generations); source photos in the public bucket; MatchPoints credits not enforced (`credits.enforced:false`); legacy modal default gender.
5. Governance: no MMOS lease was obtainable from this session; register/lease this work through the canonical keeper before Codex continues. Live CDN arena.html drift vs the critical pin should be reconciled by the Arena surface owner.
6. Test artifacts created today under `avatars/source/fable-repro/`, `avatars/generated/fable-repro/` (3 objects) and `avatars/avatar-v3/*` (4 source + 4 generated + background-source objects) plus the direct-upload copy of the founder photo `avatars/source/a66fd7d3-…/2fb00087-…png` — no delete path exists in the service; list provided for cleanup.

## 9. Files

- `REPORT.md` (this), `evidence/` (contains the founder's likeness — private), `backend/` (candidate, patch, tests, deploy/rollback scripts, CHANGES.md), `frontend_candidate/`.
- Mac: `~/Desktop/GIT_TEMP_HOLD/missionmed-avatar-v1/{server.js, test/, _fable/}` (uncommitted until the deploy script commits).

## 10. Addendum (19:07 ET) — Arena "Beta Preview" banner removal

Identified: `ensureArenaBetaUi()` (live arena.html L16051) creates `#arenaBetaPreviewBanner` unconditionally on `init()` and on every access-state hydration (`applyArenaAccessStateToLobby`/`syncArenaTrialCounters`), hence it returns after refresh, login, mobile, avatar generation and navigation; no storage flag or timer exists. Introduced in commit `35daab7` (2026-05-30). Patch `frontend_candidate/arena_beta_banner_removal.patch` (4 hunks: 2 CSS blocks, creator function → removal-only, stale copy in the locked-mode modal) verified offline in headless Chromium at 1440×900 and 375×812: banner absent, lobby init intact, 0 page errors. **NOT deployed** — the Arena frontend is leased to MX-IVPREP-LIVE-ARENA-20261012 and the live asset is off its critical pin; see `frontend_candidate/BETA_BANNER_REMOVAL.md` for the owner's deploy/verify steps. Still visible to students until the owner ships it.

## 11. Addendum (21:20 ET) — Frontend polish release (founder directive 20:05 ET)

**Status: RELEASED and verified live.** Single-surface release of `html-system/LIVE/arena.html` (+ one immutable brand asset) through `release/deploy_arena_single_surface.sh`, executed from the device VM after replacing the VM's old-curl SigV4 path with a stdlib Python signer (`release/r2_sigv4.py`). Three iterations, each sha-gated against the previous live bytes:

| Rel | sha256 | Why |
|---|---|---|
| r1 00:48Z | `4caa7d90…` | the reviewed candidate |
| r2 01:04Z | `a1d76893…` | live test found Escape/backdrop bubbling to document-level handlers that also closed the Avatar Locker → capture-phase handler scoped to the open dialog |
| **r3 01:09Z** | **`4d6580fa…`** | live test found "Try again" inert after a failed delete (confirmation promise already consumed) → dialog re-armed after failure; harness extended (15/15) |

Live acceptance (founder's account only, one disposable record created and then deleted, founder's active avatar restored to `14fbfb4d…`): **A–N all PASS** — see `ACCEPTANCE_FRONTEND.md`; screenshots `evidence/frontend_live/A–M`. Download (previously criterion 10 FAIL) is now PASS. Backend: untouched (`health` build/start time unchanged).

Source control: worktree holds r3 bytes, manifest pin `cdn_arena_live = 4d6580fa…` and the CHANGELOG entry, all **uncommitted** (VM cannot clear git lock files or push). One command on the Mac finishes it: `bash …/release/git_reconcile_and_commit.sh` (see `ACCEPTANCE_FRONTEND.md`). Registry filing (missions.json / DR) remains with the Foreman/Codex registrar; `release/DECISION_NOTE_frontend_release.md` is the packet.

### Remaining issues / recommendations
1. **Face-presence gate** on the avatar service (non-face input still yields an invented person) — backend change, deliberately not deployed.
2. Source photos stored in the public R2 bucket under unguessable keys (pre-existing design); consider private bucket + signed URLs.
3. No auth on the avatar service (CORS-only); MatchPoints not enforced server-side.
4. Avatar deletion removes the DB row only; the generated PNG stays on the CDN (pre-existing; a storage-cleanup job is the right place for it).
5. The legacy v2 flow auto-activates the newly generated avatar during generation (pre-existing behaviour, documented in criterion 8).
6. Test artifacts to clean up when convenient: `avatars/generated/fable-acceptance/*`, `avatars/source/fable-acceptance/*` on R2; CDN PNG of the deleted disposable record `c8c17962…`; `release/receipts/arena.html.LIVE_PRE_*` copies; `.git/worktrees/MX-ARENA-AVATAR-20261013/stale-index-lock-fable-20261013`.
7. Second-reviewer spot check recommended for acceptance items H/J/K (builder = verifier).
