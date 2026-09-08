# MX-CAL-4200C-R7 — executable V1 vs R6 parity map

Oracle order: live Classic/V1 for jobs and information architecture; current shared core/backend for authority and data; 4200B for StoryForge treatment. `7db48dd` is the exact deployed R6 checkpoint.

| Surface / workflow | V1 behavior | R6 behavior | Gap | R7 fix / proof |
|---|---|---|---|---|
| Primary Matrix feed | `/events?no_sync=1` owns Calendar readiness | Unbounded request plus a timer calling nonexistent `instance.set()` | **P0** indefinite spinner | Bound primary request in core; current-generation abort must settle; test Matrix success with Scheduler failure and a primary hang |
| Scheduler enrichment | Secondary appointment merge | Detached from `start()`, but timeout does not cancel and merge can be overwritten | **P1** races | Keep detached; abort stale/late requests; merge without replacing canonical WP IDs |
| Source rail | Hierarchical filter rail | API/fallback tree exists | Parent toggle does not hide descendants; source states weak | Cascade visibility by ancestry; categories render independently of event status |
| ExamPrep | Parent of Drills and Study Blocks | Fallback parent exists with two tier leaves | Static fallback omits Study Blocks | Prefer canonical API categories; preserve valid personal/system leaves |
| Drills L1 and L2/3 | Admin tabbed 19-subject inventory; click/drag to date | Shared 19+19 inventory and persistence handlers | Labels/rail density and live proof incomplete | Keep shared inventory; readable tier labels; live persist/reload/Classic/cleanup for each tier |
| Mission Residency | Parent of session sources | Parent with A–F fallback | Parent cascade missing | Use server categories and ancestry-aware filtering |
| Sessions A–F | V1 static A–E; current canonical backend adds F | R6 fallback A–F | Needs real-category verification | Preserve canonical A–F; verify populated production rail and filtering |
| Clinicals | Leaf with specialty-aware form | Leaf exists | Specialty omitted | Restore specialty field/meta for create/edit |
| NRMP / Match | System category and seeded dates | NRMP leaf exists | Exact live dates/source unproved | Verify current authoritative system rows and source filtering; no demo data |
| Arena | Leaf source | Leaf exists | Live data/permission unproved | Verify real role-scoped visibility |
| My Appointments | Scheduler-derived source | Appointment fallback exists | Scheduler replacement can lose WP identity | Merge enrichment into canonical event; avoid duplicate/ID loss |
| Tracker | Six V1 phases, countdown, current phase, click-to-jump | Same phase order/data and click action, different markup/skin | Data is hard-coded; R6 claim was overstated | Preserve exact V1 semantics and wording; StoryForge skin; date-boundary tests and browser proof |
| Month | 42 cells, event drag/drop | 42 cells and Month drag/drop | density/full-fit and six rows unproved | Fit all rows without inner/horizontal scroll; real events; browser sizes |
| Week | Time-grid with event move/resize | List columns | **Parity fail** | Restore bounded V1 hour-grid jobs with draggable events and keyboard/touch duration fallback |
| Day | Time-grid with event move/resize | List rows | **Parity fail** | Same shared IDs/state; move and duration adjustment through core |
| Agenda | Chronological event list | Chronological list | Live density/readability unproved | Verify same IDs/state and readable real production data |
| + New / Edit / Delete | Obvious admin forms/actions | Present in V2 | Audience/scope and specialty missing; category-to-event-type incorrect | Select real leaves; use category `eventType`; add audience/specialty; live admin→student CRUD/cleanup |
| Event duration | Pointer resize in Week/Day | ±15 min fallback only; controls visually hidden | **Parity fail** | Restore V1 resize where supported; keep visible keyboard/touch ±15 fallback |
| Todos | CRUD with priority/due/notes/meeting fields | User-owned CRUD, priority/due/notes | Meeting fields omitted; loading/error shown as empty | Add meeting fields/links; explicit loading/error/empty; live ownership/cleanup |
| Favorites / importance | Star/unstar user metadata plus event importance | Drawer calls shared `toggleFavorite()`; event form importance was not round-tripped | Importance now round-trips through `meta.important`; favorite remains user-scoped; live reload/unstar proof |
| Mini-calendar | Not a V1 surface | Additive 42-day mini-calendar | Previous/next absent; one Today button unbound | Keep only as bounded additive upgrade; bind all Today buttons; add accessible prev/next |
| Sync / Export | Truthful one-way ICS of filtered events | Exports raw `state.events` while claiming visible | Hidden sources leak into export | Export exactly the visibility-filtered model; keep one-way wording |
| Webex Join | Existing V1/session behavior | V2 adapter ignores `meeting_url` and may use wrong ID | **Integration fail** | Preserve canonical WP event ID; honor `can_join`; safe normalized URL; live fixture or exact blocker |
| Replay | Known URL/eligible completed event | Every `sourceId` routed to Scheduler recording | Source routing incorrect | Open existing safe replay; refresh only Scheduler appointments; fixture or `NO SAFE LIVE FIXTURE` |
| Settings | Classic/StoryForge selector | Modal exists | Prior production dark-on-dark; no rendered proof | Computed styles plus visual/keyboard proof; Classic immediate fallback |
| Student/Admin | Admin preview toggle; server authority | Presentation toggle exists | Mobile hides control; contract needs proof | Keep server-derived capability; preview never grants writes; ordinary student sees no admin/Drills |
| Category CRUD | V1 add-category job | Core/backend supports scoped CRUD | R6 UI omits it | Restore authorized personal/system category management without inventing sources |
| 390×844 | Usable stacked V1 | Conflicting fixed-bottom rail rules | Categories/todos/settings trapped; children/perspective hidden | Single accessible mobile sheet/drawer; all jobs reachable; zero horizontal overflow; last Month row visible |
| Loading/empty/degraded | Primary Calendar remains usable | Status states exist | Empty can mask loading/error; R6 timer broken | Independent status surfaces; no contradiction between notice and spinner |
| Keyboard/focus/reduced motion | Basic keyboard activation | Drawer focus trap/return present | Whole-product proof incomplete | Verify forms, rail, tracker, drag fallback, Escape, focus return and reduced motion in real browser |

Execution order: (1) shared-core loading/cancellation/merge correctness; (2) rail/category/event-form contracts; (3) V1 Week/Day and integration parity; (4) visual/readability/mobile consolidation; (5) deterministic tests; (6) authenticated local/live product QA; (7) independent non-builder verification; (8) only then StoryForge default.
