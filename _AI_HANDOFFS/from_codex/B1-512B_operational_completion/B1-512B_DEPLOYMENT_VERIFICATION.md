# B1-512B Deployment Verification

Status: **PASS for the live accepted runtime; B1-512 candidate publication is NOT verified because it has not occurred.**

## Live runtime

- Railway API deployment: `17615414-9422-453a-9eb8-7d1b36f462a6`, `SUCCESS`, one running instance.
- Railway image digest: `sha256:4614ee7669fc161e3a8a1a3b540babeacf0ab5d03b15baa9abffda13d4c8b3ce`.
- `/healthz`: HTTP 200, no-store.
- Railway 500–599 HTTP-log query: no events returned in the 500-line query.
- PostgreSQL volume: `READY`, not pending deletion, 910.336 MB used of 50000 MB.

## WordPress/Kinsta/Cloudflare

- `https://missionmedinstitute.com/storyforge/`: HTTP 200.
- Anonymous same-origin session endpoint: HTTP 401, `auth_required`.
- Route headers prove WordPress gateway, Cloudflare/Kinsta routing, no-store/private/noindex cache controls, and restrictive CSP.
- Kinsta pointer: `releases/752d408f32c7becc9d10712e163ab86693998edc`.
- Public hashes: index `a781895575afd34e68266a78f0e026d3d0802bc00bcd98741d0898b6143b766f`; app `217f4d2d0f5f3f4c95f83403efc2fd35681a87718afe8fffd25c791897e08b9c`; styles `409bdc5b96d7dadad4d9eda1f4c0a01a2ee8d561745f4b2439850423eee0e18c`.

Frozen B1-512 candidate `v-10688bb24bca7965` at `8ca5d60fffcbb479fc5ced4689702fd4a7defb58` uses aliases `cbe2999f0c70` and `5e18315007aa`, which do not match live. The live settings and ledger likewise lack B1-512-only keys/migration. This is deployment state, not an implementation failure.

`python3 _SYSTEM/tools/critical_systems_gate.py --enforce --json` completed with **0 FAIL**. Warnings were the pre-existing blank Kinsta start-command metadata and four browser journeys outside the report-only script.
