# Florida import-ready handoff

Florida must enter through the same provider-neutral bundle and importer contract used for Texas. Do not alter the live UI or create a provider-specific path.

Required sequence:

1. Validate the Florida dossier bundle against the structured dossier contract.
2. Reconcile every record by canonical `ACGME_PROGRAM` identifier and exact designation.
3. Dry-run; require 100% identity accounting and zero Child/Adult specialty leakage.
4. Apply one canonical transaction through `rise/tools/import-structured-dossiers.mjs`.
5. Re-run to prove zero insertions.
6. Re-read runs, claims, reviews, dispositions, promotions, lineage, and spend.
7. Rebuild serving projection only if the production serving contract requires it; otherwise rely on live canonical hydration.
8. Browser-QA search, filters, Program File, residents, leadership/faculty, fellowships/outcomes, and no-profile truth.

The Texas contract proves Florida needs no product rewrite. Florida research was not required to block this Texas release and no Florida provider run was launched by 5012I.
