# P1 RISE 4102B COMPLETE COMBINED HANDOFF

Release: `rise_research_authority_2026-08-10_567ee6099af7`

Result: `RESEARCH_AUTHORITY_UNBLOCKED` for offline W1-IMFM-001 only.

This document embeds the complete human-readable authority package and the controlling machine-readable policy/manifest/disposition. The 1,649-row sanitized identity sidecar is delivered separately as `WAVE1_RESEARCH_IDENTITY.ndjson` and is hash-pinned below rather than duplicated here.

- Identity sidecar SHA-256: `78644bac033a3b511b3f7e5d4e637f9e57e13f8198bddabf81468cbe15bdda55`
- Manifest SHA-256: `378c0e4421b2789088d4d48c0525bba589eb8a219f1a9a8a608722ab0d8b47e9`

<!-- BEGIN 01_AUTHORITY_CHAIN.md -->

# 01 AUTHORITY CHAIN

## Decision

rise_research_authority_2026-08-10_567ee6099af7 is the current bounded authority for P1-RISE-4102 to resume W1-IMFM-001 as offline, source-separated research after its committed/pushed custody and default validator gates pass. It does not activate the historical registry payload, authorize student display, or authorize production.

## Governing chain

1. **Current Founder directive, P1-RISE-4102B (2026-08-10).** Brian directed Codex to re-evaluate the old stop, clear every blocker legitimately resolvable from current evidence, and create a research authority release without weakening source-rights controls or mutating production.
2. **MissionMed OS DR-023 (2026-08-09).** The accepted decision record names Brian as decider and states at line 212: "RISE owns residency-program intelligence." SHA-256: `c5d977259b0b2f54ed688fe6d780f182bdd06f78e5a5c1f4ef732a7cc74fdab5`.
3. **MM-FABLE-ADR-001.** The tracked platform architecture authority supplies bounded ownership, contract, provenance, and release-governance principles. SHA-256: `50bff490faab9c089840c1db87cc3b7b92e721a3d4992bab24e1950035439f00`.
4. **Platform v1 Governing Constitution Revision 3.** The Founder directed this run to apply its principles. Its file SHA-256 is `aea2be8e5e75495b2dee63f48de6c9ea63883c90c4b6f1d7ab4daa1989c232ce`. Repository evidence does not establish global MissionMed OS ratification, so this package does not claim it. The applicable principles are one canonical owner per fact, AI output remains bounded and auditable, production claims require production evidence, and records outrank memory.
5. **Historical identity release.** `rise_registry_2026-07-09_f51f0643a2d9` is immutable and hash-valid but remains `offline_shadow_only` with `sourceRightsApproved=false`.
6. **P1-RISE-4102A.** The identity recovery proved that the historical mapping is internally consistent, compatible with the production identity function, and complete for Wave 1. It did not authorize research use.
7. **P1-RISE-4102B.** This release registers only the canonical identity graph as non-evidentiary routing metadata and creates a fail-closed process for source-level decisions. It carries no inherited program facts forward.

## Founder acceptance record

Brian's current directive prospectively accepts a bounded offline research release that satisfies every named gate. The machine manifest records `acceptedBy=Brian`, `acceptanceMode=PROSPECTIVE_CONDITIONAL_FOUNDER_DIRECTIVE`, and `exactBytesPreinspectedByFounder=false`. This is not AI self-approval and does not claim that Brian later inspected or signed the exact bytes. Activation is automatic only when the hash, validator, independent review, commit, and remote-custody conditions all pass.

## Ownership disposition

RISE is the bounded owner of residency-program intelligence for this offline research release. That scope includes program identity, program evidence/provenance, leadership, curriculum, research, outcomes, visa policy, interview intelligence, and program-specific strategy when each fact is lawfully and independently sourced. Other MissionMed products may later consume versioned RISE contracts; they do not create competing residency databases.

The current MissionMed OS registry still lacks a ratified RISE product/passport entry. That is a production governance gap, not a reason to block bounded offline research under the current Founder directive. Production activation still requires separate registration and evidence.

## Repository topology

| Role | Branch / commit |
|---|---|
| Research release base | `p1-rise-4000` / `e8503866bce9cb941dd8f2dc38f39e62bd21e316` |
| Research authority branch | `codex/p1-rise-4102b-research-authority` |
| Historical identity lineage | `codex/p1-rise-4006` / `365bd8eba38a9dc9058367e1d888a45850c34149` |
| Historical evidence commit | `46467b1568aafc0093f1e63f8098118266e7c818` |
| Production-candidate lineage | `codex/p1-rise-4006-production` / local `2d0fc6b986ab1cc010e521c54b7b42ec916c1e32` |
| Observed production remote | `ad0fae528d9d174fb01a7717af41923323074183` |
| Merge base of 4006 siblings | `9c1fa72e6b056db8fe0e17031fcaa688f78569` |

The two 4006 branches are siblings. The later production candidate did not reject the ID semantics; it failed to inherit the immutable release bytes and omitted alias/external-ID persistence. Commit `89d1fb409aaff3b127c8b7cf493cd80343e47f84` then removed source resolutions pending source-owner rights. This was a custody and rights gate, not contrary identity evidence.

## Boundaries

- No production database, route, application, Google file, or external system is changed.
- No historical canonical ID is regenerated.
- No source-rights uncertainty is converted into permission.
- No release in this package is student-facing.
- Any later conflict is resolved by a new additive authority record; this immutable package is never edited in place.

<!-- END 01_AUTHORITY_CHAIN.md -->

<!-- BEGIN 02_FIVE_BLOCKER_RESOLUTION.md -->

# 02 FIVE BLOCKER RESOLUTION

## Final dispositions

| Reported blocker | Classification | Resolution |
|---|---|---|
| RISE ownership authority | `STALE_BLOCKER`, `DOCUMENTATION_GAP`, `RESOLVABLE_NOW` for offline research | DR-023 already states that RISE owns residency-program intelligence, and the current Founder directive supplies the bounded offline scope. Production registration remains separate and nonblocking. |
| Source authorization / rights | `RIGHTS_GAP` for restricted sources; `RESOLVABLE_NOW` for a per-domain public first-party decision lane | Source classes are separated. Inherited FREIDA facts, names, URLs, identifiers, and Residency Explorer remain prohibited. No official domain is pre-authorized: a hash-pinned source-access decision must first allow the exact domain under explicit terms and access evidence. |
| Release acceptance | `STALE_BLOCKER`, `DOCUMENTATION_GAP`, `RESOLVABLE_NOW` for identity-only research | The historical release is accepted only as an immutable identity-continuity sidecar. Its claims, source documents, names, external IDs, and statistics are not activated. |
| Olathe | `STALE_BLOCKER`, `DOCUMENTATION_GAP`, `RESOLVABLE_NOW` for identity; `RIGHTS_GAP` for inherited payload | Canonical ID and retained alias are registered; the malformed duplicate remains quarantined. Source rights are isolated from identity continuity. |
| Canonical branch / schema authority | `TECHNICAL_GAP` for later production; `RESOLVABLE_NOW` for offline research | `rise.research.identity.v1` is the research contract. The production candidate remains the runtime-engineering lineage but is not the identity mapping authority until an additive schema preserves aliases/external IDs without changing IDs. |

## What the old STOP_SAFE got right

P1-RISE-4102 correctly refused fuzzy or name-based identity attachment. P1-RISE-4102A correctly refused to activate a technically valid release whose source rights and acceptance were unresolved. Those stops remain valid for inherited factual content and production.

## What is superseded

The old all-or-nothing stop is superseded for W1-IMFM-001. A restricted FREIDA or Residency Explorer field now fails closed at the source/field/record/program scope; it does not prevent independent research of an official program page whose terms and access conditions permit normal public use.

## Remaining actions that do not block W1

- AMA permission or counsel approval for broader FREIDA reuse.
- AAMC written authorization for Residency Explorer.
- Source-specific permission review before report ingestion or student display.
- MissionMed OS product registration and additive production schema reconciliation before deployment.

<!-- END 02_FIVE_BLOCKER_RESOLUTION.md -->

<!-- BEGIN 03_SOURCE_RIGHTS_AND_USE_MATRIX.md -->

# 03 SOURCE RIGHTS AND USE MATRIX

This is an operational governance matrix, not legal advice. `SOURCE_USE_POLICY.json` is the controlling machine-readable policy. Unknown or absent source classes default to `DO_NOT_USE`.

| Source class | Research | Internal storage | Student display | Raw redistribution | Derived intelligence |
|---|---|---|---|---|---|
| MissionMed canonical identity metadata | Authorized for exact routing joins | Authorized | Not authorized | Not authorized | Routing/continuity only; never program facts |
| Inherited FREIDA payload | Not authorized, including as a discovery or matching input | Existing immutable quarantine only | Not authorized | Not authorized | Not authorized |
| Residency Explorer | Do not use absent written AAMC authorization | Not authorized | Not authorized | Not authorized | Not authorized |
| Official residency program page | Denied by default; conditionally allowed only by a hash-pinned per-domain decision | Denied until that decision; then minimal discrete facts + provenance | Not authorized by this release | Not authorized | Conditional, provenance-bound, publication candidate only |
| Official hospital/institution page | Denied by default; conditionally allowed only by a hash-pinned per-domain decision | Denied until that decision; then minimal discrete facts + provenance | Not authorized by this release | Not authorized | Conditional, provenance-bound, publication candidate only |
| Official faculty/leadership page | Denied until domain and privacy-minimization decisions pass | Denied until those decisions | Not authorized | Not authorized | Conditional |
| Official resident roster | Denied until domain access and named pre-collection privacy approvals pass | Denied until controller, purpose, access, retention, deletion, and expiry are approved | Not authorized | Not authorized | Conditional; no sensitive inference |
| AAMC general public materials | Manual policy reference only | Minimal citation record | Not authorized | Not authorized | Not authorized without source-specific review |
| ACGME public site/reports | Manual reference only | Minimal citation record | Not authorized | Not authorized | Not authorized without license/review |
| NRMP reports/data | Manual policy reference only | Minimal citation record | Not authorized | Not authorized | Not authorized without permission/license |
| ABFM reports/data | Manual reference only | Minimal citation record | Not authorized | Not authorized | Program-rate ingestion not authorized |
| ABIM reports/data | Manual reference only | Not authorized pending review | Not authorized | Not authorized | Not authorized pending review |
| MissionMed internal records | Case-by-case owner/consent review | Not authorized by this release | Not authorized | Not authorized | Not authorized |
| Unofficial aggregators/blogs | Not authoritative; do not use | Not authorized | Not authorized | Not authorized | Not authorized |

## Controlling evidence reviewed 2026-08-10

- AMA Terms of Use: https://www.ama-assn.org/about/terms-use
- FREIDA provenance: https://assets.ama-assn.org/resources/doc/freida/x-pub/freida-about-freida.pdf
- Residency Explorer Terms and Conditions: https://students-residents.aamc.org/applying-residency/residency-explorer-terms-and-conditions
- AAMC Website Terms and Conditions: https://www.aamc.org/website-terms-conditions
- ACGME Terms of Use: https://www.acgme.org/about/legal/terms-of-use/
- ACGME Publication/Document Usage: https://www.acgme.org/about/legal/publication-document-usage/
- NRMP Match Data request/licensing page: https://www.nrmp.org/match-data-submit-request/
- ABFM Terms of Use: https://www.theabfm.org/terms-of-use/
- ABIM Data and Reports: https://www.abim.org/about/data-and-reports/
- U.S. Copyright Office facts guidance: https://www.copyright.gov/help/faq/faq-protect.html

## Fail-closed rule

Every accepted fact requires an allowed source class, a hash-pinned conforming source-access decision for its exact domain, separately allowing research and minimal storage, a URL, an evidence locator, a retrieval date, an identity check, and a maturity state. Derivation and automation each require their own positive decision. Resident-roster collection additionally requires a hash-pinned privacy decision. Both decision files must pass their executable validators and be unexpired. If any requirement fails, leave the field blank and record the unresolved reason. A source permission failure blocks only the affected source, operation, field, record, or program unless identity itself is uncertain.

<!-- END 03_SOURCE_RIGHTS_AND_USE_MATRIX.md -->

<!-- BEGIN 04_EXISTING_REGISTRY_PROVENANCE.md -->

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

<!-- END 04_EXISTING_REGISTRY_PROVENANCE.md -->

<!-- BEGIN 05_PUBLIC_FIRST_PARTY_RESEARCH_AUTHORITY.md -->

# 05 PUBLIC FIRST-PARTY RESEARCH AUTHORITY

## Authorized lane

P1-RISE-4102 may resume W1-IMFM-001 by creating source-access decisions and, only where those decisions allow, researching official public program, hospital, institution, faculty, leadership, curriculum, benefit, visa, and facility pages. No domain is blanket-authorized. Resident pages remain closed until both domain-access and named pre-collection privacy decisions pass. This lane creates publication-candidate evidence only.

## Required record workflow

1. Join the existing 4102 row to `WAVE1_RESEARCH_IDENTITY.ndjson` by exact legacy alias. Reject zero matches or multiple matches.
2. Do not read inherited FREIDA names, URLs, identifiers, claims, or neighboring cells as discovery or matching inputs. Build any discovery crosswalk only from independently permitted sources. Unlinked rows remain `IDENTITY_MATCH_PENDING`.
3. Before accessing a candidate domain, create a decision conforming to `SOURCE_ACCESS_DECISION_SCHEMA.json`; run `node validate_source_access_decision.mjs <decision.json>`; hash-pin the passing decision in the research record. The validator binds terms, robots, and evidence URLs to the reviewed domain and rejects expired decisions. Restrictive, absent, or ambiguous evidence returns `DENY` or `MANUAL_REVIEW_REQUIRED`, never allow.
4. Research, storage, derivation, and automation are independent permissions. A populated RISE value requires both `ALLOW_MINIMAL_FACT_RESEARCH` and `ALLOW_MINIMAL_DISCRETE_FACT_STORAGE`. Derived intelligence additionally requires `ALLOW_PROVENANCE_BOUND_DERIVATION`. Automation additionally requires `ALLOW_BOUNDED_AUTOMATION`, explicit terms/robots support, and the bounded rate/concurrency controls. Never bypass authentication, robots directives, paywalls, CAPTCHAs, or other controls.
5. Establish program identity from independently permitted first-party evidence. An official identifier may be recomputed through the pinned identity function solely to confirm an existing opaque ID; this does not authorize the identifier as a displayed fact. Do not name-match or fuzzy-match canonical records.
6. Capture only discrete facts that the allowed page explicitly states and only when storage is independently allowed. Store source URL, page title, precise evidence locator, retrieval date, source class, access-decision ID/hash, operation decisions, and confidence. Do not retain raw HTML, images, copied biographies, or expressive mission prose.
7. For resident-roster collection, additionally require a decision conforming to `PRIVACY_COLLECTION_DECISION_SCHEMA.json` and run `node validate_privacy_collection_decision.mjs <decision.json>`. Without a named controller and approved purpose/access/retention/deletion/expiry, or if any requested field is outside the strict allowlist, skip the roster source.
8. Keep all new output at `PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW`. Student display and production import require later, separate authorization.
9. If a field cannot be verified or a source cannot be used, leave the field blank and record the reason. Continue other allowed fields for the same program.

## Privacy controls

Public professional leadership roles and official business contacts may be stored only after a domain-access decision and with minimization. Resident rosters are not collectible under the base policy; a named pre-collection privacy approval must establish controller, purpose, access, retention, deletion, expiry, and audit rules. No sensitive characteristic may be inferred. Photos, personal contact details, biography text, and sensitive attributes are excluded.

## Restricted source isolation

FREIDA, Residency Explorer, ACGME bulk datasets, NRMP data/report values, and specialty-board report values do not become authorized because an official program page is authorized. Each source class is evaluated independently under `SOURCE_USE_POLICY.json`.

## Research output contract

At minimum, each populated field must carry:

- `rise_program_id`
- exact `legacy_alias` used for the join
- `field_key`
- normalized `value`
- `source_type`
- `source_access_decision_id`
- `source_access_decision_sha256`
- `research_decision`
- `storage_decision`
- `derivation_decision`
- `automation_decision`
- `source_url`
- `page_title`
- `evidence_locator`
- `retrieved_at`
- `identity_verification_method`
- `confidence`
- `maturity=PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW`
- `privacy_decision_id` and `privacy_decision_sha256` when roster data is involved

Blank fields remain blank. Guesses, inferred negatives, copied source prose, and unsourced synthesis are prohibited.

<!-- END 05_PUBLIC_FIRST_PARTY_RESEARCH_AUTHORITY.md -->

<!-- BEGIN 06_CANONICAL_BRANCH_SCHEMA_AUTHORITY.md -->

# 06 CANONICAL BRANCH SCHEMA AUTHORITY

## Research authority

| Contract | Authority |
|---|---|
| Canonical program key | Historical `programs.ndjson.id` carried as `rise_program_id` |
| Research schema | `rise.research.identity.v1` |
| Wave 1 identity sidecar | `WAVE1_RESEARCH_IDENTITY.ndjson` |
| Source-use contract | `rise.source.use.policy.v1` |
| Release manifest | `rise.research.authority.v1` |
| Research authority branch | `codex/p1-rise-4102b-research-authority` |

The sidecar fields are exactly `legacyAlias`, `riseProgramId`, `programSpecialtyId`, `browseMembershipId`, `browseSpecialty`, `relationship`, `identityReleaseId`, and `identityUse`. They are routing metadata, not program facts.

## Compatibility finding

Both 4006 branches contain the same identity implementation Git blob `2b8509621c09ba771ed1ea61eb3b462414e9a502` (SHA-256 `3c880fbc4f2842b8d8561d13dca3c7d6eccba27023a09fff46dafbb142332344`). Independent recomputation produced zero mismatches for all 6,139 program IDs, 6,139 program-specialty IDs, 6,345 browse-membership IDs, and 6,345 alias IDs.

The production candidate's SQL can preserve program, program-specialty, and browse-membership IDs but omits alias and source-qualified external-ID tables. That is a real production schema completeness gap. It does not prevent offline research because no production RISE migration was applied and this release writes no database.

## Combined specialties

The identity graph contains 206 programs with two legitimate browse memberships/aliases. Wave 1 retains component memberships rather than flattening them. A canonical program may therefore appear in multiple specialty work queues while program facts remain attached once to the canonical `rise_program_id`.

## Future production rule

Production must not load this historical release directly. A later ratified change must:

1. preserve migrations 001-003;
2. add a forward migration for release-scoped aliases and source-qualified external identifiers;
3. prove all 6,139 resulting program IDs equal the pinned mapping;
4. satisfy source-rights, privacy, RLS, release, and product-registration gates; and
5. make no destructive identity rewrite.

None of those production actions is performed or implied by 4102B.

<!-- END 06_CANONICAL_BRANCH_SCHEMA_AUTHORITY.md -->

<!-- BEGIN 07_OLATHE_DISPOSITION.md -->

# 07 OLATHE DISPOSITION

## Accepted identity state

| Item | Value |
|---|---|
| Canonical `rise_program_id` | `rise_prg_31141a27-b249-5eae-8259-dd3fe679c4f2` |
| Active retained alias | `RISE-IM-0683` |
| Quarantined alias | `RISE-IM-0682` |
| Program-specialty ID | `rise_ps_54ba473a-9b30-5dc0-8f3f-0bd2bdb17d14` |
| Browse-membership ID | `rise_bm_17a10138-722d-51b0-baf8-52a67320ce7d` |
| Historical resolution ID | `rise_source_resolution_1401900001_2026-07-15` |

The normalized external-ID observation is `1401900001`; its namespace remains source-qualified as `ACGME_PROGRAM_ID_AS_REPORTED_BY_FREIDA`. It is an identity-disposition reference, not active program evidence.

## Why the disposition stands

The quarantined row has a trailing-space identifier and malformed URL and is an older, sparse duplicate. The retained observation and canonical identity are internally coherent. All alias, membership, external-ID, and orphan checks pass. Production commit `89d1fb4` removed the reviewed resolution because source-owner rights were unresolved; it supplied no contrary identity evidence.

The AAMC ERAS participating-program page was manually reviewed on 2026-08-10 and independently corroborates one Olathe Internal Medicine program entry associated with identifier `1401900001`: https://systems.aamc.org/eras/erasstats/par/display.cfm?spec_cd=140. This is a manual reference only and is not ingested as a dataset.

## Source separation

- Neither the retained nor quarantined FREIDA observation may populate research facts.
- `RISE-IM-0682` must never become active.
- The canonical program identity remains stable even if every inherited source field is blanked or reverified.
- Any current program fact must come from an authorized first-party replacement source.

The machine-readable disposition is `WAVE1_OLATHE_DISPOSITION.json`, SHA-256 `68742c07f25148b3e4eda37c53d8ca49acd55fb30bdcd7892970a21de309fc40`.

<!-- END 07_OLATHE_DISPOSITION.md -->

<!-- BEGIN 08_RESEARCH_RELEASE_ACCEPTANCE.md -->

# 08 RESEARCH RELEASE ACCEPTANCE

## Release

| Item | Value |
|---|---|
| Release ID | `rise_research_authority_2026-08-10_567ee6099af7` |
| Result | `RESEARCH_AUTHORITY_UNBLOCKED` |
| Status | `ACTIVE_ON_SATISFIED_CUSTODY_AND_VALIDATION_CONDITIONS` |
| Effective date | `2026-08-10` |
| Manifest | `RESEARCH_AUTHORITY_MANIFEST.json` |
| Manifest SHA-256 | `378c0e4421b2789088d4d48c0525bba589eb8a219f1a9a8a608722ab0d8b47e9` |
| Research schema | `rise.research.identity.v1` |
| Source policy | `rise.source.use.policy.v1` |

## Acceptance basis

The current Founder directive explicitly authorizes this run to clear stale/documentary blockers and prospectively accepts a bounded research release when every named condition passes. DR-023 independently records that RISE owns residency-program intelligence. The identity, schema, provenance, and source-rights reviews agree that a fail-closed per-domain decision lane can proceed without activating restricted source content or production.

The manifest records Brian as the named Founder, the acceptance mode as `PROSPECTIVE_CONDITIONAL_FOUNDER_DIRECTIVE`, and `exactBytesPreinspectedByFounder=false`. It does not fabricate a later signature or inspection of the exact bytes.

This package is the bounded implementation of that directive. It becomes the controlling 4102 research handoff only when every artifact is committed, the remote research-authority branch equals local `HEAD`, `SHA256SUMS` passes, and the validator returns `PASS` without `--preflight`. It supersedes the prior STOP_SAFE only for the work named below.

## Authorized

- Existing P1-RISE-4102 thread resumes `W1-IMFM-001`.
- Strict alias-to-canonical-ID joins through the sanitized identity sidecar.
- Creation of fail-closed per-domain source-access decisions.
- Conditional research of exact official domains only after an allowing decision.
- Minimal internal storage of discrete facts and provenance only after that decision.
- Source-separated derived intelligence held at `PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW`.

## Not authorized

- Inherited FREIDA factual reuse or activation.
- Any Residency Explorer extraction or use.
- Restricted report/data ingestion beyond manual policy reference.
- Student-facing display, raw redistribution, production import, deployment, or live data mutation.
- Canonical ID regeneration, fuzzy identity matching, or competing registry creation.

## Revocation / supersession

This release fails closed if hashes fail, canonical identity conflicts emerge, the Founder revokes it, controlling law/terms change, or a source is found to prohibit the planned access. A later release may supersede it additively; this immutable package must not be edited in place.

<!-- END 08_RESEARCH_RELEASE_ACCEPTANCE.md -->

<!-- BEGIN 09_VALIDATION_REPORT.md -->

# 09 VALIDATION REPORT

## Result

`PASS` for the research-only release gates defined by P1-RISE-4102B after committed/pushed custody is verified by the default validator. Builder-time execution uses `--preflight` and cannot activate the release.

## Identity gates

| Gate | Result |
|---|---|
| Wave 1 memberships resolve | PASS: 1,649 |
| Exact-designation IM/FM programs | PASS: 1,504 |
| Related combined memberships | PASS: 145 |
| Internal Medicine memberships | PASS: 828 |
| Family Medicine memberships | PASS: 821 |
| Active unresolved aliases | PASS: 0 |
| Duplicate alias keys | PASS: 0 |
| Multi-program alias mappings | PASS: 0 |
| Canonical ID collisions | PASS: 0 |
| External-ID collisions in pinned source | PASS: 0 |
| Orphan program-specialty, membership, alias, or external-ID records | PASS: 0 |
| Combined dual-membership programs | PASS: 206 legitimate; none with more than two |

## Olathe gates

- Canonical ID present: PASS.
- `RISE-IM-0683` active and unique: PASS.
- `RISE-IM-0682` absent from active aliases and present exactly once in quarantine: PASS.
- Source payload remains prohibited as factual evidence: PASS.

## Source-policy gates

- Unknown source default is `DO_NOT_USE`: PASS.
- Inherited FREIDA facts/derivatives/student display prohibited: PASS.
- Residency Explorer research/storage/display/derivatives prohibited: PASS.
- Public first-party research defaults false and requires a conforming, hash-pinned per-domain decision: PASS.
- Research, storage, derivation, and automation are independently decided: PASS.
- Source decisions are bound to the reviewed domain, expire within 90 days, and pass an executable validator: PASS.
- Resident-roster research/storage defaults false pending a named pre-collection privacy decision: PASS.
- Roster allowed fields are a strict six-field enum; 16 sensitive/personal fields are immutably prohibited: PASS.
- Student display, raw redistribution, and production mutation disabled release-wide: PASS.
- Restricted report classes not silently authorized: PASS.

## Artifact gates

- Source 4102A package checksum verification: PASS.
- Source release manifest hash: PASS (`85ef67906ad462e0a609dfa28c1e8479bc9fe287d8a05be0084969ea26fce3c8`).
- Sanitized identity sidecar hash: PASS (`78644bac033a3b511b3f7e5d4e637f9e57e13f8198bddabf81468cbe15bdda55`).
- Source policy hash: PASS (`85e3920f24b0191b5b015c31ea0cd0f88a7ae44068adbf7d4d4fc016dded42f7`).
- Olathe disposition hash: PASS (`68742c07f25148b3e4eda37c53d8ca49acd55fb30bdcd7892970a21de309fc40`).
- Research manifest hash: PASS (`378c0e4421b2789088d4d48c0525bba589eb8a219f1a9a8a608722ab0d8b47e9`).
- Package `SHA256SUMS`: PASS after final generation.

## No-production-mutation finding

This run created files only inside `_AI_HANDOFFS/from_codex/P1_RISE_4102B_RESEARCH_AUTHORITY_CLOSURE/`. It did not run migrations, connect to or alter a production database, deploy RISE, change WordPress/Matrix/StoryForge/ACTN/CAM/PS Studio/RankList IQ, or mutate Google Drive/Sheets. Git scope is rechecked against base commit `e8503866bce9cb941dd8f2dc38f39e62bd21e316` before release closure.

## Commands

`node validate_research_authority.mjs --preflight` before commit/push

`node validate_research_authority.mjs` after commit/push; only this can return release `PASS`

`node validate_source_access_decision.mjs <decision.json>` before any domain use

`node validate_privacy_collection_decision.mjs <decision.json>` before any roster collection

`shasum -a 256 -c SHA256SUMS`

The validator recomputes source counts, joins, collisions, orphans, deterministic IDs, policy restrictions, release ID, Olathe state, decision-contract hashes, and every package hash rather than trusting this prose. The decision validators were tested with both passing fixtures and deliberately invalid cross-domain/sensitive-field fixtures; invalid fixtures failed closed.

<!-- END 09_VALIDATION_REPORT.md -->

<!-- BEGIN 10_SOL_ULTRA_RESUME_INSTRUCTIONS.md -->

# 10 SOL ULTRA RESUME INSTRUCTIONS

## Status

The existing P1-RISE-4102 Work thread **may resume W1-IMFM-001 now** under `rise_research_authority_2026-08-10_567ee6099af7` after verifying this package. Do not start a second registry or regenerate IDs.

## Verification

From this folder run:

`shasum -a 256 -c SHA256SUMS`

`node validate_research_authority.mjs`

Both must return PASS. A failure stops the affected run before research.

## Identity join

1. Read `WAVE1_RESEARCH_IDENTITY.ndjson`.
2. Join each existing conflict/progress row by exact `legacy_rise_id == legacyAlias`.
3. Require exactly one mapping row per legacy alias.
4. Copy `riseProgramId`, `programSpecialtyId`, and `browseMembershipId` as routing keys only.
5. Never join by name, external ID, row number, URL, similarity, or fuzzy matching.
6. Keep component memberships. A combined program can legitimately have multiple aliases/browse memberships attached to one canonical program.
7. Process in ascending `riseProgramId` order; the first canonical key remains `rise_prg_001aea62-14ef-5525-9f82-632e48158f4f`.

## Research rules

- Load `SOURCE_USE_POLICY.json` as the controlling gate.
- Do not use inherited FREIDA names, URLs, identifiers, claims, or neighboring workbook cells even as discovery inputs.
- Build discovery and identity confirmation from independently permitted sources; unresolved rows remain `IDENTITY_MATCH_PENDING`.
- Create, validate, and hash-pin a conforming source-access decision before using any official program/hospital/institution domain. Research, storage, derivation, and automation are separate decisions; the base policy authorizes none by itself.
- Do not collect resident-roster data until a separate hash-pinned privacy decision passes `validate_privacy_collection_decision.mjs`, names the controller, and governs purpose, allowed fields, access, retention, deletion, expiry, and audit.
- Capture minimal discrete facts plus exact provenance; do not archive pages or copy expressive text.
- Never use Residency Explorer. Never use inherited FREIDA content as evidence. Do not ingest ACGME, NRMP, ABFM, or ABIM report values unless a later source-specific authorization says so.
- Leave unknown or unverifiable fields blank.
- Keep outputs at `PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW`; do not publish to students or production.
- Fail closed at field, record, source, or program scope while continuing unaffected work.

## Required output fields

Every populated research value must include the canonical ID, legacy alias, field key, normalized value, source class, official URL, page title, evidence locator, retrieval date, identity method, source-access decision ID/hash, research/storage/derivation/automation decisions, confidence, and maturity. Resident-roster values additionally require the privacy decision ID/hash.

## Olathe

Use only `rise_prg_31141a27-b249-5eae-8259-dd3fe679c4f2` with active alias `RISE-IM-0683`. Keep `RISE-IM-0682` quarantined. Do not import either FREIDA observation as a program fact.

## Stop conditions

Stop the smallest affected scope if identity is ambiguous, a source denies access, terms are incompatible or unknown, evidence conflicts, or a required citation/locator is missing. Escalate only a genuine legal/Founder decision; ordinary engineering and research exceptions remain inside the source-policy workflow.

<!-- END 10_SOL_ULTRA_RESUME_INSTRUCTIONS.md -->

<!-- BEGIN SOURCE_USE_POLICY.json -->

```json
{
  "schemaVersion": "rise.source.use.policy.v1",
  "policyId": "P1-RISE-4102B-SOURCE-USE-POLICY",
  "effectiveDate": "2026-08-10",
  "scope": "Offline IM/FM program-intelligence research under W1-IMFM-001",
  "legalNotice": "Operational governance policy based on the evidence reviewed on 2026-08-10; not legal advice and not a substitute for written source-owner permission.",
  "defaultState": "DO_NOT_USE",
  "failClosedScope": [
    "field",
    "record",
    "source",
    "program"
  ],
  "releaseWideRules": {
    "productionMutationAllowed": false,
    "studentDisplayAuthorized": false,
    "rawPageArchiveAllowed": false,
    "authenticationBypassAllowed": false,
    "robotsOrAccessControlBypassAllowed": false,
    "sourceLaunderingAllowed": false,
    "citationRequiredForEveryAcceptedFact": true,
    "retrievalDateRequiredForEveryAcceptedFact": true,
    "firstPartyIdentityVerificationRequired": true,
    "unverifiedValueDisposition": "LEAVE_BLANK",
    "researchOutputMaturity": "PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW",
    "sourceAccessDecisionRequiredForConditionalPublicSources": true,
    "residentRosterPrecollectionPrivacyApprovalRequired": true,
    "operationSpecificSourcePermissionsRequired": true,
    "expiredSourceDecisionsAllowed": false
  },
  "sourceClasses": [
    {
      "source_type": "MISSIONMED_GENERATED_CANONICAL_IDENTITY",
      "owner": "MissionMed RISE",
      "access_class": "INTERNAL_GENERATED_ROUTING_METADATA",
      "state": "AUTHORIZED_INTERNAL",
      "research_allowed": true,
      "internal_storage_allowed": true,
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": true,
      "reverification_required": true,
      "citation_required": false,
      "allowed_scope": "Exact legacyAlias-to-riseProgramId, programSpecialtyId, and browseMembershipId joins only; no program facts.",
      "conditions": [
        "Treat opaque IDs and aliases as non-evidentiary routing metadata.",
        "Do not infer any program fact from an ID, alias, membership, or deterministic seed.",
        "Independently verify every factual association from an authorized source."
      ],
      "authority": [
        "Current Founder directive P1-RISE-4102B",
        "DR-023 dated 2026-08-09: RISE owns residency-program intelligence",
        "Hash-pinned 4102A identity validation"
      ],
      "notes": "Use of the identity sidecar does not activate the inherited registry payload."
    },
    {
      "source_type": "INHERITED_FREIDA_PAYLOAD",
      "owner": "American Medical Association / FREIDA",
      "access_class": "LICENSE_RESTRICTED",
      "state": "LICENSE_RESTRICTED",
      "research_allowed": false,
      "internal_storage_allowed": true,
      "internal_storage_scope": "PRESERVE_EXISTING_IMMUTABLE_QUARANTINE_ONLY",
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "reverification_required": true,
      "citation_required": true,
      "discovery_hint_allowed": false,
      "conditions": [
        "Do not copy, activate, enrich, display, or derive factual outputs from the inherited payload.",
        "Do not expose names, external identifiers, statistics, text, or URLs from the payload as evidence.",
        "Written AMA permission or counsel approval is required before any broader reuse."
      ],
      "authority": [
        "AMA Terms of Use reviewed 2026-08-10",
        "FREIDA About FREIDA provenance reviewed 2026-08-10",
        "Historical release sourceRightsApproved=false"
      ],
      "notes": "Inherited names, URLs, identifiers, and neighboring workbook cells are excluded even as discovery inputs. This policy makes no claim that MissionMed has broader FREIDA reuse rights."
    },
    {
      "source_type": "RESIDENCY_EXPLORER",
      "owner": "Association of American Medical Colleges",
      "access_class": "WRITTEN_AUTHORIZATION_REQUIRED",
      "state": "DO_NOT_USE",
      "research_allowed": false,
      "internal_storage_allowed": false,
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "Do not manually or automatically extract Residency Explorer material.",
        "An authenticated AAMC session does not create reuse rights.",
        "Written AAMC authorization is required before use."
      ],
      "authority": [
        "Residency Explorer Terms and Conditions updated 2026-04-08"
      ],
      "notes": "The inherited release contains zero Residency Explorer material cells."
    },
    {
      "source_type": "OFFICIAL_RESIDENCY_PROGRAM_PAGE",
      "owner": "Individual residency program or sponsoring institution",
      "access_class": "PUBLIC_FIRST_PARTY_CONDITIONAL",
      "state": "CONDITIONAL_DOMAIN_DECISION_REQUIRED",
      "research_allowed": false,
      "conditional_research_allowed": true,
      "internal_storage_allowed": false,
      "conditional_internal_storage_allowed": true,
      "internal_storage_scope": "MINIMAL_DISCRETE_FACTS_AND_PROVENANCE_ONLY",
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "conditional_derived_data_allowed": true,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "A conforming, hash-pinned SOURCE_ACCESS_DECISION must return ALLOW_MINIMAL_FACT_RESEARCH for the exact domain before access or storage.",
        "Research, storage, derivation, and automation are independently decided; one permission never implies another.",
        "The unexpired decision must pass validate_source_access_decision.mjs before use.",
        "Check the domain's current terms, robots directives, and access controls before collection.",
        "Use normal public access only; no login, paywall, CAPTCHA, or technical-control bypass.",
        "Store discrete facts, source URL, page title, evidence locator, and retrieval date; do not archive raw HTML or expressive page text.",
        "Keep all outputs at PUBLICATION_CANDIDATE until a separate display review."
      ],
      "authority": [
        "Current Founder directive P1-RISE-4102B",
        "U.S. Copyright Office facts guidance reviewed 2026-08-10",
        "Per-domain terms review required"
      ],
      "notes": "No universal first-party-site license is asserted."
    },
    {
      "source_type": "OFFICIAL_HOSPITAL_OR_INSTITUTION_PAGE",
      "owner": "Individual hospital, health system, or institution",
      "access_class": "PUBLIC_FIRST_PARTY_CONDITIONAL",
      "state": "CONDITIONAL_DOMAIN_DECISION_REQUIRED",
      "research_allowed": false,
      "conditional_research_allowed": true,
      "internal_storage_allowed": false,
      "conditional_internal_storage_allowed": true,
      "internal_storage_scope": "MINIMAL_DISCRETE_FACTS_AND_PROVENANCE_ONLY",
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "conditional_derived_data_allowed": true,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "A conforming, hash-pinned SOURCE_ACCESS_DECISION must return ALLOW_MINIMAL_FACT_RESEARCH for the exact domain before access or storage.",
        "Research, storage, derivation, and automation are independently decided; one permission never implies another.",
        "The unexpired decision must pass validate_source_access_decision.mjs before use.",
        "Apply the same per-domain access, minimization, provenance, and publication-candidate controls as official program pages."
      ],
      "authority": [
        "Current Founder directive P1-RISE-4102B",
        "Per-domain terms review required"
      ],
      "notes": "Official institutional pages may independently verify program, benefit, curriculum, visa, facility, and leadership facts when explicitly stated."
    },
    {
      "source_type": "OFFICIAL_FACULTY_OR_LEADERSHIP_PAGE",
      "owner": "Individual program, hospital, or institution",
      "access_class": "PUBLIC_FIRST_PARTY_PRIVACY_MINIMIZED",
      "state": "CONDITIONAL_DOMAIN_AND_PRIVACY_DECISION_REQUIRED",
      "research_allowed": false,
      "conditional_research_allowed": true,
      "internal_storage_allowed": false,
      "conditional_internal_storage_allowed": true,
      "internal_storage_scope": "PUBLIC_PROFESSIONAL_ROLE_AND_OFFICIAL_BUSINESS_CONTACT_ONLY",
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "conditional_derived_data_allowed": true,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "A conforming, hash-pinned SOURCE_ACCESS_DECISION must allow the exact domain before access or storage.",
        "Research, storage, derivation, and automation are independently decided; one permission never implies another.",
        "The unexpired decision must pass validate_source_access_decision.mjs before use.",
        "Do not collect personal contact details, sensitive attributes, photos, or biography text.",
        "Apply per-domain terms and the official-page controls."
      ],
      "authority": [
        "Current Founder directive P1-RISE-4102B",
        "MissionMed minimization and privacy principles"
      ],
      "notes": "Student display requires a separate privacy and publication review."
    },
    {
      "source_type": "OFFICIAL_RESIDENT_ROSTER_PAGE",
      "owner": "Individual program, hospital, or institution",
      "access_class": "PUBLIC_FIRST_PARTY_PRIVACY_REVIEW",
      "state": "PRIVACY_APPROVAL_REQUIRED",
      "research_allowed": false,
      "conditional_research_allowed": true,
      "internal_storage_allowed": false,
      "conditional_internal_storage_allowed": true,
      "internal_storage_scope": "MINIMIZED_PUBLIC_PROFESSIONAL_ROSTER_FACTS_ONLY_AFTER_APPROVAL",
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "conditional_derived_data_allowed": true,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "Before collection, a named MissionMed data controller must approve purpose, access, retention, deletion, purpose expiry, and audit rules in a hash-pinned privacy decision.",
        "A conforming, hash-pinned SOURCE_ACCESS_DECISION must separately allow the exact domain.",
        "Research, storage, derivation, and automation are independently decided; one permission never implies another.",
        "Both unexpired decisions must pass their executable validators before collection.",
        "Do not download photos or copy biography text.",
        "Do not infer nationality, race, ethnicity, visa status, religion, or other sensitive attributes.",
        "Any aggregate representation metric requires explicit method, denominator, coverage, and separate privacy review."
      ],
      "authority": [
        "Current Founder directive P1-RISE-4102B",
        "MissionMed minimization and privacy principles"
      ],
      "notes": "No resident-roster collection is authorized until both domain-access and pre-collection privacy approvals exist."
    },
    {
      "source_type": "AAMC_GENERAL_PUBLIC_MATERIAL",
      "owner": "Association of American Medical Colleges",
      "access_class": "MANUAL_REFERENCE_ONLY",
      "state": "MANUAL_REVIEW",
      "research_allowed": false,
      "manual_reference_allowed": true,
      "research_scope": "MANUAL_POLICY_REFERENCE_AND_CITATION_ONLY",
      "internal_storage_allowed": true,
      "internal_storage_scope": "MINIMAL_CITATION_RECORD_ONLY",
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "No automated collection or blanket database ingestion.",
        "Do not treat general AAMC materials as permission to use Residency Explorer."
      ],
      "authority": [
        "AAMC Website Terms and Conditions updated 2026-05-01"
      ],
      "notes": "A source-specific written grant controls if later obtained."
    },
    {
      "source_type": "ACGME_PUBLIC_SITE_OR_REPORT",
      "owner": "Accreditation Council for Graduate Medical Education",
      "access_class": "MANUAL_REFERENCE_ONLY",
      "state": "LICENSE_RESTRICTED",
      "research_allowed": false,
      "manual_reference_allowed": true,
      "research_scope": "MANUAL_REFERENCE_CHECK_ONLY",
      "internal_storage_allowed": true,
      "internal_storage_scope": "MINIMAL_CITATION_RECORD_ONLY",
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "Do not bulk ingest Program Finder or publications.",
        "Written license or source-specific approval is required for republication or database use."
      ],
      "authority": [
        "ACGME Terms of Use reviewed 2026-08-10",
        "ACGME Publication/Document Usage reviewed 2026-08-10"
      ],
      "notes": "External IDs inherited from FREIDA are not independently ACGME-verified."
    },
    {
      "source_type": "NRMP_PUBLIC_REPORT_OR_DATA",
      "owner": "National Resident Matching Program",
      "access_class": "PERMISSION_OR_LICENSE_REQUIRED",
      "state": "LICENSE_RESTRICTED",
      "research_allowed": false,
      "manual_reference_allowed": true,
      "research_scope": "MANUAL_POLICY_REFERENCE_ONLY",
      "internal_storage_allowed": true,
      "internal_storage_scope": "MINIMAL_CITATION_RECORD_ONLY",
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "Do not ingest or quote published-report data without required permission.",
        "Do not access or use restricted R3 or unpublished data without an executed license."
      ],
      "authority": [
        "NRMP Match Data request and licensing page reviewed 2026-08-10"
      ],
      "notes": "Manual policy context is distinct from program-level data ingestion."
    },
    {
      "source_type": "ABFM_REPORT_OR_DATA",
      "owner": "American Board of Family Medicine",
      "access_class": "WRITTEN_PERMISSION_REQUIRED",
      "state": "LICENSE_RESTRICTED",
      "research_allowed": false,
      "manual_reference_allowed": true,
      "research_scope": "MANUAL_REFERENCE_ONLY",
      "internal_storage_allowed": true,
      "internal_storage_scope": "MINIMAL_CITATION_RECORD_ONLY",
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "No scraping, database extraction, derivative dataset, or commercial exploitation.",
        "Written permission is required before program-level pass-rate ingestion."
      ],
      "authority": [
        "ABFM Terms of Use updated 2024-03-14"
      ],
      "notes": "Manual review does not authorize storage of report values."
    },
    {
      "source_type": "ABIM_REPORT_OR_DATA",
      "owner": "American Board of Internal Medicine",
      "access_class": "MANUAL_REVIEW_REQUIRED",
      "state": "MANUAL_REVIEW",
      "research_allowed": false,
      "manual_reference_allowed": true,
      "research_scope": "MANUAL_REFERENCE_ONLY",
      "internal_storage_allowed": false,
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "No affirmative commercial-reuse license was located in this review.",
        "Complete source-specific permission review before storing or displaying program pass-rate values."
      ],
      "authority": [
        "ABIM Data and Reports page reviewed 2026-08-10"
      ],
      "notes": "Public posting alone is not treated as a database reuse license."
    },
    {
      "source_type": "MISSIONMED_INTERNAL_RECORD",
      "owner": "MissionMed or the applicable data subject/source owner",
      "access_class": "OWNER_AND_CONSENT_SPECIFIC",
      "state": "MANUAL_REVIEW",
      "research_allowed": false,
      "internal_storage_allowed": false,
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "Require a named data owner, purpose, consent or other authority, and retention rule before use."
      ],
      "authority": [
        "MissionMed ownership, consent, privacy, and auditability principles"
      ],
      "notes": "This release does not authorize alumni, ACTN, interview, or user data."
    },
    {
      "source_type": "UNOFFICIAL_AGGREGATOR_OR_BLOG",
      "owner": "Unknown or third party",
      "access_class": "NON_AUTHORITATIVE",
      "state": "DO_NOT_USE",
      "research_allowed": false,
      "internal_storage_allowed": false,
      "student_display_allowed": false,
      "raw_redistribution_allowed": false,
      "derived_data_allowed": false,
      "reverification_required": true,
      "citation_required": true,
      "conditions": [
        "May not serve as factual authority or resolve a conflict."
      ],
      "authority": [
        "P1-RISE-4102B source-priority and zero-fabrication rules"
      ],
      "notes": "Use an authorized first-party replacement source or leave the field blank."
    }
  ]
}
```

<!-- END SOURCE_USE_POLICY.json -->

<!-- BEGIN SOURCE_ACCESS_DECISION_SCHEMA.json -->

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://missionmedinstitute.com/schemas/rise/source-access-decision.v1.json",
  "title": "RISE Source Access Decision",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "decisionId",
    "domain",
    "sourceType",
    "reviewedAt",
    "reviewedBy",
    "termsUrl",
    "termsStatus",
    "robotsUrl",
    "robotsStatus",
    "accessControlsStatus",
    "researchDecision",
    "storageDecision",
    "derivationDecision",
    "automationDecision",
    "collectionMode",
    "requestsPerMinute",
    "maxConcurrency",
    "respectRetryAfter",
    "decisionAuthority",
    "allowedPaths",
    "prohibitedActions",
    "evidence",
    "expiresAt"
  ],
  "properties": {
    "schemaVersion": {
      "const": "rise.source.access.decision.v1"
    },
    "decisionId": {
      "type": "string",
      "pattern": "^rise_sad_[a-z0-9._-]+$"
    },
    "domain": {
      "type": "string",
      "pattern": "^[a-z0-9.-]+$"
    },
    "sourceType": {
      "enum": [
        "OFFICIAL_RESIDENCY_PROGRAM_PAGE",
        "OFFICIAL_HOSPITAL_OR_INSTITUTION_PAGE",
        "OFFICIAL_FACULTY_OR_LEADERSHIP_PAGE",
        "OFFICIAL_RESIDENT_ROSTER_PAGE"
      ]
    },
    "reviewedAt": {
      "type": "string",
      "format": "date-time"
    },
    "reviewedBy": {
      "type": "string",
      "minLength": 1
    },
    "termsUrl": {
      "type": ["string", "null"],
      "format": "uri"
    },
    "termsStatus": {
      "enum": [
        "EXPLICITLY_PERMITS_REQUESTED_OPERATIONS",
        "RESTRICTS_PLANNED_USE",
        "NO_TERMS_FOUND_REQUIRES_MANUAL_REVIEW",
        "AMBIGUOUS_REQUIRES_MANUAL_REVIEW"
      ]
    },
    "robotsUrl": {
      "type": ["string", "null"],
      "format": "uri"
    },
    "robotsStatus": {
      "enum": [
        "ALLOWS_REVIEWED_PATHS",
        "DISALLOWS_REVIEWED_PATHS",
        "NO_ROBOTS_FILE_REQUIRES_MANUAL_REVIEW",
        "AMBIGUOUS_REQUIRES_MANUAL_REVIEW"
      ]
    },
    "accessControlsStatus": {
      "enum": [
        "PUBLIC_NO_BYPASS",
        "LOGIN_REQUIRED_DENY",
        "PAYWALL_OR_CAPTCHA_DENY",
        "TECHNICAL_CONTROL_DENY"
      ]
    },
    "researchDecision": {
      "enum": [
        "ALLOW_MINIMAL_FACT_RESEARCH",
        "DENY",
        "MANUAL_REVIEW_REQUIRED"
      ]
    },
    "storageDecision": {
      "enum": [
        "ALLOW_MINIMAL_DISCRETE_FACT_STORAGE",
        "DENY",
        "MANUAL_REVIEW_REQUIRED"
      ]
    },
    "derivationDecision": {
      "enum": [
        "ALLOW_PROVENANCE_BOUND_DERIVATION",
        "DENY",
        "MANUAL_REVIEW_REQUIRED"
      ]
    },
    "automationDecision": {
      "enum": [
        "ALLOW_BOUNDED_AUTOMATION",
        "DENY",
        "MANUAL_REVIEW_REQUIRED"
      ]
    },
    "collectionMode": {
      "enum": [
        "HUMAN_REVIEW_ONLY",
        "BOUNDED_AUTOMATION"
      ]
    },
    "requestsPerMinute": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10
    },
    "maxConcurrency": {
      "type": "integer",
      "minimum": 1,
      "maximum": 2
    },
    "respectRetryAfter": {
      "const": true
    },
    "decisionAuthority": {
      "enum": [
        "EXPLICIT_SITE_TERMS",
        "NAMED_HUMAN_SOURCE_RIGHTS_APPROVAL"
      ]
    },
    "allowedPaths": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^/"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "prohibitedActions": {
      "type": "array",
      "items": {
        "enum": [
          "RAW_HTML_ARCHIVE",
          "IMAGE_DOWNLOAD",
          "EXPRESSIVE_TEXT_COPY",
          "AUTHENTICATION_BYPASS",
          "ACCESS_CONTROL_BYPASS",
          "BULK_SITE_MIRROR",
          "STUDENT_DISPLAY",
          "RAW_REDISTRIBUTION"
        ]
      },
      "contains": {
        "const": "RAW_HTML_ARCHIVE"
      },
      "minItems": 6,
      "uniqueItems": true
    },
    "evidence": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "url",
          "locator",
          "retrievedAt"
        ],
        "properties": {
          "url": {
            "type": "string",
            "format": "uri"
          },
          "locator": {
            "type": "string",
            "minLength": 1
          },
          "retrievedAt": {
            "type": "string",
            "format": "date-time"
          }
        }
      }
    },
    "privacyDecisionId": {
      "type": "string",
      "pattern": "^rise_priv_[a-z0-9._-]+$"
    },
    "expiresAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "researchDecision": {
            "const": "ALLOW_MINIMAL_FACT_RESEARCH"
          }
        },
        "required": [
          "researchDecision"
        ]
      },
      "then": {
        "required": [
          "termsUrl",
          "robotsUrl"
        ],
        "properties": {
          "termsStatus": {
            "const": "EXPLICITLY_PERMITS_REQUESTED_OPERATIONS"
          },
          "robotsStatus": {
            "const": "ALLOWS_REVIEWED_PATHS"
          },
          "accessControlsStatus": {
            "const": "PUBLIC_NO_BYPASS"
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "storageDecision": {
            "const": "ALLOW_MINIMAL_DISCRETE_FACT_STORAGE"
          }
        },
        "required": ["storageDecision"]
      },
      "then": {
        "required": ["termsUrl", "robotsUrl"],
        "properties": {
          "termsStatus": {
            "const": "EXPLICITLY_PERMITS_REQUESTED_OPERATIONS"
          },
          "accessControlsStatus": {
            "const": "PUBLIC_NO_BYPASS"
          },
          "robotsStatus": {
            "const": "ALLOWS_REVIEWED_PATHS"
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "derivationDecision": {
            "const": "ALLOW_PROVENANCE_BOUND_DERIVATION"
          }
        },
        "required": ["derivationDecision"]
      },
      "then": {
        "required": ["termsUrl", "robotsUrl"],
        "properties": {
          "termsStatus": {
            "const": "EXPLICITLY_PERMITS_REQUESTED_OPERATIONS"
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "automationDecision": {
            "const": "ALLOW_BOUNDED_AUTOMATION"
          }
        },
        "required": ["automationDecision"]
      },
      "then": {
        "required": ["termsUrl", "robotsUrl"],
        "properties": {
          "termsStatus": {
            "const": "EXPLICITLY_PERMITS_REQUESTED_OPERATIONS"
          },
          "robotsStatus": {
            "const": "ALLOWS_REVIEWED_PATHS"
          },
          "collectionMode": {
            "const": "BOUNDED_AUTOMATION"
          }
        }
      },
      "else": {
        "properties": {
          "collectionMode": {
            "const": "HUMAN_REVIEW_ONLY"
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "sourceType": {
            "const": "OFFICIAL_RESIDENT_ROSTER_PAGE"
          }
        },
        "required": [
          "sourceType"
        ]
      },
      "then": {
        "required": [
          "privacyDecisionId"
        ]
      }
    }
  ]
}
```

<!-- END SOURCE_ACCESS_DECISION_SCHEMA.json -->

<!-- BEGIN PRIVACY_COLLECTION_DECISION_SCHEMA.json -->

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://missionmedinstitute.com/schemas/rise/privacy-collection-decision.v1.json",
  "title": "RISE Privacy Collection Decision",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "decisionId",
    "dataClass",
    "decision",
    "controller",
    "approvedBy",
    "approvedAt",
    "purpose",
    "allowedFields",
    "prohibitedFields",
    "accessRoles",
    "retentionDays",
    "deletionProcedure",
    "purposeExpiresAt",
    "auditLogLocation",
    "studentDisplayAllowed",
    "sensitiveInferenceAllowed"
  ],
  "properties": {
    "schemaVersion": {
      "const": "rise.privacy.collection.decision.v1"
    },
    "decisionId": {
      "type": "string",
      "pattern": "^rise_priv_[a-z0-9._-]+$"
    },
    "dataClass": {
      "const": "PUBLIC_RESIDENT_ROSTER"
    },
    "decision": {
      "enum": [
        "APPROVED",
        "DENIED"
      ]
    },
    "controller": {
      "type": "string",
      "minLength": 1
    },
    "approvedBy": {
      "type": "string",
      "minLength": 1
    },
    "approvedAt": {
      "type": "string",
      "format": "date-time"
    },
    "purpose": {
      "const": "RESIDENCY_PROGRAM_ROSTER_RESEARCH"
    },
    "allowedFields": {
      "type": "array",
      "items": {
        "enum": [
          "public_display_name",
          "training_year",
          "official_role",
          "medical_school",
          "medical_degree",
          "official_profile_url"
        ]
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "prohibitedFields": {
      "const": [
        "personal_email",
        "personal_phone",
        "home_address",
        "photo",
        "biography_text",
        "date_of_birth",
        "race",
        "ethnicity",
        "nationality",
        "citizenship",
        "visa_status",
        "religion",
        "disability",
        "sexual_orientation",
        "gender_identity",
        "family_status"
      ]
    },
    "accessRoles": {
      "type": "array",
      "items": {
        "enum": [
          "RISE_RESEARCHER",
          "RISE_PRIVACY_REVIEWER"
        ]
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "retentionDays": {
      "type": "integer",
      "minimum": 1,
      "maximum": 90
    },
    "deletionProcedure": {
      "type": "string",
      "minLength": 1
    },
    "purposeExpiresAt": {
      "type": "string",
      "format": "date-time"
    },
    "auditLogLocation": {
      "type": "string",
      "minLength": 1
    },
    "studentDisplayAllowed": {
      "const": false
    },
    "sensitiveInferenceAllowed": {
      "const": false
    }
  }
}
```

<!-- END PRIVACY_COLLECTION_DECISION_SCHEMA.json -->

<!-- BEGIN RESEARCH_AUTHORITY_MANIFEST.json -->

```json
{
  "schemaVersion": "rise.research.authority.v1",
  "releaseId": "rise_research_authority_2026-08-10_567ee6099af7",
  "ticket": "P1-RISE-4102B",
  "generatedAt": "2026-08-10T11:24:33Z",
  "effectiveDate": "2026-08-10",
  "immutable": true,
  "result": "RESEARCH_AUTHORITY_UNBLOCKED",
  "scope": "W1-IMFM-001_OFFLINE_RESEARCH_ONLY",
  "activationStatus": "ACTIVE_ON_SATISFIED_CUSTODY_AND_VALIDATION_CONDITIONS",
  "resumeAuthorized": true,
  "productionAuthorized": false,
  "studentDisplayAuthorized": false,
  "restrictedSourceRightsApproved": false,
  "publicFirstPartyResearchLaneAuthorized": true,
  "maximumRecordState": "PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW",
  "activationConditions": [
    "Every package artifact is committed on codex/p1-rise-4102b-research-authority.",
    "The remote branch head equals the local release commit.",
    "SHA256SUMS verification passes.",
    "validate_research_authority.mjs returns PASS without --preflight."
  ],
  "acceptance": {
    "acceptedBy": "Brian",
    "acceptedRole": "Founder",
    "acceptanceDate": "2026-08-10",
    "acceptanceMode": "PROSPECTIVE_CONDITIONAL_FOUNDER_DIRECTIVE",
    "threadEvidence": "Current P1-RISE-4102B Founder directive in this Codex task.",
    "acceptedScope": "A source-separated offline W1-IMFM-001 release satisfying every user-specified validation gate and making no production mutation.",
    "exactBytesPreinspectedByFounder": false,
    "interpretation": "The Founder prospectively authorized the bounded release class and its objective gates; this record does not represent later visual inspection or signature of the exact bytes.",
    "conditionedOn": [
      "Identity counts and collisions pass.",
      "Restricted-source permissions remain false.",
      "Per-domain source decisions fail closed.",
      "Release custody is committed and pushed.",
      "Independent adversarial findings are repaired and revalidated."
    ]
  },
  "authority": {
    "founderDirective": {
      "authorityType": "CURRENT_FOUNDER_DIRECTIVE_IN_THREAD",
      "directive": "Clear every legitimately resolvable blocker and authorize P1-RISE-4102 to resume W1-IMFM-001 when validation passes.",
      "scope": "Offline, source-separated, verifiable IM/FM research; no production mutation or student publication."
    },
    "riseOwnershipEvidence": {
      "record": "/Users/brianb/MissionMed_OS/decisions/DR-023_f2_lor_1009_authority_unblock_and_bounded_production_release.md",
      "sha256": "c5d977259b0b2f54ed688fe6d780f182bdd06f78e5a5c1f4ef732a7cc74fdab5",
      "statement": "RISE owns residency-program intelligence.",
      "line": 212
    },
    "architectureAuthority": {
      "record": "/Users/brianb/MissionMed_worktrees/MM-PLAT-000-platform-bootstrap-e850386/MISSIONMED_PLATFORM/docs/ADR/MM-FABLE-ADR-001_missionmed_platform_architecture.md",
      "sha256": "50bff490faab9c089840c1db87cc3b7b92e721a3d4992bab24e1950035439f00"
    },
    "constitutionRevision3": {
      "record": "/Users/brianb/MissionMed/MissionMed_Platform_v1_Governing_Constitution_Revision_3.docx",
      "sha256": "aea2be8e5e75495b2dee63f48de6c9ea63883c90c4b6f1d7ab4daa1989c232ce",
      "treatment": "Applied as Founder-directed governing principles for this bounded run; not represented as globally ratified MissionMed OS authority."
    }
  },
  "repository": {
    "url": "https://github.com/brinyu13/missionmed-hq.git",
    "researchAuthorityBranch": "codex/p1-rise-4102b-research-authority",
    "baseBranch": "p1-rise-4000",
    "baseCommit": "e8503866bce9cb941dd8f2dc38f39e62bd21e316",
    "historicalIdentityBranch": "codex/p1-rise-4006",
    "historicalIdentityHead": "365bd8eba38a9dc9058367e1d888a45850c34149",
    "historicalEvidenceCommit": "46467b1568aafc0093f1e63f8098118266e7c818",
    "productionCandidateBranch": "codex/p1-rise-4006-production",
    "productionCandidateLocalHead": "2d0fc6b986ab1cc010e521c54b7b42ec916c1e32",
    "productionCandidateRemoteHeadObserved": "ad0fae528d9d174fb01a7717af41923323074183",
    "mergeBase": "9c1fa72e6b056db8fe0e17031fcaa688f78569"
  },
  "canonicalIdentity": {
    "authorityClass": "IMMUTABLE_IDENTITY_CONTINUITY_SIDECAR",
    "researchSchemaVersion": "rise.research.identity.v1",
    "canonicalContract": "programs.ndjson.id == rise_program_id",
    "sourceReleaseId": "rise_registry_2026-07-09_f51f0643a2d9",
    "sourceReleaseActivationStatus": "offline_shadow_only",
    "sourceReleaseManifestSha256": "85ef67906ad462e0a609dfa28c1e8479bc9fe287d8a05be0084969ea26fce3c8",
    "sourceValidationSha256": "28f32301cc0ec6cccd6a06d444bdf7dbc72963e4ca85c420e19cec73e4704216",
    "identityPackageManifestSha256": "76ad89e258fa6a6b4f52e64e9dba071b421dcacabdfa9139b56333e6949b3865",
    "identityImplementationSha256": "3c880fbc4f2842b8d8561d13dca3c7d6eccba27023a09fff46dafbb142332344",
    "identityImplementationGitBlob": "2b8509621c09ba771ed1ea61eb3b462414e9a502",
    "useRestriction": "NON_EVIDENTIARY_ROUTING_ONLY",
    "programFactsActivated": false,
    "sourcePayloadActivated": false
  },
  "wave1": {
    "waveId": "W1-IMFM-001",
    "memberships": 1649,
    "exactDesignationPrograms": 1504,
    "relatedCombinedMemberships": 145,
    "internalMedicineMemberships": 828,
    "familyMedicineMemberships": 821,
    "uniqueCanonicalProgramIds": 1649,
    "unresolvedActiveAliases": 0,
    "canonicalIdCollisions": 0,
    "externalIdCollisionsInPinnedSource": 0,
    "orphanRecordsInPinnedSource": 0,
    "sanitizedIdentityFile": "WAVE1_RESEARCH_IDENTITY.ndjson",
    "sanitizedIdentitySha256": "78644bac033a3b511b3f7e5d4e637f9e57e13f8198bddabf81468cbe15bdda55"
  },
  "olathe": {
    "disposition": "ACCEPTED_FOR_IDENTITY_CONTINUITY_SOURCE_PAYLOAD_QUARANTINED",
    "canonicalRiseProgramId": "rise_prg_31141a27-b249-5eae-8259-dd3fe679c4f2",
    "retainedAlias": "RISE-IM-0683",
    "quarantinedAlias": "RISE-IM-0682",
    "dispositionFile": "WAVE1_OLATHE_DISPOSITION.json",
    "dispositionSha256": "68742c07f25148b3e4eda37c53d8ca49acd55fb30bdcd7892970a21de309fc40"
  },
  "sourceAuthority": {
    "policyFile": "SOURCE_USE_POLICY.json",
    "policySha256": "85e3920f24b0191b5b015c31ea0cd0f88a7ae44068adbf7d4d4fc016dded42f7",
    "sourceAccessDecisionSchemaFile": "SOURCE_ACCESS_DECISION_SCHEMA.json",
    "sourceAccessDecisionSchemaSha256": "c1b92face43df2c5e882f7440efba19407091c7358a5010f6c1427b6457d9712",
    "privacyCollectionDecisionSchemaFile": "PRIVACY_COLLECTION_DECISION_SCHEMA.json",
    "privacyCollectionDecisionSchemaSha256": "fb66c308fc4b304119f0ee2ef6d7a01d709e6f0cf2d9c94912980e02807f0abb",
    "sourceAccessDecisionValidatorFile": "validate_source_access_decision.mjs",
    "sourceAccessDecisionValidatorSha256": "18280b2c81679898f83b531d244d3c5040cf05f763d8dfbb8c7db609285d6bc8",
    "privacyCollectionDecisionValidatorFile": "validate_privacy_collection_decision.mjs",
    "privacyCollectionDecisionValidatorSha256": "bd28938acdf93ed03e555c78c95e432c2a05f0c316c50d2262cfd76ddbc777ef",
    "defaultState": "DO_NOT_USE",
    "publicFirstPartyResearchAuthorized": false,
    "conditionalPublicFirstPartyResearchAuthorized": true,
    "unconditionalPublicDomainAuthorization": false,
    "domainAccessDecisionRequired": true,
    "residentRosterPrecollectionPrivacyApprovalRequired": true,
    "freidaFactsAuthorized": false,
    "residencyExplorerAuthorized": false,
    "studentDisplayAuthorized": false,
    "rawRedistributionAuthorized": false,
    "productionUseAuthorized": false
  },
  "resume": {
    "thread": "P1-RISE-4102",
    "wave": "W1-IMFM-001",
    "resumeAuthorized": true,
    "authorizedWork": "Create per-domain decisions and research only exact official public first-party paths those decisions allow; resident-roster work additionally requires a named privacy decision.",
    "outputMaturity": "PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW",
    "joinRule": "Strict legacyAlias equality join to WAVE1_RESEARCH_IDENTITY.ndjson; never join by name or fuzzy matching."
  },
  "exclusions": {
    "productionMutation": true,
    "productionDeployment": true,
    "studentFacingPublication": true,
    "inheritedFreidaFactUse": true,
    "residencyExplorerUse": true,
    "restrictedReportIngestion": true,
    "canonicalIdRegeneration": true,
    "liveGoogleMutation": true,
    "inheritedProgramNames": true,
    "inheritedProgramUrls": true,
    "inheritedExternalIdentifiers": true,
    "inheritedClaims": true,
    "inheritedSourceDocuments": true,
    "inheritedDiscoveryHints": true
  },
  "nonBlockingExternalActions": [
    "Written AMA permission or counsel approval for any broader FREIDA reuse.",
    "Written AAMC authorization for Residency Explorer use.",
    "Source-specific permission or legal review before ACGME, NRMP, ABFM, or ABIM report ingestion or student display.",
    "Formal MissionMed OS product/passport registration and additive production schema reconciliation before production activation."
  ],
  "validation": {
    "requiredValidator": "validate_research_authority.mjs",
    "expectedResult": "PASS",
    "sourceReleaseValidationResult": "PASS",
    "productionMutationPerformed": false,
    "preexistingUntrackedRootsPreserved": [
      "_AI_HANDOFFS/from_codex/P1_RISE_4102A_CANONICAL_IDENTITY_UNBLOCK/",
      "outputs/"
    ]
  }
}
```

<!-- END RESEARCH_AUTHORITY_MANIFEST.json -->

<!-- BEGIN VALIDATION_REPORT.json -->

```json
{
  "schemaVersion": "rise.research.authority.validation.v1",
  "releaseId": "rise_research_authority_2026-08-10_567ee6099af7",
  "generatedAt": "2026-08-10T11:24:33Z",
  "result": "ARTIFACT_PASS_CUSTODY_REQUIRES_POST_PUSH_VALIDATION",
  "validator": "validate_research_authority.mjs",
  "counts": {
    "sourcePrograms": 6139,
    "sourceProgramSpecialties": 6139,
    "sourceBrowseMemberships": 6345,
    "sourceAliases": 6345,
    "sourceExternalIdentifiers": 6139,
    "sourceQuarantineRows": 1,
    "wave1Memberships": 1649,
    "wave1ExactDesignationPrograms": 1504,
    "wave1RelatedCombinedMemberships": 145,
    "wave1InternalMedicineMemberships": 828,
    "wave1FamilyMedicineMemberships": 821,
    "wave1UniqueCanonicalProgramIds": 1649
  },
  "gates": {
    "sourcePackageHashes": "PASS",
    "identityForeignKeys": "PASS",
    "deterministicIdentityRecomputation": "PASS",
    "duplicateRecordIds": 0,
    "duplicateAliasKeys": 0,
    "multiProgramAliasMappings": 0,
    "externalIdentifierCollisions": 0,
    "orphanRecords": 0,
    "activeUnresolvedWave1Aliases": 0,
    "olathePartition": "PASS",
    "sourcePolicyFailClosed": "PASS",
    "sourceAccessDecisionContract": "PASS",
    "sourceAccessDecisionDomainAndExpiryValidator": "PASS",
    "privacyDecisionStrictFieldAndExpiryValidator": "PASS",
    "releaseCustody": "REQUIRES_COMMIT_PUSH_AND_DEFAULT_VALIDATOR",
    "restrictedSourceRightsApproved": false,
    "productionMutationPerformed": false
  },
  "sanitizedMappingFieldAllowlist": [
    "legacyAlias",
    "riseProgramId",
    "programSpecialtyId",
    "browseMembershipId",
    "browseSpecialty",
    "relationship",
    "identityReleaseId",
    "identityUse"
  ],
  "artifactHashes": {
    "sourceReleaseManifest": "85ef67906ad462e0a609dfa28c1e8479bc9fe287d8a05be0084969ea26fce3c8",
    "sourceValidation": "28f32301cc0ec6cccd6a06d444bdf7dbc72963e4ca85c420e19cec73e4704216",
    "identityPackageManifest": "76ad89e258fa6a6b4f52e64e9dba071b421dcacabdfa9139b56333e6949b3865",
    "sourceUsePolicy": "85e3920f24b0191b5b015c31ea0cd0f88a7ae44068adbf7d4d4fc016dded42f7",
    "sourceAccessDecisionSchema": "c1b92face43df2c5e882f7440efba19407091c7358a5010f6c1427b6457d9712",
    "privacyCollectionDecisionSchema": "fb66c308fc4b304119f0ee2ef6d7a01d709e6f0cf2d9c94912980e02807f0abb",
    "sourceAccessDecisionValidator": "18280b2c81679898f83b531d244d3c5040cf05f763d8dfbb8c7db609285d6bc8",
    "privacyCollectionDecisionValidator": "bd28938acdf93ed03e555c78c95e432c2a05f0c316c50d2262cfd76ddbc777ef",
    "wave1ResearchIdentity": "78644bac033a3b511b3f7e5d4e637f9e57e13f8198bddabf81468cbe15bdda55",
    "olatheDisposition": "68742c07f25148b3e4eda37c53d8ca49acd55fb30bdcd7892970a21de309fc40",
    "researchAuthorityManifest": "378c0e4421b2789088d4d48c0525bba589eb8a219f1a9a8a608722ab0d8b47e9"
  },
  "note": "This builder report is independently reproduced by the standalone validator before release closure."
}
```

<!-- END VALIDATION_REPORT.json -->

<!-- BEGIN WAVE1_OLATHE_DISPOSITION.json -->

```json
{
  "schemaVersion": "rise.research.olathe.disposition.v1",
  "dispositionId": "rise_source_resolution_1401900001_2026-07-15",
  "status": "ACCEPTED_FOR_IDENTITY_CONTINUITY_SOURCE_PAYLOAD_QUARANTINED",
  "canonicalRiseProgramId": "rise_prg_31141a27-b249-5eae-8259-dd3fe679c4f2",
  "retainedAlias": "RISE-IM-0683",
  "quarantinedAlias": "RISE-IM-0682",
  "programSpecialtyId": "rise_ps_54ba473a-9b30-5dc0-8f3f-0bd2bdb17d14",
  "browseMembershipId": "rise_bm_17a10138-722d-51b0-baf8-52a67320ce7d",
  "normalizedExternalIdentifierObservation": {
    "namespace": "ACGME_PROGRAM_ID_AS_REPORTED_BY_FREIDA",
    "value": "1401900001",
    "use": "IDENTITY_DISPOSITION_REFERENCE_ONLY",
    "activeProgramEvidence": false
  },
  "sourcePayloadPolicy": {
    "retainedFreidaObservationMayPopulateFacts": false,
    "quarantinedFreidaObservationMayPopulateFacts": false,
    "quarantinedAliasMayBecomeActive": false,
    "firstPartyReverificationRequired": true
  },
  "independentCorroboration": {
    "sourceType": "AAMC_GENERAL_PUBLIC_MATERIAL",
    "accessMode": "MANUAL_REFERENCE_ONLY",
    "url": "https://systems.aamc.org/eras/erasstats/par/display.cfm?spec_cd=140",
    "reviewedAt": "2026-08-10",
    "permittedUse": "Corroborate that a single Olathe Internal Medicine program entry is listed; do not ingest the page as a dataset."
  },
  "rationale": "The historical duplicate disposition is technically coherent and no contrary identity evidence exists. Source-rights uncertainty is isolated from canonical identity continuity."
}
```

<!-- END WAVE1_OLATHE_DISPOSITION.json -->
