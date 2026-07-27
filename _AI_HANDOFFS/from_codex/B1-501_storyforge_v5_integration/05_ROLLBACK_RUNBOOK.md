# B1-501 Rollback Runbook

Status: **Each rollback stage verified locally. No production execution is authorized.**

## 1. Flag off

Set `missionmed_storyforge_settings.storyforge_enabled` to `false`.

Expected result:

- Navigation and tile disappear on the next server render.
- Bootstrap/token access fails closed with `storyforge_disabled`.
- Existing StoryForge data remains unchanged.

Local receipt:

```text
default_off_shortcodes=empty
flag_off_access_state=storyforge_disabled
```

## 2. Remove the edge route

Remove or disable only the `/storyforge/*` route binding; do not change the Matrix catch-all route.

Expected result:

- WordPress again owns the path.
- With no WordPress StoryForge page, `/storyforge/` returns the normal WP 404.
- Other WordPress permalinks remain available.

Local receipt:

```text
route_removed_wordpress_http=404
```

## 3. Deactivate the plugin

Deactivate `missionmed-storyforge-sso`.

Expected result:

- Deactivation forces the feature flag off.
- Tracked rate-limit transients are removed.
- No StoryForge navigation or token route remains registered.
- Deactivation does not delete user mappings or StoryForge data.

Local receipt:

```text
plugin_deactivation_forced_flag_off=true
```

## Order and authority

For a real deployment rollback, execute in this order: flag off, route removal, plugin deactivation. Before any B1-502 production action: **VERIFY LIVE FIRST. BACK UP LIVE FIRST. CREATE A PROVEN ROLLBACK POINT.** Resolve exact targets through the control-plane authority and retain before/after receipts.
