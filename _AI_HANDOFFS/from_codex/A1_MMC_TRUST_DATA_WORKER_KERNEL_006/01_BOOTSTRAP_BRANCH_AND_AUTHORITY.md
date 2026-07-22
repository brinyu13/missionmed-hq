# 01 Bootstrap, Branch, and Authority

RESULT: `MEGARUN_006_AUTHORITY_RESOLVED`

## Pre-change state

- Recorded UTC: `2026-07-15T15:39:47Z`
- Worktree: `/Users/brianb/MissionMed_worktrees/A1-MacAirMMCMentorIntelligence-005`
- Git common directory: `/Users/brianb/MissionMed/.git`
- Branch: `a1-mmc-trust-data-worker-kernel-006`
- Starting HEAD: `a34905a8708d4e254b2e5847cfedd54ea6a68faa`
- Starting tree: clean; no staged, unstaged, or untracked files before this report.
- Starting upstream: none. The predecessor commit is already pushed as `origin/a1-macair-mmc-mentor-intelligence-004`.
- Production, staging, provider, configured-database, credential, and deployment mutations: none authorized and none performed. Later disposable local PostgreSQL validation is isolated proof, not a configured write plane.

## Dependency correction

The OS-routed worktree initially checked out the clean placeholder branch `a1-macair-mmc-mentor-intelligence-005` at `9c1fa72e6b056db8b6fe0e17031fcaa688f78569` (`origin/main`). Read-only ancestry and path comparison proved that this commit does not contain the reconciled MMC implementation or the Architecture 005 authority. Those assets exist on the pushed predecessor commit `a34905a8708d4e254b2e5847cfedd54ea6a68faa`.

The placeholder branch was left untouched. This worktree was switched to a fresh MegaRun branch created directly at the exact pushed Architecture 005 SHA:

`a1-mmc-trust-data-worker-kernel-006 @ a34905a8708d4e254b2e5847cfedd54ea6a68faa`

This satisfies the predecessor dependency without merging unrelated newer `main` work, rewriting history, or replacing newer MMC work.

## Authority hierarchy

1. The MegaRun 006 mission and the 2026-07-15 steering directive.
2. `_AI_HANDOFFS/from_codex/A1_MMC_CAM_V2_ARCHITECTURE_005/`, especially reports 01, 07, 11–13, 16, 20–22 and the Partner Demo rejection report.
3. MissionMed OS boot/current routing and the product registry evidence.
4. `_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md`, `_SYSTEM/CRITICAL_SYSTEMS_CONTRACT.md`, `_SYSTEM/DATA_FLOW_CONTRACT.md`, `_SYSTEM/SUPABASE_MIGRATION_PROTOCOL.md`, `_SYSTEM/NAMING_CANON.md`, and the Matrix runtime lock protocol/manifest.
5. Current code, tests, migrations, and historical handoffs as implementation evidence.

The MissionMed OS product index does not provide a standalone MMC passport and classifies MMC authority as unknown. This is an authority degradation, not a conflict: the explicit mission plus the pushed Architecture 005 package supplies the scoped MMC authority, while all shared MissionMed HQ, data, migration, and Matrix protections remain controlling. No Matrix runtime file is in scope.

## Steering correction

The Partner Demo is classified exactly as:

`HISTORICAL · SYNTHETIC · FUNCTIONAL-CONCEPT REFERENCE ONLY · DESIGN REJECTED · NOT CAM V2.0 AUTHORITY`

It may be preserved and tested as historical evidence. Its visual language, interaction model, information architecture, responsive behavior, density, card patterns, and presentation choices have zero design authority. MegaRun 006 performs no CAM redesign; all API and state decisions must support the first-principles CAM v2 experience planned for MegaRun 007.

## Protected-path decision record

`missionmed-hq/server.mjs` is a protected shared runtime owner. It may be changed only if repository inspection proves an MMC-specific mount or boundary cannot be safely sealed within an isolated MMC module. Any permitted change must be minimal, preserve exports/middleware order/routes/auth/CSRF behavior, and pass the current MMC suite, shared runtime/deploy validators, route-collision checks, and the critical-systems gate. Broad parser, auth, session, CSRF, bootstrap, environment, or non-MMC route changes are rejected.

Historical migrations are immutable. MegaRun 006 may add correctly sequenced, unapplied migrations and validation snippets only. It may not run `db push`, `db reset`, migration repair, direct migration-history writes, live RLS mutation, or any staging/production command.

## Authorized implementation families

- `missionmed-hq/routes/mmc-coaching-pipeline.mjs` for compatibility sealing only.
- New isolated `missionmed-hq/routes/mmc/` versioned gateway modules.
- Existing MMC-only libraries and new `missionmed-hq/lib/mmc/` trust, contracts, command, query, job, asset, identity, evidence, policy, publication, cutover, and observability modules.
- Additive `supabase/migrations/*mmc_cam_v2*` and read-only validation snippets.
- `missionmed-hq/tests/mmc-*`, new `missionmed-hq/tests/mmc-cam/`, and MMC-specific local fixtures.
- This run's reports under `_AI_HANDOFFS/from_codex/A1_MMC_TRUST_DATA_WORKER_KERNEL_006/`.
- `missionmed-hq/server.mjs` only under the protected decision above.

Explicitly excluded are Matrix, Scheduler, Calendar, Daily Drills, `video_registry.json`, R2, Stream, File Vault, WordPress/LearnDash, payments, provider accounts, production/staging resources, credentials/env values, raw media, and the Partner Demo implementation.

## Rollback

Before any external state exists, rollback is commit-scoped: revert the applicable MegaRun checkpoint or disable the default-off MMC v2 feature gates. Historical v1 mutation routes are sealed; the runtime begins `SEALED_NO_WRITER` until a separately authorized, reconciled v2 cutover. No rollback may introduce dual-write or discard an acknowledged v2 write in a later authorized cutover.

## Pre-implementation gates

- Complete source/import/consumer mapping for every intended file.
- Run the applicable critical-system and Matrix freshness checks before a protected touch.
- Establish baseline validators before implementation.
- Confirm additive migration naming, ordering, headers, transactions, forced RLS, and no migration application.
- Red-team auth, CSRF, exact origin, payload bounds, identity evidence, worker fencing, idempotency, publication isolation, audit, and secret/path redaction.
