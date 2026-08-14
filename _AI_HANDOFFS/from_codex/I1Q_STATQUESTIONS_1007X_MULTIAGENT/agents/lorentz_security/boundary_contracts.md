# I1Q-1007X Lorentz and Security Boundary Contracts

Status: BASELINE AUDIT, APPLICATION REPAIRS REQUIRED

Date: 2026-07-15

Scope: I1Q-1006 and I1Q-1007X-MA, read-only analysis of commit `0d6f78f2a2036731ec592398ce5fd845beb54333`

## Authority Context

The MissionMed OS authority blockers reported by the initial audit were snapshot-time findings during root recovery. `DR-006` and MissionMed OS PR #12 now address mission registration, product ownership, datastore routing, source-read authority, composite metadata identity, explicit Drills availability, staging, rollback ownership, and the canonical GitHub route.

Those authority repairs do not repair the candidate application. The P0 and P1 application findings in this baseline remain current until code is changed and independently retested.

Authoritative records:

- `/Users/brianb/MissionMed_OS/decisions/DR-006_i1q_question_platform_internal_integration.md`
- `/Users/brianb/MissionMed_OS/PRODUCT_PASSPORTS/question-platform.md`
- `/Users/brianb/MissionMed_OS/missions.json`, mission `I1Q-1006`
- MissionMed OS PR #12: `https://github.com/brinyu13/missionmed-os/pull/12`

## Non-Negotiable Contracts

### Identity and authentication

1. WordPress and the canonical MissionMed session chain remain the identity authority.
2. I1Q may consume a verified canonical actor; it may not create a parallel identity system.
3. Role claims must be mapped server-side to I1Q roles and must not be accepted from request headers, request bodies, query strings, or caller-set database settings.
4. Cookie-authenticated mutations require the canonical CSRF control and origin policy.
5. Expired, revoked, logged-out, fixed, or unverified sessions fail closed.
6. Local synthetic-demo identity must be impossible in a deployed process, including behind a loopback reverse proxy.

### Datastore and RLS

1. The datastore is an additive `i1q` schema in the RANKLISTIQ Supabase project selected by DR-006.
2. Migrations are forward-only, timestamped, previewed first, and applied only through the canonical GitHub process.
3. RLS is forced and deny-by-default. There are no broad anonymous or authenticated authoring grants.
4. Database actor and role context must be derived from the canonical authenticated actor and set transaction-locally through a trusted adapter.
5. Review data is scoped to the exact assignment and immutable revision. Administrative access is explicit and audited.
6. Base answer-bearing tables are never directly readable by student clients or general internal read roles.

### STAT

1. The server dataset projection contains exactly, and in this order: `dataset_version`, `question_id`, `prompt`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, `explanation`.
2. The nine-field dataset row is a server-side storage/export contract. It is not the STAT duel-pack envelope.
3. The frozen duel-pack envelope remains exactly seven fields under `STAT_CANON_SPEC.md`.
4. Class A pre-answer artifacts contain no answer, explanation, `answer_map`, `is_correct`, correct-choice alias, answer-correlated ordering, or class D metadata.
5. `answer_map` remains server-only until the duel is finalized and the authenticated caller is a participant.
6. Choice order, server-authoritative scoring, sealed identifiers, historical attempts, and dataset semantics remain unchanged.

### Identity and historical joins

1. Internal identity is the immutable tuple `(item_id, itemrev_id, revision_number, content_hash)`.
2. Projected identity is at least `(dataset_version, question_id)` and is linked to the exact internal tuple.
3. Historical legacy identity is `(dataset_version, question_id, content_hash)`.
4. Projected IDs are opaque, unique within a dataset version, stable for that release, and persisted in a mapping record. Array position is not identity.
5. `question_metadata` compatibility uses composite `dataset_version` plus `question_id` semantics without silently changing protected legacy ownership.

### Drills and Daily Rounds

1. I1Q emits versioned read-only adapter artifacts. It does not mutate Drills ingestion or source registries.
2. `video_id`, title, playback availability, nodes availability, transcript availability, and VTT availability are explicit.
3. Missing, restricted, invalid, and unknown source artifacts are represented explicitly and never treated as silently available.
4. Current Drills requires a playable source and nodes; transcript absence is non-blocking only when explicitly represented.
5. Current Daily/Arena registry consumers require the complete five-field URL contract, including a non-empty transcript URL. Daily Rounds remains a separate adapter/consumer decision.
6. Timestamp remediation is released only with source lineage, rights clearance, privacy clearance, and an eligible approved Item Revision.

### Review and release

1. Every review is tied to an accepted assignment of the same review type, exact reviewer, and exact immutable revision.
2. The authenticated actor must equal the reviewer actor. Administrative impersonation is prohibited.
3. Rights, privacy, evidence, reviewer credentials, governance slots, release states, and audit events use dedicated authoritative workflows, not generic mass-assignment endpoints.
4. Release manager assembly, validation evidence, medical-governance attestation, and Brian publication ratification are separate recorded authorities.
5. Medical governance remains unassigned. Medical approval, approved release eligibility, student publication, and consumer activation remain unavailable.
6. Student, STAT consumer, and Drills consumer flags remain OFF.

### Privacy and source isolation

1. Raw transcripts and media remain restricted. Downstream extraction reads only privacy-safe working artifacts.
2. Student speech, student names, patient-identifying information, third-party identities, and identifying clinical anecdotes are covered by the privacy policy.
3. Required recall thresholds are enforced numerically, not inferred from the presence of a denominator.
4. Raw text, private object references, answer material, and restricted source wording are excluded from ordinary responses, logs, errors, caches, and generated class A/C artifacts.
5. Every internal answer-key read and restricted-source read is purpose-bound and appended to the immutable audit trail.

## Candidate Conformance Snapshot

| Boundary | Status | Evidence |
| --- | --- | --- |
| Exact nine-field STAT row | PASS | `i1q-question-platform/src/exports.mjs:14-30`; local test passes |
| Frozen STAT hash vector | PASS | `i1q-question-platform/src/hash.mjs`; local test passes |
| No live `answer_map` query | PASS, NARROW | Candidate code contains no live query; scanner coverage is incomplete |
| Generic answer read isolation | FAIL, P0 | `platform.mjs:114-185`; reproduced with `read_only` actor |
| Post-answer authorization | FAIL, P0 | `platform.mjs:360-377`; caller controls phase label |
| Review and publication authority | FAIL, P0 | `platform.mjs:146-173,240-281,333-357`; reproduced |
| Trusted RLS identity | FAIL, P1 | Migration trusts caller-set `app.actor_id` and `app.actor_roles` |
| Assignment-scoped RLS | FAIL, P1 | Broad actor-present SELECT policy on nearly every table |
| Canonical auth and CSRF | FAIL, P1 | Resolver interface only; mutations have no CSRF gate |
| Privacy threshold enforcement | FAIL, P1 | Zero recall can report aggregate `pass`; reproduced |
| Migration protocol | FAIL, P1 | Candidate filename/header/idempotency do not satisfy MR-078A |
| Rollback and reapply proof | FAIL, P1 | Static flag SQL only; no staging execution or application coupling |
| Composite projected identity | PARTIAL, P1 | Metadata carries version, but lookup and fallback IDs are unsafe |
| Drills source contract | FAIL, P1 | Candidate artifact omits required source and availability fields |
| Canonical authority and route | RESOLVED BY ROOT | DR-006 and PR #12; application gates still apply |

## Baseline Verdict

The boundary design is authorized, but the candidate implementation is not release-safe. Security vetoes migration application, staging deployment, internal production exposure, and consumer activation until every P0 is repaired and all P1 controls have executable preview evidence.
