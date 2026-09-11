# Filter, Search, and Research-Depth Update

Protected baseline depth was Deep 341, Enriched 596, Basic 5,201, Pending 1. After Holdout A promotion, live authenticated readback was:

| Depth | Live count |
|---|---:|
| Deep Research | 341 |
| Enriched Research | 597 |
| Basic Profile | 5,200 |
| Research Pending | 1 |
| Total | 6,139 |

Holdout A moved Basic -> Enriched without frontend program lists. Its approved `research.visa` value made J-1 evidence visible/filterable. The final bounded projection repair generalized central-search terms from resident-school-only values to all approved canonical research values, excluding URLs and low-information state words. After deployment `507178ef-7f15-4d01-901b-e7d1b76167ec`, live authenticated search-term readback for `adult neurology months` returned only Holdout A (`1854831078`).

This remains provider-neutral: new facts from any provider enter the existing normalized review/promotion/current-fact tables, then the filter-intelligence projection recomputes depth, conservative flags, and bounded search terms. Review-pending or conflicting claims do not become searchable/filterable facts.

The two-plane identity mismatch discovered during canary was fixed at the projection boundary: production's full 6,139 static registry uses release-specific Program File IDs, while the canonical evidence database uses stable program identities. Current-fact reads now join stable identity to ACGME ID, so approved evidence reaches the correct live Program File without rebuilding either registry.
