# I1Q-1008A RLS And Database Attack Matrix

## Verdict

**PREVIEW AND STAGING RLS CLEARANCE DENIED.** The base migration has a strong forced-RLS design and passed a disposable local PostgreSQL 16.13 attack suite. The latest runtime migration now separates the browser-safe self-profile capability from a deny-all application runtime role, and its real disposable apply, reapply, compensation, and reapply test passes. No canonical preview database, ratified application grant manifest, actor binder, connection-pool identity wiring, or staging query path was available. All environment-specific rows are `NOT RUN`.

Evaluated migration source commit: `81273add2c0fe350d330902d229683662896a1b1`

Evaluated in-flight identity-capability migration SHA-256: `e78e0e08cc84da54ef87af5c5ef8e958a2f93b813a06472a797f3842583f36a0`

## Important Scope Boundary

The first disposable test database created test-only authentication plumbing and broad test privileges so base policy behavior could be exercised. A second clean disposable database applied the base migration and the in-flight identity-capability migration and inspected its catalog behavior. Those fixtures are useful adversarial evidence, but they do not prove a production runtime role is least privilege or that canonical Supabase identity reaches `auth.uid()` correctly. Both test databases were loopback-only, stopped after their runs, and removed.

## Migration And Role Matrix

| ID | Attack or verification | Expected control | Local synthetic or static result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| DB-01 | Apply base and identity-capability migrations to a clean database | Complete transactions, expected objects only | `SYNTHETIC PASS` | `NOT RUN` | Run through canonical preview pipeline |
| DB-02 | Reapply identity-capability migration | Deterministic safe result | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| DB-03 | Apply identity-capability compensation and reapply | Removes capability, preserves records, then restores only reviewed capability | `SYNTHETIC PASS` | `NOT RUN` | State B requires preview evidence |
| DB-04 | Inspect all application tables for RLS | Every table enables and forces RLS | `OBSERVED` and `SYNTHETIC PASS`: 52 tables | `NOT RUN` | Verify catalog in preview |
| DB-05 | Connect as anonymous role | No schema, table, sequence, or function access | Migration revokes broad access; local fixture passed its modeled checks | `NOT RUN` | Verify actual managed roles and inheritance |
| DB-06 | Connect as broad authenticated role | No direct authoring, answer, source, release, or audit access | Migration revokes broad access; local fixture passed modeled checks | `NOT RUN` | Verify actual managed role grants |
| DB-07 | Inspect proposed I1Q identity-profile capability role | `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS`, no ownership or table access, exact self-profile RPC only | `SYNTHETIC PASS` in static and real disposable tests | `NOT RUN` | Ratify and repeat in preview |
| DB-08 | Inspect proposed I1Q application runtime role | Separate `NOLOGIN`, `NOINHERIT`, `NOBYPASSRLS` role with no browser membership and deny-all until exact grants are approved | `SYNTHETIC PASS` in static and real disposable tests | `NOT RUN` | Approve binder and workflow grants before use |
| DB-09 | Inspect object ownership | Runtime login cannot alter policies, functions, or tables | Candidate ownership model not applied to managed preview | `NOT RUN` | Required catalog evidence |
| DB-10 | Inspect default privileges | Future objects cannot inherit broad grants | Migration source is conservative; managed owner defaults unknown | `NOT RUN` | Required catalog evidence |
| DB-11 | Invoke definer function from an unapproved role | Permission denied | Modeled locally | `NOT RUN` | Verify actual grants |
| DB-12 | Manipulate function resolution through search path | Fixed safe search path prevents object substitution | Definer functions use fixed paths in source; local migration suite passed | `NOT RUN` | Verify owner and catalog definition |
| DB-13 | Broad `authenticated` role inherits I1Q capability | Only the caller-scoped self-profile RPC is reachable; no application runtime privilege is inherited | `SYNTHETIC PASS`: `authenticated` inherits `i1q_identity_profile_reader` only and is not a member of `i1q_app_runtime` | `NOT RUN` | Verify exact managed-role catalog in preview |
| DB-14 | Application server invokes workflow repository functions | Dedicated server principal has exact allowlisted function and read grants | In-flight migration grants identity RPC only; workflow surface remains absent | `NOT RUN` | High State B blocker |
| DB-15 | Preview workflow claims backup and post-apply security closure | Verified provider backup identity and restore path, fail-closed capture, exact authority and candidate binding, operation-history separation, post-operation catalog checks, approved schema comparison, and redacted evidence | `LOCAL STATIC PASS`: target is safely `UNASSIGNED`; workflow separates secret-free validation from step-scoped secrets and binds the closed approval record, operation, commit, four SQL hashes, workflow hash, and full remote-history hash. It requires backup and restore IDs, separate operation stages, role/RLS/grant/flag certification, and successful redaction inventory before upload | `NOT RUN` | Populate authority only after real backup and restore evidence exists, then execute and inspect every stage and schema comparison |
| DB-16 | A preexisting role receives unexpected membership, ownership, or direct privilege | Migration and reapply fail closed before accepting the role contract | `SYNTHETIC PASS`: catalog assertion and real disposable collision test reject unexpected direct privilege | `NOT RUN` | Repeat against managed preview catalog before and after apply |

## Identity Context And Pooling Matrix

| ID | Attack or verification | Expected control | Local synthetic or static result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| CTX-01 | Query without `auth.uid()` | Deny protected reads and writes | `SYNTHETIC PASS` | `NOT RUN` | Repeat using real managed auth context |
| CTX-02 | Supply caller-controlled application role setting | Ignored; role derives from membership table | `SYNTHETIC PASS` | `NOT RUN` | Repeat with runtime role |
| CTX-03 | Supply caller-controlled actor setting | Cannot replace canonical `auth.uid()` | Local test used a test-only actor setting to emulate `auth.uid()` | `NOT RUN` | Canonical provenance remains unproven |
| CTX-04 | Reuse pooled connection after actor A transaction | Actor A context is absent for actor B | Repository has no production pool wiring | `NOT RUN` | High blocker |
| CTX-05 | Set actor context outside a transaction | Rejected or reset before reuse | Not wired | `NOT RUN` | Require transaction-local setup |
| CTX-06 | Transaction errors after actor context is set | Rollback clears context and privileges | Not wired | `NOT RUN` | Required pool test |
| CTX-07 | Actor membership changes mid-session | Next authorized transaction uses current membership | In-flight identity RPC derives current memberships in design; local adapter calls it per request | `NOT RUN` | Verify freshness behavior |
| CTX-08 | Application supplies a different actor than canonical session | Database and server reject mismatch | Repository checks database actor but does not establish canonical context | `NOT RUN` | End-to-end identity blocker |

## Role, Assignment, And IDOR Matrix

| ID | Attack or verification | Expected control | Local result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| RLS-01 | Unknown actor reads any protected row | Empty set or denial | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-02 | Read-only role mutates authoring data | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-03 | Author reads or mutates another author's restricted work | Denied unless explicitly authorized | `SYNTHETIC PASS` for covered policy paths | `NOT RUN` | Expand real role matrix |
| RLS-04 | Editor accesses unassigned protected review | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-05 | Physician reviewer accesses unassigned protected review | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-06 | Release manager skips physician, editorial, rights, or safety gates | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-07 | Privacy owner reads restricted source without accepted purpose assignment | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-08 | Reviewer reads another actor's accepted assignment | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-09 | Reviewer changes requested revision after accepting assignment | Exact revision binding blocks stale decision | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| RLS-10 | Reviewer self-approves a prohibited review stage | Separation rule denies action | `SYNTHETIC PASS` for modeled stages | `NOT RUN` | Verify every authoritative role combination |
| RLS-11 | Caller inserts membership granting self a privileged role | Denied to browser and runtime roles | Policy model passed locally; identity capability has no table write grant; application workflow grants absent | `NOT RUN` | Verify actual managed grants |
| RLS-12 | Caller updates review or release status directly | Denied except through approved transition functions | `SYNTHETIC PASS` | `NOT RUN` | Verify function-only grant surface |
| RLS-13 | Auditor role reads audit evidence | Exact authorized read path, no mutation | Auditor production contract and grants are unresolved | `NOT RUN` | Define before State B |

## Answer And Restricted Source Matrix

| ID | Attack or verification | Expected control | Local result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| ISO-01 | Generic role selects `item_revision_answers` | No direct access | `SYNTHETIC PASS` | `NOT RUN` | Repeat as actual runtime role |
| ISO-02 | Generic role selects restricted source references | No direct access | `SYNTHETIC PASS` | `NOT RUN` | Repeat as actual runtime role |
| ISO-03 | Reviewer calls answer reader without assignment | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| ISO-04 | Reviewer calls answer reader with wrong purpose | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| ISO-05 | Reviewer calls answer reader for stale revision | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| ISO-06 | Privacy reviewer calls restricted-source reader without accepted assignment | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| ISO-07 | Protected reader returns extra columns | Closed-world response contains only approved fields | `SYNTHETIC PASS` in local repository and adapter suites | `NOT RUN` | Inspect real query and API response |
| ISO-08 | Attacker encodes protected field name to evade export checks | Encoded, case, separator, and nested variants rejected | `SYNTHETIC PASS` across Class D matrix | `NOT RUN` | Repeat exact deployed build |
| ISO-09 | Pre-finalization export obtains answer or explanation | Server refuses answer-bearing channel | `SYNTHETIC PASS` | `NOT RUN` | Repeat through staging consumer route |
| ISO-10 | Source object URL is returned in generic API | No restricted location or raw material emitted | `SYNTHETIC PASS` in local API shaping | `NOT RUN` | Verify logs, proxy, and browser too |

## Audit, Evidence, And Immutability Matrix

| ID | Attack or verification | Expected control | Local result | Preview or staging result | Disposition |
| --- | --- | --- | --- | --- | --- |
| AUD-01 | Caller inserts arbitrary actor, time, sequence, or prior hash | Database derives authoritative values | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| AUD-02 | Caller updates or deletes audit event | Denied | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| AUD-03 | Concurrent events fork audit chain | Row-locked head creates one ordered chain | Design observed and local suite passed | `NOT RUN` | Add preview concurrency test |
| AUD-04 | Caller inserts arbitrary audit event directly | Only approved functions can append | `SYNTHETIC PASS` in modeled grants | `NOT RUN` | Verify runtime grants |
| AUD-05 | Caller mutates immutable item revision | Denied; new revision required | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| AUD-06 | Approval remains valid after content changes | Exact revision hash prevents reuse | `SYNTHETIC PASS` | `NOT RUN` | Repeat in preview |
| AUD-07 | Release manifest or evidence record is replaced | Hash and immutable identity reveal mismatch | `LOCAL PASS`: current validator passes 20 of 20 with zero errors and claimed state `BLOCKED` | `NOT RUN` | Bind the future deployed commit and database snapshot to a new environment-specific inventory |
| AUD-08 | Security event cannot be read by authorized auditor | Defined least-privilege audit view is available | No approved runtime grant or staging audit route | `NOT RUN` | Operational blocker |
| AUD-09 | Sensitive answer or source data enters audit payload | Payload schema rejects or redacts protected fields | Local application shaping helps; database payload policy not proven end to end | `NOT RUN` | Add explicit negative fixture and log inspection |

## Local PostgreSQL Runs

An isolated loopback PostgreSQL 16.13 instance executed the current `postgres-migration` suite:

| Metric | Result |
| --- | --- |
| Tests discovered | 13 |
| Passed | 13 |
| Failed | 0 |
| Skipped | 0 |
| Remote systems touched | 0 |
| Preview or staging evidence | None |

The temporary instance was stopped and removed after the run.

A second clean loopback PostgreSQL 16.13 instance ran the in-flight executable runtime test, which reported 1 test, 1 pass, 0 failures, and 0 skips. It applied the base and identity-capability migrations, reapplied the identity migration, compensated twice to prove idempotency, and reapplied through the dedicated forward reapply migration twice. Catalog inspection observed:

| Check | Local result |
| --- | --- |
| Identity-profile role login, inheritance, superuser, role creation, and RLS bypass | all false |
| Application runtime role login, inheritance, superuser, role creation, and RLS bypass | all false |
| `authenticated` membership in identity-profile role after apply | true |
| `authenticated` membership in application runtime role | false |
| `authenticated` execution of caller-scoped identity RPC after apply | true |
| Application runtime table and function grants | none |
| Unexpected direct privilege injected into identity role | migration reapply rejected fail closed |
| Enabled I1Q feature flags | 0 |
| Apply, reapply, compensate, reapply | pass |

These results support migration-candidate quality and close the local role-name conflation. Exact application grants, actor binding, and environment authority remain open. They are not preview or staging evidence.

## Required State B Evidence

1. Approved preview project identity and migration route.
2. Exact migration checksum and deployment commit.
3. Approved browser identity-capability role, separate application runtime principal, group memberships, and closed grant manifests, or an explicit authority ruling that safely replaces that separation.
4. Catalog proof for ownership, `NOBYPASSRLS`, forced RLS, policies, function security, search paths, and default privileges.
5. Full role matrix using actual anonymous, authenticated, runtime, and administrative roles.
6. Transaction-local actor-context tests through the real pool, including error, retry, and actor-switch cases.
7. Answer, source, audit, release, and IDOR attacks through both SQL and the application API.
8. Compensating migration, schema comparison, reapply, and data-preservation evidence through the canonical process.
9. Redacted logs proving denials are observable without leaking protected data.
10. Successful workflow redaction and inventory artifact, real provider backup identity, and executed restoration evidence. The static gate alone is insufficient.

Until all ten items pass in preview, Security vetoes State B and every higher state.
