# Neurology Taxonomy Follow-up

The completed research-pipeline handoff reports:

- exact plain `Neurology` in Texas/Florida: 0;
- two deliberately untouched Child Neurology holdouts: ACGME `1854831078` (Texas) and `1851113100` (Florida);
- both holdouts entered this canary in `ELIGIBLE` research state;
- the dropped-line systemic finding is separate and was not repaired here.

The live RISE registry projection contains 6,139 program-specialty records, 31 top-level specialty tabs, 57 exact designations, and nine Child Neurology identities in Texas/Florida. This differs from the research-pipeline database count and confirms a cross-store taxonomy/projection integrity follow-up is required. The two holdouts were matched across stores by stable ACGME ID rather than release-specific RISE internal IDs.

Child Neurology remains a `TEST_ONLY` canary exception. The initial six-specialty rollout policy remains unchanged: Internal Medicine, Family Medicine, Pediatrics, Psychiatry, Neurology, and General Surgery.
