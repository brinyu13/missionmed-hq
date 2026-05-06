# Daily + Drills LAB Artifacts

This directory is for MD Daily + Drills lab evidence only.

## Status

- Lab-only.
- Not runtime.
- Not production.
- Not tester-facing unless separately approved by Control Tower.
- Not proof of AI QA pass, tester readiness, production shape, or promotion
  readiness.

## Current Artifact

`daily_drills_unified_lab.html`

- Version marker: `MD-MERGER-DAILY-DRILLS-LAB-915-2026-05-02`
- Lab marker: `labOnly: true`
- Purpose: internal Daily gateway to Drills handoff exploration
- Storage behavior: uses `sessionStorage` and `localStorage` lab keys
- Runtime status: not referenced by `_SYSTEM/DEPLOY_MANIFEST.json`, deploy
  scripts, validation scripts, CDN runtime paths, or WordPress route proxies

Do not promote this artifact to `LIVE/*.html`. Do not wire it into `/arena`,
`/daily`, `/drills`, `/stat`, or CDN production paths without a separate
Control Tower-approved implementation prompt.

## Operator Console

`daily_drills_admin_console.html`

- Lab-only operator/admin reference surface
- Documents Contract B runtime files, learner-flow checklist, result payload
  shape, session-only persistence status, and future wiring needs
- Performs no backend writes
- Performs no Supabase writes
- Does not modify auth, WordPress, Railway, R2/CDN, or deploy behavior
- Not tester-facing unless separately approved by Control Tower

## Single HTML T16 Candidate

`daily_drills_single_html_t16_candidate_011.html`

- Lab mirror of the T-16 single-file `LIVE/drills.html` candidate
- Supports `/drills?entry=daily_rounds` menu state and
  `/drills?video_id=...&origin_mode=daily_rounds` runtime state
- Preserves `mm_selected_drill`, `mm_daily_drill_result`, and
  `window.MMDailyDrillsBridge`
- Keeps T-16 demo data as fallback only
- Not deployed, not promoted, and not proof of production readiness

`daily_drills_single_html_t16_notes_011.md`

- Integration notes, data source expectations, route behavior, and candidate
  limitations for wiring authority review
