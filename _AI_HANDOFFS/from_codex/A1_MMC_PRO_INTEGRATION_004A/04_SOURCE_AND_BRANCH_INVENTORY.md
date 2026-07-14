# 04 — Source and Branch Inventory

RESULT: `MMC_SOURCE_FAMILIES_AND_BRANCH_RELATIONSHIPS_ACCOUNTED_FOR`

## Canonical target and controls

| Source | Observed state | Role in Goal 004A |
| --- | --- | --- |
| Active `A1-MacAirMMCMentorIntelligence-004` worktree | Branch/upstream exact at starting SHA `41a2dfb` | Authorized integration target |
| Canonical `/Users/brianb/MissionMed` checkout | Same shared Git store; independently dirty | Read-only repository evidence; never synchronized over target |
| `A1-MacAirMMCMentorIntelligence-005` | Clean `origin/main` control at `9c1fa72` | Read-only current-main comparison |
| Incoming archive and fresh quarantine | Exact verified archive; owner-only extraction | Historical source and byte-verification authority |
| `MissionMed-Webex` | Historical Webex branch/worktree | Protected reference only |
| Scheduler/Webex booking worktrees | Diverged implementation evidence | Protected reference only |
| Matrix/Scheduler/Calendar production sources | Runtime-lock and known-good governed | Protected reference only; no import or mutation |

The active worktree and canonical checkout share `/Users/brianb/MissionMed/.git`. Isolation is supplied by the dedicated branch and worktree, not by a separate repository clone.

## Branch and ref relationships

- Target and upstream at Goal 004A start: `a1-macair-mmc-mentor-intelligence-004` / `origin/a1-macair-mmc-mentor-intelligence-004`, both `41a2dfbbdf5e42eec1b6f2b0179af752d5c03551`.
- `origin/main`: `9c1fa72e6b056db8b6fe0e17031fcaa688f78569`.
- Common ancestor: `5cc9144bfc770e5eda78124cc1fa886640041767`.
- Divergence: 13 commits unique to the target and 13 unique to `origin/main`.
- A synthetic merge-tree inspection identified nine conflicts: the activity log, four private-MMC UI files, two USCE route files, `missionmed-hq/server.mjs`, and the private-mount validator. Main also contains shared governance/launch work not owned by MMC. No wholesale main merge was authorized or performed.
- The Air bundle advertises 324 refs: 168 heads, 45 remote-tracking refs, 9 tags, 97 worktree refs, 2 Codex refs, 1 stash, 1 main-worktree ref, and HEAD.
- Prompt 004 imported only the 168 head tips to isolated `old-laptop/*` remote-style refs. All 168 exist and match exactly; tags, stashes, worktree refs, remotes, Codex refs, and HEAD were not mapped over local state.
- Relevant historical tips include the report-only Air archive branch `b5536ab`, the private-route chain ending `7b55f04`, and the shared Pro/Air MMC-019 commit `1be8a3d`.

## Archive source inventory

The archive's four worktree-export families contain 221 source payload files verified by their per-worktree manifests:

| Export family | Verified payload rows | Treatment |
| --- | ---: | --- |
| MMC canonical-discovery worktree | 215 | Primary Air MMC implementation/history source |
| Canonical MissionMed checkout | 2 | One MMC architecture record plus protected system evidence |
| Claude prototype worktree | 2 | Historical prototype/evidence only |
| Live-source reconciliation worktree | 2 | Unrelated/protected evidence only |

The Air change-origin matrix is broader than those unique payload rows because it records tracked, dirty, untracked, and duplicate-observation states: 255 rows across four source worktrees. Every row has a final treatment in the Goal 004A change-origin matrix.

## Current repository MMC source families

The canonical engineering baseline spans:

- `missionmed-hq/server.mjs` for guarded route registration and shared-runtime integration;
- `missionmed-hq/routes/mmc-coaching-pipeline.mjs`;
- worker, student-resolution, roster-verification, and Webex-triggered-pull libraries under `missionmed-hq/lib/`;
- the versioned coaching-analysis prompt;
- `missionmed-hq/public/mmc-private/` and the synthetic partner demo;
- deterministic `missionmed-hq/tests/mmc-*` validators;
- `mmc-v1-core/` as historical fixture/oracle rather than deployed runtime;
- MMC migrations and validation snippets as unapplied schema/RLS evidence;
- Prompt 004 reports plus Goal 004A numbered reports as current migration evidence.

## Historical document inventory

The public-safe historical manifest has 188 byte-unique rows:

- 174 Codex MMC reports;
- one master architecture document;
- two Cowork architecture/UX documents;
- one Claude MMC prototype report;
- ten export-provenance and migration-safety documents.

Raw bodies remain in the verified local archive/quarantine. Five unrelated ACTN gate reports, a stale global knowledge index, system logs, generated cache, secret-excluded tests, and unrelated Arena/Scheduler/Calendar/WordPress/deployment artifacts are intentionally absent from the public branch.

## Inventory conclusion

The target branch, main control, canonical checkout, Air archive, imported refs, relevant runtime families, protected references, and public-safe historical corpus are all identified. No source requires another read from the MacBook Air, and no broad branch merge or repository replacement is needed.
