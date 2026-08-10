# 08 RESEARCH RELEASE ACCEPTANCE

## Release

| Item | Value |
|---|---|
| Release ID | `rise_research_authority_2026-08-10_567ee6099af7` |
| Result | `RESEARCH_AUTHORITY_UNBLOCKED` |
| Status | `ACTIVE_ON_SATISFIED_CUSTODY_AND_VALIDATION_CONDITIONS` |
| Effective date | `2026-08-10` |
| Manifest | `RESEARCH_AUTHORITY_MANIFEST.json` |
| Manifest SHA-256 | `378c0e4421b2789088d4d48c0525bba589eb8a219f1a9a8a608722ab0d8b47e9` |
| Research schema | `rise.research.identity.v1` |
| Source policy | `rise.source.use.policy.v1` |

## Acceptance basis

The current Founder directive explicitly authorizes this run to clear stale/documentary blockers and prospectively accepts a bounded research release when every named condition passes. DR-023 independently records that RISE owns residency-program intelligence. The identity, schema, provenance, and source-rights reviews agree that a fail-closed per-domain decision lane can proceed without activating restricted source content or production.

The manifest records Brian as the named Founder, the acceptance mode as `PROSPECTIVE_CONDITIONAL_FOUNDER_DIRECTIVE`, and `exactBytesPreinspectedByFounder=false`. It does not fabricate a later signature or inspection of the exact bytes.

This package is the bounded implementation of that directive. It becomes the controlling 4102 research handoff only when every artifact is committed, the remote research-authority branch equals local `HEAD`, `SHA256SUMS` passes, and the validator returns `PASS` without `--preflight`. It supersedes the prior STOP_SAFE only for the work named below.

## Authorized

- Existing P1-RISE-4102 thread resumes `W1-IMFM-001`.
- Strict alias-to-canonical-ID joins through the sanitized identity sidecar.
- Creation of fail-closed per-domain source-access decisions.
- Conditional research of exact official domains only after an allowing decision.
- Minimal internal storage of discrete facts and provenance only after that decision.
- Source-separated derived intelligence held at `PUBLICATION_CANDIDATE_REQUIRES_HUMAN_REVIEW`.

## Not authorized

- Inherited FREIDA factual reuse or activation.
- Any Residency Explorer extraction or use.
- Restricted report/data ingestion beyond manual policy reference.
- Student-facing display, raw redistribution, production import, deployment, or live data mutation.
- Canonical ID regeneration, fuzzy identity matching, or competing registry creation.

## Revocation / supersession

This release fails closed if hashes fail, canonical identity conflicts emerge, the Founder revokes it, controlling law/terms change, or a source is found to prohibit the planned access. A later release may supersede it additively; this immutable package must not be edited in place.
