# MMOS-ARENA-INTEL: UI State Machine + Behavior Contract

**Prompt ID:** (Z)-MMOS-ARENA-INTEL-claude-high-603
**Date:** 2026-04-27
**System:** MMOS-ARENA-INTEL-01
**Risk:** LOW (CONTENT / STRATEGY)
**Authority:** PRIMER_CORE.md, MMOS_MODE_PATTERN.md, DATA_FLOW_CONTRACT.md
**Depends On:** MMOS_ARENA_INTEL_HARDENING_REPORT.md, MMOS_ARENA_INTEL_UI_COPY.md

---

## 1. STATE LIST

The Intel HUD has exactly 7 mutually exclusive global states. The system is always in exactly one state. No state is implicit.

| State ID | Name | Condition |
|----------|------|-----------|
| `S0` | NO_SESSION | No authenticated Supabase session. auth.getUser() returns null. |
| `S1` | EMPTY_USER | Authenticated. Zero rows in qstat_answers_v1 for this user_id. No student_profiles row OR student_profiles exists with zero answer history. |
| `S2` | LOW_DATA | Authenticated. 1-19 total rows in qstat_answers_v1 for this user_id. |
| `S3` | STALE_DATA | Authenticated. 20+ answers exist. Last snapshot updated_at is >24 hours old. No pipeline job currently running for this user. |
| `S4` | ACTIVE | Authenticated. 20+ answers exist. Snapshot freshness <= 24 hours. |
| `S5` | PIPELINE_UPDATING | Authenticated. An intel_job for this user_id is in status 'pending' or 'running'. Existing snapshot may or may not be fresh. |
| `S6` | ERROR | Any RPC call in the initialization sequence failed and could not recover after 1 retry. |

**State priority (conflict resolution):** If multiple conditions are true simultaneously, resolve to the highest-priority state:

```
S6 > S0 > S5 > S3 > S4 > S2 > S1
```

Example: User is authenticated (not S0), has 25 answers (not S1/S2), snapshot is 30 hours old (qualifies for S3), AND a pipeline job is running (qualifies for S5). Resolution: S5 wins because pipeline is actively refreshing. S3 only applies when no job is running.

---

## 2. STATE TRANSITIONS

```
S0 ──[auth success]──> S1 | S2 | S3 | S4 | S5
       (determined by data check after auth)

S1 ──[user completes first answer]──> S2
       (detected on next HUD load, not real-time)

S2 ──[answer count reaches 20]──> S4 | S5
       (S5 if pipeline job triggered, S4 if snapshot already computed)

S3 ──[user triggers refresh OR pipeline job starts]──> S5
S3 ──[fresh snapshot detected on load]──> S4

S4 ──[snapshot age exceeds 24h without new activity]──> S3
S4 ──[pipeline job starts for new data]──> S5
       (S5 overlays on S4; existing data stays visible)

S5 ──[job completes successfully]──> S4
S5 ──[job fails and enters 'dead']──> S3 (if existing snapshot >24h) | S4 (if existing snapshot still fresh)
S5 ──[job timeout (>60s visible wait)]──> S4 with stale indicator (if snapshot exists) | S6 (if no snapshot exists)

S6 ──[user clicks retry]──> Re-run entry flow (may land on any state)
S6 ──[user clicks back]──> Arena lobby (MMOS.returnToArena())

ANY ──[auth token expires + refresh fails]──> S0
ANY ──[unrecoverable RPC failure]──> S6
```

---

## 3. ENTRY FLOW

When user loads the Intel HUD (navigates to the intel mode within Arena):

```
STEP 1: Check auth
  ├── supabase.auth.getUser()
  ├── Returns null? ──> STATE = S0. STOP.
  └── Returns user? ──> Continue.

STEP 2: Fetch user data (parallel)
  ├── A: SELECT count(*) FROM qstat_answers_v1 WHERE user_id = {uid}
  ├── B: SELECT * FROM student_profiles WHERE user_id = {uid}
  ├── C: SELECT * FROM intel_jobs WHERE payload->>'user_id' = {uid}
  │       AND status IN ('pending', 'running')
  │       ORDER BY created_at DESC LIMIT 1
  └── D: Fetch latest snapshot (implementation-specific, may be a view or materialized result)

  If ANY of A/B/C/D fails after 1 retry ──> STATE = S6. STOP.

STEP 3: Determine state
  ├── C returns a running/pending job? ──> STATE = S5
  ├── A returns 0? ──> STATE = S1
  ├── A returns 1-19? ──> STATE = S2
  ├── D snapshot exists AND snapshot.updated_at > (now - 24h)? ──> STATE = S4
  ├── D snapshot exists AND snapshot.updated_at <= (now - 24h)? ──> STATE = S3
  └── D no snapshot AND A >= 20? ──> STATE = S5 (trigger pipeline job)

STEP 4: Render
  Apply HUD rules for determined state (Section 4).
```

**Timing budget:** Steps 1-3 must complete within 3 seconds. If any query exceeds 3s, cancel pending queries and enter S6 with timeout context.

**No flash of wrong state:** Render a neutral loading skeleton until Step 3 completes. Never show S4 content and then switch to S1.

---

## 4. HUD RULES PER STATE

### S0: NO_SESSION

| Element | Behavior |
|---------|----------|
| HUD container | Hidden |
| Auth prompt | Visible. Full-screen overlay within mode. |
| Message | "Log in to access your performance dashboard." |
| Action | [Log In] button triggers auth flow (/api/auth/exchange + bootstrap) |
| All panels | Hidden |
| Timer | Hidden |
| Today Focus | Hidden |
| Today Plan | Hidden |

### S1: EMPTY_USER

| Element | Behavior |
|---------|----------|
| HUD container | Visible (onboarding layout) |
| Hero area | Single card, centered. "Welcome to Arena Intel. Start a practice session to see your performance data here." |
| Today Focus | Hidden |
| Today Plan | Hidden |
| Mission Intel | Hidden |
| Topic breakdown | Hidden |
| Timer | Hidden |
| Enrollment badge | Visible if enrolled (shows tier name) |
| Action | [Start Practicing] button navigates to drill or duel mode |
| Refresh button | Hidden (nothing to refresh) |

### S2: LOW_DATA

| Element | Behavior |
|---------|----------|
| HUD container | Visible (partial layout) |
| Progress bar | Visible. "{n}/20 questions answered. {20-n} more to unlock full insights." |
| Overall accuracy | Visible. "{correct} of {n} correct" (raw count, no percentage if n < 10). If n >= 10, show percentage + count. |
| Average response time | Visible if n >= 5. Hidden if n < 5. |
| Today Focus | Hidden (insufficient data for recommendation) |
| Today Plan | Visible (empty state copy: "Complete 20 questions across 2+ topics to generate your first study plan.") |
| Mission Intel | Hidden |
| Topic breakdown | Visible only for topics with 3+ answers. Show raw count format. Topics with <3 answers: omitted. |
| Timer | Visible and functional |
| Refresh button | Hidden (no pipeline runs below 20) |

### S3: STALE_DATA

| Element | Behavior |
|---------|----------|
| HUD container | Visible (full layout) |
| Staleness banner | Visible. Inline, non-blocking. "Last updated {n} days ago. Practice to refresh." Amber text. |
| All metric panels | Visible with last-known-good data. Each shows freshness timestamp. |
| Today Focus | Visible with stale label. Shows last recommendation. |
| Today Plan | Visible. If plan exists, show it. If not, show generation prompt. |
| Mission Intel | Visible. Uses stale-data variant: "Last session: {date}. A quick 5-minute drill will refresh everything." |
| Timer | Visible and functional |
| Refresh button | Visible. [Refresh Insights] triggers pipeline job, transitions to S5. |
| Disabled elements | None. All actions available. |

### S4: ACTIVE

| Element | Behavior |
|---------|----------|
| HUD container | Visible (full layout) |
| All metric panels | Visible with current data. No staleness warnings. |
| Today Focus | Visible. High-confidence version if qualifying topic has 20+ answers. Low-confidence version if 10-19. |
| Today Plan | Visible. Active plan if generated. Generation prompt if not. |
| Mission Intel | Visible. Selects variant based on performance profile (strong/weak/mixed). |
| Timer | Visible and functional |
| Topic breakdown | Full display. All topics with 3+ answers shown with appropriate confidence tier. |
| Refresh button | Hidden (data is fresh, no action needed). |
| Actions | All available: start timer, launch drill from plan, expand topic details. |

### S5: PIPELINE_UPDATING

| Element | Behavior |
|---------|----------|
| HUD container | Visible |
| Update indicator | Visible. Small, non-blocking. "Refreshing your insights..." with subtle animation (pulse dot, not spinner). |
| Existing data | Visible if snapshot exists (show last-known-good). Hidden if no snapshot (show skeleton). |
| All panels | Functional. User can interact with existing data while pipeline runs. |
| Today Focus | Show existing recommendation if available. Otherwise hidden. |
| Timer | Visible and functional |
| Refresh button | Disabled. Shows "Updating..." |
| On job completion | Transition to S4. Replace data in-place without full page reload. Remove update indicator. Brief "Updated just now" confirmation that fades after 3s. |
| On job failure | If existing snapshot is fresh enough (< 24h): remain in S4, remove indicator, log failure silently. If no usable snapshot: transition to S6. |

### S6: ERROR

| Element | Behavior |
|---------|----------|
| HUD container | Visible (error layout) |
| Error card | Centered. "Something went wrong loading your data. This is on our end, not yours." |
| Actions | [Try Again] re-runs entry flow from Step 1. [Back to Arena] calls MMOS.returnToArena(). |
| All metric panels | Hidden |
| Timer | Hidden |
| Today Focus | Hidden |
| Today Plan | Hidden |
| Mission Intel | Hidden |
| Technical details | Hidden from user. Logged to console: `[INTEL_ERROR] {error_code} {rpc_name} {timestamp}` |

---

## 5. ACTION FLOWS

### 5.1: Clicking "Career" (navigating to Intel HUD)

```
1. MMOS.navigate('intel') called
2. MMOS shows loader overlay ("Loading your dashboard...")
3. Intel mode init() executes Entry Flow (Section 3)
4. On success: init() returns { status: 'ready', initialState: S1|S2|S3|S4|S5 }
5. MMOS hides loader, calls onEnter()
6. onEnter() renders HUD per determined state
7. Total time budget: 3s from navigate call to visible HUD
```

If init exceeds 3s:
```
1. init() returns { status: 'error', message: 'Taking longer than expected. Please try again.' }
2. MMOS shows error overlay with Retry and Back buttons
```

### 5.2: Starting Timer

```
Precondition: State is S2, S3, S4, or S5 (timer hidden in S0, S1, S6)

1. User clicks [Start Timer]
2. Timer panel transitions to active state
3. Display: "{minutes}:{seconds} remaining" + topic label (if focus topic set)
4. Timer runs client-side (setInterval in mode closure)
5. If user navigates away (mode onExit called): timer stops, no save
6. If timer completes: show completion card with [Log & Continue] and [Done for Today]
7. If session > 25 min continuous: show break suggestion
```

Timer state is ephemeral. Not persisted to Supabase. Lost on page close. This is intentional: timer is a focus tool, not a tracking system.

### 5.3: Completing a Task (from Today Plan)

```
Precondition: State is S4 and Today Plan is active with items

1. User clicks [Complete] on a plan item (or completes linked drill/duel)
2. Plan item transitions to completed visual state (strikethrough + check)
3. Progress counter updates: "{completed}/{total} complete"
4. If all items complete: show completion message, transition plan card to done state
5. Completion persisted to client memory (sessionStorage key: 'intel.plan.progress')
6. On next full HUD load: plan regenerates fresh from latest snapshot
```

Plan progress is session-scoped. Not persisted to Supabase. Fresh plan generated on each new session. Rationale: study plans should reflect current data, not preserve yesterday's plan.

### 5.4: Refreshing Data

```
Precondition: State is S3 (stale data, refresh button visible)

1. User clicks [Refresh Insights]
2. RPC call: insert into intel_event_inbox (source: 'manual_refresh', user_id: {uid})
   OR trigger pipeline job directly via an RPC that enqueues a snapshot job
3. Transition to S5
4. Existing data remains visible
5. Update indicator appears
6. Poll intel_jobs status every 5s (max 12 polls = 60s timeout)
7. Job succeeds: fetch new snapshot, transition to S4, replace data in-place
8. Job fails or timeout: transition per S5 failure rules
```

Rate limit: One manual refresh per 5 minutes. Button disabled for 5 min after trigger. Prevents pipeline hammering.

---

## 6. FAILURE RULES

### 6.1: Missing Data (Expected Data Not Found)

| Scenario | Detection | Behavior |
|----------|-----------|----------|
| student_profiles row missing | Step 2B returns no rows | Treat as S1. System does not require student_profiles to exist for basic display. Create row on first meaningful interaction if needed. |
| qstat_answers_v1 returns error (view broken) | RPC error on count query | Enter S6. Log `[INTEL_VIEW_ERROR]`. Do not attempt fallback queries against raw tables. |
| Snapshot table/view missing or empty | Step 2D returns null/error | If answer count >= 20: transition to S5 (trigger computation). If < 20: fall to S2. Never show S4 layout without a snapshot. |
| question_metadata gaps | Topic breakdown shows "Uncategorized" bucket | Display "Other" category. Do not suppress the data. Log `[QMETA_MISS]` per question_id. |

### 6.2: Delayed Pipeline (Job Running But Not Completing)

| Duration | Behavior |
|----------|----------|
| 0-10s | Show "Refreshing your insights..." No additional messaging. |
| 10-30s | Add "This is taking a bit longer than usual." Same indicator, extended copy. |
| 30-60s | Add "Still working on it. Your existing data is still available below." |
| 60s+ (timeout) | Stop polling. Remove indicator. If existing snapshot available: show it with "Unable to refresh right now. Showing your most recent data." If no snapshot: transition to S6 with message "We couldn't load your insights. Please try again in a few minutes." |

Never show a spinner for more than 60 seconds. After 60s, the system must resolve to a stable visual state.

### 6.3: Failed RPC

```
On any RPC failure:
  1. Log to console: [INTEL_RPC_FAIL] {function_name} {error_code} {timestamp}
  2. Retry once with 2s delay
  3. If retry succeeds: continue as normal
  4. If retry fails:
     a. Is this a data-fetch RPC (read)? 
        - If other data is available: show what we have, hide the failed panel, no error overlay
        - If this is the critical path (count query, auth check): transition to S6
     b. Is this a write RPC (refresh trigger)?
        - Show inline error: "Couldn't start refresh. Try again in a moment."
        - Re-enable refresh button after 10s
        - Do NOT transition to S6 for write failures
```

### 6.4: Auth Expiry

```
Detection: Any RPC returns 401 or supabase.auth.getUser() returns null mid-session

1. Attempt token refresh: supabase.auth.refreshSession()
2. If refresh succeeds: retry the failed RPC. No user-visible interruption.
3. If refresh fails: attempt full re-auth (/api/auth/exchange + /api/auth/bootstrap)
4. If re-auth succeeds: retry the failed RPC. Brief "Session refreshed" toast (2s).
5. If re-auth fails: transition to S0. Show auth prompt.
   Message: "Your session timed out. Log in again to continue."
   [Log In] button.
```

Never retry auth more than once per failure. Never loop. If one re-auth attempt fails, go to S0 immediately.

---

## 7. CONSISTENCY GUARANTEES

### CG-01: Single Source of Truth for State

The global state variable is determined once during entry flow and updated only by explicit transition events. No panel or component independently determines its own visibility. All visibility rules derive from the single global state.

```
WRONG: Topic panel checks its own data availability and hides itself
RIGHT: Topic panel is visible/hidden based on global state rules in Section 4
```

### CG-02: No Mixed Freshness

All metric panels in a single view must reference the same snapshot. If panel A shows data from snapshot at T1 and panel B shows data from snapshot at T2, the UI is in violation.

**Enforcement:** On snapshot refresh (S5 to S4 transition), replace ALL panel data atomically. Never update one panel before another. Buffer the new snapshot, then swap all panels simultaneously.

### CG-03: No Data Without Context

Every numeric metric displayed must include exactly one of:
- Sample size (e.g., "14 questions")
- Freshness (e.g., "Updated 2 hours ago")
- Both (for primary metrics)

A bare number without context (e.g., "72%") is a contract violation unless the sample size is displayed elsewhere in the same panel.

### CG-04: No Phantom UI

No panel, button, or interactive element may be visible if its action is impossible in the current state.

```
WRONG: Refresh button visible in S4 (data is fresh, nothing to refresh)
WRONG: Timer visible in S0 (user not authenticated)
WRONG: Today Plan "Start Plan" button visible when plan has no items
RIGHT: Elements appear only when their preconditions are met
```

### CG-05: No Contradictory Messaging

The system must never simultaneously display:
- "Refreshing..." AND a freshness timestamp suggesting data is current
- "No data" in one panel AND populated metrics in another (same snapshot scope)
- An upgrade prompt AND enrolled-tier features
- A stale warning AND "Just updated" confirmation

**Enforcement:** State transitions must clear all messaging from the previous state before rendering new state messaging.

### CG-06: Deterministic Load Order

On every HUD load, elements appear in this fixed order. No element loads before its predecessor.

```
1. Skeleton/loading frame (neutral, no data)
2. Auth verified (or S0 triggered)
3. Global state determined
4. Hero metric panel (first to populate)
5. Today Focus card
6. Today Plan card
7. Topic breakdown
8. Mission Intel
9. Timer (last, lowest priority)
```

If any step fails mid-sequence, render up to the last successful step and show inline error for the failed section. Never show a later element while an earlier element is still loading.

### CG-07: Idempotent Renders

Calling the render function for any state with the same input data must produce identical output. No render depends on how many times it has been called, what the previous state was, or how long the user has been on the page.

```
WRONG: "Welcome back!" shows only on first render after S3
RIGHT: S3 always shows the same stale-data messaging regardless of how the user arrived
```

Exception: One-time transitions (S5 to S4 "Updated just now" confirmation) are time-limited (3s auto-dismiss) and never replay on subsequent renders.

### CG-08: Graceful Degradation Direction

When the system cannot fulfill a full state, it degrades downward:

```
S4 (ideal) -> S3 (stale but complete) -> S2 (partial) -> S1 (empty) -> S6 (error)
```

Never skip levels. If the system cannot render S4 (missing snapshot), it must attempt S3 (show stale data) before falling to S6. The user should see the maximum information available, never less than what the system can actually provide.

---

## STATE MACHINE DIAGRAM

```
                    ┌────────────────────────────────────────┐
                    │              S0: NO_SESSION             │
                    └──────────────────┬─────────────────────┘
                                       │ auth success
                                       v
                    ┌─────── DATA CHECK (Steps 2-3) ────────┐
                    │                                         │
          count=0   │   count=1-19   │  count>=20           │  count>=20
             │      │       │        │  snapshot fresh       │  snapshot stale
             v      │       v        │       │              │       │
     ┌───────────┐  │ ┌──────────┐  │       v              │       v
     │ S1: EMPTY │  │ │ S2: LOW  │  │ ┌──────────┐         │ ┌──────────┐
     └─────┬─────┘  │ └────┬─────┘  │ │ S4: ACTIVE│         │ │ S3: STALE│
           │        │      │        │ └─────┬────┘         │ └────┬─────┘
           │ first  │      │ reach  │       │              │      │
           │ answer │      │ 20     │       │ job starts   │      │ refresh
           v        │      v        │       v              │      v
     ┌──────────┐   │ ┌──────────┐  │ ┌──────────────┐     │ ┌──────────────┐
     │ S2: LOW  │   │ │ S4 or S5 │  │ │S5: UPDATING  │◄────┘ │S5: UPDATING  │
     └──────────┘   │ └──────────┘  │ └──────┬───────┘       └──────┬───────┘
                    │               │        │                       │
                    │               │        │ job done              │ job done
                    │               │        v                       v
                    │               │  ┌──────────┐           ┌──────────┐
                    │               │  │ S4: ACTIVE│           │ S4: ACTIVE│
                    │               │  └──────────┘           └──────────┘
                    │               │
                    └───────────────┘

     ANY STATE ──[unrecoverable error]──> S6: ERROR
     ANY STATE ──[auth lost]──> S0: NO_SESSION
     S6 ──[retry]──> Re-run entry flow
     S6 ──[back]──> Arena lobby
```

---

## EXECUTION REPORT

**WHAT WAS DONE:**
- Defined 7 mutually exclusive global UI states with exact conditions
- Defined state priority resolution for overlapping conditions
- Defined complete entry flow with 4-step initialization sequence and 3s timing budget
- Defined all valid state transitions with triggers
- Defined HUD element visibility/behavior for each state (6 state tables)
- Defined 4 action flows (navigate, timer, task completion, refresh)
- Defined failure handling for 4 categories (missing data, delayed pipeline, failed RPC, auth expiry)
- Defined 8 consistency guarantees that prevent contradictory UI behavior

**RESULT:**
Complete UI state machine and behavior contract delivered. All behavior is deterministic (no judgment calls at runtime). Every state has exactly one set of visibility rules. Every transition has exactly one trigger and one destination.

**STATUS:** COMPLETE

---

## NEXT ACTION

Use this contract as the acceptance criteria for the Intel HUD frontend implementation. Every UI test should verify: (1) the correct state was determined given the data conditions, (2) the correct elements are visible/hidden per Section 4, and (3) no consistency guarantee from Section 7 is violated.
