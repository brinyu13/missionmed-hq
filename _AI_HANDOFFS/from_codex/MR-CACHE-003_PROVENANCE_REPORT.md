# MR-CACHE-003 Provenance Report

RESULT: PARTIAL

MR-CACHE-003 identified exact live provenance for Arena, Daily, and Drills, and identified the exact deployed STAT snapshot/report lineage. The remaining unresolved item is STAT git-object provenance: the live STAT artifact matches a local verification/report snapshot and activity log deployment record, but no matching local git object was found across scanned refs/history.

## 1. Scope And Safety

- Worktree used: `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001`
- Required branch used: `mr/cache-coherence-repair-001`
- Deploys performed: none
- Purges performed: none
- Commits performed: none
- Pushes performed: none
- Runtime HTML modified: none
- Auth, Supabase, Railway, WooCommerce, LearnDash, Postmark/Gmail, student data, and database state modified: none
- Computer Use: not used for this read-only provenance pass
- Credentials/secrets: not inspected, printed, copied, stored, or used

## 2. Mandatory Preflight

- `pwd`: `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001`
- Starting branch: `mr/cache-coherence-repair-001`
- Ending branch: `mr/cache-coherence-repair-001`
- Starting status:
  - `?? VALIDATION/live_state_report.mjs`
  - `?? VALIDATION/validate_live_state.sh`
  - `?? _AI_HANDOFFS/`
  - `?? _SYSTEM/purge_runtime_cache.sh`
- Ending status:
  - `?? VALIDATION/live_state_report.mjs`
  - `?? VALIDATION/validate_live_state.sh`
  - `?? _AI_HANDOFFS/from_codex/MR-CACHE-002_CACHE_COHERENCE_REPORT.md`
  - `?? _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_EVIDENCE.json`
  - `?? _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_EVIDENCE.md`
  - `?? _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_STRICT.md`
  - `?? _AI_HANDOFFS/from_codex/MR-CACHE-003_PROVENANCE_REPORT.md`
  - `?? _SYSTEM/purge_runtime_cache.sh`
- Dirty state decision: continued read-only because the dirty files were MR-CACHE-002 validation tooling/report artifacts.
- `git diff --name-status`: no tracked file diffs at preflight
- Remote: `origin https://github.com/brinyu13/missionmed-hq.git`
- HEAD at start: `7409a82f056b58335e996dda7e101c310c982f1f` (`Fix Arena STAT lobby mode metadata and fallback copy`)

## 3. Files Inspected

- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/_SYSTEM/PRIMER_CORE.md`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/_SYSTEM/SESSION_PRIMER_V2.md`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/_AI_HANDOFFS/from_codex/MR-CACHE-002_CACHE_COHERENCE_REPORT.md`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/_AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_EVIDENCE.md`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/_AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_STRICT.md`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/VALIDATION/validate_live_state.sh`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/VALIDATION/live_state_report.mjs`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/_SYSTEM/deploy.sh`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/_SYSTEM/DEPLOY_MANIFEST.json`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/_SYSTEM/PRIMER_EXT_HTML_DEPLOY.md`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/wp-content/mu-plugins/arena-route-proxy.php`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/wp-content/mu-plugins/stat-route-proxy.php`
- `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/wp-content/mu-plugins/drills-route-proxy.php`
- `/Users/brianb/MissionMed/_REPORTS/ARENA-LOGIN-RECOVERY-001_STAT_DUEL_PACK_GUARD_2026-05-03.md`
- `/Users/brianb/MissionMed/_REPORTS/stat_live_verify_20260503221506.html`
- `/Users/brianb/MissionMed/_REPORTS/WIRING_FINAL_MD-Daily-Drills-MergedMode-008B.md`
- `/Users/brianb/MissionMed/_REPORTS/WIRING_FINAL_MD-Daily-Drills-MergedMode-008C.md`
- `/Users/brianb/MissionMed/_REPORTS/MD_DAILY_DRILLS_WIRING_HANDOFF_PACKET_007.md`
- `/Users/brianb/MissionMed/_REPORTS/WIRING_AUDIT_S9_STAT_ADVANCED_2026-05-04.md`
- `/Users/brianb/MissionMed/_SYSTEM_LOGS/MM_ACTIVITY_LOG.md`
- `/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl`
- `/Users/brianb/MissionMed/CHANGELOG/CHANGELOG.md`
- `/Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-current-arena-repair/_AI_HANDOFFS/from_codex/AV3-002-g_authenticated_locker_validation_report.md`
- Candidate HTML files across `/Users/brianb/MissionMed`, `/Users/brianb/MissionMed_worktrees`, `/Users/brianb/MissionMed_WORKTREES`, `/Users/brianb/MissionMed_Worktrees`, and MissionMed report/backup directories

Requested but not found in this worktree:

- `MISSIONMED_MASTER_KNOWLEDGE.md`
- `KNOWLEDGE_INDEX.md`

## 4. Files Modified

- Created this report only: `/Users/brianb/MissionMed_worktrees/cache-coherence-repair-001/_AI_HANDOFFS/from_codex/MR-CACHE-003_PROVENANCE_REPORT.md`

No validation tooling was patched. No runtime files were touched.

## 5. MR-CACHE-002 Evidence Summary

Strict validation failed all four canonical routes as `SOURCE/DEPLOY MISMATCH`:

| Route | Local expected SHA256 | Live CDN SHA256 | MR-CACHE-002 finding |
|---|---:|---:|---|
| `/arena` | `2d8eebdd261a450de9eb36f84e07de38cb9506a8f7c5f151cc60d70c91379834` | `6994ede872996d3e5753d7072404b72387513d19a84f19056a862540dbc379eb` | CDN matched another branch artifact |
| `/stat` | `350108cc24edd44c885061aa084763e7613102cf3c41eb8e8d8c324242c08d75` | `e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048` | CDN did not match current branch |
| `/daily` | `aa7b7ff42f51f85c8af6b8953eac26c65f75c223818706fb08818a47df49e5af` | `a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e` | CDN matched another branch artifact |
| `/drills` | `cd79a2f1c822214643f58347fe8abd0fe5cfc0342caa39523a56fb81fb2ad91d` | `a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01` | CDN matched another branch artifact |

MR-CACHE-002 also proved this is not simple CDN edge staleness:

- Direct CDN normal and cache-busted responses returned identical body hashes.
- Direct CDN headers included `cache-control: no-cache, no-store, must-revalidate` and `cf-cache-status: DYNAMIC`.
- WordPress wrapper routes proxied the same deployed CDN artifacts.
- WordPress wrappers were therefore not the primary stale layer for the current mismatch.

## 6. Provenance Search Method

Read-only searches checked:

- all local git refs and HTML history for exact SHA256 matches
- current worktrees under MissionMed worktree roots
- report directories under `_REPORTS/`
- handoffs under `_AI_HANDOFFS/`
- system logs under `_SYSTEM_LOGS/`
- backup/live verification HTML files
- deploy and handoff reports containing route hashes or source commits

The broad exact-hash scan output was kept outside the repo at `/tmp/mr-cache-003-provenance-scan.json` for local working evidence only.

## 7. Per-Route Provenance Table

| Route | CDN URL | Live artifact | Exact provenance found | Classification | Risk | Recommended reconciliation |
|---|---|---|---|---|---|---|
| `/arena` | `https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html` | `6994ede872996d3e5753d7072404b72387513d19a84f19056a862540dbc379eb` | Git commit `138d1e3be8e5ab04d002482c23e4a7661bbacbda` on `av3/profile-locker-v3-current-arena-repair-002-g`; file match at `/Users/brianb/MissionMed_worktrees/av3-profile-locker-v3-current-arena-repair/LIVE/arena.html`; AV3 report confirms repaired version `2026-05-08 12:25 AV3-002-g-current-arena-repair` | `SAFE CURRENT` for live production evidence, but `SOURCE/DEPLOY MISMATCH` in this worktree | HIGH | Preserve live artifact. Reconcile source by porting/merging the AV3 repair commit into the canonical branch after Brian review. Do not redeploy this worktree's `LIVE/arena.html`. |
| `/stat` | `https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html` | `e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048` | Exact file match at `/Users/brianb/MissionMed/_REPORTS/stat_live_verify_20260503221506.html`; STAT addendum and activity log record direct R2/CDN promotion of `LIVE/stat.html` for `2026-05-03 22:12 STAT_DUEL_PACK_HYDRATION_GUARD`; no exact git object found | `LIVE FROM BACKUP/UNTRACKED FILE` | HIGH | Create a route-specific STAT reconciliation branch. Import or reconstruct the deployed STAT artifact, review diff against current `LIVE/stat.html`, and commit before any future redeploy. Do not redeploy this worktree's `LIVE/stat.html`. |
| `/daily` | `https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html` | `a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e` | Git commit `5c19f4a6a90fcb1a92f75c674f4c908aa8b4a01c` on `md-daily-drills-nonwiring-megarun-007`; file match at `/Users/brianb/MissionMed_worktrees/md-merger-daily-drills/LIVE/daily.html`; `WIRING_FINAL_MD-Daily-Drills-MergedMode-008B.md` records approved R2/CDN promotion | `LIVE FROM WRONG BRANCH` relative to this worktree, known approved source | HIGH | Preserve live artifact unless Brian elects to roll back. Reconcile canonical source with commit `5c19f4a` or create a Daily-specific repair branch. Do not redeploy this worktree's `LIVE/daily.html`. |
| `/drills` | `https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html` | `a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01` | Git commit `5c19f4a6a90fcb1a92f75c674f4c908aa8b4a01c` on `md-daily-drills-nonwiring-megarun-007`; file match at `/Users/brianb/MissionMed_worktrees/md-merger-daily-drills/LIVE/drills.html`; `WIRING_FINAL_MD-Daily-Drills-MergedMode-008B.md` records approved R2/CDN promotion | `LIVE FROM WRONG BRANCH` relative to this worktree, known approved source | HIGH | Preserve live artifact unless Brian elects to roll back. Reconcile canonical source with commit `5c19f4a` or create a Drills-specific repair branch. Do not redeploy this worktree's `LIVE/drills.html`. |

Risk is marked HIGH for all routes because each mismatch involves protected runtime HTML where auth, game state, route wiring, or gameplay behavior can be affected. Arena, Daily, and Drills are not unknown artifacts; the risk is source-of-truth drift, not an unexplained CDN body.

## 8. Route-Specific Notes

### Arena

- Current worktree `LIVE/arena.html` is older/different than live.
- Live artifact is newer than this branch's HEAD and matches commit `138d1e3` dated `2026-05-08 13:08:04 -0400`.
- AV3 report states the live CDN object was repaired by applying Avatar Studio v3 additions onto current Arena baseline commit `c25c0e7`, then promoting only `LIVE/arena.html`.
- LEARNINGS_LOG records a critical rule from AV3-002-g: compare local version marker/hash against authoritative baseline and verify CDN plus proxy after upload.
- Recommended action: keep the live AV3 repair artifact and reconcile it into the canonical branch. A blind deploy from `mr/cache-coherence-repair-001` would likely roll Arena back.

### STAT

- Live artifact exactly matches `/Users/brianb/MissionMed/_REPORTS/stat_live_verify_20260503221506.html`.
- Header in that file: `VERSION: 2026-05-03 22:12 STAT_DUEL_PACK_HYDRATION_GUARD`.
- STAT addendum records a STAT-only guard for canonical `get_duel_pack` hydration when hydrated questions are missing/mismatched, plus a stale resume guard.
- MM_ACTIVITY_LOG records that only `LIVE/stat.html` was promoted to R2/CDN and live SHA verified as `e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048`.
- No exact matching git object was found in scanned refs/history. This means the deployed artifact is traceable as a verified production snapshot, but not cleanly recoverable from git.
- Recommended action: treat this as a source-control repair task before any STAT deploy. Import the deployed artifact into a clean reconciliation branch or recover the missing commit, review it, validate it, then commit.

### Daily And Drills

- Live Daily/Drills artifacts exactly match commit `5c19f4a` on `md-daily-drills-nonwiring-megarun-007`.
- `WIRING_FINAL_MD-Daily-Drills-MergedMode-008B.md` says approved Daily/Drills runtime files from that commit were promoted to R2/CDN LIVE and CDN hashes matched approved local hashes.
- The older 008B report observed bare `/daily` and `/drills` first-party route cache lag immediately after promotion; MR-CACHE-002 later showed wrappers now proxy the promoted artifacts, so that earlier route cache lag appears resolved.
- Recommended action: preserve these live artifacts unless Brian intentionally chooses a rollback. Reconcile `5c19f4a` into the canonical source branch before the next deploy.

## 9. Unknowns

- Exact STAT git commit or branch for hash `e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048` remains unknown.
- Exact deploy operator/session metadata for STAT was not reconstructed beyond the report and activity log.
- `MISSIONMED_MASTER_KNOWLEDGE.md` and `KNOWLEDGE_INDEX.md` were not present in the specified worktree.
- MR-CACHE-002 validation tooling appears to treat absolute `--output` paths as repo-relative in at least one attempted run. I did not patch tooling under MR-CACHE-003 because provenance reporting did not depend on that correction.

## 10. Reconciliation Plan Only

Do not deploy from the current `mr/cache-coherence-repair-001` branch until the live artifacts are reconciled into source control.

Recommended route plan:

| Route | Plan |
|---|---|
| `/arena` | Preserve live artifact and update canonical source branch after reviewing `138d1e3` / AV3-002-g. |
| `/stat` | Pause and create a route-specific STAT repair branch from the canonical base; import the exact live snapshot or locate the missing commit before any deploy. |
| `/daily` | Preserve live artifact and update canonical source branch after reviewing `5c19f4a`. |
| `/drills` | Preserve live artifact and update canonical source branch after reviewing `5c19f4a`. |

The safest reconciliation order is:

1. Create a clean source-of-truth reconciliation worktree/branch.
2. Bring in the known-good live artifacts route by route.
3. Review diffs against current branch and reports.
4. Commit source reconciliation.
5. Run `VALIDATION/validate_live_state.sh --strict` to confirm current production still matches the reconciled source.
6. Only after Brian explicitly authorizes a deploy, promote scoped objects and immediately re-run strict validation.

## 11. Exact Next Prompt For Brian If Redeploy Is Needed

```text
PROMPT NAME:
MR-CACHE-004 — Authorized Runtime Source Reconciliation And Scoped Redeploy Gate

WORKTREE:
Use a new clean worktree under /Users/brianb/MissionMed_worktrees/mr-cache-004-runtime-source-reconcile

BRANCH:
Use codex/mr-cache-004-runtime-source-reconcile

MISSION:
Create a clean source-of-truth reconciliation branch for live Arena, STAT, Daily, and Drills artifacts before any deploy. Preserve current live artifacts unless Brian explicitly chooses a rollback per route.

AUTHORIZED ACTIONS:
- Create a clean worktree/branch.
- Import/reconcile:
  - Arena from commit 138d1e3be8e5ab04d002482c23e4a7661bbacbda after review.
  - Daily and Drills from commit 5c19f4a6a90fcb1a92f75c674f4c908aa8b4a01c after review.
  - STAT from /Users/brianb/MissionMed/_REPORTS/stat_live_verify_20260503221506.html only after diff review against current LIVE/stat.html, unless a matching git commit is found.
- Run syntax/hash/live-state validation.
- Commit narrowly if validation passes.

DEPLOY AUTHORIZATION:
Do not deploy unless Brian adds this exact line:
I AUTHORIZE SCOPED R2/CDN REDEPLOY OF THE RECONCILED ROUTES: [arena/stat/daily/drills list here]

FORBIDDEN:
No auth rewrite, no Supabase/RLS changes, no Railway secret/env changes, no WordPress production content edits, no broad cache purge, no git clean/reset/stash, no git add . or git add -A.

VALIDATION REQUIRED AFTER ANY AUTHORIZED DEPLOY:
bash VALIDATION/validate_live_state.sh --strict
```

## 12. Rollback Notes

- Arena rollback reference from AV3 report:
  - pre-repair local/current baseline backup: `/Users/brianb/MissionMed_AI_Sandbox/_AV3_REPAIR_BACKUPS/AV3-002-g_arena-current-baseline-before-avatar-v3-20260508-122136/arena.current-baseline.before-avatar-v3.html`
  - pre-repair live CDN backup: `/Users/brianb/MissionMed_AI_Sandbox/_AV3_REPAIR_BACKUPS/AV3-002-g_arena-current-baseline-before-avatar-v3-20260508-122136/arena.live-cdn.before-repair.html`
- STAT rollback/pre-deploy backup recorded in STAT addendum:
  - `/Users/brianb/MissionMed/BACKUPS/ARENA-LOGIN-RECOVERY-001/stat_LIVE_pre_stale_resume_guard_2026-05-03_221203.html`
- Daily/Drills rollback should use the pre-promotion hashes recorded in `WIRING_FINAL_MD-Daily-Drills-MergedMode-008B.md` only if Brian intentionally rolls back the merged mode promotion.
- Any rollback must be route-scoped, followed by direct CDN normal/cache-busted checks and WordPress wrapper strict validation. Do not broad purge blindly.

## 13. Commands Run

Representative read-only commands:

- `pwd`
- `git branch --show-current`
- `git status --short`
- `git log --oneline --decorate -8`
- `git diff --name-status`
- `git remote -v`
- `git branch -vv`
- `rg --files`
- `sed -n ...`
- `rg -n ...`
- `git show -s ...`
- `git show --stat ...`
- `git branch --contains ... --all`
- `sha256sum ...`
- read-only exact-hash scans across git history, worktrees, reports, and backups

No deployment, purge, commit, push, database, auth, secret, email, or payment command was run.

## 14. Confidence

Confidence: 91%

Reservation:

- Arena/Daily/Drills provenance is high confidence because exact hashes match local git commits and supporting deployment/validation reports.
- STAT is lower confidence because the exact live artifact is traceable to a report snapshot and deployment log, but not to an exact git object. Confidence would rise closer to 98% if the missing STAT commit/branch were recovered or the live STAT snapshot were formally imported, reviewed, validated, and committed to a clean reconciliation branch.
