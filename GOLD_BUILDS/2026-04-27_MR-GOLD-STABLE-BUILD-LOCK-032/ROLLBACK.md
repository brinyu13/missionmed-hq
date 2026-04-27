# MissionMed Gold Stable Rollback

Gold Build: `2026-04-27_MR-GOLD-STABLE-BUILD-LOCK-032`
Source commit at lock time: `909b313`
Tag: `MR-GOLD-STABLE-2026-04-27`
CDN Gold archive base: `https://cdn.missionmedinstitute.com/html-system/GOLD_BUILDS/2026-04-27/`

## Scope
This rollback restores the canonical runtime files only:
- `arena.html`
- `stat.html`
- `drills.html`
- `daily.html`

## Local Restore (Source of Truth)
1. Confirm repository root: `/Users/brianb/MissionMed`.
2. Restore files from this snapshot:
   - `cp GOLD_BUILDS/2026-04-27_MR-GOLD-STABLE-BUILD-LOCK-032/LIVE/arena.html LIVE/arena.html`
   - `cp GOLD_BUILDS/2026-04-27_MR-GOLD-STABLE-BUILD-LOCK-032/LIVE/stat.html LIVE/stat.html`
   - `cp GOLD_BUILDS/2026-04-27_MR-GOLD-STABLE-BUILD-LOCK-032/LIVE/drills.html LIVE/drills.html`
   - `cp GOLD_BUILDS/2026-04-27_MR-GOLD-STABLE-BUILD-LOCK-032/LIVE/daily.html LIVE/daily.html`
3. Run validation:
   - `./VALIDATION/validate_deploy.sh --live-dir /Users/brianb/MissionMed/LIVE`
4. Deploy through pipeline:
   - Preferred: `PROMPT_ID=MR-GOLD-STABLE-BUILD-LOCK-032 ./_SYSTEM/deploy.sh`
   - If git gate blocks on unrelated pre-existing deploy-scope drift, resolve drift first; only then use `--skip-git-check` by explicit release decision.

## CDN Direct Rollback (Emergency)
Use existing R2 signed-copy workflow to copy from:
- `html-system/GOLD_BUILDS/2026-04-27/arena.html` -> `html-system/LIVE/arena.html`
- `html-system/GOLD_BUILDS/2026-04-27/stat.html` -> `html-system/LIVE/stat.html`
- `html-system/GOLD_BUILDS/2026-04-27/drills.html` -> `html-system/LIVE/drills.html`
- `html-system/GOLD_BUILDS/2026-04-27/daily.html` -> `html-system/LIVE/daily.html`

After copy, run:
- `./VALIDATION/validate_runtime.sh --env LIVE --manifest /Users/brianb/MissionMed/_SYSTEM/DEPLOY_MANIFEST.json --live-dir /Users/brianb/MissionMed/LIVE --base-url https://cdn.missionmedinstitute.com`

## Post-Rollback Verification
- `/arena` returns `200`
- `/stat` returns `200`
- `/drills` returns `200`
- `/daily` returns `200`
- Auth exchange/bootstrap endpoints return deterministic non-502 responses.
