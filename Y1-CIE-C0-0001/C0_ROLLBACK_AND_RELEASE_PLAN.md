# Y1-CIE-C0-0001 Rollback and Release Plan

## Current Deployment State

- Local: executable and tested.
- Staging: not deployed.
- Production: not deployed.
- Provider resources: none created.

## Pre-Merge Rollback

Delete the isolated worktree and branch after preserving any desired evidence. No shared runtime or database rollback is required because nothing was deployed.

## Post-Merge, Pre-Deployment Rollback

Revert the focused branch commits in reverse order. Do not rewrite shared history. Verify RC1, root regressions, and allowed-path scope after the revert.

## Migration Rollback Law

The CIE migrations are forward-only. Do not down-migrate evidence tables, remove audit proof, weaken RLS, or regrant direct authenticated DML. Before any future deployment:

1. apply all three migrations in one gated release;
2. verify fourteen FORCE-RLS tables and zero public/authenticated DML;
3. keep all runtime routes and role memberships disabled until the reviewed host adapter is ready;
4. grant only the deletion verifier and executor function capabilities required by their separate workers;
5. preserve deletion execution even when other feature flags are off.

If activation validation fails, revoke adapter role membership and route traffic away from CIE. Leave the additive schema and deletion/audit evidence intact for investigation.

## Local Cleanup

Disposable PostgreSQL clusters and repository fixtures self-delete. Browser fixture servers were stopped. No synthetic provider assets, users, credentials, or production rows exist.

## Release Prerequisites

- Reviewed production Postgres repository/command adapter.
- Canonical host-auth mapping into the preverified principal contract.
- Staging migration and API parity tests.
- Staging cross-user/grant/deletion/browser verification.
- Operations owner, incident procedure, and rollback rehearsal.
- Normal MissionMed release approval.
