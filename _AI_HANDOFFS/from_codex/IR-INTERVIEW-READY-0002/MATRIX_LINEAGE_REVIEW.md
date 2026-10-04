# Matrix lineage review for Interview Ready

Verdict: **READ-ONLY FINDING; CURRENT SHARED-SHELL AUTHORITY GAP REMAINS.** Exact live custody is established for the inspected files. A fully reconciled, approved current shared-shell baseline is not established. IIQ-1203 used a dedicated discovery exception and did not update or cure the shell lock. Do not replace any shell asset, rewrite the manifest, revive a completed decision, or treat this report as runtime execution approval.

Observed: 2026-10-04, evidence collected through 15:27:41Z. Review scope: bounded Matrix lineage and additive external Interview Ready discovery seam. Risk: LOW read-only archaeology; report creation only. No provider/runtime mutation, browser identity, student data, credentials, deployment, registry or lease mutation occurred. No stale Matrix preflight was run.

## Custody and boot

- Assigned product base: `bc7fad3b9739e2cb4125b4423f5c4bfcb25eafaa`, branch `codex/ir-interview-ready-0002-storyforge`.
- OS base and observed HEAD: `1e8374664751ad911280d83d8c60e200a224245d`. `CURRENT.md` was generated `2026-10-04T08:12:04-04:00`. No IR-INTERVIEW-READY-0002 mission was found at that snapshot; Foreman owns fresh registration.
- Canonical HQ origin: `https://github.com/brinyu13/missionmed-hq.git`; `origin/main` = `0feee579b0a9f2c90529220899f6cf6d21b8cd05`. Canonical checkout HEAD is a different lineage, `4d1a8f5950668eed35a619f9a17aca7553c8308c`; it was not used as a donor or modified.
- Immutable `origin/main:_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md` SHA256 = `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357` (accepted MR-079 identity).
- Universal validator returned `BOOT_DEPENDENCY_VALIDATION_PASS profile=universal hq_tip=0feee579b0a9f2c90529220899f6cf6d21b8cd05`.
- Pull/fetch/push was not performed under this expressly read-only dependency scope. Thus this report does not independently assert current remote-tip synchronization beyond the supplied OS snapshot and inspected Git objects.
- Local lock and canonical HQ `origin/main` lock share SHA256 `f8d1496763bed12a2333be6e9286256f814fcd5f8c36a45af72ae8cb397b7d90`. Lock `last_updated_utc` = `2026-09-17T14:00:00Z`, owner Brian. HQ reconciliation commit `0feee579b0a9f2c90529220899f6cf6d21b8cd05` is dated `2026-09-17T09:48:41-04:00`.

The assigned report did not exist before creation. Scoped ordinary Git hygiene preflight passed without dirty-path overlap; its only location warning concerned the explicitly assigned worktree. Existing and concurrent dirty `_AI_INPUTS/`, `supabase/.temp/cli-latest`, registration request, Interview Ready build/source/data and production asset manifest were preserved. No protected source files are present at the inspected `wp-content/plugins/missionmed-hub/...` paths in this product worktree; it must not be represented as a current Matrix source checkout.

## Exact contradiction

Live plugin root: `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`, read through existing SSH alias `missionmed-kinsta` with `BatchMode=yes`.

| Surface | Fresh live SHA256 | Immutable/registered evidence | Determination |
| --- | --- | --- | --- |
| `includes/class-mmed-student-os.php` | `b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d` | Same hash at HQ `28a556730eebabee8c60d1575c05fdbbf6e3ec90`, dated `2026-09-04T10:18:03-04:00`; same hash pinned in lock, source owner `MX-DASH-6010B` | PHP source identity is established. Both immutable source and live line 61 select `student-os.16ca42c53ca2e890.js`. This selection predates IIQ-1203. |
| `assets/student-os.16ca42c53ca2e890.js` | `0b112c74e770e3b8decc2c7d8e6a6b73570647aa5f759a3a85cea68ec82f4201` | HQ original asset and unversioned source at `0a09411520acedb7a4ffdc7c48470674917302d0`, dated `2026-08-15T23:12:02-04:00`, hash `16ca42c53ca2e890a1e791fc2731fc3b0c86a9082f5f801198fc1a12274593fa` | Live bytes differ from the original filename-addressed object. No current immutable owner source/DR/manifest pin for live `0b112...` was established within scope. |
| Lock `student_os_js` record | Pin `38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a` | `assets/student-os.38507e1ac8a555ba.js`, source `ffb44cb55fbc6a6c88a200d626fdc3f43f49a881`, owner `Y1-CAM-4005R`, validation `MX-DASH-6020A`, version `20260904T190225Z` | Pin concerns a different file from the live PHP selection. Presence or hash of this other file would not establish that the shell selected it. |
| `includes/class-mmed-rest-api.php` | `c7285a39f698101b9ec7a5e6c7fb6a535c08e1247e9cf02dc5dece8897b9c461` | Same hash at HQ `2dca23409db0f1529ab8cd119d098eb2211ed692`, dated `2026-09-07T12:09:34-04:00` | Source byte custody established; this file is not one of the inspected shell lock records. No authority for changing it follows. |
| Existing MU `missionmed-matrix-interviewiq-entry.php` | `94d1668e8c45cf9fb830c7c10f78151ba25c4adb23904bce0c166ad115767f7c` | Same hash in OS IIQ-1203 closure at `handoffs/from_codex/IIQ_1203_MATRIX_DISCOVERY/IIQ_1203_PRODUCTION_CLOSURE.md` | Existing approved discovery boundary is preserved. |

The JS read was an origin file hash, not a fresh authenticated browser loaded-resource capture or fresh public-cache hash. This review does not claim either. The narrow conclusion is exact PHP-selected origin lineage, not full runtime acceptance.

DR-295, dated 2026-09-17, explicitly pins both JS `38507...` and PHP `b3f797...` (lines 24 and 26) and authorizes only a one-time manifest reconciliation. Its expiry includes **“new unexplained runtime drift”** (line 8); it cannot now authorize changing live `0b112...`, rewriting the lock, or restoring either older JS. Its lines 46–49 require source/origin/public verification from accepted owner commits. OS filing commit: `f5d413d8257d1b310b54a1dba9d172728d9fa6a1`, `2026-09-17T09:43:16-04:00`.

## What IIQ-1203 does and does not resolve

Current OS mission IIQ-1203 is `done`, owner Brian, builder `codex-iiq-1203-foreman`, gate `MATRIX_DISCOVERY_LIVE_VERIFIED`; authority entries DR-371/372 are `COMPLETED_PRESERVATION_REMAINS_BINDING`, canonically filed/read back. Closure commit `8a70b442917578592c6487596e4865c0241b0da0` is dated `2026-10-03T18:11:33-04:00`.

DR-371 line 17 specifically permits a dedicated InterviewIQ discovery extension, a namespaced renderer copied from freshly verified live bytes, and narrowly scoped renderer selection. It also says **“No ... shared shell/router/Calendar/entitlement/auth edits, or runtime-lock rewrite is authorized”** and **“Record existing lock/runtime contradictions explicitly and preserve all existing asset bytes.”** Line 29 says its Founder approval **“permits only this bounded discovery exception; it grants no stale lock override or independent-review bypass.”** Expiry is independently verified production discovery closure (line 8).

The closure reports original Matrix V2 renderer `56dee16717478f9351cb038e6a0976c3f4fad71e522b092b552cff6754a66235` preserved, namespaced discovery renderer `8d4b57a24132681f6d02fd8c072e3368246b9e5d4e56a3d68e8bbb12c5aba9ee`, and entry hash `94d166...`. This is a separate dashboard renderer selection, not a new `student_os_js` lock. The matched live MU code selects the discovery renderer only for handle `mmed-dashboard-v2-js` and installs an external IQ anchor through `wp_footer`.

Therefore IIQ-1203 cannot be cited as approval for live shared-shell `0b112...` or borrowed to execute an IR integration. Preserve its existing entry, eligibility, renderer handle selection, immutable assets and InterviewIQ application/data.

## Actual additive seam

Inspected live `class-mmed-student-os.php` has no generic module-registration filter: `init()` contains a reserved-hook comment (line 38), `get_active_modules()` is private (409), and returns its array directly (590). `get_initial_data()` directly returns modules plus profile/stats/access (364–400). Existing `apply_filters` concern runtime enabled, StoryForge enabled and CAM launch URL; they are not generic discovery hooks.

Inspected live REST class uses namespace `mmed/v1`; `/user/profile` returns profile only, and its lone call to `get_initial_data()` extracts `profile` (879–882). No native Matrix bootstrap/modules REST endpoint or module filter was found. WordPress REST response decoration on `/user/profile` would not feed the shell's initial module registry. Do not invent such a seam.

The shell reads `window.MMED_OS.modules` at initialization (JS lines 4, 17, 6621). However, a generic registry append with `launch_url` is insufficient: navigation reads that field (474) but only treats `cam` and `ivprep` as external links (588–591); an arbitrary IR route would become a hash route. Modifying that behavior would touch protected shell/router scope.

The smallest technically evidenced alternative is a **new, dedicated IR-owned MU extension** that server-gates a direct external anchor into the existing MATCH TOOLS list using current `.sos-nav-*` markup, a unique IR marker, an idempotent installer and a listener/observer retained across shell route rerenders and removed on `pagehide`. It must append only IR, leave existing anchors/active route/observers/global module state unchanged, and point to the separately authorized IR product route. Existing IIQ MU code demonstrates this physical seam, but supplies no IR authority. Do not change its renderer selection or copy its full renderer for a rail-only request.

This is a registration candidate, not a tested IR integration. The IR product owner must supply exact target URL and visibility/eligibility contract; Matrix presentation must never grant access, modify enrollments or infer signed roles. Founder/Admin preview and mobile route-rerender behavior need fresh acceptance after independent review.

## Decisive authority boundary

Canonical `_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_PROTOCOL.md` line 7 applies the lock to tasks touching Matrix shell wiring, app assets or deploy/cache behavior. Lines 30–38 require preflight before editing a protected Matrix runtime file, with `--assets all` for shell/router work. Lines 44–50 require stopping on the exact stale warning; lines 54–75 require guarded deployment or a Brian-authorized manual equivalent. Lines 106–115 require Matrix-related prompts to carry the all-assets preflight instruction. These clauses do not explicitly provide a generic addon exemption.

There is a meaningful distinction between editing a listed protected shell file and creating an isolated extension, but this reviewer cannot convert that distinction into a sovereign exemption. No Matrix guard was run, so no actual guard warning is claimed. The observed unresolved live/lock conflict must remain disclosed under BOOT/AGENTS hard stops; an all-assets PASS cannot be truthfully inferred from this archaeology.

Foreman may prepare new additive registration from this evidence. Before execution, the current owner must resolve the boundary in a freshly filed, reviewed decision: either (a) reconcile exact current shell source, selected origin/public bytes and manifest under fresh current Matrix authority, or (b) expressly authorize the exact IR-only extension boundary while preserving every shared file, asset and existing renderer selection, state how protected runtime guard requirements are satisfied for that write set, and bind current preimages, origin/public verification, narrow fencing, rollback and independent acceptance. Option (b) must not silently approve `0b112...`, override a stale warning, or use completed DR-371 as executable authority. If the fresh contract requires full-shell PASS, option (a) remains prerequisite. This report issues no architecture ruling or permission.

Stop here after the report-only scoped commit. No push, merge or deployment. Canonical filing remains Foreman's responsibility; a local commit alone is not pushed-filed authority.

## Reproducible evidence commands

All executed reads were inspected. Core commands were `git show <exact-commit>:<path>`, `git log --all -- <exact-path>`, `git ls-tree`, `shasum -a 256`, and SSH `sha256sum`/`sed`/`grep` limited to the named Matrix files and existing IIQ entry. Source hashing was repeated only after checking object/path existence; missing files yielded no asserted source hash. An early lookup used OS rather than HQ for `28a556...` and returned `bad object`; the correct canonical HQ read established the hash above. No empty-stream hash is treated as evidence.

```text
python3 /Users/brianb/MissionMed_OS/tools/validate_boot_dependencies.py --hq-git-dir /Users/brianb/MissionMed/.git --os-root /Users/brianb/MissionMed_OS
git -C /Users/brianb/MissionMed show 28a556730eebabee8c60d1575c05fdbbf6e3ec90:wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php
git -C /Users/brianb/MissionMed show 0a09411520acedb7a4ffdc7c48470674917302d0:wp-content/plugins/missionmed-hub/assets/student-os.16ca42c53ca2e890.js
git -C /Users/brianb/MissionMed show 2dca23409db0f1529ab8cd119d098eb2211ed692:wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php
ssh -o BatchMode=yes missionmed-kinsta 'sha256sum /www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php /www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php /www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub/assets/student-os.16ca42c53ca2e890.js /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-matrix-interviewiq-entry.php'
```
