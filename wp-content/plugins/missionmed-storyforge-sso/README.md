# MissionMed StoryForge SSO

This default-off plugin is the B1-501 WordPress seam. It:

- obtains the user exclusively from the live WordPress session;
- requires an exact WordPress user ID allowlist that is empty and deny-all by default;
- re-checks 360 eligibility or mentor assignment on every token issuance;
- uses a WordPress REST nonce plus same-origin validation;
- issues a short-lived, purpose-bound HS256 JWT without exposing the signing secret;
- contributes the StoryForge Matrix navigation item and dashboard tile only for enabled, entitled users;
- redirects the existing Matrix `#storyforge` control to V5 only for the exact enabled account, without editing protected Matrix assets;
- disables issuance and removes rate-limit state on deactivation.

The production signing secret must come from `STORYFORGE_JWT_SECRET` in the server environment or a protected WordPress constant. The plugin never stores it in an option.

The WordPress-to-StoryForge UUID mapping is read from `_missionmed_storyforge_user_id`. Missing mappings fail closed. Mentor assignments are read from `_missionmed_storyforge_student_ids` and may be replaced by the `missionmed_storyforge_mentor_student_ids` filter when the production assignment owner is pinned.

`allowed_user_ids` is the server-enforced pilot boundary for navigation, bootstrap, and token issuance. `app_role_overrides` may map an exact allowlisted WordPress user ID to `student`, `mentor`, or `admin`. For the founder self-workflow, an exact founder administrator may be mapped to `student`; the JWT and database session then remain subject to student owner-only RLS and receive no admin private-story override. Other administrators remain denied unless their exact IDs are separately allowlisted.

Activation always forces `storyforge_enabled` to false while preserving the remaining settings. On the real member dashboard, `assets/matrix-launch.js` is enqueued only after the same server-side access check succeeds. Feature-off or plugin deactivation therefore restores the protected legacy `#storyforge` behavior without a `missionmed-hub` edit.

Local fixtures require both `WP_ENVIRONMENT_TYPE=local` and the explicit `MISSIONMED_STORYFORGE_LOCAL_FIXTURES` constant. They are unavailable in staging and production.
