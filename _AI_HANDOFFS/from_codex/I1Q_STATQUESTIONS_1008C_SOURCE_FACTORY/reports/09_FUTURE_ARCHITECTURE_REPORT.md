# Future Architecture Report

## Current safe compatibility

The retained authority benchmark uses four-choice single-best-answer records, existing variant forms, immutable content hashes, explicit revision numbers, stable candidate/concept/variant identifiers, separated evidence and explanation structures, and an explicit non-platform status.

This is candidate-layer compatibility only. The library is not persisted Item/Item Revision data, does not implement the canonical transcript lane, and does not enforce monotonic revisioning across time. Persistent atomic sequencing and approval history require a forward migration/runtime design.

The authoring-run artifact binds known code/input/output/candidate hashes but honestly records missing runtime model label, prompt-template hash, and generation parameters. It is not an extraction-run record.

## First future architecture priority: trusted transcript boundary

Before new item types or adaptive delivery work, implement the canonical corpus flow:

1. a fresh authoritative source-universe acquisition service in a ratified restricted environment;
2. a content-addressed corpus completeness receipt and addition/removal history;
3. opaque source-to-transcript/Nodes and segment-authority manifests;
4. privacy-safe working artifacts, rights/attribution bindings, and human gold evaluations;
5. extraction-run model/prompt/parameter lineage plus question, answer, and teaching-span occurrences;
6. verbatim/reconstructed status and ambiguity quarantine;
7. semantic deduplication that preserves every occurrence and human resolution; and
8. a trusted verifier adapter that can replace—but not bypass—the local terminal sentinel.

The future transcript candidate contract must reject proof-free assertions and bind the exact trusted run evidence. The machine-readable entry point is `i1q-question-platform/evidence/source-factory/transcript-resume-manifest.json`.

## Safe future seams

After canonical access and medical governance exist, the candidate structure can support internal review, immutable revisions, specialty/topic/concept search, misconception analysis, variant exclusion, rights-cleared SBA media, and explanation-depth selection.

Generated reviewer artifacts are not learner payloads. A learner projection must remove answer keys, rationales, answer-bearing IDs, concept metadata, and internal provenance; server-only answer-map constraints remain in force.

## Separate ratified migration/runtime work

The following remain separate forward tickets:

1. candidate-to-Item-to-Revision persistence and atomic revision numbering;
2. database-level taxonomy/concept coherence and version bindings;
3. one-Variant-Group-member-per-release enforcement;
4. release-level answer sequence, clueing, semantic-quality, and evidence-expiry gates;
5. physician-only evidence verification bound to exact candidate hashes;
6. independent release-validator outputs and consumer adapter grants;
7. multi-select/sequential-case storage, scoring, and answer isolation, if ever ratified;
8. media rights, accessibility, secure projections, and device behavior; and
9. controlled psychometric collection and thresholds after medical/editorial approval.

No new lifecycle state, item type, delivery algorithm, or consumer integration is implied by the present source-factory artifacts.
