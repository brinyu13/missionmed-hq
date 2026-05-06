# Daily + Drills v3 Side-by-Side Notes 014

## Purpose

This branch preserves the existing legacy comparison routes and adds a separate v3 single-file candidate.

## Legacy Comparison Route Retained

- Legacy Daily route: `/daily`
- Legacy Drills route: `/drills`
- Legacy runtime files:
  - `LIVE/daily.html`
  - `LIVE/drills.html`

These files are intentionally unchanged in this branch.

## V3 Candidate

- V3 runtime file: `LIVE/daily_drills_v3.html`
- Source: `dcc73b5b14a725224db8bbdfcbf4851cba873abc:LIVE/drills.html`
- Intended future route: `/daily-drills-v3`
- Intended future CDN object: `html-system/LIVE/daily_drills_v3.html`

Expected future internal states:

- `/daily-drills-v3?entry=daily_rounds`
- `/daily-drills-v3?video_id=...&origin_mode=daily_rounds`

## Arena Card

Direct `LIVE/arena.html` editing was not performed in this branch. Arena has several layered mode-card renderers and Play-button controllers, so a safe card addition should be wired by the central Wiring Authority.

Prepared LAB-only snippet:

- `LIVE/LAB/daily_drills_v3_arena_card_snippet_014.html`

## Protected Boundary

No auth, Railway, Supabase, WordPress, STAT, R2/CDN, deploy, package, payment, email, LearnDash, WooCommerce, USCE, Clinicals, or Offer files were modified.

No deploy or promotion was performed.

## MD-MERGER-017 Hydration Correction

The v3 candidate previously exposed T-16 demo subject/session data in normal mode. That created fake counts and allowed a prompt-only drill to start when real media or nodes were missing.

Normal v3 mode now uses the legacy Daily/Drills registry endpoint as the first source of truth:

- `https://mmvs-backend-production.up.railway.app/api/drills`

Normal v3 mode should prefer:

- `sessionStorage.mm_selected_drill`
- `sessionStorage.mm.launch`
- `video_id` query parameter matched against the real registry
- real registry rows with `video_id`, `playback_url` or `stream_id`, and `nodes_url`
- real `nodes_url` prompt extraction

T-16 demo subjects, fake Neurology/Cardiology sessions, and fallback prompts are LAB-only behind `?lab=1` or `#lab`. The normal live route should show real registry data or an honest empty/error state. It should not start a fake drill when media or nodes are unavailable.

No deployment or CDN promotion was performed for the MD-MERGER-017 hydration correction.

## MD-MERGER-020 Flow / Labels / Subject Browser / Avatar Correction

The v3 frontend now uses the intended learner flow labels:

- Step 1: Dashboard
- Step 2: Choose Exam
- Step 3: Choose Subject
- Step 4: Ready & Run
- Step 5: Summary + Feedback

Step 3 is the combined subject and real-video selection screen. Subject counts and video cards are derived from the real registry data loaded by the v3 hydration layer. If metadata only supports a broad group such as `DRJ_DRILLS`, v3 displays that honestly instead of inventing Cardio/Pulm/Renal categories.

Video/drill titles now pass through a display-title normalization layer. Raw Zoom/GMT/recording/resolution filenames are treated as technical metadata and are not used as the main learner-facing title unless no safer derived label exists.

The dashboard now includes an adapter-friendly full-body avatar area. The hook is `window.MMDailyDrillsBridge.getUserAvatar?.()`. If no avatar URL is available, v3 shows a clear placeholder and does not query backend/profile systems.

No deployment or CDN promotion was performed for the MD-MERGER-020 UI flow correction.

## MD-MERGER-022 Tab 3 / Tab 4 UX Correction

Tab 3 now treats the far-left column as the subject selector with the visible title `Pick Your Subject`. Normal v3 mode maps real registry rows through the legacy Daily curriculum assignment model so learner-facing subjects can show as Cardio, Pulm, Renal, GI, Neuro, ID, Endo, Heme, OB/GYN, Psych, Surgery, Peds, and related real curriculum labels where the source data supports it.

The immediately adjacent column is now the video drill picker for only the selected subject. Video cards select and highlight the drill but do not start runtime. The main Start action remains in Tab 4.

The right-side Tab 3 panel is the subject history/stats area. It shows selected subject, available drill count, session-only accuracy/recall placeholders, flagged/review state placeholders, and an honest note that durable history is not wired here.

Tab 4 remains the Ready & Run screen and now launches through a frontend-only animated countdown: `3`, `2`, `1`, `GO`. The countdown validates that real media and nodes are available before it appears, then starts the existing timed recall/self-report runtime.

No auth, WordPress, Railway, Supabase, R2/CDN, STAT, Arena, legacy Daily, or legacy Drills files were modified. No deployment or CDN promotion was performed for MD-MERGER-022.
