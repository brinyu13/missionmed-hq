# D9-415 Final Authority Conflict Register

No authority conflict was silently resolved.

| ID | Final status | Conflict | Resolution / routing |
|---|---|---|---|
| C-001 | RESOLVED FOR SOURCE RECOVERY | Production controller `23da5c...` versus active global lock `c0a538...`. | Founder Decision 002 authorizes exact current byte for source recovery; former byte remains rollback evidence; global lock unchanged. |
| C-002 | DEFERRED TO D9-416 | Observed controller is entitlement-significant, while D9-415 cannot approve entitlement authority. | Preservation is not approval; D9-416 decides intended semantics and access contract. |
| C-003 | RESOLVED AS TIME-SCOPED PROVENANCE | D9-410 hashes versus newer observed runtime. | Both baselines retained with timestamps and direct mappings; current D9-415 snapshot governs source recovery. |
| C-004 | RESOLVED BY BRANCH-LOCAL EVIDENCE | Newer active Matrix manifest is in a protected dirty root. | Read as evidence only; no protected root mutation; branch-local lock records the discrepancy. |
| C-005 | RESOLVED | Exact baseline includes shipped residue while package must be safe. | A/tag preserve all 125 plugin files; policy excludes five documented non-runtime residues from the 120-file package set. |
| C-006 | ROUTED TO OTHER OWNERS | Wider repository contains inherited Arena/STAT backup-pattern MU files. | Matrix package selects only nine intended-active files; other product owners must quarantine their files before general deployment. |
| C-007 | ADVISORY | D9-415 absent from MissionMed OS registry. | Founder packet governs this bounded mission; registry and doctrine remain untouched. |
| C-008 | DEFERRED TO D9-416 | Source authority is recovered but data/auth/deployment authority is open. | `G-D9-5A` PASS; `G-D9-5B` OPEN; overall G-D9-5 PARTIAL; D9-420 BLOCKED. |
