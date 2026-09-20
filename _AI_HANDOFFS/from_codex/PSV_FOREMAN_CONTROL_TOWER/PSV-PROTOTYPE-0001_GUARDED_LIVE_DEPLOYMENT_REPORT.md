# PSV-PROTOTYPE-0001 Guarded Live Deployment Report

Updated: 2026-09-20T18:44:48Z

## Production state

- Deployed: **YES**
- Plugin: `missionmed-file-vault-ps` version `0.1.0`
- Deployed path: `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-file-vault-ps/`
- Production PHP: `8.2.29`; required `zip`, `dom`, `mbstring`, and `json` extensions present
- Package ZIP SHA-256: `93ba87efb5f4883bb7b0ceca9226a23ccec415136ffb2638d058990cd45f3f25`
- Package/deployed manifest: 21/21 exact files PASS; deployed PHP lint PASS
- Activation: native WordPress Admin activation as authenticated `brinyu`; plugin active
- Access: mode `allowlist`; `MMED_PS_PROTO_ALLOW_USER_IDS` is exactly user ID `1`; `mmed_ps_proto_allow_admins` is exactly `0`
- Provider: dedicated server-side key resolves; value was never printed, logged, committed, or placed in this report
- Privacy: `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` is undefined; all production testing constants are undefined
- Activation state: four namespaced prototype tables present; documented namespaced options present
- Production fence: PATH lease epoch `3198` covered native activation and expired closed; PATH lease epoch `3199` covered the allow-admin hardening and released normally; final active-lease readback for the PSV scope is zero
- Release acceptance: **PASS / M1 SEALED** — a fresh independent verifier resolved the earlier hash interpretation and passed the complete release gate

## Regression safety

- File Vault behavior: **PASS by deployment executor** — normal administrator view renders 13 students; review queue remains 26; upload workflow opens and closes without a write; the live controller hash remained unchanged across this deployment
- File Vault release custody: **PASS by independent verifier** — live controller `ca4abfe4bfbd968a6e203b9e32dbb0359bf9369fdcef5b665ac15338a90cf555`, repository `dce600c8…`, scanner `9839b9a5…`, mutable JS `0a3caa65…` and mutable CSS `87c932a3…` exactly match canonical commit `264293554a4f9b152ffb98ce8d707045c6bf5993`, which DR-308 and the current passport register as clean current custody. The passport/DR-166 `15962cbc…ec3d1b5` controller is the accepted 1018 baseline, not the later current pin.
- RISE behavior: **PASS** — the independent verifier received HTTP 200, `ok=true`, production/active/current-source-rights health and registry release `rise_registry_acgme_2026-09-20_50d08ea6f2da`; executor browser verification showed the registry, five saved programs and 6,245 canonical identities. No RISE deployment or file change occurred.
- Anonymous/non-allowlisted invisibility: **PASS** — anonymous home and prototype requests had the same title/length and no prototype markers; anonymous bootstrap and namespace were HTTP 404; admin bypass is disabled; no spare safe non-allowlisted authenticated identity was used
- Logs: **PASS** — zero relevant MMPS or PHP fatal entries after live use
- Existing File Vault/RISE files changed: **NONE**
- Existing File Vault/RISE database rows changed by PSV: **NONE OBSERVED**; PSV writes are confined to its four namespaced tables

## Live integration

- Real RISE: **PASS**
- Real OpenAI with built-in synthetic ROOT: **PASS** (`openai-responses`, `gpt-5.6-terra`, request storage off)
- Essential generation: **PASS**
  - Brooklyn Hospital Center Program, ACGME `1403512265`
  - strategy `TRAINING_ENVIRONMENT_FIRST`
  - run `2675ac65-d549-4953-9f19-8134960bffc7`
  - evidence fact IDs `F-7b3f8cf1e699`, `F-15031bf6ecda`, `F-698b8c96ddb5`
  - latency `9344 ms`; one provider attempt; validator blocking count `0`; protected ROOT PASS
- Deep generation: **PASS**
  - HCA Florida Healthcare/USF Morsani College of Medicine GME - Tampa South/Brandon Hospital Program, ACGME `1401100940`
  - initial strategy `BRIDGE_FROM_EXPERIENCE`
  - run `117e7fd9-1359-4883-8c0a-c00d027ca254`
  - evidence fact IDs `F-ed31142d3865`, `F-e6b1c9a599f4`, `F-09a4963093bd`, `F-cb08bc210e7f`
  - latency `11173 ms`; one provider attempt; validator blocking count `0`; protected ROOT PASS
- Strategy rotation: **PASS** — the same Deep-ready program rotated through:
  - `BRIDGE_FROM_EXPERIENCE`, run `117e7fd9-1359-4883-8c0a-c00d027ca254`
  - `GOAL_FORWARD`, run `49bee8a2-f4fc-4ad0-a6e4-6e687bde5ca4`
  - `QUIET_SPECIFIC`, run `18be3153-44ea-47b4-a0de-e8399eee6eae`
- Deep Research Needed: **PASS** — Abbott-Northwestern Hospital Program, ACGME `1402631204`, run `bd6097f6-3c32-422d-a9ab-3b7a82678393`; no provider call was made
- Protected ROOT integrity: **PASS** — five protected paragraphs unchanged on every successful preview
- Preview/diff/evidence: **PASS** — full statement preview, replaced ROOT paragraph, changed-region marker, RISE sources, and validator result rendered
- Isolated save: **PASS** — one Deep statement saved `APPROVED` in the prototype library only
- DOCX download: **PASS** — authenticated DOCX download handler completed twice and recorded `library_download` audit entries; the browser-native download control was used
- Real-student privacy gate remains closed: **PASS** — UI reports `Synthetic only`; server constant remains undefined; only one synthetic ROOT exists
- Current isolated PSV rows: roots `1`, runs `5`, library `1`; no real-root row exists

## Founder review

- Live URL: `https://missionmedinstitute.com/?mmed_ps_proto=1`
- Entry point: `My Matrix` → `File Vault` → bottom-right `Personal Statements · Prototype / Program-Specific PS →`
- First outputs to inspect:
  1. Approved HCA Brandon Deep output, `BRIDGE_FROM_EXPERIENCE`, run `117e7fd9-1359-4883-8c0a-c00d027ca254`
  2. Current HCA Brandon Deep output, `QUIET_SPECIFIC`, run `18be3153-44ea-47b4-a0de-e8399eee6eae`
  3. Brooklyn Hospital Center Essential output, `TRAINING_ENVIRONMENT_FIRST`, run `2675ac65-d549-4953-9f19-8134960bffc7`
- UX issue: a freshly loaded File Vault briefly shows an empty/loading roster before the 13-student roster resolves; the launcher appears after the File Vault stage is ready. This is transient and did not alter File Vault behavior.
- Writing-quality concern for Founder review: the full legal/program name is long and makes the initial Deep paragraph read somewhat mechanically; the `QUIET_SPECIFIC` rotation is materially tighter. No prompt or feature iteration was performed.
- Next likely iteration after Founder review: the planned 4–5 simultaneous paragraph-option feature; explicitly not started.
- Ready for Founder review: **YES — M1 technically live, verified and sealed; no M2 work started**

## State delta

### Production files/config

- Created `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-file-vault-ps/` with the exact 21-file v0.1.0 package.
- Modified `/www/theresidencyacademy_209/public/wp-config.php` only to add:
  - `MMED_PS_PROTO_ALLOW_USER_IDS` set to `1`
  - `MMED_PS_PROTO_OPENAI_API_KEY` referencing the dedicated server-side PSV secret
- Created private rollback copy `/www/theresidencyacademy_209/private/psv-prototype-0001/wp-config.php.pre-psv-20260920T175053Z`.
- Created private deployment artifacts:
  - `/www/theresidencyacademy_209/private/psv-prototype-0001/missionmed-file-vault-ps-0.1.0.zip`
  - `/www/theresidencyacademy_209/private/psv-prototype-0001/missionmed-file-vault-ps-0.1.0.MANIFEST.sha256`
- No existing `missionmed-hub`, File Vault, RISE, or `mu-plugins` file changed.

### Production database

- Created tables:
  - `wp_mmed_ps_proto_roots`
  - `wp_mmed_ps_proto_runs`
  - `wp_mmed_ps_proto_library`
  - `wp_mmed_ps_proto_audit`
- Created/updated options:
  - `mmed_ps_proto_mode = allowlist`
  - `mmed_ps_proto_allow_admins = 0`
  - `mmed_ps_proto_allow_user_ids = []` (the authoritative allowlist is the server constant)
  - `mmed_ps_proto_db_version = 1`
- Created isolated prototype data: one synthetic ROOT, five runs, one approved library document, and corresponding ID/hash-only audit rows.
- Existing File Vault and RISE tables: no intentional writes.

## Rollback readiness

Fable rollback remains ready in order: set `mmed_ps_proto_mode` to `off`; if required define `MMED_PS_PROTO_DISABLE`; then native WordPress deactivation; then remove only the new plugin directory. The four prototype tables are preserved unless a separate Founder purge decision is recorded.

## Independent verdict

- **PASS**
- The fresh non-builder recheck independently passed universal/PSV boot, exact Git/authority custody, live protected File Vault hashes, plugin identity/version, ZIP and 21/21 deployed manifest, PHP lint, allowlist/user/key-presence/privacy/testing configuration, synthetic-only table/run/library/audit state, authenticated File Vault read-only REST routes, live RISE health, recent production logs and provider-native lease readback.
- The earlier controller finding is resolved: current production exactly matches canonical commit `264293554a4f9b152ffb98ce8d707045c6bf5993`, registered by DR-308 and the File Vault passport as clean current custody. The `15962cbc…ec3d1b5` hash is explicitly the accepted 1018 baseline and remains historical rollback lineage; it is not the current controller pin.
- Authenticated visual UX facts were supplied as Foreman browser receipts; the verifier independently corroborated release-critical runtime state through canonical Git/authority, production hashes/config/database, authenticated internal File Vault GET routes, public RISE health, logs and provider-native lease reads.
- No rollback is required. The prototype remains restricted to WordPress user ID `1`, real-ROOT AI remains closed, and no M2 work has started.
