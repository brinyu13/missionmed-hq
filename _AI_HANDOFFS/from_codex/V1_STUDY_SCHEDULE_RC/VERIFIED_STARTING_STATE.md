# V1 Study Schedule — Verified Starting State

Verified: 2026-07-22  
Ticket: `V1-STUDY-SCHEDULE-RC`

## Verdict

The highest fully green authority is `458f93b`. The newest implementation parent, `f91a2d7`, contains the unbound E3 owner arbiter but began this continuation with 17 of 21 PR jobs green. It was not a release candidate until its stale 8010C isolation assertion was repaired and reverified.

## Repository and worktrees

- `/Users/brianb/MissionMed_worktrees/V1-StudyScheduler-8000`: clean reconciliation checkout at `c988666`; not an implementation root.
- `/Users/brianb/MissionMed_worktrees/V1-StudySchedule-8010A`: preserved donor/evidence checkout at stale local HEAD `bafd2f1`, with five tracked modifications and 99 untracked files.
- `/Users/brianb/MissionMed_worktrees/V1-StudySchedule-RC`: clean isolated continuation created from `f91a2d7` on `codex/v1-study-schedule-production-connected-rc`.

No existing dirty worktree was reset, stashed, cleaned, rewritten, or used as an implicit authority.

## GitHub evidence

Draft PR #14 is open against `codex/v1-study-schedule-8010a`. At `f91a2d7`, four jobs failed and seventeen passed. The four failures were the PHP 7.4 and 8.3 pure jobs in both the 8010C and 8010E workflows. All failed on the same source assertion in `tests/php/v1-study-schedule-8010c-contract.php`: the test globbed every future V1 class while the intentionally unbound E3 owner arbiter names the Calendar table.

Physical MySQL 8 and MariaDB 10.11 E3 lanes, containment, 8010D, loader, and WordPress integration lanes passed at that head. Earlier exact commit `458f93b` had all 21 recorded jobs green and is the rollback base.

The initial RC repair narrows only that stale assertion, exempts exactly `class-mmed-v1-study-owner-arbiter.php`, and positively proves that neither its filename nor class appears in `missionmed-hub.php`. Local containment, 8010C, 8010D, 8010E pure, and JavaScript loader suites all pass after the repair.

## Protected runtime

Fresh canonical Matrix preflight against the RC worktree passed with local, origin, public, and approved bytes aligned.

- Matrix base JavaScript: `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a`
- Matrix controller: `5ed6e92eb9bf748a01f475bc5a6a72e249e21a2b7560d07d2acf66f8058e8d95`
- Manifest observed SHA-256: `a357d5650e8523350d2842771cf2fd9080e117c72293d93d31dffb73f9bf396f`

No stale Matrix runtime warning exists at the starting state.

## Implemented boundary at `f91a2d7`

- Legacy Matrix `#study` still renders through `student-os.js` and the Calendar-backed `mmed/v1/study-blocks` flow.
- V1 domain, release, access, observability, read-only bootstrap REST, and inert loader are plugin-bound and default-hidden.
- Generation-2 schema, migrator, physical reader, Week domain, command writer, recovery proofs, restore census, and owner arbiter exist only as synthetic/unbound source.
- No V1 Week endpoint, command endpoint, production actor adapter, commit authorizer, commissioned store, visible V1 client, or V1 Matrix mount owner exists.

## Design authority

The intended complete experience is the D9-360 prototype:

`/Users/brianb/MissionMed/_AI_HANDOFFS/from_cowork/D9_MATRIX_STUDY_SCHEDULER_360/D9_360_MATRIX_PLAN_FINAL_PERFECTION_PROTOTYPE.html`

Observed SHA-256: `3932492723fb031942603724cda1d1d80418d1e0f230f6916824e2257fbe8dd5`.

It is a design and behavior donor, not production code. It uses seeded data, prototype-only claims, external fonts, and client-local state and therefore cannot be shipped unchanged.

## Starting limitations

- Decision 12 remains HOLD.
- No real-data retention/privacy policy is approved.
- No production source-owner promotion into `main` is proven; the V1 PR stack is draft and predecessor-based.
- No deployment or production verification is authorized by this mission.
- Browser, screen-reader, responsive, performance, security, rollback, and Founder taste gates remain open.

