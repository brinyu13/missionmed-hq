# I1Q-1007X Privacy Normalization

## Verdict

`BLOCKED_BEFORE_WORKING_COPY`

Read-only inventory is complete, but no real transcript has been promoted into a working-redacted extraction copy. No raw transcript text, source title, URL, original speaker label, or identity-bearing diagnostic is stored in Git or this handoff.

## Governed Corpus

| Measure | Result |
| --- | ---: |
| Authorized sources | 97 |
| Source-level `verified_drj` | 97 |
| Multi-speaker sources | 97 |
| Sources with explicit speaker evidence | 96 |
| Sources with generic-only speaker evidence | 1 |
| Compliant working-redacted copies | 0 |
| Extraction-ready sources | 0 |

Source-level classification does not prove segment-level speaker attribution. The generic-only source must retain zero segments until an authoritative source-owner attestation or equivalent restricted mapping is recorded.

## Required Boundary

The accepted privacy design has four zones:

1. Raw source-system truth, read only and restricted.
2. Restricted processing copies, mappings, gold labels, and diagnostics.
3. Working-redacted copies containing only positively mapped Dr. J segments, opaque references, timestamps, redacted text, reason codes, and pipeline provenance.
4. Evidence-only aggregates and hashes suitable for Git.

A working copy must be constructed from an allowlist. It may not be produced by cloning a raw object and editing selected fields. Original text, original speaker labels, source metadata, reversible source IDs, and raw/redacted sibling fields are forbidden.

## Required Removal Classes

- non-Dr. J speech, including student, unknown, mixed, overlapping, and ambiguously attributed segments
- student names and other student identifiers
- patient direct identifiers
- patient quasi-identifiers
- third-party identities
- complete identifying clinical anecdote windows when span removal is insufficient
- source titles, URLs, paths, filenames, original IDs, and original speaker labels

Uncertainty resolves to complete removal or source quarantine.

## Local Contract Repair

The 1007X repair replaces the unsafe 1006 normalization shape with an allowlist constructor. It emits newly constructed working segments, uses only opaque source linkage and approved Dr. J fields, models all eight required privacy classes, suppresses ambiguous and identifying anecdote windows, keeps public excerpt and media permissions off, and rejects raw-text aliases and original source metadata keys.

The local suite proves deterministic output, exact source mapping, complete class coverage, zero-denominator failure, per-class minimums, exact lower-bound gates, and zero-tolerance failures using non-clinical fixtures. These tests close the local contract defect. They do not create a real working transcript or substitute for a restricted, source-complete human-adjudicated gold evaluation.

## Unblock Evidence

Normalization can promote a source only after all of the following exist:

- exact source and pipeline digests
- authoritative source-specific Dr. J speaker mapping
- class-complete deterministic redaction
- no raw sibling fields or source metadata in output
- serialized-output forbidden-field and metadata scans
- byte-identical rerun evidence
- a passing per-source validation result
- a passing source-complete global privacy pilot

## Release State

The local privacy contract passes engineering tests. Real promotion remains blocked because no restricted gold set or passing source-complete evaluation exists. Real extraction, candidate generation, public excerpts, media clips, and student publication remain disabled.
