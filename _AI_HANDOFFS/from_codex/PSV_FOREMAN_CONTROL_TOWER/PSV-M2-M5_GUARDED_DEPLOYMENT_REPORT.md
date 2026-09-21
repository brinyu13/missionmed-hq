# PSV M2-M5 Guarded Production Deployment Report

Updated: 2026-09-21T04:56:47Z

## Verdict

- Deployment: **PASS**
- Synthetic production acceptance: **PASS**
- Fresh final independent production verification: **PASS**, no P0/P1 findings
- M1 accepted capability: preserved
- M2-M5 engineering and guarded synthetic production path: complete
- Real-student AI: closed; `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` remains undefined
- Human-only production activation gate: Founder privacy authority for transmitting a real student's complete ROOT to OpenAI is still required. It was not inferred from credit restoration.
- Sibling-owner seams: native File Vault population and accepted RISE hydration remain inactive until their owner contracts/authority permit those writes.

## Exact release custody

- Repository: `https://github.com/brinyu13/missionmed-hq.git`
- Branch: `codex/psv-prototype-foreman`
- Exact live commit: `d373847b18e2fce46a52392aa1ed3349c9839906`
- Exact tree: `1ae89ed68531009034bef68d4e92b850eadbf231`
- Plugin: `missionmed-file-vault-ps` version `0.5.3`
- ZIP: `/tmp/psv-0.5.3-d373847.VWF5ig/missionmed-file-vault-ps-0.5.3.zip`
- ZIP SHA-256: `08bf8b0e8ac789fd0dbfca3aa9add3cd29d30b2eda4fcac62964f63b1052322e`
- Manifest SHA-256: `7b29dddd6460bb0325d039174a6cf7f0bbfea8a19c3a1a7422db1a6a9bcdd323`
- Package/deployed/source tree: exact 24/24 files, no extras or mismatches
- PHP lint: production 21/21 PASS; production runtime `8.2.29`
- Final local gates: M2-M5 contract/runtime 125/125; adversarial validators 21/21; disposable WordPress API 126/126; PHP lint 21/21; JavaScript/JSON parse PASS. The UI source remained unchanged from the accepted 36/36 desktop/tablet/phone suite.

## Authority and fencing

- Mission: `PSV-PROTOTYPE-0001`
- Decisions: DR-311, DR-312, DR-313, DR-314 and DR-315
- Current clean MissionMed OS authority: `8f53f64d1769fd9653f96707e9ef992dfc936f04`
- Universal BOOT: PASS
- Exact PSV mission BOOT: PASS
- Canonical Founder identity: WordPress `brinyu`, user ID `1`
- Guarded activation mechanism: native WordPress Admin; global WP-CLI repair was not attempted
- v0.5.2 deploy lease epoch `3395`: released
- v0.5.3 deploy lease epoch `3413`: expired closed after the verified atomic swap
- Acceptance/export leases: epochs `3416`, `3417`, `3418`, `3419` and `3421`; completed or expired closed
- Final active PSV path lease count: `0`
- One unrelated active `PRODUCT:IV-PREP-ON-CALL` lease existed at final readback; it did not conflict with the PSV path
- Force push: NO

## Production delta

- Replaced only `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-file-vault-ps/` with exact v0.5.3.
- Staged v0.5.3 at `/www/theresidencyacademy_209/private/psv-deploy-d373847-0.5.3/`.
- Retained v0.5.2 at `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-0.5.3-d373847-20260921T043035Z/live-retired`.
- Retained v0.5.1 through the earlier v0.5.2 rollback at `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-0.5.2-8f78a5f-20260921T041740Z/live-retired`.
- v0.5.3 fixed the remaining Deep-candidate false-positive while preserving byte-identical, punctuation-only, copied-opening and unselected-evidence duplicate blocking.
- Added synthetic-only PSV ROOT/run/job/item/library/audit/fingerprint rows during acceptance.
- Did not alter `wp-config.php`, existing File Vault code/data, RISE code/data, Railway, shared options or unrelated WordPress/worktree state.

## Runtime and privacy state

- Plugin active: YES
- Version: `0.5.3`
- Mode: `allowlist`
- Effective allowlist: WordPress user ID `1`
- `mmed_ps_proto_allow_admins`: `0`
- Dedicated PSV OpenAI key: present as a boolean only; its value was never inspected, printed, hashed, logged, copied or committed
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI`: undefined
- Production test constants: undefined
- DB version: `5`; all ten namespaced tables present
- Final rows: roots `3` (synthetic `3`, real `0`), runs `25`, library `8`, audit `61`, provider attempts `15`, jobs `1`, items `5`, research artifacts `0`, similarity fingerprints `8`, similarity buckets `512`
- Latest job `4794e7db-3535-49af-a488-5313b324b7ee`: `COMPLETE`, 5/5 processed, 5 clean, 0 exceptions, 0 failures, 0 active workers, 5 approved documents
- Final batch mix: 1 Deep and 4 Essential overrides; every item completed on attempt 1 of 3
- Provider outcomes: nine `http_200`; historical bounded failures retained as five `http_429` and one `http_429_credit_balance_exhausted`
- Export audit totals: seven individual downloads and four bulk selected/all-approved exports
- Recent production-log readback: zero fatal errors and zero PSV-related severe warnings

## Live acceptance

- Credits restored: real OpenAI Essential and Deep calls succeeded using only built-in fictional synthetic ROOT content.
- Final Deep run `0a0642dd-6fc6-4e1b-b8e9-5104e8312fda` returned five valid, materially different rhetorical approaches with one recommended default.
- A non-default research/fellowship candidate was selected; the complete statement reconstructed with all five protected ROOT paragraphs unchanged, then approved and saved.
- Library preserved both M1 documents and the earlier M2 acceptance document, then added five approved batch documents for a final count of eight.
- Bounded live batch imported five real RISE identities, honored priority-to-Deep defaults, persisted four explicit Essential overrides, ran with the two-worker durable coordinator, reached 100%, and approved all five clean defaults.
- Library rows visibly carry specialty, human program name, verified program ID, tier, version, status, location and timestamps.
- Individual, selected and all-approved export paths were exercised; durable audit rows confirm both individual and bulk generation. The automation browser may suppress saving the inbound file locally, but server generation/auditing succeeded.
- Deep Research Needed, Essential fallback, optimized research prompt, quarantine/validation and RISE-owner handoff were validated by the release suites. No fabricated artifact was uploaded and no RISE write occurred.
- Cross-student protection persists only keyed HMAC/MinHash material; no other student's prose is exposed.

## Regression sentinels

- Anonymous home and prototype-flag URL: HTTP 200 with zero PSV markers
- Anonymous PSV bootstrap and namespace: HTTP 404 with zero PSV markers
- File Vault browser: administrator workspace rendered normally as `brinyu`, including review queue `26`
- RISE browser: rendered five saved programs and `6,245` canonical identities
- Protected File Vault hashes remained exactly:
  - controller `e906c0a42aab3f7f6674e6c581be903b37ba04e792efc4e477f149c4e80fa265`
  - repository `d54e2d2ffc564785b5fc2023ba65544a198713a618aaeaca2ae202f9cce14c16`
  - scanner `9839b9a54a98e90fd92490af0d33dba0fde79488a3a35250a62f237ba263cf25`
  - mutable JS `0a3caa654d9b6724270133e89b7cf6e7c6201eef449ddf8ca8067e43f1f8bdd9`
  - mutable CSS `87c932a3b20b5e6b5351a5ee5bda08c0489bea5195df007cb0f70d6d21e9d9f2`
- Existing File Vault and RISE behavior did not regress; rollback was not invoked.

## Independent completion sweep

- Verdict: PASS; no P0/P1 findings.
- Independently matched origin commit, release package hash, Git/archive/private-package/deployed 24-file chain and production PHP lint 21/21.
- Independently read back v0.5.3 active state, privacy/config booleans, 3/3 synthetic roots with zero real roots, complete 5/5 batch, eight approved documents and export audit counts.
- Independently matched all five protected File Vault hashes, healthy File Vault runtime, current production RISE health/source rights, anonymous 200/404 gates, zero severe PSV log findings and zero conflicting PSV leases.
- P2 observation: fresh interactive browser replay was unavailable because the relevant Chrome tabs were already owned by the Foreman's shared browser-control session. The Foreman had already completed and visually observed authenticated File Vault, RISE and PSV acceptance in that session; the verifier stopped retrying and completed every independently available CLI, HTTP, provider, hash, database, log and lease check.

## Implemented M2-M5 scope

- M2: complete-ROOT read context with region-only write, five genuinely distinct evidence-bounded strategies, recommended/default plus alternatives, protected reconstruction and polished editor prompt.
- M3: specialty-isolated contexts, RISE list import, priority defaults/overrides, 100-program durable jobs, two-worker server ceiling, retries/idempotency/partial-failure handling, exception review, selective-regeneration preservation and individual/selected/all-approved exports.
- M4: Essential fallback, optimized super-deep research prompt, strict Markdown provenance validation/quarantine, owner-scoped handoff and no direct RISE hydration outside the RISE-owner contract.
- M5: privacy-safe keyed exact/near duplicate protection, quality-first review, fail-closed similarity reads, `ProgramEvidenceBundle v1`, responsive/accessibility/performance hardening and Astra-directed StoryForge/RISE-family presentation reconciliation.

## Human-only next decision

No additional engineering approval is required for the synthetic guarded capability. Before real student use, the Founder must explicitly decide whether MissionMed may transmit a student's complete ROOT Personal Statement to the dedicated OpenAI project as read context while preserving region-only write authority. Until that decision is recorded, the live system remains synthetic-only and fail-closed.

Native File Vault population and accepted research hydration into RISE remain deliberately unexercised owner-bound seams. They require the applicable File Vault/RISE owner contracts or separate authority; this release does not silently broaden custody.

## Rollback

Rollback remains layered and non-destructive: set prototype mode off, define the hard-off constant if required, use native WordPress Admin deactivation as `brinyu`, or atomically restore only the exact prior plugin directory from the v0.5.2 private rollback target. PSV tables/data remain preserved unless a separate Founder purge decision authorizes destruction.
