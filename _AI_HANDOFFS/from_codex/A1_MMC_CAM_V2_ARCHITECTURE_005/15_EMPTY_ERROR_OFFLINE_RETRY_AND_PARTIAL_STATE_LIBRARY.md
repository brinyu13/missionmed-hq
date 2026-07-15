# 15 Empty, Error, Offline, Retry, and Partial State Library

RESULT: `COMPLETE_STATE_VOCABULARY_DEFINED`

## Shared state contract

Every remote/derived region renders through one `AsyncBoundary/StatePanel` contract containing icon, title, plain-language explanation, user impact, source/environment, “as of” time, primary recovery, optional secondary action, diagnostic ID, and accessible announcement behavior. Color reinforces but never defines.

The boundary keeps last successful content when safe, scopes state per region, and never converts a partial page into a blank `Promise.all` failure. State is data, not ad hoc copy.

## Data and connectivity states

| State | Display and behavior |
| --- | --- |
| Initial loading | Named skeleton (`aria-hidden`) plus one polite “Loading [object]”; no fixtures shown as truth. |
| Refreshing | Preserve prior content; mark refreshing; retain focus; show last successful timestamp. |
| First-use empty | Explain what belongs here and one authorized seeding action; never populate synthetic records. |
| Authoritative empty | Confirm source/time and zero records; do not resurrect fixtures. |
| Filtered empty | Name filters/query and provide Clear Filters; do not imply no history exists. |
| Future policy-authorized offline cache | Not present in initial CAM v2. If separately approved later: persistent label, exact cache age, unavailable commands, stale dependent guidance, device-bound encryption, TTL, and revocation limits. |
| Offline unsynced | Mark each memory-only draft `NOT SAVED`; warn that close/reload loses it; reconnect/retry/discard only when safe. |
| Stale | Age/threshold/source plus refresh; suppress or flag consequential derived output. |
| Partial | Show available sections; name unavailable ones; suppress completeness-dependent conclusions; retry missing only. |
| Degraded dependency | Name capability affected/unaffected and fallback; persistent system status. |
| Permission denied | No protected flash/existence leak; name role/safe recourse only. |
| Session expired | Protect draft per policy; sign-in returns to exact safe workflow. |
| Not found/withdrawn | Distinguish unavailable/withdrawn without leaking protected existence. |
| Timeout warning / reauthentication | Accessible countdown/status without spam; extend or reauthenticate; preserve only permitted draft and exact return route. |
| Unsupported browser / upgrade required | Name unsupported capability and safe supported route; never continue with weakened security/accessibility. |
| Maintenance | Scope, expected window, unaffected work, retained draft, refresh/status action. |
| Notification disabled | Explain channel state and in-app alternative without coercion. |

## Error and concurrency states

| State | Display and behavior |
| --- | --- |
| Retryable error | Retain input/content; explain failure; Retry; diagnostic details; alert once if blocking. |
| Non-retryable error | Explain required owner/action; suppress futile retry; include diagnostic ID. |
| Rate limited | Retry-after time, queued behavior, retained input; no screen-reader countdown spam. |
| Validation error | Linked error summary; per-field explanation; focus first error; retain all input. |
| Version conflict | Preserve both versions; author/time/source diff; reapply/discard/resolve; never unsafe auto-merge. |
| Duplicate command | Return original result identity and timestamp; do not create warning noise unless payload conflicts. |
| Canonical outcome unknown after lost response | Recheck current authority and replay the same idempotency identity to return the recorded all-or-nothing result; never imply a partial canonical commit. |
| External effect partial or outcome unknown | Show completed/pending/failed/`OUTCOME_UNKNOWN`; read-before/reconcile when possible and require a named manual decision when ambiguity remains. Retry only when a stable provider idempotency contract makes it safe; canonical objects remain committed and unchanged. |
| Revoked during action | Stop, clear protected cache, retain safe non-sensitive draft, explain authorization change. |
| Upload scanning/quarantine | File name/type/size safely escaped, scan state, allowed cancel; no downstream use before pass. |
| Upload rejected/quota | Specific allowed reason/limits and safe replace/contact path; retain no unsafe partial reference. |

## Job and pipeline states

| State | Required UI |
| --- | --- |
| Queued | Created time, owner, stage/SLO; cancel only if safe. |
| Leased/running | Operation name, attempt, heartbeat/progress when known; throttled announcements. |
| Retry scheduled | Failure class, attempt, next retry, authorized Retry Now/Cancel. |
| Failed/dead letter | Evidence retained, owner/runbook, safe retry/reconcile, duplicate protection. |
| Completed | Exact result/affected object/time/next action; polite announcement. |
| Cancelled/superseded | What replaced/cancelled it; retained audit. |
| Incomplete pair | Missing/ambiguous member via opaque asset IDs; no Analyze. |
| Identity unverified/conflict | Evidence/alternatives and review route; attachment/analysis/publication blocked. |
| Consent missing/revoked | Purpose/policy gate and owner; processing stops; no bypass. |
| AI proposal | `AI PROPOSAL · UNREVIEWED`; evidence/model/prompt/run; no operational styling. |
| Evidence failed/partial | Unsupported claims named; approval/publication blocked; repair/reject route. |
| Awaiting mentor review | Reviewer/age/evidence and downstream block. |

## Publication states

`DRAFT`, `REVIEW_REQUIRED`, `APPROVED`, `PUBLISHED`, `ACKNOWLEDGED`, `CORRECTED`, `SUPERSEDED`, `WITHDRAWN`, and `EXPIRED` each show exact version, actor, date, subject, and next action. `MENTOR_ONLY` and `SENSITIVE` appear as restrictions and are never publication progress. Withdrawal invalidates active student queries/caches/notifications; correction links versions.

## Mentor/student empty-state examples

- Today empty: “No verified condition needs action now. Last refreshed [time]. Review upcoming calls.” Not “All students are safe.”
- No goals: “No agreed goal evidence yet. Create or import an agreed goal.” Not “35% ready.”
- Student Today empty: “Your mentor has not published a next action yet.” No fixture content.
- Review queue empty: “No items match this queue/filter as of [time].” It does not imply the worker/source is healthy.
- Search empty: echo query/scope and offer corrections; do not reveal protected matches.

## Announcement and focus rules

Passive state changes use polite status; blocking submission errors use alert once; action-required notices persist. Background refresh never moves focus. Failed submission focuses a linked error summary. Retry restores focus to result/status. Toasts with required actions do not auto-dismiss. Progress announcements are rate-limited.

## Deterministic fixture matrix

Every state above has a non-network fixture with environment label and exact expected DOM/ARIA, plus transitions: load→success, load→empty, refresh→partial, offline→not-saved→reconnect, save→409 conflict, queue→retry→success, job→dead letter→reconcile, proposal→evidence fail, publication→withdrawal, permission→revocation, timeout→reauth, upload→quarantine→accept/reject, maintenance→resume, and unsupported-browser. Fixtures may not share IDs/data with live/staging.

## Acceptance

- Every async region declares exactly one primary state plus applicable orthogonal trust state.
- Empty/loading/offline/stale/partial/conflict/permission/error are visually and programmatically distinct.
- User input is never lost on retryable failures.
- Retry is idempotent and never labels pending work saved.
- Partial data cannot produce a completeness-dependent recommendation.
- No state leaks protected existence, path, credential, transcript, or other student.
- Every state is responsive, keyboard/screen-reader complete, and covered in browser/visual regression.
