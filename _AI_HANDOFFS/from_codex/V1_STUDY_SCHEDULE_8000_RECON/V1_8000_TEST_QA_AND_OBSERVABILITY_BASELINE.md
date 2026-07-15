# V1 Study Schedule — Test, QA, and Observability Baseline

## Evidence reproduced in V1-8000

| Check | Result | Credit |
|---|---|---|
| PHP syntax on relevant plugin classes/bootstrap | Pass | Source syntax only |
| Active Student OS JavaScript syntax | Pass | Source syntax only |
| D9-350 suite | 188 passed, 0 failed | Prototype behavioral credit |
| D9-360 suite | 209 passed, 0 failed | Prototype behavioral/refinement credit |
| D9-300 local render | Rendered canonical Mission/Week/Focus/Reserve language | Visual-authority confirmation |
| D9-360 desktop/tablet/mobile render | Rendered; visible popover and bottom-nav defects found | Manual prototype QA |
| Public hashed asset | Exact public/source SHA; current live PHP and lock coverage unverified/missing | Provenance credit only |
| Anonymous REST | 401 | Anonymous denial only |
| Anonymous dashboard | 302 login redirect | Auth boundary observation only |

D9-350/360 suites required temporary filename normalization because they
hard-code `app350.html`/`app360.html`. Originals were not modified. No executable
D9-100/200/300 suite was recovered.

## Current production test census

The repository has three unrelated test files and no production Study-specific
suite. There is no verified:

- Study domain unit suite;
- repository/migration suite;
- REST schema/authorization/security suite;
- metadata preservation or foreign-event test;
- timezone/DST/property test;
- adapter contract test;
- authenticated end-to-end suite;
- two-tab/concurrency/idempotency test;
- accessibility automation plus assistive-technology pass;
- responsive device/visual regression suite;
- performance/load/query budget;
- rollback rehearsal;
- production synthetic or telemetry dashboard.

## V1-8010 minimum test pyramid

| Layer | Required coverage |
|---|---|
| Characterization | Current legacy route, owner/type mutation, metadata, access cohorts, shell route race |
| Domain unit/property | Collision, capacity, reserve/recovery conservation, partial/remainder, streak, series, timezone |
| Repository | Engine/isolation capability, unique revision/idempotency constraints, atomic operations and first-op/cutover watermark, concurrent migration lock, failure injection, snapshots/compaction, tombstones, rollback, two-user isolation |
| API contract | Auth+REST nonce, entitlement/rollout/action ordering, learner-scoped lookup, resource/field checks, non-enumeration, schemas, stored-content encoding, mass-assignment, rate limits, conflicts, retry, pagination, no PII logs |
| Adapter contract | Calendar and any explicitly approved generic fixed-anchor provider, preview-CAS/import idempotency, replay/reorder/tombstone/echo, Courses/Arena evidence, mentor privacy |
| Client integration | D9-300 interactions, state recovery, offline/failure, keyboard equivalents |
| Browser E2E | Audit-only admin, explicit learner principal, non-entitled, refresh/two-tab, all six views, Focus, closeout, direct route |
| Accessibility | axe plus keyboard, screen reader, zoom, contrast, reduced motion, touch targets |
| Visual/responsive | 320/390/768/1024/desktop, all views/states, empty/error/loading/overflow |
| Performance | cold total plus incremental bytes, bootstrap/query limits, direct LCP versus warm route-ready, p95 API, large cardinalities, long tasks, memory/DOM, unmount leaks, no polling |
| Security/privacy | forged IDs/context, CSRF/nonce, enumeration, mentor scope, telemetry allowlist |
| Release/rollback | exposure/write/reader modes, atomic cutover watermark, current/N-1 reader, pre/post-cutover continuity and legacy-write denial, exact RC/package hashes, migration rehearsal, cross-app smoke |

## Observability contract

Create privacy-safe structural events for:

- route requested/ready/error;
- bootstrap duration and payload version;
- mutation attempted/succeeded/conflicted/failed;
- idempotent replay and stale revision;
- import preview/result;
- recovery/ghost/closeout operation type without learner content;
- API latency/status and query count;
- JS error boundary and loader race;
- flag/cohort decision reason code;
- rollback/kill-switch activation.

Never emit notes, task titles, student names, tokens, cookies, URLs containing
credentials, or raw request bodies. Define SLOs and alerts before pilot:

- authorization denials and foreign-record attempts;
- mutation failure/conflict rate;
- client error rate;
- p95 API and p75 Core Web Vitals;
- write/read divergence;
- route regression outside Study.

## Quality gate

Prototype suites must be ported or replaced against the real domain and browser.
V1-8010 cannot claim implementation complete until the full intended product has
real persistence and integration tests. V1-8020 cannot claim 9+/10 until an
independent board evaluates rendered and interactive evidence.
