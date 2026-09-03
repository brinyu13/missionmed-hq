# I1Q-1008A Answer And Source Isolation Results

## Verdict

**LOCAL SYNTHETIC PASS. STAGING NOT RUN. NO STAGING CLEARANCE.**

The evaluated design keeps answer-bearing records and restricted source references behind separate storage, purpose-scoped access, exact assignment checks, and closed-world API projections. Local application and PostgreSQL attacks passed. A concurrent identity-capability migration grants no table access and only one identity RPC, which preserves local structural isolation. There is no approved application runtime grant surface, preview apply, or deployed staging path, so this evidence cannot establish real-environment isolation.

Evaluated source commit: `81273add2c0fe350d330902d229683662896a1b1`

## Protected Material

This assessment treats the following as protected:

1. Correct answer selections and answer-key records.
2. Explanations and rationales when their presence would reveal the answer before finalization.
3. Restricted source references, object locations, private transcript references, and privacy-controlled excerpts.
4. Review payloads that deliberately include protected content for an authorized assigned reviewer.
5. Server-only STAT answer maps and post-finalization channel artifacts.

No raw source material was read during this assessment.

## Expected Isolation Boundaries

| Boundary | Required behavior |
| --- | --- |
| Storage | Answers and restricted source references reside outside generic item and source rows. |
| SQL grants | Generic runtime and managed roles cannot select protected tables directly. |
| RLS | Forced RLS denies direct access even if application authorization fails. |
| Purpose reader | A definer reader requires exact actor, role, accepted assignment, purpose, and immutable revision. |
| API projection | Generic list, detail, search, dashboard, and export responses omit protected fields. |
| Review API | Protected content appears only for the exact accepted review task and uses `no-store`. |
| Finalization | Answer-bearing context is derived on the server and bound to actor, session, release, channel, and feature flag. |
| Consumer artifact | Pre-answer Class A payload omits answers and explanations; answer map remains server-only. |
| Browser and edge | Protected responses are not cached, logged, stored, indexed, or exposed across origins. |
| Evidence | Tests identify exact commit and environment and never promote a local result to staging. |

## Local Results

| ID | Adversarial control | Result | Evidence and limit |
| --- | --- | --- | --- |
| ISO-L01 | Generic API item projection contains no answer fields | `SYNTHETIC PASS` | Local API and contract tests |
| ISO-L02 | Generic API source projection contains no restricted locations | `SYNTHETIC PASS` | Local sanitization tests |
| ISO-L03 | Review content requires accepted assignment for exact actor and role | `SYNTHETIC PASS` | Local protected-read tests |
| ISO-L04 | Review content is bound to exact immutable revision hash | `SYNTHETIC PASS` | Local stale-revision attacks |
| ISO-L05 | Wrong purpose cannot invoke protected reader | `SYNTHETIC PASS` | Local repository and PostgreSQL tests |
| ISO-L06 | Direct select from answer table is denied in modeled role matrix | `SYNTHETIC PASS` | Disposable PostgreSQL only |
| ISO-L07 | Direct select from restricted-reference table is denied in modeled role matrix | `SYNTHETIC PASS` | Disposable PostgreSQL only |
| ISO-L08 | Caller cannot smuggle answer or source fields through nested, encoded, case, or separator variants | `SYNTHETIC PASS` | Local Class D encoding matrix |
| ISO-L09 | Pre-finalization channel cannot receive answer-bearing payload | `SYNTHETIC PASS` | Local adapter and artifact tests |
| ISO-L10 | Finalization context cannot be caller-supplied | `SYNTHETIC PASS` | Local server-context tests |
| ISO-L11 | Audit rows are database-derived and immutable | `SYNTHETIC PASS` | Disposable PostgreSQL only |
| ISO-L12 | Public bundle contains no protected answer-map or source-location labels | `LOCAL STATIC PASS` | Token scan only, not dynamic browser proof |
| ISO-L13 | Evidence file checksums match current manifest | `LOCAL PASS` | Final independent validator passes 20 of 20 expected files with zero errors and claimed state `BLOCKED`; this is not deployed evidence binding |
| ISO-L14 | In-flight identity-capability role receives no answer, source, audit, or workflow table grant | `LOCAL STATIC AND APPLY PASS` | Disposable PostgreSQL only; role model remains unratified |

## Deployed Attack Matrix

Every row below requires an authenticated staging host, preview database, deployed edge, or operational telemetry. None was available.

| ID | Attack | Required result | Staging status |
| --- | --- | --- | --- |
| ISO-S01 | Anonymous API requests answer-bearing item fields | `401` or `403`, no protected fields, no existence oracle | `NOT RUN` |
| ISO-S02 | Authenticated low-privilege user enumerates item IDs | Only authorized generic fields, no answer or restricted source | `NOT RUN` |
| ISO-S03 | Reviewer requests another reviewer's protected assignment | Denied with no content or metadata leak | `NOT RUN` |
| ISO-S04 | Reviewer reuses an assignment against another revision | Denied as revision mismatch | `NOT RUN` |
| ISO-S05 | Reviewer changes role or purpose in request | Server ignores caller authority and denies | `NOT RUN` |
| ISO-S06 | User invokes answer-reader function directly | Database permission denied | `NOT RUN` |
| ISO-S07 | User selects answer or restricted-source table directly | Database permission denied and RLS denies | `NOT RUN` |
| ISO-S08 | Pooled connection changes from authorized reviewer to another actor | No residual actor, purpose, assignment, or row visibility | `NOT RUN` |
| ISO-S09 | Pre-finalization export or STAT pack is generated | No answer, explanation, rationale, or answer map | `NOT RUN` |
| ISO-S10 | Post-finalization request fabricates release or channel | Denied unless server-authorized exact context exists | `NOT RUN` |
| ISO-S11 | Client inspects HTML, JavaScript, source maps, network cache, or browser storage | No protected data outside authorized response memory | `NOT RUN` |
| ISO-S12 | Shared cache or CDN replays reviewer response | No caching; no cross-user response reuse | `NOT RUN` |
| ISO-S13 | Application or proxy error logs a protected payload | Redacted event only | `NOT RUN` |
| ISO-S14 | Access logs capture source location or query content | Sensitive values absent or irreversibly redacted | `NOT RUN` |
| ISO-S15 | Browser sends protected URL in a referrer | No referrer disclosure | `NOT RUN` |
| ISO-S16 | Hostile origin reads reviewer content with credentials | CORS blocks response and CSRF blocks mutation | `NOT RUN` |
| ISO-S17 | User follows a restricted source object location directly | Source system independently denies access | `NOT RUN` |
| ISO-S18 | Search index, monitoring payload, or analytics event receives protected content | Protected fields excluded | `NOT RUN` |
| ISO-S19 | Feature flag is omitted or malformed | Answer-bearing consumer remains disabled | `NOT RUN` |
| ISO-S20 | Deployment commit differs from evidence manifest | Release gate fails | `NOT RUN` |

## STAT Sealed-Pack Invariant

The reviewed local contract preserves the required split:

1. The server-safe pre-answer artifact is Class A and omits answers and explanations.
2. The frozen STAT `dataset_questions` projection remains a separate nine-column server dataset.
3. `answer_map` remains server-only and unavailable before finalization.
4. `question_metadata` identity uses composite `dataset_version` plus `question_id` semantics.
5. A consumer feature flag must be exact, server-owned, and false by default.

These are locally tested contract properties. They are not evidence that any deployed consumer currently enforces them.

## Residual Risks And Open Gates

1. The in-flight identity resolver passes synthetic tests but is uncommitted, unratified, unwired, and not aligned with the concurrent proposed closed bootstrap schema. Protected review authorization is not connected to an authoritative deployed identity.
2. The in-flight database role exposes only an identity RPC to the broad `authenticated` role. No approved application runtime principal or workflow grant surface exists, so direct-table isolation is not proven under real privileges.
3. The non-demo local shell now fails closed unless an explicit static-access adapter grants the request. The canonical edge and cookie composition, deployed static cache behavior, and source-map exposure remain untested.
4. Review content intentionally exposes answers to an authorized assigned reviewer. Cache, log, browser storage, and proxy isolation for that response are untested.
5. The finalization resolver is not wired to a real release datastore or canonical session.
6. No staging log, CDN, proxy, browser, source-object, or monitoring inspection has occurred.
7. No rate control has been demonstrated for high-volume enumeration of item or assignment IDs.
8. Local policy-test grants deliberately differ from production grants. The latest candidate now separates the browser-safe profile capability from a deny-all application role, but no approved application grants or preview catalog evidence exists.

## Isolation Exit Criteria

Security will clear answer and source isolation only after all deployed rows above pass against the exact staging commit and actual runtime role, with redacted evidence. A failure must keep all consumer and student-content flags off. No answer-bearing release may proceed on local evidence alone.
