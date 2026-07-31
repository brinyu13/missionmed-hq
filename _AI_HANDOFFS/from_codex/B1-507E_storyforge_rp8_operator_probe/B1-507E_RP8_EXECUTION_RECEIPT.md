# B1-507E RP-8 Execution Receipt

## Scope

This is the redacted execution receipt for the temporary Railway/Nixpacks
operator probe. It is not a StoryForge production deployment.

## Temporary Railway identity

| Resource | Exact identity |
|---|---|
| Existing project | `missionmed-hq-fix005` |
| Project ID | `29afe885-b9b1-425d-8fd8-8611cd275409` |
| Temporary environment | `rp8-probe` |
| Environment ID | `2c03ee2a-b45b-421e-9015-512d52cebade` |
| Temporary service | `storyforge-rp8-probe` |
| Service ID | `3993f127-f72e-417a-a410-b65f714acf3e` |
| Temporary Railway domain | `storyforge-rp8-probe-rp8-probe.up.railway.app` |
| Domain ID | `c35b7b8c-1769-4e24-b215-c616ff2eae15` |
| Target port | `3000` |
| Replicas | `1` |
| Volumes | none |

The environment and all listed temporary resources are deleted. IDs are retained
only as audit evidence.

## Variable proof

The environment configuration listed exactly these two explicit user variables:

1. `PORT`
2. `RP8_PROBE_TOKEN`

The token value was 64 hexadecimal characters and was never printed. Railway
also exposed its standard `RAILWAY_*` platform metadata at runtime; those are
platform-injected names, not user variables or production credentials.

No database URL, R2 credential, provider key, student data, WordPress secret, or
production application variable was present.

## Build and deployment identity

| Evidence | Value |
|---|---|
| Deployment/build-log selector | `86cdfa38-55e6-4072-a70d-13893772584c` |
| Deployment status | `SUCCESS` |
| Created | `2026-07-31T04:43:22.566Z` |
| Builder | `NIXPACKS` |
| Nixpacks config | `/nixpacks.toml` |
| Build command | `npm run build:api` |
| Start command | `node scripts/rp8-probe-server.mjs` |
| Health check | none, by probe-only override |
| Build container digest | `sha256:aa28ceae3cbe5cfda189a5be3627dac7987f285f4d198cc33e7b98423a378772` |
| Railway deployment image digest | `sha256:aee5cad80f522d4d5dfff45f79ec6450de51e528885234457410c588b590cb79` |

Railway CLI 5.26.1 did not expose a second standalone build UUID. The same
deployment UUID is the accepted selector for both build logs and deployment
logs; the two immutable image digests above preserve the distinct build and
runtime identities.

## Redacted operator sequence

1. Verify exact project and absence of `rp8-probe`.
2. `railway environment new rp8-probe --json`
3. Link only the new environment.
4. `railway add --service storyforge-rp8-probe --json`
5. Set `PORT=3000` and pipe the generated token through stdin with
   `--skip-deploys`.
6. List explicit variable names only.
7. Export the exact frozen `storyforge-v5` tree from commit
   `767e438ab60b5179456716f782be747dfcd642f0`.
8. Add only the temporary `rp8-probe` start/health-check overlay.
9. Upload to the exact temporary project/environment/service selectors.
10. Verify deployment metadata, Nixpacks, start command, digest, one replica,
    and no volume.
11. Generate one Railway-provided temporary domain.
12. Exercise protected routes, download the archive once, validate locally,
    simulate interruption/restart, and run local browser playback.
13. Delete the service, then the environment; delete the token and temporary
    package; verify absence.

## Route evidence

| Request | Result |
|---|---|
| Missing token, manifest GET | HTTP 404 |
| Correct token, manifest GET | HTTP 200 |
| Correct token, non-probe GET | HTTP 404 |
| Missing token, artifacts GET | HTTP 404 |
| Correct token, artifacts GET used for single capture | HTTP 200 |
| HEAD, even with token | HTTP 404, because the server admits GET only |

The token was not put in a URL, browser, screenshot, log, or handoff.

## Fixture evidence

- Count: 40
- Per-segment nominal duration: 15 seconds
- Nominal total: 600 seconds
- Generator: deterministic sine wave
- Ordered fixture inventory digest:
  `2c6f8780d6bf58771a03d19289d32ae90669705bb503a0d4c06dbcf1b6f04e0c`
- Total segment bytes: `2,606,040`
- First fixture SHA-256:
  `cf83f7a76639eb9cea9c3e6211567dd4aca59d18ac5624343b530397b3671d46`
- Last fixture SHA-256:
  `b2afe102cffe131e8452aa4c0e810761a1e6e439d766bd92197e6af7cb5b9932`

## First execution

### Option A — concat

| Run | Wall time | SHA-256 |
|---|---:|---|
| 1 | `179.940 ms` | `0c915873a3b4fd94dfbb060e711939cb460beed83dde0ee9673136f86062d5de` |
| 2 | `132.617 ms` | `0c915873a3b4fd94dfbb060e711939cb460beed83dde0ee9673136f86062d5de` |

- Automated timing: PASS
- Dual-run hash: PASS
- Output bytes: `2,588,053`
- Container: Matroska/WebM
- Audio: Opus, mono, 48 kHz
- Local ffprobe duration: `600.340 s`

### Option B — copy / ordered segments

| Run | Wall time | Manifest SHA-256 |
|---|---:|---|
| 1 | `8.611 ms` | `f2dfd5f99f70e2a11c04e30851302439f6db5836ff67929db5fefe88016bba5f` |
| 2 | `6.854 ms` | `f2dfd5f99f70e2a11c04e30851302439f6db5836ff67929db5fefe88016bba5f` |

- Automated timing: PASS
- Dual-run manifest hash: PASS
- Ordered segments: 40
- Segment 0 ffprobe duration: `15.008 s`

## Captured download

| Local evidence | SHA-256 |
|---|---|
| Protected manifest | `843ec14be7166a3dd343adbbd482f505f3dc82baebe2b722db599939b277d910` |
| Single protected archive capture | `dbad350ee9506a46ebe4a7b254b5fab221808c9ab5c3f3bc66b325edb946b1cd` |

The tar contained 47 deterministic files: forty fixtures, two concat lists, two
Option A outputs, two Option B manifests, and the probe manifest. Every ruled
output hash was recomputed locally and matched the protected manifest.

## Interruption rerun

- First restart requested against the exact temporary deployment.
- HTTP 502 observed at `2026-07-31T04:50:06Z`.
- A second restart was requested during the unavailable window.
- HTTP 200 recovery observed at `2026-07-31T04:50:10Z`.
- Regenerated Option A hashes matched the first execution.
- Regenerated Option B hashes matched the first execution.
- Post-interruption timings:
  - Option A: `216.890 ms`, `169.728 ms`
  - Option B: `9.753 ms`, `10.636 ms`
- Post-interruption manifest SHA-256:
  `06a576348adbac398866d5c6b31a68a3c9d47030abf62077af229374daa5938f`

The manifest file hash changes because wall times are evidence fields; the ruled
artifact/option hashes remain byte-identical. Interruption idempotence: PASS.

## Selection state

Automated runtime criteria and automated structural playback pass for both
options. Binding selection is not yet finalized because the Founder/operator
perceptual listening confirmation remains pending. No executor was guessed and
no environment variable was set.

If the Founder confirms perceptual playback in both browsers, both options pass
and the binding tie-break selects:

- Option A
- later separately authorized value:
  `STORYFORGE_ASSEMBLY_EXECUTOR=concat`

Until that confirmation is recorded, the current absent executor remains
fail-closed.
