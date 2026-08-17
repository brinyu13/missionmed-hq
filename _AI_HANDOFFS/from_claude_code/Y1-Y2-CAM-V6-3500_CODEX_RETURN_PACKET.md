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
| `npm test` | 314 pass / 0 fail | **327 pass / 0 fail** |
| `npm run check` | PASS, 28 modules | PASS, 32 modules |

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

## 8. Deployment — PUSHED, NOT DEPLOYED

The Founder authorized push + deploy. The push succeeded. **The deploy did not
happen, and I stopped rather than force it.** Evidence:

- Pushed `ae17956..7045419` to the 3440 feature branch. No force push.
- Polled the hosted route 21 times over ~5 minutes, plus a later fresh check.
  `https://missionmed-hq-production.up.railway.app/iv-prep-on-call/` still serves
  `script-src 'self'` with **no `'wasm-unsafe-eval'`**. Pushing this branch is not
  a deploy trigger.
- `origin/HEAD` → `refs/heads/main`, and `origin/main` is `4c86e85` (2026-08-13,
  "Restore canonical Critical and Matrix custody"). Our commits are **not** on
  `main`, and `main` does not contain `ae17956` or `89f8cae` either — so the live
  HQ service is running a pinned deployment off this feature branch, consistent
  with 3483's recorded-deployment model.

**Why I did not deploy via the Railway CLI.** `railway status` in this worktree
resolves to project `missionmed-hq-fix005` / environment `production` with the
linked service:

```
ivprep-profile-b-worker   service ID 294a0bef-9cd2-43ff-97e8-4b88fa9e873d
```

That is the **Profile B avatar worker** (3483 records the worker service ID prefix
as `294a`), *not* the HQ web service that serves `/iv-prep-on-call/` (3483 records
the HQ prefix as `3d18`). A `railway up` from here would have deployed the wrong
service — and specifically the paid provider worker. That is the unbounded,
wrong-target infrastructure change 3500 forbids, so it was refused on evidence
rather than attempted.

**What is actually needed:** redeploy the **HQ** service (prefix `3d18`) from the
3440 branch at commit `7045419` (or later). That requires Railway access to the
correct service and is one action for the Founder or Codex. No migration, no
infrastructure change, no secret rotation is involved.

Until that redeploy happens, the vision-stage repair is **not live**, and the
hosted product still cannot render wireframes.

---

## 9. M1–M6 status

| Milestone | Status |
|---|---|
| **M1 — real sensor stage** | **Code path repaired and verified to boot. Physical camera/mic confirmation OUTSTANDING (Founder). Pushed but NOT DEPLOYED — see §8.** |
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
6. **`pitch_zero_crossing`** is the only pitch-adjacent registered signal. It is a
   zero-crossing proxy, not F0. Per 3500 this must surface as
   `PITCH — UNAVAILABLE` unless genuine F0 is implemented. Not yet audited.
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
