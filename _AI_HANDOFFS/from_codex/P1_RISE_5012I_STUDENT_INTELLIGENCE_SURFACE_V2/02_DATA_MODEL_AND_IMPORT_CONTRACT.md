# Data model and import contract

Production path:

`completed provider dossier -> provider-neutral structured bundle -> exact ACGME identity reconciliation -> canonical review disposition -> approved-current promotion -> release-bound serving projection -> Program File/search/filter`

The checked-in bundle is `rise/config/research-dossiers/texas-adult-neurology-2026-09-12.v1.json`. It contains 16 ingests, 26 attempted domains per program, 578 claims, source URLs/locators, retrieval dates, provider/run IDs, evidence states, and zero new spend.

The operator importer is `rise/tools/import-structured-dossiers.mjs`. It is idempotent: the second production execution inserted 0 runs and 0 claims. It resolves each source subject by the immutable `ACGME_PROGRAM` identifier rather than trusting a provider-local program UUID. Final dispositions are mutually exclusive and preserve `APPROVED_CURRENT`, `APPROVED_HISTORICAL`, `RESEARCHED_NOT_FOUND`, `CONFLICT_REQUIRES_REVIEW`, and `INSUFFICIENT_EVIDENCE`.

Production import readback:

- inserted runs: 16
- inserted claims: 578
- identity matches: 16/16
- dispositions: 403 approved current, 3 approved historical, 137 researched not found, 28 conflict review, 7 insufficient evidence
- current promotions: 403
- review rows: 578
- lineage rows: 403
- completed research-factory claims after import: 10,736
- visible promotions after import: 3,038

Provider custody remains provider-neutral: Claude Opus 2,301; Claude Sonnet 4,230; OpenAI 79; Parallel 4,126 completed claims. No provenance was deleted or rewritten.
