# I1Q-1007X Authority Decision

## Verdict

`CANONICALLY FILED AND EFFECTIVE`

Authority commit:

`b3d8089 docs(i1q): ratify protected internal integration`

Canonical candidate decision:

`/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`

The same commit updates `authority_index.json`, the Question Platform passport, `missions.json`, generated `CURRENT.md`, and the append-only MissionMed activity log.

## Ratified Boundary

`DR-006` records Brian's explicit authorization for:

- Dedicated authenticated internal Question Platform
- Canonical MissionMed HQ and WordPress-to-Railway-to-Supabase auth/session reuse
- No parallel identity, frontend sign-up, or global auth weakening
- New additive `i1q` schema in the RANKLISTIQ Supabase project
- Forward-only migrations through preview/staging and canonical GitHub delivery
- Forced RLS, deny-by-default roles, transaction-local actor and role context, immutable audit, assignment scope, and answer/source isolation
- Read-only inventory of authorized MissionMed-owned Dr. J, Drills, Daily Rounds, Stream, R2/CDN metadata, transcript, VTT, nodes, static registry, and MissionMed Drive sources
- Privacy-safe internal derivation with raw sources restricted
- Default removal of student speech, patient-identifying information, and third-party identities
- `likely_drj` versus `verified_drj` classification with authoritative evidence required for verification
- Read-only hashed legacy v4 export and non-student aggregate exposure metadata
- Composite `dataset_version` plus `question_id` compatibility identity
- Exact frozen STAT nine-field server projection
- Class A pre-answer artifacts without answers or explanations
- Server-only `answer_map` unavailable before finalization
- Explicit transcript, VTT, and nodes availability in Drills adapters
- Staging and authenticated internal production only after all gates pass

## Governance

Brian is interim privacy owner, editorial lead, taxonomy owner, misconception-vocabulary owner, release manager, incident owner, assessment-science owner, and rollback operator.

Medical governance lead remains `UNASSIGNED`. No credential is inferred from a title or name, and Dr. J is not automatically assigned. This blocks medical approval, approved release eligibility, and student-facing publication. It does not block engineering, inventory, privacy-safe extraction, quarantined candidate generation, or authenticated internal review.

## Pilot Thresholds

| Measure | Threshold |
| --- | --- |
| Medical-question detection precision | at least 0.90 |
| Medical-question detection recall | at least 0.80 |
| Question-answer pairing | at least 0.85 |
| Speaker attribution accuracy | at least 0.95 |
| Timestamp accuracy within two seconds | at least 0.90 |
| Privacy recall for patient-identifying information | at least 0.995 |
| Privacy recall for student names | at least 0.99 |

AI benchmarking may authorize only quarantined candidate generation. It cannot authorize student publication.

## Closed Actions

- Manual production SQL
- `railway up`
- Force push or history rewrite
- Ad hoc upload or direct runtime replacement
- Broad anonymous or authenticated datastore grants
- Mutation of source registries or media objects
- Mutation of the legacy v4 dataset
- Exposure of answers or explanations before finalization
- Student, STAT-consumer, or Drills-consumer enablement before the exact release gates pass

## Student Release Gate

Every student-facing revision requires an exact immutable Item Revision, completed editorial review, genuine credentialed physician review, current Evidence Claim, no conflict, no active safety flag, rights and privacy clearance, release validation, and Brian publication ratification.

This run must not claim State D without those real records.

## Canonical Filing

The authority branch passed independent verification and merged through MissionMed OS PR #12 at exact head `b3d8089dbc436bad6ec48de95e1d57b6985b7444`. The I1Q merge commit is `93c0404794fe105235b80514c75fffc3177f140b`. At the final read-only recheck, canonical `main` was clean and synchronized with `origin/main` at later separately owned RISE commit `0e47d39d79edd9891896eb41e65183e855573cc1`; `CURRENT.md` still listed I1Q-1006 active and DR-006 remained tracked. The protected integration decision is effective for the bounded internal implementation described here.
