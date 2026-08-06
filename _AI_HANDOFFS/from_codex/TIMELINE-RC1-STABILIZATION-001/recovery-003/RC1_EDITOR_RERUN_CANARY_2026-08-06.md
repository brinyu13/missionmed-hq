# RC1 editor rerun canary — 2026-08-06

Status: LIVE CANDIDATE INSTALLED; PARTIAL PRODUCTION CANARY.

## Immutable release

- Source commit: `085034f03c9e58d6c17c39a73717ee822fee81ad`.
- Static release: `timeline-9390c41fe08d746d` (63/63 verified build assets).
- WordPress runtime: `timeline-wp-2d46960b6d971fab`.
- Installed payload SHA-256: `0af64360a530034de205f7439c6927b1179de9d5466a03a7bd6623dd3f2bcc6d`.
- Installation time: `2026-08-06T22:08:03Z`.
- Public runtime asset observed in an authenticated production browser: `4626721cb98e`, matching the immutable release manifest.

## Bounded repair

1. A flags-only audience projection now uses the established empty-state boundary before the protected D1-409H renderer, which requires at least one arrow event.
2. The Timeline host reapplies its fixed 1920×1080 composition and waits for two layout frames before a bounded retry of the protected renderer's `TEXT_FIT_UNRESOLVED` guard. No protected visual asset, CSS, geometry, or export serializer changed.

## Local regression

- Focused Fable integration: 13/13 PASS.
- Typecheck: PASS.
- Browser journeys: 42/42 PASS (administrator, eligible-360, removed); administrator PNG, Letter PDF, and A4 PDF downloads passed with zero browser errors.

## Timeline-only recovery

- Fresh private snapshot: `/www/theresidencyacademy_209/private/timeline-rc1-recovery-backups/20260806T220712Z-editor-rerun`.
- Snapshot pointer: `releases/timeline-wp-ea4db91abf5a4315`.
- Snapshot checksum manifest: verified.
- Immediate rollback target: `releases/timeline-wp-ea4db91abf5a4315`.

## Production observation

- The active pointer now resolves to `releases/timeline-wp-2d46960b6d971fab` and its payload SHA matches the immutable release.
- Authenticated founder-equivalent production Home rendered a seven-event preview through the protected kernel without a fatal render alert.
- Authenticated Advanced Studio rendered the approved canvas-first interaction shell and asset rail without a fatal render alert.
- Anonymous direct-route access returned through the approved Matrix/member-dashboard sign-in path.
- The active 360 session also loaded the new asset and returned the safe no-visible-events state instead of the former `events[] required` fatal failure.

## Preserved blocker

An existing `SYNC CONFLICT — REVIEW` banner was present in the pre-existing concurrent browser state before this rerun and remains unresolved. No conflict copy was chosen, no local document was overwritten, and no user data was modified. This is not counted as a passing save/reload or student workflow. Continue the remaining live journeys from a clean or intentionally reconciled test state.
