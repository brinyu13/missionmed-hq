# PSV Foreman Control-Tower State

Updated: 2026-09-20T22:43:27Z

## Product and outcome

- Mission: `PSV-PROTOTYPE-0001`
- Product: Program-Specific Personal Statement capability inside File Vault
- Current milestone: M5 release candidate — M2 remains live and independently sealed; M3-M5 are locally complete and awaiting exact-commit independent verification
- Terminal condition: Continue through M2-M5 to independently verified, production-ready AAA completion, stopping only for a true human-only privacy or sibling-owner authority gate on the critical path

## Repository truth

- Worktree: `/Users/brianb/MissionMed_worktrees/program-specific-ps-engine`
- Repository: `https://github.com/brinyu13/missionmed-hq.git`
- Branch: `codex/psv-prototype-foreman`
- Base HEAD: `0feee579b0a9f2c90529220899f6cf6d21b8cd05`
- M2 sealed/pushed HEAD: `981f0d16fc091abb4f54132c15c917c640021c34`
- Prior branch: `fable/program-specific-ps-engine-architecture`
- Upstream at initialization: `origin/main` at the same base HEAD
- Preserved dirty state: untracked `_AI_HANDOFFS/from_fable/` package only
- Git index lock: absent
- Workers: independent M2 production verifier passed exact commit `981f0d16fc091abb4f54132c15c917c640021c34` against live v0.2.1. The first M3 verifier correctly failed commit `fa41f382a284c171735ef8b93ee6ef9cd1b6d84d`; the second independently failed `8647f2557b65a5a1a592ddefbd8af97600aba83f` on a stale-counter race, LSH false-clear, similarity fail-open paths and unchecked item transitions. Each finding is now narrowly repaired with independent-process concurrency and commit-failure recovery coverage. Astra 6 completed the required read-only presentation review; Codex implemented its bounded reconciliation without changing contracts or authority boundaries.

## Authority and continuity

- MissionMed OS: `f02766ba11cfa10203775b316de1e2cdb2f337c3`, equal to `origin/main`
- Active decisions: DR-311, DR-312, DR-313, DR-314 and DR-315
- Brain: `04ca13d4097096203b9f0b8fa68a0937556fd214`, equal to upstream and clean
- Universal boot: PASS after DR-315
- `PSV-PROTOTYPE-0001` boot: PASS after DR-315
- Canonical Founder identity: WordPress login `brinyu`, user ID `1`
- WP-CLI plugin commands: known exit 139; global repair prohibited
- Approved activation: native WordPress Admin Plugins screen as `brinyu`, exact plugin/version only

## Candidate

- Live plugin: `missionmed-file-vault-ps` version `0.2.1`; local M3-M5 release candidate: `0.5.0`
- Live ZIP SHA-256: `71c922b64d7c5e3c0a54bb7bf195ff7304076b741cb0ea62e3b9206f84645376`
- ZIP integrity: PASS
- Manifest: 21/21 PASS at initialization
- Candidate delta from live M2: additive isolated batch, provider-attempt, research-quarantine, and privacy-fingerprint storage; no existing File Vault or RISE code/table mutation
- Tracked M2 source: `wp-content/plugins/missionmed-file-vault-ps/`, materialized byte-for-byte from the sealed v0.1.0 package; 21/21 manifest hashes PASS before editing
- Tracked validation surface: `psv/local-harness/`, `psv/contracts/` and `psv/docs/`, copied from the sealed evidence package without changing the preserved Fable handoff
- M2 release gate: PHP/JS/JSON lint PASS; M2 contract 24/24; M2 runtime 12/12; disposable WordPress API 100/100; Playwright/Chrome UX 22/22; production package/deployed manifest 21/21; independent production verification PASS
- M3-M5 release gate: M2 contract 24/24 + runtime 12/12; M3 contract 29/29 + runtime 8/8; M4 contract 14/14 + runtime 9/9; M5 contract 16/16 + runtime 7/7; disposable WordPress API 126/126; Playwright UX 36/36 across desktop, 820px and 390px with zero console/page/CSP errors; validator scenarios PASS; all plugin PHP lint PASS; manifest JSON and JavaScript parse PASS
- M3 repaired findings: atomic two-worker claim/slot ceiling; independent-process concurrency stress; every real provider call atomically consumes a daily slot; cap exhaustion pauses without retry loss; transactional job creation and claimed-item transitions; injected commit-failure recovery with provider idempotency; checked requeue/approval/refresh/stale-counter persistence; candidate-custody protection; correct requeue status; migration column/index postconditions; checked ZIP construction
- M4: exact program research prompt, strict Markdown/provenance validation, rejected/validated quarantine, owner-scoped handoff, immediate Essential fallback, and no direct RISE write
- M5: keyed exact and near-duplicate protection using opaque HMAC/MinHash material only, complete one-position bucket recall, fail-closed reads/backfill, salt-keyed algorithm migration, explicit quality-first near review, atomic document/fingerprint persistence, responsive/accessibility/performance hardening, and Astra-directed StoryForge/RISE-family presentation reconciliation

## Current production truth

- Prototype deployed: YES
- Target plugin directory: `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-file-vault-ps/`
- Prototype active: YES
- Prototype tables and documented options: PRESENT
- PHP: `8.2.29`
- Required extensions `zip`, `dom`, `mbstring`, `json`: PASS
- `wp-config.php` PHP lint: PASS; canonical insertion marker count: 1
- Private rollback directory: present and writable
- RISE origin: configured
- File Vault class: loaded
- File Vault mode: `on`
- Public home and login: HTTP 200 at `https://missionmedinstitute.com`
- Logged-out PSV REST bootstrap and namespace: HTTP 404
- Authenticated browser baseline: File Vault rendered successfully for `brinyu` in administrator view
- MMPS log lines: 0; recent fatal lines: 0
- Dedicated PSV key: PRESENT as a boolean presence check; value never printed or recorded
- `MMED_PS_PROTO_ALLOW_USER_IDS`: `1`
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI`: UNDEFINED
- Production testing constants: UNDEFINED
- Prototype access: `allowlist`; `mmed_ps_proto_allow_admins=0`
- Prototype rows at latest independent M2 readback: two synthetic ROOTs, eleven runs, two library documents; no real ROOT
- Real provider: `openai-responses` / `gpt-5.6-terra`; Essential PASS; Deep PASS; Deep Research Needed PASS
- Independent verdict: PASS — the prior hash finding was resolved as stale-baseline interpretation: live File Vault controller/repository/scanner and mutable assets exactly match canonical commit `264293554a4f9b152ffb98ce8d707045c6bf5993`, which DR-308 and the current passport register as clean current custody; `15962cbc…ec3d1b5` is the accepted 1018 baseline, not the later controller pin
- Production mutation by this Foreman run: exact new plugin directory, two documented `wp-config.php` constants, four namespaced tables, documented namespaced options, isolated synthetic prototype rows only

## Health and accepted capabilities

- Existing File Vault and RISE: preserved after activation and live use; File Vault roster/upload dialog and live RISE registry rendered normally
- Package/hash/manifest, rollback surface and production prerequisites: PASS
- Live RISE, live OpenAI, five-candidate generation, non-default selection, reconstruction, isolated save and DOCX download: PASS

## Provider and privacy state

- Existing Railway OpenAI credentials: isolated to MissionMed HQ and IV Prep; reuse prohibited
- Authorized credential: one new dedicated project-scoped PSV OpenAI key in Kinsta server-side configuration only
- Privacy gate: CLOSED
- Real student PS prose to AI: PROHIBITED
- Initial provider proof: built-in fictional synthetic ROOT only

## Rollback target

- Known-good runtime: prototype absent and inactive; existing File Vault and RISE unchanged
- Ordered rollback: soft off, hard off, native WordPress deactivation, then remove only `wp-content/plugins/missionmed-file-vault-ps/`
- Prototype tables/data remain preserved unless a separate Founder purge decision exists

## Waiting dependency

- No remaining local engineering blocker. Production transmission of real-student ROOT prose remains a genuine Founder privacy decision and is not authorized by DR-314/DR-315.
- Writes into existing File Vault or RISE code/data remain deferred unless a proven owner contract or separate owner authority permits the exact integration.

## Next critical path

1. Seal and push the exact v0.5.0 release-candidate commit.
2. Obtain fresh independent verification, including explicit retest of every prior M3 P1 and the M4/M5 privacy/owner boundaries.
3. Promote only after fresh BOOT/authority/preflight, exact backup/rollback, synthetic-only live acceptance and a final independent production readback; keep the real-student AI gate closed and do not mutate sibling-owned surfaces without authority.

## State delta log

- 2026-09-20T17:32:13Z — Foreman packet adopted; volatile truth refreshed; dedicated key remains the sole external dependency; production remains unmodified.
- 2026-09-20T17:35:45Z — Read-only M0 refresh confirmed absent PSV tables/options, File Vault mode on, protected runtime hashes unchanged, public negative routes closed and authenticated File Vault healthy. Kinsta-shell DNS could not resolve the obsolete hostname `theresidencyacademy.com`; authoritative WordPress home/site URL is `https://missionmedinstitute.com`, which passed locally.
- 2026-09-20T17:50:53Z — Added the exact two DR-313-authorized server-only constants to `wp-config.php` under config lease epoch 3196. PHP lint and boolean readback passed; the lease expired closed with zero active claim.
- 2026-09-20T17:56:08Z — Uploaded and atomically installed the exact 21-file v0.1.0 plugin package under PATH lease epoch 3197. Deployed hashes and PHP lint passed; no preimage existed because the path was absent.
- 2026-09-20T18:04:00Z — Activated the plugin natively as `brinyu` under PATH lease epoch 3198; all four isolated tables and documented options were created. The lease expired closed.
- 2026-09-20T18:04:53Z — Set `mmed_ps_proto_allow_admins=0` under PATH lease epoch 3199. The known WP-CLI exit-139 occurred only after the success response; a separate readback proved the value persisted, and the lease released normally.
- 2026-09-20T18:18:24Z — Completed live synthetic-only RISE/OpenAI acceptance: Essential PASS, Deep PASS, Deep Research Needed PASS, three rotating Deep strategies, protected ROOT PASS, isolated approval/save PASS, and authenticated DOCX download audit PASS. File Vault and RISE regression checks remained green.
- 2026-09-20T18:24:00Z — Fresh independent non-builder verdict FAIL: immutable File Vault JS/CSS matched, but live controller `ca4abfe4…cf555` conflicts with passport/DR-166 accepted `15962cbc…ec3d1b5` and no superseding authority was found. The hash was unchanged from this mission's preflight, so no prototype-caused regression was observed and no rollback or File Vault mutation was performed. Release remains unsealed; STOP.
- 2026-09-20T18:44:48Z — Foreman blocker loop located the exact later custody: all current protected File Vault hashes match canonical commit `264293554a4f9b152ffb98ce8d707045c6bf5993`, which DR-308 and the current passport register as clean current production custody. A fresh non-builder independently confirmed that `15962cbc…ec3d1b5` is the accepted 1018 baseline rather than the current pin, rechecked package/config/synthetic-only data/File Vault REST/RISE health/log/lease gates, and returned PASS. M1 is sealed; STOP for Founder review; no M2 work started.
- 2026-09-20T19:42:00Z — Founder accepted live M1 and authorized autonomous M2-M5 continuation. MissionMed OS registered DR-314/DR-315 at canonical commit `f02766ba11cfa10203775b316de1e2cdb2f337c3`; GitHub readback, universal BOOT and PSV mission BOOT passed; registry lease epoch 3219 released, and the default OS checkout was safely fast-forwarded under registry lease epoch 3222 with unrelated dirty state preserved.
- 2026-09-20T19:45:00Z — Materialized the sealed v0.1.0 plugin, local harness, contracts and deployment documentation into tracked product paths without altering the preserved Fable handoff. Baseline plugin manifest verification passed 21/21. M2 implementation is active; production has not changed in this continuation.
- 2026-09-20T20:08:09Z — M2 25% checkpoint sealed locally. Implemented complete-ROOT read-only editorial context, five distinct evidence-bounded strategies, recommended/default plus accessible alternatives, server-resolved candidate selection, complete-PS reconstruction and truthful per-candidate/set-level validation. Independent review found and the Foreman repaired a false-PASS display condition, legacy prompt-provenance drift, stale strategy labels and weak copied-opening detection. Final gates: contract 24/24, runtime 11/11, disposable WordPress API 100/100, browser UX 22/22, no console/page/CSP errors. Production remains on accepted M1 v0.1.0 and unchanged by this M2 continuation.
- 2026-09-20T21:20:00Z — Guardedly promoted exact M2 commit `981f0d16fc091abb4f54132c15c917c640021c34` as v0.2.1 after fresh BOOT/authority/preflight and package checks. Synthetic ROOT plus real RISE/OpenAI returned five valid candidates; a non-default candidate was selected, reconstructed, approved, saved and downloaded. Existing File Vault and RISE behavior and protected hashes remained unchanged. Fresh independent production verification passed with no P0/P1 or unverified condition.
- 2026-09-20T22:01:40Z — M3 batch core reached its 50% functional gate locally. Added 100-program specialty-isolated jobs, durable items/claims/idempotency/retries, Deep/Essential defaults/overrides, exception-focused approval, selective regeneration preservation and selected/all-approved ZIP export. Static contract 21/21, runtime scale 8/8 and full browser journey 29/29 passed; a CSP-unsafe inline progress style found by the first expanded walkthrough was replaced with a semantic `<progress>` control. Live production remains sealed M2 v0.2.1 and unmodified by M3.
- 2026-09-20T22:12:00Z — Independent verification of M3 commit `fa41f382a284c171735ef8b93ee6ef9cd1b6d84d` returned FAIL on four P1s: browser-only concurrency, incorrect provider-attempt accounting/cap behavior, candidate relabel custody, and unchecked/non-atomic persistence. No production action was taken.
- 2026-09-20T22:30:00Z — Foreman repaired all four P1s plus the verifier's P2 migration/status/ZIP evidence findings. Expanded adversarial coverage proved server concurrency, per-network-call cap accounting with pause/resume, atomic creation, fail-closed result linkage, and saved-alternative custody.
- 2026-09-20T22:38:00Z — M4 and M5 functional scope completed locally: authority-safe research prompt/upload/quarantine/owner handoff; Essential fallback; no RISE write; keyed opaque cross-student exact/near protection; explicit quality-first near review; atomic fingerprint persistence; File Vault/RISE/ProgramEvidenceBundle boundaries preserved.
- 2026-09-20T22:43:27Z — Astra 6 completed its required read-only Presentation Director review. Codex fixed grid rhythm, progress colors, candidate overflow, phone header/navigation, current-step semantics, persistent save/research states, task-first hierarchy and user-facing copy. Final local gates: API 123/123, UX 36/36, all M2-M5 contract/runtime suites green, validator scenarios green, PHP/JS/JSON lint green. Production remains sealed M2 v0.2.1 and unmodified by M3-M5.
- 2026-09-20T23:00:00Z — Independent verification of exact commit `8647f2557b65a5a1a592ddefbd8af97600aba83f` returned FAIL on four P1s: stale recovery could overwrite a concurrent slot count, four-value LSH bands could miss an above-threshold match, similarity reads/backfill could fail open, and several item/counter transitions ignored persistence results. It also identified self-asserted research source authority and salt-rotation/test-depth P2s. No production action was taken.
- 2026-09-20T23:10:00Z — Foreman repair pass completed locally. Claim+slot and completion+release are transactional; stale recovery decrements only recovered leases; all transition/refresh writes fail closed; independent PHP processes prove the two-worker ceiling; injected commit failure proves stale-slot recovery and provider idempotency. Similarity now has complete per-position retrieval, no candidate truncation, exhaustive bounded backfill, fail-closed reads, and salt-keyed re-hydration. Research authority is host-bound to the current RISE official domain or acgme.org. Gates: M3 29/29+8/8, M4 14/14+9/9, M5 16/16+7/7, API 126/126, UX 36/36. Production remains sealed M2 v0.2.1 and unmodified.
