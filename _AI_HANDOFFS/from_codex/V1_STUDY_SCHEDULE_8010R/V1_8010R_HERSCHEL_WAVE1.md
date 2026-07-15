# V1-STUDY-SCHEDULE-8010R Implementation Map

Read-only discovery completed. No files were edited and no tests or generators
were run by Herschel.

## Baseline and concurrent work

- Worktree: `/Users/brianb/MissionMed_worktrees/V1-StudySchedule-8010A`
- Branch: `codex/v1-study-schedule-8010a`
- Accepted foundation begins at the V1-8010A commits on the D9 source-recovery
  base.
- The current dirty 8010B work modifies Calendar and Study and adds three PHP
  fixtures. It is provisional until supervisor verification.

Treat committed `HEAD` as the ownership baseline and preserve the dirty diff.

## Bootstrap, routing, and assets

- `wp-content/plugins/missionmed-hub/missionmed-hub.php` is the plugin
  bootstrap. Matrix runtime is gated by `mmed_student_os_enabled`, default
  false. Student OS, REST, Calendar, and Study classes are conditionally loaded.
- `includes/class-mmed-hub-page.php` recognizes the shell and renders
  `MMED_Student_OS::render_shell()`.
- `templates/student-os-shell.php` emits `window.MMED_OS`, REST base `mmed/v1`,
  and the WordPress REST nonce.
- `includes/class-mmed-student-os.php` enqueues the immutable
  `assets/student-os.646e3598d284fff3.js`, builds module/access bootstrap, and
  currently exposes `study` merely because the legacy Study class exists.
- `assets/student-os.js` is source and
  `assets/student-os.646e3598d284fff3.js` is the protected artifact; current
  bytes are identical. `#study` remains a generic legacy route using
  `/study-blocks`. Non-admin access comes from `module_permissions.study`, with
  a client-side admin bypass.

The clean 8010C seam is a dedicated Study bootstrap/controller that registers
from the plugin bootstrap, resolves fail-closed entitlement and mode on the
server, augments the Student OS bootstrap with safe V1 state, and enqueues a tiny
content-hashed loader after the Student OS runtime. The loader must register V1
before `DOMContentLoaded` and no-op while hidden.

There is no current filter for permission/bootstrap augmentation. A narrow
protected touch to `class-mmed-student-os.php` is therefore unavoidable. Do not
emulate entitlement with user meta or casually edit the large runtime bundle.

## REST ownership

`includes/class-mmed-rest-api.php` owns namespace `mmed/v1`.
`/study-blocks` delegates to legacy `MMED_Study_Schedule` and its permission
callback is only `is_user_logged_in()`. Generic `/events` Calendar CRUD is also
broadly available to logged-in users.

V1 needs a separate Study-owned REST controller and versioned namespace backed
only by V1 command/query services. The accepted evidence does not yet fix the
physical namespace string.

## 8010B containment boundary

Legacy ownership is limited to:

- `includes/class-mmed-study-schedule.php`
- narrow internal enforcement in `includes/class-mmed-calendar-engine.php`

The provisional work adds forced private audience, owner and `study_block` type
enforcement, metadata preservation, optimistic state checks, disabled admin
fallback for strict operations, 404/409 outcomes, and fixture coverage.
Calendar is heavily shared, so containment must remain opt-in/internal and may
not alter generic event semantics.

## Shared Calendar writers and consumers

Direct or indirect writers include Calendar, Study Schedule, REST API, Calendar
Enrollment, SSA Adapter, Interview Prep, and Session Manager. Readers also
include attendance, session chat/reminders, Arena Live, enrollment, Session
Manager, and Study.

The Calendar schema does not declare `source_group_id`, although other classes
read and write it. This reinforces that Calendar cannot become the V1 Plan
store.

## Persistence boundary for 8010C/8010D

The current store is `$wpdb->prefix . 'mmed_events'`, installed with `dbDelta`.
No V1 Plan store, repository, migration runner, or WordPress/InnoDB integration
harness exists. Diagnostic `study_plans/tasks`, Calendar events, and unapproved
Supabase surfaces are forbidden as Plan truth.

V1 requires additive Plan-owned InnoDB tables behind one repository; only its
command service/repository may write. Calendar, Admin, Session, Courses, Arena,
and legacy Study must have no V1 write path.

8010D must prove isolated synthetic transactionality for first operation/import
plus watermark, migration locking/restart, injected-failure recovery,
backup/restore, constraints, ownership isolation, current/N-1 reader, and
non-destructive rollback.

## Entitlement

`class-mmed-access-gate.php` is too broad: any configured LearnDash enrollment
qualifies, administrators receive full access, and user meta can override
modules.

The strongest existing evidence provider is
`wp-content/mu-plugins/missionmed-hq-auth-handoff.php`, especially
`mmhq_cam_build_entitlement()`, which evaluates LearnDash/Woo state,
currentness, revocation, and trust. V1 can consume it through a dedicated
fail-closed adapter but must not inherit an administrator mutation bypass.

## Deployment and protected runtime

The worktree's `_SYSTEM/deploy.sh` is an old R2 HTML path and is invalid for this
plugin. Canonical controls are:

- guard: `/Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py`
- manifest: `/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`
- production alias: `missionmed-kinsta`
- plugin root: `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`
- backups: `/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/<ticket>/<stamp>`

New V1 controller, REST/bootstrap classes, entitlement adapter, loader, assets,
CSS, and rollback-reader descriptors are absent from the guard manifest and
must be registered with immutable hashes and route-regression evidence before
deployment. A content-hashed loader without a query version avoids the global
version-stripping behavior in `missionmed-performance-boost.php`.

## Rollback boundaries

- 8010B, 8010C, and 8010D remain separate tested commits or stacked PRs.
- Source rollback reverts only the relevant accepted slice.
- Before a V1 watermark, V1 may be disabled and legacy mutation can resume.
- After a watermark, legacy mutation must never resume: deny both writers, keep
  the V1 current/N-1 read path, snapshot Plan data, and disable adapters.
- Persistence rollback is additive and restartable; never drop Plan tables or
  data.
- Protected runtime rollback restores only guard-captured files.

## Direct blockers

1. The provisional 8010B work requires independent integration verification.
2. No isolated WordPress/InnoDB harness or migration runner exists for 8010D.
3. The V1 REST namespace and physical Plan table names remain undecided.
4. Eligible and ineligible 360 entitlement behavior is unverified.
5. New V1 files are absent from the runtime guard, blocking deployment but not
   synthetic source work.
6. Privacy/legal approval blocks real learner and production use, not synthetic
   8010B-8010D work.
7. This worktree lacks current Matrix lock contracts; canonical contracts and
   tools must be read from `/Users/brianb/MissionMed`.
