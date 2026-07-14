# D9-415 Authority Conflict Register

No conflict was silently resolved.

| ID | Severity | Conflict | Strongest evidence | Required resolution |
|---|---|---|---|---|
| C-001 | RESOLVED FOR SOURCE RECOVERY | Production controller `23da5c...` conflicts with active lock `c0a538...`. | Founder Decision 002 plus identical T0/T1 manifests. | Preserve current byte in D9-415A and former lock byte as historical evidence; no global lock mutation. |
| C-002 | DEFERRED | New observed controller is entitlement-significant, but D9-415 may not decide or change entitlement authority. | Decision 002 explicitly separates preservation from approval. | D9-416 resolves authority; D9-420 must not infer deployability. |
| C-003 | P1 | D9-410 hashes versus current shell hashes. | D9-410 baseline versus post-D9-410 manifest/production. | Preserve both time-scoped baselines and label current direct production distinctly. |
| C-004 | P1 | Active Matrix manifest is newer but uncommitted in protected dirty root. | Root Git status and manifest hash. | Treat as evidence input only; do not modify/copy blindly; later branch-local reconciliation after direct snapshot. |
| C-005 | P1 | Exact baseline includes all shipped residues, while safe package should exclude non-runtime material. | Complete 125-file production inventory. | D9-415A preserves exact bytes; packaging exclusions happen only later and are documented. |
| C-006 | P1 | Global MU backup policy versus unrelated inherited top-level backup files. | Origin/main tree and prompt's Matrix scope. | Target recovered Matrix active-set validation; do not mutate unrelated inherited files. |
| C-007 | ADVISORY | D9-415 absent from OS registry. | Fetched `origin/main:missions.json`. | Record degradation; use explicit founder packet; no unauthorized registry change. |
