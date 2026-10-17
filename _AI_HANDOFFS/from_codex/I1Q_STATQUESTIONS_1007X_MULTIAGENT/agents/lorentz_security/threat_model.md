# I1Q-1007X Threat Model

Status: CURRENT BASELINE, SECURITY REPAIRS REQUIRED

Method: STRIDE-informed boundary review plus local exploit probes

Date: 2026-07-15

## Authority Context

MissionMed OS authority blockers in the first audit were snapshot-time findings during root recovery. DR-006 and MissionMed OS PR #12 now authorize the dedicated internal application, RANKLISTIQ `i1q` schema, read-only source work, preview/staging path, rollback ownership, and GitHub-only deployment. The P0/P1 application threats below remain current until repaired and independently retested.

## Protected Assets

1. Answer-bearing Item Revisions and release answer sets.
2. STAT `answer_map`, sealed pack, choice order, attempts, scoring, and historical joins.
3. Raw transcripts, source object references, student speech, patient identifiers, third-party identities, and clinical anecdotes.
4. Canonical MissionMed sessions, actor identity, role mapping, and reviewer credentials.
5. Review assignments, exact-revision approvals, governance slots, and publication ratification.
6. Immutable Item Revisions, releases, promotions, source hashes, manifests, and audit chain.
7. RANKLISTIQ project routing, migrations, RLS policies, database credentials, and deployment workflow.
8. Protected Drills, Daily, Arena, HQ, WordPress, Railway, Matrix, CDN, R2, and source registries.

## Trust Boundaries

| Boundary | Trusted input | Required control |
| --- | --- | --- |
| Browser to I1Q app | Canonical cookie/session and CSRF token | Session validation, CSRF, origin, role authorization, bounded schemas |
| I1Q app to HQ/auth | Verified canonical actor and session state | Expiry, revocation, logout, outage, and role-map handling |
| I1Q app to RANKLISTIQ | Server-derived actor context | Transaction-local context, forced RLS, least privilege, no client base-table grants |
| I1Q review workflow | Assignment and immutable revision | Exact reviewer/actor/type/hash checks, self-review prevention |
| I1Q release workflow | Validator and authority evidence | Independent promotion chain and immutable records |
| Restricted source to working corpus | Authorized read-only bytes | Redaction, rights, source/working hashes, no raw downstream text |
| I1Q to STAT | Immutable release artifacts | Nine-field server row, class A pre-answer, finalization/participant reveal |
| I1Q to Drills | Versioned read-only adapter | Explicit availability, lineage, rights/privacy, no registry mutation |
| GitHub to staging/production | Reviewed fixed commit | Canonical workflow, preview, backup, RLS/security/rollback gates |

## Threat Register

| ID | STRIDE | Severity | Threat | Current evidence | Required repair |
| --- | --- | --- | --- | --- | --- |
| TH-001 | Information disclosure | P0 | General internal reader retrieves answers and explanations through generic revision API | Reproduced with `read_only` actor | SEC-001 |
| TH-002 | Spoofing / disclosure | P0 | Caller supplies `post_answer_finalized` and unlocks debrief without server state or participant proof | Reproduced | SEC-002 |
| TH-003 | Tampering / elevation | P0 | Any write role can forge rights, privacy, evidence, or source eligibility | Reproduced with unassigned physician role | SEC-003 |
| TH-004 | Spoofing / elevation | P0 | Admin registers fabricated physician credentials and impersonates reviewer | Reproduced | SEC-004 |
| TH-005 | Tampering | P0 | Medical event is accepted on an editorial assignment | Reproduced | SEC-004 |
| TH-006 | Elevation / repudiation | P0 | One admin self-assigns governance and publishes without independent evidence or Brian ratification | Reproduced | SEC-005 |
| TH-007 | Spoofing | P1 | Database trusts caller-set actor and comma-separated roles | Static SQL review | SEC-006 |
| TH-008 | Information disclosure / IDOR | P1 | Actor-present RLS exposes most tables without ownership or assignment scope | Static SQL review | SEC-006 |
| TH-009 | Spoofing / CSRF | P1 | Cookie-backed mutations have no CSRF or origin validation in I1Q | Static API review | SEC-007 |
| TH-010 | Spoofing | P1 | Expired or revoked canonical session behavior is not proven; inspected HQ source accepts expired payloads after warnings | Static protected-source review; live parity unverified | SEC-007 |
| TH-011 | Information disclosure | P1 | Raw transcript text survives in normalized in-memory objects and can reach downstream logs or accidental writes | Static pipeline review | SEC-008 |
| TH-012 | Tampering / disclosure | P1 | Privacy aggregate passes with zero recall when class denominators exist | Reproduced | SEC-008 |
| TH-013 | Tampering | P1 | Ordinal projected IDs and bare-question lookup can remap or overwrite identity | Static transformation review | SEC-009 |
| TH-014 | Tampering / repudiation | P1 | Rollback inserts an audit event with null predecessor and does not control the running in-memory app | Static SQL/app review | SEC-010 |
| TH-015 | Tampering / denial | P1 | Candidate migration violates naming/header/repeatability protocol and has no Postgres proof | Static migration review | SEC-011 |
| TH-016 | Tampering / denial | P1 | Application records do not match SQL record requirements and no transactional repository exists | Static cross-contract review | SEC-011 |
| TH-017 | Information disclosure | P1 | Leak scanner omits `answer_map` and `is_correct` and is not closed-world | Reproduced | SEC-012 |
| TH-018 | Spoofing / elevation | P1 | Local demo grants admin based on loopback socket and can misidentify proxied traffic | Static auth review | SEC-013 |
| TH-019 | Tampering / disclosure | P1 | Placeholder Drills artifact omits source availability, rights, privacy, and hashes | Static consumer review | SEC-014 |
| TH-020 | Denial / supply chain | P1 | Dependency, secret, log, error, and deployed-route attack suites are incomplete | Not executed | SEC-015 |

## Abuse Cases

### Answer harvesting

An authenticated low-privilege user enumerates `/api/v1/resources/item_revisions` and collects every answer and explanation. No duel, assignment, purpose, or answer-read audit is required.

### Premature reveal

An authenticated user requests a post-answer channel with the query phase `post_answer_finalized`. The service accepts the label rather than authoritative server state.

### Governance fabrication

A platform administrator creates a reviewer with self-declared physician credentials, assigns governance slots, submits review as that reviewer, turns on release state, and completes all promotions alone.

### RLS role injection

A database caller sets custom actor/role settings before querying. Because policies trust those settings, the caller can claim an administrative role unless the future adapter and database privileges prevent it.

### Source leakage

A pipeline error, debug log, or generic resource response serializes an in-memory segment containing both raw and redacted text. Restricted source content crosses into ordinary application observability.

### Identity collision

Two releases reuse a question ID or an earlier revision is inserted, changing ordinal IDs. Lookup generation silently overwrites or remaps an old attempt to different content.

## Existing Defensive Evidence

- No current live `answer_map` query exists in candidate source.
- Exact nine-field projection and STAT fixed vector pass locally.
- Feature flags default off in candidate SQL.
- No client grants are created by candidate SQL.
- Candidate HTTP responses set restrictive CSP, frame, MIME, referrer, permissions, cache, and body-size controls.
- Local tests reject malformed JSON and traversal attempts.
- No migration, deployment, consumer activation, or source mutation occurred in this audit.

These controls reduce immediate exposure but do not offset any P0 finding.

## Release Criteria

Every P0 must be repaired and regression-tested. Every P1 must either pass an executable preview/staging test or have an explicit, time-bounded accepted-risk decision that does not weaken answer, identity, privacy, migration, or release invariants. DR-006 does not accept these application risks.

## Threat Verdict

SECURITY VETO. The current candidate must not receive a migration, staging route, internal production audience, or consumer activation.
