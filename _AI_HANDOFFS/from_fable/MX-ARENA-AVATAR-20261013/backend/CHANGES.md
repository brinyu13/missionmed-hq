# MX-ARENA-AVATAR-20261013 — avatar backend change summary

Service: Railway project `mmvs-avatar-production`, service `noble-harmony`
(`https://noble-harmony-production.up.railway.app`). Repo: this folder
(`brinyu13/mmvs-avatar-service`), base commit `778f306` (AV3-011).

## Root cause (verified live 2026-10-13)
`POST /api/avatar` (Arena "Create Your Avatar" modal) ran the legacy Replicate
FLUX engine with the reference photo in the `image` field. FLUX Kontext models
define `input_image`, so the photo was ignored and the model generated a
text-only generic character from `AVATAR_PROMPT_FORTNITE`; the route still
answered `success:true`. A non-face probe image (and `gender=female`) returned
the same generic male doctor.

## Fix (server.js only, additive)
- New env `AVATAR_V2_ENGINE` (default `identity`): `/api/avatar` generation now
  uses the proven Avatar Studio v3 identity-preserving engine
  (`generateAvatarV3WithOpenAI` + Replicate background removal, same as
  `/api/avatar/v3/generate`). Prompt set = request `gender` +
  `AVATAR_V2_DEFAULT_BODY_TYPE` (athletic) + `AVATAR_V2_DEFAULT_STYLE` (doctor);
  optional `body_type`/`style` form fields are honored when valid.
- Gender is validated BEFORE the photo is stored (invalid -> 400, nothing persisted).
- No silent cross-engine fallback: provider failure -> HTTP error with `stage`.
- Legacy engines only by explicit opt-in: `AVATAR_V2_ENGINE=replicate`
  (reference field corrected to `input_image`/`input_images`) or `openai_composite`.
- Integrity/telemetry: `source_photo_sha256`, `source_photo_bytes`, `engine`,
  `identity_conditioned`, `model`, `prompt_set_id`, `generation_latency_ms`,
  `build` in v2 and v3 responses; logs carry hashes/keys/latency only (no photo
  bytes, no source URLs).
- `GET /api/avatar/health` (non-secret) for deployment verification.
- Response contract for the Arena frontend is preserved (`success`, `avatar_url`, `provider`).

## Local verification (harness, no secrets)
`test/run_local.sh` + `test/v2_identity_route.test.sh`: 12/12 pass; provider
outage case returns 503 with no text-only generation and no stock avatar.

## Deploy / rollback
`_fable/deploy_v2_identity.sh` (railway up + health gate + receipt),
`_fable/rollback_v2_identity.sh` (redeploy prior commit).
No Railway env changes are required; defaults activate the identity engine.
