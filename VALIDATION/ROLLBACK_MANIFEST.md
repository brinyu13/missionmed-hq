# MM-LAUNCH-SEV1-001-FIXES Rollback Manifest

## Rollback Scope

This change is source-only. It does not deploy, does not run `railway up`, does not update WordPress database content, and does not change WooCommerce product data.

## Backup Directory

`_SYSTEM_LOGS/backups/MM-LAUNCH-SEV1-001-FIXES-20260615-112906/`

## Rollback Steps

1. Remove `wp-content/mu-plugins/missionmed-launch-sev1-fixes.php`.
2. Remove the generated handoff files under `_AI_HANDOFFS/from_codex/legal_pages/` if they are not needed.
3. Remove `VALIDATION/PRECHANGE_STATUS.md`, `VALIDATION/FILES_TOUCHED.md`, `VALIDATION/ROLLBACK_MANIFEST.md`, `VALIDATION/POSTCHANGE_STATUS.md`, and `_AI_HANDOFFS/from_codex/MM-LAUNCH-SEV1-001-FIXES-REPORT.md` if rolling back documentation too.
4. Restore `_SYSTEM_LOGS/MM_ACTIVITY_LOG.md` from the backup copy in the backup directory if the activity-log entry should also be removed.

## Logical Fix Groups

- Legal pages:
  - Runtime virtual pages for `/terms-of-agreement/` and `/refund-cancellation-policy/`.
  - Runtime privacy-policy content replacement for `/privacy-policy/`.
  - Admin-ready legal page handoff files.
- SEO/meta:
  - Yoast and Rank Math description filters scoped by request slug.
- Public copy:
  - Canonical program-name replacements on launch pages and product content.
  - Main Mission Residency pricing-copy replacement to canonical public prices.
  - Compare Programs pricing bridge.
  - USCE raw code-fence marker removal.
  - Arena public "concept demo only" wording softened to an interest-preview state.
- Navigation/footer:
  - MatchLab menu labels corrected to Arena.
  - Footer policy links and raw privacy page ID repaired.
  - Legacy Mission Residency email corrected to `info@missionmedinstitute.com`.

## Known Non-Rolled-Back External State

No external state was changed.
