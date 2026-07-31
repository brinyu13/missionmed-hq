# B1-507E Final Complete Combined Handoff

## Final verdict

**RP-8 COMPLETE — EXECUTOR SELECTED.**

The temporary Railway probe, both executor candidates, protected artifact
capture, interruption recovery, Chrome/Safari structural playback, cleanup, and
all local regressions are complete. The Founder confirmed that Option A
playback in both Chrome and Safari was continuous, correctly ordered, and
uncorrupted, approved the RP-8 result, and selected Option A.

The later activation value is `STORYFORGE_ASSEMBLY_EXECUTOR=concat`. It was not
set in production. No StoryForge production deployment or voice activation
occurred.

## 1. Starting state

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `codex/b1-503-storyforge-product-recovery`
- Required/observed starting HEAD:
  `767e438ab60b5179456716f782be747dfcd642f0`
- Upstream: `origin/codex/b1-503-storyforge-product-recovery`
- Starting relation: eight local commits ahead
- Starting worktree: clean
- Release candidate: `v-a9a076957973d7d4`

Required authority, combined handoffs, Fable Ruling 1, executable contracts,
acceptance matrix, probe source, Nixpacks configuration, selection logic, and
all RP-8 tests were read before creation.

## 2. Authority and source hashes

| Item | SHA-256 |
|---|---|
| B1-507E prompt | `9bfe0f4a20a307359f53f4ad6b2ae71709023575c3254e4654c4cc2e09f5a973` |
| B1-507D combined | `f0278b82301ad3d81653f2cabcc84aadaa7619d2b93e2c4535cebf9658f15766` |
| B1-507B combined | `224133bbd9a47cc4eba9a74b374d08b1d35844712129e58d87a35ed2b3844869` |
| Fable binding authority | `defd2eccdc901e2b2adc8ac269dff3c6403f2c4afb966025dccb8ed31698ca19` |
| Executable contracts | `84de5c81232aa8e15adac3ac96f17d9f03df705537497539546e70b5ec004bea` |
| Acceptance matrix | `3ae51d8a0885c0bd116a55fc1edecf64d4a0e6a22fec9e1b5cb174e27692947b` |
| Probe server | `558ca30b0d88de83ade02ead0ed9b2660925bfcb1b4240050ef5d2eae1c73cf2` |
| Nixpacks | `0642ab3ef2952baa827f966d5c458e8650aba6784bef928d78a9cfa3db8fe14c` |

## 3. Preflight

- Required HEAD matched.
- Worktree was clean.
- Release bytes and release ID matched B1-507D.
- Focused RP-8 unit tests: 12/12 passed.
- Nixpacks specified Node 20 and ffmpeg.
- Probe used only deterministic synthetic audio.
- Protected routes returned 404 outside the exact token/GET boundary.
- Selection evaluator was fail-closed and matched Fable's tie-break.
- Railway CLI 5.26.1 was authenticated.
- Existing project contained no `rp8-probe`.
- Production had one service before the probe.
- No production credential or external data dependency was used.

## 4. Exact temporary environment

| Resource | Value |
|---|---|
| Project | `missionmed-hq-fix005` |
| Project ID | `29afe885-b9b1-425d-8fd8-8611cd275409` |
| Environment | `rp8-probe` |
| Environment ID | `2c03ee2a-b45b-421e-9015-512d52cebade` |
| Service | `storyforge-rp8-probe` |
| Service ID | `3993f127-f72e-417a-a410-b65f714acf3e` |
| Railway domain | `storyforge-rp8-probe-rp8-probe.up.railway.app` |
| Domain ID | `c35b7b8c-1769-4e24-b215-c616ff2eae15` |
| Replica count | 1 |
| Volumes | none |

Explicit user-variable names:

1. `PORT`
2. `RP8_PROBE_TOKEN`

The token value remained redacted and was deleted. Railway's standard
`RAILWAY_*` runtime metadata was platform-injected, not a user variable.

No database, R2, provider, student data, WordPress credential, or production
domain was attached.

## 5. Build identity

- Deployment/build-log selector:
  `86cdfa38-55e6-4072-a70d-13893772584c`
- Status: `SUCCESS`
- Created: `2026-07-31T04:43:22.566Z`
- Builder: `NIXPACKS`
- Nixpacks path: `/nixpacks.toml`
- Build command: `npm run build:api`
- Probe-only start:
  `node scripts/rp8-probe-server.mjs`
- Health check: none for the token-only probe
- Build container digest:
  `sha256:aa28ceae3cbe5cfda189a5be3627dac7987f285f4d198cc33e7b98423a378772`
- Railway image digest:
  `sha256:aee5cad80f522d4d5dfff45f79ec6450de51e528885234457410c588b590cb79`

Railway CLI exposes the deployment UUID as the build/deployment log selector and
did not return a second build UUID. Both immutable image digests are recorded.

## 6. Probe commands and configuration

The operator:

1. created only the authorized environment;
2. created only the authorized service;
3. piped the generated token through stdin;
4. verified names only;
5. exported the exact frozen StoryForge tree;
6. added the temporary environment-specific start/health-check overlay;
7. uploaded with exact project/environment/service selectors;
8. verified resolved deployment metadata;
9. created one Railway-provided temporary domain;
10. exercised protected routes;
11. captured one archive download;
12. verified artifacts, restart idempotence, and browser playback;
13. deleted all remote probe resources.

No secret-bearing literal command is retained.

## 7. Fixture and artifact receipt

- 40 deterministic synthetic WebM/Opus segments.
- Nominal segment duration: 15 seconds.
- Nominal total duration: 600 seconds.
- Ordered fixture inventory SHA-256:
  `2c6f8780d6bf58771a03d19289d32ae90669705bb503a0d4c06dbcf1b6f04e0c`
- Segment bytes total: `2,606,040`.
- Protected manifest SHA-256:
  `843ec14be7166a3dd343adbbd482f505f3dc82baebe2b722db599939b277d910`.
- Protected archive SHA-256:
  `dbad350ee9506a46ebe4a7b254b5fab221808c9ab5c3f3bc66b325edb946b1cd`.
- Archive inventory: 47 files.
- Every ruled hash recomputed locally and matched.

Protected live-route results:

- no token manifest GET: 404;
- correct token manifest GET: 200;
- correct token non-probe GET: 404;
- no token artifact GET: 404;
- correct token artifact capture GET: 200;
- HEAD: 404 by deliberate GET-only contract.

## 8. Candidate results

### Option A — concat

| Run | Time | SHA-256 |
|---|---:|---|
| 1 | `179.940 ms` | `0c915873a3b4fd94dfbb060e711939cb460beed83dde0ee9673136f86062d5de` |
| 2 | `132.617 ms` | `0c915873a3b4fd94dfbb060e711939cb460beed83dde0ee9673136f86062d5de` |

Media:

- WebM/Opus;
- mono 48 kHz;
- `2,588,053` bytes;
- ffprobe duration `600.340 s`.

Machine-verifiable result: PASS.

### Option B — ordered segment playback

| Run | Time | Manifest SHA-256 |
|---|---:|---|
| 1 | `8.611 ms` | `f2dfd5f99f70e2a11c04e30851302439f6db5836ff67929db5fefe88016bba5f` |
| 2 | `6.854 ms` | `f2dfd5f99f70e2a11c04e30851302439f6db5836ff67929db5fefe88016bba5f` |

Machine-verifiable result: PASS.

## 9. Interruption

- Restarted exact temporary service.
- Observed protected route become HTTP 502 at
  `2026-07-31T04:50:06Z`.
- Sent second restart during the unavailable window.
- Observed HTTP 200 recovery at `2026-07-31T04:50:10Z`.
- Option A regenerated hashes: identical.
- Option B regenerated hashes: identical.
- Post-interruption times:
  - A: `216.890 ms`, `169.728 ms`;
  - B: `9.753 ms`, `10.636 ms`.
- Interruption idempotence: PASS.

## 10. Chrome and Safari

Playback used downloaded local artifacts only and ran through every media
timestamp/segment at 16x:

| Browser | Option A | Option B |
|---|---|---|
| Chrome | PASS, ended at `600.340 s` | PASS, 40/40, `600.320 s` |
| Safari | PASS, ended at `600.332 s` | PASS, 40/40, `600.540 s` |

This proves open, decode, start, duration, full completion, ordered 40-segment
transition, and absence of browser media errors or unrecoverable playback
failure.

Founder perceptual result:

- Chrome Option A: PASS — continuous, correctly ordered, and uncorrupted;
- Safari Option A: PASS — continuous, correctly ordered, and uncorrupted.

The result was supplied and approved by the Founder on 2026-07-31; no auditory
judgment is attributed to Codex.

## 11. Exact selection rule

Option A currently has:

- ffmpeg/runtime PASS;
- timing PASS;
- deterministic hash PASS;
- Chrome structural playback PASS;
- Safari structural playback PASS;
- interruption PASS;
- human perceptual playback PASS.

Option B currently has:

- timing PASS;
- deterministic manifest PASS;
- Chrome 40-segment structural playback PASS;
- Safari 40-segment structural playback PASS;
- perceptual criterion PASS under the approved binding result.

Current binding result:

`option_a_selected`

Executor selected: **Option A**.

Both options satisfy the binding criteria. The binding tie-break and explicit
Founder approval select:

- Option A;
- later activation value:
  `STORYFORGE_ASSEMBLY_EXECUTOR=concat`.

The live service was not touched, that variable was not set, voice remains
disabled, and no deployment occurred.

## 12. Cleanup

- Temporary service deleted.
- Zero services verified in temporary environment.
- Temporary environment deleted.
- Temporary domain removed with service/environment.
- URL returns 404 without token.
- URL returns 404 with the now-revoked former token.
- Local token file deleted.
- Temporary frozen-package active path removed.
- Local playback server stopped after Founder confirmation.
- Local synthetic evidence moved from its active temp path to macOS Trash.
- No volume or persistent resource remains.
- Temporary environment/name count: 0.
- Temporary service ID/name count across remaining environments: 0.

After cleanup the project has exactly the four pre-existing environments and the
production environment still has exactly its prior one service,
`missionmed-hq` (`3d18b017-4fc9-4b22-b097-ba879816d374`).

## 13. Local verification

| Gate | Result |
|---|---|
| Focused RP-8 unit | 12 passed |
| Complete unit | 218 passed |
| Existing PostgreSQL | 12 passed |
| B1-507 PG/contract | 130 passed |
| Browser E2E | 59 passed |
| Product conformance | 72 passed |
| Accessibility | no serious violation in included checks |
| Secret scan | clean |
| npm audit high | 0 vulnerabilities |
| API-only package check | pass; dormant/nondeployable by design |
| `git diff --check` after Founder closeout edits | clean |

The acceptance mapping remains 163 unique automated IDs: 130 PG/contract, 26
unit, and 7 E2E IDs, with zero authority skip.

Resolved non-product failures:

1. PATH selected PostgreSQL 16; the runner stopped before tests. Pinning
   PostgreSQL 18.4 produced the complete pass.
2. An E2E tool-output yield returned before its process. A second invocation
   correctly found the first test database busy. The original run completed
   and recorded Playwright `passed` with no failed tests.
3. Runner-generated tracked screenshots were restored to exact HEAD bytes.
4. The first Founder-closeout focused-test command used its app-relative path
   from the repository root. It stopped before running a test. The exact same
   test was rerun from `storyforge-v5` and passed 12/12.

## 14. Local files changed

Only this B1-507E evidence package:

1. `B1-507E_RP8_PREFLIGHT.md`
2. `B1-507E_RP8_EXECUTION_RECEIPT.md`
3. `B1-507E_RP8_PLAYBACK_AND_INTERRUPTION_EVIDENCE.md`
4. `B1-507E_RP8_CLEANUP_RECEIPT.md`
5. `B1-507E_IMPLEMENTATION_HANDOFF.md`
6. `B1-507E_FINAL_COMPLETE_COMBINED_HANDOFF.md`
7. `MANIFEST.sha256`

No product, test, migration, release, WordPress, or runtime file changed.

## 15. Release identity and residual risk

- Release ID remains `v-a9a076957973d7d4`.
- App SHA-256:
  `fded51e056c6a2c16b01c718bf2fa1f43aa4a45fb8ca2d48e8263a6e81d60827`.
- Styles SHA-256:
  `644548c5ff24b3b357c4194b97e56ce8525feab59b0f4914e3bf9779099e00fe`.
- WordPress runtime SHA-256:
  `30fc0e380be9704ff3d52a8f3827edf4d578c1c7bb95e933a4ab21e268e11d9a`.

Residual risk:

- RP-8 does not satisfy RP-11 transcription-provider bake-off;
- RP-8 does not provision R2 or authorize production voice;
- production deployment/activation gates remain separate.

## 16. Exact next gate

RP-8 needs no further action. The next gate is a separately authorized
production voice preflight covering the still-required provider, R2, rollout,
and activation controls. At that later activation only, configure
`STORYFORGE_ASSEMBLY_EXECUTOR=concat`. Do not activate voice until every
remaining external gate and explicit deployment authority are satisfied.
