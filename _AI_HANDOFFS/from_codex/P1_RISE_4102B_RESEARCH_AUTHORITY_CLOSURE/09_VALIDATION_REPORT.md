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
