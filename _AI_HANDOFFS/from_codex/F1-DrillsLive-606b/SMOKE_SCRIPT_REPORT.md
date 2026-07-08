RESULT: WEBEX_107A_SOURCE_TRUTH_COMPLETE
SUMMARY: A read-only future deploy validation script was added at `_AI_HANDOFFS/tools/v3-smoke.sh` and passed shell syntax validation.

# Smoke Script Report

Script:
- `_AI_HANDOFFS/tools/v3-smoke.sh`

Purpose:
- Prepare future deploy validation without performing deploy, push, cache purge, or production writes.

Checks prepared:
- V3 route render check.
- Public asset fetch and SHA-256 comparison against `DRILLS_LIVE_MANIFEST.tsv`.
- Fast endpoint HTTP and `cache-control: no-store` check.
- Legacy preview header check for `x-missionmed-preview: WEBEX-034`.
- Launcher untouched check by hash when `LAUNCHER_SHA256` is provided, otherwise by route pointer guard.

Validation:
- `bash -n _AI_HANDOFFS/tools/v3-smoke.sh` passed.

Run controls:
- The script is read-only.
- It uses `curl`, local hashing, and local file reads only.
- It does not deploy.
- It does not purge cache.
- It does not modify production.

