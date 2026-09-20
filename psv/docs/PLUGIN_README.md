# MissionMed File Vault · Program-Specific PS (prototype) · PSV-PROTOTYPE-0001

An isolated, allowlisted vertical slice of the Program-Specific Personal Statement workflow behind File Vault. Governing architecture: PSV-0002.

- **Owns nothing it should not.** File Vault owns PS documents; RISE owns program intelligence. This module reads both, writes to neither, and keeps its outputs in its own four tables.
- **Entry:** File Vault → launcher "Personal Statements · Program-Specific PS" (allowlisted users only) → `/?mmed_ps_proto=1`.
- **Flow:** ROOT → confirm region → preferences → RISE programs → Essential or Deep → generate → preview with diff, facts and sources → save → download.
- **Contract:** `contracts/program-evidence-bundle.v1.schema.json`; manifest in `docs/INTEGRATION_COMPATIBILITY_MANIFEST.md` (both live beside the plugin in the handoff package and in the repository, never in the deployed directory).
- **Deploy, disable, rollback:** `docs/DEPLOY_AND_ROLLBACK.md`.

| Path | Role |
|---|---|
| `missionmed-file-vault-ps.php` | bootstrap; fail-inert loader (readability check + `\Throwable`), duplicate-copy guard |
| `includes/class-mmps-gate.php` | kill switches, allowlist, REST permission (404 outside the allowlist) |
| `includes/class-mmps-install.php`, `class-mmps-store.php` | four namespaced tables; owner-scoped reads and writes; audit of ids and hashes only |
| `includes/class-mmps-root-source.php`, `class-mmps-fv-reader.php`, `class-mmps-docx.php` | ROOT sources: File Vault (read-only, reflection-checked), synthetic, pasted |
| `includes/class-mmps-region.php` | region detection, reconstruction, protected-text proof |
| `includes/class-mmps-rise-client.php`, `class-mmps-evidence-bundle.php` | replaceable RISE transport + ProgramEvidenceBundle v1 projection |
| `includes/class-mmps-tiers.php` | preferences, Essential / Deep / Deep research needed |
| `includes/class-mmps-provider.php`, `class-mmps-generator.php` | AI adapter (store:false, strict schema), prompt, strategies, deterministic validators, privacy gate |
| `includes/class-mmps-rest.php`, `class-mmps-page.php` | REST `mmed-ps-proto/v1`; standalone page with strict CSP; File Vault launcher |
| `assets/` | UI in the StoryForge / RISE token family; no external requests |

wp-config constants: `MMED_PS_PROTO_ALLOW_USER_IDS`, `MMED_PS_PROTO_OPENAI_API_KEY`, optional `MMED_PS_PROTO_OPENAI_MODEL`, `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` (Founder privacy decision only), `MMED_PS_PROTO_ALLOW_SIMULATOR` (plumbing test without a key; output is labelled SIMULATED), `MMED_PS_PROTO_DISABLE` (hard kill switch).
