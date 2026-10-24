# Open Blockers and Next Actions

## Primary external blocker

The complete Dr. J transcript corpus is not accessible or proven complete in this workspace. Current discovery found 0 actual transcript, VTT, caption/subtitle, or Nodes artifacts. The prior aggregate observation of 97 cannot be used as a fixed denominator.

## Ordered GX blocker ledger

| Gate | Missing authority or evidence | Resume condition |
|---|---|---|
| GX-0 | Fresh authoritative source universe | Reacquire and enumerate every currently authorized source without assuming 97 |
| GX-1 | Corpus completeness authority | Trusted completeness receipt, acquisition time, opaque IDs, per-source hashes/handles, and change history |
| GX-2 | Authorized source bytes/handles | Actual retrievable transcript and Nodes artifacts inside the restricted boundary |
| GX-3 | Privacy-safe working artifacts | Redacted working corpus and deterministic privacy manifests bound to GX-0 |
| GX-4 | Rights and attribution | Source-complete manifests for authorized internal use and any later quotation/media use |
| GX-5 | Segment-level Dr. J authority | Per-segment speaker mapping; source-level labels are insufficient |
| GX-6 | Recall and occurrence denominator | Human gold for explicit, incomplete, implied, rapid-fire, pivot, differential, next-step, mechanism, management, interpretation, and convertible teaching statements |
| GX-7 | Trusted derivation authorization | New ratified restricted verifier/adapter; the local gate cannot grant trust |
| GX-8 | Extraction-run lineage | Model, prompt/template hash, parameters, code, corpus snapshot, and run IDs |
| GX-9 | Question/answer/teaching spans | Stable timestamp or equivalent locators and all occurrence links |
| GX-10 | Semantic adjudication | Human-reviewed dedupe/merge decisions preserving every source occurrence |
| GX-11 | Medical, psychometric, release governance | Full visible-claim evidence review, credentialed physician approval, controlled pilot, release validation, and final ratification |

## AM-11 conflict

The prior aggregate reports all 97 observed sources as multi-speaker, while the current privacy pilot contract requires nonzero single- and multi-speaker strata. The current dataset cannot satisfy that contract. Resume must either discover a genuine single-speaker stratum in the fresh complete universe or obtain a ratified absent-stratum protocol change. Do not invent a single-speaker source.

## Exact next action

Inside a newly ratified trusted restricted corpus boundary:

1. reacquire the complete authoritative Dr. J source universe without assuming a count of 97;
2. emit signed or equivalently trusted, content-addressed corpus-completeness and segment-authority manifests;
3. create authorized privacy-safe working artifacts plus rights/attribution and human privacy/recall gold manifests;
4. implement the trusted verifier/candidate-binding adapter at `i1q-question-platform/src/source-factory/restricted-corpus.mjs#evaluateTranscriptFactoryGate`; and
5. rebuild with `npm --prefix i1q-question-platform run source-factory:build`, verify with `npm --prefix i1q-question-platform run source-factory:validate`, then begin all-source extraction at GX-0.

The resumable machine manifest is `i1q-question-platform/evidence/source-factory/transcript-resume-manifest.json`. The human-readable specification is `reports/11_TRANSCRIPT_ACCESS_BLOCKER_AND_RESUME.md`.

## Secondary work, only after transcript extraction

- Deduplicate canonical transcript concepts while preserving all occurrences.
- Compare transcript-derived concepts with the 845 legacy rows.
- Report established overlap, transcript-derived concepts absent from legacy, and legacy rows with/without established transcript provenance.
- Use the legacy audit and 24 authority drafts as reference and benchmark material; do not let either define or cap transcript coverage.

## Downstream human gates

After safe extraction, every candidate still needs immutable citation retrieval, claim-level entailment/conflict/currency review, full explanation review, exact-hash editorial and credentialed physician decisions, cognitive interviewing, randomized/variant-separated psychometric piloting, fairness analysis, release validation, and final ratification.

## Stop condition for this run

The useful local benchmark, audit, guardrail, and resume work can be completed and verified, but the primary transcript objective cannot advance without corpus access and a new trusted boundary. Continuing to polish legacy or authority-derived drafts would not satisfy the objective and could create a false impression of corpus completion.
