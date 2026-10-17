# P1-RISE-4006 Verified Starting State

## Recovery

The run resumed the latest verified RISE lineage instead of restarting it.

| Item | Verified state |
| --- | --- |
| Canonical repository | `/Users/brianb/MissionMed/missionmed-hq` lineage |
| Safe production worktree | `/Users/brianb/MissionMed_worktrees/P1-RISE-4006-production` |
| Branch | `codex/p1-rise-4006-production` |
| Starting HEAD and upstream | `54d0090b35340180bdc6699ff9131c9268840e22` |
| Core implementation ancestor | `8549c84` (`feat(rise): isolate service and private data planes`) |
| Default branch | `origin/main` at `9c1fa72` |
| Existing draft PR | [#15](https://github.com/brinyu13/missionmed-hq/pull/15) |

The older `/Users/brianb/MissionMed_worktrees/P1-RISE-4006` checkout contained unrelated local changes and was left untouched.

## Starting Engineering Baseline

- The isolated `rise/` package installed reproducibly with its own lockfile.
- Core suite: 71/71 passing.
- Browser suite: 26/26 passing against a conspicuously synthetic fixture.
- Prior web build: `rise_web_cc8f346c0ac1`.
- Proposed migrations 001 and 002 existed, but no dedicated production database, policies, backup, or owner approval existed.
- The server had a local preview and a generic injected-auth boundary, but no concrete HQ adapter, shared abuse adapter, production artifact bootstrap, activation receipt, keyed audit identity, or source-evidence activation guard.
- Matrix, ACTN, CAM, StoryForge, operator writes, and matching were prose-described or deliberately disabled rather than production-connected.

## Data State

The source inventory was a dated 31-specialty workbook snapshot, not an authorized production feed:

- 6,346 raw specialty-tab rows;
- 6,345 active specialty memberships;
- 1 quarantined stale or malformed duplicate observation;
- 6,139 normalized unique program identifiers;
- 206 additional combined-program browse projections;
- 31 specialty tabs.

The FREIDA authorization pin in `rise/config/dataset.v1.json` was and remains `null`. Residency Explorer also requires a separate AAMC authorization. The workbook was therefore blocked before inspection for a real release.

## Live and Authority Baseline

On July 22, 2026:

- `https://missionmedinstitute.com/rise/` returned 404;
- `https://missionmed-hq-production.up.railway.app/rise` returned 404;
- `https://cdn.missionmedinstitute.com/html-system/LIVE/rise.html` returned 404;
- no RISE Railway service, edge route, active artifact, dedicated database, or live build identifier was found;
- MissionMed OS `f197c54a9d5b062fa3c8e773bc19c64de9dba6cb` had no canonical RISE registration.

## Baseline Classification

The recovered system was an **offline, fail-closed, synthetic-review candidate**. It was not staging, not production-connected, and not production-live. That boundary governed every subsequent change.
