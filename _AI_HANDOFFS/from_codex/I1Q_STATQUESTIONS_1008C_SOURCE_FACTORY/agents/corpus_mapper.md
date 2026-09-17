# Agent Report — Corpus Mapper

## Assignment

Independently map the repository, Dr. J inventory, legacy banks, provenance, and missing phase outputs without editing files.

## Findings

- The starting branch contained strong privacy/workflow/release scaffolding but no material 1008B/1008C source-factory output.
- A prior non-recomputable aggregate observation reported 97 sources, 97 transcript and Nodes artifacts, and 81,604 aligned records, but retained no row manifest and reported zero working-redacted or extraction-ready sources. Those historical counts are planning evidence, not current access or completeness proof.
- No privacy-safe row manifest, real question occurrence set, answer-span linkage, semantic merge map, candidate bank, taxonomy assignment, or Level 1–3 explanation bank existed.
- The 845-row static v4 export and separate 3,961-record runtime mirror must remain distinct.
- Existing service, SQL, and pipeline contracts have known provenance and future-type drift that should not be hidden.

## Independent verdict

The real transcript phases were not complete and remained externally privacy blocked. A safe bounded scope was to build deterministic audit/provenance machinery, preserve source denominators, quarantine candidates, and avoid migration/runtime changes.

## Influence on implementation

This report caused the work to:

- preserve the 97-source aggregate as non-recomputable point-in-time evidence;
- block transcript candidate generation;
- fully audit all 845 static rows with question-level opaque lineage;
- explicitly separate authority-derived candidates from Dr. J-derived content;
- retain semantic adjudication as human work.
