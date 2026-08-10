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
