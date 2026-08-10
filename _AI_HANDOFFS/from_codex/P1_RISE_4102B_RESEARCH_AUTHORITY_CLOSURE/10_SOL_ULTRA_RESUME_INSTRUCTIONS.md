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
