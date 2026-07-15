# V1 Study Schedule — Runtime and Production Readiness

## Verified runtime facts

Present public observations below were captured
`2026-07-15T00:23:41Z`–`2026-07-15T00:23:42Z`. D9-415 is a separate
point-in-time quiescent production snapshot at T0
`2026-07-14T00:31:00.453619187Z` and T1
`2026-07-14T00:31:03.315562100Z`.

| Check | Result |
|---|---|
| Public hashed Student OS asset | HTTP-readable; SHA-256 `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a` |
| Recovered hashed source | Exact same SHA-256 |
| Public unversioned Student OS asset | Different stale SHA-256 `6b3ad4ea933f61c28da266a7260851b3c0af69b8e09a7df08ff5485718f9948c` |
| Active hashed bundle lock/passport coverage | Missing; the global lock inventories unversioned `assets/student-os.js`, not `assets/student-os.646e3598d284fff3.js`, and the stale Matrix passport omits the active hashed path |
| Controller behavior | Recovered D9-415 source references the hashed asset; current live PHP/controller was not read |
| Anonymous member dashboard | HTTP 302 to WordPress login |
| Anonymous Study REST GET | HTTP 401 |
| Authenticated `#study` | Not verified |
| V1 route bundle/app mode | Not present |
| V1 runtime-lock entries | Not present |
| V1 feature flag | Not present |
| V1 telemetry | Not present |

## Runtime-lock state

The read-only local Matrix guard matched the inputs that its manifest actually
declares except the recovered Student OS controller. Its recovered-source hash is
`23da5c033e8d9ffcf3e9512fb385a8a0a0e88b592cae5e375941d43372cefe29`;
the manifest retains an older approved hash. This local result is not a
present-time read of live PHP. It also does not cover the active hashed bundle:
the global lock protects the repository's unversioned `assets/student-os.js`
twin, while the public unversioned object has drifted to SHA `6b3ad4ea...` and
the public hashed object is SHA `646e3598...`. Brian explicitly approved the
Matrix runtime lock override for `V1-STUDY-SCHEDULE-8000` and
`class_mmed_student_os_php`. That override does not cure the descriptor-coverage
gap. No protected file was edited.

## Readiness gates

| Gate | State | Required proof |
|---|---|---|
| Product identity | PASS | Corrected V1 ledger |
| Source provenance | PASS | D9-415 135/135 snapshot plus present public/source hashed-byte parity; current PHP still unverified |
| Visual foundation | PASS as authority | D9-300 hash/render; production port still pending |
| Behavioral authority | PASS as authority | D9-350 constitution/suite; production port pending |
| Authenticated current route | FAIL | Controlled admin and learner route evidence |
| Legacy mutation safety | FAIL | Owner/type/metadata/auth negative tests |
| Physical V1 store | FAIL | Decision record, migration, repository tests |
| Entitlement/authorization | FAIL | Structured actor, entitlement, rollout, scoped action/resource/field policy and forged-client tests |
| Feature flag | FAIL | Registered default-off server switch |
| Dedicated V1 assets | FAIL | Immutable loader/bundle/CSS and manifest |
| Complete product | FAIL | All intended temporal/execution/mentor surfaces |
| Accessibility/mobile | FAIL | WCAG 2.2 AA and device evidence |
| Performance | FAIL | Budgeted staging measurements |
| Observability | FAIL | Events, dashboards, alerts, privacy review |
| Staging | FAIL | Representative environment, data/migration rehearsal |
| Release/rollback | FAIL | Reproducible exact digest, separate exposure/write/reader modes, atomic cutover watermark, current/N-1 fallback reader, pre/post-cutover rehearsal |
| Production verification | FAIL | Authenticated E2E after gated rollout |

## Current route conclusion

**CURRENT PRODUCTION ROUTE: NONE VERIFIED.**

Source and anonymous redirect behavior make
`https://missionmedinstitute.com/member-dashboard/#study` the legacy candidate,
not an authenticated runtime fact. V1's future route may retain `#study` for
backward navigation compatibility, but it must have one clear renderer and
server-derived access.

## Production mutation attestation

Final and external state:

- net/final application-source diff: 0;
- persisted, staged, committed, pushed, or deployed application-source files: 0;
- production mutations: 0;
- database mutations: 0;
- cache/CDN mutations: 0;
- feature-flag mutations: 0;
- authentication/entitlement mutations: 0;
- deployments: 0.

During the earlier activation-only overrun, the main supervisor created two
untracked provisional PHP drafts and later removed exactly those two files during
resume disposition. That is four disclosed local create/delete filesystem
operations, not zero historical operations. Neither draft entered tracked state,
Git history, runtime, a database, or production. Public checks were anonymous
GET/HEAD-style observations. Prototype rendering was local. MissionMed_OS local
file changes were not modified.

## Release sequence gate

V1-8010 may install additive code and schema only in staging with the flag off
after its authority gates pass. V1-8020 and V1-8030 remain staging quality and
release-candidate work. No learner-visible production V1 behavior, package
deployment, or production cohort is authorized before V1-8040. Administrators
remain audit-only for learner data; mutation tests and pilots use explicit
learner principals. V1-8040 rollout stops immediately on authorization leakage,
foreign-record mutation, persistence divergence, route regression, or a
performance-budget breach.
