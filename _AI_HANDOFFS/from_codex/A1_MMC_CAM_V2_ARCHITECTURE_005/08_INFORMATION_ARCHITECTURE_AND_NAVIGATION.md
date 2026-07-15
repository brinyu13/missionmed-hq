# 08 Information Architecture and Navigation

RESULT: `FINAL_NAVIGATION_SELECTED`

## Mentor destinations

The mentor product has four primary destinations:

| Destination | Question | Contents |
| --- | --- | --- |
| Today | Who needs me and what is the next safe action? | Attention queue, next calls, mentor promises, review waits, changes. |
| Students | What is true and useful for this student? | Roster/search and route-scoped Student Workspace. |
| Work | What commitments require follow-through? | Tasks, promises, open loops, decisions, ownership/due filters. |
| Reviews | What requires human judgment? | AI claim, publication, identity, and selected media review queues. |

`Operations` is a capability-gated workspace switch for pipeline, roster adapters, Webex policy, jobs, prompts, audit, and system health. Search/command palette and Quick Capture are global controls. Environment, freshness, connectivity, save state, and account role live in stable shell chrome.

## Student destinations

Student navigation is separate: Today, Plan, Tasks, Updates, Files. It has no route to mentor memory, internal attention, Operations, AI proposals, or identity evidence.

## Destination resolution

| Current concept | CAM v2 placement |
| --- | --- |
| Student Profile | `/students/:id/overview` contextual workspace |
| Call Prep / Mentor Memory | Overview Focus mode + private inspector |
| Sessions / Meeting Intelligence | `/students/:id/history/sessions/:sessionId`; evidence/session detail |
| Goals | Student Plan tab and Work filters |
| Promises | Canonical commitments in Plan/Work |
| Open Loops | Plan/Work projection; attention only when actionable |
| Timeline | Student History projection |
| Actions | Work primary destination |
| Review queues | Reviews primary destination |
| Student Preview | Contextual exact publication preview through student authorization |
| Pipeline Admin / Webex controls | Operations, capability gated |
| System/environment status | persistent compact shell state + Operations health detail |

## Route contract

```text
/mmc-private/today
/mmc-private/students
/mmc-private/students/:subjectLinkId/overview
/mmc-private/students/:subjectLinkId/plan
/mmc-private/students/:subjectLinkId/history
/mmc-private/students/:subjectLinkId/history/sessions/:sessionId
/mmc-private/students/:subjectLinkId/files
/mmc-private/students/:subjectLinkId/prep
/mmc-private/sessions/:sessionId/live
/mmc-private/sessions/:sessionId/review
/mmc-private/work
/mmc-private/reviews/:queueKind?/:reviewId?
/mmc-private/operations/:area?/:itemId?
```

Student URLs use a distinct authenticated route family and publication IDs; they never reuse a mentor subject-link URL.

## Desktop and laptop

At 1280px and above, a labeled CAM operator rail holds the four destinations, with Operations isolated at the bottom when authorized. Student context appears in a sticky workspace header after a student route is open. A dominant stage occupies the center and an optional evidence inspector the right. The inspector never becomes a second source of truth.

At 1024–1279px, the rail compacts and exposes accessible names on focus/hover; the inspector becomes a drawer. The top bar never wraps. Search, Quick Capture, and one primary action remain visible; secondary commands move to an overflow menu.

## Tablet and mobile

At 768–1023px, navigation uses an overlay rail or portrait bottom navigation. Master/detail becomes route-based queue → detail. At less than 768px, bottom navigation provides Today, Students, Work, Reviews, and More; one column and a sticky non-obscuring contextual action replace desktop splits. Operations is available through More only to authorized roles. Every desktop action remains reachable at 320px, though dense batch work becomes sequential.

## Back, deep links, and state restoration

- Every primary screen and selected object has a URL. Navigation uses real links, browser history, and `aria-current`.
- Back returns from inspector/detail to the originating queue with filters, selected row, scroll, and focus restored.
- A route change focuses the view `h1` and announces it once; background refresh never steals focus.
- Reload rehydrates subject, tab, filter, review, and safe draft state from server authority, not a mutable global selector.
- A link to an unauthorized/expired object reveals no protected metadata and routes to an honest permission/not-found state.

## Multi-tab and unsaved work

Each command has `expected_version`. A second tab receives changed-version notification and marks its draft conflict before write. Safe drafts can be retained by policy; sensitive content is never silently stored in unapproved localStorage. Navigation from unsaved work offers Save Draft, Discard, or Stay. Save Draft must receive durable acknowledgement before claiming saved.

## Keyboard model

- Skip link → primary nav → contextual header → main action/content → inspector.
- `Cmd/Ctrl+K` search/commands, `/` focus search when appropriate, `?` shortcuts, Escape retreat, and optional documented destination keys.
- Arrow-key roving behavior is used only in true tabs/menus/listboxes; plain navigation remains normal links.
- Live Session Focus mode has explicit enter/exit and cannot strand focus.

## IA constraints

- A feature does not earn a nav item merely because it has a table.
- One object cannot have conflicting state in Overview, Plan, Work, History, and Preview.
- Contextual detail belongs in an inspector, not another dashboard card.
- Pipeline mechanics cannot interrupt the mentor loop unless a decision actually needs the mentor.
- Student publication is a product boundary, not a preview tab.
- Partner Demo navigation has no authority and is explicitly rejected in the dedicated report.

## Navigation acceptance

All deep links, reloads, back/forward paths, cross-student attempts, session resume, review return, tab conflicts, keyboard paths, mobile drawers/bottom navigation, and focus restoration must pass deterministic browser tests at every required viewport. The architecture fails if any hidden mutable selection can disagree with the route.
