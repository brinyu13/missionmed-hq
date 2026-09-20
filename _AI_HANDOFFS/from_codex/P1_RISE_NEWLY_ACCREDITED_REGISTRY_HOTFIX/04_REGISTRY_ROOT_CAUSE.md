# Registry Root Cause

The production runtime served a source-controlled immutable registry release rather than dynamically querying ACGME. That release was frozen at 6,139 programs and had no current ACGME Report 1/8 reconciliation step.

Trace:

ACGME ADS reports -> no durable current-report importer -> frozen release index -> API/search served only existing identities -> frontend correctly returned no result for omitted programs.

The separate Railway database registry was an older 909-row rights-safe projection and was not the active full RISE registry. Replacing the active release with that table would have caused a major regression. The hotfix therefore repaired the authoritative release-generation path, not the legacy projection.

Additional findings:

- 1,405 existing exact-ID rows differ in name and/or location from parsed current-report text. Some differences are formatting or PDF extraction artifacts, so they were queued for review rather than overwritten.
- 26 RISE IDs do not appear in current Report 1. They were retained and classified NOT_IN_CURRENT_REPORT_REVIEW_REQUIRED; no student/research state was deleted.
- Existing canonical IDs and research payloads were preserved.
