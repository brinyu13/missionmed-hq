# 03 — Data Source Map

| Domain | Discovered source | Current usable state | Publication gate |
|---|---|---|---|
| Program identity | Canonical 4102 residency registry / Google Sheet-derived release material | 6,346 specialty rows; 6,345 active memberships; 6,139 normalized unique program IDs; 828 active unique IM ACGME IDs; 821 FM rows | Full source-owner authorization set and immutable active-release receipt are missing |
| SOAP 2026 | Validated canonical sheet import | 883 YES, 4,024 NO, 1,439 UNKNOWN; 925 source rows, 883 mapped, 42 unmapped | Rights-approved release and program-specialty binding required |
| IM deep research | Frozen corpora, ledgers, dossiers, normalized results | 135 frozen-deep; 1 validated complete; 126 partial; 566 foundational-only; 1 identity-review | Current provenance, conflict, privacy, and release gates required |
| SOL56 / Opus / Sol | On-disk research corpora | Discovery-only; not ingested | Source receipt, normalization, exact identity reconciliation |
| Parallel results | Raw, normalized, staging, SQLite run records | Local factory exists; no canonical writer | Provider authority, spend controls, deterministic ingest/review |
| ABIM | Structured research artifacts and claims | Not activated | Current source and cycle receipts |
| Residents/people/fellows/outcomes | Research artifacts and public-professional sources | Partial and privacy-sensitive | Roster privacy decision, source-located assertions, review |
| Matrix applicant profile | Matrix remains canonical | No versioned RISE read/write service found | Matrix owner contract and field-level consent |
| Membership | MissionMed access gate evidence | No RISE feature-key mapping found | Entitlement owner mapping and fail-closed service contract |
| File Vault CV | File Vault V2 | No safe ordinary-student RISE contract found | Owner-approved selector/upload/proposal contract |
| RankList IQ | Separate protected product | No callable RISE integration found | Product-owner handoff contract |
| ACTN/alumni | Separate protected data | Not production-ready for RISE | Owner contract and privacy authorization |

No source material was published, copied into browser code, or written to a provider. The test fixture is synthetic and isolated under `rise/tests/browser/`.

Deduplication law for a future authorized ingest: ACGME ID first, then exact program identity and specialty/track; preserve RISE IDs and aliases; quarantine collisions; never overwrite newer/stronger evidence; retain conflicts and unknowns.
