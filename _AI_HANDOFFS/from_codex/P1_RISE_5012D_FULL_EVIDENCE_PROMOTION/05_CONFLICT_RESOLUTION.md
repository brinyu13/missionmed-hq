# Conflict Resolution

The live review queue contains 181 `CONFLICT_REQUIRES_REVIEW` and 1,181 `INSUFFICIENT_EVIDENCE` claims. They are retained for admin review and are not promoted as student-visible facts.

Automated resolution is limited to deterministic equivalence, supported aggregation, explicit supersession, and a clearly stronger current source. Ambiguous policy language, competing current scalar values, or unsafe person/roster details remain pending. The admin review API exposes the immutable source claim, source URLs, quality score, current disposition, and override lineage without exposing contributor identity to students.

A later human review must append a new event referencing the overridden event; it must not mutate or delete history. The live student UI may show “evidence found · verification pending” when unresolved evidence exists, but unresolved evidence does not inflate research depth or filter matches.
