# PSV M2-M5 Guarded Production Deployment Report

Updated: 2026-09-21T00:03:43Z

## Verdict

- Deployment: **PASS**
- Independent production verification: **PASS**, no P0/P1/P2 findings
- Full roadmap acceptance: **WAITING AT A HUMAN-ONLY PROVIDER CREDIT GATE**
- Required owner action: add API credits to the existing dedicated PSV OpenAI project. Do not paste, rotate, replace or recreate the key; the approved server-side credential is already present.
- M1 accepted capability: preserved
- Real-student AI: closed; `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` remains undefined

## Exact release custody

- Repository: `https://github.com/brinyu13/missionmed-hq.git`
- Branch: `codex/psv-prototype-foreman`
- Commit: `9a669ceea02e5a3bdb63368f929bed304249b1f7`
- Plugin: `missionmed-file-vault-ps` version `0.5.1`
- ZIP: `/tmp/psv-0.5.1-9a669ce.RF2SUm/missionmed-file-vault-ps-0.5.1.zip`
- ZIP SHA-256: `682d51f1b476c505b07f0b6827031948dfd766bcba6bc86d8738a6ac4d44d0a8`
- Manifest SHA-256: `177754887c85f41d622c699687a8fba17183f45e10dadace1370626454c71651`
- Package/deployed tree: exact 24/24 files, no extras
- PHP lint: local and production PASS; production runtime `8.2.29`
- Local gates: M2-M5 contract/runtime `120/120`; adversarial validators `21/21`; disposable WordPress API `126/126`; prior final UI suite `36/36` with zero console/page/CSP errors

## Authority and fencing

- Mission: `PSV-PROTOTYPE-0001`
- Decisions: DR-311, DR-312, DR-313, DR-314 and DR-315
- MissionMed OS: `148de6883d76f37b170b44faf58fea4ce7a2658a`
- HQ authority tip: `0feee579b0a9f2c90529220899f6cf6d21b8cd05`
- Universal BOOT: PASS
- Exact PSV mission BOOT: PASS
- Canonical MR-079 hash: `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`
- Staging lease: PATH epoch `3285`, released normally
- Production swap lease: PATH epoch `3286`, released normally
- Final authoritative active lease count: `0` globally and `0` for the PSV production path
- Force push: NO

## Production delta

- Replaced only `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-file-vault-ps/` from v0.5.0 to exact v0.5.1.
- Staged verified release at `/www/theresidencyacademy_209/private/psv-deploy-9a669ce-0.5.1/`.
- Retained the exact prior directory at `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-0.5.1-9a669ce-20260920T235000Z/live-retired` with a preimage manifest.
- Kept the active plugin loaded; no schema activation was required because DB version remains `5`.
- Added one synthetic-only failed provider-attempt record and one Deep Research Needed run during acceptance.
- Did not alter `wp-config.php`, existing File Vault code/data, RISE code/data, Railway, shared options, unrelated WordPress state or unrelated worktree state.

## Runtime and privacy state

- Plugin active: YES
- Mode: `allowlist`
- Effective allowlist: WordPress user ID `1` (`brinyu`)
- `mmed_ps_proto_allow_admins`: `0`
- Dedicated PSV OpenAI key: present as a boolean only; value never inspected, printed, hashed, logged, copied or committed
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI`: undefined
- Production test constants: undefined
- DB version: `5`
- Tables: all ten namespaced PSV tables present
- Final rows: roots `2` (synthetic `2`, real `0`), runs `15`, library `2`, audit `20`, provider attempts `6`; jobs/items/research/similarity rows `0`
- Latest provider audit outcome: `http_429_credit_balance_exhausted`
- Production logs: zero recent MMPS, fatal or inert-plugin errors

## Live acceptance

- Anonymous home and prototype-flag URL: normal site, no PSV markers
- Anonymous PSV bootstrap and namespace: `404 rest_no_route`; namespace absent from REST discovery
- Authenticated PSV workspace: v0.5.1 rendered as `brinyu`; writer status truthfully remained synthetic-only
- RISE: browser rendered five saved programs and `6,245` canonical identities; independent verifier confirmed production/active/current-source-rights health
- Batch import: five program identities imported read-only; private RISE notes did not enter PSV; resumable-batch creation was intentionally not started while provider credits are unavailable
- Deep Research Needed: PASS; no AI call or hallucinated program claim; immediate Essential fallback present
- Research workflow: standardized program-specific MissionMed Markdown prompt rendered; upload/quarantine and RISE-owner boundary were visible; no fabricated artifact was uploaded
- Library: both accepted M1 documents remained visible with specialty, program, ACGME id, tier, version/status and individual/selected/all-approved download controls
- Fresh M2 five-candidate generation: not executable because the dedicated OpenAI project returned `credit_balance_exhausted`
- v0.5.1 billing UX: PASS; the live UI now states that a project owner must add credits, instead of instructing the student to retry a transient rate limit

## Regression sentinels

- File Vault browser: administrator workspace rendered 13 students, review queue 26 and the PSV launcher
- Protected File Vault hashes remained exactly:
  - controller `ca4abfe4bfbd968a6e203b9e32dbb0359bf9369fdcef5b665ac15338a90cf555`
  - repository `dce600c8fce8a4973e6f4fca41d7403f323f1d8ae6778e3f344009541f79ad56`
  - scanner `9839b9a54a98e90fd92490af0d33dba0fde79488a3a35250a62f237ba263cf25`
  - mutable JS `0a3caa654d9b6724270133e89b7cf6e7c6201eef449ddf8ca8067e43f1f8bdd9`
  - mutable CSS `87c932a3b20b5e6b5351a5ee5bda08c0489bea5195df007cb0f70d6d21e9d9f2`
- No existing File Vault or RISE regression was observed; no rollback was invoked.

## Implemented M2-M5 scope

- M2: whole-ROOT read context with region-only write, five genuinely distinct rhetorical strategies, one recommended default, per-candidate validation, alternative selection and protected reconstruction.
- M3: specialty-isolated ROOT/preferences/program sets, RISE list import, priority defaults with override, 100-program durable jobs, two-worker server ceiling, retries/idempotency/partial failure, exception review, selective regeneration preservation and individual/selected/all-approved exports.
- M4: Essential fallback, optimized research-agent prompt, strict Markdown validation/quarantine, owner-scoped handoff and no direct RISE hydration without the RISE-owner contract.
- M5: server-keyed exact/near-duplicate protection without cross-student prose disclosure, quality-first review, fail-closed similarity storage/retrieval, `ProgramEvidenceBundle v1` preservation, responsive/accessibility/performance hardening and Astra-directed presentation reconciliation.
- Native File Vault population and RISE hydration remain owner-bound seams; no sibling-owned mutation was made.

## Remaining acceptance path

After credits are added to the existing dedicated PSV project, resume this same worktree and task, refresh BOOT/authority/preflight, and use only the built-in synthetic ROOT to verify:

1. Essential and Deep real-provider generation;
2. five meaningfully different candidates and the recommended default;
3. alternative selection, protected complete-PS reconstruction, save and download;
4. one bounded resumable batch with retries/partial-failure behavior and export; and
5. a fresh independent production acceptance readback.

The separate Founder privacy decision for real-student whole-ROOT transmission remains unopened and must not be inferred from provider-credit restoration.

## Rollback

Rollback remains layered and non-destructive: soft off, hard-off constant, native WordPress Admin deactivation as `brinyu`, or restore only the exact prior plugin directory from the private v0.5.0 rollback target. PSV tables/data remain preserved unless a separate Founder purge decision authorizes destruction.
