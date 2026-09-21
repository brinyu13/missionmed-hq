# MissionMed File Vault · Program-Specific PS (prototype) · PSV-PROTOTYPE-0001

An isolated Program-Specific Personal Statement workflow for administrators and currently entitled MissionMed 360 members. Governing architecture: PSV-0002 and DR-327.

- **Owns nothing it should not.** File Vault owns PS documents; RISE owns program intelligence. This module reads both, writes to neither, and keeps its outputs in ten isolated, namespaced tables.
- **Entry:** Matrix → sidebar item "Program-Specific PS" (administrators and verified current MissionMed 360 members only) → `/?mmed_ps_proto=1`; the File Vault launcher remains as a secondary entry.
- **Flow:** specialty ROOT → confirm region → specialty preferences → import the RISE program set → Deep/Essential defaults and overrides → resumable batch generation → review exceptions or accept recommended defaults → reconstruct complete PS files → save → individual, selected or Download All ZIP.
- **Writing boundary:** the complete ROOT is sent as read-only editorial context. The provider returns replacement-region candidates only; the server resolves the chosen candidate and reconstructs the document while proving every protected ROOT paragraph is unchanged.
- **Contracts:** `contracts/program-evidence-bundle.v1.schema.json` and `contracts/generation-candidate-set.v2.schema.json`; manifest in `docs/INTEGRATION_COMPATIBILITY_MANIFEST.md` (all live beside the plugin in the handoff package and in the repository, never in the deployed directory).
- **Deploy, disable, rollback:** `docs/DEPLOY_AND_ROLLBACK.md`.

| Path | Role |
|---|---|
| `missionmed-file-vault-ps.php` | bootstrap; fail-inert loader (readability check + `\Throwable`), duplicate-copy guard |
| `includes/class-mmps-gate.php` | kill switches, explicit canary allowlist, administrator/current-360 entitlement validation, REST permission (404 outside authorized access) |
| `includes/class-mmps-install.php`, `class-mmps-store.php` | ten namespaced tables; owner-scoped reads and writes; transactional persistence; audit of ids and hashes only |
| `includes/class-mmps-batch.php` | durable 100-item jobs, bounded workers/retries, stale-lock recovery, idempotent provider work, partial-failure and selective-regeneration control |
| `includes/class-mmps-root-source.php`, `class-mmps-fv-reader.php`, `class-mmps-docx.php` | ROOT sources: File Vault (read-only, reflection-checked), synthetic, pasted |
| `includes/class-mmps-region.php` | region detection, reconstruction, protected-text proof |
| `includes/class-mmps-rise-client.php`, `class-mmps-evidence-bundle.php` | replaceable RISE transport + ProgramEvidenceBundle v1 projection |
| `includes/class-mmps-tiers.php` | preferences, Essential / Deep / Deep research needed |
| `includes/class-mmps-provider.php`, `class-mmps-generator.php` | AI adapter (store:false, strict schema), complete-ROOT read-only prompt, five-strategy candidate set, deterministic evidence/diversity validators, privacy gate |
| `includes/class-mmps-research.php` | Deep Research Needed prompt, strict Markdown validation/quarantine, and owner-handoff artifact; never hydrates RISE directly |
| `includes/class-mmps-similarity.php` | keyed exact/near-duplicate protection using opaque HMAC/MinHash material only; never exposes another student's prose or identity |
| `includes/class-mmps-rest.php`, `class-mmps-page.php` | REST `mmed-ps-proto/v1`; owner-scoped batch/export routes; standalone page with strict CSP; File Vault launcher |
| `assets/` | UI in the StoryForge / RISE token family; no external requests |

wp-config constants: `MMED_PS_PROTO_ALLOW_USER_IDS`, `MMED_PS_PROTO_OPENAI_API_KEY`, optional `MMED_PS_PROTO_OPENAI_MODEL`, `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` (broad Founder privacy decision only), the exact canary tuple `MMED_PS_PROTO_REAL_ROOT_CANARY_USER_ID`, `MMED_PS_PROTO_REAL_ROOT_CANARY_ROOT_SHA256`, `MMED_PS_PROTO_REAL_ROOT_CANARY_SPECIALTY`, `MMED_PS_PROTO_REAL_ROOT_CANARY_REGION_INDEX`, `MMED_PS_PROTO_REAL_ROOT_CANARY_PROGRAM_ID`, `MMED_PS_PROTO_ALLOW_SIMULATOR` (plumbing test without a key; output is labelled SIMULATED), `MMED_PS_PROTO_DISABLE` (hard kill switch).
