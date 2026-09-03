# I1Q-1008A Dependent Consumer Matrix

## Verdict

`DEPENDENCIES MAPPED; NO DEPENDENT PRODUCT CERTIFIED FOR I1Q`

No protected consumer was changed by HERSCHEL. Current route reachability or unchanged files do not count as regression certification. Shared identity, RANKLISTIQ, deployment, and runtime-source changes can affect multiple products, so every before, after, rollback, and reapply baseline must use the exact I1Q commit and reconciled consumer source.

## Consumer Matrix

| Consumer | Owner and authority | Shared dependency with I1Q | Current I1Q coupling | Impact of I1Q integration | Safe integration path | Current verdict |
| --- | --- | --- | --- | --- | --- | --- |
| MissionMed HQ | HQ/Auth owner; Critical Systems Contract and Manifest | Canonical WordPress session exchange, encrypted session, Supabase bootstrap, CORS, CSRF, logout | Required dependency; an untracked I1Q bearer-adapter candidate exists locally but is not an HQ route or deployed integration | Shared auth change can affect every HQ consumer | Narrow versioned I1Q assertion or introspection after expiry, configured-secret, CORS, replay, revocation, and outage repair | `BLOCKED FOR I1Q`; live health 200 but auth defects remain |
| WordPress auth relay | WordPress/HQ owner; MR-078B and DR-006 | Person identity, signed handoff, first-party proxy, cookies, final route | No I1Q route | Handoff or proxy change can affect Arena, STAT, Daily, USCE, and future I1Q | Reuse observed chain; add only an owner-approved audience/final route; do not widen roles | `ACTIVE SHARED DEPENDENCY`; I1Q route missing |
| RANKLISTIQ | Arena/STAT data owner not explicitly named; DR-006, MR-078B, Critical Manifest | Supabase Auth UUID, Arena, STAT, USCE, future `i1q` schema | Authorized target; no I1Q apply | Wrong project, grants, or role context could affect existing consumers | Isolated additive schema, project-pinned preview workflow, unprivileged role, forced RLS, rollback and reapply | `TARGET AUTHORIZED, ROUTE MISSING` |
| Arena | Arena owner; Critical Manifest and MR-078B | HQ auth, RANKLISTIQ, STAT and Daily/Drills routes | No I1Q consumer flag; future indirect consumer | Shared auth or RANKLISTIQ changes can break entry, profiles, avatars, routes, or games | Do not edit Arena; release only through downstream owner-certified adapter | `ACTIVE, SOURCE AUTHORITY UNRESOLVED` |
| STAT | STAT owner; STAT Canon, MR-078B, DR-006 | HQ auth, RANKLISTIQ, dataset projection, question metadata, sealed duels | `stat_adapter_enabled = false` | Dataset or auth changes can affect sealed packs, choice order, answer secrecy, old attempts, and telemetry | Publish a new immutable server-side dataset version with exact nine-field projection; preserve active v4 and server-only answer map | `FLAG OFF, NOT I1Q-CERTIFIED` |
| Drills | Drills/MMVS owner; DR-006 and current Drills contract | WordPress wrapper, MMVS registry, playback, nodes, optional transcript, Daily return | `drills_adapter_enabled = false` | Registry or source-contract changes can break playback and source availability | Read-only sidecar keyed by stable video ID; never alter ingestion | `FLAG OFF, OWNER CERTIFICATION MISSING` |
| Daily Rounds | Daily plus Drills/Arena integration; exact human owner not found | HQ auth, MMVS registry, RANKLISTIQ control, Drills launch | No active I1Q channel | Changes can break active filtering, selected-drill payload, launch, or return | Reuse Drills sidecar only after Daily owner approves its stricter five-field contract | `ACTIVE, NO I1Q CHANNEL` |
| USCE admin | USCE owner; Critical Systems Manifest | HQ auth relay, Railway, RANKLISTIQ `command_center.usce_*` | No I1Q feature coupling, but shared auth and project coupling | HQ auth or RANKLISTIQ role changes can break protected admin reads | Include relay, unauthenticated denial, authenticated read, CORS, RPC, and rollback tests | `PROTECTED DEPENDENCY, NOT TESTED HERE` |
| Matrix | Brian/Matrix owner; Matrix Runtime Lock | WordPress identity and shared Kinsta estate | No I1Q consumer | WordPress or global auth changes can affect dashboard entry and app-mode routes | No adapter in 1008A; run current guard and all locked journeys after shared change | `UNTOUCHED, NOT REGRESSION-TESTED` |
| Growth Engine | HQ/Growth owner; MR-078A and MR-078B | HQ CRM/media and contract-listed drill data | Not the I1Q target | Using its migration directory could damage desynchronized history or wrong data plane | Read-only existing APIs only; never route I1Q SQL here | `NO I1Q WRITES` |
| MMVS drill API | Drills/MMVS owner; DR-006 read-only authority | Current Drills and Daily source registry | Source metadata only; extraction is out of 1008A scope | Mutation or schema assumptions could break Drills and Daily | GET-only contract and no registry mutation | `READ-ONLY DEPENDENCY` |
| R2/CDN | Root plus product owners | Arena, STAT, Drills, Daily runtime delivery; future I1Q static assets if registered | No I1Q app route | Wrong deploy can overwrite runtime-only behavior | Reconcile four live hashes first; register any I1Q asset separately | `PROTECTED, SOURCE DRIFT OPEN` |
| Legacy v4 and attempt joins | STAT owner | Current question IDs, dataset versions, attempts, metadata | Read-only future compatibility | Rewriting or joining on question ID alone can corrupt history | Composite `dataset_version + question_id`; no v4 mutation | `IMMUTABLE, HISTORICAL JOIN PROOF MISSING` |
| TournaMed and future Arena modes | Respective future owners | Future release artifacts only | Contract-only, no active channel | Premature consumer activation could bypass review and release gates | Separate owner approval and manifest entry per channel | `NO ACTIVE I1Q COUPLING` |

## Shared Change Impact Matrix

| Proposed change class | Directly affected systems | Required owner and regression scope |
| --- | --- | --- |
| HQ session or auth route | HQ, WordPress, Arena, STAT, Daily, USCE, future I1Q | HQ/Auth owner; valid, expired, revoked, logout, CORS, CSRF, replay, outage, browser journeys |
| WordPress handoff or proxy | WordPress, HQ, Arena, STAT, Daily, USCE, Matrix entry, future I1Q | WordPress/HQ owner; host allowlists, cookies, redirect, proxy, login, logout, failure behavior |
| RANKLISTIQ project, role, grant, or auth change | Arena, STAT, USCE, Supabase Auth users, future I1Q | Datastore owner; migration history, role matrix, RLS, RPC signatures, auth bootstrap, consumer tests |
| Additive `i1q` migration only | I1Q plus shared project capacity and role namespace | Datastore owner and Root; object collision, grants, forced RLS, query plan, rollback, no shared-schema drift |
| Arena/STAT/Drills/Daily tracked source deploy | Corresponding runtime and linked routes | Product owner plus Root; reconcile current live bytes first |
| I1Q dedicated service only | I1Q, HQ auth adapter, RANKLISTIQ `i1q`, monitoring | I1Q, HQ/Auth, Datastore, Deployment owners; strongest isolation if no shared runtime mutation |
| Feature-flag activation | I1Q and selected consumer | Root plus consumer owner; exact release hash, security, rollback, monitoring, independent review |

## Current Protected Baselines

| System | Latest reliable evidence | What remains missing |
| --- | --- | --- |
| HQ | Live health HTTP 200; live hostile-origin credentialed CORS reflection reproduced | Authenticated session, expiry denial, restart, revocation, logout, safe CORS, source parity |
| WordPress | Existing handoff/proxy source and prior unauthenticated route reachability | Authenticated end-to-end I1Q route, replay, expiry, logout, staging route |
| Arena | Live CDN hash `7bb0ad1c...`; wrapper reachable in read-only probe; 1007X runtime markers passed | Authoritative source, authenticated journey, after/rollback tests |
| STAT | Live CDN hash `77303e63...`; 1007X runtime markers passed | Authoritative source, sealed-pack and answer secrecy regression, old attempt joins |
| Drills | Live CDN hash `c480c014...`; 1007X runtime markers passed | Authoritative source, registry, launch, playback, source availability, return journey |
| Daily | Live CDN hash `409a89d0...`; 1007X runtime markers passed | Authoritative source, five-field contract, launch and return journey |
| Matrix | Current lock manifest updated 2026-07-15 and owned by Brian | Guard preflight and app-mode browser journeys on the exact candidate |
| RANKLISTIQ | Canonical project pin known | Preview target, migration history, real I1Q objects, roles, RLS and rollback |
| USCE | Critical Manifest route and project pins | Shared-auth and datastore after-change smoke |

No protected product is marked `PASS` from these baselines.

## Minimum Dependent Regression Set

### MissionMed OS

- BOOT resolution and current mission routing;
- MissionMed OS clean and current state;
- DR-006 and product registration still indexed.

### WordPress And HQ

- valid login and handoff;
- invalid, expired, malformed, and replayed handoff;
- session expiry and revocation;
- fixed-origin CORS and hostile-origin denial;
- CSRF, fixation, bootstrap replay, and logout;
- HQ health and protected-route failure behavior;
- no token, cookie, secret, answer, or source content in logs.

### Arena

- authenticated entry;
- RANKLISTIQ project pin;
- profile and avatar hydration;
- routes to STAT, Drills, and Daily;
- no service-role or frontend sign-up path;
- browser console and network clean;
- rollback to preserved current runtime.

### STAT

- exact frozen nine-column dataset projection;
- exact seven-field pack authority resolution before consumer activation;
- choice order and content-hash parity;
- no answer or explanation before finalization;
- `answer_map` server-only and participant-gated;
- current v4 and historical attempt joins unchanged;
- composite question metadata behavior;
- Arena entry and rollback.

### Drills And Daily

- registry GET shape and stable IDs;
- playback and nodes requirements;
- explicit transcript and VTT availability;
- Daily's required five fields;
- selected-drill payload and query launch;
- Drills return to Daily and Arena;
- no source registry mutation;
- rollback to preserved current runtime.

### RANKLISTIQ And USCE

- project, schema, table, RPC, and role pins;
- migration history unchanged outside reviewed I1Q objects;
- auth bootstrap still provisions the same UUID identity;
- USCE admin relay and protected reads;
- no broad grant or RLS regression;
- rollback and reapply proof.

### Matrix

- Matrix runtime guard preflight on the exact worktree;
- dashboard, calendar, scheduler, file vault, messages, and StoryForge routes;
- required app-mode classes and Return to Matrix Dashboard;
- no duplicate auth or module mount;
- no stale runtime warning.

## Feature Flag Boundary

The current I1Q deployment manifest records all six flags false:

```text
internal_platform_enabled = false
internal_review_enabled = false
student_content_enabled = false
student_release_enabled = false
stat_adapter_enabled = false
drills_adapter_enabled = false
```

No consumer test may assume a flag is active. No consumer activation is part of HERSCHEL's authority.

## Owner Handoffs

| Owner | Required handoff before State C |
| --- | --- |
| Authority maintainer | Resolve missing `MM-AUTH-ARCH-001` status without inventing it. |
| HQ/Auth owner | Repair shared auth findings and review the in-flight versioned I1Q adapter behavior against shared authority. |
| Datastore owner | Register RANKLISTIQ preview, workflow, roles, backup, and rollback. |
| Deployment owner | Register dedicated I1Q provider, service, hosts, health, monitoring, and rollback. |
| Arena owner | Reconcile live source hash and run authenticated before/after tests. |
| STAT owner | Reconcile live source and contract collisions; certify sealed-pack and history invariants. |
| Drills owner | Reconcile runtime and ingestion ownership; certify sidecar contract. |
| Daily owner | Name the owner, reconcile source, and certify strict launch contract. |
| USCE owner | Run shared auth and RANKLISTIQ regression. |
| Matrix owner | Run lock guard and required app-mode journeys after any shared identity change. |

## Protected No-Touch Boundary

No consumer source, provider, route, datastore, migration, auth system, workflow, runtime object, feature flag, student data, or production configuration was modified or certified by this lane.
