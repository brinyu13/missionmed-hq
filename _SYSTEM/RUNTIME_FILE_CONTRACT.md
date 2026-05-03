# RUNTIME FILE CONTRACT - ARENA / DAILY / DRILLS / STAT

**Authority:** MD Daily/Drills SOT reconciliation 004
**Date:** 2026-05-03
**Status:** CONTRACT B LOCKED FOR RUNTIME FILENAMES

This document defines the runtime HTML filename contract for the MissionMed
Arena / Daily Rounds / Drills / STAT surface.

## Authoritative Runtime Contract

Contract B is authoritative for runtime filenames:

| Surface | WordPress proxy path | CDN object | Repository source |
|---------|----------------------|------------|-------------------|
| Arena | `/arena` | `html-system/LIVE/arena.html` | `LIVE/arena.html` |
| Daily Rounds menu | `/daily` and `/drills?entry=daily_rounds` | `html-system/LIVE/daily.html` | `LIVE/daily.html` |
| Drills engine | `/drills` and `/drills?video_id=...` | `html-system/LIVE/drills.html` | `LIVE/drills.html` |
| STAT | `/stat` | `html-system/LIVE/stat.html` | `LIVE/stat.html` |

The deploy manifest, deploy validation, runtime validation, and WordPress route
proxies must use these four files as the runtime contract.

## Legacy / Archive Contract

Contract A is legacy/archive/rollback compatibility only:

| Legacy file | Runtime status |
|-------------|----------------|
| `LIVE/arena_v1.html` | Not an active runtime target. Do not recreate as production runtime. |
| `LIVE/mode_dailyrounds_v1.html` | Not an active runtime target. Archive/rollback compatibility only. |
| `LIVE/drills_v1.html` | Not an active runtime target. Archive/rollback compatibility only. |
| `LIVE/stat_latest.html` | Not an active runtime target. Archive/rollback compatibility only. |

Do not promote `_v1` or `stat_latest` files into active runtime routing. Do not
create alternate production filenames such as `arena_v2.html`,
`dailyrounds_new.html`, `drills_copy.html`, or `arena_merged.html`.

## Source Of Truth Rule

GitHub is the source of truth for runtime HTML. CDN/R2 is delivery only. A CDN
object is not authoritative unless it matches the approved GitHub source for the
same Contract B path.

## Current SOT Reconciliation Note

SOT reconciliation 004 intentionally locks the filename contract only. The
authoritative `LIVE/stat.html` content variant must be explicitly approved by
Control Tower before this lane can proceed to AI QA or tester exposure.
