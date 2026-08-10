# 04 EXISTING REGISTRY PROVENANCE

## Immutable source release

| Item | Value |
|---|---|
| Release | `rise_registry_2026-07-09_f51f0643a2d9` |
| Release manifest SHA-256 | `85ef67906ad462e0a609dfa28c1e8479bc9fe287d8a05be0084969ea26fce3c8` |
| Activation status | `offline_shadow_only` |
| Source rights approved | `false` |
| Canonical Google Sheet ID (historical provenance only) | `1sHpiFtlQgCZMN9eIR5ZtudyErPP9OkFAeCiXPmQ8uVA` |
| Verified Google account (historical evidence) | `info@missionmedinstitute.com` |
| Source workbook SHA-256 | `1fd54a2222d31c609b77aea46cfd875ea0aca1dc701f83dc7c8f4948695847ff` |
| Google-Sheets import workbook SHA-256 | `c627397c69d2fad42c07a0b66951f3f3a4957a86c231d93a5bd925cdb2d87b9e` |
| Inspection SHA-256 | `2f33a66160150a084e37f72b18e36813553b970f8214f5a9aa935826f60c8878` |

## Measured provenance

- 6,346 raw source rows; 6,345 active rows; one quarantined duplicate observation.
- 6,139 canonical program IDs, 6,139 program-specialty records, 6,345 browse memberships, 6,345 aliases, and 6,139 external-identifier observations.
- 6,139 source documents and 721,055 claims are attributed to `FREIDA_GME_CENSUS`.
- One Brookdale official-program source document supplies 11 field-source overrides.
- Zero cells are attributed to Residency Explorer.
- The generator directly queried FREIDA administrative API/page endpoints. This is why public availability is not assumed to grant product reuse.

## Rights treatment

The release is retained as immutable evidence and identity continuity. Its source documents, claims, names, external identifiers, statistics, and copied text are not activated by 4102B. The sanitized Wave 1 sidecar intentionally contains no names, locations, websites, external IDs, salaries, program attributes, or narrative text.

The opaque `rise_program_id` values were deterministically generated from normalized external-ID seeds. 4102B accepts those opaque values only as internal continuity keys because both 4006 branches implement byte-identical identity semantics and all IDs recompute exactly. This is not a finding that the seed source may be republished or used as program evidence.

## Source-by-source disposition

- **FREIDA:** preserve existing immutable bytes in quarantine; no active factual use, display, redistribution, or further derivation without written permission or counsel approval.
- **Residency Explorer:** no inherited material exists; future use remains prohibited absent written AAMC authorization.
- **Brookdale official override:** must be freshly reverified from the current official page before use; the old override is not automatically accepted.
- **External identifiers:** historical observations remain source-qualified (`ACGME_PROGRAM_ID_AS_REPORTED_BY_FREIDA`), not independently ACGME-verified.
