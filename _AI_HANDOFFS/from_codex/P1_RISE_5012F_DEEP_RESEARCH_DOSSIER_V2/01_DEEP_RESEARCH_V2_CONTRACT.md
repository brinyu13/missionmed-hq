# Deep Research Dossier V2 Contract

Contract ID: `MISSIONMED_DEEP_RESEARCH_DOSSIER_V2`

Contract version: `2.0.0`

Result schema: `missionmed.rise.deep-research-dossier.v2`

The provider-neutral contract is persisted in `rise/config/deep-research-dossier-v2.json` and on every V2 production job: contract version, request class, required domains, requested fields, completion matrix, provider/model, schema version, timestamp, weighted score, and outcome.

A FULL request requires all 18 domains: identity/structure; visa; application requirements; current roster; resident schools; resident composition; leadership; core faculty; trained-here retention; board pass; in-house fellowships; graduate outcomes; salary/benefits; curriculum/training; research/scholarly; program differentiators; culture/resident experience; facilities/patient population.

Terminal states are `VERIFIED`, `PARTIALLY_VERIFIED`, `RESEARCHED_NOT_FOUND`, `EVIDENCE_FOUND_REVIEW_PENDING`, `CONFLICT`, `UNAVAILABLE`, and `NOT_APPLICABLE`. A completed FULL job cannot retain `NOT_RESEARCHED`. Database constraints and the worker enforce the contract.

Deep classification is deterministic: all required domains attempted; no identity ambiguity; all critical domains terminal; source/freshness metadata present; roster, leadership, outcomes, and differentiators meaningfully attempted; and weighted completion at or above the configured threshold. Raw claim count is not a classifier.

The final guard at code commit `aea6ce9` also rejects array-shape errors, disagreeing verified roster/school counts, and accessibility denominators that conflict with the verified roster.
