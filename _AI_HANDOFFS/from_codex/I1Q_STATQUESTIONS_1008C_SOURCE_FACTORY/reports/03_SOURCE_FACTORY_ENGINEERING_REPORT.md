# Source Factory Engineering Report

## Delivered reusable implementation

The bounded source-factory namespace under `i1q-question-platform/src/source-factory/` provides:

- `contracts.mjs` — candidate states, four-choice SBA constraints, warning allowlists, evidence/provenance states, and manifest paths.
- `legacy-v4.mjs` — deterministic read-only SQL parsing, hashing, family/duplicate analysis, structural census, and opaque row-manifest generation for secondary legacy material.
- `restricted-corpus.mjs` — qualified aggregate snapshot, explicit current-access/completeness fields, and fail-closed transcript privacy/recall/governance gates.
- `transcript-resume.mjs` — transcript-first authority order, mandatory zero-access metrics, GX blocker ledger, required inputs, content-addressed evidence bindings, and exact resume entry point.
- `workspace-corpus-probe.mjs` — live filename/extension heuristic with path-free content-addressed results and stale-zero invalidation.
- `taxonomy.mjs` — content-addressed draft domain and misconception registries.
- `authoring.mjs` — deterministic construction of authority-derived, Class-D, release-blocked editorial benchmark candidates.
- `quality.mjs` — closed-world validation for candidate/library structure, evidence-lane coherence, warnings, hashes, dates, answer-position sequence checks, learner-projection isolation, and source-reference constraints.
- `dedupe.mjs` — exact/normalized text, token-overlap, and concept-related audit signals without automated medical merges.
- `envelopes.mjs` — closed build/library/run/gate envelope validation and unknown-field rejection.

The commands are:

- `npm --prefix i1q-question-platform run source-factory:build`
- `npm --prefix i1q-question-platform run source-factory:validate`

## Transcript lane is intentionally fail-closed

The source factory does not accept transcript-derived or legacy-derived candidates on unbound assertions. Candidate validation currently supports the authority-derived benchmark lane only. A future transcript record must bind a trusted corpus snapshot, derivation authorization, privacy/rights evidence, segment occurrence, question/answer spans, extraction run, model/prompt/parameters, and human adjudication evidence before the lane can be admitted.

The current local gate is a **terminal trust-boundary sentinel**:

- the retained snapshot sets `source_factory_derivation_allowed = false`;
- current access and corpus completeness are false/not established;
- segment authority and transcript bytes are absent;
- a trusted privacy-authority blocker is unconditionally present; and
- the prior aggregate’s 97/97 multi-speaker result conflicts with the AM-11 contract requiring both single- and multi-speaker strata.

Supplying a locally forged “pass” object cannot open the gate. Resume requires a ratified restricted executor, a new trusted verifier adapter, and a code change. This is deliberate safety behavior, not an extraction implementation success.

## Candidate contract boundary

The validator requires, among other properties:

- an internal curated-candidate status, not a platform Item claim;
- `AI_DRAFT_NOT_MEDICALLY_VALIDATED`, physician review required, and release blocked;
- exactly four distinct A–D choices for a single-best-answer draft;
- immutable content hash and explicit revision number;
- authority-lane proposed-answer provenance and unresolved evidence status;
- source-reference type/linkage coherence and no raw/private source fields;
- structured correct-answer and distractor rationales;
- three explanation containers, while explicitly warning that distractor and Level 3 claims remain unmapped/unverified;
- `editorial_uncalibrated` difficulty and interview competency as an intended content target, not a measured SBA construct;
- AI-only relevance/fairness attestations pending human review; and
- an exact mandatory warning set.

Passing this contract means **schema/editorial guardrails passed for quarantined drafts**. It does not mean medical accuracy, psychometric validity, transcript provenance, residency-selection validity, or release readiness.

## Deterministic artifacts

The build produces the candidate JSON/Markdown library and content-addressed evidence for:

- the secondary legacy audit;
- the authority authoring run;
- the qualified restricted-corpus snapshot;
- the blocked transcript-factory gate;
- the transcript resume manifest;
- the live workspace corpus-access probe;
- candidate validation and dedupe audit;
- the draft taxonomy; and
- the build manifest.

The current build manifest binds 16 generator/source inputs and 11 non-self artifacts. The added live, content-addressed workspace probe inspected 698 in-scope files, found 0 obvious transcript/caption or Nodes/media-registry candidates, stores only empty path-hash arrays, and explicitly cannot prove corpus completeness. Independent source-factory validation passed with the transcript gate `BLOCKED`, transcript resume status `INCOMPLETE_CORPUS_WORK_EXTERNAL_TRUST_BOUNDARY_REQUIRED`, 0 discovered/processed transcript artifacts, 845 secondary legacy rows audited, 24 quarantined authority drafts, and 0 release-eligible candidates. This is a guardrail/artifact-integrity pass, not corpus or medical completion.

The authoring-run artifact explicitly says this was not a transcript extraction run. Its AM-4 provenance is partial: exact runtime model label, prompt-template hash, and parameters were unavailable and remain null rather than fabricated. Input/output/candidate hashes are still bound where known.

The machine-readable resume artifact is `i1q-question-platform/evidence/source-factory/transcript-resume-manifest.json`. It contains no transcript text or identity-bearing metadata.

## Preserved architecture boundaries

No persistence, runtime adapter, release path, or consumer was changed. The platform remains four-choice single-best-answer content with existing variant forms only. New lifecycle values, media-native items, multi-select, sequential cases, and release-level psychometric behavior remain future ratified work.

The implementation also does not enforce monotonic revisioning across time; it records a revision number and immutable hash within a stateless artifact. Persistent atomic revision sequencing remains a separate migration/runtime responsibility.
