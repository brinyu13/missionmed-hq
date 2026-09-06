# I1Q 1006 Pilot Report

## Status

BLOCKED: No real extraction pilot was run.

VERIFIED: Real source inventory is not authorized, privacy ownership is unassigned, rights are unresolved, and medical governance is unassigned.

VERIFIED: No source was represented as Dr. J content without evidence.

VERIFIED: No provisional AI benchmark was fabricated from synthetic data and labeled as corpus performance.

## Technical pre-pilot evidence

- VERIFIED: Synthetic normalization and candidate detection tests pass.
- VERIFIED: Patient-identifier punctuation splitting is covered by the independent mutation suite.
- VERIFIED: Answer-source uncertainty remains unresolved by default.
- VERIFIED: Candidate lineage cannot become medically approved automatically.
- VERIFIED: Browser review workflows are available for a future benchmark.

## Authorized pilot design

After GX-0 authorization, select 8 to 12 sources across:

- at least three specialties
- clean and poor transcript quality
- single and multiple speakers
- recall-heavy and reasoning-heavy teaching
- older and newer recordings
- short and long sessions

Measure question detection precision/recall, Q/A pairing, speaker attribution, timestamp accuracy, privacy precision/recall, answer-source confidence, candidate approval-proxy yield, reviewer workflow time, duplicate rate, and cost per candidate.

## Threshold governance

- VERIFIED: Patient-identifier recall default from Architecture 1002.1 is 0.995 plus human audit.
- OPEN: Question-detection, Q/A pairing, speaker, timestamp, and candidate-yield thresholds require ratification against a real provisional benchmark.
- OPEN: Denominator-zero handling for a real benchmark should remain fail-closed for every required privacy class.

## Gate 7 result

BLOCKED: No technical report can claim extraction quality on real sources.

VERIFIED: `evidence/extraction_metrics.json` records `BLOCKED_NOT_RUN` and null real metrics.

VERIFIED: Student publication remains disabled.
