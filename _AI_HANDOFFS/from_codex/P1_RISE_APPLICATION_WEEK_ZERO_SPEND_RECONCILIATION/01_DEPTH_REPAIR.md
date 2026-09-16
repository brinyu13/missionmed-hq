# Research-Depth Projection Repair

## Root cause

The durable filter-intelligence projection selected research coverage only from claims whose source had the literal `source_type = 'completed_research_factory'`. Canonical review promotion creates approved current facts whose source/provider taxonomy can legitimately differ, so approved research could be omitted from depth calculation even though it was present and promoted.

## Repair

Commit `65f9edc44f5ecfa20af96e976146aeb9afad27bb` makes depth source-neutral:

1. Approved depth coverage is derived from `canonical_current_facts` where the field is `research.%` and publication state is `STUDENT_VISIBLE` or `PRIVATE_BETA`.
2. Canonical program identity is resolved through either source metadata ACGME ID or `canonical_program_identities`.
3. Pending coverage is derived from unresolved/review-required claims across all providers and excludes claims already present as current facts.
4. Per-program pending/domain reads use the same provider-neutral identity rule.
5. No provider/source string is used as a depth eligibility gate.

## Deterministic outcomes

| Specialty | Total | Deep | Enriched | Basic | Pending |
|---|---:|---:|---:|---:|---:|
| Internal Medicine | 695 | 126 | 233 | 336 | 0 |
| Family Medicine | 809 | 111 | 200 | 497 | 1 |

Relative to the stale census failure mode that emitted zero Deep/Enriched, 670 programs are correctly recognized: 359 IM and 311 FM. The immediately preceding 5012K live build had already restored those visible counts through intervening reconciliation work, so this deployment produced no artificial count jump; it removed the latent source-label dependency and keeps future provider-neutral promotions filterable.

## Verification

- Full Node suite: 230/230 PASS.
- Regression assertion explicitly rejects `source_type` and provider predicates in depth coverage.
- Live authenticated filter: Internal Medicine + Deep Research = 126.
- Live global filter inventory: Deep 375, Enriched 598, Basic 5,165, Pending 1.

