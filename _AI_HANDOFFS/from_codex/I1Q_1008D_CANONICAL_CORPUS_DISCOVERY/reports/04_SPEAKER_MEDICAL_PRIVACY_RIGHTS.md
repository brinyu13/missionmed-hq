# Speaker, medical, privacy, and rights review

Scope: authority required to attribute and extract Dr. J teaching. Status:
**BLOCKED**. Limitation: no protected transcript text was reviewed.

## Determinations

| Gate | Verdict | Reason |
|---|---|---|
| Candidate-source discovery | Pass | Current live envelope and artifacts are enumerated |
| Source-level Dr. J authority | Unreconciled | Labels nominate sources but do not attest identity |
| Segment-level Dr. J authority | Blocked | No owner mapping or adjudicated diarization receipt |
| Educational/medical intent | Blocked | Contextual intent was not reviewed |
| Privacy-safe extraction input | Blocked | No per-source redaction/privacy receipt |
| Source-specific rights for internal derivation | Blocked | No roster-bound rights manifest |
| Internal quarantined derivation policy | Conditional | Governing decision permits it only after source/privacy gates |
| Medical approval or learner release | Blocked | Medical governance remains unassigned |

## Why metadata is insufficient

Category, subcategory, title, filename, path, collection, or consumer-route membership can
nominate a likely source. None proves who spoke a particular segment. A session can contain
student speech, third-party speech, quoted material, administration, or patient information.

The historical database contains nonempty speaker strings for 40,197 segments and 59
distinct speaker labels. Those strings lack identity-adjudication, confidence, global-label,
and review authority. They may represent diarization labels or session-local aliases. They
must not be converted into real-person attribution.

Even a verified Dr. J segment is not automatically a medical teaching prompt. It may be
administrative, conversational, quoted, hypothetical, or a correction. Educational intent
requires a contextual span and an explicit classification of verbatim, incomplete-spoken,
implied, or reconstructed wording.

## Minimum extraction gates

Before automated extraction begins, the restricted boundary must bind:

1. the owner-attested source roster and snapshot;
2. one authorized primary transcript per source and Nodes/equivalent stable locators;
3. source-specific internal-use/attribution rights;
4. privacy-safe working transcripts with student speech, patient-identifying information,
   and third-party identities removed by default;
5. per-segment speaker authority using owner mapping or adjudicated identity evidence plus
   validated diarization;
6. a contextual extraction rubric and gold denominator;
7. exact source/segment locator, hash, speaker decision, verbatim/reconstructed state,
   reconstruction rationale, and extraction-run lineage for every candidate.

The governing provisional quality gates remain: speaker accuracy at least 0.95,
patient-identifying-information recall at least 0.995, student-name recall at least 0.99,
medical-question precision at least 0.90, recall at least 0.80, question/answer pairing at
least 0.85, and timestamp accuracy within two seconds at least 0.90. Aggregate thresholds
never authorize retention of a known uncertain segment.

## Quarantine rules

- Hold all 105 sources outside extraction until global scope, rights, privacy, and authority pass.
- Mark six sources with neither artifact as `ARTIFACT_UNRESOLVED`.
- Mark two Nodes-only sources as `PRIMARY_TRANSCRIPT_UNRESOLVED`.
- Attribute zero spans from generic, conflicting, or low-confidence speaker labels.
- Never complete missing medical meaning; quarantine unsupported reconstruction.
- Keep any future generated item `AI_DRAFT_NOT_MEDICALLY_VALIDATED` until exact-hash
  physician and evidence review.

No credentialed physician review was needed for this metadata-only discovery. It is required
before medical correctness claims, approval, release eligibility, or learner publication.
