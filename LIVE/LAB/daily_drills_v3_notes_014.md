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
