# B1-507E RP-8 Preflight

## Verdict before remote creation

**PASS — the frozen candidate and the authorized probe contract were fit for the
temporary Railway execution.**

This receipt records the preflight completed before the `rp8-probe` environment
was created. It does not grant production deployment or voice-activation
authority.

## Repository identity

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `codex/b1-503-storyforge-product-recovery`
- Required and observed starting HEAD:
  `767e438ab60b5179456716f782be747dfcd642f0`
- Upstream: `origin/codex/b1-503-storyforge-product-recovery`
- Starting relation: eight local commits ahead
- Starting worktree: clean
- Release ID: `v-a9a076957973d7d4`

## Authority read and pinned

| Input | SHA-256 |
|---|---|
| B1-507E operator prompt | `9bfe0f4a20a307359f53f4ad6b2ae71709023575c3254e4654c4cc2e09f5a973` |
| B1-507D final combined handoff | `f0278b82301ad3d81653f2cabcc84aadaa7619d2b93e2c4535cebf9658f15766` |
| B1-507B final combined handoff | `224133bbd9a47cc4eba9a74b374d08b1d35844712129e58d87a35ed2b3844869` |
| B1-507B Fable binding authority | `defd2eccdc901e2b2adc8ac269dff3c6403f2c4afb966025dccb8ed31698ca19` |
| B1-507B executable contracts | `84de5c81232aa8e15adac3ac96f17d9f03df705537497539546e70b5ec004bea` |
| B1-507B acceptance matrix | `3ae51d8a0885c0bd116a55fc1edecf64d4a0e6a22fec9e1b5cb174e27692947b` |

Binding Ruling 1 authorizes exactly one environment named `rp8-probe`, exactly
one service named `storyforge-rp8-probe`, the frozen candidate, the repository
Nixpacks configuration, one probe-only start override, two user variables, and
mandatory deletion after evidence capture.

## Frozen package

| Artifact | SHA-256 / evidence |
|---|---|
| `scripts/rp8-probe-server.mjs` | `558ca30b0d88de83ade02ead0ed9b2660925bfcb1b4240050ef5d2eae1c73cf2` |
| `nixpacks.toml` | `0642ab3ef2952baa827f966d5c458e8650aba6784bef928d78a9cfa3db8fe14c` |
| Base `railway.json` | `200b7540add8003b9548008fdaa1aae8cef814b703628290c8bf21143aa68d1a` |
| Runtime | Node 20 minimum |
| Nixpacks setup | `nodejs_20`, `ffmpeg` |
| Probe data | deterministic synthetic sine waves only |
| Provider calls | none in probe |
| Database/R2 use | none in probe |

The exact Git tree was exported from the required HEAD into a temporary package.
The only ephemeral deployment overlay was the authority-required
environment-specific start command:

`node scripts/rp8-probe-server.mjs`

The overlay also set the inherited production `/healthz` check to `null`, because
the probe deliberately exposes only token-protected RP-8 routes. The deployment
metadata later proved that Railway resolved the environment override while
keeping `NIXPACKS` and `/nixpacks.toml`.

## Probe audit

- Secret handling: 64-hex token generated locally; never printed.
- Token redaction: no value appeared in console output, receipts, screenshots,
  browser URLs, logs, or Git.
- Route boundary: only `GET /rp8/manifest.json` and
  `GET /rp8/artifacts.tar`; wrong token, missing token, wrong method, and other
  paths return 404.
- Fixture determinism: fixed 40 files, 15 seconds each, frequencies
  `220 + 11 * index`.
- Dual-run consistency: both options execute twice and record timings/hashes.
- Playback artifacts: one assembled WebM for Option A and forty ordered WebM
  segments plus deterministic manifests for Option B.
- Selection: pure fail-closed evaluator; both pass selects A, one pass selects
  it, neither returns `gate_failed`.
- Interruption: service rerun recreates the workspace and regenerated outputs
  must match prior hashes.
- Cleanup: temporary environment, service, domain, token, and package are
  disposable and separately verified absent.

## Focused preflight test

`node --test storyforge-v5/tests/unit/rp8-probe.test.mjs`

- Passed: 12
- Failed: 0
- Skipped: 0

## Railway boundary before creation

- Railway CLI: `5.26.1`
- Authentication: valid operator session
- Existing project: `missionmed-hq-fix005`
- Project ID: `29afe885-b9b1-425d-8fd8-8611cd275409`
- No pre-existing `rp8-probe` environment
- Existing environments preserved:
  - `production`
  - `cam-dev`
  - `cam-release-staging`
  - `cam-production`
- Production had one service before the probe.
- No production credential, database, R2 bucket, provider key, student data,
  custom/production domain, volume, or shared variable was authorized for use.

## Release-byte baseline

| Release byte | SHA-256 |
|---|---|
| `dist/assets/app.fded51e056c6.js` | `fded51e056c6a2c16b01c718bf2fa1f43aa4a45fb8ca2d48e8263a6e81d60827` |
| `dist/assets/styles.644548c5ff24.css` | `644548c5ff24b3b357c4194b97e56ce8525feab59b0f4914e3bf9779099e00fe` |
| WordPress runtime `release.php` | `30fc0e380be9704ff3d52a8f3827edf4d578c1c7bb95e933a4ab21e268e11d9a` |

No product byte was changed by B1-507E.
