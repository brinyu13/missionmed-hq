# Terra Budget Authorization Packet

## Exact queue

| Wave | Specialty | DELTA_LIGHT | DELTA_MEDIUM | FULL | Total jobs | Expected | Upper |
|---|---|---:|---:|---:|---:|---:|---:|
| A/B | Internal Medicine | 11 | 236 | 78 | 325 | $84.24 | $99.20 |
| C/D | Family Medicine | 0 | 425 | 243 | 668 | $184.15 | $210.82 |
| Combined |  | 11 | 661 | 321 | 993 | $268.39 | $310.02 |

Exact DELTA total: `672`. Exact FULL total: `321`.

## Proposed authorization

- Founder authorization cap: `$315.00` combined.
- Operational spend stop-loss: `$310.02` actual accumulated provider cost.
- Recommended concurrency: `6`.
- Expected wall clock: `18-24 hours` including deterministic Codex review/promotion cadence.
- Conservative upper wall clock: `30 hours`.
- Batch size: `25` jobs, with a promotion/readback checkpoint after each batch.
- Live cadence: validate/promote safe current facts after each completed batch; refresh filter projection; verify count and sample Program Files; continue only if error and spend rates remain inside bounds.

## Observed-cost basis

Only MissionMed production benchmark/canary evidence is used:

- DELTA_LIGHT: observed `$0.0946-$0.1502`, expected `$0.1281`.
- DELTA_MEDIUM: observed DELTA anchor `$0.2382`, conservative upper reservation `$0.3000`.
- FULL: observed `$0.3394-$0.3429`, expected `$0.3412`.

## Wave ordering

1. Wave A: highest applicant-value IM residuals.
2. Wave B: remaining IM.
3. Wave C: highest applicant-value FM residuals.
4. Wave D: remaining FM.

Within each wave the CSV is priority-sorted by applicant-critical gaps, research depth, IMG/DO/visa relevance, and unresolved evidence value.

## Validation and escalation

- Terra performs only the exact DELTA/FULL job defined per row.
- Codex performs deterministic identity, evidence, conflict, and promotion validation.
- Opus is used only when a newly returned applicant-critical fact has a hard source conflict that Codex cannot resolve deterministically.
- Expected Opus escalations: approximately `13` based on the observed 1.30% hard-conflict rate.
- Hard ceiling: `20`; crossing it pauses the wave for diagnosis.
- Existing conflict markers are not automatically sent to Opus.
- Opus spend is not included in this Terra authorization and remains unauthorized.

## Stop-loss conditions

Pause immediately if any of the following occurs:

- actual provider cost reaches `$310.02`;
- more than 20 new hard-conflict escalations are required;
- canonical identity mismatch, sibling-program contamination, or source-to-program ambiguity;
- error/refund rate exceeds 5% in a 25-job batch;
- promotion creates a registry, auth, filter, or Program File regression;
- router scope or kill-switch state drifts from the authorized wave.

No job in this packet has been launched.

