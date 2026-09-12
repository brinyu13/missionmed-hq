# Find Programs Search and Filters

Live authenticated QA confirmed:

- Baseline: 6,139 programs.
- Internal Medicine: 828.
- Internal Medicine plus any visa evidence: 643.
- Internal Medicine filter drawer counts: J-1 635; H-1B 168; J-1 or H-1B 640; IMG evidence 506; DO evidence 449; Caribbean roster 24; US MD evidence 510; COMLEX Level 2 418; Deep Research 112; Enriched 175; Basic 356; SOAP 2026 94.
- Central query `University of Michigan Internal Medicine` returned a live ranked set and exposed the completed Deep canary.
- Clear filters restores the canonical baseline in automated browser QA.

Supported controls include visa, Step 1 policy, Step 2 minimum, COMLEX Level 2, attempts, YOG, USCE, IMG/DO/Caribbean/USMD composition, exact medical school, medical-school country, resident-school search, SOAP, research depth, state, and specialty. Counts are derived from the same current result predicate and compose by intersection.
