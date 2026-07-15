# V1 Study Schedule — Current State Report

## Product identity ledger

| Field | Value |
|---|---|
| Product | **V1 Study Schedule** |
| Purpose | Learner academic study planning and execution |
| Historical aliases | Matrix Plan; Study Schedule; Study Scheduler; D9 Matrix Plan |
| Not this product | MissionMed Scheduler; Appointment Scheduler; Calendar; Webex Scheduler |

Every file containing “scheduler” was classified by content. Appointment,
Calendar, Webex, and session-booking assets were excluded except where their
shared runtime or data behavior directly touches `study_block`.

## Repository state

- Repository: `https://github.com/brinyu13/missionmed-hq.git`
- Worktree: `/Users/brianb/MissionMed_worktrees/V1-StudyScheduler-8000`
- Branch: `codex/v1-study-schedule-8000`
- Starting/source-base HEAD: `d4455bf4ee401eaa8b074603497eb9fcd6eb04a0`
- `origin/d9-matrix-plan-415-source-recovery`: exact same commit
- `origin/main`: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`
- Recovered source-base relationship: `origin/main...d4455bf` is zero commits
  left and six right; its merge base is `origin/main`. The later handoff-only
  publication commit is deliberately excluded from this source metric.
- Tracked files modified before reporting: zero.
- Staged files: zero.
- Permitted untracked state: this reconciliation handoff only.

## Authority-state separation

| Layer | Exact state | Use |
|---|---|---|
| MissionMed_OS working tree | Local `main` dirty with 19 status entries; preserved untouched | Not current run authority |
| MissionMed_OS local HEAD | `72b48e54f5b009ca17cb37c143e7d3c8afb1ef02`; zero ahead, 11 behind fetched remote | Local historical state |
| MissionMed_OS fetched authority | `origin/main` `714443573c41e7a04e4241e67244c334787e1bed` read directly | OS routing/registry authority for this run |
| V1 application-source base | `d4455bf4ee401eaa8b074603497eb9fcd6eb04a0` | Recovered implementation foundation |
| D9-415 production snapshot | Identical T0/T1 at `2026-07-14T00:31:00.453619187Z` / `2026-07-14T00:31:03.315562100Z` | Point-in-time provenance only |
| Present public observation | `2026-07-15T00:23:41Z`–`00:23:42Z` | Two asset hashes, dashboard 302, REST 401 only |

## Current implementation

The current repository contains a **legacy Study panel**, not V1 Study Schedule:

1. `missionmed-hub.php` loads `class-mmed-study-schedule.php`.
2. `MMED_Student_OS` registers route key `study` with the label “Study Schedule.”
3. The active hashed Student OS bundle renders a daily timeline and seven-day
   chooser.
4. The client calls `/wp-json/mmed/v1/study-blocks`.
5. `MMED_Study_Schedule` translates those payloads into Calendar engine events
   with `event_type=study_block`.
6. Source defines the Calendar engine's shared event table as the persistence
   layer; D9-410 and this run did not verify that the live table or Study rows
   exist.

Observed capabilities in source are list, create, drag/move, resize, and
completion toggle. The UI has no complete edit/delete flow and no V1 domain.

## Access and route state

- The Study module is absent from the Student OS temporary-open route list.
  Recovered source populates explicit permissions only for StoryForge and CAM,
  so **every non-admin is source-proven locked** before enrollment/free-module
  checks. Authenticated live behavior remains unverified.
- The REST routes use the shared `can_access` callback, which is only
  `is_user_logged_in()`. Client lock and server authorization therefore do not
  describe the same population.
- Anonymous production GET to the REST route returned 401, as expected.
- Anonymous navigation to `/member-dashboard/` returned 302 to WordPress login.
- A browser check of `/member-dashboard/#study` also reached login. No credential
  was submitted and no authenticated Study route was verified.

**Current production route: NONE VERIFIED.** The only route candidate is the
source-inferred legacy `/member-dashboard/#study`.

## Current defects with production consequence

- Update and delete delegate a numeric ID to generic Calendar mutation without
  first proving `event_type=study_block`.
- The shared soft-delete path returns `deleted=true` without checking whether the
  database update succeeded.
- Completion-only update replaces the event metadata object rather than merging
  it, which can erase subject or future fields.
- No revision, transaction, idempotency, version, tombstone, series, overlap, or
  fixed-anchor enforcement exists.
- Naive datetime conversion creates timezone and DST ambiguity.
- Timeline coverage is 07:00–23:00 rather than the intended 06:00–24:00.
- Range fetching and display boundaries are inconsistent.
- Multiple blocks are stacked within coarse hour rows; cross-midnight layout is
  not faithful.
- Clickable article blocks do not supply full keyboard semantics; the resize
  affordance is smaller than a robust touch target.
- Calendar v4, Admin OS, and Session Manager also recognize or write
  `study_block`, creating a future dual-writer hazard.

## Prototype state

The D9-100 through D9-360 corpus is substantial: 75 files and 2,006,500 bytes.
D9-300 was rendered and confirmed to express the canonical CAM/Timeline language.
D9-350 and D9-360 suites pass in their prototype environment. None of these
self-contained HTML/local-state prototypes is production implementation.

D9-360 rendered at desktop, tablet, and mobile without horizontal document
overflow, but manual checks found a clipped/overlapping focus-within popover and
a fixed bottom navigation that overlays content and clips visible destinations
at smaller widths. Its self-authored 9+ scores are therefore not accepted as an
independent quality gate.

## Runtime and authority drift

- Active served hashed Student OS asset SHA-256:
  `646e3598d284fff31d22dec98c70c1800e74743276872bb65f1afeeda1c17e5a`,
  exact match to source.
- The public unversioned `student-os.js` is a different stale object:
  `6b3ad4ea933f61c28da266a7260851b3c0af69b8e09a7df08ff5485718f9948c`.
  The recovered controller source references the hashed asset, so this is cache
  hygiene evidence and a source-inferred delivery path, not current proof that
  the stale file does or does not execute.
- The local Matrix runtime guard matched its protected source inputs except the
  recovered Student OS controller, whose source hash is `23da5c...` while the
  manifest names an older approved hash. This does not verify current live PHP.
  Brian explicitly approved the read-only lock override for this mission and
  `class_mmed_student_os_php`.
- That guard result covers only declared inputs. The global lock inventories
  unversioned `assets/student-os.js`, not the active
  `assets/student-os.646e3598d284fff3.js`; the product-repository Matrix passport
  is stale and omits the active hashed path too. The override does not close
  this coverage gap. V1-8010A must pin controller, hashed bundle, unversioned
  source twin, and cache-delivery behavior as one governed descriptor.
- An earlier startup preflight proved a zero-byte MissionMed_OS Git index lock
  stale and removed only that lock; the resumed run observed it absent.
  MissionMed_OS local file changes were preserved untouched. Its local `CURRENT.md`
  and registry are not V1 authority; fetched `origin/main` was read directly and
  contains no registered V1 mission.

## Readiness conclusion

Product and prototype authority are recoverable. Source authority is recovered.
Data, entitlement, integration ownership, staging, deployment, and production
acceptance are not. V1-8010 must begin with authority locks and safety
characterization. Initial rollout is default-off, but post-cutover rollback
requires distinct exposure/write/reader modes rather than one boolean flag.
