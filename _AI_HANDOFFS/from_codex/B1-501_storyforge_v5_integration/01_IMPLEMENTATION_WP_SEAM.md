# Seam 1 — WordPress SSO and Navigation

Status: **IMPLEMENTED and locally verified.**

Implementation:

- `wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php`
- `wp-content/plugins/missionmed-storyforge-sso/uninstall.php`
- `wp-content/plugins/missionmed-storyforge-sso/README.md`

The plugin is default-off through `missionmed_storyforge_settings.storyforge_enabled`.

## Authentication

- Provides a cookie-authenticated AJAX bootstrap that returns a WordPress REST nonce and same-origin token endpoint.
- Provides `POST /wp-json/missionmed/v1/storyforge/token`.
- Checks request origin, REST nonce, live WordPress session, role/cohort enablement, and live server-side entitlement on every issuance.
- Rate limits by user and request IP.
- Signs short-TTL HS256 JWTs using only an environment variable or server constant.
- Emits B1-500-compatible identity claims: `sub`, `app_role`, `storyforge_eligible`, `wp_user_id`, and `name`.
- Requires an explicit UUID mapping and fails closed when identity, entitlement, or signing configuration is unavailable.
- Never places a service-role key or signing secret in the client.

## Entitlement and role mapping

- `manage_options` maps to the B1 application role `admin`.
- WP mentor/advisor/coach roles map to `mentor` and require at least one current assignment.
- Other eligible accounts map to `student` and are checked through `mmhq_cam_build_entitlement()` when that trusted owner is loaded.
- Allowed application roles and student cohorts are configurable and default closed through the master flag.
- The local fixture entitlement path requires both `WP_ENVIRONMENT_TYPE=local` and `MISSIONMED_STORYFORGE_LOCAL_FIXTURES=true`; it cannot silently activate in production.

## Matrix entry points

- Adds server-gated navigation and dashboard-tile filters.
- Adds two shortcodes for disposable/local verification.
- Adds a standard `wp_nav_menu_items` adapter for configured Matrix menu locations.
- Every rendering path reuses the same server-side access decision; hiding the link is not treated as authorization.

## Lifecycle

- Deactivation forces the feature flag off and deletes tracked rate-limit transients.
- Uninstall removes plugin options.
- Protected `missionmed-hub` files were not changed.
