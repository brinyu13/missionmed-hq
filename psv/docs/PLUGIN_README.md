# MissionMed File Vault · Program-Specific PS (prototype) · PSV-PROTOTYPE-0001

An isolated, allowlisted vertical slice of the Program-Specific Personal Statement workflow behind File Vault. Governing architecture: PSV-0002.

- **Owns nothing it should not.** File Vault owns PS documents; RISE owns program intelligence. This module reads both, writes to neither, and keeps its outputs in its own six tables.
- **Entry:** File Vault → launcher "Personal Statements · Program-Specific PS" (allowlisted users only) → `/?mmed_ps_proto=1`.
- **Flow:** specialty ROOT → confirm region → specialty preferences → import the RISE program set → Deep/Essential defaults and overrides → resumable batch generation → review exceptions or accept recommended defaults → reconstruct complete PS files → save → individual, selected or Download All ZIP.
- **Writing boundary:** the complete ROOT is sent as read-only editorial context. The provider returns replacement-region candidates only; the server resolves the chosen candidate and reconstructs the document while proving every protected ROOT paragraph is unchanged.
- **Contracts:** `contracts/program-evidence-bundle.v1.schema.json` and `contracts/generation-candidate-set.v2.schema.json`; manifest in `docs/INTEGRATION_COMPATIBILITY_MANIFEST.md` (all live beside the plugin in the handoff package and in the repository, never in the deployed directory).
- **Deploy, disable, rollback:** `docs/DEPLOY_AND_ROLLBACK.md`.

| Path | Role |
|---|---|
| `missionmed-file-vault-ps.php` | bootstrap; fail-inert loader (readability check + `\Throwable`), duplicate-copy guard |
| `includes/class-mmps-gate.php` | kill switches, allowlist, REST permission (404 outside the allowlist) |
| `includes/class-mmps-install.php`, `class-mmps-store.php` | six namespaced tables; owner-scoped reads and writes; audit of ids and hashes only |
| `includes/class-mmps-batch.php` | durable 100-item jobs, bounded workers/retries, stale-lock recovery, idempotent provider work, partial-failure and selective-regeneration control |
| `includes/class-mmps-root-source.php`, `class-mmps-fv-reader.php`, `class-mmps-docx.php` | ROOT sources: File Vault (read-only, reflection-checked), synthetic, pasted |
| `includes/class-mmps-region.php` | region detection, reconstruction, protected-text proof |
| `includes/class-mmps-rise-client.php`, `class-mmps-evidence-bundle.php` | replaceable RISE transport + ProgramEvidenceBundle v1 projection |
| `includes/class-mmps-tiers.php` | preferences, Essential / Deep / Deep research needed |
| `includes/class-mmps-provider.php`, `class-mmps-generator.php` | AI adapter (store:false, strict schema), complete-ROOT read-only prompt, five-strategy candidate set, deterministic evidence/diversity validators, privacy gate |
| `includes/class-mmps-rest.php`, `class-mmps-page.php` | REST `mmed-ps-proto/v1`; owner-scoped batch/export routes; standalone page with strict CSP; File Vault launcher |
| `assets/` | UI in the StoryForge / RISE token family; no external requests |

wp-config constants: `MMED_PS_PROTO_ALLOW_USER_IDS`, `MMED_PS_PROTO_OPENAI_API_KEY`, optional `MMED_PS_PROTO_OPENAI_MODEL`, `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` (Founder privacy decision only), `MMED_PS_PROTO_ALLOW_SIMULATOR` (plumbing test without a key; output is labelled SIMULATED), `MMED_PS_PROTO_DISABLE` (hard kill switch).
