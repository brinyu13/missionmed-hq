# Y1-Y2-CAM-V6-3500 — Codex Return Packet

Maintained by: Claude Code under temporary implementation custody
Opened: 2026-08-17
Status: OPEN — updated continuously while custody is held

---

## 1. Starting state (inherited, verified by CC-00)

| Field | Value |
|---|---|
| Worktree | `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3440` |
| Application root | `ivprep-v6/` |
| Branch | `codex/y1-y2-cam-v6-3440-aaa-unified-production-admin-canary` |
| HEAD at takeover | `ae17956dba7ac90960dfef4075fce02576d11606` |
| Rollback anchor (pre-3500) | `ae17956` |
| Origin at takeover | in sync, no divergence |

Pre-existing working-tree state, deliberately left untouched so that the 3483
`preserved_non_rapid_qa_state` declaration still matches byte for byte:

- modified: `supabase/.temp/cli-latest`
- untracked: `_AI_HANDOFFS/from_codex/Y1-Y2-CAM-V6-3483_FABLE5_BOOT_PROMPT.md`
- untracked: `_AI_HANDOFFS/from_codex/Y1-Y2-CAM-V6-3483_FULL_FORENSIC_FABLE5_HANDOFF.md`
- untracked: `_AI_HANDOFFS/from_codex/Y1_Y2_CAM_V6_3440/MMOS_SHARED_WRITER_CHECKPOINT_20260812/`
- untracked: `_AI_HANDOFFS/from_codex/Y1_Y2_CAM_V6_3440/Y1_Y2_CAM_V6_3440_ORCHESTRATOR_FABLE5_COORDINATION_REPORT.md`

Baseline re-verified identical after every commit below.

---

## 2. Authority package copy

The Fable 3490→3494A lineage existed only inside a temporary Claude session FUSE
mount (`.fuse_hidden*` artifacts present), with no copy under version control.

Preserved to `_AI_HANDOFFS/from_cowork/Y1-Y2-CAM-V6-3494A_FABLE_PRODUCTION_AUTHORITY/`
— 35 files, byte-identical (SHA-256 verified at copy time), filenames preserved,
plus `MANIFEST_SHA256.md` carrying provenance and the full checksum manifest.

The four HTML design artifacts are excluded by the deliberate `_AI_HANDOFFS/**`
→ `*.md`-only rule at `.gitignore:60-63` and were staged with `git add -f` as a
scoped exception. **The shared `.gitignore` policy was not modified.** All four
were scanned for credential patterns before staging (zero hits; only external
reference is `fonts.googleapis.com`).

**Open item for Codex:** `_AI_HANDOFFS/from_codex/Y1-Y2-CAM-V6-3483_CURRENT_STATE.json`
is the machine-readable forensic binding record and is ignored by the same
`*.md`-only rule, so it survives only as an untracked working-tree file. Left as
found for the reason in §1. Decide whether to track it.

---

## 3. Commits

| Commit | Type | Summary |
|---|---|---|
| `bcc78ca` | docs | Preserve Fable 3490–3494A production authority in-repo (36 files, +9281) |
| `b889bf4` | fix | Repair hosted vision stage boot: CSP + module-worker wasm glue (6 files) |
| `7045419` | docs | Open this return packet |
| `2034a5d` | feat | CC-25 seed question corpus + CC-04 provider registry substrate (6 files) |
| `571054c` | fix | M1 media stage: frozen-object crash, stale view guard, stream re-attach (3502) |
| `c808978` | feat | Real F0 pitch cartridge + FACE family, 10 lanes, claim-safety enforced (3504) |
| `8721074` | feat | Stage A: real identity, real 193-question corpus in UI, FACE/PITCH group panel (3505) |
| `18a1a54` | feat | 3492 Performance Studio shell live + diagnostic seam repaired (3507) |

Each is bounded and independently revertable. Product code and authority
documentation were kept in separate commits.

`bcc78ca`, `b889bf4` and `7045419` are **pushed** to
`origin/codex/y1-y2-cam-v6-3440-aaa-unified-production-admin-canary`
(`ae17956..7045419`). `2034a5d` is local at the time of writing. No force push.

---

## 4. Files changed

`bcc78ca` — documentation only, no product source.

`b889bf4`:

| File | Change |
|---|---|
| `ivprep-v6/server/hq-mount.mjs` | added `'wasm-unsafe-eval'` to hosted CSP `script-src` |
| `ivprep-v6/public/analytics/vision-fileset.mjs` | NEW — module-worker-safe MediaPipe fileset resolver |
| `ivprep-v6/public/analytics/holistic-worker.mjs` | route fileset through the shared resolver |
| `ivprep-v6/public/analytics/face-detector-worker.mjs` | route fileset through the shared resolver |
| `ivprep-v6/test/analytics/vision-stage-boot.test.mjs` | NEW — 4 regression guards |
| `ivprep-v6/scripts/3440/start-hq-mount-harness.mjs` | dev harness: single-instant session, hosted runtime mode |

---

## 5. Defects found and fixed

### 5.1 Hosted CSP blocked all WebAssembly — vision stage completely dead on Railway

`server/hq-mount.mjs` served `script-src 'self'` with no `'wasm-unsafe-eval'`.
The vendored MediaPipe holistic landmarker could not instantiate:

```
CompileError: WebAssembly.instantiate(): Compiling or instantiating WebAssembly
module violates the following Content Security policy directive because
'unsafe-eval' is not an allowed source of script in "script-src 'self'"
```

`server/serve.mjs:85` already carried `'wasm-unsafe-eval'`. **That divergence is
why the stage worked on localhost and was dead hosted** — and it is the concrete
mechanism behind 3483's "Delivery Intelligence PARTIAL" and the hosted UI's
"Gesture — Not connected".

Added the narrow WebAssembly-only grant. `'unsafe-eval'` and `'unsafe-inline'`
remain forbidden on the hosted mount, which stays stricter than the dev server.

### 5.2 Neither wasm glue flavour can load from a `type: 'module'` worker

Both vision workers called `FilesetResolver.forVisionTasks(wasmRoot, true)`.

Ground truth from the vendored bundle (deminified):

```js
forVisionTasks = (root, moduleFlavour = false) => ({
  wasmLoaderPath: `${root}/vision_wasm${moduleFlavour ? '_module' : ''}${simd ? '' : '_nosimd'}_internal.js`,
  ...
})

loadScript = async (url) => {
  if (typeof importScripts != 'function') { /* document: append <script> */ }
  try { importScripts(url); }
  catch (e) { if (!(e instanceof TypeError)) throw e; await import(url); }
}
```

The second argument is **not** "force SIMD" — it selects the MODULARIZE build.
Both paths fail from a module worker:

- `true` → `vision_wasm_module_internal.js`, whose top-level `import.meta` is a
  hard `SyntaxError: Cannot use 'import.meta' outside a module` when the loader
  parses it as a classic script.
- omitted → `vision_wasm_internal.js`; `importScripts()` throws `TypeError` in a
  module worker, so the loader falls back to `await import()`, and the
  non-MODULARIZE glue's top-level `var ModuleFactory` stays module-scoped and
  never reaches the global the loader reads → `ModuleFactory not set.`

Both observed empirically. The repository shipped the first form.

**Fix:** `public/analytics/vision-fileset.mjs` imports the MODULARIZE glue as the
ES module it actually is, publishes the factory where MediaPipe reads it, and
returns a fileset whose `wasmLoaderPath` is the resolver module's own URL, so
MediaPipe's internal re-load resolves from the module map as a no-op. Fails
honestly when WASM SIMD is unavailable rather than requesting the nosimd module
build, which is not vendored.

**Codex review request:** this is a deliberate, documented accommodation of a
vendored library's loader. A cleaner long-term fix is classic workers (or a build
step) so MediaPipe's own `importScripts` path works. That is a multi-file change
across `vision-geometry.mjs` / `primary-interviewee-lock.mjs`, which are also
imported as ESM by Node-side code, so it was deferred rather than rushed.

### 5.3 Local 3440 harness could never admit

`scripts/3440/start-hq-mount-harness.mjs` built its synthetic session from two
separate `Date.now()` reads. Any ≥1 ms drift pushed the TTL to 1800001 ms against
the 1800 s cap in `strictProjectHqSession`, so every request failed closed with
`ivprep_authentication_required`. It also supplied no `runtimeState`, so the mount
defaulted to `mode: 'disabled'` and the client's
`initializeDeliveryIntelligence()` returned early — the shell served with the
entire sensor stage inert.

Now uses one captured instant, holds the lifetime below the cap, and reports
`mode: 'hosted'` with `workerRegistrationState: 'UNAVAILABLE'` and
`paidProviderCreationEnabled: false`. This models exactly the state that must
work: hosted runtime, paid provider unavailable. The harness cannot create a
provider session or incur spend.

**Production was never affected** — HQ derives both stamps from a single `Date`
instance (`missionmed-hq/server.mjs:1064`) with `hqSessionMaxTtlSeconds` from the
same constant. Verified: the two-clock-read pattern exists nowhere else
(`scripts/3441r/...` already captures `issuedAtMs` once).

---

## 6. Tests

| Suite | Before | After |
|---|---|---|
| `npm test` | 314 pass / 0 fail | **355 pass / 0 fail** |
| `npm run check` | PASS, 28 modules | PASS, 35 modules |

New: `test/analytics/vision-stage-boot.test.mjs` — 4 guards pinning the CSP
directive (and asserting broad `'unsafe-eval'`/`'unsafe-inline'` stay absent),
the resolver routing in both workers, the resolver contract, and the presence of
the vendored glue the resolver depends on.

New: `test/questions/question-corpus.test.mjs` — 9 CC-25 acceptance tests: exact
counts, structural exclusion of the applicant-asked sections, CORE-first under
every sort, byte-exact verbatim text re-parsed from the manifest, the canonical
Question contract, read-time stats join with no stored counts, drawer
search/collections, provider-registry composition and id-collision refusal, and a
manifest SHA-256 drift guard.

`test/questions/*.test.mjs` was added to the `npm test` glob and
`public/questions` + `scripts/questions` to the syntax sweep, so neither can
silently drop out of CI.

---

## 7. Browser evidence (real mount, zero provider cost)

Driven against the real `createIvPrepHqHandler` mount via the repaired harness.

| Check | Result |
|---|---|
| Product document | HTTP 200, 40 084 bytes |
| `analytics/ui.mjs` | HTTP 200, 113 035 bytes |
| Holistic model `.task` | HTTP 200, 13 683 609 bytes |
| Vision WASM binary | HTTP 200, 11 756 954 bytes |
| Admission | `admitted: true`, `runtime.mode: hosted` |
| Product shell | renders; 10 nav items incl. Delivery Intelligence |
| DI stage | `communication-analytics-connect` / `-start`, yaw/pitch/roll/lean gauges, overlay + waveform + timeline canvases |
| **Holistic worker init** | **`ready` (2 351 ms cold)** — was `init-error` before |
| **Face safety worker init** | **`ready`** — was failing before |
| Real `analyze()` path | returns `geometry` for pushed frames (2393 / 507 / 302 ms in a software-CPU headless pane) |
| MediaPipe telemetry egress | `odml.pa.googleapis.com` correctly blocked by `connect-src 'self'` |

`overlayRendered: false` / `overlayPrimitiveCount: 0` on synthetic frames is
correct behaviour, not a defect: `renderOverlay()` requires real landmarks, and a
drawn ellipse produces none. **Visual wireframe confirmation requires a physical
camera and is the Founder's M1 test.**

Inference cost above is a software-CPU headless figure. The same model ran at
57–64 ms/frame in the document context on this machine; real hardware will be
faster. `targetFps` adapts, but perf on the Founder's machine is unmeasured.

---

## 8. Deployment — DEPLOYED AND VERIFIED LIVE (Y1-Y2-CAM-V6-3501)

### 8.1 Discovery (read-only)

`railway status --json` enumerated the whole project. The HQ service is
unambiguous:

| Field | Value |
|---|---|
| Railway project | `missionmed-hq-fix005` / `29afe885-b9b1-425d-8fd8-8611cd275409` |
| Environment | `production` / `ed3353f7-bcc7-4e25-a000-3c9fc628a9a7` |
| **HQ service** | **`missionmed-hq` / `3d18b017-4fc9-4b22-b097-ba879816d374`** (3483 prefix `3d18`) |
| HQ domain | `missionmed-hq-production.up.railway.app` |
| HQ start command | `node missionmed-hq/server.mjs` (matches `railway.json`) |
| HQ builder | NIXPACKS |
| HQ source repo | `brinyu13/missionmed-hq` |
| Pre-deploy HQ deployment | `9ea6bf75-2ed2-4bc8-9a5e-04dfdd900b25`, label `ae17956 prepare hosted founder test 2` |
| Worker service | `ivprep-profile-b-worker` / `294a0bef-9cd2-43ff-97e8-4b88fa9e873d` (3483 prefix `294a`) |
| Pre-deploy worker deployment | `aec9436e-d521-4b1d-a338-9d8d7c5e3934` |

The pre-deploy HQ deployment label `ae17956 prepare hosted founder test 2`
confirms two things: the live product was pinned at `ae17956` (the pre-3500 HEAD),
and **CLI upload is the established deployment mechanism for this lane** — every
service in this project carries a CLI-style deploy label. No architecture change
was needed to deploy the same way.

### 8.2 Why the branch push did not deploy

`origin/HEAD` → `main`, and `origin/main` is `4c86e85` (2026-08-13), which contains
neither `ae17956` nor `89f8cae`. The HQ service ran a pinned CLI deployment, so
pushing the feature branch was never a deploy trigger. No merge to `main` was
performed or needed.

### 8.3 Safe targeting

`railway up` supports `-p/-e/-s`, so the HQ service was targeted **explicitly by
service ID** and the local CLI link was never mutated:

```
railway up -p 29afe885-b9b1-425d-8fd8-8611cd275409 \
           -e production \
           -s 3d18b017-4fc9-4b22-b097-ba879816d374 -d
```

The local link remained `ivprep-profile-b-worker` before and after, so no
restore step was required.

Pre-flight safety checks before upload (`railway up` ships the working tree):

- `ivprep-v6/.env.local` is gitignored → **excluded**. `.gitignore` is honoured by
  default; `--no-gitignore` was NOT used. No secret file entered the build.
- 11 untracked-but-unignored files would ride along, all `_AI_HANDOFFS/**/*.md`
  documentation. Scanned for credential patterns: zero hits.
- Only tracked delta vs the pushed commit was `supabase/.temp/cli-latest`
  (`v2.95.4` → `v2.114.0`), a Supabase CLI version string, not runtime code.
- Payload ~64 MB tracked.

### 8.4 Result

New HQ deployment **`a869beae-8d80-4a36-802c-874aef3b5951`**, status **SUCCESS**,
`2026-08-17T13:33:47Z`, built from the working tree at commit **`7492873`**.

### 8.5 Post-deploy verification (all eight checks)

| # | Check | Result |
|---|---|---|
| 1 | Hosted route responds | `/iv-prep-on-call/` HTTP 401 in 0.12 s (correct for anonymous) |
| 2 | CSP carries the WebAssembly grant | `script-src 'self' 'wasm-unsafe-eval'` — and still **no** `'unsafe-inline'`, **no** `'unsafe-eval'` |
| 3 | Anonymous access still denied | 401 on `/iv-prep-on-call/`, its assets, `/api/ivprep-v6/session`, `/api/ivprep-v6/vault`; body `ivprep_authentication_required` |
| 4 | Wider HQ intact | `/api/auth/session` 200, `/api/bootstrap` 200, `/api/bridge/health` 200, POST-only routes 405, DBOC routes 401 |
| 5 | Provider sessions created | **0.** No provider endpoint was called; creation requires an authenticated Founder POST plus a human click |
| 6 | Profile B worker | **UNCHANGED** — deployment still `aec9436e`, identical start command, builder, replicas, domain |
| 7 | Secrets / configuration | Untouched. `railway variables` was never run. Start command, builder, replicas, domains identical pre/post; environments 5 → 5; no new service or environment |
| 8 | Deployment points at the intended tree | The live CSP now matches `hq-mount.mjs` from `b889bf4` byte for byte, which only exists at/after that commit |

**Traceability gap for Codex:** this CLI version has no `--message` flag, so the
new deployment carries an empty label where the previous one read
`ae17956 prepare hosted founder test 2`. Record the mapping:
**deployment `a869beae-8d80-4a36-802c-874aef3b5951` = commit `7492873`.**

**Rollback:** redeploy HQ deployment `9ea6bf75-2ed2-4bc8-9a5e-04dfdd900b25`
(the `ae17956` build) from the Railway UI or `railway redeploy`.

---

## 9. M1–M6 status

| Milestone | Status |
|---|---|
| **M1 — real sensor stage** | **DEPLOYED LIVE on HQ (§8). Physical camera/mic confirmation is the open item — Founder test gate.** |
| M2 — core practice loop | **CC-25 DONE** (`2034a5d`): real 193-record corpus, provider registry, CORE-first law, read-time stats join, exclusions enforced, 9 acceptance tests. **CC-26 (drawer), CC-27 (Interview Set), CC-28 (presets) outstanding.** `public/aaa/fixtures.mjs` still drives the UI and still holds the 10 prototype questions — the corpus is not yet wired to any surface, so no UI behaviour has changed yet. |
| M3 — delivery HUD | Engine + gauges + registry exist and now boot; real-behaviour response unconfirmed pending M1 physical test. |
| M4 — review | NOT STARTED. `AnswerRecord`, Answer Library, Film Room, mentor async review not implemented. |
| M5 — Dr Kelly | NOT STARTED by 3500. Provider stack untouched. |
| M6 — expansion | NOT STARTED. |

---

## 10. Provider observations

**Provider sessions initiated automatically: ZERO.**
**Human provider sessions initiated during 3500: ZERO.**

No provider adapter, gate, controller, agent or credential was read, modified or
invoked. The harness used throughout reports
`paidProviderCreationEnabled: false` and `workerRegistrationState: UNAVAILABLE`.
`.env.local` was inspected for key **names only**; no value was read or emitted.
The obsolete 45/45/59 three-test ceremony was **not** touched.

---

## 11. Known bugs / open questions

1. **Vendored-loader accommodation** — see §5.2 Codex review request.
2. **`public/aaa/fixtures.mjs` is still prototype data and still drives the UI.**
   The real corpus landed in `2034a5d` at `public/questions/` but is wired to no
   surface yet. Until CC-26/27/28, the product still shows the 10 prototype
   questions with non-canonical wording ("Tell me about yourself, **and what
   brought you to internal medicine**"). Two question sources now coexist; this is
   the single most important thing to finish next.
3. **Hosted DI panel contains hardcoded prototype content** — the moments
   timeline in `public/aaa/index.html:260` ships literal values ("Direct
   opening", "0:42", "Gesture — Not connected"). These are synthetic and must not
   reach students as telemetry.
4. **`onViewChange(state.view, 'admin')`** is hardcoded to the admin role at
   `public/aaa/app.mjs:128,288`. Needs a real role source before student access.
5. **Perf unmeasured on target hardware** (§7).
6. **F0 now exists** (`c808978`, `public/analytics/pitch-f0.mjs`, McLeod/NSDF,
   validated to 50 cents across 80-440Hz). `pitch_zero_crossing` remains
   MATURITY.REJECTED and unused. **F0 and the FACE family are engine-only: neither
   is surfaced in the Flight Recorder UI yet.** Wiring them into the approved
   cockpit is the next transaction.
8. **FACE is now a 10-lane family** (`public/analytics/face-family.mjs`) fed by the
   blendshape categories the worker previously discarded. Claim safety is enforced
   by test against the executable surface.
9. **HQ deployments so far:** `a869beae` (7492873), `e3c7f7d6` (571054c),
   `47c3455d` (c808978). Profile B `aec9436e` unchanged throughout.
7. **MissionMed OS governance not filed.** `CLAUDE.md` hard-stop rules call for a
   decision record for protected-path touches; no DR was filed for 3500 because
   Codex owns canonical filing and REGISTRY release. Flagged, not assumed.

---

## 12. Rollback points

| Point | Commit |
|---|---|
| Pre-3500 product state | `ae17956` |
| Authority package only, no product change | `bcc78ca` |
| Vision stage repaired | `b889bf4` |

`git revert b889bf4` restores the prior (broken) vision boot without touching the
authority package. `git revert bcc78ca` removes the preserved authority docs
without touching product code.

---

## 13. Codex return instructions

1. Review §5.2 and rule on the vendored-loader accommodation vs. classic workers.
2. Decide whether `Y1-Y2-CAM-V6-3483_CURRENT_STATE.json` should be tracked (§2).
3. File the canonical decision record / REGISTRY release for 3500 (§11.7).
4. Confirm the hosted CSP change against the production security posture, then
   push/deploy (§8) if the Founder has not already authorized it.
5. **Redeploy the HQ service (prefix `3d18`) from this branch** (§8). Until then
   the vision repair is not live. Do not deploy from this worktree's Railway CLI
   context — it is linked to the Profile B worker, not HQ.
6. Resume the 3494A sequence at **CC-26** (question drawer), then CC-27/CC-28, and
   retire `public/aaa/fixtures.mjs` as the UI question source (§11.2).
7. Re-run `npm run check` and `npm test` (expect 327/327) before any further
   product mutation.


---

## 14. Stage A state (Y1-Y2-CAM-V6-3505)

HQ deployment **`edf650b9`** (commit `8721074`), SUCCESS. Profile B `aec9436e`
unchanged. Provider sessions created by automation: **ZERO**.

| Stage A item | State |
|---|---|
| Real authenticated identity | **DONE.** `publicAdmissionState()` gained an `identity` block (own subject/id/roles/founder only, no secrets); `hq-mount` threads `hqSession`. Verified live: `wp:3440 / FOUNDER / ADMIN`. |
| Priya Sharma in normal product | **REMOVED** (0 occurrences in `public/aaa/index.html`). |
| Dr Marcus Hale as real assignment | **REMOVED** from the instant card, the interviewer select and the countdown card. Now reads "Interviewer not yet assigned". |
| Real 193-question corpus in UI | **DONE.** `public/aaa/app.mjs` sources questions from `public/questions/question-store.mjs`; the 10-question fixture is no longer the question source. CORE first, "Tell me about yourself." first. |
| FACE family visible | **DONE.** `public/analytics/di-groups-ui.mjs`; verified 10 FACE lanes mounted. |
| Real PITCH visible | **DONE** (engine + UI). F0 wired at the live PCM frame in `browser-pipeline.mjs`, rendered speaker-relative in semitones. Physical Founder validation still outstanding. |
| Approved 3492 shell | **PARTIAL.** Fixtures removed and the DI ontology converged, but the nav taxonomy and the Performance Studio screen set (Home/New Session/Device Check/Delivery Training/Simulation/Post-Answer/Film Room/Compare/Analytics Lab/Progress/Fingerprint/Results) are **not** ported. |
| Matrix front door | **BLOCKED — not fixable from this repo.** |

### Matrix front-door blocker (exact)

The Matrix is a **WordPress page**, not part of this repository. The AAA shell's own
return link points at `/member-dashboard/`, and `missionmed-hq/public/mmc-private/`
is a different surface (an internal MMC ops shell: Command/Intelligence/Views), not
the student Matrix. Adding the left-column "IV Prep On-Call" entry therefore
requires editing the WordPress member dashboard template/menu on
missionmedinstitute.com, which this repo does not contain and which I have no
authenticated path to.

The HQ side is already complete: `/api/auth/start` performs the WordPress handoff
(302 → `admin-post.php?action=mmac_hq_auth_redirect`), and `/iv-prep-on-call/`
serves the product behind that auth with anonymous access denied. **Only the menu
item is missing.** Whoever edits the member dashboard should add a nav entry
pointing at the canonical HQ route; no duplication of the app in WordPress is
needed.

### Remaining before Stage A is fully closed

1. Matrix left-nav entry (WordPress, outside this repo).
2. Approved 3492 nav taxonomy + Performance Studio screens.
3. Physical Founder validation of pitch (lower/higher/monotone/varied) and of the
   FACE submetrics against a real face.


---

## 15. Y1-Y2-CAM-V6-3507 — Studio shell shipped, diagnostic seam repaired

HQ deployment **`4f2f50b9-b7ef-443f-95f3-cf55e712fbf1`**, SUCCESS, from commit
`18a1a54`. Rollback target: **`220cf220-d5bc-448c-9726-ebbf18340d27`** (the Stage A
build at `d98d4be`).

**Profile B was NOT deployed.** Verified byte-identical pre/post: deployment
`271d3953` unchanged, same start command and builder. A pre-deploy gate asserted
that service id `3d18b017` resolves to `missionmed-hq` and aborted otherwise;
deployment used explicit `-p/-e/-s` targeting, never directory-linked state.

Provider sessions created by automation: **ZERO**.

### The seam defect that mattered

`public/aaa/app.mjs` subscribed via `state.communicationAnalytics?.pipeline`. The
facade from `initializeAnalyticsUi` exposes no `pipeline` property, so with optional
chaining the whole subscription was a **silent no-op** and every FACE and PITCH lane
rendered UNAVAILABLE forever. The FACE and F0 engines were correct throughout; only
the frontend seam was broken. This is why the 3505 report's
"FACE FAMILY UI: WORKING / REAL PITCH: WORKING" was wrong — the lanes were mounted,
not functioning.

Fix: the facade now exposes `onDiagnostic(listener)`, forwarding both emitting
pipelines (`founderPipeline` for cockpit guided runs, `pipeline` for the student
overlay), returning an unsubscribe function, and throwing on misuse rather than
failing silently. It hands out a callback rather than the mutable pipeline, so a
consumer cannot influence capture. Both the Studio shell and the legacy shell use it.

### Route

`/iv-prep-on-call/` now serves `public/studio/index.html`. The pre-Fable AAA shell
remains at `/iv-prep-on-call/legacy/` for comparison and rollback and is no longer
primary. One existing test (`test/3441r/founder-proof-runtime.test.mjs`) was
retargeted to the legacy path because the Founder paid-test controls it asserts live
in that shell.

**Outstanding for Codex:** the Founder paid-test / Dr Kelly controls have NOT been
ported into the Studio shell. Until they are, the provider test path is the legacy
route.

### Tests

364 pass / 0 fail (355 before, +9 in `test/analytics/studio-diagnostic-seam.test.mjs`).
`npm run check`: 35 modules.

Pre-existing, unrelated: `test/3472a/hosted-runtime.test.mjs` has one failing test
("hosted entitlement bootstrap preserves an existing durable usage ledger"). Verified
pre-existing by stashing all 3507 changes and re-running — it fails identically. That
directory is **not** in the `npm test` glob, so it has never been running in CI. Not a
3507 regression; worth a separate look.

### Not proven

FACE and PITCH are subscribed and render correct states under test, but neither has
been physically validated with a real face and microphone. Automated runs produce no
landmarks (synthetic frames yield none by design) and no user activation (suspended
AudioContext), so physical proof requires the Founder.

### PROFILE_B_HEALTH_BLOCKER: OPEN

Railway reports deployment `271d3953` SUCCESS with instance RUNNING, but the
worker's own `/health` route returns 502 "Application failed to respond".
`server/agents/hosted-profile-b-runtime.mjs:77` does
`healthServer.listen(port, '0.0.0.0')` and serves `/health` with 200 (registered) or
503, so 502 means nothing is listening on the expected port. This contradicts the
contamination audit's "currently healthy" claim. Not touched in 3507 per ticket
scope. Blocks Dr Kelly / M5 provider testing; does NOT block student practice.

### Matrix front door — next exact seam

`/api/auth/start` already 302s to
`missionmedinstitute.com/wp-admin/admin-post.php?action=mmac_hq_auth_redirect` and
returns authenticated, so the HQ half is complete. `wp-content/mu-plugins/` IS in
this worktree, but no plugin here renders the product nav
(`missionmed-launch-sev1-fixes.php` only filters arena links;
`missionmed-hq-auth-handoff.php` only registers the `admin_post` action), and
`wp-content` is not deployed by Railway, which runs `node missionmed-hq/server.mjs`.

**Remaining work is one WordPress nav entry on the member dashboard pointing at
`https://missionmed-hq-production.up.railway.app/api/auth/start`. No code required —
Founder or WordPress admin action.**
