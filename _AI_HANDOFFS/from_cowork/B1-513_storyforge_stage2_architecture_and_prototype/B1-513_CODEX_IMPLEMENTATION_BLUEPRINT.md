# B1-513 Codex Implementation Blueprint

Everything needed to generate the final Codex execution prompt **after Founder prototype approval (FD-3)**. Until that approval this blueprint is inert: the prototype is not silently production visual authority, and no binding execution prompt exists yet.

## 0. Preconditions to binding
1. FD-3 prototype approval (with any Founder-requested visual/copy amendments folded in).
2. FD-1 consent wording approved; FD-2 default confirmed.
3. Clean, pushed baseline at or after custody HEAD `1fb19f4d0beb90c03dcefcb7f602cb0c465f90c2`; Critical Systems 0 FAIL; live release still `v-10688bb24bca7965` (re-verify at execution time; if production has advanced, re-run the doc 01 baseline check first).

## 1. Execution shape: four tickets, one per release
Recommended ticket IDs: B1-514 (R1), B1-515 (R2), B1-516 (R3), B1-517 (R4). Each follows the proven B1-511/512 operating pattern: canonical baseline lock → change-budget ledger → implementation → full local suites → deterministic release → fresh locked backups + restore rehearsal → guarded migration → Railway/Kinsta cutover → Founder-first canary → scope ladder → Critical Systems reconciliation → complete handoff + MANIFEST.sha256 under `_AI_HANDOFFS/from_codex/B1-51x_*/`.

## 2. Change budget per ticket (expected hand-authored surfaces)

**B1-514 (R1):** `public/app.js` (consent modal, visibility card/chips, directory + drawer, direct review controls, Review Check UI, settings panel, activity beacon — at the seams enumerated in doc 22 §2), `public/styles.css` (namespaced b1513 additions from the approved prototype CSS), `server/app.mjs` (consent/visibility/activity routes), `server/admin-console.mjs` (directory/review-check/direct-review extensions), new `server/visibility.mjs` + `server/activity.mjs` (bounded modules), R1 migration (doc 10), `server/config.mjs` + `server/flags.mjs` (5 new flags + kill switches), focused tests, release generators untouched.

**B1-515 (R2):** `public/app.js` (`b1513VersionSurface` region + recorder version-sink), `server/app.mjs` + new `server/story-versions.mjs`, R2 migration, `server/product-configuration.mjs` (versions registry validation incl. full_story-unhideable + original-absent rules), tests.

**B1-516 (R3):** `public/app.js` (Inspiration destination + wizard), new `server/inspiration.mjs`, R3 migration + 81-prompt seed (from the approved `PROMPT_LIBRARY.json`, stable IDs preserved), presentation projection, tests.

**B1-517 (R4):** admin content-manager depth in `admin-console.mjs`/`app.js`, analytics views, optional FD-4 tool. No migration expected.

Files NOT to touch, ever, in these tickets: `missionmed-hub` protected assets, WordPress roles/identity, LearnDash, provider/model config, R2 ACLs, story-media activation state, Matrix assets, `supabase/migrations` root, reconciliation, `auth.js` trust chain.

## 3. Authoritative inputs for the execution prompt
- Approved prototype file + `prototype/extensions.js` / `extensions.css` / `build.mjs` patch list (the UI diff, seam by seam — reuse the markup and copy verbatim except where FD amendments apply; discard the shim/backend entirely).
- Contracts: docs 03 (versions), 07 (visibility/consent), 06 (console), 08 (activity), 09 (config), 10 (schema/migrations), 11 (RLS + negative matrix), 12 (IA/a11y/responsive), 13 (flags/train/rollback), 14 (acceptance gates + adversarial probes), 04/05 (Inspiration product + research).
- Prototype-only elements to discard: fetch/history/media shims, synthetic dataset, blob: playback allowance, scripted transcripts, in-memory persistence (doc 22 §4).

## 4. Per-ticket acceptance (summary — full gates in doc 14)
Unit + PostgreSQL + acceptance + browser E2E + conformance/accessibility all green with the release's focused suites added; axe serious/critical = 0 on every new surface at all three text sizes; 390×844 zero horizontal overflow; N-matrix negative tests green; migration apply/rollback/reapply + restore rehearsal; flags default-off with kill-switch drills; Founder canary scripts as specified; Critical Systems 0 FAIL before and after; truthful handoff receipts (no simulated success, ever — inherited house rule).

## 5. Model routing (doc 13 §4)
GPT-5.6 Sol High: R1 `observable()` predicate + RLS + consent transaction; R2 version engine + migration + conflict semantics; R3 selection logic + promotion transaction; privacy-path defects. Terra High: directory/profile/Review Check plumbing, activity beacon, config panels, deterministic releases, backups/receipts, canary execution, screenshot evidence, Critical Systems reconciliation. If a Terra-assigned lane meets a genuine correctness wall, escalate that lane alone.

## 6. Canary identities
Founder `brinyu` (WP 1, StoryForge `09c3b822-…`, student + adminConsole) — first for every lane; `Brian_test` (WP 107, admin) — admin-parity checks; one named consenting eligible student for the student-side canaries (as with B1-511A, never an unconsented real student); one ineligible + anonymous probe per cutover.
