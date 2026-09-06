# Avicenna — root cause and regression analysis

Verdict: **prior failure was authority inversion, not corpus absence**.

The predecessor correctly found zero transcript artifacts in its repository scope but then
hard-coded a blocked gate around that scope. Historical counts and literals were validated
without recomputing the runtime universe. The consumer projection was at risk of being treated
as the universe.

Regression rules: never equate repository scan with runtime inventory; never equate consumer
rows with upstream membership; never validate a completeness literal without a recomputable
set receipt; never infer deltas by count subtraction when identity joins are possible.
