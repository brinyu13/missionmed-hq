# I1Q-1008D canonical corpus discovery

Status: **C1_OBSERVED**. Extraction: **BLOCKED**.

This handoff establishes a privacy-safe, current runtime candidate inventory and
artifact-availability receipt. It does **not** establish an owner-attested canonical
Dr. J corpus, segment-level speaker identity, rights, privacy clearance, or permission
to extract questions.

Start with [the combined handoff](COMPLETE_COMBINED_HANDOFF.md), then use the focused
reports and ledgers below.

## Reports

- [Executive status and mandatory metrics](reports/00_EXECUTIVE_STATUS.md)
- [Authority and runtime inventory](reports/01_AUTHORITY_AND_RUNTIME_INVENTORY.md)
- [Provenance and completeness](reports/02_PROVENANCE_AND_COMPLETENESS.md)
- [Artifact integrity and duplicates](reports/03_ARTIFACT_INTEGRITY_AND_DUPLICATES.md)
- [Speaker, medical, privacy, and rights review](reports/04_SPEAKER_MEDICAL_PRIVACY_RIGHTS.md)
- [Database, index, Cloudflare R2, and content delivery network review](reports/05_DATABASE_INDEX_R2_CDN.md)
- [Extraction readiness and exact resume sequence](reports/06_EXTRACTION_READINESS_AND_RESUME.md)
- [True external blockers](reports/07_TRUE_EXTERNAL_BLOCKERS.md)
- [Validation and multidisciplinary review](reports/08_VALIDATION_AND_REVIEW.md)

## Ledgers and evidence

- [Mission ledger](ledgers/MISSION_LEDGER.md)
- [Decision ledger](ledgers/AGENT_DECISIONS.md)
- [Discovery-attempt ledger](ledgers/DISCOVERY_ATTEMPTS.md)
- [Sanitized live receipt](evidence/runtime_corpus_probe.json)
- [Lower-authority discovery receipts](evidence/discovery_receipts.json)
- [Exact autonomous continuation](NEXT_AUTONOMOUS_EXECUTION.md)

## Safe tooling

- [Zero-retention runtime probe](tools/sanitize_runtime_corpus_probe.mjs)
- [Fixture-only adversarial suite](tools/test_sanitize_runtime_corpus_probe.mjs)
- [Handoff and receipt validator](tools/validate_handoff.mjs)

Per-run entity aliases are keyed and unlinkable across runs. Content hashes establish
byte identity only. No receipt contains transcript text, titles, raw runtime identifiers,
source locations, speaker strings, credentials, cookies, or request headers.
