# Zero-Spend Reconciliation and Promotion Readback

## Result

All currently approved safe evidence was already promoted before this run completed:

- Approved-current source claims: 4,745 distinct.
- Promotion lineage rows: 6,238.
- Approved-current source claims without promotion lineage: 0.
- Canonical current facts: 5,005.
- Canonical evidence claims retained: 19,166.

Therefore this run did not synthesize duplicate promotion events or bypass review. It repaired the projection that consumes approved current facts, re-read the canonical store, and built exact post-reconciliation matrices.

## Zero-spend outcomes

- 670 IM/FM programs are correctly recognized as Deep or Enriched relative to the prior zero-depth failure baseline.
- 511 programs are classified `NO_PAID_WORK` and excluded from Terra: 370 IM + 141 FM.
- Superseded, retracted, insufficient, stale, unknown, and conflicting evidence remains non-promoted or truthfully qualified.
- New paid research spend: `$0.00`.
- Student quota consumption: `0`.

## Important interpretation

`NO_PAID_WORK` means existing registry/canonical evidence is sufficient for this completion queue. It does not mean every possible field is known. Missing-domain columns distinguish real residual gaps and never convert unknown into a negative fact.

