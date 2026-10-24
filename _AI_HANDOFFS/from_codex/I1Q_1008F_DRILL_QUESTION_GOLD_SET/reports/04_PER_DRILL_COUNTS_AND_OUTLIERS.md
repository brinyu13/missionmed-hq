# Per-Drill Counts and Outliers

The final safe ledger reports one position-only row for every validated drill. It includes primary, follow-up, total, ambiguity, provenance-class, and rejection-class counts; duration; and an exact rational questions-per-minute value. It publishes no source alias, drill identity, student alias, question identity, wording, locator, hash, URL, path, or review narrative.

Count expectations are review signals, never targets. The owner’s approximate 300–350 questions-per-drill observation is treated as a strong sanity check. Every drill over 350 receives explicit review; every drill over 400 requires an explained disposition. Low and high anomaly detection also uses cohort distribution, questions per minute, primary/follow-up ratio, ambiguity/fragment ratio, sequence-to-primary equality, runtime delta, and source/hash validity.

A drill is not failed merely for having a low count. Failure is reserved for an absent/invalid shard or parser, schema, hash, provenance, pairing, contract, or boundary failure. Low-count flags include zero questions despite valid transcript content, robust distribution outliers, sequence/call mismatch, or a material unexplained deficit against represented runtime prompts. High-count flags include robust upper outliers, abnormal clauses-per-question, and an implausible follow-up ratio.

Each flagged row receives a restricted reason code, observed value, cohort threshold, source/hash checks, sequence/question/ambiguity counts, runtime delta, and disposition. Counts are never forced to agree with expectations or the lossy runtime detector.

The final distribution is: minimum 52, p25 158, median 179, p75 196, maximum 222, and mean 16,690/97 (172.062). The primary/follow-up split is 3,054/13,636. No position exceeds 350 or 400.

Four low-count positions required explicit review: orders 14 (71), 43 (62), 52 (52), and 63 (52). All four have valid source/hash bindings, completed shards, exact order, and accepted semantic review. Positions 52 and 63 each preserve one ambiguity-marked sequence rather than inventing additional student calls. The positions are distinct validated source pairs. Their counts remain as observed; they were not inflated to match an expectation.
