# Transcript Access Blocker and Resumable Extraction Manifest

## Access determination

**The complete Dr. J transcript corpus is not accessible or proven complete in the current workspace.**

The current probe found 0 actual transcript, VTT, caption/subtitle, or Nodes artifacts. No transcript artifact was processed. The prior count of 97 is a non-recomputable, point-in-time aggregate observation with no retained row manifest. It must not be used as the corpus denominator, a current-access receipt, or evidence that all Dr. J questions were extracted.

Machine-readable companions:

- `i1q-question-platform/evidence/source-factory/transcript-resume-manifest.json`;
- `i1q-question-platform/evidence/source-factory/workspace-corpus-access-probe.json`.

The latter is a live filename/extension heuristic over the current worktree. It inspected 698 in-scope files, found 0 obvious transcript/caption or Nodes/media-registry candidates, stores no paths, and will invalidate the zero-access build if such candidates appear. It is not a source-universe or corpus-completeness proof and cannot discover opaque external sources.

## Precise blocker inventory

| Required corpus input | Observed in this run | What must exist before extraction |
|---|---|---|
| Canonical corpus path or authorized handle | No authoritative current path/handle was supplied or discovered | Trusted restricted root or immutable opaque handles for every current source |
| Transcript/VTT/caption artifacts | 0 current workspace artifacts | Actual authorized bytes or handles with per-artifact hashes |
| Nodes/media-registry artifacts | 0 current workspace artifacts | Nodes/equivalent artifacts bound one-to-one or explicitly many-to-one to sources |
| Complete source-universe index | None | Signed or equivalently trusted content-addressed enumeration, acquisition time, derived count, and additions/removals |
| Completeness authority | None | Named authority class and verifiable receipt proving what “complete available corpus” means for this run |
| Privacy-safe row manifest | None retained | Opaque source IDs, artifact bindings, statuses, and deterministic hashes without identity-bearing metadata |
| Source-to-transcript/Nodes mapping | None retained | Exact mappings for every enumerated source |
| Segment-level Dr. J speaker authority | None retained | Per-segment authority/adjudication; a source-level Dr. J label is insufficient |
| Stable source locations | Unavailable | Timestamp or equivalent stable locator for every question, answer, and teaching span |
| Working-redacted artifacts | 0 | Source-complete privacy-safe working corpus and redaction proof |
| Privacy gold evaluation | Not passed | Human-adjudicated, source-complete gold metrics across ratified classes and strata |
| Question-recall/occurrence gold | Absent | Denominator covering explicit, incomplete, implied, rapid-fire, pivot, differential, next-step, mechanism, management, interpretation, and convertible teaching-statement channels |
| Rights and attribution | Absent for corpus use | Source-complete internal-use, attribution, quotation, and media statuses as applicable |
| Extraction-run lineage | Absent | Code, corpus snapshot, model, prompt/template hash, parameters, and run IDs |
| Trusted derivation authorization | Unavailable locally | Ratified restricted verifier/adapter; caller-supplied booleans are insufficient |
| Credentialed physician governance | Unassigned/unperformed | Exact-hash reviewer identity/authority and structured decisions after safe drafting |

The names and locations of the missing source root cannot be invented: no authoritative corpus path was provided. The blocker is therefore an absent trusted path/handle and index, not a claimed filesystem permission denial. Access must be established by the corpus authority inside the restricted boundary.

## Historical evidence retained, with limits

The 2026-07-15 aggregate observation reported:

- 97 authorized/source rows;
- 97 transcript and 97 Nodes artifacts at that probe time;
- all 97 sources classified as multi-speaker;
- 0 working-redacted sources;
- 0 extraction-ready sources;
- no retained row manifest; and
- no independent Git recomputation path.

These facts are useful for planning and discrepancy checks only. A fresh inventory may be smaller, equal, or larger. The resume process must explain any difference from 97 rather than force the new universe to equal it.

## AM-11 and terminal-gate blockers

AM-11 currently requires nonzero single- and multi-speaker pilot strata, while the prior aggregate says 97/97 observed sources were multi-speaker. The existing evidence cannot satisfy AM-11. The trusted next run must either find a genuine single-speaker stratum in the complete current universe or obtain a ratified absent-stratum protocol change.

The local gate also always denies restricted-source derivation and always adds a trusted-privacy-authority blocker. It is intentionally impossible to open with a locally constructed pass object. Resume therefore requires a code change and new trusted verifier, not merely copying source files into the workspace.

## Resume cursor

The run is stopped at **GX-0 — fresh authoritative source universe**. No extraction-stage checkpoint has been passed.

Resume in this exact order:

1. **GX-0/GX-1:** in a newly ratified trusted restricted boundary, reacquire the full current source universe and emit its content-addressed completeness receipt. Derive the count; do not assume 97.
2. **GX-2/GX-5:** bind every opaque source to its transcript/Nodes artifacts and per-segment Dr. J authority, including immutable hashes and stable locators.
3. **GX-3/GX-4:** create source-complete privacy-safe working artifacts and bind privacy, rights, and attribution evidence.
4. **GX-6:** establish human privacy and recall/occurrence gold denominators, including the complete channel list above.
5. **GX-7:** implement the ratified trusted verifier/candidate-binding adapter at `i1q-question-platform/src/source-factory/restricted-corpus.mjs#evaluateTranscriptFactoryGate`.
6. **GX-8/GX-9:** run deterministic all-source extraction with exact model/prompt/parameter and question/answer/teaching-span lineage.
7. **GX-10:** deduplicate semantically while preserving all occurrences and quarantining ambiguity.
8. Only after canonical extraction, compare with the 845-row legacy secondary estate and route medical/editorial/psychometric review through GX-11.

After trusted inputs and adapter code exist:

```sh
npm --prefix i1q-question-platform run source-factory:build
npm --prefix i1q-question-platform run source-factory:validate
```

## Mandatory metrics at this checkpoint

| Metric | Result |
|---|---:|
| Transcript artifacts discovered in current workspace | 0 |
| Corpus proven complete | No |
| Transcript artifacts processed | 0 |
| Explicit questions extracted | 0 |
| Implicit/reconstructed questions extracted | 0 |
| Teaching statements converted | 0 |
| Unique transcript concepts after deduplication | 0 |
| Transcript/legacy overlaps | Not measurable; 0 established |
| Transcript-derived questions absent from legacy | Not measurable; 0 established |
| Legacy rows without established transcript provenance | 845/845, without inferring corpus absence |
| Transcript-derived four-choice MCQs | 0 |
| Authority benchmark four-choice drafts | 24, quarantined/noncanonical |
| Legacy secondary four-choice rows | 845, non-release/noncanonical |
| Credentialed medically reviewed | 0 |
| Approved | 0 |
| Transcript-derived quarantined candidates | 0 |
| Authority-derived quarantined candidates | 24 |
| Secondary legacy rows preserved non-release outside candidate lifecycle | 845 |
| Total non-release answer-bearing units retained | 869 |

## Safety stop

No further local polishing of legacy or authority benchmark content can advance GX-0. Do not claim complete extraction, infer missing medical meaning, fabricate timestamps or source links, or connect any learner/production consumer. Preserve current work and resume from the machine manifest when the trusted corpus boundary exists.
