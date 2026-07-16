# Corpus and Provenance Report

## Canonical authority order

The source estates are deliberately separated and ranked:

1. **Complete Dr. J transcript corpus:** canonical extraction source, currently inaccessible and not proven complete.
2. **Transcript-derived questions and teaching concepts:** canonical derived layer, currently empty.
3. **Static legacy v4 export:** 845 read-only rows, retained only for secondary comparison, overlap analysis, and preservation of useful prior work.
4. **Other sources:** allowed only when separately authorized. The 24 public-authority drafts are an internal authoring benchmark, not substitutes for transcript-derived content.

A separate STAT runtime mirror of 3,961 historical records is reported by prior evidence and does not intersect the static v4 IDs. It is not the canonical transcript corpus.

## Current corpus-access finding

The current workspace probe found:

- 0 local VTT files;
- 0 local transcript/caption/subtitle data files;
- 0 local Nodes or media-registry artifacts containing the corpus;
- 0 retained privacy-safe row-level corpus records;
- 0 independently recomputable current transcript artifacts;
- 0 extraction-ready sources; and
- 0 transcript artifacts processed.

No canonical corpus root, retrievable source handle, current corpus index, authoritative completeness receipt, source-to-transcript/Nodes map, per-artifact hash manifest, or segment-level Dr. J authority map is present in the workspace.

## What the historical “97” does and does not establish

The inventory evidence records a prior 2026-07-15 aggregate probe in which 97 source rows, 97 transcript artifacts, and 97 Nodes artifacts were witnessed. It also records 97 multi-speaker sources, 0 working-redacted sources, 0 extraction-ready sources, and a generic-only speaker-classification concern in the underlying prior review.

That evidence is explicitly `POINT_IN_TIME_AGGREGATE`. It retains no row manifest and is not independently recomputable from Git. The aggregate hashes bind the prior report, not the current transcript bytes or a complete source-universe manifest. Therefore:

- 97 must not be assumed to be the current or complete corpus denominator;
- “transcripts available = 97” is historical observation, not current access;
- “verified sources = 97” is not proof of segment-level Dr. J speaking authority;
- the prior source count is not a question-recall denominator; and
- no claim that all Dr. J questions were extracted can be made.

## Canonical transcript provenance required on resume

Every retained transcript-derived concept must ultimately bind:

- an opaque source ID and content hash;
- an authoritative corpus-universe receipt and snapshot ID;
- an authorized transcript/Nodes artifact hash;
- Dr. J segment-authority status;
- timestamp or equivalent stable source location;
- exact occurrence preservation across all sessions;
- explicit/verbatim, incomplete-spoken, or reconstructed/implicit status;
- reconstruction rationale with no invented medical meaning;
- extraction run, model/prompt/version, and parameters;
- answer-span linkage when present;
- semantic merge decision and every contributing provenance link;
- privacy, rights, attribution, evidence, medical-review, psychometric, and lifecycle states.

None of those transcript-derived provenance chains exists in the current run.

## Legacy v4 secondary census

The deterministic parser and independent audit agree on 845 historical rows: 517 base and 328 vignette. The retained audit records duplicate/family membership and systematic structural issues without modifying the migration or presenting legacy content as canonical extraction.

All 845 rows currently lack established transcript provenance. That is a provenance result only: it does not prove that their concepts are absent from an inaccessible corpus, and it does not by itself adjudicate medical accuracy.

## Deduplication status

The implementation can distinguish exact/normalized text signals, high-token-overlap signals, concept relatedness, and human semantic adjudication. It never performs an automatic medical canonical merge.

Canonical cross-session deduplication, transcript/legacy overlap, transcript-absent-from-legacy, and legacy-unsupported-by-transcript calculations are all unperformed because there are 0 transcript-derived candidates. The current numeric result is 0 established in each comparison category, with status **not measurable**, not “no overlap.”

## Resume prerequisites

1. Reacquire a fresh authoritative corpus universe in the restricted zone; derive its count instead of assuming 97.
2. Emit an authoritative completeness receipt and content-addressed opaque source/artifact manifest.
3. Retain source-to-transcript/Nodes mappings and segment-level Dr. J authority.
4. Resolve the AM-11 stratum conflict: the prior aggregate says all 97 were multi-speaker, while the current local pilot contract requires both single- and multi-speaker strata.
5. Produce privacy-safe working-redacted artifacts and pass a source-complete human privacy gold evaluation.
6. Establish a question-recall gold denominator covering explicit, punctuation-free, incomplete, rhetorical, rapid-fire, logistical-negative, teaching-pivot, and answer-span cases.
7. Add a trusted restricted verifier/derivation adapter. The current local gate always denies trusted authority and cannot be opened with a caller-supplied pass record.
8. Only then extract, preserve occurrences, classify verbatim versus reconstructed content, deduplicate semantically, and compare with the secondary legacy estate.
