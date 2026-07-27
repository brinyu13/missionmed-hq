# MissionMed StoryForge SSO

This default-off plugin is the B1-501 WordPress seam. It:

- obtains the user exclusively from the live WordPress session;
- re-checks 360 eligibility or mentor assignment on every token issuance;
- uses a WordPress REST nonce plus same-origin validation;
- issues a short-lived, purpose-bound HS256 JWT without exposing the signing secret;
- contributes the StoryForge Matrix navigation item and dashboard tile only for enabled, entitled users;
- disables issuance and removes rate-limit state on deactivation.

The production signing secret must come from `STORYFORGE_JWT_SECRET` in the server environment or a protected WordPress constant. The plugin never stores it in an option.

The WordPress-to-StoryForge UUID mapping is read from `_missionmed_storyforge_user_id`. Missing mappings fail closed. Mentor assignments are read from `_missionmed_storyforge_student_ids` and may be replaced by the `missionmed_storyforge_mentor_student_ids` filter when the production assignment owner is pinned.

Local fixtures require both `WP_ENVIRONMENT_TYPE=local` and the explicit `MISSIONMED_STORYFORGE_LOCAL_FIXTURES` constant. They are unavailable in staging and production.
