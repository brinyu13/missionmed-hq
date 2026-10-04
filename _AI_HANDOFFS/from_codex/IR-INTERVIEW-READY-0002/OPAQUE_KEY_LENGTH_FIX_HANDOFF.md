# Opaque key minimum-length guard fix

Date: 2026-10-04. Assigned and verified base: `9ba7856a51a21f17e8baa6700ffe57b20fc19f66`. Scope: dormant local helper, fixture tests, and this handoff only. Local commit only; no push; stop after commit.

## Evidence and result

Reused the foreman's fresh BOOT PASS at MissionMed OS main `1e8374664751ad911280d83d8c60e200a224245d`; verified that OS HEAD and worktree base without OS sync or further discovery. Read the supplied management-key representation diagnosis and value-free metadata receipt. The diagnosis records the official OpenAPI `api_key` string contract without `minLength`. The independently admitted receipt reports one selected existing `missionmed_lease_runtime_v5` secret with exact prefix, ASCII alphabet membership, at least four distinct suffix characters, and no whitespace/control, conventional mask glyph, or placeholder word. Its suffix bucket is `below_32`, and length alone failed the old validator. This worker did not repeat that provider observation or inspect its underlying value.

Changed `SECRET_RE` suffix quantifier from `{32,128}` to `{1,128}`. The comment now explicitly limits the guard to local shape checking, which cannot establish a complete key or REST authentication. Retained prefix, ASCII alphabet, maximum 128, non-string rejection, diversity, placeholder/mask rejection, constant errors, token custody, unique fixed name/type selection, endpoints, headers, deadlines, bounds, and all other transport behavior.

Changed the existing short-string rejection fixture to an empty suffix because a short suffix with sufficient diversity is now intentionally shape-admitted. Added two focused fixture tests: fabricated suffixes below 32 pass local shape selection without custody/probe calls; empty, non-string, masks, placeholder words, controls/whitespace, malformed alphabet/prefix, low diversity, and over-128 values still reject with the constant format error. No actual values or new provider credentials are present in these fixtures.

Before commit, the foreman additionally authorized one data-minimization correction: `_GET_WORKER` health mode now emits only the actual HTTP status plus newline and closes the connection without calling `response.read`, including for HTTP 200. This avoids an unnecessary private REST root OpenAPI-body read and a false authentication stop from an oversized schema. Management reveal still reads the full JSON with its existing cap. The health endpoint, GET method, TLS, headers, 60-second total deadline, parent response cap, and status-based acceptance remain unchanged. Normal RPC canonical validation remains a separate gate. One additional fake HTTPS fixture verifies status-only output for 200/401, zero body-read calls, connection close, and the fixed GET/TLS/header contract; no real HTTP is sent.

## Validation

- Baseline: `python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/lease_transport_tests.py` — 27 tests, OK.
- Final: same command — 30 tests in 0.012s, OK (original 27 plus three focused tests).
- `git diff --check` — passed.
- An initial new negative bytes fixture was mistakenly decoded into a valid string; corrected the test to call `_secret` with the bytes object intact, then reran the 29-test suite successfully.
- Unchanged metadata projection's 11 tests were not rerun.

All transport tests use fictional injected inputs/mocks. No actual environment credential lookup, token-file/keychain read, private provider GET, real health probe, wrapper/client/registrar execution, CLI upgrade, runtime mutation, or OS write occurred. Public documentation was opened; the changelog Markdown fetch failed due to unsupported content type. No private credential access followed.

## SHA-256 custody

| File | SHA-256 |
| --- | --- |
| `lease_transport.py` (final) | `6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad` |
| `lease_transport_tests.py` (final) | `b6ae9a554a34c6cc81232b7d1933ff59847f01ce0c602158bc360a2dab9e62a2` |
| `KEY_METADATA_OBSERVATION_20261004.json` (read only) | `65643091b3eb06833ebbc146bd06b10bf6b3a4cf8dcd6193e1a4b62a0f208636` |
| `MANAGEMENT_KEY_REPRESENTATION_DIAGNOSIS.md` (read only) | `21c0a16676eb60e60d91f451a20a4c28c42a230ae85937ab1f9f8cf40c6dcda6` |

Preserved unrelated dirty registration packet, execution checkpoint, `supabase/.temp/cli-latest`, `_AI_INPUTS/`, and metadata receipt. No authentication is proven. REST authentication remains the authority for gateway acceptance; this shape fix grants no execution, registration, lease, or product authority. Independent review of the exact changed bytes remains required before any separately authorized execution.
