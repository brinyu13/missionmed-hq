# B1-510H Root Cause and Route Map

## Verdict

The production defect is proven. Two active StoryForge delivery paths use
different gates:

1. `/member-dashboard/#storyforge` mounts the protected Matrix Bootstrap Demo.
2. `/storyforge/` serves the accepted current StoryForge release.

The isolated StoryForge SSO adapter redirects the Matrix path only when
`mmsf_access_state()` succeeds. Production settings allowlist only WordPress
users 1 and 107, so a normal 360 student never receives that adapter.

## Obsolete path

The protected source is:

`/Users/brianb/MissionMed_worktrees/b1-storyforge-advanced-102-live-matrix-source-export/wp-content/plugins/missionmed-hub/assets/student-os-storyforge.js`

- lines 36-50 contain twelve static stories;
- lines 93-100 admit Matrix `student_bootstrap` users;
- lines 140-145 render `Bootstrap demo` and
  `Static sample data. Not persistent yet.`

The Matrix guard independently passed with approved, local, origin, and public
hashes equal:

- JavaScript: `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa`
- CSS: `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8`

This proves the obsolete interface is the active locked artifact, not browser
cache or a fallback after a failed current bootstrap.

## Canonical path

- URL: `https://missionmedinstitute.com/storyforge/`
- release: `v-a790ce4e3168384f`
- immutable release source: `1bb6e8b917d6993c4af08e9ff2408313835f123d`
- index SHA-256: `2071b79c42260b97b5369e26c7662b517d0ed67948e4d15d848e38c574fe5263`
- app SHA-256: `9aaf9d3670eea84ff41aa84859384c4bd945b753c80dd880601a9637fa8361df`
- route SHA-256: `2837cde673a9bb66d334c903053926c51cddf1582f6d52b698ab20e4964b616a`
- release PHP SHA-256: `01c6871355683ee87ce9e648480bb226ce0d393ef05cae77700943e086552f2f`

Public checks returned `CF-Cache-Status: DYNAMIC`, `X-Kinsta-Cache: BYPASS`,
and exact index/app bytes. Cache segmentation is not causal.

## Entitlement authority

- canonical LearnDash course ID: `3893`;
- live entitlement function: `mmhq_cam_build_entitlement()`;
- source SHA-256 and live SHA-256:
  `548d0b30ab341948c59411408f9b8aabd175941d0b5ca3a0a0f90af300f11c98`.

The function applies current enrollment, expiry, revocation, restriction, and
purchase-state checks. No WordPress “360 role” exists or was created.

## Second gate: identity mapping

Redirect alone is insufficient. The WordPress token bridge requires
`_missionmed_storyforge_user_id`, and PostgreSQL RLS binds the signed UUID and
WordPress ID to one eligible `sf_users` row. Production has 439 entitled
non-admin users and zero mappings among them. PostgreSQL has two `sf_users`
rows total.

Therefore an eligible student currently follows this exact causal path:

`active course 3893 -> Matrix student_bootstrap -> legacy renderer`

and direct entry follows:

`/storyforge/ -> current shell -> SSO user_not_enabled`

If only the route gate were deployed, the last step would become
`storyforge_identity_unmapped` rather than a working application.
