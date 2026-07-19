# Agent Decisions

| Decision | Resolution |
|---|---|
| Question identity | Reuse every accepted 1008F occurrence-specific question ID unchanged. |
| Duplicate policy | Preserve every occurrence; never constrain or group by wording. |
| Missing drill dates | Keep `drill_date` null; relative/file timestamps are not evidence. |
| Missing medical metadata | Use explicit `UNCLASSIFIED`; do not infer an ontology from wording. |
| Question type/confidence/ambiguity | Copy existing Gold fields and validate every row. |
| Source artifacts | Store exact restricted-roster artifact aliases without absolute paths. |
| SQL collision behavior | Wrap DDL and all inserts in one transaction; omit conflict suppression. |
| Average spacing | Preserve exact numerator/denominator and deterministic decimal string, including zero gaps. |
| Release state | Restricted internal only; medical approval and learner release not performed. |
