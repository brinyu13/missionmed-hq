RESULT: WORKED

# MR-BRAND-TRANSITION-003 - Legacy Popup Live Deploy Report

## Scope
- Task: Commit, push, deploy, exact-cache-purge, and live-verify the MR-BRAND-TRANSITION-002 legacy Mission Residency popup.
- Worktree: `/Users/brianb/MissionMed_worktrees/MR-BRAND-TRANSITION-002-legacy-popup`
- Branch start: `feature/mr-brand-transition-002-legacy-popup`
- Branch end: `feature/mr-brand-transition-002-legacy-popup`

## Git State
- Starting status before MR003 commit: intended MR002 implementation files only, plus local MR002 backup artifacts.
- Implementation commit: `c2cf7f4` - `MR-BRAND-TRANSITION-002 add legacy Mission Residency popup`
- Files committed in implementation commit:
  - `CHANGELOG/CHANGELOG_MASTER.md`
  - `_AI_HANDOFFS/from_codex/MR-BRAND-TRANSITION-002_legacy_redirect_popup_implementation.md`
  - `wp-content/mu-plugins/missionmed-mr-legacy-popup.php`
- Push status: pushed to `origin/feature/mr-brand-transition-002-legacy-popup`.
- Ending status target after committing this report/changelog: untracked backup/evidence artifacts only.

## Files Inspected
- `SESSION_PRIMER_V2.md`
- `_SYSTEM/PRIMER_CORE.md`
- `_SYSTEM/PRIMER_EXT_VISUAL.md`
- `_SYSTEM/PRIMER_EXT_INTEGRITY.md`
- `_SYSTEM/NAMING_CANON.md`
- `/Users/brianb/MissionMed/_SYSTEM/RULES_ENGINE.md`
- `_AI_HANDOFFS/from_codex/MR-BRAND-TRANSITION-002_legacy_redirect_popup_implementation.md`
- `wp-content/mu-plugins/missionmed-mr-legacy-popup.php`
- `CHANGELOG/CHANGELOG_MASTER.md`
- Kinsta MU-plugin cache command/source files on production:
  - `/www/theresidencyacademy_209/public/wp-content/mu-plugins/kinsta-mu-plugins/wp-cli/commands/class-cache-purge-command.php`
  - `/www/theresidencyacademy_209/public/wp-content/mu-plugins/kinsta-mu-plugins/cache/class-cache-purge.php`

## Files Modified
- `CHANGELOG/CHANGELOG_MASTER.md`
- `_AI_HANDOFFS/from_codex/MR-BRAND-TRANSITION-003_legacy_popup_live_deploy_report.md`

## Files Deployed
- Local source: `wp-content/mu-plugins/missionmed-mr-legacy-popup.php`
- Live target: `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-mr-legacy-popup.php`

## Files Intentionally Untouched
- WooCommerce, LearnDash, auth/login/logout/session systems, Arena, STAT, Drills, Daily, Matrix, Dashboard, Scheduler, Calendar, File Vault, StoryForge, USCE, Webex, payments, checkout, enrollment, memberships, course access, user roles, database schema, Supabase, Railway, R2, CDN static app files, unrelated WordPress pages, DreamHost, DNS, MissionResidency.com, and Cloudflare redirects/email routing.
- Local backup PHP files under `wp-content/mu-plugins/*BACKUP*.php` were intentionally not committed or deployed, because deploying backup PHP files inside MU-plugins could load them as production code.

## Backup Paths
- Reused MR002 backups:
  - `CHANGELOG/CHANGELOG_MASTER_BACKUP_20260524T013025Z_MR-BRAND-TRANSITION-002.md`
  - `_AI_HANDOFFS/from_codex/MR-BRAND-TRANSITION-002_legacy_redirect_popup_implementation_BACKUP_20260524T015145Z_MR-BRAND-TRANSITION-002.md`
  - `wp-content/mu-plugins/missionmed-mr-legacy-popup_BACKUP_20260524T014118Z_MR-BRAND-TRANSITION-002.php`
  - `wp-content/mu-plugins/missionmed-mr-legacy-popup_BACKUP_20260524T014402Z_MR-BRAND-TRANSITION-002.php`
- Created MR003 backup:
  - `CHANGELOG/CHANGELOG_MASTER_BACKUP_20260524T122842Z_MR-BRAND-TRANSITION-003.md`
- Remote backup: not created because the live MU-plugin target did not exist before deploy.

## Diff Summary
- Implementation commit `c2cf7f4`: 3 files changed, 722 insertions; new MU-plugin, MR002 handoff, changelog entry.
- MR003 documentation changes: changelog live-deploy entry and this handoff report.

## Deployment Method
- Verified remote target was absent before upload.
- Uploaded local MU-plugin to Kinsta temporary path via `scp`.
- Installed from `/tmp/missionmed-mr-legacy-popup.MR-BRAND-TRANSITION-003.php` to:
  - `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-mr-legacy-popup.php`
- Set mode `0644`; group set to `www-data`.
- Remote PHP lint:
  - `No syntax errors detected in /www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-mr-legacy-popup.php`
- Remote SHA-256:
  - `1d9513b72b532cb7daaf74106d9aba9472f27304e2d794015d3e24f9b2f7020f`
- Local committed SHA-256 matched the remote hash.

## Cache Purge
- `wp kinsta cache purge` exposes only broad `--site`, `--cdn`, `--object`, and `--all` flags, so no public exact-page WP-CLI flag was available.
- Production Kinsta MU-plugin internals expose a single-path purge request format.
- Used exact single-path Kinsta immediate purge for:
  - `missionmedinstitute.com/mission-residency/`
- Purge response:
  - `response_code: 200`
  - `error_code: 0`
  - `error_message: ""`
- Broad site/CDN/object purge was not used.

## Live Source/Runtime Proof
- Trigger page rendered popup runtime script:
  - `script id="mm-mr-legacy-popup-js"`
  - `window.__MM_MR_LEGACY_POPUP_VERSION = "MR-BRAND-TRANSITION-002_20260524T013025Z"`
- No-param Mission Residency page rendered the scoped script but did not display the popup/banner because the query gate was absent.
- `/about/` did not render the popup runtime version.
- Live accessibility source check confirmed:
  - desktop role string includes `role="dialog" aria-modal="true" aria-labelledby="mm-mr-legacy-title" aria-describedby="mm-mr-legacy-copy"`
  - close button string includes `aria-label="Close Mission Residency update"`
  - mobile region string includes `role="region" aria-label="Mission Residency update"`

## Live Browser Verification
- Browser method: fresh headless Chrome profile with DevTools Protocol, storage/cookie reset between scenarios.
- Evidence JSON:
  - `_SYSTEM_LOGS/MR-BRAND-TRANSITION-003/browser-results.json`
- Screenshots:
  - `_SYSTEM_LOGS/MR-BRAND-TRANSITION-003/live_desktop_trigger_modal.png`
  - `_SYSTEM_LOGS/MR-BRAND-TRANSITION-003/live_suppression_reload_no_popup.png`
  - `_SYSTEM_LOGS/MR-BRAND-TRANSITION-003/live_no_param_no_popup.png`
  - `_SYSTEM_LOGS/MR-BRAND-TRANSITION-003/live_about_no_popup.png`
  - `_SYSTEM_LOGS/MR-BRAND-TRANSITION-003/live_mobile_inline_banner.png`
  - `_SYSTEM_LOGS/MR-BRAND-TRANSITION-003/live_cta_after_scroll.png`

## Exact URLs Tested
- `https://missionmedinstitute.com/mission-residency/?legacy_source=missionresidency`
- `https://missionmedinstitute.com/mission-residency/`
- `https://missionmedinstitute.com/about/`

## Test Results
- Desktop trigger result: PASS
  - URL: `/mission-residency/?legacy_source=missionresidency`
  - `rootPresent: true`
  - `rootClass: "mm-mr-legacy-overlay"`
  - `modalPresent: true`
  - headline: `Welcome home.`
  - CTA: `Explore Mission Residency at MissionMed`
  - localStorage: `mr_legacy_popup_seen=true`
  - cookie: `mr_legacy_popup_seen=true`
- Normal no-param result: PASS
  - URL: `/mission-residency/`
  - `rootPresent: false`
  - localStorage not set
  - cookie not set
- Unrelated page result: PASS
  - URL: `/about/`
  - `rootPresent: false`
  - popup runtime version absent
- Suppression result: PASS
  - Dismissed via `Got it, thanks`.
  - Reloaded trigger URL.
  - `rootPresent: false`
  - localStorage remained `true`
  - cookie remained `true`
- Mobile result: PASS with reservation
  - Viewport: 390 x 800, under 600px.
  - `rootPresent: true`
  - `rootClass: "mm-mr-legacy-banner-wrap"`
  - `modalPresent: false`
  - localStorage and cookie set.
  - Reservation: an existing, pre-existing mobile notice saying "Get the full MissionMed experience on desktop" visually overlaps the top portion of the new inline banner in the screenshot. This was not caused or modified by this task.
- CTA scroll result: PASS
  - CTA click dismissed the popup and scrolled to `#programs`.
  - After click: `scrollY: 12844`, `programsTop: 11`.
- Console result: PASS
  - Captured console errors/warnings in tested scenarios: `0`
  - Popup-related console errors: `0`

## Regression Spot Check
- Mission Residency page loaded normally.
- `/about/` loaded normally and did not include the popup runtime.
- Visible interactive elements remained present on Mission Residency page.
- No WooCommerce, LearnDash, auth, Arena, Matrix, or unrelated production modules were modified.

## QA Reset Note
- To reset the popup in a browser during QA:
  - In DevTools console on `https://missionmedinstitute.com`, run:
    - `localStorage.removeItem('mr_legacy_popup_seen'); document.cookie='mr_legacy_popup_seen=; Max-Age=0; path=/';`
  - Reload `https://missionmedinstitute.com/mission-residency/?legacy_source=missionresidency`.

## Rollback Plan
1. Remove the deployed file:
   - `/www/theresidencyacademy_209/public/wp-content/mu-plugins/missionmed-mr-legacy-popup.php`
2. Purge only:
   - `https://missionmedinstitute.com/mission-residency/`
3. Optional git rollback:
   - revert commit `c2cf7f4` or remove the MU-plugin file in a follow-up commit.

## Remaining Risks
- Existing mobile desktop-experience notice can overlap the top of the new mobile banner before that existing notice is dismissed.
- Kinsta public WP-CLI did not expose an exact URL purge flag; exact purge used the Kinsta MU-plugin internal single-path purge endpoint discovered on the live host.
- Local backup artifacts remain untracked and intentionally uncommitted.

## Confidence
- Confidence: 92%
- Reservation: confidence is not 100% because live mobile has a pre-existing overlay interaction outside this task's allowed scope, and because exact page purge relied on Kinsta MU-plugin internals rather than a public `wp kinsta cache purge --url` command.
