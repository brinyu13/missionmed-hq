# I1Q-1007X Darwin Behavioral Parity Report

## Verdict

`VERIFIED: PASS_LOCAL_PARITY. BLOCK_EXTERNAL RELEASE CLAIMS.`

VERIFIED: Darwin made no application edits, so this pass introduced no behavioral change. Exact integrated commit `6ac62c5a0503981680f161fe5119d5e5e2fa031a` satisfies the executed package and evidence-validator suites.

UNKNOWN: These results do not certify staging, production, privacy clearance, medical correctness, browser behavior, accessibility, or human workflows.

## Candidate Identity

- VERIFIED: Branch is `i1q-question-platform-ultra-1007x-ma`.
- VERIFIED: HEAD is `6ac62c5a0503981680f161fe5119d5e5e2fa031a`.
- VERIFIED: Application, evidence, validator, OpenAPI, and API-test bytes are integrated at that exact checkpoint.
- VERIFIED: `src/platform.mjs` SHA-256 is `b232f577c7c5acc793c723228b20ad6c519807ef24055e7a298c380e953936dd`.
- VERIFIED: `src/server.mjs` SHA-256 is `a956dab618a354b2170e45ff63562a2a8bc8157672e07c4bd5c9ac03b82e9c90`.
- VERIFIED: Migration SHA-256 is `c7e93e8d4c540ddf07951ac9fd909ed1fb49fdd962d31003e934cb186967c127`.

VERIFIED: These hashes identify inspected engineering bytes and do not imply release approval.

## Independent Local Evidence

| Class | Check | Result |
| --- | --- | --- |
| VERIFIED | Full package suite | 206 discovered, 205 pass, 0 fail, 1 gated skip |
| VERIFIED | Evidence validator | 20 of 20 pass, 0 errors, claimed `STATE_A` |
| VERIFIED | Disposable PostgreSQL in package run | Gated skip because no isolated URL was supplied to Darwin |
| VERIFIED | Root-supplied disposable PostgreSQL proof | 12 of 12 pass, not independently rerun by Darwin |
| VERIFIED | 20,000-row workload, POINT_IN_TIME | Repository first-page median 9.627 ms and p95 22.375 ms |
| VERIFIED | 10,000-row workload, POINT_IN_TIME | Median 129.960 ms and p95 134.658 ms |
| VERIFIED | 1,000-item release export, POINT_IN_TIME | Median 28.172 ms and p95 30.292 ms |

## Preserved Behavior Matrix

### STAT and answer isolation

`VERIFIED`

- Server dataset projection remains exactly: `dataset_version`, `question_id`, `prompt`, `choice_a`, `choice_b`, `choice_c`, `choice_d`, `answer`, `explanation`.
- Pre-answer artifacts omit answers, explanations, rationales, and equivalent nested aliases.
- Caller-supplied phase text cannot unlock post-answer data.
- Post-answer debrief requires trusted finalization and participant proof.
- Composite question identity remains dataset version plus question ID.

### Drills projection

`VERIFIED`

- Playback and nodes are required available.
- Transcript and VTT absence is explicit rather than silently accepted.
- Rights, privacy, source hash, working hash, and timestamp linkage are required.
- No Drills consumer activation was performed.

### Authentication and request integrity

`VERIFIED`

- Production mode without a resolver fails closed.
- Expired, revoked, stale, missing, unvalidated, and outage identity contexts fail closed.
- Mutations require session-bound CSRF and trusted Origin when resolver-backed.
- Local demo is rejected in production and under forwarded ambiguity.

`UNKNOWN`

- The canonical MissionMed identity resolver and session adapter are not wired or tested in staging.

### Resource visibility

`VERIFIED`

- Generic resource reads are answer-free.
- Read-only actors cannot browse unapproved revisions.
- Revision and source visibility follows author, assignment, governance, or approved-read scope.
- Restricted source fields and normalized transcript wording are removed from unauthorized projections.

### Authoring and review lifecycle

`VERIFIED`

- Draft edits use an explicit guarded route and optimistic hash matching.
- Candidate submission freezes the draft path.
- Editorial and medical review require exact assignments and explicit acceptance.
- Self-review, delegated conflict, actor swap, review-type swap, and revision-hash swap fail.
- Medical assignment and review require current verified MD or DO credentials.
- Unassigned medical governance blocks exact medical approval and release ratification.

### Release lifecycle

`VERIFIED`

- Release membership binds exact immutable revision IDs, numbers, hashes, dataset versions, and question IDs.
- Official validation checks and artifact evidence are bound to a deterministic hash.
- Assembler, validator, medical ratifier, and publisher separation is enforced in covered paths.
- Both student flags and the exact adapter flag are required before consumer delivery.
- All feature flags remain expected off.

### Datastore contract

`VERIFIED`

- Candidate SQL uses `auth.uid()` and database-owned memberships.
- Forced RLS, deny-by-default grants, answer isolation, restricted source isolation, immutable history, rights expiry, exact validation, and preserving compensation are covered by local tests.
- Root reports one independent disposable PostgreSQL run with all 12 checks passing.

`UNKNOWN`

- Canonical project routing, runtime grants, connection pooling, query plans, backups, promotion, and rollback are not proven.

### UI and accessibility mechanics

`VERIFIED`

- Seventeen workflows remain declared.
- Native controls, landmarks, live regions, focus rules, responsive selectors, reduced motion, and source-lineage regression checks pass locally.
- Selected source context does not fall back across the three-source synthetic regression fixture.

`UNKNOWN`

- No real browser, accessibility tree, keyboard journey, screen reader, zoom, mobile viewport, or human task board ran in this pass.

### Privacy and medical content

`BLOCKED`

- Privacy mechanics pass synthetic local tests.
- All 97 real sources remain blocked.
- Compliant privacy-safe working transcripts: 0.
- Real extracted candidates: 0.
- Credentialed physician-approved real revisions: 0.
- Medical governance lead: unassigned.

BLOCKED: No medical accuracy, medical approval, or content-quality claim is made.

## Current Parity Status

VERIFIED: No Darwin behavioral delta exists because no application code was changed.

VERIFIED: The evidence packet is currently contract-consistent for the executed validator: 20 of 20 files pass with zero errors and claimed `STATE_A`.

VERIFIED: Negative validator coverage remains in the 205 passing package tests, including malformed JSON, duplicate keys, stale checksums, privacy thresholds, answer leakage, source leakage, unsupported state claims, release hashes, and combined-handoff checks.

UNKNOWN: Local passing tests do not establish canonical provider, datastore, browser, staging, production, or human parity.

## Production And Release Blockers

- BLOCKED: No canonical MissionMed auth integration.
- BLOCKED: No canonical unprivileged PostgreSQL runtime wiring or approved grant manifest.
- BLOCKED: No approved preview, staging, or production deployment evidence.
- BLOCKED: No monitoring, backup, production smoke, or rollback rehearsal.
- BLOCKED: No real browser or assistive-technology certification.
- BLOCKED: No completed human validation.
- PROTECTED: No real-corpus extraction or privacy-clearance claim.
- BLOCKED: No assigned medical governance lead or physician-approved real revision.

## State Ruling

- VERIFIED: `STATE_A` is the current evidence-validator claim.
- BLOCKED: State B is not achieved because governed privacy-safe real extraction has not occurred.
- BLOCKED: State C is not achieved because auth, datastore, staging, deployment, browser, security, accessibility, monitoring, and rollback gates are incomplete.
- BLOCKED: State D is prohibited without genuine credentialed physician approval and authorized publication ratification.

## Darwin Conclusion

VERIFIED: Exact checkpoint `6ac62c5a0503981680f161fe5119d5e5e2fa031a` preserves the intended local contracts covered by 205 passing tests and the 20 of 20 evidence validation.

INFERENCE: Point-in-time measurements show no local latency regression signal, while server-side query completeness remains the warranted pre-scale refactor.

BLOCKED: Release, deployment, consumer activation, privacy clearance, and medical approval vetoes remain fully in force.
