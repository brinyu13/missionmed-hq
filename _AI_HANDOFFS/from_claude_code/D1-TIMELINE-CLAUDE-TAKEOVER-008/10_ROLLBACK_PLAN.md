# 10 — Rollback Plan

## Current state: nothing to roll back

**No production mutation was performed in this run.** Production is byte-for-byte what it
was at takeover. This document therefore describes the rollback that would be required *if*
the candidate is later deployed, plus the corrections to the inherited rollback record.

## Corrections to the inherited record

The Codex handoff recorded the live Railway deployment as `8e0385ce-972c-41af-a81b-43c609ee668f`.
That is **stale**. Observed live at takeover:

| Item | Inherited record | Observed now |
|---|---|---|
| Railway project | — | `missionmed-timeline` (`295b3d56-f555-4851-91f4-eb32d7dc88e1`) |
| Railway service | `mission-timeline-api` | `mission-timeline-api` (`12bfaf69-f883-42b5-a380-b6beea49f251`) |
| Railway deployment | `8e0385ce-972c-41af-a81b-43c609ee668f` | **`2d815dbd-85b2-4d12-8ed0-8aea8fbc1347`** |
| API version | — | `timeline-c9eda9eeb7d6cf98` |
| WordPress release | `timeline-wp-ed84301a63d1ed11` | not re-verified (needs authenticated admin) |

Anyone planning a cutover must re-verify the WordPress release ID before relying on it.

## Rollback sequence (unchanged in shape)

1. **Kill switch** — disable the Timeline route.
2. **WordPress pointer reversal** — atomic revert to the previously installed release.
3. **Railway rollback** — redeploy the prior deployment ID (currently
   `2d815dbd-85b2-4d12-8ed0-8aea8fbc1347`, which is the *current* live one and would become
   the rollback target for any new deploy).
4. **No schema reversal required** — this run adds no database migration, exactly as UX-007
   added none.

## Known gap in the rollback tooling (confirmed, not fixed)

**F-07** — `scripts/manage-d1-411c-release.mjs` cannot roll back the artifact students
actually load. It requires `release-manifest.json`, but WordPress runtime releases contain
only `release.php`. The static release and the WordPress release are rolled back by different
mechanisms, and only one of them is covered by the tool. This should be closed *before* a
cutover, not after, or the rollback rehearsal will fail at the worst possible moment.

## Backup position

Kinsta manual backup capacity was 5/5 at the Codex checkpoint, with the oldest manual backup
being `Post Timeline Builder Success` (Aug 4 2026, 10:08 PM). The mandatory fresh
pre-deploy backup **cannot be created without Founder authorization to delete exactly one
existing backup**, and existing deletion authority names different backups. No backup was
created or deleted in this run. This remains a hard, Founder-only gate.
