# MD Daily/Drills v3 Tab 3 / Tab 4 Countdown Handoff 022

## Result

V3 Tab 3 / Tab 4 UX fix completed locally for Codex review. No deploy or promotion was performed.

## Startup Confirmation

- Worktree: `/Users/brianb/MissionMed_worktrees/md-merger-daily-drills`
- Branch: `md-daily-drills-v3-side-by-side-014`
- Starting HEAD: `c160a1cb5e91fd02856bee04b14afa05618ad8a3`
- Date/time: `2026-05-06 12:51:21 EDT`
- Dirty state before this task: clean

## Files Changed

- `LIVE/daily_drills_v3.html`
- `LIVE/LAB/daily_drills_v3_notes_014.md`
- `_AI_HANDOFFS/from_claude_code/MD_DAILY_DRILLS_V3_TAB3_TAB4_COUNTDOWN_022.md`

## Tab 3 Subject / Video Layout

- Far-left Tab 3 column is now explicitly titled `Pick Your Subject`.
- Normal v3 mode uses the legacy Daily curriculum topic assignment strategy to map real registry rows into subject labels such as Cardio, Pulm, Renal, GI, Neuro, ID, Endo, Heme, OB/GYN, Psych, Surgery, Peds, and related curriculum buckets where the source video metadata supports it.
- `DRJ_DRILLS` is treated as limited metadata and is not promoted as the main subject label when the legacy curriculum mapping can resolve a better subject.
- The second column is now the selected-subject video drill list titled `Pick a Video Drill`.
- Video cards select/highlight a drill and prepare Tab 4. They do not start runtime directly.
- The right-side Tab 3 panel is reserved for subject history/stats, including available video count, session-only accuracy/recall placeholders, flagged/review placeholder, trend placeholder, and browser/session-only copy.

## Video Naming

- Existing title normalization remains preserved.
- Raw GMT / recording / resolution filenames are cleaned before becoming a fallback title.
- If no clean title exists, the UI falls back to `Metadata pending` rather than inventing medical topics.

## Tab 4 Ready & Run / Countdown

- Tab 4 remains the Ready & Run screen.
- The main Start button now validates that a real drill, media, and nodes/prompts are available before countdown.
- A frontend-only countdown overlay shows `3`, `2`, `1`, `GO`, then starts the existing timed recall/self-report runtime.
- Reduced-motion users receive a shorter, non-animated countdown path.

## Preserved Contracts

- `sessionStorage.mm_selected_drill`
- `sessionStorage.mm_daily_drill_result`
- `entry=daily_rounds`
- `video_id`
- `origin_mode=daily_rounds`
- real registry hydration
- real media/nodes handling
- demo gating behind `?lab=1` / `#lab`
- session-only language
- Step 2 Choose Exam labels and Step/Level card titles
- Step 5 Summary + Feedback
- dashboard avatar hook/display

## Protected Boundary

No Arena, legacy Daily, legacy Drills, STAT, WordPress, Railway/backend, Supabase/RLS, R2/CDN, deploy, USCE, Clinicals, or Offer files were modified.

## Validation Run

- `git diff --check`: PASS
- inline JS syntax check for `LIVE/daily_drills_v3.html`: PASS
- `git diff --name-status`: only allowed files modified before handoff creation
- forbidden copy search for durable/server-verified claims: PASS
- static contract searches for Tab 3 labels, countdown, storage keys, and route params: PASS

No browser, Computer Use, deploy, or CDN validation was performed by this prompt.

## Wiring Authority Notes

- Wiring Authority should promote only after reviewing the final diff and validating `/daily-drills-v3` live.
- Validate that the live registry data produces real subject buckets and that selecting a subject filters the video list to only that subject.
- Validate desktop plus mobile that the countdown appears only after the main Tab 4 Start action and then opens runtime.
- Validate no fake durable progress, server-verified grading, or STAT-style copy appears.

## Red Team

- Static checks cannot prove the live API data will map every row cleanly; rows without legacy schedule/exact mapping still fall back to `Metadata pending`.
- The subject history graph remains frontend/session-only until durable progress wiring exists.
- The countdown is static-validated only; final animation/runtime proof needs browser validation after promotion.
