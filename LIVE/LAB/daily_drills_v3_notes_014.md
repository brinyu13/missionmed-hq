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
