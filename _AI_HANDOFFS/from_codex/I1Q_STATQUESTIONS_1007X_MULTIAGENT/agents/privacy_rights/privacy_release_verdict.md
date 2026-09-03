# Privacy Release Verdict

## Verdict: BLOCK

**Scope:** All 97 governed sources are blocked from concept extraction, candidate generation, and downstream content use. Read-only inventory and restricted privacy engineering remain authorized under DR-006.

**Confidence:** High (`0.98`) that the present evidence requires a block. This confidence reflects matched evidence digests, complete aggregate source coverage, explicit known defects, and the absence of a governed working-copy run or privacy pilot. It is not confidence that the underlying content is privacy-safe.

## Determinations

- All 97 sources may be classified `verified_drj` at the source level because the authoritative registry category satisfies DR-006.
- Source classification does not identify the speaking person in each segment. Every source is multi-speaker.
- Ninety-six sources have explicit speaker evidence suitable for a restricted exact-match allowlist after the privacy controls pass.
- The generic-only source remains source-verified but segment-unresolved. It must retain zero segments until an authoritative mapping is recorded.
- Brian's authority covers internal inventory and derivation only. It does not publicly clear source excerpts, quotations, or media clips.

## Release Blockers

1. The candidate implementation exposes raw and redacted text together.
2. Non-Dr J speech, student speech, and identifying clinical anecdotes are not all enforced as required fail-closed classes.
3. Aggregate scoring can mask zero recall for a required class.
4. No compliant working-redacted copy exists for any source.
5. No frozen, source-complete, class-complete gold pilot has met patient recall `>= 0.995`, student-name recall `>= 0.99`, every per-class threshold, and the required confidence bounds.
6. No per-source forbidden-field scan, metadata-leak scan, deterministic-rerun proof, or output-schema proof is filed.
7. One source lacks authoritative segment-level Dr J mapping.
8. Public-use Rights Records are not evidenced.

## Conditions for Re-review

Re-review requires a new evidence bundle showing: a construct-from-allowlist output schema with no raw sibling fields; deterministic non-Dr J removal; complete required-class handling; restricted and adjudicated gold labels; all denominators and per-class metrics; a passing patient and student-name gate; byte-identical rerun evidence; 97 per-source validation results; and resolution or continued zero-retention treatment of the generic-only source.

Passing privacy would authorize only the DR-006 internal workflow. Student-facing publication would still require rights clearance, medical governance, review, release validation, and Brian ratification under the passport and DR-006.
