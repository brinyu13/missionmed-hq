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

Both are bounded and independently revertable. Product code and authority
documentation were kept in separate commits.

**Not pushed.** Branch is 2 ahead of origin. See §8.

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
| `npm test` | 314 pass / 0 fail | **318 pass / 0 fail** |
| `npm run check` | PASS, 28 analytics modules | PASS, 29 analytics modules |

New: `test/analytics/vision-stage-boot.test.mjs` — 4 guards pinning the CSP
directive (and asserting broad `'unsafe-eval'`/`'unsafe-inline'` stay absent),
the resolver routing in both workers, the resolver contract, and the presence of
the vendored glue the resolver depends on.

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

## 8. Deployment

**Nothing deployed. Nothing pushed.** Branch is 2 commits ahead of origin.

Railway starts `node missionmed-hq/server.mjs` (`railway.json`). Whether a push
to this branch auto-deploys is a Railway service setting not visible from the
repo, so the blast radius of a push could not be verified from here. Because the
change alters a **production security header**, the push/deploy decision was left
to the Founder rather than assumed. Awaiting that decision.

Deploy consists of pushing these two commits; no migration, no infrastructure
change, no secret rotation is involved.

---

## 9. M1–M6 status

| Milestone | Status |
|---|---|
| **M1 — real sensor stage** | **Code path repaired and verified to boot. Physical camera/mic confirmation OUTSTANDING (Founder). Not yet deployed.** |
| M2 — core practice loop | NOT STARTED. Shell views exist (`instant`/`custom`/`room`/`vault`); question corpus is 10 prototype fixtures in `public/aaa/fixtures.mjs`, not the canonical Core Ten wording, and not the MR142/behavioural corpus. CC-25…CC-28 outstanding. |
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
2. **`public/aaa/fixtures.mjs` is prototype data.** 10 questions with
   non-canonical wording (e.g. "Tell me about yourself, **and what brought you to
   internal medicine**" vs the canonical "Tell me about yourself."). The 3494A
   import manifest requires 10 CORE verbatim + 142 MR142 + 41 behavioural. Do not
   mistake the fixtures for the corpus.
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
5. Resume the 3494A sequence at **CC-25** (question data import) — the M2 gate and
   the largest remaining block to Founder MVP.
6. Re-run `npm run check` and `npm test` (expect 318/318) before any further
   product mutation.
