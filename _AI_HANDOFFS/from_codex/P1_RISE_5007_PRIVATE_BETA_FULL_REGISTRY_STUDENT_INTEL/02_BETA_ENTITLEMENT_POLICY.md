# Private-Beta Entitlement Policy

The implementation accepts exactly:

- WordPress administrators;
- LearnDash course `3893` — 360 Match Mentorship;
- LearnDash course `3646` — IV Prep Complete.

The WordPress route checks `sfwd_lms_has_access()` server-side and fails closed if LearnDash cannot prove access. Its signed 60-second handoff carries the exact eligible course IDs plus `FULL_RISE_BETA_ACCESS`. HQ verifies the `rise` audience, recomputes bounded fields, rejects ineligible handoffs, and exposes only the exact RISE entitlement. The RISE adapter requires both the upstream beta assertion and `FULL_RISE_BETA_ACCESS` before minting `rise:read`, `rise:private-beta`, `rise:contribute`, and the bounded RISE depth capability.

No unrelated MissionMed entitlement is granted. Browser claims, product labels, and arbitrary course IDs cannot authorize access.

Files:

- `wp-content/mu-plugins/missionmed-rise-sso.php`
- `missionmed-hq/server.mjs`
- `rise/adapters/hq-auth.mjs`
- `rise/config/entitlements.v1.json`

Status: **implemented and locally verified; not live**.

