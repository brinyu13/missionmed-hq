# D1 Timeline UX-007 — Rollback Plan

## Before cutover

1. Reverify Kinsta provider-native backup inventory and create a fresh `D1-TIMELINE-UX-007-PRE-<UTC>` backup.
2. Preserve current WordPress pointer `timeline-wp-ed84301a63d1ed11` as the immediate code rollback target.
3. Preserve current Railway deployment `8e0385ce-972c-41af-a81b-43c609ee668f` as the API rollback target.
4. Create a fresh Timeline-scoped filesystem snapshot and verify its checksum manifest.

## Automatic rollback

- Disable Timeline access through the existing kill switch if wrong target, unstable identity, unauthorized or cross-owner access, RLS failure, broken persistence/export, unusable backup, or unrelated-app impact is observed.
- Atomically repoint the Timeline runtime symlink to `timeline-wp-ed84301a63d1ed11`.
- Railway rollback to `8e0385ce-972c-41af-a81b-43c609ee668f`; do not drop or reverse the existing database schema because UX-007 adds no migration.
- Reverify health, route identity, anonymous/direct-API denial, eligible access, existing data, media, and unrelated applications before re-enabling users.

No destructive cleanup or student-document mutation is part of rollback.
