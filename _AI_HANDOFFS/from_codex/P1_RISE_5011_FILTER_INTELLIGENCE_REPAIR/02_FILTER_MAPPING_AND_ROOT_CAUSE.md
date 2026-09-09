# Filter Mapping and Root Cause

## Root cause

`toFableProgram()` projected canonical registry rows into the browser model with `rich: null`, `abim.state = NOT_PUBLISHED`, and a placeholder registry depth. The old Visa and IMG predicates read only `p.rich.visa` and `p.rich.roster`; both were therefore disconnected from the populated canonical `fields` payload. DO and Caribbean shared a non-functional toast-only control. The old Gold/Enriched/Registry choices did not map to the provider-neutral research workflow.

## Repaired path

```text
canonical registry fields
+ approved canonical_current_facts
+ completed provider-neutral research source coverage
-> durable Postgres filter projection
-> authenticated /api/rise/v1/filter-intelligence
-> compact flags + researchDepth per programSpecialtyId
-> browser predicates and dynamic counts
-> rendered result set
```

Static registry facts supply published visa and resident/graduate composition. Approved, non-conflicting `STUDENT_VISIBLE` or `PRIVATE_BETA` current facts can add structured research observations. Research depth uses completed research-source field coverage without exposing review-gated claim content or a provider name. A future canonical promotion becomes filterable after the 30-second server cache expires; no frontend program list or provider-specific release is required.

The frontend and endpoint remain authenticated. Anonymous access to the filter endpoint returns HTTP 401. The ordinary 360 canary received HTTP 403 from the administrator-only Student Intel operator endpoint.

