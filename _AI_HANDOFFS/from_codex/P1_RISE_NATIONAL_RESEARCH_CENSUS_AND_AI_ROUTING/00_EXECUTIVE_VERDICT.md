# RISE national research census and AI routing — executive verdict

Generated: 2026-09-14T00:17:44.097Z

## INTERNAL MEDICINE

- Current exact IM count: 695
- Programs with substantive prior research: 435
- Deep: 126 canonical-supported / 0 emitted live
- Enriched: 233 canonical-supported / 0 emitted live
- Basic: 336 canonical-supported / 695 emitted live
- Programs requiring no new research: 370 (reuse/projection first; some still require review)
- Programs requiring only gap-fill: 247
- Programs requiring full deep research: 78
- Is IM 100% researched? **DEPENDS ON DEFINITION — and NO under the substantive program-level standard.** All 695 have registry data, but only 435 have substantive current/provider research evidence.
- Is IM 100% Deep? **NO.**
- Exact explanation: The 695-row Sonnet Phase A file is cross-specialty, not 695 IM programs. It contains 116 current exact IM rows. Current approved canonical facts support 126 Deep IM programs, but the live depth builder emits 0 because it only recognizes `completed_research_factory` sources while current facts are stored under `canonical_review_promotion`. This is a projection regression, not proof that the facts vanished.

## FAMILY MEDICINE

- Current exact FM count: 809
- Programs with substantive prior research: 318
- Deep: 111 canonical-supported / 0 emitted live
- Enriched: 200 canonical-supported / 0 emitted live
- Basic: 497 canonical-supported / 808 emitted live
- Programs requiring no new research: 141 (reuse/projection first; some still require review)
- Programs requiring gap-fill: 425
- Programs requiring full deep research: 243

## NEXT SPECIALTY

- Recommended next specialty: **Family Medicine, after the IM $0 reuse/projection pass.**
- Why: It has the largest exact-designation registry (809), material existing Sonnet/Parallel leverage (318 substantive rows), and high student value for IMG/DO/visa and geographic choice.
- Priority score: **72/100** under the documented evidence-weighted rubric; demand/popularity inputs unavailable in canonical RISE were held neutral rather than invented.

## AI ROUTING

- Best bulk deep-research provider/model: **OpenAI Terra / gpt-5.6-terra primary, Codex validation.**
- Best gap-fill provider/model: **OpenAI Terra / gpt-5.6-terra targeted DELTA.**
- Best adversarial validator: **Codex deterministic cross-source checks plus human review for high-consequence exceptions.**
- Best hard-conflict escalation model: **Claude Opus, only after bounded Terra/Codex evidence collection and with adversarial validation.**
- Best normalization/promotion agent: **Codex deterministic canonical pipeline.**
- Should Parallel be used again? **Only as a scoped comparative or retrieval lane after a fresh controlled benchmark; not as the default now.** Its historical corpus remains valuable and must be reused first.
- Is new paid research necessary before reusing existing evidence? **NO.**

## RECOMMENDED NEXT MOVE

Run a no-spend repair/reconciliation tranche first: correct the research-depth source-type projection, reconcile historical provider rows for current exact IM/FM IDs, and promote only claims that pass the existing evidence contract. Then launch targeted Terra DELTA jobs for the residual high-value gaps, not a blind 1,504-program re-research. Estimated paid follow-on after reuse: **$90–$220** and roughly **2–6 hours of provider wall time at controlled concurrency**, plus **2–4 reviewer-days**; these are planning ranges, not an authorization.

## Critical current-state caveats

- Live file-backed registry: 6139 programs / 31 specialty tabs.
- Current DB canonical identities: 1295; current facts: 5005; current review-ledger rows: 0.
- The DB active registry release is stale (909 programs) while the deployed file-backed index is 6,139. This task did not mutate either path.
- Router/control tables are empty now (settings 0, routes 0, jobs 0, spend rows 0). Historical 5012E fail-safe settings therefore cannot be described as current rows.
- Per-program conflict/insufficient/not-found counts are not reconstructible from the empty current review ledger; the matrices mark them unavailable rather than falsely zero. Provider-level historical dispositions remain preserved in the forensic report.

NO_NEW_PAID_RESEARCH = YES
PRODUCTION_MUTATION = NO
RESEARCH_ROUTER_ACTIVATED = NO
STUDENT_QUOTA_CONSUMED = NO
