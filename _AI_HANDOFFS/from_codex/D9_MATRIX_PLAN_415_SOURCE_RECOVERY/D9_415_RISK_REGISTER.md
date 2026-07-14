# D9-415 Risk Register

| ID | Severity | Risk | Evidence | Control / disposition |
|---|---|---|---|---|
| R-001 | P1 | Production controller differs from active Matrix lock. | Production `23da5c...`; lock `c0a538...`; production mtime postdates lock. | Source-recovery exception resolved by Decision 002; preserve both; do not modify global lock; D9-416 adjudicates behavior. |
| R-002 | P1 | New controller alters entitlement evaluation while D9-415 cannot decide auth/entitlement authority. | Y1-CAM-4005 candidate exactly matches production. | Exact byte preserved without approval or behavior edit; D9-416 remains mandatory. |
| R-003 | RESOLVED | Production may not be quiescent during snapshot. | Identical 287-entry T0/T1 manifests. | Formal cutoff established; no mixed-time bytes. |
| R-004 | RESOLVED | Source may contain embedded credentials/private payloads. | Redacted scan of 135 selected files plus full-envelope path scan. | No secret/private data; Webex library/schema false positives documented; tracked-tree rescan identical. |
| R-005 | P1 | Partial protected-only import omits runtime dependencies. | Full plugin plus ten-file MU closure derived from includes, hooks, symbols, and asset-path behavior. | Exact hash manifest; Wave 2 must independently review closure. |
| R-006 | P1 | Executable MU backup remains active in production. | WordPress top-level `.php` loader; hash `725790...`. | Preserve in D9-415A; source-only quarantine in D9-415B after clearance; no production change. |
| R-007 | P1 | Local refs/tags/exports create false provenance. | No complete remote-tracked baseline; historical candidates stale/partial. | Direct production snapshot and path/blob mapping only. |
| R-008 | P1 | CI could mistakenly treat guard override as success. | Guard accepts warnings/failures with `--brian-approved`. | Never use override or production modes in CI. |
| R-009 | P1 | Repository-wide backup scan expands scope into unrelated inherited MU files. | Existing origin/main backup-named MU files. | Scope validation to recovered Matrix MU set and document inherited exceptions. |
| R-010 | P1 | Scheduler runtime changes outside Git/package. | Mutable unpinned CDN HTML. | D9-416 must pin source/hash/deploy/cache/rollback authority. |
| R-011 | P1 | Large Webex adapter lacks deterministic upstream source provenance. | Shipped third-party bundle present in the exact production tree. | Preserve exact baseline; classify as dependency/vendor; record as package/source-provenance debt. |
| R-012 | P2 | Mission record absent from MissionMed OS. | Fetched current registry has no D9-415 entry. | Founder prompt governs scoped task; no registry mutation invented. |
