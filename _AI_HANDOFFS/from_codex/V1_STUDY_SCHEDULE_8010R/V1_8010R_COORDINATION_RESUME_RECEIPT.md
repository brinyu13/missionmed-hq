# V1-8010R Coordination Resume Receipt

## Capture

- Captured: 2026-07-15T03:45:00Z
- Worktree: `/Users/brianb/MissionMed_worktrees/V1-StudySchedule-8010A`
- Branch: `codex/v1-study-schedule-8010a`
- Local HEAD: `bafd2f16a031163f4a1fce9bcae8ac8cc5a706a6`
- Index: nothing staged
- Tracked changes: exactly two files
- Untracked groups: one workflow, five PHP fixtures plus their runner, and the V1-8010R evidence directory

The resumed state contained more untracked evidence than the earlier coordination-stop summary named. Work stopped for classification before any of those bytes were overwritten or adopted.

## Preserved receipt

The exact pre-adoption state is preserved outside the repository at:

`/Users/brianb/MissionMed_Backups/V1_STUDY_SCHEDULE_8010R/20260715T034500Z`

| Receipt artifact | SHA-256 |
|---|---|
| `tracked.patch` | `6f9e6aee68927d0c781782793b969c71fbec08b1b667f7257137a753e5bda6e4` |
| `untracked.tar.gz` | `3c0e84bf6d8b51fcf15e3a87b5258124ca13e251fe7b2ffe9b3aece70b356e16` |
| `status.txt` | `7c27fa40ffe878612089472ba0eece7668bde6cf835d1aa61bb59db5d29642c3` |
| `metadata.txt` | `9a83a7dceed91f8f7c6393cfe5117f35ba01c06cff950d02e9a4fca2e25a86fb` |
| `file-sha256.txt` | `5f5b27574a6ba60950d31dba8202786f64dad6dbfb0648d3e939da70d93e3729` |

Receipt files are mode `0600`. No MissionMed_OS file was changed.

## Byte reconciliation

The two modified source files and all six workflow/test files are byte-identical to remote validation head `34395ab7466d5a2e4496fe2db6d602f3a12a7f9e` on `codex/v1-study-schedule-8010b-ci` and draft PR #11.

| Path | SHA-256 |
|---|---|
| `.github/workflows/v1-study-schedule-containment.yml` | `e9318b4f12f3a9052ecfd5c702adbf10a44563955e5c8000993346947fad2043` |
| `tests/php/run-v1-study-schedule-containment.sh` | `7536364a111b86f04da3f296d6e71d9424e5399c259586360abc16222be947da` |
| `tests/php/v1-study-schedule-calendar-private-audience.php` | `be8c2a43cd9d5772cc51ba3553b44f73fbdf7b0486fd55fadc2ef1681253ffcb` |
| `tests/php/v1-study-schedule-calendar-strict-mutation.php` | `cd7ba1e7b57bdf6b6c52c8d45ff4d13a565a5adf368679c60bde98a2639026cf` |
| `tests/php/v1-study-schedule-legacy-containment.php` | `d989ebd2d6fb9df00b139f515ac0495fbb9093453a562ca131dde5f171e246d9` |
| `tests/php/v1-study-schedule-route-baseline.php` | `0a88682661748ee1fe9ba57f4cb327cc3f194fa50317db24adb1526e91d9b322` |
| `wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php` | `5f2a183a443fbc2ed3fe0735f6af2483cde27e943fcebd40c50f0f54fdb525d4` |
| `wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php` | `83bed69a97fa2227b3635460afb5ab113ec4530ba30eb0684ea775eea9cb5841` |

GitHub Actions run `29386935391` completed successfully for that exact validation head. Its two jobs used PHP 7.4.33 and PHP 8.3.32; both linted the two source files and four fixtures and passed every fixture.

## Disposition

| Group | Disposition | Reason |
|---|---|---|
| Two modified legacy source files | Preserve and provisionally adopt | Exact remote byte match and green dual-version CI; final adoption waits for current independent Wave 1 and Darwin review. |
| Workflow and PHP tests | Preserve and provisionally adopt | Exact remote byte match; PHP 7.4/8.3 evidence is independently recoverable from GitHub. |
| Existing V1-8010R Markdown reports | Preserve as provisional evidence | They document the parallel attempt but do not replace supervisor verification or the required re-engaged agent wave. |
| External snapshot | Retain | It is the rollback/evidence boundary for the resumed dirty state. |

No file was deleted, reset, stashed, cleaned, or blindly rewritten during reconciliation.
