# V1 Study Schedule — Blocker Register

Only V1-specific verified blockers are listed.

Severity law: **P0** means an unconditional release gate whose unresolved state
can corrupt/misauthorize data or makes safe launch impossible. It does not imply
that a cross-user production exploit was observed. **P1** blocks the applicable
implementation/quality/release phase but is not by itself evidence of current
cross-user impact. P2/P3 are nonblocking improvement/record issues.

| ID | Class / severity | Evidence and affected requirement | Direct dependency | Autonomous resolution path | Acceptance test | Ticket |
|---|---|---|---|---|---|---|
| B-01 | SECURITY P0 | Ordinary caller can pass an owned non-Study Calendar ID; admin fallback can reach any admin-editable event. No ordinary cross-user mutation was shown | Shared Calendar engine | Require owner, `event_type=study_block`, role/action checks; preserve metadata | Own foreign-type, foreign-user, and admin cross-user negatives pass; metadata retained | V1-8010B |
| B-02 | ENTITLEMENT P0 | Recovered client locks every non-admin while REST accepts any logged-in caller for owned-resource operations; no ordinary cross-user leak shown | Student OS + REST | Ordered server checks: auth+nonce, entitlement/rollout/action, learner-scoped lookup, resource/field authorization, non-enumerating response | UI/API role-action matrix, CSRF, XSS, mass-assignment, enumeration, rate, and forged-client tests agree; admin learner writes denied | V1-8010A/B/C |
| B-03 | DATA P0 | No authoritative Plan store or proven transactional capability; Calendar is wrong owner | Data-plane decision | Record store and prove transaction/isolation/locking/failure behavior before additive repository/op log | Engine/isolation, unique constraints, concurrent migration, injected failure, atomic first-op/watermark, revision/idempotency/two-user suite | V1-8010A/D |
| B-04 | INTEGRATION P0 | Source-capable Calendar/legacy/Session paths can write and Admin UI recognizes `study_block`; concurrent live execution is unverified | Shared writer inventory | V1 distinct UUID/store; read-only adapters; explicit import; no dual-write | Source/runtime write audit proves only repository writes Plan state | V1-8010A/D/E |
| B-05 | DEPLOYMENT P0 | No registered V1 rollout/mode controls, immutable assets, manifest, or canary | Runtime/release governance | Modes, loader, content hashes, package/rollback manifest | 8010 staging package only; 8020 fixes rerun gates; 8030 freezes/rehearses exact RC digest; 8040 deploys only that digest with canary/kill switch | V1-8010C/I/J, V1-8020/8030/8040 |
| B-06 | CODE P1 | Intended Mission/Week/Focus/Reserve/Recovery/Review/Journey product absent | V1 domain/UI | Incremental vertical slices preserving D9-300/350 | Full feature acceptance and durable reload | V1-8010E–H |
| B-07 | AUTHENTICATION P1 | Actor is WordPress, but optional Plan context-partition policy/mapping is undefined | WordPress/Profile/context sources | Decide whether/how partitioning applies; never trust client context | Two users isolated; selected partition policy and invalid-context cases pass | V1-8010A/D |
| B-08 | PRODUCT DECISION P1 | Physical store, entitlement population, timezone, settings owner not yet recorded | Authority documents | Evidence-backed V1 decision records before dependent code | Records accepted and tests derived | V1-8010A |
| B-09 | TESTING P1 | No production Study suite or authenticated E2E | CI/staging | Build characterization through release pyramid | All focused and cross-app suites green | V1-8010B–J |
| B-10 | ACCESSIBILITY P1 | Prototype and legacy defects; no WCAG production evidence | V1 UI | Semantic/keyboard/touch/SR/reduced-motion implementation and audit | WCAG 2.2 AA + expert task completion | V1-8010E–I, V1-8020 |
| B-11 | MOBILE P1 | D9-360 bottom nav overlays/clips content; production V1 absent | V1 UI | Responsive architecture and real-device matrix | All views/actions reachable 320px+ without obstruction | V1-8010E–I, V1-8020 |
| B-12 | OBSERVABILITY P1 | No V1 event contract, SLO, dashboard, or alert | Telemetry/release | Privacy-safe events and rollout monitors | Synthetic and alert rehearsal; no content/PII | V1-8010I |
| B-13 | PERFORMANCE P1 | No V1 bundle/API/data-size measurements | Build/API/staging | Enforce Darwin budgets and large-data tests | CI/staging budgets pass | V1-8010I, V1-8020/8030 |
| B-14 | ROLLBACK P0 BEFORE FIRST WRITE/IMPORT | One boolean cannot both hide V1 pre-cutover and preserve a truthful V1 reader post-cutover; `d4455bf` cannot read V1 data | Release/data | Separate exposure/write/reader modes, atomic cutover watermark, current/N-1 fallback reader, deny legacy writes | Pre/post-cutover rehearsals preserve truthful V1 read-only continuity, deny both mutation paths, and prove no second writable truth | V1-8010A/D/I/J, V1-8030 |
| B-15 | UX P1 | Independent 9+/10 board not run on production implementation | Complete V1 staging build | Ten-lens evidence-driven iteration | Every lens >=9, median >=9, no P0/P1 | V1-8020 |
| B-16 | STAGING P1 | Representative V1 environment/data migration not evidenced | Release infrastructure | Stage flag-off, seed representative anonymized data, rehearse migration | Staging E2E/security/perf/rollback green | V1-8010I/J, V1-8030 |
| B-17 | SOURCE GOVERNANCE P1 | Recovered base lives on a historical D9 branch; long-term canonical integration/release destination is undecided | Repository authority | 8010A selects long-lived V1 branch, reviewed baseline promotion, or exact package-based release | Future source/release remains reproducible without an orphaned branch | V1-8010A |

## Not blockers

- MissionMed Scheduler or Webex work.
- D9-415 credential incident continuation.
- General auth redesign.
- Broad Student OS, Calendar, or Matrix modernization.
- Missing named-agent Settings toggles.

These are excluded unless a direct V1 contract test proves dependency.

## Founder decisions

No irreconcilable founder decision blocks V1-8000. The remaining product/data
choices can be resolved by evidence and explicit V1 records. Founder approval is
needed only if those records expose mutually exclusive valid founder authority or
an irreversible external action.
