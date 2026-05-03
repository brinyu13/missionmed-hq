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
