# A1 MMC Pro Worktree Inventory

RESULT: FINAL_READ_ONLY_INVENTORY_COMPLETE

All evidence worktrees were inspected with Git locks disabled where practical and remained read-only. The full registry of 140 worktrees, 210 local branches, remote refs, six tags, and seven stashes is preserved in A1_MMC_PRO_BOOTSTRAP_REPORT.md.

| Path | Branch / observed HEAD | State at comparison | Authority treatment |
| --- | --- | --- | --- |
| /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-004 | a1-macair-mmc-mentor-intelligence-004 / code tip bbdcd96d859b | authorized integration target | canonical MMC integration branch |
| /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-005 | a1-macair-mmc-mentor-intelligence-005 / 9c1fa72e6b05 | clean, tracks origin/main | current-main control, read-only |
| /Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-001 | a1-macair-mmc-mentor-intelligence-001 / 3faf0e8deb90 | historical | MMC private-route ancestry evidence |
| /Users/brianb/MissionMed | audit/supabase-2026-grants-20260527-101117 / e8503866bce9 | heavily dirty | PROTECTED, DO NOT TOUCH |
| /Users/brianb/MissionMed_worktrees/live-source-of-truth-reconcile-004 | mr/live-source-of-truth-reconcile-004 / 85b5998edb85 | dirty evidence | PROTECTED runtime/reconciliation evidence |
| /Users/brianb/MissionMed-Webex | feature/webex-meeting-integration / 3e8104c032bf | dirty historical evidence | PROTECTED Webex source |
| /Users/brianb/MissionMed_worktrees/Y1-CAM-3000 | y1-cam-3000 / 3faf0e8deb90 | dirty design evidence | read-only CAM/Fable reference |

Relevant Pro refs were reconciled as follows: origin/main supplied self-contained MMC commits 49bb583 and 7b55f04; origin/codex/mmc-019-preserve-mmc and the matching Air ref both point to 1be8a3d; origin/a1-macair-mmc-mentor-intelligence-003 at b5536ab is report-only archival evidence. No evidence worktree, branch, tag, or stash was modified.
