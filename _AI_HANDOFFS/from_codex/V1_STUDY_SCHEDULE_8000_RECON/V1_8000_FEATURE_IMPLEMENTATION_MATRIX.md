# V1 Study Schedule — Feature Implementation Matrix

Status vocabulary follows the canonical prompt. Every production-source row is
at `d4455bf4ee401eaa8b074603497eb9fcd6eb04a0`.

## Evidence key

| Key | Exact evidence |
|---|---|
| S-SHELL | `wp-content/plugins/missionmed-hub/assets/student-os.646e3598d284fff3.js`, especially lines 77–124, 1001–1003, 3982–4049, 4591–4779 |
| S-CTRL | `wp-content/plugins/missionmed-hub/includes/class-mmed-student-os.php`, especially 434–442, 601, 661 |
| S-ACCESS | `wp-content/plugins/missionmed-hub/includes/class-mmed-access-gate.php`, especially 291–299 |
| S-STUDY | `wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php` |
| S-REST | `wp-content/plugins/missionmed-hub/includes/class-mmed-rest-api.php`, 591–624, 694–695, 1860–1900 |
| S-CAL | `wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php` |
| S-WRITERS | Calendar v4/Admin assets plus Session Manager/Calendar Enrollment PHP chain listed in E-010 |
| P-100/200/300/350/360 | Operational historical packages under `/Users/brianb/MissionMed/_AI_HANDOFFS/from_cowork/`, with byte-identical sandbox copies observed; only D9-360 has the official D9-410 package seal |
| R-PUBLIC | Current anonymous public evidence: hashed JS exact, dashboard 302, REST 401; no authenticated route/backend proof |
| R-NONE | No authenticated production runtime evidence |
| D-CAL-SOURCE | Source defines `$wpdb->prefix . mmed_events` wiring; live table and rows are unverified |
| D-NONE | No applied/verified persistence |
| I-CAL-SOURCE | Source-level shared Calendar coupling only; runtime behavior unverified |
| I-NONE | No production integration implementation found |
| T-350 / T-360 | Prototype-only suites, 188/188 and 209/209 |
| T-NONE | No production feature test |

## Matrix

| Feature | Status | Source / branch | Runtime · persistence · integration · tests | Confidence | Exact gap | V1-8010 action |
|---|---|---|---|---|---|---|
| Learner route/access | PRESENT BUT BROKEN | S-SHELL, S-CTRL, S-ACCESS | R-NONE · D-NONE · I-NONE · T-NONE | High source / low runtime | Every non-admin is locked in recovered source; authenticated runtime unverified | Separate entitlement/rollout/action authorization and test principals |
| Admin legacy route | IMPLEMENTED BUT UNVERIFIED | S-SHELL, S-CTRL | R-NONE · D-CAL-SOURCE · I-CAL-SOURCE · T-NONE | High source / low runtime | Source bypasses lock for admin; no authenticated render | Characterize audit-only admin and deny learner-data mutation |
| Daily block list | IMPLEMENTED BUT UNVERIFIED | S-SHELL, S-STUDY, S-REST | R-NONE · D-CAL-SOURCE · I-CAL-SOURCE · T-NONE | High source | Live table/rows and authenticated response unknown | Freeze behavior, then replace with V1 read model |
| Create block | IMPLEMENTED BUT UNVERIFIED | S-SHELL, S-STUDY, S-REST, S-CAL | R-NONE · D-CAL-SOURCE · I-CAL-SOURCE · T-NONE | High source | No Plan model, overlap, idempotency, revision, runtime proof | Add safety tests; implement Plan repository |
| Drag/move | IMPLEMENTED BUT UNVERIFIED | S-SHELL | R-NONE · D-CAL-SOURCE · I-CAL-SOURCE · T-NONE | High source | Coarse layout; no collision/concurrency law | Transactional 15-minute learner operation |
| Resize | IMPLEMENTED BUT UNVERIFIED | S-SHELL | R-NONE · D-CAL-SOURCE · I-CAL-SOURCE · T-NONE | High source | Small handle; no keyboard parity or revision | Accessible alternatives and revision checks |
| Completion | PRESENT BUT BROKEN | S-SHELL, S-STUDY, S-CAL | R-NONE · D-CAL-SOURCE · I-CAL-SOURCE · T-NONE | High source | Partial update replaces metadata; wrong domain ownership | Preserve metadata; learner-only Plan operation |
| Edit/delete learner UI | NOT STARTED | S-SHELL; backend S-REST/S-CAL only | R-NONE · D-CAL-SOURCE · I-CAL-SOURCE · T-NONE | High | No edit/delete UI; backend numeric mutation is unsafe | Owner/type containment, then complete Plan UI |
| Mission | PROTOTYPE ONLY | P-200/300/350/360 | R-NONE · D-NONE · I-NONE · T-350/T-360 | High | No production domain/UI | Implement after first vertical slice |
| Day | PARTIAL | Legacy S-SHELL; target P-350 | R-NONE · D-CAL-SOURCE · I-CAL-SOURCE · T-350 | High | No actuals, anchors, reserve, closeout | Build V1 Day read model |
| Week canvas | PROTOTYPE ONLY | P-300/350/360 | R-NONE · D-NONE · I-NONE · T-350/T-360 | High | Legacy coarse day/hour view only | Port D9-300 language onto Plan data |
| Month | PROTOTYPE ONLY | P-350/360 | R-NONE · D-NONE · I-NONE · T-350/T-360 | High | No production source | Add after execution core |
| Journey | PROTOTYPE ONLY | P-350/360 | R-NONE · D-NONE · I-NONE · T-350/T-360 | High | No production source; prototype popover defects | Revalidate and implement read model |
| Review/closeout | PROTOTYPE ONLY | P-200/350/360 | R-NONE · D-NONE · I-NONE · T-350/T-360 | High | No durable closeout/streak | Operation-derived implementation |
| Focus Mode | PROTOTYPE ONLY | P-200/300/350/360 | R-NONE · D-NONE · I-NONE · T-350/T-360 | High | No production session persistence | Durable session service and UI |
| Quick Build | PROTOTYPE ONLY | P-100/200 | R-NONE · D-NONE · I-NONE · T-NONE | Medium-high | No planner/API/preview | Add after core repository |
| Recurrence | NOT STARTED | Requirement P-100/350 | R-NONE · D-NONE · I-NONE · T-NONE | High | No Plan series/exception model | Stable series and detach semantics |
| Reserve | PROTOTYPE ONLY | P-200/350 | R-NONE · D-NONE · I-NONE · T-350 | High | No durable provenance | First-class reserve object |
| Recovery/reflow | PROTOTYPE ONLY | P-200/350 | R-NONE · D-NONE · I-NONE · T-350 | High | No conservation engine | Learner-confirmed deterministic recovery |
| Partial/remainder | PROTOTYPE ONLY | P-350 | R-NONE · D-NONE · I-NONE · T-350 | High | No actual/remainder model | Session actual plus derived remainder |
| Mentor ghosts/privacy | PROTOTYPE ONLY | P-100/200/350 | R-NONE · D-NONE · I-NONE · T-350 | High | No assignment/privacy/withdrawal/API | Versioned suggestion and learner response |
| Goals/runways | PROTOTYPE ONLY | P-100/350/360 | R-NONE · D-NONE · I-NONE · T-350/T-360 | Medium | Profile/source field ownership open | Decide fields; snapshot source facts |
| Capacity/confidence | PROTOTYPE ONLY | P-100/200/350 | R-NONE · D-NONE · I-NONE · T-350 | High | No fixed anchors/capacity engine | Computed capacity snapshot |
| Task families/activity types | PROTOTYPE ONLY | P-100/200/350 | R-NONE · D-NONE · I-NONE · T-350 | High | Legacy strings are not governed taxonomy | Stable IDs and server validation |
| Calendar boundary | PRESENT BUT BROKEN | S-STUDY, S-CAL, S-WRITERS | R-NONE · D-CAL-SOURCE · I-CAL-SOURCE · T-NONE | High source | Wrong owner; source-capable multiple writers/recognizers; runtime concurrency unverified | Read-only adapter, echo-safe export, explicit import |
| Approved fixed-anchor provider | NOT STARTED | Generic boundary only | R-NONE · D-NONE · I-NONE · T-NONE | High | No provider beyond Calendar is approved or proven necessary | Keep generic seam; no appointment-system work in V1-8010 |
| Course/Arena adapters | NOT STARTED | Requirement P-100/350 | R-NONE · D-NONE · I-NONE · T-NONE | High | No transforms/contracts | Versioned evidence/proposal adapters |
| StoryForge/Vault/Profile | NOT STARTED | Requirement P-100/200 | R-NONE · D-NONE · I-NONE · T-NONE | High | No V1 context links/failure policy | Isolated optional adapters |
| Timer/pill/companion | PROTOTYPE ONLY | P-200/360 | R-NONE · D-NONE · I-NONE · T-360 | High | No durable cross-route session | Shell adapter after Focus core |
| Settings | PROTOTYPE ONLY | P-350/360 | R-NONE · D-NONE · I-NONE · T-350/T-360 | High | Canonical owner/round-trip open | Decide owner; versioned settings |
| Quotes/sound/motion | PROTOTYPE ONLY | P-350/360 | R-NONE · D-NONE · I-NONE · T-350/T-360 | High | Prototype-local only | Govern, opt-in, reduced motion |
| Streaks | PROTOTYPE ONLY | P-350 | R-NONE · D-NONE · I-NONE · T-350 | High | No durable closeout basis | Derive from closeout operations |
| Entitlement/authorization | PRESENT BUT BROKEN | S-SHELL, S-ACCESS, S-REST | R-PUBLIC · D-NONE · I-NONE · T-NONE | High source | Non-admin UI locked; any logged-in caller passes generic REST permission for own resources | Structured fail-closed access context |
| Rollout/runtime modes | NOT STARTED | Registry search at d445 | R-NONE · D-NONE · I-NONE · T-NONE | High | No registered V1 key or separate exposure/write/reader state | Server default-off rollout plus post-cutover degraded-reader mode |
| Plan persistence | NOT STARTED | Source/data census | R-NONE · D-NONE · I-NONE · T-NONE | High | No store selected/applied | Decision, schema, repository, migration |
| Observability | NOT STARTED | Source search at d445 | R-NONE · D-NONE · I-NONE · T-NONE | High | No V1 events/SLO/dashboard | Privacy-safe telemetry |
| Production QA/release | NOT STARTED | Repository and runtime census | R-PUBLIC · D-NONE · I-NONE · T-NONE | High | No production suite, staging, package, or rollback rehearsal | Layered CI → staging → 8020/8030 gates |

## Current usable scope

No ordinary learner-visible Study scope is verified. Recovered source makes the
legacy route source-capable for administrators to list, create, move, resize, and
complete blocks, but the authenticated route and live Calendar table/rows were
not verified. The backend separately exposes source-level list/create/update/
delete routes to logged-in callers for owned records, with the defects recorded
above. That is not a usable V1 product.

## Unknowns eliminated

There is no hidden production Mission/Focus/Reserve/Recovery/Journey
implementation in the recovered source. No Plan feature flag, runtime-lock asset,
dedicated route bundle, production event vocabulary, applied Plan schema, or
verified production Study route was found.
