# Agent Report — Medical and Psychometric Red Team

## Assignment

Assume the library is unsafe until proven otherwise. Independently audit medical, psychometric, provenance, privacy, and release claims without editing files.

## Legacy-bank verdict

**BLOCK / QUARANTINE.** Zero of 845 legacy rows meets the complete requested rubric. Universal missing evidence, structured explanations, distractor review, physician approval, and transcript linkage combine with confirmed structural and medical defects.

The red team independently produced the exact census now encoded in tests: 845 rows, 11 exact/12 normalized duplicate groups, 56 truncation signals, 304 fi/fl-ligature rows, 28 malformed comma-period rows, 28 unmatched-parenthesis rows, and 1,527/1,551 cross-item keyed-answer distractor matches.

Representative medically unsafe examples included incorrect treatment/key relationships for Hashimoto disease, achalasia, botulism, biliary colic evaluation, herpes encephalitis, and malaria periodicity.

## Initial source-factory concerns

- Optional hashes and open source schemas.
- Unbacked taxonomy IDs.
- Physician attestation modeled too close to evidence authority.
- Syntactic URLs treated as if they proved claim support.
- Self-declared item-quality booleans without human proof.
- No cross-item keyed-answer reuse check or malformed-input totality.

## Implemented response

The revised implementation requires hashes, closed schemas, registry membership, unresolved-citation status, answer-only claim mappings, calendar-valid currency/review dates, exact cross-item reuse checks, computed keyed-option length checks, three-level explanations, and immutable blocked labels. Physician attestation was removed as an evidence-authority class so it cannot substitute for independent evidence.

## Standing verdict

The source factory is suitable for quarantined draft generation and retrospective audit only. Physician review, current evidence adjudication, and controlled psychometric evaluation remain mandatory before promotion.
