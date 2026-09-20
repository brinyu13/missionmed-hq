# PSV Foreman Control-Tower State

Updated: 2026-09-20T17:32:13Z

## Product and outcome

- Mission: `PSV-PROTOTYPE-0001`
- Product: Program-Specific Personal Statement capability inside File Vault
- Current milestone: M0 Production Guardian Green leading to M1 live Founder preview
- Terminal condition: M1 technically live and verified, then stop for Founder writing and UX review; M2 has not started

## Repository truth

- Worktree: `/Users/brianb/MissionMed_worktrees/program-specific-ps-engine`
- Repository: `https://github.com/brinyu13/missionmed-hq.git`
- Branch: `codex/psv-prototype-foreman`
- Base HEAD: `0feee579b0a9f2c90529220899f6cf6d21b8cd05`
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

- Prototype deployed: NO
- Target plugin directory: ABSENT
- Prototype active: NO
- PHP: `8.2.29`
- Required extensions `zip`, `dom`, `mbstring`, `json`: PASS
- RISE origin: configured
- File Vault class: loaded
- Dedicated PSV key: ABSENT as a boolean presence check; value never inspected
- `MMED_PS_PROTO_ALLOW_USER_IDS`: ABSENT
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI`: UNDEFINED
- Production mutation by this Foreman run: NONE

## Health and accepted capabilities

- Existing File Vault and RISE: preserved; predeployment regression proof remains required immediately before mutation and after activation
- Package/hash/manifest and production prerequisites: accepted for M0 subject to final pre-mutation refresh
- Live RISE, live OpenAI, generation, reconstruction, save and DOCX: not yet proven because deployment has not occurred

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

- `WAITING: dedicated project-scoped PSV OpenAI credential installed in Kinsta server-side wp-config.php as MMED_PS_PROTO_OPENAI_API_KEY`

## Next critical path

1. Recheck only the dedicated-key boolean.
2. When present, rerun full M0 production preflight from the beginning.
3. Acquire exact production path/config fences.
4. Guarded upload, deployed-hash proof, PHP lint and server-only configuration.
5. Native WordPress Admin activation and complete M1 acceptance.
6. Fresh independent read-only verification.
7. Stop for Founder review; do not begin M2.

## State delta log

- 2026-09-20T17:32:13Z — Foreman packet adopted; volatile truth refreshed; dedicated key remains the sole external dependency; production remains unmodified.
