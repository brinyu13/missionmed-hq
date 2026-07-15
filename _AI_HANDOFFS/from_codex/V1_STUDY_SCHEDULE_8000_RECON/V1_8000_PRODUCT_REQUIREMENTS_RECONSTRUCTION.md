# V1 Study Schedule — Product Requirements Reconstruction

Legend: **V** = directly verified in founder or historical authority; **I** =
inferred implementation requirement needed to make an approved behavior safe in
production. Production owner names are target boundaries, not proof of current
implementation.

| Requirement | Source / basis | V/I | Production acceptance criterion | Owner |
|---|---|:---:|---|---|
| Mission | D9-200, D9-350 | V | Select one humane primary mission; show why it matters and now/next/later without hiding the plan | V1 domain/UI |
| Day | D9-350 temporal architecture | V | Accurate day window, actuals, partial/missed states, anchors, reserve, closeout | V1 domain/UI |
| Week | D9-300 canvas, D9-350 | V | Seven-day 06:00–24:00, 15-minute operations, no overlap, capacity honesty, keyboard/touch parity | V1 domain/UI |
| Month | D9-350/360 | V | Summarize load, goals, recovery, milestones; avoid editing ambiguity | V1 read model/UI |
| Journey | D9-350/360 | V | Runway/phases/exams/goals with accessible drill-down and stable temporal navigation | V1 read model/UI |
| Review | D9-200/350 | V | Closeout and periodic review show planned vs actual, recovery, learning, and next adjustments | V1 domain/UI |
| Focus Mode | D9-200/300 | V | One current block, timer/session state, pause/partial/complete/skip, next action, minimal cognitive load | V1 session service/UI |
| Quick Build | D9-100/200 | V | Create a valid initial week from goals, anchors, capacity, and preferences; preview before commit | V1 planner |
| Manual blocks | D9-100/300 | V | Create/edit/delete/reload with stable IDs, ownership, validation, and audit history | V1 repository/API |
| Drag/drop/resize/nudge | D9-300 | V | 15-minute keyboard/touch/pointer changes; reject collisions; preserve duration and timezone | V1 UI/domain |
| Recurrence | D9-100 | V | Create series, edit one/future/all, detach exceptions, idempotent retries | V1 series service |
| Reserve | D9-200/350 | V | Visible provenance; never auto-consume; learner confirms conversion | V1 domain |
| Recovery | D9-200/350 | V | Missed work produces conservation-preserving choices; no silent reflow or rest theft | V1 recovery service |
| Partial/remainder | D9-350 | V | Record actual time, retain remainder with provenance, offer but do not force reschedule | V1 execution domain |
| Skip/reschedule | D9-200/350 | V | Record reason/state, conserve work, reject conflicts, maintain history | V1 execution/recovery |
| Runway/exam facts | D9-100/350 + IC-14 | V | Profile-owned versioned dates drive planning/Journey through effective V1 snapshots without transferring source ownership | Profile source + V1 snapshot |
| Capacity/confidence | D9-100/200 | V | Planned load reflects anchors, recovery, user confidence, and over-capacity warnings | V1 planner |
| Task families/activity types | Founder definition + D9 domain model | V | Blocks use governed study activity families with stable IDs, labels, defaults, analytics-safe categories, and extensible course context | V1 domain + Courses adapter |
| Medical unit targets | D9-100 | V | Units attach to task family/course context and roll up without hard-coded assumptions | V1 domain + Courses adapter |
| Mentor ghosts | D9-200/350 | V | Mentor creates immutable suggestion with reason; learner accepts/rejects/negotiates; no direct edit | Mentor adapter + V1 domain |
| Mentor privacy/withdrawal | D9-100/200/350 | V | Server filters assigned learners and `mentorVis=true` fields; minute actuals require learner opt-in; every ghost has reason, author/assignment provenance, created/withdrawn versions, CAS resolution, and audited withdrawal/accept conflict behavior | Entitlement/privacy + mentor adapter |
| Calendar boundary | D9 ecosystem specs + current source | V | Calendar is busy/fixed-anchor input or marked projection; it never owns canonical Plan state | Calendar adapter |
| Goal fields | D9-100/350 | V | Versioned goals drive planning without erasing history; field-level semantic/physical ownership is decided in V1-8010A | Owner TBD; V1 snapshot allowed |
| Courses | D9-100 integration map | V | Server-validated context and due/target evidence; no silent completion | Courses adapter |
| Arena | D9-100/350 conflict resolution | V | Outcomes attach evidence/propose completion; learner remains completion authority | Arena adapter |
| StoryForge/Vault/Profile | D9-100/200 | V | Explicit read-only context links; no hidden Plan writes; absence degrades safely | Dedicated adapters |
| Messages/notifications | D9-100 | V | Opt-in actionable reminders/mentor notices with privacy, dedupe, timezone, and quiet hours | Notification adapter |
| Timer/floating pill | D9-200/360 | V | One durable session, cross-route state, safe recovery after refresh, no duplicate timers | Session service + shell adapter |
| Phone companion | D9-360 | V | Responsive execution companion with same authoritative session; no separate local truth | V1 responsive UI |
| Settings | D9-350/360 | V | Server round-trip, versioned defaults, scoped sound/motion/quotes/privacy controls after canonical owner is decided | Ownership TBD in V1-8010A |
| Sound/motion/quotes | D9-350/360 | V | Optional, reduced-motion aware, silent by default where required, governed quote source | V1 settings/UI |
| Streaks/motivation | D9-350 | V | Closeout-derived, deterministic, humane, timezone-safe; rest/recovery do not punish | V1 motivation service |
| Onboarding | D9-100/360 | V | Explain ownership, anchors, capacity, reserve, recovery, and first safe plan; resumable | V1 UI |
| Responsive/mobile | D9-300/360 | V | 320px+ without obstruction; all six views and primary actions reachable; touch targets >=44px | V1 UI |
| Keyboard/accessibility | D9-300/350 | V | WCAG 2.2 AA, semantic controls, focus order, SR announcements, drag alternatives, contrast | V1 UI |
| Timezones | Temporal behavior + production necessity | I | Store instants plus IANA zone and local intent; DST tests for gaps/folds and week boundaries | V1 domain/repository |
| Persistence/sync | Approved durable product intent | I | Atomic versioned writes, revisions, idempotency, two-tab conflict handling, offline failure clarity | V1 repository |
| Access/authorization | Founder boundary + current source defect | I | Authenticate+nonce, entitlement/rollout/action decision, learner-scoped lookup, resource/field authorization, and non-enumerating errors | V1 access service + repository |
| Offline/failure | Cognitive-load intent | I | No false success; retry safely; preserve draft/operation IDs; explain stale/conflict state | V1 client/repository |
| Analytics/observability | Production gate | I | Privacy-safe events for route, load, mutation, conflict, recovery, errors, performance; no student content | V1 telemetry |
| Retention/history | D9-100 inherited rule + privacy gate | V | Revalidate 90-day operation-log and permanent ReviewRecord/weekly-aggregate language; define archive, tombstone/audit, deletion/anonymization, backup expiry, restore/export | Data/privacy owners |
| Deployment/rollback | Runtime governance | I | Immutable assets, additive schema, separate exposure/write/reader modes, atomic cutover watermark, current/N-1 fallback reader, canary, and truthful pre/post-cutover continuity | Release owner |

## Behavioral invariants

1. The learner owns completion and accepts every mentor ghost.
2. Reserve is explicit capacity, never an invisible overflow bucket.
3. Recovery conserves work and rest; it does not silently rewrite the plan.
4. Calendar and any later explicitly approved fixed-anchor provider may inform V1
   but do not own Plan state; appointment systems are not an assumed dependency.
5. Fixed external anchors are immutable in V1.
6. No overlap, no silent work loss, no metadata replacement, and no
   last-write-wins across tabs.
7. Focus/closeout actuals are distinct from planned blocks.
8. Product silence and reduced cognitive load are functional requirements.
