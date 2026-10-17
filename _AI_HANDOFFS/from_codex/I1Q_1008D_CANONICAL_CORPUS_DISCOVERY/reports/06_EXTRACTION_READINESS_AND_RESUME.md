# Extraction readiness and exact resume sequence

Scope: decision gates for moving from discovery to transcript-derived question extraction.
Status: **BLOCKED**. Evidence cutoff: 2026-07-17T05:51:03-04:00.

Abbreviations: Cloudflare R2 object storage (R2) and MissionMed Headquarters/Content
Intelligence Engine (HQ/CIE).

## Gate matrix

| Gate | Current state | Required pass evidence |
|---|---|---|
| Runtime inventory | Pass for timestamped observation | Double-read stable lists; artifacts are not snapshot-pinned |
| Candidate/consumer/local reconciliation | Pass | Exact keyed set buckets |
| Canonical scope and denominator | Blocked | Named owner attestation |
| Upstream R2/database/HQ reconciliation | Blocked | Read-only snapshot receipts |
| One primary transcript per corpus member | Blocked | 97/105 observed; owner must resolve 8 gaps |
| Stable segment locators | Partial | 99 Nodes artifacts; two are locator-only |
| Segment-level Dr. J authority | Blocked | Adjudicated speaker manifest |
| Privacy clearance | Blocked | Per-source redaction/privacy receipt |
| Rights and attribution | Blocked | Roster-bound internal-use manifest |
| Medical governance for approval/release | Blocked | Named accountable authority |

No extraction may start while any blocked gate remains.

## Exact autonomous continuation

1. Obtain the named corpus owner's signed scope receipt: inclusion/exclusion predicate,
   denominator, snapshot time, exclusions, and update policy.
2. Resolve the exact Supabase/media-index owner and grant a snapshot-scoped read-only role.
3. Obtain mediated R2 listing authority and an authenticated, non-mutating HQ/CIE inventory.
4. Inside the restricted boundary, create stable keyed aliases and row-wise reconcile the
   owner roster against live runtime, R2, database/index, HQ/CIE, local, and historical sets.
5. Resolve the six candidates with neither artifact and the two Nodes-only candidates.
   Record owner-approved exclusion or bind the missing primary transcript; never infer.
6. Bind every retained source to exactly one authorized primary transcript hash and to Nodes
   or an equivalent stable segment-locator authority.
7. Attach source-specific rights/attribution, privacy/redaction, and retention decisions.
8. Establish per-segment Dr. J identity and contextual educational-intent adjudication.
9. Rerun the committed zero-retention probe against the current runtime envelope, then
   identity-join its safe receipt to the frozen owner roster inside the restricted boundary.
   The current tool does not accept a frozen roster as its candidate input. Require zero
   unresolved primary artifacts among retained roster members and archive the paired manifests.
10. Only then process every transcript, preserving exact provenance and verbatim versus
    reconstructed status; quarantine ambiguity; never invent missing meaning.
11. Semantically deduplicate across sessions while preserving every occurrence link.
12. Compare transcript-derived concepts with the 845-row bank carried forward from the bound
    [I1Q-1008C legacy audit](../../I1Q_STATQUESTIONS_1008C_SOURCE_FACTORY/reports/02_LEGACY_V4_AUDIT_REPORT.md)
    only after extraction.
13. Route medical, psychometric, learning-science, and release review through the governed
    lifecycle. Do not connect a learner-facing consumer in this run.

## Required restricted extraction record

Each future occurrence must bind: stable source alias, artifact hash, segment locator,
speaker decision and confidence, privacy decision, rights decision, exact/reconstructed state,
reconstruction rationale, extraction-run identity, model/prompt/parameters, and human review.
The safe export may expose only approved opaque lineage and aggregate status.

## Automatic stop conditions

Stop extraction immediately on roster drift, artifact hash drift, missing primary artifacts,
speaker conflict, privacy/rights failure, stale Matrix/runtime warning, authority conflict, or
any request that could mutate/backfill a shared service. Discovery can resume read-only after
the owner refreshes the affected receipt.

Recommended MegaRun successor: **I1Q-1008E — Owner-Attested Corpus Freeze and Restricted
Speaker/Privacy Adjudication**. Its first action is authority acquisition, not question generation.
