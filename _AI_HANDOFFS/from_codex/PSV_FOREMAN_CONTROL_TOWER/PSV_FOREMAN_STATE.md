# PSV Foreman Control-Tower State

Updated: 2026-09-20T18:44:48Z

## Product and outcome

- Mission: `PSV-PROTOTYPE-0001`
- Product: Program-Specific Personal Statement capability inside File Vault
- Current milestone: M1 live Founder preview deployed, independently verified and sealed
- Terminal condition: STOP for Founder review; M2 has not started

## Repository truth

- Worktree: `/Users/brianb/MissionMed_worktrees/program-specific-ps-engine`
- Repository: `https://github.com/brinyu13/missionmed-hq.git`
- Branch: `codex/psv-prototype-foreman`
- Base HEAD: `0feee579b0a9f2c90529220899f6cf6d21b8cd05`
- Current HEAD: `1695cae877de6a5889159bf3526f11179849bbfa`
- Prior branch: `fable/program-specific-ps-engine-architecture`
- Upstream at initialization: `origin/main` at the same base HEAD
- Preserved dirty state: untracked `_AI_HANDOFFS/from_fable/` package only
- Git index lock: absent
- Workers: none

## Authority and continuity

- MissionMed OS: `e3d5d9fbfb3442210f19998b0470749c321b7fb1`, equal to `origin/main`
- Active decisions: DR-311, DR-312 and DR-313
- Brain: `04ca13d4097096203b9f0b8fa68a0937556fd214`, equal to upstream and clean
- Universal boot: PASS after DR-313
- `PSV-PROTOTYPE-0001` boot: PASS after DR-313
- Canonical Founder identity: WordPress login `brinyu`, user ID `1`
- WP-CLI plugin commands: known exit 139; global repair prohibited
- Approved activation: native WordPress Admin Plugins screen as `brinyu`, exact plugin/version only

## Candidate

- Plugin: `missionmed-file-vault-ps` version `0.1.0`
- ZIP SHA-256: `93ba87efb5f4883bb7b0ceca9226a23ccec415136ffb2638d058990cd45f3f25`
- ZIP integrity: PASS
- Manifest: 21/21 PASS at initialization
- Candidate delta: one new plugin directory plus the two documented server-only constants; four new namespaced tables and documented namespaced options on activation

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
- Prototype rows: one synthetic ROOT, five runs, one approved library document
- Real provider: `openai-responses` / `gpt-5.6-terra`; Essential PASS; Deep PASS; Deep Research Needed PASS
- Independent verdict: PASS — the prior hash finding was resolved as stale-baseline interpretation: live File Vault controller/repository/scanner and mutable assets exactly match canonical commit `264293554a4f9b152ffb98ce8d707045c6bf5993`, which DR-308 and the current passport register as clean current custody; `15962cbc…ec3d1b5` is the accepted 1018 baseline, not the later controller pin
- Production mutation by this Foreman run: exact new plugin directory, two documented `wp-config.php` constants, four namespaced tables, documented namespaced options, isolated synthetic prototype rows only

## Health and accepted capabilities

- Existing File Vault and RISE: preserved after activation and live use; File Vault roster/upload dialog and live RISE registry rendered normally
- Package/hash/manifest, rollback surface and production prerequisites: PASS
- Live RISE, live OpenAI, generation, reconstruction, isolated save and DOCX download handler: PASS

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

- Founder review of the live writing and UX. No technical M1 blocker remains.

## Next critical path

1. STOP for Dr Brian's explicit review of the live writing and UX.
2. Keep the prototype allowlist-only and the real-student AI privacy gate closed.
3. Do not tune prompts, iterate features, begin the 4-5 option feature, or start M2 without new Founder direction.

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
